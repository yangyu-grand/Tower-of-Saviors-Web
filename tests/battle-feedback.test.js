import test from "node:test";
import assert from "node:assert/strict";
import { createBattleFeedback } from "../battleFeedback.js";

function makeClassList() {
  const values = new Set();
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); }
  };
}

function makeAudioContext() {
  const calls = { oscillators: 0, starts: 0, stops: 0, frequencies: [] };
  const context = {
    currentTime: 2,
    state: "running",
    destination: {},
    createOscillator() {
      calls.oscillators += 1;
      return {
        type: "sine",
        frequency: { setValueAtTime(value) { calls.frequencies.push(value); } },
        connect() {},
        start() { calls.starts += 1; },
        stop() { calls.stops += 1; }
      };
    },
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          exponentialRampToValueAtTime() {}
        },
        connect() {}
      };
    },
    close() { return Promise.resolve(); }
  };
  return { context, calls };
}

function makeBoard() {
  const orbs = Array.from({ length: 3 }, () => ({
    classList: makeClassList(),
    style: { values: {}, setProperty(name, value) { this.values[name] = value; } }
  }));
  return {
    orbs,
    classList: makeClassList(),
    querySelector(selector) {
      const match = selector.match(/data-i="(\d+)"/);
      return match ? orbs[Number(match[1])] ?? null : null;
    }
  };
}

test("sound is opt-in and disabled sound never creates an audio context", () => {
  const audio = makeAudioContext();
  let created = 0;
  const feedback = createBattleFeedback({
    audioContextFactory: () => { created += 1; return audio.context; },
    reducedMotion: true
  });

  assert.equal(feedback.isMuted(), true);
  feedback.playHit();
  assert.equal(created, 0);
  assert.equal(feedback.setMuted(false), false);
  assert.equal(created, 1);
  feedback.playHit();
  assert.equal(audio.calls.oscillators, 1);
  feedback.setMuted(true);
  feedback.playHit();
  assert.equal(audio.calls.oscillators, 1);
  feedback.destroy();
});

test("matching runes receives a staggered animation class without changing board data", () => {
  const board = makeBoard();
  const feedback = createBattleFeedback({ boardElement: board, reducedMotion: false });
  feedback.playMatch([0, 2], 3);

  assert.equal(board.orbs[0].classList.contains("match-pop"), true);
  assert.equal(board.orbs[2].classList.contains("match-pop"), true);
  assert.equal(board.orbs[1].classList.contains("match-pop"), false);
  assert.equal(board.orbs[0].style.values["--match-delay"], "0ms");
  assert.equal(board.orbs[2].style.values["--match-delay"], "3ms");
});

test("hit, attack, healing, skill, and victory hooks target the intended elements", () => {
  const board = makeBoard();
  const enemy = { classList: makeClassList(), offsetWidth: 1 };
  const feedback = createBattleFeedback({ boardElement: board, enemyElement: enemy });

  feedback.playHit();
  assert.equal(enemy.classList.contains("enemy-hit"), true);
  feedback.playEnemyAttack();
  assert.equal(board.classList.contains("board-hit"), true);
  feedback.playHeal();
  assert.equal(board.classList.contains("board-heal"), true);
  feedback.playSkill();
  assert.equal(board.classList.contains("board-skill"), true);
  feedback.playVictory();
  assert.equal(board.classList.contains("board-victory"), true);
});

test("reduced-motion preference disables decorative animation hooks", () => {
  const board = makeBoard();
  const enemy = { classList: makeClassList(), offsetWidth: 1 };
  const feedback = createBattleFeedback({
    boardElement: board,
    enemyElement: enemy,
    reducedMotion: true
  });

  feedback.playMatch([0, 1], 2);
  feedback.playHit();
  feedback.playEnemyAttack();
  feedback.playHeal();
  feedback.playSkill();
  feedback.playVictory();

  assert.equal(board.orbs[0].classList.contains("match-pop"), false);
  assert.equal(board.classList.contains("board-hit"), false);
  assert.equal(board.classList.contains("board-heal"), false);
  assert.equal(board.classList.contains("board-skill"), false);
  assert.equal(enemy.classList.contains("enemy-hit"), false);
  assert.equal(board.classList.contains("board-victory"), false);
});

test("unsupported audio keeps the control safely muted", () => {
  const feedback = createBattleFeedback({
    audioContextFactory: () => null,
    reducedMotion: true
  });
  assert.equal(feedback.setMuted(false), true);
  assert.equal(feedback.isMuted(), true);
  feedback.playVictory();
});
