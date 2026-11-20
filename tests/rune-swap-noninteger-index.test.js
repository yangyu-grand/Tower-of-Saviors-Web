import test from "node:test";
import assert from "node:assert/strict";
import { isOrthogonallyAdjacentRuneSwap } from "../runeSwapGeometry.js";

test("rejects fractional, non-finite, and non-numeric rune indices", () => {
  const invalid = [0.5, -0.5, 1.25, NaN, Infinity, -Infinity, "1", null, undefined];
  for (const index of invalid) {
    assert.equal(isOrthogonallyAdjacentRuneSwap(index, 1), false);
    assert.equal(isOrthogonallyAdjacentRuneSwap(1, index), false);
  }
  assert.equal(isOrthogonallyAdjacentRuneSwap(0, 1), true);
});
