# Morgan Valuation Refactor Checkpoint

Last updated: 2026-06-02
Current baseline commit: `eac7d58` (current pushed baseline before the active-profile warmup slice)
Last fully Vercel-smoked checkpoint: `4fd1966`
Current slice pending Vercel smoke: active-profile parallel warmup + historical-hover pending distinction
Next implementation phase: diagnostics deepening and remaining current-value fallback audit

This file is the durable context for the Morgan valuation/topbar refactor. If the conversation is compacted, resume by reading this document before touching code.

## Product Goal

Morgan must behave like a trustworthy personal finance and portfolio aggregator:

- show the freshest validated current value for every dashboard;
- keep topbar, cards and the last chart point coherent;
- keep historical chart values stable and not recalculate them unnecessarily;
- never show fake `0,00`, stale values pretending to be live, visible `--` placeholders, or disappearing numbers during refresh;
- make dashboard navigation feel instant because data is already warm and values are already current.
- for the active user, every dashboard must show the same committed current snapshot at the same time. Dashboard navigation changes only the visible slice, not the underlying current money state.
- use an elegant animated skeleton for current money values only when there is no valid committed snapshot yet. Once a committed snapshot exists, dashboard switching must not show skeletons; refreshes keep the last committed snapshot visible until a new complete snapshot is ready.
- do not show skeleton for historical hover gaps. If a chart point predates investment/crypto/Binance values, that is historical absence, not a current loading state.

The key product rule is:

> Navigation should change only the view selector, not trigger the creation of the value.

Current invariant to preserve across all dashboards:

```text
heritage = checking + investment + crypto
checking = BBVA + Trade Republic cash
investment = ETF/stock/investment products with live market prices
crypto = Trade Republic crypto + Binance current balances
Trade Republic crypto = BTC + ETH + other imported TR crypto holdings
Binance = BTC + ETH + SOL + XRP + other synced Binance balances
```

All topbar, card and current chart values must come from the same current valuation snapshot. Main dashboard, checking, investment, crypto and Binance dashboards may show different slices, but they must not create different current totals for the same profile/date/version.

## Atomic Current Valuation Policy

Target behavior for the active user:

```text
no valid committed snapshot -> skeleton
valid committed snapshot + refresh in progress -> keep showing committed snapshot
new complete snapshot ready -> atomic swap everywhere
refresh failed or partial -> keep committed snapshot and publish diagnostics
dashboard navigation with committed snapshot -> no skeleton, no fallback, no value recomputation
```

Definitions:

- `committedSnapshot`: the last complete, coherent current valuation snapshot for a profile/version/date. Selectors for topbar, cards, home and current chart points read this snapshot.
- `refreshing/draft`: a non-visible refresh in progress. It can fetch stage data, Binance balances and live quotes, but it must not overwrite visible current values one piece at a time.
- `complete snapshot`: a snapshot whose required children are ready for the requested profile version. Parents such as `crypto` and `heritage` are shown only when their required children are ready or explicitly absent.
- `stale-while-refresh`: while a new snapshot is being built, the UI keeps showing the last committed snapshot. This is preferable to showing partial values or a loading skeleton during ordinary refresh/navigation.

Skeleton policy:

- cold login/F5/profile switch with no committed snapshot for the target profile/version: show skeleton pills/cards/chart placeholders;
- dashboard switch with a committed snapshot: do not show skeleton, render the new dashboard from the same committed snapshot;
- focus/reconnect/daily refresh with a committed snapshot: keep values visible until the new snapshot commits;
- import/Binance connect/delete can invalidate the old profile version. If there is no committed snapshot for the new version, show skeleton until the post-change valuation commits.
- historical tooltip/topbar gaps: render as absent/empty values, not animated loading skeletons.

Active-profile warmup policy:

- when the active profile is known, start the whole current valuation input set immediately;
- stage data, Binance balances and current valuation should be launched in parallel and rely on cache/in-flight de-duplication;
- the active stage remains first priority, but dashboard and Binance must be started before auxiliary checking/investment/crypto stage preloads because they are the critical inputs for the committed current snapshot;
- inactive profiles refresh as background work for the home aggregate, but they must not block or delay the active profile snapshot;
- even with parallel warmup, visible current values still swap only through a complete committed snapshot.

Binance current policy:

- Binance remains current-only until the separate Binance historical sync project.
- Binance balances are input data, not authoritative live current values.
- Binance token with a valid live quote: include in Binance/crypto/heritage current and show in Binance card.
- Binance token with missing/unavailable/invalid quote: exclude from current totals and hide from current-value card rows; record the token/key in diagnostics. Do not use `balance.eurValue` as an unmarked current fallback.
- Token name/quantity may be shown as synced balance data only if the UI clearly separates it from current valuation. For the current valuation card, prefer hiding unpriced token rows.

## Target Architecture

### 1. Provider Adapters

Use one adapter per data source/provider family. Adapters normalize raw imported/API data into a common domain shape.

Planned adapters:

- `trade-republic-adapter`
  - checking cash balance and cashflow summaries;
  - investment holdings;
  - crypto holdings;
  - provider-level totals and transaction counts.
- `bbva-adapter`
  - checking balance and cashflow summaries;
  - provider-level totals and transaction counts.
- `binance-adapter`
  - current balances;
  - tradable symbols and live quote keys;
  - current EUR values;
  - later: historical balance sync when implemented.

Adapters should not own the final app values. They only normalize provider facts.

### 2. Current Valuation Engine

Add a central current valuation engine/store. It should be the single source for current values:

- `heritage`
- `checking`
- `investment`
- `crypto`
- `binance`
- provider totals
- asset totals
- required live quote keys
- quote metadata: `value`, `fetchedAt`, `attemptedAt`, `source`, `status`
- readiness: `ready`, `loading`, `partial`, `error`
- diagnostics: `missingKeys`, `unavailableKeys`, `quoteAge`, `lastFetch`

This engine should consume:

- cached historical/stage data;
- provider adapter output;
- global live quote cache;
- Binance balances;
- active profile metadata.

It should publish immutable snapshots by profile/version/date.

### 3. View Selectors

Topbar, cards and charts should not calculate business totals directly. They should consume selectors from the central valuation snapshot.

Selectors needed:

- main dashboard topbar selector;
- checking topbar selector;
- investment topbar selector;
- crypto topbar selector;
- Binance topbar selector;
- dashboard cards selector;
- checking cards selector;
- investment cards selector;
- crypto cards selector;
- Binance card selector;
- main chart today-point selector;
- secondary chart today-point selectors.

Dashboard-specific components can still manage visual state, tooltip selection, tab selection and layout, but not the authoritative value.

## Required Behaviors

### Cold Login With Cleared Cookies/Cache

Ideal flow:

1. Login succeeds.
2. Load profiles.
3. Pick active profile:
   - persisted active profile when available;
   - single profile if only one exists;
   - otherwise show/prepare multi-profile home.
