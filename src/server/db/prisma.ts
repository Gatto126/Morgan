import "server-only";

import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });
}

export const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
