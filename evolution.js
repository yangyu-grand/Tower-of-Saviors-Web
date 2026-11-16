import { getCard, getMaxEvolutionLevel } from "./team.js";
import { normalizeSave, spendCurrency, spendMaterials } from "./inventory.js";

export const EVOLUTION_RECIPES = Object.freeze({
  3: Object.freeze({ awakeningShards: 3, prismCores: 1, goldCost: 500 }),
  4: Object.freeze({ awakeningShards: 6, prismCores: 2, goldCost: 1500 }),
  5: Object.freeze({ awakeningShards: 10, prismCores: 3, goldCost: 3000 })
});

export function getCardEvolutionLevels(inventory) {
  if (!Array.isArray(inventory)) throw new TypeError("inventory must be an array");
  return Object.fromEntries(inventory.map((entry) => {
    const card = getCard(entry.cardId);
    const evolutionLevel = entry.evolutionLevel ?? 0;
    if (!Number.isInteger(evolutionLevel) || evolutionLevel < 0 || evolutionLevel > getMaxEvolutionLevel(card.id)) {
      throw new RangeError("Invalid evolution level for " + card.id);
    }
    return [card.id, evolutionLevel];
  }));
}

export function getEvolutionQuote(inputSave, cardId) {
  const save = normalizeSave(inputSave);
  const entry = save.inventory.find((item) => item.cardId === cardId && item.quantity > 0);
  if (!entry) throw new Error("Card is not owned: " + String(cardId));
  const card = getCard(cardId);
  const evolutionLevel = entry.evolutionLevel ?? 0;
  const maxed = evolutionLevel >= getMaxEvolutionLevel(cardId);
  const currentRarity = card.rarity + evolutionLevel;
  const recipe = maxed ? null : EVOLUTION_RECIPES[currentRarity];
  if (!maxed && !recipe) throw new RangeError("No evolution recipe for rarity " + currentRarity);
  const costs = recipe ?? { awakeningShards: 0, prismCores: 0, goldCost: 0 };
  const missingGold = Math.max(0, costs.goldCost - save.currencies.gold);
  const missingAwakeningShards = Math.max(0, costs.awakeningShards - save.materials.awakeningShards);
  const missingPrismCores = Math.max(0, costs.prismCores - save.materials.prismCores);
  return {
    cardId,
    evolutionLevel,
    nextEvolutionLevel: maxed ? evolutionLevel : evolutionLevel + 1,
    currentRarity,
    targetRarity: maxed ? currentRarity : currentRarity + 1,
    awakeningShards: costs.awakeningShards,
    prismCores: costs.prismCores,
    goldCost: costs.goldCost,
    missingGold,
    missingAwakeningShards,
    missingPrismCores,
    maxed,
    available: !maxed && missingGold === 0 && missingAwakeningShards === 0 && missingPrismCores === 0
  };
}

export function evolveCard(inputSave, cardId) {
  const save = normalizeSave(inputSave);
  const quote = getEvolutionQuote(save, cardId);
  if (quote.maxed) throw new Error("Card is already at maximum evolution");
  if (quote.missingGold > 0) throw new Error("Not enough gold");
  if (quote.missingAwakeningShards > 0 || quote.missingPrismCores > 0) {
    throw new Error("Not enough evolution materials");
  }

  let next = spendCurrency(save, "gold", quote.goldCost);
  next = spendMaterials(next, {
    awakeningShards: quote.awakeningShards,
    prismCores: quote.prismCores
  });
  const entry = next.inventory.find((item) => item.cardId === cardId);
  entry.evolutionLevel = quote.nextEvolutionLevel;
  return {
    save: normalizeSave(next),
    cardId,
    evolutionLevel: quote.nextEvolutionLevel,
    targetRarity: quote.targetRarity,
    goldCost: quote.goldCost,
    materialsSpent: {
      awakeningShards: quote.awakeningShards,
      prismCores: quote.prismCores
    }
  };
}
