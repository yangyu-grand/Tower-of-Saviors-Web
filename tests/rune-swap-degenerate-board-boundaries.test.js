import test from "node:test";
import assert from "node:assert/strict";
import { isOrthogonallyAdjacentRuneSwap } from "../runeSwapGeometry.js";

test("rune swap geometry handles one-cell boards without inventing a neighbor", () => {
  assert.equal(isOrthogonallyAdjacentRuneSwap(0, 1, { rows: 1, columns: 1 }), false);
  assert.equal(isOrthogonallyAdjacentRuneSwap(0, 0, { rows: 1, columns: 1 }), false);
});

test("rune swap geometry supports one-row and one-column boards symmetrically", () => {
  for (const [a, b, board] of [
    [0, 1, { rows: 1, columns: 2 }],
    [1, 0, { rows: 1, columns: 2 }],
    [0, 1, { rows: 2, columns: 1 }],
    [1, 0, { rows: 2, columns: 1 }]
  ]) {
    assert.equal(isOrthogonallyAdjacentRuneSwap(a, b, board), true);
  }
});

test("rune swap geometry keeps default-board edge and final-cell boundaries", () => {
  assert.equal(isOrthogonallyAdjacentRuneSwap(29, 28), true, "the bottom-right rune should have a left neighbor");
  assert.equal(isOrthogonallyAdjacentRuneSwap(29, 23), true, "the bottom-right rune should have an upper neighbor");
  assert.equal(isOrthogonallyAdjacentRuneSwap(29, 30), false, "the board must not expose an out-of-range neighbor");
  assert.equal(isOrthogonallyAdjacentRuneSwap(5, 6), false, "the top row must not wrap into the second row");
  assert.equal(isOrthogonallyAdjacentRuneSwap(29, 24), false, "the bottom row must not wrap into the previous row");
});

test("rune swap geometry rejects unsafe board-size multiplication", () => {
  assert.equal(isOrthogonallyAdjacentRuneSwap(0, 1, { rows: Number.MAX_SAFE_INTEGER, columns: 2 }), false);
});
