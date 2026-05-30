import { describe, expect, it } from "vitest";

import {
  getLocalPasswordPolicyHint,
  hasLocalPasswordInput,
  isValidLocalEmail,
  isValidLocalPassword,
  normalizeLocalEmail,
} from "@/domain/auth/local-auth";

describe("local auth helpers", () => {
  it("normalizes and validates email addresses", () => {
    expect(normalizeLocalEmail(" Luca.Example+Morgan@Example.COM ")).toBe("luca.example+morgan@example.com");
    expect(isValidLocalEmail("luca@example.com")).toBe(true);
    expect(isValidLocalEmail("luca@example")).toBe(false);
    expect(isValidLocalEmail("luca example@example.com")).toBe(false);
  });

  it("accepts long passphrases with spaces and symbols", () => {
    expect(isValidLocalPassword("correct horse battery staple!")).toBe(true);
    expect(isValidLocalPassword("Symbols are fine: #42")).toBe(true);
  });

  it("rejects short or empty passwords for new accounts", () => {
    expect(isValidLocalPassword("Secret1")).toBe(false);
    expect(isValidLocalPassword("               ")).toBe(false);
    expect(isValidLocalPassword("a".repeat(129))).toBe(false);
  });

  it("allows bounded password input for legacy sign-ins", () => {
    expect(hasLocalPasswordInput("Secret1")).toBe(true);
    expect(hasLocalPasswordInput("")).toBe(false);
    expect(hasLocalPasswordInput("a".repeat(129))).toBe(false);
  });

  it("describes the current password policy", () => {
    expect(getLocalPasswordPolicyHint()).toBe(
      "15-128 characters; spaces and symbols allowed"
    );
  });
});
