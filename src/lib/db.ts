import "server-only";

import path from "node:path";

import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function resolveSqliteUrl(url: string) {
  if (!url.startsWith("file:")) {
    return url;
  }

  const sqlitePath = url.slice(5);

  if (!sqlitePath.startsWith("./")) {
    return url;
  }

  const absolutePath = path.join(process.cwd(), "prisma", sqlitePath.slice(2)).replaceAll("\\", "/");
  return `file:${absolutePath}`;
}

const connectionString = resolveSqliteUrl(process.env.SQLITE_DATABASE_URL ?? "file:./dev.db");

// timeout: how long better-sqlite3 waits when DB is locked before throwing
// (default is 5 000 ms — raise to 15 s to survive post-import parallel reads)
const adapter = new PrismaBetterSQLite3({ url: connectionString, options: { timeout: 15_000 } });

function createPrismaClient() {
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

  // WAL mode: allows concurrent readers while a writer is active
  client.$executeRawUnsafe("PRAGMA journal_mode=WAL").catch(() => {});
  client.$executeRawUnsafe("PRAGMA synchronous=NORMAL").catch(() => {});

  return client;
}

export const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
