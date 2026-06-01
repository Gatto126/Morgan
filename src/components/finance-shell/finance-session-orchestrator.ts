"use client";

import { getBinanceLivePriceKeys } from "@/components/dashboard/binance-live-values";
import type { BinanceBalanceRow, DashboardData, ProviderSummary } from "@/components/dashboard/types";
import type { PortfolioData } from "@/components/portfolio-dashboard/types";
import { fetchAndCacheLivePrices, globalLivePricesCache } from "@/shared/live-prices";

import {
  fetchDashboardStageData,
  getDashboardStageCacheDateKey
} from "./dashboard-stage-data-cache";
import {
  getDashboardStageDataVersion,
  getVisibleDashboardStageKeys,
  type DashboardStageKey
} from "./dashboard-stage-items";
import { ACTIVE_PROFILE_PERSISTENCE_KEY } from "./persistence-state";
import type { UserRecord } from "./types";
import { fetchDashboardPreviewData } from "./use-account-portfolio-preview-data";

export type FinanceSessionEvent =
  | "app-boot"
  | "binance-connect"
  | "binance-delete"
  | "binance-sync"
  | "dashboard-change"
  | "daily-rollover"
  | "import"
  | "login"
  | "logout"
  | "network-reconnect"
  | "profile-change"
  | "profile-delete"
  | "tab-focus";

export type FinanceSessionPriority = "background" | "active" | "user";

export type DashboardLivePriceKeys = {
  cryptos: string[];
  isins: string[];
};

type MutableLivePriceKeySets = {
  cryptos: Set<string>;
  isins: Set<string>;
};

type EnsureFinanceStageReadyOptions = {
  binanceRefreshKey?: number;
  event?: FinanceSessionEvent;
  force?: boolean;
  livePriceMaxAgeMs?: number;
  priority?: FinanceSessionPriority;
  stage: DashboardStageKey;
  user: UserRecord;
};

type FinanceStageRequestEntry = {
  dataFetchedAt: number | null;
  dateKey: string;
  event: FinanceSessionEvent;
  livePriceFetchedAt: number | null;
  priority: FinanceSessionPriority;
  promise: Promise<unknown | null>;
  stage: DashboardStageKey;
  status: "idle" | "loading" | "ready" | "refreshing" | "error";
  userId: string;
  version: number;
};

type PreloadFinanceProfileStagesOptions = {
  activeStage?: DashboardStageKey;
  binanceRefreshKey?: number;
  event?: FinanceSessionEvent;
  force?: boolean;
  priority?: FinanceSessionPriority;
  user: UserRecord;
};

type WarmFinanceSessionOptions = {
  maxWaitMs?: number;
};

const defaultWarmupMaxWaitMs = 1_500;
const backgroundLivePriceMaxAgeMs = 60_000;
const priorityRank = {
  background: 0,
  active: 1,
  user: 2
} satisfies Record<FinanceSessionPriority, number>;
const financeStageRequests = new Map<string, FinanceStageRequestEntry>();
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

function addPriceKey(keys: Set<string>, value: string | null | undefined) {
  if (value) {
    keys.add(value);
  }
}

function getHigherPriority(
  currentPriority: FinanceSessionPriority,
  nextPriority: FinanceSessionPriority
) {
  return priorityRank[nextPriority] > priorityRank[currentPriority]
    ? nextPriority
    : currentPriority;
}

function toLivePriceKeys(keys: MutableLivePriceKeySets): DashboardLivePriceKeys {
  return {
    cryptos: [...keys.cryptos].sort(),
    isins: [...keys.isins].sort()
  };
}

function createLivePriceKeySets(): MutableLivePriceKeySets {
  return {
    cryptos: new Set(),
    isins: new Set()
  };
}

function isPortfolioData(data: unknown): data is PortfolioData {
  return !!data
    && typeof data === "object"
    && Array.isArray((data as Partial<PortfolioData>).providers);
}

function isBinanceData(data: unknown): data is { balances?: BinanceBalanceRow[] } {
  return !!data
    && typeof data === "object"
    && Array.isArray((data as { balances?: unknown }).balances);
}

