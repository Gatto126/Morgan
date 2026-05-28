# Report Manutenibilita Scaffold

Data: 2026-05-28

Stato: analisi, piano e migrazione test completata

## Sintesi

La repo e' utilizzabile, ma lo scaffold e' ancora in una fase di transizione.
Il problema non e' solo che ci sono test "in giro" nell'app: il punto piu'
profondo e' che nello stesso livello convivono responsabilita' diverse.

- I test unitari vivono dentro cartelle di codice applicativo.
- `src/lib` contiene dominio, codice server-only, integrazioni, auth, logging,
  accesso Prisma e parser.
- Alcune route API contengono molta logica di business e aggregazione dati.
- Gli script mescolano E2E attivi, utilita' DB, migrazioni legacy e script
  vecchi/no-op.
- SQLite e' scaffoldato, ma l'app e' ancora accoppiata strutturalmente al runtime
  Next/Postgres.

Direzione consigliata: tenere l'app Next dov'e', ma rendere `src` una cartella
di codice di produzione. Test, fixture e utility di test devono uscire da `src`.
Subito dopo va svuotato gradualmente `src/lib`, separando dominio, server,
integrazioni e codice condiviso.

## Inventario Iniziale

Snapshot dei file non ignorati prima della migrazione test:

| Area | Totale |
| --- | ---: |
| File totali | 163 |
| File sotto `src/` | 122 |
| File di test | 21 |
| File sotto `scripts/` | 9 |
| File sotto `docs/` | 8 |

Distribuzione iniziale dei test:

| Posizione | Totale | Nota |
| --- | ---: | --- |
| `src/lib` | 13 | Test dominio, server, integrazioni e config mischiati |
| `src/components` | 5 | Per lo piu' helper e chart-data, non veri render test |
| `src/app/api` | 2 | Test route colocati ai moduli Next |
| `scripts` | 1 | Test helper script |

Snapshot dopo la migrazione test:

| Posizione | Totale | Nota |
| --- | ---: | --- |
| `tests/unit/domain` | 7 | Dominio, parser/import, pricing e calcoli finance |
| `tests/unit/server` | 5 | Config, security, logging e secrets |
| `tests/unit/integrations` | 1 | Client/service Binance |
| `tests/unit/ui` | 5 | Helper UI, chart data e hook leggeri |
| `tests/api` | 2 | Route-level tests |
| `scripts` | 1 | Test helper script |
| `src` | 0 | Nessun test sotto codice di produzione |

File piu' grandi:

| File | Linee | Rischio |
| --- | ---: | --- |
| `src/components/finance-shell.tsx` | 1417 | Troppe responsabilita' UI e stato in un componente |
| `src/components/dashboard.tsx` | 565 | Orchestrazione dashboard e view logic mischiate |
| `src/lib/justetf-parser.ts` | 521 | Integrazione/parser grande e poco isolata |
| `src/components/dashboard/dashboard-chart.tsx` | 510 | Rendering, tooltip e interazione chart molto densi |
| `src/app/api/transactions/dashboard/route.ts` | 504 | Aggregazione business dentro route API |
| `scripts/e2e/full-browser-flow.mjs` | 491 | Utile, ma dovrebbe avere fixture/helper separati |
| `scripts/e2e/smoke-upload-panel.mjs` | 489 | Utile, ma grande e bespoke |

## Test Placement

Pattern attuale: test colocati ai sorgenti.

Esempi:

- `src/lib/secrets.test.ts`
- `src/lib/trade-republic-csv-parser.test.ts`
- `src/lib/bbva-xlsx-parser.test.ts`
- `src/components/checking-dashboard/chart-data.test.ts`
- `src/app/api/account/route.test.ts`
- `scripts/lib/rate-limit-test-scope.test.mjs`

Questo pattern non e' sbagliato in assoluto, ma non e' ideale per l'obiettivo
attuale: una repo in cui `src` rappresenta solo codice shippabile. Inoltre
`tsconfig.json` include `**/*.ts` e `**/*.tsx`, quindi i test entrano nella
superficie generale di typecheck dell'app.

### Note Specifiche

`src/lib/secrets.test.ts`

- Testa helper server-only per cifratura e credenziali Binance.
- Mocka `server-only` direttamente nel file.
- Muta direttamente `process.env.MORGAN_ENCRYPTION_KEY`.
- Raccomandazione: spostare in `tests/unit/server/secrets.test.ts`; centralizzare
  reset/env helper in `tests/setup/env.ts`; centralizzare il mock `server-only`
  in setup o in helper documentato.

`src/lib/trade-republic-csv-parser.test.ts`

