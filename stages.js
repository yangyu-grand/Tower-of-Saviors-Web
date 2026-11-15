export const STAGES = Object.freeze([
  Object.freeze({
    id: "ash-road",
    name: "灰燼山徑",
    difficulty: "初階",
    waves: Object.freeze([
      Object.freeze({ id: "lava-wyrmling", name: "熔岩幼龍", emoji: "🐉", element: "fire", hp: 180, attack: 9, attackEvery: 1 }),
      Object.freeze({ id: "cinder-guard", name: "燼甲守衛", emoji: "🛡️", element: "fire", hp: 260, attack: 12, attackEvery: 1 }),
      Object.freeze({
        id: "ash-dragon-king", name: "灰燼龍王", emoji: "🐲", element: "fire",
        hp: 620, attack: 16, attackEvery: 2, boss: true,
        special: Object.freeze({ every: 3, name: "熔火吐息", damage: 34, shieldPierce: 0.5 }),
        enrageAt: 0.5, enrageMultiplier: 1.5
      })
    ])
  }),
  Object.freeze({
    id: "tide-ruins",
    name: "潮汐遺跡",
    difficulty: "進階",
    waves: Object.freeze([
      Object.freeze({ id: "reef-stalker", name: "礁影獵手", emoji: "🦈", element: "water", hp: 300, attack: 14, attackEvery: 1 }),
      Object.freeze({ id: "coral-sentinel", name: "珊瑚守衛", emoji: "🪸", element: "water", hp: 390, attack: 16, attackEvery: 1 }),
      Object.freeze({
        id: "abyss-leviathan", name: "深淵海皇", emoji: "🐋", element: "water",
        hp: 850, attack: 20, attackEvery: 2, boss: true,
        special: Object.freeze({ every: 3, name: "深海洪流", damage: 42, shieldPierce: 0.4 }),
        enrageAt: 0.5, enrageMultiplier: 1.5
      })
    ])
  }),
  Object.freeze({
    id: "eclipse-throne",
    name: "蝕月王座",
    difficulty: "菁英",
    waves: Object.freeze([
      Object.freeze({ id: "night-wisp", name: "夜幕幽靈", emoji: "👻", element: "dark", hp: 420, attack: 17, attackEvery: 1 }),
      Object.freeze({ id: "prism-golem", name: "稜鏡魔像", emoji: "🔮", element: "light", hp: 520, attack: 19, attackEvery: 1 }),
      Object.freeze({
        id: "eclipse-sovereign", name: "蝕月君主", emoji: "🌘", element: "dark",
        hp: 1100, attack: 25, attackEvery: 2, boss: true,
        special: Object.freeze({ every: 3, name: "日蝕裁決", damage: 54, shieldPierce: 0.5 }),
        enrageAt: 0.5, enrageMultiplier: 1.6
      })
    ])
  })
]);

function assertCampaignState(state) {
  if (!state || !Number.isInteger(state.stageIndex) || state.stageIndex < 0 || state.stageIndex >= STAGES.length) {
    throw new RangeError("Invalid campaign stage index");
  }
  const stage = STAGES[state.stageIndex];
  if (!Number.isInteger(state.waveIndex) || state.waveIndex < 0 || state.waveIndex >= stage.waves.length) {
    if (!(state.completed === true && state.waveIndex === stage.waves.length - 1)) {
      throw new RangeError("Invalid campaign wave index");
    }
  }
  if (!Number.isInteger(state.turn) || state.turn < 0) throw new RangeError("turn must be a non-negative integer");
  if (!Number.isFinite(state.enemyHp) || state.enemyHp < 0) throw new RangeError("enemyHp must be non-negative");
  return stage;
}

export function createCampaignState(stageIndex = 0) {
  if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex >= STAGES.length) {
    throw new RangeError("Unknown stage index: " + String(stageIndex));
  }
  const first = STAGES[stageIndex].waves[0];
  return { stageIndex, waveIndex: 0, turn: 0, enemyHp: first.hp, completed: false, campaignComplete: false };
}

export function getCurrentStage(state) {
  return STAGES[assertCampaignState(state).stageIndex];
}

export function getCurrentEncounter(state) {
  const stage = assertCampaignState(state);
  return state.completed ? null : stage.waves[state.waveIndex];
}

