import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listByOwner: vi.fn(),
  findByOwner: vi.fn(),
  findByOwnerAndName: vi.fn(),
  create: vi.fn(),
  listInvestmentIsins: vi.fn(),
  listOtherInvestmentIsins: vi.fn(),
  listCryptoTokens: vi.fn(),
  listBinanceTokens: vi.fn(),
  listOtherCryptoTokens: vi.fn(),
  listOtherBinanceTokens: vi.fn(),
  deleteAssetHistory: vi.fn(),
  deleteAssets: vi.fn(),
  deleteCryptoAssets: vi.fn(),
  deletePriceCache: vi.fn(),
  deleteBinanceBalances: vi.fn(),
  deleteBinanceDailySnapshots: vi.fn(),
  deleteProfile: vi.fn(),
  updateBinanceCredentials: vi.fn(),
  invalidateProfileStageSnapshots: vi.fn(),
  encryptSecret: vi.fn((value: string | null | undefined) => value ? `encrypted:${value.trim()}` : null),
  makeBinanceApiKeyPreview: vi.fn((value: string | null | undefined) => value ? `${value.trim().slice(0, 8)}...` : null)
}));

vi.mock("@/server/repositories/profile-repository", () => ({
  profileRepository: {
    listByOwner: mocks.listByOwner,
    findByOwner: mocks.findByOwner,
    findByOwnerAndName: mocks.findByOwnerAndName,
    create: mocks.create,
    listInvestmentIsins: mocks.listInvestmentIsins,
    listOtherInvestmentIsins: mocks.listOtherInvestmentIsins,
    listCryptoTokens: mocks.listCryptoTokens,
    listBinanceTokens: mocks.listBinanceTokens,
    listOtherCryptoTokens: mocks.listOtherCryptoTokens,
    listOtherBinanceTokens: mocks.listOtherBinanceTokens,
    deleteAssetHistory: mocks.deleteAssetHistory,
    deleteAssets: mocks.deleteAssets,
    deleteCryptoAssets: mocks.deleteCryptoAssets,
    deletePriceCache: mocks.deletePriceCache,
    deleteBinanceBalances: mocks.deleteBinanceBalances,
    deleteBinanceDailySnapshots: mocks.deleteBinanceDailySnapshots,
    deleteProfile: mocks.deleteProfile,
    updateBinanceCredentials: mocks.updateBinanceCredentials
  }
}));

vi.mock("@/server/security/secrets", () => ({
  encryptSecret: mocks.encryptSecret,
  makeBinanceApiKeyPreview: mocks.makeBinanceApiKeyPreview,
  hasBinanceCredentials: (user: { binanceApiKeyEncrypted?: string | null; binanceApiSecretEncrypted?: string | null }) =>
    !!(user.binanceApiKeyEncrypted && user.binanceApiSecretEncrypted),
  getBinanceApiKeyPreview: (user: { binanceApiKeyPreview?: string | null }) => user.binanceApiKeyPreview ?? null
}));

vi.mock("@/server/services/profile-stage-snapshot", () => ({
  invalidateProfileStageSnapshots: mocks.invalidateProfileStageSnapshots
}));

import {
  createProfile,
  deleteProfile,
  getProfile,
  listProfiles,
  ProfileBadRequestError,
  ProfileConflictError,
  ProfileNotFoundError,
  updateProfileBinanceSettings
} from "@/server/services/profile-service";

const profile = {
  id: "profile-1",
  ownerId: "owner-1",
  name: "Main",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  binanceApiKeyEncrypted: null,
  binanceApiSecretEncrypted: null,
  binanceApiKeyPreview: null
};

