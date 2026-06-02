"use client";

import { useMemo, useSyncExternalStore } from "react";

import {
  getBinanceBalanceLivePriceKey,
  getBinanceBalanceQuantity,
  getBinanceLivePriceKeys
} from "@/components/dashboard/binance-live-values";
import type { DashboardChartPoint } from "@/components/dashboard/dashboard-chart-types";
import type {
  BinanceBalanceRow,
  DashboardData,
  ProviderSummary
} from "@/components/dashboard/types";
import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";
import { getUtcDateKey } from "@/shared/date-keys";
import {
  fetchAndCacheLivePrices,
  getLivePriceDiagnostics,
  globalLivePricesCache,
  globalLiveQuotesCache,
  type LiveQuote
} from "@/shared/live-prices";
import type { ChartPoint } from "@/types/chart";

import {
  fetchDashboardStageData,
  readDashboardStageDataCache
} from "./dashboard-stage-data-cache";
import type { DashboardStageKey } from "./dashboard-stage-items";
import type { UserRecord } from "./types";

const OPEN_HOLDING_THRESHOLD = 0.000001;
const BINANCE_PROVIDER_ID = "BINANCE";

export type CurrentValuationStatus = "loading" | "ready" | "partial" | "error";

export type ValuationValueStatus =
  | "ready"
  | "loading"
  | "missing-live-quote"
  | "unavailable"
  | "error";

export type ValuationValueSource =
  | "checking-balance"
  | "live-quote"
  | "binance-sync"
  | "derived";

export type ValuationValue = {
  cents: number | null;
  fetchedAt: number | null;
  source: ValuationValueSource;
  status: ValuationValueStatus;
};

export type CurrentValuationVersion = {
  binanceRefreshKey: number;
  checkingCount: number;
  cryptoCount: number;
  dateKey: string;
  investmentCount: number;
  transactionCount: number;
};

export type ProviderValuation = {
  hasBinance: boolean;
  hasChecking: boolean;
  hasCrypto: boolean;
  hasInvestment: boolean;
  id: string;
  label: string;
  totals: {
    binance: ValuationValue;
    checking: ValuationValue;
    crypto: ValuationValue;
    investment: ValuationValue;
    total: ValuationValue;
  };
  transactionCount: number | null;
};

export type AssetValuation = {
  category: "investment" | "crypto" | "binance";
  chartKey: string;
  id: string;
  label: string;
  priceKey: string | null;
  providerIds: string[];
  providerValues: Record<string, ValuationValue>;
  quantity: number;
  value: ValuationValue;
};

export type CurrentValuationSnapshot = {
  assets: Record<string, AssetValuation>;
  diagnostics: {
    lastFetchAt: number | null;
    maxQuoteAgeMs: number | null;
    missingKeys: string[];
    unavailableKeys: string[];
  };
  profileId: string;
  providers: Record<string, ProviderValuation>;
  quoteKeys: {
    cryptos: string[];
    isins: string[];
  };
  status: CurrentValuationStatus;
  totals: {
    binance: ValuationValue;
    checking: ValuationValue;
    crypto: ValuationValue;
    heritage: ValuationValue;
    investment: ValuationValue;
  };
  updatedAt: number;
  version: CurrentValuationVersion;
};

type BinanceStagePayload = {
  balances?: BinanceBalanceRow[];
  hasApiKey?: boolean;
  isStale?: boolean;
  syncedAt?: string | null;
};

export type BuildCurrentValuationSnapshotOptions = {
  binancePayload?: BinanceStagePayload | null;
  binanceRefreshKey?: number;
  dashboardData: DashboardData | null;
  dateKey?: string;
  livePrices?: Record<string, number | null>;
  liveQuotes?: Record<string, LiveQuote>;
  now?: number;
  profile: UserRecord;
};

export type EnsureCurrentValuationOptions = {
  binanceRefreshKey?: number;
  dateKey?: string;
  force?: boolean;
  livePriceMaxAgeMs?: number;
};

export type CurrentValuationListener = (snapshot: CurrentValuationSnapshot | null) => void;

export type CurrentValuationTopbarItem = {
  id: string;
  label?: string;
  value: ValuationValue;
};

export type CurrentValuationCardItem = {
  category: AssetValuation["category"] | "checking" | "heritage";
  id: string;
  label: string;
  value: ValuationValue;
};

export type CurrentValuationSnapshotsByProfile = Record<string, CurrentValuationSnapshot | null | undefined>;

export type CurrentValuationHeritageAggregate = {
  diagnostics: {
    missingKeys: string[];
    pendingProfileIds: string[];
    unavailableKeys: string[];
  };
  point: DashboardChartPoint | null;
  status: CurrentValuationStatus;
  value: ValuationValue;
};

type MutableQuoteKeys = {
  cryptos: Set<string>;
  isins: Set<string>;
};

type CurrentValuationEntry = {
  promise?: Promise<CurrentValuationSnapshot>;
  snapshot: CurrentValuationSnapshot | null;
};

const currentValuationEntries = new Map<string, CurrentValuationEntry>();
const currentValuationListeners = new Map<string, Set<CurrentValuationListener>>();
const emptySnapshotMap: CurrentValuationSnapshotsByProfile = {};
const currentValuationSnapshotMapCache = new Map<string, {
  snapshots: Array<CurrentValuationSnapshot | null>;
  value: CurrentValuationSnapshotsByProfile;
}>();

