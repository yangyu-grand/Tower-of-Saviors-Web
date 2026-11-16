import { STAGES } from "./stages.js";

const ELEMENT_NAMES = Object.freeze({
  fire: "火",
  water: "水",
  wood: "木",
  light: "光",
  dark: "暗",
  heart: "心"
});
const ATTACK_TYPES = new Set(["single", "heavy", "multi"]);
const ROLES = new Set(["all", "boss", "normal"]);

function copyPattern(pattern) {
  if (!pattern) return { type: "single", name: "普通攻擊", hits: 1 };
  if (!ATTACK_TYPES.has(pattern.type)) {
    throw new RangeError("Unknown enemy attack pattern: " + String(pattern.type));
  }
  return {
    type: pattern.type,
    name: typeof pattern.name === "string" && pattern.name ? pattern.name : "普通攻擊",
    hits: pattern.hits ?? 1
  };
}

function copyOptional(value) {
  return value ? { ...value } : null;
}

export function buildEnemyCodex(stages = STAGES) {
  if (!Array.isArray(stages)) throw new TypeError("stages must be an array");
  const ids = new Set();
  return stages.flatMap((stage, stageIndex) => {
    if (!stage || typeof stage.id !== "string" || typeof stage.name !== "string" || !Array.isArray(stage.waves)) {
      throw new TypeError("Each codex stage must have an id, name, and waves array");
    }
    return stage.waves.map((encounter, waveIndex) => {
      if (!encounter || typeof encounter.id !== "string" || typeof encounter.name !== "string") {
        throw new TypeError("Each codex encounter must have an id and name");
      }
      if (ids.has(encounter.id)) throw new RangeError("Duplicate encounter id: " + encounter.id);
      ids.add(encounter.id);
      if (!Object.hasOwn(ELEMENT_NAMES, encounter.element)) {
        throw new RangeError("Unknown enemy element: " + String(encounter.element));
      }
      if (!Number.isFinite(encounter.hp) || encounter.hp <= 0 ||
          !Number.isFinite(encounter.attack) || encounter.attack < 0) {
        throw new RangeError("Enemy HP and attack must be finite non-negative combat values");
      }
      const attackEvery = encounter.attackEvery ?? 1;
      if (!Number.isInteger(attackEvery) || attackEvery < 1) {
        throw new RangeError("attackEvery must be a positive integer");
      }
      const phases = (encounter.phases ?? []).map((phase) => {
        if (!Number.isFinite(phase.at) || phase.at < 0 || phase.at > 1 || typeof phase.name !== "string") {
          throw new RangeError("Boss phase requires a name and an HP threshold between 0 and 1");
        }
        return {
          at: phase.at,
          name: phase.name,
          attackEvery: phase.attackEvery ?? attackEvery,
          attackPattern: copyPattern(phase.attackPattern ?? encounter.attackPattern),
          special: copyOptional(phase.special),
          enrageAt: phase.enrageAt ?? null,
          enrageMultiplier: phase.enrageMultiplier ?? 1
        };
      });
      return {
        id: encounter.id,
        name: encounter.name,
        emoji: encounter.emoji ?? "👾",
        element: encounter.element,
        elementName: ELEMENT_NAMES[encounter.element],
        hp: encounter.hp,
        attack: encounter.attack,
        attackEvery,
        attackPattern: copyPattern(encounter.attackPattern),
        special: copyOptional(encounter.special),
        support: copyOptional(encounter.support),
        phases,
        enrageAt: encounter.enrageAt ?? null,
        enrageMultiplier: encounter.enrageMultiplier ?? 1,
        isBoss: encounter.boss === true,
        stageId: stage.id,
        stageName: stage.name,
        stageDifficulty: stage.difficulty ?? "",
        stageIndex,
        waveIndex,
        waveNumber: waveIndex + 1,
        waveCount: stage.waves.length
      };
    });
  });
}

export const ENEMY_CODEX = Object.freeze(buildEnemyCodex());

export function filterEnemyCodex(entries, filters = {}) {
  if (!Array.isArray(entries)) throw new TypeError("entries must be an array");
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    throw new TypeError("enemy codex filters must be an object");
  }
  const query = filters.query ?? "";
  const stageId = filters.stageId ?? "all";
  const element = filters.element ?? "all";
  const role = filters.role ?? "all";
  if (typeof query !== "string" || typeof stageId !== "string" || typeof element !== "string") {
    throw new TypeError("query, stageId, and element filters must be strings");
  }
  if (!ROLES.has(role)) throw new RangeError("Unknown enemy codex role: " + String(role));
  if (element !== "all" && !Object.hasOwn(ELEMENT_NAMES, element)) {
    throw new RangeError("Unknown enemy codex element: " + element);
  }
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return entries.filter((entry) => {
    if (stageId !== "all" && entry.stageId !== stageId) return false;
    if (element !== "all" && entry.element !== element) return false;
    if (role === "boss" && !entry.isBoss) return false;
    if (role === "normal" && entry.isBoss) return false;
    if (!normalizedQuery) return true;
    const phaseTerms = entry.phases.flatMap((phase) => [
      phase.name,
      phase.attackPattern.name,
      phase.special?.name
    ]);
    const searchable = [
      entry.id, entry.name, entry.stageName, entry.stageDifficulty,
      entry.elementName, entry.attackPattern.name, entry.special?.name,
      entry.support?.name, ...phaseTerms
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return searchable.includes(normalizedQuery);
  });
}
