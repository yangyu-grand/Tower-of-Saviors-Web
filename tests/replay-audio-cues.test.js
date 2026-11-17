import test from "node:test";
import assert from "node:assert/strict";
import { getReplayAudioCue } from "../replayAudioCues.js";

const event = (type, data = {}) => ({ type, data });

test("high and frenzy Combo milestones select distinct optional cues", () => {
  assert.equal(getReplayAudioCue(event("player-action"), {
    comboMilestone: { tier: "high", combo: 6 }
  }), "combo-high");
  assert.equal(getReplayAudioCue(event("player-action"), {
    comboMilestone: { tier: "frenzy", combo: 8 }
  }), "combo-frenzy");
});

test("a decisive final hit takes priority over other player-action cues", () => {
  assert.equal(getReplayAudioCue(event("player-action"), {
    combatFeedback: { finalHit: true, overkillDamage: 240, damage: 900 },
    comboMilestone: { tier: "frenzy", combo: 8 }
  }), "final-hit");
});

test("overkill, ordinary damage, and healing have deterministic priorities", () => {
  assert.equal(getReplayAudioCue(event("player-action"), {
    combatFeedback: { overkillDamage: 120, damage: 500 }
  }), "overkill");
  assert.equal(getReplayAudioCue(event("player-action"), {
    combatFeedback: { damage: 500, healing: 20 }
  }), "hit");
  assert.equal(getReplayAudioCue(event("player-action"), {
    combatFeedback: { healing: 20 }
  }), "heal");
});

test("skill events select the existing synthesized skill cue", () => {
  assert.equal(getReplayAudioCue(event("skill")), "skill");
});

test("Boss phase transitions take priority over incoming enemy attacks", () => {
  assert.equal(getReplayAudioCue(event("enemy-action"), {
    combatFeedback: { hpDamageTaken: 30, incomingDamage: 50 },
    phaseTransition: { fromPhase: "花霧姿態", toPhase: "月蝕姿態" }
  }), "phase-transition");
});

test("enemy attacks include shield-only hits and enemy healing has its own cue", () => {
  assert.equal(getReplayAudioCue(event("enemy-action"), {
    combatFeedback: { hpDamageTaken: 0, shieldAbsorbed: 45, incomingDamage: 45 }
  }), "enemy-attack");
  assert.equal(getReplayAudioCue(event("enemy-action"), {
    combatFeedback: { enemyHealing: 35 }
  }), "heal");
});

test("non-combat events and events without meaningful outcomes are silent", () => {
  assert.equal(getReplayAudioCue(event("cascade", { combo: 3 })), null);
  assert.equal(getReplayAudioCue(event("player-action", { damage: 0 })), null);
  assert.equal(getReplayAudioCue(event("enemy-action", {})), null);
});

test("invalid events are rejected and malformed feedback is ignored safely", () => {
  assert.throws(() => getReplayAudioCue(null), /object data/);
  assert.throws(() => getReplayAudioCue({ type: "player-action" }), /object data/);
  assert.equal(getReplayAudioCue(event("player-action"), {
    combatFeedback: { damage: Number.MAX_SAFE_INTEGER + 1, healing: -1 }
  }), null);
  assert.equal(getReplayAudioCue(event("enemy-action"), {
    phaseTransition: { fromPhase: "same", toPhase: "same" },
    combatFeedback: { hpDamageTaken: -1, shieldAbsorbed: 0 }
  }), null);
});
