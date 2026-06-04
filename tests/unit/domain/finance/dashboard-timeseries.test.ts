import { describe, expect, it } from "vitest";

import {
  buildDashboardData,
  getDashboardPriceKeys,
  mapDashboardTransactions,
  type DashboardTransactionRows
} from "@/domain/finance/dashboard-timeseries";
import { BBVA_INSTITUTION, TRADE_REPUBLIC_INSTITUTION } from "@/shared/institutions";

describe("dashboard time-series", () => {
  it("maps row sources, extracts price keys and builds account totals", () => {
    const rows: DashboardTransactionRows = {
      checkingTxs: [
        {
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          typeLabel: "Salary",
          description: "Salary",
          direction: "IN",
          amountCents: 100000,
          balanceCents: 100000
        },
        {
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-02T00:00:00.000Z"),
          typeLabel: "Card",
          description: "Groceries",
          direction: "OUT",
          amountCents: 10000,
          balanceCents: 90000
        }
      ],
      investmentTxs: [
        {
          sourceInstitution: TRADE_REPUBLIC_INSTITUTION,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          typeLabel: "BUY",
          description: "Buy Core MSCI World",
          direction: "OUT",
          amountCents: 10000,
          productName: "Core MSCI World",
          isin: "IE00B4L5Y983",
          quantityUnits: 1,
          tradeType: "buy_trade"
        }
      ],
      cryptoTxs: [
        {
          sourceInstitution: TRADE_REPUBLIC_INSTITUTION,
          bookingDate: new Date("2026-01-02T00:00:00.000Z"),
          typeLabel: "BUY",
          description: "Buy Bitcoin",
          direction: "OUT",
          amountCents: 5000,
          tokenName: "Bitcoin",
          tokenSymbol: "XF000BTC0017",
          quantityUnits: 0.1
        }
      ]
    };

    const transactions = mapDashboardTransactions(rows);
    expect(getDashboardPriceKeys(transactions)).toEqual(["IE00B4L5Y983", "BTC"]);

    const result = buildDashboardData({
      transactions,
      priceKeys: ["IE00B4L5Y983", "BTC"],
      historyPrices: [
        { isin: "IE00B4L5Y983", date: "2026-01-01", value: 120 },
        { isin: "BTC", date: "2026-01-02", value: 60000 }
      ],
      now: new Date("2026-01-02T12:00:00.000Z")
    });

    expect(result.dailyData).toHaveLength(2);
    expect(result.dailyData[0]).toMatchObject({
      date: "2026-01-01",
      checking: 100000,
      investment: 12000,
      crypto: 0,
      heritage: 112000
    });
    expect(result.dailyData[1]).toMatchObject({
      date: "2026-01-02",
      checking: 90000,
      investment: 12000,
      crypto: 600000,
      heritage: 702000,
      providerInvestment: {
        [TRADE_REPUBLIC_INSTITUTION]: 12000
      },
      providerCrypto: {
        [TRADE_REPUBLIC_INSTITUTION]: 600000
      },
      providerExpenses: {
        [BBVA_INSTITUTION]: 10000
      }
    });
    expect(result.accountTotals).toMatchObject({
      checking: 90000,
      investment: 12000,
      crypto: 600000,
      heritage: 702000
    });
    expect(result.providerSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceInstitution: BBVA_INSTITUTION,
          checking: expect.objectContaining({
            income: 100000,
            expenses: 10000,
            total: 90000
          })
        }),
        expect.objectContaining({
          sourceInstitution: TRADE_REPUBLIC_INSTITUTION,
          investmentProducts: [
            expect.objectContaining({
              productName: "Core MSCI World",
              quantity: 1,
              investedValue: 10000,
              isin: "IE00B4L5Y983"
            })
          ],
          cryptoTokens: [
            expect.objectContaining({
              tokenName: "Bitcoin",
              quantity: 0.1,
              investedValue: 5000,
              tokenSymbol: "BTC"
            })
          ]
        })
      ])
    );
  });

  it("counts BBVA interest and cashback in dashboard income buckets and summaries", () => {
    const rows: DashboardTransactionRows = {
      checkingTxs: [
        {
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          typeLabel: "Interessi",
          description: "Interest payment",
          direction: "IN",
          amountCents: 2303,
          balanceCents: 2303
        },
        {
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          typeLabel: "Premio",
          description: "Cash reward",
          direction: "IN",
          amountCents: 54,
          balanceCents: 2357
        }
      ],
      cryptoTxs: [],
      investmentTxs: []
    };

    const result = buildDashboardData({
      transactions: mapDashboardTransactions(rows),
      historyPrices: [],
      priceKeys: [],
      now: new Date("2026-01-01T12:00:00.000Z")
    });

    expect(result.dailyData[0]).toMatchObject({
      providerCashback: {
        [BBVA_INSTITUTION]: 54
      },
      providerIncome: {
        [BBVA_INSTITUTION]: 2357
      },
      providerInterest: {
        [BBVA_INSTITUTION]: 2303
      }
    });
    expect(result.providerSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceInstitution: BBVA_INSTITUTION,
          checking: expect.objectContaining({
            cashback: 54,
            income: 2357,
            interest: 2303
          })
        })
      ])
    );
  });

  it("dedupes BBVA statement and movement-only rows before building dashboard balances", () => {
    const rows: DashboardTransactionRows = {
      checkingTxs: [
        {
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-02T00:00:00.000Z"),
          typeLabel: "Bonifico ricevuto",
          description: "Risparmi",
          direction: "IN",
          amountCents: 10000,
          balanceCents: 10000
        },
        {
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-02T00:00:00.000Z"),
          typeLabel: "Risparmi",
          description: "BONIFICO RICEVUTO - Luca Ansaldi IT54O0357601601010008013762",
          direction: "IN",
          amountCents: 10000,
          balanceCents: 10000
        },
        {
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-02T00:00:00.000Z"),
          typeLabel: "Bonifico ricevuto",
          description: "Risparmi",
          direction: "IN",
          amountCents: 300000,
          balanceCents: 310000
        },
        {
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-02T00:00:00.000Z"),
          typeLabel: "Risparmi",
          description: "BONIFICO RICEVUTO - Luca Ansaldi IT54O0357601601010008013762",
          direction: "IN",
          amountCents: 300000,
          balanceCents: 310000
        },
        {
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-03T00:00:00.000Z"),
          typeLabel: "Costa poco gprs",
          description: "5179090010640733 COSTA POCO GPRS NOVI LIGUREALIT",
          direction: "OUT",
          amountCents: 358,
          balanceCents: 309642
        },
        {
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-03T00:00:00.000Z"),
          typeLabel: "PAGAMENTO CON CARTA",
          description: "COSTA POCO GPRS",
          direction: "OUT",
          amountCents: 358,
          balanceCents: 309642
        },
        {
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-06-02T00:00:00.000Z"),
          typeLabel: "LIQUIDAZIONE INTERESSI-COMMISSIONI-SPESE",
          description: "LIQUIDAZIONE INTERESSI-COMMISSIONI-SPESE",
          direction: "IN",
          amountCents: 640,
          balanceCents: 310282
        }
      ],
      cryptoTxs: [],
      investmentTxs: []
    };

    const result = buildDashboardData({
      transactions: mapDashboardTransactions(rows),
      historyPrices: [],
      priceKeys: [],
      now: new Date("2026-06-02T12:00:00.000Z")
    });

    expect(result.dailyData.find((day) => day.date === "2026-01-03")).toMatchObject({
      checking: 309642,
      heritage: 309642,
      providerChecking: {
        [BBVA_INSTITUTION]: 309642
      }
    });
    expect(result.accountTotals).toMatchObject({
      checking: 310282,
      heritage: 310282
    });
    expect(result.providerSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceInstitution: BBVA_INSTITUTION,
          checking: expect.objectContaining({
            expenses: 358,
            income: 310640,
            interest: 640,
            total: 310282
          })
        })
      ])
    );
  });
});
