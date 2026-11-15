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
  if (!ELEMENTS.includes(element)) throw new RangeError(`Unknown ${label}: ${String(element)}`);
}

export function getElementalMatchup(attackerElement, enemyElement) {
  assertElement(attackerElement, "attacker element");
  assertElement(enemyElement, "enemy element");
  if (attackerElement === "heart") return { multiplier: 0, relation: "healing" };
  if (enemyElement === "heart") return { multiplier: 1, relation: "neutral" };
  if (ADVANTAGE[attackerElement] === enemyElement) return { multiplier: 1.5, relation: "advantage" };
  if (ADVANTAGE[enemyElement] === attackerElement) return { multiplier: 0.5, relation: "disadvantage" };
  return { multiplier: 1, relation: "neutral" };
}

export function calculateCombatResult({ counts = {}, combo = 1, enemyElement, teamAttackByElement = null, skillMultiplier = 1 }) {
  assertElement(enemyElement, "enemy element");
  if (!Number.isInteger(combo) || combo < 1) throw new RangeError("combo must be a positive integer");
  if (typeof skillMultiplier !== "number" || !Number.isFinite(skillMultiplier) || skillMultiplier < 1 || skillMultiplier > 10) {
    throw new RangeError("skillMultiplier must be between 1 and 10");
  }
  for (const [element, count] of Object.entries(counts)) {
    assertElement(element, "rune element");
    if (!Number.isInteger(count) || count < 0) throw new RangeError(`count for ${element} must be a non-negative integer`);
  }

  if (teamAttackByElement !== null) {
    if (typeof teamAttackByElement !== "object" || Array.isArray(teamAttackByElement)) {
      throw new TypeError("teamAttackByElement must be an object");
    }
    for (const [element, attack] of Object.entries(teamAttackByElement)) {
      if (!ATTACK_ELEMENTS.includes(element)) throw new RangeError("Unknown team attack element: " + element);
      if (typeof attack !== "number" || !Number.isFinite(attack) || attack < 0) {
        throw new RangeError("Team attack for " + element + " must be a non-negative finite number");
      }
    }
  }

  const comboMultiplier = 1 + (combo - 1) * COMBO_STEP;
  const breakdown = [];
  let damage = 0;
  for (const element of ATTACK_ELEMENTS) {
    const count = counts[element] ?? 0;
    if (count === 0) continue;
    const matchup = getElementalMatchup(element, enemyElement);
    const baseDamage = teamAttackByElement === null
      ? count * BASE_DAMAGE_PER_RUNE
      : (teamAttackByElement[element] ?? 0);
    const runeCountMultiplier = teamAttackByElement === null
      ? 1
      : 1 + Math.max(0, count - 3) * 0.1;
    const elementDamage = Math.round(
      baseDamage * runeCountMultiplier * comboMultiplier * matchup.multiplier * skillMultiplier
    );
    damage += elementDamage;
    breakdown.push({
      element, count, baseDamage, runeCountMultiplier,
      comboMultiplier, multiplier: matchup.multiplier,
      relation: matchup.relation, damage: elementDamage
    });
  }
  const heartCount = counts.heart ?? 0;
  return { damage, healing: heartCount * HEAL_PER_HEART_RUNE, comboMultiplier, skillMultiplier, breakdown };
}
