import type { Dispatch, RefObject, SetStateAction } from "react";
import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";
import {
  getCurrentValuationAssetValueCents,
  getCurrentValuationProviderValueCents
} from "@/components/finance-shell/current-valuation-assets";
import type { CurrentValuationSnapshot } from "@/components/finance-shell/current-valuations-store";

import { DashboardBinanceCard } from "./dashboard-binance-card";
import { getBinanceCardAssetValueCentsByKey } from "./dashboard-binance-card-total";
import {
  DashboardAssetHeader,
  DashboardCardShell,
  DashboardMetricRow
} from "./dashboard-card-parts";
import { formatEuroCents, formatProviderLabel } from "./formatters";
import type { BinanceBalanceRow, ProviderSummary } from "./types";

type DashboardCryptoCardsProps = {
  providers: ProviderSummary[];
  currentValuationSnapshot?: CurrentValuationSnapshot | null;
  binanceBalances: BinanceBalanceRow[];
  isBinanceSyncing: boolean;
  filterSmallBinance: boolean;
  setFilterSmallBinance: Dispatch<SetStateAction<boolean>>;
  binanceListRef: RefObject<HTMLDivElement | null>;
};

function getUnitPriceCentsFromCurrentValue(currentValueCents: number | null, quantity: number) {
  return currentValueCents !== null && Math.abs(quantity) > 0.000001
    ? Math.round(currentValueCents / quantity)
    : null;
}

export function DashboardCryptoCards({
  providers,
  currentValuationSnapshot,
  binanceBalances,
  isBinanceSyncing,
  filterSmallBinance,
  setFilterSmallBinance,
  binanceListRef
}: DashboardCryptoCardsProps) {
  const providersWithTokens = providers
    .map((provider) => ({
      ...provider,
      cryptoTokens: provider.cryptoTokens.filter((token) => Math.abs(token.quantity) > 0.000001)
    }))
    .filter((provider) => provider.cryptoTokens.length > 0);

  if (providersWithTokens.length === 0 && binanceBalances.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-5">
      {providersWithTokens.map((provider) => {
        const valuationProviderValue = getCurrentValuationProviderValueCents(
          currentValuationSnapshot,
          {
            category: "crypto",
            providerId: provider.sourceInstitution
          }
        );
        const providerCurrentValue = currentValuationSnapshot
          ? valuationProviderValue ?? null
          : null;

        return (
          <DashboardCardShell
            animateValueChanges={typeof valuationProviderValue === "number"}
            key={`crypto-${provider.sourceInstitution}`}
            title={formatProviderLabel(provider.sourceInstitution)}
            value={formatCurrentValue(providerCurrentValue)}
          >
            <div className="space-y-4">
              {provider.cryptoTokens.map((token) => {
              const tokenSymbol = normalizeCryptoSymbol(token.tokenSymbol);
              const valuationTokenValue = getCurrentValuationAssetValueCents(
                currentValuationSnapshot,
                {
                  category: "crypto",
                  chartKey: token.tokenName,
                  priceKey: tokenSymbol,
                  providerId: provider.sourceInstitution
                }
              );
              const currentValueCents = currentValuationSnapshot
                ? valuationTokenValue ?? null
                : null;
              const unitPriceCents = getUnitPriceCentsFromCurrentValue(
                currentValueCents,
                token.quantity
              );

              return (
                <div key={token.tokenName}>
                  <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
                  <DashboardAssetHeader
                    align="center"
                    animateValueChanges={typeof valuationTokenValue === "number"}
                    name={token.tokenName}
                    value={unitPriceCents !== null ? formatEuroCents(unitPriceCents) : "--"}
                  />
                  <div className="space-y-1.5 text-sm">
                    <DashboardMetricRow
                      label="Quantity"
                      value={token.quantity.toLocaleString("it-IT", { maximumFractionDigits: 8 })}
                    />
                    <DashboardMetricRow label="Invested Value" value={formatEuroCents(token.investedValue)} />
                    <DashboardMetricRow
                      animateValueChanges={currentValueCents !== null}
                      label="Current Value"
                      value={currentValueCents !== null ? formatEuroCents(currentValueCents) : "--"}
                      valueClassName={currentValueCents === null
                        ? "text-[color:var(--text-dim)] underline decoration-dotted decoration-[color:var(--text-dim)]"
                        : "text-[color:var(--text-main)]"}
                    />
                  </div>
                </div>
              );
              })}
            </div>
          </DashboardCardShell>
        );
      })}

      <DashboardBinanceCard
        balances={binanceBalances}
        currentAssetValueCentsByKey={getBinanceCardAssetValueCentsByKey(currentValuationSnapshot)}
        currentValueCents={currentValuationSnapshot?.totals.binance.cents}
        filterSmallBalances={filterSmallBinance}
        isSyncing={isBinanceSyncing}
        listRef={binanceListRef}
        setFilterSmallBalances={setFilterSmallBinance}
      />
    </div>
  );
}

function formatCurrentValue(value: number | null) {
  return value === null ? "--" : formatEuroCents(value);
}