function createQuoteKeySets(): MutableQuoteKeys {
  return {
    cryptos: new Set<string>(),
    isins: new Set<string>()
  };
}

function toSortedQuoteKeys(keys: MutableQuoteKeys): CurrentValuationSnapshot["quoteKeys"] {
  return {
    cryptos: [...keys.cryptos].sort(),
    isins: [...keys.isins].sort()
  };
}

function createVersion(
  profile: UserRecord,
  binanceRefreshKey: number,
  dateKey: string
): CurrentValuationVersion {
  return {
    binanceRefreshKey,
    checkingCount: profile.checkingCount,
    cryptoCount: profile.cryptoCount,
    dateKey,
    investmentCount: profile.investmentCount,
    transactionCount: profile.transactionCount
  };
}

function createValuationValue(
  cents: number | null,
  status: ValuationValueStatus,
  source: ValuationValueSource,
  fetchedAt: number | null = null
): ValuationValue {
  return {
    cents,
    fetchedAt,
    source,
    status
  };
}

function createReadyValue(
  cents: number,
  source: ValuationValueSource,
  fetchedAt: number | null = null
) {
  return createValuationValue(cents, "ready", source, fetchedAt);
}

function createLoadingValue(source: ValuationValueSource = "derived") {
  return createValuationValue(null, "loading", source);
}

function createEmptyProviderValuation(id: string): ProviderValuation {
  const zero = () => createReadyValue(0, "derived");

  return {
    hasBinance: false,
    hasChecking: false,
    hasCrypto: false,
    hasInvestment: false,
    id,
    label: id,
    totals: {
      binance: zero(),
      checking: zero(),
      crypto: zero(),
      investment: zero(),
      total: zero()
    },
    transactionCount: null
  };
}

function getProviderValuation(
  providers: Record<string, ProviderValuation>,
  id: string
) {
  providers[id] ??= createEmptyProviderValuation(id);
  return providers[id];
}

function getAggregateFetchedAt(values: ValuationValue[]) {
  const fetchedAtValues = values
    .map((value) => value.fetchedAt)
    .filter((fetchedAt): fetchedAt is number => typeof fetchedAt === "number");

  return fetchedAtValues.length > 0 ? Math.min(...fetchedAtValues) : null;
}

function getBlockingStatus(values: ValuationValue[]): ValuationValueStatus | null {
  if (values.some((value) => value.status === "error")) {
    return "error";
  }

  if (values.some((value) => value.status === "loading")) {
    return "loading";
  }

  if (values.some((value) => value.status === "missing-live-quote")) {
    return "missing-live-quote";
  }

  if (values.some((value) => value.status === "unavailable")) {
    return "unavailable";
  }

  return null;
}

function sumValuationValues(
  values: ValuationValue[],
  source: ValuationValueSource = "derived"
): ValuationValue {
  if (values.length === 0) {
    return createReadyValue(0, source);
  }

  const blockingStatus = getBlockingStatus(values);
  if (blockingStatus) {
    return createValuationValue(null, blockingStatus, source, getAggregateFetchedAt(values));
  }

  return createReadyValue(
    values.reduce((sum, value) => sum + (value.cents ?? 0), 0),
    source,
    getAggregateFetchedAt(values)
  );
}

function isOpenQuantity(quantity: number) {
  return Math.abs(quantity) > OPEN_HOLDING_THRESHOLD;
}

