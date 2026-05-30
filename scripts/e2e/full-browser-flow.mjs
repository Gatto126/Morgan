import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";

import {
  assert,
  authUserPrefixWhere,
  buildXlsxBufferFromRows,
  cleanupUsersByPrefix,
  expectNoNextOverlay,
  importFileThroughUi,
  getProfiles,
  saveScreenshot as saveE2eScreenshot,
  toTradeRepublicCsv,
  waitForHealthCheck,
  waitForProfile
} from "./e2e-helpers.mjs";
import {
  applyEnvFileDatabaseUrl,
  restoreRateLimits,
  snapshotAndClearRateLimits
} from "../lib/rate-limit-test-scope.mjs";

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DIRECT_URL = process.env.TEST_DIRECT_URL ?? process.env.TEST_DATABASE_URL;
} else {
  applyEnvFileDatabaseUrl();
}

const baseUrl = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3001";
const binanceApiKey = process.env.BINANCE_TEST_API_KEY ?? "";
const binanceApiSecret = process.env.BINANCE_TEST_API_SECRET ?? "";
const runBinance = binanceApiKey.length > 0 && binanceApiSecret.length > 0;

const prisma = new PrismaClient();
const runId = Date.now().toString(36);
const username = `browseraudit${runId}`;
const email = `${username}@example.test`;
const password = "Temporary audit password 2026!";
const signupInviteCode = process.env.MORGAN_SIGNUP_INVITE_CODE ?? "local-test-invite-code";
const profileName = `Audit ${runId.slice(-6)}`;
const outDir = path.resolve("artifacts", "e2e", "browser-flow");

function buildTradeRepublicCsv() {
  const rows = [
    {
      datetime: "2026-01-02T10:00:00.000Z",
      date: "2026-01-02",
      account_type: "CASH",
      category: "CASH",
      type: "TRANSFER",
      name: "Initial transfer",
      amount: "1000.00",
      fee: "0",
      tax: "0",
      currency: "EUR",
      description: "Audit cash deposit",
      transaction_id: `audit-cash-${runId}`
    },
    {
      datetime: "2026-01-03T10:00:00.000Z",
      date: "2026-01-03",
      account_type: "SECURITIES",
      category: "TRADING",
      type: "BUY",
      asset_class: "ETF",
      name: "Core MSCI World",
      symbol: "IE00B4L5Y983",
      shares: "1.25",
      price: "80.00",
      amount: "-100.00",
      fee: "0",
      tax: "0",
      currency: "EUR",
      description: "Audit ETF order",
      transaction_id: `audit-buy-${runId}`
    }
  ];

  return toTradeRepublicCsv(rows);
}

function buildBbvaXlsxBuffer() {
  const rows = [
    ["Audit BBVA"],
    ["Data", "Parola chiave", "Importo", "Disponibile", "Osservazioni"],
    ["04/01/2026", "Pagamento carta", "-12,50", "-12,50", "Audit saldo negativo"],
    ["05/01/2026", "Bonifico ricevuto", "50,00", "37,50", "Audit bonifico"]
  ];

  return buildXlsxBufferFromRows(rows);
}

async function saveScreenshot(page, name) {
  return saveE2eScreenshot(page, outDir, name);
}

async function waitForServer() {
  await waitForHealthCheck(baseUrl);
}

async function expectNoHydrationOverlay(page, label) {
  await expectNoNextOverlay(page, label, {
    includePortal: true,
    message: "unexpected Next hydration/error overlay:"
  });
}

async function waitForProfileCounts(page, expected) {
  return waitForProfile(
    page,
    profileName,
    (profile) =>
      profile.transactionCount === expected.transactionCount &&
      profile.checkingCount === expected.checkingCount &&
      profile.investmentCount === expected.investmentCount,
    `counts ${JSON.stringify(expected)}`,
    { timeoutMs: 20_000 }
  );
}

async function importFile(page, filePayload, expectedNewCount, triggerName) {
  await importFileThroughUi(page, filePayload, expectedNewCount, {
    label: triggerName,
    openAddDocument: triggerName === "Add document",
    addDocumentTimeoutMs: 15_000,
    reviewTimeoutMs: 15_000,
    spinnerTimeoutMs: 20_000,
    waitForAddDocumentEnabled: triggerName === "Add document"
  });
}

