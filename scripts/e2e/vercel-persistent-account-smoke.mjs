import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

import { chromium } from "playwright";

import {
  assert,
  expectNoNextOverlay,
  importFileThroughUi,
  saveScreenshot as saveE2eScreenshot,
  toTradeRepublicCsv,
  waitForAny,
  waitForHealthCheck,
  waitForProfile
} from "./e2e-helpers.mjs";

function parseEnvValue(rawValue) {
  const trimmed = rawValue.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return false;

  const body = readFileSync(filePath, "utf8");

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = parseEnvValue(line.slice(separatorIndex + 1));

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  return true;
}

const envFileArg = process.argv.find((arg) => arg.startsWith("--env-file="));
const envFilePath = path.resolve(envFileArg ? envFileArg.slice("--env-file=".length) : ".env.e2e.local");
const loadedEnvFile = loadEnvFile(envFilePath);
const baseUrl = process.env.TEST_BASE_URL ?? "https://morgan-chi.vercel.app";
const testEmail = process.env.MORGAN_TEST_EMAIL ?? "";
const testPassword = process.env.MORGAN_TEST_PASSWORD ?? "";
const binanceApiKey = process.env.BINANCE_TEST_API_KEY ?? "";
const binanceApiSecret = process.env.BINANCE_TEST_API_SECRET ?? "";
const requireBinance = process.env.REQUIRE_BINANCE_SMOKE === "1";
const keepProfile = process.argv.includes("--keep-profile") || process.env.KEEP_VERCEL_SMOKE_PROFILE === "1";
const profilePrefix = process.env.MORGAN_TEST_PROFILE_PREFIX ?? "Vercel Smoke";
const runId = Date.now().toString(36);
const profileName = `${profilePrefix} ${runId.slice(-6)}`;
const outDir = path.resolve("artifacts", "e2e", "vercel-persistent-account-smoke");
const browserErrors = [];
const httpErrors = [];
const steps = [];
const screenshots = [];

if (!testEmail || !testPassword) {
  throw new Error("Set MORGAN_TEST_EMAIL and MORGAN_TEST_PASSWORD, or create .env.e2e.local, to run the persistent-account smoke test.");
}

if (requireBinance && (!binanceApiKey || !binanceApiSecret)) {
  throw new Error("Set BINANCE_TEST_API_KEY and BINANCE_TEST_API_SECRET, or unset REQUIRE_BINANCE_SMOKE.");
}

function buildTradeRepublicCsv() {
  const date = "2026-05-29";
  const rows = [
    {
      datetime: `${date}T09:00:00.000Z`,
      date,
      account_type: "CASH",
      category: "CASH",
      type: "TRANSFER",
      name: "Smoke cash transfer",
      amount: "1200.00",
      fee: "0",
      tax: "0",
      currency: "EUR",
      description: "Smoke cash deposit",
      transaction_id: `vercel-smoke-${runId}-cash`
    },
    {
      datetime: `${date}T10:00:00.000Z`,
      date,
      account_type: "SECURITIES",
      category: "TRADING",
      type: "BUY",
      asset_class: "ETF",
      name: "Core MSCI World",
      symbol: "IE00B4L5Y983",
      shares: "1.2500",
      price: "82.40",
      amount: "-103.00",
      fee: "0",
      tax: "0",
      currency: "EUR",
      description: "Smoke ETF buy",
      transaction_id: `vercel-smoke-${runId}-etf`
    },
    {
      datetime: `${date}T11:00:00.000Z`,
      date,
      account_type: "CRYPTO",
      category: "TRADING",
      type: "BUY",
      asset_class: "CRYPTO",
      name: "Bitcoin",
      symbol: "BTC",
      shares: "0.0025",
      price: "65000.00",
      amount: "-162.50",
      fee: "0",
      tax: "0",
      currency: "EUR",
      description: "Smoke BTC buy",
      transaction_id: `vercel-smoke-${runId}-btc`
    }
  ];

  return toTradeRepublicCsv(rows);
}

async function saveScreenshot(page, name) {
  return saveE2eScreenshot(page, outDir, name, { screenshots });
}

async function waitForServer() {
  await waitForHealthCheck(baseUrl, { timeoutMs: 60_000 });
}

async function expectNoOverlay(page, label) {
  await expectNoNextOverlay(page, label, {
    includePortal: true,
    message: "unexpected Next hydration/error overlay:"
  });
}

async function login(page) {
  const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  assert(response?.ok(), `Initial request failed with status ${response?.status()}.`);
  await page.locator('main[data-auth-shell-ready="true"], main[data-finance-shell-ready="true"]').waitFor({
    state: "attached",
    timeout: 30_000
  });

  if (await page.locator('main[data-finance-shell-ready="true"]').count() > 0) {
    steps.push("already_authenticated");
    return;
  }

  await page.getByRole("button", { name: "Log in Existing account", exact: true }).click();
  await page.getByPlaceholder("Email", { exact: true }).fill(testEmail);
  await page.getByPlaceholder("Password", { exact: true }).fill(testPassword);
  await page.locator('button[aria-label="Log in"]').click();
  await page.locator('main[data-finance-shell-ready="true"]').waitFor({ state: "attached", timeout: 45_000 });
  await expectNoOverlay(page, "after login");
  steps.push("logged_in_persistent_account");
}

