import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";
import { PRICE_REQUEST_LIMITS } from "@/domain/pricing/price-request";

export const globalLivePricesCache: Record<string, number | null> = {};
export const globalLivePricesCacheUpdatedAt: Record<string, number> = {};

const inFlightPriceKeyRequests = new Map<string, Promise<Record<string, number | null>>>();
const DEFAULT_LIVE_PRICE_CACHE_MAX_AGE_MS = 60_000;
const livePriceFetchOptions: RequestInit = {
  cache: "no-store",
  headers: {
    "Cache-Control": "no-cache",
    Pragma: "no-cache"
  }
};

export function saveLivePricesToCache(prices: Record<string, number | null>) {
  const now = Date.now();
  Object.assign(globalLivePricesCache, prices);
  for (const key of Object.keys(prices)) {
    globalLivePricesCacheUpdatedAt[key] = now;
  }
}

type LivePriceRequest = {
  isins?: string[];
  cryptos?: string[];
};

type LivePriceRequestOptions = {
  maxAgeMs?: number;
};

type NormalizedLivePriceRequest = Required<LivePriceRequest>;

function normalizeKeys(keys: string[] | undefined, kind: "isin" | "crypto") {
  return [
    ...new Set(
      (keys ?? [])
        .map((key) => kind === "crypto" ? normalizeCryptoSymbol(key) : key)
        .filter((key): key is string => Boolean(key))
    )
  ].sort();
}

function pickCachedPrices(keys: string[], maxAgeMs: number) {
  const prices: Record<string, number | null> = {};
  const missingKeys: string[] = [];
  const now = Date.now();

  for (const key of keys) {
    if (
      Object.hasOwn(globalLivePricesCache, key) &&
      now - (globalLivePricesCacheUpdatedAt[key] ?? 0) <= maxAgeMs
    ) {
      prices[key] = globalLivePricesCache[key];
    } else {
      missingKeys.push(key);
    }
  }

  return {
    missingKeys,
    prices
  };
}

function getTrackingKey(kind: "isin" | "crypto", key: string) {
  return `${kind}:${key}`;
}

function collectPendingAndMissingKeys(
  keys: string[],
  kind: "isin" | "crypto",
  pendingRequests: Set<Promise<Record<string, number | null>>>
) {
  const missingKeys: string[] = [];

  for (const key of keys) {
    const pendingRequest = inFlightPriceKeyRequests.get(getTrackingKey(kind, key));
    if (pendingRequest) {
      pendingRequests.add(pendingRequest);
    } else {
      missingKeys.push(key);
    }
  }

  return missingKeys;
}

function trackInFlightRequest(
  request: NormalizedLivePriceRequest,
  requestPromise: Promise<Record<string, number | null>>
) {
  const trackingKeys = [
    ...request.isins.map((isin) => getTrackingKey("isin", isin)),
    ...request.cryptos.map((crypto) => getTrackingKey("crypto", crypto))
  ];

  for (const key of trackingKeys) {
    inFlightPriceKeyRequests.set(key, requestPromise);
  }

  void requestPromise.finally(() => {
    for (const key of trackingKeys) {
      if (inFlightPriceKeyRequests.get(key) === requestPromise) {
        inFlightPriceKeyRequests.delete(key);
      }
    }
  });
}

function buildPriceRequestUrl({ isins, cryptos }: NormalizedLivePriceRequest) {
  const params = new URLSearchParams();
  if (isins.length > 0) {
    params.set("isins", isins.join(","));
  }
  if (cryptos.length > 0) {
    params.set("cryptos", cryptos.join(","));
  }

  return `/api/prices?${params.toString()}`;
}

function makeLivePriceRequestBatches(
  isins: string[],
  cryptos: string[]
): NormalizedLivePriceRequest[] {
  const batches: NormalizedLivePriceRequest[] = [];
  let isinIndex = 0;
  let cryptoIndex = 0;

  while (isinIndex < isins.length || cryptoIndex < cryptos.length) {
    const batchIsins = isins.slice(
      isinIndex,
      isinIndex + Math.min(PRICE_REQUEST_LIMITS.maxIsins, PRICE_REQUEST_LIMITS.maxTotalKeys)
    );
    isinIndex += batchIsins.length;

    const remainingTotalSlots = PRICE_REQUEST_LIMITS.maxTotalKeys - batchIsins.length;
    const batchCryptos = cryptos.slice(
      cryptoIndex,
      cryptoIndex + Math.min(PRICE_REQUEST_LIMITS.maxCryptos, remainingTotalSlots)
    );
    cryptoIndex += batchCryptos.length;

    if (batchIsins.length === 0 && batchCryptos.length === 0) {
      break;
    }

    batches.push({
      cryptos: batchCryptos,
      isins: batchIsins
    });
  }

  return batches;
}

export function getLivePriceRequestKey({ isins, cryptos }: LivePriceRequest) {
  const normalizedIsins = normalizeKeys(isins, "isin");
  const normalizedCryptos = normalizeKeys(cryptos, "crypto");

  if (normalizedIsins.length === 0 && normalizedCryptos.length === 0) {
    return "";
  }

  return `isins=${normalizedIsins.join(",")}|cryptos=${normalizedCryptos.join(",")}`;
}

export async function fetchAndCacheLivePrices(
  request: LivePriceRequest,
  { maxAgeMs = DEFAULT_LIVE_PRICE_CACHE_MAX_AGE_MS }: LivePriceRequestOptions = {}
) {
  const normalizedIsins = normalizeKeys(request.isins, "isin");
  const normalizedCryptos = normalizeKeys(request.cryptos, "crypto");
  const cachedIsins = pickCachedPrices(normalizedIsins, maxAgeMs);
  const cachedCryptos = pickCachedPrices(normalizedCryptos, maxAgeMs);
  const cachedPrices = {
    ...cachedIsins.prices,
    ...cachedCryptos.prices
  };
  const pendingRequests = new Set<Promise<Record<string, number | null>>>();
  const missingIsins = collectPendingAndMissingKeys(
    cachedIsins.missingKeys,
    "isin",
    pendingRequests
  );
  const missingCryptos = collectPendingAndMissingKeys(
    cachedCryptos.missingKeys,
    "crypto",
    pendingRequests
  );
  const requestBatches = makeLivePriceRequestBatches(missingIsins, missingCryptos);

  if (requestBatches.length === 0 && pendingRequests.size === 0) {
    return cachedPrices;
  }

  for (const batch of requestBatches) {
    const requestPromise = fetch(buildPriceRequestUrl(batch), livePriceFetchOptions)
      .then(async (response) => {
        if (!response.ok) {
          return {};
        }

        const prices = await response.json() as Record<string, number | null>;
        saveLivePricesToCache(prices);
        return prices;
      })
      .catch(() => ({}));

    trackInFlightRequest(batch, requestPromise);
    pendingRequests.add(requestPromise);
  }

  const pendingPrices = Object.assign({}, ...(await Promise.all(pendingRequests)));
  return {
    ...cachedPrices,
    ...pendingPrices
  };
}