async function deleteTestAccountIfPresent() {
  const cleanup = await cleanupUsersByPrefix(prisma, [username]);
  return {
    forcedCleanup: cleanup.ownerIds.length > 0,
    ownerIds: cleanup.ownerIds
  };
}

async function collectDbState(profileId) {
  const authUsers = await prisma.authUser.count({
    where: authUserPrefixWhere([username])
  });

  return {
    authUsers,
    profiles: await prisma.user.count({ where: { name: profileName } }),
    checkingTransactions: profileId ? await prisma.checkingTransaction.count({ where: { userId: profileId } }) : null,
    investmentTransactions: profileId ? await prisma.investmentTransaction.count({ where: { userId: profileId } }) : null,
    binanceBalances: profileId ? await prisma.binanceBalance.count({ where: { userId: profileId } }) : null
  };
}

let browser;
let page;
let profileId = null;
let forcedCleanup = false;
let initialRateLimits = null;
const browserErrors = [];
const steps = [];

try {
  await waitForServer();
  initialRateLimits = await snapshotAndClearRateLimits({ prisma });

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1572, height: 1270 } });
  page = await context.newPage();
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      browserErrors.push({ type: message.type(), text: message.text().slice(0, 500) });
    }
  });
  page.on("pageerror", (error) => {
    browserErrors.push({ type: "pageerror", text: error.message.slice(0, 500) });
  });

  const initialResponse = await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  assert(initialResponse?.ok(), `Initial page request failed with status ${initialResponse?.status()}.`);
  const headers = initialResponse.headers();
  assert(headers["x-frame-options"] === "DENY", "Missing X-Frame-Options DENY.");
  assert(headers["x-content-type-options"] === "nosniff", "Missing X-Content-Type-Options nosniff.");
  assert(headers["content-security-policy"]?.includes("frame-ancestors 'none'"), "Missing frame-ancestors CSP.");
  await page.locator('main[data-auth-shell-ready="true"]').waitFor({ state: "attached", timeout: 15_000 });
  await expectNoHydrationOverlay(page, "initial load");
  steps.push("loaded_home_with_security_headers");

  await page.getByRole("button", { name: "Register New account", exact: true }).click();
  await page.getByPlaceholder("Invite code", { exact: true }).fill(signupInviteCode);
  await page.getByPlaceholder("Email", { exact: true }).fill(email);
  await page.getByPlaceholder("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("button", { name: "Create profile", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
  steps.push("created_auth_account");

  await page.getByPlaceholder("Profile", { exact: true }).fill(profileName);
  await page.getByRole("button", { name: "Create profile", exact: true }).click();
  await page.locator('main[data-finance-shell-ready="true"]').waitFor({ state: "attached", timeout: 15_000 });
  await page.getByRole("heading", { name: "Upload", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
  profileId = await page.evaluate(() => localStorage.getItem("morgan_active_user"));
  assert(profileId, "Profile id was not stored in localStorage.");
  steps.push("created_profile");

  await importFile(
    page,
    {
      name: "trade-republic-audit.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(buildTradeRepublicCsv(), "utf8")
    },
    2,
    "Upload"
  );
  await waitForProfileCounts(page, {
    transactionCount: 3,
    checkingCount: 2,
    investmentCount: 1
  });
  steps.push("imported_trade_republic_csv");

  await page.getByRole("button", { name: "Add document", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
  await importFile(
    page,
    {
      name: "bbva-audit.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: buildBbvaXlsxBuffer()
    },
    2,
    "Add document"
  );
  const profileAfterImports = await waitForProfileCounts(page, {
    transactionCount: 5,
    checkingCount: 4,
    investmentCount: 1
  });
  await saveScreenshot(page, "01-after-imports.png");
  steps.push("imported_bbva_xlsx_with_negative_balance");

  await page.getByRole("button", { name: "Checking", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
  await page.getByRole("button", { name: "Investments", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
  steps.push("navigation_unlocked_for_checking_and_investments");

  let binanceResult = { attempted: false, status: "skipped", message: "No credentials provided.", balanceCount: null };
  if (runBinance) {
    binanceResult = { attempted: true, status: "unknown", message: "", balanceCount: null };
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("heading", { name: "General Settings", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
    await page.locator("button").filter({ hasText: "API Key" }).click();
    await page.getByRole("heading", { name: "BINANCE", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByPlaceholder("Enter API Key", { exact: true }).fill(binanceApiKey);
    await page.getByPlaceholder("Enter Secret Key", { exact: true }).fill(binanceApiSecret);
    await page.locator('button[title="Save API Keys"]').click();

    await page.locator('button[title="Delete Saved API Keys"]').waitFor({ state: "visible", timeout: 35_000 });
    const settingsText = await page.locator('[role="dialog"][data-modal-panel="settings"]').innerText({ timeout: 5_000 });
    const balancesAfterSync = await prisma.binanceBalance.count({ where: { userId: profileId } });
    binanceResult.balanceCount = balancesAfterSync;

    if (/Connected!/i.test(settingsText)) {
      binanceResult.status = "connected";
      binanceResult.message = settingsText.match(/Connected![^\n]*/i)?.[0] ?? "Connected.";
    } else {
      const lines = settingsText.split("\n").map((line) => line.trim()).filter(Boolean);
      const lastUsefulLine = [...lines].reverse().find((line) =>
        !["BINANCE", "API KEY", "SECRET", "API Only", "API + Data"].includes(line)
      );
      binanceResult.status = "saved_but_sync_reported_error";
      binanceResult.message = lastUsefulLine ?? "Credentials saved, sync did not report success.";
    }
    await saveScreenshot(page, "02-binance-settings-after-sync.png");
    steps.push("saved_and_synced_binance_credentials");

    await page.locator('button[title="Delete Saved API Keys"]').click();
    await page.getByRole("button", { name: "API + Data", exact: true }).click();
    await page.locator('button[title="Save API Keys"]').waitFor({ state: "visible", timeout: 15_000 });
    const profileAfterDeleteApi = (await getProfiles(page)).users.find((user) => user.name === profileName);
    const balancesAfterDeleteApi = await prisma.binanceBalance.count({ where: { userId: profileId } });
    assert(profileAfterDeleteApi?.hasBinanceCredentials === false, "Binance credentials were not cleared from profile summary.");
    assert(balancesAfterDeleteApi === 0, `Expected Binance balances to be cleared, found ${balancesAfterDeleteApi}.`);
    steps.push("deleted_binance_credentials_and_data");
  }

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
  await page.locator('main[data-auth-shell-ready="true"]').waitFor({ state: "attached", timeout: 20_000 });
  await page.getByRole("button", { name: "Register New account", exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  await expectNoHydrationOverlay(page, "after account deletion");
  await saveScreenshot(page, "03-after-account-delete.png");
  steps.push("deleted_account_via_ui");

  const dbAfterDelete = await collectDbState(profileId);
  assert(dbAfterDelete.authUsers === 0, `Auth user still exists after account delete: ${JSON.stringify(dbAfterDelete)}`);
  assert(dbAfterDelete.profiles === 0, `Profile still exists after account delete: ${JSON.stringify(dbAfterDelete)}`);

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    username,
    profileName,
    profileId,
    steps,
    profileAfterImports,
    binanceResult,
    dbAfterDelete,
    browserErrors,
    screenshots: {
      afterImports: path.join(outDir, "01-after-imports.png"),
      binanceSettings: path.join(outDir, "02-binance-settings-after-sync.png"),
      afterAccountDelete: path.join(outDir, "03-after-account-delete.png")
    }
  }, null, 2));
} catch (error) {
  if (page) {
    await saveScreenshot(page, "failure.png").catch(() => null);
  }
  const cleanup = await deleteTestAccountIfPresent().catch((cleanupError) => ({
    forcedCleanup: false,
    cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
  }));
  forcedCleanup = cleanup.forcedCleanup === true;
  console.error(JSON.stringify({
    ok: false,
    baseUrl,
    username,
    profileName,
    profileId,
    steps,
    forcedCleanup,
    error: error instanceof Error ? error.message : String(error),
    browserErrors,
    failureScreenshot: path.join(outDir, "failure.png")
  }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (initialRateLimits) {
    await restoreRateLimits(initialRateLimits, { prisma });
  }
  await prisma.$disconnect();
}
