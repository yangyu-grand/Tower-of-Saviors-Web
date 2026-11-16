import test from "node:test";
import assert from "node:assert/strict";
import { simulateRuneEncounter } from "../runeBattleSimulation.js";
import {
  createRuneBattleReplay,
  getRuneBattleReplayEvent,
  validateRuneBattleReplay
} from "../runeBattleReplay.js";

function sampleSimulation() {
  return simulateRuneEncounter({
    stageIndex: 3,
    waveIndex: 2,
    seed: 99,
    skillPolicy: "greedy",
    maxTurns: 12
  });
}

test("battle turns retain exact pre-move, cascade, and post-turn board snapshots", () => {
  const simulation = sampleSimulation();
  assert.ok(simulation.turns.length > 0);
  for (const turn of simulation.turns) {
    assert.equal(turn.boardAtTurnStart.length, 30);
    assert.deepEqual(turn.moveTrace.initialBoard, turn.boardBeforeMove);
    assert.deepEqual(turn.moveTrace.finalBoard, turn.boardAfterMove);
    assert.deepEqual(turn.moveTrace.cascades.at(-1).boardAfterRefill, turn.moveTrace.finalBoard);
    if (!turn.reshuffledAfterMove) assert.deepEqual(turn.boardAfterTurn, turn.boardAfterMove);
  }
});

test("replay timeline contains ordered turn, skill, swap, cascade, enemy, and battle events", () => {
  const replay = createRuneBattleReplay(sampleSimulation());
  const types = replay.events.map((event) => event.type);
  for (const required of ["turn-start", "skill", "swap", "cascade", "player-action", "enemy-action", "turn-end", "battle-end"]) {
    assert.ok(types.includes(required), "missing replay event: " + required);
  }
  assert.equal(replay.eventCount, replay.events.length);
  assert.deepEqual(replay.events.map((event) => event.index), replay.events.map((_, index) => index));
  assert.equal(validateRuneBattleReplay(replay), true);
});

test("replay generation is deterministic for identical seeded simulations", () => {
  const first = createRuneBattleReplay(sampleSimulation());
  const second = createRuneBattleReplay(sampleSimulation());
  assert.deepEqual(first, second);
});

test("replay generation does not mutate the source simulation", () => {
  const simulation = sampleSimulation();
  const before = structuredClone(simulation);
  createRuneBattleReplay(simulation);
  assert.deepEqual(simulation, before);
});

test("event seeking returns a detached event and null beyond the timeline", () => {
  const replay = createRuneBattleReplay(sampleSimulation());
  const event = getRuneBattleReplayEvent(replay, 0);
  assert.equal(event.type, "turn-start");
  event.data.board[0] = "corrupted";
  assert.notEqual(replay.events[0].data.board[0], "corrupted");
  assert.equal(getRuneBattleReplayEvent(replay, replay.eventCount), null);
  assert.throws(() => getRuneBattleReplayEvent(replay, -1), /non-negative integer/);
});

test("replay validator rejects corrupted board snapshots and event counts", () => {
  const replay = createRuneBattleReplay(sampleSimulation());
  const badBoard = structuredClone(replay);
  badBoard.events.find((event) => event.type === "turn-start").data.board[0] = "unknown";
  assert.throws(() => validateRuneBattleReplay(badBoard), /valid 30-cell rune board/);
  const badCount = structuredClone(replay);
  badCount.eventCount += 1;
  assert.throws(() => validateRuneBattleReplay(badCount), /eventCount/);
});

test("replay validator rejects non-adjacent swap events", () => {
  const replay = createRuneBattleReplay(sampleSimulation());
  const badSwap = structuredClone(replay);
  const swap = badSwap.events.find((event) => event.type === "swap");
  swap.data.to = 29;
  swap.data.from = 0;
  assert.throws(() => validateRuneBattleReplay(badSwap), /adjacent cells/);
});
