import test from "node:test";
import assert from "node:assert/strict";
import {
  getReplayCombatFeedback,
  getReplayEnemyHp
} from "../replayCombatFeedback.js";

const event = (type, data) => ({ type, data });

test("player-action feedback combines rune and skill healing and keeps combat totals", () => {
  assert.deepEqual(getReplayCombatFeedback(event("player-action", {
    combo: 4,
    damage: 1280,
    healing: 21,
    skillHealing: 35,
    enemyHpBeforeAttack: 1800,
    enemyHpAfterTurn: 520
  })), {
    kind: "player-action",
    combo: 4,
    damage: 1280,
    healing: 56,
    enemyHpBefore: 1800,
    enemyHpAfter: 520
  });
});

test("enemy-action feedback separates HP damage from shield absorption", () => {
  assert.deepEqual(getReplayCombatFeedback(event("enemy-action", {
    hpDamageTaken: 17,
    shieldAbsorbed: 42,
    partyHpAfterTurn: 183
  })), {
    kind: "enemy-action",
    hpDamageTaken: 17,
    shieldAbsorbed: 42,
    partyHpAfter: 183
  });
});

test("invalid or negative combat amounts are treated as zero", () => {
  assert.deepEqual(getReplayCombatFeedback(event("player-action", {
    combo: -1,
    damage: 1.5,
    healing: -8,
    skillHealing: Number.MAX_SAFE_INTEGER + 1,
    enemyHpBeforeAttack: -1,
    enemyHpAfterTurn: 0
  })), {
    kind: "player-action",
    combo: 0,
    damage: 0,
    healing: 0,
    enemyHpBefore: null,
    enemyHpAfter: 0
  });
});

test("non-combat replay events do not create floating combat feedback", () => {
  assert.equal(getReplayCombatFeedback(event("cascade", { combo: 2 })), null);
  assert.equal(getReplayCombatFeedback(event("turn-end", {})), null);
});

test("malformed replay events are rejected", () => {
  assert.throws(() => getReplayCombatFeedback(null), /object data/);
  assert.throws(() => getReplayCombatFeedback({ type: "player-action" }), /object data/);
});

test("enemy HP starts at encounter maximum and changes only after player-action events", () => {
  const replay = {
    encounter: { hp: 1000 },
    events: [
      event("turn-start", {}),
      event("cascade", { combo: 1 }),
      event("player-action", { enemyHpBeforeAttack: 1000, enemyHpAfterTurn: 740 }),
      event("enemy-action", { hpDamageTaken: 12 }),
      event("player-action", { enemyHpBeforeAttack: 740, enemyHpAfterTurn: 315 })
    ]
  };

  assert.deepEqual(getReplayEnemyHp(replay, 0), { currentHp: 1000, maxHp: 1000, ratio: 1 });
  assert.deepEqual(getReplayEnemyHp(replay, 1), { currentHp: 1000, maxHp: 1000, ratio: 1 });
  assert.deepEqual(getReplayEnemyHp(replay, 2), { currentHp: 740, maxHp: 1000, ratio: 0.74 });
  assert.deepEqual(getReplayEnemyHp(replay, 3), { currentHp: 740, maxHp: 1000, ratio: 0.74 });
  assert.deepEqual(getReplayEnemyHp(replay, 4), { currentHp: 315, maxHp: 1000, ratio: 0.315 });
});

test("battle-end HP is authoritative and values are clamped to the encounter maximum", () => {
  const replay = {
    encounter: { hp: 500 },
    events: [
      event("player-action", { enemyHpAfterTurn: 700 }),
      event("battle-end", { enemyHpRemaining: 0 })
    ]
  };

  assert.deepEqual(getReplayEnemyHp(replay, 0), { currentHp: 500, maxHp: 500, ratio: 1 });
  assert.deepEqual(getReplayEnemyHp(replay, 1), { currentHp: 0, maxHp: 500, ratio: 0 });
});

test("missing encounter HP returns null and invalid event indexes are rejected", () => {
  assert.equal(getReplayEnemyHp({ encounter: {}, events: [event("turn-start", {})] }, 0), null);
  const replay = { encounter: { hp: 100 }, events: [event("turn-start", {})] };
  assert.throws(() => getReplayEnemyHp(replay, -1), /out of range/);
  assert.throws(() => getReplayEnemyHp(replay, 1), /out of range/);
});
