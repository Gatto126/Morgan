# Morgan Valuation Memory Checkpoint

Ultimo aggiornamento: 2026-06-05
Commit baseline corrente: `879ada6` (storico daily snapshot Binance esposto alla UI)
Ultimo checkpoint smoke su Vercel: `3610ebd` (cold login e diagnostica di coerenza cross-dashboard)
Slice locale corrente: primo connect Binance coerente completato; crypto current surfaces snapshot-driven completate; storico Binance server-side implementato e precaricato nei payload stage; settings `API + DATA` deve cancellare anche lo storico Binance.
Prossima fase: verificare il primo run cron schedulato reale e la crescita progressiva dello storico Binance.

Questo file e' la memoria durevole del refactor valuation/topbar/Binance.
Quando una conversazione Codex viene compattata, leggere questo file prima di toccare codice.

## Ripresa Rapida

1. Esegui `git status --short`.
2. Leggi `Stato Corrente`, `Problemi Aperti` e `Memo Binance`.
3. Non ricominciare tutto il refactor da capo.
4. Continua dal piu' piccolo problema aperto non finito.
5. Preserva la regola principale: Morgan deve sembrare istantaneo, ma non deve mai mentire sui valori correnti.

## Obiettivo Prodotto

Morgan e' un workspace di finanza personale. La UI finance deve mostrare uno stato monetario corrente coerente per ogni profilo attivo.

Regola centrale:

```text
la navigazione cambia solo il selettore visibile, non la valuation corrente sottostante
```

Invariante corrente:

```text
heritage = checking + investment + crypto
checking = BBVA + liquidita' Trade Republic
investment = ETF/azioni/investimenti con prezzi live di mercato
crypto = crypto Trade Republic + saldi correnti Binance
Binance = saldi Binance sincronizzati e prezzati con quote live correnti
```

Tutti i valori correnti in topbar, card dashboard, detail row dove applicabile e punto chart di oggi devono arrivare dallo stesso committed current valuation snapshot per lo stesso profilo/data/versione.

I valori storici nei tooltip dei chart possono essere storici e incompleti. Non devono sostituire i valori correnti a riposo.

## Contratto Globale Valori Correnti

Questa e' la regola prodotto/tecnica piu' importante da preservare:

```text
le dashboard sono viste dello stesso stato corrente globale,
non proprietarie autonome dei valori correnti
```

Valori che devono leggere solo da committed valuation snapshot:

- topbar;
- card current value;
- detail row current dove applicabile;
- punto corrente/today del chart quando rappresenta il valore attuale;
- Home aggregate multi-profilo.

Le dashboard possono:

- restare montate anche quando non sono visitate;
- precaricare stage data;
- leggere cache;
- preparare tabelle, chart storici e provider list.

Le dashboard non devono:

- avviare Binance sync solo perche' vengono visitate o montate;
- pubblicare topbar/card/current totals da sole;
- combinare quote live nuove con stage data vecchio creando valori correnti locali;
- far divergere topbar, card e Home sullo stesso profilo/versione.

Refresh globale target:

```text
refresh richiesto
-> raccolta input in parallelo: stage data, Binance current balances, ETF/azioni, crypto, token Binance
-> costruzione draft valuation
-> se completa, commit atomico per profilo
-> topbar/card/detail/home leggono il nuovo snapshot
```

Durante il refresh, l'ultimo committed snapshot resta visibile. La velocita' si ottiene parallelizzando gli input, non pubblicando valori parziali.

## Contratto Multi-Profilo

Ogni profilo possiede il proprio committed valuation snapshot.

La Home deve aggregare solo snapshot committed validi per i profili richiesti. Se uno snapshot manca, e' vecchio rispetto alla versione profilo/data o ha quote obbligatorie mancanti, la Home deve segnalarlo o restare pending per quella parte; non deve mischiare valori current locali o parziali.

Regola multi-profilo:

```text
ogni profilo mantiene il proprio snapshot corrente committed
nessuna dashboard pubblica valori correnti direttamente
ogni profilo committa atomicamente il proprio snapshot
Home aggrega dopo commit, non durante il draft
```

Stato attuale: il profilo attivo e la Home hanno percorsi di warmup/refresh gia' funzionanti. Il requisito da preservare non e' fare tutto ovunque a ogni tick, ma impedire che Home/topbar/card mescolino snapshot current locali, parziali o non committed.

## Stato Corrente

Stato verificato alla baseline `3610ebd`:

