import { ACTIVE_SKILLS, MAX_SKILL_LEVEL } from "./skills.js";
import { normalizeSave, spendCurrency } from "./inventory.js";

export const SKILL_ENHANCEMENT_GOLD_PER_LEVEL = 250;
export const SKILL_ENHANCEMENT_DUPLICATE_COST = 1;

export function getSkillEnhancementQuote(entry) {
  if (!entry || !ACTIVE_SKILLS[entry.cardId]) {
    throw new TypeError("A card with an active skill is required");
  }
  const skillLevel = entry.skillLevel ?? 1;
  if (!Number.isInteger(skillLevel) || skillLevel < 1 || skillLevel > MAX_SKILL_LEVEL) {
    throw new RangeError("Invalid skill level");
  }
  if (!Number.isSafeInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 999) {
    throw new RangeError("Invalid owned card quantity");
  }

  const maxed = skillLevel >= MAX_SKILL_LEVEL;
  const duplicateCost = maxed ? 0 : SKILL_ENHANCEMENT_DUPLICATE_COST;
  const goldCost = maxed ? 0 : skillLevel * SKILL_ENHANCEMENT_GOLD_PER_LEVEL;
  return {
    skillLevel,
    nextSkillLevel: maxed ? skillLevel : skillLevel + 1,
    duplicateCost,
    goldCost,
    available: !maxed && entry.quantity > duplicateCost,
    maxed
  };
}

export function enhanceCardSkill(inputSave, cardId) {
  const save = normalizeSave(inputSave);
  const entry = save.inventory.find((item) => item.cardId === cardId && item.quantity > 0);
  if (!entry) throw new Error("Card is not owned: " + String(cardId));
  if (!ACTIVE_SKILLS[cardId]) throw new RangeError("Card has no active skill: " + String(cardId));

  const quote = getSkillEnhancementQuote(entry);
  if (quote.maxed) throw new Error("Skill is already at maximum level");
  if (!quote.available) throw new Error("A duplicate copy is required for skill enhancement");

  const next = spendCurrency(save, "gold", quote.goldCost);
  const upgraded = next.inventory.find((item) => item.cardId === cardId);
  upgraded.quantity -= quote.duplicateCost;
  upgraded.skillLevel = quote.nextSkillLevel;

  return {
    save: normalizeSave(next),
    cardId,
    previousSkillLevel: quote.skillLevel,
    skillLevel: quote.nextSkillLevel,
    duplicateConsumed: quote.duplicateCost,
    goldCost: quote.goldCost
  };
}
