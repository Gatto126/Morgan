import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { getVisibleDashboardStageKeys, type DashboardStageKey } from "./dashboard-stage-items";
import type { UserRecord } from "./types";
import type { Stage } from "./use-finance-navigation";

const Dashboard = dynamic(
  () => import("../dashboard").then((mod) => mod.Dashboard),
  { loading: DashboardStageLoading, ssr: false }
);

const CheckingDashboard = dynamic(
  () => import("../checking-dashboard").then((mod) => mod.CheckingDashboard),
  { loading: DashboardStageLoading, ssr: false }
);

const InvestmentDashboard = dynamic(
  () => import("../investment-dashboard").then((mod) => mod.InvestmentDashboard),
  { loading: DashboardStageLoading, ssr: false }
);

const CryptoDashboard = dynamic(
  () => import("../crypto-dashboard").then((mod) => mod.CryptoDashboard),
  { loading: DashboardStageLoading, ssr: false }
);

const BinanceDashboard = dynamic(
  () => import("../binance-dashboard").then((mod) => mod.BinanceDashboard),
  { loading: DashboardStageLoading, ssr: false }
);

type DashboardStageStackProps = {
  activeUser: UserRecord | null;
  binanceRefreshKey: number;
  isDashboardStage: boolean;
  onImportRefreshComplete: () => void;
  renderInlineUploadState: () => ReactNode;
  stage: Stage;
};

function DashboardStageLoading() {
  return (
    <div className="absolute inset-0 flex h-full w-full items-center justify-center">
      <div className="import-spinner" />
    </div>
  );
}

function resolveActiveDashboardStage(stage: Stage, visibleStageKeys: Set<DashboardStageKey>): DashboardStageKey {
  const candidateStage = stage as DashboardStageKey;

  return visibleStageKeys.has(candidateStage) ? candidateStage : "dashboard";
}

export function DashboardStageStack({
  activeUser,
  binanceRefreshKey,
  isDashboardStage,
  onImportRefreshComplete,
  renderInlineUploadState,
  stage
}: DashboardStageStackProps) {
  if (!activeUser || !isDashboardStage) {
    return null;
  }

  const visibleStageKeys = new Set(getVisibleDashboardStageKeys(activeUser));
  const activeDashboardStage = resolveActiveDashboardStage(stage, visibleStageKeys);

  return (
    <div className="absolute inset-0 z-10">
      {activeDashboardStage === "dashboard" ? (
        <Dashboard
          emptyStateElement={activeUser.transactionCount === 0 && !activeUser.hasBinanceCredentials ? renderInlineUploadState() : undefined}
          hasBinanceCredentials={activeUser.hasBinanceCredentials}
          isActive
          shouldLoad
          key={`dashboard-${activeUser.id}`}
          userId={activeUser.id}
          binanceRefreshKey={binanceRefreshKey}
          onImportRefreshComplete={stage === "dashboard" ? onImportRefreshComplete : undefined}
          checkingCount={activeUser.checkingCount}
          investmentCount={activeUser.investmentCount}
          cryptoCount={activeUser.cryptoCount}
          transactionCount={activeUser.transactionCount}
        />
      ) : null}
      {activeDashboardStage === "checking" ? (
        <CheckingDashboard
          isActive
          shouldLoad
          key={`checking-${activeUser.id}`}
          userId={activeUser.id}
          onImportRefreshComplete={stage === "checking" ? onImportRefreshComplete : undefined}
          transactionCount={activeUser.transactionCount}
        />
      ) : null}
      {activeDashboardStage === "investment" ? (
        <InvestmentDashboard
          isActive
          shouldLoad
          key={`investment-${activeUser.id}`}
          userId={activeUser.id}
          onImportRefreshComplete={stage === "investment" ? onImportRefreshComplete : undefined}
          transactionCount={activeUser.transactionCount}
        />
      ) : null}
      {activeDashboardStage === "crypto" ? (
        <CryptoDashboard
          isActive
          shouldLoad
          key={`crypto-${activeUser.id}`}
          userId={activeUser.id}
          onImportRefreshComplete={stage === "crypto" ? onImportRefreshComplete : undefined}
          transactionCount={activeUser.transactionCount}
        />
      ) : null}
      {activeDashboardStage === "binance" ? (
        <BinanceDashboard
          isActive
          shouldLoad
          key={`binance-${activeUser.id}`}
          userId={activeUser.id}
          transactionCount={activeUser.transactionCount}
        />
      ) : null}
    </div>
  );
}
