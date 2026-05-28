import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apiLogger,
  formatLogBody,
  sanitizeLogValue,
  shouldLogInfoMessage
} from "@/server/logging/logger";
import { setTestEnv } from "../../../setup/env";

describe("logger", () => {
  let restoreEnv = () => {};

  afterEach(() => {
    restoreEnv();
    restoreEnv = () => {};
    vi.restoreAllMocks();
  });

  it("redacts sensitive fields recursively", () => {
    expect(
      sanitizeLogValue({
        apiKey: "public-looking-key",
        nested: {
          password: "secret-password",
          safe: "visible",
          note: `value ${"abcDEF123_".repeat(5)}`
        },
        tokenCount: 94
      })
    ).toEqual({
      apiKey: "[redacted]",
      nested: {
        password: "[redacted]",
        safe: "visible",
        note: "value [redacted]"
      },
      tokenCount: "[redacted]"
    });
  });

  it("omits log bodies in minimal detail mode", () => {
    expect(formatLogBody({ heritage: "1091.13 EUR", tokensFound: 94 }, "minimal")).toBe("");
  });

  it("sanitizes bodies in standard detail mode", () => {
    expect(formatLogBody({ apiSecret: "secret", status: "ok" }, "standard")).toBe(
      ' {"apiSecret":"[redacted]","status":"ok"}'
    );
  });

  it("suppresses info messages in minimal detail mode", () => {
    restoreEnv = setTestEnv({
      MORGAN_LOG_DETAIL: "minimal",
      MORGAN_LOG_LEVEL: "info"
    });

    expect(shouldLogInfoMessage()).toBe(false);
  });

  it("logs production request lines without body details", () => {
    restoreEnv = setTestEnv({
      MORGAN_LOG_COLORS: "0",
      MORGAN_LOG_DETAIL: "minimal",
      MORGAN_LOG_LEVEL: "info"
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    apiLogger("Test").response("GET", "/api/test", 200, {
      heritage: "1091.13 EUR",
      tokensFound: 94
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = String(logSpy.mock.calls[0][0]);
    expect(line).toContain("[Test]");
    expect(line).toContain("<- GET 200");
    expect(line).not.toContain("1091.13");
    expect(line).not.toContain("tokensFound");
  });
});
