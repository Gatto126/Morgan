# Repository Maintenance Pass

Date: 2026-05-30

Branch: `codex/repo-maintenance`

## Scope

This pass followed the release-readiness merge and focused on repository
maintainability rather than product behavior. The goal was to reduce drift
between local checks, CI, docs, and deployment gates.

## Changes

- `pnpm run release:check` is now the canonical local and CI gate.
- The release gate validates both Prisma schemas before lint, typecheck, tests,
  and production build.
- SQLite schema validation no longer requires a developer to have
  `SQLITE_DATABASE_URL` in the active environment.
- GitHub CI now calls the same release gate as local development instead of
  duplicating each command manually.
- README, script docs, and release-readiness docs now describe the same gate.

## Verification

Passed:

```powershell
pnpm run prisma:validate
pnpm run release:check
```

`release:check` covered:

- Postgres Prisma schema validation;
- SQLite Prisma schema validation;
- ESLint;
- app TypeScript check;
- test TypeScript check;
- Vitest suite;
- production Next.js build.

## Remaining Maintenance Backlog

- Keep Docker pre-production E2E as a separate heavier gate because it builds
  containers and drives a browser.
- Add backup/restore, monitoring, rollback, and legal/privacy release work from
  `docs/deployment/release-readiness.md` before public launch.
- Continue small repo passes by consolidating docs that describe the same
  workflow whenever they drift.
