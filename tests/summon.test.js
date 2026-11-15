import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultSave, addCurrency } from "../inventory.js";
import { summonCards, SUMMON_COSTS, SUMMON_RATES } from "../summon.js";

test("single summon uses one stone, adds one owned card, and records pity state", () => {
  const save = createDefaultSave();
  const result = summonCards(save, 1, () => 0.5);
  assert.equal(result.cost, SUMMON_COSTS.single);
  assert.equal(result.results.length, 1);
  assert.equal(result.save.currencies.summonStones, 2);
  assert.equal(result.save.summonState.totalSummons, 1);
  assert.equal(result.save.summonState.epicPity, 1);
  assert.equal(save.currencies.summonStones, 3);
});

test("rarity rates resolve to epic, rare, and common tiers at their boundaries", () => {
  const save = createDefaultSave();
  assert.equal(summonCards(save, 1, () => 0.01).results[0].card.rarity, 5);
  assert.equal(summonCards(save, 1, () => 0.10).results[0].card.rarity, 4);
  assert.equal(summonCards(save, 1, () => 0.50).results[0].card.rarity, 3);
  assert.deepEqual(SUMMON_RATES, { common: 0.70, rare: 0.25, epic: 0.05 });
});

test("a ten-pull guarantees at least one rare or epic card", () => {
  const save = addCurrency(createDefaultSave(), "summonStones", 7);
  const result = summonCards(save, 10, () => 0.99);
  assert.equal(result.results.length, 10);
  assert.equal(result.cost, SUMMON_COSTS.ten);
  assert.ok(result.results.some(({ card }) => card.rarity >= 4));
  assert.equal(result.guaranteeTriggered, true);
  assert.equal(result.save.currencies.summonStones, 0);
  assert.equal(result.save.summonState.totalSummons, 10);
});

test("the twentieth consecutive non-epic attempt is guaranteed to be epic", () => {
  const save = createDefaultSave();
  save.summonState.epicPity = 19;
  const result = summonCards(save, 1, () => 0.99);
  assert.equal(result.results[0].card.rarity, 5);
  assert.equal(result.save.summonState.epicPity, 0);
});

test("epic results reset pity while non-epic results increase it", () => {
  const save = createDefaultSave();
  save.summonState.epicPity = 7;
  const epic = summonCards(save, 1, () => 0.01);
  assert.equal(epic.save.summonState.epicPity, 0);
  const common = summonCards(save, 1, () => 0.5);
  assert.equal(common.save.summonState.epicPity, 8);
});

test("duplicate summons increase card quantity and identify the duplicate", () => {
  const save = createDefaultSave();
  const result = summonCards(save, 1, (() => { const values = [0.5, 0]; return () => values.shift() ?? 0; })());
  assert.equal(result.results[0].card.id, "ember_scout");
  assert.equal(result.results[0].duplicate, true);
  assert.equal(result.save.inventory.find((entry) => entry.cardId === "ember_scout").quantity, 2);
});

test("summons reject insufficient currency, invalid count, and invalid random values without mutating input", () => {
  const save = createDefaultSave();
  assert.throws(() => summonCards(save, 10, () => 0.5), /Not enough/);
  assert.throws(() => summonCards(save, 5, () => 0.5), /1 or 10/);
  assert.throws(() => summonCards(save, 1, () => 1), /\[0, 1\)/);
  assert.equal(save.currencies.summonStones, 3);
  assert.equal(save.summonState.totalSummons, 0);
});
