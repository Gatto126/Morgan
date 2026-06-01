import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  getVisibleDashboardStageKeys,
  resolveVisibleDashboardStage,
  type DashboardStageKey
} from "./dashboard-stage-items";
import { ensureFinanceStageReady, getPrioritizedProfileStageWarmupOrder } from "./finance-session-orchestrator";
import type { UserRecord } from "./types";
import type { Stage } from "./use-finance-navigation";

import { cn } from "@/shared/utils";

const loadDashboard = () => import("../dashboard").then((mod) => mod.Dashboard);
const loadCheckingDashboard = () => import("../checking-dashboard").then((mod) => mod.CheckingDashboard);
const loadInvestmentDashboard = () => import("../investment-dashboard").then((mod) => mod.InvestmentDashboard);
const loadCryptoDashboard = () => import("../crypto-dashboard").then((mod) => mod.CryptoDashboard);
const loadBinanceDashboard = () => import("../binance-dashboard").then((mod) => mod.BinanceDashboard);

const dashboardStageModuleWarmers = {
  binance: loadBinanceDashboard,
  checking: loadCheckingDashboard,
  crypto: loadCryptoDashboard,
  dashboard: loadDashboard,
  investment: loadInvestmentDashboard
} satisfies Record<DashboardStageKey, () => Promise<unknown>>;

const Dashboard = dynamic(
  loadDashboard,
  { loading: DashboardStageLoading, ssr: false }
);

const CheckingDashboard = dynamic(
  loadCheckingDashboard,
  { loading: DashboardStageLoading, ssr: false }
);

const InvestmentDashboard = dynamic(
  loadInvestmentDashboard,
  { loading: DashboardStageLoading, ssr: false }
);

const CryptoDashboard = dynamic(
  loadCryptoDashboard,
  { loading: DashboardStageLoading, ssr: false }
);

const BinanceDashboard = dynamic(
  loadBinanceDashboard,
  { loading: DashboardStageLoading, ssr: false }
);

type DashboardStageStackProps = {
  activeUser: UserRecord | null;
  binanceRefreshKey: number;
  isDashboardStage: boolean;
  onImportRefreshComplete: () => void;
  renderInlineUploadState: () => ReactNode;
  stage: Stage;
  warmupDelayMs?: number;
};

type VisitedDashboardStages = {
  stages: Set<DashboardStageKey>;
  userId: string | null;
};

function DashboardStageLoading() {
  return null;
}

function scheduleDashboardWarmup(callback: () => void, delayMs = 0) {
  const delayId = globalThis.setTimeout(callback, delayMs);

  return () => {
    globalThis.clearTimeout(delayId);
  };
}

