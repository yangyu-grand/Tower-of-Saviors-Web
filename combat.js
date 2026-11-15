export const ELEMENTS = Object.freeze(["fire", "water", "wood", "light", "dark", "heart"]);

const ATTACK_ELEMENTS = Object.freeze(["fire", "water", "wood", "light", "dark"]);
const ADVANTAGE = Object.freeze({
  fire: "wood",
  wood: "water",
  water: "fire",
  light: "dark",
  dark: "light"
});

export const BASE_DAMAGE_PER_RUNE = 11;
export const HEAL_PER_HEART_RUNE = 7;
export const COMBO_STEP = 0.25;

function assertElement(element, label) {
  if (!ELEMENTS.includes(element)) {
    throw new RangeError(`Unknown ${label}: ${String(element)}`);
  }
}

/**
 * Advantage: 1.5x; disadvantage: 0.5x; neutral: 1x.
 * Heart is a support element and is never an attack element.
 */
export function getElementalMatchup(attackerElement, enemyElement) {
  assertElement(attackerElement, "attacker element");
  assertElement(enemyElement, "enemy element");

  if (attackerElement === "heart") {
    return { multiplier: 0, relation: "healing" };
  }
  if (enemyElement === "heart") {
    return { multiplier: 1, relation: "neutral" };
  }
  if (ADVANTAGE[attackerElement] === enemyElement) {
    return { multiplier: 1.5, relation: "advantage" };
  }
  if (ADVANTAGE[enemyElement] === attackerElement) {
    return { multiplier: 0.5, relation: "disadvantage" };
  }
  return { multiplier: 1, relation: "neutral" };
}

/**
 * Pure combat calculation. Counts are the number of runes removed in one
 * cascade step; combo is the 1-based cascade index for the current turn.
 */
export function calculateCombatResult({ counts = {}, combo = 1, enemyElement }) {
  assertElement(enemyElement, "enemy element");
  if (!Number.isInteger(combo) || combo < 1) {
    throw new RangeError("combo must be a positive integer");
  }

  for (const [element, count] of Object.entries(counts)) {
    assertElement(element, "rune element");
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(`count for ${element} must be a non-negative integer`);
    }
  }

  const comboMultiplier = 1 + (combo - 1) * COMBO_STEP;
  const breakdown = [];
  let damage = 0;

  for (const element of ATTACK_ELEMENTS) {
    const count = counts[element] ?? 0;
    if (count === 0) continue;

    const matchup = getElementalMatchup(element, enemyElement);
    const elementDamage = Math.round(
      count * BASE_DAMAGE_PER_RUNE * comboMultiplier * matchup.multiplier
    );
    damage += elementDamage;
    breakdown.push({
      element,
      count,
      baseDamage: count * BASE_DAMAGE_PER_RUNE,
      comboMultiplier,
      multiplier: matchup.multiplier,
      relation: matchup.relation,
      damage: elementDamage
    });
  }

  const heartCount = counts.heart ?? 0;
  return {
    damage,
    healing: heartCount * HEAL_PER_HEART_RUNE,
    comboMultiplier,
    breakdown
  };
}
