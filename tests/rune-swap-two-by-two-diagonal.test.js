import test from "node:test";
import assert from "node:assert/strict";
import { isOrthogonallyAdjacentRuneSwap } from "../runeSwapGeometry.js";

test("2x2 swaps accept only orthogonal neighbors", () => {
  const board = Object.freeze({ rows: 2, columns: 2 });
  for (let from = 0; from < 4; from++) {
    for (let to = 0; to < 4; to++) {
      const distance = Math.abs(Math.floor(from / 2) - Math.floor(to / 2)) + Math.abs(from % 2 - to % 2);
      assert.equal(isOrthogonallyAdjacentRuneSwap(from, to, board), distance === 1, `${from} -> ${to}`);
    }
  }
});
