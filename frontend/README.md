# GFG RBU Workspace frontend

React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, and reusable shadcn-style UI primitives for the GFG RBU ticketing workspace.

## Run locally

```bash
npm install
npm run dev
```

The backend currently does not expose ticket, team, or authentication API routes. The frontend labels its sample ticket/domain/team data as preview data and saves ticket changes and preferences in this browser only. To enable the GitHub sign-in button, configure `VITE_GITHUB_AUTH_URL` with the URL for the backend OAuth flow; do not put provider secrets in frontend environment variables.

Check the production build with `npm run build`.
