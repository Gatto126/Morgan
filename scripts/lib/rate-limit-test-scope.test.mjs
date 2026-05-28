import { describe, expect, it } from "vitest";

import { assertSafeRateLimitReset } from "./rate-limit-test-scope.mjs";

describe("assertSafeRateLimitReset", () => {
  it("allows a local database outside CI without an explicit flag", () => {
    const result = assertSafeRateLimitReset({
      databaseUrl: "postgresql://morgan:morgan@localhost:5432/morgan?schema=public",
      nodeEnv: "test",
      ci: "false"
    });

    expect(result.mode).toBe("local");
  });

  it("allows a local SQLite file outside CI without an explicit flag", () => {
    const result = assertSafeRateLimitReset({
      databaseUrl: "file:./prisma/sqlite/dev.db",
      nodeEnv: "test",
      ci: "false"
    });

    expect(result.mode).toBe("local");
  });

  it("rejects production even with the explicit test flag", () => {
    expect(() =>
      assertSafeRateLimitReset({
        allowTestReset: "1",
        databaseUrl: "postgresql://morgan:morgan@localhost:5432/morgan?schema=public",
        nodeEnv: "production"
      })
    ).toThrow("NODE_ENV=production");
  });

  it("rejects remote databases without the explicit test flag", () => {
    expect(() =>
      assertSafeRateLimitReset({
        databaseUrl: "postgresql://user:pass@ep-test.neon.tech/morgan?sslmode=require",
        nodeEnv: "test",
        ci: "false"
      })
    ).toThrow("non-local database");
  });

  it("requires the explicit test flag in CI", () => {
    expect(() =>
      assertSafeRateLimitReset({
        databaseUrl: "postgresql://morgan:morgan@localhost:5432/morgan?schema=public",
        nodeEnv: "test",
        ci: "true"
      })
    ).toThrow("in CI");
  });

  it("allows an explicit test reset outside production", () => {
    const result = assertSafeRateLimitReset({
      allowTestReset: "1",
      databaseUrl: "postgresql://user:pass@ep-test.neon.tech/morgan?sslmode=require",
      nodeEnv: "test",
      ci: "true"
    });

    expect(result.mode).toBe("explicit");
  });
});
