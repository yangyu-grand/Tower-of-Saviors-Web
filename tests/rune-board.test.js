import test from "node:test";
import assert from "node:assert/strict";
import {
  RUNE_TYPES,
  createRuneBoard,
  createSeededRandom,
  findRuneMatches,
  isAdjacentRuneCells,
  hasLegalRuneSwap,
  collapseRuneBoard,
  resolveRuneSwap
} from "../runeBoard.js";

function fallbackBoard() {
  return createRuneBoard({ random: () => 0, maxAttempts: 1 });
}

function sequenceRandom(values) {
  let index = 0;
  return () => values[index++] ?? 0.73;
}

test("seeded board generation is deterministic, match-free, and playable", () => {
  const first = createRuneBoard({ random: createSeededRandom(20261117) });
  const second = createRuneBoard({ random: createSeededRandom(20261117) });
  assert.deepEqual(first, second);
  assert.equal(first.length, 30);
  assert.ok(first.every((rune) => RUNE_TYPES.includes(rune)));
  assert.equal(findRuneMatches(first).size, 0);
  assert.equal(hasLegalRuneSwap(first), true);
});

test("board generation falls back to a known playable board when the random source stalls", () => {
  const board = createRuneBoard({ random: () => 0, maxAttempts: 2 });
  assert.deepEqual(board, fallbackBoard());
  assert.equal(findRuneMatches(board).size, 0);
  assert.equal(hasLegalRuneSwap(board), true);
});

test("match detection includes horizontal, vertical, and intersecting runs without duplicate cells", () => {
  const board = Array(30).fill(null);
  board[0] = "fire";
  board[1] = "fire";
  board[2] = "fire";
  board[6] = "fire";
  board[12] = "fire";
  assert.deepEqual([...findRuneMatches(board)].sort((a, b) => a - b), [0, 1, 2, 6, 12]);
});

test("adjacency rejects row wrapping, diagonals, self-swaps, and out-of-range indices", () => {
  assert.equal(isAdjacentRuneCells(0, 1), true);
  assert.equal(isAdjacentRuneCells(0, 6), true);
  assert.equal(isAdjacentRuneCells(5, 6), false);
  assert.equal(isAdjacentRuneCells(0, 7), false);
  assert.equal(isAdjacentRuneCells(4, 4), false);
  assert.equal(isAdjacentRuneCells(-1, 0), false);
  assert.equal(isAdjacentRuneCells(0, 30), false);
});

test("gravity preserves survivor order and fills only cleared cells", () => {
  const board = Array.from({ length: 30 }, (_, index) => RUNE_TYPES[index % RUNE_TYPES.length]);
  const original = [...board];
  const collapsed = collapseRuneBoard(board, [0, 12], () => 0.99);
  assert.deepEqual(collapsed.slice(0, 30).filter((_, index) => index % 6 === 0), [
    "heart", "heart", "water", "light", "dark"
  ]);
  for (let index = 0; index < board.length; index += 1) {
    if (index % 6 !== 0) assert.equal(collapsed[index], original[index]);
  }
  assert.deepEqual(board, original);
});

test("a non-matching adjacent swap is rejected without mutating the board", () => {
  const board = fallbackBoard();
  const original = [...board];
  const result = resolveRuneSwap(board, 0, 1, { random: () => 0.5 });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "no-match");
  assert.deepEqual(result.board, original);
  assert.deepEqual(board, original);
});

test("a legal swap resolves a match and records its cascade snapshot", () => {
  const board = fallbackBoard();
  const original = [...board];
  const result = resolveRuneSwap(board, 6, 7, {
    random: sequenceRandom([0.01, 0.2, 0.4])
  });
  assert.equal(result.valid, true);
  assert.equal(result.combo, 1);
  assert.equal(result.chainCapped, false);
  assert.deepEqual(result.cascades[0].indices, [0, 6, 12]);
  assert.deepEqual(result.cascades[0].counts, { fire: 3 });
  assert.equal(findRuneMatches(result.board).size, 0);
  assert.deepEqual(board, original);
});

test("invalid board and random configurations fail with explicit errors", () => {
  assert.throws(() => findRuneMatches([]), /exactly 30 cells/);
  assert.throws(() => createRuneBoard({ random: () => 1 }), /\[0, 1\)/);
  assert.throws(() => createRuneBoard({ maxAttempts: 0 }), /maxAttempts/);
  assert.throws(() => resolveRuneSwap(fallbackBoard(), 0, 30), /maxCascades|random/);
});
