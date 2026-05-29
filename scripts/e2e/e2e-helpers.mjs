import fs from "node:fs/promises";
import path from "node:path";

import { strToU8, zipSync } from "fflate";

export const tradeRepublicHeaders = [
  "datetime",
  "date",
  "account_type",
  "category",
  "type",
  "asset_class",
  "name",
  "symbol",
  "shares",
  "price",
  "amount",
  "fee",
  "tax",
  "currency",
  "original_amount",
  "original_currency",
  "fx_rate",
  "description",
  "transaction_id",
  "counterparty_name",
  "counterparty_iban",
  "payment_reference",
  "mcc_code"
];

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function csvEscape(value) {
  return JSON.stringify(value ?? "");
}

export function isoDate(offsetDays, start = new Date(Date.UTC(2023, 0, 5))) {
  const date = new Date(start);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function toTradeRepublicCsv(rows, headers = tradeRepublicHeaders) {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(","))
  ].join("\n");
}

export function italianDate(date) {
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

export function italianMoney(value) {
  return value.toFixed(2).replace(".", ",");
}

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (char) => {
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

function columnName(index) {
  let column = "";
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    current = Math.floor((current - 1) / 26);
  }

  return column;
}

function cellXml(cell, rowIndex, columnIndex) {
  if (cell === null || cell === undefined) return "";

  const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
  if (typeof cell === "number") return `<c r="${reference}"><v>${cell}</v></c>`;
  if (typeof cell === "boolean") return `<c r="${reference}" t="b"><v>${cell ? 1 : 0}</v></c>`;

  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
}

export function worksheetXml(rows) {
  const sheetRows = rows
    .map((row, rowIndex) =>
      `<row r="${rowIndex + 1}">${row.map((cell, columnIndex) => cellXml(cell, rowIndex, columnIndex)).join("")}</row>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
}

export function buildXlsxBufferFromRows(rows, sheetName = "Informe BBVA") {
  return Buffer.from(zipSync({
    "[Content_Types].xml": strToU8("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>"),
    "_rels/.rels": strToU8("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>"),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/></Relationships>"),
    "xl/worksheets/sheet1.xml": strToU8(worksheetXml(rows))
  }));
}

export async function waitForHealthCheck(baseUrl, { timeoutMs = 45_000 } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Keep polling until the app is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${baseUrl}.`);
}

export async function saveScreenshot(page, outDir, name, { screenshots, fullPage = false } = {}) {
  await fs.mkdir(outDir, { recursive: true });
  const screenshotPath = path.join(outDir, name);
  await page.screenshot({ path: screenshotPath, fullPage });
  screenshots?.push(screenshotPath);
  return screenshotPath;
}

export async function getProfiles(page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/users");
    if (!response.ok) throw new Error(`GET /api/users failed: ${response.status}`);
    return response.json();
  });
}