- i totali correnti di main dashboard, investment, crypto e Binance sono guidati dal central valuation snapshot;
- la navigazione dashboard non forza piu' refresh della live valuation;
- la UI Binance dashboard non possiede piu' la current sync;
- settings/API connect resta l'entry point esplicito di sync Binance richiesta dall'utente;
- l'ownership dei refresh di current valuation e' centralizzata;
- la UI mantiene visibile l'ultimo committed snapshot mentre un nuovo draft refresh e' in corso;
- cold login/F5 e controlli main/investment/crypto hanno restituito `coherent: true` nella diagnostica production;
- lo smoke manuale detail-row/coherence e' stato completato: i valori correnti visibili cambiano solo quando cambia il committed snapshot;
- `refreshing: true` nella diagnostica puo' essere normale: significa che esiste un draft refresh mentre il committed snapshot resta visibile;
- Docker preprod locale replica build production + Next start + Postgres ed e' ora il gate consigliato prima di Vercel per slice valuation/Binance;
- gli E2E `active-components` e `realistic` sono stati aggiornati alla UI attuale (`Connect Binance API`) e passano in Docker preprod con credenziali Binance reali temporanee;
- il rate limiter DB-backed di `/api/prices` non genera piu' 500 ne' log `P2002` sotto richieste concorrenti;
- la cache server-side profilo viene invalidata dopo sync/update/delete Binance, evitando payload Binance stale dopo connect/delete;
- il primo connect Binance ora attende il ciclo valuation prima del messaggio finale `Connected! ...`, oppure mostra un messaggio esplicito se la valuation non e' pronta;
- `binanceRefreshKey` viene persistito in `localStorage`, cosi' un reload immediato dopo connect continua a leggere la cache/versione Binance nuova invece della vecchia `binance:0` vuota;
- la dashboard Binance non usa piu' una schermata muta: mostra chart, preparing, no-material o unavailable in modo esplicito;
- crypto current surfaces completate localmente: prezzo unitario/current value token e totali provider crypto/investment nelle card main dashboard e portfolio dashboard leggono il committed valuation snapshot invece del punto chart/stage fallback.
- follow-up locale: le card crypto non usano piu' fallback legacy a `currentPoint`, live price diretto o invested value quando manca lo snapshot; mostrano pending/skeleton finche' il committed snapshot non e' valido.
- storico Binance server-side implementato localmente: schema `BinanceDailySnapshot`, servizio idempotente, route cron protetta da `CRON_SECRET` e configurazione Vercel Cron `0 23 * * *`;
- produzione preparata: `CRON_SECRET` configurato su Vercel Production e migration `20260603070000_binance_daily_snapshots` applicata su Neon production.
- diagnosi cron 2026-06-04: Vercel Cron risulta abilitato e registrato su `/api/cron/binance-daily-snapshot`, ma nei log Vercel degli ultimi 3 giorni non risultavano chiamate automatiche per quel path; il run manuale dalla dashboard Vercel ha invece prodotto `GET 200`, quindi endpoint e autorizzazione sono vivi.
- correzione cron storico Binance: il batch schedulato ora usa come `dateKey` il giorno calendario precedente in `Europe/Rome`, perche' la fotografia notturna rappresenta il giorno appena concluso; inoltre la route cron risponde `500` se almeno un profilo fallisce e scrive nei log una riga summary leggibile con `dateKey`, `created`, `failed`, `profiles`, `skippedExisting`, `skippedMissingCredentials`.
- correzione dettaglio storico Binance 2026-06-04: il job salva gia' tutte le righe token dello snapshot giornaliero; il problema era il payload storico letto dalla UI, che esponeva solo il totale. Ora le stage data Binance portano anche i token storici, cosi' nella dashboard crypto con `BINANCE` selezionato il tooltip/serie storiche possono mostrare `BALANCE` e righe token reali per ogni giorno fotografato.
- Binance dashboard collegata allo storico daily snapshot: la linea non viene piu' ricostruita piatta dal solo valore corrente; usa gli snapshot giornalieri reali e aggiunge/sostituisce il punto di oggi con il committed current valuation snapshot.
- Crypto dashboard ALL collegata allo stesso storico daily snapshot per il provider `BINANCE`: la linea Binance non deve piu' essere un salto verticale da zero/current; i bucket storici sommano Binance daily snapshot al totale crypto storico, mentre il punto di oggi resta il committed current valuation snapshot.
- Main dashboard collegata allo storico daily snapshot Binance: i punti storici `crypto` e `heritage` sommano il valore Binance giornaliero quando disponibile; nella tab crypto la sottolinea `BINANCE` nasce dallo stesso storico.
- Le sottolinee `BINANCE` nei grafici crypto main e Crypto dashboard seguono la stessa regola: con almeno due punti disegnano una linea; con un solo punto possono disegnare un marker standalone quando `BINANCE` e' acceso in legenda.
- La tab `CRYPTO` della main dashboard non deve usare come dominio X tutta la storia globale del portfolio: per restare coerente con la Crypto dashboard, taglia i punti iniziali inattivi e parte dal primo punto crypto/Binance reale.
- Regola aggregazione punto Binance singolo: il punto Binance corrente/storico entra negli aggregati `CRYPTO` e `HERITAGE`. Nella tab `CRYPTO` della main dashboard e nella Crypto dashboard separata, il marker standalone `BINANCE` non viene disegnato finche' la linea aggregata `CRYPTO` e' visibile, per evitare doppia rappresentazione dello stesso valore; torna visibile solo se l'utente nasconde l'aggregato e vuole isolare Binance.
- Quando nella Crypto dashboard e' selezionato il provider `BINANCE`, la linea `BALANCE` e i token non devono creare zeri storici sintetici prima del primo punto reale Binance. Con un solo punto reale si disegna un marker standalone; con almeno due punti reali si disegna una linea.
- Lo storico Binance non deve arrivare come fetch client tardiva per main/crypto: viene arricchito server-side dentro i payload stage `/api/transactions/dashboard` e `/api/transactions/crypto`, anche quando la base arriva da `ProfileStageSnapshot`.
- Cache stage client bumpata a versione 3 per scartare payload `sessionStorage` vecchi senza `binanceHistoricalPoints`.
- Con Binance collegata, main e crypto non devono rendere visibile il chart solo perche' hanno stage data o balances: devono aspettare il `currentValuationPoint` committed, cosi' scala, topbar e punto corrente entrano insieme.
- I date key current per chart Binance/Crypto usano `Europe/Rome`, come il cron storico.
- Settings Binance delete semantics: `API ONLY` scollega solo le credenziali e preserva saldi/storico; `API + DATA` elimina credenziali, `BinanceBalance`, `BinanceDailySnapshot` con righe token in cascade, marker cache `binance_sync_*`, `ProfileStageSnapshot` del profilo e cache stage browser/sessionStorage, poi invalida la cache profilo.
- Se una cancellazione Binance precedente e' stata parziale, la UI Settings deve permettere un wipe `DATA` anche quando non ci sono piu' API salvate, cosi' l'utente non deve ricollegare Binance solo per pulire lo storico/cache residui.

Risultati smoke manuale comunicati il 2026-06-03:

| Passaggio | Coerente | Refreshing | Refresh ms | Snapshot | Totali cents |
| --- | --- | --- | ---: | --- | --- |
| Dashboard cold login | si | no | 1083 | `cmpweqfz30001jy043muzli4t:2026-06-02:449:371:65:13:0:1780442326295` | binance 233422, checking 448513, crypto 236525, heritage 918148, investment 233110 |
| Dashboard dopo attesa | si | no | 1085 | `cmpweqfz30001jy043muzli4t:2026-06-02:449:371:65:13:0:1780442366291` | binance 233437, checking 448513, crypto 236541, heritage 918164, investment 233110 |
| Investment | si | si | 1023 | `cmpweqfz30001jy043muzli4t:2026-06-02:449:371:65:13:0:1780442394279` | binance 233253, checking 448513, crypto 236353, heritage 917976, investment 233110 |
| Crypto | si | si | 1172 | `cmpweqfz30001jy043muzli4t:2026-06-02:449:371:65:13:0:1780442411412` | binance 233337, checking 448513, crypto 236439, heritage 918062, investment 233110 |

