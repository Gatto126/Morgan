# Runtime Performance Audit - 2026-05-30

## Scope

Branch: `codex/runtime-performance-audit`

Baseline after merging `codex/transaction-payload-lazy-loading` into `main`.
This report now also includes the payload split implementation performed on the
same branch.
The audit focused on runtime behavior with a dense local profile, especially:

- navigation between Home, Dashboard, Checking, Investments, Crypto, Settings;
- loader stability after the previous dashboard loader fixes;
- payload size and API timing under a 10-year dataset;
- table lazy loading behavior;
- likely sources of Edge input latency.

## Dataset

Initial audit account: `rrtmprpmxat`

Profile: `Runtime Dense`

Seed command:

```bash
pnpm run seed:performance -- --username=rrtmprpmxat --profile="Runtime Dense" --years=10 --replace
```

Seed summary:

| Area | Count |
| --- | ---: |
| Checking transactions | 2373 |
| Investment transactions | 512 |
| Crypto transactions | 375 |
| Daily asset history rows | 60848 |
| Binance balance rows | 6 |

Implementation QA account: `perfqaprr181y`

Profile: `perfqaprr181y`

Seed command:

```bash
pnpm run seed:performance -- --username=perfqaprr181y --profile=perfqaprr181y --years=12 --replace
```

Seed summary:

| Area | Count |
| --- | ---: |
| Checking transactions | 2828 |
| Investment transactions | 610 |
| Crypto transactions | 447 |
| Daily asset history rows | 72528 |
| Binance balance rows | 6 |

## Verification

Passed:

```bash
pnpm run lint
pnpm run typecheck
pnpm run typecheck:test
pnpm run test:run
pnpm run build
```

Test result: 54 files passed, 225 tests passed.

Build result: Next production build completed successfully.

## Browser QA

The in-app browser was used against `http://localhost:3000/` with the dense profile.

Visited sections:

- Home
- Dashboard
- Checking
- Investments
- Crypto
- Settings

Artifacts:

- `artifacts/screenshots/runtime-performance-audit/`
- `artifacts/screenshots/runtime-performance-audit-contained/`
- `artifacts/screenshots/runtime-performance-qa/`
- `artifacts/performance/runtime-audit/network-results.json`

Result:

- no visible Next.js error overlay;
- loader did not duplicate;
- chart `ALL` remains daily over the full range;
- transaction rows load incrementally on scroll;
- visual screenshots were captured for all target sections.

The final in-app browser reload after the last dev-server restart was blocked
by the browser sandbox policy. The integrated browser pass had already covered
Dashboard, Checking, Investments, Crypto, Settings, provider tabs and table
scroll before that restart. A clean Playwright pass was then run against the
same local app and dense 12-year profile.

## Findings

### P1 - Large summary payloads remain the main scale cost

On the dense profile, the largest raw response bodies were:

| Endpoint | Count | Max size | Max duration |
| --- | ---: | ---: | ---: |
| `/api/transactions/dashboard` | 1 | 2,399,598 B | 1412 ms |
| `/api/transactions/investment` | 1 | 1,202,974 B | 288 ms |
| `/api/transactions/crypto` | 1 | 864,408 B | 756 ms |
| `/api/transactions/checking` | 1 | 697,850 B | 565 ms |

The payload growth is now mostly from daily chart series and repeated nested maps
inside each daily point, not from transaction tables. The previous row lazy
loading work is effective, but chart/data models still transfer large all-range
summary objects.

Recommended next implementation:

- split initial summary payloads from detailed chart series;
- fetch product/token-level daily maps only when a user selects a detailed tab;
- consider compact chart transport arrays for daily series instead of repeated
  object keys per day;
- keep monthly data available for lightweight initial views while preserving
  daily data for `ALL` when requested.

Applied payload split:

- `/api/transactions/dashboard` now returns the financially complete overview
  without provider/product/token detail maps.
- `/api/transactions/dashboard/series` returns the requested detailed series
  for `checking`, `investment`, or `crypto`.
- `/api/transactions/checking` strips provider income/expense maps from the
  initial payload.
- `/api/transactions/checking/series` returns provider flow series on demand.
- `/api/transactions/investment` and `/api/transactions/crypto` strip
  `providerProducts` from the initial payload.
