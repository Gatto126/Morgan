import { cookies, headers } from "next/headers";

import { AuthShell } from "@/components/auth-shell";
import { FinanceShell, type PrimedDashboardStageData } from "@/components/finance-shell";
import {
  getDashboardStageDataVersion,
  isDashboardStageKey,
  resolveVisibleDashboardStage,
  type DashboardStageKey
} from "@/components/finance-shell/dashboard-stage-items";
import {
  ACTIVE_PROFILE_PERSISTENCE_KEY,
  ACTIVE_STAGE_PERSISTENCE_KEY,
  type PersistedFinanceSelection,
  resolveRestoredStage
} from "@/components/finance-shell/persistence-state";
import type { UserRecord } from "@/components/finance-shell/types";
import { auth } from "@/server/auth/auth";
import { getBinanceBalancesStatus } from "@/server/services/binance-sync";
import { getCheckingSummaryData } from "@/server/services/checking-data";
import { getDashboardData } from "@/server/services/dashboard-data";
import {
  getInvestmentPortfolioSummaryData,
  getTradeRepublicCryptoPortfolioSummaryData
} from "@/server/services/portfolio-data";
import { getCachedProfileData, makeProfileStageCacheKey } from "@/server/services/profile-data-cache";
import { listProfiles } from "@/server/services/profile-service";

export const dynamic = "force-dynamic";

async function loadDashboardStageData(stage: DashboardStageKey, userId: string) {
  switch (stage) {
    case "checking":
      return getCheckingSummaryData(userId);
    case "investment": {
      const { result } = await getInvestmentPortfolioSummaryData(userId);
      return result;
    }
    case "crypto": {
      const { result } = await getTradeRepublicCryptoPortfolioSummaryData(userId);
      return result;
    }
    case "binance": {
      const payload = await getBinanceBalancesStatus(userId);
      return {
        ...payload,
        syncedAt: payload.syncedAt?.toISOString() ?? null
      };
    }
    case "dashboard":
    default:
      return getDashboardData(userId);
  }
}

async function getInitialDashboardStageData(
  activeUser: UserRecord | null,
  stage: string | null
): Promise<PrimedDashboardStageData | null> {
  if (!activeUser || !stage || !isDashboardStageKey(stage)) {
    return null;
  }

  const dashboardStage = resolveVisibleDashboardStage(stage, activeUser);
  const version = getDashboardStageDataVersion(dashboardStage, activeUser);
  const cacheKey = makeProfileStageCacheKey(dashboardStage, activeUser.id, String(version));
  const data = await getCachedProfileData(
    cacheKey,
    () => loadDashboardStageData(dashboardStage, activeUser.id)
  );

  return {
    data,
    stage: dashboardStage,
    userId: activeUser.id,
    version
  };
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
  const initialDashboardStageData = await getInitialDashboardStageData(persistedActiveUser, persistedStage);

  return (
    <FinanceShell
      accountName={session.user.name}
      initialDashboardStageData={initialDashboardStageData}
      initialSelection={initialSelection}
      initialUsers={usersWithCount}
    />
  );
}
