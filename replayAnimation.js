const BOARD_ROWS = 5;
const BOARD_COLUMNS = 6;
const BOARD_SIZE = BOARD_ROWS * BOARD_COLUMNS;

export const REPLAY_ANIMATION_DURATIONS = Object.freeze({
  swap: 220,
  cascade: 460,
  skill: 420,
  playerAction: 320,
  enemyAction: 380
});

function assertEvent(event) {
  if (!event || typeof event !== "object" || !event.data ||
      typeof event.data !== "object" || Array.isArray(event.data)) {
    throw new TypeError("replay animation requires an event with object data");
  }
}

function assertCell(index, label) {
  if (!Number.isInteger(index) || index < 0 || index >= BOARD_SIZE) {
    throw new RangeError(label + " must be a valid 6x5 board cell");
  }
}

function isAdjacent(first, second) {
  return Math.abs(first - second) === BOARD_COLUMNS ||
    (Math.floor(first / BOARD_COLUMNS) === Math.floor(second / BOARD_COLUMNS) &&
      Math.abs(first - second) === 1);
}

export function getReplayAnimationPlan(event) {
  assertEvent(event);
  const data = event.data;

  if (event.type === "swap") {
    const from = data.from;
    const to = data.to;
    assertCell(from, "swap.from");
    assertCell(to, "swap.to");
    if (!isAdjacent(from, to)) {
      throw new RangeError("replay animation swap must use adjacent cells");
    }
    const offsetX = (to % BOARD_COLUMNS) - (from % BOARD_COLUMNS);
    const offsetY = Math.floor(to / BOARD_COLUMNS) - Math.floor(from / BOARD_COLUMNS);
    return {
      kind: "swap",
      durationMs: REPLAY_ANIMATION_DURATIONS.swap,
      cells: [
        { index: from, effect: "swap", offsetX, offsetY, delayMs: 0 },
        { index: to, effect: "swap", offsetX: -offsetX, offsetY: -offsetY, delayMs: 0 }
      ]
    };
  }

  if (event.type === "cascade") {
    const indices = data.indices;
    if (!Array.isArray(indices) || indices.length < 3) {
      throw new TypeError("cascade animation requires at least three matched cells");
    }
    const matched = new Set();
    const maxRowByColumn = new Map();
    for (const index of indices) {
      assertCell(index, "cascade index");
      if (matched.has(index)) throw new RangeError("cascade indices must be unique");
      matched.add(index);
      const row = Math.floor(index / BOARD_COLUMNS);
      const column = index % BOARD_COLUMNS;
      maxRowByColumn.set(column, Math.max(maxRowByColumn.get(column) ?? -1, row));
    }

    const cells = [];
    for (const [column, maxRow] of [...maxRowByColumn.entries()].sort((a, b) => a[0] - b[0])) {
      for (let row = 0; row <= maxRow; row += 1) {
        const index = row * BOARD_COLUMNS + column;
        cells.push({
          index,
          effect: matched.has(index) ? "refill" : "drop",
          delayMs: Math.min(140, row * 24 + (column % 3) * 10)
        });
      }
    }
    return {
      kind: "cascade",
      durationMs: REPLAY_ANIMATION_DURATIONS.cascade,
      cells
    };
  }

  if (event.type === "skill") {
    return { kind: "skill", durationMs: REPLAY_ANIMATION_DURATIONS.skill, cells: [] };
  }
  if (event.type === "player-action") {
    return { kind: "player-action", durationMs: REPLAY_ANIMATION_DURATIONS.playerAction, cells: [] };
  }
  if (event.type === "enemy-action") {
    return { kind: "enemy-hit", durationMs: REPLAY_ANIMATION_DURATIONS.enemyAction, cells: [] };
  }
  return null;
}
