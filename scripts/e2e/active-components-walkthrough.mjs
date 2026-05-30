import fs from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";

import {
  assert,
  authUserPrefixWhere,
  buildXlsxBufferFromRows,
  cleanupUsersByPrefix,
  expectNoNextOverlay,
  isoDate,
  italianDate,
  italianMoney,
  importFileThroughUi,
  saveScreenshot as saveE2eScreenshot,
  toTradeRepublicCsv,
  waitForAny,
  waitForHealthCheck,
  waitForProfile
} from "./e2e-helpers.mjs";
import {
  restoreRateLimits,
  snapshotAndClearRateLimits
} from "../lib/rate-limit-test-scope.mjs";

const baseUrl = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const keepAccount = process.argv.includes("--keep-account") || process.env.KEEP_ACTIVE_COMPONENTS_ACCOUNT === "1";
const postgresPort = process.env.POSTGRES_PORT ?? "5432";
const dockerDatabaseUrl = `postgresql://morgan:morgan@localhost:${postgresPort}/morgan?schema=public`;
const databaseUrl = process.env.TEST_DATABASE_URL ?? dockerDatabaseUrl;
process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = process.env.TEST_DIRECT_URL ?? databaseUrl;
process.env.MORGAN_DATABASE_PROVIDER = "postgresql";

const binanceApiKey = process.env.BINANCE_TEST_API_KEY ?? "";
const binanceApiSecret = process.env.BINANCE_TEST_API_SECRET ?? "";
const outDir = path.resolve("artifacts/e2e/active-components-walkthrough");
const prisma = new PrismaClient();
const runId = Date.now().toString(36);
const username = `activeflow${runId}`;
const email = `${username}@example.test`;
const password = "Temporary active components password 2026!";
const signupInviteCode = process.env.MORGAN_SIGNUP_INVITE_CODE ?? "local-test-invite-code";
const profileName = `Active Flow ${runId.slice(-6)}`;
const secondProfileName = `Active Flow Extra ${runId.slice(-6)}`;
const trPath = path.join(outDir, "trade-republic-active-components.csv");
const bbvaPath = path.join(outDir, "bbva-active-components.xlsx");
const browserErrors = [];
const httpErrors = [];
const allowedHttpErrors = [];
const screenshots = [];
const steps = [];

async function prepareFixtures() {
  const tradeRepublicRows = [];
  let rowIndex = 0;
  let checkingCount = 0;
  let investmentCount = 0;
  let cryptoCount = 0;

  for (let month = 0; month < 24; month += 1) {
    const date = isoDate(month * 30, new Date(Date.UTC(2024, 0, 5)));
    tradeRepublicRows.push({
      datetime: `${date}T09:00:00.000Z`,
      date,
      account_type: "CASH",
      category: "CASH",
      type: "TRANSFER",
      name: "Broker cash transfer",
      amount: month % 3 === 0 ? "1500.00" : "600.00",
      fee: "0",
      tax: "0",
      currency: "EUR",
      description: `Active flow broker cash transfer ${month + 1}`,
      transaction_id: `active-${runId}-cash-${rowIndex++}`
    });
    checkingCount += 1;

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
        description: `Active flow ETF buy ${month + 1}`,
        transaction_id: `active-${runId}-etf-${rowIndex++}`
      });
      investmentCount += 1;
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
        description: `Active flow stock buy ${month + 1}`,
        transaction_id: `active-${runId}-stock-${rowIndex++}`
      });
      investmentCount += 1;
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
        description: `Active flow BTC buy ${month + 1}`,
        transaction_id: `active-${runId}-btc-${rowIndex++}`
      });
      cryptoCount += 1;
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
        description: `Active flow ETH buy ${month + 1}`,
        transaction_id: `active-${runId}-eth-${rowIndex++}`
      });
      cryptoCount += 1;
    }
  }

  const bbvaRows = [["Active BBVA"], ["Data", "Parola chiave", "Importo", "Disponibile", "Osservazioni"]];
  let balance = 750;
  for (let index = 0; index < 120; index += 1) {
    const date = new Date(Date.UTC(2023, 0, 10));
    date.setUTCDate(date.getUTCDate() + index * 8);
    let amount;
    let type;
    let description;

    if (index % 13 === 0) {
      amount = 2350;
      type = "Bonifico ricevuto";
      description = `Active salary long history ${index}`;
    } else if (index % 17 === 0) {
      amount = 8.35;
      type = "Interessi";
      description = `Active interest ${index}`;
    } else if (index % 19 === 0) {
      amount = 11.2;
      type = "Premio";
      description = `Active cashback ${index}`;
    } else if (index % 23 === 0) {
      amount = -42.6;
      type = "Tax";
      description = `Active tax withholding ${index}`;
    } else {
      amount = -((index % 9) * 17.33 + 12.49);
      type = index % 3 === 0 ? "Pagamento carta" : (index % 3 === 1 ? "Addebito SEPA" : "Prelievo");
      description = `Active checking expense ${index}`;
    }

    balance += amount;
    if (index === 3) balance = -125.44;
    bbvaRows.push([italianDate(date), type, italianMoney(amount), italianMoney(balance), description]);
  }

  const tradeRepublicCsv = toTradeRepublicCsv(tradeRepublicRows);
  const bbvaXlsx = buildXlsxBufferFromRows(bbvaRows);

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(trPath, tradeRepublicCsv);
  await fs.writeFile(bbvaPath, bbvaXlsx);

  return {
    tradeRepublicRows: tradeRepublicRows.length,
    tradeRepublicCashOnlyCount: checkingCount,
    tradeRepublicCheckingCount: tradeRepublicRows.length,
    tradeRepublicInvestmentCount: investmentCount,
    tradeRepublicCryptoCount: cryptoCount,
    bbvaRows: bbvaRows.length - 2
  };
}

