import test from "node:test";
import assert from "node:assert/strict";
import { getReplayComboMilestone } from "../replayCombatFeedback.js";

const event = (type, data) => ({ type, data });

test("Combo values below five do not create a milestone", () => {
  assert.equal(getReplayComboMilestone(event("player-action", { combo: 0 })), null);
  assert.equal(getReplayComboMilestone(event("player-action", { combo: 4 })), null);
});

test("five through seven Combos use the high milestone", () => {
  assert.deepEqual(getReplayComboMilestone(event("player-action", { combo: 5 })), {
    tier: "high",
    label: "高連擊",
    combo: 5
  });
  assert.deepEqual(getReplayComboMilestone(event("player-action", { combo: 7 })), {
    tier: "high",
    label: "高連擊",
    combo: 7
  });
});

test("eight or more Combos use the frenzy milestone", () => {
  assert.deepEqual(getReplayComboMilestone(event("player-action", { combo: 8 })), {
    tier: "frenzy",
    label: "極限連鎖",
    combo: 8
  });
  assert.equal(getReplayComboMilestone(event("player-action", { combo: 12 })).tier, "frenzy");
});

test("milestones are limited to player actions and reject invalid counts safely", () => {
  assert.equal(getReplayComboMilestone(event("enemy-action", { combo: 10 })), null);
  assert.equal(getReplayComboMilestone(event("player-action", { combo: -3 })), null);
  assert.equal(getReplayComboMilestone(event("player-action", { combo: "8" })), null);
  assert.throws(() => getReplayComboMilestone(null), TypeError);
});
