import {
  createRuneBoard,
  createSeededRandom,
  findRuneMatches,
  hasLegalRuneSwap
} from "./runeBoard.js";
import { analyzeRuneMoves, traceRuneMove } from "./runeMoveAnalysis.js";
import { DEFAULT_TEAM, buildTeam } from "./team.js";
import {
  STAGES,
  createCampaignState,
  getCurrentEncounter,
  getEnemyIntent,
  damageCurrentEnemy,
  resolveEnemyTurn,
  mitigateIncomingDamage
} from "./stages.js";
import {
  getActiveSkill,
  createSkillStates,
  canActivateSkill,
  activateSkill,
  advanceSkillCooldowns
} from "./skills.js";

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(label + " must be an object");
  }
}

function assertInteger(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(label + " must be an integer between " + minimum + " and " + maximum);
  }
}

function assertSafeSeed(seed) {
  if (!Number.isSafeInteger(seed)) throw new TypeError("seed must be a safe integer");
}

function deriveSeed(seed, turn, salt = 0) {
  return ((seed >>> 0) ^ Math.imul(turn + 1, 0x9E3779B1) ^ (salt >>> 0)) >>> 0;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function makeMoveAnalysis(board, {
  seed,
  turn,
  waveIndex,
  encounter,
  team,
  levels,
  evolutionLevels,
  costLimit,
  healingWeight,
  maxCascades,
  skillMultiplier = 1
}) {
  return analyzeRuneMoves(board, {
    seed: deriveSeed(seed, turn + waveIndex * 211, 0xA5A5A5A5),
    enemyElement: encounter.element,
    teamCardIds: team.cardIds,
    levels,
    evolutionLevels,
    costLimit,
    healingWeight,
    maxCascades,
    skillMultiplier
  });
}

function chooseGreedySkill({
  team,
  skillStates,
  skillLevels,
  board,
  partyHp,
  shield,
  enemyHp,
  intent,
  leaderDamageReduction,
  baseAnalysis,
  seed,
  turn,
  analysisContext
}) {
  const candidates = [];
  const forecastDamage = intent.type === "charging" ? intent.previewDamage : intent.damage;
  const forecastHits = intent.type === "charging" ? intent.previewHits : intent.hits;
  const adjustedForecast = Math.ceil((forecastDamage ?? 0) * (1 - leaderDamageReduction));
  const hitCount = Math.max(1, forecastHits ?? 1);
  const shieldPierce = intent.shieldPierce ?? 0;
  const beforeMitigation = mitigateIncomingDamage(adjustedForecast, shield, shieldPierce, hitCount);

  for (let index = 0; index < team.cardIds.length; index += 1) {
    const cardId = team.cardIds[index];
    const skillLevel = skillLevels[cardId] ?? 1;
    const skill = getActiveSkill(cardId, skillLevel);
    if (!canActivateSkill(cardId, skillStates)) continue;

    const activation = activateSkill({
      cardId,
      skillStates,
      board,
      hp: partyHp,
      maxHp: team.totalHp,
      shield,
      damageMultiplier: 1,
      random: createSeededRandom(deriveSeed(seed, turn, index + 17)),
      skillLevel
    });

    if (skill.type === "heal") {
      const usefulThreshold = Math.max(1, Math.ceil(team.totalHp * 0.08));
      if (activation.restored >= usefulThreshold) {
        candidates.push({ priority: 4, index, cardId, skill, skillLevel, activation, analysis: null });
      }
      continue;
    }

    if (skill.type === "shield") {
      if (adjustedForecast <= 0) continue;
      const afterMitigation = mitigateIncomingDamage(
        adjustedForecast,
        activation.shield,
        shieldPierce,
        hitCount
      );
      if (afterMitigation.hpDamage < beforeMitigation.hpDamage) {
        candidates.push({ priority: 3, index, cardId, skill, skillLevel, activation, analysis: null });
      }
      continue;
    }

    if (skill.type === "damageBoost") {
      const bestMove = baseAnalysis.summary.bestMove;
      if (bestMove && bestMove.damage > 0 && bestMove.damage < enemyHp &&
          activation.damageMultiplier > 1) {
        candidates.push({ priority: 2, index, cardId, skill, skillLevel, activation, analysis: null });
      }
      continue;
    }

    if (skill.type === "convert") {
      const targetHasValue = skill.target === "heart" || team.attackByElement[skill.target] > 0;
      if (!targetHasValue || findRuneMatches(activation.board).size > 0) continue;
      const convertedAnalysis = makeMoveAnalysis(activation.board, {
        ...analysisContext,
        seed: deriveSeed(seed, turn, index + 701)
      });
      const baseUtility = baseAnalysis.summary.bestMove?.utility ?? 0;
      const convertedUtility = convertedAnalysis.summary.bestMove?.utility ?? 0;
      if (convertedAnalysis.summary.bestMove && convertedUtility > baseUtility) {
        candidates.push({
          priority: 1,
          index,
          cardId,
          skill,
          skillLevel,
          activation,
          analysis: convertedAnalysis
        });
      }
    }
  }

  candidates.sort((left, right) => right.priority - left.priority || left.index - right.index);
  return candidates[0] ?? null;
}

/**
 * Simulate one real 6x5-board encounter. Each turn selects the highest-utility
 * legal move, applies one useful ready active skill at most, then resolves the
 * existing enemy intent, boss phase, shield, and leader damage-reduction rules.
 *
 * This is a deterministic greedy policy benchmark, not a human-play prediction.
 */
export function simulateRuneEncounter(options = {}) {
  assertRecord(options, "options");
  const stageIndex = options.stageIndex ?? 0;
  assertInteger(stageIndex, 0, STAGES.length - 1, "stageIndex");
  const stage = STAGES[stageIndex];
  const waveIndex = options.waveIndex ?? 0;
  assertInteger(waveIndex, 0, stage.waves.length - 1, "waveIndex");
  const encounter = stage.waves[waveIndex];

  const teamIds = options.teamIds ?? DEFAULT_TEAM;
  const levels = options.levels ?? {};
  const evolutionLevels = options.evolutionLevels ?? {};
  const costLimit = options.costLimit ?? 30;
  const team = buildTeam(teamIds, { levels, evolutionLevels, costLimit });
  for (const cardId of team.cardIds) getActiveSkill(cardId, options.skillLevels?.[cardId] ?? 1);

  const seed = options.seed ?? 1;
  assertSafeSeed(seed);
  const maxTurns = options.maxTurns ?? 60;
  assertInteger(maxTurns, 1, 200, "maxTurns");
  const skillPolicy = options.skillPolicy ?? "greedy";
  if (skillPolicy !== "greedy" && skillPolicy !== "none") {
    throw new RangeError("skillPolicy must be greedy or none");
  }
  const healingWeight = options.healingWeight ?? 0.5;
  if (!Number.isFinite(healingWeight) || healingWeight < 0 || healingWeight > 5) {
    throw new RangeError("healingWeight must be between 0 and 5");
  }
  const maxCascades = options.maxCascades ?? 12;
  assertInteger(maxCascades, 1, 30, "maxCascades");
  const skillLevels = options.skillLevels ?? {};
  const initialSkillStates = options.initialSkillStates ?? {};
  assertRecord(skillLevels, "skillLevels");
  assertRecord(initialSkillStates, "initialSkillStates");

  const initialShield = options.initialShield ?? 0;
  if (!Number.isSafeInteger(initialShield) || initialShield < 0) {
    throw new RangeError("initialShield must be a non-negative safe integer");
  }
  const startingPartyHp = options.startingPartyHp ?? team.totalHp;
  if (!Number.isSafeInteger(startingPartyHp) || startingPartyHp < 1 || startingPartyHp > team.totalHp) {
    throw new RangeError("startingPartyHp must be between 1 and team total HP");
  }
  const startingEnemyHp = options.startingEnemyHp ?? encounter.hp;
  if (!Number.isSafeInteger(startingEnemyHp) || startingEnemyHp < 1 || startingEnemyHp > encounter.hp) {
    throw new RangeError("startingEnemyHp must be between 1 and encounter HP");
  }

  let state = {
    ...createCampaignState(stageIndex),
    waveIndex,
    enemyHp: startingEnemyHp
  };
  let partyHp = startingPartyHp;
  let shield = initialShield;
  let skillStates = createSkillStates(team.cardIds, initialSkillStates);
  let board = options.initialBoard ? [...options.initialBoard] :
    createRuneBoard({ random: createSeededRandom(deriveSeed(seed, 0, 0xB04D)) });
  if (findRuneMatches(board).size > 0) {
    throw new RangeError("initialBoard must not contain unresolved matches");
  }

  let reshuffleCount = 0;
  if (!hasLegalRuneSwap(board)) {
    board = createRuneBoard({ random: createSeededRandom(deriveSeed(seed, 0, 0xDEAD)) });
    reshuffleCount += 1;
  }

  const leaderDamageReduction = team.leaderSkill?.damageReduction ?? 0;
  let victory = false;
  let partyDefeated = false;
  let totalDamageDealt = 0;
  let totalHealingApplied = 0;
  let totalSkillHealing = 0;
  let totalEnemyHealing = 0;
  let totalEnemyDamageBeforeReduction = 0;
  let totalEnemyDamageAfterReduction = 0;
  let totalHpDamageTaken = 0;
  let totalShieldAbsorbed = 0;
  let totalActiveSkillUses = 0;
  const phaseNames = [];
  const turns = [];

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const currentEncounter = getCurrentEncounter(state);
    if (!currentEncounter) break;
    const boardAtTurnStart = [...board];
    let reshuffledBeforeMove = false;

    const intentPreview = getEnemyIntent(state);
    const analysisContext = {
      seed,
      turn,
      waveIndex: state.waveIndex,
      encounter: currentEncounter,
      team,
      levels,
      evolutionLevels,
      costLimit,
      healingWeight,
      maxCascades
    };
    let analysis = makeMoveAnalysis(board, analysisContext);
    if (!analysis.summary.bestMove) {
      board = createRuneBoard({ random: createSeededRandom(deriveSeed(seed, turn, 0xDEAD)) });
      reshuffleCount += 1;
      reshuffledBeforeMove = true;
      analysis = makeMoveAnalysis(board, analysisContext);
    }

    let skillEvent = null;
    let damageMultiplier = 1;
    if (skillPolicy === "greedy") {
      const choice = chooseGreedySkill({
        team,
        skillStates,
        skillLevels,
        board,
        partyHp,
        shield,
        enemyHp: state.enemyHp,
        intent: intentPreview,
        leaderDamageReduction,
        baseAnalysis: analysis,
        seed,
        turn,
        analysisContext
      });
      if (choice) {
        const previousShield = shield;
        skillStates = choice.activation.skillStates;
        partyHp = choice.activation.hp;
        shield = choice.activation.shield;
        board = choice.activation.board;
        damageMultiplier = choice.activation.damageMultiplier;
        totalSkillHealing += choice.activation.restored;
        totalHealingApplied += choice.activation.restored;
        totalActiveSkillUses += 1;
        skillEvent = {
          cardId: choice.cardId,
          skillId: choice.skill.id,
          name: choice.skill.name,
          type: choice.skill.type,
          skillLevel: choice.skillLevel,
          changed: choice.activation.changed,
          restored: choice.activation.restored,
          shieldAdded: choice.activation.shield - previousShield,
          damageMultiplier
        };
        if (choice.analysis) {
          analysis = choice.analysis;
        } else if (choice.skill.type === "damageBoost") {
          analysis = makeMoveAnalysis(board, {
            ...analysisContext,
            seed: deriveSeed(seed, turn, 0xDADA),
            skillMultiplier: damageMultiplier
          });
        }
      }
    }

    if (!analysis.summary.bestMove) {
      board = createRuneBoard({ random: createSeededRandom(deriveSeed(seed, turn, 0xF00D)) });
      reshuffleCount += 1;
      reshuffledBeforeMove = true;
      analysis = makeMoveAnalysis(board, {
        ...analysisContext,
        seed: deriveSeed(seed, turn, 0xF00D),
        skillMultiplier: damageMultiplier
      });
    }

    const move = analysis.moves[0];
    if (!move) throw new Error("A playable board must provide at least one legal move");
    const boardBeforeMove = [...board];
    const moveTrace = traceRuneMove(boardBeforeMove, move, {
      seed: analysis.seed,
      maxCascades
    });
    const enemyHpBeforeAttack = state.enemyHp;
    const damageResult = damageCurrentEnemy(state, move.damage);
    const damageDealt = Math.min(enemyHpBeforeAttack, move.damage);
    state = damageResult.state;
    const runeHealing = Math.min(team.totalHp - partyHp, move.healing);
    partyHp += runeHealing;
    totalDamageDealt += damageDealt;
    totalHealingApplied += runeHealing;
    damageMultiplier = 1;

    const boardAfterMove = [...move.finalBoard];
    let reshuffledAfterMove = false;
    board = [...boardAfterMove];
    if (!hasLegalRuneSwap(board)) {
      board = createRuneBoard({ random: createSeededRandom(deriveSeed(seed, turn, 0x51A7)) });
      reshuffleCount += 1;
      reshuffledAfterMove = true;
    }

    skillStates = advanceSkillCooldowns(skillStates);
    let enemyAction = null;
    let adjustedIncomingDamage = 0;
    let hpDamageTaken = 0;
    let shieldAbsorbed = 0;
    let enemyHealing = 0;

    if (damageResult.defeated) {
      victory = true;
    } else {
      const enemyTurn = resolveEnemyTurn(state);
      adjustedIncomingDamage = Math.ceil(enemyTurn.incomingDamage * (1 - leaderDamageReduction));
      const mitigation = mitigateIncomingDamage(
        adjustedIncomingDamage,
        shield,
        enemyTurn.intent.shieldPierce ?? 0,
        enemyTurn.intent.hits ?? 1
      );
      shield = mitigation.remainingShield;
      hpDamageTaken = mitigation.hpDamage;
      shieldAbsorbed = mitigation.shieldDamage;
      partyHp = Math.max(0, partyHp - hpDamageTaken);
      totalEnemyDamageBeforeReduction += enemyTurn.incomingDamage;
      totalEnemyDamageAfterReduction += adjustedIncomingDamage;
      totalHpDamageTaken += hpDamageTaken;
      totalShieldAbsorbed += shieldAbsorbed;
      enemyHealing = enemyTurn.intent.healing ?? 0;
      totalEnemyHealing += enemyHealing;
      if (enemyTurn.intent.phase && !phaseNames.includes(enemyTurn.intent.phase)) {
        phaseNames.push(enemyTurn.intent.phase);
      }
      enemyAction = {
        type: enemyTurn.intent.type,
        label: enemyTurn.intent.label,
        phase: enemyTurn.intent.phase ?? null,
        enraged: enemyTurn.intent.enraged ?? false,
        damage: enemyTurn.incomingDamage,
        previewDamage: enemyTurn.intent.previewDamage ?? 0,
        hits: enemyTurn.intent.hits ?? 1,
        healing: enemyHealing,
        shieldPierce: enemyTurn.intent.shieldPierce ?? 0
      };
      state = enemyTurn.state;
      if (partyHp === 0) partyDefeated = true;
    }

    turns.push({
      turn,
      encounterId: currentEncounter.id,
      encounterName: currentEncounter.name,
      boardAtTurnStart,
      boardBeforeMove,
      moveTrace,
      boardAfterMove,
      boardAfterTurn: [...board],
      reshuffledBeforeMove,
      reshuffledAfterMove,
      boardSeed: deriveSeed(seed, turn + state.waveIndex * 211, 0xA5A5A5A5),
      move: {
        from: move.from,
        to: move.to,
        direction: move.direction,
        combo: move.combo,
        matchedRuneCount: move.matchedRuneCount,
        runeCounts: { ...move.runeCounts },
        damage: move.damage,
        healing: move.healing,
        utility: move.utility,
        chainCapped: move.chainCapped,
        cascades: move.cascades
      },
      skillEvents: skillEvent ? [skillEvent] : [],
      enemyHpBeforeAttack,
      enemyHpAfterTurn: damageResult.defeated ? 0 : state.enemyHp,
      damageDealt,
      calculatedDamage: move.damage,
      damageByElement: move.damageByElement.map((item) => ({ ...item })),
      healingApplied: runeHealing,
      skillHealingApplied: skillEvent?.restored ?? 0,
      enemyAction,
      adjustedIncomingDamage,
      hpDamageTaken,
      shieldAbsorbed,
      partyHpAfterTurn: partyHp,
      shieldAfterTurn: shield,
      cooldownsAfterTurn: { ...skillStates },
      reshuffleCount
    });

    if (victory || partyDefeated) break;
  }

  const status = victory ? "victory" : partyDefeated ? "party-defeated" : "turn-limit";
  return {
    seed,
    stage: { id: stage.id, name: stage.name, difficulty: stage.difficulty },
    stageIndex,
    encounter: {
      id: encounter.id,
      name: encounter.name,
      element: encounter.element,
      hp: encounter.hp,
      startingHp: startingEnemyHp,
      attack: encounter.attack,
      boss: encounter.boss === true
    },
    waveIndex,
    team: {
      cardIds: [...team.cardIds],
      totalCost: team.totalCost,
      totalHp: team.totalHp,
      attackByElement: { ...team.attackByElement },
      leaderSkill: team.leaderSkill?.name ?? null,
      damageReduction: leaderDamageReduction
    },
    policy: { move: "highest-utility-legal-swap", skill: skillPolicy, healingWeight },
    status,
    victory,
    partyDefeated,
    turnsToDefeat: victory ? turns.length : null,
    turnsSimulated: turns.length,
    totalDamageDealt,
    averageDamagePerTurn: turns.length ? totalDamageDealt / turns.length : 0,
    totalHealingApplied,
    totalSkillHealing,
    totalEnemyHealing,
    totalEnemyDamageBeforeReduction,
    totalEnemyDamageAfterReduction,
    totalHpDamageTaken,
    totalShieldAbsorbed,
    totalActiveSkillUses,
    enemyHpRemaining: victory ? 0 : state.enemyHp,
    remainingPartyHp: partyHp,
    remainingShield: shield,
    reshuffleCount,
    phaseNames,
    turns
  };
}

