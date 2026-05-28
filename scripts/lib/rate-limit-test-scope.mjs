import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const LOCAL_DATABASE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "postgres",
  "morgan-postgres"
]);

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const equalsIndex = trimmed.indexOf("=");
  if (equalsIndex === -1) return null;

  const key = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();

  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function readEnvFileValues(envFilePath = ".env") {
  const envPath = path.resolve(process.cwd(), envFilePath);
  const values = {};

  try {
    const contents = fs.readFileSync(envPath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (parsed) {
        values[parsed.key] = parsed.value;
      }
    }
  } catch {
    // Missing .env is fine; callers may provide DATABASE_URL through process.env.
  }

  return values;
}

function readEnvFileValue(key, envFilePath = ".env") {
  return readEnvFileValues(envFilePath)[key] ?? null;
}

export function applyEnvFileDatabaseUrl(envFilePath = ".env") {
  if (process.env.MORGAN_USE_PROCESS_DATABASE_URL === "1") {
    return false;
  }

  const values = readEnvFileValues(envFilePath);
  if (typeof values.DATABASE_URL !== "string" && typeof values.SQLITE_DATABASE_URL !== "string") {
    return false;
  }

  if (typeof values.DATABASE_URL === "string") {
    process.env.DATABASE_URL = values.DATABASE_URL;
  }
  if (typeof values.SQLITE_DATABASE_URL === "string") {
    process.env.SQLITE_DATABASE_URL = values.SQLITE_DATABASE_URL;
  }
  if (typeof values.MORGAN_DATABASE_PROVIDER === "string") {
    process.env.MORGAN_DATABASE_PROVIDER = values.MORGAN_DATABASE_PROVIDER;
  }
  if (typeof values.DIRECT_URL === "string") {
    process.env.DIRECT_URL = values.DIRECT_URL;
  }

  return true;
}

function resolveDatabaseUrl(databaseUrl = process.env.DATABASE_URL ?? process.env.SQLITE_DATABASE_URL) {
  return databaseUrl || readEnvFileValue("DATABASE_URL") || readEnvFileValue("SQLITE_DATABASE_URL");
}

function isLocalDatabaseUrl(databaseUrl) {
  if (databaseUrl.startsWith("file:")) {
    return true;
  }

  try {
    const url = new URL(databaseUrl);
    if (url.protocol === "file:") {
      return true;
    }
    return LOCAL_DATABASE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function assertSafeRateLimitReset(options = {}) {
  const databaseUrl = resolveDatabaseUrl(options.databaseUrl);
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const isCi = options.ci ?? process.env.CI;
  const explicitAllow = (options.allowTestReset ?? process.env.MORGAN_ALLOW_TEST_RESET) === "1";

  if (nodeEnv === "production") {
    throw new Error("Refusing to reset rate limits while NODE_ENV=production.");
  }

  if (explicitAllow) {
    return {
      databaseUrl,
      mode: "explicit"
    };
  }

  if (!databaseUrl) {
    throw new Error("Refusing to reset rate limits without DATABASE_URL, SQLITE_DATABASE_URL or MORGAN_ALLOW_TEST_RESET=1.");
  }

  if (isCi === "true") {
    throw new Error("Refusing to reset rate limits in CI without MORGAN_ALLOW_TEST_RESET=1.");
  }

  if (!isLocalDatabaseUrl(databaseUrl)) {
    throw new Error("Refusing to reset rate limits for a non-local database without MORGAN_ALLOW_TEST_RESET=1.");
  }

  return {
    databaseUrl,
    mode: "local"
  };
}

export async function snapshotAndClearRateLimits(options = {}) {
  assertSafeRateLimitReset(options);

  const prisma = options.prisma ?? new PrismaClient();
  const ownsClient = !options.prisma;

  try {
    const rows = await prisma.rateLimit.findMany();
    await prisma.rateLimit.deleteMany();
    return rows;
  } finally {
    if (ownsClient) {
      await prisma.$disconnect();
    }
  }
}

export async function restoreRateLimits(rows, options = {}) {
  assertSafeRateLimitReset(options);

  const prisma = options.prisma ?? new PrismaClient();
  const ownsClient = !options.prisma;

  try {
    await prisma.rateLimit.deleteMany();
    if (rows.length > 0) {
      await prisma.rateLimit.createMany({ data: rows });
    }
  } finally {
    if (ownsClient) {
      await prisma.$disconnect();
    }
  }
}

export async function clearRateLimitsForTest(options = {}) {
  const safety = assertSafeRateLimitReset(options);

  const prisma = options.prisma ?? new PrismaClient();
  const ownsClient = !options.prisma;

  try {
    const result = await prisma.rateLimit.deleteMany();
    return {
      deletedCount: result.count,
      safetyMode: safety.mode
    };
  } finally {
    if (ownsClient) {
      await prisma.$disconnect();
    }
  }
}
