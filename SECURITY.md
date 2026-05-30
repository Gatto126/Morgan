# Security Policy

Morgan handles financial data and integration credentials. Treat security
reports and accidental secret exposure as high priority.

## Reporting A Vulnerability

If this repository is hosted on GitHub, use a private GitHub Security Advisory
when possible. Do not open a public issue for vulnerabilities, leaked secrets,
authentication bypasses, account deletion bugs, or credential handling issues.

Include:

- affected commit or version;
- reproduction steps;
- expected and actual behavior;
- whether any secrets or personal financial data may have been exposed.

## Secret Handling

Never commit real values for:

- `DATABASE_URL` or `DIRECT_URL`;
- `BETTER_AUTH_SECRET`;
- `MORGAN_ENCRYPTION_KEY`;
- `MORGAN_SIGNUP_INVITE_CODE`;
- Binance API keys or secrets;
- browser traces, screenshots, logs, or exported databases containing personal
  finance data.

Use the checked-in `.env.*.example` files as templates only. Real `.env` files,
local databases and runtime artifacts are intentionally ignored by Git.

## Supported Targets

Current security-sensitive targets:

- local development against Docker Postgres;
- Docker pre-production;
- future Vercel + Neon web deployment;
- future desktop/offline app concept.

Before public deployment, run the repository checks and complete the deployment
hardening items documented in `docs/deployment/`.

Public release is blocked until `docs/deployment/release-readiness.md` is
green for the deployed environment, including backup/restore validation, secret
rotation, legal/privacy copy, monitoring, rollback, browser QA, and dense-data
performance QA.
