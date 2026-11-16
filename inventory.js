import { CARD_CATALOG, STARTER_CARD_IDS, DEFAULT_TEAM, buildTeam, getCardStats } from "./team.js";
import { createCampaignState, getCurrentStage, getCurrentEncounter } from "./stages.js";
import { ACTIVE_SKILLS, createSkillStates } from "./skills.js";

export const SAVE_KEY = "tower-of-saviors-web.save";
export const SAVE_VERSION = 3;
export const SUMMON_EPIC_PITY_LIMIT = 20;
export const RUNE_TYPES = Object.freeze(["fire", "water", "wood", "light", "dark", "heart"]);
export const EVOLUTION_MATERIALS = Object.freeze({
  awakeningShards: Object.freeze({ name: "覺醒碎片", emoji: "✧" }),
  prismCores: Object.freeze({ name: "稜鏡核心", emoji: "🔷" })
});
const MATERIAL_IDS = new Set(Object.keys(EVOLUTION_MATERIALS));
const CARD_IDS = new Set(CARD_CATALOG.map((card) => card.id));

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertSafeInteger(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(label + " must be an integer between " + min + " and " + max);
  }
}

export function createDefaultSave() {
  const team = buildTeam(DEFAULT_TEAM);
  return {
    version: SAVE_VERSION,
    inventory: CARD_CATALOG.filter((card) => STARTER_CARD_IDS.includes(card.id)).map((card) => ({ cardId: card.id, quantity: 1, level: 1, exp: 0, skillLevel: 1, evolutionLevel: 0 })),
    currencies: { gold: 1000, summonStones: 3 },
    materials: { awakeningShards: 0, prismCores: 0 },
    summonState: { totalSummons: 0, epicPity: 0 },
    teamIds: [...DEFAULT_TEAM],
    campaign: createCampaignState(),
    unlockedStageIndex: 0,
    hp: team.totalHp,
    score: 0,
    maxCombo: 0,
    board: null,
    skillStates: createSkillStates(DEFAULT_TEAM),
    shield: 0,
    pendingDamageMultiplier: 1,
    updatedAt: 0
  };
}

export function isCardOwned(save, cardId) {
  return Boolean(save?.inventory?.some((entry) => entry.cardId === cardId && entry.quantity > 0));
}

export function listOwnedCards(save) {
  const entries = new Map((save?.inventory ?? []).map((entry) => [entry.cardId, entry]));
  return CARD_CATALOG.filter((card) => (entries.get(card.id)?.quantity ?? 0) > 0)
    .map((card) => {
      const entry = entries.get(card.id);
      return { ...getCardStats(card.id, entry.level, entry.evolutionLevel ?? 0), quantity: entry.quantity, exp: entry.exp, skillLevel: entry.skillLevel ?? 1, evolutionLevel: entry.evolutionLevel ?? 0 };
    });
}

export function addCard(save, cardId, quantity = 1) {
  if (!CARD_IDS.has(cardId)) throw new RangeError("Unknown card id: " + String(cardId));
  assertSafeInteger(quantity, "quantity", 1, 999);
  const next = structuredClone(save);
  const existing = next.inventory.find((entry) => entry.cardId === cardId);
  if (existing) {
    assertSafeInteger(existing.quantity + quantity, "card quantity", 1, 999);
    existing.quantity += quantity;
  } else {
    next.inventory.push({ cardId, quantity, level: 1, exp: 0, skillLevel: 1, evolutionLevel: 0 });
  }
  return next;
}

export function addCurrency(save, currency, amount) {
  if (!["gold", "summonStones"].includes(currency)) throw new RangeError("Unknown currency: " + String(currency));
  assertSafeInteger(amount, "amount", 0, Number.MAX_SAFE_INTEGER);
  const next = structuredClone(save);
  const updated = next.currencies[currency] + amount;
  assertSafeInteger(updated, currency, 0, Number.MAX_SAFE_INTEGER);
  next.currencies[currency] = updated;
  return next;
}