function isValidMarketQuote(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getQuoteValue(
  key: string,
  livePrices: Record<string, number | null>,
  liveQuotes: Record<string, LiveQuote>
) {
  const quote = liveQuotes[key];
  const cacheValue = Object.hasOwn(livePrices, key) ? livePrices[key] : undefined;
  const value = quote?.value ?? cacheValue ?? null;

  return {
    quote,
    value
  };
}

function getPricedHoldingValue({
  fallbackCents,
  livePrices,
  liveQuotes,
  priceKey,
  quantity
}: {
  fallbackCents: number;
  livePrices: Record<string, number | null>;
  liveQuotes: Record<string, LiveQuote>;
  priceKey: string | null | undefined;
  quantity: number;
}): ValuationValue {
  if (!priceKey) {
    return createReadyValue(fallbackCents, "derived");
  }

  const { quote, value } = getQuoteValue(priceKey, livePrices, liveQuotes);

  if (isValidMarketQuote(value)) {
    return createReadyValue(Math.round(quantity * value * 100), "live-quote", quote?.fetchedAt ?? null);
  }

  if (quote || Object.hasOwn(livePrices, priceKey)) {
    return createValuationValue(null, "unavailable", "live-quote", quote?.fetchedAt ?? null);
  }

  return createValuationValue(null, "missing-live-quote", "live-quote");
}

function getBinanceBalanceValue(
  balance: BinanceBalanceRow,
  livePrices: Record<string, number | null>,
  liveQuotes: Record<string, LiveQuote>
): ValuationValue {
  const quantity = getBinanceBalanceQuantity(balance);
  const priceKey = getBinanceBalanceLivePriceKey(balance);
  const syncedValueCents = Number.isFinite(balance.eurValue)
    ? Math.round(balance.eurValue * 100)
    : 0;

  if (!priceKey) {
    return createReadyValue(syncedValueCents, "binance-sync");
  }

  const { quote, value } = getQuoteValue(priceKey, livePrices, liveQuotes);

  if (isValidMarketQuote(value)) {
    return createReadyValue(Math.round(quantity * value * 100), "live-quote", quote?.fetchedAt ?? null);
  }

  return createReadyValue(syncedValueCents, "binance-sync", quote?.fetchedAt ?? null);
}

function mergeAssetValue(
  assets: Record<string, AssetValuation>,
  asset: AssetValuation
) {
  const current = assets[asset.id];

  if (!current) {
    assets[asset.id] = asset;
    return;
  }

  assets[asset.id] = {
    ...current,
    providerIds: [...new Set([...current.providerIds, ...asset.providerIds])],
    providerValues: mergeProviderAssetValues(current.providerValues, asset.providerValues),
    quantity: current.quantity + asset.quantity,
    value: sumValuationValues([current.value, asset.value], current.value.source)
  };
}

function mergeProviderAssetValues(
  currentValues: Record<string, ValuationValue>,
  nextValues: Record<string, ValuationValue>
) {
  const mergedValues = { ...currentValues };

  for (const [providerId, value] of Object.entries(nextValues)) {
    mergedValues[providerId] = mergedValues[providerId]
      ? sumValuationValues([mergedValues[providerId], value], value.source)
      : value;
  }

  return mergedValues;
}

function collectDashboardQuoteKeys(data: DashboardData | null, keys: MutableQuoteKeys) {
  for (const provider of data?.providerSummaries ?? []) {
    for (const product of provider.investmentProducts) {
      if (product.isin && isOpenQuantity(product.quantity)) {
        keys.isins.add(product.isin);
      }
    }

    for (const token of provider.cryptoTokens) {
      const tokenSymbol = normalizeCryptoSymbol(token.tokenSymbol);
      if (tokenSymbol && isOpenQuantity(token.quantity)) {
        keys.cryptos.add(tokenSymbol);
      }
    }
  }
}

function collectBinanceQuoteKeys(
  binancePayload: BinanceStagePayload | null | undefined,
  keys: MutableQuoteKeys
) {
  getBinanceLivePriceKeys(binancePayload?.balances).forEach((key) => keys.cryptos.add(key));
}

export function collectCurrentValuationQuoteKeys(
  dashboardData: DashboardData | null,
  binancePayload?: BinanceStagePayload | null
) {
  const keys = createQuoteKeySets();

  collectDashboardQuoteKeys(dashboardData, keys);
  collectBinanceQuoteKeys(binancePayload, keys);

  return toSortedQuoteKeys(keys);
}

function buildQuoteDiagnostics(
  quoteKeys: CurrentValuationSnapshot["quoteKeys"],
  livePrices: Record<string, number | null>,
  liveQuotes: Record<string, LiveQuote>,
  now: number
): CurrentValuationSnapshot["diagnostics"] {
  const diagnostics = getLivePriceDiagnostics(quoteKeys, now);
  const missingKeys = new Set(diagnostics.missingKeys);
  const unavailableKeys = new Set(diagnostics.unavailableKeys);
  const fetchedAtValues: number[] = [];
  const quoteAgeValues: number[] = [];

  for (const key of diagnostics.requestedKeys) {
    const { quote, value } = getQuoteValue(key, livePrices, liveQuotes);
    const wasAttempted = !!quote || Object.hasOwn(livePrices, key);

    if (quote?.fetchedAt !== null && quote?.fetchedAt !== undefined) {
      fetchedAtValues.push(quote.fetchedAt);
      quoteAgeValues.push(Math.max(0, now - quote.fetchedAt));
    }

    if (wasAttempted) {
      missingKeys.delete(key);
    }

    if (wasAttempted && !isValidMarketQuote(value)) {
      unavailableKeys.add(key);
    }
  }

  return {
    lastFetchAt: fetchedAtValues.length > 0
      ? Math.max(...fetchedAtValues)
      : diagnostics.lastFetchAt,
    maxQuoteAgeMs: quoteAgeValues.length > 0
      ? Math.max(...quoteAgeValues)
      : diagnostics.maxQuoteAgeMs,
    missingKeys: [...missingKeys].sort(),
    unavailableKeys: [...unavailableKeys].sort()
  };
}

function getSnapshotStatus(totals: CurrentValuationSnapshot["totals"]): CurrentValuationStatus {
  const values = Object.values(totals);

  if (values.some((value) => value.status === "error")) {
    return "error";
  }

  if (values.some((value) => value.status === "loading")) {
    return "loading";
  }

  if (values.some((value) => value.status !== "ready")) {
    return "partial";
  }

  return "ready";
}

function createEmptyDashboardData(): DashboardData {
  return {
    accountTotals: {
      checking: 0,
      crypto: 0,
      heritage: 0,
      investment: 0
    },
    dailyData: [],
    monthlyData: [],
    providerSummaries: []
  };
}

function buildLoadingSnapshot(
  profile: UserRecord,
  binanceRefreshKey: number,
  dateKey: string,
  now: number
): CurrentValuationSnapshot {
  const loading = createLoadingValue();

  return {
    assets: {},
    diagnostics: {
      lastFetchAt: null,
      maxQuoteAgeMs: null,
      missingKeys: [],
      unavailableKeys: []
    },
    profileId: profile.id,
    providers: {},
    quoteKeys: {
      cryptos: [],
      isins: []
    },
    status: "loading",
    totals: {
      binance: loading,
      checking: loading,
      crypto: loading,
      heritage: loading,
      investment: loading
    },
    updatedAt: now,
    version: createVersion(profile, binanceRefreshKey, dateKey)
  };
}

function buildProviderInvestmentValue(
  provider: ProviderSummary,
  assets: Record<string, AssetValuation>,
  livePrices: Record<string, number | null>,
  liveQuotes: Record<string, LiveQuote>
) {
  const productValues: ValuationValue[] = [];

  for (const product of provider.investmentProducts) {
    if (!isOpenQuantity(product.quantity)) {
      continue;
    }

    const value = getPricedHoldingValue({
      fallbackCents: product.investedValue,
      livePrices,
      liveQuotes,
      priceKey: product.isin,
      quantity: product.quantity
    });

    productValues.push(value);
    mergeAssetValue(assets, {
      category: "investment",
      chartKey: product.productName,
      id: `investment:${product.productName}`,
      label: product.productName,
      priceKey: product.isin ?? null,
      providerIds: [provider.sourceInstitution],
      providerValues: {
        [provider.sourceInstitution]: value
      },
      quantity: product.quantity,
      value
    });
  }

  return productValues.length > 0 ? sumValuationValues(productValues) : createReadyValue(0, "derived");
}

function buildProviderCryptoValue(
  provider: ProviderSummary,
  assets: Record<string, AssetValuation>,
  livePrices: Record<string, number | null>,
  liveQuotes: Record<string, LiveQuote>
) {
  const tokenValues: ValuationValue[] = [];

  for (const token of provider.cryptoTokens) {
    if (!isOpenQuantity(token.quantity)) {
      continue;
    }

    const priceKey = normalizeCryptoSymbol(token.tokenSymbol);
    const value = getPricedHoldingValue({
      fallbackCents: token.investedValue,
      livePrices,
      liveQuotes,
      priceKey,
      quantity: token.quantity
    });

    tokenValues.push(value);
    mergeAssetValue(assets, {
      category: "crypto",
      chartKey: token.tokenName,
      id: `crypto:${token.tokenName}`,
      label: token.tokenName,
      priceKey,
      providerIds: [provider.sourceInstitution],
      providerValues: {
        [provider.sourceInstitution]: value
      },
      quantity: token.quantity,
      value
    });
  }

  return tokenValues.length > 0 ? sumValuationValues(tokenValues) : createReadyValue(0, "derived");
}

function buildBinanceValuation(
  profile: UserRecord,
  binancePayload: BinanceStagePayload | null | undefined,
  assets: Record<string, AssetValuation>,
  providers: Record<string, ProviderValuation>,
  livePrices: Record<string, number | null>,
  liveQuotes: Record<string, LiveQuote>
) {
  if (!profile.hasBinanceCredentials && !binancePayload?.balances?.length) {
    return createReadyValue(0, "binance-sync");
  }

  if (!binancePayload) {
    return createLoadingValue("binance-sync");
  }

  const balanceValues: ValuationValue[] = [];
  const balances = binancePayload.balances ?? [];

  for (const balance of balances) {
    const quantity = getBinanceBalanceQuantity(balance);
    if (!isOpenQuantity(quantity)) {
      continue;
    }

    const priceKey = getBinanceBalanceLivePriceKey(balance);
    const label = balance.tokenName
      ? `${balance.tokenName} (${balance.tokenSymbol})`
      : balance.tokenSymbol;
    const value = getBinanceBalanceValue(balance, livePrices, liveQuotes);

    balanceValues.push(value);
    mergeAssetValue(assets, {
      category: "binance",
      chartKey: label,
      id: `binance:${priceKey ?? balance.tokenSymbol}`,
      label,
      priceKey,
      providerIds: [BINANCE_PROVIDER_ID],
      providerValues: {
        [BINANCE_PROVIDER_ID]: value
      },
      quantity,
      value
    });
  }

  const binanceValue = balanceValues.length > 0
    ? sumValuationValues(balanceValues, "binance-sync")
    : createReadyValue(0, "binance-sync");
  const provider = getProviderValuation(providers, BINANCE_PROVIDER_ID);
  provider.hasBinance = true;
  provider.hasCrypto = true;
  provider.totals.binance = binanceValue;
  provider.totals.crypto = binanceValue;
  provider.totals.total = binanceValue;
  provider.transactionCount = 0;

  return binanceValue;
}

export function buildCurrentValuationSnapshot({
  binancePayload,
  binanceRefreshKey = 0,
  dashboardData,
  dateKey = getUtcDateKey(),
  livePrices = globalLivePricesCache,
  liveQuotes = globalLiveQuotesCache,
  now = Date.now(),
  profile
}: BuildCurrentValuationSnapshotOptions): CurrentValuationSnapshot {
  if (!dashboardData) {
    return buildLoadingSnapshot(profile, binanceRefreshKey, dateKey, now);
  }

  const providers: Record<string, ProviderValuation> = {};
  const assets: Record<string, AssetValuation> = {};

  for (const providerSummary of dashboardData.providerSummaries) {
    const provider = getProviderValuation(providers, providerSummary.sourceInstitution);
    const checkingValue = createReadyValue(providerSummary.checking.total, "checking-balance");
    const investmentValue = buildProviderInvestmentValue(providerSummary, assets, livePrices, liveQuotes);
    const cryptoValue = buildProviderCryptoValue(providerSummary, assets, livePrices, liveQuotes);

    provider.hasChecking = providerSummary.checking.total !== 0;
    provider.hasInvestment = providerSummary.investmentProducts.some((product) => isOpenQuantity(product.quantity));
    provider.hasCrypto = providerSummary.cryptoTokens.some((token) => isOpenQuantity(token.quantity));
    provider.totals.checking = checkingValue;
    provider.totals.investment = investmentValue;
    provider.totals.crypto = cryptoValue;
    provider.totals.total = sumValuationValues([checkingValue, investmentValue, cryptoValue]);
  }

  const binanceValue = buildBinanceValuation(
    profile,
    binancePayload,
    assets,
    providers,
    livePrices,
    liveQuotes
  );
  const checkingValue = createReadyValue(dashboardData.accountTotals.checking, "checking-balance");
  const investmentValue = sumValuationValues(
    Object.values(providers)
      .filter((provider) => provider.id !== BINANCE_PROVIDER_ID)
      .map((provider) => provider.totals.investment)
  );
  const providerCryptoValue = sumValuationValues(
    Object.values(providers)
      .filter((provider) => provider.id !== BINANCE_PROVIDER_ID)
      .map((provider) => provider.totals.crypto)
  );
  const cryptoValue = sumValuationValues([providerCryptoValue, binanceValue]);
  const heritageValue = sumValuationValues([checkingValue, investmentValue, cryptoValue]);
  const quoteKeys = collectCurrentValuationQuoteKeys(dashboardData, binancePayload);
  const totals = {
    binance: binanceValue,
    checking: checkingValue,
    crypto: cryptoValue,
    heritage: heritageValue,
    investment: investmentValue
  };

  return {
    assets,
    diagnostics: buildQuoteDiagnostics(quoteKeys, livePrices, liveQuotes, now),
    profileId: profile.id,
    providers,
    quoteKeys,
    status: getSnapshotStatus(totals),
    totals,
    updatedAt: now,
    version: createVersion(profile, binanceRefreshKey, dateKey)
  };
}

function emitCurrentValuationChange(profileId: string) {
  const snapshot = getCurrentValuationSnapshot(profileId);
  currentValuationListeners.get(profileId)?.forEach((listener) => listener(snapshot));
}

function publishCurrentValuationSnapshot(snapshot: CurrentValuationSnapshot) {
  currentValuationEntries.set(snapshot.profileId, {
    snapshot
  });
  emitCurrentValuationChange(snapshot.profileId);

  return snapshot;
}

export function isCurrentValuationSnapshotCurrentForProfile(
  snapshot: CurrentValuationSnapshot,
  profile: UserRecord,
  { binanceRefreshKey = 0, dateKey = getUtcDateKey() }: EnsureCurrentValuationOptions = {}
) {
  return snapshot.version.transactionCount === profile.transactionCount
    && snapshot.version.checkingCount === profile.checkingCount
    && snapshot.version.investmentCount === profile.investmentCount
    && snapshot.version.cryptoCount === profile.cryptoCount
    && snapshot.version.binanceRefreshKey === binanceRefreshKey
    && snapshot.version.dateKey === dateKey;
}

function isSnapshotCurrentForProfile(
  snapshot: CurrentValuationSnapshot,
  profile: UserRecord,
  options: EnsureCurrentValuationOptions
) {
  return isCurrentValuationSnapshotCurrentForProfile(snapshot, profile, options)
    && isSnapshotLivePriceFresh(snapshot, options);
}

function isSnapshotLivePriceFresh(
  snapshot: CurrentValuationSnapshot,
  options: EnsureCurrentValuationOptions
) {
  if (typeof options.livePriceMaxAgeMs !== "number") {
    return true;
  }

  const hasRequestedQuotes = snapshot.quoteKeys.cryptos.length > 0 || snapshot.quoteKeys.isins.length > 0;
  if (!hasRequestedQuotes) {
    return true;
  }

  if (snapshot.diagnostics.missingKeys.length > 0 || snapshot.diagnostics.unavailableKeys.length > 0) {
    return false;
  }

  if (typeof snapshot.diagnostics.maxQuoteAgeMs !== "number") {
    return false;
  }

  const elapsedSinceSnapshotMs = Math.max(0, Date.now() - snapshot.updatedAt);
  return snapshot.diagnostics.maxQuoteAgeMs + elapsedSinceSnapshotMs <= options.livePriceMaxAgeMs;
}

async function fetchCurrentValuationStageData(
  profile: UserRecord,
  { binanceRefreshKey = 0, force = false }: EnsureCurrentValuationOptions
) {
  const dashboardPromise = profile.transactionCount > 0
    ? fetchDashboardStageData("dashboard", profile.id, {
        force,
        version: profile.transactionCount
      })
    : Promise.resolve(createEmptyDashboardData());
  const binancePromise = profile.hasBinanceCredentials
    ? fetchDashboardStageData("binance", profile.id, {
        force,
        version: binanceRefreshKey
      })
    : Promise.resolve(null);

  const [dashboardData, binancePayload] = await Promise.all([dashboardPromise, binancePromise]);

  return {
    binancePayload,
    dashboardData
  };
}

export async function ensureCurrentValuation(
  profile: UserRecord,
  options: EnsureCurrentValuationOptions = {}
) {
  const existingEntry = currentValuationEntries.get(profile.id);

  if (!options.force && existingEntry?.promise) {
    return existingEntry.promise;
  }

  if (
    !options.force
    && existingEntry?.snapshot
    && isSnapshotCurrentForProfile(existingEntry.snapshot, profile, options)
  ) {
    return existingEntry.snapshot;
  }

  const promise = fetchCurrentValuationStageData(profile, options)
    .then(async ({ binancePayload, dashboardData }) => {
      const quoteKeys = collectCurrentValuationQuoteKeys(dashboardData, binancePayload);
      if (quoteKeys.isins.length > 0 || quoteKeys.cryptos.length > 0) {
        await fetchAndCacheLivePrices(quoteKeys, {
          maxAgeMs: options.livePriceMaxAgeMs ?? 0
        });
      }

      return publishCurrentValuationSnapshot(buildCurrentValuationSnapshot({
        binancePayload,
        binanceRefreshKey: options.binanceRefreshKey ?? 0,
        dashboardData,
        dateKey: options.dateKey,
        profile
      }));
    })
    .catch(() => {
      const previousSnapshot = currentValuationEntries.get(profile.id)?.snapshot;
      if (previousSnapshot) {
        return previousSnapshot;
      }

      return publishCurrentValuationSnapshot({
        ...buildLoadingSnapshot(
          profile,
          options.binanceRefreshKey ?? 0,
          options.dateKey ?? getUtcDateKey(),
          Date.now()
        ),
        status: "error"
      });
    })
    .finally(() => {
      const entry = currentValuationEntries.get(profile.id);
      if (entry?.promise === promise) {
        currentValuationEntries.set(profile.id, {
          snapshot: entry.snapshot
        });
      }
    });

  currentValuationEntries.set(profile.id, {
    promise,
    snapshot: existingEntry?.snapshot ?? null
  });

  return promise;
}

export function refreshCurrentValuationFromCaches(
  profile: UserRecord,
  { binanceRefreshKey = 0, dateKey = getUtcDateKey() }: EnsureCurrentValuationOptions = {}
) {
  const dashboardData = profile.transactionCount > 0
    ? readDashboardStageDataCache("dashboard", profile.id, profile.transactionCount)
    : createEmptyDashboardData();

  if (!dashboardData) {
    return getCurrentValuationSnapshot(profile.id);
  }

  const binancePayload = profile.hasBinanceCredentials
    ? readDashboardStageDataCache("binance", profile.id, binanceRefreshKey)
    : null;
  const snapshot = buildCurrentValuationSnapshot({
    binancePayload,
    binanceRefreshKey,
    dashboardData,
    dateKey,
    profile
  });

  return publishCurrentValuationSnapshot(snapshot);
}

export function subscribeCurrentValuation(
  profileId: string,
  listener: CurrentValuationListener
) {
  const listeners = currentValuationListeners.get(profileId) ?? new Set<CurrentValuationListener>();
  listeners.add(listener);
  currentValuationListeners.set(profileId, listeners);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      currentValuationListeners.delete(profileId);
    }
  };
}

