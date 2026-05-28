import { describe, expect, it } from "vitest";

import { internalServerErrorResponse } from "@/server/api/error-response";

describe("API error responses", () => {
  it("returns a generic 500 payload without exposing the original error", async () => {
    const response = internalServerErrorResponse("Errore durante il caricamento.");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Errore durante il caricamento."
    });
  });
});
