# Manual Docker deployment to EC2

This demonstration setup builds both images on a local Ubuntu machine, transfers them directly to an Ubuntu 24.04 EC2 `t3.micro`, and runs them with Docker Compose. The existing host Nginx terminates HTTPS and proxies to the frontend container. PostgreSQL remains external. No ECR, S3, ALB, NAT Gateway, or AWS Systems Manager is used.

## Requirements and limits

- Local machine: Docker Engine/BuildKit and `docker compose`; build images for `linux/amd64` (the EC2 architecture).
- EC2: Ubuntu 24.04, Docker Engine, Docker Compose plugin, Git, host Nginx, and an inbound security group allowing HTTPS (443) and HTTP (80 for redirect/certificate renewal). Restrict SSH (22) to your own IP.
- Do not expose ports 4000 or 5432 publicly. Compose exposes the frontend only at `127.0.0.1:8080`; the backend is reachable only inside the Compose network.
- A `t3.micro` with 1 GiB RAM and an 8 GiB root disk is suitable only for a small demonstration. Image builds happen locally. Compose caps the API at 512 MiB and frontend at 128 MiB, and rotates container logs. Monitor available memory and disk.

## 1. Prepare the repository and backend configuration on EC2

Clone the repository before creating the ignored `.env` file, or update the existing checkout:

```sh
sudo install -d -o ubuntu -g ubuntu /opt/geekgate
git clone YOUR_REPOSITORY_URL /opt/geekgate
# For an existing checkout:
cd /opt/geekgate && git pull
```

If the repository is private, configure Git SSH access securely; never put a personal access token in the clone URL.

Create `/opt/geekgate/backend/.env` on the instance and protect it:

```sh
sudo install -d -o ubuntu -g ubuntu -m 755 /opt/geekgate/backend/certs
sudo install -o ubuntu -g ubuntu -m 600 /dev/null /opt/geekgate/backend/.env
sudoedit /opt/geekgate/backend/.env
```

The `.env` must be readable by the user running `docker compose` on the host. The example makes `ubuntu` its owner and keeps it private. The CA certificate is public data; ensure the container's non-root Node user can read it (file mode `644`).

Set the following values in that file:

```dotenv
NODE_ENV=production
PORT=4000
BACKEND_URL=https://your-domain.example
FRONTEND_URL=https://your-domain.example
DATABASE_URL=your-postgresql-connection-string
SESSION_SECRET=at-least-32-random-characters
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.5-flash
```

Generate a unique session secret locally with `openssl rand -hex 32`; transfer it securely and do not commit it. The Gemini key is optional if you do not want the assistant. Keep all secrets in the backend `.env`, not in the frontend or Docker build arguments.

For Supabase, use `sslmode=verify-full` in `DATABASE_URL` and download the project CA certificate into `/opt/geekgate/backend/certs/prod-ca-2021.crt`. The host certificate directory is mounted read-only at `/run/certs` in the API container, so set the URL parameter to `sslrootcert=/run/certs/prod-ca-2021.crt`. Do not disable TLS certificate validation. The certificate is ignored by Git.

If needed, install the downloaded CA certificate with:

```sh
sudo install -o ubuntu -g ubuntu -m 644 /path/to/downloaded-ca.crt /opt/geekgate/backend/certs/prod-ca-2021.crt
```

Ensure `/opt/geekgate/backend/.env` and the certificate remain present when updating the checkout. The root `.gitignore` excludes the backend env file; verify permissions and paths before starting containers.

## 2. Build images locally

Run these commands from the repository root on the local Ubuntu machine:

```sh
docker build --platform linux/amd64 -t geekgate-backend:demo ./backend
docker build --platform linux/amd64 --build-arg VITE_API_URL= -t geekgate-frontend:demo ./frontend
docker save geekgate-backend:demo geekgate-frontend:demo | gzip -1 > geekgate-images.tar.gz
```

The empty frontend API URL is intentional: the browser calls `/api` on the current HTTPS domain, without needing a domain-specific rebuild. Do not pass backend secrets into either build.

## 3. Transfer and load images

Replace the SSH user and host with your instance's Ubuntu user and public IP or DNS:

```sh
scp geekgate-images.tar.gz ubuntu@YOUR_EC2_HOST:/tmp/geekgate-images.tar.gz
ssh ubuntu@YOUR_EC2_HOST
```

On EC2, load the images and immediately remove the archive:

```sh
sudo sh -c 'gzip -dc /tmp/geekgate-images.tar.gz | docker load'
rm -f /tmp/geekgate-images.tar.gz
```

The `docker` commands above assume the `ubuntu` user is in the `docker` group. If not, prefix Docker and Compose commands with `sudo`. Membership in the Docker group grants root-equivalent privileges.

## 4. Apply migrations and start the app

On EC2:

```sh
cd /opt/geekgate
docker compose run --rm backend npx prisma migrate deploy
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1:8080/api/health
```

The Compose file uses locally loaded `geekgate-backend:demo` and `geekgate-frontend:demo` images. The backend does not publish a host port. Prisma migration deployment uses the Prisma CLI included in the backend image; Node.js/npm are not required on the EC2 host.

## 5. Configure host Nginx and HTTPS

Point your domain's DNS A/AAAA record at the instance. Obtain a TLS certificate using your preferred ACME client, then copy [nginx-geekgate.conf.example](./nginx-geekgate.conf.example) to `/etc/nginx/sites-available/geekgate`, replace `your-domain.example` and certificate paths, enable the site, and validate/reload Nginx:

```sh
sudo ln -s /etc/nginx/sites-available/geekgate /etc/nginx/sites-enabled/geekgate
sudo nginx -t
sudo systemctl reload nginx
```

If the default Nginx site also claims the same host, disable that site before reloading. The sample config redirects HTTP to HTTPS and proxies to the frontend container at `127.0.0.1:8080`. It forwards `X-Forwarded-Proto: https`; Express trusts one proxy hop in production so its secure session cookie works.

In the GitHub OAuth app, set the callback URL exactly to:

```text
https://your-domain.example/api/auth/github/callback
```

The app's `BACKEND_URL` and `FRONTEND_URL` must match the public HTTPS origin. `FRONTEND_URL` is also used for credentialed CORS and allowed mutation origins.

## 6. Bootstrap the workspace owner

After HTTPS and OAuth are working, sign in once with GitHub to create your user. Then run on EC2, replacing the email with the verified email returned by your GitHub sign-in:

```sh
cd /opt/geekgate
docker compose run --rm backend npm run seed:admin -- --email="your-verified-github-email"
```

This grants the user the OWNER role in the `GFG RBU` workspace and ensures the default project exists. Do not run this with an email that you have not verified as yours.

## 7. Deploy an update

Rebuild both images locally with the same tags, transfer and load the new archive, then on EC2 run:

```sh
cd /opt/geekgate
docker compose run --rm backend npx prisma migrate deploy
docker compose up -d
docker compose ps
docker image prune
```

Review the images selected by `docker image prune` before confirming if you need to retain rollback images. Keep a separate backup of PostgreSQL before applying schema changes; EC2 image transfer is not a database backup.

GitHub Actions runs tests and builds but does not deploy. The previous ECR/S3/SSM deployment has been removed to match this no-additional-AWS-services workflow.
