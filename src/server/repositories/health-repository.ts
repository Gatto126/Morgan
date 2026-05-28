import { prisma } from "@/server/db/prisma";

export type HealthRepository = {
  checkDatabase(): Promise<void>;
};

export const healthRepository: HealthRepository = {
  async checkDatabase() {
    await prisma.$queryRaw`SELECT 1`;
  }
};
