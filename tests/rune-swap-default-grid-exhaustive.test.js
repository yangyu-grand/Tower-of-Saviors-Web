import test from "node:test";
import assert from "node:assert/strict";
import { isOrthogonallyAdjacentRuneSwap } from "../runeSwapGeometry.js";

test("default 5×6 board matches Manhattan adjacency for every ordered pair", () => {
  for (let start = 0; start < 30; start += 1) {
    for (let end = 0; end < 30; end += 1) {
      const rowDistance = Math.abs(Math.floor(start / 6) - Math.floor(end / 6));
      const columnDistance = Math.abs(start % 6 - end % 6);
      const expected = rowDistance + columnDistance === 1;
      assert.equal(isOrthogonallyAdjacentRuneSwap(start, end), expected, `${start} -> ${end}`);
    }
  }
});
