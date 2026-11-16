import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const openTag = '<script type="module">';
const start = html.indexOf(openTag);
const end = html.indexOf("</script>", start);
const moduleSource = start >= 0 && end > start
  ? html.slice(start + openTag.length, end)
  : "";

test("the embedded browser module parses after removing static imports", () => {
  assert.ok(start >= 0 && end > start, "index.html must contain its browser module");
  const source = moduleSource
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("import "))
    .join("\n");
  assert.doesNotThrow(() => new vm.Script(source, { filename: "index.html#module" }));
});

test("the inventory UI exposes progression controls and the saved progression module", () => {
  assert.match(html, /from "\.\/progression\.js"/);
  assert.match(html, /id="inventoryGrid"/);
  assert.match(html, /特訓升級/);
  assert.match(html, /隊伍全員獲得/);
});

test("the inventory UI exposes duplicate-card skill enhancement and displays effective skill levels", () => {
  assert.match(html, /from "\.\/skillEnhancement\.js"/);
  assert.match(html, /function performSkillEnhancement/);
  assert.match(html, /skill-enhance/);
  assert.match(html, /技能 Lv\./);
  assert.match(html, /getActiveSkill\(cardId,skillLevel\)/);
});


test("the browser UI exposes card evolution, material balances, and battle material rewards", () => {
  assert.match(html, /from "\.\/evolution\.js"/);
  assert.match(html, /function performEvolution/);
  assert.match(html, /evolution-button/);
  assert.match(html, /id="awakeningShards"/);
  assert.match(html, /id="prismCores"/);
  assert.match(html, /addMaterials\(profile,"awakeningShards"/);
});


test("the browser applies leader combo, heart-healing, and incoming-damage reduction effects", () => {
  assert.match(html, /comboStepBonus:currentTeam\.leaderSkill\?\.comboStepBonus/);
  assert.match(html, /healingMultiplier:currentTeam\.leaderSkill\?\.healingMultiplier/);
  assert.match(html, /currentTeam\.leaderSkill\?\.damageReduction/);
  assert.match(html, /adjustedIncomingDamage/);
});

test("the card codex exposes searchable element, rarity, ownership, and evolution filters", () => {
  assert.match(html, /from "\.\/codex\.js"/);
  assert.match(html, /id="codexSearch"/);
  assert.match(html, /id="codexElementFilter"/);
  assert.match(html, /id="codexRarityFilter"/);
  assert.match(html, /id="codexOwnershipFilter"/);
  assert.match(html, /id="codexEvolutionFilter"/);
  assert.match(html, /function renderCodex/);
  assert.match(html, /filterCardCatalog\(CARD_CATALOG,profile\.inventory/);
  assert.match(html, /主動技能 · /);
  assert.match(html, /隊長技能 · /);
});


test("the browser UI wires opt-in sound and battle feedback animations", () => {
  assert.match(html, /from "\.\/battleFeedback\.js"/);
  assert.match(html, /id="soundToggle"/);
  assert.match(html, /feedback\.playMatch/);
  assert.match(html, /feedback\.playHit/);
  assert.match(html, /feedback\.playVictory/);
  assert.match(html, /feedback\.playEnemyAttack/);
  assert.match(html, /prefers-reduced-motion:reduce/);
});


test("the browser exposes a first-run tutorial with gameplay event hooks and persistent skip controls", () => {
  assert.match(html, /from "\.\/tutorial\.js"/);
  assert.match(html, /id="tutorialPanel"/);
  assert.match(html, /id="tutorialAdvance"/);
  assert.match(html, /id="tutorialSkip"/);
  assert.match(html, /updateTutorial\("match"\)/);
  assert.match(html, /updateTutorial\("skill"\)/);
  assert.match(html, /loadTutorialProgress\(storage\)/);
  assert.match(html, /saveTutorialProgress\(tutorialProgress,storage\)/);
  assert.match(html, /tutorial-target/);
});


test("the browser renders a persistent stage-clear result with a non-claiming reward summary", () => {
  assert.match(html, /from "\.\/battleResults\.js"/);
  assert.match(html, /id="battleResult"/);
  assert.match(html, /id="resultContinue"/);
  assert.match(html, /id="resultDismiss"/);
  assert.match(html, /buildBattleResult\(battleStats\)/);
  assert.match(html, /recordEncounterDefeat\(battleStats/);
  assert.match(html, /completeBattleStats\(battleStats\)/);
  assert.match(html, /獎勵已自動加入背包，不需要再次領取/);
});


test("the browser previews enemy attack patterns, multi-hit counts, and support healing", () => {
  assert.match(html, /intent\.hits>1/);
  assert.match(html, /intent\.healing>0/);
  assert.match(html, /intent\.previewDamage>0/);
  assert.match(html, /enemyTurn\.intent\.hits\?\?1/);
  assert.match(html, /aria-live="polite">敵人預告/);
});

test("the enemy codex exposes searchable chapter, element, role, and boss-phase information", () => {
  assert.match(html, /from "\.\/enemyCodex\.js"/);
  assert.match(html, /id="enemyCodexSearch"/);
  assert.match(html, /id="enemyCodexStageFilter"/);
  assert.match(html, /id="enemyCodexElementFilter"/);
  assert.match(html, /id="enemyCodexRoleFilter"/);
  assert.match(html, /function renderEnemyCodex/);
  assert.match(html, /initializeEnemyCodex\(\)/);
  assert.match(html, /unlockedStageTotal/);
  assert.match(html, /phase\.special/);
});
