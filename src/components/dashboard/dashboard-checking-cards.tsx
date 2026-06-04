import { DashboardCardShell, DashboardMetricRow } from "./dashboard-card-parts";
import type { DashboardChartPoint } from "./dashboard-chart-types";
import { getCheckingMetrics } from "./dashboard-checking-card-metrics";
import { formatEuroCents, formatProviderLabel } from "./formatters";
import type { DashboardData, TimeRange } from "./types";

type DashboardCheckingCardsProps = {
  currentPoint: DashboardChartPoint | null;
  data: DashboardData;
  timeRange: TimeRange;
  valuesKnown: boolean;
};

function getPointValue(point: DashboardChartPoint | null, key: string, valuesKnown: boolean) {
  if (!valuesKnown || !point) {
    return null;
  }

  const value = point[key];
  return typeof value === "number" ? value : null;
}

export function DashboardCheckingCards({
  currentPoint,
  data,
  timeRange,
  valuesKnown
}: DashboardCheckingCardsProps) {
  const checkingProviders = data.providerSummaries.filter((provider) => provider.checking.total !== 0);

  if (checkingProviders.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-5">
      {checkingProviders.map((provider) => {
        const metrics = getCheckingMetrics(provider, data, timeRange);

        return (
          <DashboardCardShell
            key={`checking-${provider.sourceInstitution}`}
            title={formatProviderLabel(provider.sourceInstitution)}
            value={formatEuroCents(
              getPointValue(currentPoint, provider.sourceInstitution, valuesKnown) ?? provider.checking.total
            )}
          >
            <div className="space-y-4">
              <div>
                <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
                <div className="space-y-1.5 text-sm">
                  <DashboardMetricRow label="Income" value={formatEuroCents(metrics.providerIncomePeriod)} />
                  <DashboardMetricRow label="Spending" value={formatEuroCents(metrics.providerExpensesPeriod)} />
                  <DashboardMetricRow label="Average" value={formatEuroCents(metrics.providerAverage)} />
                  <DashboardMetricRow label="Interest" value={formatEuroCents(metrics.providerInterestPeriod)} />
                  {metrics.providerCashbackPeriod !== 0 && (
                    <DashboardMetricRow label="Cashback" value={formatEuroCents(metrics.providerCashbackPeriod)} />
                  )}
                  {provider.sourceInstitution === "trade_republic" && (
                    <DashboardMetricRow label="Tax" value={formatEuroCents(metrics.providerTaxPeriod)} />
                  )}
                </div>
              </div>
            </div>
          </DashboardCardShell>
        );
      })}
    </div>
  );
}
