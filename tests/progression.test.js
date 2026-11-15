import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultSave, normalizeSave } from "../inventory.js";
import { DEFAULT_TEAM, buildTeam } from "../team.js";
import {
  MAX_CARD_LEVEL, experienceToNextLevel, getCardLevels, grantCardExperience,
  grantTeamExperience, getTrainingQuote, trainCard
} from "../progression.js";

test("experience thresholds increase by level and stop at the level cap", () => {
  assert.equal(experienceToNextLevel(1), 100);
  assert.equal(experienceToNextLevel(2), 125);
  assert.equal(experienceToNextLevel(MAX_CARD_LEVEL), 0);
  assert.throws(() => experienceToNextLevel(0), /level/);
});

test("partial card experience is retained without changing the level", () => {
  const result = grantCardExperience(createDefaultSave(), "ember_scout", 45);
  const entry = result.save.inventory.find((item) => item.cardId === "ember_scout");
  assert.equal(entry.level, 1);
  assert.equal(entry.exp, 45);
  assert.equal(result.levelsGained, 0);
});

test("reaching the threshold levels a card and carries no unnecessary remainder", () => {
  const result = grantCardExperience(createDefaultSave(), "ember_scout", 100);
  const entry = result.save.inventory.find((item) => item.cardId === "ember_scout");
  assert.equal(entry.level, 2);
  assert.equal(entry.exp, 0);
  assert.equal(result.levelsGained, 1);
});

test("large experience grants can produce multiple level-ups", () => {
  const result = grantCardExperience(createDefaultSave(), "ember_scout", 350);
  const entry = result.save.inventory.find((item) => item.cardId === "ember_scout");
  assert.equal(entry.level, 3);
  assert.equal(entry.exp, 125);
  assert.equal(result.levelsGained, 2);
});

test("battle experience is granted independently to each active team member", () => {
  const result = grantTeamExperience(createDefaultSave(), DEFAULT_TEAM, 40);
  assert.equal(result.results.length, 5);
  for (const cardId of DEFAULT_TEAM) {
    const entry = result.save.inventory.find((item) => item.cardId === cardId);
    assert.equal(entry.exp, 40);
  }
});

test("experience is capped at level 99 and excess experience is discarded", () => {
  const save = createDefaultSave();
  const entry = save.inventory.find((item) => item.cardId === "ember_scout");
  entry.level = 98;
  entry.exp = experienceToNextLevel(98) - 1;
  const result = grantCardExperience(save, "ember_scout", 5000);
  const capped = result.save.inventory.find((item) => item.cardId === "ember_scout");
  assert.equal(capped.level, MAX_CARD_LEVEL);
  assert.equal(capped.exp, 0);
});

test("training spends level-scaled gold and advances exactly one level", () => {
  const result = trainCard(createDefaultSave(), "ember_scout");
  const entry = result.save.inventory.find((item) => item.cardId === "ember_scout");
  assert.equal(result.goldCost, 100);
  assert.equal(result.expGranted, 100);
  assert.equal(result.level, 2);
  assert.equal(entry.level, 2);
  assert.equal(entry.exp, 0);
  assert.equal(result.save.currencies.gold, 900);
});

test("training quote accounts for already-earned experience", () => {
  const entry = { cardId: "ember_scout", level: 2, exp: 25 };
  assert.deepEqual(getTrainingQuote(entry), { goldCost: 200, expGranted: 100, available: true });
});

test("training rejects unowned cards, insufficient gold, and maximum-level cards", () => {
  const save = createDefaultSave();
  assert.throws(() => trainCard(save, "abyss_weaver"), /not owned/);
  save.currencies.gold = 0;
  assert.throws(() => trainCard(save, "ember_scout"), /Not enough gold/);
  const maxed = createDefaultSave();
  const entry = maxed.inventory.find((item) => item.cardId === "ember_scout");
  entry.level = MAX_CARD_LEVEL;
  entry.exp = 0;
  assert.throws(() => trainCard(maxed, "ember_scout"), /maximum level/);
});

test("progressed card levels increase party HP and elemental attack", () => {
  const base = buildTeam(DEFAULT_TEAM);
  const leveled = buildTeam(DEFAULT_TEAM, { levels: { ember_scout: 2 } });
  assert.ok(leveled.baseHp > base.baseHp);
  assert.ok(leveled.totalHp > base.totalHp);
  assert.ok(leveled.attackByElement.fire > base.attackByElement.fire);
  assert.equal(leveled.cards[0].level, 2);
});

test("level-aware save validation permits the progressed team's higher HP ceiling", () => {
  const save = createDefaultSave();
  save.inventory.find((item) => item.cardId === "ember_scout").level = 2;
  const team = buildTeam(save.teamIds, { levels: getCardLevels(save.inventory) });
  save.hp = team.totalHp;
  assert.equal(normalizeSave(save).hp, team.totalHp);
  save.hp += 1;
  assert.throws(() => normalizeSave(save), /HP limit/);
});

test("save validation rejects experience already beyond the next-level threshold", () => {
  const save = createDefaultSave();
  save.inventory.find((item) => item.cardId === "ember_scout").exp = 100;
  assert.throws(() => normalizeSave(save), /next-level threshold/);
});

test("team experience rejects malformed teams and invalid amounts without mutating input", () => {
  const save = createDefaultSave();
  assert.throws(() => grantTeamExperience(save, DEFAULT_TEAM.slice(0, 4), 10), /five unique/);
  assert.throws(() => grantCardExperience(save, "ember_scout", -1), /experience/);
  assert.equal(save.inventory[0].exp, 0);
});

test("card level lookup returns the current owned levels", () => {
  const save = createDefaultSave();
  save.inventory.find((item) => item.cardId === "ember_scout").level = 3;
  const levels = getCardLevels(save.inventory);
  assert.equal(levels.ember_scout, 3);
  assert.equal(levels.tide_monk, 1);
});