4. Load active profile historical/stage data.
5. Load Binance balances if credentials exist.
6. Collect all required live quote keys for ETF, stock, Trade Republic crypto and Binance.
7. Fetch fresh live quotes.
8. Build the first valid current valuation snapshot.
9. Render topbar, cards and charts from that same snapshot.
10. Continue background refresh.

User-facing rule:

- show loader/shell briefly if necessary;
- do not show current values until the first valid snapshot exists;
- do not show old values as if they were fresh.

### Dashboard Change

Ideal flow:

```text
user clicks crypto
-> active view selector changes to crypto
-> topbar reads crypto selector from current valuation snapshot
-> cards and chart today point read the same snapshot
-> no blocking fetch
-> no stale crypto topbar flash
```

The dashboard change should not be responsible for updating the value. It should only select a different view of an already-updating state.

### Profile Change

Ideal flow:

1. Set selected profile.
2. Promote that profile to high-priority valuation refresh.
3. Load/reuse stage data for that profile.
4. Load fresh live quotes for that profile's required keys.
5. Publish a current valuation snapshot.
6. Render the selected profile only after its snapshot is valid.

Other profiles should keep only lightweight previews warm unless explicitly selected.

### Import New Transactions

Ideal flow:

```text
transactions approved
-> show circular loader
-> save transactions
-> invalidate only the imported profile's derived stage/cache data
-> rebuild historical/stage data until yesterday/today base
-> recompute current quantities
-> fetch fresh live quotes
-> publish new current valuation snapshot
-> close loader
-> show all topbar/card/chart values together
```

User-facing rule:

- no `0,00` flash;
- no disappearing topbar values;
- no partially updated dashboards;
- loader remains until data + quotes + current snapshot are coherent.

### Browser Background/Focus

When the tab is backgrounded, the browser may throttle JS timers. On focus:

1. immediately refresh live quote keys;
2. refresh Binance balances if stale;
3. publish a new current valuation snapshot;
4. update all topbar stage entries before the user navigates.

### F5 / Direct Reload On Any Dashboard

F5 is a first-class bootstrap path, not a special case. It must work on:

- main dashboard;
- checking;
- investment;
- crypto;
- Binance;
- home/authenticated profile selection.

Ideal flow:

```text
F5 on any dashboard
-> restore session/profile/navigation state
-> resolve active profile and active dashboard stage
-> prioritize active stage data
-> load/reuse stable historical stage data
-> fetch fresh live quotes required by the active profile
-> build current valuation snapshot
-> render topbar/card/chart from the same snapshot
-> preload the remaining profile stages in background
```

User-facing rule:

- no cards disappearing after reload;
- no empty chart caused by stage data not being rehydrated;
- no stale topbar from session storage;
- no need to switch dashboard to wake up data.

### Profile Change While Refresh Is In Flight

If profile A is refreshing and the user switches to profile B:

1. profile A promises may finish, but must not publish into profile B's topbar/UI;
2. every valuation snapshot must be keyed by profile id + stage/data versions + date;
3. profile B becomes priority immediately;
4. any visible values must belong only to profile B.

User-facing rule:

- never show the previous profile's values after switching profile;
- keep previous profile refreshes isolated and harmless.

### Import While User Navigates

The import overlay owns the data transition for the affected profile. If the user imports from one dashboard and navigates before processing finishes:

1. keep the import loader/transition authoritative for that profile;
2. invalidate old stage data and current valuation only for the imported profile;
3. do not publish partial new values into any dashboard;
4. close the loader only after rebuilt stage data + fresh live quote attempt + current valuation snapshot are coherent.

User-facing rule:

- navigation during import must not expose half-updated dashboards;
- topbar/card/chart update together once import settles.

### Binance Connect / Delete / Sync

Connecting Binance credentials:

```text
save credentials
-> sync Binance balances
-> seed Binance stage data
-> invalidate current valuation for profile
-> fetch Binance live quote keys
-> publish new valuation snapshot including Binance
```

Deleting Binance credentials:

```text
delete credentials
-> optionally delete persisted balances
-> invalidate Binance stage data and profile valuation
-> publish snapshot without Binance contribution
-> remove Binance dashboard/topbar entries if no longer visible
```

Syncing Binance in the background:

- may update Binance token quantities and fallback EUR values;
- must refresh live quote keys for any meaningful balances;
- must not flash crypto/heritage to zero while sync is running.

User-facing rule:

- Binance connect/delete/sync must behave like import: no fake zero, no stale Binance value pretending to be current.

### Daily Rollover

At UTC/local date boundary, the meaning of "today" changes:

1. current stage cache date key changes;
2. yesterday becomes historical/stable;
3. today's current point starts from the new date;
4. valuation snapshots must include a date key;
5. current valuation should refresh immediately after rollover/focus.

User-facing rule:

- no duplicated today point;
- no stale yesterday value shown as today's live value;
- historical series remains stable after rollover.

### Live Quote Unavailable Or Partial

The valuation engine must treat quote readiness centrally.

Cases:

- all required quotes available: publish full ready snapshot;
- one provider quote missing: provider value is pending/unavailable;
- aggregate depends on missing quote: aggregate is pending/partial, not fake zero;
- quote endpoint returns `null`: keep last valid numeric quote with metadata, but mark quote attempt/status;
- quote endpoint returns zero for a live asset: do not accept it as a valid market quote unless explicitly allowed.

Open policy decision:

- whether aggregate totals should display a partial total with a stale/partial status, or stay pending until all required live quotes settle.

Current preference:

- top-level money values should avoid partial totals unless the UI clearly marks them as partial;
- diagnostics should always expose which keys are missing.

### Multi-Profile Home / Preview

The authenticated home is a multi-profile aggregate. It should not mount every profile's dashboards, but it must use the same current valuation engine as the dashboards for the current money value.

Ideal flow:

1. active profile gets complete current valuation at high priority;
2. inactive profiles get complete current valuation in background without mounting their dashboard UI;
3. home current Heritage reads `sum(profile.currentValuation.totals.heritage)` across all profiles;
4. home historical chart can keep using lightweight preview/history, but its current pill/today point must come from the aggregated valuation snapshots;
5. selecting an inactive profile promotes it to high-priority valuation and dashboard warmup;
6. previews never overwrite active profile topbar/state and never mix with valuation totals in one displayed current number.

User-facing rule:

- home must feel fast with many profiles;
- with one profile, home Heritage must equal the main dashboard Heritage exactly;
- with multiple profiles, home Heritage must equal the sum of all profile Heritage snapshots;
- if any required profile snapshot is not ready, the home should wait, keep a last validated aggregate, or show an explicit loading/partial state instead of a mixed preview+valuation total;
- profile selection must not leak values between profiles.

### Auth Expiry / 401

If an API request fails because the session expired:

- do not convert missing API data to zero;
- do not clear the latest validated valuation as if the portfolio were empty;
- surface auth/session state separately;
- stop privileged refresh loops until authenticated again.

### Offline / Slow Network

