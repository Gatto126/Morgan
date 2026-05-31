import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkingFindMany: vi.fn(),
  investmentFindMany: vi.fn(),
  cryptoFindMany: vi.fn(),
  assetHistoryFindMany: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    checkingTransaction: { findMany: mocks.checkingFindMany },
    investmentTransaction: { findMany: mocks.investmentFindMany },
    cryptoTransaction: { findMany: mocks.cryptoFindMany },
    assetHistory: { findMany: mocks.assetHistoryFindMany }
  }
}));

import { dashboardRepository } from "@/server/repositories/dashboard-repository";

describe("dashboard repository", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.checkingFindMany.mockResolvedValue([]);
    mocks.investmentFindMany.mockResolvedValue([]);
    mocks.cryptoFindMany.mockResolvedValue([]);
    mocks.assetHistoryFindMany.mockResolvedValue([]);
  });

  it("loads all dashboard transaction tables for one profile", async () => {
    await dashboardRepository.listTransactions("profile-1");

    expect(mocks.checkingFindMany).toHaveBeenCalledWith({
      where: { userId: "profile-1" },
      select: {
        amountCents: true,
        balanceCents: true,
        bookingDate: true,
        description: true,
        direction: true,
        sourceInstitution: true,
        typeLabel: true
      },
      orderBy: { bookingDate: "asc" }
    });
    expect(mocks.investmentFindMany).toHaveBeenCalledWith({
      where: { userId: "profile-1" },
      select: {
        amountCents: true,
        bookingDate: true,
        description: true,
        direction: true,
        isin: true,
        productName: true,
        quantityUnits: true,
        sourceInstitution: true,
        tradeType: true,
        typeLabel: true
      },
      orderBy: { bookingDate: "asc" }
    });
    expect(mocks.cryptoFindMany).toHaveBeenCalledWith({
      where: { userId: "profile-1" },
      select: {
        amountCents: true,
        bookingDate: true,
        description: true,
        direction: true,
        quantityUnits: true,
        sourceInstitution: true,
        tokenName: true,
        tokenSymbol: true,
        typeLabel: true
      },
      orderBy: { bookingDate: "asc" }
    });
  });

  it("loads EUR history only for requested symbols and skips empty lists", async () => {
    await expect(dashboardRepository.listAssetHistory([])).resolves.toEqual([]);
    expect(mocks.assetHistoryFindMany).not.toHaveBeenCalled();

    await dashboardRepository.listAssetHistory(["BTC", "IE00B4L5Y983"]);

    expect(mocks.assetHistoryFindMany).toHaveBeenCalledWith({
      where: {
        isin: { in: ["BTC", "IE00B4L5Y983"] },
        currency: "EUR"
      },
      select: {
        isin: true,
        date: true,
        value: true
      },
      orderBy: { date: "asc" }
    });
  });

  it("can limit dashboard history to the profile transaction window", async () => {
    await dashboardRepository.listAssetHistory(["BTC"], { fromDate: "2026-01-01" });

    expect(mocks.assetHistoryFindMany).toHaveBeenCalledWith({
      where: {
        isin: { in: ["BTC"] },
        currency: "EUR",
        date: { gte: "2026-01-01" }
      },
      select: {
        isin: true,
        date: true,
        value: true
      },
      orderBy: { date: "asc" }
    });
  });
});
