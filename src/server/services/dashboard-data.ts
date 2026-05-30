import {
  buildDashboardData,
  getDashboardPriceKeys,
  mapDashboardTransactions
} from "@/domain/finance/dashboard-timeseries";
import {
  dashboardRepository,
  type DashboardRepository
} from "@/server/repositories/dashboard-repository";

export type DashboardSeriesTab = "checking" | "investment" | "crypto";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
type DashboardBucket = DashboardData["monthlyData"][number] | DashboardData["dailyData"][number];

export async function getDashboardData(
  userId: string,
  repository: DashboardRepository = dashboardRepository,
  now = new Date()
) {
  const rows = await repository.listTransactions(userId);
  const transactions = mapDashboardTransactions(rows);
  const priceKeys = getDashboardPriceKeys(transactions);
  const historyPrices = await repository.listAssetHistory(priceKeys);

  return buildDashboardData({
    transactions,
    historyPrices,
    priceKeys,
    now
  });
}

function toBaseDashboardBucket<TBucket extends DashboardBucket>(bucket: TBucket) {
  return {
    ...("date" in bucket ? { date: bucket.date } : {}),
    month: bucket.month,
    checking: bucket.checking,
    investment: bucket.investment,
    crypto: bucket.crypto,
    heritage: bucket.heritage
  };
}

function toBaseMonthlyBucket(bucket: DashboardData["monthlyData"][number]) {
  return {
    month: bucket.month,
    checking: bucket.checking,
    investment: bucket.investment,
    crypto: bucket.crypto,
    heritage: bucket.heritage
  };
}

function toBaseDailyBucket(bucket: DashboardData["dailyData"][number]) {
  return {
    date: bucket.date,
    month: bucket.month,
    checking: bucket.checking,
    investment: bucket.investment,
    crypto: bucket.crypto,
    heritage: bucket.heritage
  };
}

function selectDashboardSeriesBucket<TBucket extends DashboardBucket>(
  bucket: TBucket,
  series: DashboardSeriesTab
) {
  const baseBucket = toBaseDashboardBucket(bucket);

  if (series === "checking") {
    return {
      ...baseBucket,
      providerChecking: bucket.providerChecking
    };
  }

  if (series === "investment") {
    return {
      ...baseBucket,
      providerProducts: bucket.providerProducts
    };
  }

  return {
    ...baseBucket,
    providerCryptoTokens: bucket.providerCryptoTokens
  };
}

export function stripDashboardSeriesDetails(data: DashboardData): DashboardData {
  return {
    accountTotals: data.accountTotals,
    monthlyData: data.monthlyData.map(toBaseMonthlyBucket),
    dailyData: data.dailyData.map(toBaseDailyBucket),
    providerSummaries: data.providerSummaries
  };
}

export function selectDashboardSeriesData(data: DashboardData, series: DashboardSeriesTab) {
  return {
    series,
    monthlyData: data.monthlyData.map((bucket) => selectDashboardSeriesBucket(bucket, series)),
    dailyData: data.dailyData.map((bucket) => selectDashboardSeriesBucket(bucket, series))
  };
}

export async function getDashboardInitialData(
  userId: string,
  repository: DashboardRepository = dashboardRepository,
  now = new Date()
) {
  const data = await getDashboardData(userId, repository, now);
  return stripDashboardSeriesDetails(data);
}

export async function getDashboardSeriesData(
  userId: string,
  series: DashboardSeriesTab,
  repository: DashboardRepository = dashboardRepository,
  now = new Date()
) {
  const data = await getDashboardData(userId, repository, now);
  return selectDashboardSeriesData(data, series);
}
