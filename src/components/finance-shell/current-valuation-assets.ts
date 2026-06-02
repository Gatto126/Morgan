import type { AssetValuation, CurrentValuationSnapshot } from "./current-valuations-store";

type CurrentValuationAssetLookup = {
  category: AssetValuation["category"];
  chartKey?: string | null;
  priceKey?: string | null;
  providerId: string;
};

function normalizeLookupValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

export function findCurrentValuationAsset(
  snapshot: Pick<CurrentValuationSnapshot, "assets"> | null | undefined,
  { category, chartKey, priceKey, providerId }: CurrentValuationAssetLookup
) {
  const candidates = Object.values(snapshot?.assets ?? {}).filter((asset) =>
    asset.category === category && Object.hasOwn(asset.providerValues, providerId)
  );
  const normalizedPriceKey = normalizeLookupValue(priceKey);
  const normalizedChartKey = normalizeLookupValue(chartKey);

  if (normalizedPriceKey) {
    const priceKeyMatch = candidates.find((asset) =>
      normalizeLookupValue(asset.priceKey) === normalizedPriceKey
    );

    if (priceKeyMatch) {
      return priceKeyMatch;
    }
  }

  if (normalizedChartKey) {
    const chartKeyMatch = candidates.find((asset) =>
      normalizeLookupValue(asset.chartKey) === normalizedChartKey
      || normalizeLookupValue(asset.label) === normalizedChartKey
    );

    if (chartKeyMatch) {
      return chartKeyMatch;
    }
  }

  return undefined;
}

export function getCurrentValuationAssetValueCents(
  snapshot: Pick<CurrentValuationSnapshot, "assets"> | null | undefined,
  lookup: CurrentValuationAssetLookup
) {
  const asset = findCurrentValuationAsset(snapshot, lookup);

  return asset ? asset.providerValues[lookup.providerId]?.cents ?? null : undefined;
}
