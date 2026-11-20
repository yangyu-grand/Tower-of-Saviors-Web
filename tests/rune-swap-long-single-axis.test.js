import test from "node:test";
import assert from "node:assert/strict";
import { isOrthogonallyAdjacentRuneSwap } from "../runeSwapGeometry.js";

test("long single-axis boards only allow immediate neighbors", () => {
  for (const board of [{ rows: 1, columns: 30 }, { rows: 30, columns: 1 }]) {
    for (let start = 0; start < 30; start++) {
      for (let end = 0; end < 30; end++) {
        assert.equal(
          isOrthogonallyAdjacentRuneSwap(start, end, board),
          Math.abs(start - end) === 1,
          `board ${board.rows}x${board.columns}: ${start} -> ${end}`
        );
      }
    }
  }
});
