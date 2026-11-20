import test from "node:test";
import assert from "node:assert/strict";
import { isOrthogonallyAdjacentRuneSwap } from "../runeSwapGeometry.js";

test("single-cell boards cannot exchange any rune", () => {
  const board = Object.freeze({ rows: 1, columns: 1 });
  for (const start of [-1, 0, 1]) {
    for (const end of [-1, 0, 1]) {
      assert.equal(isOrthogonallyAdjacentRuneSwap(start, end, board), false,
        `single-cell swap ${start} -> ${end}`);
    }
  }
});
