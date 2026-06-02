import { getBinanceBalanceLivePriceKey } from "./binance-live-values";
import { formatEuroCents } from "./formatters";
import type { CurrentValuationSnapshot } from "../finance-shell/current-valuations-store";
import type { BinanceBalanceRow } from "./types";

const BINANCE_PROVIDER_ID = "BINANCE";

export type BinanceCardAssetValueMap = Record<string, number | null | undefined>;

export function getBinanceCardTotalLabel(
  currentValueCents?: number | null
) {
  if (typeof currentValueCents === "number") {
    return formatEuroCents(currentValueCents);
  }

  return null;
}

export function getBinanceCardAssetValueCentsByKey(
  snapshot: Pick<CurrentValuationSnapshot, "assets"> | null | undefined
): BinanceCardAssetValueMap | undefined {
  const values: BinanceCardAssetValueMap = {};

  for (const asset of Object.values(snapshot?.assets ?? {})) {
    if (asset.category !== "binance") {
      continue;
    }

    const key = asset.id.startsWith("binance:")
      ? asset.id.slice("binance:".length)
      : asset.priceKey ?? asset.chartKey;
    values[key] = asset.providerValues[BINANCE_PROVIDER_ID]?.cents ?? asset.value.cents;
  }

  return Object.keys(values).length > 0 ? values : undefined;
}

export function getBinanceCardBalanceValueLabel(
  balance: BinanceBalanceRow,
  currentAssetValueCentsByKey?: BinanceCardAssetValueMap
) {
  const key = getBinanceBalanceLivePriceKey(balance) ?? balance.tokenSymbol;
  const currentValueCents = currentAssetValueCentsByKey?.[key];

  return typeof currentValueCents === "number"
    ? formatEuroCents(currentValueCents)
    : null;
}
