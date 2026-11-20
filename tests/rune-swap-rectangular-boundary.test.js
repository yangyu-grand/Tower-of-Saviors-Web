import test from "node:test";
import assert from "node:assert/strict";
import { isOrthogonallyAdjacentRuneSwap } from "../runeSwapGeometry.js";

test("rectangular 2×3 rune board accepts only orthogonal neighbors", () => {
  const board = { rows: 2, columns: 3 };
  for (let start = 0; start < 6; start++) {
    for (let end = 0; end < 6; end++) {
      const expected = start !== end &&
        Math.abs(Math.floor(start / 3) - Math.floor(end / 3)) +
        Math.abs((start % 3) - (end % 3)) === 1;
      assert.equal(
        isOrthogonallyAdjacentRuneSwap(start, end, board),
        expected,
        `start=${start}, end=${end}`,
      );
    }
  }
});

test("rectangular board excludes out-of-bounds and row-wrapping moves", () => {
  const board = { rows: 2, columns: 3 };
  for (const [start, end] of [[-1, 0], [0, 6], [5, 6], [2, 3], [3, 2], [0, 5]]) {
    assert.equal(isOrthogonallyAdjacentRuneSwap(start, end, board), false);
  }
});
