import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkingCount: vi.fn(),
  checkingFindMany: vi.fn(),
  investmentCount: vi.fn(),
  investmentFindMany: vi.fn(),
  cryptoCount: vi.fn(),
  cryptoFindMany: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    checkingTransaction: {
      count: mocks.checkingCount,
      findMany: mocks.checkingFindMany
    },
    investmentTransaction: {
      count: mocks.investmentCount,
      findMany: mocks.investmentFindMany
    },
    cryptoTransaction: {
      count: mocks.cryptoCount,
      findMany: mocks.cryptoFindMany
    }
  }
}));

import {
  toCryptoPortfolioTransaction,
  transactionReadRepository
} from "@/server/repositories/transaction-read-repository";

describe("transaction read repository", () => {
  beforeEach(() => {
    mocks.checkingCount.mockReset();
    mocks.checkingFindMany.mockReset();
    mocks.investmentCount.mockReset();
    mocks.investmentFindMany.mockReset();
    mocks.cryptoCount.mockReset();
    mocks.cryptoFindMany.mockReset();
  });

  it("loads checking transactions in reverse chronological order", async () => {
    await transactionReadRepository.listCheckingTransactions("profile-1");

    expect(mocks.checkingFindMany).toHaveBeenCalledWith({
      where: { userId: "profile-1" },
      orderBy: { bookingDate: "desc" },
      select: {
        id: true,
        sourceInstitution: true,
        bookingDate: true,
        typeLabel: true,
        description: true,
        direction: true,
        amountCents: true,
        balanceCents: true
      }
    });
  });

  it("loads only Trade Republic crypto transactions for the crypto portfolio view", async () => {
    await transactionReadRepository.listTradeRepublicCryptoTransactions("profile-1");

    expect(mocks.cryptoFindMany).toHaveBeenCalledWith({
      where: {
        userId: "profile-1",
        sourceInstitution: "trade_republic"
      },
      orderBy: { bookingDate: "desc" },
      select: {
        id: true,
        sourceInstitution: true,
        bookingDate: true,
        typeLabel: true,
        description: true,
        direction: true,
        amountCents: true,
        tokenName: true,
        tokenSymbol: true,
        quantityUnits: true
      }
    });
  });

  it("loads checking transaction rows as a stable page and returns the provider total", async () => {
    mocks.checkingFindMany.mockResolvedValue([{ id: "row-1" }]);
    mocks.checkingCount.mockResolvedValue(42);

    await expect(transactionReadRepository.listCheckingTransactionRows("profile-1", {
      limit: 100,
      offset: 200,
      sourceInstitution: "bbva"
    })).resolves.toEqual({
      total: 42,
      transactions: [{ id: "row-1" }]
    });

    expect(mocks.checkingFindMany).toHaveBeenCalledWith({
      where: { userId: "profile-1", sourceInstitution: "bbva" },
      orderBy: [
        { bookingDate: "desc" },
        { id: "desc" }
      ],
      skip: 200,
      take: 100,
      select: {
        id: true,
        sourceInstitution: true,
        bookingDate: true,
        typeLabel: true,
        description: true,
        direction: true,
        amountCents: true,
        balanceCents: true
      }
    });
    expect(mocks.checkingCount).toHaveBeenCalledWith({
      where: { userId: "profile-1", sourceInstitution: "bbva" }
    });
  });

  it("loads investment transaction rows as a stable page", async () => {
    mocks.investmentFindMany.mockResolvedValue([{ id: "row-1" }]);
    mocks.investmentCount.mockResolvedValue(7);

    await expect(transactionReadRepository.listInvestmentTransactionRows("profile-1", {
      limit: 50,
      offset: 0,
      sourceInstitution: "trade_republic"
    })).resolves.toEqual({
      total: 7,
      transactions: [{ id: "row-1" }]
    });

    expect(mocks.investmentFindMany).toHaveBeenCalledWith({
      where: { userId: "profile-1", sourceInstitution: "trade_republic" },
      orderBy: [
        { bookingDate: "desc" },
        { id: "desc" }
      ],
      skip: 0,
      take: 50,
      select: {
        id: true,
        sourceInstitution: true,
        bookingDate: true,
        typeLabel: true,
        description: true,
        direction: true,
        amountCents: true,
        tradeType: true,
        productName: true,
        isin: true,
        quantityUnits: true
      }
    });
  });

  it("loads crypto transaction rows as a stable page", async () => {
    mocks.cryptoFindMany.mockResolvedValue([{ id: "row-1" }]);
    mocks.cryptoCount.mockResolvedValue(9);

    await expect(transactionReadRepository.listTradeRepublicCryptoTransactionRows("profile-1", {
      limit: 25,
      offset: 50,
      sourceInstitution: "trade_republic"
    })).resolves.toEqual({
      total: 9,
      transactions: [{ id: "row-1" }]
    });

    expect(mocks.cryptoFindMany).toHaveBeenCalledWith({
      where: { userId: "profile-1", sourceInstitution: "trade_republic" },
      orderBy: [
        { bookingDate: "desc" },
        { id: "desc" }
      ],
      skip: 50,
      take: 25,
      select: {
        id: true,
        sourceInstitution: true,
        bookingDate: true,
        typeLabel: true,
        description: true,
        direction: true,
        amountCents: true,
        tokenName: true,
        tokenSymbol: true,
        quantityUnits: true
      }
    });
  });

  it("maps crypto rows to portfolio transactions", () => {
    expect(toCryptoPortfolioTransaction({
      id: "tx-1",
      sourceInstitution: "trade_republic",
      bookingDate: new Date("2026-01-01T00:00:00.000Z"),
      typeLabel: "BUY",
      description: "BTC savings plan",
      direction: "OUT",
      amountCents: 1000,
      tokenName: "Bitcoin",
      tokenSymbol: "BTC",
      quantityUnits: 0.01
    })).toMatchObject({
      id: "tx-1",
      tradeType: "savings_plan",
      productName: "Bitcoin",
      isin: "BTC"
    });
  });
});