export function getCurrentValuationSnapshot(profileId: string) {
  return currentValuationEntries.get(profileId)?.snapshot ?? null;
}

export function useCurrentValuationSnapshot(profileId: string | null) {
  return useSyncExternalStore(
    (listener) => profileId ? subscribeCurrentValuation(profileId, listener) : () => undefined,
    () => profileId ? getCurrentValuationSnapshot(profileId) : null,
    () => null
  );
}

function getProfileIdsKey(profileIds: string[]) {
  return [...new Set(profileIds)].sort().join("|");
}

function getCurrentValuationSnapshotMap(profileIdsKey: string) {
  if (!profileIdsKey) {
    return emptySnapshotMap;
  }

  const profileIds = profileIdsKey.split("|");
  const snapshots = profileIds.map((profileId) => getCurrentValuationSnapshot(profileId));
  const cached = currentValuationSnapshotMapCache.get(profileIdsKey);

  if (
    cached
    && cached.snapshots.length === snapshots.length
    && cached.snapshots.every((snapshot, index) => snapshot === snapshots[index])
  ) {
    return cached.value;
  }

  const value = Object.fromEntries(
    profileIds.map((profileId, index) => [profileId, snapshots[index]])
  ) satisfies CurrentValuationSnapshotsByProfile;

  currentValuationSnapshotMapCache.set(profileIdsKey, {
    snapshots,
    value
  });

  return value;
}

