# Docker Pre-Production

Date: 2026-05-28

Status: initial implementation

## Purpose

Docker pre-production runs Morgan as a production-built Next.js container
against a separate Postgres container. It is the local rehearsal for the Vercel
+ Neon target:

- the app image is built inside Linux;
- Prisma uses the Postgres datasource;
- migrations run with `prisma migrate deploy --schema=prisma/schema.prisma`;
- `MORGAN_DATABASE_PROVIDER=postgresql` is set explicitly;
- the app starts with `next start`, not `next dev`;
- smoke tests hit the already-running app over HTTP.

## Ports

- Host dev app: `http://127.0.0.1:3000`
- Docker pre-prod app: `http://127.0.0.1:3001`
- Docker Postgres: `localhost:5432`

The app container talks to Postgres through the Compose service name
`postgres:5432`, which is closer to cloud service-to-service networking than a
host-local connection.

## Environment

Compose reads `.env` automatically for secrets, which is the default local
workflow. For a dedicated pre-prod env, copy `.env.preprod.example` to
`.env.preprod`, keep it uncommitted, and pass it explicitly with
`docker compose --env-file .env.preprod ...`.

Required secret values:

```env
MORGAN_ENCRYPTION_KEY=
BETTER_AUTH_SECRET=
MORGAN_SIGNUP_INVITE_CODE=
MORGAN_DATABASE_PROVIDER=postgresql
```

Pre-production logging defaults to production-like minimal detail:

```env
MORGAN_LOG_LEVEL=info
MORGAN_LOG_DETAIL=minimal
```

This keeps request and response lines visible while omitting financial values,
token counts, and other response bodies from container logs. Use
`MORGAN_LOG_DETAIL=standard` only for local debugging.

The app container intentionally ignores host `DATABASE_URL` and uses:

```env
postgresql://morgan:morgan@postgres:5432/morgan?schema=public
```

## Commands

Build and start the full stack:

```powershell
pnpm run docker:preprod:up
```

Build and start the same stack with a dedicated pre-prod env file:

```powershell
docker compose --env-file .env.preprod up -d --build app
```

Check service health:

```powershell
docker compose ps
Invoke-WebRequest http://127.0.0.1:3001/api/health -UseBasicParsing
```

Run smoke tests against the app container:

```powershell
pnpm run smoke:upload-panel:docker
```

Run the fuller browser flow against the app container:

```powershell
pnpm run e2e:docker:full
```

The full browser flow stores screenshots under ignored `artifacts/`. Binance
checks run only when the current process environment provides Binance test API
variables.

Clear Better Auth rate-limit buckets for repeated local smoke runs:

```powershell
pnpm run test:rate-limit:clear
```

The clear command only runs against safe local database targets by default. In
CI, or when pointing at a non-local test database, set
`MORGAN_ALLOW_TEST_RESET=1` intentionally.

Stop the stack:

```powershell
pnpm run docker:preprod:down
```

Reset all Docker data, including the Postgres volume:

```powershell
pnpm run docker:preprod:reset
```

## Validation Checklist

- `docker compose config` succeeds.
- `docker compose up -d --build app` succeeds.
- `morgan-postgres` is healthy.
- `morgan-app` is healthy.
- `/api/health` returns `200`.
- `pnpm run smoke:upload-panel:docker` succeeds.
- `pnpm run e2e:docker:full` succeeds when full-flow validation is required.
- App logs contain no startup migration errors.
- App logs omit response bodies when `MORGAN_LOG_DETAIL=minimal`.

## What This Does Not Replace

This is not a Vercel Preview deployment. It does not validate Vercel routing,
Vercel environment configuration, Neon pooling, or edge/CDN behavior. It does
validate the production Next runtime, the Prisma/Postgres schema, migrations,
and core browser workflow before pushing to Vercel.
