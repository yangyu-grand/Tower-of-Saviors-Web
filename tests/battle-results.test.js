import test from "node:test";
import assert from "node:assert/strict";
import {
  createBattleStats, normalizeBattleStats, recordBattleTurn, recordEncounterDefeat,
  completeBattleStats, dismissBattleResult, buildBattleResult
} from "../battleResults.js";

const STAGE_ZERO_ENCOUNTERS = ["lava-wyrmling", "cinder-guard", "ash-dragon-king"];
const STANDARD_REWARD = { gold: 100, awakeningShards: 1, score: 100 };
const BOSS_REWARD = { gold: 500, summonStones: 1, awakeningShards: 3, prismCores: 1, score: 150 };

test("new battle stats start empty and are detached from later updates", () => {
  const original = createBattleStats(0);
  const next = recordBattleTurn(original, {
    combo: 3, runesMatched: 9, damageDealt: 240, healingDone: 14,
    hpDamageTaken: 5, shieldAbsorbed: 8, expEarned: 20, scoreEarned: 270
  });
  assert.equal(original.turns, 0);
  assert.equal(next.turns, 1);
  assert.equal(next.bestCombo, 3);
  assert.equal(next.runesMatched, 9);
});

test("successful turns accumulate combo, damage, healing, mitigation, EXP and score", () => {
  let stats = createBattleStats(0);
  stats = recordBattleTurn(stats, {
    combo: 2, runesMatched: 6, damageDealt: 120, healingDone: 7,
    hpDamageTaken: 9, shieldAbsorbed: 4, expEarned: 20, scoreEarned: 120
  });
  stats = recordBattleTurn(stats, {
    combo: 4, runesMatched: 12, damageDealt: 360, healingDone: 14,
    hpDamageTaken: 0, shieldAbsorbed: 12, expEarned: 70, scoreEarned: 480
  });
  assert.equal(stats.turns, 2);
  assert.equal(stats.comboSteps, 6);
  assert.equal(stats.bestCombo, 4);
  assert.equal(stats.runesMatched, 18);
  assert.equal(stats.damageDealt, 480);
  assert.equal(stats.healingDone, 21);
  assert.equal(stats.hpDamageTaken, 9);
  assert.equal(stats.shieldAbsorbed, 16);
  assert.equal(stats.expEarned, 90);
  assert.equal(stats.scoreEarned, 600);
});

test("encounter rewards are recorded once even if the same defeat event is retried", () => {
  let stats = createBattleStats(0);
  stats = recordEncounterDefeat(stats, "lava-wyrmling", STANDARD_REWARD);
  const retried = recordEncounterDefeat(stats, "lava-wyrmling", STANDARD_REWARD);
  assert.deepEqual(retried, stats);
  assert.equal(retried.rewards.gold, 100);
  assert.equal(retried.scoreEarned, 100);
  assert.throws(() => recordEncounterDefeat(stats, "reef-stalker", STANDARD_REWARD), /current stage/);
});

test("stage completion requires every encounter and builds an accurate reward summary", () => {
  let stats = createBattleStats(0);
  stats = recordBattleTurn(stats, {
    combo: 4, runesMatched: 12, damageDealt: 1800, healingDone: 28,
    hpDamageTaken: 35, shieldAbsorbed: 18, expEarned: 190, scoreEarned: 480
  });
  assert.throws(() => completeBattleStats(stats), /Every encounter/);
  stats = recordEncounterDefeat(stats, STAGE_ZERO_ENCOUNTERS[0], STANDARD_REWARD);
  stats = recordEncounterDefeat(stats, STAGE_ZERO_ENCOUNTERS[1], STANDARD_REWARD);
  stats = recordEncounterDefeat(stats, STAGE_ZERO_ENCOUNTERS[2], BOSS_REWARD);
  stats = completeBattleStats(stats);
  const summary = buildBattleResult(stats);
  assert.equal(summary.stageName, "灰燼山徑");
  assert.equal(summary.bossName, "灰燼龍王");
  assert.equal(summary.wavesDefeated, 3);
  assert.equal(summary.totalWaves, 3);
  assert.equal(summary.turns, 1);
  assert.equal(summary.bestCombo, 4);
  assert.equal(summary.damageDealt, 1800);
  assert.deepEqual(summary.rewards, { gold: 700, summonStones: 1, awakeningShards: 5, prismCores: 1 });
  assert.equal(summary.scoreEarned, 830);
});

test("result dismissal is persisted and idempotent", () => {
  let stats = createBattleStats(0);
  for (const encounterId of STAGE_ZERO_ENCOUNTERS) {
    stats = recordEncounterDefeat(stats, encounterId, STANDARD_REWARD);
  }
  stats = completeBattleStats(stats);
  const dismissed = dismissBattleResult(stats);
  assert.equal(dismissed.resultDismissed, true);
  assert.deepEqual(dismissBattleResult(dismissed), dismissed);
  assert.throws(() => dismissBattleResult(createBattleStats(0)), /no completed-stage result/);
});

test("battle stats reject invalid counters, stage ids, duplicate encounters and reward overflow", () => {
  const invalidCounter = createBattleStats(0);
  invalidCounter.damageDealt = -1;
  assert.throws(() => normalizeBattleStats(invalidCounter), /damageDealt/);
  const invalidStage = createBattleStats(0);
  invalidStage.stageIndex = 99;
  assert.throws(() => normalizeBattleStats(invalidStage), /stage index/);
  const duplicate = createBattleStats(0);
  duplicate.defeatedEncounterIds = ["lava-wyrmling", "lava-wyrmling"];
  assert.throws(() => normalizeBattleStats(duplicate), /unique/);
  const overflow = createBattleStats(0);
  overflow.rewards.gold = Number.MAX_SAFE_INTEGER;
  assert.throws(() => recordEncounterDefeat(overflow, "lava-wyrmling", { gold: 1 }), /total reward gold/);
  assert.throws(() => recordBattleTurn(createBattleStats(0), { combo: 13, runesMatched: 3 }), /combo/);
});
