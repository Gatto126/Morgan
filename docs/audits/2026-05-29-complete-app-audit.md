# Audit Completo Applicazione

Data: 2026-05-29

Stato: audit completo su repository locale

## Ambito

Questo audit ha coperto i file tracciati che compongono l'applicazione Morgan:
codice `src/`, test, script, Prisma, configurazioni, Docker, CI e
documentazione. Sono stati esclusi i contenuti generati o vendorizzati
(`node_modules/`, `.next/`, `artifacts/`, database locali e build output).

Snapshot repository tracciato:

| Area | File | Linee |
| --- | ---: | ---: |
| `src/` | 185 | 17.417 |
| `tests/` | 51 | 3.956 |
| `scripts/` | 13 | 2.856 |
| `docs/` | 11 | 1.212 |
| `prisma/` | 5 | 760 |
| `.github/` | 2 | 132 |
| Root config/docs | 24 | 5.223 |
| Totale | 291 | 31.556 |

Stack installato nel workspace:

- Next.js 15.5.18, React 19.2.6, TypeScript 5.9.3.
- Prisma 6.19.3 con schema Postgres attivo e schema SQLite scaffold.
- Better Auth 1.6.11 per account locali.
- Tailwind CSS 4.3.0, Recharts 3.8.1, lucide-react 0.511.0.
- Vitest 4.1.7 e Playwright 1.60.0 per test e browser flow.

## Esito Sintetico

L'app e' in buono stato tecnico per un prodotto personale/local-first in fase
pre-release. Il codice compila, i test passano, la build Next produce un
artefatto valido e lo schema Postgres e' allineato alle migrazioni. La struttura
e' molto migliorata rispetto agli audit precedenti: il vecchio catch-all
`src/lib` non esiste piu', i test sono fuori da `src/`, le route principali sono
thin handler sopra service/repository e ci sono regole ESLint per proteggere i
confini.

I rischi principali non sono di "app rotta", ma di robustezza operativa e
hardening:

- alcune protezioni custom sono in memoria e non distribuite;
- import e refresh prezzi dipendono da provider esterni senza timeout uniforme
  o queue robusta;
- lo scaffold SQLite e' valido, ma non e' ancora un runtime desktop completo;
- alcune configurazioni residuali puntano a vecchi alias;
- la security posture e' buona per uso privato, ma va irrigidita prima di una
  esposizione pubblica piu' ampia.

## Verifiche Eseguite

| Comando | Esito |
| --- | --- |
| `pnpm run lint` | Pass |
| `pnpm run typecheck` | Pass |
| `pnpm run typecheck:test` | Pass |
| `pnpm run test:run` | Pass, 51 file e 200 test |
| `pnpm exec prisma validate --schema=prisma/schema.prisma` | Pass |
| `pnpm exec prisma validate --schema=prisma/sqlite/schema.prisma` | Fail iniziale per env mancante |
| `SQLITE_DATABASE_URL=file:./prisma/sqlite/audit.db prisma validate` | Pass |
| `pnpm audit --prod` | Pass, nessuna vulnerabilita' nota |
| `pnpm run build` | Pass |
| `docker compose config --quiet` | Pass |
| `git status --short --branch` | Pulito su `main...origin/main` |

Nota SQLite: il primo fail e' dovuto alla `.env` locale priva di
`SQLITE_DATABASE_URL`. Lo schema e' valido quando la variabile viene fornita.

Build Next:

- `/` pesa 170 kB, First Load JS 272 kB.
- Shared First Load JS: 102 kB.
- Tutte le route API risultano dinamiche, come atteso.

Dipendenze:

- `pnpm audit --prod` non segnala vulnerabilita' note.
- `pnpm outdated` segnala major disponibili per Next 16, Prisma 7, Zod 4,
  TypeScript 6, ESLint 10 e lucide-react 1.x. Non e' un problema immediato,
  ma va pianificato perche' Prisma 7 e Next 16 sono upgrade con potenziali
  cambiamenti operativi.

## Architettura

### Punti Forti

- Confini chiari:
  - `src/domain/` contiene logica pura di import, pricing e calcoli finance.
  - `src/integrations/` contiene Binance e JustETF.
  - `src/server/` contiene auth, security, logging, service e repository.
  - `src/components/` contiene UI e hook client.
