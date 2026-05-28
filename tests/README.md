# Tests

This folder is the home for app tests and shared fixtures.

Current organization:

- unit tests live under `tests/unit/`;
- parser, import, pricing, auth and finance calculation tests live under
  `tests/unit/domain/`;
- config, security, logging and secret tests live under `tests/unit/server/`;
- integration/client service tests live under `tests/unit/integrations/`;
- UI helper and chart-data tests live under `tests/unit/ui/`;
- API route tests live under `tests/api/`;
- reusable input builders and sample data live under `tests/fixtures/`;
- shared test setup helpers live under `tests/setup/`.

Do not add new app tests under `src/`.
