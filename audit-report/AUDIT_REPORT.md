# Morgan Finance - Audit Report

Data audit: 2026-05-27
Repository: `C:\Users\Lucaa\Desktop\morgan`
Stack rilevato: Next.js 15 App Router, React 19, TypeScript strict, Prisma + SQLite, Better Auth, Tailwind CSS 4, Vitest.

## Executive Summary

L'app e' in buono stato tecnico generale: build, type-check, lint, test unitari e audit dipendenze passano. La separazione dei profili tramite `ownerId`, l'uso di Prisma invece di SQL manuale, la cifratura AES-GCM per le credenziali Binance e i controlli su upload/import sono segnali positivi.

Le aree ancora aperte piu' urgenti riguardano:

1. layout mobile con overflow orizzontale e controlli parzialmente fuori viewport;
2. schema di import che rifiuta saldi conto negativi anche se il parser BBVA li puo' produrre.

Aggiornamento post-fix del 2026-05-27:

- `/api/prices` e' stato hardenizzato con validazione, deduplica, limiti cardinalita' e rate limit.
- `connect` e `sync` Binance usano un servizio condiviso e aggiornano timestamp/staleness in modo coerente.
- la cancellazione account richiede password verificata server-side, origin check e rate limit sui tentativi falliti.
- l'autenticazione locale non usa piu' un PIN breve per nuovi account: registrazione con password/passphrase 15-128 caratteri, spazi/simboli ammessi, rate limit Better Auth database-backed.
- il submit auth e' esplicito: rimosso auto-login temporizzato; il bottone resta visibile/disabilitato finche' i campi non sono validi.
- le voci Settings/API/Danger, New Profile e il toggle secret sono controlli `button` semantici; la modale delete account e' stata estratta in componente dedicato.
- i pannelli Upload/Settings/Profile isolano il contenuto sottostante con `inert`/`aria-hidden` e focus trap; la modale delete account usa lo stesso focus management.
- l'upload panel non resta aperto quando si naviga verso Settings/Profile, non si auto-apre su Home con profili vuoti e il pulsante upload non rimane attivo fuori dagli stage contenuto.
- i campi plaintext legacy Binance sono rimossi dallo schema e dalla lettura applicativa; `scripts/migrate-binance-plaintext.mjs` conserva un percorso di migrazione per DB preesistenti.
- online readiness avanzata: header HTTP difensivi in `next.config.ts`, same-origin check su tutte le mutazioni app, cookie Better Auth sicuri quando `BETTER_AUTH_URL` e' HTTPS, warning produzione per origin/proxy IP non configurati.

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
| `pnpm run test:run` | OK, 17 file / 73 test |
| `pnpm exec tsc --noEmit` | OK |
| `pnpm run build` | OK, Next build completato |
| `pnpm run smoke:upload-panel` | OK, include isolamento pannelli e tab order |

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


### P2 - Settings/Upload overlay non isola il contenuto sottostante - RISOLTO

**Evidenza originaria:** quando Settings o Upload erano aperti, il DOM esponeva ancora bottoni, grafici e card dashboard sottostanti. I controlli di sfondo restavano nella navigazione assistiva e in parte interagibili.

**File interessati:**

- `src/components/finance-shell.tsx`
- `src/components/finance-shell/use-modal-accessibility.ts`
- `src/components/finance-shell/delete-account-dialog.tsx`
- `scripts/smoke-upload-panel.mjs`

**Stato attuale:** risolto.

