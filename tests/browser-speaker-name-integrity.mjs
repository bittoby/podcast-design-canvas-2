// Running-product acceptance for speaker name integrity (#172).
// Maintainer probe: setup Sam Rivera + social links → approve context → export summary unchanged.
// Run: node tests/browser-speaker-name-integrity.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = 8766;

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

async function openHostSocial(page) {
  const details = page.locator(".speaker-card").first().locator("details.speaker-optional-details");
  await details.locator("summary").click();
  await page.locator("#f-sp-0-social-website").fill("https://samrivera.show");
  await page.locator("#f-sp-0-social-twitter").fill("https://x.com/samrivera");
}

async function completeSetup(page) {
  await page.getByRole("button", { name: "Start blank episode" }).click();
  await page.waitForSelector("form.setup-import");
  await page.locator("#f-episodeName").fill("Founders Unfiltered #7");
  await page.locator("#f-sp-0-name").fill("Sam Rivera");
  await page.locator("#f-sp-1-name").fill("Dana Kim");
  await page.locator("#f-sp-2-name").fill("Alex Chen");
  await openHostSocial(page);
  await page.locator(".setup-preset-card").first().click();
  const workspace = page.locator(".guided-workspace");
  if (!(await workspace.isVisible())) {
    await page.locator("#setup-complete-continue").click();
    await workspace.waitFor({ state: "visible" });
  }
}

async function applyAudioIfVisible(page) {
  const audioStep = page.locator(".audio-step");
  if (await audioStep.isVisible()) {
    await page.locator(".audio-preset-card").first().click();
    await page.getByRole("button", { name: "Apply audio & continue →" }).click();
    await page.locator(".guided-workspace, .publish-review-step, .context-step").first().waitFor();
  }
}

async function openPublishReview(page) {
  if (await page.locator(".publish-review-step").isVisible()) {
    return;
  }
  if (await page.locator(".guided-workspace").isVisible()) {
    await page.locator("#workspace-primary-next, .workspace-checklist-open").filter({ hasText: "Review episode" }).first().click();
    await page.locator(".publish-review-step").waitFor();
  }
}

async function approveContextFromReview(page) {
  const fixBtn = page.getByRole("button", { name: "Review context" });
  if (await fixBtn.isVisible()) {
    await fixBtn.click();
    await page.locator(".context-step").waitFor();
  }
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
    log(await page.locator(".guided-workspace").isVisible(), "Setup with Sam Rivera lands in production workspace");

    const recapText = await page.locator(".workspace-handoff-layout").innerText();
    log(recapText.includes("Sam Rivera"), "Workspace recap shows Sam Rivera from setup");
    log(!recapText.includes("Sam Riveraa"), "Workspace recap does not show corrupted Sam Riveraa");

    await applyAudioIfVisible(page);
    await openPublishReview(page);
    await approveContextFromReview(page);

    if (await page.locator(".context-step").isVisible()) {
      const displayName = await page.locator("#ctx-0-displayName").inputValue();
      log(displayName === "Sam Rivera", `Social context approved name is exactly Sam Rivera (got "${displayName}")`);
      const spellingHints = await page.locator("#ctx-0-spellingHints").inputValue();
      log(!spellingHints.toLowerCase().includes("sam river"), "Social context spelling hints omit unsafe Sam River prefix");
      await page.getByRole("button", { name: "Approve context & continue →" }).click();
      await page.locator(".audio-step, .guided-workspace, .publish-review-step").first().waitFor();
    }

    await applyAudioIfVisible(page);
    await openPublishReview(page);

    const approveExport = page.getByRole("button", { name: "Approve for export →" });
    if (await approveExport.isEnabled()) {
      await approveExport.click();
      await page.getByRole("button", { name: "Approved for export" }).waitFor();
    }
    log(await page.getByRole("button", { name: "Approved for export" }).isVisible(), "Publish review approves after social context");

    const exportBtn = page.locator("#workspace-primary-next, .workspace-checklist-open").filter({ hasText: "Export episode" }).first();
    if (await page.locator(".guided-workspace").isVisible()) {
      await exportBtn.click();
    } else {
      await page.getByRole("button", { name: "← Back to workspace" }).click();
      await exportBtn.click();
    }
    await page.locator(".export-summary").waitFor();

    const summaryText = await page.locator(".export-summary").innerText();
    log(summaryText.includes("Sam Rivera"), "Export final summary includes Sam Rivera");
    log(!summaryText.includes("Sam Riveraa"), "Export final summary does not include Sam Riveraa");

    await page.screenshot({ path: join(root, "tests", "speaker-name-integrity-export.png"), fullPage: false });
    log(true, "Screenshot saved to tests/speaker-name-integrity-export.png");
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
  console.log("\nBrowser speaker name integrity: all checks passed.");
}

main();
