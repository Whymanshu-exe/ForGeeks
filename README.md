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

1. **Secure foundation:** GitHub OAuth, verified-email handling, provider-account records, PostgreSQL sessions, API security headers, tests, and an EC2 container/CI deployment path.
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

Pull requests run backend tests/schema validation and frontend lint/build in [ci-cd.yml](./.github/workflows/ci-cd.yml). A push to `main` deploys container images to an EC2 host through AWS Systems Manager.

The deployment uses Docker Compose and an Nginx reverse proxy on EC2. To use GitHub's OIDC-based AWS deployment, create the ECR repositories, deployment-artifact S3 bucket, IAM roles, and EC2 instance profile, then configure the repository variables and secret described in [deploy/README.md](./deploy/README.md).

**Cost note:** EC2 free-tier eligibility does not make an Application Load Balancer free. The first deployment keeps Nginx on one EC2 instance; add an AWS ALB only if you accept its additional hourly and usage charges. A production OAuth cookie also requires HTTPS.
