import "server-only";

import { timingSafeEqual } from "node:crypto";

export const SIGNUP_INVITE_CODE_MIN_LENGTH = 8;

export function hasValidSignupInviteCodeConfig(value: string | undefined) {
  return (value ?? "").trim().length >= SIGNUP_INVITE_CODE_MIN_LENGTH;
}

export function shouldRequireSignupInviteCode(env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV === "production" || Boolean(env.MORGAN_SIGNUP_INVITE_CODE?.trim());
}

export function isSignupInviteCodeAccepted(input: unknown, configuredCode: string | undefined) {
  const expected = (configuredCode ?? "").trim();
  if (!hasValidSignupInviteCodeConfig(expected) || typeof input !== "string") {
    return false;
  }

  const candidate = input.trim();
  if (candidate.length === 0) {
    return false;
  }

  const candidateBuffer = Buffer.from(candidate, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (candidateBuffer.length !== expectedBuffer.length) {
    timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }

  return timingSafeEqual(candidateBuffer, expectedBuffer);
}
