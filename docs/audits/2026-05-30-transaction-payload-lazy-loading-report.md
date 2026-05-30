# Transaction Payload Lazy Loading Report - 2026-05-30

## Scope

Follow-up after merging `codex/data-scale-cleanup` into `main`.

Goals:

- stop sending provider transaction rows inside Checking, Investments and Crypto summary payloads;
- expose paginated row endpoints for table data;
- keep dense accounts visually responsive while preserving access to historical rows.

## Completed In This Pass

### Summary Payloads Without Rows

The existing detail summary endpoints now return chart/card data plus `transactionCount` per provider, but no `provider.transactions` arrays:

- `/api/transactions/checking`
- `/api/transactions/investment`
- `/api/transactions/crypto`

This keeps chart/card rendering behavior intact while removing thousands of row objects from the first section payload.

### Paginated Transaction Row Endpoints

New row endpoints load table data by profile, provider, `limit` and `offset`:

- `/api/transactions/checking/rows`
- `/api/transactions/investment/rows`
- `/api/transactions/crypto/rows`

Each response returns `transactions`, `total`, `offset`, `limit` and `nextOffset`.

### Client-Side Lazy Loading

Checking and portfolio provider cards now use a shared `useTransactionRows` hook. The hook:

- loads the first 20 rows only when the section is active;
- automatically loads the next 10 rows as the user scrolls near the bottom of the table;
- deduplicates in-flight and very recent identical page requests to keep React dev Strict Mode from doubling row fetches.

## Validation

Targeted checks:

```powershell
pnpm vitest run tests/unit/server/repositories/transaction-read-repository.test.ts tests/unit/server/services/checking-data.test.ts tests/unit/server/services/portfolio-data.test.ts
pnpm run lint
pnpm run typecheck
pnpm run typecheck:test
pnpm run test:run
```

Browser QA used a temporary local account with a synthetic 10-year dense dataset:

- checking: 2373 transactions;
- investment: 512 transactions;
- crypto: 375 transactions;
- asset history: 60848 rows.

Observed network behavior:

- summary endpoints reported `hasProviderTransactions: false`;
- Checking initial rows: 20 rendered rows per provider, 60 total across 3 providers;
- Checking after scrolling the first provider table: 30 rows in that table, with `/rows?limit=10&offset=20`;
- Investments initial rows: 20 rendered rows, then 30 after scroll with `/rows?limit=10&offset=20`;
- Crypto initial rows: 20 rendered rows, then 30 after scroll with `/rows?limit=10&offset=20`;
- no `Load more` text remained in the UI;
- no browser console errors or warnings were observed.

Screenshots and captured API summaries are in `artifacts/screenshots/payload-lazy-loading`.

## Remaining Work

1. Reduce summary payload size further by compressing or windowing daily buckets for very long `ALL` ranges.
2. Add a repeatable Playwright performance trace for row pagination and chart interaction.
3. Consider true table virtualization if individual providers grow beyond tens of thousands of rows.