Interpretazione:

- `coherent: true` in tutti i passaggi registrati;
- dashboard dopo attesa ha cambiato snapshot e totali insieme, come atteso da un committed refresh;
- investment e crypto mostrano `refreshing: true`, ma lo snapshot visibile resta committed e coerente;
- checking e investment restano stabili nei totali mentre Binance/crypto/heritage si muovono insieme ai refresh di quote.

Ultima verifica locale del 2026-06-03:

```text
pnpm run prisma:validate   pass, Postgres + SQLite
pnpm run lint              pass
pnpm exec tsc --noEmit     pass
pnpm run typecheck:test    pass
pnpm run test:run          pass, 82 file / 390 test
pnpm run build             pass nella build Docker preprod
```

Verifica Docker preprod del 2026-06-03:

```text
pnpm run docker:preprod:up           pass, build production + migration deploy + health ok
pnpm run smoke:upload-panel:docker   pass
pnpm run e2e:active-components       pass con Binance reale, 9 token trovati, card+chart Binance visibili, HTTP/browser errors 0, account test cancellato
pnpm run e2e:realistic               pass con Binance reale, 9 token trovati, HTTP/browser errors 0, account test cancellato
docker logs finali                   nessun P2002/Unique constraint/500 rate-limit dopo fix upsert
```

Verifica locale crypto current surfaces del 2026-06-03:

```text
pnpm exec vitest run tests/unit/ui/finance-shell/current-valuation-assets.test.ts
  pass, provider crypto totals separati da Binance e missing provider gestito
pnpm exec tsc --noEmit --pretty false
  pass
pnpm run lint
  pass
pnpm run typecheck:test
  pass
pnpm run test:run
  pass, 82 file / 393 test
pnpm run docker:preprod:up
  pass, build production + Postgres
pnpm run smoke:upload-panel:docker
  pass
pnpm run e2e:active-components
  pass con Binance reale, 9 token trovati, HTTP/browser errors 0, account test cancellato
pnpm run e2e:realistic
  pass con Binance reale, 9 token trovati, secondo profilo incluso, HTTP/browser errors 0, account test cancellato
docker logs finali
  nessun ERROR/500/P2002/Unhandled/Exception
```

Verifica locale storico Binance server-side del 2026-06-03:

```text
pnpm exec prisma generate --schema=prisma/schema.prisma
  pass
pnpm exec vitest run tests/unit/server/services/binance-daily-snapshot.test.ts
  pass, service idempotente, Europe/Rome date key, dust incluso, batch continua dopo errore profilo
pnpm exec vitest run tests/api/binance-daily-snapshot-cron.test.ts
  pass, missing secret 503, unauthorized 401, authorized 200
pnpm run prisma:validate
  pass, Postgres + SQLite
pnpm run lint
  pass
pnpm run typecheck
  pass
pnpm run typecheck:test
  pass
pnpm run test:run
  pass, 84 file / 400 test
pnpm run build
  pass, route `/api/cron/binance-daily-snapshot` inclusa
pnpm run docker:preprod:up
  pass, build production + migration deploy + health ok
pnpm run smoke:upload-panel:docker
  pass
docker logs app --tail=200
  nessun ERROR/500/P2002/Unhandled/Exception
pnpm run docker:preprod:down
  pass
```

Verifica production setup storico Binance del 2026-06-03:

```text
Vercel Environment Variables
  CRON_SECRET aggiunto a Production, Sensitive
Neon production migration
  prisma migrate deploy su host Neon direct/unpooled
  migration applicata: 20260603070000_binance_daily_snapshots
```

Verifica locale collegamento Binance chart storico del 2026-06-03:

```text
pnpm exec vitest run tests/unit/ui/chart-data/binance-chart-model.test.ts
  pass, snapshot storici ordinati, punto corrente di oggi prevale, niente storico inventato prima del primo snapshot
pnpm exec vitest run tests/unit/server/services/binance-daily-snapshot.test.ts
  pass, history reader normalizzato per client chart
pnpm exec vitest run tests/api/binance-history-route.test.ts
  pass, ownership richiesta e snapshot restituiti
pnpm exec vitest run tests/unit/ui/chart-data/portfolio-chart-data.test.ts
  pass, storico Binance fuso nel chart Crypto provider/history e current point di oggi prevale
pnpm exec vitest run tests/unit/ui/chart-data/dashboard-chart-model.test.ts
  pass, storico Binance fuso nelle linee main crypto/heritage e nella sottolinea Binance della tab crypto
```

Nota sicurezza: le credenziali Binance reali sono state passate solo come variabili d'ambiente di processo nei comandi E2E locali. Non sono state salvate in file tracciati.

## Invarianti Non Negoziabili

- Non mostrare mai `0,00` finti quando manca un valore corrente.
- Non lasciare mai che `--` visibili sostituiscano un valore corrente committed valido durante refresh/navigazione ordinari.
- Non lasciare mai che la navigazione dashboard crei current valuation come side effect.
- Non lasciare mai che la navigazione dashboard avvii Binance current sync.
- Non pubblicare mai totali topbar/card/today-chart da quote live miste.
- Non sostituire mai un committed snapshot con un draft parziale.
- Non usare mai prezzi storici di fallback come valori live correnti.
- Non hardcodare comportamenti per un singolo account, profilo, asset, token o wallet Binance.
- Non cancellare transazioni/profili sorgente per sistemare stato derivato.
- Le transazioni sorgente sono autorevoli; stage data, snapshot e live quote sono derivati.
- Non fetchare la stessa quote live piu' volte nello stesso ciclo globale solo perche' appare in piu' profili, provider o dashboard.

## Policy Atomic Valuation

Comportamento target:

```text
nessun committed snapshot valido -> skeleton
committed snapshot valido + refresh in corso -> mantieni visibile il committed snapshot
nuovo snapshot completo pronto -> swap atomico ovunque
refresh fallito o parziale -> mantieni committed snapshot e pubblica diagnostica
navigazione dashboard con committed snapshot -> niente skeleton, niente recompute locale
```

Definizioni:

- `committedSnapshot`: ultima current valuation completa e coerente per profilo/data/versione. I selector per topbar, card, home e punti chart correnti leggono questo.
- `draftSnapshot`: risultato di refresh non visibile. Puo' fetchare stage data, saldi Binance e live quote, ma non deve sovrascrivere i valori correnti visibili pezzo per pezzo.
- `complete snapshot`: tutti i figli correnti richiesti sono pronti o esplicitamente assenti. Valori parent come `crypto` e `heritage` vengono mostrati solo quando le dipendenze sono valide.
- `stale-while-refresh`: durante il refresh, continua a mostrare l'ultimo committed snapshot.

Policy live quote:

- I prezzi live sono input, non publisher diretti di totali visibili.
- `LIVE_PRICES_UPDATED_EVENT` puo' aggiornare diagnostica e cache, ma non dovrebbe ricostruire direttamente i totali correnti visibili.
- I totali correnti si aggiornano tramite `ensureFinanceCurrentValuation(...)`.
- Gli stage warmup possono precaricare dati e cache quote, ma non devono pubblicare current totals in modo indipendente.

## Mappa Codice Chiave

- Entry/server priming: `src/app/page.tsx`
- Shell client principale: `src/components/finance-shell.tsx`
- Cache stage dashboard: `src/components/finance-shell/dashboard-stage-data-cache.ts`
- Orchestrazione sessione/diagnostica: `src/components/finance-shell/finance-session-orchestrator.ts`
- Current valuation store/selector: `src/components/finance-shell/current-valuations-store.ts`
- Helper asset current valuation: `src/components/finance-shell/current-valuation-assets.ts`
- Topbar dashboard store/shell: `src/components/finance-shell/dashboard-topbar-store.ts`, `src/components/finance-shell/dashboard-topbar-shell.tsx`
- Test current value asset/dashboard: `tests/unit/ui/finance-shell/current-valuations-store.test.ts`, `tests/unit/ui/finance-shell/current-valuation-assets.test.ts`
- Live price cache/request batching: `src/shared/live-prices.ts`
- Price API/service: `src/app/api/prices/route.ts`, `src/server/services/price-refresh.ts`
- Binance current sync: `src/app/api/binance/sync/route.ts`, `src/app/api/binance/connect/route.ts`, `src/server/services/binance-sync.ts`
- Integrazione Binance: `src/integrations/binance/binance-service.ts`
- Storico Binance daily snapshot: `src/server/services/binance-daily-snapshot.ts`, `src/server/repositories/binance-daily-snapshot-repository.ts`, `src/app/api/cron/binance-daily-snapshot/route.ts`, `src/app/api/binance/history/route.ts`
- Binance chart storico: `src/components/binance-dashboard.tsx`, `src/components/binance-dashboard/binance-chart-model.ts`
- Crypto chart Binance storico: `src/components/portfolio-dashboard/portfolio-dashboard.tsx`, `src/components/portfolio-dashboard/chart-data.ts`
- Main/Crypto dashboard Binance storico/readiness: `src/server/services/binance-history-stage-data.ts`, `src/components/dashboard.tsx`, `src/components/dashboard/dashboard-chart-data-model.ts`, `src/components/dashboard/use-dashboard-visual-state.ts`, `src/components/portfolio-dashboard/portfolio-dashboard.tsx`

## Problemi Risolti

| Problema | Sintomo | Soluzione | Evidenza |
| --- | --- | --- | --- |
| Current valuation distribuita | Topbar, card e punto chart corrente potevano essere prodotti da calcoli locali diversi. | Introdotto central current valuation store con selector. | `current-valuations-store.ts`, test valuation selector. |
| Flash da refresh parziale | Un refresh poteva esporre valori pending, mancanti o zero finti. | Aggiunta policy committed/draft snapshot e publish atomico. | Test su retention del draft parziale e rigetto quote zero. |
| Navigazione dashboard creava valore | Cambiare dashboard poteva forzare live valuation refresh o cache-only publish. | La navigazione ora precarica stage data senza forzare current valuation. | Controllare `navigateToStableStage` e `preloadFinanceProfileStages(... refreshCurrentValuation: false)`. |
| Binance dashboard possedeva la sync | Visitare UI Binance-related poteva avviare current sync. | Ownership current sync spostata agli owner orchestrati; dashboard UI orientata a lettura/view. | Baseline `3610ebd`. |
| Mismatch current/detail Binance | Totali Binance e detail row token potevano divergere nel timing del committed snapshot. | I current value Binance ora preferiscono il committed valuation snapshot; smoke manuale detail-row/coherence completato. | `current-valuation-assets.ts`, test allineamento dashboard/detail row, risultati smoke del 2026-06-03. |
| Import chiudeva prima di stato coerente | L'import rischiava di chiudere il loader prima di valuation coerenti. | Import warmup attende dati profilo aggiornati e percorso valuation prima di applicare stato visibile. | `warmImportedProfileData`, test finance-shell import-related. |
| Home multi-profilo poteva pubblicare aggregate incompleti | Snapshot mancante per un profilo poteva produrre aggregate corrente fuorviante. | Home aggregate resta loading quando mancano snapshot richiesti. | Test `selectCurrentValuationHeritageAggregate`. |
| Quote live zero/unavailable inquinavano i totali | Quote zero o unavailable potevano diventare valori numerici correnti finti. | Zero rigettato come market quote invalida; unavailable tracciato in diagnostica. | Test `rejects zero live quotes` e quote Binance unavailable. |
| Rate limit volatile | Price/account-delete custom limits erano memory-backed. | Rate limit spostati su flow DB-backed `RateLimit` namespaced. | `src/server/services/rate-limit.ts`, `price-refresh.ts`. |
| Race condition rate limiter DB-backed | In Docker preprod, richieste concorrenti a `/api/prices` potevano loggare/fallire su unique constraint `RateLimit.key`. | Primo bucket creato con `upsert`; retry dell'intera transazione solo per errori retryable `P2002/P2034`. | `rate-limit-repository.ts`, test `retries after a retryable write conflict`, E2E finali senza P2002/500. |
| Cache profilo stale dopo sync Binance | Dopo connect/sync Binance, `/api/binance/balances` e stage correlati potevano restare su payload pre-connect finche' scadeva TTL. | Aggiunta `invalidateProfileDataCache(userId)` e chiamata dopo sync/update/delete credenziali Binance. | `profile-data-cache.ts`, `route-handler.ts`, `profile-service.ts`, test invalidazione profilo. |
| Primo connect Binance chiudeva prima della vista coerente | Il pannello mostrava `Connected! 9 tokens found` ma dopo reload la dashboard poteva leggere una vecchia cache `binance:0` vuota e mostrare no-material invece del chart. | Il connect attende `ensureFinanceCurrentValuation`, la dashboard mostra stati espliciti e `binanceRefreshKey` viene persistito in `localStorage` per sopravvivere al reload. | `use-finance-binance-actions.ts`, `binance-dashboard.tsx`, test `use-finance-binance-actions`, Docker `active-components` con card+chart Binance visibili. |
| Script E2E disallineati alla UI | I flow cercavano `Save API Keys`, `CHECKING` e cache storage v1; la UI usa `Connect Binance API`, contenuti reali e cache v2. | Aggiornati selector, wait condition e cache prefix; Binance card/graph gestiti in modo compatibile con wallet reali. | `active-components`, `realistic`, `full-browser-flow`, `vercel-persistent-account-smoke`. |
| Fan-out enrichment import | Enrichment ISIN/token poteva lanciare troppe request esterne insieme. | Concorrenza enrichment limitata. | `MARKET_ENRICHMENT_CONCURRENCY = 3`. |