If the network is slow or offline:

- keep the last validated valuation visible when appropriate;
- mark diagnostics/status as stale or refresh-failed;
- do not publish pending/zero values over the last valid snapshot;
- retry on focus/reconnect.

User-facing rule:

- stale-but-known is better than fake current;
- diagnostics must make quote age and failure reason visible.

### Transaction/Profile Deletion

When transactions or profiles are deleted:

1. invalidate all derived stage data and current valuations for the affected profile;
2. if no transactions/Binance remain, return to the empty/upload state;
3. clear topbar entries for stages that are no longer visible;
4. do not affect unrelated profiles.

## Current State

Implemented so far:

- stage data cache is date/version aware in `src/components/finance-shell/dashboard-stage-data-cache.ts`;
- live prices have metadata and do not let `null` overwrite the latest numeric quote in `src/shared/live-prices.ts`;
- central current valuation can build local bootstrap snapshots when the store is not populated yet:
  - `src/components/finance-shell/current-valuations-store.ts`
- the dashboard and portfolio legacy local current snapshot fallbacks have been removed; local bootstrap must use the central valuation engine instead of separate current builders.
- dashboard topbar store guards against fake zero/pending regressions:
  - `src/components/finance-shell/dashboard-topbar-store.ts`
- warmed dashboards keep polling live values:
  - `src/components/dashboard/use-dashboard-live-prices.ts`
  - `src/components/portfolio-dashboard/use-portfolio-live-prices.ts`
  - `src/components/dashboard/use-binance-balances.ts`
- central current valuation store/snapshot scaffolding exists:
  - `src/components/finance-shell/current-valuations-store.ts`
  - `tests/unit/ui/finance-shell/current-valuations-store.test.ts`
- topbar stage entries are now also seeded from shared live values:
  - `src/components/finance-shell/dashboard-topbar-current-values.ts`
  - `src/components/finance-shell/dashboard-topbar-shell.tsx`
- `dashboard-topbar-current-values.ts` now seeds checking/investment/crypto topbars from current valuation selectors instead of rebuilding its own dashboard current snapshot.
- orchestration now publishes/refreshes central valuation snapshots:
  - `src/components/finance-shell/finance-session-orchestrator.ts`
  - `src/components/finance-shell/import-data-warmup.ts`
  - `src/components/finance-shell/use-finance-binance-actions.ts`
- main dashboard today's chart point can now be supplied by the current valuation selector:
  - `src/components/dashboard/dashboard-chart-data-model.ts`
  - `src/components/dashboard/use-dashboard-chart-model.ts`
  - `src/components/dashboard.tsx`
- dashboard cards now prefer current valuation provider/asset values:
  - `src/components/dashboard/dashboard-cards.tsx`
  - `src/components/dashboard/dashboard-checking-cards.tsx`
  - `src/components/dashboard/dashboard-investment-cards.tsx`
  - `src/components/dashboard/dashboard-crypto-cards.tsx`
- portfolio/investment/crypto today chart points and cards now prefer current valuation selectors/snapshots:
  - `src/components/portfolio-dashboard/chart-data.ts`
  - `src/components/portfolio-dashboard/portfolio-dashboard.tsx`
  - `src/components/portfolio-dashboard/portfolio-provider-cards.tsx`
- Binance dashboard total/topbar/flat current chart line now prefer the Binance total from the central valuation snapshot:
  - `src/components/binance-dashboard.tsx`
- Binance balances now use the synced Binance EUR value as a valid fallback inside the central valuation when a Binance live quote key is missing or unavailable:
  - `src/components/finance-shell/current-valuations-store.ts`
- The main dashboard resting topbar now prefers the central valuation chart point before falling back to the legacy local current snapshot:
  - `src/components/dashboard.tsx`
- Binance dashboard manual current sync now seeds the Binance stage cache and forces a profile valuation refresh after balances are synced:
  - `src/components/binance-dashboard.tsx`
- dashboard topbar publication now normalizes stage/provider order in the shared topbar store:
  - `src/components/finance-shell/dashboard-topbar-store.ts`
- dashboard navigation now refreshes the central valuation alongside the visible stage, and current valuation freshness accounts for live quote age:
  - `src/components/finance-shell.tsx`
  - `src/components/finance-shell/current-valuations-store.ts`
- authenticated home current Heritage now uses a multi-profile aggregate of current valuation snapshots instead of recalculating from preview/live totals:
  - `src/components/finance-shell/welcome-heritage-preview.tsx`
  - `src/components/finance-shell/current-valuations-store.ts`
- current valuation warmup for all profiles is now owned by the shell/orchestrator instead of the home preview:
  - `src/components/finance-shell/finance-session-orchestrator.ts`
  - `src/components/finance-shell.tsx`
  - `src/components/finance-shell/welcome-heritage-preview.tsx`
- dashboard topbar session storage is layout-only:
  - stored topbar entries no longer replay old money values after reload/F5;
  - `dashboard-topbar-store.ts` keeps provider order canonical and removes stale provider tabs when a new valuation layout no longer includes them;
  - `dashboard-topbar-shell.tsx` keys rendered tabs by stage/item identity so UI state is not reused across unrelated slots.
- dashboard topbar tooltip/hover values are transient overlays:
  - `DashboardTabs`, `CheckingDashboardTabs` and `PortfolioDashboardTabs` publish tooltip values with `{ transient: true }`;
  - transient topbar values are visible during chart interaction but are not persisted and do not replace the resting committed topbar entry;
  - when the tooltip ends or the publisher unmounts, the topbar falls back to the last committed valuation/resting value.
- dashboard topbar resting publishers are now UI-only:
  - `DashboardTabs`, `CheckingDashboardTabs`, `PortfolioDashboardTabs` and `BinanceDashboard` can update active tab/click/layout without overwriting the committed money value;
  - `dashboard-topbar-current-values.ts` seeds dashboard/checking/investment/crypto/Binance resting topbars from the current valuation selector;
  - `DashboardTopbarShell` seeds from the current valuation snapshot when it changes, with version checks, before falling back to cache refresh.

Important limitation:

The app is still hybrid. Several components still calculate fallback values locally. The central valuation store now exists, topbar seed helper consumes it, login/profile/import/Binance orchestration refreshes it, dashboard cards prefer it, and dashboard/portfolio/Binance current chart points can consume it. Remaining local logic mainly acts as fallback while snapshots are not available and in historical/tooltip transformations.

Known mismatch found during production smoke and current mitigation:

