# Free Tier Vercel And Neon Setup

Date: 2026-05-30

Status: recommended first cloud setup

## Goal

Use the free plans carefully:

- one Vercel Hobby project;
- one Neon Free project;
- production deploys from GitHub `main`;
- no automatic preview database branching at first;
- no Clerk or Neon Auth yet.

This keeps the setup understandable and avoids burning free-tier database
branches, storage, egress, or function usage while Morgan is still in private
validation.

## Free-Tier Constraints To Respect

Vercel Hobby is for personal/non-commercial projects. Current official limits
include 1 million function invocations, 100 GB Fast Data Transfer, 100 build
hours, and 100 deployments per day. If a free-tier usage limit is exceeded, the
feature may be unavailable until the reset window.

Neon Free currently includes 100 CU-hours per project per month, scale-to-zero
after 5 minutes, 0.5 GB storage per project, 5 GB monthly public network
transfer, 1 day of metrics retention, and a limited instant-restore window.

Practical rule for Morgan: deploy manually and deliberately. Do not push many
throwaway branches after Vercel is connected unless a separate preview database
strategy is configured.

## Before Importing On Vercel

The GitHub repository is enough for Vercel import. GitHub CLI is optional and
not required for the first deployment.

The repository already includes:

- `vercel.json` with `pnpm run vercel-build`;
- production Prisma migration command in `vercel-build`;
- production runtime config validation;
- release gate: `pnpm run release:check`.

Vercel Functions are pinned to `iad1` in `vercel.json`. Keep Neon in AWS US
East 1 / N. Virginia for the first setup so the app functions and database are
close to each other.

## Neon Project

In Neon:

1. Project name: `Morgan`.
2. Postgres version: `17`.
3. Region: `AWS US East 1 (N. Virginia)`.
4. Backend Services: keep `Neon Auth` off.
5. Create the project.

After creation, open the connection details and copy:

- pooled connection string for `DATABASE_URL`;
- direct or unpooled connection string for `DIRECT_URL`.

Morgan uses Prisma. `DATABASE_URL` is used by the app runtime. `DIRECT_URL` is
used by Prisma migrations.

## Vercel Import

In Vercel:

1. Import the GitHub repository `Gatto126/Morgan`.
2. Framework preset: `Next.js`.
3. Root directory: repository root.
4. Build command: leave as detected from `vercel.json`
   (`pnpm run vercel-build`).
5. Install command: default.
6. Output directory: default.

Before deploying, add environment variables.

## Production Environment Variables

Set these for `Production` first. Do not set Preview variables yet unless a
separate preview database is configured.

```env
DATABASE_URL=<Neon pooled connection string>
DIRECT_URL=<Neon direct/unpooled connection string>
MORGAN_DATABASE_PROVIDER=postgresql
MORGAN_ENCRYPTION_KEY=<32-byte base64 or 64-character hex key>
BETTER_AUTH_SECRET=<different random secret, at least 32 characters>
MORGAN_SIGNUP_INVITE_CODE=<private registration code>
BETTER_AUTH_URL=https://<vercel-project-domain>.vercel.app
BETTER_AUTH_TRUSTED_ORIGINS=https://<vercel-project-domain>.vercel.app
BETTER_AUTH_IP_HEADERS=x-forwarded-for
MORGAN_LOG_LEVEL=info
MORGAN_LOG_DETAIL=minimal
```

Generate two separate secrets locally:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use one value for `MORGAN_ENCRYPTION_KEY` and the other for
`BETTER_AUTH_SECRET`.

Choose `MORGAN_SIGNUP_INVITE_CODE` yourself and keep it outside Git. In
production, registration is blocked unless the user enters this exact
case-sensitive code.

If the first Vercel domain differs from the value you guessed, update
`BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS`, then redeploy from Vercel.

## First Deploy Check

After Vercel deploys:

1. Open the production URL.
2. Register a test account with the private invite code.
3. Create one profile.
4. Navigate Dashboard, Checking, Investments, Crypto, Settings.
5. Import one small BBVA or Trade Republic sample locally only if you are
   comfortable storing that test data in Neon.
6. Delete the test account from Settings.
7. Check Vercel logs for startup or migration errors.
8. Check Neon usage and confirm storage/compute remain low.

## What Not To Enable Yet

Do not enable these during the first free-tier setup:

- Clerk authentication;
- Neon Auth;
- automatic Neon preview branching;
- Vercel Analytics or Speed Insights unless you intentionally want them;
- public signups beyond your own private testing.

Those are useful later, but each adds moving parts or usage. Get the basic
production deploy healthy first.

## Later Steps

After the first production deploy is stable:

1. Add a manual backup/restore runbook.
2. Decide whether Preview deployments should be disabled, left failing without
   env vars, or connected to Neon preview branching.
3. Add Clerk only after the Vercel domain, env model, and database deployment
   path are proven.
4. Revisit public-launch blockers in `docs/deployment/release-readiness.md`.
