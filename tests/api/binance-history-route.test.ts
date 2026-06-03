import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authGuardResponse: vi.fn(),
  getBinanceDailySnapshotHistory: vi.fn(),
  logError: vi.fn(),
  logPerformance: vi.fn(),
  logRequest: vi.fn(),
  logResponse: vi.fn(),
  requireOwnedProfile: vi.fn(),
  shouldLogPerformance: vi.fn()
}));

vi.mock("@/server/auth/auth-guard", () => ({
  authGuardResponse: mocks.authGuardResponse,
  requireOwnedProfile: mocks.requireOwnedProfile
}));

vi.mock("@/server/services/binance-daily-snapshot", () => ({
  getBinanceDailySnapshotHistory: mocks.getBinanceDailySnapshotHistory
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

import { GET } from "@/app/api/binance/history/route";

function makeRequest(url = "http://localhost/api/binance/history?userId=profile-1") {
  return new NextRequest(url);
}

describe("GET /api/binance/history", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.authGuardResponse.mockReturnValue(null);
    mocks.shouldLogPerformance.mockReturnValue(false);
    mocks.requireOwnedProfile.mockResolvedValue({
      profile: { id: "profile-1" },
      session: { user: { id: "owner-1" } }
    });
    mocks.getBinanceDailySnapshotHistory.mockResolvedValue([
      {
        dateKey: "2026-06-04",
        snapshotAt: "2026-06-03T23:00:00.000Z",
        tokenCount: 9,
        totalEurValue: 2311.23
      }
    ]);
  });

  it("requires a profile id", async () => {
    const response = await GET(makeRequest("http://localhost/api/binance/history"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "userId is required." });
    expect(mocks.requireOwnedProfile).not.toHaveBeenCalled();
    expect(mocks.getBinanceDailySnapshotHistory).not.toHaveBeenCalled();
  });

  it("requires ownership before returning Binance daily snapshots", async () => {
    const request = makeRequest();
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mocks.requireOwnedProfile).toHaveBeenCalledWith(request, "profile-1");
    expect(mocks.getBinanceDailySnapshotHistory).toHaveBeenCalledWith(
      "profile-1",
      expect.objectContaining({
        trace: expect.objectContaining({ isEnabled: false })
      })
    );
    await expect(response.json()).resolves.toEqual({
      count: 1,
      snapshots: [{
        dateKey: "2026-06-04",
        snapshotAt: "2026-06-03T23:00:00.000Z",
        tokenCount: 9,
        totalEurValue: 2311.23
      }]
    });
  });

  it("preserves auth guard responses", async () => {
    const authError = new Error("auth");
    const authResponse = NextResponse.json({ error: "Profilo non trovato." }, { status: 404 });
    mocks.requireOwnedProfile.mockRejectedValueOnce(authError);
    mocks.authGuardResponse.mockReturnValueOnce(authResponse);

    const response = await GET(makeRequest());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Profilo non trovato." });
    expect(mocks.getBinanceDailySnapshotHistory).not.toHaveBeenCalled();
  });
});
