// Running-product acceptance for locked canvas layers (#190).
// Run: node tests/browser-canvas-layer-lock.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = 8768;

function mime(path) {
  const ext = extname(path);
  if (ext === ".html") return "text/html";
  if (ext === ".css") return "text/css";
  if (ext === ".js") return "text/javascript";
  return "application/octet-stream";
}

function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const rel = req.url === "/" ? "/index.html" : req.url.split("?")[0];
      const file = join(root, rel.replace(/^\//, ""));
      if (!file.startsWith(root) || !existsSync(file)) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": mime(file) });
      res.end(readFileSync(file));
    });
    server.listen(port, () => resolve(server));
  });
}

async function completeSetup(page) {
  await page.getByRole("button", { name: "Start blank episode" }).click();
  await page.waitForSelector("form.setup-import");
  await page.locator("#f-episodeName").fill("Founders Unfiltered #7");
  await page.locator("#f-riversideLink").fill("https://riverside.fm/studio/founders-ep1");
  await page.locator("#f-sp-0-name").fill("Sam Rivera");
  await page.locator("#f-sp-1-name").fill("Dana Kim");
  await page.locator("#f-sp-2-name").fill("Alex Chen");
  await page.locator(".setup-preset-card").first().click();
  await page.locator(".guided-workspace").waitFor({ state: "visible" });
}

async function openCanvasFromWorkspace(page) {
  await page.locator(".workspace-checklist-open").filter({ hasText: "Open canvas editor" }).click();
  await page.locator(".canvas-step").waitFor({ state: "visible" });
}

async function readBounds(locator) {
  return locator.evaluate((el) => ({
    left: el.style.left,
    top: el.style.top,
    width: el.style.width,
    height: el.style.height,
  }));
}

async function dragElement(page, locator, dx, dy) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("Missing bounding box for drag target");
  }
  const startX = box.x + Math.max(12, box.width / 4);
  const startY = box.y + Math.max(12, box.height / 4);
  const endX = startX + dx;
  const endY = startY + dy;
  await locator.dispatchEvent("pointerdown", {
    clientX: startX,
    clientY: startY,
    pointerId: 1,
    bubbles: true,
    cancelable: true,
  });
  await locator.dispatchEvent("pointermove", {
    clientX: endX,
    clientY: endY,
    pointerId: 1,
    bubbles: true,
    cancelable: true,
  });
  await locator.dispatchEvent("pointerup", {
    clientX: endX,
    clientY: endY,
    pointerId: 1,
    bubbles: true,
    cancelable: true,
  });
  await page.waitForTimeout(100);
}

async function main() {
  const server = await startServer();
  let browser;
  let failed = false;
  const log = (ok, msg) => {
    console.log(`${ok ? "  ok" : " FAIL"} ${msg}`);
    if (!ok) failed = true;
  };

  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });

    await completeSetup(page);
    log(await page.locator(".guided-workspace").isVisible(), "Setup lands in production workspace");

    await openCanvasFromWorkspace(page);
    log(await page.locator(".canvas-step").isVisible(), "Production checklist opens the canvas editor");
    log(await page.getByRole("heading", { name: /Customize/i }).isVisible(), "Canvas editor headline is visible");

    const titleRow = page.locator(".canvas-layer").filter({ hasText: "Title moment" });
    const titleStage = page.locator(".canvas-obj-title");
    await titleRow.getByRole("button", { name: "Lock" }).click();
    await titleRow.locator(".canvas-layer-meta", { hasText: "position locked" }).waitFor();
    log(await titleRow.evaluate((el) => el.classList.contains("is-locked")), "Locked layer row shows is-locked");
    log(await titleStage.evaluate((el) => el.classList.contains("is-locked")), "Locked title stage object shows is-locked");

    const moveUp = titleRow.locator("button", { hasText: "▲" });
    const moveDown = titleRow.locator("button", { hasText: "▼" });
    log(await moveUp.isDisabled(), "Locked layer move-up control is disabled");
    log(await moveDown.isDisabled(), "Locked layer move-down control is disabled");

    const lockedBounds = await readBounds(titleStage);
    await dragElement(page, titleStage, 90, 60);
    const afterLockedDrag = await readBounds(titleStage);
    log(
      lockedBounds.left === afterLockedDrag.left && lockedBounds.top === afterLockedDrag.top,
      "Locked layer drag does not change on-stage position",
    );

    await titleRow.getByRole("button", { name: "Unlock" }).click();
    await titleRow.getByRole("button", { name: "Lock" }).waitFor();
    log(!(await titleRow.evaluate((el) => el.classList.contains("is-locked"))), "Unlock restores editable layer row");

    const unlockedBefore = await readBounds(titleStage);
    await dragElement(page, titleStage, 70, 40);
    const unlockedAfter = await readBounds(titleStage);
    log(
      unlockedBefore.left !== unlockedAfter.left || unlockedBefore.top !== unlockedAfter.top,
      "Unlocked layer drag changes on-stage position",
    );

    await page.screenshot({ path: join(root, "tests", "canvas-layer-lock-unlocked.png"), fullPage: false });
    log(true, "Screenshot saved to tests/canvas-layer-lock-unlocked.png");
  } catch (err) {
    console.error(err);
    failed = true;
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  if (failed) {
    process.exit(1);
  }
  console.log("\nBrowser canvas layer lock: all checks passed.");
}

main();
