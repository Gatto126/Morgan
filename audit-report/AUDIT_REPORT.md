# Morgan Finance - Audit Report

Data audit: 2026-05-28
Repository: `C:\Users\Lucaa\Desktop\morgan`
Ambiente: Windows, PowerShell, Node 22, pnpm, Next dev server locale su `http://127.0.0.1:3000`

Le credenziali Binance fornite per il test live sono state usate solo in memoria/process env del comando di audit. Non sono state scritte nel report, in file sorgente, in commit o in file tracciati.

## Executive Summary

Morgan Finance ha una base tecnica complessivamente solida per un'app finance local-first: le API proteggono i profili con owner check, le mutazioni applicano same-origin check, le credenziali Binance sono cifrate con AES-256-GCM, gli import deduplicano tramite fingerprint e la suite automatica principale passa.

Il flusso Binance live e' stato testato con successo: salvataggio credenziali, verifica cifratura at-rest, sync live, lettura saldi e rimozione credenziali. La sync ha risposto `200`, `success=true`, con 94 saldi/token restituiti. Dopo il cleanup non restavano utenti, profili, transazioni, righe Binance o credenziali cifrate dell'audit.

Le priorita' principali restano:

1. correggere l'overflow orizzontale responsive, presente sia desktop sia mobile;
2. allineare l'infrastruttura cloud prevista nei documenti con una vera persistenza Postgres prima di qualsiasi deploy pubblico;
3. rendere persistenti/distribuiti i rate limit custom e irrigidire la gestione IP in produzione.

Aggiornamento post-fix 2026-05-28:

- l'import accetta ora `balanceCents` firmato mantenendo `amountCents` non negativo;
- il parser/test BBVA copre un saldo disponibile negativo;
- lo smoke `upload-panel` aspetta un segnale esplicito di idratazione (`data-auth-shell-ready=true`) prima del click iniziale.

## Stack E Infrastruttura Rilevati

Stack applicativo installato/eseguito:

- Next.js 15.5.18 App Router
- React 19
- TypeScript strict
- Prisma 6.x con SQLite e `better-sqlite3`
- Better Auth con plugin username e cookie Next
- Tailwind CSS 4
- Recharts per dashboard
- Playwright per smoke/browser test
- Integrazioni esterne: Binance REST/SAPI, JustETF WebSocket/scraping

Persistenza attuale:

- `SQLITE_DATABASE_URL` locale, risolto sotto `prisma/dev.db`
- WAL SQLite abilitato in `src/lib/db.ts`
- timeout SQLite a 15 secondi
- `.env`, DB, WAL/SHM, log, `.next` e `test-results` ignorati da Git

Configurazione ambiente verificata in forma redatta:

| Variabile | Stato |
| --- | --- |
| `SQLITE_DATABASE_URL` | impostata |
| `MORGAN_ENCRYPTION_KEY` | valida, 32 byte base64 |
| `BETTER_AUTH_SECRET` | impostata |
| `BETTER_AUTH_URL` | `http://localhost:3000` in locale |
| `BETTER_AUTH_TRUSTED_ORIGINS` | 3 origin locali |
| `BETTER_AUTH_IP_HEADERS` | non impostata |

Target infrastrutturali documentati:

- cloud production: Vercel Hobby + Neon Postgres;
- pre-produzione: Vercel Preview/Docker + Postgres/Neon branch;
- desktop offline: Tauri + WebView2 + SQLite locale.

Nota: il codice corrente e' ancora cablato su datasource Prisma SQLite. La strategia cloud/Postgres e' documentata, ma non ancora implementata nella repo corrente.

## Scope Eseguito

- Review statica di auth, API route, sicurezza request, gestione segreti, import, dashboard, Binance service, schema Prisma e configurazione Next.
- Verifica `.env` redatta e `.gitignore`.
- Test automatici: lint, unit test, type-check, build, dependency audit, outdated.
- Smoke ufficiale upload/settings/profile.
- Smoke e2e HTTP con cookie jar isolato:
  - richieste senza sessione;
  - registrazione account locale temporaneo;
  - profilo senza transazioni;
  - profilo con transazioni importate;
  - deduplica import;
  - endpoint dashboard/checking/investment/crypto/prices;
  - salvataggio, sync live, rimozione credenziali Binance;
  - cancellazione account e verifica cleanup DB.
- Smoke cross-owner:
  - profilo reale con transazioni;
  - accesso no-auth su ID reale;
  - accesso da secondo account autenticato ma non owner;
  - restore dei rate limit dopo test.
- Smoke UI responsive:
  - viewport desktop 1440x900;
  - viewport mobile 390x844;
  - misurazione scroll width e controlli offscreen;
  - controllo errori console;
  - screenshot salvati in `test-results/` (ignorato da Git).
