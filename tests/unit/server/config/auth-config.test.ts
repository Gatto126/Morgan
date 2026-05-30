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
      DATABASE_URL: "postgresql://user:pass@example.test:5432/morgan",
      DIRECT_URL: "postgresql://user:pass@example.test:5432/morgan",
      BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
      MORGAN_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      BETTER_AUTH_URL: "http://morgan.example",
      BETTER_AUTH_TRUSTED_ORIGINS: "https://*.example.com"
    })).toEqual([
      "BETTER_AUTH_URL should use HTTPS for public production deployments.",
      "BETTER_AUTH_TRUSTED_ORIGINS should not use wildcard public origins in production.",
      "Configure BETTER_AUTH_IP_HEADERS for the trusted proxy or hosting provider in production."
    ]);
  });

  it("warns about missing production runtime requirements", () => {
    expect(getAuthDeploymentWarnings({
      NODE_ENV: "production",
      BETTER_AUTH_URL: "https://morgan.example",
      BETTER_AUTH_IP_HEADERS: "x-forwarded-for"
    })).toEqual([
      "DATABASE_URL is required in production.",
      "DIRECT_URL is required in production.",
      "BETTER_AUTH_SECRET is required in production.",
      "MORGAN_ENCRYPTION_KEY is required in production."
    ]);
  });

  it("validates production secret strength and encryption key shape", () => {
    expect(getAuthDeploymentWarnings({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@example.test:5432/morgan",
      DIRECT_URL: "postgresql://user:pass@example.test:5432/morgan",
      BETTER_AUTH_SECRET: "too-short",
      MORGAN_ENCRYPTION_KEY: "not-a-key",
      BETTER_AUTH_URL: "https://morgan.example",
      BETTER_AUTH_IP_HEADERS: "x-forwarded-for"
    })).toEqual([
      "BETTER_AUTH_SECRET should be at least 32 characters in production.",
      "MORGAN_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex value."
    ]);
  });

  it("accepts complete production deployment settings", () => {
    expect(getAuthDeploymentWarnings({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@example.test:5432/morgan",
      DIRECT_URL: "postgresql://user:pass@example.test:5432/morgan",
      BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
      MORGAN_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      BETTER_AUTH_URL: "https://morgan.example",
      BETTER_AUTH_TRUSTED_ORIGINS: "https://morgan.example",
      BETTER_AUTH_IP_HEADERS: "x-forwarded-for"
    })).toEqual([]);
  });
});
