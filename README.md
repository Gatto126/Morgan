# Morgan Finance

Morgan Finance is a personal finance workspace built with Next.js, Prisma, and Postgres for the cloud web target. It helps private users consolidate bank activity, investment transactions, crypto balances, and portfolio performance into one self-hosted dashboard.

The application is designed for personal data ownership: authentication is handled by the app, financial records stay in the database you control, and external integrations are used only when the user explicitly configures them. The future desktop/offline target will keep a separate local SQLite storage path.

## Key Features

- Multi-profile finance workspace with local account authentication.
- Dashboard for net worth, account allocation, cash flow, and historical performance.
- Import flow with transaction preview, duplicate detection, and approval before writing data.
- BBVA checking account parser for XLSX statements.
- Trade Republic parser for CSV investment and cash activity.
- Investment tracking with ISIN enrichment and price history through JustETF scraping.
- Crypto transaction tracking and historical token pricing through Binance market data.
- Optional Binance API connection for live wallet balances, with encrypted credential storage.
- Postgres persistence through Prisma for Vercel/Neon deployment.

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Prisma ORM with PostgreSQL
- Better Auth for local authentication
- Tailwind CSS 4
- Recharts for dashboard visualizations
- Playwright and node-html-parser for market metadata scraping
- read-excel-file for XLSX statement parsing

## Getting Started

### Prerequisites

- Node.js 20 LTS or newer
- pnpm 10 or newer
- Docker Desktop, for the local Postgres pre-production database

### Installation

```bash
git clone https://github.com/Gatto126/Morgan.git
cd Morgan
pnpm install
```

### Environment

Create a local environment file from the example:

```bash
cp .env.example .env
```

Configure the required values:

```env
DATABASE_URL=postgresql://morgan:morgan@localhost:5432/morgan?schema=public
DIRECT_URL=postgresql://morgan:morgan@localhost:5432/morgan?schema=public
MORGAN_DATABASE_PROVIDER=postgresql
MORGAN_ENCRYPTION_KEY=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://192.168.*.*:3000
BETTER_AUTH_IP_HEADERS=x-forwarded-for
```

Recommended secret generation:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use separate values for `MORGAN_ENCRYPTION_KEY` and `BETTER_AUTH_SECRET`.

For a public Vercel deployment, set `BETTER_AUTH_URL` to the final HTTPS origin,
keep `BETTER_AUTH_TRUSTED_ORIGINS` to exact origins you control, and use
`BETTER_AUTH_IP_HEADERS=x-forwarded-for` for direct Vercel deployments.

### Database Setup

```bash
pnpm run docker:postgres
pnpm run prisma:generate
pnpm run db:migrate
```

### Development

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the application.

### Local Runtime Policy

Keep local services stopped by default. Start only the runtime needed for the
task, then stop it when finished:

- port `3000` is for the local Next.js development server;
- `pnpm run dev:docker` also serves the app on port `3000`, but points it at
  Docker Postgres on `localhost:5432`;
- port `3001` is reserved for the Docker pre-production app container;
- Docker should be running only while using Postgres or pre-production checks.

Use `pnpm run docker:postgres:down` or `pnpm run docker:preprod:down` after
Docker-backed work. Do not keep both `3000` and `3001` running unless a task
explicitly compares development and production-like behavior.

## Available Scripts