function summarize(results) {
  const victories = results.filter((result) => result.victory);
  const turns = results.reduce((sum, result) => sum + result.turnsSimulated, 0);
  return {
    simulations: results.length,
    victories: victories.length,
    partyDefeats: results.filter((result) => result.partyDefeated).length,
    turnLimits: results.filter((result) => result.status === "turn-limit").length,
    winRate: results.length ? round(victories.length / results.length, 4) : 0,
    averageTurnsToDefeat: victories.length
      ? round(victories.reduce((sum, result) => sum + result.turnsToDefeat, 0) / victories.length)
      : null,
    averageHpDamageTaken: results.length
      ? round(results.reduce((sum, result) => sum + result.totalHpDamageTaken, 0) / results.length)
      : 0,
    averageDamagePerTurn: turns
      ? round(results.reduce((sum, result) => sum + result.totalDamageDealt, 0) / turns)
      : 0,
    activeSkillUses: results.reduce((sum, result) => sum + result.totalActiveSkillUses, 0),
    reshuffles: results.reduce((sum, result) => sum + result.reshuffleCount, 0)
  };
}

export function buildRuneBattleReport(options = {}) {
  assertRecord(options, "options");
  const samples = options.samples ?? 1;
  assertInteger(samples, 1, 20, "samples");
  const seed = options.seed ?? 20261117;
  assertSafeSeed(seed);
  if (options.startingEnemyHp !== undefined) {
    throw new RangeError("startingEnemyHp is only supported by simulateRuneEncounter");
  }

  const simulationOptions = { ...options };
  delete simulationOptions.samples;
  delete simulationOptions.seed;
  const results = [];

  for (let stageIndex = 0; stageIndex < STAGES.length; stageIndex += 1) {
    const stage = STAGES[stageIndex];
    for (let waveIndex = 0; waveIndex < stage.waves.length; waveIndex += 1) {
      for (let sample = 0; sample < samples; sample += 1) {
        const sampleSeed = (
          (seed >>> 0) ^
          Math.imul(stageIndex + 1, 0x9E3779B1) ^
          Math.imul(waveIndex + 1, 0x85EBCA77) ^
          sample
        ) >>> 0;
        results.push(simulateRuneEncounter({
          ...simulationOptions,
          stageIndex,
          waveIndex,
          seed: sampleSeed
        }));
      }
    }
  }

  const encounters = STAGES.flatMap((stage, stageIndex) =>
    stage.waves.map((encounter, waveIndex) => {
      const matching = results.filter((result) =>
        result.stageIndex === stageIndex && result.waveIndex === waveIndex
      );
      return {
        stage: stage.name,
        encounter: encounter.name,
        boss: encounter.boss === true,
        summary: summarize(matching)
      };
    })
  );

  const summary = summarize(results);
  summary.encounters = encounters.length;
  summary.stages = STAGES.length;
  summary.samplesPerEncounter = samples;
  summary.bossBattles = encounters.filter((entry) => entry.boss).length;
  summary.bossPhaseBattles = results.filter((result) =>
    result.encounter.boss && result.phaseNames.length > 0
  ).length;

  return { seed, samples, summary, encounters, results };
}

