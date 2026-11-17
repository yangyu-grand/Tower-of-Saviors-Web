import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const MIME_TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };

function startStaticServer() {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
    const filePath = resolve(ROOT, relativePath);
    if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
      response.writeHead(403); response.end("Forbidden"); return;
    }
    try {
      const body = await readFile(filePath);
      response.writeHead(200, { "Content-Type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404); response.end("Not found");
    }
  });
  return new Promise((resolveServer, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveServer({ server, url: "http://127.0.0.1:" + server.address().port }));
  });
}

test("rune board supports bounded arrow navigation and keeps a single Tab stop", async t => {
  const { server, url } = await startStaticServer();
  let browser;
  t.after(async () => {
    if (browser) await browser.close();
    await new Promise(resolveClose => server.close(resolveClose));
  });
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  if (await page.locator("#tutorialPanel").isVisible()) await page.locator("#tutorialSkip").click();

  const first = page.locator('.orb[data-i="0"]');
  await first.focus();
  assert.equal(await first.evaluate(el => el.tabIndex), 0);
  assert.equal(await page.locator('.orb[tabindex="0"]').count(), 1);

  await page.keyboard.press("ArrowRight");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.i), "1");
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.i), "7");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.i), "6");
  await page.keyboard.press("ArrowUp");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.i), "0");

  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.i), "0", "left edge must not wrap to the previous row");
  await page.keyboard.press("ArrowUp");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.i), "0", "top edge must not wrap to the last row");

  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector('.orb[data-i="0"]')?.classList.contains("selected"));
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.i), "0", "board re-render should restore the focused rune");
  assert.equal(await page.locator('.orb[tabindex="0"]').count(), 1);

  await page.keyboard.press("Tab");
  assert.notEqual(await page.evaluate(() => document.activeElement?.classList.contains("orb")), true, "Tab should leave the board instead of visiting all 30 runes");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.i), "0", "Shift+Tab should return to the single board tab stop");
});
