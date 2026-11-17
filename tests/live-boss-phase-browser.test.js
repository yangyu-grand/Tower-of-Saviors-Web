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
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};

function startStaticServer() {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\\/+/, "");
    const filePath = resolve(ROOT, relativePath);
    if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    try {
      const body = await readFile(filePath);
      response.writeHead(200, {
        "Content-Type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream",
        "Cache-Control": "no-store"
      });
      response.end(body);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  return new Promise((resolveServer, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolveServer({ server, url: "http://127.0.0.1:" + server.address().port });
    });
  });
}

async function findValidAttackSwap(page) {
  return page.evaluate(() => {
    const types = ["fire", "water", "wood", "light", "dark", "heart"];
    const board = [...document.querySelectorAll("#board .orb")].map((orb) =>
      types.find((type) => orb.classList.contains(type))
    );
    const matchedAttackTypes = (cells) => {
      const found = new Set();
      const addRun = (run) => {
        if (run.length >= 3) run.forEach((type) => found.add(type));
      };
      for (let row = 0; row < 5; row += 1) {
        for (let column = 0; column < 6; column += 1) {
          const index = row * 6 + column;
          const type = cells[index];
          if (!type) continue;
          if (column <= 3 && cells[index + 1] === type && cells[index + 2] === type) {
            const run = [type];
            for (let next = column + 1; next < 6 && cells[row * 6 + next] === type; next += 1) run.push(type);
            addRun(run);
          }
          if (row <= 2 && cells[index + 6] === type && cells[index + 12] === type) {
            const run = [type];
            for (let next = row + 1; next < 5 && cells[next * 6 + column] === type; next += 1) run.push(type);
            addRun(run);
          }
        }
      }
      return [...found].filter((type) => type !== "heart");
    };

    for (let index = 0; index < board.length; index += 1) {
      const neighbors = [];
      if (index % 6 < 5) neighbors.push(index + 1);
      if (index < 24) neighbors.push(index + 6);
      for (const neighbor of neighbors) {
        const candidate = [...board];
        [candidate[index], candidate[neighbor]] = [candidate[neighbor], candidate[index]];
        if (matchedAttackTypes(candidate).length > 0) return [index, neighbor];
      }
    }
    return null;
  });
}

test("Chromium announces the live fourth-chapter Boss phase transition", async (t) => {
  const { server, url } = await startStaticServer();
  let browser;
  t.after(async () => {
    if (browser) await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  });

  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const save = createDefaultSave();
  save.campaign = {
    stageIndex: 3,
    waveIndex: 2,
    turn: 0,
    enemyHp: 926,
    completed: false,
    campaignComplete: false
  };
  save.unlockedStageIndex = 3;
  save.battleStats = createBattleStats(3);
  const serializedSave = JSON.stringify(normalizeSave(save));
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: SAVE_KEY,
    value: serializedSave
  });
  await page.goto(url, { waitUntil: "networkidle" });

  assert.match(await page.locator("#stageName").innerText(), /霧櫻古境/);
  assert.equal(await page.locator("#liveCombatFeedback .live-combat-number--boss-phase").count(), 0,
    "loading into the first Boss phase must not announce a transition");
  const move = await findValidAttackSwap(page);
  assert.ok(move, "the seeded Boss board should expose a legal attack-rune match");
  const [from, to] = move;
  const start = await page.locator('.orb[data-i="' + from + '"]').boundingBox();
  const end = await page.locator('.orb[data-i="' + to + '"]').boundingBox();
  assert.ok(start && end, "the selected rune cells must have visible hit targets");

  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 });
  await page.mouse.up();

  const phaseCallout = page.locator("#liveCombatFeedback .live-combat-number--boss-phase");
  await phaseCallout.waitFor({ state: "visible", timeout: 10000 });
  assert.equal(await phaseCallout.innerText(), "Boss 階段：花霧姿態 → 月蝕姿態");
  assert.deepEqual(pageErrors, [], "the Boss phase transition should not raise browser errors");
  await context.close();
});
