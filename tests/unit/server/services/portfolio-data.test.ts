import { describe, expect, it, vi } from "vitest";

import {
  getInvestmentPortfolioData,
  getTradeRepublicCryptoPortfolioData
} from "@/server/services/portfolio-data";

describe("portfolio data service", () => {
  it("loads investment transactions, history and builds the portfolio payload", async () => {
    const transactionRepository = {
      listInvestmentTransactions: vi.fn(async () => [
        {
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
        }
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
    expect(marketRepository.listPortfolioHistory).toHaveBeenCalledWith(["IE00B4L5Y983"]);
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
    expect(marketRepository.listPortfolioHistory).toHaveBeenCalledWith(["BTC"]);
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
});
