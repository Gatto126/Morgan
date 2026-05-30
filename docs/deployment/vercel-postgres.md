# Vercel And Postgres Deployment

Date: 2026-05-28

Status: initial cloud path

## Runtime Shape

The web/cloud target runs as a Next.js app on Vercel with Postgres persistence.
Docker is used locally to run a Postgres database that matches the cloud schema;
Vercel itself builds and runs the Next.js project directly rather than deploying
this repository as a Docker image.

Recommended services:

- Vercel Hobby for the Next.js app;
- Neon Postgres for production and preview databases;
- local Docker Compose Postgres for pre-production checks.

For the first free-tier cloud setup, follow
`docs/deployment/free-tier-vercel-neon.md` before enabling preview database
branching or external authentication providers.

## Local Pre-Production

Start the full Docker pre-production stack when you want to test the app as a
production build:

```powershell
pnpm run docker:preprod:up
pnpm run smoke:upload-panel:docker
```

For database-only local development, start Postgres:

```powershell
pnpm run docker:postgres
```

Use a local env based on `.env.example`:

```env
DATABASE_URL=postgresql://morgan:morgan@localhost:5432/morgan?schema=public
DIRECT_URL=postgresql://morgan:morgan@localhost:5432/morgan?schema=public
MORGAN_DATABASE_PROVIDER=postgresql
MORGAN_ENCRYPTION_KEY=<32-byte base64 or 64-character hex key>
BETTER_AUTH_SECRET=<random secret>
MORGAN_SIGNUP_INVITE_CODE=<private registration code>
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://192.168.*.*:3000
BETTER_AUTH_IP_HEADERS=x-forwarded-for
```

Apply migrations and validate:

```powershell
pnpm run db:migrate
pnpm run release:check
pnpm run smoke:upload-panel
```

## Vercel Environment

Set these variables in Vercel for Production and Preview. Preview should point
to a separate Neon database or branch so migration tests never mutate production.

```env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
MORGAN_DATABASE_PROVIDER=postgresql
MORGAN_ENCRYPTION_KEY=...
BETTER_AUTH_SECRET=...
MORGAN_SIGNUP_INVITE_CODE=...
BETTER_AUTH_URL=https://<app>.vercel.app
BETTER_AUTH_TRUSTED_ORIGINS=https://<app>.vercel.app
BETTER_AUTH_IP_HEADERS=x-forwarded-for
MORGAN_LOG_LEVEL=info
MORGAN_LOG_DETAIL=minimal
```

When a custom domain is attached, replace `BETTER_AUTH_URL` and
`BETTER_AUTH_TRUSTED_ORIGINS` with that exact HTTPS origin.

Keep `MORGAN_SIGNUP_INVITE_CODE` out of Git and rotate it if it is shared with
anyone who should no longer be able to create accounts.

## Build And Deploy

`vercel.json` runs:

```powershell
pnpm run vercel-build
```

That script generates the Prisma client, applies committed migrations with
`prisma migrate deploy --schema=prisma/schema.prisma`, and then runs
`next build`.

Useful local Vercel checks:

```powershell
pnpm dlx vercel pull --environment=preview
pnpm dlx vercel build
```

Deploy preview:

```powershell
pnpm dlx vercel
```

Deploy production:

```powershell
pnpm dlx vercel --prod
```

## Release Checklist

- Docker Postgres is healthy.
- `pnpm run db:migrate` succeeds against the target database.
- `pnpm run release:check` succeeds.
- `pnpm run smoke:upload-panel` succeeds against the local Postgres database.
- `pnpm run smoke:upload-panel:docker` succeeds against the Docker production app.
- `pnpm run e2e:docker:full` succeeds for release-candidate checks; Binance is
  included only when test API variables are provided.
- Vercel Preview uses a preview database, not production.
- `docs/deployment/release-readiness.md` is complete for the target release.