function subscribeCurrentValuationSnapshotMap(profileIdsKey: string, listener: () => void) {
  if (!profileIdsKey) {
    return () => undefined;
  }

  const unsubscribers = profileIdsKey
    .split("|")
    .map((profileId) => subscribeCurrentValuation(profileId, listener));

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}

export function useCurrentValuationSnapshotMap(profileIds: string[]) {
  const profileIdsKey = useMemo(() => getProfileIdsKey(profileIds), [profileIds]);

  return useSyncExternalStore(
    (listener) => subscribeCurrentValuationSnapshotMap(profileIdsKey, listener),
    () => getCurrentValuationSnapshotMap(profileIdsKey),
    () => emptySnapshotMap
  );
}

export function invalidateCurrentValuation(profileId: string) {
  const hadEntry = currentValuationEntries.delete(profileId);

  if (hadEntry) {
    emitCurrentValuationChange(profileId);
  }
}

export function resetCurrentValuationsStore() {
  const profileIds = [...currentValuationEntries.keys()];
  currentValuationEntries.clear();
  profileIds.forEach((profileId) => emitCurrentValuationChange(profileId));
}

export function isValuationValueReady(value: ValuationValue) {
  return value.status === "ready" && typeof value.cents === "number";
}

function shouldExposeValuationValue(value: ValuationValue) {
  return isValuationValueReady(value);
}

