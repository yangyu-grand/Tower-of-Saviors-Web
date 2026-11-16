import test from "node:test";
import assert from "node:assert/strict";
import { STAGES } from "../stages.js";
import { ENEMY_CODEX, buildEnemyCodex, filterEnemyCodex } from "../enemyCodex.js";

test("enemy codex indexes all twelve campaign encounters and four bosses", () => {
  assert.equal(ENEMY_CODEX.length, 12);
  assert.equal(ENEMY_CODEX.filter((entry) => entry.isBoss).length, 4);
  assert.deepEqual(ENEMY_CODEX.map((entry) => entry.stageId), [
    "ash-road", "ash-road", "ash-road",
    "tide-ruins", "tide-ruins", "tide-ruins",
    "eclipse-throne", "eclipse-throne", "eclipse-throne",
    "mist-sakura-ancient", "mist-sakura-ancient", "mist-sakura-ancient"
  ]);
});

test("enemy codex preserves attack cadence, multi-hit, support, and boss phase data", () => {
  const reefStalker = ENEMY_CODEX.find((entry) => entry.id === "reef-stalker");
  assert.equal(reefStalker.attackPattern.type, "multi");
  assert.equal(reefStalker.attackPattern.hits, 2);
  assert.equal(reefStalker.attackPattern.name, "雙重撕咬");

  const coralSentinel = ENEMY_CODEX.find((entry) => entry.id === "coral-sentinel");
  assert.deepEqual(coralSentinel.support, { every: 3, name: "珊瑚再生", amount: 36 });

  const sakuraBoss = ENEMY_CODEX.find((entry) => entry.id === "sakura-moon-fox");
  assert.equal(sakuraBoss.phases.length, 2);
  assert.equal(sakuraBoss.phases[0].name, "花霧姿態");
  assert.equal(sakuraBoss.phases[1].at, 0.5);
  assert.equal(sakuraBoss.phases[1].attackPattern.hits, 3);
  assert.equal(sakuraBoss.phases[1].special.name, "天狐焚月");
});

test("enemy codex filters by boss role, chapter, and element without changing source data", () => {
  const source = JSON.stringify(ENEMY_CODEX);
  assert.equal(filterEnemyCodex(ENEMY_CODEX, { role: "boss" }).length, 4);
  assert.equal(filterEnemyCodex(ENEMY_CODEX, { role: "normal" }).length, 8);
  assert.equal(filterEnemyCodex(ENEMY_CODEX, { stageId: "mist-sakura-ancient" }).length, 3);
  assert.equal(filterEnemyCodex(ENEMY_CODEX, { element: "dark" }).length, 3);
  assert.equal(JSON.stringify(ENEMY_CODEX), source);
});

test("enemy codex search includes attack names, stage names, and boss phase specials", () => {
  assert.deepEqual(filterEnemyCodex(ENEMY_CODEX, { query: "天狐焚月" }).map((entry) => entry.id), ["sakura-moon-fox"]);
  assert.deepEqual(filterEnemyCodex(ENEMY_CODEX, { query: "霧櫻古境" }).map((entry) => entry.id), [
    "mist-tail-fox", "splitwind-tengu", "sakura-moon-fox"
  ]);
  assert.deepEqual(filterEnemyCodex(ENEMY_CODEX, { query: "雙重撕咬" }).map((entry) => entry.id), ["reef-stalker"]);
});

test("enemy codex validates malformed campaign data and filter values", () => {
  assert.throws(() => buildEnemyCodex(null), /stages/);
  assert.throws(() => buildEnemyCodex([{ id: "broken", name: "Broken", waves: [{ id: "x", name: "X", element: "ice", hp: 1, attack: 1 }] }]), /Unknown enemy element/);
  assert.throws(() => filterEnemyCodex(ENEMY_CODEX, { role: "elite" }), /Unknown enemy codex role/);
  assert.throws(() => filterEnemyCodex(ENEMY_CODEX, { element: "ice" }), /Unknown enemy codex element/);
  assert.throws(() => filterEnemyCodex(ENEMY_CODEX, null), /filters/);
});

test("enemy codex remains derived from the shared campaign source of truth", () => {
  assert.equal(ENEMY_CODEX.length, STAGES.reduce((total, stage) => total + stage.waves.length, 0));
  assert.equal(ENEMY_CODEX[11].name, STAGES[3].waves[2].name);
});
