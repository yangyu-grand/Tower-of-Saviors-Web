import test from "node:test";
import assert from "node:assert/strict";
import { isOrthogonallyAdjacentRuneSwap } from "../runeSwapGeometry.js";

test("transposed 3×2 rune board preserves orthogonal adjacency in both directions", () => {
  const board = { rows: 3, columns: 2 };
  for (let start = 0; start < 6; start += 1) {
    for (let end = 0; end < 6; end += 1) {
      const rowDelta = Math.abs(Math.floor(start / 2) - Math.floor(end / 2));
      const columnDelta = Math.abs((start % 2) - (end % 2));
      const expected = rowDelta + columnDelta === 1;
      assert.equal(isOrthogonallyAdjacentRuneSwap(start, end, board), expected, `${start} → ${end}`);
      assert.equal(isOrthogonallyAdjacentRuneSwap(end, start, board), expected, `${end} → ${start}`);
    }
  }
});
