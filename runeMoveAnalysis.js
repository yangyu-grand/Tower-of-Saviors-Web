import {
  RUNE_BOARD_HEIGHT,
  RUNE_BOARD_SIZE,
  RUNE_BOARD_WIDTH,
  createRuneBoard,
  createSeededRandom,
  findRuneMatches,
  resolveRuneSwap
} from "./runeBoard.js";
import { ELEMENTS, calculateCombatResult } from "./combat.js";
import { buildTeam, DEFAULT_TEAM } from "./team.js";

const ADJACENT_SWAP_COUNT = RUNE_BOARD_HEIGHT * (RUNE_BOARD_WIDTH - 1) + (RUNE_BOARD_HEIGHT - 1) * RUNE_BOARD_WIDTH;

function assertSafeSeed(seed) {
  if (!Number.isSafeInteger(seed)) {
    throw new TypeError("seed must be a safe integer");
  }
}

function deriveMoveSeed(seed, first, second) {
  return (
    (seed >>> 0) ^
    Math.imul(first + 1, 0x9E3779B1) ^
    Math.imul(second + 1, 0x85EBCA77)
  ) >>> 0;
}

function addCounts(target, source) {
  for (const [element, count] of Object.entries(source)) {
    target[element] = (target[element] ?? 0) + count;
  }
}

