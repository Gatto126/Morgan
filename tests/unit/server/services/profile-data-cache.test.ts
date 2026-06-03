import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCachedProfileData,
  getVersionedProfileDataCacheTtlMs,
  invalidateProfileDataCache,
  makeProfileStageCacheKey
} from "@/server/services/profile-data-cache";

describe("profile data cache", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("dedupes warm profile stage loads by versioned cache key", async () => {
    const load = vi.fn(async () => ({ ok: true }));

    await expect(getCachedProfileData("dashboard:profile-1:7", load, 60_000)).resolves.toEqual({ ok: true });
    await expect(getCachedProfileData("dashboard:profile-1:7", load, 60_000)).resolves.toEqual({ ok: true });

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache unversioned profile loads", async () => {
    const load = vi.fn(async () => ({ ok: true }));

    await getCachedProfileData(null, load, 60_000);
    await getCachedProfileData(null, load, 60_000);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("invalidates cached entries for one profile", async () => {
    const profileLoad = vi.fn()
      .mockResolvedValueOnce({ ok: "first" })
      .mockResolvedValueOnce({ ok: "second" });
    const otherProfileLoad = vi.fn(async () => ({ ok: "other" }));

    await expect(getCachedProfileData("binance:profile-1:0:2026-06-01", profileLoad, 60_000)).resolves.toEqual({ ok: "first" });
    await expect(getCachedProfileData("binance:profile-2:0:2026-06-01", otherProfileLoad, 60_000)).resolves.toEqual({ ok: "other" });

    invalidateProfileDataCache("profile-1");

    await expect(getCachedProfileData("binance:profile-1:0:2026-06-01", profileLoad, 60_000)).resolves.toEqual({ ok: "second" });
    await expect(getCachedProfileData("binance:profile-2:0:2026-06-01", otherProfileLoad, 60_000)).resolves.toEqual({ ok: "other" });

    expect(profileLoad).toHaveBeenCalledTimes(2);
    expect(otherProfileLoad).toHaveBeenCalledTimes(1);
  });

  it("builds a key only when the client sends a version", () => {
    expect(makeProfileStageCacheKey("checking", "profile-1", "3", "2026-06-01")).toBe("checking:profile-1:3:2026-06-01");
    expect(makeProfileStageCacheKey("checking", "profile-1", null)).toBeNull();
  });

  it("keeps default versioned cache entries fresh beyond the old one minute window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
    const load = vi.fn(async () => ({ ok: true }));
    const cacheKey = "dashboard:profile-1:7:2026-06-01";

    await expect(getCachedProfileData(cacheKey, load)).resolves.toEqual({ ok: true });
    vi.setSystemTime(new Date("2026-06-01T12:02:00.000Z"));
    await expect(getCachedProfileData(cacheKey, load)).resolves.toEqual({ ok: true });

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps versioned profile data fresh until the next UTC date", () => {
    expect(getVersionedProfileDataCacheTtlMs(new Date("2026-06-01T23:59:30.000Z"))).toBe(330_000);
    expect(getVersionedProfileDataCacheTtlMs(new Date("2026-06-01T12:00:00.000Z"))).toBe(43_500_000);
  });
});
