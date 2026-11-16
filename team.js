export const TEAM_SIZE = 5;
export const DEFAULT_COST_LIMIT = 30;
export const CARD_STAT_GROWTH_PER_LEVEL = 0.025;
export const MAX_CARD_EVOLUTION_LEVEL = 2;
const EVOLUTION_SUFFIXES = Object.freeze(["覺醒", "神化"]);

const ATTACK_ELEMENTS = Object.freeze(["fire", "water", "wood", "light", "dark"]);

function freezeCard(card) {
  if (card.leaderSkill) {
    Object.freeze(card.leaderSkill.attackMultipliers);
    Object.freeze(card.leaderSkill);
  }
  return Object.freeze(card);
}

export const CARD_CATALOG = Object.freeze([
  freezeCard({
    id: "ember_scout", name: "赤焰斥候", emoji: "🔥", element: "fire",
    hp: 950, atk: 180, cost: 6, rarity: 3,
    leaderSkill: {
      name: "赤焰先鋒",
      description: "隊伍火屬性攻擊提升 20%，隊伍生命提升 5%。",
      attackMultipliers: { fire: 1.2 }, hpMultiplier: 1.05
    }
  }),
  freezeCard({ id: "tide_monk", name: "潮紋僧侶", emoji: "💧", element: "water", hp: 1120, atk: 160, cost: 6, rarity: 3 }),
  freezeCard({ id: "moss_guard", name: "苔甲守衛", emoji: "🌿", element: "wood", hp: 1450, atk: 135, cost: 5, rarity: 3 }),
  freezeCard({ id: "dawn_archer", name: "晨星弓手", emoji: "✨", element: "light", hp: 900, atk: 190, cost: 6, rarity: 3 }),
  freezeCard({ id: "heart_priest", name: "心燈祭司", emoji: "💗", element: "heart", hp: 1250, atk: 120, cost: 5, rarity: 3 }),
  freezeCard({ id: "dusk_mage", name: "暮影術士", emoji: "🌙", element: "dark", hp: 880, atk: 205, cost: 6, rarity: 3 }),
  freezeCard({ id: "cinder_knight", name: "燼火騎士", emoji: "🛡️", element: "fire", hp: 1200, atk: 165, cost: 6, rarity: 3 }),
  freezeCard({ id: "river_oracle", name: "河灣預言者", emoji: "🔮", element: "water", hp: 1000, atk: 175, cost: 5, rarity: 3 }),
  freezeCard({ id: "thorn_ranger", name: "荊棘遊俠", emoji: "🏹", element: "wood", hp: 950, atk: 180, cost: 5, rarity: 3 }),
  freezeCard({ id: "moon_sentinel", name: "月影守望者", emoji: "🌘", element: "dark", hp: 1300, atk: 155, cost: 6, rarity: 3 }),
  freezeCard({
    id: "azure_minstrel", name: "蒼潮樂師", emoji: "🎼", element: "water",
    hp: 1080, atk: 185, cost: 7, rarity: 4
  }),
  freezeCard({
    id: "verdant_alchemist", name: "翠森鍊金師", emoji: "🧪", element: "wood",
    hp: 1000, atk: 200, cost: 7, rarity: 4
  }),
  freezeCard({
    id: "astral_scribe", name: "星界書記官", emoji: "📜", element: "light",
    hp: 980, atk: 215, cost: 7, rarity: 4
  }),
  freezeCard({
    id: "abyss_weaver", name: "深淵織夢者", emoji: "🕷️", element: "dark",
    hp: 920, atk: 240, cost: 8, rarity: 5,
    leaderSkill: {
      name: "深淵共鳴",
      description: "隊伍暗屬性攻擊提升 25%，隊伍生命提升 4%。",
      attackMultipliers: { dark: 1.25 }, hpMultiplier: 1.04
    }
  }),
  freezeCard({
    id: "solar_archon", name: "曜日裁決者", emoji: "☀️", element: "fire",
    hp: 1250, atk: 230, cost: 8, rarity: 5,
    leaderSkill: {
      name: "日輪裁決",
      description: "隊伍火屬性攻擊提升 25%，隊伍生命提升 3%。",
      attackMultipliers: { fire: 1.25 }, hpMultiplier: 1.03
    }
  })
]);

export const STARTER_CARD_IDS = Object.freeze([
  "ember_scout", "tide_monk", "moss_guard", "dawn_archer", "heart_priest",
  "dusk_mage", "cinder_knight", "river_oracle", "thorn_ranger", "moon_sentinel"
]);

