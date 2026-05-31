import { cookies, headers } from "next/headers";

import { AuthShell } from "@/components/auth-shell";
import { FinanceShell, type PrimedDashboardStageData } from "@/components/finance-shell";
import { getVisibleDashboardStageKeys, type DashboardStageKey } from "@/components/finance-shell/dashboard-stage-items";
import {
  ACTIVE_PROFILE_PERSISTENCE_KEY,
  ACTIVE_STAGE_PERSISTENCE_KEY,
  type PersistedFinanceSelection,
  resolveRestoredStage
} from "@/components/finance-shell/persistence-state";
import { auth } from "@/server/auth/auth";
import { getBinanceBalancesStatus } from "@/server/services/binance-sync";
import { getCheckingSummaryData } from "@/server/services/checking-data";
import { getDashboardData } from "@/server/services/dashboard-data";
import { getInvestmentPortfolioSummaryData, getTradeRepublicCryptoPortfolioSummaryData } from "@/server/services/portfolio-data";
import { getCachedProfileData, makeProfileStageCacheKey } from "@/server/services/profile-data-cache";
import { listProfiles } from "@/server/services/profile-service";
import type { UserRecord } from "@/components/finance-shell/types";
import type { Stage } from "@/components/finance-shell/use-finance-navigation";

export const dynamic = "force-dynamic";

const dashboardStageKeys = new Set<DashboardStageKey>(["dashboard", "checking", "investment", "crypto", "binance"]);

function isDashboardStageKey(stage: Stage): stage is DashboardStageKey {
  return dashboardStageKeys.has(stage as DashboardStageKey);
}

async function getPrimedDashboardStageData(
  activeUser: UserRecord | null,
  stage: Stage
): Promise<PrimedDashboardStageData | null> {
  if (!activeUser || !isDashboardStageKey(stage)) {
    return null;
  }

  const visibleStages = new Set(getVisibleDashboardStageKeys(activeUser));
  if (!visibleStages.has(stage)) {
    return null;
  }

  const version = stage === "binance" ? 0 : activeUser.transactionCount;
  const versionKey = String(version);

  try {
    switch (stage) {
      case "dashboard":
        return {
          data: await getCachedProfileData(
            makeProfileStageCacheKey("dashboard", activeUser.id, versionKey),
            () => getDashboardData(activeUser.id)
          ),
          stage,
          userId: activeUser.id,
          version
        };
      case "checking":
        return {
          data: await getCachedProfileData(
            makeProfileStageCacheKey("checking", activeUser.id, versionKey),
            () => getCheckingSummaryData(activeUser.id)
          ),
          stage,
          userId: activeUser.id,
          version
        };
      case "investment": {
        const { result } = await getCachedProfileData(
          makeProfileStageCacheKey("investment", activeUser.id, versionKey),
          () => getInvestmentPortfolioSummaryData(activeUser.id)
        );

        return {
          data: result,
          stage,
          userId: activeUser.id,
          version
        };
      }
      case "crypto": {
        const { result } = await getCachedProfileData(
          makeProfileStageCacheKey("crypto", activeUser.id, versionKey),
          () => getTradeRepublicCryptoPortfolioSummaryData(activeUser.id)
        );

        return {
          data: result,
          stage,
          userId: activeUser.id,
          version
        };
      }
      case "binance": {
        const payload = await getCachedProfileData(
          makeProfileStageCacheKey("binance", activeUser.id, versionKey),
          () => getBinanceBalancesStatus(activeUser.id),
          30_000
        );

        return {
          data: {
            balances: payload.balances,
            hasApiKey: payload.hasApiKey,
            isStale: payload.isStale,
            syncedAt: payload.syncedAt?.toISOString() ?? null
          },
          stage,
          userId: activeUser.id,
          version
        };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user?.id) {
    return <AuthShell />;
  }

  const usersWithCount = await listProfiles(session.user.id);
  const cookieStore = await cookies();
  const persistedActiveUserId = cookieStore.get(ACTIVE_PROFILE_PERSISTENCE_KEY)?.value ?? null;
  const persistedStage = resolveRestoredStage(cookieStore.get(ACTIVE_STAGE_PERSISTENCE_KEY)?.value ?? null);
  const persistedActiveUser = persistedActiveUserId
    ? usersWithCount.find((user) => user.id === persistedActiveUserId) ?? null
    : null;
  const initialSelection: PersistedFinanceSelection | null = persistedActiveUser
    ? { activeUserId: persistedActiveUser.id, stage: persistedStage }
    : null;
  const initialDashboardStageData = await getPrimedDashboardStageData(persistedActiveUser, persistedStage);

  return (
    <FinanceShell
      accountName={session.user.name}
      initialDashboardStageData={initialDashboardStageData}
      initialSelection={initialSelection}
      initialUsers={usersWithCount}
    />
  );
}