- Le regole ESLint bloccano import server/db da UI, import Next/React/Prisma da
  dominio condiviso e import Prisma diretto da route/service.
- Le route API principali usano service/repository invece di query Prisma
  inline.
- Better Auth e Prisma sono confinati nel runtime server.
- Il target Postgres e lo scaffold SQLite sono documentati separatamente.

### Stato Per Target

| Target | Stato |
| --- | --- |
| Web locale Next/Postgres | Funzionante |
| Docker pre-prod/Postgres | Config valido |
| Vercel/Neon | Documentato e buildabile |
| Desktop/SQLite | Solo scaffold, non runtime reale |

### Rischio Residuo Architetturale

`src/integrations/justetf/justetf-parser.ts` importa `apiLogger` da
`src/server/logging/logger.ts`. Questo non rompe l'app web, ma rende
l'integrazione meno riusabile nel futuro desktop/offline. La direzione migliore
e' iniettare logger e fetcher, come gia' avviene in parte su Binance.

## Sicurezza

### Punti Forti

- `.env` e `.env.*` reali sono ignorati; solo gli example sono tracciati.
- Non risultano database, log, `.next`, `artifacts` o `.tsbuildinfo` tracciati.
- Binance API key e secret sono cifrati con AES-256-GCM tramite
  `MORGAN_ENCRYPTION_KEY`.
- Le response user usano `toSafeUser` e non espongono segreti cifrati.
- Le mutazioni custom verificano Origin/Referer con `requireSameOriginMutation`.
- Better Auth usa rate limit DB-backed per sign-in/sign-up e verifica password.
- Logging centralizzato con redazione per chiavi sensibili e valori secret-like.
- Header di base: nosniff, referrer policy, frame deny, COOP, permissions
  policy, CSP minima e HSTS in produzione.

### Rischi

| Priorita' | Area | Rischio | File |
| --- | --- | --- | --- |
| P2 | Upload import | `request.formData()` viene parsato prima di autenticare il profilo. La dimensione e' limitata a 8 MB dopo il parse, quindi un attore con browser/sessione non valida ma Origin valido puo' consumare lavoro server prima dell'auth. | `src/app/api/transactions/preview/route.ts:24-73` |
| P2 | Rate limit custom | Price refresh e delete-account failed attempts usano `Map` in memoria. In serverless/multi-instance il limite non e' condiviso e si resetta su cold start. | `src/server/services/price-refresh.ts:37-67`, `src/app/api/account/route.ts:17-35` |
| P3 | Asset history | `/api/assets/[isin]/history` richiede solo account autenticato, non profilo. Il dato e' market data globale, ma puo' rivelare quali asset hanno storico nel DB condiviso. | `src/app/api/assets/[isin]/history/route.ts:13-20` |
| P3 | CSP | La CSP blocca object/frame/base-uri, ma non definisce ancora `default-src`, `script-src`, `connect-src`, `img-src` o `style-src`. Per uso privato e' accettabile; per esposizione pubblica va rafforzata con attenzione a Next. | `next.config.ts:3-10` |

## Import, Dati E Finanza

### Punti Forti

- Parser Trade Republic CSV robusto: header obbligatori, duplicati,
  transazioni zero non supportate, valute non EUR, importi al centesimo e
  direzione BUY/SELL sono validati.
- Parser BBVA XLSX abbastanza difensivo: ricerca header, date italiane,
  numeri localizzati, righe vuote e fingerprint deterministico.
- Import preview separa parsing, deduplica, approvazione e persistenza.
- Doppia entry per investimenti/crypto crea lato cash collegato con id esplicito.
- Unique constraint per `userId + fingerprint` sui tre tipi transazione.
- Serie storiche checking, portfolio e dashboard sono testate con unit test.

### Rischi