async function listProfiles(page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/users", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? `GET /api/users failed: ${response.status}`);
    return Array.isArray(payload.users) ? payload.users : [];
  });
}

async function deleteProfile(page, profileId) {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? `DELETE /api/users/${id} failed: ${response.status}`);
    return payload;
  }, profileId);
}

async function cleanupSmokeProfiles(page) {
  const users = await listProfiles(page);
  const smokeProfiles = users.filter((user) => user.name?.startsWith(profilePrefix));

  for (const profile of smokeProfiles) {
    await deleteProfile(page, profile.id);
  }

  return smokeProfiles.map((profile) => ({ id: profile.id, name: profile.name }));
}

async function createSmokeProfile(page) {
  const payload = await page.evaluate(async (name) => {
    const response = await fetch("/api/users", {
      body: JSON.stringify({ name }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? `POST /api/users failed: ${response.status}`);
    return data;
  }, profileName);

  assert(payload.user?.id, "Profile creation did not return a profile id.");
  await page.evaluate((profileId) => {
    window.localStorage.setItem("morgan_active_user", profileId);
    window.localStorage.setItem("morgan_stage", "dashboard");
  }, payload.user.id);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('main[data-finance-shell-ready="true"]').waitFor({ state: "attached", timeout: 30_000 });
  await page.getByRole("heading", { name: "Upload", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  steps.push("created_smoke_profile");

  return payload.user;
}

async function importSmokeTransactions(page) {
  await importFileThroughUi(
    page,
    {
      buffer: Buffer.from(buildTradeRepublicCsv(), "utf8"),
      mimeType: "text/csv",
      name: "vercel-smoke-trade-republic.csv"
    },
    3,
    {
      label: "imported_vercel_smoke_trade_republic",
      reviewTimeoutMs: 45_000,
      spinnerTimeoutMs: 180_000,
      steps
    }
  );

  return waitForProfile(page, profileName, (profile) =>
    profile.transactionCount > 0 &&
    profile.checkingCount > 0 &&
    profile.investmentCount > 0 &&
    profile.cryptoCount > 0,
  "after smoke import", { timeoutMs: 60_000 });
}

async function expectStableTopbarValues(page, label, { minimumNumeric = 1 } = {}) {
  const result = await page.waitForFunction(({ minimumNumeric: minNumeric }) => {
    const tabs = Array.from(document.querySelectorAll(".dashboard-topbar-tab"));
    const getAmounts = (value) => value.match(/\d[\d.]*,\d{2}/g) ?? [];
    const isZeroAmount = (amount) => Number(amount.replace(/\./g, "").replace(",", ".")) === 0;
    const values = tabs
      .map((tab) => (tab.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const pending = values.filter((value) => value.includes("--") || value === "0,00" || value === "0,00 €");
    const numeric = values.filter((value) =>
      getAmounts(value).some((amount) => !isZeroAmount(amount))
    );

    return {
      ok: values.length > 0 && pending.length === 0 && numeric.length >= minNumeric,
      numeric,
      pending,
      values
    };
  }, { minimumNumeric }, { timeout: 90_000 });
  const value = await result.jsonValue();

  assert(value.ok, `${label}: topbar values were not stable: ${JSON.stringify(value)}`);
  return value;
}

async function clickStage(page, name) {
  const button = page.getByRole("button", { name, exact: true });
  await button.waitFor({ state: "visible", timeout: 45_000 });
  await button.click();
}

async function exerciseDashboards(page) {
  await clickStage(page, "Dashboard");
  await waitForAny(page.getByText("TRADE REPUBLIC", { exact: true }), "dashboard Trade Republic provider", 45_000);
  const dashboardTopbar = await expectStableTopbarValues(page, "dashboard topbar", { minimumNumeric: 3 });
  await saveScreenshot(page, "01-dashboard-after-import.png");

  await clickStage(page, "Investments");
  await waitForAny(page.getByText("Core MSCI World", { exact: false }), "investment product", 45_000);
  const investmentTopbar = await expectStableTopbarValues(page, "investment topbar");

  await clickStage(page, "Crypto");
  await waitForAny(page.getByText("Bitcoin", { exact: false }), "crypto product", 45_000);
  const cryptoTopbar = await expectStableTopbarValues(page, "crypto topbar");

  await clickStage(page, "Checking");
  await waitForAny(page.getByText("CHECKING", { exact: true }), "checking title", 45_000);
  const checkingTopbar = await expectStableTopbarValues(page, "checking topbar");
  steps.push("verified_dashboard_investment_crypto_checking_topbars");

  return {
    checkingTopbar,
    cryptoTopbar,
    dashboardTopbar,
    investmentTopbar
  };
}

async function connectBinance(page) {
  if (!binanceApiKey || !binanceApiSecret) {
    if (requireBinance) {
      throw new Error("Binance credentials are required but missing.");
    }
    steps.push("skipped_binance_missing_env");
    return { attempted: false, status: "skipped_missing_env" };
  }

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const panel = page.locator('[role="dialog"][data-modal-panel="settings"]');
  await panel.waitFor({ state: "visible", timeout: 15_000 });
  await panel.locator("button").filter({ hasText: "API Key" }).click();
  await panel.getByRole("heading", { name: "BINANCE", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
  await panel.getByPlaceholder("Enter API Key", { exact: true }).fill(binanceApiKey);
  await panel.getByPlaceholder("Enter Secret Key", { exact: true }).fill(binanceApiSecret);
  await panel.locator('button[title="Save API Keys"]').click();
  await panel.getByText("Connected!", { exact: false }).waitFor({ state: "visible", timeout: 120_000 });
  await panel.locator('button[title="Delete Saved API Keys"]').waitFor({ state: "visible", timeout: 90_000 });
  await saveScreenshot(page, "02-binance-connected-settings.png");

  const closeButton = page.getByRole("button", { name: "Esci dalle impostazioni", exact: true });
  await closeButton.click();
  await panel.waitFor({ state: "detached", timeout: 15_000 });
  await clickStage(page, "Binance");
  await waitForAny(page.getByText("BINANCE", { exact: true }), "Binance dashboard", 45_000);
  const binanceTopbar = await expectStableTopbarValues(page, "binance topbar");

  await clickStage(page, "Crypto");
  await waitForAny(page.getByText("BINANCE", { exact: true }), "Binance card in crypto dashboard", 45_000);
  const cryptoWithBinanceTopbar = await expectStableTopbarValues(page, "crypto topbar with Binance");
  steps.push("connected_binance_and_verified_topbars");

  return {
    attempted: true,
    cryptoWithBinanceTopbar,
    status: "connected_or_saved",
    topbar: binanceTopbar
  };
}

let browser;
let page;
let createdProfileId = null;
let cleanupBeforeRun = [];
let cleanupAfterRun = [];

try {
  await waitForServer();

  browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADLESS !== "0" });
  const context = await browser.newContext({ viewport: { width: 1572, height: 1270 } });
  page = await context.newPage();
  page.on("console", (message) => {
    const text = message.text();
    if (["error", "warning"].includes(message.type())) {
      browserErrors.push({ type: message.type(), text: text.slice(0, 500) });
    }
  });
  page.on("pageerror", (error) => browserErrors.push({ type: "pageerror", text: error.message.slice(0, 500) }));
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400) {
      httpErrors.push({ status, url: response.url() });
    }
  });

  await login(page);
  cleanupBeforeRun = await cleanupSmokeProfiles(page);
  const profile = await createSmokeProfile(page);
  createdProfileId = profile.id;
  const profileAfterImport = await importSmokeTransactions(page);
  const topbarChecks = await exerciseDashboards(page);
  const binanceResult = await connectBinance(page);

  await expectNoOverlay(page, "after Vercel smoke");
  assert(browserErrors.length === 0, `Browser errors/warnings found: ${JSON.stringify(browserErrors)}`);
  assert(httpErrors.length === 0, `Unexpected HTTP errors found: ${JSON.stringify(httpErrors)}`);

  if (!keepProfile) {
    cleanupAfterRun = await cleanupSmokeProfiles(page);
    steps.push("deleted_smoke_profiles");
  } else {
    steps.push("kept_smoke_profile_for_manual_review");
  }

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    loadedEnvFile,
    profileName,
    createdProfileId,
    keepProfile,
    cleanupBeforeRun,
    cleanupAfterRun,
    profileAfterImport,
    topbarChecks,
    binanceResult,
    steps,
    screenshots,
    browserErrors,
    httpErrors
  }, null, 2));
} catch (error) {
  if (page) {
    await saveScreenshot(page, "failure-vercel-persistent-account-smoke.png").catch(() => null);
    if (!keepProfile) {
      cleanupAfterRun = await cleanupSmokeProfiles(page).catch((cleanupError) => [{
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
      }]);
    }
  }

  console.error(JSON.stringify({
    ok: false,
    baseUrl,
    loadedEnvFile,
    profileName,
    createdProfileId,
    keepProfile,
    cleanupBeforeRun,
    cleanupAfterRun,
    steps,
    error: error instanceof Error ? error.message : String(error),
    screenshots,
    browserErrors,
    httpErrors
  }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
}