export function selectCurrentValuationHeritageAggregate(
  profiles: UserRecord[],
  snapshotsByProfileId: CurrentValuationSnapshotsByProfile,
  options: EnsureCurrentValuationOptions = {}
): CurrentValuationHeritageAggregate {
  const pendingProfileIds: string[] = [];
  const missingKeys = new Set<string>();
  const unavailableKeys = new Set<string>();
  const values = {
    binance: [] as ValuationValue[],
    checking: [] as ValuationValue[],
    crypto: [] as ValuationValue[],
    heritage: [] as ValuationValue[],
    investment: [] as ValuationValue[]
  };

  for (const profile of profiles) {
    const snapshot = snapshotsByProfileId[profile.id];

    if (!snapshot || !isCurrentValuationSnapshotCurrentForProfile(snapshot, profile, options)) {
      pendingProfileIds.push(profile.id);
      continue;
    }

    snapshot.diagnostics.missingKeys.forEach((key) => missingKeys.add(key));
    snapshot.diagnostics.unavailableKeys.forEach((key) => unavailableKeys.add(key));
    values.binance.push(snapshot.totals.binance);
    values.checking.push(snapshot.totals.checking);
    values.crypto.push(snapshot.totals.crypto);
    values.heritage.push(snapshot.totals.heritage);
    values.investment.push(snapshot.totals.investment);
  }

  if (pendingProfileIds.length > 0) {
    return {
      diagnostics: {
        missingKeys: [...missingKeys].sort(),
        pendingProfileIds,
        unavailableKeys: [...unavailableKeys].sort()
      },
      point: null,
      status: "loading",
      value: createLoadingValue()
    };
  }

  const totals = {
    binance: sumValuationValues(values.binance),
    checking: sumValuationValues(values.checking),
    crypto: sumValuationValues(values.crypto),
    heritage: sumValuationValues(values.heritage),
    investment: sumValuationValues(values.investment)
  };
  const status = getSnapshotStatus(totals);
  const dateKey = options.dateKey ?? getUtcDateKey();

  return {
    diagnostics: {
      missingKeys: [...missingKeys].sort(),
      pendingProfileIds,
      unavailableKeys: [...unavailableKeys].sort()
    },
    point: isValuationValueReady(totals.heritage)
      ? {
          binance: totals.binance.cents,
          checking: totals.checking.cents,
          crypto: totals.crypto.cents,
          heritage: totals.heritage.cents,
          investment: totals.investment.cents,
          rawMonth: dateKey,
          value: totals.heritage.cents
        }
      : null,
    status,
    value: totals.heritage
  };
}

