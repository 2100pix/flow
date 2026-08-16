# Flow

Flow is a project and task management application for teams.

**Current release:** `v0.1.0`

Flow is currently being validated in a real workspace before broader product development.

## Current Capabilities

- Discord authentication
- Workspace roles and permissions
- Client management
- Project management
- Private and workspace-visible projects
- Project members
- Task boards
- Custom task workflows
- Task assignment
- Dashboard
- Role-based access control
- Project-level privacy and ACL enforcement

## Stack

- React
- TypeScript
- Vite
- Hono
- Cloudflare Workers
- Cloudflare D1
- Drizzle ORM

## Development

Install dependencies:

```bash
npm install
```

Create local environment variables based on:

```text
.dev.vars.example
```

Run the development server:

```bash
npm run dev
```

## Validation

Run the project validation gates before committing or deploying:

```bash
npm run lint
npm run check
git diff --check
```

## Deployment

Flow is deployed on Cloudflare Workers.

Production:

```text
https://flow.normalbase.workers.dev
```

Deploy using the production environment configuration:

```bash
npx wrangler deploy --secrets-file .env.production.local
```

Environment and secret files must not be committed to the repository.

## Database

Flow uses Cloudflare D1.

Database migrations are stored in:

```text
drizzle/
```

Workspace seed data is stored in:

```text
scripts/seed.sql
```

Production migrations should only be applied after reviewing the pending migration set and validating database integrity.

## Versioning

`v0.1.0` represents the first production-verified MVP baseline.

Development after `v0.1.0` may introduce new product features, interface changes, and architecture changes without modifying the original MVP checkpoint.

## Status

**MVP v0.1.0 — Production Verified**
