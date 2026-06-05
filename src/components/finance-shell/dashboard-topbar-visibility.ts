import type { DashboardStageKey } from "./dashboard-stage-items";
import type { UserRecord } from "./types";

export function hasDashboardStageTopbarData(activeUser: UserRecord, activeStage: DashboardStageKey) {
  switch (activeStage) {
    case "binance":
      return activeUser.hasBinanceCredentials || !!activeUser.hasBinanceData;
    case "checking":
      return activeUser.checkingCount > 0;
    case "crypto":
      return activeUser.cryptoCount > 0;
    case "investment":
      return activeUser.investmentCount > 0;
    case "dashboard":
    default:
      return activeUser.transactionCount > 0 || activeUser.hasBinanceCredentials || !!activeUser.hasBinanceData;
  }
}
