# Runtime Targets And Storage Decision

Date: 2026-05-27

Status: accepted, Postgres implemented, SQLite scaffolded

## Context

Morgan must support two product shapes without turning into two separate products:

- a hosted web app for personal testing and future online use;
- a private local/offline Windows app for users who do not want to expose finance data online.

The hosted app needs a production-ready database for serverless deployment. The desktop app needs a low-friction local database that does not require the user to manage a DB server.

## Decision

Morgan will support these targets:

| Target | Runtime | Database | Intended use |
| --- | --- | --- | --- |
| Cloud production | Vercel Hobby | Neon Postgres | Public/private hosted app |
| Cloud pre-production | Vercel Preview + Docker locally | Neon preview branch or local Postgres | Release validation |
| Desktop offline | Windows desktop app, likely Tauri | Local SQLite file | Private local use |

Cloud and pre-production use Postgres. Desktop/offline uses SQLite.

## Why Not Postgres Everywhere

Postgres everywhere would simplify provider parity, but it would make the desktop app harder for normal users:

- a local Postgres server must be installed, started, updated and backed up;
- packaging with a desktop app is more complex;
- support issues become more likely: occupied ports, service permissions, local credentials, antivirus interference;
- "download and open" becomes "download, configure a database, then open".

SQLite is a better fit for a single-user offline desktop app:

- no server process;
- one local database file;
- simple backup/export story;
- strong offline behavior;
- low operational burden for non-technical users.

SQLite is not the right storage for Vercel/serverless production, but it is a good storage engine for a local desktop product.

## Non-Negotiable Product Rules

- Desktop/offline mode must not send financial data to Morgan cloud infrastructure.
- Desktop/offline mode may call external services only when the user explicitly uses integrations such as Binance or price/metadata retrieval.
- Cloud mode must use a server database, not local filesystem persistence.
- Shared UI, parsing, calculations and validation must not be duplicated per target.
- Target-specific code should be limited to app shells, persistence adapters and deployment wiring.

## Storage Boundary

The application should move toward a storage boundary:

```text
UI and workflows
  -> domain services
    -> repository/storage interface
      -> Postgres implementation for web/cloud
      -> SQLite implementation for desktop/offline
```

The goal is not to hide every Prisma call immediately. The goal is to stop new code from deepening target coupling.

Short term:

- keep the current Next.js app working;
- keep the web/cloud path on Postgres;
- keep Docker Postgres available for pre-production tests;
- maintain the SQLite Prisma schema scaffold for desktop/offline validation;
- document which modules are web-only until extraction.

Medium term:

- extract parser, import, pricing and chart data logic into target-neutral packages;
- introduce repository interfaces around persistence-heavy workflows;
- add SQLite-backed desktop persistence after the target-neutral core is stable.

## Target Details

### Cloud Production

Recommended stack:

- Vercel Hobby for the Next.js app;
- Neon Postgres Free for the production database;
- `BETTER_AUTH_URL=https://<app>.vercel.app`;
- `BETTER_AUTH_TRUSTED_ORIGINS=https://<app>.vercel.app`;
- `BETTER_AUTH_IP_HEADERS=x-forwarded-for`.

This target is suitable for online testing and personal hosted use. The Hobby plan should be treated as a free/hobby deployment, not as a commercial production guarantee.

### Cloud Pre-Production

Recommended stack:

- Vercel Preview deployments for pull requests or preview branches;
- Neon preview branches when available;
- Docker Compose with local Postgres for repeatable local pre-production checks.

Pre-production should run the same Postgres schema and migrations used by cloud production.

### Desktop Offline

Recommended direction:

- Tauri for the Windows app shell;
- WebView2 as the Windows webview runtime through Tauri;
- SQLite local database file;
- local encryption for stored integration secrets;
- explicit network controls for Binance and price retrieval.

Tauri is preferred over a C#/.NET WebView2 shell because Morgan's UI and workflows are already React/TypeScript. A C# shell can be reconsidered only if the desktop app becomes deeply Windows-native.

The current desktop product direction is captured as a concept mockup in
`docs/desktop/windows-desktop-mockup.md`. That mockup is not an implementation
commitment; it exists to define desktop-only product concerns before any desktop
runtime code is introduced.

## Migration Implications

The project now has explicit Prisma schemas for two database providers:

- Postgres schema/migrations for web and pre-production;
- SQLite schema scaffold for desktop.

To keep this maintainable:

- avoid raw provider-specific SQL in domain workflows;
- isolate provider-specific queries in storage modules;
- keep data shapes shared through TypeScript types and validation schemas;
- add tests at the domain layer and adapter layer separately.

## Open Questions

- Final desktop shell: Tauri is the current recommendation, but it should be validated with a minimal proof of concept.
- Desktop packaging format: MSI, NSIS installer, portable build, or more than one.
- Desktop backup/export format.
- Whether desktop SQLite should stay on Prisma, or move to Drizzle, raw SQLite, or a small repository layer.
- How much of the current Prisma usage should move behind repository functions before the desktop app begins.
