# Valuation Refactor Checkpoint

## Objective

Make every primary value in Morgan come from one coherent valuation pipeline:

- historical portfolio series is stable and only recomputed when transactions or stored market history change;
- today's point is calculated from current quantities and the freshest live quotes available;
- topbar, chart, cards and previews read the same current valuation state;
- no current value falls back to historical prices while pretending to be live;
- refreshes never make already-known live values disappear.

## Current Architecture Notes

- Server dashboard payloads are built in `src/server/services/dashboard-data.ts` from all transactions plus `AssetHistory`.
- Investment and crypto dashboards are built in `src/server/services/portfolio-data.ts` with a similar history walk.
- Client live values are applied in:
  - `src/components/dashboard/use-dashboard-live-prices.ts`
  - `src/components/portfolio-dashboard/use-portfolio-live-prices.ts`
  - `src/components/dashboard/dashboard-chart-data-model.ts`
  - `src/components/portfolio-dashboard/chart-data.ts`
  - `src/components/dashboard/use-dashboard-live-totals.ts`
- `/api/prices` already disables historical fallback through `includeHistoricalFallback: false`.
- Stage data cache is date-versioned in `src/components/finance-shell/dashboard-stage-data-cache.ts`.

## Implementation Order

1. Add live quote metadata: `value`, `fetchedAt`, `source`, `status`.
2. Keep topbar/chart pending until all required live quote keys are settled.
3. Make today's point explicit: history until yesterday, live valuation for today.
4. Deduplicate live quote requests and expose freshness/debug information.
5. Add materialized historical valuation tables and regenerate them after import/profile reset.
6. Replace full multi-profile dashboard payloads with lighter previews.

## Progress

- 2026-06-01: Started refactor. First target is live quote metadata and current-value readiness without historical fallbacks.
- 2026-06-01: Added live quote metadata cache. A `null` refresh no longer overwrites the latest numeric live quote.
- 2026-06-01: Current chart points now stay pending for today until required live price values are numeric.
- 2026-06-01: Added opportunistic DB materialized stage snapshots for `dashboard`, `checking`, `investment` and `crypto`, keyed by profile, stage, version and UTC date.

## Guardrails

- Do not hardcode the implementation for a single user, even if production currently has one account.
- Prefer resetting/regenerating derived valuation data over deleting account/profile/transaction source data.
- Commit and push in small verified slices.
