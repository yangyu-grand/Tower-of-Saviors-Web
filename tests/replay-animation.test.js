import test from "node:test";
import assert from "node:assert/strict";
import {
  getReplayAnimationPlan,
  REPLAY_ANIMATION_DURATIONS
} from "../replayAnimation.js";

const event = (type, data) => ({ type, data });

test("horizontal swaps animate both runes from their previous cells", () => {
  const plan = getReplayAnimationPlan(event("swap", { from: 7, to: 8 }));
  assert.equal(plan.kind, "swap");
  assert.equal(plan.durationMs, REPLAY_ANIMATION_DURATIONS.swap);
  assert.deepEqual(plan.cells, [
    { index: 7, effect: "swap", offsetX: 1, offsetY: 0, delayMs: 0 },
    { index: 8, effect: "swap", offsetX: -1, offsetY: -0, delayMs: 0 }
  ]);
});

test("vertical swaps calculate row offsets without wrapping across rows", () => {
  const plan = getReplayAnimationPlan(event("swap", { from: 7, to: 13 }));
  assert.deepEqual(plan.cells.map(({ index, offsetX, offsetY }) => ({
    index, offsetX, offsetY
  })), [
    { index: 7, offsetX: 0, offsetY: 1 },
    { index: 13, offsetX: -0, offsetY: -1 }
  ]);
});

test("swap animation rejects non-adjacent and out-of-range cells", () => {
  assert.throws(() => getReplayAnimationPlan(event("swap", { from: 5, to: 6 })), /adjacent/);
  assert.throws(() => getReplayAnimationPlan(event("swap", { from: -1, to: 0 })), /valid 6x5/);
  assert.throws(() => getReplayAnimationPlan(event("swap", { from: 0, to: 30 })), /valid 6x5/);
});

test("cascade animation marks matched cells for refill and affected cells for gravity", () => {
  const plan = getReplayAnimationPlan(event("cascade", { indices: [13, 14, 15, 19] }));
  assert.equal(plan.kind, "cascade");
  assert.equal(plan.durationMs, REPLAY_ANIMATION_DURATIONS.cascade);
  assert.equal(plan.cells.length, 10);
  assert.equal(plan.cells.find((cell) => cell.index === 13).effect, "refill");
  assert.equal(plan.cells.find((cell) => cell.index === 19).effect, "refill");
  assert.equal(plan.cells.find((cell) => cell.index === 1).effect, "drop");
  assert.ok(plan.cells.every((cell) => cell.delayMs >= 0));
});

test("cascade animation rejects too few, duplicate, and invalid matched cells", () => {
  assert.throws(() => getReplayAnimationPlan(event("cascade", { indices: [1, 2] })), /at least three/);
  assert.throws(() => getReplayAnimationPlan(event("cascade", { indices: [1, 1, 2] })), /unique/);
  assert.throws(() => getReplayAnimationPlan(event("cascade", { indices: [1, 2, 30] })), /valid 6x5/);
});

test("skill, player, and enemy events return board-level feedback plans", () => {
  assert.equal(getReplayAnimationPlan(event("skill", {})).kind, "skill");
  assert.equal(getReplayAnimationPlan(event("player-action", {})).kind, "player-action");
  assert.equal(getReplayAnimationPlan(event("enemy-action", {})).kind, "enemy-hit");
  assert.equal(getReplayAnimationPlan(event("turn-end", {})), null);
});

test("malformed animation events are rejected", () => {
  assert.throws(() => getReplayAnimationPlan(null), /event with object data/);
  assert.throws(() => getReplayAnimationPlan({ type: "swap" }), /event with object data/);
});
