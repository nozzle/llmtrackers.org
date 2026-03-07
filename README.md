# LLM Tracker Comparison

Single Cloudflare Worker app for the LLM Trackers website, suggestion APIs, and automated update checking.

## Repo Layout

- `src/` - TanStack Start frontend app
- `public/` - static assets bundled with the site
- `worker/` - unified Worker runtime, form APIs, cron, and queue consumers
- `data/companies/` - YAML source of truth for companies and plans
- `packages/shared/` - schemas, YAML helpers, compile step, and shared types
- `packages/github/` - GitHub API helpers used by the Worker

## Stack

- pnpm workspaces
- React 19 + TanStack Start + Vite 7
- Tailwind CSS v4
- Cloudflare Worker + Cloudflare Queues + cron triggers
- YAML as the source of truth for company data
- Zod for validation
- Vitest for tests

## Requirements

- Node.js 24+
- pnpm 10+

## Install

```bash
pnpm install
```

## Common Commands

```bash
pnpm dev
pnpm dev:worker
pnpm compile-data
pnpm test
pnpm typecheck
pnpm build
pnpm deploy
pnpm backfill-review-sites
```

## Data Model

- Source data lives in `data/companies/*.yaml`
- Each company has one YAML file
- `packages/shared/src/compile.ts` validates YAML and outputs `packages/shared/compiled-data.json`
- The site reads compiled JSON, not raw YAML

When editing data:

```bash
pnpm compile-data
pnpm test
pnpm typecheck
```

## Environment and Secrets

Configured in `wrangler.toml`.

Secrets:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_INSTALLATION_ID`
- `OPENAI_API_KEY`
- `MANUAL_TRIGGER_TOKEN`
- `TURNSTILE_SECRET_KEY` (optional)

Vars:

- `GITHUB_REPO_OWNER`
- `GITHUB_REPO_NAME`
- `TURNSTILE_SITE_KEY` (optional public key)
- `VITE_SITE_URL` (optional canonical production URL)

## Local Worker Secrets

Set worker secrets with Wrangler:

```bash
wrangler secret put GITHUB_APP_ID
wrangler secret put GITHUB_APP_PRIVATE_KEY
wrangler secret put GITHUB_INSTALLATION_ID
wrangler secret put OPENAI_API_KEY
wrangler secret put MANUAL_TRIGGER_TOKEN
wrangler secret put TURNSTILE_SECRET_KEY
```

## Deploy

GitHub Actions deploys the single Worker app on pushes to `main`.

The Worker serves:

- prerendered site assets from `dist/client`
- public suggestion APIs under `/api/*`
- admin update enqueue endpoints under `/api/admin/update-checker/*`
- weekly cron scheduling
- Cloudflare Queue consumption for per-company update jobs

Required GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_INSTALLATION_ID`
- `OPENAI_API_KEY`
- `MANUAL_TRIGGER_TOKEN`
- `TURNSTILE_SECRET_KEY`

## Update Checker

The automated updater is queue-driven:

- cron enqueues one job per company
- queue consumers process a single company at a time
- each job fetches pricing/features pages, runs extraction, diffs YAML, and opens or updates a PR

Manual enqueue all companies:

```bash
curl -X POST "https://<worker-url>/api/admin/update-checker/enqueue" \
  -H "Authorization: Bearer $MANUAL_TRIGGER_TOKEN"
```

Manual enqueue one company:

```bash
curl -X POST "https://<worker-url>/api/admin/update-checker/enqueue/<slug>" \
  -H "Authorization: Bearer $MANUAL_TRIGGER_TOKEN"
```

## Review Site Backfill

Seed official review-site URLs in `data/companies/*.yaml` under `reviewSites`, then run:

```bash
pnpm backfill-review-sites
```

To persist updates:

```bash
pnpm backfill-review-sites -- --write
```

To target a single company slug:

```bash
pnpm backfill-review-sites -- ahrefs-brand-radar --write
```

## Testing

- shared YAML merge/round-trip tests live in `packages/shared/src/*.test.ts`
- Worker form and update tests live in `worker/**/*.test.ts`

Run all tests:

```bash
pnpm test
```

## Notes

- YAML is the source of truth
- the update checker rewrites YAML via shared helpers, not regex parsing
- manual enqueue endpoints are authenticated with a bearer token

## Security and Maintenance

- Security reporting guidance is in `SECURITY.md`
- Dependabot is configured for npm dependencies and GitHub Actions in `.github/dependabot.yml`
- GitHub Actions are pinned to commit SHAs where possible
