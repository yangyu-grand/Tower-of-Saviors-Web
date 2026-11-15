import { CARD_CATALOG } from "./team.js";
import { addCard, isCardOwned, normalizeSave, spendCurrency, SUMMON_EPIC_PITY_LIMIT } from "./inventory.js";

export const SUMMON_COSTS = Object.freeze({ single: 1, ten: 10 });
export const SUMMON_RATES = Object.freeze({ common: 0.70, rare: 0.25, epic: 0.05 });

function sample(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("random must return a finite value in [0, 1)");
  }
  return value;
}

function chooseRarity(random, epicPity, minimumRarity = 3) {
  if (epicPity >= SUMMON_EPIC_PITY_LIMIT - 1) return 5;
  const roll = sample(random);
  if (roll < SUMMON_RATES.epic) return 5;
  if (roll < SUMMON_RATES.epic + SUMMON_RATES.rare) return 4;
  return minimumRarity >= 4 ? minimumRarity : 3;
}

function chooseCard(rarity, random) {
  const pool = CARD_CATALOG.filter((card) => card.rarity === rarity);
  if (pool.length === 0) throw new Error("No cards configured for rarity " + rarity);
  return pool[Math.floor(sample(random) * pool.length)];
}

export function summonCards(inputSave, count = 1, random = Math.random) {
  if (![1, 10].includes(count)) throw new RangeError("Summon count must be 1 or 10");
  if (typeof random !== "function") throw new TypeError("random must be a function");
  const save = normalizeSave(inputSave);
  const cost = count === 1 ? SUMMON_COSTS.single : SUMMON_COSTS.ten;
  let next = spendCurrency(save, "summonStones", cost);
  let totalSummons = save.summonState.totalSummons;
  let epicPity = save.summonState.epicPity;
  const results = [];

  for (let index = 0; index < count; index += 1) {
    const needsTenPullGuarantee = count === 10 && index === 9 &&
      !results.some((result) => result.card.rarity >= 4);
    const rarity = chooseRarity(random, epicPity, needsTenPullGuarantee ? 4 : 3);
    const card = chooseCard(rarity, random);
    const duplicate = isCardOwned(next, card.id);
    next = addCard(next, card.id, 1);
    totalSummons += 1;
    epicPity = rarity >= 5 ? 0 : epicPity + 1;
    results.push({ card, duplicate });
  }

  next.summonState = { totalSummons, epicPity };
  return {
    save: next,
    results,
    cost,
    guaranteeTriggered: count === 10 &&
      results.slice(0, 9).every((result) => result.card.rarity < 4) &&
      results[9].card.rarity >= 4
  };
}
