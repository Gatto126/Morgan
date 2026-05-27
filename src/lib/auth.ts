import "server-only";

import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";

import { prisma } from "@/lib/db";
import {
  LOCAL_PASSWORD_MAX_LENGTH,
  LOCAL_PASSWORD_MIN_LENGTH,
  hasLocalPasswordInput,
  isValidLocalPassword,
  isValidLocalUsername,
  localUsernameToEmail,
  normalizeLocalUsername
} from "@/lib/local-auth";

function assertPassword(password: unknown, path: string) {
  if (typeof password !== "string") {
    throw new APIError("BAD_REQUEST", {
      message: "Password is required."
    });
  }

  if (path === "/sign-in/username" && !hasLocalPasswordInput(password)) {
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

function normalizeAuthBody(body: unknown, path: string) {
  if (!body || typeof body !== "object") return;

  const payload = body as {
    username?: unknown;
    displayUsername?: unknown;
    email?: unknown;
    name?: unknown;
    password?: unknown;
  };

  assertPassword(payload.password, path);

  if (path === "/sign-up/email" && typeof payload.username !== "string") {
    throw new APIError("BAD_REQUEST", {
      message: "Username is required."
    });
  }

  if (typeof payload.username === "string") {
    const normalizedUsername = normalizeLocalUsername(payload.username);
    if (!isValidLocalUsername(normalizedUsername)) {
      throw new APIError("BAD_REQUEST", {
        message: "Invalid username."
      });
    }
    payload.username = normalizedUsername;

    const displayName = typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : normalizedUsername;
    payload.name = displayName;

    if (typeof payload.displayUsername !== "string") {
      payload.displayUsername = displayName;
    }

    if ("email" in payload) {
      payload.email = localUsernameToEmail(normalizedUsername);
    }
  }
}

function getTrustedOrigins() {
  const configuredOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const origins = new Set<string>([
    process.env.BETTER_AUTH_URL,
    ...configuredOrigins
  ].filter((origin): origin is string => Boolean(origin)));

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
    origins.add("http://192.168.*.*:3000");
  }

  return Array.from(origins);
}

function getIpAddressHeaders() {
  const configuredHeaders = (
    process.env.BETTER_AUTH_IP_HEADERS ??
    process.env.TRUSTED_IP_HEADERS ??
    ""
  )
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);

  return configuredHeaders.length > 0 ? configuredHeaders : ["x-forwarded-for"];
}

export const auth = betterAuth({
  appName: "Morgan",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: getTrustedOrigins(),
  advanced: {
    ipAddress: {
      ipAddressHeaders: getIpAddressHeaders()
    }
  },
  database: prismaAdapter(prisma, {
    provider: "sqlite"
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
      "/sign-in/username": {
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
      if (context.path === "/sign-up/email" || context.path === "/sign-in/username") {
        normalizeAuthBody(context.body, context.path);
      }
    })
  },
  plugins: [
    username({
      minUsernameLength: 2,
      maxUsernameLength: 24,
      usernameValidator: isValidLocalUsername,
      usernameNormalization: normalizeLocalUsername
    }),
    nextCookies()
  ]
});
