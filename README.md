# Morgan Finance

Morgan Finance is a local-first personal finance workspace built with Next.js, Prisma, and SQLite. It helps private users consolidate bank activity, investment transactions, crypto balances, and portfolio performance into one self-hosted dashboard.

The application is designed for personal data ownership: financial records stay in a local SQLite database, authentication is handled by the app, and external integrations are used only when the user explicitly configures them.

## Key Features

- Multi-profile finance workspace with local account authentication.
- Dashboard for net worth, account allocation, cash flow, and historical performance.
- Import flow with transaction preview, duplicate detection, and approval before writing data.
- BBVA checking account parser for XLSX statements.
- Trade Republic parser for CSV investment and cash activity.
- Investment tracking with ISIN enrichment and price history through JustETF scraping.
- Crypto transaction tracking and historical token pricing through Binance market data.
- Optional Binance API connection for live wallet balances, with encrypted credential storage.
- SQLite persistence through Prisma, optimized for a private self-hosted setup.

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Prisma ORM with SQLite and better-sqlite3
- Better Auth for local authentication
- Tailwind CSS 4
- Recharts for dashboard visualizations
- Playwright and node-html-parser for market metadata scraping
- SheetJS for XLSX statement parsing

## Getting Started

### Prerequisites

- Node.js 20 LTS or newer
- pnpm 10 or newer

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
SQLITE_DATABASE_URL=file:./dev.db
MORGAN_ENCRYPTION_KEY=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://192.168.*.*:3000
BETTER_AUTH_IP_HEADERS=
```

Recommended secret generation:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use separate values for `MORGAN_ENCRYPTION_KEY` and `BETTER_AUTH_SECRET`.

For a public deployment, set `BETTER_AUTH_URL` to the final HTTPS origin and keep
`BETTER_AUTH_TRUSTED_ORIGINS` to exact origins you control. Configure
`BETTER_AUTH_IP_HEADERS` for the proxy that terminates traffic before the app:
use `cf-connecting-ip` on Cloudflare, or the sanitized `x-forwarded-for` header
only when your host/proxy guarantees clients cannot spoof it.

### Database Setup

```bash
pnpm run prisma:generate
pnpm run db:push
```

### Development

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the application.

## Available Scripts

```bash
pnpm run dev              # Start the local development server
pnpm run build            # Create a production build
pnpm run start            # Start the production server
pnpm run lint             # Run ESLint
pnpm run test:run         # Run unit tests
pnpm run smoke:upload-panel # Run the upload-panel navigation smoke test
pnpm run prisma:generate  # Generate the Prisma client
pnpm run db:push          # Apply the Prisma schema to the SQLite database
```

## Project Structure

```text
prisma/
  schema.prisma          Database schema and relations
scripts/
  reclassify.ts          Transaction classification utility
  seed.ts                Local demo-data seed script
src/
  app/
    api/                 Route handlers for auth, users, imports, prices, assets, and Binance
    layout.tsx           Root application layout
    page.tsx             Auth-aware application entry point
  components/
    auth-shell.tsx       Local account onboarding and login UI
    finance-shell.tsx    Main workspace navigation and import flow
    *-dashboard.tsx      Dashboard surfaces for cash, investments, crypto, and Binance
    ui/                  Shared UI primitives
  lib/
    auth.ts              Better Auth configuration
    db.ts                Prisma client setup
    transaction-import.ts Import orchestration and persistence
    *-parser.ts          Statement, market data, and integration parsers
```

## Data and Security Notes

- `.env` files, local databases, build outputs, and generated caches are intentionally ignored by Git.
- Binance API secrets are encrypted before being stored.
- Imported transactions are fingerprinted to prevent duplicate persistence.
- The application is intended for private self-hosting. Review all environment values before deploying outside localhost.

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
