const DEFAULT_VOLUME = 0.035;

function prefersReducedMotion() {
  try {
    return Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    return false;
  }
}

export function createBattleFeedback({
  boardElement = null,
  enemyElement = null,
  audioContextFactory = null,
  reducedMotion = prefersReducedMotion()
} = {}) {
  let muted = true;
  let audioContext = null;
  let destroyed = false;

  function getAudioContext() {
    if (muted || destroyed) return null;
    if (!audioContext) {
      try {
        if (audioContextFactory) {
          audioContext = audioContextFactory();
        } else {
          const AudioContextConstructor = globalThis.AudioContext || globalThis.webkitAudioContext;
          audioContext = AudioContextConstructor ? new AudioContextConstructor() : null;
        }
      } catch {
        audioContext = null;
      }
    }
    if (audioContext?.state === "suspended" && typeof audioContext.resume === "function") {
      try {
        Promise.resolve(audioContext.resume()).catch(() => {});
      } catch {
        // Audio is optional; a blocked device must never interrupt gameplay.
      }
    }
    return audioContext;
  }

  function playTone(frequency, duration, waveform = "sine", delay = 0, volume = DEFAULT_VOLUME, volumeScale = 1) {
    const safeVolumeScale = Number.isFinite(volumeScale)
      ? Math.min(1, Math.max(0, volumeScale))
      : 1;
    if (safeVolumeScale === 0) return false;
    const context = getAudioContext();
    if (!context) return false;
    try {
      const startAt = context.currentTime + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * safeVolumeScale), startAt + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.02);
      return true;
    } catch {
      return false;
    }
  }

  function pulse(element, className) {
    if (reducedMotion || !element?.classList) return;
    element.classList.remove(className);
    if (typeof element.offsetWidth === "number") void element.offsetWidth;
    element.classList.add(className);
  }

  function playMatch(indices = [], combo = 1, volumeScale = 1) {
    if (!reducedMotion && boardElement?.querySelector) {
      indices.forEach((index, offset) => {
        const orb = boardElement.querySelector('[data-i="' + Number(index) + '"]');
        if (!orb?.classList) return;
        orb.style?.setProperty?.("--match-delay", Math.min(offset * 3, 42) + "ms");
        orb.classList.add("match-pop");
      });
    }
    playTone(280 + Math.min(Math.max(Number(combo) || 1, 1), 8) * 38, 0.13, "triangle", 0, 0.028, volumeScale);
  }

  function playHit(volumeScale = 1) {
    pulse(enemyElement, "enemy-hit");
    playTone(145, 0.17, "sawtooth", 0, 0.04, volumeScale);
  }

  function playEnemyAttack(volumeScale = 1) {
    pulse(boardElement, "board-hit");
    playTone(190, 0.12, "square", 0, 0.025, volumeScale);
    playTone(120, 0.16, "sawtooth", 0.08, 0.03, volumeScale);
  }

  function playHeal(volumeScale = 1) {
    pulse(boardElement, "board-heal");
    playTone(523.25, 0.12, "sine", 0, 0.025, volumeScale);
    playTone(783.99, 0.18, "sine", 0.1, 0.025, volumeScale);
  }

  function playSkill(volumeScale = 1) {
    pulse(boardElement, "board-skill");
    playTone(440, 0.1, "triangle", 0, 0.025, volumeScale);
    playTone(659.25, 0.15, "triangle", 0.09, 0.025, volumeScale);
  }

  function playVictory(volumeScale = 1) {
    pulse(boardElement, "board-victory");
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      playTone(frequency, 0.22, "triangle", index * 0.12, 0.03, volumeScale);
    });
  }

  function setMuted(nextMuted) {
    muted = Boolean(nextMuted);
    if (!muted && !getAudioContext()) muted = true;
    return muted;
  }

  function destroy() {
    destroyed = true;
    if (audioContext?.close) {
      try {
        Promise.resolve(audioContext.close()).catch(() => {});
      } catch {
        // Closing an optional audio context must not affect the game.
      }
    }
    audioContext = null;
  }

  return {
    isMuted: () => muted,
    setMuted,
    playMatch,
    playHit,
    playEnemyAttack,
    playHeal,
    playSkill,
    playVictory,
    destroy
  };
}
