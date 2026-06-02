import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchBalances: vi.fn(),
  priceBalances: vi.fn(),
  decryptBinanceCredentials: vi.fn(),
  hasBinanceCredentials: vi.fn((user: { binanceApiKeyEncrypted?: string | null; binanceApiSecretEncrypted?: string | null } | null) =>
    !!(user?.binanceApiKeyEncrypted && user?.binanceApiSecretEncrypted)
  )
}));

vi.mock("@/integrations/binance/binance-service", () => ({
  fetchBalances: mocks.fetchBalances,
  priceBalances: mocks.priceBalances
}));

vi.mock("@/server/security/secrets", () => ({
  decryptBinanceCredentials: mocks.decryptBinanceCredentials,
  hasBinanceCredentials: mocks.hasBinanceCredentials
}));

import {
  BinanceMissingCredentialsError,
  getBinanceBalancesStatus,
  persistBalances,
  syncBinanceProfile,
  type PersistedBinanceBalance
} from "@/server/services/binance-sync";
import type {
  BinanceBalanceStatusRecords,
  BinanceCredentialRecord,
  BinanceRepository
} from "@/server/repositories/binance-repository";

function makeRepositoryMock(persistedBalances: PersistedBinanceBalance[] = []) {
  const getCredentialRecord = vi.fn<(...args: unknown[]) => Promise<BinanceCredentialRecord>>(async () => null);
  const listBalances = vi.fn(async () => persistedBalances);
  const upsertBalance = vi.fn(async () => undefined);
  const deleteInactiveBalances = vi.fn(async () => undefined);
  const upsertSyncTimestamp = vi.fn(async () => undefined);
  const getBalanceStatusRecords = vi.fn<(...args: unknown[]) => Promise<BinanceBalanceStatusRecords>>(async () => ({
    balances: persistedBalances,
    syncTimestamp: null,
    credentialRecord: null
  }));

  const repository = {
    getCredentialRecord,
    listBalances,
    upsertBalance,
    deleteInactiveBalances,
    upsertSyncTimestamp,
    getBalanceStatusRecords
  } satisfies BinanceRepository;

  return {
    repository,
    getCredentialRecord,
    listBalances,
    upsertBalance,
    deleteInactiveBalances,
    upsertSyncTimestamp,
    getBalanceStatusRecords
  };
}

