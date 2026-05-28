import type { Dispatch, RefObject, SetStateAction } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/shared/utils";
import { euroFormatter, filterData, formatEuroCents, formatProviderLabel } from "./formatters";
import type { BinanceBalanceRow, DashboardData, ProviderSummary, TimeRange } from "./types";

type DashboardCardsProps = {
  cardsPortalNode: HTMLElement | null;
  isActive: boolean;
  contentVisible: boolean;
  data: DashboardData;
  timeRange: TimeRange;
  livePrices: Record<string, number | null>;
  binanceBalances: BinanceBalanceRow[];
  isBinanceSyncing: boolean;
  filterSmallBinance: boolean;
  setFilterSmallBinance: Dispatch<SetStateAction<boolean>>;
  binanceListRef: RefObject<HTMLDivElement | null>;
  getProviderInvestmentLiveTotal: (provider: ProviderSummary) => number;
  getProviderCryptoLiveTotal: (provider: ProviderSummary) => number;
};

export function DashboardCards({
  cardsPortalNode,
  isActive,
  contentVisible,
  data,
  timeRange,
  livePrices,
  binanceBalances,
  isBinanceSyncing,
  filterSmallBinance,
  setFilterSmallBinance,
  binanceListRef,
  getProviderInvestmentLiveTotal,
  getProviderCryptoLiveTotal
}: DashboardCardsProps) {
  if (!cardsPortalNode) {
    return null;
  }

  return createPortal(
    <div
      className={cn("grid gap-4 w-full pb-6 lg:pb-0", !isActive && "absolute pointer-events-none opacity-0 invisible")}
      style={{
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        alignItems: "start",
        opacity: contentVisible ? 1 : 0,
        transform: contentVisible ? "none" : "translateY(10px)",
        transition: contentVisible ? "opacity 0.5s ease-out 0.06s, transform 0.5s ease-out 0.06s" : "none"
      }}
    >
      {data.providerSummaries.some((provider) => provider.checking.total !== 0) && (
        <div className="flex flex-col gap-3">
          {data.providerSummaries.filter((provider) => provider.checking.total !== 0).map((provider) => {
            const filteredTimeData = filterData({ monthly: data.monthlyData, daily: data.dailyData }, timeRange);
            const providerAverage = filteredTimeData.length > 0
              ? Math.round(filteredTimeData.reduce((sum, bucket) => sum + (bucket.providerChecking?.[provider.sourceInstitution] || 0), 0) / filteredTimeData.length)
              : 0;
            const providerIncomePeriod = filteredTimeData.reduce((sum, bucket) => sum + (bucket.providerIncome?.[provider.sourceInstitution] || 0), 0);
            const providerExpensesPeriod = filteredTimeData.reduce((sum, bucket) => sum + (bucket.providerExpenses?.[provider.sourceInstitution] || 0), 0);
            const providerInterestPeriod = timeRange === "ALL"
              ? provider.checking.interest
              : filteredTimeData.reduce((sum, bucket) => sum + (bucket.providerInterest?.[provider.sourceInstitution] || 0), 0);
            const providerCashbackPeriod = timeRange === "ALL"
              ? provider.checking.cashback
              : filteredTimeData.reduce((sum, bucket) => sum + (bucket.providerCashback?.[provider.sourceInstitution] || 0), 0);
            const providerTaxPeriod = timeRange === "ALL"
              ? provider.checking.tax
              : filteredTimeData.reduce((sum, bucket) => sum + (bucket.providerTax?.[provider.sourceInstitution] || 0), 0);
            return (
              <div key={`checking-${provider.sourceInstitution}`} className="flex flex-col gap-4 rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-canvas)] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-main)]">
                    {formatProviderLabel(provider.sourceInstitution)}
                  </span>
                  <span className="text-sm font-bold text-[color:var(--text-main)]">
                    {formatEuroCents(provider.checking.total)}
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="pl-3 text-[color:var(--text-dim)] font-medium">Income</span>
                        <span className="font-semibold text-[color:var(--text-main)]">
                          {formatEuroCents(providerIncomePeriod)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="pl-3 text-[color:var(--text-dim)] font-medium">Spending</span>
                        <span className="font-semibold text-[color:var(--text-main)]">
                          {formatEuroCents(providerExpensesPeriod)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="pl-3 text-[color:var(--text-dim)] font-medium">Average</span>
                        <span className="font-semibold text-[color:var(--text-main)]">
                          {formatEuroCents(providerAverage)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="pl-3 text-[color:var(--text-dim)] font-medium">Interest</span>
                        <span className="font-semibold text-[color:var(--text-main)]">
                          {formatEuroCents(providerInterestPeriod)}
                        </span>
                      </div>
                      {providerCashbackPeriod !== 0 && (
                        <div className="flex justify-between">
                          <span className="pl-3 text-[color:var(--text-dim)] font-medium">Cashback</span>
                          <span className="font-semibold text-[color:var(--text-main)]">
                            {formatEuroCents(providerCashbackPeriod)}
                          </span>
                        </div>
                      )}
                      {provider.sourceInstitution === "trade_republic" && (
                        <div className="flex justify-between">
                          <span className="pl-3 text-[color:var(--text-dim)] font-medium">Tax</span>
                          <span className="font-semibold text-[color:var(--text-main)]">
                            {formatEuroCents(providerTaxPeriod)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data.providerSummaries.some((provider) => provider.investmentProducts.filter((product) => Math.abs(product.quantity) > 0.000001).length > 0) && (
        <div className="flex flex-col gap-3">
          {data.providerSummaries
            .map((provider) => ({ ...provider, investmentProducts: provider.investmentProducts.filter((product) => Math.abs(product.quantity) > 0.000001) }))
            .filter((provider) => provider.investmentProducts.length > 0)
            .map((provider) => (
              <div key={`investment-${provider.sourceInstitution}`} className="flex flex-col gap-4 rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-canvas)] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-main)]">
                    {formatProviderLabel(provider.sourceInstitution)}
                  </span>
                  <span className="text-sm font-bold text-[color:var(--text-main)]">
                    {formatEuroCents(getProviderInvestmentLiveTotal(provider))}
                  </span>
                </div>
                <div className="space-y-4">
                  {provider.investmentProducts.map((product) => {
                    return (
                      <div key={product.productName}>
                        <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
                        <div className="mb-1.5 flex items-start justify-between min-w-0">
                          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-main)] break-words w-0 flex-1 pr-3">
                            {product.productName}
                          </span>
                          <span className="text-xs font-bold text-[color:var(--text-main)] flex-shrink-0 pt-[1px]">
                            {(() => {
                              const price = product.isin ? livePrices[product.isin] : null;
                              return price != null ? formatEuroCents(Math.round(price * 100)) : "-";
                            })()}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-sm">
                          {product.isin && (
                            <div className="flex justify-between">
                              <span className="pl-3 text-[color:var(--text-dim)] font-medium">ISIN</span>
                              <span className="font-semibold text-[color:var(--text-main)]">
                                {product.isin}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="pl-3 text-[color:var(--text-dim)] font-medium">Quantity</span>
                            <span className="font-semibold text-[color:var(--text-main)]">
                              {product.quantity.toLocaleString("it-IT", { maximumFractionDigits: 6 })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="pl-3 text-[color:var(--text-dim)] font-medium">Invested Value</span>
                            <span className="font-semibold text-[color:var(--text-main)]">
                              {formatEuroCents(product.investedValue)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="pl-3 text-[color:var(--text-dim)] font-medium">Current Value</span>
                            {(() => {
                              const price = product.isin ? livePrices[product.isin] : null;
                              if (price == null) {
                                return (
                                  <span className="font-semibold text-[color:var(--text-dim)] underline decoration-dotted decoration-[color:var(--text-dim)]">
                                    {formatEuroCents(0)}
                                  </span>
                                );
                              }
                              const currentValueCents = Math.round(product.quantity * price * 100);
                              return (
                                <span className="font-semibold text-[color:var(--text-main)]">
                                  {formatEuroCents(currentValueCents)}
                                </span>
                              );
                            })()}
                          </div>
                          {product.cashback !== 0 && (
                            <div className="flex justify-between">
                              <span className="pl-3 text-[color:var(--text-dim)] font-medium">Cashback</span>
                              <span className="font-semibold text-[color:var(--text-main)]">
                                {formatEuroCents(product.cashback)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {(data.providerSummaries.some((provider) => provider.cryptoTokens.filter((token) => Math.abs(token.quantity) > 0.000001).length > 0) || binanceBalances.length > 0) && (
        <div className="flex flex-col gap-3">
          {data.providerSummaries
            .map((provider) => ({ ...provider, cryptoTokens: provider.cryptoTokens.filter((token) => Math.abs(token.quantity) > 0.000001) }))
            .filter((provider) => provider.cryptoTokens.length > 0)
            .map((provider) => (
              <div key={`crypto-${provider.sourceInstitution}`} className="flex flex-col gap-4 rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-canvas)] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-main)]">
                      {formatProviderLabel(provider.sourceInstitution)}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-[color:var(--text-main)]">
                    {formatEuroCents(getProviderCryptoLiveTotal(provider))}
                  </span>
                </div>
                <div className="space-y-4">
                  {provider.cryptoTokens.map((token) => {
                    return (
                      <div key={token.tokenName}>
                        <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-main)]">
                            {token.tokenName}
                          </span>
                          <span className="text-xs font-bold text-[color:var(--text-main)] pl-2">
                            {(() => {
                              const price = token.tokenSymbol ? livePrices[token.tokenSymbol] : null;
                              return price != null ? formatEuroCents(Math.round(price * 100)) : "-";
                            })()}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="pl-3 text-[color:var(--text-dim)] font-medium">Quantity</span>
                            <span className="font-semibold text-[color:var(--text-main)]">
                              {token.quantity.toLocaleString("it-IT", { maximumFractionDigits: 8 })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="pl-3 text-[color:var(--text-dim)] font-medium">Invested Value</span>
                            <span className="font-semibold text-[color:var(--text-main)]">
                              {formatEuroCents(token.investedValue)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="pl-3 text-[color:var(--text-dim)] font-medium">Current Value</span>
                            {(() => {
                              const price = token.tokenSymbol ? livePrices[token.tokenSymbol] : null;
                              if (price == null) {
                                return (
                                  <span className="font-semibold text-[color:var(--text-dim)] underline decoration-dotted decoration-[color:var(--text-dim)]">
                                    {formatEuroCents(0)}
                                  </span>
                                );
                              }
                              const currentValueCents = Math.round(token.quantity * price * 100);
                              return (
                                <span className="font-semibold text-[color:var(--text-main)]">
                                  {formatEuroCents(currentValueCents)}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

          {binanceBalances.length > 0 && (() => {
            const visibleBinanceBalances = filterSmallBinance
              ? binanceBalances.filter((balance) => balance.eurValue >= 0.95)
              : binanceBalances;

            return (
              <div className="flex flex-col gap-4 rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-canvas)] p-4">
                <div className="flex items-center justify-between select-none">
                  <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => binanceListRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
                  >
                    <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-main)]">
                      BINANCE
                    </span>
                    {isBinanceSyncing && (
                      <span className="text-[9px] font-medium text-[color:var(--text-dim)] animate-pulse uppercase tracking-wider">
                        syncing
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      role="button"
                      tabIndex={0}
                      title={filterSmallBinance ? "Mostra tutti i token" : "Nascondi token sotto 0,95 EUR"}
                      onClick={() => setFilterSmallBinance((value) => !value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          setFilterSmallBinance((value) => !value);
                        }
                      }}
                      className="cursor-pointer text-[color:var(--text-dim)] transition-colors hover:text-white"
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      {filterSmallBinance
                        ? <EyeOff className="h-3.5 w-3.5" strokeWidth={2.2} />
                        : <Eye className="h-3.5 w-3.5" strokeWidth={2.2} />}
                    </div>
                    <span className="text-sm font-bold text-[color:var(--text-main)]">
                      {euroFormatter.format(binanceBalances.reduce((sum, balance) => sum + balance.eurValue, 0))}
                    </span>
                  </div>
                </div>
                <div ref={binanceListRef} className="max-h-[300px] overflow-y-auto hide-scrollbar space-y-4">
                  {visibleBinanceBalances.map((token) => {
                    const total = token.freeAmount + token.lockedAmount;
                    const isPartialLock = token.lockedAmount > 0 && token.freeAmount > 0;
                    return (
                      <div key={token.tokenSymbol}>
                        <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
                        <div className="mb-1.5 flex items-start justify-between min-w-0">
                          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-main)] break-words w-0 flex-1 pr-3">
                            {token.tokenName ? `${token.tokenName} (${token.tokenSymbol})` : token.tokenSymbol}
                          </span>
                          <span className="text-xs font-bold text-[color:var(--text-main)] flex-shrink-0 pt-[1px]">
                            {euroFormatter.format(token.eurValue)}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="pl-3 text-[color:var(--text-dim)] font-medium">Quantity</span>
                            <span className="font-semibold text-[color:var(--text-main)]">
                              {total.toLocaleString("it-IT", { maximumFractionDigits: 8 })}
                            </span>
                          </div>
                          {isPartialLock && (
                            <div className="flex justify-between">
                              <span className="pl-3 text-[color:var(--text-dim)] font-medium">Locked</span>
                              <span className="font-semibold text-[color:var(--text-main)]">
                                {token.lockedAmount.toLocaleString("it-IT", { maximumFractionDigits: 8 })}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="pl-3 text-[color:var(--text-dim)] font-medium">Current Value</span>
                            <span className="font-semibold text-[color:var(--text-main)]">
                              {euroFormatter.format(token.eurValue)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>,
    cardsPortalNode
  );
}
