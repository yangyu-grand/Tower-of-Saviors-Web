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

test("rune board Home/End navigation respects row and board boundaries", async t => {
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

  await page.locator('.orb[data-i="8"]').focus();
  await page.keyboard.press("Home");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.i), "6", "Home should focus the first cell in the current row");

  await page.keyboard.press("End");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.i), "11", "End should focus the last cell in the current row");

  await page.keyboard.press("Control+Home");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.i), "0", "Ctrl+Home should focus the first board cell");

  await page.keyboard.press("Control+End");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.i), "29", "Ctrl+End should focus the last board cell");

  assert.equal(await page.locator('.orb[tabindex="0"]').count(), 1, "the board should retain one roving Tab stop");
});
