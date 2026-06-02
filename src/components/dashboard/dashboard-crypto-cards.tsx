import type { Dispatch, RefObject, SetStateAction } from "react";
import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";
import type { CurrentValuationSnapshot } from "@/components/finance-shell/current-valuations-store";

import { DashboardBinanceCard } from "./dashboard-binance-card";
import { getBinanceCardAssetValueCentsByKey } from "./dashboard-binance-card-total";
import {
  DashboardAssetHeader,
  DashboardCardShell,
  DashboardMetricRow
} from "./dashboard-card-parts";
import type { DashboardChartPoint } from "./dashboard-chart-types";
import { formatEuroCents, formatProviderLabel } from "./formatters";
import type { BinanceBalanceRow, ProviderSummary } from "./types";

type DashboardCryptoCardsProps = {
  providers: ProviderSummary[];
  currentPoint: DashboardChartPoint | null;
  currentValuationSnapshot?: CurrentValuationSnapshot | null;
  valuesKnown: boolean;
  livePrices: Record<string, number | null>;
  binanceBalances: BinanceBalanceRow[];
  isBinanceSyncing: boolean;
  filterSmallBinance: boolean;
  setFilterSmallBinance: Dispatch<SetStateAction<boolean>>;
  binanceListRef: RefObject<HTMLDivElement | null>;
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

function getValuationTokenValue(
  snapshot: CurrentValuationSnapshot | null | undefined,
  providerId: string,
  tokenName: string
) {
  const asset = Object.values(snapshot?.assets ?? {}).find((item) =>
    item.category === "crypto" &&
    item.chartKey === tokenName &&
    Object.hasOwn(item.providerValues, providerId)
  );

  return asset ? asset.providerValues[providerId]?.cents ?? null : undefined;
}

export function DashboardCryptoCards({
  providers,
  currentPoint,
  currentValuationSnapshot,
  valuesKnown,
  livePrices,
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
        const providerHasLivePrice = provider.cryptoTokens.some((token) => {
          const tokenSymbol = normalizeCryptoSymbol(token.tokenSymbol);
          return tokenSymbol ? livePrices[tokenSymbol] != null : false;
        });

        return (
          <DashboardCardShell
            animateValueChanges={providerHasLivePrice}
            key={`crypto-${provider.sourceInstitution}`}
            title={formatProviderLabel(provider.sourceInstitution)}
            value={formatCurrentValue(
              getPointValue(currentPoint, `crypto_inst_${provider.sourceInstitution}`, valuesKnown)
            )}
          >
            <div className="space-y-4">
              {provider.cryptoTokens.map((token) => {
              const tokenSymbol = normalizeCryptoSymbol(token.tokenSymbol);
              const price = tokenSymbol ? livePrices[tokenSymbol] : null;
              const valuationTokenValue = getValuationTokenValue(
                currentValuationSnapshot,
                provider.sourceInstitution,
                token.tokenName
              );
              const currentValueCents = valuationTokenValue !== undefined
                ? valuationTokenValue
                : getPointValue(currentPoint, token.tokenName, valuesKnown);
              const liveTokenReady = currentValueCents !== null;
              const unitPriceCents = getUnitPriceCentsFromCurrentValue(
                currentValueCents,
                token.investedValue,
                token.quantity
              );

              return (
                <div key={token.tokenName}>
                  <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
                  <DashboardAssetHeader
                    align="center"
                    animateValueChanges={price != null}
                    name={token.tokenName}
                    value={liveTokenReady ? formatEuroCents(unitPriceCents) : "--"}
                  />
                  <div className="space-y-1.5 text-sm">
                    <DashboardMetricRow
                      label="Quantity"
                      value={token.quantity.toLocaleString("it-IT", { maximumFractionDigits: 8 })}
                    />
                    <DashboardMetricRow label="Invested Value" value={formatEuroCents(token.investedValue)} />
                    <DashboardMetricRow
                      animateValueChanges={price != null || currentValueCents !== null}
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