async function waitForServer() {
  await waitForHealthCheck(baseUrl);
}

async function saveScreenshot(page, name) {
  return saveE2eScreenshot(page, outDir, name, { screenshots });
}

async function expectNoOverlay(page, label) {
  await expectNoNextOverlay(page, label);
}

async function importFile(page, filePath, expectedNewCount, label, openAddDocument = false) {
  await importFileThroughUi(page, filePath, expectedNewCount, {
    label,
    openAddDocument,
    captureScreenshot: (name) => saveScreenshot(page, name),
    steps
  });
}

async function clickIfVisible(locator) {
  if (await locator.count() === 0) return false;
  if (!(await locator.first().isVisible())) return false;
  await locator.first().click();
  return true;
}

async function expectTopbarTabActive(page, tabLabel) {
  const tab = page.getByRole("button", { name: `${tabLabel} dashboard tab`, exact: true });
  await tab.waitFor({ state: "visible", timeout: 10_000 });
  const active = await tab.getAttribute("data-active", { timeout: 10_000 });
  assert(active === "true", `Expected ${tabLabel} dashboard tab to be active, got ${active}`);
}

async function clickTopbarTab(page, tabLabel) {
  await page.getByRole("button", { name: `${tabLabel} dashboard tab`, exact: true }).click();
  await expectTopbarTabActive(page, tabLabel);
}

async function clickChartTimeRange(page, range) {
  await page.getByTestId("dashboard-chart-controls").getByRole("button", { name: range, exact: true }).click();
  await page.getByTestId("dashboard-chart").locator(".recharts-wrapper").first().waitFor({ state: "visible", timeout: 10_000 });
}

async function expectChartTooltip(page, label) {
  const chart = page.locator(".recharts-wrapper:visible").first();
  await chart.waitFor({ state: "visible", timeout: 15_000 });
  const box = await chart.boundingBox();
  assert(box, `${label}: chart bounding box not available`);

  const hoverPoints = [
    { x: box.x + box.width * 0.76, y: box.y + box.height * 0.36 },
    { x: box.x + box.width * 0.62, y: box.y + box.height * 0.42 },
    { x: box.x + box.width * 0.48, y: box.y + box.height * 0.50 },
    { x: box.x + box.width * 0.34, y: box.y + box.height * 0.56 }
  ];

  for (const point of hoverPoints) {
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(250);
    const tooltipState = await page.evaluate(() => {
      const wrapper = Array.from(document.querySelectorAll(".recharts-tooltip-wrapper")).find((node) =>
        getComputedStyle(node).visibility !== "hidden" && node.textContent?.trim()
      );
      return {
        visible: Boolean(wrapper && getComputedStyle(wrapper).visibility !== "hidden" && wrapper.textContent?.trim()),
        text: wrapper?.textContent?.trim() ?? ""
      };
    });

    if (tooltipState.visible) {
      assert(/€|EUR|TOTAL|CHECKING|INVESTMENT|CRYPTO|BINANCE|TRADE|BBVA/i.test(tooltipState.text), `${label}: tooltip text did not include financial values: ${tooltipState.text}`);
      return tooltipState.text;
    }
  }

  throw new Error(`${label}: chart tooltip did not appear after hover attempts.`);
}

