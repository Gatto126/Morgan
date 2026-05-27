import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { formatEuroCents, formatProviderLabel, formatSignedEuroCents } from "./formatters";
import type { CheckingProviderSummary } from "./types";

type CheckingProviderCardsProps = {
  portalNode: HTMLElement | null;
  providers: CheckingProviderSummary[];
  isActive: boolean;
};

export function CheckingProviderCards({
  portalNode,
  providers,
  isActive
}: CheckingProviderCardsProps) {
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
                  {formatEuroCents(provider.total)}
                </span>
              </div>
              <div className="mt-4 space-y-1.5 text-sm">
                <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
                <div className="flex justify-between">
                  <span className="pl-3 text-[color:var(--text-dim)] font-medium">Income</span>
                  <span className="font-semibold text-[color:var(--text-main)]">
                    {formatEuroCents(provider.income)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="pl-3 text-[color:var(--text-dim)] font-medium">Expenses</span>
                  <span className="font-semibold text-[color:var(--text-main)]">
                    {formatEuroCents(provider.expenses)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="pl-3 text-[color:var(--text-dim)] font-medium">Interest</span>
                  <span className="font-semibold text-[color:var(--text-main)]">
                    {formatEuroCents(provider.interest)}
                  </span>
                </div>
                {provider.cashback !== 0 && (
                  <div className="flex justify-between">
                    <span className="pl-3 text-[color:var(--text-dim)] font-medium">Cashback</span>
                    <span className="font-semibold text-[color:var(--text-main)]">
                      {formatEuroCents(provider.cashback)}
                    </span>
                  </div>
                )}
                {(provider.sourceInstitution === "trade_republic" || provider.tax !== 0) && (
                  <div className="flex justify-between">
                    <span className="pl-3 text-[color:var(--text-dim)] font-medium">Tax</span>
                    <span className="font-semibold text-[color:var(--text-main)]">
                      {formatEuroCents(provider.tax)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col min-h-[280px] lg:h-[400px] flex-1 overflow-hidden rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[#1f1f1f]">
              <div className="h-full overflow-auto rounded-[20px] hide-scrollbar">
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
                    {provider.transactions.map((transaction) => (
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
              </div>
            </div>
          </div>
      ))}
    </div>,
    portalNode
  );
}
