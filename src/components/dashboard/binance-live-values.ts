import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";

import type { BinanceBalanceRow } from "./types";

const NON_ZERO_THRESHOLD = 0.000001;

export function getBinanceBalanceQuantity(balance: BinanceBalanceRow) {
  return balance.freeAmount + balance.lockedAmount;
}

export function getBinanceBalanceLivePriceKey(balance: BinanceBalanceRow) {
  return normalizeCryptoSymbol(balance.tokenSymbol);
}

export function getBinanceLivePriceKeys(balances: BinanceBalanceRow[] | undefined) {
  const keys = new Set<string>();

  for (const balance of balances ?? []) {
    if (Math.abs(getBinanceBalanceQuantity(balance)) <= NON_ZERO_THRESHOLD) {
      continue;
    }

    const key = getBinanceBalanceLivePriceKey(balance);
    if (key) {
      keys.add(key);
    }
  }

  return [...keys].sort();
}

export function getBinanceBalanceLiveValue(
  balance: BinanceBalanceRow,
  livePrices: Record<string, number | null>
) {
  const quantity = getBinanceBalanceQuantity(balance);
  const livePriceKey = getBinanceBalanceLivePriceKey(balance);
  const livePrice = livePriceKey ? livePrices[livePriceKey] : null;

  return livePrice != null && Math.abs(quantity) > NON_ZERO_THRESHOLD
    ? quantity * livePrice
    : balance.eurValue;
}

export function applyLiveBinanceBalanceValues<TBalance extends BinanceBalanceRow>(
  balances: TBalance[],
  livePrices: Record<string, number | null>
): TBalance[] {
  return balances.map((balance) => ({
    ...balance,
    eurValue: getBinanceBalanceLiveValue(balance, livePrices)
  }));
}

export function getBinanceBalancesTotalCents(balances: BinanceBalanceRow[]) {
  return Math.round(balances.reduce((sum, balance) => sum + balance.eurValue, 0) * 100);
}
