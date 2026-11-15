export const ACTIVE_SKILLS = Object.freeze({
  ember_scout: Object.freeze({ id: "flame_surge", name: "烈焰突襲", description: "下一次成功攻擊傷害提升 50%。", cooldown: 4, type: "damageBoost", multiplier: 1.5 }),
  tide_monk: Object.freeze({ id: "tide_call", name: "潮汐呼喚", description: "將最多 5 顆非水符石轉為水符石。", cooldown: 4, type: "convert", target: "water", count: 5 }),
  moss_guard: Object.freeze({ id: "moss_barrier", name: "苔甲壁壘", description: "獲得 20 點護盾，抵擋後續敵人攻擊。", cooldown: 4, type: "shield", amount: 20 }),
  dawn_archer: Object.freeze({ id: "star_arrow", name: "晨星箭雨", description: "下一次成功攻擊傷害提升 35%。", cooldown: 3, type: "damageBoost", multiplier: 1.35 }),
  heart_priest: Object.freeze({ id: "heart_benediction", name: "心燈祝福", description: "立即回復隊伍生命上限的 25%。", cooldown: 4, type: "heal", fraction: 0.25 }),
  dusk_mage: Object.freeze({ id: "nightfall", name: "暮影降臨", description: "下一次成功攻擊傷害提升 40%。", cooldown: 4, type: "damageBoost", multiplier: 1.4 }),
  cinder_knight: Object.freeze({ id: "cinder_brand", name: "燼火烙印", description: "將最多 4 顆非火符石轉為火符石。", cooldown: 4, type: "convert", target: "fire", count: 4 }),
  river_oracle: Object.freeze({ id: "river_mist", name: "河灣甘霖", description: "將最多 5 顆非心符石轉為心符石。", cooldown: 4, type: "convert", target: "heart", count: 5 }),
  thorn_ranger: Object.freeze({ id: "thorn_volley", name: "荊棘連射", description: "下一次成功攻擊傷害提升 30%。", cooldown: 3, type: "damageBoost", multiplier: 1.3 }),
  moon_sentinel: Object.freeze({ id: "moon_aegis", name: "月影守護", description: "獲得 28 點護盾，抵擋後續敵人攻擊。", cooldown: 4, type: "shield", amount: 28 }),
  azure_minstrel: Object.freeze({ id: "azure_resonance", name: "蒼潮共鳴", description: "下一次成功攻擊傷害提升 25%。", cooldown: 3, type: "damageBoost", multiplier: 1.25 }),
  verdant_alchemist: Object.freeze({ id: "verdant_transmute", name: "翠森轉化", description: "將最多 5 顆非木符石轉為木符石。", cooldown: 4, type: "convert", target: "wood", count: 5 }),
  astral_scribe: Object.freeze({ id: "astral_script", name: "星界秘文", description: "下一次成功攻擊傷害提升 35%。", cooldown: 4, type: "damageBoost", multiplier: 1.35 }),
  abyss_weaver: Object.freeze({ id: "abyss_ward", name: "深淵結界", description: "獲得 35 點護盾，抵擋後續敵人攻擊。", cooldown: 4, type: "shield", amount: 35 }),
  solar_archon: Object.freeze({ id: "solar_judgement", name: "曜日裁決", description: "下一次成功攻擊傷害提升 55%。", cooldown: 4, type: "damageBoost", multiplier: 1.55 })
});

function cloneSkillStates(states = {}) {
  return Object.fromEntries(Object.entries(states).map(([cardId, state]) => [cardId, {
    remaining: Number.isInteger(state?.remaining) && state.remaining > 0 ? state.remaining : 0,
    justActivated: state?.justActivated === true
  }]));
}

export function createSkillStates(cardIds, previousStates = {}) {
  if (!Array.isArray(cardIds)) throw new TypeError("cardIds must be an array");
  const previous = cloneSkillStates(previousStates);
  return Object.fromEntries(cardIds.map((cardId) => {
    if (!ACTIVE_SKILLS[cardId]) throw new RangeError("No active skill for card: " + String(cardId));
    return [cardId, previous[cardId] ?? { remaining: 0, justActivated: false }];
  }));
}

export function canActivateSkill(cardId, skillStates, isResolving = false) {
  const skill = ACTIVE_SKILLS[cardId];
  const state = skillStates?.[cardId];
  return Boolean(skill && state && !isResolving && state.remaining === 0);
}

export function activateSkill({
  cardId, skillStates, board, hp, maxHp, shield = 0,
  damageMultiplier = 1, random = Math.random
}) {
  const skill = ACTIVE_SKILLS[cardId];
  if (!skill) throw new RangeError("Unknown active skill card: " + String(cardId));
  if (!canActivateSkill(cardId, skillStates)) throw new Error("Skill is unavailable or on cooldown");
  if (!Array.isArray(board)) throw new TypeError("board must be an array");
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0 || hp < 0 || hp > maxHp) {
    throw new RangeError("hp and maxHp must describe a valid health value");
  }
  if (!Number.isFinite(shield) || shield < 0) throw new RangeError("shield must be non-negative");
  if (!Number.isFinite(damageMultiplier) || damageMultiplier < 1 || damageMultiplier > 10) {
    throw new RangeError("damageMultiplier must be between 1 and 10");
  }
  if (typeof random !== "function") throw new TypeError("random must be a function");

  const nextBoard = [...board];
  let nextHp = hp;
  let nextShield = shield;
  let nextDamageMultiplier = damageMultiplier;
  let changed = 0;
  let restored = 0;

  if (skill.type === "convert") {
    const candidates = nextBoard.map((rune, index) => rune !== skill.target ? index : -1).filter((index) => index >= 0);
    for (let i = candidates.length - 1; i > 0; i--) {
      const sample = random();
      if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new RangeError("random must return a value in [0, 1)");
      const j = Math.floor(sample * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const selected = candidates.slice(0, Math.min(skill.count, candidates.length));
    selected.forEach((index) => { nextBoard[index] = skill.target; });
    changed = selected.length;
  } else if (skill.type === "damageBoost") {
    nextDamageMultiplier = Math.max(nextDamageMultiplier, skill.multiplier);
  } else if (skill.type === "shield") {
    nextShield += skill.amount;
  } else if (skill.type === "heal") {
    restored = Math.min(maxHp - hp, Math.ceil(maxHp * skill.fraction));
    nextHp += restored;
  }

  const nextSkillStates = cloneSkillStates(skillStates);
  nextSkillStates[cardId] = { remaining: skill.cooldown, justActivated: true };
  const detail = skill.type === "convert" ? "轉換 " + changed + " 顆符石" :
    skill.type === "damageBoost" ? "下一次攻擊倍率 " + nextDamageMultiplier.toFixed(2) + "×" :
    skill.type === "shield" ? "護盾增加 " + skill.amount : "回復 " + restored + " HP";

  return {
    skillStates: nextSkillStates,
    board: nextBoard,
    hp: nextHp,
    shield: nextShield,
    damageMultiplier: nextDamageMultiplier,
    changed,
    restored,
    summary: skill.name + "：" + detail
  };
}

export function advanceSkillCooldowns(skillStates) {
  return Object.fromEntries(Object.entries(cloneSkillStates(skillStates)).map(([cardId, state]) => [cardId, {
    remaining: state.justActivated ? state.remaining : Math.max(0, state.remaining - 1),
    justActivated: false
  }]));
}
