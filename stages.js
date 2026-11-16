export const STAGES = Object.freeze([
  Object.freeze({id:"ash-road",name:"灰燼山徑",difficulty:"初階",waves:Object.freeze([
    Object.freeze({id:"lava-wyrmling",name:"熔岩幼龍",emoji:"🐉",element:"fire",hp:180,attack:9,attackEvery:1,attackPattern:Object.freeze({type:"single",name:"灼熱吐息"})}),
    Object.freeze({id:"cinder-guard",name:"燼甲守衛",emoji:"🛡️",element:"fire",hp:260,attack:12,attackEvery:2,attackPattern:Object.freeze({type:"heavy",name:"重盾猛擊"})}),
    Object.freeze({id:"ash-dragon-king",name:"灰燼龍王",emoji:"🐲",element:"fire",hp:620,attack:16,attackEvery:2,attackPattern:Object.freeze({type:"heavy",name:"龍爪重擊"}),boss:true,special:Object.freeze({every:3,name:"熔火吐息",damage:34,shieldPierce:0.5}),enrageAt:0.5,enrageMultiplier:1.5})
  ])}),
  Object.freeze({id:"tide-ruins",name:"潮汐遺跡",difficulty:"進階",waves:Object.freeze([
    Object.freeze({id:"reef-stalker",name:"礁影獵手",emoji:"🦈",element:"water",hp:300,attack:14,attackEvery:1,attackPattern:Object.freeze({type:"multi",name:"雙重撕咬",hits:2})}),
    Object.freeze({id:"coral-sentinel",name:"珊瑚守衛",emoji:"🪸",element:"water",hp:390,attack:16,attackEvery:1,attackPattern:Object.freeze({type:"single",name:"珊瑚脈衝"}),support:Object.freeze({every:3,name:"珊瑚再生",amount:36})}),
    Object.freeze({id:"abyss-leviathan",name:"深淵海皇",emoji:"🐋",element:"water",hp:850,attack:20,attackEvery:2,attackPattern:Object.freeze({type:"heavy",name:"深淵震擊"}),boss:true,special:Object.freeze({every:3,name:"深海洪流",damage:42,hits:3,shieldPierce:0.4}),enrageAt:0.5,enrageMultiplier:1.5})
  ])}),
  Object.freeze({id:"eclipse-throne",name:"蝕月王座",difficulty:"菁英",waves:Object.freeze([
    Object.freeze({id:"night-wisp",name:"夜幕幽靈",emoji:"👻",element:"dark",hp:420,attack:17,attackEvery:1,attackPattern:Object.freeze({type:"multi",name:"幽影連斬",hits:2})}),
    Object.freeze({id:"prism-golem",name:"稜鏡魔像",emoji:"🔮",element:"light",hp:520,attack:19,attackEvery:2,attackPattern:Object.freeze({type:"heavy",name:"稜鏡光束"})}),
    Object.freeze({id:"eclipse-sovereign",name:"蝕月君主",emoji:"🌘",element:"dark",hp:1100,attack:25,attackEvery:2,attackPattern:Object.freeze({type:"heavy",name:"蝕月斬"}),boss:true,special:Object.freeze({every:3,name:"日蝕裁決",damage:54,hits:2,shieldPierce:0.5}),enrageAt:0.5,enrageMultiplier:1.6})
  ])})
  Object.freeze({id:"mist-sakura-ancient",name:"霧櫻古境",difficulty:"傳說",rewardMultiplier:2,waves:Object.freeze([
    Object.freeze({id:"mist-tail-fox",name:"霧尾妖狐",emoji:"🦊",element:"wood",hp:720,attack:22,attackEvery:1,attackPattern:Object.freeze({type:"multi",name:"幻尾連擊",hits:2})}),
    Object.freeze({id:"splitwind-tengu",name:"裂風天狗",emoji:"👺",element:"light",hp:980,attack:28,attackEvery:2,attackPattern:Object.freeze({type:"heavy",name:"風刃蓄勢"})}),
    Object.freeze({id:"sakura-moon-fox",name:"櫻月天狐",emoji:"🦊",element:"dark",hp:1850,attack:32,attackEvery:2,attackPattern:Object.freeze({type:"heavy",name:"櫻刃蓄力"}),boss:true,special:Object.freeze({every:3,name:"花影連舞",damage:72,hits:2,shieldPierce:0.2}),enrageAt:0.5,enrageMultiplier:1.25,phases:Object.freeze([
      Object.freeze({at:1,name:"花霧姿態",attackEvery:2,attackPattern:Object.freeze({type:"heavy",name:"櫻刃蓄力"}),special:Object.freeze({every:3,name:"花影連舞",damage:72,hits:2,shieldPierce:0.2}),enrageAt:0.5,enrageMultiplier:1.25}),
      Object.freeze({at:0.5,name:"月蝕姿態",attackEvery:1,attackPattern:Object.freeze({type:"multi",name:"月輪連斬",hits:3}),special:Object.freeze({every:2,name:"天狐焚月",damage:90,hits:3,shieldPierce:0.35}),enrageAt:0.2,enrageMultiplier:1.4})
    ])})
  ])})
]);

