import test from "node:test";
import assert from "node:assert/strict";
import { isOrthogonallyAdjacentRuneSwap } from "../runeSwapGeometry.js";

test("omitted and nullish dimensions use the default 5x6 board", () => {
  for (const board of [{}, { rows: null, columns: undefined }, { rows: undefined, columns: null }]) {
    assert.equal(isOrthogonallyAdjacentRuneSwap(0, 6, board), true);
    assert.equal(isOrthogonallyAdjacentRuneSwap(0, 5, board), false);
    assert.equal(isOrthogonallyAdjacentRuneSwap(29, 28, board), true);
    assert.equal(isOrthogonallyAdjacentRuneSwap(29, 30, board), false);
  }
});

test("explicit zero dimensions are rejected rather than defaulted", () => {
  for (const board of [{ rows: 0 }, { columns: 0 }, { rows: 0, columns: 0 }]) {
    assert.equal(isOrthogonallyAdjacentRuneSwap(0, 1, board), false);
  }
});