- The main dashboard resting topbar used to read the legacy `buildDashboardCurrentSnapshot(...)` path while crypto/investment dashboards preferred `useCurrentValuationSnapshot(...)`. `src/components/dashboard.tsx` first preferred the central valuation chart point, then after the cleanup slice removed `buildDashboardCurrentSnapshot(...)` entirely and now uses the valuation chart point as the only resting current point. Local bootstrap still uses `buildCurrentValuationSnapshot(...)`, which is the same central valuation engine.
- The Binance dashboard manual sync button used to update local balances without forcing the central current valuation. `src/components/binance-dashboard.tsx` now seeds the Binance stage cache and calls `ensureFinanceCurrentValuation(... force: true)` after sync.
- The document and code should treat `investment` like `crypto` for current values: both depend on live market quotes and must be valued centrally, not rebuilt independently per dashboard.
- Production smoke after `3b5d8b7` showed provider tabs could swap order between publishers. The shared topbar store now applies a canonical order per stage, so clicking BBVA/TR or switching dashboards must not reorder the buttons.
- Follow-up topbar cleanup made session storage layout-only. It can keep tab shape while the app hydrates, but it must never replay a previous money value as current after F5/reload.
- Follow-up publisher cleanup made chart tooltip topbar values transient. Historical hover values can still be shown while interacting with a chart, but they should not survive dashboard switches, unmounts or the next resting publish.
- Follow-up resting publisher cleanup made dashboard tab publishers UI-only when not hovering. A dashboard can select a tab or provide click handlers, but it should not overwrite the resting valuation money value.
- Production smoke also showed Trade Republic crypto prices could fail to refresh when Binance API was not connected. Binance is optional: a no-Binance profile must still fetch TR crypto live quotes and publish `crypto = Trade Republic crypto`.
- Production smoke after `5cc65eb` showed the authenticated home Heritage can differ from the main dashboard Heritage. `src/components/finance-shell/welcome-heritage-preview.tsx` now keeps preview/history for the chart, but the current pill and current chart point are sourced from the multi-profile valuation aggregate.
- Follow-up smoke after `be821a5` showed the home value can remain stale if the only refresh owner is the home component. The refresh owner must be the shell/orchestrator: app boot, focus/reconnect, daily rollover, dashboard navigation and login warmup should ensure current valuation snapshots for all profiles. The home must only subscribe and aggregate.
- Production smoke after `dab2244` showed Binance was treated differently between the crypto dashboard and main dashboard charts. The crypto dashboard correctly showed Binance as current-only/today, while the main dashboard was adding the current Binance total to every reconstructed historical `crypto`/`heritage` bucket. Main dashboard historical chart points must now exclude Binance and only the today/current point may include Binance through the valuation/live current point.
- Production smoke after `2777133` passed: main dashboard and crypto dashboard now follow the same Binance policy. Historical main dashboard `crypto`/`heritage` points exclude current-only Binance, while the today/current point includes Binance through the valuation current point.
- Production smoke after `88675f4` passed: removing the main dashboard legacy current fallback did not regress F5, resting topbar/cards/current chart point, hover restore, or fake-zero behavior. Main dashboard current values are now fully valuation-driven.
- Production smoke after `583eddc` passed: investment/crypto valuation-first current points did not regress F5, dashboard switching, hover restore, Binance current-only behavior, or fake-zero behavior. The portfolio fallback can now be removed in the next cleanup slice.
- Production smoke after `1927c16` found topbar flicker when switching away from the main dashboard after staying there for several seconds. Likely cause: `DashboardTopbarShell` kept hydrated topbar items in state without scoping them to `userId:stage`, so a stage with fewer tabs could render the previous dashboard stage's hydrated layout for one frame before the valuation/topbar entry caught up. The fix scopes hydrated topbar items by stage and ignores them when the active stage changes.
- Production smoke after `4fd1966` passed: portfolio current fallback removal and topbar stage hydration scoping did not regress F5 investment/crypto, dashboard switching, topbar flicker, hover restore, Binance current-only behavior, or fake-zero behavior. Current value fallback cleanup for main + portfolio is now considered closed.
- Production smoke after `4fd1966` found a one-cent mismatch between Binance in the crypto topbar and Binance in the Binance card. Cause: the topbar read `snapshot.totals.binance.cents` from the central valuation, while `DashboardBinanceCard` summed local `balance.eurValue` floats. The card total should use the valuation Binance total when a current valuation snapshot is available.
- Follow-up audit for similar cases found no other resting topbar/card totals that still sum live float values against valuation totals. Investment/crypto provider card totals already read valuation current points, and asset rows prefer `currentValuationSnapshot.assets`. Remaining `balance.eurValue` sums are bootstrap/fallback, historical preview, chart/current-only Binance support, or the Binance card fallback before valuation exists.
- `76dd695` aligns Binance card totals and token current values with valuation values when available. Follow-up policy is stricter: remove visible Binance current fallbacks from `balance.eurValue`; if a Binance token cannot be live-priced, exclude/hide it from current valuation and diagnostics should explain why.
- New target after the Binance card slice: active-user current valuation must be atomic. If the user switches from crypto to main and back, the same committed snapshot must be visible everywhere. No dashboard should show a newer crypto current value while another dashboard still shows an older crypto current value.
- `3f677da` implements the first atomic store step: `getCurrentValuationSnapshot(...)` now exposes only the last complete committed snapshot. Ready snapshots commit; partial/loading/error snapshots stay as draft diagnostics and do not replace visible current values. Main dashboard no longer uses a local built valuation as the visible current fallback.
- Current local slice implements UI readiness and visible Binance fallback cleanup:
  - topbar/card current placeholders render an animated skeleton instead of visible `--`;
  - main and portfolio dashboards no longer add local live today points when the committed valuation point is missing;
  - Binance current valuation excludes unpriced Binance balances instead of using synced `balance.eurValue`;
  - Binance current card rows hide tokens without valuation values and the card total stays pending until valuation is available.
- Current local slice after `eac7d58` hardens active-profile warmup/readiness:
  - active profile stage warmups and `ensureFinanceCurrentValuation(...)` now start in parallel;
  - warmup order starts active stage, dashboard and Binance before auxiliary stages;
  - focus/reconnect and dashboard navigation use the full active-profile preload instead of only the visible stage;
  - topbar current skeletons are controlled by an explicit pending flag, so historical hover gaps stay empty instead of looking like loading current values.
- Follow-up smoke after `a1406b5` found checking topbar could remain skeleton after leaving chart hover. Cause: UI-only topbar publishes preserved the numeric value but could also preserve/infer a pending flag incorrectly when the checking publisher did not send explicit readiness. Fix: checking tabs publish explicit `valuePending`, and the topbar renderer/store derive pending from the preserved value so numeric values cannot be hidden by a stale pending flag.
- Follow-up smoke after `1fa9519` showed Binance balances data starts almost together with dashboard data, but Binance current can still stay at `0,00`. Cause: Binance live quote collection still filtered balances by synced `balance.eurValue > 0.49`, which conflicts with the stricter policy that synced EUR is not a trusted current fallback. Fix: request live quotes for every open Binance balance with a normalizable symbol; include only balances with valid live quotes in current valuation.

## Gaps To Close

### Gap 1: Central Current Valuation Store

Create a store/module, likely under:

- `src/components/finance-shell/current-valuations-store.ts`
- or `src/domain/valuation/current-valuations.ts`

Current progress:

