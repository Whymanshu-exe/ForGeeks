# EC2 deployment setup

This deployment runs the React site and Express API as containers on one EC2 instance. Nginx serves the frontend and reverse-proxies `/api` requests to Express. PostgreSQL remains the configured external PostgreSQL/Supabase database.

## AWS resources to prepare

1. Create private ECR repositories named `gfg-rbu-backend` and `gfg-rbu-frontend`.
2. Create a private, versioned S3 bucket for deployment files. Restrict access to the GitHub deploy role and EC2 instance role.
3. Create an EC2 instance with Docker Engine and the Docker Compose plugin installed. Attach an instance profile with:
   - `AmazonSSMManagedInstanceCore` (or its least-privilege equivalent);
   - pull access to the two ECR repositories;
   - `s3:GetObject` access to the deployment-artifact bucket.
4. Prepare `/opt/geekgate/backend` on the instance and put the production backend environment in `/opt/geekgate/backend/.env`. Make it readable only by the deployment/runtime account. Do not copy `.env` into the repository or S3.
5. Add the instance to Systems Manager and ensure it can reach SSM, ECR, S3, and the database. Do not open SSH to the internet.
6. Put HTTPS in front of the instance. For a single instance, a TLS-terminating ALB is an option; configure its target group to port 80. The EC2 security group should allow port 80 only from the ALB security group.

The ALB is optional and is billed separately from EC2/free-tier usage. Nginx in this project is the single-instance reverse proxy; it does not make one EC2 instance highly available.

## Production environment

Set these in `/opt/geekgate/backend/.env`:

```dotenv
PORT=4000
NODE_ENV=production
BACKEND_URL=https://your-workspace-domain
FRONTEND_URL=https://your-workspace-domain
DATABASE_URL=your-postgresql-connection-string
SESSION_SECRET=at-least-32-random-characters
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.5-flash
```

Use the same HTTPS host for the frontend and API. Nginx routes `/api` to the backend and forwards the original `X-Forwarded-Proto` set by the HTTPS load balancer. In the GitHub OAuth app, set the callback URL to:

```text
https://your-workspace-domain/api/auth/github/callback
```

The database user needs permission to apply Prisma migrations and create the PostgreSQL-backed session table.

## GitHub repository configuration

Configure these **repository variables**:

- `AWS_REGION`: region containing ECR, S3, and EC2.
- `DEPLOY_BUCKET`: private S3 deployment-artifact bucket.
- `EC2_INSTANCE_ID`: target instance ID.

Configure this **repository secret**:

- `AWS_DEPLOY_ROLE_ARN`: IAM role trusted for GitHub Actions OIDC from this repository and its `main` branch.

The GitHub deploy role needs ECR image push permissions, `s3:PutObject` to the deployment bucket, `ssm:SendCommand` for the target instance, and `ssm:GetCommandInvocation`. Limit resource ARNs to the specific repositories, bucket, and instance where possible.

The workflow builds/pushes images, uploads the Compose/Nginx/deploy files, sends a command through SSM, runs `prisma migrate deploy`, restarts Compose, and checks `/api/health`.

## First owner setup

1. Sign in once through GitHub so the user is created.
2. Run the owner bootstrap command from the backend using the verified GitHub email:

   ```sh
   npm run seed:admin -- --email="your-verified-github-email"
   ```

This creates or reuses the `GFG RBU` workspace, grants that member `OWNER`, and ensures the default `GFG` project exists. Only an operator with access to the database environment should run this command.
