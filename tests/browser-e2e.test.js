import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createDefaultSave, normalizeSave, SAVE_KEY } from "../inventory.js";
import { createBattleStats, recordBattleTurn, recordEncounterDefeat, completeBattleStats } from "../battleResults.js";
import { simulateRuneEncounter } from "../runeBattleSimulation.js";
import { createRuneBattleReplay } from "../runeBattleReplay.js";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};

function startStaticServer() {
  const server = createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405);
      response.end();
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    } catch {
      response.writeHead(400);
      response.end("Bad request");
      return;
    }

    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = resolve(ROOT, relativePath);
    if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const body = await readFile(filePath);
      response.writeHead(200, {
        "Content-Type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream",
        "Cache-Control": "no-store"
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  return new Promise((resolveServer, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolveServer({
        server,
        url: "http://127.0.0.1:" + address.port
      });
    });
  });
}

async function findValidSwap(page) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const move = await page.evaluate(() => {
      const types = ["fire", "water", "wood", "light", "dark", "heart"];
      const board = [...document.querySelectorAll("#board .orb")].map((orb) =>
        types.find((type) => orb.classList.contains(type))
      );
      const hasMatch = (cells) => {
        for (let row = 0; row < 5; row += 1) {
          for (let column = 0; column < 6; column += 1) {
            const index = row * 6 + column;
            const type = cells[index];
            if (!type) continue;
            if (column <= 3 && cells[index + 1] === type && cells[index + 2] === type) return true;
            if (row <= 2 && cells[index + 6] === type && cells[index + 12] === type) return true;
          }
        }
        return false;
      };

      for (let index = 0; index < board.length; index += 1) {
        const neighbors = [];
        if (index % 6 < 5) neighbors.push(index + 1);
        if (index < 24) neighbors.push(index + 6);
        for (const neighbor of neighbors) {
          const candidate = [...board];
          [candidate[index], candidate[neighbor]] = [candidate[neighbor], candidate[index]];
          if (hasMatch(candidate)) return [index, neighbor];
        }
      }
      return null;
    });

    if (move) return move;
    await page.locator("#newGame").click();
  }
  return null;
}

