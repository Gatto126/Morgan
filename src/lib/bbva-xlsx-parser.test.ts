import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";

import { BBVA_INSTITUTION } from "@/lib/institutions";
import { parseBbvaXlsxStatement } from "@/lib/bbva-xlsx-parser";

type WorkbookCell = string | number | boolean | null | undefined;

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "\"":
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

function columnName(index: number) {
  let column = "";
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    current = Math.floor((current - 1) / 26);
  }

  return column;
}

function cellXml(cell: WorkbookCell, rowIndex: number, columnIndex: number) {
  if (cell === null || cell === undefined) return "";

  const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
  if (typeof cell === "number") return `<c r="${reference}"><v>${cell}</v></c>`;
  if (typeof cell === "boolean") return `<c r="${reference}" t="b"><v>${cell ? 1 : 0}</v></c>`;

  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
}

function worksheetXml(rows: WorkbookCell[][]) {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row.map((cell, columnIndex) => cellXml(cell, rowIndex, columnIndex)).join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

function buildWorkbookFile(rows: WorkbookCell[][]) {
  const data = zipSync({
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Informe BBVA" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(worksheetXml(rows))
  });

  return new File([data], "bbva.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

describe("parseBbvaXlsxStatement", () => {
  it("parses BBVA rows from the real statement layout", async () => {
    const document = await parseBbvaXlsxStatement(
      buildWorkbookFile([
        ["Header 1"],
        ["Header 2"],
        ["Header 3"],
        ["Header 4"],
        [null, "Data valuta", "Data", "Parola chiave", "Movimento", "Importo", "Valuta", "Disponibile", "Valuta", "Osservazioni"],
        [null, "31/01/2024", "01/02/2024", "Bonifico ricevuto", "Altro", 123.45, "EUR", 1123.45, "EUR", "Stipendio"],
        [null, "01/02/2024", "02/02/2024", "Pagamento con carta", "Carta", -23.4, "EUR", 1100.05, "EUR", "Spesa supermercato"]
      ])
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

  it("maps transaction columns by header name instead of fixed offsets", async () => {
    const document = await parseBbvaXlsxStatement(
      buildWorkbookFile([
        ["Report BBVA"],
        ["Data", "Parola chiave", "Importo", "Disponibile", "Osservazioni"],
        ["03/02/2024", "Cashback promozione commerciale", "0,07", "1.100,12", "CASHBACK BBVA"]
      ])
    );

    expect(document.transactions).toHaveLength(1);
    expect(document.transactions[0]).toMatchObject({
      rawDateLabel: "03/02/2024",
      typeLabel: "Cashback promozione commerciale",
      description: "CASHBACK BBVA",
      direction: "IN",
      amountCents: 7,
      balanceCents: 110_012
    });
  });
});