- Testa comportamento di dominio/import, ma vive nel generico `src/lib`.
- Costruisce fixture CSV inline, inclusi header e `File`.
- Raccomandazione: spostare in
  `tests/unit/domain/import/trade-republic-csv-parser.test.ts`; spostare builder
  CSV e campioni in `tests/fixtures/imports/trade-republic.ts` o fixture `.csv`.

`src/app/api/*/*.test.ts`

- Importano direttamente moduli route Next.
- Va bene per coverage stretta, ma dovrebbero essere classificati come API tests.
- Raccomandazione: spostare in `tests/api/account-route.test.ts` e
  `tests/api/binance-routes.test.ts`, con mock espliciti per auth/session/Prisma.

## Scaffold Test Consigliato

Struttura consigliata:

```text
tests/
  unit/
    domain/
      import/
        trade-republic-csv-parser.test.ts
        bbva-xlsx-parser.test.ts
      portfolio/
        portfolio-timeseries.test.ts
      pricing/
        price-request.test.ts
    server/
      auth-config.test.ts
      database-provider.test.ts
      request-security.test.ts
      secrets.test.ts
      logger.test.ts
    ui/
      auth-shell-helpers.test.ts
      finance-navigation.test.ts
      chart-data/
        checking-chart-data.test.ts
        portfolio-chart-data.test.ts
    api/
      account-route.test.ts
      binance-routes.test.ts
  fixtures/
    imports/
      trade-republic.ts
      bbva.ts
    users.ts
  setup/
    env.ts
    server-only.ts
```

Per gli script, si puo' scegliere una di due regole:

- lasciare `scripts/lib/*.test.mjs` accanto agli helper script;
- oppure spostarli in `tests/scripts/`.

La cosa importante e' codificare la regola in `vitest.config.ts`.

Vitest a regime dovrebbe diventare:

```ts
include: ["tests/**/*.test.ts", "scripts/**/*.test.mjs"]
```

Durante la migrazione a blocchi e' corretto usare una configurazione
transitoria che includa anche `src/**/*.test.ts`, cosi' i test non ancora
spostati restano nella suite.

TypeScript dovrebbe essere separato:

```text
tsconfig.json        Opzioni base condivise
tsconfig.app.json    Typecheck app/Next, esclude test
tsconfig.test.json   Typecheck test e fixture
```

Script consigliati:

```json
"typecheck": "tsc --noEmit -p tsconfig.app.json",
"typecheck:test": "tsc --noEmit -p tsconfig.test.json",
"test:unit": "vitest run tests/unit",
"test:scripts": "vitest run scripts",
"test:run": "vitest run"
```

## Scaffold Sorgenti

`src/lib` era il punto piu' critico. Conteneva:

- runtime server-only: `auth.ts`, `auth-guard.ts`, `db.ts`, `secrets.ts`,
  `user-response.ts`;
- configurazione/deploy: `auth-config.ts`, `database-provider.ts`, `logger.ts`,
  `request-security.ts`;
- dominio/import: `transaction-preview.ts`, `transaction-import.ts`,
  `transaction-classifier.ts`, `bbva-xlsx-parser.ts`,
  `trade-republic-csv-parser.ts`, `checking-balance.ts`;
- integrazioni: `binance-service.ts`, `binance-parser.ts`, `justetf-parser.ts`;
- calcoli condivisi: `portfolio-timeseries.ts`, `price-request.ts`,
  `live-prices.ts`;
- utility generiche: `utils.ts`, `institutions.ts`, `local-auth.ts`.

Struttura intermedia applicata:

```text
src/
  app/
    api/
    layout.tsx
    page.tsx
  components/
    ui/
    finance-shell/
    dashboard/
    checking-dashboard/
    portfolio-dashboard/
  domain/
    auth/
      local-auth.ts
    finance/
      checking-balance.ts
      portfolio-timeseries.ts
      transaction-classifier.ts
    imports/
      bbva-xlsx-parser.ts
      trade-republic-csv-parser.ts
      transaction-preview.ts
    pricing/
      price-request.ts
  integrations/
    binance/
      binance-parser.ts
      binance-service.ts
    justetf/
      justetf-parser.ts
  server/
    auth/
      auth.ts
      auth-guard.ts
      user-response.ts
    db/
      prisma.ts
      database-provider.ts
    security/
      auth-config.ts
      request-security.ts
      secrets.ts
    services/
      transaction-import.ts
      account-deletion.ts
      dashboard-data.ts
    logging/
      logger.ts
  shared/
    institutions.ts
    utils.ts
    live-prices.ts
  hooks/
  types/
```

Questa non e' ancora una migrazione monorepo. E' una pulizia dei confini dentro
l'app attuale. Dopo il refactor non resta piu' una cartella `src/lib`: il codice
e' stato ricollocato in `src/domain`, `src/integrations`, `src/server`,
`src/shared` e `src/client`.

## API Route

