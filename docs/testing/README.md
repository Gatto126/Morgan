# Testing And Artifacts

Date: 2026-05-28

## Test Layers

- New app unit tests live under `tests/unit/`.
- Domain tests are grouped by responsibility, for example
  `tests/unit/domain/import/`, `tests/unit/domain/finance/`, and
  `tests/unit/domain/pricing/`.
- Server tests are grouped by responsibility, for example
  `tests/unit/server/config/`, `tests/unit/server/security/`, and
  `tests/unit/server/logging/`.
- Integration/client service tests live under `tests/unit/integrations/`.
- API route tests should live under `tests/api/`.
- Shared fixtures live under `tests/fixtures/`.
- Shared setup helpers live under `tests/setup/`.
- App tests should not be added under `src/`.
- Script helper tests live under `scripts/**/*.test.mjs`.
- Browser smoke and E2E scripts live under `scripts/e2e/`.
- Local maintenance scripts live under `scripts/testing/`.

Vitest is configured to include `tests/**/*.test.ts` and
`scripts/**/*.test.mjs`. Application source under `src/` should contain only
production code.

## Commands

```powershell
pnpm run lint
pnpm run typecheck
pnpm run typecheck:test
pnpm run test:run
pnpm run test:unit
pnpm run test:scripts
pnpm run smoke:upload-panel
pnpm run smoke:upload-panel:docker
pnpm run e2e:docker:full
```

## Local Runtime Policy

Keep all local runtimes stopped by default. Port `3000` is for local Next.js
development, including `pnpm run dev:docker`. Port `3001` is for the Docker
pre-production app only. Docker should be started only for Postgres-backed
development or pre-production checks, then stopped after the run.

Prefer this loop:

```powershell
pnpm run docker:postgres
pnpm run dev:docker
# test the app on http://127.0.0.1:3000
pnpm run docker:postgres:down
```

For production-like checks:

```powershell
pnpm run docker:preprod:up
pnpm run smoke:upload-panel:docker
pnpm run e2e:docker:full
pnpm run docker:preprod:down
```

Do not keep both `3000` and `3001` running unless the task explicitly compares
development and production-like behavior.

The full Docker E2E script uses `TEST_BASE_URL` when provided, otherwise
`http://127.0.0.1:3001`. It reads database settings from `.env` unless
`TEST_DATABASE_URL` and optional `TEST_DIRECT_URL` are set.

Binance API checks are opt-in for local testing. Set
`BINANCE_TEST_API_KEY` and `BINANCE_TEST_API_SECRET` in the process environment
only; do not commit them to files.

## Artifacts

Generated screenshots, browser outputs, coverage, logs, build caches, and local
database files are ignored by Git:

- `artifacts/`
- `test-results/`
- `playwright-report/`
- `.next/`
- `*.log`
- `*.db`, `*.sqlite`, `*.sqlite3`, and related SQLite sidecar files

Keep durable findings in `docs/audits/`; keep disposable run output in
`artifacts/`.
