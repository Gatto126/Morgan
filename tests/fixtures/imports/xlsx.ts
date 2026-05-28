import { strToU8, zipSync } from "fflate";

export type WorkbookCell = string | number | boolean | null | undefined;

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

export function buildXlsxFile(rows: WorkbookCell[][], fileName = "workbook.xlsx") {
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
    <sheet name="Sheet 1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(worksheetXml(rows))
  });

  return new File([data], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}
