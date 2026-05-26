import { describe, expect, it } from "vitest";

import {
  buildPortfolioTimeSeries,
  getPortfolioPriceKeys,
  type PortfolioTransaction
} from "@/lib/portfolio-timeseries";

describe("portfolio time-series", () => {
  it("calculates provider totals, product positions and daily buckets from trades and prices", () => {
    const transactions: PortfolioTransaction[] = [
      {
        id: "sell",
        sourceInstitution: "trade_republic",
        bookingDate: new Date("2024-01-03T00:00:00.000Z"),
        typeLabel: "SELL",
        description: "Sell Core MSCI World",
        direction: "IN",
        amountCents: 70_00,
        tradeType: "buy_trade",
        productName: "Core MSCI World",
        isin: "IE00B4L5Y983",
        quantityUnits: 0.5
      },
      {
        id: "buy",
        sourceInstitution: "trade_republic",
        bookingDate: new Date("2024-01-02T00:00:00.000Z"),
        typeLabel: "BUY",
        description: "Buy Core MSCI World",
        direction: "OUT",
        amountCents: 100_00,
        tradeType: "buy_trade",
        productName: "Core MSCI World",
        isin: "IE00B4L5Y983",
        quantityUnits: 1
      }
    ];

    const result = buildPortfolioTimeSeries({
      transactions,
      priceKeys: ["IE00B4L5Y983"],
      historyPrices: [
        { isin: "IE00B4L5Y983", date: "2024-01-02", value: 120 },
        { isin: "IE00B4L5Y983", date: "2024-01-03", value: 150 }
      ],
      now: new Date("2024-01-03T12:00:00.000Z")
    });

    expect(result.dailyData).toHaveLength(2);
    expect(result.dailyData[0]).toMatchObject({
      date: "2024-01-02",
      total: 12_000,
      providers: { trade_republic: 12_000 },
      providerProducts: { trade_republic: { "Core MSCI World": 12_000 } }
    });
    expect(result.dailyData[1]).toMatchObject({
      date: "2024-01-03",
      total: 7_500,
      providers: { trade_republic: 7_500 },
      providerProducts: { trade_republic: { "Core MSCI World": 7_500 } }
    });
    expect(result.monthlyData.at(-1)).toMatchObject({
      month: "2024-01",
      total: 7_500
    });
    expect(result.providers[0]).toMatchObject({
      sourceInstitution: "trade_republic",
      total: 7_500,
      income: 70_00,
      expenses: 100_00,
      products: [
        {
          productName: "Core MSCI World",
          quantity: 0.5,
          investedValue: 30_00,
          isin: "IE00B4L5Y983"
        }
      ]
    });
  });

  it("deduplicates and filters price keys", () => {
    expect(
      getPortfolioPriceKeys(
        [
          { isin: "IE00B4L5Y983" },
          { isin: "IE00B4L5Y983" },
          { isin: "BTC" },
          { isin: null }
        ],
        (key) => key.length === 12
      )
    ).toEqual(["IE00B4L5Y983"]);
  });
});
