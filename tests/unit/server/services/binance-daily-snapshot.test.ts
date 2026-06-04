import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  decryptBinanceCredentials: vi.fn(),
  fetchBalances: vi.fn(),
  priceBalances: vi.fn()
}));

vi.mock("@/integrations/binance/binance-service", () => ({
  fetchBalances: mocks.fetchBalances,
  priceBalances: mocks.priceBalances
}));

vi.mock("@/server/security/secrets", () => ({
  decryptBinanceCredentials: mocks.decryptBinanceCredentials
}));

import {
  createBinanceDailySnapshotForProfile,
  createBinanceDailySnapshotsForAllProfiles,
  getBinanceDailySnapshotCronDateKey,
  getBinanceDailySnapshotDateKey,
  getBinanceDailySnapshotHistory
} from "@/server/services/binance-daily-snapshot";
import type {
  BinanceDailySnapshotProfile,
  BinanceDailySnapshotRepository
} from "@/server/repositories/binance-daily-snapshot-repository";

function makeProfile(id = "user-1"): BinanceDailySnapshotProfile {
  return {
    binanceApiKeyEncrypted: "encrypted-key",
    binanceApiKeyPreview: "preview",
    binanceApiSecretEncrypted: "encrypted-secret",
    id,
    name: id
  };
}

function makeRepositoryMock() {
  const repository = {
    createSnapshot: vi.fn<BinanceDailySnapshotRepository["createSnapshot"]>(),
    findSnapshot: vi.fn<BinanceDailySnapshotRepository["findSnapshot"]>(),
    listSnapshots: vi.fn<BinanceDailySnapshotRepository["listSnapshots"]>(),
    listProfilesWithBinanceCredentials: vi.fn<BinanceDailySnapshotRepository["listProfilesWithBinanceCredentials"]>()
  } satisfies BinanceDailySnapshotRepository;

  repository.createSnapshot.mockImplementation(async (input) => ({
    created: true,
    dateKey: input.dateKey,
    id: "snapshot-1",
    snapshotAt: input.snapshotAt,
    tokenCount: input.tokens.length,
    totalEurValue: input.totalEurValue,
    userId: input.userId
  }));
  repository.findSnapshot.mockResolvedValue(null);
  repository.listSnapshots.mockResolvedValue([]);
  repository.listProfilesWithBinanceCredentials.mockResolvedValue([]);

  return repository;
}

