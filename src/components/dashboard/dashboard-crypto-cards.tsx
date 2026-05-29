import type { Dispatch, RefObject, SetStateAction } from "react";

import { DashboardBinanceCard } from "./dashboard-binance-card";
import {
  DashboardAssetHeader,
  DashboardCardShell,
  DashboardMetricRow
} from "./dashboard-card-parts";
import { formatEuroCents, formatProviderLabel } from "./formatters";
import type { BinanceBalanceRow, ProviderSummary } from "./types";

type DashboardCryptoCardsProps = {
  providers: ProviderSummary[];
  livePrices: Record<string, number | null>;
  binanceBalances: BinanceBalanceRow[];
  isBinanceSyncing: boolean;
  filterSmallBinance: boolean;
  setFilterSmallBinance: Dispatch<SetStateAction<boolean>>;
  binanceListRef: RefObject<HTMLDivElement | null>;
  getProviderCryptoLiveTotal: (provider: ProviderSummary) => number;
};

export function DashboardCryptoCards({
  providers,
  livePrices,
  binanceBalances,
  isBinanceSyncing,
  filterSmallBinance,
  setFilterSmallBinance,
  binanceListRef,
  getProviderCryptoLiveTotal
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
    <div className="flex flex-col gap-3">
      {providersWithTokens.map((provider) => (
        <DashboardCardShell
          key={`crypto-${provider.sourceInstitution}`}
          title={formatProviderLabel(provider.sourceInstitution)}
          value={formatEuroCents(getProviderCryptoLiveTotal(provider))}
        >
          <div className="space-y-4">
            {provider.cryptoTokens.map((token) => {
              const price = token.tokenSymbol ? livePrices[token.tokenSymbol] : null;
              const currentValueCents = price == null ? null : Math.round(token.quantity * price * 100);

              return (
                <div key={token.tokenName}>
                  <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
                  <DashboardAssetHeader
                    align="center"
                    name={token.tokenName}
                    value={price != null ? formatEuroCents(Math.round(price * 100)) : "-"}
                  />
                  <div className="space-y-1.5 text-sm">
                    <DashboardMetricRow
                      label="Quantity"
                      value={token.quantity.toLocaleString("it-IT", { maximumFractionDigits: 8 })}
                    />
                    <DashboardMetricRow label="Invested Value" value={formatEuroCents(token.investedValue)} />
                    <DashboardMetricRow
                      label="Current Value"
                      value={formatEuroCents(currentValueCents ?? 0)}
                      valueClassName={currentValueCents == null
                        ? "text-[color:var(--text-dim)] underline decoration-dotted decoration-[color:var(--text-dim)]"
                        : "text-[color:var(--text-main)]"}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardCardShell>
      ))}

      <DashboardBinanceCard
        balances={binanceBalances}
        filterSmallBalances={filterSmallBinance}
        isSyncing={isBinanceSyncing}
        listRef={binanceListRef}
        setFilterSmallBalances={setFilterSmallBinance}
      />
    </div>
  );
}