- `src/components/finance-shell/current-valuations-store.ts` exists.
- It exposes `ensureCurrentValuation(profile, options)`, `subscribeCurrentValuation(profileId, listener)`, `getCurrentValuationSnapshot(profileId)`, `invalidateCurrentValuation(profileId)`, `refreshCurrentValuationFromCaches(profile, options)` and initial topbar/card/chart selectors.
- Snapshot values include status metadata and diagnostics for missing/unavailable quote keys.
- Zero live quotes are treated as unavailable and do not publish fake zero totals.
- Topbar cache seeding now reads checking/investment/crypto values through valuation selectors.
- `finance-session-orchestrator` exposes `ensureFinanceCurrentValuation(...)` and includes valuation status/missing/unavailable quote diagnostics in session diagnostics.
- `finance-session-orchestrator` exposes `ensureFinanceProfilesCurrentValuations(...)`, which prioritizes the active profile but also refreshes inactive profile snapshots in background without mounting their dashboards.
- `warmImportedProfileData(...)` waits for a forced post-import valuation snapshot before returning.
- Binance connect/delete invalidates the profile valuation and triggers a coherent valuation refresh.
- Focus/reconnect refresh now asks for a full current valuation refresh, not only the visible stage.
- Asset valuations now keep provider-specific values, so cards can read a single provider's ETF/token value without accidentally using an aggregate shared asset label.
- `useCurrentValuationSnapshot(profileId)` is available for React consumers.
- Portfolio/investment/crypto chart data accepts a valuation current point and uses it for today's point.
- Main dashboard historical chart points exclude current-only Binance values; Binance enters the main `crypto`/`heritage` chart only through the today/current valuation point until historical Binance sync exists.
- Vercel smoke confirmed the main dashboard and crypto dashboard now agree on Binance current-only chart behavior after `2777133`.
- Main dashboard no longer imports or uses the legacy `dashboard-current-snapshot.ts` fallback. `src/components/dashboard.tsx` uses `selectCurrentValuationChartPoint(...)` for topbar, cards and current chart point; the removed file/test were:
  - `src/components/dashboard/dashboard-current-snapshot.ts`
  - `tests/unit/ui/current-snapshot/dashboard-current-snapshot.test.ts`
- Vercel smoke confirmed the main dashboard works without the legacy fallback after `88675f4`.
- Portfolio/investment/crypto dashboards now use `src/components/portfolio-dashboard/portfolio-current-valuation.ts` to accept a valuation current point only when the snapshot matches the current stage transaction count, Binance refresh key for crypto, and date key. When that valuation point exists, `buildPortfolioCurrentSnapshot(...)` is not computed, so valuation pending/null values cannot be overwritten by a local fallback.
- Vercel smoke confirmed the portfolio valuation-first behavior after `583eddc`; the next slice can remove `src/components/portfolio-dashboard/portfolio-current-snapshot.ts` and its legacy test.
- Portfolio/investment/crypto dashboards no longer import or use the legacy `buildPortfolioCurrentSnapshot(...)` fallback. `src/components/portfolio-dashboard/portfolio-dashboard.tsx` now uses `currentValuationPoint` as the only resting current point for tabs and cards; if valuation is not ready, those values remain pending instead of being rebuilt locally. Removed files:
  - `src/components/portfolio-dashboard/portfolio-current-snapshot.ts`
  - `tests/unit/ui/current-snapshot/portfolio-current-snapshot.test.ts`
- Vercel smoke confirmed the portfolio fallback removal and topbar hydration fix after `4fd1966`.
- Main dashboard and portfolio cards prefer valuation values for provider totals and asset current values.
- Binance dashboard prefers `totals.binance` from the valuation snapshot for its topbar and current flat chart value.
- Topbar storage is now a UI/layout bridge only: persisted topbar entries keep identity/order/labels, not authoritative values.
- Topbar store now has committed entries plus transient entries for chart interactions. `useDashboardTopbarEntry(...)` reads the transient overlay first, then falls back to the committed entry.
- Resting topbar values are seeded from `selectCurrentValuationTopbar(...)` for dashboard, checking, investment, crypto and Binance. Dashboard components now publish UI state at rest and transient values only during chart interaction.
- `DashboardTopbarShell` hydrated layout state is scoped by `userId:stage`, preventing a previous dashboard stage's hydrated items from flashing during navigation to a different stage.
- `DashboardBinanceCard` accepts a valuation `currentValueCents` total, and dashboard/portfolio crypto cards pass `snapshot.totals.binance.cents` so Binance card totals match topbar totals exactly.
- `DashboardBinanceCard` also accepts valuation Binance asset values keyed by asset id/symbol; dashboard/portfolio crypto cards pass those values so individual Binance token current values use the same valuation source when available.
- Visible Binance current fallback from `balance.eurValue` is removed locally:
  - `DashboardBinanceCard` renders skeleton for pending totals and hides unpriced token rows;
  - Binance dashboard uses local price fetch only as quote warmup, not as a current EUR calculator;
  - central valuation skips Binance balances whose live quote is missing/unavailable and records the missing/unavailable quote key in diagnostics.
- Added `tests/unit/ui/chart-data/dashboard-binance-card-total.test.ts` to lock the one-cent rounding case for both the card total and individual Binance balance values.
- Atomic committed snapshot support is implemented locally and pending Vercel smoke:
  - `current-valuations-store.ts` keeps committed snapshot, draft snapshot, refresh state, pending version and last error per profile;
  - cache refreshes commit only `ready` snapshots;
  - partial cache refreshes keep the existing committed snapshot visible and store the partial result as draft diagnostics;
  - `src/components/dashboard.tsx` reads only the current committed store snapshot for its resting current values, removing the last visible local main-dashboard valuation bootstrap;
  - `finance-session-orchestrator` diagnostics now expose committed/draft valuation status, pending version and refresh state.
  - Added unit tests for no-committed pending state, stale-while-partial-refresh, and atomic swap when a complete snapshot arrives.
- UI readiness support is implemented locally and pending Vercel smoke:
  - `CurrentValueSkeleton` provides the dark animated current-value placeholder;
  - `DashboardTopbarTab`, dashboard card parts, checking provider cards and portfolio provider cards render skeletons for genuinely pending current money values;
  - dashboard/portfolio chart builders keep historical data but do not add local live today points in the app when the committed valuation point is absent.

Remaining work:

- smoke active-user atomic current valuation with stale-while-refresh after deploy:
  - committed values stay visible while a refresh is partial;
  - complete refreshes swap all selected values together;
  - no dashboard shows a newer crypto/investment value while another dashboard still shows the previous value;
  - diagnostics expose committed/draft/refreshing state clearly;
- smoke the UI readiness and Binance fallback cleanup after deploy:
  - skeleton appears only for no-committed current values;
  - dashboard navigation with committed values does not show skeleton;
  - no local live today point appears before committed valuation;
  - Binance card/topbar/today point do not use synced `balance.eurValue`;
