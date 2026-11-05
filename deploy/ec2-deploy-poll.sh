#!/usr/bin/env bash
set -Eeuo pipefail

: "${DEPLOY_PATH:?DEPLOY_PATH must be set}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set}"
: "${GHCR_OWNER:?GHCR_OWNER must be set}"
: "${GHCR_USERNAME:?GHCR_USERNAME must be set}"

cd "$DEPLOY_PATH"

target_sha="$(
  python3 - <<'PY'
import json
import os
import re
import urllib.request

repository = os.environ["GITHUB_REPOSITORY"]
if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
    raise SystemExit("GITHUB_REPOSITORY is not a valid owner/repository")

request = urllib.request.Request(
    f"https://api.github.com/repos/{repository}/commits/main",
    headers={"Accept": "application/vnd.github+json"},
)
token = os.environ.get("GITHUB_READ_TOKEN")
if token:
    request.add_header("Authorization", f"Bearer {token}")

with urllib.request.urlopen(request, timeout=20) as response:
    commit = json.load(response)["sha"]

if not re.fullmatch(r"[a-f0-9]{40}", commit):
    raise SystemExit("GitHub returned an invalid main commit SHA")
print(commit)
PY
)"

state_dir="${HOME}/.local/state/geekgate-deploy"
mkdir -p "$state_dir"
success_file="$state_dir/last-successful-sha"
attempt_file="$state_dir/last-attempted-sha"

if [[ -f "$success_file" ]] && [[ "$(cat "$success_file")" == "$target_sha" ]]; then
  exit 0
fi

if [[ -f "$attempt_file" ]] && [[ "$(cat "$attempt_file")" == "$target_sha" ]]; then
  echo "Deployment of $target_sha previously failed; inspect the service logs and clear $attempt_file to retry."
  exit 1
fi

if [[ -n "${GITHUB_READ_TOKEN:-}" ]]; then
  askpass="$(mktemp)"
  trap 'rm -f "$askpass"' EXIT
  cat >"$askpass" <<'ASKPASS'
#!/bin/sh
case "$1" in
  *Username*) printf '%s\n' "x-access-token" ;;
  *Password*) printf '%s\n' "$GITHUB_READ_TOKEN" ;;
  *) exit 1 ;;
esac
ASKPASS
  chmod 700 "$askpass"
  GIT_ASKPASS="$askpass" GIT_TERMINAL_PROMPT=0 git fetch --no-tags origin "$target_sha"
  rm -f "$askpass"
  trap - EXIT
else
  git fetch --no-tags origin "$target_sha"
fi
git checkout --detach "$target_sha"

logged_in=0
cleanup() {
  if (( logged_in )); then
    docker logout ghcr.io >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ -n "${GHCR_READ_TOKEN:-}" ]]; then
  printf '%s' "$GHCR_READ_TOKEN" |
    docker login ghcr.io --username "$GHCR_USERNAME" --password-stdin
  logged_in=1
fi

export GHCR_OWNER="${GHCR_OWNER,,}"
export IMAGE_TAG="$target_sha"
docker compose pull
if (( logged_in )); then
  docker logout ghcr.io >/dev/null
  logged_in=0
fi

printf '%s\n' "$target_sha" >"$attempt_file"
docker compose run --rm backend npx prisma migrate deploy
docker compose up -d --force-recreate

healthy=0
for _ in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 5 http://127.0.0.1:8080/api/health; then
    healthy=1
    break
  fi
  sleep 2
done

docker compose ps
if (( ! healthy )); then
  echo "Deployment health check failed. The deployment will not be retried until the attempt marker is cleared or main advances."
  exit 1
fi

previous_sha=""
if [[ -f "$success_file" ]]; then
  previous_sha="$(cat "$success_file")"
fi

older_sha=""
if [[ -f "$state_dir/previous-successful-sha" ]]; then
  older_sha="$(cat "$state_dir/previous-successful-sha")"
fi

if [[ "$older_sha" =~ ^[a-f0-9]{40}$ ]]; then
  docker image rm \
    "ghcr.io/$GHCR_OWNER/forgeeks-backend:$older_sha" \
    "ghcr.io/$GHCR_OWNER/forgeeks-frontend:$older_sha" >/dev/null 2>&1 || true
fi

if [[ "$previous_sha" =~ ^[a-f0-9]{40}$ ]]; then
  printf '%s\n' "$previous_sha" >"$state_dir/previous-successful-sha"
else
  rm -f "$state_dir/previous-successful-sha"
fi
printf '%s\n' "$target_sha" >"$success_file"
rm -f "$attempt_file"
echo "Deployed $target_sha successfully."
