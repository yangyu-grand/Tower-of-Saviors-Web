import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function startStaticServer() {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
    const filePath = resolve(ROOT, relativePath);
    if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    try {
      const body = await readFile(filePath);
      response.writeHead(200, { "Content-Type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  return new Promise((resolveServer, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolveServer({ server, url: "http://127.0.0.1:" + address.port });
    });
  });
}

async function openBoard(page, url) {
  await page.goto(url, { waitUntil: "networkidle" });
  if (await page.locator("#tutorialPanel").isVisible()) {
    await page.locator("#tutorialSkip").click();
  }
  const orb = page.locator('.orb[data-i="0"]');
  await orb.click();
  await assertEventuallySelected(orb);
  return orb;
}

async function assertEventuallySelected(orb) {
  await orb.evaluate(el => {
    if (!el.classList.contains("selected")) {
      throw new Error("Rune tap did not select the expected board cell");
    }
  });
}

test("selected rune scale feedback is removed only when reduced motion is requested", async t => {
  const { server, url } = await startStaticServer();
  let browser;
  t.after(async () => {
    if (browser) await browser.close();
    await new Promise(resolveClose => server.close(resolveClose));
  });

  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

  const reducedPage = await browser.newPage();
  await reducedPage.emulateMedia({ reducedMotion: "reduce" });
  const reducedOrb = await openBoard(reducedPage, url);
  const reducedStyle = await reducedOrb.evaluate(el => ({
    preferenceMatches: matchMedia("(prefers-reduced-motion: reduce)").matches,
    transform: getComputedStyle(el).transform,
    transitionDuration: getComputedStyle(el).transitionDuration
  }));
  assert.equal(reducedStyle.preferenceMatches, true);
  assert.equal(reducedStyle.transform, "none");
  assert.ok(Number.parseFloat(reducedStyle.transitionDuration) <= 0.001);

  const normalPage = await browser.newPage();
  await normalPage.emulateMedia({ reducedMotion: "no-preference" });
  const normalOrb = await openBoard(normalPage, url);
  const normalStyle = await normalOrb.evaluate(el => ({
    preferenceMatches: matchMedia("(prefers-reduced-motion: reduce)").matches,
    transform: getComputedStyle(el).transform
  }));
  assert.equal(normalStyle.preferenceMatches, false);
  assert.notEqual(normalStyle.transform, "none", "normal motion preference should retain the selected-rune scale feedback");
});
