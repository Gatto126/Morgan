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

function isRetryableWriteError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

export const rateLimitRepository: RateLimitRepository = {
  async consume({ key, windowMs, maxAttempts, nowMs = Date.now() }) {
    const consumeOnce = () => prisma.$transaction(async (tx) => {
      const record = await tx.rateLimit.findUnique({ where: { key } });
      const windowStartMs = record ? Number(record.lastRequest) : nowMs;
      const isExpired = !record || nowMs < windowStartMs || nowMs - windowStartMs >= windowMs;
      const currentCount = isExpired ? 0 : record.count;

      if (currentCount >= maxAttempts) {
        return Math.max(1, windowMs - (nowMs - windowStartMs));
      }

      if (!record) {
        await tx.rateLimit.upsert({
          where: { key },
          create: {
            key,
            count: 1,
            lastRequest: BigInt(nowMs)
          },
          update: {
            count: {
              increment: 1
            }
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

    try {
      return await consumeOnce();
    } catch (error) {
      if (!isRetryableWriteError(error)) {
        throw error;
      }

      return consumeOnce();
    }
  },

  async clear(key) {
    await prisma.rateLimit.deleteMany({ where: { key } });
  }
};