| Priorita' | Area | Rischio | File |
| --- | --- | --- | --- |
| P2 | Provider esterni in import | Durante l'import, ISIN e token mancanti vengono arricchiti con `Promise.all` senza limite esplicito per batch e senza timeout uniforme su JustETF/Binance history. Un file con molti asset puo' rendere lenta o fragile la request. | `src/server/services/transaction-import.ts:203-283` |
| P2 | Timeout esterni | JustETF metadata/history e Binance klines storici non usano `AbortSignal.timeout`; i prezzi live invece si'. | `src/integrations/justetf/justetf-parser.ts:98-106`, `src/integrations/binance/binance-parser.ts:9-18` |
| P3 | Race import | La deduplica controlla fingerprint prima della create. Due import concorrenti dello stesso file possono ancora arrivare alla unique constraint e fallire l'intero batch. | `src/server/repositories/transaction-import-repository.ts` |
| P3 | Precisione finanziaria | Quantita' e prezzi usano `Float`/`number`, adeguato per dashboard personale ma non per contabilita' precisa o riconciliazione fiscale. | `prisma/schema.prisma`, dominio finance |

## UI E UX

### Punti Forti

- La UI e' molto piu' modulare di quanto indicato dal vecchio audit: shell,
  overlay, navigazione, import, dashboard e chart sono divisi in hook e
  componenti dedicati.
- Auth shell e finance shell hanno stati di loading/restore e attributi usati
  dagli smoke test.
- Le dashboard condividono primitive chart e modelli testabili.
- Il flusso import ha preview, paginazione, stato saved/existing/new e refresh
  delle dashboard.
- Le azioni sensibili lato client non gestiscono segreti persistenti: le API key
  Binance sono inviate al server e poi pulite dagli input.

### Rischi

| Priorita' | Area | Rischio | File |
| --- | --- | --- | --- |
| P3 | Tooling UI | `components.json` punta ancora a `@/lib/utils` e `@/lib`, ma `src/lib` non esiste piu'. Nuove generazioni shadcn rischiano import sbagliati. | `components.json:13-18` |
| P3 | Bundle | La pagina principale ha First Load JS 272 kB. E' accettabile ora, ma dashboard/chart e auth vivono nello stesso first screen; quando il prodotto cresce conviene valutare lazy load per dashboard pesanti. | build output |
| P4 | Duplicazione pattern dashboard | Alcuni pattern tra dashboard checking/portfolio/binance sono simili ma non ancora completamente unificati. Non e' critico, pero' puo' aumentare il costo dei refactor UI. | `src/components/*dashboard*` |

## Database E Persistenza

### Punti Forti

- Schema Postgres valido e migrazione iniziale tracciata.
- Indici principali presenti: owner, user/date, user/fingerprint, user/isin,
  user/token, AssetHistory per isin/date.
- Cascate su owner/profile/transazioni coerenti.
- Repository layer isola Prisma dal grosso dei service.
- Account delete esegue cleanup scoped/full per asset condivisi tra profili.
- SQLite schema valido quando viene fornita `SQLITE_DATABASE_URL`.

### Rischi

| Priorita' | Area | Rischio | File |
| --- | --- | --- | --- |
| P2 | Desktop SQLite | Lo schema SQLite e' solo scaffold: non ci sono migrazioni SQLite, adapter desktop, test adapter o runtime Tauri. | `prisma/sqlite/schema.prisma`, docs desktop |
| P3 | Prisma client provider | Generare il client SQLite sostituisce il client del workspace; serve rigenerare Postgres prima di tornare al web. Questo e' documentato, ma resta fragile. | `prisma/README.md` |
| P3 | Cache globale | `Asset`, `CryptoAsset`, `AssetHistory` e `PriceCache` sono globali, non per owner. Va bene per dedup market data, ma va trattato come cache condivisa e non come dato privato. | `prisma/schema.prisma` |

## Test E CI

### Stato

- 47 test file e 187 test passano.
- Copertura buona su:
  - parser import;
  - pricing request validation;
  - time-series finance;
  - auth locale;
  - security/config/logging/secrets;
  - repository e service principali;
  - route API account/users/binance;
  - modelli chart/helper UI.
- CI esegue lint, typecheck, typecheck test, test, Prisma validate e build.
- Workflow Docker E2E manuale copre smoke, realistic flow e active-components.

### Gap

- Non ci sono soglie di coverage.
- Gli E2E completi sono manuali, non su ogni PR.
- Mancano test adapter SQLite perche' il runtime desktop non esiste ancora.
- Non c'e' secret scanning dedicato in CI.
- Non c'e' dependency review/renovate automatizzato.