describe("binance sync service", () => {
  beforeEach(() => {
    mocks.fetchBalances.mockReset();
    mocks.priceBalances.mockReset();
    mocks.decryptBinanceCredentials.mockReset();
    mocks.hasBinanceCredentials.mockClear();
  });

  it("persists balances, removes inactive tokens and records the sync timestamp", async () => {
    const syncedAt = new Date("2026-01-02T03:04:05.000Z");
    const persistedBalance: PersistedBinanceBalance = {
      id: "balance-1",
      userId: "user-1",
      tokenSymbol: "BTC",
      tokenName: "Bitcoin",
      freeAmount: 1,
      lockedAmount: 0.5,
      eurValue: 45_000,
      updatedAt: syncedAt
    };
    const {
      repository,
      upsertBalance,
      deleteInactiveBalances,
      listBalances,
      upsertSyncTimestamp
    } = makeRepositoryMock([
      persistedBalance
    ]);

    const result = await persistBalances(
      "user-1",
      [
        {
          tokenSymbol: "BTC",
          tokenName: "Bitcoin",
          freeAmount: 1,
          lockedAmount: 0.5,
          eurValue: 45_000
        },
        {
          tokenSymbol: "DUST",
          tokenName: "Dust",
          freeAmount: 20,
          lockedAmount: 0,
          eurValue: 0.25
        }
      ],
      { repository, now: () => syncedAt }
    );

    expect(upsertBalance).toHaveBeenCalledTimes(1);
    expect(upsertBalance).toHaveBeenCalledWith("user-1", {
      tokenSymbol: "BTC",
      tokenName: "Bitcoin",
      freeAmount: 1,
      lockedAmount: 0.5,
      eurValue: 45_000
    });
    expect(deleteInactiveBalances).toHaveBeenCalledWith("user-1", ["BTC"]);
    expect(upsertSyncTimestamp).toHaveBeenCalledWith("user-1", syncedAt);
    expect(listBalances).toHaveBeenCalledWith("user-1");
    expect(result).toEqual({ balances: [persistedBalance], syncedAt });
  });

  it("clears all user Binance balances and still records sync time for empty wallets", async () => {
    const syncedAt = new Date("2026-01-03T00:00:00.000Z");
    const { repository, upsertBalance, deleteInactiveBalances, upsertSyncTimestamp } = makeRepositoryMock();

    await persistBalances("user-1", [], { repository, now: () => syncedAt });

    expect(upsertBalance).not.toHaveBeenCalled();
    expect(deleteInactiveBalances).toHaveBeenCalledWith("user-1", []);
    expect(upsertSyncTimestamp).toHaveBeenCalledWith("user-1", syncedAt);
  });

  it("loads credentials, prices balances and persists a profile sync", async () => {
    const syncedAt = new Date("2026-01-04T00:00:00.000Z");
    const persistedBalance: PersistedBinanceBalance = {
      id: "balance-1",
      userId: "user-1",
      tokenSymbol: "ETH",
      tokenName: "Ethereum",
      freeAmount: 2,
      lockedAmount: 0,
      eurValue: 4_000,
      updatedAt: syncedAt
    };
    const { repository, getCredentialRecord } = makeRepositoryMock([persistedBalance]);
    const credentials = { apiKey: "api-key", secret: "secret" };
    const rawBalances = new Map([["ETH", { free: 2, locked: 0 }]]);
    const pricedBalances = [{
      tokenSymbol: "ETH",
      tokenName: "Ethereum",
      freeAmount: 2,
      lockedAmount: 0,
      eurValue: 4_000
    }];

    getCredentialRecord.mockResolvedValueOnce({ binanceApiKeyEncrypted: "key", binanceApiSecretEncrypted: "secret" });
    mocks.decryptBinanceCredentials.mockReturnValueOnce(credentials);
    mocks.fetchBalances.mockResolvedValueOnce(rawBalances);
    mocks.priceBalances.mockResolvedValueOnce(pricedBalances);

    const result = await syncBinanceProfile("user-1", { repository, now: () => syncedAt });

    expect(getCredentialRecord).toHaveBeenCalledWith("user-1");
    expect(mocks.decryptBinanceCredentials).toHaveBeenCalledWith({
      binanceApiKeyEncrypted: "key",
      binanceApiSecretEncrypted: "secret"
    });
    expect(mocks.fetchBalances).toHaveBeenCalledWith(credentials, {
      repository,
      now: expect.any(Function)
    });
    expect(mocks.priceBalances).toHaveBeenCalledWith(rawBalances, {
      repository,
      now: expect.any(Function)
    });
    expect(result).toEqual({ balances: [persistedBalance], syncedAt });
  });

  it("rejects profile sync when credentials are missing", async () => {
    const { repository, getCredentialRecord } = makeRepositoryMock();
    getCredentialRecord.mockResolvedValueOnce({ binanceApiKeyEncrypted: null, binanceApiSecretEncrypted: null });
    mocks.decryptBinanceCredentials.mockReturnValueOnce(null);

    await expect(syncBinanceProfile("user-1", { repository }))
      .rejects.toBeInstanceOf(BinanceMissingCredentialsError);
    expect(mocks.fetchBalances).not.toHaveBeenCalled();
  });

  it("returns cached balances status and stale state", async () => {
    const syncedAt = new Date("2026-01-01T00:00:00.000Z");
    const { repository, getBalanceStatusRecords } = makeRepositoryMock();
    getBalanceStatusRecords.mockResolvedValueOnce({
      balances: [
        {
          id: "balance-1",
          userId: "user-1",
          tokenSymbol: "BTC",
          tokenName: "Bitcoin",
          freeAmount: 1,
          lockedAmount: 0,
          eurValue: 30_000,
          updatedAt: syncedAt
        },
        {
          id: "balance-2",
          userId: "user-1",
          tokenSymbol: "DUST",
          tokenName: "Dust",
          freeAmount: 20,
          lockedAmount: 0,
          eurValue: 0.25,
          updatedAt: syncedAt
        }
      ],
      syncTimestamp: syncedAt,
      credentialRecord: {
        binanceApiKeyEncrypted: "key",
        binanceApiSecretEncrypted: "secret"
      }
    });

    const result = await getBinanceBalancesStatus("user-1", {
      repository,
      now: () => new Date("2026-01-01T00:09:59.000Z")
    });

    expect(result).toEqual({
      balances: [{
        id: "balance-1",
        userId: "user-1",
        tokenSymbol: "BTC",
        tokenName: "Bitcoin",
        freeAmount: 1,
        lockedAmount: 0,
        eurValue: 30_000,
        updatedAt: syncedAt
      }],
      syncedAt,
      isStale: false,
      hasApiKey: true
    });
    expect(getBalanceStatusRecords).toHaveBeenCalledWith("user-1");
  });
});
