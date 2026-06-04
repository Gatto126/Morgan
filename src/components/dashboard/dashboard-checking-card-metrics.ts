import { filterData } from "./formatters";
import type { DashboardData, ProviderSummary, TimeRange } from "./types";

export function getCheckingMetrics(provider: ProviderSummary, data: DashboardData, timeRange: TimeRange) {
  const filteredTimeData = filterData({ monthly: data.monthlyData, daily: data.dailyData }, timeRange);
  const providerAverage = filteredTimeData.length > 0
    ? Math.round(filteredTimeData.reduce((sum, bucket) => sum + (bucket.providerChecking?.[provider.sourceInstitution] || 0), 0) / filteredTimeData.length)
    : 0;
  const providerIncomePeriod = timeRange === "ALL"
    ? provider.checking.income
    : filteredTimeData.reduce((sum, bucket) => sum + (bucket.providerIncome?.[provider.sourceInstitution] || 0), 0);
  const providerExpensesPeriod = timeRange === "ALL"
    ? provider.checking.expenses
    : filteredTimeData.reduce((sum, bucket) => sum + (bucket.providerExpenses?.[provider.sourceInstitution] || 0), 0);
  const providerInterestPeriod = timeRange === "ALL"
    ? provider.checking.interest
    : filteredTimeData.reduce((sum, bucket) => sum + (bucket.providerInterest?.[provider.sourceInstitution] || 0), 0);
  const providerCashbackPeriod = timeRange === "ALL"
    ? provider.checking.cashback
    : filteredTimeData.reduce((sum, bucket) => sum + (bucket.providerCashback?.[provider.sourceInstitution] || 0), 0);
  const providerTaxPeriod = timeRange === "ALL"
    ? provider.checking.tax
    : filteredTimeData.reduce((sum, bucket) => sum + (bucket.providerTax?.[provider.sourceInstitution] || 0), 0);

  return {
    providerAverage,
    providerIncomePeriod,
    providerExpensesPeriod,
    providerInterestPeriod,
    providerCashbackPeriod,
    providerTaxPeriod
  };
}
