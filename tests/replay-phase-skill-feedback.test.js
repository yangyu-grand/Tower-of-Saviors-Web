import test from "node:test";
import assert from "node:assert/strict";
import { getReplayBossPhaseTransition, getReplayCombatFeedback } from "../replayCombatFeedback.js";

const event = (type, data) => ({ type, data });

test("skill events expose a readable name and effect summary", () => {
  assert.deepEqual(getReplayCombatFeedback(event("skill", {
    name: "炎龍護盾",
    summary: "獲得 120 點護盾。",
    cardId: "ember-guardian"
  })), {
    kind: "skill",
    skillName: "炎龍護盾",
    summary: "獲得 120 點護盾。"
  });
});

test("skill labels normalize whitespace, enforce bounds, and use safe fallbacks", () => {
  const feedback = getReplayCombatFeedback(event("skill", {
    name: "  " + "技能".repeat(40) + "  ",
    summary: "  火屬性攻擊提升。\n".repeat(30)
  }));
  assert.equal(feedback.skillName.length, 48);
  assert.equal(feedback.summary.length, 140);
  assert.equal(feedback.summary.includes("\n"), false);
  assert.equal(getReplayCombatFeedback(event("skill", {})).skillName, "角色技能");
  assert.equal(getReplayCombatFeedback(event("skill", {})).summary, "技能效果已發動。");
});

test("Boss enemy actions expose the recorded phase and enrage state", () => {
  assert.deepEqual(getReplayCombatFeedback(event("enemy-action", {
    action: {
      label: "月輪連斬",
      phase: "月蝕姿態",
      enraged: true,
      damage: 90
    },
    hpDamageTaken: 42,
    shieldAbsorbed: 48,
    partyHpAfterTurn: 183
  })), {
    kind: "enemy-action",
    actionLabel: "月輪連斬",
    incomingDamage: 90,
    enemyHealing: 0,
    hpDamageTaken: 42,
    shieldAbsorbed: 48,
    partyHpAfter: 183,
    phaseName: "月蝕姿態",
    enraged: true
  });
});

test("ordinary enemy actions omit absent phase and non-explicit enrage labels", () => {
  const feedback = getReplayCombatFeedback(event("enemy-action", {
    action: { label: "普通攻擊", phase: 17, enraged: "true", damage: 10 },
    hpDamageTaken: 10,
    shieldAbsorbed: 0
  }));
  assert.equal(feedback.actionLabel, "普通攻擊");
  assert.equal("phaseName" in feedback, false);
  assert.equal("enraged" in feedback, false);
});

test("untrusted phase and action labels are bounded text values", () => {
  const feedback = getReplayCombatFeedback(event("enemy-action", {
    action: { label: "  " + "攻擊".repeat(50), phase: "  " + "姿態".repeat(40) },
    hpDamageTaken: 0,
    shieldAbsorbed: 0
  }));
  assert.equal(feedback.actionLabel.length, 64);
  assert.equal(feedback.phaseName.length, 48);
});


const bossReplay = (phases, boss = true) => ({
  encounter: { boss },
  events: phases.map((phase, index) => ({
    type: index % 2 === 0 ? "enemy-action" : "player-action",
    data: index % 2 === 0 ? { action: { phase } } : {}
  }))
});

test("Boss phase transition is detected from the last recorded non-empty phase", () => {
  const replay = bossReplay(["花霧姿態", null, "月蝕姿態"]);
  assert.deepEqual(getReplayBossPhaseTransition(replay, 2), {
    fromPhase: "花霧姿態",
    toPhase: "月蝕姿態"
  });
});

test("initial phase, unchanged phase, and non-Boss encounters do not announce transitions", () => {
  const replay = bossReplay(["花霧姿態", "花霧姿態", "月蝕姿態"]);
  assert.equal(getReplayBossPhaseTransition(replay, 0), null);
  assert.equal(getReplayBossPhaseTransition(replay, 2), null);
  assert.equal(getReplayBossPhaseTransition(bossReplay(["花霧姿態", "月蝕姿態"], false), 1), null);
});

test("phase transition lookup is seek-stable and validates replay indices", () => {
  const replay = bossReplay(["花霧姿態", null, "月蝕姿態"]);
  const first = getReplayBossPhaseTransition(replay, 2);
  const second = getReplayBossPhaseTransition(replay, 2);
  assert.deepEqual(second, first);
  assert.throws(() => getReplayBossPhaseTransition(replay, 3), RangeError);
  assert.throws(() => getReplayBossPhaseTransition(null, 0), TypeError);
});