## Dipendenze E Supply Chain

### Stato

- Nessuna vulnerabilita' nota da `pnpm audit --prod`.
- Lockfile presente e `pnpm install --frozen-lockfile` usato in CI/Docker.
- `packageManager` pinna pnpm 10.8.1.

### Rischi

- Versioni con caret in `package.json` hanno portato installazioni piu' recenti
  rispetto ai numeri dichiarati inizialmente, per esempio Next 15.5.18 e Prisma
  6.19.3. Il lockfile stabilizza il workspace, ma conviene essere espliciti
  quando si fanno release.
- Major upgrade disponibili: Next 16, Prisma 7, Zod 4, TypeScript 6, ESLint 10.
  Non vanno applicati in blocco senza branch dedicato.

## Priorita' Operative

### Entro Il Prossimo Ciclo

Completato nel ciclo di remediation del 2026-05-29:

1. Auth prima del parse multipart in `/api/transactions/preview`.
2. Timeout espliciti a JustETF metadata/history e Binance klines.
3. Concorrenza limitata sugli enrichment in import.
4. Rate limit custom spostati da memoria a storage DB.
5. `components.json` riallineato alla rimozione di `src/lib`.
6. History API asset resa profile-scoped.
7. Import reso tollerante agli insert duplicati da batch concorrenti.

### Prima Di Deploy Pubblico

1. Rafforzare CSP con `default-src`, `connect-src` e policy compatibile con
   Next, JustETF/Binance e WebSocket prezzi.
2. Aggiungere secret scanning in CI.
3. Introdurre dependency review o bot di aggiornamento.
4. Rendere obbligatorio almeno uno smoke browser su preview/pre-prod prima del
   deploy.
5. Validare env di produzione con fail-fast per variabili critiche.

### Prima Del Desktop

1. Estrarre logger/fetcher dalle integrazioni per renderle target-neutral.
2. Definire adapter storage Postgres/SQLite con contratti testati.
3. Creare migrazioni SQLite dedicate.
4. Aggiungere test adapter SQLite.
5. Decidere se Prisma resta lo strato SQLite desktop o se introdurre un adapter
   piu' leggero.

## Aggiornamento Remediation

Data: 2026-05-29

P2 chiusi dopo questo audit:

- `/api/transactions/preview` esegue ora `requireAuth` prima di leggere il
  multipart con `request.formData()`.
- Gli enrichment JustETF e Binance storici usano timeout espliciti.
- L'import limita gli enrichment di mercato concorrenti a batch controllati.
- I rate limit custom per refresh prezzi e conferma password di cancellazione
  account sono ora DB-backed sulla tabella `RateLimit`, con chiavi namespaced
  `morgan:*`.

P3 quick win chiusi dopo il checkpoint:

- `components.json` punta ora a `@/shared/utils` e `@/shared`, allineato alla
  struttura corrente senza `src/lib`.
- `/api/assets/[isin]/history` richiede un `userId` di profilo posseduto e
  verifica che il profilo contenga l'asset/token richiesto prima di leggere la
  cache globale `AssetHistory`.
- L'import usa `createMany(..., skipDuplicates: true)` per transazioni e punti
  history, cosi' due batch concorrenti dello stesso contenuto non fanno fallire
  l'intero import sulla unique constraint.

Verifica finale dopo remediation:

| Comando | Esito |
| --- | --- |
| `pnpm run lint` | Pass |
| `pnpm run typecheck` | Pass |
| `pnpm run typecheck:test` | Pass |
| `pnpm run test:run` | Pass, 51 file e 200 test |
| `pnpm run build` | Pass |

## Conclusione

Morgan e' in uno stato sano: build, lint, typecheck, test, audit prod e schema
Postgres passano; la separazione interna e' coerente con la direzione
architetturale documentata. L'app e' adatta a uso locale e pre-produzione
privata.

Il lavoro piu' importante ora si sposta dal fix dei P2/P3 piccoli
all'hardening pre-deploy: CSP piu' completa, secret scanning, dependency review
o bot aggiornamenti, smoke browser in CI/pre-prod e validazione fail-fast delle
env di produzione. Il capitolo desktop/SQLite resta separato perche' richiede
migrazioni, adapter e runtime dedicati.
