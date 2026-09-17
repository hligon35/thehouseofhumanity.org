# Cloudflare deployment

The major-update branch uses one Cloudflare Worker for the public site, /admin, API routes, security headers, and the scheduled newsletter processor. D1 is the production system of record.

## Cloudflare resources

- Worker: thehouseofhumanity
- D1 binding: DASHBOARD_DB
- D1 database: thoh-dashboard
- D1 migrations: migrations/
- Production routes: thehouseofhumanity.org/* and www.thehouseofhumanity.org/*
- Cron: every 15 minutes for due newsletter processing

The repository currently identifies the public hostname as thehouseofhumanity.org; keep the hostname, CNAME, canonical URLs, and Cloudflare zone aligned unless the domain is intentionally changed.

## Admin authentication

Production admin access is handled by Cloudflare Access. Create an Access application covering /admin* and /api/*, connect the approved identity provider, and configure the Access application audience. The Worker additionally checks the cf-access-authenticated-user-email header against ADMIN_ALLOWED_EMAILS when that list is populated.

Local credential login is available only when ALLOW_LOCAL_ADMIN_LOGIN=true or when running non-production development. It is not a production authentication path.

## D1 migration and deploy

Run from the repository root:

1. npm ci
2. npx wrangler d1 migrations apply thoh-dashboard --remote
3. npm run validate
4. npm run deploy

The GitHub Actions workflow runs validation and deploys on main; keep major-update isolated until reviewed and intentionally merged.

Set runtime secrets with Wrangler:

- npx wrangler secret put CRON_PROCESS_SECRET
- npx wrangler secret put RESEND_API_KEY
- npx wrangler secret put RESEND_FROM_EMAIL
- npx wrangler secret put RESEND_REPLY_TO
- npx wrangler secret put CONTACT_TO_EMAIL
- npx wrangler secret put ADMIN_SESSION_SECRET

Set non-secret Worker variables in wrangler.jsonc or the Cloudflare dashboard:

- ADMIN_BASE_URL
- NEXT_PUBLIC_SITE_URL
- CF_ACCESS_TEAM_DOMAIN
- CF_ACCESS_AUD
- ADMIN_ALLOWED_EMAILS
- ALLOW_LOCAL_ADMIN_LOGIN=false

Resend must have a verified sending domain before newsletters or contact notifications are enabled. If Resend is missing in local development, delivery is reported as simulated; production fails closed rather than marking an email as delivered.

## Admin operations

The dashboard intentionally exposes only the operations needed for this nonprofit site:

- Overview: D1-backed submissions, subscriber count, and first-party traffic.
- Submissions: search, All/New/Read/Archived filters, mark read, archive, and restore.
- Newsletter: compose, preview, send a test, schedule, edit/delete unsent items, and process due items.
- Site content: save draft, reset to published content, and publish the supported About, event, newsletter, and support copy.
- Activity: audit log for sign-ins, submissions, newsletter work, and content changes.

The submissions inbox stores website messages only; it is not an inbound mailbox.

## Legacy services

Google Apps Script and SendGrid are no longer runtime dependencies. Contact submissions are stored in D1 and notifications/newsletters use Resend. The static site is routed through the same Cloudflare Worker as the admin application.
