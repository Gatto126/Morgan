import { describe, expect, it } from "vitest";

import {
  getAuthDeploymentWarnings,
  getIpAddressHeaders,
  getTrustedOrigins,
  shouldUseSecureCookies
} from "@/server/security/auth-config";

describe("auth config helpers", () => {
  it("adds localhost trusted origins outside production", () => {
    expect(getTrustedOrigins({ NODE_ENV: "development" })).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://192.168.*.*:3000"
    ]);
  });

  it("keeps production trusted origins explicit", () => {
    expect(getTrustedOrigins({
      NODE_ENV: "production",
      BETTER_AUTH_URL: "https://morgan.example",
      BETTER_AUTH_TRUSTED_ORIGINS: "https://morgan.example, https://app.example"
    })).toEqual(["https://morgan.example", "https://app.example"]);
  });

  it("normalizes configured IP headers", () => {
    expect(getIpAddressHeaders({
      BETTER_AUTH_IP_HEADERS: "CF-Connecting-IP, X-Real-IP"
    })).toEqual(["cf-connecting-ip", "x-real-ip"]);
  });

  it("uses secure cookies for HTTPS public URLs", () => {
    expect(shouldUseSecureCookies({
      NODE_ENV: "production",
      BETTER_AUTH_URL: "https://morgan.example"
    })).toBe(true);
    expect(shouldUseSecureCookies({
      NODE_ENV: "development",
      BETTER_AUTH_URL: "http://localhost:3000"
    })).toBe(false);
  });

  it("warns about unsafe production auth deployment settings", () => {
    expect(getAuthDeploymentWarnings({
      NODE_ENV: "production",
      BETTER_AUTH_URL: "http://morgan.example",
      BETTER_AUTH_TRUSTED_ORIGINS: "https://*.example.com"
    })).toEqual([
      "BETTER_AUTH_URL should use HTTPS for public production deployments.",
      "BETTER_AUTH_TRUSTED_ORIGINS should not use wildcard public origins in production.",
      "Configure BETTER_AUTH_IP_HEADERS for the trusted proxy or hosting provider in production."
    ]);
  });
});
