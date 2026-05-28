export const globalLivePricesCache: Record<string, number | null> = {};

export function saveLivePricesToCache(prices: Record<string, number | null>) {
  Object.assign(globalLivePricesCache, prices);
}
