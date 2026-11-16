import test from "node:test";
import assert from "node:assert/strict";
import {
  REPLAY_PLAYBACK_SPEEDS, DEFAULT_REPLAY_SPEED,
  getReplayIntervalMs, getReplaySpeedLabel, normalizeReplaySpeed
} from "../replayPlayback.js";

test("replay playback exposes a bounded set of supported speeds", () => {
  assert.deepEqual(REPLAY_PLAYBACK_SPEEDS, [0.5, 1, 1.5, 2, 3, 4]);
  assert.equal(DEFAULT_REPLAY_SPEED, 1);
});

test("playback intervals scale inversely with speed", () => {
  assert.equal(getReplayIntervalMs(0.5), 1300);
  assert.equal(getReplayIntervalMs(1), 650);
  assert.equal(getReplayIntervalMs(2), 325);
  assert.equal(getReplayIntervalMs(4), 163);
});

test("very fast playback keeps a readable minimum event interval", () => {
  assert.equal(getReplayIntervalMs(4, 100), 50);
  assert.equal(getReplayIntervalMs(4, 40), 50);
});

test("speed normalization rejects unsupported and non-finite values", () => {
  for (const value of [0, -1, 1.25, 5, NaN, Infinity, "fast"]) {
    assert.throws(() => normalizeReplaySpeed(value));
  }
  assert.equal(normalizeReplaySpeed("2"), 2);
});

test("base intervals must be positive finite numbers", () => {
  for (const value of [0, -1, NaN, Infinity, "slow"]) {
    assert.throws(() => getReplayIntervalMs(1, value), /positive finite/);
  }
});

test("speed labels use the normalized multiplier", () => {
  assert.equal(getReplaySpeedLabel(0.5), "0.5×");
  assert.equal(getReplaySpeedLabel("2"), "2×");
});
