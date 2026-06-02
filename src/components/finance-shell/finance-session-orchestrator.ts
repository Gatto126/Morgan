"use client";

import { getBinanceLivePriceKeys } from "@/components/dashboard/binance-live-values";
import type { BinanceBalanceRow, DashboardData, ProviderSummary } from "@/components/dashboard/types";
import type { PortfolioData } from "@/components/portfolio-dashboard/types";
import {
  fetchAndCacheLivePrices,
  getLivePriceDiagnostics,
  globalLivePricesCache,
  LIVE_PRICES_UPDATED_EVENT,
  type LivePricesUpdatedEventDetail,
  type LivePriceDiagnostics
} from "@/shared/live-prices";

import {
  fetchDashboardStageData,
  getDashboardStageCacheDateKey
} from "./dashboard-stage-data-cache";
import {
  ensureCurrentValuation,
  getCurrentValuationState,
  invalidateCurrentValuation,
  refreshCurrentValuationFromCaches,
  resetCurrentValuationsStore
} from "./current-valuations-store";
import {
  getDashboardStageDataVersion,
  getVisibleDashboardStageKeys,
  type DashboardStageKey
} from "./dashboard-stage-items";
import { ACTIVE_PROFILE_PERSISTENCE_KEY } from "./persistence-state";
import type { UserRecord } from "./types";
import { fetchDashboardPreviewData } from "./use-account-portfolio-preview-data";

declare global {
  interface Window {
    __MORGAN_FINANCE_DIAGNOSTICS__?: ReturnType<typeof getFinanceSessionDiagnostics>;
    morganFinanceDiagnostics?: () => ReturnType<typeof getFinanceSessionDiagnostics>;
  }
}

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
  dataFetchDurationMs: number | null;
  dataRequestedAt: number;
  dateKey: string;
  errorMessage: string | null;
  event: FinanceSessionEvent;
  livePriceDiagnostics: LivePriceDiagnostics | null;
  livePriceFetchDurationMs: number | null;
  livePriceFetchedAt: number | null;
  livePriceRequestedAt: number | null;
  livePriceStatus: "idle" | "loading" | "ready" | "error";
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

type EnsureFinanceCurrentValuationOptions = {
  binanceRefreshKey?: number;
  event?: FinanceSessionEvent;
  force?: boolean;
  livePriceMaxAgeMs?: number;
  priority?: FinanceSessionPriority;
  user: UserRecord;
};

type EnsureFinanceProfilesCurrentValuationsOptions = {
  activeUserId?: string | null;
  binanceRefreshKey?: number;
  event?: FinanceSessionEvent;
  force?: boolean;
  livePriceMaxAgeMs?: number;
  priority?: FinanceSessionPriority;
  users: UserRecord[];
};

type WarmFinanceSessionOptions = {
  maxWaitMs?: number;
};

const defaultWarmupMaxWaitMs = 1_500;
const backgroundLivePriceMaxAgeMs = 0;
const priorityRank = {
  background: 0,
  active: 1,
  user: 2
} satisfies Record<FinanceSessionPriority, number>;
const financeStageRequests = new Map<string, FinanceStageRequestEntry>();
let livePriceDiagnosticsListenerRegistered = false;
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

function refreshFinanceStageLivePriceDiagnostics(now = Date.now()) {
  let didUpdate = false;

  for (const entry of financeStageRequests.values()) {
    const requested = entry.livePriceDiagnostics?.requested;
    if (!requested || (requested.cryptos.length === 0 && requested.isins.length === 0)) {
      continue;
    }

    const diagnostics = getLivePriceDiagnostics(requested, now);
    entry.livePriceDiagnostics = diagnostics;
    entry.livePriceFetchedAt = diagnostics.lastFetchAt ?? entry.livePriceFetchedAt;
    entry.livePriceStatus = diagnostics.missingKeys.length > 0 ? "error" : "ready";
    didUpdate = true;
  }

  return didUpdate;
}

