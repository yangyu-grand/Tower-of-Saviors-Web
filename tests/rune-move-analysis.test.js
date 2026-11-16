import test from "node:test";
import assert from "node:assert/strict";
import { createRuneBoard, createSeededRandom, findRuneMatches } from "../runeBoard.js";
import { analyzeRuneMoves, buildRuneMoveQualityReport, formatRuneMoveQualityReport } from "../runeMoveAnalysis.js";

function playableBoard() {
  return createRuneBoard({ random: () => 0, maxAttempts: 1 });
}

test("move analysis enumerates only legal adjacent swaps and ranks deterministically", () => {
  const board = playableBoard();
  const first = analyzeRuneMoves(board, { seed: 77, enemyElement: "wood" });
  const second = analyzeRuneMoves(board, { seed: 77, enemyElement: "wood" });
  assert.deepEqual(first, second);
  assert.equal(first.summary.adjacentSwapCount, 49);
  assert.ok(first.summary.legalMoveCount > 0);
  assert.equal(first.summary.deadBoard, false);
  assert.ok(first.moves.every((move) => move.combo >= 1 && move.matchedRuneCount >= 3));
  assert.ok(first.moves.every((move) => findRuneMatches(move.finalBoard).size === 0));
  assert.deepEqual(first.moves, [...first.moves].sort((a, b) =>
    b.utility - a.utility || b.combo - a.combo || b.matchedRuneCount - a.matchedRuneCount || a.from - b.from || a.to - b.to
  ));
});

test("move analysis uses the selected team leader and elemental matchup", () => {
  const board = playableBoard();
  const fireLeader = analyzeRuneMoves(board, {
    seed: 11,
    enemyElement: "wood",
    teamCardIds: ["ember_scout", "tide_monk", "moss_guard", "dawn_archer", "heart_priest"]
  });
  const waterLeader = analyzeRuneMoves(board, {
    seed: 11,
    enemyElement: "wood",
    teamCardIds: ["tide_monk", "ember_scout", "moss_guard", "dawn_archer", "heart_priest"]
  });
  assert.equal(fireLeader.team.leaderSkill, "赤焰先鋒");
  assert.equal(waterLeader.team.leaderSkill, "潮汐韻律");
  assert.notDeepEqual(fireLeader.team.attackByElement, waterLeader.team.attackByElement);
});

test("heart matches contribute healing to move utility", () => {
  const board = playableBoard();
  const analysis = analyzeRuneMoves(board, {
    seed: 2026,
    enemyElement: "fire",
    healingWeight: 1
  });
  assert.ok(analysis.moves.some((move) => move.healing > 0));
  assert.ok(analysis.moves.every((move) => move.utility === move.damage + move.healing));
});

test("seeded move quality report is repeatable and samples playable boards", () => {
  const options = { samples: 24, seed: 20261117, enemyElement: "dark" };
  const first = buildRuneMoveQualityReport(options);
  const second = buildRuneMoveQualityReport(options);
  assert.deepEqual(first, second);
  assert.equal(first.summary.boardsAnalyzed, 24);
  assert.equal(first.summary.deadBoardCount, 0);
  assert.equal(first.summary.playableBoardRate, 1);
  assert.ok(first.summary.minLegalMoves > 0);
  assert.match(formatRuneMoveQualityReport(first), /Playable board rate: 100.0%/);
});

test("move analysis rejects unresolved matches, invalid teams, and invalid options", () => {
  const board = playableBoard();
  assert.throws(() => analyzeRuneMoves([...board.slice(0, 29), "fire"]), /unresolved matches|30 rune cells/);
  assert.throws(() => analyzeRuneMoves(board, { seed: 1.5 }), /safe integer/);
  assert.throws(() => analyzeRuneMoves(board, { teamCardIds: ["ember_scout"] }), /exactly 5 cards/);
  assert.throws(() => analyzeRuneMoves(board, { healingWeight: 6 }), /healingWeight/);
  assert.throws(() => buildRuneMoveQualityReport({ samples: 0 }), /samples/);
});

test("board samples are deterministic from the same seed", () => {
  const first = createRuneBoard({ random: createSeededRandom(20261117) });
  const second = createRuneBoard({ random: createSeededRandom(20261117) });
  assert.deepEqual(first, second);
});
