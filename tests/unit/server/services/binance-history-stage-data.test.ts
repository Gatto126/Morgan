import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBinanceDailySnapshotHistory: vi.fn()
}));

vi.mock("@/server/services/binance-daily-snapshot", () => ({
  getBinanceDailySnapshotHistory: mocks.getBinanceDailySnapshotHistory
}));

import { getBinanceHistoricalPointsForStage } from "@/server/services/binance-history-stage-data";

describe("binance history stage data", () => {
  beforeEach(() => {
    mocks.getBinanceDailySnapshotHistory.mockReset();
  });

  it("maps daily snapshot totals and tokens to chart cents", async () => {
    mocks.getBinanceDailySnapshotHistory.mockResolvedValueOnce([
      {
        dateKey: "2026-06-03",
        snapshotAt: "2026-06-04T00:41:59.000Z",
        tokenCount: 2,
        tokens: [
          {
            eurPrice: 75_000,
            eurValue: 697.36,
            freeAmount: 0.009298,
            lockedAmount: 0,
            tokenName: "Bitcoin",
            tokenSymbol: "BTC",
            totalAmount: 0.009298
          },
          {
            eurPrice: 2_500,
            eurValue: 367.89,
            freeAmount: 0.147156,
            lockedAmount: 0,
            tokenName: "Ethereum",
            tokenSymbol: "ETH",
            totalAmount: 0.147156
          }
        ],
        totalEurValue: 2269.36
      }
    ]);

    await expect(getBinanceHistoricalPointsForStage("profile-1")).resolves.toEqual([
      {
        dateKey: "2026-06-03",
        tokens: [
          { tokenName: "Bitcoin", tokenSymbol: "BTC", valueCents: 69_736 },
          { tokenName: "Ethereum", tokenSymbol: "ETH", valueCents: 36_789 }
        ],
        valueCents: 226_936
      }
    ]);
  });
});
