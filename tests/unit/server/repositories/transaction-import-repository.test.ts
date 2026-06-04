import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkingFindMany: vi.fn(),
  checkingFindFirst: vi.fn(),
  checkingCreateMany: vi.fn(),
  investmentFindMany: vi.fn(),
  investmentCreateMany: vi.fn(),
  cryptoFindMany: vi.fn(),
  cryptoCreateMany: vi.fn(),
  userFindUnique: vi.fn(),
  assetFindMany: vi.fn(),
  assetUpsert: vi.fn(),
  assetHistoryCreateMany: vi.fn(),
  cryptoAssetFindMany: vi.fn(),
  cryptoAssetUpsert: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    checkingTransaction: {
      findMany: mocks.checkingFindMany,
      findFirst: mocks.checkingFindFirst,
      createMany: mocks.checkingCreateMany
    },
    investmentTransaction: {
      findMany: mocks.investmentFindMany,
      createMany: mocks.investmentCreateMany
    },
    cryptoTransaction: {
      findMany: mocks.cryptoFindMany,
      createMany: mocks.cryptoCreateMany
    },
    user: { findUnique: mocks.userFindUnique },
    asset: {
      findMany: mocks.assetFindMany,
      upsert: mocks.assetUpsert
    },
    assetHistory: { createMany: mocks.assetHistoryCreateMany },
    cryptoAsset: {
      findMany: mocks.cryptoAssetFindMany,
      upsert: mocks.cryptoAssetUpsert
    },
    $transaction: mocks.transaction
  }
}));

import { transactionImportRepository } from "@/server/repositories/transaction-import-repository";
import type { AssetMetadata } from "@/integrations/justetf/justetf-parser";

const metadata: AssetMetadata = {
  isin: "IE00B4L5Y983",
  type: "ETF",
  wkn: "A0RPWH",
  name: "Core MSCI World",
  ter: 0.2,
  ticker: "SWDA",
  marketCap: null,
  country: null,
  sector: null,
  dividendYield: null,
  perfYTD: null,
  perf1Month: null,
  perf3Months: null,
  perf6Months: null,
  perf1Year: null,
  perf3Years: null,
  perf5Years: null,
  volatility1Year: null,
  volatility3Years: null,
  volatility5Years: null,
  returnPerRisk1Year: null,
  returnPerRisk3Years: null,
  returnPerRisk5Years: null,
  maxDrawdown1Year: null,
  maxDrawdown3Years: null,
  maxDrawdown5Years: null,
  maxDrawdownSinceInception: null,
  fundSize: null,
  distributionPolicy: null,
  replication: null,
  inceptionDate: null,
  holdingsTotalWeight: null,
  holdingsCount: null,
  topHoldings: null,
  countriesWeight: null,
  sectorsWeight: null
};

describe("transaction import repository", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.checkingFindMany.mockResolvedValue([]);
    mocks.checkingFindFirst.mockResolvedValue(null);
    mocks.investmentFindMany.mockResolvedValue([]);
    mocks.cryptoFindMany.mockResolvedValue([]);
    mocks.checkingCreateMany.mockReturnValue("checking-query");
    mocks.investmentCreateMany.mockReturnValue("investment-query");
    mocks.cryptoCreateMany.mockReturnValue("crypto-query");
    mocks.assetFindMany.mockResolvedValue([]);
    mocks.cryptoAssetFindMany.mockResolvedValue([]);
    mocks.transaction.mockResolvedValue(undefined);
  });

  it("collects existing fingerprints across transaction tables", async () => {
    mocks.checkingFindMany.mockResolvedValueOnce([{ fingerprint: "a" }]);
    mocks.investmentFindMany.mockResolvedValueOnce([{ fingerprint: "b" }]);
    mocks.cryptoFindMany.mockResolvedValueOnce([{ fingerprint: "c" }]);

    const result = await transactionImportRepository.getExistingFingerprints("profile-1", ["a", "b", "c"]);

    expect([...result]).toEqual(["a", "b", "c"]);
    expect(mocks.checkingFindMany).toHaveBeenCalledWith({
      where: { userId: "profile-1", fingerprint: { in: ["a", "b", "c"] } },
      select: { fingerprint: true }
    });
  });

  it("creates transaction batches atomically", async () => {
    await transactionImportRepository.createTransactions({
      checkingData: [{ userId: "profile-1", sourceInstitution: "BBVA", fingerprint: "a", bookingDate: new Date(), rawDateLabel: "01/01/2026", typeLabel: "Card", description: "Coffee", direction: "OUT", amountCents: 250, balanceCents: 1000 }],
      investmentData: [],
      cryptoData: []
    });

    expect(mocks.checkingCreateMany).toHaveBeenCalledOnce();
    expect(mocks.checkingCreateMany).toHaveBeenCalledWith({
      data: expect.any(Array),
      skipDuplicates: true
    });
    expect(mocks.transaction).toHaveBeenCalledWith(["checking-query"]);
  });

  it("finds the latest checking balance before a movement-only BBVA import range", async () => {
    const bookingDate = new Date("2026-05-03T00:00:00.000Z");
    mocks.checkingFindFirst.mockResolvedValueOnce({ balanceCents: 12_345 });

    await expect(transactionImportRepository.findLatestCheckingBalanceBefore(
      "profile-1",
      "bbva",
      bookingDate
    )).resolves.toEqual({ balanceCents: 12_345 });
    expect(mocks.checkingFindFirst).toHaveBeenCalledWith({
      where: {
        userId: "profile-1",
        sourceInstitution: "bbva",
        bookingDate: { lt: bookingDate }
      },
      orderBy: [
        { bookingDate: "desc" },
        { importedAt: "desc" },
        { id: "desc" }
      ],
      select: { balanceCents: true }
    });
  });

  it("upserts asset metadata and skips empty history inserts", async () => {
    await transactionImportRepository.upsertAssetMetadata("IE00B4L5Y983", metadata);
    await transactionImportRepository.createAssetHistory([]);

    expect(mocks.assetUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { isin: "IE00B4L5Y983" },
      create: expect.objectContaining({
        isin: "IE00B4L5Y983",
        name: "Core MSCI World",
        ticker: "SWDA"
      })
    }));
    expect(mocks.assetHistoryCreateMany).not.toHaveBeenCalled();
  });

  it("skips duplicate asset history points created by concurrent enrichments", async () => {
    await transactionImportRepository.createAssetHistory([
      { isin: "IE00B4L5Y983", date: "2026-01-01", value: 42, currency: "EUR" }
    ]);

    expect(mocks.assetHistoryCreateMany).toHaveBeenCalledWith({
      data: [{ isin: "IE00B4L5Y983", date: "2026-01-01", value: 42, currency: "EUR" }],
      skipDuplicates: true
    });
  });
});
