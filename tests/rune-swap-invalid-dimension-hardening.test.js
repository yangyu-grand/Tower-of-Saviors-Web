import test from "node:test";
import assert from "node:assert/strict";
import { isOrthogonallyAdjacentRuneSwap } from "../runeSwapGeometry.js";

test("rune swap geometry rejects array-shaped board configuration", () => {
  assert.equal(isOrthogonallyAdjacentRuneSwap(0, 1, []), false);
  assert.equal(isOrthogonallyAdjacentRuneSwap(0, 1, [5, 6]), false);
});

test("rune swap geometry rejects invalid row and column dimensions", () => {
  for (const rows of [-1, 1.5, NaN, Infinity, "5"]) {
    assert.equal(isOrthogonallyAdjacentRuneSwap(0, 1, { rows, columns: 6 }), false, String(rows));
  }
  for (const columns of [-1, 2.5, NaN, Infinity, "6"]) {
    assert.equal(isOrthogonallyAdjacentRuneSwap(0, 1, { rows: 5, columns }), false, String(columns));
  }
});

test("rune swap geometry rejects non-finite or non-integer cell indices", () => {
  for (const [start, end] of [[NaN, 1], [Infinity, 1], [0, -Infinity], ["0", 1], [0, 1.25]]) {
    assert.equal(isOrthogonallyAdjacentRuneSwap(start, end), false);
  }
});
