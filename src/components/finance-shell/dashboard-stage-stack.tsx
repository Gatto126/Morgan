import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

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

type VisitedDashboardStages = {
  stages: Set<DashboardStageKey>;
  userId: string | null;
};

function DashboardStageLoading() {
  return null;
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
  const [visitedState, setVisitedState] = useState<VisitedDashboardStages>({
    stages: new Set(),
    userId: null
  });
  const visibleStageKeys = useMemo(() => new Set(getVisibleDashboardStageKeys(activeUser)), [activeUser]);
  const activeDashboardStage = resolveActiveDashboardStage(stage, visibleStageKeys);
  const activeUserId = activeUser?.id ?? null;
  const renderedStageKeys = useMemo(() => {
    const persistedStages = visitedState.userId === activeUserId
      ? visitedState.stages
      : new Set<DashboardStageKey>();
    const nextKeys = new Set(persistedStages);
    nextKeys.add(activeDashboardStage);
    return nextKeys;
  }, [activeDashboardStage, activeUserId, visitedState]);

  useEffect(() => {
    if (!activeUserId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => setVisitedState((currentState) => {
      if (currentState.userId !== activeUserId) {
        return {
          stages: new Set([activeDashboardStage]),
          userId: activeUserId
        };
      }

      if (currentState.stages.has(activeDashboardStage)) {
        return currentState;
      }

      const nextStages = new Set(currentState.stages);
      nextStages.add(activeDashboardStage);
      return {
        stages: nextStages,
        userId: activeUserId
      };
    }));

    return () => window.cancelAnimationFrame(frameId);
  }, [activeDashboardStage, activeUserId]);

  if (!activeUser) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-10">
      {renderedStageKeys.has("dashboard") && visibleStageKeys.has("dashboard") ? (
        <Dashboard
          emptyStateElement={activeUser.transactionCount === 0 && !activeUser.hasBinanceCredentials ? renderInlineUploadState() : undefined}
          hasBinanceCredentials={activeUser.hasBinanceCredentials}
          isActive={isDashboardStage && activeDashboardStage === "dashboard"}
          shouldLoad={activeDashboardStage === "dashboard"}
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
      {renderedStageKeys.has("checking") && visibleStageKeys.has("checking") ? (
        <CheckingDashboard
          isActive={isDashboardStage && activeDashboardStage === "checking"}
          shouldLoad={activeDashboardStage === "checking"}
          key={`checking-${activeUser.id}`}
          userId={activeUser.id}
          onImportRefreshComplete={stage === "checking" ? onImportRefreshComplete : undefined}
          transactionCount={activeUser.transactionCount}
        />
      ) : null}
      {renderedStageKeys.has("investment") && visibleStageKeys.has("investment") ? (
        <InvestmentDashboard
          isActive={isDashboardStage && activeDashboardStage === "investment"}
          shouldLoad={activeDashboardStage === "investment"}
          key={`investment-${activeUser.id}`}
          userId={activeUser.id}
          onImportRefreshComplete={stage === "investment" ? onImportRefreshComplete : undefined}
          transactionCount={activeUser.transactionCount}
        />
      ) : null}
      {renderedStageKeys.has("crypto") && visibleStageKeys.has("crypto") ? (
        <CryptoDashboard
          isActive={isDashboardStage && activeDashboardStage === "crypto"}
          shouldLoad={activeDashboardStage === "crypto"}
          key={`crypto-${activeUser.id}`}
          userId={activeUser.id}
          onImportRefreshComplete={stage === "crypto" ? onImportRefreshComplete : undefined}
          transactionCount={activeUser.transactionCount}
        />
      ) : null}
      {renderedStageKeys.has("binance") && visibleStageKeys.has("binance") ? (
        <BinanceDashboard
          isActive={isDashboardStage && activeDashboardStage === "binance"}
          shouldLoad={activeDashboardStage === "binance"}
          key={`binance-${activeUser.id}`}
          userId={activeUser.id}
          transactionCount={activeUser.transactionCount}
        />
      ) : null}
    </div>
  );
}