- `src/components/finance-shell/settings-panel.tsx` usa `button` per Settings/API/Danger e per il toggle visibilita' secret con `aria-label`.
- `src/components/finance-shell/user-select-panel.tsx` usa un `button` per New Profile.
- `src/components/finance-shell/use-modal-accessibility.ts` centralizza `inert`, `aria-hidden`, focus iniziale, focus trap, restore del focus ed Escape.
- `src/components/finance-shell.tsx` marca Header, cards portal e background del frame con `inert`/`aria-hidden` quando Upload/Settings/Profile sono aperti.
- I pannelli Upload/Settings/Profile espongono `role="dialog"` e `data-modal-panel`; Home resta navigabile liberamente e non auto-apre Upload anche se il profilo e' vuoto.
- `src/components/finance-shell/delete-account-dialog.tsx` usa lo stesso focus trap quando la modale distruttiva e' aperta sopra Settings.
- L'animazione di chiusura e' applicata solo al contenuto interno: il contenitore del pannello resta opaco, fermo e allineato al grafico fino allo smontaggio.

**Verifica:** `pnpm run smoke:upload-panel` crea un profilo vuoto, attraversa Upload/Settings/Profile/Home, verifica `inert`/`aria-hidden`, controlla che il Tab non entri nello sfondo nascosto e conferma che Home rimanga senza Upload auto-aperto.

**Impatto residuo:** nessuno noto su desktop. Resta separato il tema responsive mobile gia' tracciato come P1.

### P2 - Cancellazione account protetta solo da `window.confirm` - RISOLTO

**Evidenza originaria:** il client usava un confirm nativo e poi inviava una `DELETE` senza body:

- `src/components/finance-shell.tsx:490`
- `src/components/finance-shell.tsx:496`

Il server cancellava profili e account autenticato dopo la sola sessione:

- `src/app/api/account/route.ts:13`
- `src/app/api/account/route.ts:17`
- `src/app/api/account/route.ts:100`
- `src/app/api/account/route.ts:105`

**Stato attuale:** risolto.

- `src/app/api/account/route.ts` richiede `password` nel body, verifica la password Better Auth via hash server-side, applica same-origin check e rate limit sui tentativi falliti.
- `src/lib/request-security.ts` centralizza il controllo `Origin`/`Referer`.
- `src/components/finance-shell.tsx` usa una modale dedicata invece di `window.confirm`.
- `src/app/api/account/route.test.ts` copre auth guard, origin check, body invalido, password errata, rate limit e percorso di successo.

### P2 - Autenticazione locale basata su PIN alfanumerico breve - RISOLTO

**Evidenza originaria:** il PIN era 6-16 caratteri alfanumerici:

- `src/lib/local-auth.ts:4`
- `src/lib/auth.ts:110-111`

Non era evidente nel codice un rate limit applicativo o lockout dedicato per sign-in.

**Stato attuale:** risolto per nuovi account e reso compatibile con gli account legacy.

- `src/lib/local-auth.ts` definisce password/passphrase 15-128 caratteri, con spazi e simboli ammessi.
- `src/lib/auth.ts` applica la policy alle nuove registrazioni, mantiene login legacy per non bloccare account locali esistenti e abilita rate limit Better Auth con storage database.
- `prisma/schema.prisma` include `RateLimit`.
- `src/components/auth-shell.tsx` parla di password, non PIN, e rimuove l'auto-login temporizzato.
- `src/lib/local-auth.test.ts` copre policy password, username e compatibilita' input legacy.

**Nota deploy:** prima di esposizione pubblica reale, configurare `BETTER_AUTH_IP_HEADERS` / `TRUSTED_IP_HEADERS` in base al provider. In locale il fallback `x-forwarded-for` e' sufficiente per test; con Cloudflare usare `cf-connecting-ip`. `src/lib/auth-config.ts` ora emette warning in produzione se `BETTER_AUTH_URL` non e' HTTPS pubblico, se gli origin trusted usano wildcard pubbliche o se gli header IP proxy non sono espliciti.

### P3 - Campi legacy plaintext per Binance restano nel modello - RISOLTO

**Evidenza originaria:** lo schema conteneva sia campi plaintext sia encrypted:

- `prisma/schema.prisma:16-19`

la lettura supportava ancora fallback plaintext:

- `src/lib/secrets.ts:102-107`

**Stato attuale:** risolto.

