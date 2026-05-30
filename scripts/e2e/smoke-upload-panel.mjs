import { execFile as execFileCallback, spawn } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { promisify } from "node:util";

import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";

import {
  assert,
  cleanupUsersByPrefix
} from "./e2e-helpers.mjs";
import {
  applyEnvFileDatabaseUrl,
  restoreRateLimits,
  snapshotAndClearRateLimits
} from "../lib/rate-limit-test-scope.mjs";

applyEnvFileDatabaseUrl();

const execFile = promisify(execFileCallback);
const rootDir = process.cwd();
const host = "127.0.0.1";
const password = "Temporary smoke password 2026!";
const signupInviteCode = process.env.MORGAN_SIGNUP_INVITE_CODE ?? "local-test-invite-code";

function readArgValue(name) {
  const equalsPrefix = `${name}=`;
  const equalsArg = process.argv.find((arg) => arg.startsWith(equalsPrefix));
  if (equalsArg) {
    return equalsArg.slice(equalsPrefix.length);
  }

  const index = process.argv.indexOf(name);
  if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--")) {
    return process.argv[index + 1];
  }

  return null;
}

const configuredBaseUrl = readArgValue("--base-url")?.replace(/\/$/, "") ?? null;
const shouldStartServer = !process.argv.includes("--no-start-server") && !configuredBaseUrl;

if (!shouldStartServer && !configuredBaseUrl) {
  throw new Error("--no-start-server requires --base-url.");
}

function onceAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findAvailablePort(startPort = 3100) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await onceAvailable(port)) {
      return port;
    }
  }
  throw new Error("No available port found for the smoke test.");
}

async function waitForServer(url, child, getLogs) {
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) {
      throw new Error(`Next dev exited early with code ${child.exitCode}.\n${getLogs()}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until Next finishes booting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}.\n${getLogs()}`);
}