- `/api/transactions/investment/series` and `/api/transactions/crypto/series`
  return product/token-level provider series on demand.
- Client hooks merge detailed series into cached base data only after the user
  opens the corresponding tab/provider. Idle prefetch was removed so large
  series are not fetched in the background.

Live price behavior is preserved: provider summaries, holdings, quantities and
the `/api/prices` request still run on first load, so portfolio/card totals can
show live values immediately.

12-year QA payload results after the split:

| Endpoint | Trigger | Max decoded body |
| --- | --- | ---: |
| `/api/transactions/dashboard` | initial dashboard | 560,023 B |
| `/api/transactions/dashboard/series?series=investment` | clicked dashboard investment tab | 1,462,120 B |
| `/api/transactions/dashboard/series?series=crypto` | clicked dashboard crypto tab | 1,074,577 B |
| `/api/transactions/checking` | opened Checking | 597,621 B |
| `/api/transactions/checking/series?provider=bbva` | clicked BBVA provider | 876,509 B |
| `/api/transactions/investment` | opened Investments | 448,853 B |
| `/api/transactions/investment/series?provider=trade_republic` | clicked TR provider | 1,440,336 B |
| `/api/transactions/crypto` | opened Crypto | 447,845 B |
| `/api/transactions/crypto/series?provider=trade_republic` | clicked TR provider | 1,033,373 B |
| `/api/prices` | first live price refresh | 247 B |

Observed chart line counts in the clean browser pass:

| Section | Visible line paths |
| --- | ---: |
| Dashboard | 4 |
| Dashboard investment tab | 6 |
| Dashboard crypto tab | 2 |
| Checking | 4 |
| Checking provider | 3 |
| Investments | 2 |
| Investments provider | 6 |
| Crypto | 2 |
| Crypto provider | 6 |

### P2 - Hidden dashboard stages still occupy DOM/render budget

The shell intentionally keeps visited dashboard stages mounted so switching back
does not restart loaders or lose UI state. With dense data, this means hidden
charts and transaction tables remain in the document after navigation.

Applied fix:

- inactive dashboard stage roots now receive `content-visibility: hidden`;
- inactive roots also receive layout/paint/style containment;
- React state remains mounted, while the browser can skip work for hidden
  dashboard subtrees.

Touched files:

- `src/components/dashboard/dashboard-status.tsx`
- `src/components/dashboard.tsx`
- `src/components/checking-dashboard.tsx`
- `src/components/portfolio-dashboard/portfolio-dashboard.tsx`

Browser verification confirmed inactive roots expose computed
`content-visibility: hidden` and `contain: content` while active sections remain
visually correct.

### P2 - Table lazy loading is working

Investment table scroll test:

| Metric | Value |
| --- | ---: |
| Rows before scroll | 105 |
| Rows after repeated table scroll | 155 |

Observed row page requests:

- initial `limit=20&offset=0`;
- then incremental `limit=10` pages at offsets `20`, `30`, `40`, `50`, `60`.

Follow-up QA on the 12-year profile confirmed the same model:

- initial provider row requests use `limit=20&offset=0`;
- table scroll triggered `limit=10&offset=20` and `limit=10&offset=30`;
- visible checking rows increased from 60 to 80 after scrolling, without loading
  the full 2828-row dataset.

This matches the desired scroll-driven loading model.

### P3 - Settings overlay keeps the last dashboard visible below it

Settings opens as an overlay on top of the last dashboard stage. This is
consistent with current shell behavior, but it means dense dashboard content can
remain behind settings. The new stage containment helps inactive stages, but the
currently active background dashboard still exists under the settings panel.

Recommended follow-up:

- when settings/user/profile panels are open, pause expensive chart/table work
  for the covered dashboard where possible;
- or mark the covered chart region with containment while the modal-like panel
  is active.

## Current State

The branch is healthy after the payload split and hidden-stage containment.
Initial views still show the same totals, cards, live prices and daily `ALL`
charts, while deep provider/product/token series are now fetched only when the
user opens the relevant detailed tab/provider.

Recommended next optimization:

1. compact the base daily chart transport, because repeated JSON object keys are
   now the largest remaining initial-payload cost;
2. consider server-side memoization for expensive dense-profile series builders;
3. pause or contain the active background dashboard while settings/profile/upload
   overlays are open.
