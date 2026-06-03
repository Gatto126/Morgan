import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authGuardResponse: vi.fn(),
  requireOwnedProfile: vi.fn(),
  profileHasMarketKey: vi.fn(),
  listAssetHistorySeries: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn()
}));

vi.mock("@/server/auth/auth-guard", () => ({
  authGuardResponse: mocks.authGuardResponse,
  requireOwnedProfile: mocks.requireOwnedProfile
}));

vi.mock("@/server/repositories/market-data-repository", () => ({
  marketDataRepository: {
    profileHasMarketKey: mocks.profileHasMarketKey,
    listAssetHistorySeries: mocks.listAssetHistorySeries
  }
}));

vi.mock("@/server/logging/logger", () => ({
  apiLogger: () => ({
    error: mocks.logError,
    info: mocks.logInfo
  })
}));

import { GET } from "@/app/api/assets/[isin]/history/route";

function makeRequest(url = "http://localhost/api/assets/IE00B4L5Y983/history?userId=profile-1") {
  return new Request(url);
}

const params = { params: Promise.resolve({ isin: "IE00B4L5Y983" }) };

describe("GET /api/assets/[isin]/history", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.authGuardResponse.mockReturnValue(null);
    mocks.requireOwnedProfile.mockResolvedValue({
      session: { user: { id: "owner-1" } },
      profile: { id: "profile-1" }
    });
    mocks.profileHasMarketKey.mockResolvedValue(true);
    mocks.listAssetHistorySeries.mockResolvedValue([{ date: "2026-01-01", value: 42 }]);
  });

  it("requires a profile id", async () => {
    const response = await GET(makeRequest("http://localhost/api/assets/IE00B4L5Y983/history"), params);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Profile id is required." });
    expect(mocks.requireOwnedProfile).not.toHaveBeenCalled();
    expect(mocks.listAssetHistorySeries).not.toHaveBeenCalled();
  });

  it("requires ownership of the selected profile before reading history", async () => {
    const response = await GET(makeRequest(), params);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      isin: "IE00B4L5Y983",
      currency: "EUR",
      count: 1,
      series: [{ date: "2026-01-01", value: 42 }]
    });
    expect(mocks.requireOwnedProfile).toHaveBeenCalledWith(expect.any(Request), "profile-1");
    expect(mocks.profileHasMarketKey).toHaveBeenCalledWith("profile-1", "IE00B4L5Y983");
    expect(mocks.listAssetHistorySeries).toHaveBeenCalledWith("IE00B4L5Y983", "EUR");
  });

  it("does not expose global history for assets outside the profile", async () => {
    mocks.profileHasMarketKey.mockResolvedValueOnce(false);

    const response = await GET(makeRequest(), params);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Asset history not found." });
    expect(mocks.listAssetHistorySeries).not.toHaveBeenCalled();
  });

  it("preserves auth guard responses", async () => {
    const authError = new Error("auth");
    const authResponse = NextResponse.json({ error: "Profilo non trovato." }, { status: 404 });
    mocks.requireOwnedProfile.mockRejectedValueOnce(authError);
    mocks.authGuardResponse.mockReturnValueOnce(authResponse);

    const response = await GET(makeRequest(), params);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Profilo non trovato." });
    expect(mocks.profileHasMarketKey).not.toHaveBeenCalled();
  });
});
