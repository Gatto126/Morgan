import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

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
    decryptBinanceCredentials: vi.fn(),
    findUnique: vi.fn(),
    logError: vi.fn(),
    logInfo: vi.fn(),
    logRequest: vi.fn(),
    logResponse: vi.fn(),
    requireOwnedProfile: vi.fn(),
    syncBinanceBalances: vi.fn(),
    BinanceApiError: MockBinanceApiError,
  };
});

vi.mock("@/lib/auth-guard", () => ({
  authGuardResponse: mocks.authGuardResponse,
  requireOwnedProfile: mocks.requireOwnedProfile,
}));

vi.mock("@/lib/binance-service", () => ({
  BinanceApiError: mocks.BinanceApiError,
  syncBinanceBalances: mocks.syncBinanceBalances,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  apiLogger: () => ({
    error: mocks.logError,
    info: mocks.logInfo,
    request: mocks.logRequest,
    response: mocks.logResponse,
  }),
}));

vi.mock("@/lib/secrets", () => ({
  decryptBinanceCredentials: mocks.decryptBinanceCredentials,
}));

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
  updatedAt: syncedAt,
};
const credentials = { apiKey: "api-key", secret: "secret" };
const user = { id: "user-1" };

function makeRequest(path: string, body: unknown = { userId: "user-1" }) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const routes = [
  { name: "connect", path: "/api/binance/connect", post: connectPost },
  { name: "sync", path: "/api/binance/sync", post: syncPost },
];

describe("binance API routes", () => {
  beforeEach(() => {
    mocks.authGuardResponse.mockReset();
    mocks.decryptBinanceCredentials.mockReset();
    mocks.findUnique.mockReset();
    mocks.logError.mockReset();
    mocks.logInfo.mockReset();
    mocks.logRequest.mockReset();
    mocks.logResponse.mockReset();
    mocks.requireOwnedProfile.mockReset();
    mocks.syncBinanceBalances.mockReset();

    mocks.authGuardResponse.mockReturnValue(null);
    mocks.findUnique.mockResolvedValue(user);
    mocks.decryptBinanceCredentials.mockReturnValue(credentials);
    mocks.syncBinanceBalances.mockResolvedValue({
      balances: [persistedBalance],
      syncedAt,
    });
  });

  for (const route of routes) {
    describe(route.name, () => {
      it("rejects malformed JSON bodies", async () => {
        const response = await route.post(
          new Request(`http://localhost${route.path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{",
          })
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: "Invalid request body." });
        expect(mocks.syncBinanceBalances).not.toHaveBeenCalled();
      });

      it("requires a userId", async () => {
        const response = await route.post(makeRequest(route.path, {}));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: "userId is required." });
        expect(mocks.syncBinanceBalances).not.toHaveBeenCalled();
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
        expect(mocks.findUnique).not.toHaveBeenCalled();
        expect(mocks.syncBinanceBalances).not.toHaveBeenCalled();
      });

      it("rejects missing Binance credentials", async () => {
        mocks.decryptBinanceCredentials.mockReturnValueOnce(null);

        const response = await route.post(makeRequest(route.path));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: "API key non configurata." });
        expect(mocks.syncBinanceBalances).not.toHaveBeenCalled();
      });

      it("uses the shared Binance sync service and returns balances with syncedAt", async () => {
        const request = makeRequest(route.path);
        const response = await route.post(request);

        expect(response.status).toBe(200);
        expect(mocks.requireOwnedProfile).toHaveBeenCalledWith(request, "user-1");
        expect(mocks.findUnique).toHaveBeenCalledWith({ where: { id: "user-1" } });
        expect(mocks.decryptBinanceCredentials).toHaveBeenCalledWith(user);
        expect(mocks.syncBinanceBalances).toHaveBeenCalledWith("user-1", credentials);
        await expect(response.json()).resolves.toMatchObject({
          success: true,
          balances: [{ tokenSymbol: "BTC", eurValue: 30_000 }],
          syncedAt: "2026-01-02T03:04:05.000Z",
        });
      });

      it("passes shared Binance API errors through with their status", async () => {
        mocks.syncBinanceBalances.mockRejectedValueOnce(
          new mocks.BinanceApiError("Invalid API-key", 400)
        );

        const response = await route.post(makeRequest(route.path));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: "Invalid API-key" });
      });

      it("preserves route-specific generic errors for unexpected failures", async () => {
        mocks.syncBinanceBalances.mockRejectedValueOnce(new Error("network down"));

        const response = await route.post(makeRequest(route.path));

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({
          error: route.name === "connect"
            ? "Errore di connessione a Binance."
            : "Errore di sincronizzazione Binance.",
        });
      });
    });
  }
});
