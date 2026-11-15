import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultSave, normalizeSave, addCard } from "../inventory.js";
import { enhanceCardSkill, getSkillEnhancementQuote } from "../skillEnhancement.js";
import { getActiveSkill, createSkillStates, activateSkill, MAX_SKILL_LEVEL } from "../skills.js";

test("a duplicate copy and level-scaled gold are required to enhance a skill", () => {
  const save = createDefaultSave();
  const entry = save.inventory.find((item) => item.cardId === "ember_scout");
  assert.deepEqual(getSkillEnhancementQuote(entry), {
    skillLevel: 1, nextSkillLevel: 2, duplicateCost: 1, goldCost: 250, available: false, maxed: false
  });
  assert.throws(() => enhanceCardSkill(save, "ember_scout"), /duplicate copy/);
  assert.equal(save.currencies.gold, 1000);
  assert.equal(entry.quantity, 1);
});

test("enhancement consumes exactly one duplicate while retaining the owned card", () => {
  let save = addCard(createDefaultSave(), "ember_scout");
  const result = enhanceCardSkill(save, "ember_scout");
  const entry = result.save.inventory.find((item) => item.cardId === "ember_scout");
  assert.equal(result.skillLevel, 2);
  assert.equal(entry.skillLevel, 2);
  assert.equal(entry.quantity, 1);
  assert.equal(result.duplicateConsumed, 1);
  assert.equal(result.goldCost, 250);
  assert.equal(result.save.currencies.gold, 750);
  assert.equal(save.inventory.find((item) => item.cardId === "ember_scout").quantity, 2);
});

test("enhancement costs increase with the current skill level", () => {
  let save = addCard(createDefaultSave(), "tide_monk", 4);
  save.currencies.gold = 10000;
  for (let level = 1; level < 4; level += 1) {
    const entry = save.inventory.find((item) => item.cardId === "tide_monk");
    assert.equal(getSkillEnhancementQuote(entry).goldCost, level * 250);
    save = enhanceCardSkill(save, "tide_monk").save;
  }
  const entry = save.inventory.find((item) => item.cardId === "tide_monk");
  assert.equal(entry.skillLevel, 4);
  assert.equal(entry.quantity, 1);
});

test("maximum skill level prevents further duplicate or gold consumption", () => {
  let save = addCard(createDefaultSave(), "moss_guard", 5);
  save.currencies.gold = 10000;
  for (let i = 0; i < 4; i += 1) save = enhanceCardSkill(save, "moss_guard").save;
  const before = normalizeSave(save);
  assert.equal(before.inventory.find((item) => item.cardId === "moss_guard").skillLevel, MAX_SKILL_LEVEL);
  assert.throws(() => enhanceCardSkill(save, "moss_guard"), /maximum level/);
  assert.deepEqual(save, before);
});

test("unknown and unowned cards cannot be enhanced", () => {
  const save = createDefaultSave();
  assert.throws(() => enhanceCardSkill(save, "unknown"), /not owned|Unknown/i);
  assert.throws(() => getSkillEnhancementQuote({ cardId: "unknown", quantity: 2 }), /active skill/);
});

test("enhancement fails without enough gold and leaves the input save unchanged", () => {
  let save = addCard(createDefaultSave(), "heart_priest");
  save.currencies.gold = 0;
  const before = normalizeSave(save);
  assert.throws(() => enhanceCardSkill(save, "heart_priest"), /Not enough gold/);
  assert.deepEqual(save, before);
});

test("damage, conversion, shield and healing skills scale with skill level", () => {
  assert.equal(getActiveSkill("ember_scout", 5).multiplier, 1.7);
  assert.equal(getActiveSkill("tide_monk", 5).count, 7);
  assert.equal(getActiveSkill("moss_guard", 5).amount, 40);
  assert.equal(getActiveSkill("heart_priest", 5).fraction, 0.45);
  assert.equal(getActiveSkill("ember_scout", 5).cooldown, 3);
  assert.throws(() => getActiveSkill("ember_scout", 6), /skillLevel/);
});

test("activation applies the enhanced effect and enhanced cooldown", () => {
  const team = ["ember_scout", "tide_monk", "moss_guard", "dawn_archer", "heart_priest"];
  const board = Array(30).fill("fire");
  const result = activateSkill({
    cardId: "ember_scout", skillLevel: 5, skillStates: createSkillStates(team),
    board, hp: 80, maxHp: 100
  });
  assert.equal(result.damageMultiplier, 1.7);
  assert.equal(result.skillStates.ember_scout.remaining, 3);
});
