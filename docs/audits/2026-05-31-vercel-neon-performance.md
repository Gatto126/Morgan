# Vercel And Neon Performance Audit

Date: 2026-05-31

## Goal

Reduce page loading during production navigation and reloads, especially when a
profile contains many transactions and long market-history series.

## Main Bottlenecks Found

1. Authenticated dashboard GET requests were always fetched with `no-store`.
   A reload or tab revisit had to hit the Vercel Function and Neon again even
   when the profile version had not changed.
2. Dashboard, checking, investment, crypto, Binance, row, and price responses
   had no private browser cache headers.
3. Portfolio summary endpoints built provider transaction arrays and then
   discarded them before returning JSON.
4. Historical price reads loaded all rows for each symbol, even when the
   profile's first transaction was later than the oldest stored price.
5. Latest historical price fallback loaded every matching history row and
   deduplicated in application code.
6. Transaction row pagination filtered by `userId` and `sourceInstitution`, but
   the database only had the broader `userId, bookingDate` indexes.

## Implemented Changes

- Added private browser caching for authenticated JSON responses:
  `Cache-Control: private, max-age=..., stale-while-revalidate=...` and
  `Vary: Cookie`.
- Added client-side versioned query strings (`v=`) for dashboard stage and row
  fetches. The version is based on transaction count or Binance refresh key, so
  imports invalidate cached URLs.
- Changed dashboard stage force refreshes from `no-store` to `reload`, allowing
  the browser to update its private cache instead of discarding the response.
- Added short-lived in-process server cache/deduplication for versioned profile
  stage payloads. This helps warm Vercel Functions avoid repeated heavy work.
- Increased transaction row cache TTL from 5 seconds to 60 seconds, keyed by
  endpoint, user, provider, count, offset, and limit.
- Avoided building provider transaction arrays for checking and portfolio
  summary payloads.
- Limited historical price reads to the profile transaction window.
- Replaced latest price fallback with a Postgres `DISTINCT ON` query so only one
  row per key is returned from Neon.
- Added production indexes for:
  - transaction row pagination by `userId`, `sourceInstitution`, `bookingDate`,
    `id`;
  - market history lookup by `currency`, `isin`, `date`.
- Deferred transaction row loading until table visibility or browser idle, with
  idle prefetch for the first provider rows.
- Limited focus and active-timer refreshes to stale stage caches so quick app
  switching does not force fresh Vercel and Neon work.
- Optimized Binance pricing by loading all ticker prices once and pricing token
  balances locally from that symbol map.
- Added structured production performance traces for endpoint duration, profile
  cache hit/miss/dedup, repository calls, time-series builders, payload sizes,
  price refreshes, and Binance sync.
- Added cookie-backed active profile/stage persistence and server-primed reload
  payloads for the active dashboard section.

## Production Notes

- Keep Vercel Functions in the same region as the Neon primary or nearest read
  endpoint. This repo is configured for `fra1`; Neon should be placed close to
  Frankfurt for the lowest round trip.
- Keep `DATABASE_URL` pointed at the Neon pooled connection string and
  `DIRECT_URL` pointed at the direct connection string for Prisma migrations.
- For very large existing production tables, consider applying the new indexes
  during a quiet window. The migration uses normal `CREATE INDEX` statements.
- After deployment, compare Vercel Function duration for:
  - `/api/transactions/dashboard`;
  - `/api/transactions/checking`;
  - `/api/transactions/investment`;
  - `/api/transactions/crypto`;
  - `/api/prices`.

## Remaining High-Impact Follow-Ups

1. Consider a combined dashboard summary endpoint for idle warmup, so all stage
   data can be prepared from one coordinated server pass.
2. Move live price refresh further away from reload paint or serve stale prices
   first, because `/api/prices` can still compete with Crypto reload.
3. For very large histories, consider precomputed daily/monthly portfolio
   snapshots per profile.
