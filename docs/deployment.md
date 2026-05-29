# Deployment

## GitHub Pages Static Demo

This repository includes a no-card static demo powered by GitHub Pages:

https://cc-c122.github.io/AI-PR-Reviewer/

The Pages workflow builds only `apps/web` with:

```text
GITHUB_PAGES=true
VITE_DEMO_MODE=true
```

In demo mode, the frontend validates GitHub PR URLs and renders deterministic
sample analysis data in the browser. It does not call the Fastify API, GitHub,
Prisma, or an AI provider. This makes it suitable for a free public demo link.

## Render Free Web Service

This project supports a single Render Web Service that serves both the Fastify API
and the built React app. The frontend calls same-origin `/api/*`, so no separate
Vercel or API URL is required.

Live demo placeholder:

https://YOUR_RENDER_DEMO_URL_HERE

## Render Settings

Create a new Render Web Service from this repository.

- Runtime: Node
- Build command: `pnpm render:build`
- Start command: `pnpm render:start`
- Instance type: Free

Render provides a `PORT` environment variable. The API also accepts `API_PORT`,
but `PORT` is preferred for hosted production.

## Environment Variables

Minimum demo configuration:

```text
NODE_ENV=production
DATABASE_URL=file:./demo.db
```

Optional configuration:

```text
GITHUB_TOKEN=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
LOG_LEVEL=info
```

If `OPENAI_API_KEY` is omitted, the deployed demo uses `MockReviewModelClient`
and still returns deterministic structured reports. Public GitHub PRs work
without `GITHUB_TOKEN`, though rate limits are lower.

## Startup Flow

`pnpm render:build` runs Prisma client generation and builds every workspace,
including `apps/web/dist`.

`pnpm render:start` runs:

```bash
prisma migrate deploy || node scripts/apply-sqlite-schema.mjs && pnpm --filter @ai-pr-reviewer/api start
```

The Prisma migration command is preferred. The fallback script applies the
checked-in SQLite schema directly from `prisma/migrations` so the free demo can
still boot in constrained environments where Prisma's schema engine is
unavailable.

The Fastify server then:

- Serves `/api/analysis-tasks/*` from the API routes.
- Serves `/api/health` for health checks.
- Serves `apps/web/dist` for the React app in production.
- Falls back to `index.html` for non-API routes.

## SQLite Notes

The free Render filesystem is suitable for a lightweight demo, but it is not a
durable production database. Use `DATABASE_URL=file:./demo.db` for the free
demo. Prisma resolves relative SQLite paths from the `prisma/` directory, so
this creates `prisma/demo.db`. SQLite database files are git ignored and must
not be committed.

Do not store GitHub tokens, OpenAI keys, request headers, or other secrets in the
database. The current persistence layer stores task metadata, PR snapshots,
changed-file JSON, report summaries, risk levels, and finding JSON only.
