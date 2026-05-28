import {
  buildDashboardData,
  getDashboardPriceKeys,
  mapDashboardTransactions
} from "@/domain/finance/dashboard-timeseries";
import {
  dashboardRepository,
  type DashboardRepository
} from "@/server/repositories/dashboard-repository";

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
