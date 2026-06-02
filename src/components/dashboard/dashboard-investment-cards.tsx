import {
  DashboardAssetHeader,
  DashboardCardShell,
  DashboardMetricRow
} from "./dashboard-card-parts";
import { getCurrentValuationAssetValueCents } from "../finance-shell/current-valuation-assets";
import type { CurrentValuationSnapshot } from "../finance-shell/current-valuations-store";
import type { DashboardChartPoint } from "./dashboard-chart-types";
import { formatEuroCents, formatProviderLabel } from "./formatters";
import type { ProviderSummary } from "./types";

type DashboardInvestmentCardsProps = {
  providers: ProviderSummary[];
  currentPoint: DashboardChartPoint | null;
  currentValuationSnapshot?: CurrentValuationSnapshot | null;
  valuesKnown: boolean;
  livePrices: Record<string, number | null>;
};

function getFallbackUnitPriceCents(investedValue: number, quantity: number) {
  return Math.abs(quantity) > 0.000001 ? Math.round(investedValue / quantity) : investedValue;
}

function getPointValue(point: DashboardChartPoint | null, key: string, valuesKnown: boolean) {
  if (!valuesKnown || !point) {
    return null;
  }

  const value = point[key];
  return typeof value === "number" ? value : null;
}

function getUnitPriceCentsFromCurrentValue(currentValueCents: number | null, investedValue: number, quantity: number) {
  return currentValueCents !== null && Math.abs(quantity) > 0.000001
    ? Math.round(currentValueCents / quantity)
    : getFallbackUnitPriceCents(investedValue, quantity);
}

export function DashboardInvestmentCards({
  providers,
  currentPoint,
  currentValuationSnapshot,
  valuesKnown,
  livePrices
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
    <div className="flex flex-col gap-5">
      {providersWithProducts.map((provider) => {
        const providerHasLivePrice = provider.investmentProducts.some((product) =>
          product.isin ? livePrices[product.isin] != null : false
        );

        return (
          <DashboardCardShell
            animateValueChanges={providerHasLivePrice}
            key={`investment-${provider.sourceInstitution}`}
            title={formatProviderLabel(provider.sourceInstitution)}
            value={formatCurrentValue(
              getPointValue(currentPoint, `investment_inst_${provider.sourceInstitution}`, valuesKnown)
            )}
          >
            <div className="space-y-4">
              {provider.investmentProducts.map((product) => {
              const price = product.isin ? livePrices[product.isin] : null;
              const valuationProductValue = getCurrentValuationAssetValueCents(
                currentValuationSnapshot,
                {
                  category: "investment",
                  chartKey: product.productName,
                  priceKey: product.isin,
                  providerId: provider.sourceInstitution
                }
              );
              const currentValueCents = currentValuationSnapshot
                ? valuationProductValue ?? null
                : getPointValue(currentPoint, product.productName, valuesKnown);
              const liveProductReady = currentValueCents !== null;
              const unitPriceCents = getUnitPriceCentsFromCurrentValue(
                currentValueCents,
                product.investedValue,
                product.quantity
              );

              return (
                <div key={product.productName}>
                  <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
                  <DashboardAssetHeader
                    animateValueChanges={price != null}
                    name={product.productName}
                    value={liveProductReady ? formatEuroCents(unitPriceCents) : "--"}
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
                      animateValueChanges={price != null || currentValueCents !== null}
                      label="Current Value"
                      value={currentValueCents !== null ? formatEuroCents(currentValueCents) : "--"}
                      valueClassName={currentValueCents === null
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
        );
      })}
    </div>
  );
}

function formatCurrentValue(value: number | null) {
  return value === null ? "--" : formatEuroCents(value);
}