- Secret scan locale sulle credenziali fornite: nessun match nei file della repo esclusi `.git` e `node_modules`.

## Risultati Automatici

| Controllo | Esito |
| --- | --- |
| `pnpm run lint` | OK |
| `pnpm run test:run` | OK, 17 file / 74 test |
| `pnpm exec tsc --noEmit` | OK |
| `pnpm run build` | OK, build Next completata |
| `pnpm audit --prod` | OK, nessuna vulnerabilita' nota |
| `pnpm outdated` | Warning informativo, diverse major/minor disponibili |
| `pnpm run smoke:upload-panel` | OK dopo fix idratazione |

Dipendenze con aggiornamenti disponibili rilevanti:

- Next 16.x
- Prisma 7.x
- Zod 4.x
- TypeScript 6.x
- ESLint 10.x
- `better-sqlite3` 12.x
- `lucide-react` 1.x

Nessuno di questi e' emerso come vulnerabilita' da `pnpm audit --prod`; sono aggiornamenti da pianificare, non emergenze immediate.

## Test Auth, Profili E Dati

### No-auth

Su richieste senza sessione:

| Endpoint | Esito atteso | Esito |
| --- | ---: | ---: |
| `GET /api/users` | 401 | 401 |
| `GET /api/transactions/dashboard?userId=...` | 401 | 401 |
| `GET /api/prices?cryptos=BTC` | 401 | 401 |
| `POST /api/binance/sync` senza `Origin` | 403 | 403 |
| `POST /api/binance/sync` same-origin senza cookie | 401 | 401 |

Su ID reale di un profilo temporaneo con transazioni:

| Endpoint | Esito |
| --- | ---: |
| `GET /api/transactions/dashboard?userId=<profilo reale>` senza cookie | 401 |
| `GET /api/binance/balances?userId=<profilo reale>` senza cookie | 401 |
| `POST /api/binance/sync` same-origin senza cookie | 401 |

### Auth con profilo senza transazioni

Profilo temporaneo vuoto:

- `transactionCount=0`
- `GET /api/transactions/dashboard` OK
- `GET /api/transactions/checking` OK
- `GET /api/transactions/investment` OK
- `GET /api/transactions/crypto` OK
- `GET /api/binance/balances` OK con `hasApiKey=false` e `balances=[]`
- `POST /api/binance/sync` senza credenziali OK come rifiuto controllato: `400`

### Auth con profilo con transazioni

Profilo temporaneo con due transazioni checking BBVA importate via API:

- primo import: `insertedCount=2`, `skippedCount=0`;
- secondo import dello stesso payload: `insertedCount=0`, `skippedCount=2`;
- `transactionCount=2`, `checkingCount=2`;
- dashboard checking totale: `210000` centesimi, coerente con 2500.00 EUR in entrata e 400.00 EUR in uscita;
- endpoint checking/investment/crypto e prices: OK.

### Cross-owner

Secondo account autenticato non owner su profilo reale del primo account:

| Endpoint | Esito |
| --- | ---: |
| `GET /api/users/<profileId>` | 404 |
| `GET /api/transactions/dashboard?userId=<profileId>` | 404 |
| `PATCH /api/users/<profileId>` | 404 |

Questo evita enumerazione utile e impedisce lettura/modifica cross-account.

## Test Binance Live

Sequenza eseguita su profilo temporaneo:

1. `PATCH /api/users/<id>` con API key e secret.
2. Verifica risposta: nessuna credenziale raw restituita.
3. Verifica DB: campi cifrati presenti con prefisso formato `v1`, nessuna credenziale raw nella riga profilo.
4. `GET /api/binance/balances`: `hasApiKey=true`.
5. `POST /api/binance/sync`: `200`, `success=true`, 94 saldi/token.
6. `PATCH /api/users/<id>` con `apiKey=null`, `apiSecret=null`, `deleteBalances=true`.
7. Verifica risposta: `hasBinanceCredentials=false`.
8. `DELETE /api/account` con password.
9. Verifica cleanup DB: 0 auth users, 0 profili, 0 righe credenziali, 0 checking rows, 0 Binance rows per l'audit.

Osservazioni:

- Il flusso applicativo live funziona.
- Le credenziali vengono cifrate prima della persistenza.
- Le route non espongono secret raw.
- La sync cancella/aggiorna i saldi cached tramite la path condivisa del servizio.
- La chiamata live dipende dai permessi Binance associati alla key; in questo test i permessi sono risultati sufficienti.

## Analisi Sicurezza

Punti positivi:

