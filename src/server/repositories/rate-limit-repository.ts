import { prisma } from "@/server/db/prisma";

export type ConsumeRateLimitInput = {
  key: string;
  windowMs: number;
  maxAttempts: number;
  nowMs?: number;
};

export type RateLimitRepository = {
  consume(input: ConsumeRateLimitInput): Promise<number | null>;
  clear(key: string): Promise<void>;
};

export const rateLimitRepository: RateLimitRepository = {
  async consume({ key, windowMs, maxAttempts, nowMs = Date.now() }) {
    return prisma.$transaction(async (tx) => {
      const record = await tx.rateLimit.findUnique({ where: { key } });
      const windowStartMs = record ? Number(record.lastRequest) : nowMs;
      const isExpired = !record || nowMs < windowStartMs || nowMs - windowStartMs >= windowMs;
      const currentCount = isExpired ? 0 : record.count;

      if (currentCount >= maxAttempts) {
        return Math.max(1, windowMs - (nowMs - windowStartMs));
      }

      if (!record) {
        await tx.rateLimit.create({
          data: {
            key,
            count: 1,
            lastRequest: BigInt(nowMs)
          }
        });
        return null;
      }

      await tx.rateLimit.update({
        where: { key },
        data: isExpired
          ? {
              count: 1,
              lastRequest: BigInt(nowMs)
            }
          : {
              count: {
                increment: 1
              }
            }
      });

      return null;
    });
  },

  async clear(key) {
    await prisma.rateLimit.deleteMany({ where: { key } });
  }
};
