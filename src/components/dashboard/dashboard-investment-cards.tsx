import {
  DashboardAssetHeader,
  DashboardCardShell,
  DashboardMetricRow
} from "./dashboard-card-parts";
import { formatEuroCents, formatProviderLabel } from "./formatters";
import type { ProviderSummary } from "./types";

type DashboardInvestmentCardsProps = {
  providers: ProviderSummary[];
  livePrices: Record<string, number | null>;
  getProviderInvestmentLiveTotal: (provider: ProviderSummary) => number;
};

export function DashboardInvestmentCards({
  providers,
  livePrices,
  getProviderInvestmentLiveTotal
}: DashboardInvestmentCardsProps) {
  const providersWithProducts = providers
    .map((provider) => ({
      ...provider,
      investmentProducts: provider.investmentProducts.filter((product) => Math.abs(product.quantity) > 0.000001)
    }))
    .filter((provider) => provider.investmentProducts.length > 0);

  if (providersWithProducts.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {providersWithProducts.map((provider) => (
        <DashboardCardShell
          key={`investment-${provider.sourceInstitution}`}
          title={formatProviderLabel(provider.sourceInstitution)}
          value={formatEuroCents(getProviderInvestmentLiveTotal(provider))}
        >
          <div className="space-y-4">
            {provider.investmentProducts.map((product) => {
              const price = product.isin ? livePrices[product.isin] : null;
              const currentValueCents = price == null ? null : Math.round(product.quantity * price * 100);

              return (
                <div key={product.productName}>
                  <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
                  <DashboardAssetHeader
                    name={product.productName}
                    value={price != null ? formatEuroCents(Math.round(price * 100)) : "-"}
                  />

                  <div className="space-y-1.5 text-sm">
                    {product.isin && (
                      <DashboardMetricRow label="ISIN" value={product.isin} />
                    )}
                    <DashboardMetricRow
                      label="Quantity"
                      value={product.quantity.toLocaleString("it-IT", { maximumFractionDigits: 6 })}
                    />
                    <DashboardMetricRow label="Invested Value" value={formatEuroCents(product.investedValue)} />
                    <DashboardMetricRow
                      label="Current Value"
                      value={formatEuroCents(currentValueCents ?? 0)}
                      valueClassName={currentValueCents == null
                        ? "text-[color:var(--text-dim)] underline decoration-dotted decoration-[color:var(--text-dim)]"
                        : "text-[color:var(--text-main)]"}
                    />
                    {product.cashback !== 0 && (
                      <DashboardMetricRow label="Cashback" value={formatEuroCents(product.cashback)} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardCardShell>
      ))}
    </div>
  );
}