describe("profile service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockClear();
    }

    mocks.listByOwner.mockResolvedValue([]);
    mocks.findByOwner.mockResolvedValue(null);
    mocks.findByOwnerAndName.mockResolvedValue(null);
    mocks.create.mockResolvedValue(profile);
    mocks.listInvestmentIsins.mockResolvedValue([]);
    mocks.listOtherInvestmentIsins.mockResolvedValue([]);
    mocks.listCryptoTokens.mockResolvedValue([]);
    mocks.listBinanceTokens.mockResolvedValue([]);
    mocks.listOtherCryptoTokens.mockResolvedValue([]);
    mocks.listOtherBinanceTokens.mockResolvedValue([]);
    mocks.deleteAssetHistory.mockResolvedValue(undefined);
    mocks.deleteAssets.mockResolvedValue(undefined);
    mocks.deleteCryptoAssets.mockResolvedValue(undefined);
    mocks.deletePriceCache.mockResolvedValue(undefined);
    mocks.deleteBinanceBalances.mockResolvedValue(undefined);
    mocks.deleteBinanceDailySnapshots.mockResolvedValue(undefined);
    mocks.deleteProfile.mockResolvedValue(undefined);
    mocks.updateBinanceCredentials.mockResolvedValue(profile);
    mocks.invalidateProfileStageSnapshots.mockResolvedValue(undefined);
  });

  it("lists owned profiles with transaction counts", async () => {
    mocks.listByOwner.mockResolvedValueOnce([
      {
        ...profile,
        _count: {
          checkingTransactions: 2,
          investmentTransactions: 3,
          cryptoTransactions: 5
        }
      }
    ]);

    const users = await listProfiles("owner-1");

    expect(users).toEqual([
      expect.objectContaining({
        id: "profile-1",
        name: "Main",
        transactionCount: 10,
        checkingCount: 2,
        investmentCount: 3,
        cryptoCount: 5
      })
    ]);
    expect(mocks.listByOwner).toHaveBeenCalledWith("owner-1");
  });

  it("creates a profile and returns the refreshed list", async () => {
    mocks.listByOwner.mockResolvedValueOnce([
      {
        ...profile,
        _count: {
          checkingTransactions: 0,
          investmentTransactions: 0,
          cryptoTransactions: 0
        }
      }
    ]);

    const result = await createProfile("owner-1", { name: " Main " });

    expect(mocks.findByOwnerAndName).toHaveBeenCalledWith("owner-1", "Main");
    expect(mocks.create).toHaveBeenCalledWith("owner-1", "Main");
    expect(result.user).toMatchObject({
      id: "profile-1",
      transactionCount: 0
    });
    expect(result.users).toHaveLength(1);
  });

  it("rejects duplicate profile names", async () => {
    mocks.findByOwnerAndName.mockResolvedValueOnce(profile);

    await expect(createProfile("owner-1", { name: "Main" })).rejects.toBeInstanceOf(ProfileConflictError);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns a safe owned profile or not found", async () => {
    mocks.findByOwner.mockResolvedValueOnce({
      ...profile,
      binanceApiKeyEncrypted: "encrypted-key",
      binanceApiSecretEncrypted: "encrypted-secret",
      binanceApiKeyPreview: "apikey12..."
    });

    await expect(getProfile("owner-1", "profile-1")).resolves.toMatchObject({
      id: "profile-1",
      hasBinanceCredentials: true,
      binanceApiKeyPreview: "apikey12..."
    });

    mocks.findByOwner.mockResolvedValueOnce(null);
    await expect(getProfile("owner-1", "missing")).rejects.toBeInstanceOf(ProfileNotFoundError);
  });

  it("updates Binance credentials only when key and secret are provided together", async () => {
    await expect(updateProfileBinanceSettings("profile-1", { apiKey: "only-key" }))
      .rejects.toBeInstanceOf(ProfileBadRequestError);
    expect(mocks.updateBinanceCredentials).not.toHaveBeenCalled();

    await updateProfileBinanceSettings("profile-1", {
      apiKey: "abcdefgh123",
      apiSecret: "secret-value"
    });

    expect(mocks.updateBinanceCredentials).toHaveBeenCalledWith("profile-1", {
      binanceApiKeyEncrypted: "encrypted:abcdefgh123",
      binanceApiSecretEncrypted: "encrypted:secret-value",
      binanceApiKeyPreview: "abcdefgh..."
    });
  });

  it("clears Binance credentials and optional cached data", async () => {
    await updateProfileBinanceSettings("profile-1", {
      apiKey: null,
      apiSecret: null,
      deleteBalances: true
    });

    expect(mocks.deleteBinanceBalances).toHaveBeenCalledWith("profile-1");
    expect(mocks.deleteBinanceDailySnapshots).toHaveBeenCalledWith("profile-1");
    expect(mocks.deletePriceCache).toHaveBeenCalledWith(["binance_sync_profile-1"]);
    expect(mocks.invalidateProfileStageSnapshots).toHaveBeenCalledWith("profile-1");
    expect(mocks.updateBinanceCredentials).toHaveBeenCalledWith("profile-1", {
      binanceApiKeyEncrypted: null,
      binanceApiSecretEncrypted: null,
      binanceApiKeyPreview: null
    });
  });

  it("clears Binance credentials without deleting data when requested", async () => {
    await updateProfileBinanceSettings("profile-1", {
      apiKey: null,
      apiSecret: null,
      deleteBalances: false
    });

    expect(mocks.deleteBinanceBalances).not.toHaveBeenCalled();
    expect(mocks.deleteBinanceDailySnapshots).not.toHaveBeenCalled();
    expect(mocks.deletePriceCache).not.toHaveBeenCalled();
    expect(mocks.invalidateProfileStageSnapshots).not.toHaveBeenCalled();
    expect(mocks.updateBinanceCredentials).toHaveBeenCalledWith("profile-1", {
      binanceApiKeyEncrypted: null,
      binanceApiSecretEncrypted: null,
      binanceApiKeyPreview: null
    });
  });

  it("deletes a profile and removes only unshared asset metadata", async () => {
    mocks.listInvestmentIsins.mockResolvedValueOnce(["ETF1", "ETF2"]);
    mocks.listOtherInvestmentIsins.mockResolvedValueOnce(["ETF2"]);
    mocks.listCryptoTokens.mockResolvedValueOnce(["BTC", "ETH"]);
    mocks.listBinanceTokens.mockResolvedValueOnce(["BNB"]);
    mocks.listOtherCryptoTokens.mockResolvedValueOnce(["ETH"]);
    mocks.listOtherBinanceTokens.mockResolvedValueOnce([]);

    const result = await deleteProfile("profile-1");

    expect(mocks.deleteAssetHistory).toHaveBeenNthCalledWith(1, ["ETF1"]);
    expect(mocks.deleteAssets).toHaveBeenCalledWith(["ETF1"]);
    expect(mocks.deleteAssetHistory).toHaveBeenNthCalledWith(2, ["BTC", "BNB"]);
    expect(mocks.deleteCryptoAssets).toHaveBeenCalledWith(["BTC", "BNB"]);
    expect(mocks.deletePriceCache).toHaveBeenCalledWith(["ETF1", "BTC", "BNB", "binance_sync_profile-1"]);
    expect(mocks.deleteProfile).toHaveBeenCalledWith("profile-1");
    expect(result).toEqual({
      isinsToDelete: ["ETF1"],
      tokensToDelete: ["BTC", "BNB"],
      priceCacheKeysToDelete: ["ETF1", "BTC", "BNB", "binance_sync_profile-1"]
    });
  });
});
