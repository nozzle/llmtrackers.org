# LLM Tracker Comparison

LLM Tracker Comparison is a TanStack Start app deployed to Cloudflare Workers.

It uses:

- TanStack Start for the app and routing
- the Cloudflare Vite plugin for local/runtime integration
- static prerendering for public pages
- a custom Cloudflare server entry for queues, cron, and API endpoints

## Project Structure

- `src/` - TanStack Start app source
- `src/server.ts` - custom Cloudflare Worker entry that wraps TanStack Start and adds queue/cron/API handling
- `public/` - static public assets
- `src/server/` - server-side modules for suggestion APIs and update processing
- `data/companies/` - YAML source of truth for tracker data
- `packages/shared/` - shared schemas, YAML helpers, and compiled data generation
- `packages/github/` - GitHub API helpers

## Stack

- React 19
- TanStack Start
- Vite 7
- Cloudflare Workers
- Cloudflare Queues
- Cloudflare cron triggers
- Tailwind CSS v4
- pnpm workspaces
- Vitest

## Requirements

- Node.js 24+
- pnpm 10+

## Install

```bash
pnpm install
pnpm playwright:install
```

`pnpm playwright:install` is required for local browser-backed extraction. In production,
the app uses Cloudflare Browser Rendering.

## Common Commands

```bash
pnpm dev
pnpm preview
pnpm dev:server
pnpm compile-data
pnpm playwright:install
pnpm cf-typegen
pnpm test
pnpm typecheck
pnpm build
pnpm deploy:check
pnpm release
pnpm backfill-review-sites
```

## Development Modes

- `pnpm dev`
  - runs the TanStack Start app through Vite with the Cloudflare Vite plugin
  - this is the normal app development mode

- `pnpm preview`
  - previews the built app locally after `pnpm build`

- `pnpm dev:server`
  - runs the Cloudflare server entry with Wrangler
  - useful when focusing on queue, cron, or server-runtime behavior

## Static Prerendering

Static prerendering is enabled in `vite.config.ts`.

Current prerender behavior includes:

- `enabled: true`
- `autoSubfolderIndex: true`
- `autoStaticPathsDiscovery: true`
- `crawlLinks: true`
- `concurrency: 14`
- retry and redirect handling for prerender jobs
- `failOnError: true`

Public pages are prerendered into `dist/client` during `pnpm build`.

## Data Model

- source data lives in `data/companies/*.yaml` and `data/reviews/*.yaml`
- each company and each published review gets its own YAML file
- `packages/shared/src/compile.ts` validates YAML and writes `packages/shared/compiled-data.json`
- the app reads compiled JSON, not raw YAML, at runtime

When editing data:

```bash
pnpm compile-data
pnpm test
pnpm typecheck
```

## Cloudflare Configuration

Worker configuration lives in `wrangler.toml`.

The app uses:

- `src/server.ts` as the custom Worker entrypoint
- `nodejs_compat`
- Cloudflare Queue bindings for update jobs
- a cron trigger for scheduled update fan-out
- observability enabled in Wrangler

Bindings/types can be regenerated with:

```bash
pnpm cf-typegen
```

This updates `worker-configuration.d.ts`.

## Environment and Secrets

Configured via `wrangler.toml` and Wrangler secrets.

Secrets:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_INSTALLATION_ID`
- `OPENAI_API_KEY`
- `MANUAL_TRIGGER_TOKEN`
- `TURNSTILE_SECRET_KEY` optional

Vars:

- `GITHUB_REPO_OWNER`
- `GITHUB_REPO_NAME`
- `TURNSTILE_SITE_KEY` optional
- `VITE_SITE_URL` optional canonical site URL

Set local secrets with Wrangler:

```bash
wrangler secret put GITHUB_APP_ID
wrangler secret put GITHUB_APP_PRIVATE_KEY
wrangler secret put GITHUB_INSTALLATION_ID
wrangler secret put OPENAI_API_KEY
wrangler secret put MANUAL_TRIGGER_TOKEN
wrangler secret put TURNSTILE_SECRET_KEY
```

For local environment overrides, use `.env.local` and do not commit it.

## Server Features

The custom Cloudflare server entry handles:

- TanStack Start app requests
- public suggestion APIs under `/api/*`
- admin update enqueue endpoints under `/api/admin/update-checker/*`
- queue consumption for per-company update jobs
- scheduled fan-out via cron

## Update Checker

The update system is queue-driven:

- cron enqueues one job per company
- queue consumers process one company at a time
- each job fetches pricing/features pages, extracts changes, diffs YAML, and opens or updates a PR

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

Test the scheduled handler locally:

```bash
curl "http://localhost:3000/cdn-cgi/handler/scheduled?cron=*+*+*+*+*"
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

## Screenshot Collection

Curated product screenshots are stored as first-party images downloaded from seeded public pages.

- seed candidate pages in `data/companies/*.yaml` under `screenshotSources`
- selected screenshot metadata lives in the same company YAML under `screenshots`
- downloaded image files live in `public/company-assets/<slug>/screenshots/`
- temporary discovery output is written to `tmp/company-screenshots/<slug>.json`

Discover candidates for one company:

```bash
pnpm screenshots:discover -- ahrefs-brand-radar --include-same-host-help
```

Review the discovered candidates in a compact table:

```bash
pnpm screenshots:review -- ahrefs-brand-radar
pnpm screenshots:review -- ahrefs-brand-radar --all
```

Ingest one or more discovered candidates by index or id:

```bash
pnpm screenshots:ingest -- ahrefs-brand-radar --pick 1
pnpm screenshots:ingest -- ahrefs-brand-radar --pick brand-radar-dashboard-showing-branded-search-vol
```

Use `--force` to replace an existing screenshot with the same id.

## Testing

- shared YAML tests live in `packages/shared/src/*.test.ts`
- server-side tests live in `src/server/**/*.test.ts`

Run all tests:

```bash
pnpm test
```

## Deploy

Cloudflare Git integration handles production deploys from the repository.

Check the deploy bundle locally with:

```bash
pnpm deploy:check
```

Deploy with:

```bash
pnpm release
```

CI/CD is configured in `.github/workflows/`.

GitHub Actions are used for CI only.

Required Cloudflare Worker secrets include:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_INSTALLATION_ID`
- `OPENAI_API_KEY`
- `MANUAL_TRIGGER_TOKEN`
- `TURNSTILE_SECRET_KEY`

If you manage Worker settings with Wrangler, set them with:

```bash
wrangler secret put GITHUB_APP_ID
wrangler secret put GITHUB_APP_PRIVATE_KEY
wrangler secret put GITHUB_INSTALLATION_ID
wrangler secret put OPENAI_API_KEY
wrangler secret put MANUAL_TRIGGER_TOKEN
wrangler secret put TURNSTILE_SECRET_KEY
```

Migration checklist from GitHub Actions deploys to Cloudflare Git deploys:

- move Worker secrets into Cloudflare before removing any GitHub deploy workflow
- confirm Cloudflare Git integration is connected to the correct production branch
- mirror any required environment variables from `wrangler.toml` in Cloudflare environments
- verify queues, cron triggers, and bindings exist in the target Cloudflare account
- keep `pnpm deploy:check` and `pnpm release` for manual deploy validation when needed

## Notes

- YAML is the source of truth
- compiled JSON is the runtime data source for the app
- update jobs rewrite YAML through shared helpers, not regexes
- manual update endpoints are bearer-token protected

## Security and Maintenance

- security reporting guidance is in `SECURITY.md`
- Dependabot config lives in `.github/dependabot.yml`
- GitHub Actions are pinned to commit SHAs where possible
