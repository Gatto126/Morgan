# Morgan Finance - Audit Report

Data audit: 2026-05-27
Repository: `C:\Users\Lucaa\Desktop\morgan`
Stack rilevato: Next.js 15 App Router, React 19, TypeScript strict, Prisma + SQLite, Better Auth, Tailwind CSS 4, Vitest.

## Executive Summary

L'app e' in buono stato tecnico generale: build, type-check, lint, test unitari e audit dipendenze passano. La separazione dei profili tramite `ownerId`, l'uso di Prisma invece di SQL manuale, la cifratura AES-GCM per le credenziali Binance e i controlli su upload/import sono segnali positivi.

Le aree piu' urgenti riguardano:

1. layout mobile con overflow orizzontale e controlli parzialmente fuori viewport;
2. schema di import che rifiuta saldi conto negativi anche se il parser BBVA li puo' produrre;
3. endpoint prezzi senza limiti sulla fan-out di richieste esterne;
4. accessibilita' e isolamento dei pannelli overlay/settings;
5. hardening di autenticazione, cancellazione account e campi legacy per segreti.

## Scope Eseguito

- Mappatura repo, stack, script e stato Git.
- Review statica di API routes, auth guard, import/parsing, Prisma schema, gestione segreti, dashboard e shell UI.
- Controlli automatici: lint, test, type-check, build, dependency audit.
- Navigazione app via browser:
  - registrazione account locale temporaneo;
  - creazione profilo;
  - dashboard vuota;
  - dashboard con dati sintetici;
  - tab Dashboard, Checking, Investments;
  - Upload panel;
  - Settings, API Key, Danger Zone;
  - viewport desktop e mobile;
  - cancellazione/cleanup dell'account temporaneo.

Screenshot salvati in `test-results/audit/`, in particolare:

- `10-dashboard-viewport.png`
- `11-investments-viewport.png`
- `13-mobile-dashboard-main.png`
- `14-mobile-settings.png`
- `16-mobile-settings-menu.png`
- `17-mobile-api-key.png`
- `18-mobile-danger-zone.png`

## Verifiche Automatiche

| Controllo | Esito |
| --- | --- |
| `pnpm audit --prod` | OK, nessuna vulnerabilita' nota |
| `pnpm outdated` | Warning: diverse major disponibili |
| `pnpm run lint` | OK |
| `pnpm run test:run` | OK, 6 file / 14 test |
| `pnpm exec tsc --noEmit` | OK |
| `pnpm run build` | OK, Next build completato |

Dipendenze principali con major disponibili: Next 16, Prisma 7, Zod 4, TypeScript 6, ESLint 10, lucide-react 1.x. Non sono aggiornamenti urgenti per vulnerabilita', ma vanno pianificati per ridurre debito tecnico.

## Findings Prioritari

### P1 - Layout mobile con overflow e controlli fuori viewport

**Evidenza:** nel viewport mobile 390x844 la pagina produce `documentElement.scrollWidth = 621`. Diversi bottoni risultano oltre il viewport: esempi misurati `x=456`, `x=429`, `x=398`; la nav laterale mobile risulta anche parzialmente spostata a sinistra (`x=-11`). Visivamente la barra metriche e la nav mobile risultano tagliate o sovrapposte.

**File interessati:**

- `src/components/finance-shell.tsx:895` - portal dei tab con overflow orizzontale.
- `src/components/finance-shell.tsx:911-912` - aside mobile orizzontale con larghezze fisse.

**Impatto:** su mobile la navigazione e i dati finanziari principali possono risultare difficili da usare o invisibili. Per un'app finance personale e' un problema alto per usabilita' e fiducia.

**Raccomandazione:** definire una strategia mobile dedicata:

- top metrics in carousel/scroll area contenuta, con padding e snap;
- nav inferiore o tab bar senza elementi fuori viewport;
- evitare larghezze fisse non clampate;
- aggiungere test visuale Playwright per 390x844 e 768px.

### P1 - Import schema rifiuta saldi negativi

**Evidenza:** lo schema di preview richiede `balanceCents` non negativo:

- `src/lib/transaction-preview.ts:17`