test("Chromium exercises gameplay, save persistence, sound, and mobile layout", async (t) => {
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

  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page = await desktopContext.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(url, { waitUntil: "networkidle" });
  assert.equal(await page.title(), "符石遠征｜Puzzle RPG");
  assert.equal(await page.locator("#tutorialPanel").isVisible(), true, "a first-time player should see the onboarding tutorial");
  assert.match(await page.locator("#tutorialTitle").innerText(), /歡迎/);
  await page.locator("#tutorialAdvance").click();
  assert.ok((await page.locator("#board").getAttribute("class")).includes("tutorial-target"), "the rune board should be highlighted during the match lesson");
  assert.equal(await page.locator("#board .orb").count(), 30, "the 6 × 5 rune board should render");
  assert.equal(await page.locator("#codexGrid .codex-card").count(), 15, "all original cards should appear in the codex");
  assert.equal(await page.locator("#unlockedStageTotal").innerText(), "4", "the unlocked-stage counter should reflect all four chapters");
  assert.equal(await page.locator("#enemyCodexGrid .enemy-codex-card").count(), 12, "all twelve campaign encounters should appear in the enemy codex");
  await page.locator("#enemyCodexRoleFilter").selectOption("boss");
  assert.equal(await page.locator("#enemyCodexGrid .enemy-codex-card").count(), 4, "the boss filter should show all four chapter bosses");
  await page.locator("#enemyCodexRoleFilter").selectOption("normal");
  assert.equal(await page.locator("#enemyCodexGrid .enemy-codex-card").count(), 8, "the normal-enemy filter should exclude bosses");
  await page.locator("#enemyCodexRoleFilter").selectOption("all");
  await page.locator("#enemyCodexStageFilter").selectOption("mist-sakura-ancient");
  assert.equal(await page.locator("#enemyCodexGrid .enemy-codex-card").count(), 3, "the chapter filter should show its three encounters");
  await page.locator("#enemyCodexStageFilter").selectOption("all");
  await page.locator("#enemyCodexSearch").fill("天狐焚月");
  assert.equal(await page.locator("#enemyCodexGrid .enemy-codex-card").count(), 1, "search should find a special attack in a boss phase");
  assert.match(await page.locator("#enemyCodexGrid").innerText(), /月蝕姿態/);
  await page.locator("#enemyCodexSearch").fill("");


  await page.locator("#soundToggle").click();
  assert.equal(await page.locator("#soundToggle").getAttribute("aria-pressed"), "true");
  await page.locator("#soundToggle").click();
  assert.equal(await page.locator("#soundToggle").getAttribute("aria-pressed"), "false");

  await page.locator("#codexOwnershipFilter").selectOption("unowned");
  await page.waitForFunction(() => document.querySelector("#codexCount").textContent.includes("5 / 15"));
  assert.equal(await page.locator("#codexGrid .codex-card").count(), 5);
  await page.locator("#codexOwnershipFilter").selectOption("owned");
  await page.waitForFunction(() => document.querySelector("#codexCount").textContent.includes("10 / 15"));
  assert.equal(await page.locator("#codexGrid .codex-card").count(), 10);
  await page.locator("#codexOwnershipFilter").selectOption("all");

  const desktopMove = await findValidSwap(page);
  assert.ok(desktopMove, "a legal match-producing adjacent swap should be available after board resets");
  const [desktopStart, desktopEnd] = desktopMove;
  const startBox = await page.locator('.orb[data-i="' + desktopStart + '"]').boundingBox();
  const endBox = await page.locator('.orb[data-i="' + desktopEnd + '"]').boundingBox();
  assert.ok(startBox && endBox, "rune cells should have visible hit targets");

  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() => Number(document.querySelector("#score").textContent) > 0, null, { timeout: 10000 });
  await page.waitForFunction(() => {
    const slot = document.querySelector("#teamSlots select");
    return slot && !slot.disabled;
  }, null, { timeout: 10000 });
  const scoreAfterMatch = Number(await page.locator("#score").innerText());
  assert.ok(scoreAfterMatch > 0, "a real pointer drag should resolve a rune match and award score");
  await page.waitForFunction(() => document.querySelector("#tutorialTitle").textContent.includes("Combo"));
  await page.locator("#tutorialAdvance").click();
  assert.ok((await page.locator("#skillButtons").getAttribute("class") || "").includes("tutorial-target"), "the active-skill area should be highlighted");
  await page.locator("#skillButtons button:not(:disabled)").first().click();
  await page.waitForFunction(() => document.querySelector("#tutorialTitle").textContent.includes("編組"));
  for (let step = 0; step < 4; step += 1) await page.locator("#tutorialAdvance").click();
  assert.equal(await page.locator("#tutorialPanel").isVisible(), false, "finishing the final lesson should dismiss the tutorial");

  await page.locator("#saveNow").click();
  await page.waitForFunction(() => document.querySelector("#saveStatus").textContent.includes("手動儲存"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("#saveStatus").textContent.includes("已載入上次遊戲進度"));
  assert.equal(await page.locator("#tutorialPanel").isVisible(), false, "completed tutorial progress should survive a reload");
  assert.equal(Number(await page.locator("#score").innerText()), scoreAfterMatch, "the post-match score should survive a reload");

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce"
  });
  const mobilePage = await mobileContext.newPage();
  const mobileErrors = [];
  const mobileConsoleErrors = [];
  mobilePage.on("pageerror", (error) => mobileErrors.push(error.message));
  mobilePage.on("console", (message) => {
    if (message.type() === "error") mobileConsoleErrors.push(message.text());
  });
  await mobilePage.goto(url, { waitUntil: "networkidle" });

  const mobileLayout = await mobilePage.evaluate(() => ({
    battleColumns: getComputedStyle(document.querySelector(".battle")).gridTemplateColumns.trim().split(/\s+/).length,
    boardColumns: getComputedStyle(document.querySelector("#board")).gridTemplateColumns.trim().split(/\s+/).length,
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches
  }));
  assert.equal(mobileLayout.battleColumns, 1, "battle panels should stack on a narrow viewport");
  assert.equal(mobileLayout.boardColumns, 6, "the rune board should retain six columns on mobile");
  assert.ok(mobileLayout.documentWidth <= mobileLayout.viewportWidth, "the mobile page should not overflow horizontally");
  assert.equal(mobileLayout.reducedMotion, true, "the browser should expose the requested reduced-motion preference");

  const mobileMove = await findValidSwap(mobilePage);
  assert.ok(mobileMove, "a legal match-producing move should be available on the mobile viewport");
  const [mobileStart, mobileEnd] = mobileMove;
  await mobilePage.locator('.orb[data-i="' + mobileStart + '"]').dispatchEvent("pointerdown", {
    pointerId: 71,
    pointerType: "touch",
    isPrimary: true,
    button: 0
  });
  await mobilePage.locator('.orb[data-i="' + mobileEnd + '"]').dispatchEvent("pointerup", {
    pointerId: 71,
    pointerType: "touch",
    isPrimary: true,
    button: 0
  });
  await mobilePage.waitForFunction(() => Number(document.querySelector("#score").textContent) > 0, null, { timeout: 10000 });
  await mobilePage.waitForFunction(() => {
    const slot = document.querySelector("#teamSlots select");
    return slot && !slot.disabled;
  }, null, { timeout: 10000 });
  assert.ok(Number(await mobilePage.locator("#score").innerText()) > 0, "touch pointer events should resolve a match on mobile");

  assert.deepEqual(pageErrors, [], "desktop page should not raise uncaught JavaScript errors");
  assert.deepEqual(consoleErrors, [], "desktop page should not log browser console errors");
  assert.deepEqual(mobileErrors, [], "mobile page should not raise uncaught JavaScript errors");
  assert.deepEqual(mobileConsoleErrors, [], "mobile page should not log browser console errors");
  await mobileContext.close();
  await desktopContext.close();
});