function assertCampaignState(state){
  if(!state||!Number.isInteger(state.stageIndex)||state.stageIndex<0||state.stageIndex>=STAGES.length)throw new RangeError("Invalid campaign stage index");
  const stage=STAGES[state.stageIndex];
  if(!Number.isInteger(state.waveIndex)||state.waveIndex<0||state.waveIndex>=stage.waves.length)throw new RangeError("Invalid campaign wave index");
  if(!Number.isInteger(state.turn)||state.turn<0)throw new RangeError("turn must be a non-negative integer");
  if(!Number.isFinite(state.enemyHp)||state.enemyHp<0)throw new RangeError("enemyHp must be non-negative");
  const wave=stage.waves[state.waveIndex];
  if(state.completed){
    if(state.waveIndex!==stage.waves.length-1||state.enemyHp!==0)throw new RangeError("A completed stage must have a defeated final boss");
    if(state.campaignComplete!==(state.stageIndex===STAGES.length-1))throw new RangeError("campaignComplete does not match the final stage");
  }else if(state.enemyHp<=0||state.enemyHp>wave.hp)throw new RangeError("enemyHp must be within the current encounter's HP range");
  return stage;
}

export function createCampaignState(stageIndex=0){
  if(!Number.isInteger(stageIndex)||stageIndex<0||stageIndex>=STAGES.length)throw new RangeError("Unknown stage index: "+String(stageIndex));
  return {stageIndex,waveIndex:0,turn:0,enemyHp:STAGES[stageIndex].waves[0].hp,completed:false,campaignComplete:false};
}

export function getCurrentStage(state){return assertCampaignState(state)}
export function getCurrentEncounter(state){const stage=assertCampaignState(state);return state.completed?null:stage.waves[state.waveIndex]}

export function damageCurrentEnemy(state,damage){
  const stage=assertCampaignState(state);
  if(state.completed)throw new Error("The current stage is already complete");
  if(!Number.isFinite(damage)||damage<0)throw new RangeError("damage must be a non-negative finite number");
  const encounter=stage.waves[state.waveIndex],enemyHp=Math.max(0,state.enemyHp-damage);
  if(enemyHp>0)return {state:{...state,enemyHp},defeated:false,defeatedEnemy:null,nextEncounter:encounter,stageCompleted:false,campaignCompleted:false};
  const nextWaveIndex=state.waveIndex+1;
  if(nextWaveIndex<stage.waves.length){
    const nextEncounter=stage.waves[nextWaveIndex];
    return {state:{...state,waveIndex:nextWaveIndex,turn:0,enemyHp:nextEncounter.hp},defeated:true,defeatedEnemy:encounter,nextEncounter,stageCompleted:false,campaignCompleted:false};
  }
  const campaignCompleted=state.stageIndex===STAGES.length-1;
  return {state:{...state,enemyHp:0,completed:true,campaignComplete:campaignCompleted},defeated:true,defeatedEnemy:encounter,nextEncounter:null,stageCompleted:true,campaignCompleted};
}

function getEncounterPhase(encounter, enemyHp){
  if(!Array.isArray(encounter.phases)||encounter.phases.length===0)return null;
  const hpRatio=enemyHp/encounter.hp;
  let active=null;
  for(const phase of encounter.phases){
    if(!Number.isFinite(phase.at)||phase.at<0||phase.at>1)throw new RangeError("Encounter phase threshold must be between 0 and 1");
    if(hpRatio<=phase.at)active=phase;
  }
  return active;
}

