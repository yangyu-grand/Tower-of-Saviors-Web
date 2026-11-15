import test from "node:test";
import assert from "node:assert/strict";
import {
  ELEMENTS,
  calculateCombatResult,
  getElementalMatchup
} from "../combat.js";

test("defines a matchup for all six enemy elements", () => {
  for (const enemyElement of ELEMENTS) {
    for (const attackerElement of ELEMENTS) {
      const matchup = getElementalMatchup(attackerElement, enemyElement);
      assert.ok([0, 0.5, 1, 1.5].includes(matchup.multiplier));
    }
  }
});

test("fire has advantage over wood", () => {
  assert.deepEqual(getElementalMatchup("fire", "wood"), {
    multiplier: 1.5,
    relation: "advantage"
  });
});

test("fire is disadvantaged against water", () => {
  assert.deepEqual(getElementalMatchup("fire", "water"), {
    multiplier: 0.5,
    relation: "disadvantage"
  });
});

test("unrelated attack elements are neutral", () => {
  assert.deepEqual(getElementalMatchup("fire", "dark"), {
    multiplier: 1,
    relation: "neutral"
  });
});

test("light and dark counter each other", () => {
  assert.equal(getElementalMatchup("light", "dark").multiplier, 1.5);
  assert.equal(getElementalMatchup("dark", "light").multiplier, 1.5);
});

test("heart-element enemies are neutral to every attack element", () => {
  for (const element of ["fire", "water", "wood", "light", "dark"]) {
    assert.equal(getElementalMatchup(element, "heart").multiplier, 1);
  }
});

test("damage includes rune count, combo multiplier and elemental multiplier", () => {
  const result = calculateCombatResult({
    counts: { fire: 3 },
    combo: 2,
    enemyElement: "wood"
  });
  assert.equal(result.comboMultiplier, 1.25);
  assert.equal(result.damage, 62);
  assert.deepEqual(result.breakdown[0], {
    element: "fire",
    count: 3,
    baseDamage: 33,
    comboMultiplier: 1.25,
    multiplier: 1.5,
    relation: "advantage",
    damage: 62
  });
});

test("disadvantage and neutral damage are calculated independently", () => {
  const result = calculateCombatResult({
    counts: { fire: 2, dark: 1 },
    combo: 1,
    enemyElement: "water"
  });
  assert.equal(result.damage, 33);
  assert.equal(result.breakdown[0].damage, 11);
  assert.equal(result.breakdown[1].damage, 22);
});

test("heart-only matches heal and deal no damage", () => {
  const result = calculateCombatResult({
    counts: { heart: 2 },
    combo: 3,
    enemyElement: "fire"
  });
  assert.equal(result.damage, 0);
  assert.equal(result.healing, 14);
  assert.deepEqual(result.breakdown, []);
});

test("rejects invalid combo, element and rune counts", () => {
  assert.throws(
    () => calculateCombatResult({ counts: {}, combo: 0, enemyElement: "fire" }),
    RangeError
  );
  assert.throws(
    () => calculateCombatResult({ counts: {}, combo: 1, enemyElement: "ice" }),
    RangeError
  );
  assert.throws(
    () => calculateCombatResult({ counts: { fire: -1 }, combo: 1, enemyElement: "fire" }),
    RangeError
  );
});