- smoke the active-profile parallel warmup after deploy:
  - cold login/F5 starts dashboard and Binance requests together;
  - Binance skeleton duration should be shorter and should not trail auxiliary stage preloads;
  - once values appear, topbar/cards/current chart point still swap together from one committed snapshot;
  - chart hover on dates before investment/crypto/Binance existed does not show animated skeletons for those missing historical values;
  - checking dashboard hover-out restores numeric topbar values when a committed value exists and does not keep animating skeleton pills;
  - Binance balances with synced `eurValue` equal to zero still request live quotes when quantity is non-zero;
- smoke the shell-owned multi-profile valuation refresh after deploy:
  - one profile: home Heritage equals main dashboard Heritage after visiting dashboards and returning home;
  - multiple profiles: home Heritage equals the sum of profile Heritage snapshots;
  - inactive profile quotes refresh without opening that profile's dashboards;
- finish any remaining non-current `--` cleanup only if it is truly a current-value placeholder;
- extend diagnostics with explicit excluded Binance token symbols in addition to missing/unavailable quote keys;
- replace remaining local current-value builders after consumers are migrated; dashboard and portfolio current snapshot fallbacks have been removed and smoked;
- migrate checking dashboard card/topbar/chart where useful, though checking does not depend on live quotes;
- remove fallback current-value paths after production smoke confirms valuation snapshots are available early enough; main dashboard and portfolio current fallbacks are removed and smoked;
- expand tests for orchestration races and UI consistency.
- smoke the resting topbar publisher cleanup after deploy;
- cleanup local current fallback builders once smoke confirms valuation is early and stable enough;

Snapshot shape should include:

```ts
type CurrentValuationSnapshot = {
  profileId: string;
  version: {
    transactionCount: number;
    checkingCount: number;
    investmentCount: number;
    cryptoCount: number;
    binanceRefreshKey: number;
    dateKey: string;
  };
  totals: {
    heritage: ValuationValue;
    checking: ValuationValue;
    investment: ValuationValue;
    crypto: ValuationValue;
    binance: ValuationValue;
  };
  providers: Record<string, ProviderValuation>;
  assets: Record<string, AssetValuation>;
  quoteKeys: {
    isins: string[];
    cryptos: string[];
  };
  diagnostics: {
    lastFetchAt: number | null;
    maxQuoteAgeMs: number | null;
    missingKeys: string[];
    unavailableKeys: string[];
  };
  status: "loading" | "ready" | "partial" | "error";
  updatedAt: number;
};

type ValuationValue = {
  cents: number | null;
  status: "ready" | "loading" | "missing-live-quote" | "unavailable" | "error";
  fetchedAt: number | null;
  source: "checking-balance" | "live-quote" | "binance-sync" | "derived";
};
```

### Gap 2: Multi-Profile Home Aggregate

The authenticated home currently behaves like a preview surface, but its displayed current Heritage must be an aggregate valuation surface.

Current problem:

- `WelcomeHeritagePreview` historically combined preview/history and live totals locally;
- this produced numbers close to, but not exactly equal to, dashboard Heritage;
- the current pill/today point now read valuation aggregates, but the snapshots must be warmed outside the home so they keep updating while the user is on a dashboard.

Current progress:

- `selectCurrentValuationHeritageAggregate(...)` aggregates profile snapshots for the home current pill/today point;
- `useCurrentValuationSnapshotMap(...)` subscribes the home to profile snapshots;
- `ensureFinanceProfilesCurrentValuations(...)` warms all profile snapshots from the orchestrator;
- `FinanceShell` triggers multi-profile valuation refresh on app boot/profile changes, focus/reconnect, daily rollover and dashboard navigation;
- `WelcomeHeritagePreview` no longer calls `ensureFinanceCurrentValuation(...)` or owns focus/online refresh listeners.

Target:

- ensure current valuation snapshots for all profiles:
  - active profile: high priority;
  - inactive profiles: background priority;
  - no forced dashboard mounting for inactive profiles;
- add a home aggregate selector/hook that returns:
  - aggregated Heritage value;
  - readiness/status across profile snapshots;
  - missing/unavailable quote diagnostics per profile;
- update the home current pill and today's chart point to read the aggregate valuation;
- keep historical home chart preview separate from the current valuation point;
- do not mix preview totals and valuation totals in one displayed current value.

Tests:

- one profile: home Heritage equals main dashboard Heritage;
- multiple profiles: home Heritage equals sum of profile Heritage snapshots;
- inactive profile with ETF/crypto live prices updates the home aggregate without opening that profile's dashboards;
- missing snapshot/quote does not publish a fake complete aggregate.

### Gap 3: Move UI To Selectors

After the store exists, migrate consumers gradually:

1. topbar shell reads only valuation selectors;
2. dashboard cards read valuation selectors;
3. investment/crypto cards read valuation selectors;
4. chart today point reads valuation selectors;
5. dashboard-local calculation remains only for tooltip historical reconstruction.

Do not rewrite every component in one commit. Use small verified slices.

### Gap 4: Import Loader Contract

Make import completion wait for the central valuation snapshot:

- stage data rebuilt;
- Binance state accounted for;
- fresh live quotes attempted;
- snapshot status is `ready` or intentional `partial` with clear reason.

Then close the loader.

### Gap 5: Diagnostics UI/Console

`window.morganFinanceDiagnostics()` exists, but should be extended or replaced with valuation diagnostics:

- profileId;
- active stage;
- valuation status;
- last quote fetch;
- max quote age;
- missing quote keys;
- unavailable quote keys;
- stale stage data keys;
- pending promises.

The goal is to identify in seconds whether a stale value is caused by:

- DB/stage cache;
- `/api/prices`;
- Binance sync;
- valuation engine readiness;
- rendering/topbar store.

### Gap 6: Binance History

Current Binance is correct as a live/current value but has no historical account reconstruction yet. Treat Binance as a current-only provider until a dedicated historical Binance sync exists.

Current policy before Binance history exists:

- include Binance in the central current valuation;
- include Binance in current `crypto` and current `heritage`;
- include Binance in topbar, cards, and today's current chart point;
- include Binance in the `today` / current chart point because that point is a live valuation snapshot;
- do not backfill historical Binance values into old `crypto`/`heritage` chart points;
- do not pretend the historical Binance line is known before a real historical sync;
- past chart points remain reconstructed historical data only; if Binance history is not synced, past `crypto`/`heritage` points exclude Binance;
- while hovering a past chart point, topbar/card/tooltip values should stay on that historical point and must not follow live updates until the interaction ends;
- when the chart is at rest, topbar/cards/current point return to the full current valuation, including Binance;
- if a chart needs to represent Binance now, keep it as current-only / flat-current / current marker behavior, clearly distinct from reconstructed historical data.

Later:

- implement Binance historical sync if API allows;
- store historical Binance balance/value snapshots;
- merge them into crypto/heritage historical series.

Until then:

