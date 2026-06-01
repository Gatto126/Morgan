"use client";

import {
  getVisibleDashboardStageKeys,
  type DashboardStageKey
} from "./dashboard-stage-items";
import {
  ensureFinanceCurrentValuation,
  ensureFinanceStageReady
} from "./finance-session-orchestrator";
import type { UserRecord } from "./types";
import type { ImportedTransactionCounts } from "./use-transaction-import";

type WarmImportedProfileDataOptions = {
  binanceRefreshKey?: number;
};

export function applyImportedTransactionCountsToUser(
  user: UserRecord,
  {
    addedChecking,
    addedCrypto,
    addedInvestment,
    insertedCount
  }: ImportedTransactionCounts
): UserRecord {
  return {
    ...user,
    checkingCount: user.checkingCount + addedChecking,
    cryptoCount: user.cryptoCount + addedCrypto,
    investmentCount: user.investmentCount + addedInvestment,
    transactionCount: user.transactionCount + insertedCount
  };
}

export function getImportedProfileWarmupStages(
  user: UserRecord,
  counts: ImportedTransactionCounts
): DashboardStageKey[] {
  const nextUser = applyImportedTransactionCountsToUser(user, counts);
  const visibleStages = new Set(getVisibleDashboardStageKeys(nextUser));
  const stages: DashboardStageKey[] = [];

  if (counts.insertedCount > 0 && visibleStages.has("dashboard")) {
    stages.push("dashboard");
  }

  if (counts.addedChecking > 0 && visibleStages.has("checking")) {
    stages.push("checking");
  }

  if (counts.addedInvestment > 0 && visibleStages.has("investment")) {
    stages.push("investment");
  }

  if (counts.addedCrypto > 0 && visibleStages.has("crypto")) {
    stages.push("crypto");
  }

  if (nextUser.hasBinanceCredentials && visibleStages.has("binance")) {
    stages.push("binance");
  }

  return stages;
}

export async function warmImportedProfileData(
  user: UserRecord,
  counts: ImportedTransactionCounts,
  { binanceRefreshKey = 0 }: WarmImportedProfileDataOptions = {}
) {
  const nextUser = applyImportedTransactionCountsToUser(user, counts);
  const stages = getImportedProfileWarmupStages(user, counts);

  if (stages.length === 0) {
    return nextUser;
  }

  await Promise.allSettled([
    ...stages.map((stage) => ensureFinanceStageReady({
      binanceRefreshKey,
      event: "import",
      force: true,
      priority: stage === "dashboard" ? "user" : "active",
      stage,
      user: nextUser
    }))
  ]);
  await ensureFinanceCurrentValuation({
    binanceRefreshKey,
    event: "import",
    force: true,
    livePriceMaxAgeMs: 0,
    priority: "user",
    user: nextUser
  });

  return nextUser;
}
