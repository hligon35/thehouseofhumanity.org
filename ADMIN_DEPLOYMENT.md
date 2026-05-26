# Admin Deployment

This repository now contains two delivery paths:

- the existing public site, still served from the root-level static HTML files
- the Next.js admin worker, served only on `/admin*` and `/api/*`

The Cloudflare worker configuration is intentionally route-scoped so deployment of the admin runtime does not replace the static public site.

## Local environment

Copy `.env.example` to `.env.local` when running the Next.js app locally.

`.env.example` and `.dev.vars.example` are sanitized templates. Fill them with deployment-specific values locally instead of committing real credentials or secrets.

Variables used by the admin runtime:

- `ADMIN_USERNAME`: credential-based login username for `/admin`
- `ADMIN_PASSWORD`: credential-based login password for `/admin`
- `ADMIN_SESSION_SECRET`: HMAC secret used to sign the admin session cookie
- `CRON_PROCESS_SECRET`: bearer token used by the scheduled worker to call `/api/newsletters/process`
- `SENDGRID_API_KEY`: optional SendGrid API key; when empty, newsletter processing stays in simulated delivery mode
- `SENDGRID_FROM_EMAIL`: verified sender address for newsletter sends

## Cloudflare worker variables

Set these in Wrangler or the Cloudflare Workers dashboard:

- `ADMIN_BASE_URL`: production base URL for the admin worker, normally `https://www.thehouseofhumanity.org`
- `CRON_PROCESS_SECRET`: must match the app secret so cron-triggered processing can authorize successfully

Set these as Cloudflare secrets instead of plain vars:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `CRON_PROCESS_SECRET`
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`

Recommended setup commands:

1. `Copy-Item .env.example .env.local`
2. `Copy-Item .dev.vars.example .dev.vars`
3. `npx wrangler secret put ADMIN_USERNAME`
4. `npx wrangler secret put ADMIN_PASSWORD`
5. `npx wrangler secret put ADMIN_SESSION_SECRET`
6. `npx wrangler secret put CRON_PROCESS_SECRET`
7. `npx wrangler secret put SENDGRID_API_KEY`
8. `npx wrangler secret put SENDGRID_FROM_EMAIL`

Set the public worker var with:

- `npx wrangler deploy --var ADMIN_BASE_URL:https://www.thehouseofhumanity.org`

If you prefer the dashboard, use Workers and Pages > your worker > Settings > Variables and Secrets, keeping `ADMIN_BASE_URL` as a plain text variable and the remaining sensitive values as encrypted secrets.

Do not use a raw `npx wrangler deploy` repository build command in Cloudflare for this project. That falls back to a generic static deploy, ignores the OpenNext build pipeline, and can try to upload the repo root as assets.

## Commands

- `npm run dev`: run the admin app in standard Next.js development mode
- `npm run dev:app`: explicit alias for local Next.js app development
- `npm run build`: run the standard Next.js production build
- `npm run build:app`: explicit alias for the app-only production build
- `npm run build:worker`: generate the `.open-next` worker build output for Cloudflare
- `npm run build:all`: build both the app and the Cloudflare worker output in one pass
- `npm run lint`: run ESLint directly; `next lint` is removed in Next.js 16
- `npm run typecheck`: run the TypeScript compiler without emitting files
- `npm run check`: run lint plus type-checking
- `npm run validate`: run lint, type-checking, and both build targets
- `npm run cf:build`: generate the `.open-next` worker build output for Cloudflare
- `npm run preview`: build and preview the worker locally in the Workers runtime
- `npm run preview:worker`: explicit alias for worker preview
- `npm run deploy`: build and deploy the worker to Cloudflare
- `npm run deploy:worker`: explicit alias for worker deployment
- `npm run upload`: build and upload a new worker version without immediately promoting it
- `npm run upload:worker`: explicit alias for worker upload
- `npm run cf-typegen`: regenerate `cloudflare-env.d.ts` from the current Wrangler config

## Deployment notes

- The admin runtime has been upgraded to Next.js 16 and the current OpenNext Cloudflare adapter line so the project no longer depends on the deprecated `0.6.x` adapter branch.
- `wrangler.jsonc` keeps `main` pointed at `worker/index.ts` to preserve the custom scheduled handler required by the admin prompt.
- `worker/index.ts` reuses the generated OpenNext fetch handler after `npm run cf:build` creates `.open-next/worker.js`.
- Routes are limited to `/admin*` and `/api/*` on both apex and `www`, so the root static site remains untouched.
- `public/_headers` enables immutable caching for generated Next static assets.
- `_redirects` must stay relative-path only for Cloudflare static asset processing; host-level canonical redirects should be handled with a Cloudflare Redirect Rule, not in `_redirects`.

## Recommended production checklist

1. Create `.env.local` locally from `.env.example` for local development.
2. Set the Cloudflare worker secrets and vars, especially `CRON_PROCESS_SECRET`.
3. Run `npm run cf:build` locally at least once before first deployment.
4. Run `npm run preview` to verify `/admin` and the API routes in the Workers runtime.
5. Deploy with `npm run deploy` or configure Workers Builds with `npm install`, then `npx @opennextjs/cloudflare build`, then `npx @opennextjs/cloudflare deploy`.
