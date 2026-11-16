import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TEAM } from "../team.js";
import { STAGES } from "../stages.js";
import {
  simulateRuneEncounter,
  buildRuneBattleReport,
  formatRuneBattleReport
} from "../runeBattleSimulation.js";

test("board-driven encounter simulation is deterministic for a fixed seed", () => {
  const options = {
    stageIndex: 3,
    waveIndex: 2,
    seed: 271828,
    maxTurns: 20,
    skillPolicy: "greedy"
  };
  assert.deepEqual(simulateRuneEncounter(options), simulateRuneEncounter(options));
});

test("a surviving enemy resolves its real attack intent after the player's board move", () => {
  const result = simulateRuneEncounter({
    stageIndex: 3,
    waveIndex: 2,
    seed: 77,
    skillPolicy: "none",
    maxTurns: 8
  });
  assert.ok(result.turns.length > 0);
  assert.ok(result.turns[0].enemyAction);
  assert.equal(result.turns[0].enemyAction.type, "charging");
  assert.ok(result.totalDamageDealt > 0);
});

test("boss phase thresholds are read after board damage and recorded from the enemy response", () => {
  const result = simulateRuneEncounter({
    stageIndex: 3,
    waveIndex: 2,
    seed: 123,
    skillPolicy: "none",
    maxTurns: 20
  });
  assert.ok(result.phaseNames.includes("月蝕姿態"));
  assert.ok(result.turns.some((turn) => turn.enemyAction?.phase === "月蝕姿態"));
});

test("greedy skill policy uses a shield when the next enemy intent would damage the party", () => {
  const result = simulateRuneEncounter({
    stageIndex: 3,
    waveIndex: 2,
    seed: 99,
    skillPolicy: "greedy",
    maxTurns: 12
  });
  assert.ok(result.totalActiveSkillUses > 0);
  assert.equal(result.turns[0].skillEvents[0].type, "shield");
  assert.equal(result.turns[0].skillEvents[0].shieldAdded, 20);
  assert.equal(result.turns[0].cooldownsAfterTurn.moss_guard.remaining, 4);
});

test("disabled skill policy leaves all skill states unused", () => {
  const result = simulateRuneEncounter({
    stageIndex: 0,
    waveIndex: 0,
    seed: 7,
    skillPolicy: "none",
    maxTurns: 10
  });
  assert.equal(result.totalActiveSkillUses, 0);
  assert.ok(result.turns.every((turn) => turn.skillEvents.length === 0));
});

test("campaign report covers all twelve encounters and is reproducible", () => {
  const options = { samples: 1, seed: 20261117, skillPolicy: "greedy" };
  const first = buildRuneBattleReport(options);
  const second = buildRuneBattleReport(options);
  assert.deepEqual(first, second);
  assert.equal(first.summary.encounters, 12);
  assert.equal(first.summary.simulations, 12);
  assert.equal(first.encounters.length, 12);
  assert.equal(first.encounters.filter((entry) => entry.boss).length, 4);
  assert.match(formatRuneBattleReport(first), /櫻月天狐/);
  assert.equal(first.results.every((result) => result.turns.length > 0), true);
});

test("encounter simulation rejects invalid stages, seeds, policies, and HP values", () => {
  assert.throws(() => simulateRuneEncounter({ stageIndex: 99 }), /stageIndex/);
  assert.throws(() => simulateRuneEncounter({ seed: 1.5 }), /safe integer/);
  assert.throws(() => simulateRuneEncounter({ skillPolicy: "always" }), /skillPolicy/);
  assert.throws(() => simulateRuneEncounter({ startingEnemyHp: STAGES[0].waves[0].hp + 1 }), /startingEnemyHp/);
  assert.throws(() => simulateRuneEncounter({ teamIds: DEFAULT_TEAM.slice(0, 4) }), /exactly 5 cards/);
  assert.throws(() => buildRuneBattleReport({ samples: 0 }), /samples/);
  assert.throws(() => buildRuneBattleReport({ startingEnemyHp: 1 }), /startingEnemyHp/);
});
