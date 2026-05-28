# Prisma Runtime Schemas

Morgan keeps separate Prisma schemas for the supported storage targets.

## Postgres Web/Cloud

- Schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/`
- Env: `DATABASE_URL` and `DIRECT_URL`
- Commands:

```powershell
pnpm run prisma:generate:postgres
pnpm run db:migrate:postgres
pnpm run db:migrate:dev:postgres
```

This is the default runtime for local Docker, Vercel, and Neon.

## SQLite Desktop Scaffold

- Schema: `prisma/sqlite/schema.prisma`
- Env: `SQLITE_DATABASE_URL`
- Commands:

```powershell
pnpm run prisma:generate:sqlite
pnpm run db:migrate:dev:sqlite
```

The SQLite path is a scaffold for the future desktop/offline target. Generating
the Prisma client for SQLite swaps the generated client provider for the local
workspace; run `pnpm run prisma:generate:postgres` before returning to the web
or Docker target.

Do not mix Postgres migrations into the SQLite folder. When SQLite persistence
becomes active, create SQLite-specific migrations under `prisma/sqlite/`.
