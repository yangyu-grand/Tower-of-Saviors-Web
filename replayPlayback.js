export const REPLAY_PLAYBACK_SPEEDS = Object.freeze([0.5, 1, 1.5, 2, 3, 4]);
export const DEFAULT_REPLAY_SPEED = 1;
export const DEFAULT_REPLAY_INTERVAL_MS = 650;

export function normalizeReplaySpeed(speed) {
  const value = Number(speed);
  if (!Number.isFinite(value)) {
    throw new TypeError("replay speed must be a finite number");
  }
  if (!REPLAY_PLAYBACK_SPEEDS.includes(value)) {
    throw new RangeError("unsupported replay speed");
  }
  return value;
}

export function getReplayIntervalMs(speed = DEFAULT_REPLAY_SPEED, baseIntervalMs = DEFAULT_REPLAY_INTERVAL_MS) {
  const normalizedSpeed = normalizeReplaySpeed(speed);
  const base = Number(baseIntervalMs);
  if (!Number.isFinite(base) || base <= 0) {
    throw new RangeError("base replay interval must be a positive finite number");
  }
  return Math.max(50, Math.round(base / normalizedSpeed));
}

export function getReplaySpeedLabel(speed) {
  return String(normalizeReplaySpeed(speed)) + "×";
}
