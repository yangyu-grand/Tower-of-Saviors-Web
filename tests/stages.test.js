import test from "node:test";
import assert from "node:assert/strict";
import {STAGES,createCampaignState,getCurrentStage,getCurrentEncounter,damageCurrentEnemy,getEnemyIntent,resolveEnemyTurn,mitigateIncomingDamage,advanceCampaignStage} from "../stages.js";

function clearStage(state){
  while(!state.completed)state=damageCurrentEnemy(state,100000).state;
  return state;
}

test("campaign exposes three stages with a boss as the final wave",()=>{
  assert.equal(STAGES.length,3);
  for(const stage of STAGES){
    assert.equal(stage.waves.length,3);
    assert.equal(stage.waves.at(-1).boss,true);
  }
});

test("new campaign starts at the first encounter with full HP",()=>{
  const state=createCampaignState();
  assert.equal(getCurrentStage(state).name,"灰燼山徑");
  assert.equal(getCurrentEncounter(state).name,"熔岩幼龍");
  assert.equal(state.enemyHp,180);
  assert.equal(state.turn,0);
});

test("non-lethal damage reduces current enemy HP without advancing the wave",()=>{
  const result=damageCurrentEnemy(createCampaignState(),55);
  assert.equal(result.state.enemyHp,125);
  assert.equal(result.state.waveIndex,0);
  assert.equal(result.defeated,false);
});

test("defeating a wave advances to the next enemy and resets its turn counter",()=>{
  const result=damageCurrentEnemy({...createCampaignState(),turn:2},180);
  assert.equal(result.defeated,true);
  assert.equal(result.defeatedEnemy.id,"lava-wyrmling");
  assert.equal(result.nextEncounter.id,"cinder-guard");
  assert.equal(result.state.waveIndex,1);
  assert.equal(result.state.enemyHp,260);
  assert.equal(result.state.turn,0);
  assert.equal(result.stageCompleted,false);
});

test("defeating the boss completes the stage and campaign only on the final wave",()=>{
  let beforeBoss=damageCurrentEnemy(createCampaignState(),100000).state;
  beforeBoss=damageCurrentEnemy(beforeBoss,100000).state;
  const bossResult=damageCurrentEnemy(beforeBoss,10000);
  assert.equal(bossResult.stageCompleted,true);
  assert.equal(bossResult.campaignCompleted,false);
  assert.equal(bossResult.state.completed,true);
  assert.equal(getCurrentEncounter(bossResult.state),null);

  let finalBoss=damageCurrentEnemy(createCampaignState(2),100000).state;
  finalBoss=damageCurrentEnemy(finalBoss,100000).state;
  const finalResult=damageCurrentEnemy(finalBoss,10000);
  assert.equal(finalResult.campaignCompleted,true);
});

test("regular enemies expose their named attack and resolve the configured damage",()=>{
  const state=createCampaignState();
  const intent=getEnemyIntent(state);
  assert.equal(intent.type,"attack");
  assert.equal(intent.label,"灼熱吐息");
  assert.equal(intent.damage,9);
  assert.equal(intent.hits,1);
  const resolved=resolveEnemyTurn(state);
  assert.equal(resolved.state.turn,1);
  assert.equal(resolved.incomingDamage,9);
  assert.match(resolved.message,/灼熱吐息/);
});

test("heavy attacks are telegraphed one turn before they land",()=>{
  const state={...createCampaignState(),waveIndex:1,enemyHp:260,turn:0};
  const warning=getEnemyIntent(state);
  assert.equal(warning.type,"charging");
  assert.equal(warning.label,"重盾猛擊蓄力中");
  assert.equal(warning.previewDamage,12);
  const charge=resolveEnemyTurn(state);
  assert.equal(charge.incomingDamage,0);
  assert.equal(charge.state.turn,1);
  const attack=getEnemyIntent(charge.state);
  assert.equal(attack.type,"heavy");
  assert.equal(attack.label,"重盾猛擊");
  assert.equal(attack.damage,12);
});

