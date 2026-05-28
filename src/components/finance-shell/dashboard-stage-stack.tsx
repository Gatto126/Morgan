import type { ReactNode } from "react";

import { BinanceDashboard } from "../binance-dashboard";
import { CheckingDashboard } from "../checking-dashboard";
import { CryptoDashboard } from "../crypto-dashboard";
import { Dashboard } from "../dashboard";
import { InvestmentDashboard } from "../investment-dashboard";
import { getVisibleDashboardStageKeys } from "./dashboard-stage-items";
import type { UserRecord } from "./types";
import type { Stage } from "./use-finance-navigation";

import { cn } from "@/shared/utils";

type DashboardStageStackProps = {
  activeUser: UserRecord | null;
  binanceRefreshKey: number;
  isDashboardStage: boolean;
  onImportRefreshComplete: () => void;
  renderInlineUploadState: () => ReactNode;
  stage: Stage;
};

export function DashboardStageStack({
  activeUser,
  binanceRefreshKey,
  isDashboardStage,
  onImportRefreshComplete,
  renderInlineUploadState,
  stage
}: DashboardStageStackProps) {
  if (!activeUser) {
    return null;
  }

  const visibleStageKeys = new Set(getVisibleDashboardStageKeys(activeUser));

  return (
    <div className={cn("absolute inset-0", isDashboardStage ? "z-10" : "z-0 pointer-events-none opacity-0 invisible")}>
      <Dashboard
        emptyStateElement={activeUser.transactionCount === 0 && !activeUser.hasBinanceCredentials ? renderInlineUploadState() : undefined}
        hasBinanceCredentials={activeUser.hasBinanceCredentials}
        isActive={stage === "dashboard"}
        shouldLoad={activeUser.transactionCount > 0 || stage === "dashboard"}
        key={`dashboard-${activeUser.id}`}
        userId={activeUser.id}
        binanceRefreshKey={binanceRefreshKey}
        onImportRefreshComplete={stage === "dashboard" ? onImportRefreshComplete : undefined}
        checkingCount={activeUser.checkingCount}
        investmentCount={activeUser.investmentCount}
        cryptoCount={activeUser.cryptoCount}
        transactionCount={activeUser.transactionCount}
      />
      {visibleStageKeys.has("checking") ? (
        <CheckingDashboard
          isActive={stage === "checking"}
          shouldLoad
          key={`checking-${activeUser.id}`}
          userId={activeUser.id}
          onImportRefreshComplete={stage === "checking" ? onImportRefreshComplete : undefined}
          transactionCount={activeUser.transactionCount}
        />
      ) : null}
      {visibleStageKeys.has("investment") ? (
        <InvestmentDashboard
          isActive={stage === "investment"}
          shouldLoad
          key={`investment-${activeUser.id}`}
          userId={activeUser.id}
          onImportRefreshComplete={stage === "investment" ? onImportRefreshComplete : undefined}
          transactionCount={activeUser.transactionCount}
        />
      ) : null}
      {visibleStageKeys.has("crypto") ? (
        <CryptoDashboard
          isActive={stage === "crypto"}
          shouldLoad
          key={`crypto-${activeUser.id}`}
          userId={activeUser.id}
          onImportRefreshComplete={stage === "crypto" ? onImportRefreshComplete : undefined}
          transactionCount={activeUser.transactionCount}
        />
      ) : null}
      {visibleStageKeys.has("binance") ? (
        <BinanceDashboard
          isActive={stage === "binance"}
          shouldLoad
          key={`binance-${activeUser.id}`}
          userId={activeUser.id}
          transactionCount={activeUser.transactionCount}
        />
      ) : null}
    </div>
  );
}
