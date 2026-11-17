function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function positiveAmount(value) {
  return Number.isSafeInteger(value) && value > 0;
}

const DAMAGE_ELEMENTS = new Set(["fire", "water", "wood", "light", "dark"]);

function dominantDamageElement(value) {
  if (!Array.isArray(value)) return null;
  let selected = null;
  for (const item of value) {
    if (!isRecord(item) || !DAMAGE_ELEMENTS.has(item.element) || !positiveAmount(item.damage)) continue;
    if (!selected || item.damage > selected.damage) selected = item;
  }
  return selected?.element ?? null;
}

function hasPhaseTransition(value) {
  return isRecord(value) &&
    typeof value.fromPhase === "string" &&
    typeof value.toPhase === "string" &&
    value.fromPhase.trim().length > 0 &&
    value.toPhase.trim().length > 0 &&
    value.fromPhase !== value.toPhase;
}

/**
 * Select one optional synthesized replay cue for a sequentially-played event.
 * The caller is responsible for checking the player's replay-audio and master
 * sound settings before dispatching the returned cue.
 */
export function getReplayAudioCue(event, {
  combatFeedback = null,
  phaseTransition = null,
  comboMilestone = null
} = {}) {
  if (!isRecord(event) || !isRecord(event.data)) {
    throw new TypeError("replay audio cues require an event with object data");
  }

  const feedback = isRecord(combatFeedback) ? combatFeedback : {};

  if (event.type === "skill") return "skill";

  if (event.type === "enemy-action") {
    if (hasPhaseTransition(phaseTransition)) return "phase-transition";
    if (positiveAmount(feedback.hpDamageTaken) ||
        positiveAmount(feedback.shieldAbsorbed) ||
        positiveAmount(feedback.incomingDamage)) return "enemy-attack";
    if (positiveAmount(feedback.enemyHealing)) return "heal";
    return null;
  }

  if (event.type !== "player-action") return null;

  if (feedback.finalHit === true) return "final-hit";
  if (comboMilestone?.tier === "frenzy") return "combo-frenzy";
  if (comboMilestone?.tier === "high") return "combo-high";
  if (positiveAmount(feedback.overkillDamage)) return "overkill";
  if (positiveAmount(feedback.damage)) {
    const element = dominantDamageElement(feedback.damageByElement);
    return element ? `element-hit-${element}` : "hit";
  }
  if (positiveAmount(feedback.healing)) return "heal";
  return null;
}
