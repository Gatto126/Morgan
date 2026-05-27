import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RequestSecurityError,
  getAllowedMutationOrigins,
  requireSameOriginMutation
} from "@/lib/request-security";

const originalEnv = {
  BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL
};

afterEach(() => {
  vi.unstubAllEnvs();
  restoreEnv("BETTER_AUTH_TRUSTED_ORIGINS", originalEnv.BETTER_AUTH_TRUSTED_ORIGINS);
  restoreEnv("BETTER_AUTH_URL", originalEnv.BETTER_AUTH_URL);
});

function restoreEnv(key: keyof typeof originalEnv, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("request security", () => {
  it("allows the request origin for same-origin mutations", () => {
    const request = new Request("https://morgan.example/api/users", {
      method: "POST",
      headers: { Origin: "https://morgan.example" }
    });

    expect(() => requireSameOriginMutation(request)).not.toThrow();
  });

  it("allows the configured public auth origin behind a proxy", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", "https://morgan.example");
    vi.stubEnv("BETTER_AUTH_TRUSTED_ORIGINS", "");

    const request = new Request("http://internal:3000/api/users", {
      method: "POST",
      headers: { Origin: "https://morgan.example" }
    });

    expect(() => requireSameOriginMutation(request)).not.toThrow();
  });

  it("rejects requests without origin or referer signals", () => {
    const request = new Request("https://morgan.example/api/users", {
      method: "POST"
    });

    expect(() => requireSameOriginMutation(request)).toThrow(RequestSecurityError);
  });

  it("does not turn wildcard trusted origins into mutation allow-list entries", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", "https://morgan.example");
    vi.stubEnv("BETTER_AUTH_TRUSTED_ORIGINS", "https://*.example.com, https://app.example");

    const request = new Request("https://morgan.example/api/users", {
      method: "POST",
      headers: { Origin: "https://evil.example" }
    });

    expect(getAllowedMutationOrigins(request)).toEqual([
      "https://morgan.example",
      "https://app.example"
    ]);
    expect(() => requireSameOriginMutation(request)).toThrow(RequestSecurityError);
  });
});
