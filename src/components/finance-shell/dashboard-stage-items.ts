import type { UserRecord } from "./types";

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