## Problemi Aperti

| Priorita' | Problema | Comprensione Attuale | Risoluzione Prevista |
| --- | --- | --- | --- |
| P1 | E2E coherence automatizzati | La coerenza e' verificata manualmente con browser diagnostics. | Aggiungere assert E2E su `window.morganFinanceCoherenceDiagnostics?.()` per cold login, F5, dashboard switching e refresh-in-flight. |
| P1 | Audit topbar/card/detail/Home | Molti valori sono gia' snapshot-driven, ma serve verifica sistematica di tutte le superfici current. | Mappare ogni valore current visibile e assicurare che legga da selector committed snapshot, non da calcoli dashboard-local. |
| P2 | Leggibilita' diagnostica | La diagnostica e' utile ma verbosa; l'indagine production richiede ancora interpretazione. | Aggiungere summary compatto: profilo attivo, visible snapshot id, committed/draft ids, totali, missing/unavailable keys, current sync status. |
| P2 | Stale crypto cache non renderizza prima del background refresh ritardato | `realistic` conferma cache crypto in sessionStorage, refresh background partito e reload ok, ma `cachedCryptoRenderedBeforeRefreshReleased=false`. | Usare cache stale solo come stage data se versione/data key combaciano; current values restano snapshot-driven. Correggere hook/mount order dopo audit snapshot/current surfaces. |
| P2 | Lavoro dashboard inattive montate | Le dashboard inattive possono warmare dati. Serve confidenza che non pubblichino current totals o facciano hidden rendering costoso. | Aggiungere instrumentation/assertions per hidden dashboard transitions; mantenere warmup cache/data-only. |
| P2 | Primo run cron da osservare | Il codice e Vercel Cron sono pronti, ma il primo punto reale arriva solo dopo il run schedulato. | Dopo il primo run controllare log Vercel e DB; la Binance dashboard deve mostrare il nuovo punto storico piu' il punto current di oggi. |
| P2 | Smoke F5 storico Binance production | Codice locale include lo storico Binance nei payload stage dashboard/crypto/Home, invalida le vecchie cache client e blocca la prima comparsa finche' manca il current valuation point. | Dopo deploy, fare F5 su Home, main e crypto: il chart deve restare in loading/pending finche' topbar/current snapshot sono pronti, poi apparire gia' coerente. |
| P3 | Futuro desktop/SQLite | Lo schema SQLite valida, ma il runtime desktop non e' implementato. | Tenere valuation/domain logic target-neutral; poi aggiungere storage adapter e migrazioni SQLite. |

## Piano Attivo

1. Consolidamento contratto:
   - fatto: scritto nel memo il contratto globale topbar/card/detail/Home;
   - fatto: chiarita separazione Binance current materiale/veloce vs storico completo schedulato;
   - fatto: chiarita policy dashboard attive: possono warmare dati, non possedere current totals.

2. Primo connect Binance coerente:
   - fatto: dopo `Connect Binance API`, il flow completa sync + pricing + current valuation prima dello stato finale, oppure espone un messaggio transitorio/esplicito;
   - fatto: la dashboard Binance non accetta piu' il solo titolo come stato valido;
   - fatto: `binanceRefreshKey` e' persistito, quindi F5/reload post-connect resta sulla versione cache nuova;
   - gate completato: Docker preprod + `e2e:active-components` con credenziali reali mostra card+chart Binance e passa senza HTTP/browser errors.

3. Storico Binance server-side:
   - fatto: aggiunto modello `BinanceDailySnapshot` + righe token complete;
   - fatto: snapshot idempotente per `userId + dateKey`;
   - fatto: `dateKey` calcolato in `Europe/Rome`, anche se Vercel Cron gira in UTC;
   - fatto: route `/api/cron/binance-daily-snapshot` protetta da `CRON_SECRET`;
   - fatto: configurazione Vercel Cron a `0 23 * * *` UTC;
   - fatto: il job salva tutto quello che Binance restituisce con saldo positivo, inclusi dust e locked;
   - fatto: `BinanceBalance` current resta veloce/materiale e separato;
   - gate completato localmente: service/route test, schema Postgres/SQLite, test suite, build e Docker preprod.
   - fatto: `CRON_SECRET` configurato su Vercel Production;
   - fatto: migration Neon production applicata;
   - fatto: deploy Vercel registrato con cron attivo;
   - fatto localmente: endpoint `/api/binance/history` e Binance dashboard collegata agli snapshot daily;
   - fatto localmente: Crypto dashboard ALL usa gli snapshot daily per la linea provider `BINANCE`;
   - fatto localmente: main dashboard usa gli snapshot daily per sommare Binance nei punti storici `crypto` e `heritage`;
   - fatto localmente: main/crypto dashboard ricevono `binanceHistoricalPoints` dentro lo stage payload, evitando fetch client separate e linee Binance che arrivano dopo F5;
   - fatto localmente: con Binance collegata, main/crypto non partono visibili da SSR/cache stage data se manca il `currentValuationPoint`;
   - fatto localmente: Home preview riceve `binanceHistoricalPoints` nel payload preview e non renderizza la linea Heritage finche' manca il punto current aggregate committed;
   - fatto localmente: date key chart allineato a `Europe/Rome`;
   - resta: deployare la correzione Home e verificare il primo run schedulato.

