export const RUNE_BOARD_WIDTH = 6;
export const RUNE_BOARD_HEIGHT = 5;
export const RUNE_BOARD_SIZE = RUNE_BOARD_WIDTH * RUNE_BOARD_HEIGHT;
export const RUNE_TYPES = Object.freeze(["fire", "water", "wood", "light", "dark", "heart"]);

const RUNE_TYPE_SET = new Set(RUNE_TYPES);
const FALLBACK_BOARD = Object.freeze([
  "fire", "water", "wood", "light", "dark", "heart",
  "water", "fire", "heart", "dark", "light", "wood",
  "fire", "wood", "water", "heart", "dark", "light",
  "water", "heart", "fire", "wood", "light", "dark",
  "wood", "fire", "dark", "light", "heart", "water"
]);

function assertBoard(board, { allowEmpty = false } = {}) {
  if (!Array.isArray(board) || board.length !== RUNE_BOARD_SIZE) {
    throw new TypeError("A rune board must contain exactly " + RUNE_BOARD_SIZE + " cells");
  }
  board.forEach((rune, index) => {
    if (allowEmpty && rune === null) return;
    if (!RUNE_TYPE_SET.has(rune)) {
      throw new TypeError("Unknown rune at index " + index + ": " + String(rune));
    }
  });
}

function assertRandomSource(random) {
  if (typeof random !== "function") {
    throw new TypeError("random must be a function returning a number in [0, 1)");
  }
}

function randomRune(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("random must return a finite number in [0, 1)");
  }
  return RUNE_TYPES[Math.floor(value * RUNE_TYPES.length)];
}

