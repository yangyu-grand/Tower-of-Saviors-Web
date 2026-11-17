function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertEvent(event) {
  if (!isRecord(event) || !isRecord(event.data)) {
    throw new TypeError("replay combat feedback requires an event with object data");
  }
}

function safeAmount(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function safeHp(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

const DAMAGE_ELEMENTS = new Set(["fire", "water", "wood", "light", "dark"]);
const DAMAGE_RELATIONS = new Set(["advantage", "disadvantage", "neutral"]);

function normalizeDamageByElement(value) {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set();
  return value.filter((item) => {
    if (!isRecord(item) || !DAMAGE_ELEMENTS.has(item.element) || seen.has(item.element) ||
        !Number.isSafeInteger(item.runeCount) || item.runeCount < 1 ||
        !Number.isSafeInteger(item.damage) || item.damage < 0 || !DAMAGE_RELATIONS.has(item.relation)) return false;
    seen.add(item.element);
    return true;
  }).map((item) => ({ element: item.element, runeCount: item.runeCount, damage: item.damage, relation: item.relation }));
}

export function getReplayCombatFeedback(event) {
  assertEvent(event);
  const data = event.data;

  if (event.type === "player-action") {
    const healing = Math.min(
      Number.MAX_SAFE_INTEGER,
      safeAmount(data.healing) + safeAmount(data.skillHealing)
    );
    const feedback = {
      kind: "player-action",
      combo: safeAmount(data.combo),
      damage: safeAmount(data.damage),
      healing,
      enemyHpBefore: safeHp(data.enemyHpBeforeAttack),
      enemyHpAfter: safeHp(data.enemyHpAfterTurn)
    };
    if (Number.isSafeInteger(data.calculatedDamage) && data.calculatedDamage >= 0) feedback.calculatedDamage = data.calculatedDamage;
    const damageByElement = normalizeDamageByElement(data.damageByElement);
    if (damageByElement !== undefined) feedback.damageByElement = damageByElement;
    return feedback;
  }

  if (event.type === "enemy-action") {
    const action = isRecord(data.action) ? data.action : {};
    const rawLabel = action.label ?? action.name ?? action.type;
    return {
      kind: "enemy-action",
      actionLabel: typeof rawLabel === "string" && rawLabel.trim() ? rawLabel : "敵人行動",
      incomingDamage: safeAmount(action.damage),
      enemyHealing: safeAmount(action.healing),
      hpDamageTaken: safeAmount(data.hpDamageTaken),
      shieldAbsorbed: safeAmount(data.shieldAbsorbed),
      partyHpAfter: safeHp(data.partyHpAfterTurn)
    };
  }

  return null;
}

export function getReplayEnemyHp(replay, eventIndex) {
  if (!isRecord(replay) || !isRecord(replay.encounter) || !Array.isArray(replay.events)) {
    throw new TypeError("replay enemy HP requires replay metadata and events");
  }
  if (!Number.isInteger(eventIndex) || eventIndex < 0 || eventIndex >= replay.events.length) {
    throw new RangeError("replay enemy HP event index is out of range");
  }

  const maxHp = safeHp(replay.encounter.hp);
  if (maxHp === null || maxHp === 0) return null;

  let currentHp = maxHp;
  for (let index = 0; index <= eventIndex; index += 1) {
    const event = replay.events[index];
    if (!isRecord(event) || !isRecord(event.data)) continue;

    if (event.type === "player-action") {
      const recordedHp = safeHp(event.data.enemyHpAfterTurn);
      if (recordedHp !== null) currentHp = Math.min(maxHp, recordedHp);
    } else if (event.type === "battle-end") {
      const finalHp = safeHp(event.data.enemyHpRemaining);
      if (finalHp !== null) currentHp = Math.min(maxHp, finalHp);
    }
  }

  return {
    currentHp,
    maxHp,
    ratio: currentHp / maxHp
  };
}