export function selectCurrentValuationTopbar(
  snapshot: CurrentValuationSnapshot | null,
  stage: DashboardStageKey
): CurrentValuationTopbarItem[] {
  if (!snapshot) {
    return [];
  }

  if (stage === "dashboard") {
    if (!shouldExposeValuationValue(snapshot.totals.heritage)) {
      return [];
    }

    const items: CurrentValuationTopbarItem[] = [{
      id: "heritage",
      value: snapshot.totals.heritage
    }];

    if (Object.values(snapshot.providers).some((provider) => provider.hasChecking)) {
      items.push({
        id: "checking",
        value: snapshot.totals.checking
      });
    }

    if (Object.values(snapshot.providers).some((provider) => provider.hasInvestment)) {
      items.push({
        id: "investment",
        value: snapshot.totals.investment
      });
    }

    if (Object.values(snapshot.providers).some((provider) => provider.hasCrypto || provider.hasBinance)) {
      items.push({
        id: "crypto",
        value: snapshot.totals.crypto
      });
    }

    return items.filter((item) => shouldExposeValuationValue(item.value));
  }

  if (stage === "checking") {
    const checkingProviders = Object.values(snapshot.providers)
      .filter((provider) => provider.hasChecking);

    if (checkingProviders.length === 0 || !shouldExposeValuationValue(snapshot.totals.checking)) {
      return [];
    }

    return [
      {
        id: "checking",
        value: snapshot.totals.checking
      },
      ...checkingProviders.map((provider) => ({
        id: `checking:${provider.id}`,
        label: provider.id,
        value: provider.totals.checking
      }))
    ].filter((item) => shouldExposeValuationValue(item.value));
  }

  if (stage === "investment") {
    const investmentProviders = Object.values(snapshot.providers)
      .filter((provider) => provider.hasInvestment);

    if (investmentProviders.length === 0 || !shouldExposeValuationValue(snapshot.totals.investment)) {
      return [];
    }

    return [
      {
        id: "investment",
        value: snapshot.totals.investment
      },
      ...investmentProviders.map((provider) => ({
        id: `investment:${provider.id}`,
        label: provider.id,
        value: provider.totals.investment
      }))
    ].filter((item) => shouldExposeValuationValue(item.value));
  }

  if (stage === "crypto") {
    const cryptoProviders = Object.values(snapshot.providers)
      .filter((provider) => provider.hasCrypto || provider.hasBinance);

    if (cryptoProviders.length === 0 || !shouldExposeValuationValue(snapshot.totals.crypto)) {
      return [];
    }

    return [
      {
        id: "crypto",
        value: snapshot.totals.crypto
      },
      ...cryptoProviders.map((provider) => ({
        id: `crypto:${provider.id}`,
        label: provider.id,
        value: provider.hasBinance ? provider.totals.binance : provider.totals.crypto
      }))
    ].filter((item) => shouldExposeValuationValue(item.value));
  }

  if (stage === "binance" && shouldExposeValuationValue(snapshot.totals.binance)) {
    return [{
      id: "binance",
      label: BINANCE_PROVIDER_ID,
      value: snapshot.totals.binance
    }];
  }

  return [];
}

