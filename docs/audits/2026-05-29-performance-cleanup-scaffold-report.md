# Performance Cleanup And Scaffold Audit

Date: 2026-05-29
Branch: `codex/project-cleanup-performance`

## Scope

This pass reviewed the full project after the P2/P3 hardening checkpoint, with a
focus on:

- Edge-only typing latency in profile and Binance API fields;
- tooltip responsiveness during chart hover;
- repository hygiene, ignored/generated files, aliases and folder boundaries;
- maintainability hotspots by file size and ownership.

## Actions Taken

### Input Typing Latency

The likely bottleneck was controlled input state stored in `FinanceShell`.
Typing one character in the profile name or Binance API fields updated the main
shell state and could re-render the dashboard/chart tree. Chrome tolerated this
better, while Edge showed visible input delay.

Changed the inputs to keep draft state inside the leaf components:

- `CreateProfileStage`
- `ProfileCreateSection`
- `SettingsApiKeySection`

The shell now receives the submitted values only when the user confirms the
action. Binance draft fields also remount by active profile and saved/unsaved
credential state, so local drafts are cleared without synchronization effects.

### Tooltip Render Churn

`ChartTooltip` previously called `setActivePoint` whenever Recharts supplied a
fresh payload array, even if the visible tooltip point had not actually changed.
That can drive avoidable parent chart re-renders during mouse movement.

Added a visible-payload marker and ref guard so active point state changes only
when the active label or displayed series values change.

## Scaffold Findings

### Repository State

- No untracked generated files are leaking into git.
- `.next`, `artifacts`, `*.tsbuildinfo`, local databases and env files are
  ignored.
- `components.json` now points to the current `@/shared` and `@/shared/utils`
  aliases, not the removed `@/lib`.
- Current physical structure matches the documented transition model:
  `src/domain`, `src/integrations`, `src/server`, `src/shared`,
  `src/client`, `src/components`.

### Notable Hotspots

Largest maintainability targets found in the scan:

- `scripts/e2e/active-components-walkthrough.mjs`
- `src/integrations/justetf/justetf-parser.ts`
- `src/domain/finance/dashboard-timeseries.ts`
- `scripts/e2e/smoke-upload-panel.mjs`
- `src/components/finance-shell.tsx`
- `src/domain/imports/trade-republic-csv-parser.ts`

These are not currently broken, but they are the best candidates for future
splitting if we continue the cleanup.

### Residual Opportunities

- The production first-load JS for `/` is about `272 kB`; charts and dashboard
  modules are the likely next performance target.
- Edge should be profiled directly with React Profiler or browser performance
  tools if latency remains after this state-localization pass.
- E2E scripts are useful but large; extracting shared scenario helpers would
  make them easier to maintain.

## Verification

Commands passed:

- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run typecheck:test`
- `pnpm run test:run` (`51` files, `200` tests)
- `pnpm run build`
- `git diff --check`

Local smoke:

- Started Docker Postgres and Next dev on `http://127.0.0.1:3000`.
- Registered a temporary smoke account and created a profile.
- Measured profile input typing: `18` chars in `32 ms` (`1.8 ms/char`).
- Measured Binance API input typing: `32` chars in `31 ms` (`1.0 ms/char`).
- Measured Binance secret input typing: `32` chars in `29 ms` (`0.9 ms/char`).
- Captured screenshot in `artifacts/screenshots/performance-smoke-api-settings.png`.
- Deleted the temporary smoke account.
- Stopped Next dev and shut Docker down.

## Status

The Edge latency fix is implemented and verified in the local browser smoke.
The repo scaffold is coherent after the previous alias and structure work. The
next meaningful cleanup should target bundle/charts and the largest parser/e2e
files rather than broad folder churn.
