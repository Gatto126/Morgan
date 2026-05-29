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
- Browser E2E helpers for shared fixtures, cleanup, polling, profile waits,
  overlay checks, and import UI interactions live in
  `scripts/e2e/e2e-helpers.mjs`.
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
pnpm run e2e:realistic
pnpm run e2e:active-components
```

## GitHub Workflows

- `CI` runs on push and pull request. It installs dependencies, validates both
  Prisma schemas, lints, typechecks, runs unit/script tests, and builds Next.
- `Docker E2E` is manual (`workflow_dispatch`). It builds and starts the Docker
  pre-production stack on port `3001`, runs the upload-panel smoke test, the
  realistic browser flow, and the active-components walkthrough, uploads
  browser artifacts on failure, then stops the Docker stack.

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

The active-components walkthrough uses `TEST_BASE_URL` when provided, otherwise
`http://127.0.0.1:3000`. It creates a disposable account, imports Trade Republic
and BBVA files through the UI, exercises Dashboard, Checking, Investments,
Crypto, Binance, Upload, Settings, API Key, Danger zone, Select profile, and New
Profile panels. It also interacts with dashboard controls that are easy to break
during UI refactors: topbar dashboard tabs, chart time ranges, chart hover
tooltip, chart point/reference-line selection, legend toggles, and the Binance
summary card. Screenshots are saved under
`artifacts/e2e/active-components-walkthrough/`, then the account is deleted
through the UI unless the run explicitly keeps it for manual inspection.

Binance API checks are opt-in for local testing. Set
`BINANCE_TEST_API_KEY` and `BINANCE_TEST_API_SECRET` in the process environment
only; do not commit them to files. When these variables are absent, the
active-components walkthrough seeds cached Binance balances so the Binance UI is
still mounted and covered without storing real secrets.

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
