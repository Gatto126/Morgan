import "server-only";

import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/server/db/prisma";
import {
  getAuthDeploymentWarnings,
  getIpAddressHeaders,
  getTrustedOrigins,
  shouldUseSecureCookies
} from "@/server/security/auth-config";
import {
  isSignupInviteCodeAccepted,
  shouldRequireSignupInviteCode
} from "@/server/security/signup-invite";
import { getDatabaseProvider } from "@/server/db/database-provider";
import {
  LOCAL_PASSWORD_MAX_LENGTH,
  LOCAL_PASSWORD_MIN_LENGTH,
  hasLocalPasswordInput,
  isValidLocalEmail,
  isValidLocalPassword,
  normalizeLocalEmail
} from "@/domain/auth/local-auth";

const authConfigWarningState = globalThis as typeof globalThis & {
  __morganAuthConfigWarningsEmitted?: boolean;
};
const isNextProductionBuild =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.NEXT_PRIVATE_BUILD_WORKER === "1";

if (!isNextProductionBuild && !authConfigWarningState.__morganAuthConfigWarningsEmitted) {
  authConfigWarningState.__morganAuthConfigWarningsEmitted = true;
  const deploymentWarnings = getAuthDeploymentWarnings();

  if (process.env.NODE_ENV === "production" && deploymentWarnings.length > 0) {
    throw new Error(`Invalid production deployment configuration:\n- ${deploymentWarnings.join("\n- ")}`);
  }

  for (const warning of deploymentWarnings) {
    console.warn(`[auth-config] ${warning}`);
  }
}

function assertPassword(password: unknown, path: string) {
  if (typeof password !== "string") {
    throw new APIError("BAD_REQUEST", {
      message: "Password is required."
    });
  }

  if (path === "/sign-in/email" && !hasLocalPasswordInput(password)) {
    throw new APIError("BAD_REQUEST", {
      message: `Password must be between 1 and ${LOCAL_PASSWORD_MAX_LENGTH} characters.`
    });
  }

  if (path === "/sign-up/email" && !isValidLocalPassword(password)) {
    throw new APIError("BAD_REQUEST", {
      message: `Password must be between ${LOCAL_PASSWORD_MIN_LENGTH} and ${LOCAL_PASSWORD_MAX_LENGTH} characters.`
    });
  }
}

function assertSignupInviteCode(inviteCode: unknown) {
  if (!shouldRequireSignupInviteCode()) {
    return;
  }

  if (!isSignupInviteCodeAccepted(inviteCode, process.env.MORGAN_SIGNUP_INVITE_CODE)) {
    throw new APIError("FORBIDDEN", {
      message: "Invalid invite code."
    });
  }
}

function normalizeAuthBody(body: unknown, path: string) {
  if (!body || typeof body !== "object") return;

  const payload = body as {
    email?: unknown;
    inviteCode?: unknown;
    name?: unknown;
    password?: unknown;
  };

  assertPassword(payload.password, path);

  if (path === "/sign-in/email" || path === "/sign-up/email") {
    if (typeof payload.email !== "string" || !isValidLocalEmail(payload.email)) {
      throw new APIError("BAD_REQUEST", {
        message: "Valid email is required."
      });
    }

    payload.email = normalizeLocalEmail(payload.email);
  }

  if (path === "/sign-up/email") {
    assertSignupInviteCode(payload.inviteCode);
    delete payload.inviteCode;

    if (typeof payload.name !== "string" || payload.name.trim().length === 0) {
      payload.name = payload.email;
    } else {
      payload.name = payload.name.trim();
    }
  }
}

export const auth = betterAuth({
  appName: "Morgan",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: getTrustedOrigins(),
  advanced: {
    useSecureCookies: shouldUseSecureCookies(),
    ipAddress: {
      ipAddressHeaders: getIpAddressHeaders()
    }
  },
  database: prismaAdapter(prisma, {
    provider: getDatabaseProvider()
  }),
  user: {
    modelName: "authUser"
  },
  session: {
    modelName: "authSession"
  },
  account: {
    modelName: "authAccount"
  },
  verification: {
    modelName: "authVerification"
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: LOCAL_PASSWORD_MIN_LENGTH,
    maxPasswordLength: LOCAL_PASSWORD_MAX_LENGTH,
    requireEmailVerification: false
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 120,
    customRules: {
      "/sign-in/email": {
        window: 5 * 60,
        max: 5
      },
      "/sign-up/email": {
        window: 10 * 60,
        max: 3
      },
      "/verify-password": {
        window: 5 * 60,
        max: 5
      },
      "/change-password": {
        window: 5 * 60,
        max: 5
      }
    }
  },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path === "/sign-up/email" || context.path === "/sign-in/email") {
        normalizeAuthBody(context.body, context.path);
      }
    })
  },
  plugins: [
    nextCookies()
  ]
});