function registerLivePriceDiagnosticsListener() {
  if (
    livePriceDiagnosticsListenerRegistered
    || typeof window === "undefined"
  ) {
    return;
  }

  livePriceDiagnosticsListenerRegistered = true;
  window.addEventListener(LIVE_PRICES_UPDATED_EVENT, ((event: CustomEvent<LivePricesUpdatedEventDetail>) => {
    const eventTime = typeof event.detail?.updatedAt === "number"
      ? event.detail.updatedAt
      : Date.now();

    if (refreshFinanceStageLivePriceDiagnostics(eventTime)) {
      publishFinanceSessionDiagnostics();
    }
  }) as EventListener);
}

function publishFinanceSessionDiagnostics() {
  if (typeof window === "undefined") {
    return;
  }

  registerLivePriceDiagnosticsListener();

  const diagnostics = getFinanceSessionDiagnostics();
  const diagnosticsPayload = JSON.stringify({
    stages: diagnostics,
    updatedAt: Date.now()
  });
  window.morganFinanceDiagnostics = () => getFinanceSessionDiagnostics();
  window.__MORGAN_FINANCE_DIAGNOSTICS__ = diagnostics;

  try {
    window.sessionStorage.setItem("morgan:finance-session-diagnostics:v1", diagnosticsPayload);
  } catch {
    // Diagnostics are best-effort and must never affect app rendering.
  }

  try {
    const elementId = "morgan-finance-diagnostics";
    let diagnosticsElement = document.getElementById(elementId);

    if (!diagnosticsElement) {
      diagnosticsElement = document.createElement("script");
      diagnosticsElement.id = elementId;
      diagnosticsElement.setAttribute("type", "application/json");
      diagnosticsElement.setAttribute("data-diagnostics", "finance-session");
      diagnosticsElement.hidden = true;
      document.head.appendChild(diagnosticsElement);
    }

    diagnosticsElement.textContent = diagnosticsPayload;
  } catch {
    // The browser console/window hook is enough when DOM publishing is unavailable.
  }

  window.dispatchEvent(new CustomEvent("morgan:finance-diagnostics", {
    detail: diagnostics
  }));
}

function getValuationDiagnostics(profileId: string) {
  const state = getCurrentValuationState(profileId);
  const snapshot = state.committedSnapshot;
  const draftSnapshot = state.draftSnapshot;
  const visibleSnapshot = snapshot ?? draftSnapshot;

  return visibleSnapshot
    ? {
        committedStatus: snapshot?.status ?? null,
        committedUpdatedAt: snapshot?.updatedAt ?? null,
        committedVersion: snapshot?.version ?? null,
        draftStatus: draftSnapshot?.status ?? null,
        draftUpdatedAt: draftSnapshot?.updatedAt ?? null,
        draftVersion: draftSnapshot?.version ?? null,
        isRefreshing: state.isRefreshing,
        lastError: state.lastError,
        lastFetchAt: visibleSnapshot.diagnostics.lastFetchAt,
        maxQuoteAgeMs: visibleSnapshot.diagnostics.maxQuoteAgeMs,
        missingKeys: visibleSnapshot.diagnostics.missingKeys,
        pendingVersion: state.pendingVersion,
        status: snapshot?.status ?? draftSnapshot?.status ?? null,
        unavailableKeys: visibleSnapshot.diagnostics.unavailableKeys,
        updatedAt: visibleSnapshot.updatedAt,
        version: visibleSnapshot.version
      }
    : null;
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
  const emptyDiagnostics = getLivePriceDiagnostics(keys);

  if (keys.isins.length === 0 && keys.cryptos.length === 0) {
    return {
      diagnostics: emptyDiagnostics,
      prices: globalLivePricesCache
    };
  }

  const prices = await fetchAndCacheLivePrices(keys, { maxAgeMs });

  return {
    diagnostics: getLivePriceDiagnostics(keys),
    prices
  };
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
    publishFinanceSessionDiagnostics();
    return existingEntry.promise;
  }

  const dataRequestedAt = Date.now();
  const entry: FinanceStageRequestEntry = {
    dataFetchedAt: null,
    dataFetchDurationMs: null,
    dataRequestedAt,
    dateKey,
    errorMessage: null,
    event,
    livePriceDiagnostics: null,
    livePriceFetchDurationMs: null,
    livePriceFetchedAt: null,
    livePriceRequestedAt: null,
    livePriceStatus: "idle",
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
      entry.dataFetchDurationMs = entry.dataFetchedAt - dataRequestedAt;
      entry.status = "ready";
      publishFinanceSessionDiagnostics();
      return data as unknown;
    })
    .catch((error: unknown) => {
      entry.status = "error";
      entry.errorMessage = error instanceof Error ? error.message : "Could not load stage data.";
      entry.dataFetchDurationMs = Date.now() - dataRequestedAt;
      publishFinanceSessionDiagnostics();
      return null;
    });

  entry.promise = promise;
  financeStageRequests.set(requestKey, entry);
  publishFinanceSessionDiagnostics();

  return promise;
}

