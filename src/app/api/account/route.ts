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
import {
  clearScopedRateLimit,
  consumeScopedRateLimit
} from "@/server/services/rate-limit";

const log = apiLogger("Account");
const DELETE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DELETE_RATE_LIMIT_MAX_FAILURES = 5;
const DELETE_RATE_LIMIT_NAMESPACE = "account-delete";

function getAccountDeleteRetryAfterMs(userId: string) {
  return consumeScopedRateLimit({
    namespace: DELETE_RATE_LIMIT_NAMESPACE,
    subject: userId,
    windowMs: DELETE_RATE_LIMIT_WINDOW_MS,
    maxAttempts: DELETE_RATE_LIMIT_MAX_FAILURES
  });
}

function clearAccountDeleteFailures(userId: string) {
  return clearScopedRateLimit({
    namespace: DELETE_RATE_LIMIT_NAMESPACE,
    subject: userId
  });
}

async function validationResponse(error: AccountDeleteValidationError, ownerId: string) {
  const retryAfterMs = await getAccountDeleteRetryAfterMs(ownerId);
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

    await clearAccountDeleteFailures(ownerId);

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
