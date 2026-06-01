import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PreviewTransactionPayload } from "@/domain/imports/transaction-preview";
import type { TransactionImportRepository } from "@/server/repositories/transaction-import-repository";

const mocks = vi.hoisted(() => ({
  fetchAssetMetadata: vi.fn(),
  fetchAssetHistory: vi.fn(),
  fetchCryptoHistory: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logRequest: vi.fn(),
  logResponse: vi.fn()
}));

vi.mock("@/integrations/justetf/justetf-parser", () => ({
  fetchAssetMetadata: mocks.fetchAssetMetadata,
  fetchAssetHistory: mocks.fetchAssetHistory
}));

vi.mock("@/integrations/binance/binance-parser", () => ({
  fetchCryptoHistory: mocks.fetchCryptoHistory
}));

vi.mock("@/server/logging/logger", () => ({
  apiLogger: () => ({
    error: mocks.logError,
    info: mocks.logInfo,
    request: mocks.logRequest,
    response: mocks.logResponse
  })
}));

import { importPreviewTransactions } from "@/server/services/transaction-import";

function createRepository(): TransactionImportRepository {
  return {
    getExistingFingerprints: vi.fn().mockResolvedValue(new Set<string>()),
    findUser: vi.fn().mockResolvedValue({ id: "profile-1", name: "Main" }),
    createTransactions: vi.fn().mockResolvedValue(undefined),
    listExistingAssetIsins: vi.fn().mockResolvedValue(new Set<string>()),
    upsertAssetMetadata: vi.fn().mockResolvedValue(undefined),
    createAssetHistory: vi.fn().mockResolvedValue(undefined),
    listExistingCryptoTokens: vi.fn().mockResolvedValue(new Set<string>()),
    upsertCryptoAsset: vi.fn().mockResolvedValue(undefined)
  };
}

function createTransaction(
  overrides: Partial<PreviewTransactionPayload>
): PreviewTransactionPayload {
  return {
    fingerprint: overrides.fingerprint ?? "fingerprint-1",
    sourceInstitution: "trade_republic",
    pageNumber: 1,
    bookingDate: "2026-01-01T00:00:00.000Z",
    rawDateLabel: "2026-01-01",
    typeLabel: "BUY",
    description: "Buy trade",
    direction: "OUT",
    amountCents: 1000,
    balanceCents: 100000,
    currency: "EUR",
    accountType: "investment",
    productName: "Product",
    isin: "DE0000000001",
    quantityUnits: 1,
    tradeType: "buy_trade",
    ...overrides
  };
}

function trackConcurrency<T>(result: T) {
  let active = 0;
  let maxActive = 0;

  const fn = vi.fn(async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await Promise.resolve();
    active -= 1;
    return result;
  });

  return {
    fn,
    getMaxActive: () => maxActive
  };
}

describe("transaction import service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.fetchAssetHistory.mockResolvedValue([]);
    mocks.fetchCryptoHistory.mockResolvedValue([]);
  });

  it("limits concurrent JustETF enrichment requests", async () => {
    const repository = createRepository();
    const metadataTracker = trackConcurrency({ isin: "DE0000000001" });
    mocks.fetchAssetMetadata.mockImplementation(metadataTracker.fn);

    const transactions = Array.from({ length: 7 }, (_, index) =>
      createTransaction({
        fingerprint: `isin-${index}`,
        isin: `DE${String(index).padStart(10, "0")}`,
        productName: `ETF ${index}`
      })
    );

    await importPreviewTransactions("profile-1", transactions, "statement.csv", repository);

    expect(mocks.fetchAssetMetadata).toHaveBeenCalledTimes(7);
    expect(metadataTracker.getMaxActive()).toBeLessThanOrEqual(3);
  });

  it("limits concurrent Binance history enrichment requests", async () => {
    const repository = createRepository();
    const historyTracker = trackConcurrency([]);
    mocks.fetchAssetMetadata.mockResolvedValue({ isin: "DE0000000001" });
    mocks.fetchCryptoHistory.mockImplementation(historyTracker.fn);

    const transactions = Array.from({ length: 8 }, (_, index) =>
      createTransaction({
        fingerprint: `crypto-${index}`,
        accountType: "crypto",
        productName: `Token ${index}`,
        isin: `TOK${index}`,
        tradeType: null
      })
    );

    await importPreviewTransactions("profile-1", transactions, "statement.csv", repository);

    expect(mocks.fetchCryptoHistory).toHaveBeenCalledTimes(8);
    expect(historyTracker.getMaxActive()).toBeLessThanOrEqual(3);
  });

  it("returns persisted record counts including cash-side rows", async () => {
    const repository = createRepository();
    mocks.fetchAssetMetadata.mockResolvedValue({ isin: "DE0000000001" });
    const transactions = [
      createTransaction({
        accountType: "checking",
        fingerprint: "checking-1"
      }),
      createTransaction({
        accountType: "investment",
        fingerprint: "investment-1"
      }),
      createTransaction({
        accountType: "crypto",
        fingerprint: "crypto-1",
        isin: "BTC",
        productName: "Bitcoin",
        tradeType: null
      })
    ];

    await expect(importPreviewTransactions("profile-1", transactions, "statement.csv", repository)).resolves.toMatchObject({
      insertedCheckingCount: 3,
      insertedCount: 3,
      insertedCryptoCount: 1,
      insertedInvestmentCount: 1,
      insertedRecordCount: 5
    });
  });
});
