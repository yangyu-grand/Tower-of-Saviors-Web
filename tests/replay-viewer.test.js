import test from "node:test";
import assert from "node:assert/strict";
import { simulateRuneEncounter } from "../runeBattleSimulation.js";
import { createRuneBattleReplay } from "../runeBattleReplay.js";
import {
  createReplayViewerState, seekReplayViewer, stepReplayViewer,
  setReplayViewerPlaying, advanceReplayViewer, getReplayViewerFrame,
  describeReplayEvent
} from "../replayViewer.js";

function sampleReplay() {
  return createRuneBattleReplay(simulateRuneEncounter({
    stageIndex: 3, waveIndex: 2, seed: 99, skillPolicy: "greedy", maxTurns: 12
  }));
}

test("viewer validates and snapshots a replay at its first event", () => {
  const replay = sampleReplay();
  const state = createReplayViewerState(replay);
  replay.events[0].data.board[0] = "changed";
  assert.equal(state.index, 0);
  assert.equal(state.playing, false);
  assert.notEqual(state.replay.events[0].data.board[0], "changed");
});

test("seeking clamps to the timeline and always pauses playback", () => {
  const state = setReplayViewerPlaying(createReplayViewerState(sampleReplay()), true);
  const last = state.replay.events.length - 1;
  const start = seekReplayViewer(state, -20);
  assert.equal(start.index, 0);
  assert.equal(start.playing, false);
  const end = seekReplayViewer(state, last + 20);
  assert.equal(end.index, last);
  assert.equal(end.playing, false);
});

test("step controls move in either direction without leaving the event range", () => {
  const state = createReplayViewerState(sampleReplay());
  assert.equal(stepReplayViewer(state, 1).index, 1);
  assert.equal(stepReplayViewer(state, -1).index, 0);
  assert.equal(stepReplayViewer(state, -1).index, 0);
  assert.equal(stepReplayViewer(state, 3).index, 3);
  assert.throws(() => stepReplayViewer(state, 0), /non-zero integer/);
});

test("playback advances one event at a time and stops on the final event", () => {
  const state = createReplayViewerState(sampleReplay());
  const last = state.replay.events.length - 1;
  let playing = setReplayViewerPlaying(seekReplayViewer(state, last - 1), true);
  playing = advanceReplayViewer(playing);
  assert.equal(playing.index, last);
  assert.equal(playing.playing, false);
  assert.equal(advanceReplayViewer(playing), playing);
});

test("frame lookup retains the most recent exact board snapshot", () => {
  const state = createReplayViewerState(sampleReplay());
  for (let index = 0; index < state.replay.events.length; index += 1) {
    const frame = getReplayViewerFrame(seekReplayViewer(state, index));
    assert.ok(frame.event);
    assert.equal(frame.event.index, index);
    assert.equal(frame.board.length, 30);
  }
  const frame = getReplayViewerFrame(state);
  frame.board[0] = "mutated";
  assert.notEqual(state.replay.events[0].data.board[0], "mutated");
});

test("event descriptions explain swaps, cascades, enemy responses, and battle results", () => {
  const state = createReplayViewerState(sampleReplay());
  const byType = Object.fromEntries(state.replay.events.map((event) => [event.type, event]));
  for (const type of ["swap", "cascade", "enemy-action", "battle-end"]) {
    const description = describeReplayEvent(byType[type]);
    assert.ok(description.title.length > 0);
    assert.ok(description.detail.length > 0);
  }
  assert.match(describeReplayEvent(byType.cascade).title, /Combo/);
});

test("viewer rejects invalid replays, indices, and state transitions", () => {
  const replay = sampleReplay();
  const invalid = structuredClone(replay);
  invalid.eventCount += 1;
  assert.throws(() => createReplayViewerState(invalid), /eventCount/);
  const state = createReplayViewerState(replay);
  assert.throws(() => seekReplayViewer(state, 1.5), /integer/);
  assert.throws(() => setReplayViewerPlaying(state, "yes"), /boolean/);
  assert.throws(() => advanceReplayViewer({ index: -1 }), /invalid replay viewer state/);
});