async function clickChartDataPoint(page, label) {
  const chart = page.getByTestId("dashboard-chart").locator(".recharts-wrapper").first();
  await chart.waitFor({ state: "visible", timeout: 15_000 });
  const box = await chart.boundingBox();
  assert(box, `${label}: chart bounding box not available`);

  const hoverPoints = [
    { x: box.x + box.width * 0.76, y: box.y + box.height * 0.36 },
    { x: box.x + box.width * 0.62, y: box.y + box.height * 0.42 },
    { x: box.x + box.width * 0.48, y: box.y + box.height * 0.50 },
    { x: box.x + box.width * 0.34, y: box.y + box.height * 0.56 }
  ];

  let activeDot = null;
  for (const point of hoverPoints) {
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(250);
    activeDot = await page.evaluate(() => {
      const chartNode = document.querySelector("[data-testid='dashboard-chart'] .recharts-wrapper");
      if (!chartNode) return null;
      const candidates = Array.from(chartNode.querySelectorAll("circle"))
        .map((circle) => {
          const rect = circle.getBoundingClientRect();
          const radius = Number(circle.getAttribute("r") ?? "0");
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius };
        })
        .filter((circle) => Number.isFinite(circle.x) && Number.isFinite(circle.y) && circle.radius >= 5);
      return candidates.at(-1) ?? null;
    });
    if (activeDot) break;
  }

  assert(activeDot, `${label}: active chart dot not found after hover.`);
  await page.mouse.click(activeDot.x, activeDot.y);
  await page.waitForTimeout(300);

  const hasReferenceLine = await page.evaluate(() => {
    const overlay = document.getElementById("chart-reference-overlay");
    const overlayText = overlay?.textContent?.trim() ?? "";
    const dashedReference = Array.from(document.querySelectorAll("path,line")).some((node) => {
      const strokeDasharray = node.getAttribute("stroke-dasharray") ?? "";
      return strokeDasharray.includes("6 4");
    });
    return Boolean(overlayText || dashedReference);
  });

  assert(hasReferenceLine, `${label}: expected chart point click to create a reference line or value label.`);
}

async function exerciseChartLegend(page, labels, label, minimumExpected = labels.length) {
  let exercisedCount = 0;

  for (const legendLabel of labels) {
    const legendButton = page.getByTestId("dashboard-chart-legend").getByRole("button", { name: legendLabel, exact: true });
    if (await legendButton.count() === 0 || !(await legendButton.first().isVisible())) {
      continue;
    }

    const visibleLegendButton = legendButton.first();
    await visibleLegendButton.click();
    await page.waitForTimeout(150);
    const className = await visibleLegendButton.locator("span").first().getAttribute("class", { timeout: 10_000 });
    assert(className?.includes("line-through"), `${label}: expected ${legendLabel} legend item to be hidden after first click.`);
    await visibleLegendButton.click();
    await page.waitForTimeout(150);
    const restoredClassName = await visibleLegendButton.locator("span").first().getAttribute("class", { timeout: 10_000 });
    assert(!restoredClassName?.includes("line-through"), `${label}: expected ${legendLabel} legend item to be restored after second click.`);
    exercisedCount += 1;
  }

  assert(exercisedCount >= minimumExpected, `${label}: expected to exercise at least ${minimumExpected} legend items, exercised ${exercisedCount}.`);
}

