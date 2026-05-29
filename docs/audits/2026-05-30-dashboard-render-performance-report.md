# Dashboard Render Performance Report - 2026-05-30

## Scope

Pass mirato dopo la fase bundle/performance, con focus su account popolati e navigazione visiva completa.

Il test usa un account locale temporaneo e un profilo `Performance Dense`. Le credenziali Binance reali fornite in chat non sono state salvate, stampate in file o usate nei seed; per stressare la UI sono stati generati saldi Binance sintetici.

## Dataset

Seed locale:

```powershell
pnpm run seed:performance -- --username=<local username> --profile="Performance Dense" --years=10 --replace
```

Risultato usato nel benchmark:

- range: `2016-01-01..2026-05-29`
- checking transactions: `2373`
- investment transactions: `512`
- crypto transactions: `375`
- asset history points: `60832`
- Binance balance rows: `6`

Il seed usa chiavi benchmark isolate per evitare di cancellare o sovrascrivere price history reale di profili locali non collegati al test.

## Findings

1. I grafici in range `ALL` usavano bucket daily anche su 10 anni di dati.
   - Dashboard: `3802` punti giornalieri.
   - Checking: `3802` punti giornalieri.
   - Investment: `3789` punti giornalieri.
   - Crypto: `3785` punti giornalieri.
   - Con range lunghi questo moltiplicava punti Recharts, tooltip hit testing e payload trasformato lato client.

2. `/api/prices` aspettava il timeout live anche quando esisteva gia un fallback storico locale.
   - Baseline dashboard prices: circa `12441ms` per 13 key sintetiche con fallback.
   - Baseline investment prices: circa `4922ms` / `6207ms` per batch ISIN.
   - Il problema e reale anche fuori dal seed: simboli lenti/non disponibili non devono bloccare la UI se esiste un valore storico utilizzabile.

3. La pagina Crypto era inizialmente vuota nel benchmark perche il seed produceva crypto Binance generiche, mentre la sezione Crypto legge il portafoglio crypto Trade Republic con trade type `BUY`/`SELL`.

## Changes

- `scripts/testing/seed-dashboard-performance-data.mjs`
  - nuovo seed benchmark locale;
  - profile replace idempotente;
  - asset history sintetica isolata;
  - crypto transactions compatibili con la pagina Crypto;
  - saldi Binance sintetici senza credenziali.

- `package.json`
  - aggiunto `seed:performance`.

- `src/components/dashboard/formatters.ts`
  - range `ALL` usa bucket mensili quando lo storico ha piu di un mese.

- `src/components/checking-dashboard/chart-data.ts`
  - stesso comportamento per Checking.

- `src/components/portfolio-dashboard/chart-data.ts`
  - stesso comportamento per Investment/Crypto.

- `src/server/services/price-refresh.ts`
  - legge i fallback storici prima dei live fetch;
  - se un key ha fallback, attende il live solo per una finestra breve (`1200ms`);
  - per key oltre la concurrency live usa subito il fallback storico, evitando code seriali su portafogli grandi.

- Test unitari aggiornati per chart downsampling e fallback prezzi.

## Results

Range `ALL` sui grafici lunghi:

- prima: circa `3785-3802` punti;
- dopo: circa `124-125` punti mensili.

Prezzi:

- dashboard `/api/prices` 13 key: da circa `12441ms` a circa `1580ms`;
- investment `/api/prices` 5 key: da circa `4922-6207ms` a circa `1340-1400ms`;
- crypto `/api/prices` 5 key: circa `417-441ms`;
- nessun errore console rilevato nel browser durante il pass finale.

Input Settings/API:

- typing smoke sui campi API key/secret con valore dummy non salvato: `65ms` per fill completo;
- nessun errore console.

## Visual QA

Navigazione eseguita su:

- Home;
- Dashboard;
- Dashboard tooltip;
- Checking;
- Investments;
- Crypto;
- Settings;
- Settings API inputs;
- Select profile;
- Upload panel.

Screenshot finali:

- `artifacts/screenshots/dashboard-render-final/dashboard-settled.png`
- `artifacts/screenshots/dashboard-render-final/dashboard-tooltip.png`
- `artifacts/screenshots/dashboard-render-final/checking.png`
- `artifacts/screenshots/dashboard-render-final/investments.png`
- `artifacts/screenshots/dashboard-render-final/crypto.png`
- `artifacts/screenshots/dashboard-render-final/settings.png`
- `artifacts/screenshots/dashboard-render-final/select-profile.png`
- `artifacts/screenshots/dashboard-render-final/home.png`
- `artifacts/screenshots/dashboard-render-final/upload-panel.png`
- `artifacts/screenshots/dashboard-render-postfix/settings-api-input-cleared.png`

## Verification

Targeted checks completed:

```powershell
pnpm vitest run tests/unit/server/services/price-refresh.test.ts tests/unit/ui/chart-data/dashboard-chart-model.test.ts tests/unit/ui/chart-data/checking-chart-data.test.ts tests/unit/ui/chart-data/portfolio-chart-data.test.ts
pnpm run typecheck
```

Full checkpoint still to run before merge/push:

```powershell
pnpm run lint
pnpm run typecheck
pnpm run typecheck:test
pnpm run test:run
pnpm run build
```
