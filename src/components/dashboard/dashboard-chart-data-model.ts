import type { DashboardChartPoint } from "./dashboard-chart-types";
import { filterData } from "./formatters";
import type { AccountTab, DashboardData, MonthlyBucket, TimeRange } from "./types";

const NON_ZERO_THRESHOLD = 0.000001;

type BuildDashboardChartDataParams = {
  activeTab: AccountTab;
  binanceTotalCents: number;
  checkingProviders: string[];
  cryptoInstitutions: string[];
  cryptoTokens: string[];
  data: DashboardData | null;
  hasBinancePortfolio: boolean;
  investmentProducts: string[];
  timeRange: TimeRange;
};

type DashboardChartBucket = MonthlyBucket & { date?: string };

export function collectCheckingProviders(data: DashboardData | null) {
  return collectMonthlyKeys(data, "providerChecking");
}

export function collectInvestmentProducts(data: DashboardData | null) {
  return collectMonthlyKeys(data, "providerProducts");
}

export function collectCryptoTokens(data: DashboardData | null) {
  return collectMonthlyKeys(data, "providerCryptoTokens");
}

export function collectCryptoInstitutions(data: DashboardData | null) {
  if (!data) return [];

  return data.providerSummaries
    .filter((provider) => provider.cryptoTokens.some((token) => Math.abs(token.quantity) > NON_ZERO_THRESHOLD))
    .map((provider) => provider.sourceInstitution);
}

export function buildDashboardChartData({
  activeTab,
  binanceTotalCents,
  checkingProviders,
  cryptoInstitutions,
  cryptoTokens,
  data,
  hasBinancePortfolio,
  investmentProducts,
  timeRange
}: BuildDashboardChartDataParams): DashboardChartPoint[] {
  if (!data) {
    return [];
  }

  const firstAcquisitionDates = getFirstAcquisitionDates({
    activeTab,
    cryptoInstitutions,
    data
  });
  const filtered = timeRange === "ALL"
    ? (data.dailyData.length > 0 ? data.dailyData : data.monthlyData) as DashboardChartBucket[]
    : filterData({ monthly: data.monthlyData, daily: data.dailyData }, timeRange) as DashboardChartBucket[];

  return filtered.map((bucket) => {
    const rawMonth = bucket.date || bucket.month;
    const bucketDate = bucket.date || bucket.month || "";
    const resolveValue = createValueResolver(firstAcquisitionDates, bucketDate);

    const checkingVal = resolveValue("checking", bucket.checking);
    const investmentVal = resolveValue("investment", bucket.investment);
    const cryptoVal = resolveValue("crypto", bucket.crypto);
    const cryptoWithBinance = cryptoVal !== null
      ? cryptoVal + binanceTotalCents
      : hasBinancePortfolio
        ? binanceTotalCents
        : null;
    const rawValue = resolveValue("value", bucket[activeTab]);
    const valueWithBinance = getTabValueWithBinance({
      activeTab,
      binanceTotalCents,
      hasBinancePortfolio,
      rawValue
    });

    const entry: DashboardChartPoint = {
      month: rawMonth,
      rawMonth,
      value: valueWithBinance,
      checking: checkingVal,
      investment: investmentVal,
      crypto: cryptoWithBinance,
      heritage: getHeritageValue({
        checkingVal,
        cryptoWithBinance,
        hasBinancePortfolio,
        investmentVal,
        binanceTotalCents
      })
    };

    checkingProviders.forEach((provider) => {
      entry[provider] = resolveValue(provider, bucket.providerChecking?.[provider]);
    });

    investmentProducts.forEach((product) => {
      entry[product] = resolveValue(product, bucket.providerProducts?.[product]);
    });

    cryptoTokens.forEach((token) => {
      entry[token] = resolveValue(token, bucket.providerCryptoTokens?.[token]);
    });

    cryptoInstitutions.forEach((institution) => {
      const institutionKey = `crypto_inst_${institution}`;
      const rawSum = cryptoTokens.reduce((sum, token) => {
        const value = bucket.providerCryptoTokens?.[token];
        return sum + (isMeaningfulValue(value) ? Math.abs(value) : 0);
      }, 0);
      entry[institutionKey] = resolveValue(institutionKey, rawSum > 0 ? rawSum : undefined);
    });

    entry.binance = hasBinancePortfolio ? binanceTotalCents : null;

    return entry;
  });
}

