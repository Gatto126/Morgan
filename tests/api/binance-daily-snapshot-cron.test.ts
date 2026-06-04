import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setTestEnv } from "../setup/env";

const mocks = vi.hoisted(() => ({
  createBinanceDailySnapshotsForAllProfiles: vi.fn(),
  logError: vi.fn(),
  logPerformance: vi.fn(),
  logRequest: vi.fn(),
  logResponse: vi.fn(),
  shouldLogPerformance: vi.fn()
}));

vi.mock("@/server/services/binance-daily-snapshot", () => ({
  createBinanceDailySnapshotsForAllProfiles: mocks.createBinanceDailySnapshotsForAllProfiles
}));

vi.mock("@/server/logging/logger", () => ({
  apiLogger: () => ({
    error: mocks.logError,
    performance: mocks.logPerformance,
    request: mocks.logRequest,
    response: mocks.logResponse
  }),
  shouldLogPerformance: mocks.shouldLogPerformance
}));

import { GET } from "@/app/api/cron/binance-daily-snapshot/route";

let restoreEnv: (() => void) | null = null;
let consoleLogSpy: ReturnType<typeof vi.spyOn> | null = null;

function withCronSecret(value: string | undefined) {
  restoreEnv?.();
  restoreEnv = setTestEnv({ CRON_SECRET: value });
}

function makeCronRequest(secret?: string) {
  return new Request("http://localhost/api/cron/binance-daily-snapshot", {
    headers: secret ? { Authorization: `Bearer ${secret}` } : undefined
  });
}

describe("binance daily snapshot cron route", () => {
  beforeEach(() => {
    restoreEnv = null;
    mocks.createBinanceDailySnapshotsForAllProfiles.mockReset();
    mocks.logError.mockReset();
    mocks.logPerformance.mockReset();
    mocks.logRequest.mockReset();
    mocks.logResponse.mockReset();
    mocks.shouldLogPerformance.mockReset();
    mocks.shouldLogPerformance.mockReturnValue(false);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    mocks.createBinanceDailySnapshotsForAllProfiles.mockResolvedValue({
      created: 1,
      dateKey: "2026-06-04",
      failed: 0,
      results: [],
      skippedExisting: 0,
      skippedMissingCredentials: 0,
      snapshotAt: "2026-06-03T23:00:00.000Z",
      totalProfiles: 1
    });
  });

  afterEach(() => {
    consoleLogSpy?.mockRestore();
    consoleLogSpy = null;
    restoreEnv?.();
    restoreEnv = null;
  });

  it("returns 503 when CRON_SECRET is not configured", async () => {
    withCronSecret(undefined);

    const response = await GET(makeCronRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "CRON_SECRET is not configured."
    });
    expect(mocks.createBinanceDailySnapshotsForAllProfiles).not.toHaveBeenCalled();
  });

  it("rejects requests without the configured bearer token", async () => {
    withCronSecret("cron-secret");

    const response = await GET(makeCronRequest("wrong-secret"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mocks.createBinanceDailySnapshotsForAllProfiles).not.toHaveBeenCalled();
  });

  it("runs the snapshot service when authorized", async () => {
    withCronSecret("cron-secret");

    const response = await GET(makeCronRequest("cron-secret"));

    expect(response.status).toBe(200);
    expect(mocks.createBinanceDailySnapshotsForAllProfiles).toHaveBeenCalledWith(
      expect.objectContaining({
        trace: expect.objectContaining({ isEnabled: false })
      })
    );
    await expect(response.json()).resolves.toMatchObject({
      created: 1,
      dateKey: "2026-06-04",
      ok: true,
      totalProfiles: 1
    });
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("created=1 failed=0 profiles=1"));
  });

  it("returns 500 when at least one profile snapshot fails", async () => {
    withCronSecret("cron-secret");
    mocks.createBinanceDailySnapshotsForAllProfiles.mockResolvedValueOnce({
      created: 0,
      dateKey: "2026-06-04",
      failed: 1,
      results: [],
      skippedExisting: 0,
      skippedMissingCredentials: 0,
      snapshotAt: "2026-06-03T23:00:00.000Z",
      totalProfiles: 1
    });

    const response = await GET(makeCronRequest("cron-secret"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      failed: 1,
      ok: false,
      totalProfiles: 1
    });
    expect(mocks.logResponse).toHaveBeenCalledWith(
      "GET",
      "/api/cron/binance-daily-snapshot",
      500,
      expect.objectContaining({ failed: 1 })
    );
  });
});