- `requireAuth` e `requireOwnedProfile` proteggono le route dati utente.
- Le mutazioni app usano `requireSameOriginMutation`.
- Better Auth usa rate limit database-backed per sign-in/sign-up e password operations.
- Password locali nuove: 15-128 caratteri, spazi/simboli ammessi.
- Cancellazione account richiede password server-side.
- Credenziali Binance cifrate con AES-256-GCM.
- Nessun fallback plaintext Binance nel codice corrente.
- API responses usano `toSafeUser`/summary senza secret raw.
- Header difensivi Next: `nosniff`, `DENY`, `COOP`, `Permissions-Policy`, `base-uri`, `frame-ancestors`, `object-src`.
- Upload limitato a 8 MB e a estensioni `.csv`/`.xlsx`.
- Import deduplicato con fingerprint e vincoli unique Prisma.

Rischi residui:

- I rate limit custom di `/api/prices` e account delete sono `Map` in memoria. Vanno bene per sviluppo/single process, ma non sono affidabili in multi-instance/serverless.
- In produzione `getIpAddressHeaders` cade su `x-forwarded-for` se `BETTER_AUTH_IP_HEADERS` non e' configurato. C'e' un warning, ma il comportamento resta permissivo.
- La CSP e' minima: protegge frame/object/base-uri, ma non restringe `script-src`, `style-src` o `connect-src`. Un hardening CSP completo richiede lavoro specifico con Next.
- La key di cifratura locale e il DB vivono sullo stesso host. Per local-first e' accettabile, ma backup e deployment pubblici devono usare secret manager e backup cifrati.
- Binance sync usa chiamate SAPI parallele con peso elevato e non imposta `recvWindow`; clock drift o rate limit Binance possono causare failure operativi.

## Analisi Infrastruttura

Stato attuale:

- Buono per sviluppo locale e desktop/offline prototipale.
- SQLite WAL e timeout migliorano concorrenza locale.
- Build Next produce route dinamiche server-side.
- Test suite rapida e utile, ma ancora principalmente unit/integration leggera.

Gap rispetto al target cloud:

- Il datasource Prisma e' SQLite, mentre i documenti indicano Neon Postgres per cloud.
- Non esiste ancora uno storage boundary/repository concreto per separare web/Postgres e desktop/SQLite.
- Rate limit custom non sono condivisi tra istanze.
- Log e DB locali non sono una strategia di osservabilita'/backup cloud.
- Deploy pubblico richiede HTTPS, trusted origins esatti, IP headers affidabili e secret manager.

Valutazione:

- Local desktop/private self-host: adatto con attenzione a backup e protezione filesystem.
- Public cloud oggi: non pronto senza migrazione Postgres, rate limit distribuiti e revisione config produzione.

## Findings Prioritari

### P1 - Overflow orizzontale responsive su desktop e mobile

Evidenza smoke UI con account temporaneo e transazioni:

- desktop 1440x900: `innerWidth=1440`, `documentElement.scrollWidth=1556`;
- mobile 390x844: `innerWidth=390`, `documentElement.scrollWidth=448`;
- elementi offscreen mobile rilevati:
  - bottone/card valore `1050,00 EUR`, `left=283`, `right=448`, `width=165`;
  - card provider BBVA, `left=283`, `right=448`, `width=165`.

File/aree interessate:

- `src/components/finance-shell.tsx`
- `src/components/dashboard/dashboard-tabs.tsx`
- `src/components/checking-dashboard/checking-dashboard-tabs.tsx`
- `src/components/dashboard/dashboard-cards.tsx`

Impatto:

- su mobile alcuni controlli/dati finiscono fuori viewport;
- su desktop appare overflow orizzontale non desiderato;
- in un'app finanziaria questo riduce leggibilita' e fiducia.

Raccomandazione:

- contenere i tab/card portal dentro scroll container espliciti con max-width 100%;
- evitare card `w-[165px]` non compensate dal container;
- aggiungere test Playwright che fallisce se `scrollWidth > innerWidth + 1`;
- coprire almeno 390x844, 768x1024, 1440x900.

### P1 - L'import rifiuta saldi conto negativi - RISOLTO

Evidenza originaria:

- `src/lib/transaction-preview.ts` validava `balanceCents` con `.nonnegative()`;
- `src/lib/bbva-xlsx-parser.ts` puo' produrre saldi firmati dal foglio.

Stato attuale:

- `balanceCents` e' ora `z.number().int()`;
- `amountCents` resta `z.number().int().nonnegative()`;
- `src/lib/transaction-preview.test.ts` copre payload importabile con saldo negativo e rifiuto di importo movimento negativo;
- `src/lib/bbva-xlsx-parser.test.ts` copre un saldo BBVA negativo.

