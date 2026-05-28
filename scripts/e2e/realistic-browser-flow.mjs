import fs from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { strToU8, zipSync } from "fflate";
import { chromium } from "playwright";

const baseUrl = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const postgresPort = process.env.POSTGRES_PORT ?? "5432";
const dockerDatabaseUrl = `postgresql://morgan:morgan@localhost:${postgresPort}/morgan?schema=public`;
const databaseUrl = process.env.TEST_DATABASE_URL ?? dockerDatabaseUrl;
process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = process.env.TEST_DIRECT_URL ?? databaseUrl;
const binanceApiKey = process.env.BINANCE_TEST_API_KEY ?? "";
const binanceApiSecret = process.env.BINANCE_TEST_API_SECRET ?? "";
const outDir = path.resolve("artifacts/e2e/realistic-browser-flow");
const trPath = path.join(outDir, "trade-republic-realistic.csv");
const bbvaPath = path.join(outDir, "bbva-realistic.xlsx");
const prisma = new PrismaClient();
const runId = Date.now().toString(36);
const username = `realflow${runId}`;
const password = "Temporary realistic browser password 2026!";
const profileName = `Real Flow ${runId.slice(-6)}`;
const secondProfileName = `Real Flow Extra ${runId.slice(-6)}`;
const browserErrors = [];
const steps = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const tradeRepublicHeaders = [
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

function csvEscape(value) {
  return JSON.stringify(value ?? "");
}

function isoDate(offsetDays, start = new Date(Date.UTC(2023, 0, 5))) {
  const date = new Date(start);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function tradeRepublicRow(row) {
  return tradeRepublicHeaders.map((header) => csvEscape(row[header] ?? "")).join(",");
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
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
}

function worksheetXml(rows) {
  const sheetRows = rows
    .map((row, rowIndex) =>
      `<row r="${rowIndex + 1}">${row.map((cell, columnIndex) => cellXml(cell, rowIndex, columnIndex)).join("")}</row>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
}

function italianDate(date) {
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function italianMoney(value) {
  return value.toFixed(2).replace(".", ",");
}

async function prepareFixtures() {
  const tradeRepublicRows = [];
  let rowIndex = 0;

  for (let month = 0; month < 36; month += 1) {
    const date = isoDate(month * 30);
    tradeRepublicRows.push({
      datetime: `${date}T09:00:00.000Z`,
      date,
      account_type: "CASH",
      category: "CASH",
      type: "TRANSFER",
      name: "Monthly transfer",
      amount: month % 5 === 0 ? "1800.00" : "1200.00",
      fee: "0",
      tax: "0",
      currency: "EUR",
      description: `Realistic cash transfer ${month + 1}`,
      transaction_id: `realistic-${runId}-cash-${rowIndex++}`
    });

    if (month % 2 === 0) {
      tradeRepublicRows.push({
        datetime: `${date}T10:00:00.000Z`,
        date,
        account_type: "SECURITIES",
        category: "TRADING",
        type: "BUY",
        asset_class: "ETF",
        name: "Core MSCI World",
        symbol: "IE00B4L5Y983",
        shares: "2.5000",
        price: "82.40",
        amount: "-206.00",
        fee: "1.00",
        tax: "0",
        currency: "EUR",
        description: `Realistic ETF buy ${month + 1}`,
        transaction_id: `realistic-${runId}-etf-${rowIndex++}`
      });
    }

    if (month % 3 === 0) {
      tradeRepublicRows.push({
        datetime: `${date}T11:00:00.000Z`,
        date,
        account_type: "SECURITIES",
        category: "TRADING",
        type: "BUY",
        asset_class: "STOCK",
        name: "Apple Inc",
        symbol: "US0378331005",
        shares: "0.7500",
        price: "170.00",
        amount: "-127.50",
        fee: "1.00",
        tax: "0",
        currency: "EUR",
        description: `Realistic stock buy ${month + 1}`,
        transaction_id: `realistic-${runId}-stock-${rowIndex++}`
      });
    }

    if (month % 4 === 0) {
      tradeRepublicRows.push({
        datetime: `${date}T12:00:00.000Z`,
        date,
        account_type: "CRYPTO",
        category: "TRADING",
        type: "BUY",
        asset_class: "CRYPTO",
        name: "Bitcoin",
        symbol: "BTC",
        shares: "0.0045",
        price: "42000.00",
        amount: "-189.00",
        fee: "1.00",
        tax: "0",
        currency: "EUR",
        description: `Realistic BTC buy ${month + 1}`,
        transaction_id: `realistic-${runId}-btc-${rowIndex++}`
      });
    }

    if (month % 6 === 0) {
      tradeRepublicRows.push({
        datetime: `${date}T13:00:00.000Z`,
        date,
        account_type: "CRYPTO",
        category: "TRADING",
        type: "BUY",
        asset_class: "CRYPTO",
        name: "Ethereum",
        symbol: "ETH",
        shares: "0.0800",
        price: "2600.00",
        amount: "-208.00",
        fee: "1.00",
        tax: "0",
        currency: "EUR",
        description: `Realistic ETH buy ${month + 1}`,
        transaction_id: `realistic-${runId}-eth-${rowIndex++}`
      });
    }
  }

  const bbvaRows = [["Realistic BBVA"], ["Data", "Parola chiave", "Importo", "Disponibile", "Osservazioni"]];
  let balance = 500;
  for (let index = 0; index < 180; index += 1) {
    const date = new Date(Date.UTC(2022, 0, 10));
    date.setUTCDate(date.getUTCDate() + index * 7);
    let amount;
    let type;
    let description;

    if (index % 13 === 0) {
      amount = 2300;
      type = "Bonifico ricevuto";
      description = `Salary realistic long history ${index}`;
    } else if (index % 17 === 0) {
      amount = 14.25;
      type = "Interessi";
      description = `Interest payment ${index}`;
    } else if (index % 19 === 0) {
      amount = 8.7;
      type = "Premio";
      description = `Cash reward ${index}`;
    } else if (index % 23 === 0) {
      amount = -46.2;
      type = "Tax";
      description = `Tax withholding ${index}`;
    } else {
      amount = -((index % 9) * 17.33 + 12.49);
      type = index % 3 === 0 ? "Pagamento carta" : (index % 3 === 1 ? "Addebito SEPA" : "Prelievo");
      description = `Realistic checking expense ${index}`;
    }

    balance += amount;
    if (index === 3) balance = -125.44;
    bbvaRows.push([italianDate(date), type, italianMoney(amount), italianMoney(balance), description]);
  }

  const tradeRepublicCsv = [
    tradeRepublicHeaders.join(","),
    ...tradeRepublicRows.map(tradeRepublicRow)
  ].join("\n");
  const bbvaXlsx = Buffer.from(zipSync({
    "[Content_Types].xml": strToU8("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>"),
    "_rels/.rels": strToU8("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>"),
    "xl/workbook.xml": strToU8("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"Informe BBVA\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>"),
    "xl/_rels/workbook.xml.rels": strToU8("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/></Relationships>"),
    "xl/worksheets/sheet1.xml": strToU8(worksheetXml(bbvaRows))
  }));

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(trPath, tradeRepublicCsv);
  await fs.writeFile(bbvaPath, bbvaXlsx);

  return {
    tradeRepublicRows: tradeRepublicRows.length,
    bbvaRows: bbvaRows.length - 2,
    tradeRepublicCheckingCount: 81,
    tradeRepublicInvestmentCount: 30,
    tradeRepublicCryptoCount: 15
  };
}

async function waitForServer() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${baseUrl}.`);
}

async function saveScreenshot(page, name) {
  await fs.mkdir(outDir, { recursive: true });
  const screenshotPath = path.join(outDir, name);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  return screenshotPath;
}

async function cleanupUsersByPrefix(prefixes) {
  const authUsers = await prisma.authUser.findMany({
    where: {
      OR: prefixes.flatMap((prefix) => [
        { username: { startsWith: prefix } },
        { name: { startsWith: prefix } },
        { email: { startsWith: prefix } }
      ])
    },
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

async function getProfiles(page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/users");
    if (!response.ok) throw new Error(`GET /api/users failed: ${response.status}`);
    return response.json();
  });
}

async function waitForProfile(page, name, predicate, label) {
  const deadline = Date.now() + 60_000;
  let lastProfile = null;
  while (Date.now() < deadline) {
    const payload = await getProfiles(page);
    lastProfile = payload.users?.find((user) => user.name === name) ?? null;
    if (lastProfile && predicate(lastProfile)) return lastProfile;
    await page.waitForTimeout(500);
  }
  throw new Error(`${label}: timed out waiting for profile state; last=${JSON.stringify(lastProfile)}`);
}

async function expectNoOverlay(page, label) {
  const overlay = await page.evaluate(() => {
    const text = document.body?.innerText ?? "";
    return {
      hasOverlay: Boolean(document.querySelector("[data-nextjs-dialog-overlay]")) ||
        /Hydration failed|Console Error|Recoverable Error/.test(text),
      excerpt: text.slice(0, 500)
    };
  });
  assert(!overlay.hasOverlay, `${label}: unexpected Next overlay ${overlay.excerpt}`);
}

async function importFile(page, filePath, expectedNewCount, label, openAddDocument = false) {
  if (openAddDocument) {
    await page.getByRole("button", { name: "Add document", exact: true }).waitFor({ state: "visible", timeout: 20_000 });
    await page.getByRole("button", { name: "Add document", exact: true }).click();
    await page.locator('[role="dialog"][data-modal-panel="upload"]').waitFor({ state: "visible", timeout: 10_000 });
  }

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Upload", exact: true }).click()
  ]);
  await fileChooser.setFiles(filePath);

  await page.getByRole("heading", { name: "Review import", exact: true }).waitFor({ state: "visible", timeout: 45_000 });
  const approveButton = page.locator("button[aria-label^='Approve and save']");
  const approveLabel = await approveButton.getAttribute("aria-label", { timeout: 10_000 });
  assert(
    approveLabel?.includes(`${expectedNewCount} transactions`),
    `${label}: expected ${expectedNewCount} new transactions, got approve label ${approveLabel}`
  );
  await approveButton.click();
  await page.locator(".import-spinner").waitFor({ state: "detached", timeout: 180_000 }).catch(() => {});
  await approveButton.waitFor({ state: "detached", timeout: 180_000 }).catch(() => {});
  steps.push(label);
}

async function createSecondProfile(page) {
  await page.getByRole("button", { name: "Select profile", exact: true }).click();
  const panel = page.locator('[role="dialog"][data-modal-panel="profile"]');
  await panel.waitFor({ state: "visible", timeout: 10_000 });
  await panel.getByRole("button", { name: "New Profile" }).click();
  await panel.getByPlaceholder("Profile", { exact: true }).fill(secondProfileName);
  await panel.getByRole("button", { name: "Create profile", exact: true }).click();
  await waitForProfile(page, secondProfileName, () => true, "after second profile creation");
  await page.getByRole("heading", { name: "Upload", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  steps.push("created_second_profile");
}

async function waitForAny(locator, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let count = 0;
  while (Date.now() < deadline) {
    count = await locator.count();
    if (count > 0) return count;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label}: expected at least one matching element, found ${count}`);
}

async function runBinanceFlow(page, profileId) {
  if (!binanceApiKey || !binanceApiSecret) {
    return { attempted: false, status: "skipped_missing_env", balanceCount: null };
  }

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("heading", { name: "General Settings", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  await page.locator("button").filter({ hasText: "API Key" }).click();
  await page.getByRole("heading", { name: "BINANCE", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  await page.getByPlaceholder("Enter API Key", { exact: true }).fill(binanceApiKey);
  await page.getByPlaceholder("Enter Secret Key", { exact: true }).fill(binanceApiSecret);
  await page.locator('button[title="Save API Keys"]').click();

  const deleteButton = page.locator('button[title="Delete Saved API Keys"]');
  await deleteButton.waitFor({ state: "visible", timeout: 60_000 });
  const settingsText = await page.locator('[role="dialog"][data-modal-panel="settings"]').innerText({ timeout: 10_000 });
  const balanceCount = await prisma.binanceBalance.count({ where: { userId: profileId } });

  await deleteButton.click();
  await page.getByRole("button", { name: "API + Data", exact: true }).click();
  await page.locator('button[title="Save API Keys"]').waitFor({ state: "visible", timeout: 20_000 });
  const balancesAfterDelete = await prisma.binanceBalance.count({ where: { userId: profileId } });
  assert(balancesAfterDelete === 0, `Expected Binance balances to be deleted, found ${balancesAfterDelete}`);
  steps.push("saved_synced_and_deleted_binance_credentials");

  return {
    attempted: true,
    status: /Connected!/i.test(settingsText) ? "connected" : "saved_but_sync_reported_error",
    balanceCount,
    message: settingsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-4)
      .join(" | ")
  };
}

let browser;
let page;
let primaryProfileId = null;
let cleanup = null;

try {
  const fixtureSummary = await prepareFixtures();
  await waitForServer();
  cleanup = await cleanupUsersByPrefix(["realflow", "manualflow"]);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1572, height: 1270 } });
  page = await context.newPage();
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      browserErrors.push({ type: message.type(), text: message.text().slice(0, 500) });
    }
  });
  page.on("pageerror", (error) => browserErrors.push({ type: "pageerror", text: error.message.slice(0, 500) }));

  const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  assert(response?.ok(), `Initial request failed: ${response?.status()}`);
  await page.locator('main[data-auth-shell-ready="true"]').waitFor({ state: "attached", timeout: 20_000 });
  await expectNoOverlay(page, "initial load");

  await page.getByRole("button", { name: "Register New local account", exact: true }).click();
  await page.getByPlaceholder("Username", { exact: true }).fill(username);
  await page.getByPlaceholder("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("button", { name: "Create profile", exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  steps.push("created_auth_account");

  await page.getByPlaceholder("Profile", { exact: true }).fill(profileName);
  await page.getByRole("button", { name: "Create profile", exact: true }).click();
  const createdProfile = await waitForProfile(page, profileName, () => true, "after primary profile creation");
  await page.locator('main[data-finance-shell-ready="true"]').waitFor({ state: "attached", timeout: 30_000 });
  await page.getByRole("heading", { name: "Upload", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  primaryProfileId = await page.evaluate(() => localStorage.getItem("morgan_active_user"));
  if (!primaryProfileId) {
    primaryProfileId = createdProfile.id;
  }
  assert(primaryProfileId, "Primary profile id not available in localStorage.");
  steps.push("created_primary_profile");

  await importFile(page, trPath, fixtureSummary.tradeRepublicRows, "imported_trade_republic_realistic_csv");
  const afterTr = await waitForProfile(page, profileName, (profile) =>
    profile.transactionCount === fixtureSummary.tradeRepublicCheckingCount +
      fixtureSummary.tradeRepublicInvestmentCount +
      fixtureSummary.tradeRepublicCryptoCount &&
    profile.checkingCount === fixtureSummary.tradeRepublicCheckingCount &&
    profile.investmentCount === fixtureSummary.tradeRepublicInvestmentCount &&
    profile.cryptoCount === fixtureSummary.tradeRepublicCryptoCount,
  "after Trade Republic import");

  await importFile(page, bbvaPath, fixtureSummary.bbvaRows, "imported_bbva_realistic_xlsx", true);
  const afterBbva = await waitForProfile(page, profileName, (profile) =>
    profile.transactionCount === afterTr.transactionCount + fixtureSummary.bbvaRows &&
    profile.checkingCount === afterTr.checkingCount + fixtureSummary.bbvaRows &&
    profile.investmentCount === afterTr.investmentCount &&
    profile.cryptoCount === afterTr.cryptoCount,
  "after BBVA import");
  await saveScreenshot(page, "after-primary-imports.png");

  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await waitForAny(page.getByText("BBVA", { exact: true }), "dashboard BBVA provider");
  await waitForAny(page.getByText("TRADE REPUBLIC", { exact: true }), "dashboard Trade Republic provider");
  await page.getByRole("button", { name: "Checking", exact: true }).click();
  await waitForAny(page.getByText("Realistic checking expense", { exact: false }), "checking transaction text");
  await page.getByRole("button", { name: "Investments", exact: true }).click();
  await waitForAny(page.getByText("Core MSCI World", { exact: false }), "investment product text");
  await saveScreenshot(page, "dashboard-and-tabs.png");
  steps.push("verified_dashboard_checking_investments");

  await createSecondProfile(page);
  await importFile(page, bbvaPath, fixtureSummary.bbvaRows, "imported_bbva_on_second_profile");
  const afterSecondProfile = await waitForProfile(page, secondProfileName, (profile) =>
    profile.transactionCount === fixtureSummary.bbvaRows &&
    profile.checkingCount === fixtureSummary.bbvaRows,
  "after second profile import");

  await page.getByRole("button", { name: "Select profile", exact: true }).click();
  await page.locator('[role="dialog"][data-modal-panel="profile"]').getByRole("button", { name: profileName, exact: true }).click();
  await page.locator('[role="dialog"][data-modal-panel="profile"]').waitFor({ state: "detached", timeout: 10_000 });
  const binanceResult = await runBinanceFlow(page, primaryProfileId);

  if (await page.locator('[role="dialog"][data-modal-panel="settings"]').count() === 0) {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.locator('[role="dialog"][data-modal-panel="settings"]').waitFor({ state: "visible", timeout: 10_000 });
  }
  await page.locator("button").filter({ hasText: "Danger zone" }).click();
  await page.getByRole("button", { name: "Delete Account", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete account", exact: true });
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  await dialog.getByPlaceholder("Enter your password", { exact: true }).fill(password);
  await dialog.getByRole("button", { name: "Delete account", exact: true }).click();
  await page.locator('main[data-auth-shell-ready="true"]').waitFor({ state: "attached", timeout: 30_000 });
  await page.getByRole("button", { name: "Register New local account", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  await expectNoOverlay(page, "after account delete");
  steps.push("deleted_account_via_ui");

  const remainingUsers = await prisma.authUser.count({
    where: {
      OR: [
        { username: { startsWith: "realflow" } },
        { username: { startsWith: "manualflow" } }
      ]
    }
  });
  assert(remainingUsers === 0, `Expected test users to be deleted, found ${remainingUsers}`);

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    username,
    profileName,
    secondProfileName,
    primaryProfileId,
    steps,
    fixtureSummary,
    cleanupBeforeRun: cleanup,
    afterTr,
    afterBbva,
    afterSecondProfile,
    binanceResult,
    browserErrors,
    screenshots: {
      afterPrimaryImports: path.join(outDir, "after-primary-imports.png"),
      dashboardAndTabs: path.join(outDir, "dashboard-and-tabs.png")
    }
  }, null, 2));
} catch (error) {
  if (page) await saveScreenshot(page, "failure-realistic-flow.png").catch(() => null);
  const forcedCleanup = await cleanupUsersByPrefix(["realflow", "manualflow"]).catch((cleanupError) => ({
    error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
  }));
  console.error(JSON.stringify({
    ok: false,
    baseUrl,
    username,
    profileName,
    secondProfileName,
    primaryProfileId,
    steps,
    error: error instanceof Error ? error.message : String(error),
    forcedCleanup,
    browserErrors,
    failureScreenshot: path.join(outDir, "failure-realistic-flow.png")
  }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await prisma.$disconnect();
}