test("Chromium restores a completed-stage result, prevents duplicate claiming, and advances cleanly", async (t) => {
  const { server, url } = await startStaticServer();
  let browser;
  t.after(async () => {
    if (browser) await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  });

  const save = createDefaultSave();
  save.campaign = { stageIndex: 0, waveIndex: 2, turn: 5, enemyHp: 0, completed: true, campaignComplete: false };
  save.unlockedStageIndex = 1;
  save.score = 830;
  let battleStats = createBattleStats(0);
  battleStats = recordBattleTurn(battleStats, {
    combo: 4, runesMatched: 12, damageDealt: 1800, healingDone: 28,
    hpDamageTaken: 35, shieldAbsorbed: 18, expEarned: 190, scoreEarned: 480
  });
  battleStats = recordEncounterDefeat(battleStats, "lava-wyrmling", { gold: 100, awakeningShards: 1, score: 100 });
  battleStats = recordEncounterDefeat(battleStats, "cinder-guard", { gold: 100, awakeningShards: 1, score: 100 });
  battleStats = recordEncounterDefeat(battleStats, "ash-dragon-king", { gold: 500, summonStones: 1, awakeningShards: 3, prismCores: 1, score: 150 });
  save.battleStats = completeBattleStats(battleStats);
  const serializedSave = JSON.stringify(normalizeSave(save));

  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, { key: SAVE_KEY, value: serializedSave });
  await page.goto(url, { waitUntil: "networkidle" });

  assert.equal(await page.locator("#battleResult").isVisible(), true, "a saved completed stage should restore its result screen");
  assert.match(await page.locator("#resultTitle").innerText(), /灰燼山徑/);
  assert.equal(await page.locator("#resultGold").innerText(), "+700");
  assert.equal(await page.locator("#resultStones").innerText(), "+1");
  assert.equal(await page.locator("#resultShards").innerText(), "+5");
  assert.equal(await page.locator("#resultPrism").innerText(), "+1");
  assert.equal(await page.locator("#resultBestCombo").innerText(), "4");

  await page.locator("#resultDismiss").click();
  assert.equal(await page.locator("#battleResult").isVisible(), false);
  assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).battleStats.resultDismissed, SAVE_KEY), true, "dismissal should be written to the game save");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("#battleResult").isVisible(), false, "dismissal should persist across reload");
  assert.equal(await page.locator("#nextStage").isVisible(), true);

  await page.locator("#nextStage").click();
  await page.waitForFunction(() => document.querySelector("#stageName").textContent === "潮汐遺跡");
  assert.equal(await page.locator("#battleResult").isVisible(), false);
  assert.equal(await page.locator("#stageProgress").innerText(), "第 1 / 3 波");
  assert.deepEqual(pageErrors, [], "result restoration and stage progression should not raise browser errors");
  await context.close();
});


