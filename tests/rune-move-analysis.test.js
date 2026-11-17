import test from "node:test";
import assert from "node:assert/strict";
import { createRuneBoard, createSeededRandom, findRuneMatches } from "../runeBoard.js";
import { analyzeRuneMoves, buildRuneMoveQualityReport, formatRuneMoveQualityReport } from "../runeMoveAnalysis.js";
import { getElementalMatchup } from "../combat.js";

function playableBoard() {
  return createRuneBoard({ random: () => 0, maxAttempts: 1 });
}

function heartMatchBoard() {
  const board = playableBoard();
  board[0] = "heart";
  board[1] = "fire";
  board[2] = "heart";
  board[7] = "heart";
  return board;
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

test("move analysis attributes cascade damage to the correct elements and matchup", () => {
  const analysis = analyzeRuneMoves(playableBoard(), { seed: 20261117, enemyElement: "wood" });
  const move = analysis.moves.find((candidate) => candidate.damageByElement.length > 0);
  assert.ok(move, "at least one legal move should include an attack element");
  assert.equal(move.damageByElement.reduce((sum, item) => sum + item.damage, 0), move.damage);
  assert.equal(move.damageByElement.reduce((sum, item) => sum + item.runeCount, 0),
    Object.entries(move.runeCounts).filter(([element]) => element !== "heart").reduce((sum, [, count]) => sum + count, 0));
  for (const item of move.damageByElement) assert.equal(item.relation, getElementalMatchup(item.element, "wood").relation);
  for (const cascade of move.cascades) assert.equal(cascade.damageByElement.reduce((sum, item) => sum + item.damage, 0), cascade.damage);
});

test("heart matches contribute healing to move utility", () => {
  const board = heartMatchBoard();
  assert.equal(findRuneMatches(board).size, 0);
  const analysis = analyzeRuneMoves(board, {
    seed: 2026,
    enemyElement: "fire",
    healingWeight: 1
  });
  const heartMove = analysis.moves.find((move) => move.from === 1 && move.to === 7);
  assert.ok(heartMove);
  assert.ok(heartMove.healing >= 21);
  assert.equal(heartMove.utility, heartMove.damage + heartMove.healing);
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
  const matchedBoard = [...board];
  matchedBoard[0] = "fire"; matchedBoard[1] = "fire"; matchedBoard[2] = "fire";
  assert.throws(() => analyzeRuneMoves(matchedBoard), /unresolved matches/);
  assert.throws(() => analyzeRuneMoves(board, { seed: 1.5 }), /safe integer/);
  assert.throws(() => analyzeRuneMoves(board, { teamCardIds: ["ember_scout"] }), /exactly 5 cards/);
  assert.throws(() => analyzeRuneMoves(board, { healingWeight: 6 }), /healingWeight/);
  assert.throws(() => analyzeRuneMoves(board, { enemyElement: "ice" }), /Unknown enemy element/);
  assert.throws(() => analyzeRuneMoves(board, { maxCascades: 0 }), /maxCascades/);
  assert.throws(() => buildRuneMoveQualityReport({ samples: 0 }), /samples/);
});

test("board samples are deterministic from the same seed", () => {
  const first = createRuneBoard({ random: createSeededRandom(20261117) });
  const second = createRuneBoard({ random: createSeededRandom(20261117) });
  assert.deepEqual(first, second);
});
