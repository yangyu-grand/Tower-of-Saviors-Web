import { STAGES } from "./stages.js";

export const BATTLE_STATS_VERSION = 1;
const REWARD_FIELDS = Object.freeze(["gold", "summonStones", "awakeningShards", "prismCores"]);
const COUNTER_FIELDS = Object.freeze([
  "turns", "comboSteps", "bestCombo", "runesMatched", "damageDealt",
  "healingDone", "hpDamageTaken", "shieldAbsorbed", "expEarned", "scoreEarned"
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertSafeInteger(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(label + " must be a safe integer between " + min + " and " + max);
  }
}

function assertStageIndex(stageIndex) {
  if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex >= STAGES.length) {
    throw new RangeError("Unknown battle-stat stage index: " + String(stageIndex));
  }
}

export function createBattleStats(stageIndex = 0, options = {}) {
  assertStageIndex(stageIndex);
  if (!isRecord(options)) throw new TypeError("Battle-stat options must be an object");
  const stageCompleted = options.stageCompleted === true;
  const resultDismissed = options.resultDismissed === true;
  if (resultDismissed && !stageCompleted) throw new RangeError("An unfinished stage cannot have a dismissed result");
  return {
    version: BATTLE_STATS_VERSION,
    stageIndex,
    turns: 0,
    comboSteps: 0,
    bestCombo: 0,
    runesMatched: 0,
    damageDealt: 0,
    healingDone: 0,
    hpDamageTaken: 0,
    shieldAbsorbed: 0,
    expEarned: 0,
    scoreEarned: 0,
    defeatedEncounterIds: [],
    rewards: { gold: 0, summonStones: 0, awakeningShards: 0, prismCores: 0 },
    stageCompleted,
    resultDismissed
  };
}

export function normalizeBattleStats(input) {
  if (!isRecord(input) || input.version !== BATTLE_STATS_VERSION) {
    throw new RangeError("Unsupported or invalid battle-stat version");
  }
  assertStageIndex(input.stageIndex);
  for (const field of COUNTER_FIELDS) assertSafeInteger(input[field], field);
  if (input.bestCombo > 12 || input.bestCombo > input.comboSteps) {
    throw new RangeError("bestCombo is outside the valid range");
  }
  const stageEncounterIds = new Set(STAGES[input.stageIndex].waves.map((wave) => wave.id));
  if (!Array.isArray(input.defeatedEncounterIds) || input.defeatedEncounterIds.length > stageEncounterIds.size) {
    throw new TypeError("defeatedEncounterIds must be a list for the current stage");
  }
  const defeatedEncounterIds = [];
  const seen = new Set();
  for (const encounterId of input.defeatedEncounterIds) {
    if (typeof encounterId !== "string" || !stageEncounterIds.has(encounterId)) {
      throw new RangeError("Battle stats contain an unknown encounter id");
    }
    if (seen.has(encounterId)) throw new RangeError("Defeated encounters must be unique");
    seen.add(encounterId);
    defeatedEncounterIds.push(encounterId);
  }
  if (!isRecord(input.rewards) || Object.keys(input.rewards).some((key) => !REWARD_FIELDS.includes(key))) {
    throw new TypeError("Battle rewards contain an unknown field");
  }
  const rewards = {};
  for (const field of REWARD_FIELDS) {
    rewards[field] = input.rewards[field] ?? 0;
    assertSafeInteger(rewards[field], "reward " + field);
  }
  if (typeof input.stageCompleted !== "boolean" || typeof input.resultDismissed !== "boolean") {
    throw new TypeError("Battle result flags must be boolean");
  }
  if (input.resultDismissed && !input.stageCompleted) {
    throw new RangeError("An unfinished stage cannot have a dismissed result");
  }
  return {
    version: BATTLE_STATS_VERSION,
    stageIndex: input.stageIndex,
    turns: input.turns,
    comboSteps: input.comboSteps,
    bestCombo: input.bestCombo,
    runesMatched: input.runesMatched,
    damageDealt: input.damageDealt,
    healingDone: input.healingDone,
    hpDamageTaken: input.hpDamageTaken,
    shieldAbsorbed: input.shieldAbsorbed,
    expEarned: input.expEarned,
    scoreEarned: input.scoreEarned,
    defeatedEncounterIds,
    rewards,
    stageCompleted: input.stageCompleted,
    resultDismissed: input.resultDismissed
  };
}