test("Chromium displays distinct multi-hit and self-healing enemy intent previews", async (t) => {
  const { server, url } = await startStaticServer();
  let browser;
  t.after(async () => {
    if (browser) await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  });
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

  async function openAtEncounter(waveIndex, turn, enemyHp) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const save = createDefaultSave();
    save.campaign = { stageIndex: 1, waveIndex, turn, enemyHp, completed: false, campaignComplete: false };
    save.battleStats = createBattleStats(1);
    save.unlockedStageIndex = 1;
    const serializedSave = JSON.stringify(normalizeSave(save));
    await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, { key: SAVE_KEY, value: serializedSave });
    await page.goto(url, { waitUntil: "networkidle" });
    return { context, page };
  }

  const multiHit = await openAtEncounter(0, 0, 300);
  assert.match(await multiHit.page.locator("#enemyIntent").innerText(), /雙重撕咬/);
  assert.match(await multiHit.page.locator("#enemyIntent").innerText(), /2 段連擊/);
  assert.equal(await multiHit.page.locator("#enemyIntent").getAttribute("data-type"), "multi");
  await multiHit.context.close();

  const healer = await openAtEncounter(1, 2, 300);
  assert.match(await healer.page.locator("#enemyIntent").innerText(), /珊瑚再生/);
  assert.match(await healer.page.locator("#enemyIntent").innerText(), /回復 36 HP/);
  assert.equal(await healer.page.locator("#enemyIntent").getAttribute("data-type"), "heal");
  await healer.context.close();

  const fullHealer = await openAtEncounter(1, 2, 390);
  assert.match(await fullHealer.page.locator("#enemyIntent").innerText(), /最多回復 36 HP/);
  assert.equal(await fullHealer.page.locator("#enemyIntent").getAttribute("data-type"), "heal");
  await fullHealer.context.close();
  await browser.close();
});