export function createSeededRandom(seed = 1) {
  if (!Number.isSafeInteger(seed)) {
    throw new TypeError("seed must be a safe integer");
  }
  let state = seed >>> 0;
  return function seededRandom() {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function findRuneMatches(board) {
  assertBoard(board, { allowEmpty: true });
  const matched = new Set();

  function scanLine(indices) {
    let cursor = 0;
    while (cursor < indices.length) {
      const type = board[indices[cursor]];
      let end = cursor + 1;
      while (type !== null && end < indices.length && board[indices[end]] === type) {
        end += 1;
      }
      if (type !== null && end - cursor >= 3) {
        for (let index = cursor; index < end; index += 1) {
          matched.add(indices[index]);
        }
      }
      cursor = end;
    }
  }

  for (let row = 0; row < RUNE_BOARD_HEIGHT; row += 1) {
    scanLine(Array.from({ length: RUNE_BOARD_WIDTH }, (_, column) =>
      row * RUNE_BOARD_WIDTH + column
    ));
  }
  for (let column = 0; column < RUNE_BOARD_WIDTH; column += 1) {
    scanLine(Array.from({ length: RUNE_BOARD_HEIGHT }, (_, row) =>
      row * RUNE_BOARD_WIDTH + column
    ));
  }
  return matched;
}

export function isAdjacentRuneCells(first, second) {
  if (!Number.isInteger(first) || !Number.isInteger(second) ||
      first < 0 || second < 0 ||
      first >= RUNE_BOARD_SIZE || second >= RUNE_BOARD_SIZE ||
      first === second) {
    return false;
  }
  const vertical = Math.abs(first - second) === RUNE_BOARD_WIDTH;
  const sameRow = Math.floor(first / RUNE_BOARD_WIDTH) === Math.floor(second / RUNE_BOARD_WIDTH);
  return vertical || (sameRow && Math.abs(first - second) === 1);
}

export function hasLegalRuneSwap(board) {
  assertBoard(board);
  if (findRuneMatches(board).size > 0) return false;

  for (let index = 0; index < RUNE_BOARD_SIZE; index += 1) {
    const neighbors = [];
    if (index % RUNE_BOARD_WIDTH < RUNE_BOARD_WIDTH - 1) neighbors.push(index + 1);
    if (index + RUNE_BOARD_WIDTH < RUNE_BOARD_SIZE) neighbors.push(index + RUNE_BOARD_WIDTH);
    for (const neighbor of neighbors) {
      const swapped = [...board];
      [swapped[index], swapped[neighbor]] = [swapped[neighbor], swapped[index]];
      if (findRuneMatches(swapped).size > 0) return true;
    }
  }
  return false;
}

export function createRuneBoard({
  random = Math.random,
  maxAttempts = 256,
  ensurePlayable = true
} = {}) {
  assertRandomSource(random);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10000) {
    throw new RangeError("maxAttempts must be an integer between 1 and 10000");
  }
  if (typeof ensurePlayable !== "boolean") {
    throw new TypeError("ensurePlayable must be a boolean");
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const board = Array.from({ length: RUNE_BOARD_SIZE }, () => randomRune(random));
    if (findRuneMatches(board).size === 0 &&
        (!ensurePlayable || hasLegalRuneSwap(board))) {
      return board;
    }
  }

  return [...FALLBACK_BOARD];
}

export function collapseRuneBoard(board, removedIndices = [], random = Math.random) {
  assertBoard(board, { allowEmpty: true });
  assertRandomSource(random);
  if (!(Array.isArray(removedIndices) || removedIndices instanceof Set)) {
    throw new TypeError("removedIndices must be an array or Set");
  }

  const removed = new Set(removedIndices);
  for (const index of removed) {
    if (!Number.isInteger(index) || index < 0 || index >= RUNE_BOARD_SIZE) {
      throw new RangeError("removed rune index is outside the board");
    }
  }

  const result = Array(RUNE_BOARD_SIZE).fill(null);
  for (let column = 0; column < RUNE_BOARD_WIDTH; column += 1) {
    const survivors = [];
    for (let row = RUNE_BOARD_HEIGHT - 1; row >= 0; row -= 1) {
      const index = row * RUNE_BOARD_WIDTH + column;
      const rune = board[index];
      if (!removed.has(index) && rune !== null) survivors.push(rune);
    }
    while (survivors.length < RUNE_BOARD_HEIGHT) {
      survivors.push(randomRune(random));
    }
    for (let row = RUNE_BOARD_HEIGHT - 1; row >= 0; row -= 1) {
      result[row * RUNE_BOARD_WIDTH + column] = survivors[RUNE_BOARD_HEIGHT - 1 - row];
    }
  }
  return result;
}

export function resolveRuneSwap(board, first, second, {
  random = Math.random,
  maxCascades = 12
} = {}) {
  assertBoard(board);
  assertRandomSource(random);
  if (!Number.isInteger(maxCascades) || maxCascades < 1 || maxCascades > 30) {
    throw new RangeError("maxCascades must be an integer between 1 and 30");
  }

  if (!isAdjacentRuneCells(first, second)) {
    return {
      valid: false,
      reason: "not-adjacent",
      board: [...board],
      combo: 0,
      cascades: [],
      chainCapped: false
    };
  }

  const nextBoard = [...board];
  [nextBoard[first], nextBoard[second]] = [nextBoard[second], nextBoard[first]];
  let matches = findRuneMatches(nextBoard);
  if (matches.size === 0) {
    return {
      valid: false,
      reason: "no-match",
      board: [...board],
      combo: 0,
      cascades: [],
      chainCapped: false
    };
  }

  const cascades = [];
  while (matches.size > 0 && cascades.length < maxCascades) {
    const indices = [...matches].sort((a, b) => a - b);
    const runes = indices.map((index) => nextBoard[index]);
    const counts = {};
    runes.forEach((rune) => {
      counts[rune] = (counts[rune] ?? 0) + 1;
    });
    const collapsed = collapseRuneBoard(nextBoard, indices, random);
    cascades.push({
      combo: cascades.length + 1,
      indices,
      runes,
      counts,
      board: [...collapsed]
    });
    for (let index = 0; index < RUNE_BOARD_SIZE; index += 1) {
      nextBoard[index] = collapsed[index];
    }
    matches = findRuneMatches(nextBoard);
  }

  return {
    valid: true,
    reason: null,
    board: nextBoard,
    combo: cascades.length,
    cascades,
    chainCapped: matches.size > 0
  };
}