async function exerciseDashboardChartInteractions(page) {
  await clickTopbarTab(page, "HERITAGE");
  await exerciseDashboardBinanceCardControls(page);
  await expectChartTooltip(page, "heritage chart hover");
  await clickChartDataPoint(page, "heritage chart point click");
  await exerciseChartLegend(page, ["CHECKING", "INVESTMENT", "CRYPTO"], "heritage chart legend");
  for (const range of ["1Y", "6M", "3M", "1M", "1W", "ALL"]) {
    await clickChartTimeRange(page, range);
  }
  await saveScreenshot(page, "chart-interactions-heritage.png");

  await clickTopbarTab(page, "CHECKING");
  await expectChartTooltip(page, "checking chart hover");
  await exerciseChartLegend(page, ["BBVA", "TRADE REPUBLIC"], "checking chart legend", 1);

  await clickTopbarTab(page, "INVESTMENT");
  await expectChartTooltip(page, "investment chart hover");
  await exerciseChartLegend(page, ["Core MSCI World", "Apple Inc"], "investment chart legend", 1);
  await page.getByTestId("dashboard-chart-controls").getByRole("button", { name: "Toggle sold assets", exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByTestId("dashboard-chart-controls").getByRole("button", { name: "Toggle sold assets", exact: true }).click();
  await page.waitForTimeout(200);

  await clickTopbarTab(page, "CRYPTO");
  await expectChartTooltip(page, "crypto chart hover");
  await exerciseChartLegend(page, ["TRADE REPUBLIC", "BINANCE"], "crypto chart legend");
  await saveScreenshot(page, "chart-interactions-tabs-legend.png");

  steps.push("exercised_dashboard_chart_tooltip_legend_ranges_topbar");
}

async function exerciseDashboardBinanceCardControls(page) {
  const filterToggle = page.locator('div[title="Nascondi token sotto 0,95 EUR"]:visible, div[title="Mostra tutti i token"]:visible').first();
  await filterToggle.waitFor({ state: "visible", timeout: 10_000 });
  const beforeTitle = await filterToggle.getAttribute("title", { timeout: 10_000 });
  await filterToggle.click();
  await page.waitForTimeout(200);
  const afterTitle = await filterToggle.getAttribute("title", { timeout: 10_000 });
  assert(beforeTitle !== afterTitle, `Binance filter toggle did not change title: ${beforeTitle}`);
  await filterToggle.click();
  await page.waitForTimeout(200);

  await clickIfVisible(page.getByText("BINANCE", { exact: true }));
  await saveScreenshot(page, "dashboard-binance-card-controls.png");
  steps.push("exercised_dashboard_binance_card_controls");
}

async function exerciseBinanceChartInteractions(page) {
  await page.getByRole("button", { name: "Binance", exact: true }).click();
  await waitForAny(page.getByText("BINANCE", { exact: true }), "Binance chart header");
  await expectChartTooltip(page, "Binance chart hover");
  await saveScreenshot(page, "binance-interactions-active.png");
  steps.push("exercised_binance_chart_controls");
}

async function openSettingsSection(page, buttonName, headingName) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const panel = page.locator('[role="dialog"][data-modal-panel="settings"]');
  await panel.waitFor({ state: "visible", timeout: 10_000 });
  if (buttonName) {
    await panel.getByRole("button", { name: buttonName, exact: true }).click();
  }
  if (headingName) {
    await panel.getByRole("heading", { name: headingName, exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  }
  return panel;
}

async function closeSettings(page) {
  await page.getByRole("button", { name: "Esci dalle impostazioni", exact: true }).click();
  await page.locator('[role="dialog"][data-modal-panel="settings"]').waitFor({ state: "detached", timeout: 10_000 });
}

async function seedCachedBinanceBalances(userId, { preserveCredentials = false } = {}) {
  await prisma.$transaction(async (tx) => {
    if (!preserveCredentials) {
      await tx.user.update({
        where: { id: userId },
        data: {
          binanceApiKeyEncrypted: "seeded-not-for-sync",
          binanceApiSecretEncrypted: "seeded-not-for-sync",
          binanceApiKeyPreview: "seeded..."
        }
      });
    }

    await tx.binanceBalance.deleteMany({ where: { userId } });
    await tx.binanceBalance.createMany({
      data: [
        { userId, tokenSymbol: "BTC", tokenName: "Bitcoin", freeAmount: 0.018, lockedAmount: 0, eurValue: 1188.72 },
        { userId, tokenSymbol: "ETH", tokenName: "Ethereum", freeAmount: 0.65, lockedAmount: 0.02, eurValue: 2144.41 },
        { userId, tokenSymbol: "SOL", tokenName: "Solana", freeAmount: 18.2, lockedAmount: 0, eurValue: 1774.5 },
        { userId, tokenSymbol: "USDT", tokenName: "Tether", freeAmount: 450, lockedAmount: 0, eurValue: 417.9 }
      ]
    });
    await tx.priceCache.upsert({
      where: { key: `binance_sync_${userId}` },
      update: { timestamp: new Date() },
      create: { key: `binance_sync_${userId}`, timestamp: new Date() }
    });
  });
}

async function configureBinance(page, userId) {
  if (!binanceApiKey || !binanceApiSecret) {
    await seedCachedBinanceBalances(userId);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('main[data-finance-shell-ready="true"]').waitFor({ state: "attached", timeout: 30_000 });
    return { mode: "seeded_cached_balances", balanceCount: 4 };
  }

  const panel = await openSettingsSection(page, "API Key Manage API", "BINANCE");
  await panel.getByPlaceholder("Enter API Key", { exact: true }).fill(binanceApiKey);
  await panel.getByPlaceholder("Enter Secret Key", { exact: true }).fill(binanceApiSecret);
  await panel.locator('button[title="Save API Keys"]').click();
  await panel.locator('button[title="Delete Saved API Keys"]').waitFor({ state: "visible", timeout: 90_000 });
  const panelText = await panel.innerText({ timeout: 10_000 });
  const balanceCount = await prisma.binanceBalance.count({ where: { userId } });

  if (balanceCount === 0) {
    await seedCachedBinanceBalances(userId, { preserveCredentials: true });
  }

  await closeSettings(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('main[data-finance-shell-ready="true"]').waitFor({ state: "attached", timeout: 30_000 });

  return {
    mode: balanceCount > 0 ? "real_credentials_synced" : "real_credentials_saved_seeded_balances",
    balanceCount: balanceCount || 4,
    message: panelText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-5)
      .join(" | ")
  };
}

async function createSecondProfileAndReturn(page) {
  await page.getByRole("button", { name: "Select profile", exact: true }).click();
  const panel = page.locator('[role="dialog"][data-modal-panel="profile"]');
  await panel.waitFor({ state: "visible", timeout: 10_000 });
  await saveScreenshot(page, "profile-selector.png");
  await panel.getByRole("button", { name: "New Profile Create new profile", exact: true }).click();
  await panel.getByRole("heading", { name: "New Profile", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  await saveScreenshot(page, "profile-new-profile-menu.png");
  await panel.getByPlaceholder("Profile", { exact: true }).fill(secondProfileName);
  await panel.getByRole("button", { name: "Create profile", exact: true }).click();
  await waitForProfile(page, secondProfileName, () => true, "after second profile creation");
  await page.getByRole("heading", { name: "Upload", exact: true }).waitFor({ state: "visible", timeout: 30_000 });

  await page.getByRole("button", { name: "Select profile", exact: true }).click();
  await panel.waitFor({ state: "visible", timeout: 10_000 });
  await panel.getByRole("button", { name: profileName, exact: true }).click();
  await panel.waitFor({ state: "detached", timeout: 10_000 });
  await page.getByRole("button", { name: "Dashboard", exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  steps.push("navigated_profile_selector_and_returned_to_primary_profile");
}

async function exerciseActiveComponents(page) {
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await waitForAny(page.getByText("BBVA", { exact: true }), "dashboard BBVA provider");
  await waitForAny(page.getByText("TRADE REPUBLIC", { exact: true }), "dashboard Trade Republic provider");
  await waitForAny(page.getByText("BINANCE", { exact: true }), "dashboard Binance card");
  await saveScreenshot(page, "dashboard-heritage-active.png");
  await exerciseDashboardChartInteractions(page);

  await page.getByRole("button", { name: "Checking", exact: true }).click();
  await waitForAny(page.getByText("Active checking expense", { exact: false }), "checking transaction content");
  await saveScreenshot(page, "checking-active.png");

  await page.getByRole("button", { name: "Investments", exact: true }).click();
  await waitForAny(page.getByText("Core MSCI World", { exact: false }), "investment product content");
  await saveScreenshot(page, "investments-active.png");

  await page.getByRole("button", { name: "Crypto", exact: true }).click();
  await waitForAny(page.getByText("Bitcoin", { exact: false }), "crypto token content");
  await saveScreenshot(page, "crypto-active.png");

  await exerciseBinanceChartInteractions(page);
  await saveScreenshot(page, "binance-active.png");

  await page.getByRole("button", { name: "Add document", exact: true }).click();
  await page.locator('[role="dialog"][data-modal-panel="upload"]').waitFor({ state: "visible", timeout: 10_000 });
  await page.getByRole("heading", { name: "Upload", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  await saveScreenshot(page, "upload-overlay-active.png");
  await page.getByRole("button", { name: "Esci dall'importazione", exact: true }).click();

  const generalPanel = await openSettingsSection(page, "Settings General Settings", "General Settings");
  await generalPanel.getByText(email, { exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  await saveScreenshot(page, "settings-general-menu.png");
  await generalPanel.getByRole("button", { name: "API Key Manage API", exact: true }).click();
  await generalPanel.getByRole("heading", { name: "BINANCE", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  await saveScreenshot(page, "settings-api-menu.png");
  await generalPanel.getByRole("button", { name: "Danger zone Delete account", exact: true }).click();
  await generalPanel.getByRole("heading", { name: "Danger Zone", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  await saveScreenshot(page, "settings-danger-menu.png");
  await closeSettings(page);

  await createSecondProfileAndReturn(page);
  steps.push("exercised_active_dashboard_sections_and_overlay_menus");
}

async function deleteAccountViaUi(page) {
  const panel = await openSettingsSection(page, "Danger zone Delete account", "Danger Zone");
  await panel.getByRole("button", { name: "Delete Account", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete account", exact: true });
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  await dialog.getByPlaceholder("Enter your password", { exact: true }).fill(password);
  await dialog.getByRole("button", { name: "Delete account", exact: true }).click();
  await page.locator('main[data-auth-shell-ready="true"]').waitFor({ state: "attached", timeout: 30_000 });
  await page.getByRole("button", { name: "Register New account", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  await saveScreenshot(page, "after-account-delete.png");
  steps.push("deleted_account_via_ui");
}

let browser;
let page;
let primaryProfileId = null;
let initialRateLimits = [];
let capturedRateLimits = false;

try {
  const fixtureSummary = await prepareFixtures();
  await waitForServer();
  initialRateLimits = await snapshotAndClearRateLimits({ prisma });
  capturedRateLimits = true;
  const cleanupBeforeRun = await cleanupUsersByPrefix(prisma, ["activeflow"]);

  browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADLESS !== "0" });
  const context = await browser.newContext({ viewport: { width: 1572, height: 1270 } });
  page = await context.newPage();
  page.on("console", (message) => {
    const text = message.text();
    if (/Failed to load resource: the server responded with a status of 429/.test(text)) {
      return;
    }
    if (["error", "warning"].includes(message.type())) {
      browserErrors.push({ type: message.type(), text: message.text().slice(0, 500) });
    }
  });
  page.on("pageerror", (error) => browserErrors.push({ type: "pageerror", text: error.message.slice(0, 500) }));
  page.on("response", (response) => {
    const status = response.status();
    if (status < 400) return;

    const record = {
      status,
      url: response.url()
    };

    try {
      const pathname = new URL(response.url()).pathname;
      if (status === 429 && pathname === "/api/prices") {
        allowedHttpErrors.push(record);
        return;
      }
    } catch {
      // Non-URL responses are reported as unexpected below.
    }

    httpErrors.push(record);
  });

  const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  assert(response?.ok(), `Initial request failed: ${response?.status()}`);
  await page.locator('main[data-auth-shell-ready="true"]').waitFor({ state: "attached", timeout: 20_000 });
  await expectNoOverlay(page, "initial load");

  await page.getByRole("button", { name: "Register New account", exact: true }).click();
  await page.getByPlaceholder("Invite code", { exact: true }).fill(signupInviteCode);
  await page.getByPlaceholder("Email", { exact: true }).fill(email);
  await page.getByPlaceholder("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("button", { name: "Create profile", exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  steps.push("created_auth_account");

  await page.getByPlaceholder("Profile", { exact: true }).fill(profileName);
  await page.getByRole("button", { name: "Create profile", exact: true }).click();
  const createdProfile = await waitForProfile(page, profileName, () => true, "after primary profile creation");
  primaryProfileId = createdProfile.id;
  await page.locator('main[data-finance-shell-ready="true"]').waitFor({ state: "attached", timeout: 30_000 });
  await page.getByRole("heading", { name: "Upload", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  steps.push("created_primary_profile");

  await importFile(page, trPath, fixtureSummary.tradeRepublicRows, "imported_trade_republic_active_components");
  const afterTr = await waitForProfile(page, profileName, (profile) =>
    profile.transactionCount === fixtureSummary.tradeRepublicCheckingCount +
      fixtureSummary.tradeRepublicInvestmentCount +
      fixtureSummary.tradeRepublicCryptoCount &&
    profile.checkingCount === fixtureSummary.tradeRepublicCheckingCount &&
    profile.investmentCount === fixtureSummary.tradeRepublicInvestmentCount &&
    profile.cryptoCount === fixtureSummary.tradeRepublicCryptoCount,
  "after Trade Republic import");

  await importFile(page, bbvaPath, fixtureSummary.bbvaRows, "imported_bbva_active_components", true);
  const afterBbva = await waitForProfile(page, profileName, (profile) =>
    profile.transactionCount === afterTr.transactionCount + fixtureSummary.bbvaRows &&
    profile.checkingCount === afterTr.checkingCount + fixtureSummary.bbvaRows &&
    profile.investmentCount === afterTr.investmentCount &&
    profile.cryptoCount === afterTr.cryptoCount,
  "after BBVA import");

  const binanceResult = await configureBinance(page, primaryProfileId);
  await exerciseActiveComponents(page);
  await expectNoOverlay(page, "after active component walkthrough");
  assert(browserErrors.length === 0, `Browser errors/warnings found: ${JSON.stringify(browserErrors)}`);
  assert(httpErrors.length === 0, `Unexpected HTTP errors found: ${JSON.stringify(httpErrors)}`);

  let remainingUsers = 0;
  if (keepAccount) {
    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    await waitForAny(page.getByText("BBVA", { exact: true }), "kept account dashboard BBVA provider");
    await waitForAny(page.getByText("TRADE REPUBLIC", { exact: true }), "kept account dashboard Trade Republic provider");
    await waitForAny(page.getByText("BINANCE", { exact: true }), "kept account dashboard Binance card");
    await saveScreenshot(page, "kept-account-ready.png");
    steps.push("kept_account_for_manual_review");
    remainingUsers = await prisma.authUser.count({
      where: authUserPrefixWhere(["activeflow"])
    });
    assert(remainingUsers > 0, "Expected activeflow test user to remain for manual review.");
  } else {
    await deleteAccountViaUi(page);
    await expectNoOverlay(page, "after account deletion");
    assert(browserErrors.length === 0, `Browser errors/warnings found: ${JSON.stringify(browserErrors)}`);
    assert(httpErrors.length === 0, `Unexpected HTTP errors found: ${JSON.stringify(httpErrors)}`);

    remainingUsers = await prisma.authUser.count({
      where: authUserPrefixWhere(["activeflow"])
    });
    assert(remainingUsers === 0, `Expected activeflow test users to be deleted, found ${remainingUsers}`);
  }

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    keepAccount,
    username,
    profileName,
    secondProfileName,
    primaryProfileId,
    remainingUsers,
    steps,
    fixtureSummary,
    cleanupBeforeRun,
    afterTr,
    afterBbva,
    binanceResult,
    screenshots,
    allowedHttpErrors,
    httpErrors,
    browserErrors
  }, null, 2));
} catch (error) {
  if (page) await saveScreenshot(page, "failure-active-components-walkthrough.png").catch(() => null);
  const forcedCleanup = keepAccount
    ? { skipped: true, reason: "--keep-account" }
    : await cleanupUsersByPrefix(prisma, ["activeflow"]).catch((cleanupError) => ({
      error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
    }));
  console.error(JSON.stringify({
    ok: false,
    baseUrl,
    keepAccount,
    username,
    profileName,
    secondProfileName,
    primaryProfileId,
    steps,
    error: error instanceof Error ? error.message : String(error),
    forcedCleanup,
    browserErrors,
    httpErrors,
    allowedHttpErrors,
    screenshots
  }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (capturedRateLimits) {
    await restoreRateLimits(initialRateLimits, { prisma });
  }
  await prisma.$disconnect();
}
