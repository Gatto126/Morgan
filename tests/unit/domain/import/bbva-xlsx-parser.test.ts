import { describe, expect, it, vi } from "vitest";

import { BbvaXlsxParseError, parseBbvaXlsxStatement } from "@/domain/imports/bbva-xlsx-parser";
import { BBVA_INSTITUTION } from "@/shared/institutions";
import { buildXlsxFile } from "../../../fixtures/imports/xlsx";

describe("parseBbvaXlsxStatement", () => {
  it("parses BBVA rows from the real statement layout", async () => {
    const document = await parseBbvaXlsxStatement(
      buildXlsxFile([
        ["Header 1"],
        ["Header 2"],
        ["Header 3"],
        ["Header 4"],
        [null, "Data valuta", "Data", "Parola chiave", "Movimento", "Importo", "Valuta", "Disponibile", "Valuta", "Osservazioni"],
        [null, "31/01/2024", "01/02/2024", "Bonifico ricevuto", "Altro", 123.45, "EUR", 1123.45, "EUR", "Stipendio"],
        [null, "01/02/2024", "02/02/2024", "Pagamento con carta", "Carta", -23.4, "EUR", 1100.05, "EUR", "Spesa supermercato"]
      ], "bbva.xlsx")
    );

    expect(document.sourceInstitution).toBe(BBVA_INSTITUTION);
    expect(document.fileName).toBe("bbva.xlsx");
    expect(document.transactions).toHaveLength(2);
    expect(document.transactions[0]).toMatchObject({
      rawDateLabel: "01/02/2024",
      typeLabel: "Bonifico ricevuto",
      description: "Stipendio",
      direction: "IN",
      amountCents: 12_345,
      balanceCents: 112_345,
      currency: "EUR"
    });
    expect(document.transactions[1]).toMatchObject({
      rawDateLabel: "02/02/2024",
      typeLabel: "Pagamento con carta",
      description: "Spesa supermercato",
      direction: "OUT",
      amountCents: 2_340,
      balanceCents: 110_005,
      currency: "EUR"
    });
  });

  it("maps transaction columns by header name and accepts signed balances", async () => {
    const document = await parseBbvaXlsxStatement(
      buildXlsxFile([
        ["Report BBVA"],
        ["Data", "Parola chiave", "Importo", "Disponibile", "Osservazioni"],
        ["03/02/2024", "Cashback promozione commerciale", "0,07", "-12,50", "CASHBACK BBVA"]
      ])
    );

    expect(document.transactions).toHaveLength(1);
    expect(document.transactions[0]).toMatchObject({
      rawDateLabel: "03/02/2024",
      typeLabel: "Cashback promozione commerciale",
      description: "CASHBACK BBVA",
      direction: "IN",
      amountCents: 7,
      balanceCents: -1_250
    });
  });

  it("parses BBVA movement-only rows when an existing balance anchor is available", async () => {
    const resolveMovementOnlyBalanceAnchor = vi.fn(async (range) => {
      expect(range).toEqual({
        earliestBookingDate: "2026-05-03T00:00:00.000Z",
        latestBookingDate: "2026-05-05T00:00:00.000Z"
      });

      return {
        kind: "before-start" as const,
        balanceCents: 10_000
      };
    });
    const document = await parseBbvaXlsxStatement(
      buildXlsxFile([
        ["Movimenti"],
        [null, "Data valuta", "Data", "Causale", "Movimento", "Beneficiario", "Importo"],
        [null, "01/05/2026", "05/05/2026", "LIQUIDAZIONE INTERESSI-COMMISSIONI-SPESE", null, "-\n-", "0.02 EUR"],
        [null, "04/05/2026", "04/05/2026", "CASHBACK PROMOZIONE COMMERCIALE", "ALTRO", "-\n-", "0.12 EUR"],
        [null, "03/05/2026", "03/05/2026", "IPER SERRAVALLE 19", "PAGAMENTO CON CARTA", "-\n-", "-3.38 EUR"]
      ], "bbva-alice.excel"),
      { resolveMovementOnlyBalanceAnchor }
    );

    expect(resolveMovementOnlyBalanceAnchor).toHaveBeenCalledTimes(1);
    expect(document.fileName).toBe("bbva-alice.excel");
    expect(document.transactions).toHaveLength(3);
    expect(document.transactions[0]).toMatchObject({
      rawDateLabel: "05/05/2026",
      typeLabel: "LIQUIDAZIONE INTERESSI-COMMISSIONI-SPESE",
      description: "LIQUIDAZIONE INTERESSI-COMMISSIONI-SPESE",
      direction: "IN",
      amountCents: 2,
      balanceCents: 9_676
    });
    expect(document.transactions[1]).toMatchObject({
      rawDateLabel: "04/05/2026",
      typeLabel: "CASHBACK PROMOZIONE COMMERCIALE",
      description: "CASHBACK PROMOZIONE COMMERCIALE",
      direction: "IN",
      amountCents: 12,
      balanceCents: 9_674
    });
    expect(document.transactions[2]).toMatchObject({
      rawDateLabel: "03/05/2026",
      typeLabel: "PAGAMENTO CON CARTA",
      description: "IPER SERRAVALLE 19",
      direction: "OUT",
      amountCents: 338,
      balanceCents: 9_662
    });
  });

  it("rejects BBVA movement-only rows without a safe balance anchor", async () => {
    await expect(parseBbvaXlsxStatement(
      buildXlsxFile([
        [null, "Data valuta", "Data", "Causale", "Movimento", "Beneficiario", "Importo"],
        [null, "03/05/2026", "03/05/2026", "IPER SERRAVALLE 19", "PAGAMENTO CON CARTA", "-\n-", "-3.38 EUR"]
      ], "bbva-alice.excel")
    )).rejects.toThrow(BbvaXlsxParseError);
  });
});