export async function ensureFinanceStageReady(options: EnsureFinanceStageReadyOptions) {
  const data = await ensureFinanceStageData(options);
  const requestKey = getFinanceStageRequestKey({
    binanceRefreshKey: options.binanceRefreshKey,
    stage: options.stage,
    user: options.user
  });
  const entry = financeStageRequests.get(requestKey);
  const livePriceRequestedAt = Date.now();
  if (entry) {
    entry.livePriceRequestedAt = livePriceRequestedAt;
    entry.livePriceStatus = "loading";
    publishFinanceSessionDiagnostics();
  }

  const warmup = await warmLivePricesForStageData(options.stage, data, {
    maxAgeMs: options.livePriceMaxAgeMs ?? 0
  }).catch(() => ({
    diagnostics: getLivePriceDiagnostics(collectStageLivePriceKeys(options.stage, data)),
    prices: globalLivePricesCache
  }));

  if (entry) {
    entry.livePriceFetchedAt = Date.now();
    entry.livePriceFetchDurationMs = entry.livePriceFetchedAt - livePriceRequestedAt;
    entry.livePriceDiagnostics = warmup.diagnostics;
    entry.livePriceStatus = warmup.diagnostics.missingKeys.length > 0 ? "error" : "ready";
    publishFinanceSessionDiagnostics();
  }

  const snapshot = refreshCurrentValuationFromCaches(options.user, {
    binanceRefreshKey: options.binanceRefreshKey ?? 0
  });
  if (snapshot) {
    publishFinanceSessionDiagnostics();
  }

  return {
    currentValuation: snapshot,
    data,
    stage: options.stage,
    userId: options.user.id
  };
}

export async function ensureFinanceCurrentValuation({
  binanceRefreshKey = 0,
  event = "dashboard-change",
  force = false,
  livePriceMaxAgeMs = 0,
  priority = "active",
  user
}: EnsureFinanceCurrentValuationOptions) {
  const snapshot = await ensureCurrentValuation(user, {
    binanceRefreshKey,
    force,
    livePriceMaxAgeMs
  });

  publishFinanceSessionDiagnostics();

  return {
    event,
    priority,
    snapshot,
    userId: user.id
  };
}

function getPrioritizedCurrentValuationProfiles(
  users: UserRecord[],
  activeUserId: string | null | undefined
) {
  const uniqueUsers = users.filter((user, index, profiles) => (
    profiles.findIndex((profile) => profile.id === user.id) === index
  ));

  if (!activeUserId) {
    return uniqueUsers;
  }

  const activeUser = uniqueUsers.find((user) => user.id === activeUserId);
  if (!activeUser) {
    return uniqueUsers;
  }

  return [
    activeUser,
    ...uniqueUsers.filter((user) => user.id !== activeUserId)
  ];
}

