import test from "node:test";
import assert from "node:assert/strict";
import { createLiveBattleRecorder } from "../liveBattleRecorder.js";
import { validateRuneBattleReplay } from "../runeBattleReplay.js";

const board = Array.from({ length: 30 }, (_, index) =>
  Math.floor(index / 6) % 2 === index % 6 % 2 ? "fire" : "water"
);
const swappedBoard = [...board];
[swappedBoard[1], swappedBoard[7]] = [swappedBoard[7], swappedBoard[1]];

function createRecorder() {
  return createLiveBattleRecorder({
    seed: 20261117,
    stage: { id: "ash-trail", name: "灰燼山徑", difficulty: "普通" },
    encounter: { id: "lava-wyrmling", name: "熔岩幼龍", element: "fire", hp: 1 },
    team: { cards: [{ id: "ember_scout", name: "餘燼斥候", element: "fire" }] }
  });
}

function recordOneTurn(recorder) {
  recorder.startTurn({ turn: 1, board });
  recorder.recordSkill({
    name: "烈焰鼓舞",
    cardId: "ember_scout",
    summary: "攻擊提升",
    boardAfterSkill: board
  });
  recorder.recordSwap({
    from: 1,
    to: 7,
    direction: "down",
    boardBeforeMove: board,
    swappedBoard
  });
  recorder.recordCascade({
    combo: 1,
    indices: [0, 1, 2],
    runes: ["fire", "fire", "fire"],
    counts: { fire: 3 },
    boardAfterRefill: board
  });
  recorder.recordPlayerAction({
    combo: 1,
    matchedRuneCount: 3,
    runeCounts: { fire: 3 },
    damage: 120,
    healing: 0,
    skillHealing: 0,
    enemyHpBeforeAttack: 1,
    enemyHpAfterTurn: 0
  });
  recorder.recordEnemyAction({
    action: { label: "尾擊" },
    hpDamageTaken: 0,
    shieldAbsorbed: 0,
    partyHpAfterTurn: 200
  });
  recorder.endTurn({
    boardAfterMove: board,
    boardAfterTurn: board,
    reshuffledAfterMove: false,
    partyHpAfterTurn: 200,
    shieldAfterTurn: 0,
    cooldownsAfterTurn: { ember_scout: 2 },
    reshuffleCount: 0
  });
}

test("records a complete player-controlled battle as validated replay events", () => {
  const recorder = createRecorder();
  recordOneTurn(recorder);
  const replay = recorder.finish("victory", {
    totalDamageDealt: 120,
    totalHealingApplied: 0,
    totalHpDamageTaken: 0,
    totalShieldAbsorbed: 0,
    enemyHpRemaining: 0,
    remainingPartyHp: 200,
    remainingShield: 0
  });

  assert.equal(replay.source, "live-player");
  assert.equal(replay.status, "victory");
  assert.equal(replay.turnsSimulated, 1);
  assert.equal(replay.eventCount, 8);
  assert.equal(validateRuneBattleReplay(replay), true);
  assert.deepEqual(replay.events.map((event) => event.type), [
    "turn-start", "skill", "swap", "cascade",
    "player-action", "enemy-action", "turn-end", "battle-end"
  ]);
});

test("rejects non-adjacent swaps and mismatched swapped-board snapshots", () => {
  const recorder = createRecorder();
  recorder.startTurn({ turn: 1, board });
  assert.throws(() => recorder.recordSwap({
    from: 0, to: 7, boardBeforeMove: board, swappedBoard
  }), /adjacent/);
  assert.throws(() => recorder.recordSwap({
    from: 1, to: 7, boardBeforeMove: board, swappedBoard: board
  }), /does not match/);
});

test("rejects incomplete cascade snapshots", () => {
  const recorder = createRecorder();
  recorder.startTurn({ turn: 1, board });
  assert.throws(() => recorder.recordCascade({
    combo: 1, indices: [0, 1], runes: ["fire", "fire"],
    counts: { fire: 2 }, boardAfterRefill: board
  }), /at least three/);
});

test("requires the current turn to end before finalizing", () => {
  const recorder = createRecorder();
  recorder.startTurn({ turn: 1, board });
  assert.throws(() => recorder.finish("victory"), /endTurn/);
});

test("copies board snapshots and rejects writes after finalization", () => {
  const recorder = createRecorder();
  const sourceBoard = [...board];
  recorder.startTurn({ turn: 1, board: sourceBoard });
  sourceBoard[0] = "heart";
  assert.equal(recorder.turnsSimulated, 1);
  recorder.recordSwap({
    from: 1, to: 7, boardBeforeMove: board, swappedBoard
  });
  recorder.recordCascade({
    combo: 1, indices: [0, 1, 2],
    runes: ["fire", "fire", "fire"],
    counts: { fire: 3 }, boardAfterRefill: board
  });
  recorder.recordPlayerAction({ combo: 1, damage: 10, healing: 0, skillHealing: 0 });
  recorder.endTurn({
    boardAfterMove: board, boardAfterTurn: board,
    reshuffledAfterMove: false, partyHpAfterTurn: 100,
    shieldAfterTurn: 0, cooldownsAfterTurn: {}, reshuffleCount: 0
  });
  const replay = recorder.finish("victory", { totalDamageDealt: 10, remainingPartyHp: 100 });
  assert.equal(replay.events[0].data.board[0], "fire");
  assert.throws(() => recorder.startTurn({ turn: 2, board }), /already finished/);
});