export function selectCurrentValuationCards(
  snapshot: CurrentValuationSnapshot | null,
  stage: DashboardStageKey
): CurrentValuationCardItem[] {
  if (!snapshot) {
    return [];
  }

  if (stage === "dashboard") {
    return [
      {
        category: "heritage",
        id: "heritage",
        label: "Heritage",
        value: snapshot.totals.heritage
      },
      {
        category: "checking",
        id: "checking",
        label: "Checking",
        value: snapshot.totals.checking
      },
      {
        category: "investment",
        id: "investment",
        label: "Investment",
        value: snapshot.totals.investment
      },
      {
        category: "crypto",
        id: "crypto",
        label: "Crypto",
        value: snapshot.totals.crypto
      },
      {
        category: "binance",
        id: "binance",
        label: "Binance",
        value: snapshot.totals.binance
      }
    ];
  }

  if (stage === "checking") {
    return Object.values(snapshot.providers)
      .filter((provider) => provider.hasChecking)
      .map((provider) => ({
        category: "checking",
        id: `checking:${provider.id}`,
        label: provider.label,
        value: provider.totals.checking
      }));
  }

  if (stage === "investment" || stage === "crypto" || stage === "binance") {
    return Object.values(snapshot.assets)
      .filter((asset) => asset.category === stage || (stage === "crypto" && asset.category === "binance"))
      .map((asset) => ({
        category: asset.category,
        id: asset.id,
        label: asset.label,
        value: asset.value
      }));
  }

  return [];
}

export function selectCurrentValuationChartPoint(
  snapshot: CurrentValuationSnapshot | null
): DashboardChartPoint | null {
  if (!snapshot) {
    return null;
  }

  const point: DashboardChartPoint = {
    binance: snapshot.totals.binance.cents,
    checking: snapshot.totals.checking.cents,
    crypto: snapshot.totals.crypto.cents,
    heritage: snapshot.totals.heritage.cents,
    investment: snapshot.totals.investment.cents,
    rawMonth: snapshot.version.dateKey,
    value: snapshot.totals.heritage.cents
  };

  for (const provider of Object.values(snapshot.providers)) {
    if (provider.hasChecking) {
      point[provider.id] = provider.totals.checking.cents;
    }

    if (provider.hasInvestment) {
      point[`investment_inst_${provider.id}`] = provider.totals.investment.cents;
    }

    if (provider.hasCrypto && !provider.hasBinance) {
      point[`crypto_inst_${provider.id}`] = provider.totals.crypto.cents;
    }
  }

  for (const asset of Object.values(snapshot.assets)) {
    point[asset.chartKey] = asset.value.cents;
  }

  return point;
}

export function selectCurrentPortfolioValuationChartPoint(
  snapshot: CurrentValuationSnapshot | null,
  stage: "investment" | "crypto",
  activeTab: string
): ChartPoint | null {
  if (!snapshot) {
    return null;
  }

  const rootValue = stage === "investment"
    ? snapshot.totals.investment
    : snapshot.totals.crypto;
  const point: ChartPoint = {
    date: snapshot.version.dateKey,
    heritage: rootValue.cents,
    month: snapshot.version.dateKey,
    rawMonth: snapshot.version.dateKey
  };

  for (const provider of Object.values(snapshot.providers)) {
    if (stage === "investment" && provider.hasInvestment) {
      point[provider.id] = provider.totals.investment.cents;
    }

    if (stage === "crypto" && (provider.hasCrypto || provider.hasBinance)) {
      point[provider.id] = provider.hasBinance
        ? provider.totals.binance.cents
        : provider.totals.crypto.cents;
    }
  }

  if (activeTab !== "ALL") {
    const activeProvider = snapshot.providers[activeTab];
    point.balance = activeProvider
      ? stage === "investment"
        ? activeProvider.totals.investment.cents
        : activeProvider.hasBinance
          ? activeProvider.totals.binance.cents
          : activeProvider.totals.crypto.cents
      : null;

    for (const asset of Object.values(snapshot.assets)) {
      if (stage === "investment" && asset.category !== "investment") {
        continue;
      }

      if (stage === "crypto" && asset.category !== "crypto" && asset.category !== "binance") {
        continue;
      }

      const providerValue = asset.providerValues[activeTab];
      if (providerValue) {
        point[asset.chartKey] = providerValue.cents;
      }
    }
  }

  return point;
}
