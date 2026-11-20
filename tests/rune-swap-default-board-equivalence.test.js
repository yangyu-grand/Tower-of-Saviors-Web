import test from "node:test";
import assert from "node:assert/strict";
import { isOrthogonallyAdjacentRuneSwap } from "../runeSwapGeometry.js";

test("implicit default board agrees with explicit 5x6 geometry for all index pairs", () => {
  for (let start = -1; start <= 30; start++) {
    for (let end = -1; end <= 30; end++) {
      assert.equal(
        isOrthogonallyAdjacentRuneSwap(start, end),
        isOrthogonallyAdjacentRuneSwap(start, end, { rows: 5, columns: 6 }),
        `mismatch for ${start} -> ${end}`
      );
    }
  }
});
