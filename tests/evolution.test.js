import test from "node:test";
import assert from "node:assert/strict";
import { CARD_CATALOG, DEFAULT_TEAM, buildTeam } from "../team.js";
import { addCard, addMaterials, createDefaultSave, listOwnedCards, normalizeSave } from "../inventory.js";
import { evolveCard, getCardEvolutionLevels, getEvolutionQuote } from "../evolution.js";

function fundedSave(cardId, shards, cores, gold = 10000) {
  let save = createDefaultSave();
  if (!save.inventory.some((entry) => entry.cardId === cardId)) save = addCard(save, cardId);
  save.currencies.gold = gold;
  save = addMaterials(save, "awakeningShards", shards);
  save = addMaterials(save, "prismCores", cores);
  return save;
}

test("starter cards require the first evolution recipe and report missing materials", () => {
  const save = createDefaultSave();
  const quote = getEvolutionQuote(save, "ember_scout");
  assert.equal(quote.currentRarity, 3);
  assert.equal(quote.targetRarity, 4);
  assert.equal(quote.goldCost, 500);
  assert.equal(quote.awakeningShards, 3);
  assert.equal(quote.prismCores, 1);
  assert.equal(quote.available, false);
  assert.equal(quote.missingAwakeningShards, 3);
  assert.equal(quote.missingPrismCores, 1);
});

test("first evolution consumes materials and gold while preserving level, EXP, skill level, and quantity", () => {
  let save = fundedSave("ember_scout", 3, 1);
  const entry = save.inventory.find((item) => item.cardId === "ember_scout");
  entry.level = 12;
  entry.exp = 50;
  entry.skillLevel = 3;
  save = normalizeSave(save);
  const result = evolveCard(save, "ember_scout");
  const evolved = result.save.inventory.find((item) => item.cardId === "ember_scout");
  assert.equal(result.targetRarity, 4);
  assert.equal(evolved.evolutionLevel, 1);
  assert.equal(evolved.level, 12);
  assert.equal(evolved.exp, 50);
  assert.equal(evolved.skillLevel, 3);
  assert.equal(evolved.quantity, 1);
  assert.equal(result.save.currencies.gold, 9500);
  assert.deepEqual(result.save.materials, { awakeningShards: 0, prismCores: 0 });
  const display = listOwnedCards(result.save).find((item) => item.id === "ember_scout");
  assert.equal(display.rarity, 4);
  assert.match(display.name, /覺醒/);
});

test("a three-star card can progress through awakening and ascension to five stars", () => {
  let save = fundedSave("moss_guard", 9, 3);
  save = evolveCard(save, "moss_guard").save;
  const secondQuote = getEvolutionQuote(save, "moss_guard");
  assert.equal(secondQuote.currentRarity, 4);
  assert.equal(secondQuote.targetRarity, 5);
  assert.equal(secondQuote.goldCost, 1500);
  save = evolveCard(save, "moss_guard").save;
  const entry = save.inventory.find((item) => item.cardId === "moss_guard");
  assert.equal(entry.evolutionLevel, 2);
  const card = listOwnedCards(save).find((item) => item.id === "moss_guard");
  assert.equal(card.rarity, 5);
  assert.match(card.name, /神化/);
});

test("four-star and five-star summon cards have their own evolution targets", () => {
  const fourStar = evolveCard(fundedSave("azure_minstrel", 6, 2), "azure_minstrel");
  assert.equal(fourStar.targetRarity, 5);
  const fiveStar = evolveCard(fundedSave("abyss_weaver", 10, 3), "abyss_weaver");
  assert.equal(fiveStar.targetRarity, 6);
});

test("evolution updates the actual party HP and elemental attack totals", () => {
  let save = fundedSave("ember_scout", 3, 1);
  const before = buildTeam(DEFAULT_TEAM);
  save = evolveCard(save, "ember_scout").save;
  const levels = Object.fromEntries(save.inventory.map((entry) => [entry.cardId, entry.level]));
  const evolutionLevels = getCardEvolutionLevels(save.inventory);
  const after = buildTeam(DEFAULT_TEAM, { levels, evolutionLevels });
  assert.ok(after.totalHp > before.totalHp);
  assert.ok(after.attackByElement.fire > before.attackByElement.fire);
});

test("insufficient gold or materials never mutates the original save", () => {
  const noMaterials = fundedSave("ember_scout", 2, 1);
  const beforeMaterials = normalizeSave(noMaterials);
  assert.throws(() => evolveCard(noMaterials, "ember_scout"), /Not enough evolution materials/);
  assert.deepEqual(noMaterials, beforeMaterials);
  const noGold = fundedSave("ember_scout", 3, 1, 0);
  const beforeGold = normalizeSave(noGold);
  assert.throws(() => evolveCard(noGold, "ember_scout"), /Not enough gold/);
  assert.deepEqual(noGold, beforeGold);
});

test("maximum evolution prevents any further resource consumption", () => {
  let save = fundedSave("ember_scout", 20, 10);
  save = evolveCard(save, "ember_scout").save;
  save = evolveCard(save, "ember_scout").save;
  const before = normalizeSave(save);
  const quote = getEvolutionQuote(save, "ember_scout");
  assert.equal(quote.maxed, true);
  assert.equal(quote.available, false);
  assert.throws(() => evolveCard(save, "ember_scout"), /maximum evolution/);
  assert.deepEqual(save, before);
});

test("all catalog cards have a bounded evolution path", () => {
  assert.equal(CARD_CATALOG.length, 15);
  for (const card of CARD_CATALOG) {
    const save = fundedSave(card.id, 20, 10);
    const quote = getEvolutionQuote(save, card.id);
    assert.equal(quote.targetRarity, card.rarity + 1);
    assert.equal(quote.available, true);
  }
});

test("unowned cards and malformed evolution levels are rejected", () => {
  const save = createDefaultSave();
  assert.throws(() => getEvolutionQuote(save, "abyss_weaver"), /not owned/);
  const invalid = createDefaultSave();
  invalid.inventory.find((entry) => entry.cardId === "azure_minstrel").evolutionLevel = 2;
  assert.throws(() => normalizeSave(invalid), /Invalid evolution level/);
});
