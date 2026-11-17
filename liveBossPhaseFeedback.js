function normalizePhase(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 48);
}

/**
 * Describe a live Boss phase change. Initial phases, missing labels, and
 * unchanged phases intentionally produce no transient announcement.
 */
export function getLiveBossPhaseTransition(previousPhase, nextPhase) {
  const fromPhase = normalizePhase(previousPhase);
  const toPhase = normalizePhase(nextPhase);
  if (!fromPhase || !toPhase || fromPhase === toPhase) return null;
  return { fromPhase, toPhase };
}
