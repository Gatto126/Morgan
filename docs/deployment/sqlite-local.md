# SQLite Local Runtime

Date: 2026-05-28

Status: scaffold

SQLite is reserved for the future desktop/offline target. The current web app,
Docker pre-production stack, and Vercel/Neon deployment use Postgres by default.

## Local Scaffold

Use the SQLite example env only when intentionally validating the desktop
storage path:

```powershell
Copy-Item .env.sqlite.example .env.sqlite
```

Required values:

```env
SQLITE_DATABASE_URL=file:./prisma/sqlite/dev.db
MORGAN_DATABASE_PROVIDER=sqlite
MORGAN_ENCRYPTION_KEY=<local secret>
BETTER_AUTH_SECRET=<local secret>
```

Generate the SQLite Prisma client and create local SQLite migrations:

```powershell
pnpm run prisma:generate:sqlite
pnpm run db:migrate:dev:sqlite
```

When returning to the web, Docker, or Vercel target, regenerate the Postgres
client:

```powershell
pnpm run prisma:generate:postgres
```

## Boundaries

- Do not deploy SQLite to Vercel.
- Do not reuse Postgres migrations for SQLite.
- Keep parser, import, validation, chart, and UI behavior provider-neutral.
- Add provider-specific persistence behind small storage functions as desktop
  work begins.
