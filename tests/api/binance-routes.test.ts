import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => {
  class MockBinanceApiError extends Error {
    constructor(
      message: string,
      public status = 400
    ) {
      super(message);
      this.name = "BinanceApiError";
    }
  }

  return {
    authGuardResponse: vi.fn(),
    logError: vi.fn(),
    logInfo: vi.fn(),
    logPerformance: vi.fn(),
    logRequest: vi.fn(),
    logResponse: vi.fn(),
    shouldLogPerformance: vi.fn(),
    requireOwnedProfile: vi.fn(),
    getBinanceBalancesStatus: vi.fn(),
    syncBinanceProfile: vi.fn(),
    BinanceMissingCredentialsError: class BinanceMissingCredentialsError extends Error {},
    BinanceApiError: MockBinanceApiError
  };
});

vi.mock("@/server/auth/auth-guard", () => ({
  authGuardResponse: mocks.authGuardResponse,
  requireOwnedProfile: mocks.requireOwnedProfile
}));

vi.mock("@/integrations/binance/binance-service", () => ({
  BinanceApiError: mocks.BinanceApiError
}));

vi.mock("@/server/services/binance-sync", () => ({
  BinanceMissingCredentialsError: mocks.BinanceMissingCredentialsError,
  getBinanceBalancesStatus: mocks.getBinanceBalancesStatus,
  syncBinanceProfile: mocks.syncBinanceProfile
}));

vi.mock("@/server/logging/logger", () => ({
  apiLogger: () => ({
    error: mocks.logError,
    info: mocks.logInfo,
    performance: mocks.logPerformance,
    request: mocks.logRequest,
    response: mocks.logResponse
  }),
  shouldLogPerformance: mocks.shouldLogPerformance
}));

import { GET as balancesGet } from "@/app/api/binance/balances/route";
import { POST as connectPost } from "@/app/api/binance/connect/route";
import { POST as syncPost } from "@/app/api/binance/sync/route";

const syncedAt = new Date("2026-01-02T03:04:05.000Z");
const persistedBalance = {
  id: "balance-1",
  userId: "user-1",
  tokenSymbol: "BTC",
  tokenName: "Bitcoin",
  freeAmount: 1,
  lockedAmount: 0,
  eurValue: 30_000,
  updatedAt: syncedAt
};

function makeGetRequest(path: string, userId?: string) {
  const url = new URL(`http://localhost${path}`);
  if (userId) {
    url.searchParams.set("userId", userId);
  }
  return new NextRequest(url);
}

function makeRequest(path: string, body: unknown = { userId: "user-1" }) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost"
    },
    body: JSON.stringify(body)
  });
}

const routes = [
  { name: "connect", path: "/api/binance/connect", post: connectPost },
  { name: "sync", path: "/api/binance/sync", post: syncPost }
];

