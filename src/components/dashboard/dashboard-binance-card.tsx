import type { Dispatch, RefObject, SetStateAction } from "react";
import { Eye, EyeOff } from "lucide-react";

import { SlotValue } from "@/components/finance-shell/slot-value";

import {
  DashboardAssetHeader,
  DashboardMetricRow
} from "./dashboard-card-parts";
import { euroFormatter } from "./formatters";
import type { BinanceBalanceRow } from "./types";

type DashboardBinanceCardProps = {
  balances: BinanceBalanceRow[];
  isSyncing: boolean;
  filterSmallBalances: boolean;
  setFilterSmallBalances: Dispatch<SetStateAction<boolean>>;
  listRef: RefObject<HTMLDivElement | null>;
};

export function DashboardBinanceCard({
  balances,
  isSyncing,
  filterSmallBalances,
  setFilterSmallBalances,
  listRef
}: DashboardBinanceCardProps) {
  if (balances.length === 0) {
    return null;
  }

  const visibleBalances = filterSmallBalances
    ? balances.filter((balance) => balance.eurValue >= 0.95)
    : balances;
  const totalValue = balances.reduce((sum, balance) => sum + balance.eurValue, 0);

  return (
    <div className="flex flex-col gap-4 rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-canvas)] p-4">
      <div className="flex items-center justify-between select-none">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => listRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-main)]">
            BINANCE
          </span>
          {isSyncing && (
            <span className="text-[9px] font-medium text-[color:var(--text-dim)] animate-pulse uppercase tracking-wider">
              syncing
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div
            role="button"
            tabIndex={0}
            title={filterSmallBalances ? "Mostra tutti i token" : "Nascondi token sotto 0,95 EUR"}
            onClick={() => setFilterSmallBalances((value) => !value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                setFilterSmallBalances((value) => !value);
              }
            }}
            className="cursor-pointer text-[color:var(--text-dim)] transition-colors hover:text-white"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {filterSmallBalances
              ? <EyeOff className="h-3.5 w-3.5" strokeWidth={2.2} />
              : <Eye className="h-3.5 w-3.5" strokeWidth={2.2} />}
          </div>
          <span className="text-sm font-bold text-[color:var(--text-main)]">
            <SlotValue animateChanges value={euroFormatter.format(totalValue)} />
          </span>
        </div>
      </div>
      <div ref={listRef} className="max-h-[300px] overflow-y-auto hide-scrollbar space-y-4">
        {visibleBalances.map((token) => {
          const total = token.freeAmount + token.lockedAmount;
          const isPartialLock = token.lockedAmount > 0 && token.freeAmount > 0;

          return (
            <div key={token.tokenSymbol}>
              <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
              <DashboardAssetHeader
                animateValueChanges
                name={token.tokenName ? `${token.tokenName} (${token.tokenSymbol})` : token.tokenSymbol}
                value={euroFormatter.format(token.eurValue)}
              />
              <div className="space-y-1.5 text-sm">
                <DashboardMetricRow
                  label="Quantity"
                  value={total.toLocaleString("it-IT", { maximumFractionDigits: 8 })}
                />
                {isPartialLock && (
                  <DashboardMetricRow
                    label="Locked"
                    value={token.lockedAmount.toLocaleString("it-IT", { maximumFractionDigits: 8 })}
                  />
                )}
                <DashboardMetricRow animateValueChanges label="Current Value" value={euroFormatter.format(token.eurValue)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
