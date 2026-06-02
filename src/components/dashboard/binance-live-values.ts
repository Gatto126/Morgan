import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";
import { BINANCE_MATERIAL_VALUE_THRESHOLD_EUR, isMaterialBinanceEurValue } from "@/domain/binance/materiality";

import type { BinanceBalanceRow } from "./types";

const NON_ZERO_THRESHOLD = 0.000001;
export const BINANCE_VISIBLE_VALUE_THRESHOLD_EUR = BINANCE_MATERIAL_VALUE_THRESHOLD_EUR;

export function getBinanceBalanceQuantity(balance: BinanceBalanceRow) {
  return balance.freeAmount + balance.lockedAmount;
}

export function getBinanceBalanceLivePriceKey(balance: BinanceBalanceRow) {
  return normalizeCryptoSymbol(balance.tokenSymbol);
}

export function isOpenBinanceBalance(balance: BinanceBalanceRow) {
  return Math.abs(getBinanceBalanceQuantity(balance)) > NON_ZERO_THRESHOLD;
}

export function isMaterialBinanceBalance(balance: BinanceBalanceRow) {
  return isOpenBinanceBalance(balance)
    && isMaterialBinanceEurValue(balance.eurValue);
}

export function getBinanceLivePriceKeys(balances: BinanceBalanceRow[] | undefined) {
  const keys = new Set<string>();
  const materialBalances = [...balances ?? []]
    .filter(isMaterialBinanceBalance)
    .sort((a, b) => {
      const valueDelta = b.eurValue - a.eurValue;
      return valueDelta !== 0
        ? valueDelta
        : (getBinanceBalanceLivePriceKey(a) ?? "").localeCompare(getBinanceBalanceLivePriceKey(b) ?? "");
    });

  for (const balance of materialBalances) {
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