4. Audit superfici current:
   - fatto localmente: crypto current surfaces completate;
   - fatto: aggiunto selector provider totals da committed valuation snapshot e usato da main dashboard crypto card e portfolio/crypto dashboard card;
   - fatto: rimosso il fallback iniziale non snapshot-driven per crypto card; senza snapshot committed valido, prezzo/current value/totale provider crypto restano pending/skeleton;
   - fatto: test unitari coprono provider Trade Republic crypto, Binance separato e provider mancante;
   - gate completato: Docker preprod + `active-components` + `realistic` con Binance reale passano senza HTTP/browser errors;
   - regola: ogni prezzo/current value crypto visibile deve leggere dallo stesso committed valuation snapshot usato da Binance/topbar;
   - includere crypto dashboard, card Trade Republic, prezzo unitario BTC/ETH, current value BTC/ETH, totale provider, totale crypto e heritage;
   - non aggiornare con quote live `Invested Value`, quantity o storico transazionale;
   - mappare topbar, card, detail row, chart today e Home;
   - regola Home: storico/preview possono arrivare da cache o payload leggero, ma il grafico non deve essere mostrato prima del current aggregate committed;
   - fatto: rimosse le animazioni di comparsa una tantum da chart/card/dashboard background; le vecchie classi sono state rinominate in `visibility-gate`, che mantiene solo visibilita' `data-visible` e `pointer-events` senza fade/slide;
   - fatto: la readiness dei casi bloccanti resta esplicita e testata: profilo senza transazioni e upload panel possono diventare visibili senza attendere misura chart;
   - futuro: aggiungere una stage-enter animation dedicata che scatti a ogni cambio dashboard senza rimontare componenti o perdere cache/stato;
   - sostituire eventuali calcoli locali con selector committed snapshot;
   - gate: test unitari per selector e smoke browser con confronto topbar/card/detail/Home.

5. Automazione E2E/coherence:
   - fatto: riallineati `active-components` e `realistic` alla UI attuale e validati in Docker preprod con credenziali Binance reali temporanee;
   - fatto: Docker preprod scelto come gate production-like locale, perche' replica meglio build production + Postgres rispetto al dev server locale;
   - fatto: credenziali Binance reali usate solo come env di processo nei flow locali, mai in file tracciati;
   - fatto: `active-components` ora fallisce se la dashboard Binance e' muta; accetta solo chart o stato esplicito;
   - assertare diagnostica coerente dopo cold login e F5;
   - assertare che il dashboard switching non crei piu' visible snapshot id per lo stesso profilo;
   - includere letture refresh-in-flight dove `refreshing: true` e' consentito ma il committed snapshot visibile resta stabile.

6. Cache stale come stage data:
   - usare cache stale per velocizzare layout/storico/tabelle solo se versione profilo, transaction count e date key combaciano;
   - current values restano snapshot-driven;
   - gate: E2E `realistic` puo' riattivare assert forte sul render cache quando il modello e' blindato.

7. Cleanup diagnostica:
   - aggiungere un helper piccolo che riduce la diagnostica completa a un oggetto current-state leggibile;
   - mantenere la diagnostica dettagliata esistente per indagini profonde;
   - documentare qui la shape compatta dopo l'implementazione.

## Strategia Test

La parte valuation/Binance va testata a tre livelli:

1. Gate locale veloce:
   - serve a bloccare regressioni TypeScript, lint, unit test, build e schema;
   - non basta per validare comportamento production-like, refresh browser, cookie/sessione e Binance reale.

2. Docker preprod:
   - e' il gate locale piu' vicino a Vercel per questa app;
   - usa build production, Next start, Postgres e migrazioni reali;
   - non replica perfettamente Vercel serverless/Neon, ma cattura molti problemi che il dev server non vede;
   - dovrebbe essere il riferimento per E2E/coherence prima di fidarsi di una slice.

3. Smoke Vercel/Binance reale:
   - serve quando bisogna validare cold login, F5, produzione reale e signed Binance account API;
   - usare solo API key Binance temporanee read-only;
   - non deve diventare un test automatico ordinario con segreti persistenti;
   - va eseguito manualmente o come job opt-in controllato, poi revocare la key.

Regola pratica:

```text
unit/local gate per ogni slice
Docker preprod per ogni slice valuation/Binance significativa
Vercel + Binance reale quando la slice tocca current sync, saldi reali o diagnostica production
```

Regola di avanzamento per fasi:

```text
una fase non e' "finita" finche':
- il contratto desiderato e' scritto nel memo;
- esiste almeno un test/unit o E2E che lo protegge;
- Docker preprod passa se la fase tocca valuation/Binance/browser;
- i problemi emersi vengono promossi a Problemi Aperti o chiusi in Problemi Risolti.
```

Matrix minima per le prossime fasi:

| Fase | Test minimo |
| --- | --- |
| Primo connect Binance coerente | unit/service per sync material set + E2E Docker real-Binance con riepilogo visibile o stato no-material esplicito |
| Audit current surfaces | unit selector + smoke browser topbar/card/detail/Home su stesso snapshot |
| Crypto current surfaces | unit su token Trade Republic + Binance che condividono quote BTC/ETH; dashboard/card devono aggiornare prezzo, current value e totale dallo snapshot |
| Cache stale stage data | E2E reload con cache stale: stage data immediati quando validi, current values sempre committed snapshot |
| Diagnostica compatta | unit shape diagnostica + E2E che fallisce se `coherent` non e' true |
| Storico Binance server-side | schema + service idempotente + route cron autorizzata + fixtures complete inclusi dust/locked |

