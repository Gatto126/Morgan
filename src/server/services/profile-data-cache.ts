type CacheEntry<TData> = {
  expiresAt: number;
  promise?: Promise<TData>;
  value?: TData;
};

type ProfileDataCacheMetric = {
  durationMs?: number;
  hasVersionedKey: boolean;
  status: "disabled" | "hit" | "deduped" | "miss" | "stored";
};

type ProfileDataCacheOptions = {
  onMetric?: (metric: ProfileDataCacheMetric) => void;
  ttlMs?: number;
};

const DEFAULT_PROFILE_DATA_CACHE_TTL_MS = 60_000;
const profileDataCache = new Map<string, CacheEntry<unknown>>();

function normalizeCacheOptions(options: number | ProfileDataCacheOptions | undefined): ProfileDataCacheOptions {
  return typeof options === "number"
    ? { ttlMs: options }
    : options ?? {};
}

export async function getCachedProfileData<TData>(
  key: string | null,
  load: () => Promise<TData>,
  options?: number | ProfileDataCacheOptions
) {
  const { onMetric, ttlMs = DEFAULT_PROFILE_DATA_CACHE_TTL_MS } = normalizeCacheOptions(options);

  if (!key) {
    onMetric?.({ hasVersionedKey: false, status: "disabled" });
    return load();
  }

  const now = Date.now();
  const existing = profileDataCache.get(key);

  if (existing?.value !== undefined && existing.expiresAt > now) {
    onMetric?.({ hasVersionedKey: true, status: "hit" });
    return existing.value as TData;
  }

  if (existing?.promise) {
    onMetric?.({ hasVersionedKey: true, status: "deduped" });
    return existing.promise as Promise<TData>;
  }

  const startedAt = performance.now();
  onMetric?.({ hasVersionedKey: true, status: "miss" });
  const promise = load()
    .then((value) => {
      onMetric?.({
        durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
        hasVersionedKey: true,
        status: "stored"
      });
      profileDataCache.set(key, {
        expiresAt: Date.now() + ttlMs,
        value
      });
      return value;
    })
    .catch((error: unknown) => {
      profileDataCache.delete(key);
      throw error;
    });

  profileDataCache.set(key, {
    expiresAt: now + ttlMs,
    promise
  });

  return promise;
}

export function makeProfileStageCacheKey(stage: string, userId: string, version: string | null) {
  return version ? `${stage}:${userId}:${version}` : null;
}
