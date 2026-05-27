import { execFile as execFileCallback, spawn } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { promisify } from "node:util";

import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";

const execFile = promisify(execFileCallback);
const rootDir = process.cwd();
const host = "127.0.0.1";
const password = "Temporary smoke password 2026!";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
    if (child.exitCode !== null) {
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
  if (!child.pid || child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    await execFile("taskkill", ["/pid", String(child.pid), "/t", "/f"]).catch(() => {});
    return;
  }

  child.kill("SIGTERM");
}

async function readRateLimitIds() {
  const prisma = new PrismaClient();

  try {
    const rows = await prisma.rateLimit.findMany({ select: { id: true } });
    return rows.map((row) => row.id);
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanupSmokeData(username, initialRateLimitIds) {
  const prisma = new PrismaClient();

  try {
    const authUsers = await prisma.authUser.findMany({
      where: {
        OR: [
          { username },
          { name: username },
          { email: { startsWith: username } }
        ]
      },
      select: { id: true }
    });
    const ownerIds = authUsers.map((user) => user.id);

    if (ownerIds.length > 0) {
      await prisma.authSession.deleteMany({ where: { userId: { in: ownerIds } } });
      await prisma.authAccount.deleteMany({ where: { userId: { in: ownerIds } } });
      await prisma.user.deleteMany({ where: { ownerId: { in: ownerIds } } });
      await prisma.authUser.deleteMany({ where: { id: { in: ownerIds } } });
    }

    if (initialRateLimitIds) {
      await prisma.rateLimit.deleteMany({
        where: { id: { notIn: initialRateLimitIds } }
      });
    }

    return ownerIds.length;
  } finally {
    await prisma.$disconnect();
  }
}

async function expectUploadVisible(page, label) {
  await page.getByRole("heading", { name: "Upload", exact: true }).waitFor({
    state: "visible",
    timeout: 5_000
  });
  const addDocumentButton = page.getByRole("button", { name: "Add document", exact: true });
  await expectButtonActive(addDocumentButton, true, label);
}

async function expectUploadHidden(page, label) {
  const uploadHeadingCount = await page.getByRole("heading", { name: "Upload", exact: true }).count();
  assert(uploadHeadingCount === 0, `${label}: expected Upload panel to be hidden.`);

  const addDocumentButton = page.getByRole("button", { name: "Add document", exact: true });
  await expectButtonActive(addDocumentButton, false, label);
}

async function expectButtonActive(locator, expected, label) {
  const value = await locator.getAttribute("data-active");
  assert(
    value === String(expected),
    `${label}: expected Add document data-active=${expected}, received ${value}.`
  );
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
  const port = await findAvailablePort();
  const baseUrl = `http://${host}:${port}`;
  const username = `smokeupload${Date.now().toString(36)}`;
  const initialRateLimitIds = await readRateLimitIds();
  const { child, getLogs } = startNextDev(port);
  let browser;
  let page;

  try {
    await waitForServer(baseUrl, child, getLogs);

    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1572, height: 1270 } });

    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    const usernameInput = page.getByPlaceholder("Username", { exact: true });
    await clickUntilVisible(
      page.getByRole("button", { name: "Register New local account", exact: true }),
      usernameInput,
      "register view"
    );
    await usernameInput.fill(username);
    await page.getByPlaceholder("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create account", exact: true }).click();

    await page.getByRole("button", { name: "Create profile", exact: true }).waitFor({
      state: "visible",
      timeout: 10_000
    });
    await page.getByRole("button", { name: "Create profile", exact: true }).click();

    await expectUploadVisible(page, "initial empty profile");

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("heading", { name: "General Settings", exact: true }).waitFor({
      state: "visible",
      timeout: 5_000
    });
    await expectUploadHidden(page, "settings overlay");

    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    await expectUploadVisible(page, "dashboard after settings");

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("heading", { name: "General Settings", exact: true }).waitFor({
      state: "visible",
      timeout: 5_000
    });
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await expectUploadVisible(page, "home after settings");

    await page.getByRole("button", { name: "Select profile", exact: true }).click();
    await page.getByText("Manage profiles", { exact: true }).waitFor({
      state: "visible",
      timeout: 5_000
    });
    await expectUploadHidden(page, "profile overlay");

    await page.getByRole("button", { name: "Home", exact: true }).click();
    await expectUploadVisible(page, "home after profile panel");

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
    const removedUsers = await cleanupSmokeData(username, initialRateLimitIds);
    if (removedUsers > 0) {
      console.log(JSON.stringify({ cleanedSmokeUsers: removedUsers }, null, 2));
    }
  }
}

runSmoke().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
