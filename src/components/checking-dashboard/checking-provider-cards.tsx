import { createPortal } from "react-dom";
import { useCallback, useEffect } from "react";
import type { UIEvent } from "react";

import { CurrentValueSkeleton } from "@/components/finance-shell/current-value-skeleton";
import { SlotValue } from "@/components/finance-shell/slot-value";
import { scheduleIdleTask, useDeferredTransactionRows } from "@/hooks/use-deferred-transaction-rows";
import { prefetchTransactionRows, useTransactionRows } from "@/hooks/use-transaction-rows";
import { cn } from "@/shared/utils";
import type { ChartPoint } from "@/types/chart";

import { formatEuroCents, formatProviderLabel, formatSignedEuroCents } from "./formatters";
import type { CheckingProviderSummary, CheckingTransaction } from "./types";

type CheckingProviderCardsProps = {
  portalNode: HTMLElement | null;
  providers: CheckingProviderSummary[];
  currentPoint: ChartPoint | null;
  valuesKnown: boolean;
  userId: string;
  isActive: boolean;
  shouldPreloadRows?: boolean;
};

const INITIAL_TRANSACTION_ROWS = 20;
const NEXT_TRANSACTION_ROWS = 10;
const LOAD_MORE_SCROLL_THRESHOLD_PX = 160;

function CurrentValueDisplay({ value }: { value: string }) {
  return value === "--" || value.trim() === ""
    ? <CurrentValueSkeleton className="h-4 w-20" />
    : <SlotValue value={value} />;
}

export function CheckingProviderCards({
  portalNode,
  providers,
  currentPoint,
  valuesKnown,
  userId,
  isActive,
  shouldPreloadRows = isActive
}: CheckingProviderCardsProps) {
  useEffect(() => {
    if (!shouldPreloadRows || providers.length === 0) {
      return;
    }

    const cancelIdleTask = scheduleIdleTask(() => {
      for (const provider of providers.slice(0, 2)) {
        void prefetchTransactionRows<CheckingTransaction>({
          endpoint: "/api/transactions/checking/rows",
          initialPageSize: INITIAL_TRANSACTION_ROWS,
          pageSize: NEXT_TRANSACTION_ROWS,
          sourceInstitution: provider.sourceInstitution,
          totalCount: provider.transactionCount,
          userId
        });
      }
    }, 2_200);

    return cancelIdleTask;
  }, [providers, shouldPreloadRows, userId]);

  if (!portalNode) return null;

  return createPortal(
    <div className={cn("flex flex-col gap-5 w-full pb-6 lg:pb-0", !isActive && "absolute pointer-events-none opacity-0 invisible")}>
      {providers.map((provider) => (
          <div key={provider.sourceInstitution} className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
            <div className="flex flex-col rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-canvas)] p-4 h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-main)]">
                  {formatProviderLabel(provider.sourceInstitution)}
                </span>
                <span className="text-sm font-bold text-[color:var(--text-main)]">
                  <CurrentValueDisplay value={formatPointValue(currentPoint, provider.sourceInstitution, valuesKnown)} />
                </span>
              </div>
              <div className="mt-4 space-y-1.5 text-sm">
                <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
                <div className="flex justify-between">
                  <span className="pl-3 text-[color:var(--text-dim)] font-medium">Income</span>
                  <span className="font-semibold text-[color:var(--text-main)]">
                    <SlotValue value={formatEuroCents(provider.income)} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="pl-3 text-[color:var(--text-dim)] font-medium">Expenses</span>
                  <span className="font-semibold text-[color:var(--text-main)]">
                    <SlotValue value={formatEuroCents(provider.expenses)} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="pl-3 text-[color:var(--text-dim)] font-medium">Interest</span>
                  <span className="font-semibold text-[color:var(--text-main)]">
                    <SlotValue value={formatEuroCents(provider.interest)} />
                  </span>
                </div>
                {provider.cashback !== 0 && (
                  <div className="flex justify-between">
                    <span className="pl-3 text-[color:var(--text-dim)] font-medium">Cashback</span>
                    <span className="font-semibold text-[color:var(--text-main)]">
                      <SlotValue value={formatEuroCents(provider.cashback)} />
                    </span>
                  </div>
                )}
                {(provider.sourceInstitution === "trade_republic" || provider.tax !== 0) && (
                  <div className="flex justify-between">
                    <span className="pl-3 text-[color:var(--text-dim)] font-medium">Tax</span>
                    <span className="font-semibold text-[color:var(--text-main)]">
                      <SlotValue value={formatEuroCents(provider.tax)} />
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col min-h-[280px] lg:h-[400px] flex-1 overflow-hidden rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[#1f1f1f]">
              <CheckingTransactionTable
                isActive={isActive}
                shouldPreloadRows={shouldPreloadRows}
                provider={provider}
                userId={userId}
              />
            </div>
          </div>
      ))}
    </div>,
    portalNode
  );
}

function formatPointValue(point: ChartPoint | null, key: string, valuesKnown: boolean) {
  if (!valuesKnown || !point) {
    return "--";
  }

  const value = point[key];
  return typeof value === "number" ? formatEuroCents(value) : "--";
}

function CheckingTransactionTable({
  isActive,
  shouldPreloadRows,
  provider,
  userId
}: {
  isActive: boolean;
  shouldPreloadRows: boolean;
  provider: CheckingProviderSummary;
  userId: string;
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
  } = useTransactionRows<CheckingTransaction>({
    endpoint: "/api/transactions/checking/rows",
    initialPageSize: INITIAL_TRANSACTION_ROWS,
    isActive: isActive || shouldPreloadRows,
    pageSize: NEXT_TRANSACTION_ROWS,
    shouldLoad: shouldLoadRows,
    sourceInstitution: provider.sourceInstitution,
    totalCount: provider.transactionCount,
    userId
  });
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
              <th className="sticky top-0 z-20 border-b border-[color:var(--line-strong)] bg-[#1f1f1f] px-4 py-2 font-medium hidden md:table-cell sm:py-3">Sort</th>
              <th className="sticky top-0 z-20 border-b border-[color:var(--line-strong)] bg-[#1f1f1f] px-1.5 py-2 font-medium sm:px-4 sm:py-3 text-left w-full">Description</th>
              <th className="sticky top-0 z-20 rounded-tr-[18px] border-b border-[color:var(--line-strong)] bg-[#1f1f1f] px-1.5 py-2 text-right font-medium sm:px-4 sm:py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="border-b border-[color:rgba(255,255,255,0.08)] align-middle last:border-b-0 hover:bg-[color:rgba(255,255,255,0.03)] transition-colors duration-150">
                <td className="px-1.5 py-2 text-[color:var(--text-main)] sm:px-4">
                  <div className="font-semibold whitespace-nowrap">{new Date(transaction.bookingDate).toISOString().split("T")[0]}</div>
                </td>
                <td className="px-4 py-2 text-[color:var(--text-main)] hidden md:table-cell whitespace-nowrap">{transaction.typeLabel}</td>
                <td className="px-1.5 py-2 text-[color:var(--text-main)] sm:px-4 w-full max-w-0">
                  <div className="leading-5 truncate">{transaction.description}</div>
                </td>
                <td className="px-1.5 py-2 text-right text-[color:var(--text-main)] font-semibold whitespace-nowrap sm:px-4">{formatSignedEuroCents(transaction.amountCents, transaction.direction)}</td>
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
