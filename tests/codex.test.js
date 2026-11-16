import test from "node:test";
import assert from "node:assert/strict";
import { CARD_CATALOG } from "../team.js";
import { createDefaultSave, addCard } from "../inventory.js";
import { buildCardCodex, filterCardCatalog } from "../codex.js";

function saveWithEvolution(cardId, level) {
  let save = createDefaultSave();
  if (!save.inventory.some((item) => item.cardId === cardId)) save = addCard(save, cardId);
  const entry = save.inventory.find((item) => item.cardId === cardId);
  entry.evolutionLevel = level;
  return save;
}

test("codex includes all 15 cards and identifies the 10 starter-owned cards", () => {
  const entries = buildCardCodex(CARD_CATALOG, createDefaultSave().inventory);
  assert.equal(entries.length, 15);
  assert.equal(entries.filter((entry) => entry.owned).length, 10);
  assert.equal(entries.filter((entry) => !entry.owned).length, 5);
});

test("search covers card IDs, names, active skills, and leader skills", () => {
  const inventory = createDefaultSave().inventory;
  assert.deepEqual(filterCardCatalog(CARD_CATALOG, inventory, {query:"烈焰突襲"}).map(x=>x.baseCard.id), ["ember_scout"]);
  assert.deepEqual(filterCardCatalog(CARD_CATALOG, inventory, {query:"abyss_weaver"}).map(x=>x.baseCard.id), ["abyss_weaver"]);
  assert.deepEqual(filterCardCatalog(CARD_CATALOG, inventory, {query:"深淵共鳴"}).map(x=>x.baseCard.id), ["abyss_weaver"]);
});

test("element and rarity filters use effective evolved rarity", () => {
  const save = saveWithEvolution("ember_scout", 2);
  assert.deepEqual(filterCardCatalog(CARD_CATALOG, save.inventory, {element:"heart"}).map(x=>x.baseCard.id), ["heart_priest"]);
  assert.ok(filterCardCatalog(CARD_CATALOG, save.inventory, {rarity:5}).some(x=>x.baseCard.id==="ember_scout"&&x.card.rarity===5));
  assert.equal(filterCardCatalog(CARD_CATALOG, save.inventory, {rarity:6}).length, 0);
  const ascendedFiveStar = saveWithEvolution("abyss_weaver", 1);
  assert.deepEqual(
    filterCardCatalog(CARD_CATALOG, ascendedFiveStar.inventory, {rarity:6}).map(x=>x.baseCard.id),
    ["abyss_weaver"]
  );
});

test("ownership filters update when a summon-only card is acquired", () => {
  const initial = createDefaultSave();
  assert.equal(filterCardCatalog(CARD_CATALOG, initial.inventory, {ownership:"owned"}).length, 10);
  assert.equal(filterCardCatalog(CARD_CATALOG, initial.inventory, {ownership:"unowned"}).length, 5);
  const acquired = addCard(initial, "azure_minstrel");
  assert.equal(filterCardCatalog(CARD_CATALOG, acquired.inventory, {ownership:"owned"}).length, 11);
  assert.equal(filterCardCatalog(CARD_CATALOG, acquired.inventory, {ownership:"unowned"}).length, 4);
});

test("evolution filters distinguish base, evolved, and maxed cards", () => {
  const save = saveWithEvolution("ember_scout", 2);
  assert.deepEqual(filterCardCatalog(CARD_CATALOG, save.inventory, {evolution:"evolved"}).map(x=>x.baseCard.id), ["ember_scout"]);
  assert.deepEqual(filterCardCatalog(CARD_CATALOG, save.inventory, {evolution:"maxed"}).map(x=>x.baseCard.id), ["ember_scout"]);
  assert.equal(filterCardCatalog(CARD_CATALOG, save.inventory, {evolution:"base"}).length, 14);
});

test("combined filters preserve source data and catalog order", () => {
  const save = saveWithEvolution("ember_scout", 1);
  const before = structuredClone(save.inventory);
  const results = filterCardCatalog(CARD_CATALOG, save.inventory, {query:"烈焰",element:"fire",rarity:4,ownership:"owned",evolution:"evolved"});
  assert.deepEqual(results.map(x=>x.baseCard.id), ["ember_scout"]);
  assert.deepEqual(save.inventory, before);
});

test("invalid filters and input types are rejected", () => {
  const inventory = createDefaultSave().inventory;
  assert.throws(()=>filterCardCatalog(CARD_CATALOG,inventory,{element:"ice"}),/Unknown codex element/);
  assert.throws(()=>filterCardCatalog(CARD_CATALOG,inventory,{rarity:7}),/Rarity filter/);
  assert.throws(()=>filterCardCatalog(CARD_CATALOG,inventory,{ownership:"maybe"}),/ownership filter/);
  assert.throws(()=>filterCardCatalog(CARD_CATALOG,inventory,{evolution:"future"}),/evolution filter/);
  assert.throws(()=>filterCardCatalog(CARD_CATALOG,inventory,{query:12}),/query must be a string/);
  assert.throws(()=>buildCardCodex(CARD_CATALOG,{}),/inventory must be an array/);
});