- topbar should include Binance current value;
- crypto dashboard can show Binance current card;
- graph history for Binance may be flat/current-only or current-marker only, but must not be presented as reconstructed history;
- a future "sync" control should be about missing Binance historical sync state, not merely current balance refresh. Current balance refresh should still refresh/invalidate the central valuation.

## Implementation Plan

Current next execution order after `eac7d58`:

0. Previous pushed slice status:
   - UI readiness and visible Binance fallback cleanup are pushed in `eac7d58`.
   - Early smoke found the expected no-committed-snapshot skeleton state on cold login/F5.
   - Follow-up issue: Binance can still appear later than checking/dashboard because active-profile warmup was not aggressive enough at the orchestrator level.
   - Follow-up UI detail: while hovering an old chart point, missing investment/crypto values should not render as loading skeletons.

1. Active-user atomic valuation store: implemented and pushed, smoke continuing.
   - Add per-profile valuation state with at least:
     - `committedSnapshot`: last complete coherent snapshot for the current profile/version/date;
     - `refreshing`: whether a draft refresh is in progress;
     - `pendingVersion` / `requestedVersion`: profile counts, Binance refresh key and date being refreshed;
     - `lastError` and diagnostics for missing/unavailable quote keys.
   - Done: refresh flow builds snapshots as drafts and commits only complete `ready` snapshots.
   - Done: selectors reading `getCurrentValuationSnapshot(...)` see only the committed snapshot, not draft/partial refresh output.
   - Done: stale-while-refresh keeps an existing committed snapshot visible while a new refresh is partial or failing.
   - Remaining UI work: if a new profile/version has no committed snapshot yet, selectors/UI should expose and render an elegant skeleton instead of plain placeholders.
   - Tests:
     - done: refresh with partial/missing quote does not overwrite an existing committed snapshot;
     - done: refresh with complete quote set swaps all selected values atomically;
     - done: no committed snapshot keeps a draft pending state without publishing visible current values;
     - still to add: changing transaction counts invalidates the old committed snapshot for the new version;
     - main/crypto/investment selectors for the same snapshot return matching shared aggregate values.

2. Orchestrator as current-value owner: current local slice.
   - Active user warmup must fetch all current valuation inputs independent of visible dashboard:
     - dashboard stage data for checking/investment/crypto holdings;
     - Binance balances when credentials exist;
     - all required live quotes for investment, TR crypto and Binance.
   - Fetch active-user valuation inputs in parallel where possible, then commit once.
   - Implementation plan for this slice:
     - make `preloadFinanceProfileStages(...)` launch stage warmups and `ensureFinanceCurrentValuation(...)` together instead of waiting stage-by-stage;
     - prioritize stage order as active stage, dashboard, Binance, then auxiliary stages;
     - use `preloadFinanceProfileStages(...)` for app boot/F5, profile prefetch, dashboard navigation, focus/reconnect and daily rollover active-profile refresh;
     - keep `ensureFinanceProfilesCurrentValuations(...)` for all profiles/home aggregate, but rely on in-flight de-duplication so the active valuation is not recomputed separately;
     - preserve stale-while-refresh and committed-only visibility.
   - Keep inactive profiles as lower-priority background valuation refreshes for the home aggregate.
   - Use the same orchestration entry points:
     - login warmup;
     - app boot/F5;
     - profile select prefetch while selection overlay is closing;
     - dashboard navigation;
     - focus/reconnect;
     - daily rollover;
     - import approval;
     - Binance connect/delete/sync.
   - Diagnostics should report committed snapshot version, refresh state, pending version, missing/unavailable keys, quote ages and whether UI is showing committed or pending state.

3. UI readiness gate and skeleton: implemented and pushed, with one local follow-up in this slice.
   - Create reusable current-value skeleton components:
     - topbar pill skeleton matching the dark rounded animated style;
     - compact card value skeleton;
     - chart current-point skeleton/placeholder where needed.
   - Done: replace visible `--` for loading current money values in topbar/cards with skeletons.
   - Done by data contract: do not show skeleton on dashboard navigation when a committed snapshot exists, because selectors keep returning the committed snapshot.
   - Stage reveal rule:
     - if historical/stage data and chart frame are ready but current snapshot is pending, show skeleton values in the real layout;
     - if no usable stage data exists, keep the existing dashboard loading overlay;
     - when committed snapshot exists, render topbar/cards/current chart point immediately from it.
   - Done locally for chart current points: main/portfolio charts do not add a local live today point when the committed valuation point is missing.
   - Current local follow-up: topbar publishers now distinguish current pending from historical hover absence via an explicit pending flag. Empty historical tooltip values must not show the animated skeleton.
   - Smoke target: topbar/cards/chart should appear visually synchronized on cold login/F5: either skeleton together, or committed values together.

4. Binance current policy cleanup: implemented locally, pending Vercel smoke.
   - Done: remove visible current fallback from `balance.eurValue`.
   - In valuation:
     - Binance token with live quote: include in Binance/crypto/heritage current;
     - Done: Binance token without valid live quote is excluded from current totals and current card rows;
     - Current diagnostics list missing/unavailable quote keys; next diagnostics slice should also list excluded token symbols/reasons.
   - Binance balances may still be used for names/quantities or sync diagnostics, but not as unmarked current money.
   - Tests:
     - done: missing Binance quote excludes token and records diagnostics;
     - missing Binance quote does not block TR crypto quote refresh;
     - no-Binance profile still computes `crypto = TR crypto`;
     - Binance total/topbar/card/today point all come from the same committed snapshot.

5. Final current fallback cleanup:
   - Re-audit remaining `balance.eurValue`, `livePrices`, local current and topbar publishers.
   - Keep local logic only for historical reconstruction, tooltip values, chart transforms, synced balance metadata and diagnostics.
   - Remove or quarantine helpers that can publish current money outside the committed valuation path.

6. Regression smoke checklist for every slice:
   - F5 on dashboard/checking/investment/crypto/Binance:
     - no fake `0,00`;
     - skeleton only if no committed snapshot exists;
     - once values appear, topbar/cards/today point match.
   - Dashboard switching with committed snapshot:
     - no skeleton;
     - main crypto and crypto dashboard total match;
     - investment total matches between main and investment;
     - checking total/provider order stays stable.
   - Stay on one dashboard for 5-10 seconds, then switch:
     - no previous-stage topbar flash;
     - no mismatch between old and new dashboard current values.
   - Hover historical chart:
     - historical tooltip/topbar values appear only during hover;
     - leaving hover restores committed current snapshot.
   - Refresh/focus/reconnect:
     - old committed snapshot stays visible while refreshing;
     - new snapshot swaps in everywhere together.
   - Import/new document:
     - old version is not shown as current for the new version;
     - skeleton appears only until the post-import committed snapshot is ready.
   - Multi-profile:
     - one profile: home Heritage equals main dashboard Heritage;
     - multiple profiles: home equals the sum of committed profile snapshots;
     - inactive profile live quotes refresh in background without mounting its dashboards.
   - Binance:
     - no quote fallback current from `balance.eurValue`;
     - unpriced Binance tokens hidden/excluded from current and visible in diagnostics;
     - Binance remains current-only in charts until historical sync.

