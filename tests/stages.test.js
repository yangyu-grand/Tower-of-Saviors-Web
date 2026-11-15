import test from "node:test";
import assert from "node:assert/strict";
import {
  STAGES, createCampaignState, getCurrentStage, getCurrentEncounter,
  damageCurrentEnemy, getEnemyIntent, resolveEnemyTurn,
  mitigateIncomingDamage, advanceCampaignStage
} from "../stages.js";

test("campaign exposes three stages with a boss as the final wave", () => {
  assert.equal(STAGES.length, 3);
  for (const stage of STAGES) {
    assert.equal(stage.waves.length, 3);
    assert.equal(stage.waves.at(-1).boss, true);
  }
});

test("new campaign starts at the first encounter with full HP", () => {
  const state = createCampaignState();
  assert.equal(getCurrentStage(state).name, "灰燼山徑");
  assert.equal(getCurrentEncounter(state).name, "熔岩幼龍");
  assert.equal(state.enemyHp, 180);
  assert.equal(state.turn, 0);
});

test("non-lethal damage reduces current enemy HP without advancing the wave", () => {
  const result = damageCurrentEnemy(createCampaignState(), 55);
  assert.equal(result.state.enemyHp, 125);
  assert.equal(result.state.waveIndex, 0);
  assert.equal(result.defeated, false);
});

test("defeating a wave advances to the next enemy and resets its turn counter", () => {
  const state = { ...createCampaignState(), turn: 2 };
  const result = damageCurrentEnemy(state, 180);
  assert.equal(result.defeated, true);
  assert.equal(result.defeatedEnemy.id, "lava-wyrmling");
  assert.equal(result.nextEncounter.id, "cinder-guard");
  assert.equal(result.state.waveIndex, 1);
  assert.equal(result.state.enemyHp, 260);
  assert.equal(result.state.turn, 0);
  assert.equal(result.stageCompleted, false);
});

test("defeating the boss completes the stage and campaign only on the final stage", () => {
  let state = createCampaignState();
  state = damageCurrentEnemy(state, 10000).state;
  state = damageCurrentEnemy(state, 10000).state;
  const bossResult = damageCurrentEnemy(state, 10000);
  assert.equal(bossResult.stageCompleted, true);
  assert.equal(bossResult.campaignCompleted, false);
  assert.equal(bossResult.state.completed, true);
  assert.equal(getCurrentEncounter(bossResult.state), null);

  let finalState = createCampaignState(2);
  finalState = { ...finalState, waveIndex: 2, enemyHp: 1 };
  const finalResult = damageCurrentEnemy(finalState, 1);
  assert.equal(finalResult.campaignCompleted, true);
});

test("regular enemies attack on each configured attack interval", () => {
  const state = createCampaignState();
  const intent = getEnemyIntent(state);
  assert.deepEqual(intent, {
    type: "attack", label: "普通攻擊", damage: 9, shieldPierce: 0, enraged: false
  });
  const resolved = resolveEnemyTurn(state);
  assert.equal(resolved.state.turn, 1);
  assert.equal(resolved.incomingDamage, 9);
});

test("boss telegraphs a special attack on its third turn", () => {
  let state = createCampaignState();
  state = { ...state, waveIndex: 2, enemyHp: 620, turn: 2 };
  const intent = getEnemyIntent(state);
  assert.equal(intent.type, "special");
  assert.equal(intent.label, "熔火吐息");
  assert.equal(intent.damage, 34);
  assert.equal(intent.shieldPierce, 0.5);
});

test("boss enrages below half HP and increases its next attack", () => {
  let state = createCampaignState();
  state = { ...state, waveIndex: 2, enemyHp: 300, turn: 0 };
  const intent = getEnemyIntent(state);
  assert.equal(intent.enraged, true);
  assert.equal(intent.damage, 24);
});

test("boss special attacks partially bypass shields", () => {
  const result = mitigateIncomingDamage(34, 20, 0.5);
  assert.equal(result.piercingDamage, 17);
  assert.equal(result.shieldDamage, 17);
  assert.equal(result.hpDamage, 17);
  assert.equal(result.remainingShield, 3);
});

test("next stage can only be entered after clearing the current boss", () => {
  let state = createCampaignState();
  state = { ...state, completed: true };
  const next = advanceCampaignStage(state);
  assert.equal(next.stageIndex, 1);
  assert.equal(next.waveIndex, 0);
  assert.equal(next.enemyHp, STAGES[1].waves[0].hp);
  assert.throws(() => advanceCampaignStage(createCampaignState()), /boss/);
});

test("rejects invalid stage, damage, and shield values", () => {
  assert.throws(() => createCampaignState(99), RangeError);
  assert.throws(() => damageCurrentEnemy(createCampaignState(), -1), RangeError);
  assert.throws(() => mitigateIncomingDamage(10, 5, 1.2), RangeError);
});
