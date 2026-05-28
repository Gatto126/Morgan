import { describe, expect, it } from "vitest";

import { resolveDailyEndingBalanceCents } from "@/domain/finance/checking-balance";

describe("checking balance helpers", () => {
  it("resolves the end-of-day balance from shuffled same-day balance snapshots", () => {
    const transactions = [
      { direction: "OUT", amountCents: 5_000, balanceCents: 364_112 },
      { direction: "OUT", amountCents: 56, balanceCents: 64_056 },
      { direction: "OUT", amountCents: 5_000, balanceCents: 59_056 },
      { direction: "OUT", amountCents: 300_000, balanceCents: 64_112 }
    ];

    expect(resolveDailyEndingBalanceCents(transactions, 369_112)).toBe(59_056);
  });

  it("can infer the terminal balance without a previous day anchor", () => {
    const transactions = [
      { direction: "OUT", amountCents: 10_000, balanceCents: 369_112 },
      { direction: "IN", amountCents: 56, balanceCents: 378_694 },
      { direction: "IN", amountCents: 418, balanceCents: 379_112 }
    ];

    expect(resolveDailyEndingBalanceCents(transactions)).toBe(369_112);
  });

  it("falls back to previous balance plus net flow when snapshots cannot be chained", () => {
    const transactions = [
      { direction: "IN", amountCents: 1_000, balanceCents: 50_000 },
      { direction: "OUT", amountCents: 250, balanceCents: 75_000 }
    ];

    expect(resolveDailyEndingBalanceCents(transactions, 10_000)).toBe(10_750);
  });
});
