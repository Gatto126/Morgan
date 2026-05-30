import { describe, expect, it, vi } from "vitest";

import {
  getCheckingSummaryData,
  getCheckingTransactionRows
} from "@/server/services/checking-data";

describe("checking data service", () => {
  const checkingRow = {
    id: "checking-1",
    sourceInstitution: "bbva",
    bookingDate: new Date("2026-01-01T00:00:00.000Z"),
    typeLabel: "Salary",
    description: "Monthly salary",
    direction: "IN",
    amountCents: 100_000,
    balanceCents: 100_000
  };

  it("builds a summary payload without provider transaction rows", async () => {
    const repository = {
      listCheckingTransactions: vi.fn(async () => [
        checkingRow,
        {
          id: "checking-2",
          sourceInstitution: "bbva",
          bookingDate: new Date("2026-01-02T00:00:00.000Z"),
          typeLabel: "Card",
          description: "Card payment",
          direction: "OUT",
          amountCents: 20_000,
          balanceCents: 80_000
        }
      ])
    };

    const result = await getCheckingSummaryData(
      "profile-1",
      repository,
      new Date("2026-01-02T12:00:00.000Z")
    );

    expect(result.providers[0]).toMatchObject({
      sourceInstitution: "bbva",
      transactionCount: 2
    });
    expect(result.providers[0]).not.toHaveProperty("transactions");
  });

  it("loads checking transaction rows through the repository", async () => {
    const repository = {
      listCheckingTransactionRows: vi.fn(async () => ({
        total: 2,
        transactions: [checkingRow]
      }))
    };

    await expect(getCheckingTransactionRows("profile-1", "bbva", {
      limit: 100,
      offset: 0,
      repository
    })).resolves.toEqual({
      total: 2,
      transactions: [checkingRow]
    });

    expect(repository.listCheckingTransactionRows).toHaveBeenCalledWith("profile-1", {
      limit: 100,
      offset: 0,
      sourceInstitution: "bbva"
    });
  });
});
