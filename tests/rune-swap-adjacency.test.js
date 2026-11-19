import test from "node:test";
import assert from "node:assert/strict";
import { isOrthogonallyAdjacentRuneSwap } from "../runeSwapGeometry.js";

test("rune swap geometry accepts orthogonal neighbors across normal board positions", () => {
  for (const [a, b] of [[0, 1], [4, 5], [6, 7], [28, 29], [0, 6], [5, 11], [23, 29]]) {
    assert.equal(isOrthogonallyAdjacentRuneSwap(a, b), true, `${a} and ${b} should be adjacent`);
    assert.equal(isOrthogonallyAdjacentRuneSwap(b, a), true, `${b} and ${a} should be symmetric`);
  }
});

test("rune swap geometry rejects diagonals, non-neighbors, and row wrapping", () => {
  for (const [a, b] of [[0, 7], [1, 6], [0, 2], [0, 12], [5, 6], [11, 12], [0, 0]]) {
    assert.equal(isOrthogonallyAdjacentRuneSwap(a, b), false, `${a} and ${b} should not be adjacent`);
  }
});

test("rune swap geometry rejects out-of-range and non-integer positions", () => {
  for (const [a, b] of [[-1, 0], [30, 29], [0, 30], [0.5, 1], [1, NaN]]) {
    assert.equal(isOrthogonallyAdjacentRuneSwap(a, b), false);
  }
});

test("rune swap geometry supports custom rectangular boards and rejects invalid dimensions", () => {
  assert.equal(isOrthogonallyAdjacentRuneSwap(2, 6, { rows: 3, columns: 4 }), true);
  assert.equal(isOrthogonallyAdjacentRuneSwap(3, 4, { rows: 3, columns: 4 }), false, "custom-board row wrap must not count");
  assert.equal(isOrthogonallyAdjacentRuneSwap(0, 1, { rows: 0, columns: 6 }), false);
  assert.equal(isOrthogonallyAdjacentRuneSwap(0, 1, { rows: 5, columns: 2.5 }), false);
  assert.equal(isOrthogonallyAdjacentRuneSwap(0, 1, null), false);
});
