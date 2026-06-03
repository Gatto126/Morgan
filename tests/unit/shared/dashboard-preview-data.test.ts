import { describe, expect, it } from "vitest";

import { toDashboardPreviewData } from "@/shared/dashboard-preview-data";

describe("dashboard preview data", () => {
  it("keeps Binance historical points in the lightweight preview payload", () => {
    const preview = toDashboardPreviewData({
      accountTotals: {
        checking: 100_00,
        crypto: 250_00,
        heritage: 350_00,
        investment: 0
      },
      binanceHistoricalPoints: [{ dateKey: "2026-06-03", valueCents: 225_00 }],
      dailyData: [{
        checking: 100_00,
        crypto: 25_00,
        date: "2026-06-03",
        heritage: 125_00,
        investment: 0,
        month: "2026-06",
        providerCryptoTokens: {
          BTC: 25_00
        }
      }],
      monthlyData: [{
        checking: 100_00,
        crypto: 25_00,
        heritage: 125_00,
        investment: 0,
        month: "2026-06",
        providerCryptoTokens: {
          BTC: 25_00
        }
      }],
      providerSummaries: []
    });

    expect(preview.binanceHistoricalPoints).toEqual([{ dateKey: "2026-06-03", valueCents: 225_00 }]);
    expect(preview.dailyData[0]).not.toHaveProperty("providerCryptoTokens");
    expect(preview.monthlyData[0]).not.toHaveProperty("providerCryptoTokens");
  });
});
