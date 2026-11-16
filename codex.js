import { CARD_CATALOG, getCardStats, getMaxEvolutionLevel } from "./team.js";
import { getActiveSkill } from "./skills.js";

export const CODEX_ELEMENTS = Object.freeze(["fire", "water", "wood", "light", "dark", "heart"]);
const VALID_RARITIES = Object.freeze([3, 4, 5, 6]);

function normalizeFilters(filters) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) throw new TypeError("filters must be an object");
  const query = filters.query ?? "";
  const element = filters.element ?? "all";
  const rarity = filters.rarity ?? "all";
  const ownership = filters.ownership ?? "all";
  const evolution = filters.evolution ?? "all";
  if (typeof query !== "string") throw new TypeError("query must be a string");
  if (element !== "all" && !CODEX_ELEMENTS.includes(element)) throw new RangeError("Unknown codex element: " + String(element));
  if (rarity !== "all" && !VALID_RARITIES.includes(Number(rarity))) throw new RangeError("Rarity filter must be all or an integer from 3 to 6");
  if (!["all", "owned", "unowned"].includes(ownership)) throw new RangeError("Unknown ownership filter: " + String(ownership));
  if (!["all", "base", "evolved", "maxed"].includes(evolution)) throw new RangeError("Unknown evolution filter: " + String(evolution));
  return { query: query.trim().toLocaleLowerCase(), element, rarity: rarity === "all" ? "all" : Number(rarity), ownership, evolution };
}

export function buildCardCodex(cards = CARD_CATALOG, inventory = []) {
  if (!Array.isArray(cards)) throw new TypeError("cards must be an array");
  if (!Array.isArray(inventory)) throw new TypeError("inventory must be an array");
  const inventoryById = new Map();
  for (const entry of inventory) {
    if (!entry || typeof entry.cardId !== "string" || !Number.isInteger(entry.quantity) || entry.quantity < 0) {
      throw new TypeError("inventory entries must contain a cardId and non-negative integer quantity");
    }
    if (inventoryById.has(entry.cardId)) throw new RangeError("Duplicate inventory entry: " + entry.cardId);
    inventoryById.set(entry.cardId, entry);
  }
  return cards.map((baseCard) => {
    if (!baseCard || typeof baseCard.id !== "string") throw new TypeError("catalog cards must contain an id");
    const stored = inventoryById.get(baseCard.id);
    const owned = Boolean(stored && stored.quantity > 0);
    const level = owned ? (stored.level ?? 1) : 1;
    const skillLevel = owned ? (stored.skillLevel ?? 1) : 1;
    const evolutionLevel = owned ? (stored.evolutionLevel ?? 0) : 0;
    const card = getCardStats(baseCard.id, level, evolutionLevel);
    const maxEvolutionLevel = getMaxEvolutionLevel(baseCard.id);
    const activeSkill = getActiveSkill(baseCard.id, skillLevel);
    const leaderSkill = baseCard.leaderSkill ?? null;
    const searchText = [baseCard.id, baseCard.name, card.name, baseCard.element, activeSkill.name,
      activeSkill.description, leaderSkill?.name, leaderSkill?.description].filter(Boolean).join(" ").toLocaleLowerCase();
    return { baseCard, card, owned, quantity: owned ? stored.quantity : 0, level, skillLevel,
      evolutionLevel, maxEvolutionLevel, activeSkill, leaderSkill, searchText };
  });
}

export function filterCardCatalog(cards = CARD_CATALOG, inventory = [], filters = {}) {
  const selected = normalizeFilters(filters);
  return buildCardCodex(cards, inventory).filter((entry) => {
    if (selected.query && !entry.searchText.includes(selected.query)) return false;
    if (selected.element !== "all" && entry.baseCard.element !== selected.element) return false;
    if (selected.rarity !== "all" && entry.card.rarity !== selected.rarity) return false;
    if (selected.ownership === "owned" && !entry.owned) return false;
    if (selected.ownership === "unowned" && entry.owned) return false;
    if (selected.evolution === "base" && entry.evolutionLevel !== 0) return false;
    if (selected.evolution === "evolved" && (!entry.owned || entry.evolutionLevel === 0)) return false;
    if (selected.evolution === "maxed" && (!entry.owned || entry.evolutionLevel < entry.maxEvolutionLevel)) return false;
    return true;
  });
}
