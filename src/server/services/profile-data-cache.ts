import { getMillisecondsUntilNextUtcDate, getUtcDateKey } from "@/shared/date-keys";

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
const VERSIONED_PROFILE_DATA_CACHE_TTL_BUFFER_MS = 5 * 60_000;
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
  const normalizedOptions = normalizeCacheOptions(options);
  const onMetric = normalizedOptions.onMetric;
  const ttlMs = normalizedOptions.ttlMs
    ?? (key ? getVersionedProfileDataCacheTtlMs() : DEFAULT_PROFILE_DATA_CACHE_TTL_MS);

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

export function invalidateProfileDataCache(userId: string, stages?: string[]) {
  const stageSet = stages ? new Set(stages) : null;

  for (const key of profileDataCache.keys()) {
    const [stage, entryUserId] = key.split(":");

    if (entryUserId === userId && (!stageSet || stageSet.has(stage))) {
      profileDataCache.delete(key);
    }
  }
}

export function getVersionedProfileDataCacheTtlMs(date = new Date()) {
  return Math.max(
    DEFAULT_PROFILE_DATA_CACHE_TTL_MS,
    getMillisecondsUntilNextUtcDate(date) + VERSIONED_PROFILE_DATA_CACHE_TTL_BUFFER_MS
  );
}

export function makeProfileStageCacheKey(
  stage: string,
  userId: string,
  version: string | null,
  dateKey = getUtcDateKey()
) {
  return version ? `${stage}:${userId}:${version}:${dateKey}` : null;
}
