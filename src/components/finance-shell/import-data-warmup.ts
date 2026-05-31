"use client";

import type { DashboardData } from "@/components/dashboard/types";
import type { PortfolioData } from "@/components/portfolio-dashboard/types";
import { fetchAndCacheLivePrices } from "@/shared/live-prices";

import { fetchDashboardStageData } from "./dashboard-stage-data-cache";
import {
  getDashboardStageDataVersion,
  getVisibleDashboardStageKeys,
  type DashboardStageKey
} from "./dashboard-stage-items";
import { collectDashboardLivePriceKeys } from "./login-live-price-warmup";
import type { UserRecord } from "./types";
import type { ImportedTransactionCounts } from "./use-transaction-import";

type WarmImportedProfileDataOptions = {
  binanceRefreshKey?: number;
};

type LivePriceKeySets = {
  cryptos: Set<string>;
  isins: Set<string>;
};

export function applyImportedTransactionCountsToUser(
  user: UserRecord,
  {
    addedChecking,
    addedCrypto,
    addedInvestment,
    insertedCount
  }: ImportedTransactionCounts
): UserRecord {
  return {
    ...user,
    checkingCount: user.checkingCount + addedChecking,
    cryptoCount: user.cryptoCount + addedCrypto,
    investmentCount: user.investmentCount + addedInvestment,
    transactionCount: user.transactionCount + insertedCount
  };
}

export function getImportedProfileWarmupStages(
  user: UserRecord,
  counts: ImportedTransactionCounts
): DashboardStageKey[] {
  const nextUser = applyImportedTransactionCountsToUser(user, counts);
  const visibleStages = new Set(getVisibleDashboardStageKeys(nextUser));
  const stages: DashboardStageKey[] = [];

  if (counts.insertedCount > 0 && visibleStages.has("dashboard")) {
    stages.push("dashboard");
  }

  if (counts.addedChecking > 0 && visibleStages.has("checking")) {
    stages.push("checking");
  }

  if (counts.addedInvestment > 0 && visibleStages.has("investment")) {
    stages.push("investment");
  }

  if (counts.addedCrypto > 0 && visibleStages.has("crypto")) {
    stages.push("crypto");
  }

  if (nextUser.hasBinanceCredentials && visibleStages.has("binance")) {
    stages.push("binance");
  }

  return stages;
}

function isPortfolioData(data: unknown): data is PortfolioData {
  return !!data
    && typeof data === "object"
    && Array.isArray((data as Partial<PortfolioData>).providers);
}

function addDashboardLivePriceKeys(keys: LivePriceKeySets, dashboardData: DashboardData | null) {
  const dashboardKeys = collectDashboardLivePriceKeys(dashboardData?.providerSummaries);

  dashboardKeys.isins.forEach((isin) => keys.isins.add(isin));
  dashboardKeys.cryptos.forEach((crypto) => keys.cryptos.add(crypto));
}

function addPortfolioLivePriceKeys(
  keys: LivePriceKeySets,
  stage: DashboardStageKey,
  data: unknown
) {
  if ((stage !== "investment" && stage !== "crypto") || !isPortfolioData(data)) {
    return;
  }

  const targetKeys = stage === "investment" ? keys.isins : keys.cryptos;

  for (const provider of data.providers) {
    for (const product of provider.products) {
      if (product.isin && Math.abs(product.quantity) > 0.000001) {
        targetKeys.add(product.isin);
      }
    }
  }
}

async function warmLivePrices(keys: LivePriceKeySets) {
  if (keys.isins.size === 0 && keys.cryptos.size === 0) {
    return;
  }

  await fetchAndCacheLivePrices({
    cryptos: [...keys.cryptos],
    isins: [...keys.isins]
  }, { maxAgeMs: 0 });
}

function fetchImportedStageData(
  stage: DashboardStageKey,
  nextUser: UserRecord,
  binanceRefreshKey: number
) {
  const version = getDashboardStageDataVersion(stage, nextUser, binanceRefreshKey);

  return fetchDashboardStageData(stage, nextUser.id, {
    force: true,
    version
  }).catch(() => null);
}

export async function warmImportedProfileData(
  user: UserRecord,
  counts: ImportedTransactionCounts,
  { binanceRefreshKey = 0 }: WarmImportedProfileDataOptions = {}
) {
  const nextUser = applyImportedTransactionCountsToUser(user, counts);
  const stages = getImportedProfileWarmupStages(user, counts);

  if (stages.length === 0) {
    return nextUser;
  }

  const stageRequests = new Map(
    stages.map((stage) => [
      stage,
      fetchImportedStageData(stage, nextUser, binanceRefreshKey)
    ])
  );
  const dashboardRequest = stageRequests.get("dashboard") as Promise<DashboardData | null> | undefined;
  const dashboardData = dashboardRequest ? await dashboardRequest : null;
  const dashboardPriceKeys: LivePriceKeySets = {
    cryptos: new Set(),
    isins: new Set()
  };

  addDashboardLivePriceKeys(dashboardPriceKeys, dashboardData);
  const dashboardPriceWarmup = warmLivePrices(dashboardPriceKeys);

  const stageResults = await Promise.all(
    [...stageRequests.entries()].map(async ([stage, request]) => ({
      data: await request,
      stage
    }))
  );
  const portfolioPriceKeys: LivePriceKeySets = {
    cryptos: new Set(),
    isins: new Set()
  };

  for (const { data, stage } of stageResults) {
    addPortfolioLivePriceKeys(portfolioPriceKeys, stage, data);
  }

  await Promise.allSettled([
    dashboardPriceWarmup,
    warmLivePrices(portfolioPriceKeys),
    ...stageRequests.values()
  ]);

  return nextUser;
}