ma il parser BBVA calcola il saldo direttamente dal valore del foglio:

- `src/lib/bbva-xlsx-parser.ts:166`
- `src/lib/bbva-xlsx-parser.ts:172`

Se un conto va in scoperto o il foglio contiene un saldo negativo, la preview puo' riuscire ma l'import JSON viene respinto da Zod.

**Impatto:** import reali validi possono fallire in modo difficile da capire.

**Raccomandazione:** permettere `balanceCents` signed, mantenendo `amountCents` non negativo. Aggiungere un test BBVA/import per saldo negativo.

### P2 - Endpoint `/api/prices` senza limiti di input/fan-out

**Evidenza:** l'endpoint accetta liste comma-separated libere:

- `src/app/api/prices/route.ts:96-105`

poi crea richieste parallele verso JustETF/Binance:

- `src/app/api/prices/route.ts:174`
- `src/app/api/prices/route.ts:185`
- `src/app/api/prices/route.ts:193`

e scrive cache per ogni chiave:

- `src/app/api/prices/route.ts:223`

**Impatto:** un utente autenticato, o un bug client, puo' generare molte WebSocket/fetch esterne e molte scritture SQLite. In locale e' soprattutto rischio di lentezza/lock; se esposta in rete diventa rischio DoS applicativo.

**Raccomandazione:** validare formato e cardinalita':

- max, per esempio, 50 chiavi totali per richiesta;
- regex per ISIN e simboli crypto;
- dedupe case-insensitive;
- rate limit per sessione/profilo;
- risposta 413/422 su payload troppo ampio.

### P2 - Settings/Upload overlay non isola il contenuto sottostante

**Evidenza browser:** quando Settings o Upload sono aperti, il DOM espone ancora bottoni, grafici e card dashboard sottostanti. I controlli di sfondo restano nella navigazione assistiva e in parte interagibili.

**File interessati:**

- `src/components/finance-shell.tsx:676` e dintorni - overlay/panel assoluto.
- `src/components/finance-shell/settings-panel.tsx:66`
- `src/components/finance-shell/settings-panel.tsx:85`
- `src/components/finance-shell/settings-panel.tsx:105`

Inoltre le voci Settings/API/Danger sono `div` cliccabili, non `button`/tab semantici; il toggle visibilita' secret usa `role="button"`:

- `src/components/finance-shell/settings-panel.tsx:213`

**Impatto:** tastiera e screen reader hanno un'esperienza incoerente; aumenta anche il rischio di click accidentali sullo sfondo.

**Raccomandazione:**

- usare `button` o tablist/tab per le sezioni settings;
- aggiungere focus management e `aria-modal`/`inert` o `aria-hidden` sul background quando un panel e' aperto;
- rendere il toggle secret un vero `button` con `aria-label`;
- verificare tab order con tastiera.

### P2 - Cancellazione account protetta solo da `window.confirm`

**Evidenza:** il client usa un confirm nativo:

- `src/components/finance-shell.tsx:490`

poi invia una `DELETE` senza body:

- `src/components/finance-shell.tsx:496`

Il server cancella profili e account autenticato dopo la sola sessione:

- `src/app/api/account/route.ts:13`
- `src/app/api/account/route.ts:17`
- `src/app/api/account/route.ts:100`
- `src/app/api/account/route.ts:105`

**Impatto:** il confirm e' solo UI client-side. Un bug same-origin/XSS o un'integrazione futura potrebbe chiamare direttamente l'endpoint distruttivo.

**Raccomandazione:** richiedere una conferma server-side, per esempio `{ confirmation: accountName }`, e validarla nel route handler. Aggiungere anche origin check/rate limit sulle mutazioni distruttive.

### P2 - Autenticazione locale basata su PIN alfanumerico breve

**Evidenza:** il PIN e' 6-16 caratteri alfanumerici:

- `src/lib/local-auth.ts:4`
- `src/lib/auth.ts:110-111`

Non e' evidente nel codice un rate limit applicativo o lockout dedicato per sign-in.

**Impatto:** in uso strettamente locale e' accettabile, ma se il server viene esposto sulla LAN o Internet, il PIN breve e' sensibile a brute force.

