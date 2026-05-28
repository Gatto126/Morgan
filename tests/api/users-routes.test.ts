import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class ProfileConflictError extends Error {}
  class ProfileNotFoundError extends Error {}
  class ProfileBadRequestError extends Error {}

  return {
    ProfileConflictError,
    ProfileNotFoundError,
    ProfileBadRequestError,
    authGuardResponse: vi.fn(),
    requireAuth: vi.fn(),
    requireOwnedProfile: vi.fn(),
    listProfiles: vi.fn(),
    createProfile: vi.fn(),
    getProfile: vi.fn(),
    deleteProfile: vi.fn(),
    updateProfileBinanceSettings: vi.fn(),
    logError: vi.fn(),
    logInfo: vi.fn(),
    logRequest: vi.fn(),
    logResponse: vi.fn()
  };
});

vi.mock("@/server/auth/auth-guard", () => ({
  authGuardResponse: mocks.authGuardResponse,
  requireAuth: mocks.requireAuth,
  requireOwnedProfile: mocks.requireOwnedProfile
}));

vi.mock("@/server/services/profile-service", () => ({
  ProfileConflictError: mocks.ProfileConflictError,
  ProfileNotFoundError: mocks.ProfileNotFoundError,
  ProfileBadRequestError: mocks.ProfileBadRequestError,
  listProfiles: mocks.listProfiles,
  createProfile: mocks.createProfile,
  getProfile: mocks.getProfile,
  deleteProfile: mocks.deleteProfile,
  updateProfileBinanceSettings: mocks.updateProfileBinanceSettings
}));

vi.mock("@/server/logging/logger", () => ({
  apiLogger: () => ({
    error: mocks.logError,
    info: mocks.logInfo,
    request: mocks.logRequest,
    response: mocks.logResponse
  })
}));

import { GET as GET_USERS, POST } from "@/app/api/users/route";
import {
  DELETE,
  GET as GET_USER,
  PATCH
} from "@/app/api/users/[id]/route";

function request(method: string, body?: unknown, origin: string | null = "http://localhost") {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  if (origin !== null) {
    headers.set("Origin", origin);
  }

  return new Request("http://localhost/api/users", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

function context(id = "profile-1") {
  return { params: Promise.resolve({ id }) };
}

describe("users API routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      if ("mockReset" in mock) {
        mock.mockReset();
      }
    }

    mocks.authGuardResponse.mockReturnValue(null);
    mocks.requireAuth.mockResolvedValue({ user: { id: "owner-1", name: "Luca" } });
    mocks.requireOwnedProfile.mockResolvedValue({ session: { user: { id: "owner-1" } }, profile: { id: "profile-1" } });
    mocks.listProfiles.mockResolvedValue([{ id: "profile-1", name: "Main", transactionCount: 0 }]);
    mocks.createProfile.mockResolvedValue({
      user: { id: "profile-1", name: "Main", transactionCount: 0 },
      users: [{ id: "profile-1", name: "Main", transactionCount: 0 }]
    });
    mocks.getProfile.mockResolvedValue({ id: "profile-1", name: "Main" });
    mocks.deleteProfile.mockResolvedValue({
      isinsToDelete: [],
      tokensToDelete: [],
      priceCacheKeysToDelete: ["binance_sync_profile-1"]
    });
    mocks.updateProfileBinanceSettings.mockResolvedValue({ id: "profile-1", name: "Main" });
  });

  it("lists profiles for the authenticated owner", async () => {
    const response = await GET_USERS(request("GET"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      users: [{ id: "profile-1", name: "Main", transactionCount: 0 }]
    });
    expect(mocks.listProfiles).toHaveBeenCalledWith("owner-1");
  });

  it("maps duplicate profile creation to 409", async () => {
    mocks.createProfile.mockRejectedValueOnce(new mocks.ProfileConflictError("This profile already exists."));

    const response = await POST(request("POST", { name: "Main" }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "This profile already exists." });
  });

  it("rejects profile creation without a same-origin signal", async () => {
    const response = await POST(request("POST", { name: "Main" }, null));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Request origin not allowed." });
    expect(mocks.createProfile).not.toHaveBeenCalled();
  });

  it("maps missing profile reads to 404", async () => {
    mocks.getProfile.mockRejectedValueOnce(new mocks.ProfileNotFoundError("Profile not found."));

    const response = await GET_USER(request("GET"), context("missing"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Profile not found." });
  });

  it("deletes an owned profile through the service", async () => {
    const response = await DELETE(request("DELETE"), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mocks.requireOwnedProfile).toHaveBeenCalledWith(expect.any(Request), "profile-1");
    expect(mocks.deleteProfile).toHaveBeenCalledWith("profile-1");
  });

  it("maps invalid Binance settings to 400", async () => {
    mocks.updateProfileBinanceSettings.mockRejectedValueOnce(
      new mocks.ProfileBadRequestError("API key and secret must be updated together.")
    );

    const response = await PATCH(request("PATCH", { apiKey: "only-key" }), context());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "API key and secret must be updated together."
    });
  });
});
