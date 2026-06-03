import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo } from "react";
import type { Dispatch, RefObject, SetStateAction, UIEvent } from "react";

import { CurrentValueSkeleton } from "@/components/finance-shell/current-value-skeleton";
import {
  getCurrentValuationAssetValueCents,
  getCurrentValuationProviderValueCents
} from "@/components/finance-shell/current-valuation-assets";
import { SlotValue } from "@/components/finance-shell/slot-value";
import type { CurrentValuationSnapshot } from "@/components/finance-shell/current-valuations-store";
import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";
import { DashboardBinanceCard } from "@/components/dashboard/dashboard-binance-card";
import { getBinanceCardAssetValueCentsByKey } from "@/components/dashboard/dashboard-binance-card-total";
import type { BinanceBalanceRow } from "@/components/dashboard/types";
import { scheduleIdleTask, useDeferredTransactionRows } from "@/hooks/use-deferred-transaction-rows";
import { prefetchTransactionRows, useTransactionRows } from "@/hooks/use-transaction-rows";
import { cn } from "@/shared/utils";

import { formatEuroCents, formatProviderLabel } from "./formatters";
import { getPortfolioPointValue } from "./portfolio-current-point";
import type { PortfolioDashboardConfig, PortfolioProviderSummary, PortfolioTransaction } from "./types";
import type { ChartPoint } from "@/types/chart";

type PortfolioProviderCardsProps = {
  portalNode: HTMLElement | null;
  providers: PortfolioProviderSummary[];
  config: Pick<PortfolioDashboardConfig, "identifierLabel" | "priceQueryParam" | "showCashback" | "transactionFilter">;
  currentPoint: ChartPoint | null;
  currentValuationSnapshot?: CurrentValuationSnapshot | null;
  valuesKnown: boolean;
  livePrices: Record<string, number | null>;
  isActive: boolean;
  shouldPreloadRows?: boolean;
  transactionRowsEndpoint: string;
  userId: string;
  binanceBalances?: BinanceBalanceRow[];
  isBinanceSyncing?: boolean;
  filterSmallBinance?: boolean;
  setFilterSmallBinance?: Dispatch<SetStateAction<boolean>>;
  binanceListRef?: RefObject<HTMLDivElement | null>;
};

const INITIAL_TRANSACTION_ROWS = 20;
const NEXT_TRANSACTION_ROWS = 10;
const LOAD_MORE_SCROLL_THRESHOLD_PX = 160;

function CurrentValueDisplay({
  animateChanges = false,
  value
}: {
  animateChanges?: boolean;
  value: string;
}) {
  return value === "--" || value.trim() === ""
    ? <CurrentValueSkeleton className="h-4 w-20" />
    : <SlotValue animateChanges={animateChanges} value={value} />;
}

function getFallbackUnitPriceCents(investedValue: number, quantity: number) {
  return Math.abs(quantity) > 0.000001 ? Math.round(investedValue / quantity) : investedValue;
}

function getProductPriceKey(
  product: PortfolioProviderSummary["products"][number],
  config: Pick<PortfolioDashboardConfig, "priceQueryParam">
) {
  return config.priceQueryParam === "cryptos" ? normalizeCryptoSymbol(product.isin) : product.isin;
}

function getProviderValuationCategory(config: Pick<PortfolioDashboardConfig, "priceQueryParam">) {
  return config.priceQueryParam === "cryptos" ? "crypto" : "investment";
}

function getUnitPriceCentsFromCurrentValue(
  currentValueCents: number | null | undefined,
  investedValue: number,
  quantity: number
) {
  return typeof currentValueCents === "number" && Math.abs(quantity) > 0.000001
    ? Math.round(currentValueCents / quantity)
    : getFallbackUnitPriceCents(investedValue, quantity);
}