export function DashboardStageStack({
  activeUser,
  binanceRefreshKey,
  isDashboardStage,
  onImportRefreshComplete,
  renderInlineUploadState,
  stage,
  warmupDelayMs = 0
}: DashboardStageStackProps) {
  const [visitedState, setVisitedState] = useState<VisitedDashboardStages>({
    stages: new Set(),
    userId: null
  });
  const [prewarmedState, setPrewarmedState] = useState<VisitedDashboardStages>({
    stages: new Set(),
    userId: null
  });
  const [hasMountedClientDashboard, setHasMountedClientDashboard] = useState(false);
  const visibleStageKeys = useMemo(() => new Set(getVisibleDashboardStageKeys(activeUser)), [activeUser]);
  const visibleStageKey = useMemo(() => [...visibleStageKeys].join("|"), [visibleStageKeys]);
  const activeDashboardStage = resolveVisibleDashboardStage(stage, activeUser);
  const activeUserId = activeUser?.id ?? null;
  const isActiveDashboardStageVisible = isDashboardStage && activeDashboardStage === "dashboard";
  const isActiveCheckingStageVisible = isDashboardStage && activeDashboardStage === "checking";
  const isActiveInvestmentStageVisible = isDashboardStage && activeDashboardStage === "investment";
  const isActiveCryptoStageVisible = isDashboardStage && activeDashboardStage === "crypto";
  const isActiveBinanceStageVisible = isDashboardStage && activeDashboardStage === "binance";
  const renderedStageKeys = useMemo(() => {
    const persistedStages = visitedState.userId === activeUserId
      ? visitedState.stages
      : new Set<DashboardStageKey>();
    const prewarmedStages = prewarmedState.userId === activeUserId
      ? prewarmedState.stages
      : new Set<DashboardStageKey>();
    const nextKeys = new Set(persistedStages);
    prewarmedStages.forEach((stageKey) => nextKeys.add(stageKey));
    nextKeys.add(activeDashboardStage);
    return nextKeys;
  }, [activeDashboardStage, activeUserId, prewarmedState, visitedState]);

  const shouldBackgroundLoadStage = (stageKey: DashboardStageKey) =>
    prewarmedState.userId === activeUserId && prewarmedState.stages.has(stageKey);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setHasMountedClientDashboard(true));

    return () => window.cancelAnimationFrame(frameId);
  }, []);

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

  useEffect(() => {
    if (!activeUser || !activeUserId) {
      return;
    }

    let cancelled = false;
    const stagesToWarm = getPrioritizedProfileStageWarmupOrder(activeUser, activeDashboardStage);

    const cancelWarmupTask = scheduleDashboardWarmup(() => {
      void (async () => {
        for (const stageKey of stagesToWarm) {
          if (cancelled) return;

          void dashboardStageModuleWarmers[stageKey]().catch(() => {});
          void ensureFinanceStageReady({
            binanceRefreshKey,
            event: stageKey === activeDashboardStage ? "dashboard-change" : "profile-change",
            priority: stageKey === activeDashboardStage ? "user" : "background",
            stage: stageKey,
            user: activeUser
          }).finally(() => {
            if (cancelled) return;

            setPrewarmedState((currentState) => {
              const currentStages = currentState.userId === activeUserId
                ? currentState.stages
                : new Set<DashboardStageKey>();

              if (currentState.userId === activeUserId && currentStages.has(stageKey)) {
                return currentState;
              }

              const nextStages = new Set(currentStages);
              nextStages.add(stageKey);
              return {
                stages: nextStages,
                userId: activeUserId
              };
            });
          });
          await new Promise((resolve) => globalThis.setTimeout(resolve, stageKey === activeDashboardStage ? 0 : 80));
        }
      })();
    }, warmupDelayMs);

    return () => {
      cancelled = true;
      cancelWarmupTask();
    };
  }, [activeDashboardStage, activeUser, activeUserId, binanceRefreshKey, visibleStageKey, warmupDelayMs]);

  if (!activeUser) {
    return null;
  }

  if (!hasMountedClientDashboard) {
    return (
      <div
        aria-hidden={!isDashboardStage ? "true" : undefined}
        className={cn("absolute inset-0 z-10", !isDashboardStage && "pointer-events-none")}
      />
    );
  }

  return (
    <div
      aria-hidden={!isDashboardStage ? "true" : undefined}
      className={cn("absolute inset-0 z-10", !isDashboardStage && "pointer-events-none")}
    >
      {renderedStageKeys.has("dashboard") && visibleStageKeys.has("dashboard") ? (
        <Dashboard
          emptyStateElement={activeUser.transactionCount === 0 && !activeUser.hasBinanceCredentials ? renderInlineUploadState() : undefined}
          hasBinanceCredentials={activeUser.hasBinanceCredentials}
          isActive={isActiveDashboardStageVisible}
          shouldLoad={isActiveDashboardStageVisible || shouldBackgroundLoadStage("dashboard")}
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
          isActive={isActiveCheckingStageVisible}
          shouldLoad={isActiveCheckingStageVisible || shouldBackgroundLoadStage("checking")}
          key={`checking-${activeUser.id}`}
          userId={activeUser.id}
          onImportRefreshComplete={stage === "checking" ? onImportRefreshComplete : undefined}
          transactionCount={activeUser.checkingCount}
        />
      ) : null}
      {renderedStageKeys.has("investment") && visibleStageKeys.has("investment") ? (
        <InvestmentDashboard
          isActive={isActiveInvestmentStageVisible}
          shouldLoad={isActiveInvestmentStageVisible || shouldBackgroundLoadStage("investment")}
          key={`investment-${activeUser.id}`}
          userId={activeUser.id}
          onImportRefreshComplete={stage === "investment" ? onImportRefreshComplete : undefined}
          transactionCount={activeUser.investmentCount}
        />
      ) : null}
      {renderedStageKeys.has("crypto") && visibleStageKeys.has("crypto") ? (
        <CryptoDashboard
          isActive={isActiveCryptoStageVisible}
          shouldLoad={isActiveCryptoStageVisible || shouldBackgroundLoadStage("crypto")}
          key={`crypto-${activeUser.id}`}
          userId={activeUser.id}
          binanceRefreshKey={binanceRefreshKey}
          hasBinanceCredentials={activeUser.hasBinanceCredentials}
          onImportRefreshComplete={stage === "crypto" ? onImportRefreshComplete : undefined}
          transactionCount={activeUser.cryptoCount}
        />
      ) : null}
      {renderedStageKeys.has("binance") && visibleStageKeys.has("binance") ? (
        <BinanceDashboard
          isActive={isActiveBinanceStageVisible}
          shouldLoad={isActiveBinanceStageVisible || shouldBackgroundLoadStage("binance")}
          key={`binance-${activeUser.id}`}
          userId={activeUser.id}
          binanceRefreshKey={binanceRefreshKey}
          transactionCount={activeUser.transactionCount}
        />
      ) : null}
    </div>
  );
}
