# Automated Docker deployment to EC2

Every push to `main` runs backend tests/schema validation and frontend lint/build. When both pass, GitHub Actions builds `linux/amd64` images and publishes immutable, commit-tagged images to GitHub Container Registry (GHCR). A lightweight systemd timer on EC2 checks the latest `main` commit every two minutes, pulls the matching images, applies Prisma migrations, recreates the containers, and checks health.

The EC2 instance polls GitHub; GitHub does not SSH into the instance. No ECR, S3, ALB, NAT Gateway, or Systems Manager is used. PostgreSQL remains external. Keep the instance's SSH rule restricted to your own IP.

## Requirements and cautions

- The instance is Ubuntu 24.04 with Docker Engine, Docker Compose, Git, Python 3, curl, and host Nginx installed. The `ubuntu` user must be able to run Docker.
- Builds run on GitHub-hosted runners, not on the 1 GiB EC2 instance.
- Keep inbound ports 80 and 443 open for the website. Do not expose ports 4000, 5432, or 8080. Restrict SSH (22) to your own IP.
- Every successful push to `main` can deploy automatically. Review migrations carefully and keep a PostgreSQL backup before deploying schema changes; the workflow does not back up the database.
- Keep `backend/.env` and `backend/certs/prod-ca-2021.crt` on EC2. They are not copied from GitHub and must remain ignored by Git.
- The timer retains the current and previous successful image versions and removes older GeekGate image tags after a healthy deployment.

## 1. Configure GitHub Container Registry

The workflow publishes:

```text
ghcr.io/whymanshu-exe/forgeeks-backend:<commit-sha>
ghcr.io/whymanshu-exe/forgeeks-frontend:<commit-sha>
```

The workflow also updates each image's `latest` tag for convenient manual Compose commands. The automated timer deploys the immutable commit-SHA tags.

The workflow uses the repository's `GITHUB_TOKEN` with package-write permission. In GitHub, verify the published container packages are associated with this repository. For private packages, create a GitHub Personal Access Token (classic) with only `read:packages` and access to those packages; configure SSO authorization if GitHub requires it. Do not paste the token into chat or commit it.

For a public repository, the EC2 instance can fetch the public main-branch commit without a GitHub API token. For a private repository, provide a read-only token that can read repository contents; the same token can authenticate an HTTPS Git remote. Alternatively configure a read-only SSH deploy key on EC2.

## 2. Prepare the EC2 checkout and app configuration

The following commands assume the existing checkout is `/home/ubuntu/ForGeeks`:

```sh
cd ~/ForGeeks
git status --short
git pull --ff-only origin main
```

If `git status` reports tracked changes, review and resolve them before proceeding; the deployment script checks out each deployed commit. Ignored files such as `backend/.env` and the database CA certificate remain on the instance.

Keep the application environment file at `~/ForGeeks/backend/.env`. It must contain production values, including `DATABASE_URL`, a random `SESSION_SECRET` of at least 32 characters, GitHub OAuth credentials, and:

```dotenv
NODE_ENV=production
PORT=4000
BACKEND_URL=https://your-public-https-origin
FRONTEND_URL=https://your-public-https-origin
```

For Supabase TLS, keep `sslmode=verify-full` and set `sslrootcert=/run/certs/prod-ca-2021.crt` in `DATABASE_URL`. The certificate must exist at `~/ForGeeks/backend/certs/prod-ca-2021.crt`; Compose mounts that directory read-only at `/run/certs`.

## 3. Configure EC2 registry and polling credentials

Create a private systemd environment file:

```sh
sudo install -o ubuntu -g ubuntu -m 600 /dev/null /etc/geekgate-deploy.env
nano /etc/geekgate-deploy.env
```

Add these values (use the actual GitHub username for `GHCR_USERNAME`):

```dotenv
DEPLOY_PATH=/home/ubuntu/ForGeeks
GITHUB_REPOSITORY=Whymanshu-exe/ForGeeks
GHCR_OWNER=whymanshu-exe
GHCR_USERNAME=your-github-username
GHCR_READ_TOKEN=your-read-packages-token
```

For a public repository, `GITHUB_READ_TOKEN` is not needed. For a private repository, add a read-only token as `GITHUB_READ_TOKEN` with permission to read the repository; the deployment script uses it to find the current `main` commit and fetch that commit. If the GHCR images are public, `GHCR_READ_TOKEN` can also be omitted. Keep this file private and never print it or commit it.

Check that the `origin` remote in the EC2 checkout can fetch the repository. The systemd service runs as `ubuntu`, so any SSH deploy key or HTTPS credentials must be configured for that user.

## 4. Enable the EC2 deployment timer

From the repository root on EC2:

```sh
sudo cp deploy/geekgate-deploy.service /etc/systemd/system/
sudo cp deploy/geekgate-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now geekgate-deploy.timer
sudo systemctl start geekgate-deploy.service
```

The first run deploys the current `main` commit. Confirm that GitHub Actions completed successfully and published both images before starting the service. Check status and logs without showing environment-file contents:

```sh
sudo systemctl status geekgate-deploy.timer
sudo systemctl status geekgate-deploy.service
sudo journalctl -u geekgate-deploy.service -n 80 --no-pager
docker compose ps
curl --fail http://127.0.0.1:8080/api/health
```

The timer checks every two minutes. If CI has not yet finished publishing images for the newest commit, that check fails safely and a later check retries. A migration or health-check failure is recorded so the same commit is not repeatedly restarted. After correcting the cause, retry it with:

```sh
rm -f ~/.local/state/geekgate-deploy/last-attempted-sha
sudo systemctl start geekgate-deploy.service
```

## 5. Deploy updates

Make and test changes locally, then push them to `main`. Once backend tests, Prisma validation/migrations, and frontend checks pass, GitHub Actions publishes both images. EC2 detects the new `main` commit on its next timer run and deploys it automatically.

The timer fetches the exact commit corresponding to the images and checks it out in detached-HEAD state. Do not run `git pull` on EC2 as part of normal deployments. Continue to make code changes locally.

The frontend is built with an empty `VITE_API_URL`, so it uses same-origin `/api` requests and does not need a rebuild when the domain or HTTPS tunnel hostname changes. Keep `BACKEND_URL`, `FRONTEND_URL`, GitHub OAuth callback URL, and the current public HTTPS origin aligned in their respective settings. The backend `.env` is not overwritten by deployment.

## 6. OAuth and HTTPS

Use a public HTTPS origin for production OAuth and secure session cookies. Configure the GitHub OAuth callback as:

```text
https://your-public-host/api/auth/github/callback
```

The EC2 host Nginx should proxy to `127.0.0.1:8080`. See [nginx-geekgate.conf.example](./nginx-geekgate.conf.example). Temporary Cloudflare Quick Tunnel URLs change when restarted; if one changes, update the GitHub OAuth callback and `BACKEND_URL`/`FRONTEND_URL` in the EC2 backend environment, then recreate the backend container.

## 7. Bootstrap the workspace owner

After signing in once with GitHub, grant your verified account owner access:

```sh
cd ~/ForGeeks
docker compose run --rm backend npm run seed:admin -- --email="your-verified-github-email"
```

Do not run this with an email that you have not verified as yours.
