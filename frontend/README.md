# GFG RBU Workspace frontend

React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, and reusable shadcn-style UI primitives for the GFG RBU ticketing workspace.

## Run locally

```bash
npm install
npm run dev
```

The login screen starts the backend GitHub OAuth flow. Set `VITE_API_URL` to the backend origin in `.env.local` for local development (defaults to `http://localhost:4000`). In the single-origin EC2 deployment, leave it empty so requests use `/api` on the same host. Never put OAuth secrets in frontend environment variables.

Workspace screens use authenticated backend APIs for tickets, projects, team membership, activity, profile updates, and Gemini assistant requests. The Gemini key must be configured on the backend and is never sent to the browser. On startup, the app removes stale `gfg-rbu-demo-tickets` and `gfg-rbu-demo-preferences` entries from earlier preview versions.

Check the production build with `npm run build`.
