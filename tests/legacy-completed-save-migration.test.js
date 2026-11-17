import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultSave, normalizeSave } from "../inventory.js";

function makeLegacyCompletedSave(version) {
  const save = createDefaultSave();
  save.version = version;
  save.campaign = {
    stageIndex: 1,
    waveIndex: 2,
    turn: 4,
    enemyHp: 0,
    completed: true,
    campaignComplete: false
  };
  save.unlockedStageIndex = 2;
  save.score = 1250;
  delete save.battleStats;
  delete save.materials;
  if (version === 1) {
    delete save.summonState;
    for (const entry of save.inventory) {
      delete entry.skillLevel;
      delete entry.evolutionLevel;
    }
  } else {
    for (const entry of save.inventory) delete entry.evolutionLevel;
  }
  return save;
}

for (const version of [1, 2]) {
  test(`version-${version} completed-stage saves migrate without fabricating a battle result`, () => {
    const legacy = makeLegacyCompletedSave(version);
    const migrated = normalizeSave(legacy);

    assert.equal(migrated.version, 4);
    assert.deepEqual(migrated.campaign, legacy.campaign);
    assert.equal(migrated.unlockedStageIndex, 2);
    assert.equal(migrated.score, 1250);
    assert.equal(migrated.battleStats.stageIndex, 1);
    assert.equal(migrated.battleStats.stageCompleted, true);
    assert.equal(migrated.battleStats.resultDismissed, true);
    assert.deepEqual(migrated.battleStats.defeatedEncounterIds, []);
    assert.deepEqual(migrated.battleStats.rewards, {
      gold: 0,
      summonStones: 0,
      awakeningShards: 0,
      prismCores: 0
    });
    assert.deepEqual(normalizeSave(migrated), migrated,
      "a migrated save should remain stable when normalized again");
  });
}
