# Scripts

Scripts are grouped by intent so test and maintenance entrypoints stay easy to
find.

```text
scripts/
  db/        Local DB maintenance and legacy one-off migrations
  e2e/       Browser-driven checks against local or Docker app instances
  lib/       Shared helpers used by scripts and script tests
  testing/   Local test maintenance commands
```

Use package scripts from `package.json` for normal workflows. Direct script
execution is fine for debugging, but package scripts keep paths stable when
files move.

## E2E

- `pnpm run smoke:upload-panel` starts a temporary local Next dev server and
  verifies auth hydration, profile switching, panel isolation, and upload panel
  behavior.
- `pnpm run dev:docker` starts Next dev against the Docker Postgres database on
  `localhost:5432` with explicit `DATABASE_URL` and `DIRECT_URL`, avoiding stale
  shell env values from other test databases. Run `pnpm run docker:postgres`
  first if Postgres is not already running.
- `pnpm run smoke:upload-panel:docker` runs the same check against
  `http://127.0.0.1:3001`.
- `pnpm run e2e:docker:full` runs the fuller Docker browser flow against
  `TEST_BASE_URL` or `http://127.0.0.1:3001`. Binance import/sync runs only
  when `BINANCE_TEST_API_KEY` and `BINANCE_TEST_API_SECRET` are provided in the
  environment.
- `pnpm run e2e:realistic` runs the large realistic browser flow against
  `TEST_BASE_URL` or `http://127.0.0.1:3000`. Its cleanup defaults to the Docker
  Postgres database on `localhost:5432`; use `TEST_DATABASE_URL` and
  `TEST_DIRECT_URL` to point it elsewhere. It generates ignored fixture files
  under `artifacts/e2e/realistic-browser-flow`, imports Trade Republic and BBVA
  data across multiple years, optionally syncs Binance when credentials are set
  in the environment, and deletes its temporary users before exit.

Browser artifacts are written under `artifacts/`, which is ignored by Git.

## Test Maintenance

- `pnpm run test:rate-limit:clear` clears Better Auth rate-limit buckets only
  for safe local databases, or when `MORGAN_ALLOW_TEST_RESET=1` is intentionally
  set for CI/non-local test targets.

## Database Maintenance

- `scripts/db/seed.ts` contains demo seed data for manual local DB setup.
- `pnpm run migrate:binance-secrets:legacy-sqlite` is a SQLite-only legacy
  migration for plaintext Binance credentials. Generate the SQLite Prisma
  client first and run it only against a `file:` database URL.