describe("binance API routes", () => {
  beforeEach(() => {
    mocks.authGuardResponse.mockReset();
    mocks.logError.mockReset();
    mocks.logInfo.mockReset();
    mocks.logPerformance.mockReset();
    mocks.logRequest.mockReset();
    mocks.logResponse.mockReset();
    mocks.shouldLogPerformance.mockReset();
    mocks.requireOwnedProfile.mockReset();
    mocks.getBinanceBalancesStatus.mockReset();
    mocks.syncBinanceProfile.mockReset();

    mocks.authGuardResponse.mockReturnValue(null);
    mocks.shouldLogPerformance.mockReturnValue(false);
    mocks.syncBinanceProfile.mockResolvedValue({
      balances: [persistedBalance],
      syncedAt
    });
    mocks.getBinanceBalancesStatus.mockResolvedValue({
      balances: [persistedBalance],
      syncedAt,
      isStale: false,
      hasApiKey: true
    });
  });

  describe("balances", () => {
    it("requires a userId", async () => {
      const response = await balancesGet(makeGetRequest("/api/binance/balances"));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "userId is required." });
      expect(mocks.getBinanceBalancesStatus).not.toHaveBeenCalled();
    });

    it("returns cached balances through the shared service", async () => {
      const request = makeGetRequest("/api/binance/balances", "user-1");
      const response = await balancesGet(request);

      expect(response.status).toBe(200);
      expect(mocks.requireOwnedProfile).toHaveBeenCalledWith(request, "user-1");
      expect(mocks.getBinanceBalancesStatus).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          trace: expect.objectContaining({ isEnabled: false })
        })
      );
      await expect(response.json()).resolves.toMatchObject({
        balances: [{ tokenSymbol: "BTC", eurValue: 30_000 }],
        syncedAt: "2026-01-02T03:04:05.000Z",
        isStale: false,
        hasApiKey: true
      });
    });

    it("preserves auth guard responses before loading balances", async () => {
      const authError = new Error("auth");
      const authResponse = NextResponse.json(
        { error: "Profilo non trovato." },
        { status: 404 }
      );
      mocks.requireOwnedProfile.mockRejectedValueOnce(authError);
      mocks.authGuardResponse.mockReturnValueOnce(authResponse);

      const response = await balancesGet(makeGetRequest("/api/binance/balances", "user-1"));

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "Profilo non trovato." });
      expect(mocks.getBinanceBalancesStatus).not.toHaveBeenCalled();
    });
  });

  for (const route of routes) {
    describe(route.name, () => {
      it("rejects malformed JSON bodies", async () => {
        const response = await route.post(
          new Request(`http://localhost${route.path}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Origin: "http://localhost"
            },
            body: "{"
          })
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: "Invalid request body." });
        expect(mocks.syncBinanceProfile).not.toHaveBeenCalled();
      });

      it("rejects requests without a same-origin signal", async () => {
        const response = await route.post(
          new Request(`http://localhost${route.path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "user-1" })
          })
        );

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toEqual({ error: "Request origin not allowed." });
        expect(mocks.syncBinanceProfile).not.toHaveBeenCalled();
      });

      it("requires a userId", async () => {
        const response = await route.post(makeRequest(route.path, {}));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: "userId is required." });
        expect(mocks.syncBinanceProfile).not.toHaveBeenCalled();
      });

      it("returns auth guard responses before syncing", async () => {
        const authError = new Error("auth");
        const authResponse = NextResponse.json(
          { error: "Profilo non trovato." },
          { status: 404 }
        );
        mocks.requireOwnedProfile.mockRejectedValueOnce(authError);
        mocks.authGuardResponse.mockReturnValueOnce(authResponse);

        const response = await route.post(makeRequest(route.path));

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({ error: "Profilo non trovato." });
        expect(mocks.authGuardResponse).toHaveBeenCalledWith(authError);
        expect(mocks.syncBinanceProfile).not.toHaveBeenCalled();
      });

      it("rejects missing Binance credentials", async () => {
        mocks.syncBinanceProfile.mockRejectedValueOnce(
          new mocks.BinanceMissingCredentialsError("API key non configurata.")
        );

        const response = await route.post(makeRequest(route.path));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: "API key non configurata." });
        expect(mocks.syncBinanceProfile).toHaveBeenCalledWith(
          "user-1",
          expect.objectContaining({
            trace: expect.objectContaining({ isEnabled: false })
          })
        );
      });

      it("uses the shared Binance sync service and returns balances with syncedAt", async () => {
        const request = makeRequest(route.path);
        const response = await route.post(request);

        expect(response.status).toBe(200);
        expect(mocks.requireOwnedProfile).toHaveBeenCalledWith(request, "user-1");
        expect(mocks.syncBinanceProfile).toHaveBeenCalledWith(
          "user-1",
          expect.objectContaining({
            trace: expect.objectContaining({ isEnabled: false })
          })
        );
        await expect(response.json()).resolves.toMatchObject({
          success: true,
          balances: [{ tokenSymbol: "BTC", eurValue: 30_000 }],
          syncedAt: "2026-01-02T03:04:05.000Z"
        });
      });

      it("passes shared Binance API errors through with their status", async () => {
        mocks.syncBinanceProfile.mockRejectedValueOnce(
          new mocks.BinanceApiError("Invalid API-key", 400)
        );

        const response = await route.post(makeRequest(route.path));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: "Invalid API-key" });
      });

      it("preserves route-specific generic errors for unexpected failures", async () => {
        mocks.syncBinanceProfile.mockRejectedValueOnce(new Error("network down"));

        const response = await route.post(makeRequest(route.path));

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({
          error: route.name === "connect"
            ? "Errore di connessione a Binance."
            : "Errore di sincronizzazione Binance."
        });
      });
    });
  }
});