test("multi-hit enemies report hit count and shields are consumed hit by hit",()=>{
  const state=createCampaignState(1);
  const intent=getEnemyIntent(state);
  assert.equal(intent.type,"multi");
  assert.equal(intent.label,"雙重撕咬");
  assert.equal(intent.hits,2);
  assert.equal(intent.damage,14);
  const resolved=resolveEnemyTurn(state);
  assert.match(resolved.message,/分 2 段/);
  const mitigation=mitigateIncomingDamage(resolved.incomingDamage,10,0,intent.hits);
  assert.equal(mitigation.hpDamage,4);
  assert.equal(mitigation.shieldDamage,10);
  assert.equal(mitigation.remainingShield,0);
  assert.deepEqual(mitigation.hitResults,[
    {damage:7,piercingDamage:0,shieldDamage:7,hpDamage:0},
    {damage:7,piercingDamage:0,shieldDamage:3,hpDamage:4}
  ]);
});

test("coral sentinel heals on its support interval and cannot exceed maximum HP",()=>{
  const damaged={...createCampaignState(1),waveIndex:1,turn:2,enemyHp:300};
  const intent=getEnemyIntent(damaged);
  assert.equal(intent.type,"heal");
  assert.equal(intent.label,"珊瑚再生");
  assert.equal(intent.healing,36);
  const resolved=resolveEnemyTurn(damaged);
  assert.equal(resolved.incomingDamage,0);
  assert.equal(resolved.state.enemyHp,336);
  assert.equal(resolved.state.turn,3);

  const nearFull={...damaged,enemyHp:380};
  assert.equal(getEnemyIntent(nearFull).healing,10);
  const full={...damaged,enemyHp:390};
  assert.equal(getEnemyIntent(full).type,"attack");
  assert.equal(getEnemyIntent(full).label,"珊瑚脈衝");
});

test("boss special attacks can contain multiple independently shielded hits",()=>{
  const state={...createCampaignState(1),waveIndex:2,turn:2,enemyHp:850};
  const intent=getEnemyIntent(state);
  assert.equal(intent.type,"special");
  assert.equal(intent.label,"深海洪流");
  assert.equal(intent.hits,3);
  assert.equal(intent.damage,42);
  const mitigation=mitigateIncomingDamage(intent.damage,30,intent.shieldPierce,intent.hits);
  assert.equal(mitigation.piercingDamage,18);
  assert.equal(mitigation.shieldDamage,24);
  assert.equal(mitigation.hpDamage,18);
  assert.equal(mitigation.remainingShield,6);
});

test("boss telegraphs a special attack on its third turn",()=>{
  const state={...createCampaignState(),waveIndex:2,enemyHp:620,turn:2};
  const intent=getEnemyIntent(state);
  assert.equal(intent.type,"special");
  assert.equal(intent.label,"熔火吐息");
  assert.equal(intent.damage,34);
  assert.equal(intent.shieldPierce,0.5);
  assert.equal(intent.hits,1);
});

test("boss enrages below half HP and increases its next attack",()=>{
  const state={...createCampaignState(),waveIndex:2,enemyHp:300,turn:1};
  const intent=getEnemyIntent(state);
  assert.equal(intent.enraged,true);
  assert.equal(intent.damage,24);
});

test("boss special attacks partially bypass shields",()=>{
  const result=mitigateIncomingDamage(34,20,0.5);
  assert.equal(result.piercingDamage,17);
  assert.equal(result.shieldDamage,17);
  assert.equal(result.hpDamage,17);
  assert.equal(result.remainingShield,3);
});

test("next stage can only be entered after clearing the current boss",()=>{
  const cleared=clearStage(createCampaignState());
  const next=advanceCampaignStage(cleared);
  assert.equal(next.stageIndex,1);
  assert.equal(next.waveIndex,0);
  assert.equal(next.enemyHp,STAGES[1].waves[0].hp);
  assert.throws(()=>advanceCampaignStage(createCampaignState()),/boss/);
  assert.throws(()=>advanceCampaignStage({...createCampaignState(),completed:true}),/completed stage/);
});

test("rejects invalid stage, damage, hit count, and shield values",()=>{
  assert.throws(()=>createCampaignState(99),RangeError);
  assert.throws(()=>damageCurrentEnemy(createCampaignState(),-1),RangeError);
  assert.throws(()=>mitigateIncomingDamage(10,5,1.2),RangeError);
  assert.throws(()=>mitigateIncomingDamage(10,5,0,0),/hitCount/);
  assert.throws(()=>mitigateIncomingDamage(10,5,0,11),/hitCount/);
});