Molte route importano Prisma direttamente. Per una piccola app e' accettabile,
ma diventa un ostacolo per mantenere Postgres e SQLite in parallelo.

Punti principali iniziali:

- `src/app/api/transactions/dashboard/route.ts` e' lunga 504 linee e contiene
  aggregazione dati.
- `src/app/api/account/route.ts` contiene cleanup multi-modello e logica di
  preservazione asset.
- `src/app/api/users/[id]/route.ts` gestisce direttamente update/delete e pulizia
  di record provider-specific.

Pattern consigliato:

```text
route.ts
  valida request
  chiama server service
  restituisce response

server/services/*.ts
  workflow business
  chiama repository

server/repositories/*.postgres.ts
  implementazione Prisma/Postgres

domain/*.ts
  calcoli e validazioni pure
```

Stato dei candidati:

1. `dashboard-data.ts` estratto in `src/server/services/dashboard-data.ts`.
2. `account-deletion.ts` estratto in `src/server/services/account-deletion.ts`.
3. `profile-service.ts` estratto in `src/server/services/profile-service.ts`.
4. `binance-sync.ts` estratto in `src/server/services/binance-sync.ts`; il client
   in `src/integrations/binance` non importa piu' Prisma o codice security.
5. Repository layer introdotto per `profile`, `binance`, `dashboard`,
   `account-deletion` e `transaction-import`.
6. `src/server/services` non importa piu' Prisma o `@prisma/client`; la regola
   ESLint `no-restricted-imports` impedisce nuove dipendenze dirette dai service.

## Script

Lo scaffold script e' migliorato, ma restano ambiguita':

- `scripts/e2e/` e' corretto per browser flow.
- `scripts/testing/` e' corretto per manutenzione test locale.
- `scripts/lib/` e' corretto per helper condivisi.
- `scripts/seed.ts` e' stato spostato in `scripts/db/seed.ts`.
- `scripts/reclassify.ts` era un no-op ed e' stato eliminato.
- `scripts/migrate-binance-plaintext.mjs` e' stato rinominato in
  `scripts/db/migrate-binance-plaintext.legacy-sqlite.mjs` e protetto con un
  guard SQLite-only.

Struttura consigliata:

```text
scripts/
  db/
    seed.ts
    migrate-binance-plaintext.legacy-sqlite.mjs
  e2e/
    smoke-upload-panel.mjs
    full-browser-flow.mjs
  testing/
    clear-rate-limits.mjs
  lib/
    rate-limit-test-scope.mjs
    rate-limit-test-scope.test.mjs
```

## Prisma E Runtime

La separazione attuale e' sufficiente come scaffold:

- Postgres default: `prisma/schema.prisma`
- Migrazioni Postgres: `prisma/migrations/`
- SQLite scaffold: `prisma/sqlite/schema.prisma`

Rischio residuo: entrambi i provider generano lo stesso Prisma Client. Va bene
per controlli manuali locali, ma non e' una soluzione robusta per due runtime
attivi.

Prossima regola consigliata:

- il web usa solo il client Postgres;
- SQLite resta schema-validation/scaffold finche' non inizia il desktop;
- prima del desktop reale, introdurre repository/storage adapter provider-specific.

Forma futura:

```text
packages/
  db-postgres/
    prisma/
    repositories/
  db-sqlite/
    prisma/
    repositories/
  domain/
```

Non conviene saltare subito a questa struttura. Prima vanno puliti i confini
dentro l'app attuale, altrimenti il monorepo sposta solo il disordine.

## Componenti UI

La UI ha gia' sottocartelle utili, ma alcuni componenti root sono troppo grandi:

- `src/components/finance-shell.tsx` dovrebbe diventare solo orchestratore.
- `src/components/dashboard.tsx` dovrebbe delegare stato chart, tab e wiring dati.
- i chart hanno molta logica d'interazione che puo' vivere in hook/helper puri.

Split consigliato:

```text
src/components/finance-shell/
  finance-shell.tsx
  use-finance-shell-state.ts
  use-profile-persistence.ts
  use-panel-state.ts
  settings-panel.tsx
  upload-panel.tsx
  review-panel.tsx
  user-select-panel.tsx
```

Dopo l'aggiornamento degli import si puo' rimuovere il vecchio
`src/components/finance-shell.tsx`.

## Piano Di Implementazione

### Fase 1: Test Scaffold

Obiettivo: `src` contiene solo codice di produzione.

1. Creare `tests/unit`, `tests/api`, `tests/fixtures`, `tests/setup`.
2. Spostare tutti i `src/**/*.test.ts` in `tests/` per responsabilita'.
3. Estrarre fixture e builder inline dai parser test.
4. Aggiungere helper per mutazioni/reset di `process.env`.
5. Aggiornare `vitest.config.ts`.
6. Aggiungere `tsconfig.app.json` e `tsconfig.test.json`.
7. Aggiornare README e `docs/testing/README.md`.