function addPortfolioLivePriceKeys(
  keys: MutableLivePriceKeySets,
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

function addBinanceLivePriceKeys(keys: MutableLivePriceKeySets, data: unknown) {
  if (!isBinanceData(data)) {
    return;
  }

  getBinanceLivePriceKeys(data.balances).forEach((key) => keys.cryptos.add(key));
}

async function fetchProfilesForWarmup() {
  const response = await fetch("/api/users", loginWarmupFetchOptions);
  if (!response.ok) {
    return [];
  }

  const payload = await response.json().catch(() => ({})) as { users?: UserRecord[] };
  return Array.isArray(payload.users) ? payload.users : [];
}

export function collectDashboardLivePriceKeys(
  providerSummaries: ProviderSummary[] | undefined
): DashboardLivePriceKeys {
  const keys = createLivePriceKeySets();

  for (const provider of providerSummaries ?? []) {
    for (const product of provider.investmentProducts) {
      if (Math.abs(product.quantity) > 0.000001) {
        addPriceKey(keys.isins, product.isin);
      }
    }

    for (const token of provider.cryptoTokens) {
      if (Math.abs(token.quantity) > 0.000001) {
        addPriceKey(keys.cryptos, token.tokenSymbol);
      }
    }
  }

  return toLivePriceKeys(keys);
}

export function collectStageLivePriceKeys(
  stage: DashboardStageKey,
  data: unknown
): DashboardLivePriceKeys {
  const keys = createLivePriceKeySets();

  if (stage === "dashboard") {
    const dashboardKeys = collectDashboardLivePriceKeys(
      (data as Partial<DashboardData> | null | undefined)?.providerSummaries
    );
    dashboardKeys.isins.forEach((isin) => keys.isins.add(isin));
    dashboardKeys.cryptos.forEach((crypto) => keys.cryptos.add(crypto));
  }

  addPortfolioLivePriceKeys(keys, stage, data);
  addBinanceLivePriceKeys(keys, data);

  return toLivePriceKeys(keys);
}

export function getFinanceStageRequestKey({
  binanceRefreshKey = 0,
  dateKey,
  stage,
  user
}: {
  binanceRefreshKey?: number;
  dateKey?: string;
  stage: DashboardStageKey;
  user: UserRecord;
}) {
  const version = getDashboardStageDataVersion(stage, user, binanceRefreshKey);
  const resolvedDateKey = dateKey ?? getDashboardStageCacheDateKey(stage);

  return `${user.id}:${stage}:${version}:${resolvedDateKey}`;
}

export function getPrioritizedProfileStageWarmupOrder(
  user: UserRecord,
  activeStage: DashboardStageKey = "dashboard"
) {
  const visibleStages = getVisibleDashboardStageKeys(user);
  const resolvedActiveStage = visibleStages.includes(activeStage) ? activeStage : "dashboard";

  return [
    resolvedActiveStage,
    ...visibleStages.filter((stageKey) => stageKey !== resolvedActiveStage)
  ].filter((stageKey, index, stages) => stages.indexOf(stageKey) === index);
}

export function getActiveProfileStageWarmupOrder(user: UserRecord) {
  const visibleStages = new Set(getVisibleDashboardStageKeys(user));
  const stageOrder: DashboardStageKey[] = ["checking", "investment", "crypto", "binance"];

  return stageOrder.filter((stage) => visibleStages.has(stage));
}

export function selectPrimaryLoginWarmupProfile(
  users: UserRecord[],
  persistedProfileId: string | null
) {
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

export async function warmLivePricesForStageData(
  stage: DashboardStageKey,
  data: unknown,
  { maxAgeMs = 0 }: { maxAgeMs?: number } = {}
) {
  const keys = collectStageLivePriceKeys(stage, data);

  if (keys.isins.length === 0 && keys.cryptos.length === 0) {
    return globalLivePricesCache;
  }

  return fetchAndCacheLivePrices(keys, { maxAgeMs });
}

export function ensureFinanceStageData({
  binanceRefreshKey = 0,
  event = "dashboard-change",
  force = false,
  priority = "background",
  stage,
  user
}: EnsureFinanceStageReadyOptions) {
  const version = getDashboardStageDataVersion(stage, user, binanceRefreshKey);
  const dateKey = getDashboardStageCacheDateKey(stage);
  const requestKey = getFinanceStageRequestKey({ binanceRefreshKey, dateKey, stage, user });
  const existingEntry = financeStageRequests.get(requestKey);

  if (existingEntry && !force && existingEntry.status !== "error") {
    existingEntry.priority = getHigherPriority(existingEntry.priority, priority);
    existingEntry.event = event;
    return existingEntry.promise;
  }

  const entry: FinanceStageRequestEntry = {
    dataFetchedAt: null,
    dateKey,
    event,
    livePriceFetchedAt: null,
    priority,
    promise: Promise.resolve(null),
    stage,
    status: force ? "refreshing" : "loading",
    userId: user.id,
    version
  };
  const promise = fetchDashboardStageData(stage, user.id, {
    force,
    version
  })
    .then((data) => {
      entry.dataFetchedAt = Date.now();
      entry.status = "ready";
      return data as unknown;
    })
    .catch(() => {
      entry.status = "error";
      return null;
    });

  entry.promise = promise;
  financeStageRequests.set(requestKey, entry);

  return promise;
}

export async function ensureFinanceStageReady(options: EnsureFinanceStageReadyOptions) {
  const data = await ensureFinanceStageData(options);
  await warmLivePricesForStageData(options.stage, data, {
    maxAgeMs: options.livePriceMaxAgeMs ?? 0
  }).catch(() => globalLivePricesCache);

  const requestKey = getFinanceStageRequestKey({
    binanceRefreshKey: options.binanceRefreshKey,
    stage: options.stage,
    user: options.user
  });
  const entry = financeStageRequests.get(requestKey);
  if (entry) {
    entry.livePriceFetchedAt = Date.now();
  }

  return {
    data,
    stage: options.stage,
    userId: options.user.id
  };
}

export async function warmFinanceProfilePreview(user: UserRecord) {
  const dashboardPromise = user.transactionCount > 0
    ? fetchDashboardPreviewData(user).catch(() => null)
    : Promise.resolve(null);
  const binancePromise = user.hasBinanceCredentials
    ? ensureFinanceStageData({
        event: "login",
        priority: "background",
        stage: "binance",
        user
      }).catch(() => null)
    : Promise.resolve(null);
  const [dashboardData, binancePayload] = await Promise.all([dashboardPromise, binancePromise]);
  const binanceBalances = Array.isArray((binancePayload as { balances?: unknown } | null)?.balances)
    ? (binancePayload as { balances: BinanceBalanceRow[] }).balances
    : [];

  await Promise.allSettled([
    warmLivePricesForStageData("dashboard", dashboardData, { maxAgeMs: 0 }),
    warmLivePricesForStageData("binance", { balances: binanceBalances }, { maxAgeMs: 0 })
  ]);

  return dashboardData as DashboardData | null;
}

export async function preloadFinanceProfileStages({
  activeStage = "dashboard",
  binanceRefreshKey = 0,
  event = "profile-change",
  force = false,
  priority = "background",
  user
}: PreloadFinanceProfileStagesOptions) {
  const stageOrder = getPrioritizedProfileStageWarmupOrder(user, activeStage);

  for (const stage of stageOrder) {
    await ensureFinanceStageReady({
      binanceRefreshKey,
      event,
      force,
      livePriceMaxAgeMs: stage === activeStage ? 0 : backgroundLivePriceMaxAgeMs,
      priority: stage === activeStage ? getHigherPriority(priority, "active") : priority,
      stage,
      user
    });
  }
}

async function runFinanceSessionWarmup() {
  const persistedProfileId = getPersistedProfileId();
  const users = await fetchProfilesForWarmup();
  const primaryProfile = selectPrimaryLoginWarmupProfile(users, persistedProfileId);
  const warmupProfiles = selectLoginWarmupProfiles(users, persistedProfileId);

  if (!primaryProfile) {
    await Promise.allSettled(warmupProfiles.map((user) => warmFinanceProfilePreview(user)));
    return;
  }

  await ensureFinanceStageReady({
    event: "login",
    priority: "user",
    stage: "dashboard",
    user: primaryProfile
  });

  await Promise.allSettled([
    preloadFinanceProfileStages({
      activeStage: "dashboard",
      event: "login",
      priority: "background",
      user: primaryProfile
    }),
    ...warmupProfiles
      .filter((user) => user.id !== primaryProfile.id)
      .map((user) => warmFinanceProfilePreview(user))
  ]);
}

export async function warmFinanceSessionAfterLogin({
  maxWaitMs = defaultWarmupMaxWaitMs
}: WarmFinanceSessionOptions = {}) {
  const warmup = runFinanceSessionWarmup().catch(() => undefined);

  await withTimeout(warmup, maxWaitMs);
}

export function invalidateFinanceProfile(userId: string) {
  for (const [key, entry] of financeStageRequests.entries()) {
    if (entry.userId === userId) {
      financeStageRequests.delete(key);
    }
  }
}

export function resetFinanceSessionOrchestrator() {
  financeStageRequests.clear();
}

export function getFinanceSessionDiagnostics() {
  return [...financeStageRequests.entries()].map(([key, entry]) => ({
    dataFetchedAt: entry.dataFetchedAt,
    dateKey: entry.dateKey,
    event: entry.event,
    key,
    livePriceFetchedAt: entry.livePriceFetchedAt,
    priority: entry.priority,
    stage: entry.stage,
    status: entry.status,
    userId: entry.userId,
    version: entry.version
  }));
}