export function spendCurrency(save, currency, amount) {
  if (!["gold", "summonStones"].includes(currency)) throw new RangeError("Unknown currency: " + String(currency));
  assertSafeInteger(amount, "amount", 1, Number.MAX_SAFE_INTEGER);
  const next = structuredClone(save);
  if (next.currencies[currency] < amount) throw new Error("Not enough " + currency);
  next.currencies[currency] -= amount;
  return next;
}

export function addMaterials(save, materialId, amount) {
  if (!MATERIAL_IDS.has(materialId)) throw new RangeError("Unknown evolution material: " + String(materialId));
  assertSafeInteger(amount, "amount", 1, 99999);
  const next = structuredClone(save);
  const updated = next.materials[materialId] + amount;
  assertSafeInteger(updated, materialId, 0, 99999);
  next.materials[materialId] = updated;
  return next;
}

export function spendMaterials(save, costs) {
  if (!isRecord(costs) || Object.keys(costs).length === 0) throw new TypeError("Material costs must be a non-empty object");
  const next = structuredClone(save);
  for (const [materialId, amount] of Object.entries(costs)) {
    if (!MATERIAL_IDS.has(materialId)) throw new RangeError("Unknown evolution material: " + materialId);
    assertSafeInteger(amount, materialId, 1, 99999);
    if (next.materials[materialId] < amount) throw new Error("Not enough evolution materials");
  }
  for (const [materialId, amount] of Object.entries(costs)) next.materials[materialId] -= amount;
  return next;
}

