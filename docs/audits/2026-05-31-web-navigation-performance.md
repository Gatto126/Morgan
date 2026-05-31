# Web Navigation Performance Report

Date: 2026-05-31

## Scope

Tested the realistic browser flow with production build semantics and Docker
pre-production runtime at `http://127.0.0.1:3001`.

The flow creates an auth account, creates profiles, imports realistic Trade
Republic and BBVA files, navigates all dashboard sections, connects and syncs
Binance, removes the saved API credentials, and deletes the disposable account.

Dataset used by the flow:

- 81 Trade Republic rows.
- 180 BBVA rows.
- Primary profile after imports: 306 total transactions.
- Second profile after import: 180 total transactions.
- Binance sync: 95 balances found.

Binance credentials were injected only as process environment variables for the
test run. They were not written to files.

## Implemented Improvements

1. Deferred transaction rows until the table region is visible or the browser is
   idle, with opportunistic idle prefetch for the first provider rows.
2. Kept transaction row requests privately cacheable and versioned by profile
   transaction count.
3. Added stale-cache guards to focus and active-timer refreshes for dashboard,
   checking, investment, and crypto sections. Focus no longer forces network
   refresh while the versioned section cache is fresh.
4. Optimized Binance balance pricing by fetching all ticker prices once and
   pricing locally from an in-memory symbol map, with a fallback to the previous
   pair-by-pair lookup when the batch endpoint is unavailable.
5. Kept the Binance signed-request fix from the initial audit: server time is
   resolved before signed account calls and `recvWindow=60000` is sent.
6. Added production performance traces for critical endpoints. Logs now capture
   endpoint duration, auth time, profile cache hit/miss/dedup status, repository
   query time, builder CPU time, payload size, `/api/prices`, and Binance sync
   steps when `MORGAN_PERF_LOGS` is enabled.
7. Persisted active profile and stage to cookies as well as `localStorage`, then
   server-prime the active dashboard section on reload and seed the client cache
   before dashboard hooks mount.
8. Delayed inactive-section warmup briefly after server-primed reloads so the
   active section paints before background summary prefetches compete.

## Validation Matrix

| Block | Local validation | Docker preprod flow |
| --- | --- | --- |
| Deferred rows + idle prefetch | `pnpm run build` passed | Passed, Binance connected, no browser errors |
| Stale-only focus refresh | `pnpm run build` passed | Passed, Binance connected, no browser errors |
| Binance batch pricing | `vitest` Binance service test passed; `pnpm run build` passed | Passed, Binance connected, no browser errors |
| Production performance traces | `typecheck`, `typecheck:test`, targeted service tests, `pnpm run build` passed | Passed, Binance connected, no browser errors |
| Cookie reload server-prime | `typecheck`, `typecheck:test`, targeted cache tests, `pnpm run build` passed | Passed, reload assertion confirmed no active summary client fetch |

Each Docker gate rebuilt the app image and ran `pnpm run e2e:realistic` against
`http://127.0.0.1:3001`, then the Docker stack was stopped.

## Final Navigation Metrics

Final run after all optimizations:

| Step | Stage | Time | Dashboard API calls during transition |
| --- | ---: | ---: | --- |
| dashboard_first_open | Dashboard | 297 ms | none |
| checking_first_open | Checking | 449 ms | 2 x `/api/transactions/checking/rows` at 14 ms and 15 ms |
| investment_first_open | Investments | 473 ms | `/api/transactions/investment/rows` at 11 ms |
| crypto_first_open | Crypto | 489 ms | `/api/transactions/crypto/rows` at 11 ms |
| dashboard_return_warm | Dashboard | 403 ms | none |
| checking_return_warm | Checking | 389 ms | none |
| investment_return_warm | Investments | 416 ms | none |
| crypto_return_warm | Crypto | 417 ms | none |
| crypto_reload_server_primed | Crypto reload | 868 ms | no `/api/transactions/crypto` summary fetch; `/api/prices` and cached row fetch only |
| binance_after_sync | Binance | 368 ms | none |

The private cache headers are visible on row requests:
`private, max-age=60, stale-while-revalidate=300`.

## Effect

- The original local web run measured checking first-open at 1144 ms. The final
  preprod Docker run measures it at 449 ms with realistic imported data.
- Warm navigation between dashboard, checking, investment, crypto, and Binance
  now completes without dashboard API requests during the transition.
- Reload on a cookie-restored dashboard stage now uses server-primed summary
  data. The e2e flow asserts that the active Crypto summary is not fetched again
  by the client after reload.
- Binance sync remains functionally verified with the real flow and now avoids a
  large price-request fan-out for accounts with many token balances.

## Remaining High-Impact Work

1. For very large profiles, introduce precomputed daily/monthly snapshots keyed
   by profile and transaction version. This is the next big step after request
   caching because it reduces CPU aggregation work, not just network repeats.
2. Move live price refresh further away from reload paint. The active summary is
   now server-primed, but `/api/prices` can still run shortly after Crypto
   reload if live prices are stale.
3. Consider returning one small `initialRows` page for the first provider in each
   section summary if production traces still show row fetches competing with
   first paint.
4. Apply the new database indexes to production during a quiet window and verify
   with Neon query insights after deployment.

## Artifacts

- Screenshot after imports:
  `artifacts/e2e/realistic-browser-flow/after-primary-imports.png`
- Screenshot after dashboard navigation:
  `artifacts/e2e/realistic-browser-flow/dashboard-and-tabs.png`
