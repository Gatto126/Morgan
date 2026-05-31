import { describe, expect, it, vi } from "vitest";

import { getCachedProfileData, makeProfileStageCacheKey } from "@/server/services/profile-data-cache";

describe("profile data cache", () => {
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

  it("builds a key only when the client sends a version", () => {
    expect(makeProfileStageCacheKey("checking", "profile-1", "3")).toBe("checking:profile-1:3");
    expect(makeProfileStageCacheKey("checking", "profile-1", null)).toBeNull();
  });
});
