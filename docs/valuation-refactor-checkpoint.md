# Morgan Valuation Refactor Checkpoint

Last updated: 2026-06-02
Current baseline commit: `4fd1966` (last Vercel-smoked)
Current slice pending Vercel smoke: Binance card valuation total/asset alignment

This file is the durable context for the Morgan valuation/topbar refactor. If the conversation is compacted, resume by reading this document before touching code.

## Product Goal

Morgan must behave like a trustworthy personal finance and portfolio aggregator:

- show the freshest validated current value for every dashboard;
- keep topbar, cards and the last chart point coherent;
- keep historical chart values stable and not recalculate them unnecessarily;
- never show fake `0,00`, stale values pretending to be live, visible `--` placeholders, or disappearing numbers during refresh;
- make dashboard navigation feel instant because data is already warm and values are already current.

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
- `DashboardBinanceCard` also accepts valuation Binance asset values keyed by asset id/symbol; dashboard/portfolio crypto cards pass those values so individual Binance token current values use the same valuation source when available. The local `balance.eurValue` display remains only as fallback before valuation arrives.
- Added `tests/unit/ui/chart-data/dashboard-binance-card-total.test.ts` to lock the one-cent rounding case for both the card total and individual Binance balance values.

Remaining work:

- smoke the shell-owned multi-profile valuation refresh after deploy:
  - one profile: home Heritage equals main dashboard Heritage after visiting dashboards and returning home;
  - multiple profiles: home Heritage equals the sum of profile Heritage snapshots;
  - inactive profile quotes refresh without opening that profile's dashboards;
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

Current next execution order after `4fd1966` and the passed fallback/topbar smoke:

1. Close out current fallback cleanup:
   - inventory remaining fallback paths:
     - removed and smoked: `src/components/dashboard/dashboard-current-snapshot.ts`;
     - removed and smoked: `src/components/portfolio-dashboard/portfolio-current-snapshot.ts`;
     - still present by design: local bootstrap valuation snapshots built through `buildCurrentValuationSnapshot(...)`;
     - still present by design: historical chart builders, tooltip transforms, preview history and Binance current-only chart rendering.
   - implementation order:
     - done: main dashboard removed the legacy current snapshot builder and the resting current point now comes only from `selectCurrentValuationChartPoint(...)`;
     - done: portfolio/investment/crypto dashboard uses `selectPortfolioCurrentValuationPoint(...)` for chart, tabs and cards when the valuation snapshot is current;
     - done and smoked: removed `buildPortfolioCurrentSnapshot(...)`, deleted `src/components/portfolio-dashboard/portfolio-current-snapshot.ts` and `tests/unit/ui/current-snapshot/portfolio-current-snapshot.test.ts`, and let investment/crypto current tabs/cards stay pending until the valuation point is available;
     - Binance dashboard: keep local balance rendering for the current-only chart, but make topbar/current total prefer valuation and never publish local total as authoritative resting money;
     - checking dashboard: evaluate separately because it is not live-price dependent, but keep it aligned with valuation/topbar selectors where useful;
     - after each removal, delete the unused builder tests and add/adjust selector tests that lock the valuation-driven behavior.
   - removal rule:
     - remove local current builders only when a central valuation snapshot or local central-engine bootstrap snapshot exists for the same profile/version/date;
     - keep local logic for historical chart reconstruction and tooltip transforms only;
     - do not remove fallbacks that still protect cold login, F5, import or missing snapshot states until covered by tests/smoke.
2. Edge-case tests and diagnostics:
   - convert the most important manual smoke cases into unit/integration tests where practical;
   - extend `window.morganFinanceDiagnostics()` with valuation status, quote age, missing/unavailable keys, active profile/version and stage cache freshness;
   - prioritize clean login/cache, F5 on every dashboard, import while navigating, profile switch during refresh, Binance connect/delete/sync, no-Binance crypto and missing quotes.
3. Regression smoke checklist to keep using after each valuation/topbar slice:
   - F5 on dashboard/checking/investment/crypto/Binance must not replay old topbar money values from session storage;
   - click BBVA/TR repeatedly and switch dashboards: provider order must stay canonical;
   - delete/connect Binance or change provider availability: stale provider tabs must disappear.
   - stay on the main dashboard for 5-10 seconds, then switch to investment/crypto/checking: topbar values/layout must not flash the previous dashboard stage.
   - hover chart points, switch dashboard while hovering, then return: historical tooltip values must not remain as resting topbar values.
   - one profile: home Heritage equals dashboard Heritage after dashboard visits and return home;
   - multiple profiles: home equals the sum of profile snapshots;
   - inactive profile ETF/crypto live quotes refresh without opening that profile's dashboards.
   - at rest, dashboard/checking/investment/crypto/Binance topbar values must match valuation even after tab clicks;
   - Binance total in crypto topbar must match the Binance card total exactly, including cents;
   - Binance card token current values should come from valuation when available, with local balance values only as fallback before valuation arrives;
   - active tab/click state should still work;
   - tooltip values should still appear only while hovering.
4. Binance historical sync as a separate future project.

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
