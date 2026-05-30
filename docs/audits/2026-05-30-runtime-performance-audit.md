# Runtime Performance Audit - 2026-05-30

## Scope

Branch: `codex/runtime-performance-audit`

Baseline after merging `codex/transaction-payload-lazy-loading` into `main`.
The audit focused on runtime behavior with a dense local profile, especially:

- navigation between Home, Dashboard, Checking, Investments, Crypto, Settings;
- loader stability after the previous dashboard loader fixes;
- payload size and API timing under a 10-year dataset;
- table lazy loading behavior;
- likely sources of Edge input latency.

## Dataset

Temporary local account: `rrtmprpmxat`

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

## Verification

Passed:

```bash
pnpm run lint
pnpm run typecheck
pnpm run typecheck:test
pnpm run test:run
pnpm run build
```

Test result: 53 files passed, 220 tests passed.

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
- `artifacts/performance/runtime-audit/network-results.json`

Result:

- no visible Next.js error overlay;
- loader did not duplicate;
- chart `ALL` remains daily over the full range;
- transaction rows load incrementally on scroll;
- visual screenshots were captured for all target sections.

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

The branch is healthy after the first runtime optimization. The most valuable
next step is a payload-focused change, not more loader work:

1. introduce separate initial summary vs detailed chart endpoints;
2. move detailed product/token daily maps behind on-demand requests;
3. re-run the same dense-profile network baseline and compare raw bytes and
   navigation timings.