export function recordBattleTurn(input, event) {
  const current = normalizeBattleStats(input);
  if (current.stageCompleted) throw new Error("Cannot record a turn after stage completion");
  if (!isRecord(event)) throw new TypeError("Battle-turn event must be an object");
  assertSafeInteger(event.combo, "combo", 1, 12);
  assertSafeInteger(event.runesMatched, "runesMatched", 3, 30);
  const increments = {};
  for (const field of ["damageDealt", "healingDone", "hpDamageTaken", "shieldAbsorbed", "expEarned", "scoreEarned"]) {
    increments[field] = event[field] ?? 0;
    assertSafeInteger(increments[field], field);
  }
  return normalizeBattleStats({
    ...current,
    turns: current.turns + 1,
    comboSteps: current.comboSteps + event.combo,
    bestCombo: Math.max(current.bestCombo, event.combo),
    runesMatched: current.runesMatched + event.runesMatched,
    damageDealt: current.damageDealt + increments.damageDealt,
    healingDone: current.healingDone + increments.healingDone,
    hpDamageTaken: current.hpDamageTaken + increments.hpDamageTaken,
    shieldAbsorbed: current.shieldAbsorbed + increments.shieldAbsorbed,
    expEarned: current.expEarned + increments.expEarned,
    scoreEarned: current.scoreEarned + increments.scoreEarned
  });
}

export function recordEncounterDefeat(input, encounterId, reward = {}) {
  const current = normalizeBattleStats(input);
  if (current.stageCompleted) throw new Error("Cannot record a defeat after stage completion");
  const encounterExists = STAGES[current.stageIndex].waves.some((wave) => wave.id === encounterId);
  if (!encounterExists) throw new RangeError("Encounter does not belong to the current stage");
  if (current.defeatedEncounterIds.includes(encounterId)) return current;
  if (!isRecord(reward) || Object.keys(reward).some((key) => ![...REWARD_FIELDS, "score"].includes(key))) {
    throw new TypeError("Encounter reward contains an unknown field");
  }
  const nextRewards = { ...current.rewards };
  for (const field of REWARD_FIELDS) {
    const amount = reward[field] ?? 0;
    assertSafeInteger(amount, "reward " + field);
    nextRewards[field] += amount;
    assertSafeInteger(nextRewards[field], "total reward " + field);
  }
  const score = reward.score ?? 0;
  assertSafeInteger(score, "reward score");
  return normalizeBattleStats({
    ...current,
    scoreEarned: current.scoreEarned + score,
    defeatedEncounterIds: [...current.defeatedEncounterIds, encounterId],
    rewards: nextRewards
  });
}

export function completeBattleStats(input) {
  const current = normalizeBattleStats(input);
  const expected = STAGES[current.stageIndex].waves.map((wave) => wave.id);
  if (!expected.every((encounterId) => current.defeatedEncounterIds.includes(encounterId))) {
    throw new Error("Every encounter in the stage must be defeated before completion");
  }
  if (current.stageCompleted) return current;
  return normalizeBattleStats({ ...current, stageCompleted: true, resultDismissed: false });
}

export function dismissBattleResult(input) {
  const current = normalizeBattleStats(input);
  if (!current.stageCompleted) throw new Error("There is no completed-stage result to dismiss");
  if (current.resultDismissed) return current;
  return normalizeBattleStats({ ...current, resultDismissed: true });
}

export function buildBattleResult(input) {
  const stats = normalizeBattleStats(input);
  const stage = STAGES[stats.stageIndex];
  return {
    stageId: stage.id,
    stageName: stage.name,
    difficulty: stage.difficulty,
    bossName: stage.waves[stage.waves.length - 1].name,
    totalWaves: stage.waves.length,
    wavesDefeated: stats.defeatedEncounterIds.length,
    ...Object.fromEntries(COUNTER_FIELDS.map((field) => [field, stats[field]])),
    rewards: { ...stats.rewards },
    stageCompleted: stats.stageCompleted,
    resultDismissed: stats.resultDismissed
  };
}
