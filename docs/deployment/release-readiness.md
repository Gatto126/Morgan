# Release Readiness

Date: 2026-05-30

Status: pre-production / private beta only

## Publication Decision

Morgan should not be launched publicly until the gates below are complete. The
app is suitable for local use and controlled pre-production validation, but a
public finance app needs operational, legal, and production-data safeguards in
place before unknown users depend on it.

## Current Release Gate

Run this gate on the release branch before any preview or production deploy:

```powershell
pnpm run release:check
```

For Docker pre-production:

```powershell
pnpm run docker:preprod:up
pnpm run smoke:upload-panel:docker
pnpm run e2e:docker:full
pnpm run docker:preprod:down
```

The production runtime now fails fast when required production values are
missing or unsafe. This is intentional: a broken deployment should stop before
serving login, profile, portfolio, or credential screens.

## Required Production Configuration

Production must provide:

- `DATABASE_URL` and `DIRECT_URL` pointing at the production Postgres database.
- `MORGAN_DATABASE_PROVIDER=postgresql`.
- `MORGAN_ENCRYPTION_KEY` as a 32-byte base64 value or 64-character hex value.
- `BETTER_AUTH_SECRET` with at least 32 characters.
- `BETTER_AUTH_URL` set to the exact HTTPS application origin.
- `BETTER_AUTH_TRUSTED_ORIGINS` set to exact HTTPS origins only.
- `BETTER_AUTH_IP_HEADERS` set for the hosting/proxy path, for example
  `x-forwarded-for` on direct Vercel deployments.
- `MORGAN_LOG_LEVEL=info` and `MORGAN_LOG_DETAIL=minimal`.

Preview and production must use separate databases. Preview migrations must not
run against production data.

## Public Launch Blockers

These items block public release:

- Backup and restore procedure documented and tested on a production-like
  Postgres database.
- Secret rotation runbook for `BETTER_AUTH_SECRET`, `MORGAN_ENCRYPTION_KEY`,
  database credentials, and Binance credentials.
- Privacy policy, terms, and financial-data disclaimer written and linked from
  the product.
- Monitoring and alerting for app errors, slow API routes, failed enrichment
  jobs, and database health.
- Production rollback plan covering app deploy rollback and database migration
  recovery.
- Browser QA matrix completed for Chrome, Edge, Safari, Firefox, desktop, and
  mobile widths.
- Dense-data QA completed with years of cash, investment, ETF, stock, crypto,
  salary, expense, and import history.
- Security review completed for authentication, profile ownership, mutation
  origin checks, credential storage, log redaction, and rate limits.

## Private Beta Criteria

A private beta can proceed when:

- `pnpm run release:check` is green on the release branch.
- Docker pre-production smoke and full browser flow are green.
- The beta uses a dedicated database and dedicated secrets.
- Users are known testers, not public signups.
- Testers understand that Morgan is pre-release finance software and that they
  must keep external backups of their source records.

## Go / No-Go

Use this decision rule:

- Go for private beta when all private beta criteria pass.
- No-go for public launch while any public launch blocker remains open.
- Go for public launch only after this document, the deployment guide, and
  `SECURITY.md` match the deployed system.