## Risultati E2E Docker 2026-06-03

Ambiente:

- `http://127.0.0.1:3001`;
- Next production build via Docker;
- Postgres Docker;
- credenziali Binance reali passate come env temporanee;
- account/profili test creati e cancellati dai flow.

Risultati:

| Flow | Esito | Note |
| --- | --- | --- |
| `smoke:upload-panel:docker` | pass | upload/import base ok |
| `e2e:active-components` | pass | 54 righe TR, 120 BBVA, Binance real sync `real_credentials_synced`, 9 token, card+chart Binance visibili, HTTP/browser errors 0, utenti test rimossi |
| `e2e:realistic` | pass | 81 righe TR, 180 BBVA, secondo profilo, Binance real sync connected, 9 token, delete API+data ok, HTTP/browser errors 0 |

Diagnostica da ricordare:

- `active-components` inizialmente ha rivelato una cache `binance:0` vuota post-reload mentre `binance:1` aveva 9 saldi; la fix e' persistere `binanceRefreshKey`;
- dopo la fix, `active-components` non registra piu' `observed_explicit_binance_dashboard_state` e `binanceDashboardDebug` resta vuoto perche' il chart e' visibile;
- `realistic` ha registrato `cachedCryptoRenderedBeforeRefreshReleased=false`: cache crypto stale presente, refresh background partito, reload ok, ma non e' stato dimostrato render stale prima del completamento refresh;
- dopo la fix `upsert` rate limiter, i log finali Docker non mostrano piu' `P2002`, unique constraint o 500 collegati a `/api/prices`.

## Protocollo Smoke Manuale

Prima di pushare modifiche valuation:

```powershell
pnpm run prisma:validate
pnpm run lint
pnpm run typecheck
pnpm run typecheck:test
pnpm run test:run
pnpm run build
```

Gate Docker preprod consigliato per modifiche valuation/Binance:

```powershell
pnpm run docker:preprod:up
pnpm run smoke:upload-panel:docker
pnpm run e2e:realistic
pnpm run e2e:active-components
pnpm run docker:preprod:down
```

Se si usano credenziali Binance reali nei flow locali, passarle solo come variabili di processo temporanee, ad esempio `BINANCE_TEST_API_KEY` e `BINANCE_TEST_API_SECRET`, mai in file tracciati.

Smoke browser manuale:

1. Pulire cookies/cache o usare un profilo browser pulito.
2. Login.
3. Attendere che main dashboard sia visibile.
4. Eseguire:

```js
window.morganFinanceCoherenceDiagnostics?.()
```

5. Navigare:
   - dashboard
   - checking
   - investment
   - crypto
   - binance
   - home
   - dashboard
   - crypto
   - investment

6. Osservare:
   - `0,00` finti;
   - `--` visibili;
   - mismatch topbar/card/detail row;
   - mismatch punto chart di oggi;
   - riordino provider tab dopo navigazione;
   - Binance sync avviata solo perche' e' stata aperta una dashboard.

7. Check F5/direct reload:
   - dashboard;
   - checking;
   - investment;
   - crypto;
   - Binance.

8. Check degradati quando possibile:
   - rete lenta mantiene gli ultimi valori committed;
   - quote mancante appare in diagnostica;
   - 401/session expiry non sembra un portfolio vuoto.

## Protocollo Smoke Binance Reale

Usare credenziali Binance reali solo quando serve verificare saldi account/comportamento current wallet.

Regole:

- usare solo API key temporanee read-only;
- nessun permesso trading, withdrawal o transfer;
- non committare credenziali, screenshot con segreti, snippet di shell history o file `.env`;
- preferire inserimento manuale nell'app o variabili d'ambiente di processo per E2E locali;
- revocare la key dopo lo smoke;
- catturare diagnostica e comportamento visibile, mai valori secret.

Per uno smoke real-Binance coherence, catturare:

- `window.morganFinanceCoherenceDiagnostics?.()`;
- totali visibili topbar/card/detail-row tra main, crypto e Binance;
- se `visibleSnapshotId` resta stabile mentre si cambia dashboard;
- se un refresh successivo cambia `visibleSnapshotId` e totali insieme;
- se la dashboard navigation da sola avvia current sync.

## Memo Binance

Questa e' la memoria storica che piu' probabilmente servira' in futuro.

### Current Sync

- Binance current sync legge i saldi account correnti dalla signed Binance API.
- Le credenziali sono salvate cifrate tramite `MORGAN_ENCRYPTION_KEY`.
- I saldi correnti persistiti vivono per profilo in `BinanceBalance`.
- `BinanceBalance` oggi rappresenta il current material set usato dalla UI veloce, non un archivio storico completo del conto.
- Il current sync puo' filtrare/persistire solo token materiali `> 0,49 EUR`, perche' l'obiettivo del connect e' mostrare rapidamente un riepilogo utile senza rallentare su dust.
- I saldi correnti non sono verita' storica transazionale; sono uno snapshot corrente/materiale del wallet.
- La dashboard navigation non deve possedere la current sync.
- Settings connect/sync e gli owner orchestrati possono aggiornare i saldi correnti.
- Se current sync fallisce, mantenere visibile l'ultima valuation committed e pubblicare diagnostica.
- Dopo sync/update/delete credenziali Binance, invalidare la cache profilo server-side per evitare payload Binance/dashboard/crypto stale entro TTL.
- Dopo connect, persistere il `binanceRefreshKey` client-side: il reload immediato deve continuare a leggere la versione Binance appena sincronizzata, non una vecchia cache `binance:0` prodotta prima delle credenziali.
- In Settings, `API ONLY` cancella solo le credenziali cifrate e lascia i dati Binance raccolti. `API + DATA` cancella anche current balances, storico daily snapshot, marker cache di sync e stage snapshot/cache per quel profilo.
- Il comando `DATA` deve restare disponibile anche senza API salvate: serve a ripulire residui dopo una delete incompleta o dopo un precedente `API ONLY`.

