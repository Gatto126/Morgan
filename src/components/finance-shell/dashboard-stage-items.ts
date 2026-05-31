import type { UserRecord } from "./types";
import type { Stage } from "./use-finance-navigation";

export type DashboardStageKey = "dashboard" | "checking" | "investment" | "crypto" | "binance";

export function getVisibleDashboardStageKeys(activeUser: UserRecord | null): DashboardStageKey[] {
  if (!activeUser) {
    return [];
  }

  const stageKeys: DashboardStageKey[] = ["dashboard"];

  if (activeUser.checkingCount > 0) {
    stageKeys.push("checking");
  }

  if (activeUser.investmentCount > 0) {
    stageKeys.push("investment");
  }

  if (activeUser.cryptoCount > 0) {
    stageKeys.push("crypto");
  }

  if (activeUser.hasBinanceCredentials) {
    stageKeys.push("binance");
  }

  return stageKeys;
}

export function isDashboardStageKey(stage: Stage | string): stage is DashboardStageKey {
  return stage === "dashboard"
    || stage === "checking"
    || stage === "investment"
    || stage === "crypto"
    || stage === "binance";
}

export function resolveVisibleDashboardStage(
  stage: Stage | string,
  activeUser: UserRecord | null
): DashboardStageKey {
  const visibleStageKeys = new Set(getVisibleDashboardStageKeys(activeUser));
  const candidateStage = isDashboardStageKey(stage) ? stage : "dashboard";

  return visibleStageKeys.has(candidateStage) ? candidateStage : "dashboard";
}

export function getDashboardStageDataVersion(
  stageKey: DashboardStageKey,
  activeUser: UserRecord,
  binanceRefreshKey = 0
) {
  switch (stageKey) {
    case "binance":
      return binanceRefreshKey;
    case "checking":
      return activeUser.checkingCount;
    case "crypto":
      return activeUser.cryptoCount;
    case "investment":
      return activeUser.investmentCount;
    case "dashboard":
    default:
      return activeUser.transactionCount;
  }
}
