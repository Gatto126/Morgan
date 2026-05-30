import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authHandler: vi.fn(),
  getTrustedOrigins: vi.fn(),
  logError: vi.fn(),
  logRequest: vi.fn(),
  logResponse: vi.fn()
}));

vi.mock("@/server/auth/auth", () => ({
  auth: {
    handler: mocks.authHandler
  }
}));

vi.mock("@/server/security/auth-config", () => ({
  getTrustedOrigins: mocks.getTrustedOrigins
}));

vi.mock("@/server/logging/logger", () => ({
  apiLogger: () => ({
    error: mocks.logError,
    request: mocks.logRequest,
    response: mocks.logResponse
  })
}));

import { GET, POST } from "@/app/api/logout/route";

function makeRequest(options: {
  accept?: string;
  cookie?: string;
  method?: string;
  origin?: string | null;
  url?: string;
} = {}) {
  const url = options.url ?? "http://localhost/api/logout";
  const headers = new Headers();

  headers.set("Accept", options.accept ?? "application/json");
  if (options.origin !== null) {
    headers.set("Origin", options.origin ?? new URL(url).origin);
  }
  if (options.cookie) {
    headers.set("Cookie", options.cookie);
  }

  return new Request(url, {
    headers,
    method: options.method ?? "POST"
  });
}

function getSetCookie(response: Response) {
  return response.headers.get("set-cookie") ?? "";
}

describe("POST /api/logout", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.getTrustedOrigins.mockReturnValue([]);
    mocks.authHandler.mockResolvedValue(new Response(null, {
      headers: {
        "set-cookie": "better-auth.session_token=deleted; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
      },
      status: 200
    }));
  });

  it("clears Better Auth cookies for JSON logout requests", async () => {
    const response = await POST(makeRequest({
      cookie: "better-auth.session_token=abc; better-auth.extra=value; other=value"
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mocks.authHandler).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST"
    }));

    const setCookie = getSetCookie(response);
    expect(setCookie).toContain("better-auth.session_token=");
    expect(setCookie).toContain("better-auth.extra=");
    expect(setCookie).toContain("__Host-better-auth.session_token=");
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).not.toContain("other=");
  });

  it("redirects form logout requests back to the app root", async () => {
    const response = await POST(makeRequest({
      accept: "text/html",
      url: "https://morgan.test/api/logout"
    }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://morgan.test/");
    expect(getSetCookie(response)).toContain("Secure");
  });

  it("supports navigable GET logout requests", async () => {
    const response = await GET(makeRequest({
      accept: "text/html",
      cookie: "better-auth.session_token=abc",
      method: "GET"
    }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/");
    expect(getSetCookie(response)).toContain("better-auth.session_token=");
  });

  it("accepts logout requests without an origin signal", async () => {
    const response = await POST(makeRequest({ origin: null }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(getSetCookie(response)).toContain("better-auth.session_token=");
  });

  it("rejects logout requests with a cross-origin signal", async () => {
    const response = await POST(makeRequest({ origin: "https://evil.example" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Request origin not allowed." });
    expect(mocks.authHandler).not.toHaveBeenCalled();
  });
});