export const DEFAULT_TEAM = Object.freeze([
  "ember_scout", "tide_monk", "moss_guard", "dawn_archer", "heart_priest"
]);

const CARD_BY_ID = new Map(CARD_CATALOG.map((card) => [card.id, card]));

export function getCard(cardId) {
  const card = CARD_BY_ID.get(cardId);
  if (!card) throw new RangeError("Unknown card id: " + String(cardId));
  return card;
}

export function getMaxEvolutionLevel(cardId) {
  const rarity = getCard(cardId).rarity;
  return rarity === 3 ? 2 : 1;
}

export function getCardStats(cardId, level = 1, evolutionLevel = 0) {
  const card = getCard(cardId);
  if (!Number.isInteger(level) || level < 1 || level > 99) {
    throw new RangeError("Card level must be an integer between 1 and 99");
  }
  if (!Number.isInteger(evolutionLevel) || evolutionLevel < 0 || evolutionLevel > getMaxEvolutionLevel(cardId)) {
    throw new RangeError("Invalid evolution level for " + cardId);
  }
  const levelMultiplier = 1 + CARD_STAT_GROWTH_PER_LEVEL * (level - 1);
  const evolutionMultiplier = 1 + 0.25 * evolutionLevel;
  const suffix = evolutionLevel === 0 ? "" : "・" + EVOLUTION_SUFFIXES[evolutionLevel - 1];
  const evolvedEmoji = evolutionLevel === 1 ? "✨" : evolutionLevel === 2 ? "🌟" : "";
  return {
    ...card,
    name: card.name + suffix,
    emoji: card.emoji + evolvedEmoji,
    rarity: card.rarity + evolutionLevel,
    level,
    evolutionLevel,
    hp: Math.round(card.hp * levelMultiplier * evolutionMultiplier),
    atk: Math.round(card.atk * levelMultiplier * evolutionMultiplier)
  };
}

export function buildTeam(cardIds, options = {}) {
  const costLimit = options.costLimit ?? DEFAULT_COST_LIMIT;
  if (!Number.isInteger(costLimit) || costLimit < 0) {
    throw new RangeError("costLimit must be a non-negative integer");
  }
  if (!Array.isArray(cardIds) || cardIds.length !== TEAM_SIZE) {
    throw new RangeError("A team must contain exactly " + TEAM_SIZE + " cards");
  }

  const uniqueIds = new Set(cardIds);
  if (uniqueIds.size !== cardIds.length) {
    throw new RangeError("A team cannot contain duplicate cards");
  }

  const levels = options.levels ?? {};
  const evolutionLevels = options.evolutionLevels ?? {};
  if (!levels || typeof levels !== "object" || Array.isArray(levels)) throw new TypeError("levels must be a card-id-to-level object");
  if (!evolutionLevels || typeof evolutionLevels !== "object" || Array.isArray(evolutionLevels)) throw new TypeError("evolutionLevels must be a card-id-to-level object");
  const cards = cardIds.map((cardId) => getCardStats(cardId, levels[cardId] ?? 1, evolutionLevels[cardId] ?? 0));
  const totalCost = cards.reduce((sum, card) => sum + card.cost, 0);
  if (totalCost > costLimit) {
    throw new RangeError("Team cost " + totalCost + " exceeds limit " + costLimit);
  }

  const baseHp = cards.reduce((sum, card) => sum + card.hp, 0);
  const attackByElement = Object.fromEntries(ATTACK_ELEMENTS.map((element) => [element, 0]));
  for (const card of cards) {
    if (ATTACK_ELEMENTS.includes(card.element)) {
      attackByElement[card.element] += card.atk;
    }
  }

  const leaderSkill = cards[0].leaderSkill ?? null;
  if (leaderSkill) {
    for (const [element, multiplier] of Object.entries(leaderSkill.attackMultipliers ?? {})) {
      if (!ATTACK_ELEMENTS.includes(element) || !Number.isFinite(multiplier) || multiplier < 0) {
        throw new RangeError("Invalid leader skill attack multiplier");
      }
      attackByElement[element] = Math.round(attackByElement[element] * multiplier);
    }
  }

  return {
    cardIds: [...cardIds],
    cards,
    totalCost,
    costLimit,
    baseHp,
    totalHp: Math.round(baseHp * (leaderSkill?.hpMultiplier ?? 1)),
    attackByElement,
    leaderSkill
  };
}