export function damageCurrentEnemy(state, damage) {
  const stage = assertCampaignState(state);
  if (state.completed) throw new Error("The current stage is already complete");
  if (!Number.isFinite(damage) || damage < 0) throw new RangeError("damage must be a non-negative finite number");

  const encounter = stage.waves[state.waveIndex];
  const enemyHp = Math.max(0, state.enemyHp - damage);
  if (enemyHp > 0) {
    return {
      state: { ...state, enemyHp },
      defeated: false,
      defeatedEnemy: null,
      nextEncounter: encounter,
      stageCompleted: false,
      campaignCompleted: false
    };
  }

  const defeatedEnemy = encounter;
  const nextWaveIndex = state.waveIndex + 1;
  if (nextWaveIndex < stage.waves.length) {
    const nextEncounter = stage.waves[nextWaveIndex];
    return {
      state: { ...state, waveIndex: nextWaveIndex, turn: 0, enemyHp: nextEncounter.hp },
      defeated: true,
      defeatedEnemy,
      nextEncounter,
      stageCompleted: false,
      campaignCompleted: false
    };
  }

  const campaignCompleted = state.stageIndex === STAGES.length - 1;
  const nextState = {
    ...state,
    enemyHp: 0,
    completed: true,
    campaignComplete: campaignCompleted
  };
  return {
    state: nextState,
    defeated: true,
    defeatedEnemy,
    nextEncounter: null,
    stageCompleted: true,
    campaignCompleted
  };
}

export function getEnemyIntent(state) {
  const encounter = getCurrentEncounter(state);
  if (!encounter) return { type: "none", label: "關卡已完成", damage: 0, shieldPierce: 0, enraged: false };

  const nextTurn = state.turn + 1;
  const enraged = Number.isFinite(encounter.enrageAt)
    && state.enemyHp <= encounter.hp * encounter.enrageAt;
  const multiplier = enraged ? (encounter.enrageMultiplier ?? 1) : 1;
  const special = encounter.special;

  if (special && nextTurn % special.every === 0) {
    return {
      type: "special",
      label: special.name,
      damage: Math.ceil(special.damage * multiplier),
      shieldPierce: special.shieldPierce ?? 0,
      enraged
    };
  }
  if (nextTurn % encounter.attackEvery === 0) {
    return {
      type: "attack",
      label: enraged ? "狂暴攻擊" : "普通攻擊",
      damage: Math.ceil(encounter.attack * multiplier),
      shieldPierce: 0,
      enraged
    };
  }
  return { type: "charging", label: "蓄力中", damage: 0, shieldPierce: 0, enraged };
}

export function resolveEnemyTurn(state) {
  assertCampaignState(state);
  if (state.completed) throw new Error("Cannot resolve an enemy turn after stage completion");
  const intent = getEnemyIntent(state);
  return {
    state: { ...state, turn: state.turn + 1 },
    intent,
    incomingDamage: intent.damage,
    message: intent.type === "special"
      ? intent.label + "！造成 " + intent.damage + " 點傷害。"
      : intent.type === "attack"
        ? intent.label + "，造成 " + intent.damage + " 點傷害。"
        : "敵人正在蓄力。"
  };
}

export function mitigateIncomingDamage(incomingDamage, shield, shieldPierce = 0) {
  if (!Number.isFinite(incomingDamage) || incomingDamage < 0) {
    throw new RangeError("incomingDamage must be a non-negative finite number");
  }
  if (!Number.isFinite(shield) || shield < 0) throw new RangeError("shield must be a non-negative finite number");
  if (!Number.isFinite(shieldPierce) || shieldPierce < 0 || shieldPierce > 1) {
    throw new RangeError("shieldPierce must be between 0 and 1");
  }

  const piercingDamage = Math.ceil(incomingDamage * shieldPierce);
  const shieldableDamage = incomingDamage - piercingDamage;
  const shieldDamage = Math.min(shield, shieldableDamage);
  return {
    hpDamage: incomingDamage - shieldDamage,
    shieldDamage,
    remainingShield: shield - shieldDamage,
    piercingDamage
  };
}

export function advanceCampaignStage(state) {
  const stage = assertCampaignState(state);
  if (!state.completed) throw new Error("Defeat the stage boss before advancing");
  if (state.stageIndex >= STAGES.length - 1 || state.campaignComplete) {
    throw new Error("The campaign is already complete");
  }
  return createCampaignState(state.stageIndex + 1);
}