### Fase 2: Script Scaffold

Obiettivo: eliminare ambiguita' legacy.

1. Estrarre fixture/builder E2E da `full-browser-flow.mjs`.
2. Se serve ancora una migrazione credenziali legacy Postgres, scriverla come
   script separato e provider-specific.

### Fase 3: Confini Sorgenti

Obiettivo: ridurre `src/lib` come catch-all.

1. Spostare parser/calcoli puri in `src/domain`.
2. Spostare client/parser di servizi esterni in `src/integrations`.
3. Spostare auth/db/security/logging server-only in `src/server`.
4. Aggiornare gli import con alias.
5. Aggiungere regole ESLint per impedire import server-only da componenti client.

### Fase 4: Service Layer API

Obiettivo: preparare storage adapter Postgres/SQLite.

1. Estrarre aggregazione dashboard dalla route.
2. Estrarre servizi per delete account/profile.
3. Creare repository Prisma.
4. Testare service/domain layer invece di affidarsi solo ai route test.

### Fase 5: Monorepo Opzionale

Obiettivo: separare target solo quando i confini sono stabili.

1. Reintrodurre un `pnpm-workspace.yaml` pulito.
2. Spostare dominio condiviso in `packages/domain`.
3. Spostare storage Postgres in `packages/db-postgres`.
4. Aggiungere `packages/db-sqlite` quando il desktop e' attivo.
5. Tenere `apps/web` come app Next/Vercel e aggiungere `apps/desktop` dopo.

## Stato Migrazione

Primo blocco completato:

- creato `tests/`;
- spostati `secrets.test.ts` e `trade-republic-csv-parser.test.ts`;
- aggiunti helper `tests/setup/env.ts` e `tests/setup/server-only.ts`;
- aggiunta fixture `tests/fixtures/imports/trade-republic.ts`;
- aggiunti `tsconfig.app.json` e `tsconfig.test.json`.

Secondo blocco completato:

- spostati i test domain per BBVA, transaction preview, portfolio time-series,
  checking balance, price request e local auth;
- aggiunta fixture XLSX riusabile in `tests/fixtures/imports/xlsx.ts`;
- verificato che questi test sono ancora utili e aggiornati.

Terzo blocco completato:

- spostati i test server/config per auth config, database provider, request
  security e logger;
- sostituiti reset manuali di `process.env` con `tests/setup/env.ts`;
- verificato che coprono ancora contratti attuali per Vercel/Postgres,
  same-origin mutation protection e logging production minimal.

Quarto blocco completato:

- spostato `binance-service.test.ts` in
  `tests/unit/integrations/binance/binance-service.test.ts`;
- verificato che copre ancora contratti utili: firma HMAC, merge saldi
  multi-endpoint, fallback pricing EUR/USDT e persistenza con cleanup token
  inattivi.

Quinto blocco completato:

- spostati i test UI/helper da `src/components` in `tests/unit/ui`;
- spostati i route test da `src/app/api` in `tests/api`;
- rimossa l'inclusione transitoria `src/**/*.test.ts` da `vitest.config.ts`;
- aggiornati `tests/README.md`, `tests/api/README.md` e
  `docs/testing/README.md` per rendere `src` produzione-only.

Stato attuale: non ci sono piu' test sotto `src/`. I test applicativi vivono in
`tests/`, mentre i test helper degli script restano in `scripts/**/*.test.mjs`.
La fase 1 del piano e' completata. Sono completati anche il primo taglio della
fase 2 sugli script, la separazione di `src/lib` e l'estrazione dei servizi
`dashboard-data`, `account-deletion`, `profile-service` e `binance-sync`.
Il repository layer e' in uso per i service business principali:
`profile-service`, `binance-sync`, `dashboard-data`, `account-deletion` e
`transaction-import`. Resta da valutare una seconda fase sui direct Prisma
ancora presenti in auth guard, health check e route read-only legacy.

## Criteri Di Accettazione

La pulizia completa dello scaffold e' raggiunta quando:

- non restano `*.test.ts` sotto `src/`;
- non esiste piu' una cartella catch-all `src/lib`;
- le route API piu' pesanti sono wrapper sopra servizi;
- gli script sono raggruppati per intento e gli script stale/no-op sono rimossi
  o archiviati;
- `tsconfig.app.json` esclude i test;
- `tsconfig.test.json` typechecka test e fixture;
- `pnpm run lint`, `pnpm run typecheck`, `pnpm run typecheck:test` e
  `pnpm run test:run` passano;
- la documentazione dice dove mettere nuovi test, fixture, script, dominio e
  codice server.
