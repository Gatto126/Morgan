import { NextResponse } from "next/server";

import { authGuardResponse, requireAuth } from "@/server/auth/auth-guard";
import { apiLogger } from "@/server/logging/logger";
import {
  AccountDeleteValidationError,
  deleteAccount,
  parseAccountDeletePassword,
  verifyAccountDeletePassword
} from "@/server/services/account-deletion";
import {
  requestSecurityResponse,
  requireSameOriginMutation
} from "@/server/security/request-security";

const log = apiLogger("Account");
const DELETE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DELETE_RATE_LIMIT_MAX_FAILURES = 5;
const deleteFailureBuckets = new Map<string, number[]>();

function getAccountDeleteRetryAfterMs(userId: string) {
  const now = Date.now();
  const bucket = (deleteFailureBuckets.get(userId) ?? []).filter(
    (timestamp) => now - timestamp < DELETE_RATE_LIMIT_WINDOW_MS
  );

  if (bucket.length >= DELETE_RATE_LIMIT_MAX_FAILURES) {
    deleteFailureBuckets.set(userId, bucket);
    return DELETE_RATE_LIMIT_WINDOW_MS - (now - bucket[0]);
  }

  bucket.push(now);
  deleteFailureBuckets.set(userId, bucket);
  return null;
}

function clearAccountDeleteFailures(userId: string) {
  deleteFailureBuckets.delete(userId);
}

function validationResponse(error: AccountDeleteValidationError, ownerId: string) {
  const retryAfterMs = getAccountDeleteRetryAfterMs(ownerId);
  if (retryAfterMs !== null) {
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    return NextResponse.json(
      { error: "Too many failed account deletion attempts." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) }
      }
    );
  }

  return NextResponse.json({ error: error.message }, { status: error.status });
}

export async function DELETE(request: Request) {
  log.request("DELETE", "/api/account");

  try {
    const session = await requireAuth(request);
    const ownerId = session.user.id;
    requireSameOriginMutation(request);

    try {
      const password = await parseAccountDeletePassword(request);
      const isPasswordValid = await verifyAccountDeletePassword(ownerId, password);
      if (!isPasswordValid) {
        throw new AccountDeleteValidationError(422, "Password confirmation is invalid.");
      }
    } catch (error) {
      if (error instanceof AccountDeleteValidationError) {
        return validationResponse(error, ownerId);
      }

      throw error;
    }

    clearAccountDeleteFailures(ownerId);

    const result = await deleteAccount(ownerId);

    log.response("DELETE", "/api/account", 200, {
      success: true,
      deletedProfiles: result.deletedProfiles,
      cleanupMode: result.cleanupMode
    });

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    const securityResponse = requestSecurityResponse(error);
    if (securityResponse) return securityResponse;

    log.error("DELETE", "/api/account", error);
    return NextResponse.json({ error: "Errore durante l'eliminazione dell'account." }, { status: 500 });
  }
}
