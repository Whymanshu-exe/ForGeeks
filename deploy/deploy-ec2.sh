#!/bin/sh
set -eu

IMAGE_TAG="${1:-}"
case "$IMAGE_TAG" in
  ""|*[!0-9a-f]*)
    echo "Pass the lowercase hexadecimal commit SHA as the image tag." >&2
    exit 2
    ;;
esac

cd /opt/geekgate
export IMAGE_TAG

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

docker compose --env-file deploy.env pull
docker compose --env-file deploy.env run --rm backend npx prisma migrate deploy
docker compose --env-file deploy.env up -d --remove-orphans
curl --fail --retry 10 --retry-delay 3 http://127.0.0.1/api/health