Primo connect Binance target:

```text
utente clicca Connect Binance API
-> salva credenziali
-> sync saldi correnti
-> filtra token materiali > 0,49 EUR
-> prezza token materiali
-> costruisce/committa current valuation
-> mostra Connected + riepilogo coerente
```

Tecnicalmente puo' usare piu' chiamate interne e parallelismo, ma lato prodotto deve sembrare un unico ciclo coerente. Non mostrare "Connected!" come stato finale se la UI current non ha ancora una valuation pronta o uno stato esplicito.

Se il sync trova token ma nessuno supera la soglia materiale o nessuno ha quote disponibili, mostrare uno stato esplicito, ad esempio "token trovati, nessun saldo materiale da mostrare", non una dashboard vuota.

Bug storico chiuso il 2026-06-03:

```text
Connect salvava 9 token e committava valuation su binanceRefreshKey=1
reload riportava binanceRefreshKey a 0
la dashboard leggeva una vecchia cache binance:0 vuota
risultato: "No material balances" falso
fix: persistere binanceRefreshKey e rafforzare E2E su chart/stato esplicito
```

Owner current sync:

- cold boot/F5 per profilo attivo;
- selezione profilo;
- completamento import quando rilevante;
- connect/sync/delete Binance esplicito;
- focus/reconnect;
- daily rollover;
- active-profile live ticker.

Non-owner:

- cambio tab/dashboard;
- mount Binance dashboard;
- hidden dashboard warmup;
- render detail row.

### Current Pricing

- Le quantita' Binance balance sono prezzate con live quote keys nello stesso percorso current valuation delle altre crypto.
- Le detail row dei token Binance devono preferire committed valuation asset values quando esiste un committed snapshot.
- Un token Binance materiale senza live quote mantiene Binance/crypto/heritage pending finche' la quote non viene tentata.
- Se una quote e' stata tentata ed e' unavailable, la unavailable key e' diagnostica e il token viene escluso dai ready totals invece di diventare zero finto.
- I saldi Binance tiny/non-material sono ignorati.

### Binance Storico

Lo storico Binance resta intenzionalmente separato dalla current valuation coherence.

Il percorso target e' un job server-side schedulato, non una responsabilita' del browser:

```text
Vercel Cron 0 23 * * * UTC
-> profili con credenziali Binance valide
-> sync signed account completo
-> salva snapshot giornaliero completo: dust, locked, zero-value, token non materiali
-> usa quello storico per chart/backfill
-> non pubblica valori current parziali nelle dashboard
```

Decisione operativa:

- `dateKey` e' calcolato in `Europe/Rome`, quindi il job resta legato al giorno italiano anche se Vercel Cron usa UTC.
- L'endpoint cron e' `/api/cron/binance-daily-snapshot`.
- La chiamata deve avere header `Authorization: Bearer ${CRON_SECRET}`.
- Lo snapshot e' idempotente: una sola riga per `userId + dateKey`; se esiste, il job non richiama Binance per quel profilo.
- Lo storico salva tutto quello che Binance restituisce con saldo positivo, anche se sotto `0,49 EUR`.
- La UI current continua a usare `BinanceBalance` filtrato/materiale e committed valuation snapshot.
- Lo storico daily snapshot e' considerato dato Binance del profilo: deve essere eliminato da Settings quando l'utente sceglie `API + DATA`/`DATA`, ma non quando sceglie `API ONLY`.

Non risolvere Binance history riusando current sync come se fosse un ledger storico. Il lavoro futuro su Binance history deve decidere:

- se importare trade/depositi/prelievi Binance come transazioni;
- se salvare daily balance snapshots;
- come marcare la provenienza: transazione importata, saldo sincronizzato, snapshot derivato;
- se lo storico Binance debba influenzare la chart history prima della prima data di snapshot affidabile;
- come evitare double counting tra crypto Trade Republic e saldi wallet Binance;
- come fare backfill senza causare current dashboard sync o churn dei valori visibili.

Finche' questo design non esiste, Binance corrente va trattato come:

```text
saldo wallet corrente + live quote pricing
```

non come:

```text
ledger storico completo del portfolio Binance
```

## Decisioni Storiche

- Tenere le trasformazioni chart storiche separate dai current valuation selector.
- Trattare il punto chart corrente di oggi come overlay selector dalla current valuation quando possibile.
- Tenere dashboard stage snapshots keyed per data/versione.
- Tenere gli stage non-Binance keyed per giorno UTC.
- Trattare la cache stage Binance come live/current, non come verita' storica giornaliera.
- Tenere i profili inattivi fuori dal ticker live corto dell'attivo, a meno che i requisiti prodotto cambino.
- Tenere Binance current sync veloce e materiale: filtra per UI current, non per storico.
- Tenere Binance storico come job/snapshot completo separato: salva tutto, inclusi dust e locked.
- Considerare Home/topbar/card/detail come superfici dello stesso committed snapshot, non come calcoli dashboard-local.
- Preferire stale-while-refresh allo skeleton dopo che esiste un committed snapshot.
- Preferire nessun valore visibile a un valore numerico disonesto.
- Usare la diagnostica per spiegare valori missing/unavailable invece di nasconderne la causa.

## Guardrail Per Modifiche Future

- Tenere piccoli i cambi intorno alla valuation orchestration.
- Aggiungere/aggiornare test prima di cambiare il comportamento di snapshot publish.
- Se una nuova feature ha bisogno di valori monetari correnti, aggiungere un selector dal valuation store invece di ricomputare localmente.
- Se una nuova feature ha bisogno di dati storici, tenerla nella logica domain chart/time-series, non nella current valuation.
- Se si aggiunge un comportamento Binance, classificarlo prima: current sync, live pricing o historical ledger.
- Dopo ogni slice significativo, eseguire almeno lint, typecheck, test rilevanti e build.

## Puntatore Archivio

Questo file prima conteneva un lungo diario cronologico di implementazione. Le decisioni utili sono state assorbite in `Problemi Risolti`, `Decisioni Storiche` e `Memo Binance`.

Non considerare autorevole la memoria di vecchie conversazioni se contraddice questo checkpoint. Questo checkpoint e' il contratto di memoria corrente.