export async function waitForProfile(page, name, predicate, label, { timeoutMs = 60_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastProfile = null;

  while (Date.now() < deadline) {
    const payload = await getProfiles(page);
    lastProfile = payload.users?.find((user) => user.name === name) ?? null;
    if (lastProfile && predicate(lastProfile)) return lastProfile;
    await page.waitForTimeout(500);
  }

  throw new Error(`${label}: timed out waiting for profile state; last=${JSON.stringify(lastProfile)}`);
}

export async function expectNoNextOverlay(page, label, {
  includePortal = false,
  message = "unexpected Next overlay"
} = {}) {
  const selector = includePortal
    ? "[data-nextjs-dialog-overlay], nextjs-portal"
    : "[data-nextjs-dialog-overlay]";
  const overlay = await page.evaluate((dialogSelector) => {
    const text = document.body?.innerText ?? "";
    return {
      hasOverlay: Boolean(document.querySelector(dialogSelector)) ||
        /Hydration failed|Console Error|Recoverable Error/.test(text),
      excerpt: text.slice(0, 500)
    };
  }, selector);

  assert(!overlay.hasOverlay, `${label}: ${message} ${overlay.excerpt}`);
}

export function authUserPrefixWhere(prefixes) {
  return {
    OR: prefixes.flatMap((prefix) => [
      { username: { startsWith: prefix } },
      { name: { startsWith: prefix } },
      { email: { startsWith: prefix } }
    ])
  };
}

export async function cleanupUsersByPrefix(prisma, prefixes) {
  const authUsers = await prisma.authUser.findMany({
    where: authUserPrefixWhere(prefixes),
    select: { id: true, username: true }
  });
  const ownerIds = authUsers.map((user) => user.id);
  if (ownerIds.length === 0) return { ownerIds, authUsers: [] };

  const profiles = await prisma.user.findMany({
    where: { ownerId: { in: ownerIds } },
    select: { id: true }
  });
  const profileIds = profiles.map((profile) => profile.id);

  await prisma.$transaction(async (tx) => {
    if (profileIds.length > 0) {
      await tx.checkingTransaction.deleteMany({ where: { userId: { in: profileIds } } });
      await tx.investmentTransaction.deleteMany({ where: { userId: { in: profileIds } } });
      await tx.cryptoTransaction.deleteMany({ where: { userId: { in: profileIds } } });
      await tx.binanceBalance.deleteMany({ where: { userId: { in: profileIds } } });
      await tx.user.deleteMany({ where: { ownerId: { in: ownerIds } } });
    }
    await tx.authSession.deleteMany({ where: { userId: { in: ownerIds } } });
    await tx.authAccount.deleteMany({ where: { userId: { in: ownerIds } } });
    await tx.authUser.deleteMany({ where: { id: { in: ownerIds } } });
  });

  return { ownerIds, authUsers };
}

export async function waitForAny(locator, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let count = 0;

  while (Date.now() < deadline) {
    count = await locator.count();
    if (count > 0) return count;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`${label}: expected at least one matching element, found ${count}`);
}

export async function importFileThroughUi(page, file, expectedNewCount, {
  label,
  openAddDocument = false,
  addDocumentTimeoutMs = 20_000,
  reviewTimeoutMs = 45_000,
  spinnerTimeoutMs = 180_000,
  captureScreenshot,
  steps,
  waitForAddDocumentEnabled = false
} = {}) {
  const flowLabel = label ?? "import";

  if (openAddDocument) {
    const addDocumentButton = page.getByRole("button", { name: "Add document", exact: true });
    await addDocumentButton.waitFor({ state: "visible", timeout: addDocumentTimeoutMs });
    if (waitForAddDocumentEnabled) {
      await page.waitForFunction(() => {
        const button = document.querySelector('button[aria-label="Add document"]');
        return button instanceof HTMLButtonElement && !button.disabled;
      });
    }
    await addDocumentButton.click();
    await page.locator('[role="dialog"][data-modal-panel="upload"]').waitFor({ state: "visible", timeout: 10_000 });
    await captureScreenshot?.(`${flowLabel}-upload-overlay.png`);
  }

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Upload", exact: true }).click()
  ]);
  await fileChooser.setFiles(file);

  await page.getByRole("heading", { name: "Review import", exact: true }).waitFor({
    state: "visible",
    timeout: reviewTimeoutMs
  });
  await captureScreenshot?.(`${flowLabel}-review.png`);
  const approveButton = page.locator("button[aria-label^='Approve and save']");
  await approveButton.waitFor({ state: "visible", timeout: 10_000 });
  const approveLabel = await approveButton.getAttribute("aria-label", { timeout: 10_000 });
  assert(
    approveLabel?.includes(`${expectedNewCount} transactions`),
    `${flowLabel}: expected ${expectedNewCount} new transactions, got approve label ${approveLabel}`
  );
  await approveButton.click();
  await page.locator(".import-spinner").waitFor({ state: "detached", timeout: spinnerTimeoutMs }).catch(() => {});
  await approveButton.waitFor({ state: "detached", timeout: spinnerTimeoutMs }).catch(() => {});
  steps?.push(flowLabel);
}
