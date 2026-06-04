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
  BbvaXlsxParseError: class BbvaXlsxParseError extends Error {},
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

  it("routes BBVA .excel files through the BBVA XLSX parser", async () => {
    const file = new File(["xlsx"], "bbva alice.excel", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const formData = new FormData();
    formData.set("userId", "profile-1");
    formData.set("file", file);
    const transaction = {
      fingerprint: "bbva-1",
      sourceInstitution: "bbva",
      pageNumber: 1,
      bookingDate: "2026-05-03T00:00:00.000Z",
      rawDateLabel: "03/05/2026",
      typeLabel: "PAGAMENTO CON CARTA",
      description: "IPER SERRAVALLE 19",
      direction: "OUT",
      amountCents: 338,
      balanceCents: 9662,
      currency: "EUR"
    };

    mocks.parseBbvaXlsxStatement.mockResolvedValue({
      sourceInstitution: "bbva",
      fileName: "bbva alice.excel",
      transactions: [transaction]
    });

    const response = await POST(makeRequest(async () => formData));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.parseTradeRepublicCsv).not.toHaveBeenCalled();
    expect(mocks.parseBbvaXlsxStatement).toHaveBeenCalledWith(file);
    expect(payload.summary).toMatchObject({
      fileName: "bbva alice.excel",
      sourceInstitution: "bbva",
      totalTransactions: 1
    });
  });
});
