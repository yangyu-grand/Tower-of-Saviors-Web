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

export function getReplayCombatFeedback(event) {
  assertEvent(event);
  const data = event.data;

  if (event.type === "player-action") {
    const healing = Math.min(
      Number.MAX_SAFE_INTEGER,
      safeAmount(data.healing) + safeAmount(data.skillHealing)
    );
    return {
      kind: "player-action",
      combo: safeAmount(data.combo),
      damage: safeAmount(data.damage),
      healing,
      enemyHpBefore: safeHp(data.enemyHpBeforeAttack),
      enemyHpAfter: safeHp(data.enemyHpAfterTurn)
    };
  }

  if (event.type === "enemy-action") {
    return {
      kind: "enemy-action",
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
