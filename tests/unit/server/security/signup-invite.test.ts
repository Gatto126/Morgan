import { describe, expect, it } from "vitest";

import {
  hasValidSignupInviteCodeConfig,
  isSignupInviteCodeAccepted,
  shouldRequireSignupInviteCode
} from "@/server/security/signup-invite";

describe("signup invite security", () => {
  it("requires invite codes in production or when configured", () => {
    expect(shouldRequireSignupInviteCode({
      NODE_ENV: "production"
    })).toBe(true);

    expect(shouldRequireSignupInviteCode({
      NODE_ENV: "development",
      MORGAN_SIGNUP_INVITE_CODE: "local-invite"
    })).toBe(true);

    expect(shouldRequireSignupInviteCode({
      NODE_ENV: "development"
    })).toBe(false);
  });

  it("validates configured invite code length", () => {
    expect(hasValidSignupInviteCodeConfig("1234567")).toBe(false);
    expect(hasValidSignupInviteCodeConfig("12345678")).toBe(true);
  });

  it("accepts only the exact case-sensitive invite code", () => {
    expect(isSignupInviteCodeAccepted("Example2026", "Example2026")).toBe(true);
    expect(isSignupInviteCodeAccepted("example2026", "Example2026")).toBe(false);
    expect(isSignupInviteCodeAccepted("Example2026 ", "Example2026")).toBe(true);
    expect(isSignupInviteCodeAccepted("wrong-code", "Example2026")).toBe(false);
  });
});
