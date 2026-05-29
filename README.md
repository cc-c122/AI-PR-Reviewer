# AI PR Reviewer

AI PR Reviewer is an AI-assisted GitHub Pull Request review tool. It fetches PR changes, builds review context, identifies risky code, and produces structured review suggestions.

## Current Status

The backend MVP can create an analysis task from a public GitHub PR URL, parse
`owner/repo/pullNumber`, fetch PR metadata through Octokit, fetch changed files,
return a structured PR snapshot, and generate an `AnalysisReport` with summary,
risk level, and initial findings. It uses a deterministic mock model when
`OPENAI_API_KEY` is not configured, and switches to an OpenAI-compatible review
model provider when the key is present.

## Live Demo

[Open the GitHub Pages demo](https://cc-c122.github.io/AI-PR-Reviewer/)

The GitHub Pages build runs in static demo mode, so it does not require a
backend server, credit card, GitHub token, or OpenAI key. It shows the end-to-end
review workflow with deterministic sample findings.

## Planned Stack

- React + Vite + TypeScript for the web app
- Fastify + TypeScript for the API
- Octokit for GitHub integration
- Zod for runtime validation
- Prisma + SQLite for local persistence
- OpenAI-compatible model providers for review analysis

## Development

Install dependencies once Node.js and pnpm are available:

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate --name init
pnpm dev
```

The API starts on `http://localhost:4000` by default and the web app starts on
`http://localhost:5173`.

For a single-process production-style local run:

```bash
pnpm render:build
$env:NODE_ENV="production"; $env:DATABASE_URL="file:./demo.db"; pnpm render:start
```

Open `http://localhost:4000` for the web UI and `http://localhost:4000/api/health`
for the API health check.

`render:start` prefers `prisma migrate deploy` and falls back to applying the
checked-in SQLite schema directly if Prisma's schema engine is unavailable in a
constrained runtime.

Create an analysis task directly:

```bash
curl -X POST http://localhost:4000/api/analysis-tasks \
  -H "Content-Type: application/json" \
  -d "{\"pullRequestUrl\":\"https://github.com/owner/repo/pull/123\"}"
```

Run verification:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Database

Local persistence uses Prisma with SQLite. The default `DATABASE_URL` in
`.env.example` points at `file:./dev.db`; when Prisma commands are run from the
repository root, the SQLite file is created under `prisma/dev.db`.

Useful commands:

```bash
pnpm prisma:generate
pnpm prisma:migrate --name init
pnpm prisma:studio
```

Generated SQLite database files are git ignored. Analysis tasks persist the task
metadata, PR snapshot, changed-file JSON, report summary, risk level, and
finding JSON. GitHub tokens, OpenAI keys, and request headers are not stored.

## Environment Variables

Copy `.env.example` to `.env` before local development.

- `GITHUB_TOKEN`: Optional GitHub token. Public PRs work without it, but setting
  a token gives higher rate limits and enables access allowed by that token.
- `API_PORT`: API port. Defaults to `4000`.
- `WEB_PORT`: Vite web port. Defaults to `5173`.
- `DATABASE_URL`: Reserved for persistence. Defaults to SQLite local dev path.
- `NODE_ENV`: Use `production` to serve `apps/web/dist` from the Fastify API
  process.
- `OPENAI_API_KEY`: Optional API key for the OpenAI-compatible review model
  provider. When omitted, the API uses `MockReviewModelClient`.
- `OPENAI_MODEL`: Optional model name. Defaults to `gpt-4o-mini`.
- `OPENAI_BASE_URL`: Optional OpenAI-compatible API base URL. Defaults to
  `https://api.openai.com/v1`.

The model provider sends only the PR snapshot, generated summary, and risk
assessment to the review model. API keys and full request headers are not logged.

See [docs/deployment.md](docs/deployment.md) for Render free-tier deployment
steps.
