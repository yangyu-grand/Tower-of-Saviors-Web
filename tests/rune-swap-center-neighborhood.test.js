import test from "node:test";
import assert from "node:assert/strict";
import { isOrthogonallyAdjacentRuneSwap } from "../runeSwapGeometry.js";

test("3x3 center only swaps with four cardinal neighbors", () => {
  const board = Object.freeze({ rows: 3, columns: 3 });
  const expected = new Set([1, 3, 5, 7]);
  for (let index = 0; index < 9; index++) {
    assert.equal(isOrthogonallyAdjacentRuneSwap(4, index, board), expected.has(index), `center -> ${index}`);
    assert.equal(isOrthogonallyAdjacentRuneSwap(index, 4, board), expected.has(index), `${index} -> center`);
  }
});
