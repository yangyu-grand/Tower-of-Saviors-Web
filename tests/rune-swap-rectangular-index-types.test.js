import test from "node:test";
import assert from "node:assert/strict";
import { isOrthogonallyAdjacentRuneSwap } from "../runeSwapGeometry.js";

test("rectangular boards reject fractional and nonnumeric rune indices", () => {
  const board = { rows: 2, columns: 3 };
  const invalid = [0.5, -0.5, NaN, Infinity, -Infinity, "1", null, undefined, true, {}, []];
  for (const index of invalid) {
    assert.equal(isOrthogonallyAdjacentRuneSwap(index, 1, board), false, `invalid start: ${String(index)}`);
    assert.equal(isOrthogonallyAdjacentRuneSwap(1, index, board), false, `invalid end: ${String(index)}`);
  }
  assert.equal(isOrthogonallyAdjacentRuneSwap(0, 1, board), true);
});
