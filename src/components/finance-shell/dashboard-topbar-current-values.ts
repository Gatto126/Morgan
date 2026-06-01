import { Coins, Landmark, Wallet } from "lucide-react";

import {
  applyLiveBinanceBalanceValues,
  getBinanceBalancesTotalCents,
  getBinanceLivePriceKeys
} from "@/components/dashboard/binance-live-values";
import type { DashboardChartPoint } from "@/components/dashboard/dashboard-chart-types";
import { buildDashboardCurrentSnapshot } from "@/components/dashboard/dashboard-current-snapshot";
import { getDashboardPointValue } from "@/components/dashboard/dashboard-current-point";
import { formatEuroCents } from "@/components/dashboard/formatters";
import type { DashboardData, ProviderSummary } from "@/components/dashboard/types";
import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";
import { areLivePriceKeysValued } from "@/shared/live-price-readiness";
import { globalLivePricesCache } from "@/shared/live-prices";

import { readDashboardStageDataCache } from "./dashboard-stage-data-cache";
import { seedDashboardTopbarLayout, type DashboardTopbarItem } from "./dashboard-topbar-store";
import type { UserRecord } from "./types";

const OPEN_HOLDING_THRESHOLD = 0.000001;

function getProviderTabLabel(sourceInstitution: string) {
  const upper = sourceInstitution.replace(/_/g, " ").trim().toUpperCase();
  const words = upper.split(/\s+/).filter(Boolean);

  return words.length > 1 ? words.map((word) => word[0]).join("") : upper;
}

function formatPointValue(point: DashboardChartPoint | null, key: string) {
  const value = point?.[key];

  return typeof value === "number" && Number.isFinite(value)
    ? formatEuroCents(value)
    : "--";
}

function hasOpenInvestment(provider: ProviderSummary) {
  return provider.investmentProducts.some((product) => Math.abs(product.quantity) > OPEN_HOLDING_THRESHOLD);
}

function hasOpenCrypto(provider: ProviderSummary) {
  return provider.cryptoTokens.some((token) => Math.abs(token.quantity) > OPEN_HOLDING_THRESHOLD);
}

function getInvestmentPriceKeys(data: DashboardData) {
  return [
    ...new Set(data.providerSummaries.flatMap((provider) =>
      provider.investmentProducts
        .filter((product) => Math.abs(product.quantity) > OPEN_HOLDING_THRESHOLD)
        .map((product) => product.isin)
        .filter((isin): isin is string => !!isin)
    ))
  ].sort();
}

function getCryptoPriceKeys(data: DashboardData, binanceBalances: ReturnType<typeof applyLiveBinanceBalanceValues>) {
  return [
    ...new Set([
      ...data.providerSummaries.flatMap((provider) =>
        provider.cryptoTokens
          .filter((token) => Math.abs(token.quantity) > OPEN_HOLDING_THRESHOLD)
          .map((token) => normalizeCryptoSymbol(token.tokenSymbol))
          .filter((symbol): symbol is string => !!symbol)
      ),
      ...getBinanceLivePriceKeys(binanceBalances)
    ])
  ].sort();
}

function seedCheckingTopbar(user: UserRecord, point: DashboardChartPoint, data: DashboardData) {
  const checkingProviders = data.providerSummaries.filter((provider) => provider.checking.total !== 0);

  if (checkingProviders.length === 0) {
    return;
  }

  seedDashboardTopbarLayout("checking", user.id, [
    {
      active: true,
      icon: Landmark,
      id: "checking",
      value: formatPointValue(point, "checking")
    },
    ...checkingProviders.map((provider) => ({
      active: false,
      id: `checking:${provider.sourceInstitution}`,
      label: getProviderTabLabel(provider.sourceInstitution),
      value: formatPointValue(point, provider.sourceInstitution)
    }))
  ]);
}

function seedInvestmentTopbar(user: UserRecord, point: DashboardChartPoint, data: DashboardData) {
  const investmentProviders = data.providerSummaries.filter(hasOpenInvestment);

  if (investmentProviders.length === 0 || getDashboardPointValue(point, "investment") === null) {
    return;
  }

  seedDashboardTopbarLayout("investment", user.id, [
    {
      active: true,
      animateChanges: true,
      icon: Wallet,
      id: "investment",
      value: formatPointValue(point, "investment")
    },
    ...investmentProviders.map((provider) => ({
      active: false,
      animateChanges: true,
      id: `investment:${provider.sourceInstitution}`,
      label: getProviderTabLabel(provider.sourceInstitution),
      value: formatPointValue(point, `investment_inst_${provider.sourceInstitution}`)
    }))
  ]);
}

function seedCryptoTopbar(
  user: UserRecord,
  point: DashboardChartPoint,
  data: DashboardData,
  binanceTotalCents: number
) {
  const cryptoProviders = data.providerSummaries.filter(hasOpenCrypto);
  const cryptoTotal = getDashboardPointValue(point, "crypto");

  if (cryptoProviders.length === 0 && binanceTotalCents <= 0) {
    return;
  }

  if (cryptoTotal === null) {
    return;
  }

  const binanceItem: DashboardTopbarItem[] = binanceTotalCents > 0
    ? [{
        active: false,
        animateChanges: true,
        id: "crypto:BINANCE",
        label: "BINANCE",
        value: formatEuroCents(binanceTotalCents)
      }]
    : [];

  seedDashboardTopbarLayout("crypto", user.id, [
    {
      active: true,
      animateChanges: true,
      icon: Coins,
      id: "crypto",
      value: formatEuroCents(cryptoTotal)
    },
    ...cryptoProviders.map((provider) => ({
      active: false,
      animateChanges: true,
      id: `crypto:${provider.sourceInstitution}`,
      label: getProviderTabLabel(provider.sourceInstitution),
      value: formatPointValue(point, `crypto_inst_${provider.sourceInstitution}`)
    })),
    ...binanceItem
  ]);
}

export function seedCurrentDashboardStageTopbars(user: UserRecord, binanceRefreshKey = 0) {
  const dashboardData = readDashboardStageDataCache("dashboard", user.id, user.transactionCount);
  if (!dashboardData) {
    return;
  }

  const binancePayload = user.hasBinanceCredentials
    ? readDashboardStageDataCache("binance", user.id, binanceRefreshKey)
    : null;
  const binanceBalances = Array.isArray(binancePayload?.balances) ? binancePayload.balances : [];
  const liveBinanceBalances = applyLiveBinanceBalanceValues(binanceBalances, globalLivePricesCache);
  const binanceTotalCents = getBinanceBalancesTotalCents(liveBinanceBalances);
  const investmentPricesReady = areLivePriceKeysValued(getInvestmentPriceKeys(dashboardData), globalLivePricesCache);
  const cryptoPricesReady = areLivePriceKeysValued(getCryptoPriceKeys(dashboardData, liveBinanceBalances), globalLivePricesCache);
  const hasBinancePortfolio = user.hasBinanceCredentials || binanceTotalCents > 0;
  const binanceBalancesKnown = !user.hasBinanceCredentials || !!binancePayload;
  const snapshot = buildDashboardCurrentSnapshot({
    binanceBalancesKnown,
    binanceTotalCents,
    cryptoPricesReady,
    data: dashboardData,
    hasBinancePortfolio,
    investmentPricesReady,
    livePrices: globalLivePricesCache
  });

  if (!snapshot) {
    return;
  }

  seedCheckingTopbar(user, snapshot, dashboardData);
  seedInvestmentTopbar(user, snapshot, dashboardData);
  seedCryptoTopbar(user, snapshot, dashboardData, binanceTotalCents);
}