function startNextDev(port) {
  const baseUrl = `http://${host}:${port}`;
  const smokeOrigins = [
    baseUrl,
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`
  ].join(",");
  const nextBin = join(rootDir, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "-H", host, "-p", String(port)], {
    cwd: rootDir,
    env: {
      ...process.env,
      BETTER_AUTH_TRUSTED_ORIGINS: [
        process.env.BETTER_AUTH_TRUSTED_ORIGINS,
        smokeOrigins
      ].filter(Boolean).join(","),
      BETTER_AUTH_URL: baseUrl,
      PORT: String(port)
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });

  let logs = "";
  const appendLog = (chunk) => {
    logs += chunk.toString();
    logs = logs.slice(-10_000);
  };

  child.stdout.on("data", appendLog);
  child.stderr.on("data", appendLog);

  return { child, getLogs: () => logs };
}

async function stopProcessTree(child) {
  if (!child?.pid || child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    await execFile("taskkill", ["/pid", String(child.pid), "/t", "/f"]).catch(() => {});
    return;
  }

  child.kill("SIGTERM");
}

async function cleanupSmokeData(username) {
  const prisma = new PrismaClient();

  try {
    const cleanup = await cleanupUsersByPrefix(prisma, [username]);
    return cleanup.ownerIds.length;
  } finally {
    await prisma.$disconnect();
  }
}

async function expectInlineUploadPromptVisible(page, label) {
  const uploadPanelCount = await page.locator('[role="dialog"][data-modal-panel="upload"]').count();
  assert(uploadPanelCount === 0, `${label}: expected inline upload prompt instead of modal upload panel.`);

  await page.getByRole("heading", { name: "Upload", exact: true }).waitFor({
    state: "visible",
    timeout: 5_000
  });

  const addDocumentButton = page.locator('button[aria-label="Add document"]');
  await expectButtonActive(addDocumentButton, false, label);
  await expectButtonEnabled(addDocumentButton, false, label);
}

async function expectUploadHidden(page, label) {
  const uploadPanelCount = await page.locator('[role="dialog"][data-modal-panel="upload"]').count();
  assert(uploadPanelCount === 0, `${label}: expected Upload panel to be hidden.`);

  const addDocumentButton = page.locator('button[aria-label="Add document"]');
  await expectButtonActive(addDocumentButton, false, label);
  await expectButtonEnabled(addDocumentButton, false, label);
}

async function expectPanelCleared(page, label) {
  await page.locator("[role='dialog'][data-modal-panel]").waitFor({
    state: "detached",
    timeout: 5_000
  });

  const panelCount = await page.locator("[role='dialog'][data-modal-panel]").count();
  assert(panelCount === 0, `${label}: expected no modal panel, received ${panelCount}.`);

  const state = await page.evaluate(() => {
    const tabsPortal = document.querySelector("#dashboard-tabs-portal");
    const cardsPortal = document.querySelector("#dashboard-cards-portal");
    const welcomeBackground = document.querySelector("[data-panel-background='welcome']");

    return {
      cardsInert: cardsPortal?.hasAttribute("inert") ?? false,
      tabsInert: tabsPortal?.hasAttribute("inert") ?? false,
      welcomeBackgroundInert: welcomeBackground?.hasAttribute("inert") ?? false
    };
  });

  assert(
    !state.tabsInert && !state.cardsInert && !state.welcomeBackgroundInert,
    `${label}: expected inert attributes to be cleared, received ${JSON.stringify(state)}.`
  );
}

async function expectNoProfileSelectFlashOnReload(page, label) {
  await page.addInitScript(() => {
    window.__morganProfileSelectFlash = false;
    window.__morganProfileSelectFlashSamples = [];

    const inspect = () => {
      const ready = document.querySelector('main[data-finance-shell-ready="true"]');
      const text = document.body?.innerText ?? "";

      if (!ready && /\bSelect profile\b/.test(text)) {
        window.__morganProfileSelectFlash = true;
        window.__morganProfileSelectFlashSamples.push(text.slice(0, 400));
      }
    };

    const observer = new MutationObserver(inspect);
    observer.observe(document.documentElement, {
      characterData: true,
      childList: true,
      subtree: true
    });

    const interval = window.setInterval(inspect, 10);
    window.addEventListener("load", () => {
      window.setTimeout(() => {
        observer.disconnect();
        window.clearInterval(interval);
      }, 2_000);
    });

    inspect();
  });

  await page.waitForFunction(() => localStorage.getItem("morgan_active_user") && localStorage.getItem("morgan_stage") === "dashboard", {
    timeout: 5_000
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('main[data-finance-shell-ready="true"]').waitFor({
    state: "attached",
    timeout: 10_000
  });

  const flashState = await page.evaluate(() => ({
    flashed: window.__morganProfileSelectFlash === true,
    samples: window.__morganProfileSelectFlashSamples ?? []
  }));

  assert(
    !flashState.flashed,
    `${label}: Select profile appeared before client profile restore completed: ${JSON.stringify(flashState.samples)}.`
  );
}

async function expectElementIsolated(page, selector, label) {
  const state = await page.locator(selector).evaluate((element) => ({
    ariaHidden: element.getAttribute("aria-hidden"),
    inert: element.inert === true,
    inertAttribute: element.hasAttribute("inert")
  }));

  assert(
    state.ariaHidden === "true" && state.inert && state.inertAttribute,
    `${label}: expected ${selector} to be aria-hidden and inert, received ${JSON.stringify(state)}.`
  );
}

async function expectPanelIsolation(page, { background, label, panelType }) {
  const panel = page.locator(`[role="dialog"][data-modal-panel="${panelType}"]`);
  const panelCount = await panel.count();
  assert(panelCount === 1, `${label}: expected exactly one active ${panelType} panel, received ${panelCount}.`);
  await panel.waitFor({ state: "visible", timeout: 5_000 });

  await expectElementIsolated(page, "#dashboard-tabs-portal", `${label} tabs portal`);
  await expectElementIsolated(page, "#dashboard-cards-portal", `${label} cards portal`);
  await expectElementIsolated(page, `[data-panel-background="${background}"]`, `${label} ${background} background`);
}

async function expectPanelEnterMotion(page, { label, panelType }) {
  const motionElement = page.locator(
    `[role="dialog"][data-modal-panel="${panelType}"] [data-panel-motion="enter"]`
  );
  const count = await motionElement.count();
  assert(count === 1, `${label}: expected one ${panelType} enter motion element, received ${count}.`);

  const className = await motionElement.getAttribute("class");
  assert(
    className?.includes("panel-overlay-enter"),
    `${label}: expected ${panelType} to use the shared enter animation, received ${className}.`
  );
}

async function expectPanelTabOrder(page, { background, label, panelType }) {
  const panelSelector = `[role="dialog"][data-modal-panel="${panelType}"]`;
  await page.locator(panelSelector).evaluate((element) => element.focus());

  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press("Tab");

    const focusState = await page.evaluate(({ backgroundName }) => {
      const activeElement = document.activeElement;
      const appContent = document.querySelector("main > div");
      const backgroundElement = document.querySelector(`[data-panel-background="${backgroundName}"]`);
      const cardsPortal = document.querySelector("#dashboard-cards-portal");
      const tabsPortal = document.querySelector("#dashboard-tabs-portal");

      return {
        activeLabel: activeElement?.getAttribute("aria-label") ?? null,
        activeTag: activeElement?.tagName ?? null,
        activeText: activeElement?.textContent?.trim().slice(0, 80) ?? null,
        inAppContent: activeElement ? appContent?.contains(activeElement) === true : false,
        inBackground: activeElement ? backgroundElement?.contains(activeElement) === true : false,
        inCardsPortal: activeElement ? cardsPortal?.contains(activeElement) === true : false,
        inTabsPortal: activeElement ? tabsPortal?.contains(activeElement) === true : false
      };
    }, { backgroundName: background });

    assert(focusState.inAppContent, `${label}: focus escaped the app content: ${JSON.stringify(focusState)}.`);
    assert(!focusState.inBackground, `${label}: focus entered the hidden background: ${JSON.stringify(focusState)}.`);
    assert(!focusState.inCardsPortal, `${label}: focus entered the hidden cards portal: ${JSON.stringify(focusState)}.`);
    assert(!focusState.inTabsPortal, `${label}: focus entered the hidden tabs portal: ${JSON.stringify(focusState)}.`);
  }
}

async function expectPanelAccessibility(page, options) {
  await expectPanelIsolation(page, options);
  await expectPanelEnterMotion(page, options);
  await expectPanelTabOrder(page, options);
}

async function expectOnlyActivePanel(page, { label, panelType }) {
  const activePanels = await page.locator("[role='dialog'][data-modal-panel]").count();
  const exitingPanels = await page.locator("[data-exiting-panel]").count();
  const panel = page.locator(`[role="dialog"][data-modal-panel="${panelType}"]`);

  assert(activePanels === 1, `${label}: expected one active panel, received ${activePanels}.`);
  assert(exitingPanels === 0, `${label}: expected no exiting panel during direct switch, received ${exitingPanels}.`);
  assert(await panel.count() === 1, `${label}: expected active ${panelType} panel.`);
}

async function expectActiveProfileClickDoesNothing(page, label) {
  const profilePanel = page.locator('[role="dialog"][data-modal-panel="profile"]');
  const activeProfile = profilePanel.locator('button[aria-current="true"]');
  const activeText = await activeProfile.innerText();

  await activeProfile.click({ force: true });
  await page.waitForTimeout(350);
  await expectOnlyActivePanel(page, { label, panelType: "profile" });

  const currentActiveText = await profilePanel.locator('button[aria-current="true"]').innerText();
  assert(
    currentActiveText === activeText,
    `${label}: expected active profile click to keep ${activeText}, received ${currentActiveText}.`
  );
}

async function expectProfileSwitchUsesExitMotion(page, { fromName, label, toName }) {
  const profilePanel = page.locator('[role="dialog"][data-modal-panel="profile"]');

  await profilePanel.getByRole("button", { name: toName, exact: true }).click();
  await profilePanel.locator('[data-panel-motion="exit"]').waitFor({ state: "visible", timeout: 1_000 });

  const activeTextDuringExit = await profilePanel.locator('button[aria-current="true"]').innerText();
  assert(
    activeTextDuringExit.includes(fromName),
    `${label}: expected ${fromName} to remain active during exit motion, received ${activeTextDuringExit}.`
  );

  await profilePanel.waitFor({ state: "detached", timeout: 5_000 });
}

async function expectButtonActive(locator, expected, label) {
  const value = await locator.getAttribute("data-active");
  assert(
    value === String(expected),
    `${label}: expected Add document data-active=${expected}, received ${value}.`
  );
}

async function expectButtonEnabled(locator, expected, label) {
  const value = await locator.isEnabled();
  assert(
    value === expected,
    `${label}: expected Add document enabled=${expected}, received ${value}.`
  );
}

function expectSecurityHeaders(response) {
  assert(response, "Expected a page response.");
  const headers = response.headers();
  assert(headers["x-content-type-options"] === "nosniff", "Missing X-Content-Type-Options security header.");
  assert(headers["x-frame-options"] === "DENY", "Missing X-Frame-Options security header.");
  assert(
    headers["content-security-policy"]?.includes("frame-ancestors 'none'"),
    "Missing frame-ancestors Content-Security-Policy directive."
  );
}

async function waitForAuthShellHydration(page) {
  await page.locator('main[data-auth-shell-ready="true"]').waitFor({
    state: "attached",
    timeout: 15_000
  });
}

async function clickUntilVisible(trigger, target, label) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await trigger.click();

    try {
      await target.waitFor({ state: "visible", timeout: 2_000 });
      return;
    } catch {
      if (attempt === 3) {
        throw new Error(`${label}: target did not become visible after ${attempt} clicks.`);
      }
    }
  }
}

async function runSmoke() {
  const port = shouldStartServer ? await findAvailablePort() : null;
  const baseUrl = configuredBaseUrl ?? `http://${host}:${port}`;
  const username = `smokeupload${Date.now().toString(36)}`;
  const email = `${username}@example.test`;
  const initialRateLimits = await snapshotAndClearRateLimits();
  const { child, getLogs } = shouldStartServer
    ? startNextDev(port)
    : { child: null, getLogs: () => "" };
  let browser;
  let page;

  try {
    await waitForServer(baseUrl, child, getLogs);

    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1572, height: 1270 } });

    const initialResponse = await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    expectSecurityHeaders(initialResponse);
    await waitForAuthShellHydration(page);
    const inviteCodeInput = page.getByPlaceholder("Invite code", { exact: true });
    await clickUntilVisible(
      page.getByRole("button", { name: "Register New local account", exact: true }),
      inviteCodeInput,
      "register view"
    );
    await inviteCodeInput.fill(signupInviteCode);
    await page.getByPlaceholder("Email", { exact: true }).fill(email);
    await page.getByPlaceholder("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create account", exact: true }).click();

    await page.getByRole("button", { name: "Create profile", exact: true }).waitFor({
      state: "visible",
      timeout: 10_000
    });
    await page.getByRole("button", { name: "Create profile", exact: true }).click();

    await expectInlineUploadPromptVisible(page, "initial empty profile");

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("heading", { name: "General Settings", exact: true }).waitFor({
      state: "visible",
      timeout: 5_000
    });
    await expectUploadHidden(page, "settings overlay");
    await expectPanelAccessibility(page, {
      background: "dashboard",
      label: "settings overlay",
      panelType: "settings"
    });

    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    await expectInlineUploadPromptVisible(page, "dashboard after settings");

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("heading", { name: "General Settings", exact: true }).waitFor({
      state: "visible",
      timeout: 5_000
    });
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await expectUploadHidden(page, "home after settings");
    await expectPanelCleared(page, "home after settings");

    await page.getByRole("button", { name: "Select profile", exact: true }).click();
    await page.locator('[role="dialog"][data-modal-panel="profile"]').waitFor({
      state: "visible",
      timeout: 5_000
    });
    await expectUploadHidden(page, "profile overlay");
    await expectPanelAccessibility(page, {
      background: "welcome",
      label: "profile overlay",
      panelType: "profile"
    });
    await expectActiveProfileClickDoesNothing(page, "active profile click");

    const secondProfileName = `${username}-alt`;
    const profilePanel = page.locator('[role="dialog"][data-modal-panel="profile"]');
    await profilePanel.getByRole("button", { name: "New Profile" }).click();
    await profilePanel.getByPlaceholder("Profile", { exact: true }).fill(secondProfileName);
    await profilePanel.getByRole("button", { name: "Create profile", exact: true }).click();
    await expectInlineUploadPromptVisible(page, "second empty profile");

    await page.getByRole("button", { name: "Select profile", exact: true }).click();
    await profilePanel.waitFor({ state: "visible", timeout: 5_000 });
    await expectActiveProfileClickDoesNothing(page, "new active profile click");
    await expectProfileSwitchUsesExitMotion(page, {
      fromName: secondProfileName,
      label: "profile switch animation",
      toName: username
    });
    await expectInlineUploadPromptVisible(page, "after animated profile switch");
    await expectNoProfileSelectFlashOnReload(page, "reload with restored profile");
    await expectInlineUploadPromptVisible(page, "after restored profile reload");

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Select profile", exact: true }).click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Select profile", exact: true }).click();
    await expectOnlyActivePanel(page, {
      label: "rapid profile/settings switch",
      panelType: "profile"
    });

    await expectUploadHidden(page, "header upload disabled without transactions");

    await page.getByRole("button", { name: "Home", exact: true }).click();
    await expectUploadHidden(page, "home after profile panel");
    await expectPanelCleared(page, "home after profile panel");

    console.log(JSON.stringify({ ok: true, username, baseUrl }, null, 2));
  } catch (error) {
    if (page) {
      const visibleText = await page.locator("main").innerText({ timeout: 1_000 }).catch(() => "");
      if (visibleText) {
        console.error(`Visible page text before failure:\n${visibleText}`);
      }
    }
    const devLogs = getLogs();
    if (devLogs) {
      console.error(`Next dev logs before failure:\n${devLogs}`);
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
    await stopProcessTree(child);
    try {
      const removedUsers = await cleanupSmokeData(username);
      if (removedUsers > 0) {
        console.log(JSON.stringify({ cleanedSmokeUsers: removedUsers }, null, 2));
      }
    } finally {
      await restoreRateLimits(initialRateLimits);
    }
  }
}

runSmoke().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
