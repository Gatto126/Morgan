"use client";

import type { DashboardData, ProviderSummary } from "@/components/dashboard/types";
import { fetchAndCacheLivePrices, globalLivePricesCache } from "@/shared/live-prices";

import { fetchDashboardStageData } from "./dashboard-stage-data-cache";
import { ACTIVE_PROFILE_PERSISTENCE_KEY } from "./persistence-state";
import type { UserRecord } from "./types";

type WarmFinanceSessionOptions = {
  maxWaitMs?: number;
};

type DashboardLivePriceKeys = {
  cryptos: string[];
  isins: string[];
};

const defaultWarmupMaxWaitMs = 1_500;
const loginWarmupFetchOptions: RequestInit = {
  cache: "no-store",
  headers: {
    "Cache-Control": "no-cache",
    Pragma: "no-cache"
  }
};

function getPersistedProfileId() {
  try {
    return window.localStorage.getItem(ACTIVE_PROFILE_PERSISTENCE_KEY);
  } catch {
    return null;
  }
}

function withTimeout(promise: Promise<void>, maxWaitMs: number) {
  if (maxWaitMs <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, maxWaitMs);

    promise.finally(() => {
      window.clearTimeout(timer);
      resolve();
    });
  });
}

async function fetchProfilesForWarmup() {
  const response = await fetch("/api/users", loginWarmupFetchOptions);
  if (!response.ok) {
    return [];
  }

  const payload = await response.json().catch(() => ({})) as { users?: UserRecord[] };
  return Array.isArray(payload.users) ? payload.users : [];
}

export function selectLoginWarmupProfiles(users: UserRecord[], persistedProfileId: string | null) {
  if (users.length === 0) {
    return [];
  }

  const persistedUser = persistedProfileId
    ? users.find((user) => user.id === persistedProfileId)
    : null;

  if (persistedUser) {
    return [persistedUser];
  }

  if (users.length === 1) {
    return [users[0]];
  }

  return [];
}

function addPriceKey(keys: Set<string>, value: string | null | undefined) {
  if (value) {
    keys.add(value);
  }
}

export function collectDashboardLivePriceKeys(providerSummaries: ProviderSummary[] | undefined): DashboardLivePriceKeys {
  const isins = new Set<string>();
  const cryptos = new Set<string>();

  for (const provider of providerSummaries ?? []) {
    for (const product of provider.investmentProducts) {
      if (Math.abs(product.quantity) > 0.000001) {
        addPriceKey(isins, product.isin);
      }
    }

    for (const token of provider.cryptoTokens) {
      if (Math.abs(token.quantity) > 0.000001) {
        addPriceKey(cryptos, token.tokenSymbol);
      }
    }
  }

  return {
    cryptos: [...cryptos].sort(),
    isins: [...isins].sort()
  };
}

async function warmProfileDashboard(user: UserRecord) {
  const dashboardData = user.transactionCount > 0
    ? await fetchDashboardStageData("dashboard", user.id, { version: user.transactionCount }).catch(() => null)
    : null;
  const keys = collectDashboardLivePriceKeys((dashboardData as DashboardData | null)?.providerSummaries);
  const priceWarmup = keys.isins.length > 0 || keys.cryptos.length > 0
    ? fetchAndCacheLivePrices(keys, { maxAgeMs: 0 })
    : Promise.resolve(globalLivePricesCache);
  const binanceWarmup = user.hasBinanceCredentials
    ? fetchDashboardStageData("binance", user.id).catch(() => null)
    : Promise.resolve(null);

  await Promise.allSettled([priceWarmup, binanceWarmup]);
}

async function runFinanceSessionWarmup() {
  const persistedProfileId = getPersistedProfileId();
  const users = await fetchProfilesForWarmup();
  const warmupProfiles = selectLoginWarmupProfiles(users, persistedProfileId);

  await Promise.allSettled(warmupProfiles.map((user) => warmProfileDashboard(user)));
}

export async function warmFinanceSessionAfterLogin({
  maxWaitMs = defaultWarmupMaxWaitMs
}: WarmFinanceSessionOptions = {}) {
  const warmup = runFinanceSessionWarmup().catch(() => undefined);

  await withTimeout(warmup, maxWaitMs);
}
