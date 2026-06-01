import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    profileStageSnapshot: mocks
  }
}));

import {
  getProfileStageSnapshot,
  invalidateProfileStageSnapshots,
  parseProfileStageSnapshotVersion
} from "@/server/services/profile-stage-snapshot";

describe("profile stage snapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads a materialized snapshot without running the loader", async () => {
    const payload = { dailyData: [{ date: "2026-06-01" }] };
    mocks.findUnique.mockResolvedValueOnce({ payload });
    const loader = vi.fn(async () => ({ dailyData: [] }));

    await expect(getProfileStageSnapshot(
      "dashboard",
      "user-1",
      12,
      loader,
      { dateKey: "2026-06-01" }
    )).resolves.toBe(payload);

    expect(loader).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("stores a freshly built snapshot on cache miss", async () => {
    const payload = { providers: [{ sourceInstitution: "trade_republic" }] };
    mocks.findUnique.mockResolvedValueOnce(null);
    mocks.upsert.mockResolvedValueOnce({});

    await expect(getProfileStageSnapshot(
      "investment",
      "user-1",
      3,
      async () => payload,
      { dateKey: "2026-06-01" }
    )).resolves.toBe(payload);

    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        dateKey: "2026-06-01",
        payload,
        stage: "investment",
        userId: "user-1",
        version: 3
      })
    }));
  });

  it("falls back to the loader when the snapshot table is unavailable", async () => {
    const payload = { dailyData: [] };
    mocks.findUnique.mockRejectedValueOnce(new Error("missing table"));
    const loader = vi.fn(async () => payload);

    await expect(getProfileStageSnapshot(
      "dashboard",
      "user-1",
      1,
      loader,
      { dateKey: "2026-06-01" }
    )).resolves.toBe(payload);

    expect(loader).toHaveBeenCalledOnce();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("returns fresh data even if storing the snapshot fails", async () => {
    const payload = { providers: [] };
    mocks.findUnique.mockResolvedValueOnce(null);
    mocks.upsert.mockRejectedValueOnce(new Error("write failed"));

    await expect(getProfileStageSnapshot(
      "crypto",
      "user-1",
      2,
      async () => payload,
      { dateKey: "2026-06-01" }
    )).resolves.toBe(payload);
  });

  it("normalizes invalid snapshot versions", () => {
    expect(parseProfileStageSnapshotVersion("4")).toBe(4);
    expect(parseProfileStageSnapshotVersion(null)).toBe(0);
    expect(parseProfileStageSnapshotVersion("nope")).toBe(0);
  });

  it("can invalidate all derived snapshots for a profile", async () => {
    mocks.deleteMany.mockResolvedValueOnce({ count: 2 });

    await invalidateProfileStageSnapshots("user-1");

    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" }
    });
  });
});
