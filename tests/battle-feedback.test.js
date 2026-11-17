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
  const calls = { oscillators: 0, starts: 0, stops: 0, frequencies: [], waveforms: [], peakVolumes: [] };
  const context = {
    currentTime: 2,
    state: "running",
    destination: {},
    createOscillator() {
      calls.oscillators += 1;
      const oscillator = {
        type: "sine",
        frequency: { setValueAtTime(value) { calls.frequencies.push(value); } },
        connect() {},
        start() { calls.starts += 1; calls.waveforms.push(oscillator.type); },
        stop() { calls.stops += 1; }
      };
      return oscillator;
    },
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          exponentialRampToValueAtTime(value) {
            if (value > 0.0001) calls.peakVolumes.push(value);
          }
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

test("per-cue volume scaling clamps safely and zero volume creates no tone", () => {
  const audio = makeAudioContext();
  const feedback = createBattleFeedback({
    audioContextFactory: () => audio.context,
    reducedMotion: true
  });
  feedback.setMuted(false);

  feedback.playHit(0.5);
  assert.deepEqual(audio.calls.peakVolumes, [0.02]);

  feedback.playHit(2);
  assert.deepEqual(audio.calls.peakVolumes, [0.02, 0.04]);

  const oscillatorCount = audio.calls.oscillators;
  feedback.playHit(0);
  feedback.playHit(-1);
  assert.equal(audio.calls.oscillators, oscillatorCount);
  feedback.destroy();
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


test("five elemental hits use distinct deterministic timbres and replay volume scaling", () => {
  const audio = makeAudioContext();
  const feedback = createBattleFeedback({
    audioContextFactory: () => audio.context,
    reducedMotion: true
  });
  feedback.setMuted(false);

  const expected = {
    fire: { frequencies: [196, 294], waveforms: ["sawtooth", "triangle"] },
    water: { frequencies: [392, 587.33], waveforms: ["sine", "sine"] },
    wood: { frequencies: [261.63, 329.63], waveforms: ["triangle", "triangle"] },
    light: { frequencies: [659.25, 987.77], waveforms: ["sine", "sine"] },
    dark: { frequencies: [146.83, 220], waveforms: ["square", "sawtooth"] }
  };

  for (const [element, signature] of Object.entries(expected)) {
    const start = audio.calls.starts;
    const frequencyStart = audio.calls.frequencies.length;
    const waveformStart = audio.calls.waveforms.length;
    assert.equal(feedback.playElementHit(element, 0.5), true);
    assert.deepEqual(audio.calls.frequencies.slice(frequencyStart), signature.frequencies);
    assert.deepEqual(audio.calls.waveforms.slice(waveformStart), signature.waveforms);
    assert.equal(audio.calls.starts - start, 2);
  }

  const oscillatorCount = audio.calls.oscillators;
  assert.equal(feedback.playElementHit("heart", 1), false);
  assert.equal(feedback.playElementHit("fire", 0), false);
  assert.equal(audio.calls.oscillators, oscillatorCount);
  assert.deepEqual(audio.calls.peakVolumes.slice(0, 2), [0.013, 0.011]);
  feedback.destroy();
});
