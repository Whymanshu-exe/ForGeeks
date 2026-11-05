# Backend setup

The API uses Express, Passport GitHub OAuth, Prisma, and PostgreSQL-backed Express sessions. See the repository [README](../README.md) for what each product area does and the phased implementation status. See [deploy/README.md](../deploy/README.md) for the EC2/GitHub Actions deployment setup.

## 1. Configure provider applications

Create a GitHub OAuth application and register this callback URL exactly:

- GitHub: `http://localhost:4000/api/auth/github/callback`

GitHub requests `read:user` and `user:email`.

For production, register your production API callback URLs with each provider and use HTTPS.

## 2. Configure environment variables

Add the variables from `.env.example` to your existing backend `.env` and fill in the values. Preserve your current `DATABASE_URL`. The app requires both `DATABASE_URL` and `SESSION_SECRET` to start; if either is missing, it exits with an explicit error. Keep OAuth client secrets only in the backend environment; do not use `VITE_` variables for secrets.

Generate a session secret with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set `DATABASE_URL` to the PostgreSQL connection string already used by Prisma. For Supabase, download the project's CA certificate from its dashboard into `backend/certs/prod-ca-2021.crt` and set `sslmode=verify-full&sslrootcert=/run/certs/prod-ca-2021.crt` in the URL query parameters. Docker Compose mounts this directory read-only into the API container. This validates both the certificate chain and server hostname; do not disable certificate verification. The certificate is ignored by Git. `SESSION_SECRET` must be at least 32 characters in production. The session store creates its `session` table automatically; the database role needs permission to create it.

In the frontend, set `VITE_API_URL=http://localhost:4000` if the API is not at that default URL. The production container uses an empty value so the browser uses the same-origin `/api` path. Add `GEMINI_API_KEY` only to the backend environment to enable the workspace assistant; optionally set `GEMINI_MODEL` (defaults to `gemini-3.5-flash`). Never add the Gemini key to frontend environment variables.

## 3. Apply database migrations and start the API

From `backend/`:

```sh
npx prisma migrate dev
npx prisma generate
npm run dev
```

`migrate dev` applies all pending local migrations, including the OAuth account and workspace ticketing migrations. For a deployed database, apply committed migrations with `npx prisma migrate deploy` as part of deployment; do not use `migrate dev` in production. The development command runs Nodemon, which automatically restarts the API when backend files change. The OAuth migration maps each provider's stable user ID to an application user and does not store provider access tokens.

## Workspace APIs

All workspace routes require a GitHub-authenticated session and workspace membership. State-changing requests also require the configured frontend `Origin`.

- `GET /api/workspace`, `GET /api/profile`, `PATCH /api/profile`
- `GET /api/dashboard`, `GET /api/projects`, `POST /api/projects` (OWNER/ADMIN)
- `GET /api/tickets` with `q`, `projectId`, `status`, `priority`, `assigneeId`, `mine`, `sort`, `page`, and `limit` filters; results are limited to tickets created in the last 14 days, 20 per page by default
- `POST /api/tickets`, `GET /api/tickets/:id-or-key`, `PATCH /api/tickets/:id-or-key`
- `GET /api/tickets/export/completed.csv` streams all resolved/closed tickets in the current workspace in CSV batches
- `POST /api/tickets/:id-or-key/comments`
- `GET /api/team`, `GET /api/team/assignees` (lean member list), `PATCH /api/team/:userId/role` (OWNER only)
- `GET /api/activity?page=1&limit=15` (paginated; maximum 20 per page), `POST /api/assistant`

Ticket updates are workspace-scoped; assignment requires an OWNER/ADMIN and the assignee must belong to the same workspace. Ticket and comment changes write activity records transactionally. Gemini receives only the current workspace's latest 50 tickets; the provider key stays on the server.

## Auth routes

- `GET /api/auth/github` starts sign-in.
- `GET /api/auth/me` returns the signed-in user or `401`.
- `POST /api/auth/logout` ends the session. Send the frontend origin and credentials.
- `GET /api/health` is a basic health check.

The frontend should call `/api/auth/me` with credentials included. An already-used email is not silently linked to the GitHub identity; explicit account linking should be a separate authenticated flow.

After the first GitHub sign-in, bootstrap an owner using the verified email:

```sh
npm run seed:admin -- --email="your-verified-github-email"
```

The bootstrap command creates or reuses the GFG RBU workspace, grants the user the OWNER role, and creates the default project. After the workspace exists, GitHub sign-ins automatically add users who are not yet members with the MEMBER role. Existing membership roles are preserved; an owner or admin does not get demoted on subsequent sign-ins.

Run the backend tests with `npm test`. Tests cover OAuth identity, workspace membership, ticket creation, origin checks, role enforcement, and Gemini configuration. PostgreSQL integration tests verify sessions and provider identity; CI runs them against an ephemeral PostgreSQL service. Apply migrations before testing against a database. CI also validates the Prisma schema and builds/lints the frontend.
