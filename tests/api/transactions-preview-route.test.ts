import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authGuardResponse: vi.fn(),
  requireAuth: vi.fn(),
  requireOwnedProfile: vi.fn(),
  assertUserExists: vi.fn(),
  getExistingFingerprints: vi.fn(),
  markPreviewTransactions: vi.fn(),
  parseTradeRepublicCsv: vi.fn(),
  parseBbvaXlsxStatement: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logRequest: vi.fn(),
  logResponse: vi.fn()
}));

vi.mock("@/server/auth/auth-guard", () => ({
  authGuardResponse: mocks.authGuardResponse,
  requireAuth: mocks.requireAuth,
  requireOwnedProfile: mocks.requireOwnedProfile
}));

vi.mock("@/server/services/transaction-import", () => ({
  assertUserExists: mocks.assertUserExists,
  getExistingFingerprints: mocks.getExistingFingerprints,
  markPreviewTransactions: mocks.markPreviewTransactions
}));

vi.mock("@/domain/imports/trade-republic-csv-parser", () => ({
  parseTradeRepublicCsv: mocks.parseTradeRepublicCsv
}));

vi.mock("@/domain/imports/bbva-xlsx-parser", () => ({
  parseBbvaXlsxStatement: mocks.parseBbvaXlsxStatement
}));

vi.mock("@/server/logging/logger", () => ({
  apiLogger: () => ({
    error: mocks.logError,
    info: mocks.logInfo,
    request: mocks.logRequest,
    response: mocks.logResponse
  })
}));

import { POST } from "@/app/api/transactions/preview/route";

function makeRequest(formData: () => Promise<FormData>) {
  return {
    headers: new Headers({ Origin: "http://localhost" }),
    url: "http://localhost/api/transactions/preview",
    formData
  } as unknown as Request;
}

describe("transactions preview API route", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.authGuardResponse.mockReturnValue(null);
    mocks.requireAuth.mockResolvedValue({ user: { id: "owner-1" } });
    mocks.requireOwnedProfile.mockResolvedValue({ session: { user: { id: "owner-1" } }, profile: { id: "profile-1" } });
    mocks.assertUserExists.mockResolvedValue({ id: "profile-1", name: "Main" });
    mocks.getExistingFingerprints.mockResolvedValue(new Set<string>());
    mocks.markPreviewTransactions.mockImplementation((transactions) => transactions);
  });

  it("requires authentication before parsing multipart form data", async () => {
    const authError = new Error("Autenticazione richiesta.");
    const formData = vi.fn(async () => new FormData());

    mocks.requireAuth.mockRejectedValueOnce(authError);
    mocks.authGuardResponse.mockImplementation((error) =>
      error === authError ? Response.json({ error: "Autenticazione richiesta." }, { status: 401 }) : null
    );

    const response = await POST(makeRequest(formData));

    expect(response.status).toBe(401);
    expect(formData).not.toHaveBeenCalled();
  });
});
