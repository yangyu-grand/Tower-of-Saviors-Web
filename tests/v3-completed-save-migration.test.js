import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultSave, normalizeSave } from "../inventory.js";
import { STAGES } from "../stages.js";
import {
  createBattleStats,
  recordBattleTurn,
  recordEncounterDefeat,
  completeBattleStats,
  dismissBattleResult
} from "../battleResults.js";

test("version-3 completed saves preserve recorded battle statistics and rewards during migration", () => {
  const legacy = createDefaultSave();
  legacy.version = 3;
  legacy.campaign = {
    stageIndex: 1,
    waveIndex: 2,
    turn: 4,
    enemyHp: 0,
    completed: true,
    campaignComplete: false
  };
  legacy.unlockedStageIndex = 2;
  legacy.score = 1250;
  legacy.materials = { awakeningShards: 7, prismCores: 3 };

  let stats = createBattleStats(1);
  for (const wave of STAGES[1].waves) {
    stats = recordBattleTurn(stats, {
      combo: 2,
      runesMatched: 6,
      damageDealt: 180,
      healingDone: 14,
      hpDamageTaken: 5,
      shieldAbsorbed: 3,
      expEarned: 20,
      scoreEarned: 40
    });
    stats = recordEncounterDefeat(stats, wave.id, {
      gold: 30,
      summonStones: 1,
      awakeningShards: 1,
      score: 40
    });
  }
  legacy.battleStats = dismissBattleResult(completeBattleStats(stats));

  // Version 3 profiles may predate the per-card evolution field.
  for (const entry of legacy.inventory) delete entry.evolutionLevel;

  const migrated = normalizeSave(legacy);

  assert.equal(migrated.version, 4);
  assert.deepEqual(migrated.campaign, legacy.campaign);
  assert.equal(migrated.unlockedStageIndex, 2);
  assert.equal(migrated.score, 1250);
  assert.deepEqual(migrated.battleStats, legacy.battleStats);
  assert.deepEqual(migrated.materials, { awakeningShards: 7, prismCores: 3 });
  assert.ok(migrated.inventory.every((entry) => entry.evolutionLevel === 0));
  assert.deepEqual(normalizeSave(migrated), migrated,
    "a migrated version-3 save should remain stable when normalized again");
});