### P2 - Produzione: header IP e rate limit custom non sufficienti

Evidenza:

- `.env` locale non imposta `BETTER_AUTH_IP_HEADERS`;
- `getIpAddressHeaders` usa fallback `x-forwarded-for`;
- `/api/prices` e delete account usano Map in memoria.

Impatto:

- in deploy pubblico, client/proxy non fidati possono influire sull'identita' IP se la catena proxy non sanitizza gli header;
- rate limit custom si azzerano al restart e non sono condivisi tra istanze.

Raccomandazione:

- in produzione rendere obbligatorio `BETTER_AUTH_IP_HEADERS`;
- usare solo header garantiti dal provider, per esempio `cf-connecting-ip` su Cloudflare;
- spostare rate limit custom su DB/Redis/KV condiviso.

### P2 - Strategia cloud documentata ma non ancora implementata

Evidenza:

- `docs/architecture/targets.md` indica Vercel + Neon Postgres per cloud;
- `prisma/schema.prisma` usa ancora datasource SQLite;
- `src/lib/db.ts` risolve path file locale.

Impatto:

- un deploy Vercel con SQLite locale non sarebbe durable o affidabile;
- rischio di divergenza fra desktop/offline e cloud se la migrazione viene rinviata troppo.

Raccomandazione:

- introdurre schema/config Postgres per web;
- creare adapter/repository minimi per i workflow persistence-heavy;
- aggiungere test pre-prod con Postgres prima del deploy cloud.

### P3 - Smoke upload-panel ha una race di idratazione a freddo - RISOLTO

Evidenza originaria:

- primo `pnpm run smoke:upload-panel` fallito: Register visibile ma click non apriva il form;
- riproduzione manuale: click immediato dopo `domcontentloaded` non cambia vista;
- aspettando idratazione il form appare.

Stato attuale:

- `src/components/auth-shell.tsx` espone `data-auth-shell-ready=true` dopo idratazione client;
- `scripts/smoke-upload-panel.mjs` aspetta quel segnale prima del click su Register;
- `pnpm run smoke:upload-panel` passa.

### P3 - CSP migliorabile

Evidenza:

- `next.config.ts` definisce CSP solo per `base-uri`, `frame-ancestors` e `object-src`.

Impatto:

- protezione anti-XSS parziale;
- utile ma non ancora una CSP restrittiva.

Raccomandazione:

- valutare CSP con `script-src`, `style-src`, `connect-src`, `img-src`;
- includere domini necessari: self, Binance, JustETF/WebSocket;
- testare in report-only prima di enforcement.

### P3 - Test coverage API ancora incompleta

Copertura esistente buona:

- auth config, request security, secrets, Binance service/routes, price request, parsers, dashboard data helpers, account delete.

Gap:

- route dashboard/checking/investment/crypto con fixture DB;
- ownership cross-account automatizzata in test suite, oggi coperta da smoke custom;
- responsive overflow come regression test;
- import con saldo negativo.

## Cose Che Funzionano Bene

- Auth guard e ownership coerenti.
- Same-origin check sulle mutazioni.
- Binance connect/sync centralizzati in `syncBinanceBalances`.
- Cifratura secret robusta con AES-GCM e IV random.
- API user response sicure.
- Account delete protetta da password.
- Deduplica import funzionante.
- Build/type/lint/test puliti.
- Flusso Binance live verificato end-to-end.
- Cleanup dati audit riuscito.

## Raccomandazioni Operative

Priorita' immediata:

1. Fix overflow responsive e aggiungere test `scrollWidth`.
2. Mantenere in CI lo smoke `upload-panel` ora stabilizzato.

Prima di deploy pubblico:

1. Implementare Postgres/Neon per web cloud.
2. Rendere obbligatori IP headers espliciti in produzione.
3. Spostare rate limit custom su storage condiviso.
4. Configurare HTTPS origin esatti e secret manager.
5. Pianificare CSP restrittiva in report-only.

Hardening successivo:

1. Aggiungere MFA/passkey.
2. Aggiungere audit log applicativo redatto per operazioni critiche.
3. Aggiungere backup/export cifrati per desktop/local-first.
4. Aggiungere `recvWindow`, backoff e reporting parziale permessi nel client Binance.

## Note Di Cleanup

- Account temporanei creati durante l'audit: cancellati.
- Profili e transazioni temporanee: cancellati.
- Credenziali Binance temporanee: rimosse.
- Righe BinanceBalance temporanee: rimosse.
- Rate limit temporaneamente svuotati in uno smoke cross-owner: ripristinati.
- Secret scan sulle credenziali fornite: nessun match nei file della repo.
