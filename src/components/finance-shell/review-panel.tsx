"use client";

import { BadgeCheck, FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReviewTransaction = {
  fingerprint: string;
  rawDateLabel: string;
  typeLabel: string;
  description: string;
  direction: "IN" | "OUT";
  amountCents: number;
};

type ReviewPanelProps = {
  approving: boolean;
  transactions: ReviewTransaction[];
  error: string | null;
  notice: string | null;
  visiblePage: number;
  totalPages: number;
  newTransactionsCount: number;
  onUpload: () => void;
  onApprove: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR"
});

function formatEuro(cents: number) {
  return euroFormatter.format(cents / 100);
}

function formatSignedEuro(transaction: ReviewTransaction) {
  if (transaction.amountCents === 0) {
    return formatEuro(transaction.amountCents);
  }

  const sign = transaction.direction === "IN" ? "+" : "-";

  return `${sign}${formatEuro(transaction.amountCents)}`;
}

export function ReviewPanel({
  approving,
  transactions,
  error,
  notice,
  visiblePage,
  totalPages,
  newTransactionsCount,
  onUpload,
  onApprove,
  onPreviousPage,
  onNextPage
}: ReviewPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 text-left" style={{ opacity: approving ? 0 : 1, pointerEvents: approving ? "none" : "auto" }}>
      <div className="hidden sm:flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Review import</h2>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-[22px] border-2 border-[color:var(--line-strong)] bg-[#1C1C1C]">
        <div className="h-full overflow-auto rounded-[22px] hide-scrollbar">
          <table className="min-w-full border-separate border-spacing-0 text-[11px] sm:text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-[#D9D9D9] sm:text-[11px] sm:tracking-[0.18em]">
                <th className="sticky top-0 z-20 rounded-tl-[20px] border-b border-[color:var(--line-strong)] bg-[#1C1C1C] px-1.5 py-2 font-medium sm:px-4 sm:py-3">Date</th>
                <th className="sticky top-0 z-20 border-b border-[color:var(--line-strong)] bg-[#1C1C1C] px-4 py-2 font-medium hidden md:table-cell sm:py-3">Sort</th>
                <th className="sticky top-0 z-20 border-b border-[color:var(--line-strong)] bg-[#1C1C1C] px-1.5 py-2 font-medium sm:px-4 sm:py-3 text-left w-full">Description</th>
                <th className="sticky top-0 z-20 rounded-tr-[20px] border-b border-[color:var(--line-strong)] bg-[#1C1C1C] px-1.5 py-2 text-right font-medium sm:px-4 sm:py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.fingerprint} className="border-b border-[color:rgba(255,255,255,0.08)] align-middle last:border-b-0 hover:bg-[color:rgba(255,255,255,0.03)] transition-colors duration-150">
                  <td className="px-1.5 py-2 text-[color:var(--text-main)] sm:px-4">
                    <div className="font-semibold whitespace-nowrap">{transaction.rawDateLabel}</div>
                  </td>
                  <td className="px-4 py-2 text-[color:var(--text-main)] hidden md:table-cell whitespace-nowrap">{transaction.typeLabel}</td>
                  <td className="px-1.5 py-2 text-[color:var(--text-main)] sm:px-4 w-full max-w-0">
                    <div className="leading-5 truncate">{transaction.description}</div>
                  </td>
                  <td className="px-1.5 py-2 text-right text-[color:var(--text-main)] font-semibold whitespace-nowrap sm:px-4">{formatSignedEuro(transaction)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {error ? <p className="text-sm text-[color:var(--danger)] text-center my-1">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-200 text-center my-1">{notice}</p> : null}

      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="flex flex-1 items-center justify-start">
          <button
            className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-main)] transition-colors hover:bg-[color:var(--surface-elevated)] cursor-pointer"
            onClick={onUpload}
            type="button"
            aria-label="Carica un altro CSV"
          >
            <FolderOpen className="h-5 w-5" strokeWidth={2.3} />
          </button>
        </div>

        <div className="flex flex-none items-center justify-center gap-1 text-xs font-semibold text-[color:var(--text-dim)] sm:gap-2 sm:text-sm">
          <button
            aria-label="Previous page"
            disabled={visiblePage === 1}
            onClick={onPreviousPage}
            className={cn(
              "flex h-8 w-8 items-center justify-center border-0 bg-transparent hover:text-white sm:h-10 sm:w-10",
              "disabled:opacity-40 disabled:pointer-events-none"
            )}
          >
            {"<<"}
          </button>

          <span className="whitespace-nowrap">
            {visiblePage} / {totalPages}
          </span>

          <button
            aria-label="Next page"
            disabled={visiblePage === totalPages}
            onClick={onNextPage}
            className={cn(
              "flex h-8 w-8 items-center justify-center border-0 bg-transparent hover:text-white sm:h-10 sm:w-10",
              "disabled:opacity-40 disabled:pointer-events-none"
            )}
          >
            {">>"}
          </button>
        </div>

        <div className="flex flex-1 items-center justify-end">
          {approving ? (
            <Button className="w-full sm:w-auto sm:min-w-48" disabled onClick={onApprove}>
              ...
            </Button>
          ) : newTransactionsCount === 0 ? (
            <div className="text-[10px] uppercase tracking-wider text-[color:var(--text-dim)] hidden sm:block">Zero news</div>
          ) : (
            <button
              aria-label={`Approve and save ${newTransactionsCount} transactions`}
              className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-main)] transition-colors hover:bg-[color:var(--surface-elevated)] cursor-pointer"
              onClick={onApprove}
              type="button"
            >
              <BadgeCheck className="h-5 w-5" strokeWidth={2.3} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
