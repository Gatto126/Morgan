import { describe, expect, it } from "vitest";

import {
  applyImportedTransactionCountsToUser,
  getImportedProfileWarmupStages
} from "@/components/finance-shell/import-data-warmup";
import type { UserRecord } from "@/components/finance-shell/types";
import type { ImportedTransactionCounts } from "@/components/finance-shell/use-transaction-import";

const baseUser: UserRecord = {
  id: "profile-1",
  name: "Main",
  transactionCount: 10,
  checkingCount: 2,
  investmentCount: 3,
  cryptoCount: 0,
  hasBinanceCredentials: false
};

describe("import data warmup", () => {
  it("builds the post-import profile counts used for cache versions", () => {
    const counts: ImportedTransactionCounts = {
      insertedCount: 4,
      addedChecking: 1,
      addedInvestment: 2,
      addedCrypto: 1
    };

    expect(applyImportedTransactionCountsToUser(baseUser, counts)).toEqual({
      ...baseUser,
      checkingCount: 3,
      cryptoCount: 1,
      investmentCount: 5,
      transactionCount: 14
    });
  });

  it("warms the dashboard and only the sections touched by the import", () => {
    expect(getImportedProfileWarmupStages(baseUser, {
      insertedCount: 2,
      addedChecking: 0,
      addedInvestment: 2,
      addedCrypto: 0
    })).toEqual(["dashboard", "investment"]);

    expect(getImportedProfileWarmupStages(baseUser, {
      insertedCount: 1,
      addedChecking: 0,
      addedInvestment: 0,
      addedCrypto: 1
    })).toEqual(["dashboard", "crypto"]);
  });

  it("includes Binance balances when the imported profile has API credentials", () => {
    expect(getImportedProfileWarmupStages({
      ...baseUser,
      hasBinanceCredentials: true
    }, {
      insertedCount: 1,
      addedChecking: 1,
      addedInvestment: 0,
      addedCrypto: 0
    })).toEqual(["dashboard", "checking", "binance"]);
  });
});