export function PortfolioProviderCards({
  portalNode,
  providers,
  config,
  currentPoint,
  currentValuationSnapshot,
  valuesKnown,
  livePrices,
  isActive,
  shouldPreloadRows = isActive,
  transactionRowsEndpoint,
  userId,
  binanceBalances = [],
  isBinanceSyncing = false,
  filterSmallBinance = true,
  setFilterSmallBinance,
  binanceListRef
}: PortfolioProviderCardsProps) {
  useEffect(() => {
    if (!shouldPreloadRows || providers.length === 0) {
      return;
    }

    const cancelIdleTask = scheduleIdleTask(() => {
      for (const provider of providers.slice(0, 2)) {
        void prefetchTransactionRows<PortfolioTransaction>({
          endpoint: transactionRowsEndpoint,
          initialPageSize: INITIAL_TRANSACTION_ROWS,
          pageSize: NEXT_TRANSACTION_ROWS,
          sourceInstitution: provider.sourceInstitution,
          totalCount: provider.transactionCount,
          userId
        });
      }
    }, 2_200);

    return cancelIdleTask;
  }, [providers, shouldPreloadRows, transactionRowsEndpoint, userId]);

  if (!portalNode) return null;

  return createPortal(
    <div className={cn("flex flex-col gap-5 w-full pb-6 lg:pb-0", !isActive && "absolute pointer-events-none opacity-0 invisible")}>
      {providers.map((provider) => {
        const providerHasLivePrice = provider.products.some((product) => {
          const priceKey = getProductPriceKey(product, config);
          return priceKey ? livePrices[priceKey] != null : false;
        });
        const providerValuationCategory = getProviderValuationCategory(config);
        const valuationProviderValue = getCurrentValuationProviderValueCents(
          currentValuationSnapshot,
          {
            category: providerValuationCategory,
            providerId: provider.sourceInstitution
          }
        );
        const providerCurrentValue = currentValuationSnapshot
          ? valuationProviderValue ?? null
          : getPortfolioPointValue(currentPoint, provider.sourceInstitution);

        return (
          <div key={provider.sourceInstitution} className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
            <div className="flex flex-col rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-canvas)] p-4 h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-main)]">
                  {formatProviderLabel(provider.sourceInstitution)}
                </span>
                <span className="text-sm font-bold text-[color:var(--text-main)]">
                  <CurrentValueDisplay
                    animateChanges={providerHasLivePrice || typeof valuationProviderValue === "number"}
                    value={formatPointValue(providerCurrentValue, valuesKnown || !!currentValuationSnapshot)}
                  />
                </span>
              </div>

              <div className="mt-4 space-y-4 max-h-[400px] overflow-y-auto hide-scrollbar pr-1">
                {provider.products.filter(product => Math.abs(product.quantity) > 0.000001).map((product) => (
                  <div key={product.productName}>
                    <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
                    <div className="mb-1.5 flex items-start justify-between min-w-0">
                      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-main)] break-words w-0 flex-1 pr-3">
                        {product.productName}
                      </span>
                      <span className="text-xs font-bold text-[color:var(--text-main)] flex-shrink-0 pt-[1px]">
                        {(() => {
                          const priceKey = getProductPriceKey(product, config);
                          const price = priceKey ? livePrices[priceKey] : null;
                          const valuationProductValue = getCurrentValuationAssetValueCents(
                            currentValuationSnapshot,
                            {
                              category: config.priceQueryParam === "cryptos" ? "crypto" : "investment",
                              chartKey: product.productName,
                              priceKey,
                              providerId: provider.sourceInstitution
                            }
                          );
                          const hasValuationProductValue = valuationProductValue !== undefined;
                          const productReady = hasValuationProductValue
                            ? valuationProductValue !== null
                            : !currentValuationSnapshot && (!priceKey || price != null || valuesKnown);
                          const valuationUnitPriceCents = getUnitPriceCentsFromCurrentValue(
                            valuationProductValue,
                            product.investedValue,
                            product.quantity
                          );
                          const priceCents = hasValuationProductValue
                            ? valuationUnitPriceCents
                            : !currentValuationSnapshot && price != null
                              ? Math.round(price * 100)
                              : valuationUnitPriceCents;

                          return (
                            <CurrentValueDisplay
                              animateChanges={price != null && !hasValuationProductValue}
                              value={productReady ? formatEuroCents(priceCents) : "--"}
                            />
                          );
                        })()}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="pl-3 text-[color:var(--text-dim)] font-medium">{config.identifierLabel}</span>
                        <span className="font-semibold text-[color:var(--text-main)]">
                          {product.isin}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="pl-3 text-[color:var(--text-dim)] font-medium">Quantity</span>
                        <span className="font-semibold text-[color:var(--text-main)]">
                          <SlotValue value={product.quantity.toLocaleString("it-IT", { maximumFractionDigits: 6 })} />
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="pl-3 text-[color:var(--text-dim)] font-medium">Invested Value</span>
                        <span className="font-semibold text-[color:var(--text-main)]">
                          <SlotValue value={formatEuroCents(product.investedValue)} />
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="pl-3 text-[color:var(--text-dim)] font-medium">Current Value</span>
                        {(() => {
                          const priceKey = getProductPriceKey(product, config);
                          const price = priceKey ? livePrices[priceKey] : null;
                          const valuationProductValue = getCurrentValuationAssetValueCents(
                            currentValuationSnapshot,
                            {
                              category: config.priceQueryParam === "cryptos" ? "crypto" : "investment",
                              chartKey: product.productName,
                              priceKey,
                              providerId: provider.sourceInstitution
                            }
                          );
                          if (valuationProductValue === null) {
                            return (
                              <span className="font-semibold text-[color:var(--text-dim)]">
                                <CurrentValueDisplay value="--" />
                              </span>
                            );
                          }
                          if (currentValuationSnapshot && valuationProductValue === undefined) {
                            return (
                              <span className="font-semibold text-[color:var(--text-dim)]">
                                <CurrentValueDisplay value="--" />
                              </span>
                            );
                          }
                          if (typeof valuationProductValue === "number") {
                            return (
                              <span className="font-semibold text-[color:var(--text-main)]">
                                <SlotValue animateChanges value={formatEuroCents(valuationProductValue)} />
                              </span>
                            );
                          }
                          if (price == null && !valuesKnown && priceKey) {
                            return (
                              <span className="font-semibold text-[color:var(--text-dim)]">
                                <CurrentValueDisplay value="--" />
                              </span>
                            );
                          }
                          if (price == null) {
                            return (
                              <span className="font-semibold text-[color:var(--text-dim)] underline decoration-dotted decoration-[color:var(--text-dim)]">
                                <SlotValue value={formatEuroCents(product.investedValue)} />
                              </span>
                            );
                          }
                          const currentValueCents = Math.round(product.quantity * price * 100);
                          return (
                            <span className="font-semibold text-[color:var(--text-main)]">
                              <SlotValue animateChanges value={formatEuroCents(currentValueCents)} />
                            </span>
                          );
                        })()}
                      </div>
                      {config.showCashback && product.cashback !== 0 && (
                        <div className="flex justify-between">
                          <span className="pl-3 text-[color:var(--text-dim)] font-medium">Cashback</span>
                          <span className="font-semibold text-[color:var(--text-main)]">
                            <SlotValue value={formatEuroCents(product.cashback)} />
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col min-h-[280px] lg:h-[400px] flex-1 overflow-hidden rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[#1f1f1f]">
              <PortfolioTransactionTable
                endpoint={transactionRowsEndpoint}
                isActive={isActive}
                shouldPreloadRows={shouldPreloadRows}
                provider={provider}
                transactionFilter={config.transactionFilter}
                userId={userId}
              />
            </div>
          </div>
        );
      })}

      {config.priceQueryParam === "cryptos" && binanceBalances.length > 0 && setFilterSmallBinance && binanceListRef ? (
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
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
      ) : null}
    </div>,
    portalNode
  );
}

function formatPointValue(value: number | null, valuesKnown: boolean) {
  return valuesKnown && value !== null ? formatEuroCents(value) : "--";
}

function PortfolioTransactionTable({
  endpoint,
  isActive,
  shouldPreloadRows,
  provider,
  userId,
  transactionFilter
}: {
  endpoint: string;
  isActive: boolean;
  shouldPreloadRows: boolean;
  provider: PortfolioProviderSummary;
  userId: string;
  transactionFilter: (transaction: PortfolioTransaction) => boolean;
}) {
  const {
    rowsContainerRef,
    shouldLoadRows
  } = useDeferredTransactionRows(isActive, provider.transactionCount, {
    preload: shouldPreloadRows
  });
  const {
    error,
    hasMore,
    loading,
    loadNext,
    transactions
  } = useTransactionRows<PortfolioTransaction>({
    endpoint,
    initialPageSize: INITIAL_TRANSACTION_ROWS,
    isActive: isActive || shouldPreloadRows,
    pageSize: NEXT_TRANSACTION_ROWS,
    shouldLoad: shouldLoadRows,
    sourceInstitution: provider.sourceInstitution,
    totalCount: provider.transactionCount,
    userId
  });
  const filteredTransactions = useMemo(
    () => transactions.filter(transactionFilter),
    [transactionFilter, transactions]
  );
  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    if (!hasMore || loading) {
      return;
    }

    const target = event.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (distanceFromBottom <= LOAD_MORE_SCROLL_THRESHOLD_PX) {
      loadNext();
    }
  }, [hasMore, loadNext, loading]);

  return (
    <>
      <div
        ref={rowsContainerRef}
        className="min-h-0 flex-1 overflow-auto rounded-t-[20px] hide-scrollbar"
        onScroll={handleScroll}
      >
        <table className="min-w-full border-separate border-spacing-0 text-[11px] sm:text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-[#D9D9D9] sm:text-[11px] sm:tracking-[0.18em]">
              <th className="sticky top-0 z-20 rounded-tl-[18px] border-b border-[color:var(--line-strong)] bg-[#1f1f1f] px-1.5 py-2 font-medium sm:px-4 sm:py-3">Date</th>
              <th className="sticky top-0 z-20 border-b border-[color:var(--line-strong)] bg-[#1f1f1f] px-4 py-2 font-medium hidden md:table-cell sm:py-3 text-center">Type</th>
              <th className="sticky top-0 z-20 border-b border-[color:var(--line-strong)] bg-[#1f1f1f] px-1.5 py-2 font-medium sm:px-4 sm:py-3 text-left w-full">Asset</th>
              <th className="sticky top-0 z-20 rounded-tr-[18px] border-b border-[color:var(--line-strong)] bg-[#1f1f1f] px-1.5 py-2 text-right font-medium sm:px-4 sm:py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((transaction) => (
              <tr key={transaction.id} className="border-b border-[color:rgba(255,255,255,0.08)] align-middle last:border-b-0 hover:bg-[color:rgba(255,255,255,0.03)] transition-colors duration-150">
                <td className="px-1.5 py-2 text-[color:var(--text-main)] sm:px-4">
                  <div className="font-semibold whitespace-nowrap">{new Date(transaction.bookingDate).toISOString().split("T")[0]}</div>
                </td>
                <td className="px-4 py-2 text-[color:var(--text-main)] hidden md:table-cell whitespace-nowrap text-center opacity-70">{transaction.typeLabel}</td>
                <td className="px-1.5 py-2 text-[color:var(--text-main)] sm:px-4 w-full max-w-0">
                  <div className="leading-5 truncate capitalize font-medium">
                    {transaction.productName || transaction.description}
                    {transaction.isin && <span className="ml-1"> - {transaction.isin}</span>}
                  </div>
                </td>
                <td className="px-1.5 py-2 text-right font-bold whitespace-nowrap sm:px-4 text-white">
                  {(transaction.tradeType?.toUpperCase() === "SELL" || transaction.typeLabel?.toUpperCase() === "SELL") ? "-" : "+"}{formatEuroCents(transaction.amountCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? (
          <div className="border-t border-[color:var(--line-strong)] px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
            Loading
          </div>
        ) : null}
      </div>
      {error ? (
        <button
          className="border-t border-[color:var(--line-strong)] px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--danger)] transition-colors hover:text-white"
          onClick={loadNext}
          type="button"
        >
          Retry
        </button>
      ) : null}
    </>
  );
}
