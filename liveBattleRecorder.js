import { validateRuneBattleReplay } from "./runeBattleReplay.js";

const RUNE_TYPES = new Set(["fire", "water", "wood", "light", "dark", "heart"]);
const BOARD_SIZE = 30;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(label + " must be an object");
  }
}

function assertBoard(board, label) {
  if (!Array.isArray(board) || board.length !== BOARD_SIZE ||
      board.some((rune) => !RUNE_TYPES.has(rune))) {
    throw new TypeError(label + " must be a valid 30-cell rune board");
  }
}

function assertCell(index, label) {
  if (!Number.isInteger(index) || index < 0 || index >= BOARD_SIZE) {
    throw new RangeError(label + " must be a valid board cell");
  }
}

function isAdjacent(first, second) {
  return Math.abs(first - second) === 6 ||
    (Math.floor(first / 6) === Math.floor(second / 6) &&
      Math.abs(first - second) === 1);
}

function safeTotal(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function createLiveBattleRecorder({ seed, stage, encounter, team }) {
  if (!Number.isSafeInteger(seed)) throw new TypeError("seed must be a safe integer");
  assertRecord(stage, "stage");
  assertRecord(encounter, "encounter");
  assertRecord(team, "team");

  const replay = {
    schemaVersion: 1,
    source: "live-player",
    seed,
    stage: clone(stage),
    encounter: clone(encounter),
    team: clone(team),
    policy: { type: "human", label: "玩家實際操作" },
    status: "turn-limit",
    turnsSimulated: 0,
    eventCount: 0,
    events: []
  };

  let currentTurn = 0;
  let turnOpen = false;
  let finished = false;

  function assertWritable() {
    if (finished) throw new Error("live battle replay is already finished");
  }

  function assertTurnOpen() {
    assertWritable();
    if (!turnOpen) throw new Error("startTurn must be called before recording turn events");
  }

  function push(type, data) {
    replay.events.push({
      index: replay.events.length,
      turn: currentTurn,
      type,
      data: clone(data)
    });
    replay.eventCount = replay.events.length;
  }

  return {
    get turnsSimulated() {
      return currentTurn;
    },

    startTurn({ turn, board, reshuffledBeforeMove = false }) {
      assertWritable();
      if (turnOpen) throw new Error("the previous live replay turn has not ended");
      if (!Number.isInteger(turn) || turn !== currentTurn + 1) {
        throw new RangeError("live replay turns must be sequential");
      }
      assertBoard(board, "turn-start board");
      if (typeof reshuffledBeforeMove !== "boolean") {
        throw new TypeError("reshuffledBeforeMove must be boolean");
      }
      currentTurn = turn;
      replay.turnsSimulated = currentTurn;
      turnOpen = true;
      push("turn-start", { board, reshuffledBeforeMove });
    },

    recordSkill({ name, cardId, summary, boardAfterSkill }) {
      assertTurnOpen();
      assertBoard(boardAfterSkill, "boardAfterSkill");
      push("skill", {
        name: String(name ?? "角色技能"),
        cardId: String(cardId ?? ""),
        summary: String(summary ?? ""),
        boardAfterSkill
      });
    },

    recordSwap({ from, to, direction, boardBeforeMove, swappedBoard }) {
      assertTurnOpen();
      assertCell(from, "swap.from");
      assertCell(to, "swap.to");
      if (!isAdjacent(from, to)) throw new RangeError("live replay swap must use adjacent cells");
      assertBoard(boardBeforeMove, "boardBeforeMove");
      assertBoard(swappedBoard, "swappedBoard");
      const expected = [...boardBeforeMove];
      [expected[from], expected[to]] = [expected[to], expected[from]];
      if (expected.some((rune, index) => rune !== swappedBoard[index])) {
        throw new Error("swappedBoard does not match the recorded swap");
      }
      push("swap", {
        from,
        to,
        direction: String(direction ?? ""),
        boardBeforeMove,
        swappedBoard
      });
    },

    recordCascade({ combo, indices, runes, counts, boardAfterRefill }) {
      assertTurnOpen();
      if (!Number.isInteger(combo) || combo < 1) throw new RangeError("combo must be positive");
      if (!Array.isArray(indices) || indices.length < 3) {
        throw new TypeError("cascade must contain at least three matched cells");
      }
      if (!Array.isArray(runes) || runes.length !== indices.length ||
          runes.some((rune) => !RUNE_TYPES.has(rune))) {
        throw new TypeError("cascade runes must match the matched cell indices");
      }
      indices.forEach((index) => assertCell(index, "cascade index"));
      assertRecord(counts, "cascade counts");
      assertBoard(boardAfterRefill, "boardAfterRefill");
      push("cascade", { combo, indices, runes, counts, boardAfterRefill });
    },

    recordPlayerAction(data) {
      assertTurnOpen();
      assertRecord(data, "player action");
      push("player-action", data);
    },

    recordEnemyAction(data) {
      assertTurnOpen();
      assertRecord(data, "enemy action");
      push("enemy-action", data);
    },

    endTurn(data) {
      assertTurnOpen();
      assertRecord(data, "turn end");
      assertBoard(data.boardAfterMove, "boardAfterMove");
      assertBoard(data.boardAfterTurn, "boardAfterTurn");
      if (typeof data.reshuffledAfterMove !== "boolean") {
        throw new TypeError("reshuffledAfterMove must be boolean");
      }
      push("turn-end", data);
      turnOpen = false;
    },

    finish(status, totals = {}) {
      assertWritable();
      if (turnOpen) throw new Error("endTurn must be called before finishing a replay");
      if (currentTurn < 1) throw new Error("cannot finish a live replay without a recorded turn");
      if (!["victory", "party-defeated", "turn-limit"].includes(status)) {
        throw new RangeError("unknown live battle replay status");
      }
      assertRecord(totals, "battle totals");
      replay.status = status;
      push("battle-end", {
        status,
        victory: status === "victory",
        partyDefeated: status === "party-defeated",
        turnsSimulated: currentTurn,
        totalDamageDealt: safeTotal(totals.totalDamageDealt),
        totalHealingApplied: safeTotal(totals.totalHealingApplied),
        totalHpDamageTaken: safeTotal(totals.totalHpDamageTaken),
        totalShieldAbsorbed: safeTotal(totals.totalShieldAbsorbed),
        enemyHpRemaining: safeTotal(totals.enemyHpRemaining),
        remainingPartyHp: safeTotal(totals.remainingPartyHp),
        remainingShield: safeTotal(totals.remainingShield)
      });
      replay.eventCount = replay.events.length;
      validateRuneBattleReplay(replay);
      finished = true;
      return clone(replay);
    }
  };
}
