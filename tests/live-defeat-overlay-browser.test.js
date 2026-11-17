import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createDefaultSave, normalizeSave, SAVE_KEY } from "../inventory.js";
import { createBattleStats } from "../battleResults.js";

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

test("Chromium shows a defeat overlay and retries only the current wave", async (t) => {
  const save = createDefaultSave();
  save.campaign = {
    stageIndex: 0,
    waveIndex: 1,
    turn: 1,
    enemyHp: 260,
    completed: false,
    campaignComplete: false
  };
  save.hp = 1;
  save.board = [
    "fire", "fire", "water", "wood", "light", "dark",
    "water", "wood", "fire", "dark", "heart", "fire",
    "wood", "light", "dark", "heart", "fire", "water",
    "light", "dark", "heart", "fire", "water", "wood",
    "dark", "heart", "fire", "water", "wood", "light"
  ];
  save.battleStats = createBattleStats(0);

  const { server, url } = await startStaticServer();
  let browser;
  t.after(async () => {
    if (browser) await browser.close();
    await new Promise(resolveClose => server.close(resolveClose));
  });
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: SAVE_KEY,
    value: JSON.stringify(normalizeSave(save))
  });
  await page.goto(url, { waitUntil: "networkidle" });
  if (await page.locator("#tutorialPanel").isVisible()) await page.locator("#tutorialSkip").click();
  assert.equal(await page.locator("#defeatResult").isVisible(), false);

  const start = await page.locator('.orb[data-i="2"]').boundingBox();
  const end = await page.locator('.orb[data-i="8"]').boundingBox();
  assert.ok(start && end, "the deterministic fire-rune swap must have visible hit targets");
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 });
  await page.mouse.up();

  await page.waitForFunction(() => !document.querySelector("#defeatResult").hidden, null, { timeout: 10000 });
  assert.equal(await page.locator("#defeatTitle").innerText(), "隊伍戰敗");
  assert.equal(await page.evaluate(() => document.activeElement.id), "defeatResult", "opening the defeat dialog must move focus into the dialog");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.id), "defeatRetry", "Tab from the dialog container must focus the first action");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.id), "defeatDismiss", "Tab must move to the last action");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.id), "defeatRetry", "Tab from the last action must wrap to the first");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.evaluate(() => document.activeElement.id), "defeatDismiss", "Shift+Tab from the first action must wrap to the last");
  await page.keyboard.press("Tab");
  assert.match(await page.locator("#defeatSubtitle").innerText(), /灰燼山徑.*燼甲守衛/);
  assert.match(await page.locator("#defeatSummary").innerText(), /造成傷害/);
  const scoreBeforeRetry = Number(await page.locator("#score").innerText());

  await page.locator("#defeatRetry").click();
  await page.waitForFunction(() => document.querySelector("#defeatResult").hidden);
  assert.equal(await page.evaluate(() => document.activeElement.id), "enemyName", "retry must return focus to the current encounter heading");
  assert.match(await page.locator("#log").innerText(), /重新挑戰 燼甲守衛/);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  assert.equal(saved.campaign.stageIndex, 0);
  assert.equal(saved.campaign.waveIndex, 1, "retry must remain on the defeated wave");
  assert.equal(saved.campaign.turn, 0);
  assert.equal(saved.campaign.enemyHp, 260);
  assert.ok(saved.hp > 0, "retry must restore the party's HP");
  assert.equal(saved.score, scoreBeforeRetry, "retry must preserve the accumulated score");
  assert.equal(saved.battleStats.defeatedEncounterIds.length, 0,
    "retry must not invent a defeat reward for the wave that defeated the party");

  // Reload the original one-HP profile to exercise Escape dismissal separately.
  await page.reload({ waitUntil: "networkidle" });
  if (await page.locator("#tutorialPanel").isVisible()) await page.locator("#tutorialSkip").click();
  const escapeStart = await page.locator('.orb[data-i="2"]').boundingBox();
  const escapeEnd = await page.locator('.orb[data-i="8"]').boundingBox();
  assert.ok(escapeStart && escapeEnd);
  await page.mouse.move(escapeStart.x + escapeStart.width / 2, escapeStart.y + escapeStart.height / 2);
  await page.mouse.down();
  await page.mouse.move(escapeEnd.x + escapeEnd.width / 2, escapeEnd.y + escapeEnd.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector("#defeatResult").hidden, null, { timeout: 10000 });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#defeatResult").hidden);
  assert.equal(await page.evaluate(() => document.activeElement.id), "enemyName",
    "Escape must dismiss the dialog and restore focus to the encounter heading");
  assert.deepEqual(pageErrors, [], "the defeat, retry, and keyboard-dismiss flows must not raise page errors");
});
