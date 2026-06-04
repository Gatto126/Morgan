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

  it("counts BBVA interest and cashback as income while keeping their own categories", () => {
    const result = buildCheckingTimeSeries({
      now: new Date("2026-01-01T12:00:00.000Z"),
      transactions: [
        transaction({
          id: "bbva-interest",
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          typeLabel: "Interessi",
          description: "Interest payment",
          direction: "IN",
          amountCents: 2303,
          balanceCents: 2303
        }),
        transaction({
          id: "bbva-cashback",
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-01T00:00:00.000Z"),
          typeLabel: "Premio",
          description: "Cash reward",
          direction: "IN",
          amountCents: 54,
          balanceCents: 2357
        })
      ]
    });

    expect(result.providers.find((provider) => provider.sourceInstitution === BBVA_INSTITUTION)).toMatchObject({
      cashback: 54,
      income: 2357,
      interest: 2303
    });
    expect(result.dailyData[0].providerIncome).toMatchObject({
      [BBVA_INSTITUTION]: 2357
    });
  });

  it("dedupes the same BBVA movements imported from statement and movement-only layouts", () => {
    const result = buildCheckingTimeSeries({
      now: new Date("2026-06-02T12:00:00.000Z"),
      transactions: [
        transaction({
          id: "statement-seed",
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-02T00:00:00.000Z"),
          typeLabel: "Bonifico ricevuto",
          description: "Risparmi",
          direction: "IN",
          amountCents: 10000,
          balanceCents: 10000
        }),
        transaction({
          id: "movement-seed-duplicate",
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-02T00:00:00.000Z"),
          typeLabel: "Risparmi",
          description: "BONIFICO RICEVUTO - Luca Ansaldi IT54O0357601601010008013762",
          direction: "IN",
          amountCents: 10000,
          balanceCents: 10000
        }),
        transaction({
          id: "statement-transfer",
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-02T00:00:00.000Z"),
          typeLabel: "Bonifico ricevuto",
          description: "Risparmi",
          direction: "IN",
          amountCents: 300000,
          balanceCents: 310000
        }),
        transaction({
          id: "movement-transfer-duplicate",
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-02T00:00:00.000Z"),
          typeLabel: "Risparmi",
          description: "BONIFICO RICEVUTO - Luca Ansaldi IT54O0357601601010008013762",
          direction: "IN",
          amountCents: 300000,
          balanceCents: 310000
        }),
        transaction({
          id: "statement-card",
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-03T00:00:00.000Z"),
          typeLabel: "Costa poco gprs",
          description: "5179090010640733 COSTA POCO GPRS NOVI LIGUREALIT",
          direction: "OUT",
          amountCents: 358,
          balanceCents: 309642
        }),
        transaction({
          id: "movement-card-duplicate",
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-01-03T00:00:00.000Z"),
          typeLabel: "PAGAMENTO CON CARTA",
          description: "COSTA POCO GPRS",
          direction: "OUT",
          amountCents: 358,
          balanceCents: 309642
        }),
        transaction({
          id: "movement-new-interest",
          sourceInstitution: BBVA_INSTITUTION,
          bookingDate: new Date("2026-06-02T00:00:00.000Z"),
          typeLabel: "LIQUIDAZIONE INTERESSI-COMMISSIONI-SPESE",
          description: "LIQUIDAZIONE INTERESSI-COMMISSIONI-SPESE",
          direction: "IN",
          amountCents: 640,
          balanceCents: 310282
        })
      ]
    });

    expect(result.dailyData.find((day) => day.date === "2026-01-03")).toMatchObject({
      total: 309642,
      providers: {
        [BBVA_INSTITUTION]: 309642
      }
    });
    expect(result.dailyData.at(-1)).toMatchObject({
      date: "2026-06-02",
      total: 310282,
      providers: {
        [BBVA_INSTITUTION]: 310282
      }
    });
    expect(result.providers.find((provider) => provider.sourceInstitution === BBVA_INSTITUTION)).toMatchObject({
      expenses: 358,
      income: 310640,
      interest: 640,
      total: 310282
    });
  });
});
