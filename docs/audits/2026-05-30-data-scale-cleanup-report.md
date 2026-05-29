# Data Scale And Cleanup Report - 2026-05-30

## Scope

Follow-up after merging `codex/dashboard-render-performance` into `main`.

Goals:

- reduce repeated live price refresh work across Dashboard, Investments and Crypto;
- reduce initial DOM cost from large transaction tables;
- keep repo/scaffold direction aligned with the architecture notes.

## Completed In This Pass

### Shared Price Request Cache

`src/shared/live-prices.ts` now owns:

- global live price cache;
- per-key freshness timestamps with a 60 second TTL;
- normalized request keys;
- per-key in-flight request deduplication, including overlapping subset requests;
- fetch/cache helper for `/api/prices`.

Dashboard and portfolio dashboards now call the shared helper instead of each owning the same fetch/cache logic. This reduces duplicate initial refreshes, especially when preload and active-stage effects fire close together, avoids re-fetching prices that were just loaded by another section, and lets a detail section wait for an already running broader Dashboard refresh.

### Lighter Transaction Tables

Checking and portfolio provider transaction cards now render the latest `100` rows by default and expose a command button to expand to the full provider history.

This keeps dense accounts responsive without removing access to older imported rows.

## Validation

Targeted checks:

```powershell
pnpm vitest run tests/unit/shared/live-prices.test.ts tests/unit/server/services/price-refresh.test.ts tests/unit/ui/chart-data/dashboard-chart-model.test.ts
pnpm run typecheck
pnpm run lint
```

All targeted checks passed after adding coverage for request-key normalization, successful cache writes, fresh-cache reuse, partial stale refreshes, identical concurrent request deduplication and overlapping broad/subset request deduplication.

## Repo/Scaffold Notes

The current scaffold remains coherent with `docs/architecture/repo-structure.md`:

- `components.json` aliases point at `@/shared` and `@/components/ui`;
- `.gitignore` excludes local env files, build output, artifacts, tsbuildinfo, local DB files and reports;
- new benchmark tooling lives in `scripts/testing`;
- durable findings live in `docs/audits`;
- client-only request dedupe stayed in `src/shared` because it is a small cross-cutting browser helper already consumed by UI hooks.

## Remaining Work

1. Split summary payloads from transaction-table payloads.
   - Current APIs still return provider summaries and transaction rows together.
   - Next step: keep chart/cards payload small, then lazy-load table rows per provider.

2. Replace `Show all` expansion with real pagination or virtualization if row counts grow into the tens of thousands.

3. Add a browser performance trace around large-provider table expansion.

4. Split browser-level network/performance assertions into a repeatable Playwright script so future dense-account regressions are caught without a manual walkthrough.
