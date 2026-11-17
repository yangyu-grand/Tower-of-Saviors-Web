import test from "node:test";
import assert from "node:assert/strict";
import { buildLiveCombatNumbers } from "../liveCombatNumbers.js";

test("builds one attributed floating number for each valid damage element", () => {
  assert.deepEqual(buildLiveCombatNumbers({
    damageByElement: [
      { element: "fire", damage: 120 },
      { element: "water", damage: 80 },
      { element: "heart", damage: 999 },
      { element: "dark", damage: 0 }
    ],
    totalDamage: 200,
    combo: 3
  }), [
    { type: "element", element: "fire", text: "🔥 火 120" },
    { type: "element", element: "water", text: "💧 水 80" },
    { type: "combo", element: "combo", text: "3 COMBO" }
  ]);
});

test("falls back to total damage when elemental attribution is unavailable", () => {
  assert.deepEqual(buildLiveCombatNumbers({ damageByElement: [], totalDamage: 1234, combo: 1 }), [
    { type: "total", element: "neutral", text: "⚔️ 1,234" }
  ]);
});

test("rejects malformed damage and does not invent zero-damage numbers", () => {
  assert.deepEqual(buildLiveCombatNumbers({
    damageByElement: [{ element: "void", damage: 999 }, { element: "fire", damage: -1 }],
    totalDamage: 0,
    combo: 0
  }), []);
});

test("keeps elemental numbers and Combo milestone in deterministic input order", () => {
  const result = buildLiveCombatNumbers({
    damageByElement: [{ element: "light", damage: 15 }, { element: "wood", damage: 30 }],
    totalDamage: 45,
    combo: 4
  });
  assert.deepEqual(result.map(item => item.element), ["light", "wood", "combo"]);
});