7. Binance historical sync remains a separate future project.

### Phase 1: Stabilize Central Current Valuation

1. Create domain types for current valuation values and snapshots.
2. Create provider adapters for current holdings:
   - Trade Republic from dashboard/stage payload;
   - BBVA from checking/stage payload;
   - Binance from balances payload.
3. Create quote-key collector using normalized symbols/ISINs.
4. Build valuation snapshot from cached stage data + live quote cache.
5. Add store subscription and invalidation.
6. Add tests for:
   - main totals;
   - provider totals;
   - asset totals;
   - Binance included in crypto/heritage;
   - missing live quote keeps value pending;
   - zero quote is not accepted as live;
   - refresh with newer quote updates all selectors.

### Phase 2: Wire Topbar Fully To Valuation Store

1. Replace `dashboard-topbar-current-values.ts` with selectors from the valuation store.
2. Keep `dashboard-topbar-store.ts` as UI state/layout bridge only.
3. Remove direct value calculation from:
   - `DashboardTabs`
   - `PortfolioDashboardTabs`
   - `CheckingDashboardTabs`
   - `BinanceDashboard` topbar publication where possible.
4. Tests:
   - updating BTC while on dashboard updates crypto topbar without visiting crypto;
   - updating ETF while on crypto updates investment topbar without visiting investment;
   - no stale topbar on dashboard switch.

### Phase 3: Wire Cards And Current Chart Point

1. Cards read provider/asset values from valuation selectors.
   - Main dashboard cards prefer valuation values for provider totals and open holdings.
   - Portfolio/investment/crypto cards prefer valuation provider/asset values when the snapshot version matches the stage.
2. Last chart point for today reads valuation selectors.
   - Main dashboard chart data accepts a valuation selector point and uses it for today's point.
   - Portfolio/investment/crypto chart data accepts a valuation selector point and uses it for today's point.
   - Binance dashboard prefers valuation `totals.binance` for its current flat chart series.
3. Tooltip historical values still reconstruct from chart historical data.
4. Tests:
   - topbar/card/today point match for main dashboard;
   - topbar/card/today point match for investment dashboard;
   - topbar/card/today point match for crypto dashboard;
   - Binance current value included consistently.

### Phase 4: Login/Profile/Import Orchestration

1. Update orchestrator to call `ensureCurrentValuation`.
2. On login:
   - active profile valuation first;
   - other profiles lightweight preview only.
3. On F5/direct reload:
   - active route/stage valuation first;
   - restore persisted profile safely;
   - never reuse stale session topbar values as authoritative current values.
4. On profile change:
   - promote selected profile valuation.
5. On import:
   - invalidate profile stage + valuation;
   - wait for rebuilt stage data + valuation snapshot;
   - then close loader.
6. On Binance connect/delete/sync:
   - invalidate profile valuation;
   - refresh Binance balances and live quote keys;
   - publish one coherent snapshot.
7. On daily rollover/focus/reconnect:
   - refresh date-keyed valuation;
   - preserve last validated snapshot until replacement is valid.
8. Tests:
   - cold login produces snapshot before rendering current values;
   - F5 on investment/crypto/binance produces snapshot before rendering current values;
   - profile change does not show previous profile values;
   - profile change while previous refresh is in flight does not leak old values;
   - import does not publish zero/pending topbar;
   - navigation during import does not reveal partial values;
   - Binance connect/delete does not flash crypto/heritage to zero;
   - daily rollover updates date-keyed snapshot;
   - offline/401 paths keep last validated values separate from auth/network state.

### Phase 5: Cleanup Distributed Calculations

Remove or reduce duplicated current-value logic from:

- removed: `src/components/dashboard/dashboard-current-snapshot.ts`
- removed, pending smoke: `src/components/portfolio-dashboard/portfolio-current-snapshot.ts`
- dashboard/portfolio live price hooks where they become store internals;
- topbar seed helpers once selectors replace them.

Keep historical chart transformation logic separate.

## Testing Checklist

Run before pushing valuation changes:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm typecheck:test`
- `pnpm test -- --run tests/unit/shared/live-prices.test.ts`
- `pnpm test -- --run tests/unit/ui/current-snapshot`
- `pnpm test -- --run tests/unit/ui/finance-shell`
- targeted chart-data tests:
  - `tests/unit/ui/chart-data/dashboard-chart-model.test.ts`
  - `tests/unit/ui/chart-data/portfolio-chart-data.test.ts`

Manual production smoke after deploy:

1. Clear cookies/cache.
2. Login.
3. Wait only until main dashboard is visible.
4. Navigate:
   - dashboard
   - checking
   - investment
   - crypto
   - binance
   - home
   - dashboard
   - crypto
   - investment
5. Watch for:
   - stale topbar flashes;
   - `0,00` fake values;
   - visible `--`;
   - card/topbar mismatch;
   - today chart point mismatch.
   - provider tabs reordering after clicking BBVA/TR or switching dashboard.
6. Keep main dashboard open for 20-30 seconds, then enter crypto/investment and confirm values were already updated.
7. Run direct reload tests:
   - F5 on dashboard;
   - F5 on checking;
   - F5 on investment;
   - F5 on crypto;
   - F5 on Binance.
8. Run no-Binance crypto checks:
   - use a profile without Binance credentials;
   - confirm the Binance dashboard/button is not required for TR crypto prices;
   - confirm main `crypto`, crypto dashboard total, cards and today's chart point agree after focus/navigation.
9. Run state-transition tests:
   - switch profile while a dashboard is still loading;
   - import transactions, then navigate before the loader closes;
   - connect Binance API and watch crypto/heritage/topbar/card;
   - delete Binance API and confirm Binance values disappear coherently;
   - background the tab for a few minutes, return to focus, then navigate to crypto/investment.
10. Run degraded-data checks when possible:
   - simulate slow/offline network and confirm last validated values do not become zero;
   - simulate missing quote and confirm diagnostics show `missingKeys`;
   - confirm session expiry/401 does not look like an empty portfolio.

## Guardrails

- Do not hardcode behavior for one user/account.
- Do not delete source transactions/profile data to fix derived state.
- Historical/stage data can be regenerated; source data must remain authoritative.
- Do not show historical fallback as live current value.
- Do not let unavailable or zero live quotes overwrite the last valid numeric quote.
- Do not close import loader until the new valuation snapshot is coherent.
- Keep commits small and verified.
- After every meaningful slice, push to `main` if requested.

## Resume Instructions For Codex

When resuming after compaction:

1. Read this file first.
2. Check `git status --short`.
3. Identify the latest commit and current deployment state if relevant.
4. Do not restart the whole plan from scratch.
5. Continue from the smallest unfinished phase.
6. Preserve user priority: Morgan must feel instant but must never lie about current values.
