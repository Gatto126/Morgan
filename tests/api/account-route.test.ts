import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authGuardResponse: vi.fn(),
  requireAuth: vi.fn(),
  getCredentialPassword: vi.fn(),
  listProfileIds: vi.fn(),
  listInvestmentIsins: vi.fn(),
  listCryptoTokens: vi.fn(),
  listBinanceTokens: vi.fn(),
  listOtherInvestmentIsins: vi.fn(),
  listOtherCryptoTokens: vi.fn(),
  listOtherBinanceTokens: vi.fn(),
  deleteAccountData: vi.fn(),
  logError: vi.fn(),
  logRequest: vi.fn(),
  logResponse: vi.fn(),
  verifyPassword: vi.fn()
}));

vi.mock("@/server/auth/auth-guard", () => ({
  authGuardResponse: mocks.authGuardResponse,
  requireAuth: mocks.requireAuth
}));

vi.mock("@/server/repositories/account-deletion-repository", () => ({
  accountDeletionRepository: {
    getCredentialPassword: mocks.getCredentialPassword,
    listProfileIds: mocks.listProfileIds,
    listInvestmentIsins: mocks.listInvestmentIsins,
    listCryptoTokens: mocks.listCryptoTokens,
    listBinanceTokens: mocks.listBinanceTokens,
    listOtherInvestmentIsins: mocks.listOtherInvestmentIsins,
    listOtherCryptoTokens: mocks.listOtherCryptoTokens,
    listOtherBinanceTokens: mocks.listOtherBinanceTokens,
    deleteAccountData: mocks.deleteAccountData
  }
}));

vi.mock("better-auth/crypto", () => ({
  verifyPassword: mocks.verifyPassword
}));

vi.mock("@/server/logging/logger", () => ({
  apiLogger: () => ({
    error: mocks.logError,
    request: mocks.logRequest,
    response: mocks.logResponse
  })
}));

import { DELETE } from "@/app/api/account/route";

function makeRequest(
  body: unknown = { password: "Secret1" },
  options: { origin?: string | null; rawBody?: string } = {}
) {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");

  if (options.origin !== null) {
    headers.set("Origin", options.origin ?? "http://localhost");
  }

  return new Request("http://localhost/api/account", {
    method: "DELETE",
    headers,
    body: options.rawBody ?? JSON.stringify(body)
  });
}

describe("DELETE /api/account", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.authGuardResponse.mockReturnValue(null);
    mocks.requireAuth.mockResolvedValue({ user: { id: "owner-1", name: "Luca" } });
    mocks.getCredentialPassword.mockResolvedValue("hashed-password");
    mocks.listProfileIds.mockResolvedValue(["profile-1"]);
    mocks.listInvestmentIsins.mockResolvedValue([]);
    mocks.listCryptoTokens.mockResolvedValue([]);
    mocks.listBinanceTokens.mockResolvedValue([]);
    mocks.listOtherInvestmentIsins.mockResolvedValue([]);
    mocks.listOtherCryptoTokens.mockResolvedValue([]);
    mocks.listOtherBinanceTokens.mockResolvedValue([]);
    mocks.deleteAccountData.mockResolvedValue({
      cleanupMode: "full",
      deletedHistory: 0,
      deletedAssets: 0,
      deletedCryptoAssets: 0,
      deletedPriceCache: 0
    });
    mocks.verifyPassword.mockResolvedValue(true);
  });

  it("preserves auth guard responses", async () => {
    const authError = new Error("auth");
    const authResponse = NextResponse.json({ error: "Autenticazione richiesta." }, { status: 401 });
    mocks.requireAuth.mockRejectedValueOnce(authError);
    mocks.authGuardResponse.mockReturnValueOnce(authResponse);

    const response = await DELETE(makeRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Autenticazione richiesta." });
    expect(mocks.deleteAccountData).not.toHaveBeenCalled();
  });

  it("rejects destructive requests without a same-origin signal", async () => {
    const response = await DELETE(makeRequest({ password: "Secret1" }, { origin: null }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Request origin not allowed." });
    expect(mocks.deleteAccountData).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON before deleting anything", async () => {
    const response = await DELETE(makeRequest(undefined, { rawBody: "{" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request body." });
    expect(mocks.deleteAccountData).not.toHaveBeenCalled();
  });

  it("requires a password field", async () => {
    const response = await DELETE(makeRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Password is required." });
    expect(mocks.deleteAccountData).not.toHaveBeenCalled();
  });

  it("rejects invalid passwords without deleting anything", async () => {
    mocks.verifyPassword.mockResolvedValueOnce(false);

    const response = await DELETE(makeRequest({ password: "Wrong1" }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Password confirmation is invalid."
    });
    expect(mocks.getCredentialPassword).toHaveBeenCalledWith("owner-1");
    expect(mocks.verifyPassword).toHaveBeenCalledWith({
      hash: "hashed-password",
      password: "Wrong1"
    });
    expect(mocks.deleteAccountData).not.toHaveBeenCalled();
  });

  it("rejects users without a credential password", async () => {
    mocks.getCredentialPassword.mockResolvedValueOnce(null);

    const response = await DELETE(makeRequest({ password: "Secret1" }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Password confirmation is invalid."
    });
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
    expect(mocks.deleteAccountData).not.toHaveBeenCalled();
  });

  it("rate limits repeated failed password confirmations", async () => {
    mocks.requireAuth.mockResolvedValue({ user: { id: "owner-rate", name: "Luca" } });
    mocks.verifyPassword.mockResolvedValue(false);

    for (let index = 0; index < 5; index++) {
      const response = await DELETE(makeRequest({ password: "Wrong1" }));
      expect(response.status).toBe(422);
    }

    const response = await DELETE(makeRequest({ password: "Wrong1" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      error: "Too many failed account deletion attempts."
    });
    expect(mocks.deleteAccountData).not.toHaveBeenCalled();
  });

  it("accepts a valid password and runs the deletion repository workflow", async () => {
    const response = await DELETE(makeRequest({ password: "Secret1" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      deletedProfiles: 1,
      cleanupMode: "full"
    });
    expect(mocks.verifyPassword).toHaveBeenCalledWith({
      hash: "hashed-password",
      password: "Secret1"
    });
    expect(mocks.listProfileIds).toHaveBeenCalledWith("owner-1");
    expect(mocks.deleteAccountData).toHaveBeenCalledWith("owner-1", {
      profileIds: ["profile-1"],
      isinsToDelete: [],
      tokensToDelete: [],
      scopedPriceCacheKeys: ["binance_sync_profile-1"]
    });
  });
});
