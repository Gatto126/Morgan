import { describe, expect, it } from "vitest";

import { parseBbvaXlsxStatement } from "@/domain/imports/bbva-xlsx-parser";
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
});
