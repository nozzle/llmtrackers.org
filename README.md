# LLM Tracker Comparison

Static comparison site for AI search visibility / LLM tracking tools, plus two Cloudflare Workers:

- `apps/web` - TanStack Start site deployed to Cloudflare Pages via GitHub integration
- `apps/form-worker` - accepts suggest-form submissions and creates GitHub issues
- `apps/update-checker` - cron/manual worker that checks vendor pages, extracts structured changes, and opens PRs
- `packages/shared` - Zod schemas, shared types, YAML helpers, and the compile script

## Stack

- pnpm workspaces
- React 19 + TanStack Start + Vite 7
- Tailwind CSS v4
- Cloudflare Pages + Cloudflare Workers (Wrangler v4)
- YAML as the source of truth for company data
- Zod for validation
- Vitest for tests

## Repo Layout

```text
apps/
  web/
  form-worker/
  update-checker/
data/
  companies/
packages/
  shared/
```

## Requirements

- Node.js 24+
- pnpm 9+

## Install

```bash
pnpm install
```

## Common Commands

From the repo root:

```bash
pnpm dev
pnpm compile-data
pnpm test
pnpm typecheck
pnpm build
```

App-specific:

```bash
pnpm --filter web dev
pnpm --filter web build

pnpm --filter form-worker dev
pnpm --filter form-worker build

pnpm --filter update-checker dev
pnpm --filter update-checker test
pnpm --filter update-checker build
```

## Data Model

- Source data lives in `data/companies/*.yaml`
- Each company has one YAML file
- `packages/shared/src/compile.ts` validates all YAML and outputs `packages/shared/compiled-data.json`
- The web app reads compiled JSON, not raw YAML

When editing data:

```bash
pnpm compile-data
pnpm test
pnpm typecheck
```

## Environment and Secrets

### Web

Optional local env used by the suggest form:

- `VITE_FORM_WORKER_URL`
- `VITE_SITE_URL`
- `VITE_TURNSTILE_SITE_KEY`

### Form Worker

Configured in `apps/form-worker/wrangler.toml`.

Secrets:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_INSTALLATION_ID`
- `ALLOWED_ORIGIN`
- `TURNSTILE_SECRET_KEY` (optional)

Vars:

- `GITHUB_REPO_OWNER`
- `GITHUB_REPO_NAME`
- `TURNSTILE_SITE_KEY` (optional public key)

### Update Checker

Configured in `apps/update-checker/wrangler.toml`.

Secrets:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_INSTALLATION_ID`
- `OPENAI_API_KEY`
- `MANUAL_TRIGGER_TOKEN`

Vars:

- `GITHUB_REPO_OWNER`
- `GITHUB_REPO_NAME`

## Local Worker Secrets

Set worker secrets with Wrangler:

```bash
pnpm --filter form-worker exec wrangler secret put GITHUB_APP_ID
pnpm --filter form-worker exec wrangler secret put GITHUB_APP_PRIVATE_KEY
pnpm --filter form-worker exec wrangler secret put GITHUB_INSTALLATION_ID
pnpm --filter form-worker exec wrangler secret put ALLOWED_ORIGIN
pnpm --filter form-worker exec wrangler secret put TURNSTILE_SECRET_KEY

pnpm --filter update-checker exec wrangler secret put GITHUB_APP_ID
pnpm --filter update-checker exec wrangler secret put GITHUB_APP_PRIVATE_KEY
pnpm --filter update-checker exec wrangler secret put GITHUB_INSTALLATION_ID
pnpm --filter update-checker exec wrangler secret put OPENAI_API_KEY
pnpm --filter update-checker exec wrangler secret put MANUAL_TRIGGER_TOKEN
```

## Deploy

### Web App

`apps/web` is intended to deploy through the Cloudflare Pages GitHub integration, which also handles preview deployments for pull requests.

Recommended Cloudflare Pages settings:

- Production branch: `main`
- Build command: `VITE_SITE_URL=$CF_PAGES_URL pnpm build`
- Build output directory: `apps/web/dist/client`
- Node.js version: `24`

### Workers

GitHub Actions deploys only the workers on pushes to `main`:

- `apps/form-worker`
- `apps/update-checker`

Required GitHub repository secrets for worker deploys:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_INSTALLATION_ID`
- `ALLOWED_ORIGIN`
- `OPENAI_API_KEY`
- `MANUAL_TRIGGER_TOKEN`

Cloudflare Pages project setup is managed in Cloudflare and does not require the web deploy job in GitHub Actions.

## Manual Update Checker Trigger

Manual runs require a bearer token.

```bash
curl -X POST "https://<update-checker-url>" \
  -H "Authorization: Bearer $MANUAL_TRIGGER_TOKEN"
```

If the token is missing or invalid, the worker returns `401 Unauthorized`.

## Testing

- Shared YAML merge/round-trip tests live in `packages/shared/src/yaml.test.ts`
- Update checker diff/auth tests live in `apps/update-checker/src/*.test.ts`

Run all tests:

```bash
pnpm test
```

## Notes

- YAML is the source of truth
- The update checker now parses and rewrites YAML via shared helpers instead of regex parsing
- Manual update-trigger requests are authenticated, but cron runs are unaffected

## Security and Maintenance

- Security reporting guidance is in `SECURITY.md`
- Dependabot is configured for npm dependencies and GitHub Actions in `.github/dependabot.yml`
- GitHub Actions are pinned to commit SHAs for better supply-chain safety
