import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_SKILLS, createSkillStates, canActivateSkill, activateSkill, advanceSkillCooldowns
} from "../skills.js";
import { calculateCombatResult } from "../combat.js";

const team = ["ember_scout", "tide_monk", "moss_guard", "dawn_archer", "heart_priest"];
const board = Array.from({ length: 30 }, (_, index) => ["fire", "water", "wood", "light", "dark", "heart"][index % 6]);

test("every catalog card has a unique active skill definition", () => {
  assert.equal(Object.keys(ACTIVE_SKILLS).length, 15);
  assert.equal(new Set(Object.values(ACTIVE_SKILLS).map((skill) => skill.id)).size, 15);
});

test("skill states are created for the current team and preserve remaining cooldowns", () => {
  const states = createSkillStates(team);
  assert.equal(states.ember_scout.remaining, 0);
  const used = { ...states, ember_scout: { remaining: 2, justActivated: false } };
  const synced = createSkillStates(["ember_scout", "dusk_mage"], used);
  assert.equal(synced.ember_scout.remaining, 2);
  assert.equal(synced.dusk_mage.remaining, 0);
  assert.equal("tide_monk" in synced, false);
});

test("cannot activate a skill during resolution or while it is cooling down", () => {
  const states = createSkillStates(team);
  assert.equal(canActivateSkill("ember_scout", states), true);
  assert.equal(canActivateSkill("ember_scout", states, true), false);
  states.ember_scout.remaining = 1;
  assert.equal(canActivateSkill("ember_scout", states), false);
});

test("damage skill boosts the next attack and starts its cooldown", () => {
  const result = activateSkill({ cardId: "ember_scout", skillStates: createSkillStates(team), board, hp: 80, maxHp: 100 });
  assert.equal(result.damageMultiplier, 1.5);
  assert.equal(result.skillStates.ember_scout.remaining, 4);
  assert.equal(result.skillStates.ember_scout.justActivated, true);
  const combat = calculateCombatResult({ counts: { fire: 3 }, combo: 1, enemyElement: "wood", teamAttackByElement: { fire: 100 }, skillMultiplier: result.damageMultiplier });
  assert.equal(combat.damage, 225);
});

test("conversion skill changes only the requested number of runes", () => {
  const result = activateSkill({ cardId: "tide_monk", skillStates: createSkillStates(team), board, hp: 80, maxHp: 100, random: () => 0 });
  assert.equal(result.changed, 5);
  assert.equal(result.board.filter((rune) => rune === "water").length, board.filter((rune) => rune === "water").length + 5);
  assert.equal(result.board.length, 30);
});

test("shield skill stores mitigation for the next enemy hit", () => {
  const result = activateSkill({ cardId: "moss_guard", skillStates: createSkillStates(team), board, hp: 80, maxHp: 100 });
  assert.equal(result.shield, 20);
  const incoming = 9;
  const absorbed = Math.min(result.shield, incoming);
  assert.equal(result.shield - absorbed, 11);
  assert.equal(80 - (incoming - absorbed), 80);
});

test("healing skill restores up to one quarter of max HP without overhealing", () => {
  const result = activateSkill({ cardId: "heart_priest", skillStates: createSkillStates(team), board, hp: 60, maxHp: 100 });
  assert.equal(result.hp, 85);
  const nearFull = activateSkill({ cardId: "heart_priest", skillStates: createSkillStates(team), board, hp: 98, maxHp: 100 });
  assert.equal(nearFull.hp, 100);
  assert.equal(nearFull.restored, 2);
});

test("newly activated cooldown does not tick on the same turn", () => {
  const activated = activateSkill({ cardId: "ember_scout", skillStates: createSkillStates(team), board, hp: 80, maxHp: 100 });
  const afterActivationTurn = advanceSkillCooldowns(activated.skillStates);
  assert.equal(afterActivationTurn.ember_scout.remaining, 4);
  const afterNextTurn = advanceSkillCooldowns(afterActivationTurn);
  assert.equal(afterNextTurn.ember_scout.remaining, 3);
});

test("cooldown reaches zero after the configured number of subsequent turns", () => {
  let states = activateSkill({ cardId: "dawn_archer", skillStates: createSkillStates(team), board, hp: 80, maxHp: 100 }).skillStates;
  for (let turn = 0; turn < 4; turn++) states = advanceSkillCooldowns(states);
  assert.equal(states.dawn_archer.remaining, 0);
  assert.equal(canActivateSkill("dawn_archer", states), true);
});

test("rejects unknown cards, invalid health, and invalid random values", () => {
  assert.throws(() => activateSkill({ cardId: "unknown", skillStates: {}, board, hp: 1, maxHp: 10 }), RangeError);
  assert.throws(() => activateSkill({ cardId: "heart_priest", skillStates: createSkillStates(team), board, hp: 101, maxHp: 100 }), RangeError);
  assert.throws(() => activateSkill({ cardId: "tide_monk", skillStates: createSkillStates(team), board, hp: 1, maxHp: 100, random: () => 1 }), RangeError);
});

test("newly summonable cards all have usable active skills", () => {
  const ids = ["azure_minstrel", "verdant_alchemist", "astral_scribe", "abyss_weaver", "solar_archon"];
  const states = createSkillStates(ids);
  assert.equal(Object.keys(states).length, 5);
  assert.ok(ids.every((id) => ACTIVE_SKILLS[id] && states[id].remaining === 0));
});