function summarizeMove(move) {
  return {
    from: move.from,
    to: move.to,
    direction: move.direction,
    combo: move.combo,
    matchedRuneCount: move.matchedRuneCount,
    runeCounts: { ...move.runeCounts },
    damage: move.damage,
    healing: move.healing,
    utility: move.utility,
    chainCapped: move.chainCapped
  };
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function analyzeRuneMoves(board, options = {}) {
  if (!Array.isArray(board) || board.length !== RUNE_BOARD_SIZE) {
    throw new TypeError("board must contain exactly 30 rune cells");
  }
  if (board.some((rune) => rune !== "fire" && rune !== "water" && rune !== "wood" && rune !== "light" && rune !== "dark" && rune !== "heart")) {
    throw new TypeError("board contains an unknown rune type");
  }
  if (findRuneMatches(board).size > 0) {
    throw new RangeError("board must not contain unresolved matches");
  }

  const seed = options.seed ?? 1;
  assertSafeSeed(seed);
  const enemyElement = options.enemyElement ?? "fire";
  if (!ELEMENTS.includes(enemyElement)) throw new RangeError("Unknown enemy element: " + String(enemyElement));
  const teamCardIds = options.teamCardIds ?? DEFAULT_TEAM;
  const levels = options.levels ?? {};
  const evolutionLevels = options.evolutionLevels ?? {};
  const costLimit = options.costLimit ?? 30;
  const skillMultiplier = options.skillMultiplier ?? 1;
  const healingWeight = options.healingWeight ?? 0.5;
  const maxCascades = options.maxCascades ?? 12;
  if (!Number.isInteger(maxCascades) || maxCascades < 1 || maxCascades > 30) {
    throw new RangeError("maxCascades must be an integer between 1 and 30");
  }

  if (typeof skillMultiplier !== "number" || !Number.isFinite(skillMultiplier) || skillMultiplier < 1 || skillMultiplier > 10) {
    throw new RangeError("skillMultiplier must be between 1 and 10");
  }
  if (typeof healingWeight !== "number" || !Number.isFinite(healingWeight) || healingWeight < 0 || healingWeight > 5) {
    throw new RangeError("healingWeight must be between 0 and 5");
  }

  const team = buildTeam(teamCardIds, { levels, evolutionLevels, costLimit });
  const comboStepBonus = team.leaderSkill?.comboStepBonus ?? 0;
  const healingMultiplier = team.leaderSkill?.healingMultiplier ?? 1;
  const moves = [];

  function evaluateMove(first, second, direction) {
    const resolved = resolveRuneSwap(board, first, second, {
      random: createSeededRandom(deriveMoveSeed(seed, first, second)),
      maxCascades
    });
    if (!resolved.valid) return;

    const runeCounts = {};
    let matchedRuneCount = 0;
    let damage = 0;
    let healing = 0;
    const cascadeResults = [];

    for (const cascade of resolved.cascades) {
      addCounts(runeCounts, cascade.counts);
      matchedRuneCount += cascade.indices.length;
      const combat = calculateCombatResult({
        counts: cascade.counts,
        combo: cascade.combo,
        enemyElement,
        teamAttackByElement: team.attackByElement,
        skillMultiplier,
        comboStepBonus,
        healingMultiplier
      });
      damage += combat.damage;
      healing += combat.healing;
      cascadeResults.push({
        combo: cascade.combo,
        counts: { ...cascade.counts },
        damage: combat.damage,
        healing: combat.healing
      });
    }

    const move = {
      from: first,
      to: second,
      direction,
      combo: resolved.combo,
      matchedRuneCount,
      runeCounts,
      damage,
      healing,
      utility: round(damage + healing * healingWeight, 3),
      chainCapped: resolved.chainCapped,
      cascades: cascadeResults,
      finalBoard: [...resolved.board]
    };
    moves.push(move);
  }

  for (let index = 0; index < RUNE_BOARD_SIZE; index += 1) {
    const column = index % RUNE_BOARD_WIDTH;
    const row = Math.floor(index / RUNE_BOARD_WIDTH);
    if (column < RUNE_BOARD_WIDTH - 1) evaluateMove(index, index + 1, "horizontal");
    if (row < RUNE_BOARD_HEIGHT - 1) evaluateMove(index, index + RUNE_BOARD_WIDTH, "vertical");
  }

  moves.sort((left, right) =>
    right.utility - left.utility ||
    right.combo - left.combo ||
    right.matchedRuneCount - left.matchedRuneCount ||
    left.from - right.from ||
    left.to - right.to
  );

  const legalMoveCount = moves.length;
  const average = (selector) => legalMoveCount
    ? round(moves.reduce((sum, move) => sum + selector(move), 0) / legalMoveCount)
    : 0;

  return {
    seed,
    enemyElement,
    team: {
      cardIds: [...team.cardIds],
      totalCost: team.totalCost,
      totalHp: team.totalHp,
      attackByElement: { ...team.attackByElement },
      leaderSkill: team.leaderSkill?.name ?? null
    },
    summary: {
      adjacentSwapCount: ADJACENT_SWAP_COUNT,
      legalMoveCount,
      legalMoveRatio: round(legalMoveCount / ADJACENT_SWAP_COUNT, 4),
      deadBoard: legalMoveCount === 0,
      averageCombo: average((move) => move.combo),
      averageDamage: average((move) => move.damage),
      averageHealing: average((move) => move.healing),
      bestMove: moves.length ? summarizeMove(moves[0]) : null
    },
    moves
  };
}

export function buildRuneMoveQualityReport(options = {}) {
  const samples = options.samples ?? 100;
  const seed = options.seed ?? 20261117;
  assertSafeSeed(seed);
  if (!Number.isInteger(samples) || samples < 1 || samples > 1000) {
    throw new RangeError("samples must be an integer between 1 and 1000");
  }

  const analysisOptions = { ...options };
  delete analysisOptions.samples;
  delete analysisOptions.seed;

  const results = [];
  for (let index = 0; index < samples; index += 1) {
    const sampleSeed = ((seed % 0x100000000) + index) % 0x100000000;
    const board = createRuneBoard({ random: createSeededRandom(sampleSeed) });
    const analysis = analyzeRuneMoves(board, {
      ...analysisOptions,
      seed: (sampleSeed ^ 0xA5A5A5A5) >>> 0
    });
    results.push({
      seed: sampleSeed,
      legalMoveCount: analysis.summary.legalMoveCount,
      deadBoard: analysis.summary.deadBoard,
      averageCombo: analysis.summary.averageCombo,
      averageDamage: analysis.summary.averageDamage,
      averageHealing: analysis.summary.averageHealing,
      bestMove: analysis.summary.bestMove
    });
  }

  const sum = (selector) => results.reduce((total, result) => total + selector(result), 0);
  const legalCounts = results.map((result) => result.legalMoveCount);
  const bestMoves = results.map((result) => result.bestMove).filter(Boolean);
  const average = (selector) => bestMoves.length
    ? round(bestMoves.reduce((total, move) => total + selector(move), 0) / bestMoves.length)
    : 0;

  return {
    seed,
    samples,
    enemyElement: options.enemyElement ?? "fire",
    summary: {
      boardsAnalyzed: results.length,
      deadBoardCount: results.filter((result) => result.deadBoard).length,
      playableBoardRate: round((results.length - results.filter((result) => result.deadBoard).length) / results.length, 4),
      averageLegalMoves: round(sum((result) => result.legalMoveCount) / results.length),
      minLegalMoves: Math.min(...legalCounts),
      maxLegalMoves: Math.max(...legalCounts),
      averageBestCombo: average((move) => move.combo),
      averageBestDamage: average((move) => move.damage),
      averageBestHealing: average((move) => move.healing),
      averageBestUtility: average((move) => move.utility)
    },
    results
  };
}

export function formatRuneMoveQualityReport(report) {
  if (!report || !report.summary || !Array.isArray(report.results)) {
    throw new TypeError("report must be a rune move quality report");
  }
  const summary = report.summary;
  const lines = [
    "Rune move quality report",
    "Seed: " + report.seed,
    "Enemy element: " + report.enemyElement,
    "Boards analyzed: " + summary.boardsAnalyzed,
    "Playable board rate: " + (summary.playableBoardRate * 100).toFixed(1) + "%",
    "Dead boards: " + summary.deadBoardCount,
    "Average legal moves: " + summary.averageLegalMoves,
    "Legal move range: " + summary.minLegalMoves + "–" + summary.maxLegalMoves,
    "Average best-move Combo: " + summary.averageBestCombo,
    "Average best-move damage: " + summary.averageBestDamage,
    "Average best-move healing: " + summary.averageBestHealing,
    "Average best-move utility: " + summary.averageBestUtility
  ];
  return lines.join("\n");
}


/**
 * Re-run one selected legal swap with the exact seeded refill stream used by
 * analyzeRuneMoves(), retaining cell indices and every post-refill board for
 * deterministic battle replay.
 */
export function traceRuneMove(board, move, options = {}) {
  if (!Array.isArray(board) || board.length !== RUNE_BOARD_SIZE) {
    throw new TypeError("board must contain exactly 30 rune cells");
  }
  if (!move || typeof move !== "object" || Array.isArray(move)) {
    throw new TypeError("move must be an object");
  }
  const from = move.from;
  const to = move.to;
  if (!Number.isInteger(from) || !Number.isInteger(to) ||
      from < 0 || from >= RUNE_BOARD_SIZE || to < 0 || to >= RUNE_BOARD_SIZE) {
    throw new RangeError("move indices must be valid rune-board cells");
  }
  const seed = options.seed ?? 1;
  assertSafeSeed(seed);
  const maxCascades = options.maxCascades ?? 12;
  if (!Number.isInteger(maxCascades) || maxCascades < 1 || maxCascades > 30) {
    throw new RangeError("maxCascades must be an integer between 1 and 30");
  }
  const resolved = resolveRuneSwap(board, from, to, {
    random: createSeededRandom(deriveMoveSeed(seed, from, to)),
    maxCascades
  });
  if (!resolved.valid) throw new RangeError("move is not a legal matching swap");

  const swappedBoard = [...board];
  [swappedBoard[from], swappedBoard[to]] = [swappedBoard[to], swappedBoard[from]];
  const cascades = resolved.cascades.map((cascade, index) => ({
    combo: cascade.combo,
    indices: [...cascade.indices],
    runes: [...cascade.runes],
    counts: { ...cascade.counts },
    boardAfterRefill: [...cascade.board],
    damage: move.cascades?.[index]?.damage ?? 0,
    healing: move.cascades?.[index]?.healing ?? 0
  }));
  if (Array.isArray(move.finalBoard) &&
      move.finalBoard.some((rune, index) => rune !== resolved.board[index])) {
    throw new Error("replayed move does not match the analyzed final board");
  }
  return {
    from,
    to,
    direction: move.direction,
    initialBoard: [...board],
    swappedBoard,
    cascades,
    finalBoard: [...resolved.board],
    chainCapped: resolved.chainCapped
  };
}
