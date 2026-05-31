import { describe, expect, it } from "vitest";

import {
  buildCheckingTimeSeries,
  classifyCheckingFlow,
  type CheckingTransaction
} from "@/domain/finance/checking-timeseries";
import { BBVA_INSTITUTION, TRADE_REPUBLIC_INSTITUTION } from "@/shared/institutions";

function transaction(overrides: Partial<CheckingTransaction>): CheckingTransaction {
  return {
    id: "tx",
    sourceInstitution: TRADE_REPUBLIC_INSTITUTION,
    bookingDate: new Date("2026-01-01T00:00:00.000Z"),
    typeLabel: "CARD",
    description: "Card payment",
    direction: "OUT",
    amountCents: 1000,
    balanceCents: 0,
    ...overrides
  };
}

describe("checking time-series", () => {
  it("classifies localized checking flows", () => {
    expect(classifyCheckingFlow(transaction({ typeLabel: "Interessi", direction: "IN" }))).toBe("interest");
    expect(classifyCheckingFlow(transaction({ typeLabel: "Premio", direction: "IN" }))).toBe("cashback");
    expect(classifyCheckingFlow(transaction({ typeLabel: "Imposta", direction: "OUT" }))).toBe("tax");
    expect(classifyCheckingFlow(transaction({ direction: "IN" }))).toBe("income");
    expect(classifyCheckingFlow(transaction({ direction: "OUT" }))).toBe("expenses");
  });

  it("builds provider summaries and filled daily buckets from mixed checking accounts", () => {
    const result = buildCheckingTimeSeries({
      now: new Date("2026-01-03T12:00:00.000Z"),
      transactions: [
        transaction({
          id: "tr-card",
          sourceInstitution: TRADE_REPUBLIC_INSTITUTION,
          bookingDate: new Date("2026-01-02T00:00:00.000Z"),
          direction: "OUT",
          amountCents: 2000,
          balanceCents: 30000
        }),
        transaction({
          id: "bbva-tax",
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-02T00:00:00.000Z"),
          typeLabel: "Imposta",
          direction: "OUT",
          amountCents: 500,
          balanceCents: 99500
        }),
        transaction({
          id: "bbva-salary",
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          typeLabel: "Salary",
          direction: "IN",
          amountCents: 100000,
          balanceCents: 100000
        })
      ]
    });

    expect(result.dailyData).toHaveLength(3);
    expect(result.dailyData[1]).toMatchObject({
      date: "2026-01-02",
      total: 129500,
      providers: {
        [BBVA_INSTITUTION]: 99500,
        [TRADE_REPUBLIC_INSTITUTION]: 30000
      },
      providerExpenses: {
        [BBVA_INSTITUTION]: 500,
        [TRADE_REPUBLIC_INSTITUTION]: 2000
      }
    });
    expect(result.monthlyData).toHaveLength(1);
    expect(result.monthlyData[0]).toMatchObject({
      month: "2026-01",
      total: 129500
    });
    expect(result.providers.find((provider) => provider.sourceInstitution === BBVA_INSTITUTION)).toMatchObject({
      total: 99500,
      income: 100000,
      tax: 500
    });
    expect(result.providers.find((provider) => provider.sourceInstitution === TRADE_REPUBLIC_INSTITUTION)).toMatchObject({
      total: 30000,
      expenses: 2000
    });
  });

  it("uses imported account balances for transferred cash instead of reconstructing BBVA from inflows", () => {
    const result = buildCheckingTimeSeries({
      now: new Date("2026-01-03T12:00:00.000Z"),
      transactions: [
        transaction({
          id: "tr-transfer-out",
          sourceInstitution: TRADE_REPUBLIC_INSTITUTION,
          bookingDate: new Date("2026-01-03T00:00:00.000Z"),
          typeLabel: "TRANSFER",
          description: "Transfer to BBVA",
          direction: "OUT",
          amountCents: 300000,
          balanceCents: 364112
        }),
        transaction({
          id: "bbva-transfer-in",
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-03T00:00:00.000Z"),
          typeLabel: "Bonifico ricevuto",
          description: "Transfer from Trade Republic",
          direction: "IN",
          amountCents: 300000,
          balanceCents: 309642
        })
      ]
    });

    expect(result.dailyData[0]).toMatchObject({
      date: "2026-01-03",
      total: 673754,
      providers: {
        [BBVA_INSTITUTION]: 309642,
        [TRADE_REPUBLIC_INSTITUTION]: 364112
      }
    });
    expect(result.providers.find((provider) => provider.sourceInstitution === BBVA_INSTITUTION)).toMatchObject({
      income: 300000,
      total: 309642
    });
  });
});