- `prisma/schema.prisma` espone solo `binanceApiKeyEncrypted`, `binanceApiSecretEncrypted` e `binanceApiKeyPreview`.
- `src/lib/secrets.ts` non fa piu' fallback su plaintext.
- `src/app/api/users/[id]/route.ts` salva e cancella solo i campi cifrati.
- `scripts/migrate-binance-plaintext.mjs` migra o pulisce eventuali valori plaintext in DB legacy prima del drop colonne.

### P3 - Duplicazione logica Binance connect/sync - RISOLTO

**Evidenza originaria:** `connect` e `sync` duplicavano token names, conversione prezzi EUR e upsert dei saldi:

- `src/app/api/binance/connect/route.ts:10`
- `src/app/api/binance/connect/route.ts:53`
- `src/app/api/binance/connect/route.ts:173`
- `src/app/api/binance/sync/route.ts:10`
- `src/app/api/binance/sync/route.ts:61`
- `src/app/api/binance/sync/route.ts:265`

Inoltre solo `sync` aggiorna `binance_sync_${userId}`:

- `src/app/api/binance/sync/route.ts:295-298`

**Stato attuale:** risolto.

- `src/lib/binance-service.ts` centralizza fetch, merge, pricing, persist e timestamp.
- `src/app/api/binance/connect/route.ts` e `src/app/api/binance/sync/route.ts` chiamano entrambe `syncBinanceBalances`.
- `connect` e `sync` restituiscono `balances` + `syncedAt` e aggiornano `binance_sync_${userId}` tramite la stessa path.
- `src/lib/binance-service.test.ts` e `src/app/api/binance/routes.test.ts` coprono servizio e route.

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
- Header di sicurezza applicati via Next:
  - `next.config.ts`
- Same-origin check centralizzato per mutazioni:
  - `src/lib/request-security.ts`
  - `src/app/api/users/route.ts`
  - `src/app/api/users/[id]/route.ts`
  - `src/app/api/transactions/preview/route.ts`
  - `src/app/api/transactions/import/route.ts`
  - `src/app/api/binance/route-handler.ts`

## Copertura Test

Attuale: 17 file test, 73 test totali.

Copre parser, preview, price request validation, logica chart/time-series, servizio Binance, route Binance, cancellazione account, policy auth locale, helper UI auth/delete account, segreti cifrati, auth deployment config, request security e smoke UI per isolamento pannelli. Mancano ancora test su:

- flusso import end-to-end con saldo negativo;
- UI responsive mobile;
- route handler API restanti con auth/profile ownership.

## Raccomandazioni Operative

Priorita' prossima:

1. Fix mobile overflow e aggiungere visual regression minima.
2. Consentire `balanceCents` signed e aggiungere test.

Poi:

1. Aggiungere MFA/passkeys prima dell'esposizione pubblica reale.
2. Configurare e verificare header IP affidabili sul provider reale (`cf-connecting-ip` con Cloudflare, altrimenti header del proxy scelto e sanitizzato).
3. Pianificare upgrade major dipendenze in branch separati.
4. Aggiungere test route/API restanti e smoke e2e.

## Note Browser Audit

Account temporaneo usato: `audit60555723`.
L'account e' stato cancellato tramite la danger zone e al reload l'app e' tornata alla schermata di login.
Non sono stati rilevati errori console durante la navigazione.

Aggiornamento smoke 2026-05-27:

- dev server avviato su `http://localhost:3000`;
- registrazione con passphrase lunga completata fino alla schermata `New profile`;
- verificato che il bottone auth non faccia piu' auto-submit;
- verificato visualmente che password input e submit button abbiano radius/dimensioni coerenti in Login e Register;
- DB locale ripulito al termine dello smoke (`authUsers`, `profiles`, `sessions`, `accounts`, `rateLimits` a 0).
- smoke Upload/Settings/Profile aggiornato: verifica isolamento `inert`/`aria-hidden`, tab order keyboard e Home libera senza auto-upload su profili vuoti.
