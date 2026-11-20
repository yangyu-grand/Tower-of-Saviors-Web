import test from "node:test";
import assert from "node:assert/strict";
import { isOrthogonallyAdjacentRuneSwap } from "../runeSwapGeometry.js";

test("swap geometry does not mutate frozen board configuration", () => {
  const board = Object.freeze({ rows: 5, columns: 6 });
  assert.equal(isOrthogonallyAdjacentRuneSwap(0, 1, board), true);
  assert.equal(isOrthogonallyAdjacentRuneSwap(0, 6, board), true);
  assert.equal(isOrthogonallyAdjacentRuneSwap(0, 7, board), false);
  assert.deepEqual(board, { rows: 5, columns: 6 });
});

test("swap geometry does not mutate the supplied index arguments", () => {
  const board = Object.freeze({ rows: 2, columns: 3, label: "unchanged" });
  for (const [start, end] of [[0, 1], [0, 3], [2, 3], [5, 4]]) {
    const before = JSON.stringify(board);
    assert.equal(typeof isOrthogonallyAdjacentRuneSwap(start, end, board), "boolean");
    assert.equal(JSON.stringify(board), before);
  }
});
