# Repository Structure And Duplication Rules

Date: 2026-05-27

Status: proposed direction

## Goal

Morgan must remain maintainable while supporting multiple targets:

- cloud web app;
- pre-production Docker/Postgres;
- desktop offline app.

The rule is simple: product behavior and UI should be shared by default. Target-specific code should exist only where the runtime truly differs.

## Future Structure

The target structure should evolve toward:

```text
apps/
  web/
    Next.js app for Vercel
  desktop/
    Tauri desktop shell

packages/
  ui/
    Shared buttons, inputs, modals, layout primitives, icons
  domain/
    Pure finance logic, validation, import rules, chart data transforms
  integrations/
    Binance, price providers, metadata fetchers
  db-postgres/
    Postgres Prisma schema, migrations, storage adapter
  db-sqlite/
    SQLite schema, migrations, storage adapter
  config/
    Shared env parsing and deployment/security config

docs/
  architecture/
  deployment/
  desktop/
```

The current app can stay where it is while we migrate. This document describes the direction and the rules for new code.

## Ownership Rules

### `apps/web`

Contains only:

- Next.js route handlers;
- Next.js server component entrypoints;
- Vercel-specific wiring;
- web-only auth/session integration;
- web-only environment setup.

Must not contain reusable UI primitives, parser logic or finance calculations.

### `apps/desktop`

Contains only:

- Tauri shell configuration;
- desktop window/menu/tray behavior;
- local filesystem and OS integration;
- desktop-only bootstrap and update logic.

Must not fork the product UI unless the desktop workflow is genuinely different.

### `packages/ui`

Contains:

- button primitives;
- input primitives;
- dialogs/modals;
- navigation components;
- shell layout pieces;
- shared visual states.

If a button radius, hover style or disabled state changes, it should change here once.

### `packages/domain`

Contains target-neutral logic:

- import preview rules;
- transaction normalization;
- duplicate/fingerprint logic;
- chart/time-series calculations;
- account/profile validation rules;
- shared Zod schemas or validation helpers.

Must not import from `apps/*`, Prisma clients, Tauri APIs or Next.js.

### `packages/integrations`

Contains external service clients and parsers:

- Binance balance and price fetchers;
- ETF/asset metadata fetchers;
- provider-specific parsing helpers.

Network access should be explicit and injectable so desktop/offline mode can disable or gate it.

### `packages/db-postgres` And `packages/db-sqlite`

Contain provider-specific persistence:

- schemas and migrations;
- Prisma/driver setup;
- storage adapter implementations;
- provider-specific query optimizations.

They may depend on `packages/domain` types, but `packages/domain` must not depend on them.

## Dependency Direction

Allowed:

```text
apps/* -> packages/ui
apps/* -> packages/domain
apps/* -> packages/integrations
apps/web -> packages/db-postgres
apps/desktop -> packages/db-sqlite
packages/db-* -> packages/domain
packages/integrations -> packages/domain
```

Forbidden:

```text
packages/* -> apps/*
packages/domain -> packages/db-*
packages/ui -> apps/*
packages/ui -> packages/db-*
apps/web -> packages/db-sqlite
apps/desktop -> packages/db-postgres
```

## Anti-Duplication Rules

- A reusable UI primitive must live in `packages/ui`.
- A calculation used by more than one target must live in `packages/domain`.
- A network integration used by more than one target must live in `packages/integrations`.
- A route handler or Tauri command should be thin: validate input, call shared logic, return output.
- Do not copy a component into a target folder to make a small style change.
- Do not create target-specific versions of the same business rule.
- Provider-specific persistence is allowed to differ, but input/output shapes should stay shared.

## Naming Rules

Use target suffixes only when the code truly differs:

```text
profile-repository.postgres.ts
profile-repository.sqlite.ts
```

Avoid target suffixes for shared code:

```text
button.tsx
transaction-import.ts
portfolio-timeseries.ts
```

## Current Physical Structure

The repository has not moved to `apps/` and `packages/` yet. Current target
boundaries are:

- `prisma/schema.prisma` and `prisma/migrations/` for Postgres web/cloud;
- `prisma/sqlite/schema.prisma` for the desktop SQLite scaffold;
- `src/domain/` for target-neutral validation, import rules and finance
  calculations;
- `src/integrations/` for external provider clients and parsers;
- `src/server/` for auth, Prisma, security, logging, service workflows and
  repository adapters;
- `src/shared/` for cross-cutting client/server helpers and constants;
- `src/client/` for browser-only client wiring;
- thin route handlers under `src/app/api/` that call `src/server/services/`
  for business workflows;
- `src/server/repositories/` for persistence access used by business services;
- `scripts/e2e/` for browser flows;
- `scripts/testing/` for local test maintenance;
- `docs/audits/` for durable audit reports;
- `docs/desktop/` for desktop/offline concepts and mockups that should not yet
  introduce desktop runtime code;
- ignored `artifacts/` for disposable run outputs.

## Environment Files

Use separate example files when the targets split:

```text
.env.example
.env.web.example
.env.preprod.example
.env.test-postgres.example
.env.sqlite.example
```

Rules:

- web uses `DATABASE_URL`;
- desktop uses a local SQLite path/config;
- secrets must never be committed;
- production examples should use HTTPS origins;
- local examples should stay localhost-first.

## Testing Matrix

Minimum target checks:

| Layer | Web/Postgres | Desktop/SQLite |
| --- | --- | --- |
| Domain unit tests | Required | Shared |
| Storage adapter tests | Required | Required |
| UI component tests/smoke | Required | Required after desktop exists |
| Import/parser tests | Shared | Shared |
| Build/package test | `pnpm build` | Tauri build smoke |

Pre-production should run Postgres tests through Docker before deploy.

## Current Transition Rules

Until the repo is physically split:

- treat `src/components/ui` as future `packages/ui`;
- treat `src/domain` as future `packages/domain`;
- treat `src/integrations` as future `packages/integrations`;
- keep new persistence-heavy code behind `src/server/repositories` and call it
  from `src/server/services`;
- `src/domain` and `src/shared` are guarded by ESLint against React, Next,
  Prisma, server, client and component imports;
- `src/components` and `src/client` are guarded by ESLint against server/runtime
  imports;
- `src/app`, `src/server/services` and `src/server/auth/auth-guard.ts` are
  guarded by ESLint against direct Prisma/database imports;
- `src/server` is guarded by ESLint against web UI, client and route imports;
- `src/server/auth/auth.ts` remains an intentional exception because Better Auth
  needs the Prisma adapter wiring there;
- document any target-specific decision in `docs/architecture`.

This avoids a big-bang migration while still making every new change point in the right direction.