**Raccomandazione:** verificare/abilitare rate limiting Better Auth o implementarlo a livello route/proxy; aumentare i requisiti minimi se l'app puo' uscire da localhost; documentare chiaramente il profilo di rischio.

### P3 - Campi legacy plaintext per Binance restano nel modello

**Evidenza:** lo schema contiene sia campi plaintext sia encrypted:

- `prisma/schema.prisma:16-19`

la lettura supporta ancora fallback plaintext:

- `src/lib/secrets.ts:102-107`

**Impatto:** anche se i nuovi salvataggi impostano i plaintext a `null`, il modello continua a permettere segreti non cifrati e rende piu' facile regressione o dati legacy residui.

**Raccomandazione:** creare migrazione/utility che migra o cancella i plaintext residui, poi rimuovere i campi legacy dallo schema.

### P3 - Duplicazione logica Binance connect/sync

**Evidenza:** `connect` e `sync` duplicano token names, conversione prezzi EUR e upsert dei saldi:

- `src/app/api/binance/connect/route.ts:10`
- `src/app/api/binance/connect/route.ts:53`
- `src/app/api/binance/connect/route.ts:173`
- `src/app/api/binance/sync/route.ts:10`
- `src/app/api/binance/sync/route.ts:61`
- `src/app/api/binance/sync/route.ts:265`

Inoltre solo `sync` aggiorna `binance_sync_${userId}`:

- `src/app/api/binance/sync/route.ts:295-298`

**Impatto:** divergenza funzionale probabile: connect e sync potrebbero mostrare saldi simili ma timestamp/staleness diversi.

**Raccomandazione:** estrarre un servizio Binance condiviso (`fetchBalances`, `priceBalances`, `persistBalances`) e usare una sola path per connect/sync, con timestamp coerente.

## Cose Che Funzionano Bene

- Guardie auth/profilo coerenti:
  - `src/lib/auth-guard.ts:18`
  - `src/lib/auth-guard.ts:30-35`
- Upload con limite dimensione e filtro estensione:
  - `src/app/api/transactions/preview/route.ts:10-17`
  - `src/app/api/transactions/preview/route.ts:51-60`
- Preview/import vincolati a profilo posseduto:
  - `src/app/api/transactions/preview/route.ts:68`
  - `src/app/api/transactions/import/route.ts:26`
- Deduplica tramite fingerprint e vincoli Prisma:
  - `src/lib/transaction-import.ts:66-73`
  - `prisma/schema.prisma:111`
  - `prisma/schema.prisma:137`
  - `prisma/schema.prisma:163`
- Cifratura segreti Binance con AES-256-GCM:
  - `src/lib/secrets.ts:22-36`
  - `src/lib/secrets.ts:44`
  - `src/lib/secrets.ts:65`
- SQLite configurato con WAL e timeout:
  - `src/lib/db.ts:31`
  - `src/lib/db.ts:40-41`

## Copertura Test

Attuale: 6 file test, 14 test totali.

Copre parser, preview e logica chart/time-series. Mancano test su:

- route handler API con auth/profile ownership;
- flusso import end-to-end con saldo negativo;
- limiti `/api/prices`;
- UI responsive mobile;
- settings/danger zone/accessibilita';
- Binance service con mock HTTP.

## Raccomandazioni Operative

Priorita' prossima:

1. Fix mobile overflow e aggiungere visual regression minima.
2. Consentire `balanceCents` signed e aggiungere test.
3. Mettere limiti a `/api/prices`.
4. Rendere Settings/Upload accessibili e isolati dallo sfondo.
5. Rafforzare delete account con conferma server-side.

Poi:

1. Estrarre servizio Binance condiviso.
2. Migrare/rimuovere campi plaintext Binance.
3. Pianificare upgrade major dipendenze in branch separati.
4. Aggiungere test route/API e smoke e2e.

## Note Browser Audit

Account temporaneo usato: `audit60555723`.
L'account e' stato cancellato tramite la danger zone e al reload l'app e' tornata alla schermata di login.
Non sono stati rilevati errori console durante la navigazione.
