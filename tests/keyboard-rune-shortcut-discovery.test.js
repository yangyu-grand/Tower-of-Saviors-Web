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

test("all live runes expose keyboard shortcuts and the instructions disclose them", async t => {
  const { server, url } = await startStaticServer();
  let browser;
  t.after(async () => {
    if (browser) await browser.close();
    await new Promise(resolveClose => server.close(resolveClose));
  });
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
  if (await page.locator("#tutorialPanel").isVisible()) await page.locator("#tutorialSkip").click();

  const expected = "ArrowUp ArrowDown ArrowLeft ArrowRight Home End Control+Home Control+End Meta+Home Meta+End Enter Space Escape";
  const runes = page.locator("#board .orb");
  assert.equal(await runes.count(), 30);
  assert.deepEqual(await runes.evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-keyshortcuts"))), Array(30).fill(expected));
  const instructions = await page.locator("#boardInstructions").innerText();
  for (const key of ["方向鍵", "Enter／Space", "Home／End", "Ctrl／⌘+Home／End", "Escape"]) {
    assert.ok(instructions.includes(key), "missing keyboard instruction: " + key);
  }
  assert.deepEqual(pageErrors, []);
});
