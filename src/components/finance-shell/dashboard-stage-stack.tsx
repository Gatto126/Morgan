import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { prefetchDashboardStageData } from "./dashboard-stage-data-cache";
import { getVisibleDashboardStageKeys, type DashboardStageKey } from "./dashboard-stage-items";
import type { UserRecord } from "./types";
import type { Stage } from "./use-finance-navigation";

import { cn } from "@/shared/utils";

type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;
type IdleWindow = Window & typeof globalThis & {
  cancelIdleCallback?: (handle: number) => void;
  requestIdleCallback?: (callback: IdleCallback, options?: { timeout?: number }) => number;
};

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

function resolveActiveDashboardStage(stage: Stage, visibleStageKeys: Set<DashboardStageKey>): DashboardStageKey {
  const candidateStage = stage as DashboardStageKey;

  return visibleStageKeys.has(candidateStage) ? candidateStage : "dashboard";
}

function getDashboardStageDataVersion(stageKey: DashboardStageKey, activeUser: UserRecord, binanceRefreshKey: number) {
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

function scheduleIdleTask(callback: () => void, delayMs = 0) {
  const currentWindow = window as IdleWindow;
  let cancelIdleTask: (() => void) | null = null;

  const delayId = globalThis.setTimeout(() => {
    if (
      typeof currentWindow.requestIdleCallback === "function"
      && typeof currentWindow.cancelIdleCallback === "function"
    ) {
      const idleId = currentWindow.requestIdleCallback(callback, { timeout: 1_800 });
      cancelIdleTask = () => currentWindow.cancelIdleCallback?.(idleId);
      return;
    }

    const timeoutId = globalThis.setTimeout(callback, 650);
    cancelIdleTask = () => globalThis.clearTimeout(timeoutId);
  }, delayMs);

  return () => {
    globalThis.clearTimeout(delayId);
    cancelIdleTask?.();
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
  const visibleStageKeys = useMemo(() => new Set(getVisibleDashboardStageKeys(activeUser)), [activeUser]);
  const visibleStageKey = useMemo(() => [...visibleStageKeys].join("|"), [visibleStageKeys]);
  const activeDashboardStage = resolveActiveDashboardStage(stage, visibleStageKeys);
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

  useEffect(() => {
    if (!activeUser || !activeUserId) {
      return;
    }

    let cancelled = false;
    const stagesToWarm = getVisibleDashboardStageKeys(activeUser);

    const cancelIdleTask = scheduleIdleTask(() => {
      void (async () => {
        for (const stageKey of stagesToWarm) {
          if (cancelled) return;

          void dashboardStageModuleWarmers[stageKey]().catch(() => {});
          const version = getDashboardStageDataVersion(stageKey, activeUser, binanceRefreshKey);
          prefetchDashboardStageData(stageKey, activeUserId, { version });
          await new Promise((resolve) => globalThis.setTimeout(resolve, 120));
        }
      })();
    }, warmupDelayMs);

    return () => {
      cancelled = true;
      cancelIdleTask();
    };
  }, [activeUser, activeUserId, binanceRefreshKey, visibleStageKey, warmupDelayMs]);

  if (!activeUser) {
    return null;
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
          shouldLoad={isActiveDashboardStageVisible}
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
          shouldLoad={isActiveCheckingStageVisible}
          key={`checking-${activeUser.id}`}
          userId={activeUser.id}
          onImportRefreshComplete={stage === "checking" ? onImportRefreshComplete : undefined}
          transactionCount={activeUser.checkingCount}
        />
      ) : null}
      {renderedStageKeys.has("investment") && visibleStageKeys.has("investment") ? (
        <InvestmentDashboard
          isActive={isActiveInvestmentStageVisible}
          shouldLoad={isActiveInvestmentStageVisible}
          key={`investment-${activeUser.id}`}
          userId={activeUser.id}
          onImportRefreshComplete={stage === "investment" ? onImportRefreshComplete : undefined}
          transactionCount={activeUser.investmentCount}
        />
      ) : null}
      {renderedStageKeys.has("crypto") && visibleStageKeys.has("crypto") ? (
        <CryptoDashboard
          isActive={isActiveCryptoStageVisible}
          shouldLoad={isActiveCryptoStageVisible}
          key={`crypto-${activeUser.id}`}
          userId={activeUser.id}
          onImportRefreshComplete={stage === "crypto" ? onImportRefreshComplete : undefined}
          transactionCount={activeUser.cryptoCount}
        />
      ) : null}
      {renderedStageKeys.has("binance") && visibleStageKeys.has("binance") ? (
        <BinanceDashboard
          isActive={isActiveBinanceStageVisible}
          shouldLoad={isActiveBinanceStageVisible}
          key={`binance-${activeUser.id}`}
          userId={activeUser.id}
          binanceRefreshKey={binanceRefreshKey}
          transactionCount={activeUser.transactionCount}
        />
      ) : null}
    </div>
  );
}