export function formatRuneBattleReport(report) {
  if (!report || !report.summary || !Array.isArray(report.encounters)) {
    throw new TypeError("report must be a rune battle report");
  }
  const summary = report.summary;
  const lines = [
    "Rune battle simulation report",
    "Seed: " + report.seed,
    "Samples per encounter: " + report.samples,
    "Encounters: " + summary.encounters,
    "Simulations: " + summary.simulations,
    "Victories: " + summary.victories,
    "Party defeats: " + summary.partyDefeats,
    "Turn limits: " + summary.turnLimits,
    "Win rate: " + (summary.winRate * 100).toFixed(1) + "%",
    "Average turns to defeat: " + (summary.averageTurnsToDefeat ?? "n/a"),
    "Average HP damage taken: " + summary.averageHpDamageTaken,
    "Average damage per turn: " + summary.averageDamagePerTurn,
    "Active skill uses: " + summary.activeSkillUses,
    "Board reshuffles: " + summary.reshuffles,
    "Boss phase battles: " + summary.bossPhaseBattles,
    "",
    "Encounter results:"
  ];
  for (const entry of report.encounters) {
    lines.push(
      entry.stage + " / " + entry.encounter + ": " +
      entry.summary.victories + "/" + entry.summary.simulations +
      " wins, avg turns " + (entry.summary.averageTurnsToDefeat ?? "n/a") +
      ", avg HP damage " + entry.summary.averageHpDamageTaken
    );
  }
  return lines.join("\n");
}
