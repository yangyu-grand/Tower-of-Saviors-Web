import test from "node:test";
import assert from "node:assert/strict";
import { isOrthogonallyAdjacentRuneSwap } from "../runeSwapGeometry.js";

test("boolean, bigint and object indices are rejected without coercion", () => {
  const invalid = [true, false, 0n, 1n, {}, { valueOf: () => 1 }, [1], Symbol("index")];
  for (const index of invalid) {
    assert.equal(isOrthogonallyAdjacentRuneSwap(index, 1), false);
    assert.equal(isOrthogonallyAdjacentRuneSwap(0, index), false);
  }
  assert.equal(isOrthogonallyAdjacentRuneSwap(0, 1), true);
});
