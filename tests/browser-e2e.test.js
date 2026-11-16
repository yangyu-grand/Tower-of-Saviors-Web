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
  await page.waitForFunction(() => document.querySelector("#tutorialTitle").textContent.includes("隊伍編組"));
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
