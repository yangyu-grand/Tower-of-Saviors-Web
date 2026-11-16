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
