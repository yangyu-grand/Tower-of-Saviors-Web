import test from "node:test";
import assert from "node:assert/strict";
import {
  SAVE_KEY, RUNE_TYPES, createDefaultSave, normalizeSave, loadSave, saveGame,
  isCardOwned, listOwnedCards, addCard, addCurrency, spendCurrency, SUMMON_EPIC_PITY_LIMIT
} from "../inventory.js";

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem(key) { assert.equal(key, SAVE_KEY); return value; },
    setItem(key, next) { assert.equal(key, SAVE_KEY); value = next; },
    raw() { return value; }
  };
}

test("new profile owns the original starter collection and a valid five-card team", () => {
  const save = createDefaultSave();
  assert.equal(save.inventory.length, 10);
  assert.equal(save.teamIds.length, 5);
  assert.ok(save.teamIds.every((id) => isCardOwned(save, id)));
  assert.equal(listOwnedCards(save).length, 10);
  assert.equal(save.currencies.summonStones, 3);
});

test("normalization returns a detached, validated save snapshot", () => {
  const original = createDefaultSave();
  const normalized = normalizeSave(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(normalized, original);
  normalized.inventory[0].quantity = 9;
  assert.equal(original.inventory[0].quantity, 1);
});

test("rejects unknown or duplicate inventory cards", () => {
  const unknown = createDefaultSave();
  unknown.inventory[0].cardId = "not-a-card";
  assert.throws(() => normalizeSave(unknown), /unknown card/i);
  const duplicate = createDefaultSave();
  duplicate.inventory[1].cardId = duplicate.inventory[0].cardId;
  assert.throws(() => normalizeSave(duplicate), /unique/);
});

test("rejects a team card that is not owned", () => {
  const save = createDefaultSave();
  save.inventory = save.inventory.filter((entry) => entry.cardId !== "moon_sentinel");
  save.teamIds[0] = "moon_sentinel";
  assert.throws(() => normalizeSave(save), /not owned/);
});

test("rejects invalid currency, board, campaign and cooldown values", () => {
  const currency = createDefaultSave(); currency.currencies.gold = -1;
  assert.throws(() => normalizeSave(currency), /gold/);
  const board = createDefaultSave(); board.board = Array(29).fill("fire");
  assert.throws(() => normalizeSave(board), /30 valid runes/);
  const campaign = createDefaultSave(); campaign.campaign.stageIndex = 99;
  assert.throws(() => normalizeSave(campaign), /stage index/);
  const cooldown = createDefaultSave(); cooldown.skillStates.ember_scout.remaining = 99;
  assert.throws(() => normalizeSave(cooldown), /cooldown/);
});

test("loads a fresh profile when no save exists and restores a valid save", () => {
  const storage = memoryStorage();
  assert.equal(loadSave(storage).status, "new");
  const save = createDefaultSave(); save.score = 120;
  assert.equal(saveGame(save, storage).ok, true);
  const loaded = loadSave(storage);
  assert.equal(loaded.status, "loaded");
  assert.equal(loaded.save.score, 120);
});

test("save round-trip preserves board, campaign turn, cooldowns, currencies, and unlocks", () => {
  const storage = memoryStorage();
  const save = createDefaultSave();
  save.board = Array.from({ length: 30 }, (_, index) => RUNE_TYPES[index % RUNE_TYPES.length]);
  save.campaign = { ...save.campaign, turn: 2, enemyHp: 123 };
  save.skillStates.ember_scout = { remaining: 3, justActivated: false };
  save.currencies.gold = 3210;
  save.unlockedStageIndex = 1;
  assert.equal(saveGame(save, storage).ok, true);
  const restored = loadSave(storage).save;
  assert.deepEqual(restored.board, save.board);
  assert.deepEqual(restored.campaign, save.campaign);
  assert.equal(restored.skillStates.ember_scout.remaining, 3);
  assert.equal(restored.currencies.gold, 3210);
  assert.equal(restored.unlockedStageIndex, 1);
});

test("invalid saves never overwrite a previously valid stored save", () => {
  const storage = memoryStorage();
  const valid = createDefaultSave();
  assert.equal(saveGame(valid, storage).ok, true);
  const previous = storage.raw();
  const invalid = { ...valid, hp: -10 };
  assert.equal(saveGame(invalid, storage).ok, false);
  assert.equal(storage.raw(), previous);
});

test("corrupt or unsupported saves safely fall back without deleting the stored value", () => {
  const storage = memoryStorage("{bad json");
  const loaded = loadSave(storage);
  assert.equal(loaded.status, "invalid");
  assert.equal(loaded.save.score, 0);
  assert.equal(storage.raw(), "{bad json");
});

test("storage access failures are reported without crashing game startup", () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(loadSave(broken).status, "invalid");
  assert.equal(saveGame(createDefaultSave(), broken).ok, false);
  assert.equal(loadSave(null).status, "unavailable");
});

test("card duplicates increase owned quantity and new cards enter inventory", () => {
  let save = createDefaultSave();
  save = addCard(save, "ember_scout", 2);
  assert.equal(save.inventory.find((entry) => entry.cardId === "ember_scout").quantity, 3);
  save.inventory = save.inventory.filter((entry) => entry.cardId !== "moon_sentinel");
  save = addCard(save, "moon_sentinel");
  assert.equal(isCardOwned(save, "moon_sentinel"), true);
});

test("currency rewards and spending are validated and immutable", () => {
  const save = createDefaultSave();
  const rewarded = addCurrency(save, "gold", 250);
  assert.equal(rewarded.currencies.gold, 1250);
  assert.equal(save.currencies.gold, 1000);
  const spent = spendCurrency(rewarded, "summonStones", 2);
  assert.equal(spent.currencies.summonStones, 1);
  assert.throws(() => spendCurrency(save, "gold", 2000), /Not enough/);
  assert.throws(() => addCurrency(save, "unknown", 1), /Unknown currency/);
});

test("legacy saves without summon state migrate with zero summon history", () => {
  const legacy = createDefaultSave();
  delete legacy.summonState;
  const migrated = normalizeSave(legacy);
  assert.deepEqual(migrated.summonState, { totalSummons: 0, epicPity: 0 });
});

test("version-1 saves migrate to version 2 with skill level one for every card", () => {
  const legacy = createDefaultSave();
  legacy.version = 1;
  legacy.inventory.forEach((entry) => { delete entry.skillLevel; });
  const migrated = normalizeSave(legacy);
  assert.equal(migrated.version, 2);
  assert.ok(migrated.inventory.every((entry) => entry.skillLevel === 1));
});

test("summon pity state is validated and bounded below the guaranteed pull", () => {
  const invalid = createDefaultSave();
  invalid.summonState.epicPity = SUMMON_EPIC_PITY_LIMIT;
  assert.throws(() => normalizeSave(invalid), /epicPity/);
  const negative = createDefaultSave();
  negative.summonState.totalSummons = -1;
  assert.throws(() => normalizeSave(negative), /totalSummons/);
});
