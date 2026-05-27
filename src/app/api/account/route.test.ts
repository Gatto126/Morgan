import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  authGuardResponse: vi.fn(),
  authAccountFindFirst: vi.fn(),
  requireAuth: vi.fn(),
  logError: vi.fn(),
  logRequest: vi.fn(),
  logResponse: vi.fn(),
  profileFindMany: vi.fn(),
  investmentFindMany: vi.fn(),
  cryptoFindMany: vi.fn(),
  binanceBalanceFindMany: vi.fn(),
  transaction: vi.fn(),
  tx: {
    checkingTransaction: { deleteMany: vi.fn() },
    investmentTransaction: { deleteMany: vi.fn() },
    cryptoTransaction: { deleteMany: vi.fn() },
    binanceBalance: { deleteMany: vi.fn() },
    user: { deleteMany: vi.fn(), count: vi.fn() },
    authSession: { deleteMany: vi.fn() },
    authAccount: { deleteMany: vi.fn() },
    authUser: { deleteMany: vi.fn() },
    assetHistory: { deleteMany: vi.fn() },
    asset: { deleteMany: vi.fn() },
    cryptoAsset: { deleteMany: vi.fn() },
    priceCache: { deleteMany: vi.fn() },
  },
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/auth-guard", () => ({
  authGuardResponse: mocks.authGuardResponse,
  requireAuth: mocks.requireAuth,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    authAccount: {
      findFirst: mocks.authAccountFindFirst,
    },
    user: {
      findMany: mocks.profileFindMany,
    },
    investmentTransaction: {
      findMany: mocks.investmentFindMany,
    },
    cryptoTransaction: {
      findMany: mocks.cryptoFindMany,
    },
    binanceBalance: {
      findMany: mocks.binanceBalanceFindMany,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("better-auth/crypto", () => ({
  verifyPassword: mocks.verifyPassword,
}));

vi.mock("@/lib/logger", () => ({
  apiLogger: () => ({
    error: mocks.logError,
    request: mocks.logRequest,
    response: mocks.logResponse,
  }),
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
    body: options.rawBody ?? JSON.stringify(body),
  });
}

function resetTxMocks() {
  for (const model of Object.values(mocks.tx)) {
    for (const fn of Object.values(model)) {
      fn.mockReset();
    }
  }
}

describe("DELETE /api/account", () => {
  beforeEach(() => {
    mocks.authGuardResponse.mockReset();
    mocks.authAccountFindFirst.mockReset();
    mocks.requireAuth.mockReset();
    mocks.logError.mockReset();
    mocks.logRequest.mockReset();
    mocks.logResponse.mockReset();
    mocks.profileFindMany.mockReset();
    mocks.investmentFindMany.mockReset();
    mocks.cryptoFindMany.mockReset();
    mocks.binanceBalanceFindMany.mockReset();
    mocks.transaction.mockReset();
    mocks.verifyPassword.mockReset();
    resetTxMocks();

    mocks.authGuardResponse.mockReturnValue(null);
    mocks.requireAuth.mockResolvedValue({ user: { id: "owner-1", name: "Luca" } });
    mocks.authAccountFindFirst.mockResolvedValue({ password: "hashed-password" });
    mocks.profileFindMany.mockResolvedValue([{ id: "profile-1" }]);
    mocks.investmentFindMany.mockResolvedValue([]);
    mocks.cryptoFindMany.mockResolvedValue([]);
    mocks.binanceBalanceFindMany.mockResolvedValue([]);
    mocks.transaction.mockImplementation(async (callback) => callback(mocks.tx));
    mocks.verifyPassword.mockResolvedValue(true);

    for (const model of Object.values(mocks.tx)) {
      for (const fn of Object.values(model)) {
        fn.mockResolvedValue({ count: 0 });
      }
    }

    mocks.tx.user.count.mockResolvedValue(0);
  });

  it("preserves auth guard responses", async () => {
    const authError = new Error("auth");
    const authResponse = NextResponse.json({ error: "Autenticazione richiesta." }, { status: 401 });
    mocks.requireAuth.mockRejectedValueOnce(authError);
    mocks.authGuardResponse.mockReturnValueOnce(authResponse);

    const response = await DELETE(makeRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Autenticazione richiesta." });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects destructive requests without a same-origin signal", async () => {
    const response = await DELETE(makeRequest({ password: "Secret1" }, { origin: null }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Request origin not allowed." });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON before deleting anything", async () => {
    const response = await DELETE(makeRequest(undefined, { rawBody: "{" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request body." });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("requires a password field", async () => {
    const response = await DELETE(makeRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Password is required." });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid passwords without deleting anything", async () => {
    mocks.verifyPassword.mockResolvedValueOnce(false);

    const response = await DELETE(makeRequest({ password: "Wrong1" }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Password confirmation is invalid.",
    });
    expect(mocks.authAccountFindFirst).toHaveBeenCalledWith({
      where: {
        userId: "owner-1",
        providerId: "credential",
        password: { not: null },
      },
      select: { password: true },
    });
    expect(mocks.verifyPassword).toHaveBeenCalledWith({
      hash: "hashed-password",
      password: "Wrong1",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects users without a credential password", async () => {
    mocks.authAccountFindFirst.mockResolvedValueOnce(null);

    const response = await DELETE(makeRequest({ password: "Secret1" }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Password confirmation is invalid.",
    });
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
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
      error: "Too many failed account deletion attempts.",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("accepts a valid password and runs the deletion transaction", async () => {
    const response = await DELETE(makeRequest({ password: "Secret1" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      deletedProfiles: 1,
      cleanupMode: "full",
    });
    expect(mocks.verifyPassword).toHaveBeenCalledWith({
      hash: "hashed-password",
      password: "Secret1",
    });
    expect(mocks.profileFindMany).toHaveBeenCalledWith({
      where: { ownerId: "owner-1" },
      select: { id: true },
    });
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.tx.authUser.deleteMany).toHaveBeenCalledWith({ where: { id: "owner-1" } });
  });
});