describe("binance daily snapshot service", () => {
  beforeEach(() => {
    mocks.decryptBinanceCredentials.mockReset();
    mocks.fetchBalances.mockReset();
    mocks.priceBalances.mockReset();
  });

  it("uses the Europe/Rome date key for the daily snapshot", () => {
    expect(getBinanceDailySnapshotDateKey(new Date("2026-06-03T23:15:00.000Z")))
      .toBe("2026-06-04");
  });

  it("uses the previous Europe/Rome date key for the cron batch snapshot", () => {
    expect(getBinanceDailySnapshotCronDateKey(new Date("2026-06-03T23:15:00.000Z")))
      .toBe("2026-06-03");
  });

  it("creates a complete snapshot including dust and non-material tokens", async () => {
    const repository = makeRepositoryMock();
    const snapshotAt = new Date("2026-06-03T23:05:00.000Z");
    const credentials = { apiKey: "api-key", secret: "secret" };
    const rawBalances = new Map([
      ["BTC", { free: 0.01, locked: 0 }],
      ["DUST", { free: 100, locked: 0 }]
    ]);

    mocks.decryptBinanceCredentials.mockReturnValueOnce(credentials);
    mocks.fetchBalances.mockResolvedValueOnce(rawBalances);
    mocks.priceBalances.mockResolvedValueOnce([
      {
        eurValue: 600,
        freeAmount: 0.01,
        lockedAmount: 0,
        tokenName: "Bitcoin",
        tokenSymbol: "BTC"
      },
      {
        eurValue: 0.25,
        freeAmount: 100,
        lockedAmount: 0,
        tokenName: null,
        tokenSymbol: "DUST"
      }
    ]);

    const result = await createBinanceDailySnapshotForProfile(makeProfile(), {
      repository,
      snapshotAt
    });

    expect(result).toMatchObject({
      dateKey: "2026-06-04",
      status: "created",
      tokenCount: 2,
      totalEurValue: 600.25,
      userId: "user-1"
    });
    expect(mocks.fetchBalances).toHaveBeenCalledWith(credentials, expect.objectContaining({ repository }));
    expect(mocks.priceBalances).toHaveBeenCalledWith(rawBalances, expect.objectContaining({ repository }));
    expect(repository.createSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      dateKey: "2026-06-04",
      totalEurValue: 600.25,
      userId: "user-1"
    }));
    expect(repository.createSnapshot.mock.calls[0][0].tokens).toEqual([
      {
        eurPrice: 60_000,
        eurValue: 600,
        freeAmount: 0.01,
        lockedAmount: 0,
        tokenName: "Bitcoin",
        tokenSymbol: "BTC",
        totalAmount: 0.01
      },
      {
        eurPrice: 0.0025,
        eurValue: 0.25,
        freeAmount: 100,
        lockedAmount: 0,
        tokenName: null,
        tokenSymbol: "DUST",
        totalAmount: 100
      }
    ]);
  });

  it("skips Binance calls when the daily snapshot already exists", async () => {
    const repository = makeRepositoryMock();
    repository.findSnapshot.mockResolvedValueOnce({
      dateKey: "2026-06-03",
      id: "existing-snapshot",
      snapshotAt: new Date("2026-06-03T23:00:00.000Z"),
      tokenCount: 3,
      totalEurValue: 12.5,
      userId: "user-1"
    });

    const result = await createBinanceDailySnapshotForProfile(makeProfile(), {
      dateKey: "2026-06-03",
      repository
    });

    expect(result).toMatchObject({
      snapshotId: "existing-snapshot",
      status: "skipped-existing",
      tokenCount: 3,
      totalEurValue: 12.5
    });
    expect(mocks.decryptBinanceCredentials).not.toHaveBeenCalled();
    expect(mocks.fetchBalances).not.toHaveBeenCalled();
    expect(repository.createSnapshot).not.toHaveBeenCalled();
  });

  it("continues the batch when one profile fails", async () => {
    const repository = makeRepositoryMock();
    repository.listProfilesWithBinanceCredentials.mockResolvedValueOnce([
      makeProfile("user-1"),
      makeProfile("user-2")
    ]);
    repository.createSnapshot.mockImplementation(async (input) => ({
      created: true,
      dateKey: input.dateKey,
      id: `snapshot-${input.userId}`,
      snapshotAt: input.snapshotAt,
      tokenCount: input.tokens.length,
      totalEurValue: input.totalEurValue,
      userId: input.userId
    }));

    mocks.decryptBinanceCredentials.mockReturnValue({ apiKey: "api-key", secret: "secret" });
    mocks.fetchBalances
      .mockRejectedValueOnce(new Error("Binance offline"))
      .mockResolvedValueOnce(new Map([["ETH", { free: 1, locked: 0 }]]));
    mocks.priceBalances.mockResolvedValueOnce([
      {
        eurValue: 3000,
        freeAmount: 1,
        lockedAmount: 0,
        tokenName: "Ethereum",
        tokenSymbol: "ETH"
      }
    ]);

    const result = await createBinanceDailySnapshotsForAllProfiles({
      now: () => new Date("2026-06-03T23:10:00.000Z"),
      repository
    });

    expect(result).toMatchObject({
      created: 1,
      dateKey: "2026-06-03",
      failed: 1,
      skippedExisting: 0,
      totalProfiles: 2
    });
    expect(result.results.map((profileResult) => profileResult.status))
      .toEqual(["failed", "created"]);
    expect(repository.createSnapshot).toHaveBeenCalledTimes(1);
  });

  it("returns historical snapshots normalized for the client chart", async () => {
    const repository = makeRepositoryMock();
    repository.listSnapshots.mockResolvedValueOnce([
      {
        dateKey: "2026-06-04",
        id: "snapshot-1",
        snapshotAt: new Date("2026-06-03T23:00:00.000Z"),
        tokenCount: 9,
        totalEurValue: 2311.23,
        userId: "user-1"
      }
    ]);

    await expect(getBinanceDailySnapshotHistory("user-1", { repository })).resolves.toEqual([
      {
        dateKey: "2026-06-04",
        snapshotAt: "2026-06-03T23:00:00.000Z",
        tokenCount: 9,
        totalEurValue: 2311.23
      }
    ]);
    expect(repository.listSnapshots).toHaveBeenCalledWith("user-1");
  });
});
