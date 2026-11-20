import test from "node:test";
import assert from "node:assert/strict";
import { isOrthogonallyAdjacentRuneSwap } from "../runeSwapGeometry.js";

test("rejects board dimensions whose product exceeds safe integer precision", () => {
  const unsafeBoards = [
    { rows: Number.MAX_SAFE_INTEGER, columns: 2 },
    { rows: 2, columns: Number.MAX_SAFE_INTEGER },
    { rows: Number.MAX_SAFE_INTEGER, columns: Number.MAX_SAFE_INTEGER },
  ];
  for (const board of unsafeBoards) {
    assert.equal(isOrthogonallyAdjacentRuneSwap(0, 1, Object.freeze(board)), false);
  }
  assert.equal(isOrthogonallyAdjacentRuneSwap(0, 1, { rows: 1, columns: 2 }), true);
});
