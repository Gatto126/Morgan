# Bundle Performance Report

Date: 2026-05-30
Branch: `codex/bundle-performance`

## Goal

Reduce the first-load JavaScript cost of `/` without changing the product
layout or the finance workflow.

## Baseline

Production build before this pass:

- Route `/` size: `170 kB`
- First Load JS for `/`: `272 kB`

The likely cause was `DashboardStageStack` importing every dashboard module at
startup. Those modules pull in chart code and Recharts even when the user is on
landing, auth, welcome, profile creation or settings.

## Implementation

`DashboardStageStack` now:

- dynamically imports dashboard modules with `next/dynamic`;
- mounts only the currently active dashboard stage;
- returns `null` outside dashboard stages, so hidden dashboards do not fetch data
  or load chart chunks while the user is on Home/profile/settings/create flows;
- keeps a small spinner fallback for dashboard chunk loading.

The attempted conditional server import of `AuthShell`/`FinanceShell` did not
change the production bundle size, so it was discarded to avoid extra
complexity.

## Result

Production build after this pass:

- Route `/` size: `44.4 kB`
- First Load JS for `/`: `147 kB`

Change:

- Route `/`: `-125.6 kB`
- First Load JS: `-125 kB`
- First Load JS reduction: about `46%`

## Visual Verification

Screenshots captured under `artifacts/screenshots/`:

- `bundle-visual-landing.png`
- `bundle-visual-create-profile.png`
- `bundle-visual-dashboard.png`
- `bundle-visual-settings-api.png`
- `bundle-postfix-initial.png`
- `bundle-postfix-profile-panel.png`

Manual browser checks covered:

- landing page;
- account registration;
- first profile creation;
- dashboard empty/upload state;
- Binance API settings panel;
- profile selection panel with active profile marker;
- API key and secret typing latency after lazy loading.

Observed typing latency in the settings smoke stayed low:

- Binance API field: `27` chars in `36 ms` (`1.3 ms/char`)
- Binance secret field: `27` chars in `31 ms` (`1.1 ms/char`)

## Automated Verification

Additional E2E smoke:

- `node scripts/e2e/smoke-upload-panel.mjs --base-url=http://127.0.0.1:3000 --no-start-server`

The first E2E run exposed that hidden dashboard stages were still being mounted
outside dashboard views. After changing `DashboardStageStack` to return `null`
outside dashboard stages, the smoke passed.

## Follow-Up Candidates

- Add a small automated budget check that fails if `/` First Load JS regresses
  above a chosen threshold.
- Profile a populated dashboard with real imported transactions to tune chart
  render time, not just first-load size.
- Split the largest E2E scripts into shared scenario helpers.