export function normalizeSave(input) {
  if (!isRecord(input) || ![1, 2, SAVE_VERSION].includes(input.version)) {
    throw new RangeError("Unsupported or invalid save version");
  }
  if (!Array.isArray(input.inventory) || input.inventory.length > CARD_CATALOG.length) {
    throw new TypeError("inventory must be a card list");
  }
  const seenCards = new Set();
  const inventory = input.inventory.map((entry) => {
    if (!isRecord(entry) || !CARD_IDS.has(entry.cardId)) throw new RangeError("Inventory contains an unknown card");
    if (seenCards.has(entry.cardId)) throw new RangeError("Inventory card entries must be unique");
    seenCards.add(entry.cardId);
    assertSafeInteger(entry.quantity, "card quantity", 1, 999);
    assertSafeInteger(entry.level, "card level", 1, 99);
    assertSafeInteger(entry.exp, "card experience", 0, 1000000);
    const skillLevel = entry.skillLevel ?? 1;
    const evolutionLevel = entry.evolutionLevel ?? 0;
    assertSafeInteger(skillLevel, "skill level", 1, 5);
    assertSafeInteger(evolutionLevel, "evolution level", 0, 2);
    getCardStats(entry.cardId, entry.level, evolutionLevel);
    const requiredExp = 100 + 25 * (entry.level - 1);
    if (entry.level === 99 ? entry.exp !== 0 : entry.exp >= requiredExp) {
      throw new RangeError("Card experience must be below the next-level threshold");
    }
    return { cardId: entry.cardId, quantity: entry.quantity, level: entry.level, exp: entry.exp, skillLevel, evolutionLevel };
  });

  if (!Array.isArray(input.teamIds) || input.teamIds.length !== 5) {
    throw new RangeError("Saved team must contain exactly five cards");
  }
  const teamIds = [...input.teamIds];
  if (new Set(teamIds).size !== teamIds.length) throw new RangeError("Saved team cannot contain duplicate cards");
  const owned = new Set(inventory.filter((entry) => entry.quantity > 0).map((entry) => entry.cardId));
  if (teamIds.some((cardId) => !owned.has(cardId))) throw new RangeError("Saved team contains a card not owned in inventory");
  const levels = Object.fromEntries(inventory.map((entry) => [entry.cardId, entry.level]));
  const evolutionLevels = Object.fromEntries(inventory.map((entry) => [entry.cardId, entry.evolutionLevel]));
  const team = buildTeam(teamIds, { levels, evolutionLevels });

  if (!isRecord(input.currencies)) throw new TypeError("currencies must be an object");
  assertSafeInteger(input.currencies.gold, "gold");
  assertSafeInteger(input.currencies.summonStones, "summonStones");

  const materialInput = input.materials ?? {};
  if (!isRecord(materialInput) || Object.keys(materialInput).some((key) => !MATERIAL_IDS.has(key))) {
    throw new TypeError("materials must contain only known evolution materials");
  }
  const materials = {
    awakeningShards: materialInput.awakeningShards ?? 0,
    prismCores: materialInput.prismCores ?? 0
  };
  for (const [materialId, amount] of Object.entries(materials)) assertSafeInteger(amount, materialId, 0, 99999);

  const summonInput = input.summonState ?? {};
  if (!isRecord(summonInput)) throw new TypeError("summonState must be an object");
  const summonState = {
    totalSummons: summonInput.totalSummons ?? 0,
    epicPity: summonInput.epicPity ?? 0
  };
  assertSafeInteger(summonState.totalSummons, "totalSummons");
  assertSafeInteger(summonState.epicPity, "epicPity", 0, SUMMON_EPIC_PITY_LIMIT - 1);

  if (!isRecord(input.campaign)) throw new TypeError("campaign must be an object");
  const campaign = {
    stageIndex: input.campaign.stageIndex,
    waveIndex: input.campaign.waveIndex,
    turn: input.campaign.turn,
    enemyHp: input.campaign.enemyHp,
    completed: input.campaign.completed === true,
    campaignComplete: input.campaign.campaignComplete === true
  };
  getCurrentStage(campaign);
  getCurrentEncounter(campaign);
  assertSafeInteger(input.unlockedStageIndex, "unlockedStageIndex", campaign.stageIndex, 2);

  if (!Number.isFinite(input.hp) || input.hp < 0 || input.hp > team.totalHp) {
    throw new RangeError("Saved HP must be within the current team's HP limit");
  }
  assertSafeInteger(input.score, "score");
  assertSafeInteger(input.maxCombo, "maxCombo", 0, 12);
  if (input.board !== null && (!Array.isArray(input.board) || input.board.length !== 30 || input.board.some((rune) => !RUNE_TYPES.includes(rune)))) {
    throw new RangeError("Saved board must contain exactly 30 valid runes");
  }
  if (!Number.isFinite(input.shield) || input.shield < 0 || input.shield > 1000000) {
    throw new RangeError("Saved shield is invalid");
  }
  if (!Number.isFinite(input.pendingDamageMultiplier) || input.pendingDamageMultiplier < 1 || input.pendingDamageMultiplier > 10) {
    throw new RangeError("Saved damage multiplier is invalid");
  }

  const skillStates = createSkillStates(teamIds, input.skillStates ?? {});
  for (const [cardId, state] of Object.entries(skillStates)) {
    if (state.remaining > ACTIVE_SKILLS[cardId].cooldown) {
      throw new RangeError("Saved cooldown exceeds the skill's configured cooldown");
    }
  }
  assertSafeInteger(input.updatedAt ?? 0, "updatedAt");

  return {
    version: SAVE_VERSION,
    inventory,
    currencies: { gold: input.currencies.gold, summonStones: input.currencies.summonStones },
    materials,
    summonState,
    teamIds,
    campaign,
    unlockedStageIndex: input.unlockedStageIndex,
    hp: input.hp,
    score: input.score,
    maxCombo: input.maxCombo,
    board: input.board === null ? null : [...input.board],
    skillStates,
    shield: input.shield,
    pendingDamageMultiplier: input.pendingDamageMultiplier,
    updatedAt: input.updatedAt ?? 0
  };
}

export function loadSave(storage) {
  const fallback = createDefaultSave();
  if (!storage || typeof storage.getItem !== "function") return { save: fallback, status: "unavailable" };
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { save: fallback, status: "new" };
    return { save: normalizeSave(JSON.parse(raw)), status: "loaded" };
  } catch (error) {
    return { save: fallback, status: "invalid", error };
  }
}

export function saveGame(input, storage) {
  if (!storage || typeof storage.setItem !== "function") return { ok: false, status: "unavailable" };
  try {
    const save = normalizeSave(input);
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return { ok: true, status: "saved" };
  } catch (error) {
    return { ok: false, status: "failed", error };
  }
}
