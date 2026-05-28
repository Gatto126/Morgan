import {
  applyEnvFileDatabaseUrl,
  clearRateLimitsForTest
} from "../lib/rate-limit-test-scope.mjs";

applyEnvFileDatabaseUrl();

clearRateLimitsForTest()
  .then((result) => {
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
