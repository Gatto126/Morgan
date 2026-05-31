import { describe, expect, it, vi } from "vitest";

import {
  getInvestmentPortfolioData,
  getInvestmentPortfolioSummaryData,
  getInvestmentPortfolioTransactionRows,
  getTradeRepublicCryptoPortfolioData,
  getTradeRepublicCryptoPortfolioSummaryData,
  getTradeRepublicCryptoPortfolioTransactionRows
} from "@/server/services/portfolio-data";

describe("portfolio data service", () => {
  const investmentRow = {
    id: "investment-1",
    sourceInstitution: "trade_republic",
    bookingDate: new Date("2026-01-01T00:00:00.000Z"),
    typeLabel: "BUY",
    description: "Buy Core MSCI World",
    direction: "OUT",
    amountCents: 10000,
    tradeType: "buy_trade",
    productName: "Core MSCI World",
    isin: "IE00B4L5Y983",
    quantityUnits: 1
  };

  it("loads investment transactions, history and builds the portfolio payload", async () => {
    const transactionRepository = {
      listInvestmentTransactions: vi.fn(async () => [
        investmentRow
      ]),
      listTradeRepublicCryptoTransactions: vi.fn()
    };
    const marketRepository = {
      listPortfolioHistory: vi.fn(async () => [
        { isin: "IE00B4L5Y983", date: "2026-01-01", value: 120 }
      ])
    };

    const { result, transactionCount } = await getInvestmentPortfolioData("profile-1", {
      transactionRepository,
      marketRepository,
      now: new Date("2026-01-01T12:00:00.000Z")
    });

    expect(transactionRepository.listInvestmentTransactions).toHaveBeenCalledWith("profile-1");
    expect(marketRepository.listPortfolioHistory).toHaveBeenCalledWith(["IE00B4L5Y983"], {
      fromDate: "2026-01-01"
    });
    expect(transactionCount).toBe(1);
    expect(result.dailyData.at(-1)).toMatchObject({
      total: 12000,
      providers: { trade_republic: 12000 }
    });
  });

  it("maps Trade Republic crypto rows before building the portfolio payload", async () => {
    const transactionRepository = {
      listInvestmentTransactions: vi.fn(),
      listTradeRepublicCryptoTransactions: vi.fn(async () => [
        {
          id: "crypto-1",
          sourceInstitution: "trade_republic",
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          typeLabel: "BUY",
          description: "BTC savings plan",
          direction: "OUT",
          amountCents: 5000,
          tokenName: "Bitcoin",
          tokenSymbol: "BTC",
          quantityUnits: 0.1
        }
      ])
    };
    const marketRepository = {
      listPortfolioHistory: vi.fn(async () => [
        { isin: "BTC", date: "2026-01-01", value: 60000 }
      ])
    };

    const { result, transactionCount } = await getTradeRepublicCryptoPortfolioData("profile-1", {
      transactionRepository,
      marketRepository,
      now: new Date("2026-01-01T12:00:00.000Z")
    });

    expect(transactionRepository.listTradeRepublicCryptoTransactions).toHaveBeenCalledWith("profile-1");
    expect(marketRepository.listPortfolioHistory).toHaveBeenCalledWith(["BTC"], {
      fromDate: "2026-01-01"
    });
    expect(transactionCount).toBe(1);
    expect(result.providers[0].products[0]).toMatchObject({
      productName: "Bitcoin",
      quantity: 0.1,
      isin: "BTC"
    });
    expect(result.dailyData.at(-1)).toMatchObject({
      total: 600000
    });
  });

  it("builds investment summaries without provider transaction rows", async () => {
    const transactionRepository = {
      listInvestmentTransactions: vi.fn(async () => [
        investmentRow
      ]),
      listTradeRepublicCryptoTransactions: vi.fn()
    };
    const marketRepository = {
      listPortfolioHistory: vi.fn(async () => [
        { isin: "IE00B4L5Y983", date: "2026-01-01", value: 120 }
      ])
    };

    const { result, transactionCount } = await getInvestmentPortfolioSummaryData("profile-1", {
      transactionRepository,
      marketRepository,
      now: new Date("2026-01-01T12:00:00.000Z")
    });

    expect(transactionCount).toBe(1);
    expect(result.providers[0]).toMatchObject({
      sourceInstitution: "trade_republic",
      transactionCount: 1
    });
    expect(result.providers[0]).not.toHaveProperty("transactions");
  });

  it("builds crypto summaries without provider transaction rows", async () => {
    const transactionRepository = {
      listInvestmentTransactions: vi.fn(),
      listTradeRepublicCryptoTransactions: vi.fn(async () => [
        {
          id: "crypto-1",
          sourceInstitution: "trade_republic",
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          typeLabel: "BUY",
          description: "BTC savings plan",
          direction: "OUT",
          amountCents: 5000,
          tokenName: "Bitcoin",
          tokenSymbol: "BTC",
          quantityUnits: 0.1
        }
      ])
    };
    const marketRepository = {
      listPortfolioHistory: vi.fn(async () => [
        { isin: "BTC", date: "2026-01-01", value: 60000 }
      ])
    };

    const { result, transactionCount } = await getTradeRepublicCryptoPortfolioSummaryData("profile-1", {
      transactionRepository,
      marketRepository,
      now: new Date("2026-01-01T12:00:00.000Z")
    });

    expect(transactionCount).toBe(1);
    expect(result.providers[0]).toMatchObject({
      sourceInstitution: "trade_republic",
      transactionCount: 1
    });
    expect(result.providers[0]).not.toHaveProperty("transactions");
  });

  it("loads investment transaction rows through the repository", async () => {
    const repository = {
      listInvestmentTransactionRows: vi.fn(async () => ({
        total: 3,
        transactions: [investmentRow]
      }))
    };

    await expect(getInvestmentPortfolioTransactionRows("profile-1", "trade_republic", {
      limit: 100,
      offset: 0,
      repository
    })).resolves.toEqual({
      total: 3,
      transactions: [investmentRow]
    });

    expect(repository.listInvestmentTransactionRows).toHaveBeenCalledWith("profile-1", {
      limit: 100,
      offset: 0,
      sourceInstitution: "trade_republic"
    });
  });

  it("loads and maps crypto transaction rows through the repository", async () => {
    const repository = {
      listTradeRepublicCryptoTransactionRows: vi.fn(async () => ({
        total: 2,
        transactions: [
          {
            id: "crypto-1",
            sourceInstitution: "trade_republic",
            bookingDate: new Date("2026-01-01T00:00:00.000Z"),
            typeLabel: "BUY",
            description: "BTC savings plan",
            direction: "OUT",
            amountCents: 5000,
            tokenName: "Bitcoin",
            tokenSymbol: "BTC",
            quantityUnits: 0.1
          }
        ]
      }))
    };

    const result = await getTradeRepublicCryptoPortfolioTransactionRows("profile-1", "trade_republic", {
      limit: 100,
      offset: 0,
      repository
    });

    expect(result).toMatchObject({
      total: 2,
      transactions: [
        {
          id: "crypto-1",
          productName: "Bitcoin",
          isin: "BTC"
        }
      ]
    });
  });
});