export function getEnemyIntent(state){
  const encounter=getCurrentEncounter(state);
  if(!encounter)return {type:"none",label:"關卡已完成",damage:0,healing:0,hits:1,previewDamage:0,previewHits:1,shieldPierce:0,enraged:false,phase:null};

  const phase=getEncounterPhase(encounter,state.enemyHp);
  const nextTurn=state.turn+1;
  const phaseName=phase?.name??null;
  const enrageAt=phase?.enrageAt??encounter.enrageAt;
  const enraged=Number.isFinite(enrageAt)&&state.enemyHp<=encounter.hp*enrageAt;
  const multiplier=enraged?(phase?.enrageMultiplier??encounter.enrageMultiplier??1):1;
  const support=phase?.support??encounter.support;
  const special=phase?.special??encounter.special;
  const pattern=phase?.attackPattern??encounter.attackPattern??{type:"single"};
  const attackEvery=phase?.attackEvery??encounter.attackEvery;

  if(support&&nextTurn%support.every===0){
    return {type:"heal",label:support.name,damage:0,healing:support.amount,hits:1,previewDamage:0,previewHits:1,shieldPierce:0,enraged,phase:phaseName};
  }

  if(special&&nextTurn%special.every===0){
    return {type:"special",label:special.name,damage:Math.ceil(special.damage*multiplier),healing:0,hits:special.hits??1,previewDamage:0,previewHits:1,shieldPierce:special.shieldPierce??0,enraged,phase:phaseName};
  }

  const damage=Math.ceil(encounter.attack*multiplier);
  const hits=pattern.hits??1;
  if(nextTurn%attackEvery===0){
    return {type:pattern.type==="heavy"?"heavy":pattern.type==="multi"?"multi":"attack",label:pattern.name??(enraged?"狂暴攻擊":"普通攻擊"),damage,healing:0,hits,previewDamage:0,previewHits:1,shieldPierce:0,enraged,phase:phaseName};
  }

  return {
    type:"charging",
    label:pattern.type==="heavy"?(pattern.name+"蓄力中"):"蓄力中",
    damage:0,
    healing:0,
    hits:1,
    previewDamage:damage,
    previewHits:hits,
    shieldPierce:0,
    enraged,
    phase:phaseName
  };
}
export function resolveEnemyTurn(state){
  assertCampaignState(state);
  if(state.completed)throw new Error("Cannot resolve an enemy turn after stage completion");
  const encounter=getCurrentEncounter(state);
  const intent=getEnemyIntent(state);
  const nextState={...state,turn:state.turn+1};
  let resolvedIntent=intent;
  if(intent.type==="heal"){
    const actualHealing=Math.min(intent.healing,encounter.hp-state.enemyHp);
    nextState.enemyHp=state.enemyHp+actualHealing;
    resolvedIntent={...intent,healing:actualHealing};
  }

  let message;
  if(resolvedIntent.type==="heal")message=resolvedIntent.label+"！回復 "+resolvedIntent.healing+" HP。";
  else if(resolvedIntent.type==="special"||resolvedIntent.type==="multi")message=resolvedIntent.label+"！"+(resolvedIntent.hits>1?"分 "+resolvedIntent.hits+" 段":"")+"造成 "+resolvedIntent.damage+" 點傷害。";
  else if(resolvedIntent.type==="heavy")message=resolvedIntent.label+"！造成 "+resolvedIntent.damage+" 點重擊。";
  else if(resolvedIntent.type==="attack")message=resolvedIntent.label+"，造成 "+resolvedIntent.damage+" 點傷害。";
  else message=intent.label+"。";

  return {state:nextState,intent:resolvedIntent,incomingDamage:resolvedIntent.damage,message};
}

export function mitigateIncomingDamage(incomingDamage,shield,shieldPierce=0,hitCount=1){
  if(!Number.isFinite(incomingDamage)||incomingDamage<0)throw new RangeError("incomingDamage must be a non-negative finite number");
  if(!Number.isFinite(shield)||shield<0)throw new RangeError("shield must be a non-negative finite number");
  if(!Number.isFinite(shieldPierce)||shieldPierce<0||shieldPierce>1)throw new RangeError("shieldPierce must be between 0 and 1");
  if(!Number.isInteger(hitCount)||hitCount<1||hitCount>10)throw new RangeError("hitCount must be an integer between 1 and 10");

  let remainingShield=shield,remainingDamage=incomingDamage,hpDamage=0,shieldDamage=0,piercingDamage=0;
  const hitResults=[];
  for(let index=0;index<hitCount;index++){
    const hitDamage=index===hitCount-1?remainingDamage:Math.min(remainingDamage,Math.ceil(incomingDamage/hitCount));
    remainingDamage-=hitDamage;
    const hitPiercing=Math.ceil(hitDamage*shieldPierce);
    const shieldableDamage=hitDamage-hitPiercing;
    const absorbed=Math.min(remainingShield,shieldableDamage);
    const hitHpDamage=hitDamage-absorbed;
    remainingShield-=absorbed;
    hpDamage+=hitHpDamage;
    shieldDamage+=absorbed;
    piercingDamage+=hitPiercing;
    hitResults.push({damage:hitDamage,piercingDamage:hitPiercing,shieldDamage:absorbed,hpDamage:hitHpDamage});
  }
  return {hpDamage,shieldDamage,remainingShield,piercingDamage,hitResults};
}

export function advanceCampaignStage(state){
  assertCampaignState(state);
  if(!state.completed)throw new Error("Defeat the stage boss before advancing");
  if(state.stageIndex>=STAGES.length-1||state.campaignComplete)throw new Error("The campaign is already complete");
  return createCampaignState(state.stageIndex+1);
}
