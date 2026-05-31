import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authGuardResponse: vi.fn(),
  requireAuth: vi.fn(),
  getRetryAfterMs: vi.fn(),
  fetchPrices: vi.fn(),
  logError: vi.fn(),
  logRequest: vi.fn(),
  logResponse: vi.fn()
}));

vi.mock("@/server/auth/auth-guard", () => ({
  authGuardResponse: mocks.authGuardResponse,
  requireAuth: mocks.requireAuth
}));

vi.mock("@/server/logging/logger", () => ({
  apiLogger: () => ({
    error: mocks.logError,
    request: mocks.logRequest,
    response: mocks.logResponse
  }),
  shouldLogPerformance: () => false
}));

vi.mock("@/server/services/price-refresh", () => ({
  priceRefreshService: {
    getRetryAfterMs: mocks.getRetryAfterMs,
    fetchPrices: mocks.fetchPrices
  }
}));

import { GET } from "@/app/api/prices/route";

function makeRequest(query = "cryptos=BTC") {
  return new NextRequest(`http://localhost/api/prices?${query}`);
}

describe("GET /api/prices", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.authGuardResponse.mockReturnValue(null);
    mocks.requireAuth.mockResolvedValue({ user: { id: "user-1", name: "Luca" } });
    mocks.getRetryAfterMs.mockResolvedValue(null);
    mocks.fetchPrices.mockResolvedValue({ BTC: 62000 });
  });

  it("returns live prices without HTTP cache storage", async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0, must-revalidate");
    expect(response.headers.get("Vary")).toBe("Cookie");
    await expect(response.json()).resolves.toEqual({ BTC: 62000 });
    expect(mocks.getRetryAfterMs).toHaveBeenCalledWith("user-1");
    expect(mocks.fetchPrices).toHaveBeenCalledWith(
      { isins: [], cryptos: ["BTC"] },
      { trace: expect.any(Object) }
    );
  });
});
