import test from "node:test";
import assert from "node:assert/strict";
import { isOrthogonallyAdjacentRuneSwap } from "../runeSwapGeometry.js";

test("accepts adjacent indices at the maximum safe board size without rounding", () => {
  const last = Number.MAX_SAFE_INTEGER - 1;
  for (const board of [{ rows: 1, columns: Number.MAX_SAFE_INTEGER }, { rows: Number.MAX_SAFE_INTEGER, columns: 1 }]) {
    assert.equal(isOrthogonallyAdjacentRuneSwap(last - 1, last, board), true);
    assert.equal(isOrthogonallyAdjacentRuneSwap(last, last - 1, board), true);
    assert.equal(isOrthogonallyAdjacentRuneSwap(last - 2, last, board), false);
    assert.equal(isOrthogonallyAdjacentRuneSwap(last, Number.MAX_SAFE_INTEGER, board), false);
  }
});