export async function ensureFinanceProfilesCurrentValuations({
  activeUserId = null,
  binanceRefreshKey = 0,
  event = "profile-change",
  force = false,
  livePriceMaxAgeMs = 0,
  priority = "background",
  users
}: EnsureFinanceProfilesCurrentValuationsOptions) {
  const valuationProfiles = getPrioritizedCurrentValuationProfiles(users, activeUserId);
  const results = await Promise.allSettled(valuationProfiles.map((user) => (
    ensureFinanceCurrentValuation({
      binanceRefreshKey,
      event,
      force,
      livePriceMaxAgeMs,
      priority: user.id === activeUserId ? getHigherPriority(priority, "active") : "background",
      user
    })
  )));

  publishFinanceSessionDiagnostics();

  return {
    activeUserId,
    results,
    userIds: valuationProfiles.map((user) => user.id)
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

  await ensureFinanceCurrentValuation({
    binanceRefreshKey,
    event,
    force,
    livePriceMaxAgeMs: activeStage === "dashboard" ? 0 : backgroundLivePriceMaxAgeMs,
    priority: getHigherPriority(priority, "active"),
    user
  });
}

async function runFinanceSessionWarmup() {
  const persistedProfileId = getPersistedProfileId();
  const users = await fetchProfilesForWarmup();
  const primaryProfile = selectPrimaryLoginWarmupProfile(users, persistedProfileId);
  const warmupProfiles = selectLoginWarmupProfiles(users, persistedProfileId);

  if (!primaryProfile) {
    await Promise.allSettled([
      ensureFinanceProfilesCurrentValuations({
        activeUserId: null,
        event: "login",
        priority: "background",
        users: warmupProfiles
      }),
      ...warmupProfiles.map((user) => warmFinanceProfilePreview(user))
    ]);
    return;
  }

  await ensureFinanceStageReady({
    event: "login",
    priority: "user",
    stage: "dashboard",
    user: primaryProfile
  });
  await ensureFinanceCurrentValuation({
    event: "login",
    priority: "user",
    user: primaryProfile
  });

  await Promise.allSettled([
    preloadFinanceProfileStages({
      activeStage: "dashboard",
      event: "login",
      priority: "background",
      user: primaryProfile
    }),
    ensureFinanceProfilesCurrentValuations({
      activeUserId: primaryProfile.id,
      event: "login",
      priority: "background",
      users: warmupProfiles
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
  invalidateCurrentValuation(userId);
  publishFinanceSessionDiagnostics();
}

export function resetFinanceSessionOrchestrator() {
  financeStageRequests.clear();
  resetCurrentValuationsStore();
  publishFinanceSessionDiagnostics();
}

export function getFinanceSessionDiagnostics() {
  return [...financeStageRequests.entries()].map(([key, entry]) => {
    const livePriceDiagnostics = entry.livePriceDiagnostics
      ? getLivePriceDiagnostics(entry.livePriceDiagnostics.requested)
      : null;
    const valuationDiagnostics = getValuationDiagnostics(entry.userId);

    return {
      dataFetchedAt: entry.dataFetchedAt,
      dataFetchDurationMs: entry.dataFetchDurationMs,
      dataRequestedAt: entry.dataRequestedAt,
      dateKey: entry.dateKey,
      errorMessage: entry.errorMessage,
      event: entry.event,
      key,
      lastFetchAt: livePriceDiagnostics?.lastFetchAt ?? null,
      livePriceDiagnostics,
      livePriceFetchDurationMs: entry.livePriceFetchDurationMs,
      livePriceFetchedAt: entry.livePriceFetchedAt,
      livePriceRequestedAt: entry.livePriceRequestedAt,
      livePriceStatus: entry.livePriceStatus,
      maxQuoteAgeMs: livePriceDiagnostics?.maxQuoteAgeMs ?? null,
      missingKeys: livePriceDiagnostics?.missingKeys ?? [],
      oldestFetchAt: livePriceDiagnostics?.oldestFetchAt ?? null,
      priority: entry.priority,
      quoteCount: livePriceDiagnostics?.quotes.length ?? 0,
      requestedLiveKeys: livePriceDiagnostics?.requestedKeys ?? [],
      stage: entry.stage,
      status: entry.status,
      unavailableKeys: livePriceDiagnostics?.unavailableKeys ?? [],
      userId: entry.userId,
      valuationDiagnostics,
      valuationMissingKeys: valuationDiagnostics?.missingKeys ?? [],
      valuationStatus: valuationDiagnostics?.status ?? null,
      valuationUnavailableKeys: valuationDiagnostics?.unavailableKeys ?? [],
      valuationUpdatedAt: valuationDiagnostics?.updatedAt ?? null,
      version: entry.version
    };
  });
}
