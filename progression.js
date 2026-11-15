import { normalizeSave, spendCurrency } from "./inventory.js";
import { getCard } from "./team.js";

export const MAX_CARD_LEVEL = 99;
export const BASE_EXP_TO_NEXT_LEVEL = 100;
export const EXP_GROWTH_PER_LEVEL = 25;
export const TRAINING_GOLD_PER_LEVEL = 100;

function assertAmount(amount, label = "experience") {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000) {
    throw new RangeError(label + " must be an integer between 0 and 1000000");
  }
}

export function experienceToNextLevel(level) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_CARD_LEVEL) {
    throw new RangeError("level must be an integer between 1 and " + MAX_CARD_LEVEL);
  }
  return level >= MAX_CARD_LEVEL ? 0 : BASE_EXP_TO_NEXT_LEVEL + EXP_GROWTH_PER_LEVEL * (level - 1);
}

export function getCardLevels(inventory) {
  if (!Array.isArray(inventory)) throw new TypeError("inventory must be an array");
  return Object.fromEntries(inventory.map((entry) => {
    getCard(entry.cardId);
    if (!Number.isInteger(entry.level) || entry.level < 1 || entry.level > MAX_CARD_LEVEL) {
      throw new RangeError("Invalid card level for " + entry.cardId);
    }
    return [entry.cardId, entry.level];
  }));
}

function applyExperience(entry, amount) {
  assertAmount(amount);
  const startingLevel = entry.level;
  let remaining = entry.exp + amount;
  while (entry.level < MAX_CARD_LEVEL) {
    const required = experienceToNextLevel(entry.level);
    if (remaining < required) break;
    remaining -= required;
    entry.level += 1;
  }
  if (entry.level >= MAX_CARD_LEVEL) remaining = 0;
  entry.exp = remaining;
  return { levelsGained: entry.level - startingLevel, level: entry.level, exp: entry.exp };
}

export function grantCardExperience(inputSave, cardId, amount) {
  getCard(cardId);
  const save = normalizeSave(inputSave);
  const entry = save.inventory.find((item) => item.cardId === cardId && item.quantity > 0);
  if (!entry) throw new Error("Card is not owned: " + cardId);
  const result = applyExperience(entry, amount);
  return { save: normalizeSave(save), cardId, expGained: amount, ...result };
}

export function grantTeamExperience(inputSave, teamIds, amount) {
  assertAmount(amount);
  if (!Array.isArray(teamIds) || teamIds.length !== 5 || new Set(teamIds).size !== 5) {
    throw new RangeError("Team experience requires five unique card ids");
  }
  const save = normalizeSave(inputSave);
  const results = teamIds.map((cardId) => {
    getCard(cardId);
    const entry = save.inventory.find((item) => item.cardId === cardId && item.quantity > 0);
    if (!entry) throw new Error("Team card is not owned: " + cardId);
    return { cardId, expGained: amount, ...applyExperience(entry, amount) };
  });
  return { save: normalizeSave(save), results };
}

export function getTrainingQuote(entry) {
  if (!entry || !Number.isInteger(entry.level) || entry.level < 1 || entry.level > MAX_CARD_LEVEL ||
      !Number.isSafeInteger(entry.exp) || entry.exp < 0) {
    throw new TypeError("A valid inventory card entry is required");
  }
  if (entry.level >= MAX_CARD_LEVEL) return { goldCost: 0, expGranted: 0, available: false };
  const expGranted = experienceToNextLevel(entry.level) - entry.exp;
  if (expGranted <= 0) throw new RangeError("Card experience must be below the next-level threshold");
  return { goldCost: entry.level * TRAINING_GOLD_PER_LEVEL, expGranted, available: true };
}

export function trainCard(inputSave, cardId) {
  getCard(cardId);
  const save = normalizeSave(inputSave);
  const entry = save.inventory.find((item) => item.cardId === cardId && item.quantity > 0);
  if (!entry) throw new Error("Card is not owned: " + cardId);
  const quote = getTrainingQuote(entry);
  if (!quote.available) throw new Error("Card is already at maximum level");
  const next = spendCurrency(save, "gold", quote.goldCost);
  const trainedEntry = next.inventory.find((item) => item.cardId === cardId);
  const result = applyExperience(trainedEntry, quote.expGranted);
  return {
    save: normalizeSave(next), cardId, goldCost: quote.goldCost, expGranted: quote.expGranted,
    levelsGained: result.levelsGained, level: result.level, exp: result.exp
  };
}
