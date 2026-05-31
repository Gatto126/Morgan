import {
  buildDashboardData,
  getDashboardPriceKeys,
  mapDashboardTransactions
} from "@/domain/finance/dashboard-timeseries";
import {
  dashboardRepository,
  type DashboardRepository
} from "@/server/repositories/dashboard-repository";
import {
  measurePerformanceStep,
  type PerformanceTrace
} from "@/server/logging/performance";

export async function getDashboardData(
  userId: string,
  repository: DashboardRepository = dashboardRepository,
  now = new Date(),
  trace?: PerformanceTrace
) {
  const rows = await measurePerformanceStep(
    trace,
    "dashboard.repository.listTransactions",
    () => repository.listTransactions(userId),
    (result) => ({
      checkingRows: result.checkingTxs.length,
      cryptoRows: result.cryptoTxs.length,
      investmentRows: result.investmentTxs.length
    })
  );
  const transactions = await measurePerformanceStep(
    trace,
    "dashboard.builder.mapTransactions",
    async () => mapDashboardTransactions(rows),
    (result) => ({
      checkingRows: result.filter((transaction) => transaction.accountType === "checking").length,
      cryptoRows: result.filter((transaction) => transaction.accountType === "crypto").length,
      investmentRows: result.filter((transaction) => transaction.accountType === "investment").length
    })
  );
  const priceKeys = getDashboardPriceKeys(transactions);
  const historyPrices = await measurePerformanceStep(
    trace,
    "dashboard.repository.listAssetHistory",
    () => repository.listAssetHistory(priceKeys, {
      fromDate: transactions[0]?.bookingDate.toISOString().split("T")[0]
    }),
    (result) => ({
      priceKeys: priceKeys.length,
      rows: result.length
    })
  );

  return measurePerformanceStep(
    trace,
    "dashboard.builder.buildDashboardData",
    async () => buildDashboardData({
      transactions,
      historyPrices,
      priceKeys,
      now
    }),
    (result) => ({
      dailyPoints: result.dailyData.length,
      monthlyPoints: result.monthlyData.length,
      providers: result.providerSummaries.length
    })
  );
}