test("Chromium plays, pauses, seeks, imports, and exports deterministic battle replays", async (t) => {
  const { server, url } = await startStaticServer();
  let browser;
  t.after(async () => {
    if (browser) await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  });
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });

  await page.locator("#replayGenerate").click();
  await page.waitForFunction(() => Number(document.querySelector("#replaySeek").max) > 0);
  const eventCount = Number(await page.locator("#replaySeek").getAttribute("max")) + 1;
  assert.ok(eventCount > 1);
  assert.equal(await page.locator("#replayBoard .replay-orb").count(), 30);
  assert.match(await page.locator("#replayStatus").innerText(), /示範重播已載入/);

  await page.locator("#replayNext").click();
  assert.equal(await page.locator("#replaySeek").inputValue(), "1");
  await page.locator("#replayPrevious").click();
  assert.equal(await page.locator("#replaySeek").inputValue(), "0");

  const lastIndex = eventCount - 1;
  await page.locator("#replaySeek").evaluate((input, value) => {
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, lastIndex);
  assert.equal(await page.locator("#replaySeek").inputValue(), String(lastIndex));
  assert.equal(await page.locator("#replayNext").isDisabled(), true);

  await page.locator("#replaySeek").evaluate((input) => {
    input.value = "0";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await page.locator("#replaySpeed").inputValue(), "1");
  assert.equal(await page.locator("#replaySpeed option").count(), 6);
  await page.locator("#replaySpeed").selectOption("2");
  await page.locator("#replayPlay").click();
  await page.waitForFunction(() => Number(document.querySelector("#replaySeek").value) > 0, null, { timeout: 5000 });
  assert.equal(await page.locator("#replayPlay").innerText(), "暫停");
  await page.locator("#replaySpeed").selectOption("0.5");
  assert.equal(await page.locator("#replayPlay").innerText(), "暫停", "changing speed should keep playback active");
  await page.locator("#replayPlay").click();
  assert.equal(await page.locator("#replayPlay").innerText(), "播放");

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#replayExport").click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "tower-replay-seed-20261117.json");

  const imported = createRuneBattleReplay(simulateRuneEncounter({
    stageIndex: 0, waveIndex: 0, seed: 81, skillPolicy: "greedy", maxTurns: 8
  }));
  await page.locator("#replayImport").setInputFiles({
    name: "sample-replay.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(imported))
  });
  await page.waitForFunction(() => document.querySelector("#replayStatus").textContent.includes("匯入成功"));
  assert.equal(Number(await page.locator("#replaySeek").getAttribute("max")) + 1, imported.eventCount);
  assert.equal(await page.locator("#replayBoard .replay-orb").count(), 30);

  await page.locator("#replayImport").setInputFiles({
    name: "broken-replay.json",
    mimeType: "application/json",
    buffer: Buffer.from("{invalid")
  });
  await page.waitForFunction(() => document.querySelector("#replayStatus").textContent.includes("匯入失敗"));
  assert.equal(Number(await page.locator("#replaySeek").getAttribute("max")) + 1, imported.eventCount);
  assert.deepEqual(pageErrors, [], "replay controls and file handling should not raise browser errors");
});


test("Chromium records a real player-controlled encounter and restores its replay after reload", async (t) => {
  const { server, url } = await startStaticServer();
  let browser;
  t.after(async () => {
    if (browser) await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  });

  const save = createDefaultSave();
  save.campaign = {
    stageIndex: 0, waveIndex: 0, turn: 0,
    enemyHp: 1, completed: false, campaignComplete: false
  };
  save.unlockedStageIndex = 0;
  save.board = Array.from({ length: 30 }, (_, index) =>
    Math.floor(index / 6) % 2 === index % 6 % 2 ? "fire" : "water"
  );
  save.battleStats = createBattleStats(0);
  const serializedSave = JSON.stringify(normalizeSave(save));

  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
  }, { key: SAVE_KEY, value: serializedSave });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelectorAll("#board .orb").length === 30);

  assert.equal(await page.locator("#replayLoadLive").isDisabled(), true);
  await page.locator('#board .orb[data-i="1"]').click();
  await page.locator('#board .orb[data-i="7"]').click();
  await page.waitForFunction(() => {
    const button = document.querySelector("#replayLoadLive");
    return button && !button.disabled;
  }, null, { timeout: 10000 });

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("tower_of_saviors_live_replay_v1")));
  assert.equal(stored.source, "live-player");
  assert.equal(stored.status, "victory");
  assert.ok(stored.eventCount >= 6);
  assert.ok(stored.events.some((event) => event.type === "swap"));
  assert.ok(stored.events.some((event) => event.type === "cascade"));
  assert.ok(stored.events.some((event) => event.type === "battle-end"));

  await page.locator("#replayLoadLive").click();
  assert.match(await page.locator("#replayStatus").innerText(), /最近一場實戰重播已載入/);
  assert.equal(await page.locator("#replayBoard .replay-orb").count(), 30);
  await page.locator("#replayNext").click();
  assert.match(await page.locator("#replayEventTitle").innerText(), /符石交換/);

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#replayExport").click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^tower-live-replay-seed-\d+\.json$/);

  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("#replayLoadLive").isDisabled(), false);
  await page.locator("#replayLoadLive").click();
  assert.match(await page.locator("#replayStatus").innerText(), /最近一場實戰重播已載入/);
  assert.deepEqual(pageErrors, [], "live replay recording and restoration should not raise browser errors");
  await context.close();
});
