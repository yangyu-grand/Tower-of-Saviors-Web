import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeEncounter,
  buildCampaignBalanceReport,
  formatCampaignBalanceReport
} from "../balance.js";

test("the default baseline is deterministic and uses the active leader element", () => {
  const first = analyzeEncounter();
  const second = analyzeEncounter();
  assert.deepEqual(first, second);
  assert.deepEqual(first.scenario.matchedElements, ["fire"]);
  assert.equal(first.scenario.combo, 1);
  assert.equal(first.damagePerTurn, 216);
  assert.equal(first.status, "victory");
  assert.equal(first.turnsToDefeat, 1);
});

test("elemental advantage and disadvantage are reflected in the same team's damage", () => {
  const advantage = analyzeEncounter({
    stageIndex: 3,
    waveIndex: 0,
    matchedElements: ["fire"]
  });
  const disadvantage = analyzeEncounter({
    stageIndex: 1,
    waveIndex: 0,
    matchedElements: ["fire"]
  });
  assert.equal(advantage.damagePerTurn, 324);
  assert.equal(disadvantage.damagePerTurn, 108);
  assert.equal(advantage.damagePerTurn, disadvantage.damagePerTurn * 3);
});

test("support healing is applied between player turns and cannot exceed enemy maximum HP", () => {
  const result = analyzeEncounter({
    stageIndex: 1,
    waveIndex: 1,
    matchedElements: ["fire"]
  });
  assert.equal(result.status, "victory");
  assert.equal(result.turnsToDefeat, 4);
  assert.equal(result.totalEnemyHealing, 36);
  assert.equal(result.turns[2].enemyAction.type, "heal");
  assert.equal(result.turns[2].enemyHpAfterTurn, 102);
});

test("the fourth-chapter boss simulation crosses both phases and records its phase special", () => {
  const result = analyzeEncounter({
    stageIndex: 3,
    waveIndex: 2,
    matchedElements: ["wood"],
    maxTurns: 40
  });
  assert.equal(result.status, "victory");
  assert.deepEqual(result.phaseNames, ["花霧姿態", "月蝕姿態"]);
  assert.ok(result.turns.some((turn) =>
    turn.enemyAction?.label === "天狐焚月" &&
    turn.enemyAction.hits === 3
  ));
  assert.ok(result.turns.some((turn) => turn.enemyAction?.enraged === true));
});

test("initial shield is consumed hit by hit using the same mitigation rules as battle", () => {
  const result = analyzeEncounter({
    stageIndex: 0,
    waveIndex: 1,
    matchedElements: ["wood"],
    initialShield: 10
  });
  const heavy = result.turns.find((turn) => turn.enemyAction?.type === "heavy");
  assert.ok(heavy);
  assert.equal(heavy.shieldAbsorbed, 10);
  assert.equal(heavy.hpDamageTaken, 2);
  assert.equal(result.remainingShield, 0);
});

test("heart runes use the leader healing multiplier and restore a wounded party", () => {
  const baseline = analyzeEncounter({
    stageIndex: 0,
    waveIndex: 0,
    matchedElements: ["fire"],
    heartRunes: 3,
    startingPartyHp: 5900
  });
  assert.equal(baseline.scenario.combo, 2);
  assert.equal(baseline.healingPerTurn, 21);
  assert.equal(baseline.totalHealingApplied, 21);
  assert.equal(baseline.remainingPartyHp, 5921);
});

test("campaign report covers every encounter and formats the fourth chapter", () => {
  const report = buildCampaignBalanceReport();
  assert.equal(report.stageCount, 4);
  assert.equal(report.encounterCount, 12);
  assert.equal(report.results.length, 12);
  assert.equal(report.summary.victories, 12);
  const text = formatCampaignBalanceReport(report);
  assert.match(text, /霧櫻古境/);
  assert.match(text, /櫻月天狐/);
  assert.match(text, /12\/12 victories/);
});

test("balance inputs reject invalid stages, elements, duplicates and oversized scenarios", () => {
  assert.throws(() => analyzeEncounter({ stageIndex: 99 }), /stageIndex/);
  assert.throws(() => analyzeEncounter({ matchedElements: ["heart"] }), /positive attack/);
  assert.throws(() => analyzeEncounter({ matchedElements: ["fire", "fire"] }), /duplicates/);
  assert.throws(() => analyzeEncounter({ heartRunes: 7 }), /heartRunes/);
  assert.throws(() => analyzeEncounter({ extraCascadeCombos: 12 }), /resulting combo|extraCascadeCombos/);
});
