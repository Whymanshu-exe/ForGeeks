# GFG RBU Workspace

GFG RBU Workspace is a developer-community ticketing platform for coordinating contributors, projects, and engineering work.

## What the product areas do

| Area | Purpose | Current implementation |
|---|---|---|
| Sign-in | Authenticate members with GitHub and maintain a secure server-side session. | GitHub OAuth routes and PostgreSQL session storage are implemented. |
| Workspace and roles | Give members shared access to projects and enforce owner/admin/member permissions. | Workspace membership checks, project creation, and role changes are available; invitations are not implemented. |
| Tickets | Create, assign, search, prioritize, and move work through its lifecycle. | Authenticated workspace-scoped ticket APIs and frontend flows are available. |
| Discussion and activity | Keep ticket comments and a traceable history of important changes. | Comments and activity records are persisted and shown in the frontend. |
| Team and projects | Show contributors, their roles, and the projects they work on. | Live project/member lists and role management are available. |
| AI assistant | Answer questions using only ticket data the current member can access. | Gemini endpoint and frontend are available when `GEMINI_API_KEY` is configured on the backend. |
| Settings and help | Let a member view account/workspace information and find workflow guidance. | GitHub profile display name can be updated; notification/workspace settings remain future work. |

## Delivery phases

1. **Secure foundation:** GitHub OAuth, verified-email handling, provider-account records, PostgreSQL sessions, API security headers, tests, and an EC2 container/CI validation path.
2. **Shared ticketing (implemented):** workspace-scoped APIs, role checks, ticket lifecycle changes, comments, activity, projects, team membership, and connected frontend pages.
3. **Gemini assistant (implemented):** server-side Gemini calls with workspace-scoped ticket context, citations, and configuration/error handling.
4. **Next:** invitations, richer settings, rate limiting/usage quotas, pagination, and broader production operations.

## Run locally

Use the instructions in [backend/README.md](./backend/README.md). The frontend can run with:

```sh
cd frontend
npm ci
npm run dev
```

The backend runs at `http://localhost:4000`; the Vite frontend runs at `http://localhost:5173`.

## CI/CD and AWS

Pull requests and pushes to `main` run backend tests/schema validation and frontend lint/build in [ci-cd.yml](./.github/workflows/ci-cd.yml). Deployment is a manual local-image transfer to EC2; GitHub Actions does not access AWS or deploy the application.

The deployment uses Docker Compose behind the existing EC2 host Nginx and keeps PostgreSQL external. See [deploy/README.md](./deploy/README.md) for building x86-64 images locally, transferring them to the instance, configuring HTTPS, and applying Prisma migrations. No ECR, S3, ALB, or Systems Manager resources are required.

The demonstration deployment requires HTTPS for secure OAuth session cookies. The `t3.micro` has limited memory and disk; images are built off-instance, and Compose limits resources and Docker log growth.
