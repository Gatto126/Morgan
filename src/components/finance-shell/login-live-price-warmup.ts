"use client";

import type { DashboardData, ProviderSummary } from "@/components/dashboard/types";
import { fetchAndCacheLivePrices, globalLivePricesCache } from "@/shared/live-prices";

import { fetchDashboardStageData } from "./dashboard-stage-data-cache";
import {
  getDashboardStageDataVersion,
  getVisibleDashboardStageKeys,
  type DashboardStageKey
} from "./dashboard-stage-items";
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
  const primaryUser = selectPrimaryLoginWarmupProfile(users, persistedProfileId);

  if (!primaryUser) {
    return users;
  }

  return [
    primaryUser,
    ...users.filter((user) => user.id !== primaryUser.id)
  ];
}

export function selectPrimaryLoginWarmupProfile(users: UserRecord[], persistedProfileId: string | null) {
  if (users.length === 0) {
    return null;
  }

  const persistedUser = persistedProfileId
    ? users.find((user) => user.id === persistedProfileId)
    : null;

  if (persistedUser) {
    return persistedUser;
  }

  if (users.length === 1) {
    return users[0];
  }

  return null;
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

async function warmLivePricesForDashboardData(dashboardData: DashboardData | null) {
  const keys = collectDashboardLivePriceKeys(dashboardData?.providerSummaries);
  const priceWarmup = keys.isins.length > 0 || keys.cryptos.length > 0
    ? fetchAndCacheLivePrices(keys, { maxAgeMs: 0 })
    : Promise.resolve(globalLivePricesCache);

  await priceWarmup;
}

async function warmProfilePreview(user: UserRecord) {
  const dashboardPromise = user.transactionCount > 0
    ? fetchDashboardStageData("dashboard", user.id, { version: user.transactionCount }).catch(() => null)
    : Promise.resolve(null);
  const binanceWarmup = user.hasBinanceCredentials
    ? fetchDashboardStageData("binance", user.id).catch(() => null)
    : Promise.resolve(null);
  const dashboardData = await dashboardPromise;

  await Promise.allSettled([
    warmLivePricesForDashboardData(dashboardData as DashboardData | null),
    binanceWarmup
  ]);

  return dashboardData as DashboardData | null;
}

function getActiveProfileStageWarmupOrder(user: UserRecord) {
  const visibleStages = new Set(getVisibleDashboardStageKeys(user));
  const stageOrder: DashboardStageKey[] = ["checking", "investment", "crypto", "binance"];

  return stageOrder.filter((stage) => visibleStages.has(stage));
}

async function warmActiveProfileStages(user: UserRecord) {
  for (const stage of getActiveProfileStageWarmupOrder(user)) {
    const version = getDashboardStageDataVersion(stage, user);
    await fetchDashboardStageData(stage, user.id, { version }).catch(() => null);
  }
}

async function runFinanceSessionWarmup() {
  const persistedProfileId = getPersistedProfileId();
  const users = await fetchProfilesForWarmup();
  const primaryProfile = selectPrimaryLoginWarmupProfile(users, persistedProfileId);
  const warmupProfiles = selectLoginWarmupProfiles(users, persistedProfileId);

  if (!primaryProfile) {
    await Promise.allSettled(warmupProfiles.map((user) => warmProfilePreview(user)));
    return;
  }

  await warmProfilePreview(primaryProfile);
  await Promise.allSettled([
    warmActiveProfileStages(primaryProfile),
    ...warmupProfiles
      .filter((user) => user.id !== primaryProfile.id)
      .map((user) => warmProfilePreview(user))
  ]);
}

export async function warmFinanceSessionAfterLogin({
  maxWaitMs = defaultWarmupMaxWaitMs
}: WarmFinanceSessionOptions = {}) {
  const warmup = runFinanceSessionWarmup().catch(() => undefined);

  await withTimeout(warmup, maxWaitMs);
}
