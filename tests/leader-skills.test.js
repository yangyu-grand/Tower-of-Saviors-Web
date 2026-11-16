import test from "node:test";
import assert from "node:assert/strict";
import { CARD_CATALOG, DEFAULT_TEAM, buildTeam } from "../team.js";

test("every catalog card has a distinct, documented leader skill", () => {
  assert.equal(CARD_CATALOG.length, 15);
  const names = CARD_CATALOG.map(card => card.leaderSkill?.name);
  assert.ok(names.every(Boolean));
  assert.equal(new Set(names).size, names.length);
});

test("starter fire leader applies only its own elemental attack and HP modifiers", () => {
  const team = buildTeam(DEFAULT_TEAM);
  assert.equal(team.leaderSkill.name, "赤焰先鋒");
  assert.equal(team.attackByElement.fire, 216);
  assert.equal(team.totalHp, 5954);
  assert.equal(team.leaderSkill.comboStepBonus ?? 0, 0);
});

test("water leader adds a Combo bonus and water attack multiplier", () => {
  const team = buildTeam(["tide_monk", "ember_scout", "moss_guard", "dawn_archer", "heart_priest"]);
  assert.equal(team.leaderSkill.name, "潮汐韻律");
  assert.equal(team.attackByElement.water, 192);
  assert.equal(team.leaderSkill.comboStepBonus, 0.05);
});

test("defensive and healing leaders expose their combat effects", () => {
  const wood = buildTeam(["moss_guard", "ember_scout", "tide_monk", "dawn_archer", "heart_priest"]);
  const heart = buildTeam(["heart_priest", "ember_scout", "tide_monk", "moss_guard", "dawn_archer"]);
  assert.equal(wood.leaderSkill.damageReduction, 0.08);
  assert.equal(heart.leaderSkill.healingMultiplier, 1.35);
  assert.ok(wood.totalHp > 5670);
  assert.ok(heart.totalHp > 5670);
});

test("multi-element leader multipliers apply to each matching team element", () => {
  const team = buildTeam(["cinder_knight", "ember_scout", "tide_monk", "dawn_archer", "heart_priest"]);
  assert.equal(team.attackByElement.fire, Math.round((165 + 180) * 1.15));
  assert.equal(team.attackByElement.water, Math.round(160 * 1.1));
});

test("leader effect ranges are validated when building a team", () => {
  const original = CARD_CATALOG.find(card => card.id === "moss_guard").leaderSkill;
  assert.ok(original.damageReduction <= 0.5);
  assert.ok(original.hpMultiplier <= 3);
});