function collectMonthlyKeys(
  data: DashboardData | null,
  field: "providerChecking" | "providerProducts" | "providerCryptoTokens"
) {
  if (!data) return [];

  const keys = new Set<string>();
  data.monthlyData.forEach((bucket) => {
    const values = bucket[field];
    if (values) {
      Object.keys(values).forEach((key) => keys.add(key));
    }
  });
  return Array.from(keys);
}

function getFirstAcquisitionDates({
  activeTab,
  cryptoInstitutions,
  data
}: {
  activeTab: AccountTab;
  cryptoInstitutions: string[];
  data: DashboardData;
}) {
  const firstAcquisitionDates = new Map<string, string>();

  data.dailyData.forEach((bucket) => {
    const bucketDate = bucket.date || bucket.month || "";

    setFirstDate(firstAcquisitionDates, "checking", bucket.checking, bucketDate);
    setFirstDate(firstAcquisitionDates, "investment", bucket.investment, bucketDate);
    setFirstDate(firstAcquisitionDates, "crypto", bucket.crypto, bucketDate);
    setFirstDate(firstAcquisitionDates, "value", bucket[activeTab], bucketDate);

    Object.entries(bucket.providerChecking ?? {}).forEach(([provider, value]) => {
      setFirstDate(firstAcquisitionDates, provider, value, bucketDate);
    });

    Object.entries(bucket.providerProducts ?? {}).forEach(([product, value]) => {
      setFirstDate(firstAcquisitionDates, product, value, bucketDate);
    });

    Object.entries(bucket.providerCryptoTokens ?? {}).forEach(([token, value]) => {
      setFirstDate(firstAcquisitionDates, token, value, bucketDate);
    });

    if (isMeaningfulValue(bucket.crypto)) {
      cryptoInstitutions.forEach((institution) => {
        const key = `crypto_inst_${institution}`;
        if (!firstAcquisitionDates.has(key)) {
          firstAcquisitionDates.set(key, bucketDate);
        }
      });
    }
  });

  return firstAcquisitionDates;
}

function setFirstDate(firstAcquisitionDates: Map<string, string>, key: string, value: number | undefined, bucketDate: string) {
  if (isMeaningfulValue(value) && !firstAcquisitionDates.has(key)) {
    firstAcquisitionDates.set(key, bucketDate);
  }
}

function createValueResolver(firstAcquisitionDates: Map<string, string>, bucketDate: string) {
  return (key: string, rawValue: number | undefined) => {
    const firstDate = firstAcquisitionDates.get(key);
    const hasBeenAcquired = firstDate && bucketDate >= firstDate;

    if (isMeaningfulValue(rawValue)) {
      return rawValue;
    }
    if (hasBeenAcquired) {
      return 0;
    }
    return null;
  };
}

function getTabValueWithBinance({
  activeTab,
  binanceTotalCents,
  hasBinancePortfolio,
  rawValue
}: {
  activeTab: AccountTab;
  binanceTotalCents: number;
  hasBinancePortfolio: boolean;
  rawValue: number | null;
}) {
  if (rawValue !== null) {
    return activeTab === "heritage" || activeTab === "crypto" ? rawValue + binanceTotalCents : rawValue;
  }

  return hasBinancePortfolio && (activeTab === "heritage" || activeTab === "crypto")
    ? binanceTotalCents
    : rawValue;
}

function getHeritageValue({
  checkingVal,
  cryptoWithBinance,
  hasBinancePortfolio,
  investmentVal,
  binanceTotalCents
}: {
  checkingVal: number | null;
  cryptoWithBinance: number | null;
  hasBinancePortfolio: boolean;
  investmentVal: number | null;
  binanceTotalCents: number;
}) {
  if (checkingVal === null && investmentVal === null && cryptoWithBinance === null) {
    return hasBinancePortfolio ? binanceTotalCents : null;
  }

  return (checkingVal || 0) + (investmentVal || 0) + (cryptoWithBinance || 0);
}

function isMeaningfulValue(value: number | undefined): value is number {
  return value !== undefined && Math.abs(value) > NON_ZERO_THRESHOLD;
}
