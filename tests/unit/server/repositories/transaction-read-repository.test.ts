import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkingFindMany: vi.fn(),
  investmentFindMany: vi.fn(),
  cryptoFindMany: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    checkingTransaction: { findMany: mocks.checkingFindMany },
    investmentTransaction: { findMany: mocks.investmentFindMany },
    cryptoTransaction: { findMany: mocks.cryptoFindMany }
  }
}));

import {
  toCryptoPortfolioTransaction,
  transactionReadRepository
} from "@/server/repositories/transaction-read-repository";

describe("transaction read repository", () => {
  beforeEach(() => {
    mocks.checkingFindMany.mockReset();
    mocks.investmentFindMany.mockReset();
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
