import test from "node:test";
import assert from "node:assert/strict";
import { ELEMENTS, calculateCombatResult, getElementalMatchup } from "../combat.js";

test("defines a matchup for all six enemy elements", () => {
  for (const enemyElement of ELEMENTS) for (const attackerElement of ELEMENTS) {
    const matchup = getElementalMatchup(attackerElement, enemyElement);
    assert.ok([0, 0.5, 1, 1.5].includes(matchup.multiplier));
  }
});
test("fire has advantage over wood", () => assert.deepEqual(getElementalMatchup("fire", "wood"), { multiplier: 1.5, relation: "advantage" }));
test("fire is disadvantaged against water", () => assert.deepEqual(getElementalMatchup("fire", "water"), { multiplier: 0.5, relation: "disadvantage" }));
test("unrelated attack elements are neutral", () => assert.deepEqual(getElementalMatchup("fire", "dark"), { multiplier: 1, relation: "neutral" }));
test("light and dark counter each other", () => {
  assert.equal(getElementalMatchup("light", "dark").multiplier, 1.5);
  assert.equal(getElementalMatchup("dark", "light").multiplier, 1.5);
});
test("heart-element enemies are neutral to every attack element", () => {
  for (const element of ["fire", "water", "wood", "light", "dark"]) assert.equal(getElementalMatchup(element, "heart").multiplier, 1);
});
test("damage includes rune count, combo multiplier and elemental multiplier", () => {
  const result = calculateCombatResult({ counts: { fire: 3 }, combo: 2, enemyElement: "wood" });
  assert.equal(result.comboMultiplier, 1.25);
  assert.equal(result.damage, 62);
  assert.deepEqual(result.breakdown[0], {
    element: "fire", count: 3, baseDamage: 33, runeCountMultiplier: 1, comboMultiplier: 1.25,
    multiplier: 1.5, relation: "advantage", damage: 62
  });
});
test("disadvantage and neutral damage are calculated independently", () => {
  const result = calculateCombatResult({ counts: { fire: 2, dark: 1 }, combo: 1, enemyElement: "water" });
  assert.equal(result.damage, 22);
  assert.equal(result.breakdown[0].damage, 11);
  assert.equal(result.breakdown[1].damage, 11);
});
test("heart-only matches heal and deal no damage", () => {
  const result = calculateCombatResult({ counts: { heart: 2 }, combo: 3, enemyElement: "fire" });
  assert.equal(result.damage, 0);
  assert.equal(result.healing, 14);
  assert.deepEqual(result.breakdown, []);
});
test("rejects invalid combo, element and rune counts", () => {
  assert.throws(() => calculateCombatResult({ counts: {}, combo: 0, enemyElement: "fire" }), RangeError);
  assert.throws(() => calculateCombatResult({ counts: {}, combo: 1, enemyElement: "ice" }), RangeError);
  assert.throws(() => calculateCombatResult({ counts: { fire: -1 }, combo: 1, enemyElement: "fire" }), RangeError);
});

test("team attack stats drive damage with combo and elemental modifiers", () => {
  const result = calculateCombatResult({
    counts: { fire: 3 },
    combo: 2,
    enemyElement: "wood",
    teamAttackByElement: { fire: 180 }
  });
  assert.equal(result.damage, 338);
  assert.equal(result.breakdown[0].baseDamage, 180);
  assert.equal(result.breakdown[0].runeCountMultiplier, 1);
});

test("matching more than three runes adds a small rune-count bonus", () => {
  const result = calculateCombatResult({
    counts: { fire: 4 },
    combo: 1,
    enemyElement: "water",
    teamAttackByElement: { fire: 100 }
  });
  assert.equal(result.damage, 55);
  assert.equal(result.breakdown[0].runeCountMultiplier, 1.1);
});

test("rejects invalid team attack data", () => {
  assert.throws(() => calculateCombatResult({
    counts: { fire: 3 }, combo: 1, enemyElement: "wood",
    teamAttackByElement: { ice: 100 }
  }), RangeError);
  assert.throws(() => calculateCombatResult({
    counts: { fire: 3 }, combo: 1, enemyElement: "wood",
    teamAttackByElement: { fire: -1 }
  }), RangeError);
});


test("leader combo bonus increases each additional combo step", () => {
  const result = calculateCombatResult({ counts: { fire: 3 }, combo: 3, enemyElement: "wood", comboStepBonus: 0.05 });
  assert.equal(result.comboMultiplier, 1.6);
  assert.equal(result.damage, 79);
});

test("leader healing multiplier improves heart rune recovery with integer HP", () => {
  const result = calculateCombatResult({ counts: { heart: 2 }, combo: 1, enemyElement: "fire", healingMultiplier: 1.35 });
  assert.equal(result.healing, 19);
  assert.equal(result.damage, 0);
});

test("rejects out-of-range leader combo and healing modifiers", () => {
  assert.throws(() => calculateCombatResult({ counts: {}, combo: 1, enemyElement: "fire", comboStepBonus: -0.01 }), RangeError);
  assert.throws(() => calculateCombatResult({ counts: {}, combo: 1, enemyElement: "fire", comboStepBonus: 0.3 }), RangeError);
  assert.throws(() => calculateCombatResult({ counts: {}, combo: 1, enemyElement: "fire", healingMultiplier: 0.1 }), RangeError);
  assert.throws(() => calculateCombatResult({ counts: {}, combo: 1, enemyElement: "fire", healingMultiplier: 4 }), RangeError);
});
