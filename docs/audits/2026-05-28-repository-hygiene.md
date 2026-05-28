# Repository Hygiene Audit

Date: 2026-05-28

Status: current repository cleanup pass

## Scope

This audit reviewed the repository layout, runtime split, test scripts, generated
artifacts, ignored files, and sensitive-data exposure risk after the Postgres,
Docker pre-production, auth, logging, rate-limit, dashboard, and browser-flow
work.

## Current Runtime State

- Web, Docker pre-production, and Vercel/Neon use the Postgres Prisma schema in
  `prisma/schema.prisma`.
- Docker pre-production runs a production Next build against the Compose
  Postgres service.
- SQLite now has an explicit scaffold in `prisma/sqlite/schema.prisma` for the
  future desktop/offline target.
- The active Prisma client provider is selected through
  `MORGAN_DATABASE_PROVIDER`, defaulting to Postgres.

## Repository Organization

- Browser checks are under `scripts/e2e/`.
- Test maintenance scripts are under `scripts/testing/`.
- Shared script helpers and helper tests are under `scripts/lib/`.
- Durable audit reports are under `docs/audits/`.
- Disposable screenshots and browser run outputs belong under ignored
  `artifacts/`.

## Security And Exposure Review

- `.env` and `.env.*` remain ignored except committed example files.
- Local database files, logs, build caches, Playwright outputs, and artifacts are
  ignored.
- Binance test credentials are consumed only through process environment
  variables in E2E scripts.
- Rate-limit reset helpers refuse production, CI, and non-local database targets
  unless `MORGAN_ALLOW_TEST_RESET=1` is intentionally set.
- Production logging is configured to use minimal detail by default.

## Verification

- `pnpm exec prisma validate --schema=prisma/schema.prisma`
- `pnpm exec prisma validate --schema=prisma/sqlite/schema.prisma`
- `pnpm exec prisma generate --schema=prisma/sqlite/schema.prisma`
- `pnpm exec prisma generate --schema=prisma/schema.prisma`
- `pnpm run lint`
- `pnpm exec tsc --noEmit`
- `pnpm run test:run`
- `docker compose config --quiet`
- `pnpm run docker:postgres`
- `pnpm run db:migrate`
- `pnpm run smoke:upload-panel`
- `pnpm run docker:postgres:down`
- `pnpm run docker:preprod:build`
- `git diff --check`

All checks passed. Docker services were stopped after validation.

## Follow-Up Work

- Add a CI workflow that runs lint, typecheck, unit tests, Prisma validation for
  both schemas, and Docker smoke checks.
- Add SQLite adapter tests once the desktop persistence layer is implemented.
- Move persistence-heavy workflows behind repository functions before starting a
  full `apps/` and `packages/` monorepo split.
- Add a dedicated secret-scanning tool in CI, such as gitleaks or trufflehog,
  before opening the repository more widely.
