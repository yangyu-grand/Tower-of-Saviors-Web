import { validateRuneBattleReplay } from "./runeBattleReplay.js";

const BOARD_KEYS = [
  "boardAfterRefill", "boardAfterSkill", "swappedBoard",
  "boardAfterTurn", "boardAfterMove", "board", "boardBeforeMove"
];
const RUNE_NAMES = {
  fire: "火", water: "水", wood: "木",
  light: "光", dark: "暗", heart: "心"
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertViewerState(state) {
  if (!state || typeof state !== "object" || !state.replay ||
      !Array.isArray(state.replay.events) ||
      !Number.isInteger(state.index) ||
      state.index < 0 || state.index >= state.replay.events.length ||
      typeof state.playing !== "boolean") {
    throw new TypeError("invalid replay viewer state");
  }
}

export function createReplayViewerState(replay) {
  validateRuneBattleReplay(replay);
  const snapshot = clone(replay);
  return { replay: snapshot, index: 0, playing: false };
}

export function seekReplayViewer(state, index) {
  assertViewerState(state);
  if (!Number.isInteger(index)) throw new TypeError("replay index must be an integer");
  const last = state.replay.events.length - 1;
  return { ...state, index: Math.max(0, Math.min(last, index)), playing: false };
}

export function stepReplayViewer(state, delta) {
  assertViewerState(state);
  if (!Number.isInteger(delta) || delta === 0) {
    throw new TypeError("replay step must be a non-zero integer");
  }
  return seekReplayViewer(state, state.index + delta);
}

export function setReplayViewerPlaying(state, playing) {
  assertViewerState(state);
  if (typeof playing !== "boolean") throw new TypeError("playing must be boolean");
  const last = state.replay.events.length - 1;
  return { ...state, playing: playing && state.index < last };
}

export function advanceReplayViewer(state) {
  assertViewerState(state);
  if (!state.playing) return state;
  const last = state.replay.events.length - 1;
  const index = Math.min(last, state.index + 1);
  return { ...state, index, playing: index < last };
}

export function getReplayViewerFrame(state) {
  assertViewerState(state);
  const event = clone(state.replay.events[state.index]);
  let board = null;
  for (let cursor = state.index; cursor >= 0 && !board; cursor -= 1) {
    const data = state.replay.events[cursor].data;
    const type = state.replay.events[cursor].type;
    const preferred = type === "cascade" ? ["boardAfterRefill"] :
      type === "swap" ? ["swappedBoard"] :
      type === "skill" ? ["boardAfterSkill"] :
      type === "turn-end" ? ["boardAfterTurn", "boardAfterMove"] : BOARD_KEYS;
    const key = preferred.find((candidate) =>
      Array.isArray(data[candidate]) && data[candidate].length === 30
    );
    if (key) board = [...data[key]];
  }
  return { event, board };
}

export function describeReplayEvent(event) {
  if (!event || typeof event !== "object" || !event.data || typeof event.data !== "object") {
    throw new TypeError("invalid replay event");
  }
  const data = event.data;
  const turn = Number.isInteger(event.turn) ? event.turn : 0;
  switch (event.type) {
    case "turn-start":
      return {
        title: "第 " + turn + " 回合開始",
        detail: data.reshuffledBeforeMove ? "盤面在回合開始前已自動重排。" : "載入本回合盤面，準備選擇合法交換。"
      };
    case "skill": {
      const name = data.name ?? data.skillName ?? data.cardId ?? data.type ?? "角色技能";
      return { title: "主動技能", detail: "發動：" + String(name) };
    }
    case "swap":
      return { title: "符石交換", detail: "交換第 " + (data.from + 1) + " 格與第 " + (data.to + 1) + " 格。" };
    case "cascade": {
      const counts = Object.entries(data.counts ?? {})
        .map(([rune, count]) => (RUNE_NAMES[rune] ?? rune) + " ×" + count)
        .join("、");
      return {
        title: "Combo " + data.combo + " 消除",
        detail: "消除 " + data.indices.length + " 顆符石" + (counts ? "（" + counts + "）" : "") + "，接著執行重力補珠。"
      };
    }
    case "player-action":
      return {
        title: "玩家攻擊",
        detail: "Combo " + data.combo + " · 傷害 " + data.damage + " · 回復 " +
          ((data.healing ?? 0) + (data.skillHealing ?? 0)) + " HP。"
      };
    case "enemy-action": {
      const action = data.action && typeof data.action === "object" ? data.action : {};
      const name = action.label ?? action.name ?? action.type ?? "敵人行動";
      return {
        title: "敵人反擊",
        detail: String(name) + " · 受到 HP 傷害 " + data.hpDamageTaken +
          " · 護盾吸收 " + data.shieldAbsorbed + "。"
      };
    }
    case "turn-end":
      return {
        title: "第 " + turn + " 回合結束",
        detail: "隊伍 HP " + data.partyHpAfterTurn + " · 護盾 " + data.shieldAfterTurn +
          (data.reshuffledAfterMove ? " · 盤面已重排" : "") + "。"
      };
    case "battle-end": {
      const status = data.status === "victory" ? "勝利" :
        data.status === "party-defeated" ? "隊伍全滅" : "回合上限";
      return {
        title: "戰鬥結算：" + status,
        detail: "共 " + data.turnsSimulated + " 回合 · 總傷害 " +
          data.totalDamageDealt + " · 剩餘隊伍 HP " + data.remainingPartyHp + "。"
      };
    }
    default:
      return { title: "戰鬥事件", detail: "第 " + turn + " 回合。" };
  }
}
