# Windows Desktop Mockup

Date: 2026-05-28

Status: concept mockup, not an implementation plan

## Purpose

This mockup captures what a future Morgan desktop app could feel like without
committing the repository to a desktop architecture yet. It exists to protect
the web target from accidental desktop concerns while still making room for an
offline product direction.

## Product Shape

The desktop app should feel like the same Morgan product, but with a local-first
operating model:

- finance data is stored locally by default;
- the user can see where the local vault lives;
- external network actions are explicit;
- backup/export is a first-class workflow;
- the main dashboard stays familiar to the web app.

## Main Window Concept

```text
+--------------------------------------------------------------------------------+
| Morgan                                                     Offline  Lock  Sync |
+--------------------+-----------------------------------------------------------+
| Profile            | Net Worth                                         42,180 |
| Luca               |                                                           |
|                    |  [ ALL | 1Y | 6M | 3M | 1M | 1W ]                         |
| Local Vault        |                                                           |
| C:\Users\...\data  |        chart area shared with web dashboard               |
|                    |                                                           |
| Import             |  Checking     Investments     Crypto                      |
| Trade Republic     |  BBVA         Trade Republic  Binance optional            |
| BBVA               |                                                           |
| Binance            |                                                           |
|                    |  Recent Activity                                          |
| Settings           |  2026-05-03  BBVA salary                         +2,400 |
| Backups            |  2026-05-02  ETF buy                            -500 |
| Network            |                                                           |
+--------------------+-----------------------------------------------------------+
```

The layout intentionally resembles the current web workspace. The desktop-only
signals are the local vault, offline state, lock control, backup entrypoint and
explicit network status.

## First-Run Concept

```text
+------------------------------------------------------------------+
| Morgan Desktop                                                   |
+------------------------------------------------------------------+
| Create Local Vault                                               |
|                                                                  |
| Vault location                                                   |
| C:\Users\Luca\Documents\Morgan\morgan.db                         |
|                                                                  |
| [ Change location ]                                              |
|                                                                  |
| Encryption                                                       |
| [x] Encrypt stored integration secrets                           |
|                                                                  |
| Network access                                                   |
| [ ] Allow live price and metadata lookups by default             |
| [ ] Allow Binance account sync by default                        |
|                                                                  |
|                                   [ Create Vault ]               |
+------------------------------------------------------------------+
```

First run should make the local/offline model obvious. The user should not have
to understand Postgres, Neon, Vercel or any cloud concepts.

## Settings Concept

```text
+--------------------------------------------------------------------------------+
| Settings                                                                       |
+------------------------+-------------------------------------------------------+
| Vault                  | Local Vault                                           |
| Backups                | Location: C:\Users\...\Morgan\morgan.db              |
| Network                | Size: 18 MB                                          |
| Integrations           | Last backup: 2026-05-27 21:04                       |
| Security               |                                                       |
| About                  | [ Open folder ] [ Backup now ] [ Restore backup ]    |
|                        |                                                       |
|                        | Network                                               |
|                        | [ ] Live price lookups                                |
|                        | [ ] JustETF metadata                                  |
|                        | [ ] Binance account sync                              |
+------------------------+-------------------------------------------------------+
```

Desktop settings should separate local persistence, network permissions,
integration credentials and app security.

## Desktop-Specific Capabilities

These are candidates for desktop only. They should not leak into the web target
unless explicitly re-scoped.

| Capability | Desktop reason | Web equivalent |
| --- | --- | --- |
| Local vault path | User owns the file location | Neon database URL, private env |
| Backup/restore | Single-user offline recovery | Database backup/branching |
| Offline network switch | Prevent accidental external calls | Server env/config |
| App lock | Local privacy on shared machines | Web session auth |
| Portable export | Move data between machines | Admin/export feature later |
| Tray/menu integration | OS convenience | Not applicable |

## Shared Product Surface

The following should stay shared with the web app wherever possible:

- dashboard visual language;
- import review workflow;
- Trade Republic and BBVA parsers;
- Binance credential form and sync workflow, guarded by network permission;
- checking, investment and crypto charts;
- finance calculations and time-series logic;
- profile model and transaction model.

## Boundaries For The Current Repo

Do not create desktop runtime code yet. Until the desktop architecture is chosen:

- no `apps/desktop`;
- no Tauri dependencies;
- no filesystem APIs in `src/domain` or `src/shared`;
- no SQLite-specific assumptions in web route handlers;
- no desktop-only UI forks.

Allowed now:

- desktop concept documents;
- target-neutral extraction of domain logic;
- repository interfaces that can later receive SQLite adapters;
- tests that prove domain logic does not depend on web runtime APIs.

## Design Questions To Resolve Later

- Tauri vs another shell.
- SQLite through Prisma vs a lighter SQLite adapter.
- Whether the desktop app needs user accounts or only local profiles.
- How app lock should work on Windows.
- Backup format and restore conflict behavior.
- Whether live prices are opt-in globally or per integration.
- How to package updates without weakening local privacy expectations.

