export const globalLivePricesCache: Record<string, number | null> = {};

if (typeof window !== "undefined") {
  try {
    const cached = localStorage.getItem("morgan_live_prices");
    if (cached) {
      Object.assign(globalLivePricesCache, JSON.parse(cached));
    }
  } catch (e) {
    console.warn("Could not read live prices cache from localStorage", e);
  }
}

export function saveLivePricesToCache(prices: Record<string, number | null>) {
  Object.assign(globalLivePricesCache, prices);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("morgan_live_prices", JSON.stringify(globalLivePricesCache));
    } catch {
      // Ignore
    }
  }
}
