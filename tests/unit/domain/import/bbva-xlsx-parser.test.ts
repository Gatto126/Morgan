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

  it("parses BBVA movement-only rows from the first chronological incoming transaction", async () => {
    const document = await parseBbvaXlsxStatement(
      buildXlsxFile([
        ["Movimenti"],
        [null, "Data valuta", "Data", "Causale", "Movimento", "Beneficiario", "Importo"],
        [null, "01/05/2026", "05/05/2026", "LIQUIDAZIONE INTERESSI-COMMISSIONI-SPESE", null, "-\n-", "0.02 EUR"],
        [null, "04/05/2026", "04/05/2026", "CASHBACK PROMOZIONE COMMERCIALE", "ALTRO", "-\n-", "0.12 EUR"],
        [null, "03/05/2026", "03/05/2026", "IPER SERRAVALLE 19", "PAGAMENTO CON CARTA", "-\n-", "-3.38 EUR"]
      ], "bbva-alice.excel")
    );

    expect(document.fileName).toBe("bbva-alice.excel");
    expect(document.transactions).toHaveLength(3);
    expect(document.transactions[0]).toMatchObject({
      rawDateLabel: "05/05/2026",
      typeLabel: "LIQUIDAZIONE INTERESSI-COMMISSIONI-SPESE",
      description: "LIQUIDAZIONE INTERESSI-COMMISSIONI-SPESE",
      direction: "IN",
      amountCents: 2,
      balanceCents: 14
    });
    expect(document.transactions[1]).toMatchObject({
      rawDateLabel: "04/05/2026",
      typeLabel: "CASHBACK PROMOZIONE COMMERCIALE",
      description: "CASHBACK PROMOZIONE COMMERCIALE",
      direction: "IN",
      amountCents: 12,
      balanceCents: 12
    });
    expect(document.transactions[2]).toMatchObject({
      rawDateLabel: "03/05/2026",
      typeLabel: "IPER SERRAVALLE 19",
      description: "PAGAMENTO CON CARTA",
      direction: "OUT",
      amountCents: 338,
      balanceCents: 0
    });
  });

  it("bootstraps BBVA movement-only rows from the first incoming transaction without an existing anchor", async () => {
    const document = await parseBbvaXlsxStatement(
      buildXlsxFile([
        ["Movimenti"],
        [null, "Data valuta", "Data", "Causale", "Movimento", "Beneficiario", "Importo"],
        [null, "05/05/2026", "05/05/2026", "IPER SERRAVALLE 19", "PAGAMENTO CON CARTA", "-\n-", "-3 EUR"],
        [null, "04/05/2026", "04/05/2026", "CASHBACK PROMOZIONE COMMERCIALE", "ALTRO", "-\n-", "10 EUR"],
        [null, "03/05/2026", "03/05/2026", "GALASSIA", "PAGAMENTO CON CARTA", "-\n-", "-2 EUR"]
      ], "bbva-alice.excel")
    );

    expect(document.transactions).toHaveLength(3);
    expect(document.transactions[0]).toMatchObject({
      rawDateLabel: "05/05/2026",
      direction: "OUT",
      amountCents: 300,
      balanceCents: 700
    });
    expect(document.transactions[1]).toMatchObject({
      rawDateLabel: "04/05/2026",
      direction: "IN",
      amountCents: 1_000,
      balanceCents: 1_000
    });
    expect(document.transactions[2]).toMatchObject({
      rawDateLabel: "03/05/2026",
      direction: "OUT",
      amountCents: 200,
      balanceCents: 0
    });
  });

  it("bootstraps BBVA movement-only rows from zero when there are no incoming transactions", async () => {
    const document = await parseBbvaXlsxStatement(
      buildXlsxFile([
        [null, "Data valuta", "Data", "Causale", "Movimento", "Beneficiario", "Importo"],
        [null, "04/05/2026", "04/05/2026", "IPER SERRAVALLE 19", "PAGAMENTO CON CARTA", "-\n-", "-3 EUR"],
        [null, "03/05/2026", "03/05/2026", "GALASSIA", "PAGAMENTO CON CARTA", "-\n-", "-2 EUR"]
      ], "bbva-alice.excel")
    );

    expect(document.transactions).toHaveLength(2);
    expect(document.transactions[0]).toMatchObject({
      rawDateLabel: "04/05/2026",
      balanceCents: -500
    });
    expect(document.transactions[1]).toMatchObject({
      rawDateLabel: "03/05/2026",
      balanceCents: -200
    });
  });

  it("uses the same fingerprint for the same BBVA movement across statement and movement-only layouts", async () => {
    const statementDocument = await parseBbvaXlsxStatement(
      buildXlsxFile([
        ["Data", "Parola chiave", "Importo", "Disponibile", "Osservazioni"],
        ["22/04/2026", "Costa poco gprs", "-2,25", "3390,70", "5179090010640733 COSTA POCO GPRS"]
      ], "bbva-luca.xlsx")
    );
    const movementOnlyDocument = await parseBbvaXlsxStatement(
      buildXlsxFile([
        ["Data", "Causale", "Movimento", "Beneficiario", "Importo"],
        ["22/04/2026", "COSTA POCO GPRS", "PAGAMENTO CON CARTA", "-\n-", "-2.25 EUR"]
      ], "bbva-luca.excel")
    );

    expect(movementOnlyDocument.transactions[0]).toMatchObject({
      typeLabel: "COSTA POCO GPRS",
      description: "PAGAMENTO CON CARTA"
    });
    expect(movementOnlyDocument.transactions[0].fingerprint).toBe(statementDocument.transactions[0].fingerprint);
  });
});