```bash
pnpm run dev              # Start the local development server on port 3000
pnpm run dev:docker       # Start Next dev on port 3000 against Docker Postgres
pnpm run build            # Create a production build
pnpm run start            # Start the production server
pnpm run lint             # Run ESLint
pnpm run typecheck        # Typecheck application code without tests
pnpm run typecheck:test   # Typecheck tests and fixtures
pnpm run test:run         # Run unit tests
pnpm run release:check    # Run lint, typecheck, tests, and production build
pnpm run test:unit        # Run tests already migrated under tests/unit
pnpm run test:scripts     # Run script helper tests
pnpm run test:rate-limit:clear # Clear Better Auth test rate limits on safe local/explicit test DBs
pnpm run smoke:upload-panel # Run the upload-panel navigation smoke test
pnpm run smoke:upload-panel:docker # Run the smoke test against the Docker app on port 3001
pnpm run e2e:docker:full  # Run the full Docker browser flow; Binance runs only when test env keys are provided
pnpm run e2e:realistic    # Run the large realistic browser flow against TEST_BASE_URL or port 3000
pnpm run prisma:generate  # Generate the default Postgres Prisma client
pnpm run prisma:generate:sqlite # Generate the SQLite Prisma client for desktop storage checks
pnpm run db:migrate       # Apply committed Postgres Prisma migrations
pnpm run db:migrate:dev   # Create/apply a new local Postgres migration
pnpm run db:migrate:dev:sqlite # Create/apply a local SQLite migration for the desktop scaffold
pnpm run docker:postgres  # Start the local Postgres service
pnpm run docker:postgres:down # Stop the local Postgres service
pnpm run docker:preprod:build # Build the Docker pre-production app image
pnpm run docker:preprod:up # Build and start Postgres + app in Docker
pnpm run docker:preprod:down # Stop the Docker pre-production stack
pnpm run docker:preprod:reset # Stop the stack and remove Docker volumes
pnpm run vercel-build     # Run the Vercel build command locally
```

## Project Structure

```text
prisma/
  migrations/            Postgres migrations for web/cloud
  schema.prisma          Postgres database schema and relations
  sqlite/                 SQLite schema scaffold for future desktop/offline storage
scripts/
  db/                    Local DB maintenance and legacy one-off migrations
  e2e/                   Browser smoke and full-flow checks
  lib/                   Shared script helpers
  testing/               Local test maintenance utilities
tests/
  unit/                  Migrated unit tests grouped by responsibility
  api/                   Route-level tests
  fixtures/              Shared test fixtures and input builders
  setup/                 Shared Vitest setup and env helpers
src/
  app/
    api/                 Route handlers for auth, users, imports, prices, assets, and Binance
    layout.tsx           Root application layout
    page.tsx             Auth-aware application entry point
  client/                Browser-only clients such as Better Auth client wiring
  components/
    auth-shell.tsx       Local account onboarding and login UI
    finance-shell.tsx    Main workspace navigation and import flow
    *-dashboard.tsx      Dashboard surfaces for cash, investments, crypto, and Binance
    ui/                  Shared UI primitives
  domain/                Pure validation, import, pricing, and finance calculations
  integrations/          External clients and provider parsers
  server/                Auth, Prisma, security, repositories, and service workflows
  shared/                Cross-cutting client/server helpers and constants
```

## Architecture Notes

- [Runtime targets and storage decision](docs/architecture/targets.md)
- [Repository structure and duplication rules](docs/architecture/repo-structure.md)
- [Docker pre-production](docs/deployment/docker-preprod.md)
- [Release readiness](docs/deployment/release-readiness.md)
- [SQLite local runtime scaffold](docs/deployment/sqlite-local.md)
- [Vercel and Postgres deployment](docs/deployment/vercel-postgres.md)
- [Testing and script layout](docs/testing/README.md)
- [Audit reports](docs/audits/README.md)

## Data and Security Notes

- `.env` files, local databases, build outputs, and generated caches are intentionally ignored by Git.
- Binance API secrets are encrypted before being stored.
- Imported transactions are fingerprinted to prevent duplicate persistence.
- Production logging defaults to `MORGAN_LOG_DETAIL=minimal`, omitting response bodies and suppressing noisy integration details.
- Test rate-limit resets are guarded; CI or non-local databases require `MORGAN_ALLOW_TEST_RESET=1`.
- The cloud target is intended for private hosted use while the desktop/offline target is separated later. Review all environment values before deploying outside localhost.

## Preparing a Fresh Remote Push

For a new remote repository, initialize a clean history and push the first commit:

```bash
git init -b main
git remote add origin <remote-url>
git add .
git commit -m "Initial commit"
git push -u origin main
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
