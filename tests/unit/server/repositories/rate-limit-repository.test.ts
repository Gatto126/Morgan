import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    rateLimit: {
      deleteMany: mocks.deleteMany
    }
  }
}));

import { rateLimitRepository } from "@/server/repositories/rate-limit-repository";

describe("rate limit repository", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        rateLimit: {
          findUnique: mocks.findUnique,
          create: mocks.create,
          upsert: mocks.upsert,
          update: mocks.update
        }
      })
    );
    mocks.create.mockResolvedValue({});
    mocks.upsert.mockResolvedValue({});
    mocks.update.mockResolvedValue({});
    mocks.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("creates a bucket for the first allowed attempt", async () => {
    mocks.findUnique.mockResolvedValueOnce(null);

    await expect(rateLimitRepository.consume({
      key: "morgan:test:user-1",
      windowMs: 1000,
      maxAttempts: 2,
      nowMs: 100
    })).resolves.toBeNull();

    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { key: "morgan:test:user-1" },
      create: {
        key: "morgan:test:user-1",
        count: 1,
        lastRequest: BigInt(100)
      },
      update: {
        count: {
          increment: 1
        }
      }
    });
  });

  it("retries after a retryable write conflict", async () => {
    mocks.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        key: "morgan:test:user-1",
        count: 1,
        lastRequest: BigInt(100)
      });
    mocks.upsert.mockRejectedValueOnce({ code: "P2034" });

    await expect(rateLimitRepository.consume({
      key: "morgan:test:user-1",
      windowMs: 1000,
      maxAttempts: 3,
      nowMs: 100
    })).resolves.toBeNull();

    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { key: "morgan:test:user-1" },
      data: {
        count: {
          increment: 1
        }
      }
    });
  });

  it("returns retry time when the bucket is full", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      key: "morgan:test:user-1",
      count: 2,
      lastRequest: BigInt(100)
    });

    await expect(rateLimitRepository.consume({
      key: "morgan:test:user-1",
      windowMs: 1000,
      maxAttempts: 2,
      nowMs: 400
    })).resolves.toBe(700);

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("resets an expired bucket", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      key: "morgan:test:user-1",
      count: 2,
      lastRequest: BigInt(100)
    });

    await expect(rateLimitRepository.consume({
      key: "morgan:test:user-1",
      windowMs: 1000,
      maxAttempts: 2,
      nowMs: 1100
    })).resolves.toBeNull();

    expect(mocks.update).toHaveBeenCalledWith({
      where: { key: "morgan:test:user-1" },
      data: {
        count: 1,
        lastRequest: BigInt(1100)
      }
    });
  });

  it("clears a namespaced bucket", async () => {
    await rateLimitRepository.clear("morgan:test:user-1");

    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { key: "morgan:test:user-1" }
    });
  });
});
