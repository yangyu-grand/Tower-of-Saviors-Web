import { RUNE_BOARD_SIZE, RUNE_TYPES } from "./runeBoard.js";

const RUNE_TYPE_SET = new Set(RUNE_TYPES);
const DAMAGE_ELEMENT_SET = new Set(["fire", "water", "wood", "light", "dark"]);
const DAMAGE_RELATION_SET = new Set(["advantage", "disadvantage", "neutral"]);
const EVENT_TYPES = new Set([
  "turn-start", "skill", "swap", "cascade",
  "player-action", "enemy-action", "turn-end", "battle-end"
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function assertBoard(board, label) {
  if (!Array.isArray(board) || board.length !== RUNE_BOARD_SIZE ||
      board.some((rune) => !RUNE_TYPE_SET.has(rune))) {
    throw new TypeError(label + " must be a valid 30-cell rune board");
  }
}

function sameBoard(left, right) {
  return Array.isArray(left) && Array.isArray(right) &&
    left.length === right.length &&
    left.every((rune, index) => rune === right[index]);
}

function isAdjacent(first, second) {
  return Math.abs(first - second) === 6 ||
    (Math.floor(first / 6) === Math.floor(second / 6) && Math.abs(first - second) === 1);
}

function assertCellIndex(value, label) {
  if (!Number.isInteger(value) || value < 0 || value >= RUNE_BOARD_SIZE) {
    throw new RangeError(label + " must be a rune-board cell index");
  }
}

function assertSafeInteger(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(label + " must be a safe integer greater than or equal to " + minimum);
  }
}

function assertTurnTrace(turn, expectedTurn) {
  if (!isRecord(turn) || turn.turn !== expectedTurn) {
    throw new TypeError("battle turns must be ordered and numbered from one");
  }
  assertBoard(turn.boardAtTurnStart, "boardAtTurnStart");
  assertBoard(turn.boardBeforeMove, "boardBeforeMove");
  assertBoard(turn.boardAfterMove, "boardAfterMove");
  assertBoard(turn.boardAfterTurn, "boardAfterTurn");
  if (!isRecord(turn.move) || !isRecord(turn.moveTrace)) {
    throw new TypeError("each battle turn must include a move and moveTrace");
  }

  const trace = turn.moveTrace;
  assertBoard(trace.initialBoard, "moveTrace.initialBoard");
  assertBoard(trace.swappedBoard, "moveTrace.swappedBoard");
  assertBoard(trace.finalBoard, "moveTrace.finalBoard");
  assertCellIndex(turn.move.from, "move.from");
  assertCellIndex(turn.move.to, "move.to");
  if (!isAdjacent(turn.move.from, turn.move.to)) {
    throw new RangeError("replay swap must use adjacent cells");
  }
  if (!sameBoard(trace.initialBoard, turn.boardBeforeMove)) {
    throw new Error("moveTrace initial board does not match boardBeforeMove");
  }
  const expectedSwap = [...turn.boardBeforeMove];
  [expectedSwap[turn.move.from], expectedSwap[turn.move.to]] =
    [expectedSwap[turn.move.to], expectedSwap[turn.move.from]];
  if (!sameBoard(expectedSwap, trace.swappedBoard)) {
    throw new Error("moveTrace swapped board does not match the selected cells");
  }
  if (!sameBoard(trace.finalBoard, turn.boardAfterMove)) {
    throw new Error("moveTrace final board does not match boardAfterMove");
  }
  if (!Array.isArray(trace.cascades) || trace.cascades.length < 1 ||
      trace.cascades.length !== turn.move.combo) {
    throw new TypeError("moveTrace cascades must match the move Combo count");
  }
  trace.cascades.forEach((cascade, index) => {
    if (!isRecord(cascade) || cascade.combo !== index + 1 ||
        !Array.isArray(cascade.indices) || cascade.indices.length < 3 ||
        !Array.isArray(cascade.runes) || cascade.runes.length !== cascade.indices.length ||
        !isRecord(cascade.counts)) {
      throw new TypeError("invalid cascade replay frame");
    }
    cascade.indices.forEach((cell) => assertCellIndex(cell, "cascade cell"));
    cascade.runes.forEach((rune) => {
      if (!RUNE_TYPE_SET.has(rune)) throw new RangeError("cascade contains an unknown rune");
    });
    assertBoard(cascade.boardAfterRefill, "cascade boardAfterRefill");
  });
  if (!sameBoard(trace.cascades[trace.cascades.length - 1].boardAfterRefill, trace.finalBoard)) {
    throw new Error("last cascade frame must match the final board");
  }
  if (!turn.reshuffledAfterMove && !sameBoard(turn.boardAfterMove, turn.boardAfterTurn)) {
    throw new Error("boardAfterTurn must match boardAfterMove unless a reshuffle occurred");
  }
  if (typeof turn.reshuffledBeforeMove !== "boolean" ||
      typeof turn.reshuffledAfterMove !== "boolean") {
    throw new TypeError("replay reshuffle flags must be boolean");
  }
  if (!Array.isArray(turn.skillEvents)) throw new TypeError("skillEvents must be an array");
}

export function createRuneBattleReplay(simulation) {
  if (!isRecord(simulation)) throw new TypeError("simulation must be an object");
  if (!Number.isSafeInteger(simulation.seed)) throw new TypeError("simulation seed must be a safe integer");
  if (!isRecord(simulation.stage) || !isRecord(simulation.encounter) ||
      !isRecord(simulation.team) || !isRecord(simulation.policy)) {
    throw new TypeError("simulation metadata is incomplete");
  }
  if (!Array.isArray(simulation.turns) || simulation.turns.length < 1) {
    throw new TypeError("simulation must contain at least one battle turn");
  }
  if (simulation.turnsSimulated !== simulation.turns.length) {
    throw new RangeError("turnsSimulated must match the recorded turn count");
  }
  if (!["victory", "party-defeated", "turn-limit"].includes(simulation.status)) {
    throw new RangeError("simulation has an unknown battle status");
  }

  const events = [];
  const push = (turn, type, data) => {
    events.push({ index: events.length, turn, type, data: clone(data) });
  };
  let previousBoard = null;

  simulation.turns.forEach((turn, index) => {
    assertTurnTrace(turn, index + 1);
    if (previousBoard && !sameBoard(previousBoard, turn.boardAtTurnStart)) {
      throw new Error("adjacent replay turns must share the same board boundary");
    }
    previousBoard = [...turn.boardAfterTurn];

    push(turn.turn, "turn-start", {
      board: turn.boardAtTurnStart,
      reshuffledBeforeMove: turn.reshuffledBeforeMove
    });
    for (const skill of turn.skillEvents) {
      push(turn.turn, "skill", { ...skill, boardAfterSkill: turn.boardBeforeMove });
    }
    push(turn.turn, "swap", {
      from: turn.move.from,
      to: turn.move.to,
      direction: turn.move.direction,
      boardBeforeMove: turn.boardBeforeMove,
      swappedBoard: turn.moveTrace.swappedBoard
    });
    for (const cascade of turn.moveTrace.cascades) {
      push(turn.turn, "cascade", cascade);
    }
    push(turn.turn, "player-action", {
      combo: turn.move.combo,
      matchedRuneCount: turn.move.matchedRuneCount,
      runeCounts: turn.move.runeCounts,
      damage: turn.damageDealt,
      calculatedDamage: turn.calculatedDamage ?? turn.move.damage,
      ...(Array.isArray(turn.damageByElement ?? turn.move.damageByElement)
        ? { damageByElement: clone(turn.damageByElement ?? turn.move.damageByElement) }
        : {}),
      healing: turn.healingApplied,
      skillHealing: turn.skillHealingApplied,
      enemyHpBeforeAttack: turn.enemyHpBeforeAttack,
      enemyHpAfterTurn: turn.enemyHpAfterTurn
    });
    if (turn.enemyAction) {
      push(turn.turn, "enemy-action", {
        action: turn.enemyAction,
        adjustedIncomingDamage: turn.adjustedIncomingDamage,
        hpDamageTaken: turn.hpDamageTaken,
        shieldAbsorbed: turn.shieldAbsorbed,
        partyHpAfterTurn: turn.partyHpAfterTurn
      });
    }
    push(turn.turn, "turn-end", {
      boardAfterMove: turn.boardAfterMove,
      boardAfterTurn: turn.boardAfterTurn,
      reshuffledAfterMove: turn.reshuffledAfterMove,
      partyHpAfterTurn: turn.partyHpAfterTurn,
      shieldAfterTurn: turn.shieldAfterTurn,
      cooldownsAfterTurn: turn.cooldownsAfterTurn,
      reshuffleCount: turn.reshuffleCount
    });
  });

  push(simulation.turnsSimulated, "battle-end", {
    status: simulation.status,
    victory: simulation.victory,
    partyDefeated: simulation.partyDefeated,
    turnsSimulated: simulation.turnsSimulated,
    totalDamageDealt: simulation.totalDamageDealt,
    totalHealingApplied: simulation.totalHealingApplied,
    totalHpDamageTaken: simulation.totalHpDamageTaken,
    totalShieldAbsorbed: simulation.totalShieldAbsorbed,
    enemyHpRemaining: simulation.enemyHpRemaining,
    remainingPartyHp: simulation.remainingPartyHp,
    remainingShield: simulation.remainingShield,
    phaseNames: simulation.phaseNames
  });

  const replay = {
    schemaVersion: 1,
    seed: simulation.seed,
    stage: clone(simulation.stage),
    encounter: clone(simulation.encounter),
    team: clone(simulation.team),
    policy: clone(simulation.policy),
    status: simulation.status,
    turnsSimulated: simulation.turnsSimulated,
    eventCount: events.length,
    events
  };
  validateRuneBattleReplay(replay);
  return replay;
}

export function validateRuneBattleReplay(replay) {
  if (!isRecord(replay) || replay.schemaVersion !== 1) {
    throw new RangeError("unsupported battle replay schema");
  }
  if (!Number.isSafeInteger(replay.seed)) throw new TypeError("replay seed must be a safe integer");
  if (!isRecord(replay.stage) || !isRecord(replay.encounter) ||
      !isRecord(replay.team) || !isRecord(replay.policy)) {
    throw new TypeError("replay metadata is incomplete");
  }
  if (!["victory", "party-defeated", "turn-limit"].includes(replay.status)) {
    throw new RangeError("replay has an unknown battle status");
  }
  assertSafeInteger(replay.turnsSimulated, "turnsSimulated", 1);
  if (!Array.isArray(replay.events) || replay.events.length !== replay.eventCount) {
    throw new TypeError("replay eventCount does not match its events");
  }

  replay.events.forEach((event, index) => {
    if (!isRecord(event) || event.index !== index ||
        !EVENT_TYPES.has(event.type) || !isRecord(event.data)) {
      throw new TypeError("replay events must be indexed, typed records");
    }
    assertSafeInteger(event.turn, "event turn");
    if (event.turn > replay.turnsSimulated) {
      throw new RangeError("replay event references a turn outside the battle");
    }
    for (const key of ["board", "boardBeforeMove", "swappedBoard", "boardAfterMove", "boardAfterTurn", "boardAfterSkill", "boardAfterRefill"]) {
      if (event.data[key] !== undefined) assertBoard(event.data[key], "event data " + key);
    }
    if (event.type === "swap") {
      assertCellIndex(event.data.from, "swap.from");
      assertCellIndex(event.data.to, "swap.to");
      if (!isAdjacent(event.data.from, event.data.to)) {
        throw new RangeError("replay swap must use adjacent cells");
      }
    }
    if (event.type === "cascade") {
      if (!Number.isInteger(event.data.combo) || event.data.combo < 1 ||
          !Array.isArray(event.data.indices) || event.data.indices.length < 3) {
        throw new TypeError("invalid replay cascade event");
      }
      event.data.indices.forEach((cell) => assertCellIndex(cell, "cascade cell"));
    }
    if (event.type === "player-action") {
      if (event.data.calculatedDamage !== undefined) assertSafeInteger(event.data.calculatedDamage, "calculatedDamage");
      if (event.data.damageByElement !== undefined) {
        if (!Array.isArray(event.data.damageByElement)) throw new TypeError("player-action damageByElement must be an array");
        const seenElements = new Set();
        let breakdownTotal = 0;
        for (const item of event.data.damageByElement) {
          if (!isRecord(item) || !DAMAGE_ELEMENT_SET.has(item.element) || seenElements.has(item.element) ||
              !Number.isSafeInteger(item.runeCount) || item.runeCount < 1 ||
              !Number.isSafeInteger(item.damage) || item.damage < 0 || !DAMAGE_RELATION_SET.has(item.relation)) {
            throw new TypeError("player-action contains an invalid elemental damage breakdown");
          }
          seenElements.add(item.element);
          breakdownTotal += item.damage;
          if (!Number.isSafeInteger(breakdownTotal)) throw new RangeError("elemental damage breakdown exceeds the safe integer range");
        }
        if (event.data.calculatedDamage !== undefined && breakdownTotal !== event.data.calculatedDamage) {
          throw new Error("elemental damage breakdown must sum to calculatedDamage");
        }
      }
    }
  });
  return true;
}

export function getRuneBattleReplayEvent(replay, index) {
  validateRuneBattleReplay(replay);
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError("replay event index must be a non-negative integer");
  }
  return replay.events[index] ? clone(replay.events[index]) : null;
}
