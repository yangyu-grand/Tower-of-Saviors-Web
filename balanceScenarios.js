import { calculateCombatResult } from "./combat.js";
import { DEFAULT_TEAM, buildTeam } from "./team.js";
import {
  STAGES,
  createCampaignState,
  resolveEnemyTurn,
  mitigateIncomingDamage
} from "./stages.js";
import {
  getActiveSkill,
  createSkillStates,
  canActivateSkill,
  activateSkill,
  advanceSkillCooldowns
} from "./skills.js";

const ATTACK_ELEMENTS = Object.freeze(["fire", "water", "wood", "light", "dark"]);
const RUNE_ELEMENTS = Object.freeze([...ATTACK_ELEMENTS, "heart"]);
const DISTRIBUTION_IDS = Object.freeze(["steady", "balanced", "high-combo"]);

function assertInteger(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(label + " must be an integer between " + minimum + " and " + maximum);
  }
}

function assertSafeInteger(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(label + " must be a safe integer between " + minimum + " and " + maximum);
  }
}

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(label + " must be an object");
  }
}

function availableAttackElements(team) {
  return ATTACK_ELEMENTS
    .filter((element) => team.attackByElement[element] > 0)
    .sort((a, b) => team.attackByElement[b] - team.attackByElement[a] || ATTACK_ELEMENTS.indexOf(a) - ATTACK_ELEMENTS.indexOf(b));
}

function defaultMatchedElements(team) {
  const elements = availableAttackElements(team);
  if (!elements.length) throw new RangeError("The selected team has no attack element");
  return [elements[0]];
}

function normalizeMatchProfile(profile, team, index) {
  assertRecord(profile, "matchProfiles[" + index + "]");
  const matchedElements = profile.matchedElements ?? defaultMatchedElements(team);
  if (!Array.isArray(matchedElements) || matchedElements.length < 1 || matchedElements.length > ATTACK_ELEMENTS.length) {
    throw new RangeError("matchProfiles[" + index + "].matchedElements must contain one to five attack elements");
  }
  if (new Set(matchedElements).size !== matchedElements.length) {
    throw new RangeError("matchProfiles[" + index + "] cannot contain duplicate elements");
  }
  for (const element of matchedElements) {
    if (!ATTACK_ELEMENTS.includes(element) || !(team.attackByElement[element] > 0)) {
      throw new RangeError("Matched element must have positive attack in the selected team: " + String(element));
    }
  }
  const runesPerElement = profile.runesPerElement ?? 3;
  const heartRunes = profile.heartRunes ?? 0;
  const extraCascadeCombos = profile.extraCascadeCombos ?? 0;
  assertInteger(runesPerElement, 3, 6, "runesPerElement");
  assertInteger(heartRunes, 0, 6, "heartRunes");
  assertInteger(extraCascadeCombos, 0, 11, "extraCascadeCombos");
  const combo = matchedElements.length + (heartRunes >= 3 ? 1 : 0) + extraCascadeCombos;
  assertInteger(combo, 1, 12, "resulting combo");
  return {
    matchedElements: [...matchedElements],
    runesPerElement,
    heartRunes,
    extraCascadeCombos,
    combo
  };
}

function normalizeSkillPlan(skillPlan, team, maxTurns) {
  if (!Array.isArray(skillPlan)) throw new TypeError("skillPlan must be an array");
  const seen = new Set();
  return skillPlan.map((entry, index) => {
    assertRecord(entry, "skillPlan[" + index + "]");
    assertInteger(entry.turn, 1, maxTurns, "skillPlan[" + index + "].turn");
    if (!team.cardIds.includes(entry.cardId)) {
      throw new RangeError("Skill card is not in the selected team: " + String(entry.cardId));
    }
    const key = entry.turn + ":" + entry.cardId;
    if (seen.has(key)) throw new RangeError("A card skill can only be scheduled once per turn");
    seen.add(key);
    const skillLevel = entry.skillLevel ?? 1;
    getActiveSkill(entry.cardId, skillLevel);
    return { turn: entry.turn, cardId: entry.cardId, skillLevel, order: index };
  }).sort((a, b) => a.turn - b.turn || a.order - b.order);
}

function buildBoard() {
  return Array.from({ length: 30 }, (_, index) => RUNE_ELEMENTS[index % RUNE_ELEMENTS.length]);
}

function applyConversionToMatchProfile(profile, skillEvents, team) {
  const next = {
    matchedElements: [...profile.matchedElements],
    runesPerElement: profile.runesPerElement,
    heartRunes: profile.heartRunes,
    extraCascadeCombos: profile.extraCascadeCombos
  };
  for (const event of skillEvents) {
    if (!event.activated || event.type !== "convert" || event.changed < 3) continue;
    const skill = getActiveSkill(event.cardId, event.skillLevel);
    if (skill.target === "heart") {
      next.heartRunes = Math.max(next.heartRunes, 3);
    } else if (team.attackByElement[skill.target] > 0 && !next.matchedElements.includes(skill.target)) {
      next.matchedElements.push(skill.target);
    }
  }
  next.combo = next.matchedElements.length + (next.heartRunes >= 3 ? 1 : 0) + next.extraCascadeCombos;
  assertInteger(next.combo, 1, 12, "resulting combo after conversion");
  return next;
}

/**
 * Create a deterministic, round-robin active-skill schedule.
 * A skill activated on turn N with cooldown C is next eligible on N + C + 1,
 * matching advanceSkillCooldowns() and the live battle's no-same-turn tick rule.
 */
export function buildCooldownAwareSkillPlan(cardIds = DEFAULT_TEAM, maxTurns = 60, skillLevels = {}) {
  if (!Array.isArray(cardIds) || cardIds.length < 1) throw new TypeError("cardIds must be a non-empty array");
  assertInteger(maxTurns, 1, 200, "maxTurns");
  assertRecord(skillLevels, "skillLevels");
  const nextReadyTurn = new Map(cardIds.map((cardId) => {
    const level = skillLevels[cardId] ?? 1;
    getActiveSkill(cardId, level);
    return [cardId, 1];
  }));
  const plan = [];
  let cursor = 0;
  for (let turn = 1; turn <= maxTurns; turn += 1) {
    for (let offset = 0; offset < cardIds.length; offset += 1) {
      const index = (cursor + offset) % cardIds.length;
      const cardId = cardIds[index];
      if (nextReadyTurn.get(cardId) > turn) continue;
      const skillLevel = skillLevels[cardId] ?? 1;
      const skill = getActiveSkill(cardId, skillLevel);
      plan.push({ turn, cardId, skillLevel });
      nextReadyTurn.set(cardId, turn + skill.cooldown + 1);
      cursor = (index + 1) % cardIds.length;
      break;
    }
  }
  return plan;
}

/**
 * Representative deterministic match patterns. Profiles are resolved player
 * matches after any scheduled conversion skill; they are not random-board
 * simulations or claims about actual player win rates.
 */
export function buildRepresentativeMatchProfiles(teamIds = DEFAULT_TEAM, distributionId = "balanced", teamOptions = {}) {
  if (!DISTRIBUTION_IDS.includes(distributionId)) {
    throw new RangeError("Unknown match distribution: " + String(distributionId));
  }
  const team = buildTeam(teamIds, teamOptions);
  const elements = availableAttackElements(team);
  if (!elements.length) throw new RangeError("The selected team has no attack element");
  const primary = elements[0];
  const secondary = elements[1] ?? primary;
  const pair = primary === secondary ? [primary] : [primary, secondary];

  if (distributionId === "steady") {
    return [
      { matchedElements: [primary], runesPerElement: 3, heartRunes: 0, extraCascadeCombos: 0 },
      { matchedElements: [secondary], runesPerElement: 3, heartRunes: 0, extraCascadeCombos: 0 }
    ];
  }
  if (distributionId === "balanced") {
    return [
      { matchedElements: [primary], runesPerElement: 3, heartRunes: 3, extraCascadeCombos: 1 },
      { matchedElements: [secondary], runesPerElement: 3, heartRunes: 3, extraCascadeCombos: 1 },
      { matchedElements: [primary], runesPerElement: 4, heartRunes: 0, extraCascadeCombos: 1 }
    ];
  }
  return [
    { matchedElements: pair, runesPerElement: 4, heartRunes: 3, extraCascadeCombos: 2 },
    { matchedElements: pair, runesPerElement: 3, heartRunes: 0, extraCascadeCombos: 3 },
    { matchedElements: [primary], runesPerElement: 5, heartRunes: 3, extraCascadeCombos: 2 }
  ];
}

export function analyzeEncounterScenario(options = {}) {
  assertRecord(options, "options");
  const stageIndex = options.stageIndex ?? 0;
  assertInteger(stageIndex, 0, STAGES.length - 1, "stageIndex");
  const stage = STAGES[stageIndex];
  const waveIndex = options.waveIndex ?? 0;
  assertInteger(waveIndex, 0, stage.waves.length - 1, "waveIndex");
  const encounter = stage.waves[waveIndex];

  const team = buildTeam(options.teamIds ?? DEFAULT_TEAM, {
    levels: options.levels ?? {},
    evolutionLevels: options.evolutionLevels ?? {}
  });
  const skillLevels = options.skillLevels ?? {};
  assertRecord(skillLevels, "skillLevels");
  const maxTurns = options.maxTurns ?? 60;
  assertInteger(maxTurns, 1, 200, "maxTurns");
  const rawProfiles = options.matchProfiles ?? [{
    matchedElements: defaultMatchedElements(team),
    runesPerElement: options.runesPerElement ?? 3,
    heartRunes: options.heartRunes ?? 0,
    extraCascadeCombos: options.extraCascadeCombos ?? 0
  }];
  if (!Array.isArray(rawProfiles) || rawProfiles.length < 1 || rawProfiles.length > 12) {
    throw new RangeError("matchProfiles must contain one to twelve profiles");
  }
  const profiles = rawProfiles.map((profile, index) => normalizeMatchProfile(profile, team, index));
  const skillPlan = normalizeSkillPlan(options.skillPlan ?? [], team, maxTurns);
  let skillStates = createSkillStates(team.cardIds, options.initialSkillStates ?? {});

  const initialShield = options.initialShield ?? 0;
  assertSafeInteger(initialShield, 0, 1000000, "initialShield");
  const startingPartyHp = options.startingPartyHp ?? team.totalHp;
  assertSafeInteger(startingPartyHp, 1, team.totalHp, "startingPartyHp");
  const leaderDamageReduction = team.leaderSkill?.damageReduction ?? 0;

  let partyHp = startingPartyHp;
  let remainingShield = initialShield;
  let state = { ...createCampaignState(stageIndex), waveIndex, enemyHp: encounter.hp };
  let victory = false;
  let partyDefeated = false;
  let totalDamageDealt = 0;
  let totalHealingApplied = 0;
  let totalSkillHealing = 0;
  let totalEnemyHealing = 0;
  let totalEnemyDamageBeforeReduction = 0;
  let totalEnemyDamageAfterReduction = 0;
  let totalHpDamageTaken = 0;
  let totalShieldAbsorbed = 0;
  let totalActiveSkillUses = 0;
  let totalBlockedSkillUses = 0;
  const phaseNames = [];
  const turns = [];

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const baseProfile = profiles[(turn - 1) % profiles.length];
    const skillEvents = [];
    let damageMultiplier = 1;
    for (const scheduled of skillPlan.filter((entry) => entry.turn === turn)) {
      const skill = getActiveSkill(scheduled.cardId, scheduled.skillLevel);
      if (!canActivateSkill(scheduled.cardId, skillStates)) {
        totalBlockedSkillUses += 1;
        skillEvents.push({
          cardId: scheduled.cardId,
          skillId: skill.id,
          skillLevel: scheduled.skillLevel,
          name: skill.name,
          type: skill.type,
          activated: false,
          reason: "cooldown",
          cooldownRemaining: skillStates[scheduled.cardId]?.remaining ?? 0
        });
        continue;
      }
      const previousShield = remainingShield;
      const activated = activateSkill({
        cardId: scheduled.cardId,
        skillStates,
        board: buildBoard(),
        hp: partyHp,
        maxHp: team.totalHp,
        shield: remainingShield,
        damageMultiplier,
        random: () => 0.5,
        skillLevel: scheduled.skillLevel
      });
      skillStates = activated.skillStates;
      partyHp = activated.hp;
      remainingShield = activated.shield;
      damageMultiplier = activated.damageMultiplier;
      totalSkillHealing += activated.restored;
      totalHealingApplied += activated.restored;
      totalActiveSkillUses += 1;
      skillEvents.push({
        cardId: scheduled.cardId,
        skillId: skill.id,
        skillLevel: scheduled.skillLevel,
        name: skill.name,
        type: skill.type,
        target: skill.target ?? null,
        activated: true,
        changed: activated.changed,
        restored: activated.restored,
        shieldAdded: activated.shield - previousShield,
        damageMultiplier
      });
    }

    const profile = applyConversionToMatchProfile(baseProfile, skillEvents, team);
    const counts = Object.fromEntries(profile.matchedElements.map((element) => [element, profile.runesPerElement]));
    if (profile.heartRunes > 0) counts.heart = profile.heartRunes;
    const combat = calculateCombatResult({
      counts,
      combo: profile.combo,
      enemyElement: encounter.element,
      teamAttackByElement: team.attackByElement,
      skillMultiplier: damageMultiplier,
      comboStepBonus: team.leaderSkill?.comboStepBonus ?? 0,
      healingMultiplier: team.leaderSkill?.healingMultiplier ?? 1
    });
    if (combat.damage <= 0) throw new RangeError("The selected match scenario must deal positive damage");

    const enemyHpBeforeAttack = state.enemyHp;
    const damageDealt = Math.min(enemyHpBeforeAttack, combat.damage);
    state = { ...state, enemyHp: Math.max(0, enemyHpBeforeAttack - combat.damage) };
    totalDamageDealt += damageDealt;
    const runeHealing = Math.min(team.totalHp - partyHp, combat.healing);
    partyHp += runeHealing;
    totalHealingApplied += runeHealing;

    skillStates = advanceSkillCooldowns(skillStates);
    if (state.enemyHp === 0) {
      turns.push({
        turn,
        matchProfile: profile,
        combo: profile.combo,
        damageDealt,
        damageMultiplier,
        healingApplied: runeHealing,
        skillHealingApplied: skillEvents.reduce((sum, event) => sum + (event.restored ?? 0), 0),
        skillEvents,
        enemyHpAfterTurn: 0,
        enemyAction: null,
        hpDamageTaken: 0,
        shieldAbsorbed: 0,
        partyHpAfterTurn: partyHp,
        shieldAfterTurn: remainingShield,
        cooldownsAfterTurn: { ...skillStates }
      });
      victory = true;
      break;
    }

    const enemyTurn = resolveEnemyTurn(state);
    const adjustedIncomingDamage = Math.ceil(enemyTurn.incomingDamage * (1 - leaderDamageReduction));
    const mitigation = mitigateIncomingDamage(
      adjustedIncomingDamage,
      remainingShield,
      enemyTurn.intent.shieldPierce ?? 0,
      enemyTurn.intent.hits ?? 1
    );
    remainingShield = mitigation.remainingShield;
    partyHp = Math.max(0, partyHp - mitigation.hpDamage);
    totalEnemyDamageBeforeReduction += enemyTurn.incomingDamage;
    totalEnemyDamageAfterReduction += adjustedIncomingDamage;
    totalHpDamageTaken += mitigation.hpDamage;
    totalShieldAbsorbed += mitigation.shieldDamage;
    totalEnemyHealing += enemyTurn.intent.healing ?? 0;
    if (enemyTurn.intent.phase && !phaseNames.includes(enemyTurn.intent.phase)) {
      phaseNames.push(enemyTurn.intent.phase);
    }

    state = enemyTurn.state;
    turns.push({
      turn,
      matchProfile: profile,
      combo: profile.combo,
      damageDealt,
      damageMultiplier,
      healingApplied: runeHealing,
      skillHealingApplied: skillEvents.reduce((sum, event) => sum + (event.restored ?? 0), 0),
      skillEvents,
      enemyHpAfterTurn: state.enemyHp,
      enemyAction: {
        type: enemyTurn.intent.type,
        label: enemyTurn.intent.label,
        phase: enemyTurn.intent.phase ?? null,
        enraged: enemyTurn.intent.enraged ?? false,
        damage: enemyTurn.incomingDamage,
        previewDamage: enemyTurn.intent.previewDamage ?? 0,
        hits: enemyTurn.intent.hits ?? 1,
        healing: enemyTurn.intent.healing ?? 0,
        shieldPierce: enemyTurn.intent.shieldPierce ?? 0
      },
      adjustedIncomingDamage,
      hpDamageTaken: mitigation.hpDamage,
      shieldAbsorbed: mitigation.shieldDamage,
      partyHpAfterTurn: partyHp,
      shieldAfterTurn: remainingShield,
      cooldownsAfterTurn: { ...skillStates }
    });

    if (partyHp === 0) {
      partyDefeated = true;
      break;
    }
  }

  const status = victory ? "victory" : partyDefeated ? "party-defeated" : "turn-limit";
  return {
    stage: { id: stage.id, name: stage.name, difficulty: stage.difficulty },
    encounter: {
      id: encounter.id,
      name: encounter.name,
      element: encounter.element,
      hp: encounter.hp,
      attack: encounter.attack,
      boss: encounter.boss === true
    },
    team: {
      cardIds: [...team.cardIds],
      totalHp: team.totalHp,
      attackByElement: { ...team.attackByElement },
      leaderSkill: team.leaderSkill?.name ?? null,
      damageReduction: leaderDamageReduction
    },
    scenario: {
      matchProfiles: profiles,
      skillPlan,
      initialShield,
      maxTurns
    },
    status,
    victory,
    partyDefeated,
    turnsToDefeat: victory ? turns.length : null,
    turnsSimulated: turns.length,
    totalDamageDealt,
    averageDamagePerTurn: turns.length ? totalDamageDealt / turns.length : 0,
    totalHealingApplied,
    totalSkillHealing,
    totalEnemyHealing,
    totalEnemyDamageBeforeReduction,
    totalEnemyDamageAfterReduction,
    totalHpDamageTaken,
    totalShieldAbsorbed,
    totalActiveSkillUses,
    totalBlockedSkillUses,
    enemyHpRemaining: state.enemyHp,
    remainingPartyHp: partyHp,
    remainingShield,
    phaseNames,
    turns
  };
}

function summarizeScenario(results) {
  const victories = results.filter((result) => result.victory);
  const partyDefeats = results.filter((result) => result.partyDefeated).length;
  const turnLimits = results.filter((result) => result.status === "turn-limit").length;
  const totalTurns = results.reduce((sum, result) => sum + result.turnsSimulated, 0);
  return {
    encounterCount: results.length,
    victories: victories.length,
    partyDefeats,
    turnLimits,
    averageTurnsToDefeat: victories.length
      ? victories.reduce((sum, result) => sum + result.turnsToDefeat, 0) / victories.length
      : null,
    averageHpDamageTaken: results.length
      ? results.reduce((sum, result) => sum + result.totalHpDamageTaken, 0) / results.length
      : 0,
    averageDamagePerTurn: totalTurns
      ? results.reduce((sum, result) => sum + result.totalDamageDealt, 0) / totalTurns
      : 0,
    activeSkillUses: results.reduce((sum, result) => sum + result.totalActiveSkillUses, 0),
    blockedSkillUses: results.reduce((sum, result) => sum + result.totalBlockedSkillUses, 0)
  };
}

export function buildRepresentativeCampaignReport(options = {}) {
  assertRecord(options, "options");
  const teamIds = options.teamIds ?? DEFAULT_TEAM;
  const teamOptions = {
    levels: options.levels ?? {},
    evolutionLevels: options.evolutionLevels ?? {}
  };
  const team = buildTeam(teamIds, teamOptions);
  const maxTurns = options.maxTurns ?? 60;
  assertInteger(maxTurns, 1, 200, "maxTurns");
  const skillLevels = options.skillLevels ?? {};
  assertRecord(skillLevels, "skillLevels");
  const distributionIds = options.distributions ?? [...DISTRIBUTION_IDS];
  if (!Array.isArray(distributionIds) || distributionIds.length < 1 || distributionIds.length > DISTRIBUTION_IDS.length) {
    throw new RangeError("distributions must contain one to three distribution ids");
  }
  if (new Set(distributionIds).size !== distributionIds.length || distributionIds.some((id) => !DISTRIBUTION_IDS.includes(id))) {
    throw new RangeError("distributions must contain unique known ids");
  }

  const scenarios = distributionIds.map((distributionId) => {
    const matchProfiles = buildRepresentativeMatchProfiles(team.cardIds, distributionId, teamOptions);
    const skillPlan = options.skillPlan !== undefined
      ? options.skillPlan
      : distributionId === "steady"
        ? []
        : buildCooldownAwareSkillPlan(team.cardIds, maxTurns, skillLevels);
    const results = STAGES.flatMap((stage, stageIndex) =>
      stage.waves.map((encounter, waveIndex) => analyzeEncounterScenario({
        ...options,
        teamIds: team.cardIds,
        stageIndex,
        waveIndex,
        maxTurns,
        skillLevels,
        matchProfiles,
        skillPlan
      }))
    );
    return {
      id: distributionId,
      label: distributionId === "steady" ? "穩定三消" : distributionId === "balanced" ? "均衡消除" : "高 Combo",
      skillPolicy: skillPlan.length ? "cooldown-aware rotation" : "no active skills",
      summary: summarizeScenario(results),
      results
    };
  });

  return {
    stageCount: STAGES.length,
    team: { cardIds: [...team.cardIds], totalHp: team.totalHp, leaderSkill: team.leaderSkill?.name ?? null },
    scenarios
  };
}

export function formatRepresentativeCampaignReport(report) {
  if (!report || typeof report !== "object" || !Array.isArray(report.scenarios)) {
    throw new TypeError("A representative campaign report is required");
  }
  const lines = [
    "Representative campaign scenario report",
    "Assumptions: deterministic repeating match profiles; active skills use a cooldown-aware round-robin schedule; conversions assume the player matches the converted target group.",
    "Team: " + report.team.cardIds.join(", ") + " | Leader: " + (report.team.leaderSkill ?? "none")
  ];
  for (const scenario of report.scenarios) {
    const summary = scenario.summary;
    lines.push("");
    lines.push("[" + scenario.label + "] " + scenario.skillPolicy);
    lines.push(
      "Summary: " + summary.victories + "/" + summary.encounterCount + " victories; " +
      summary.partyDefeats + " party defeats; " + summary.turnLimits + " turn limits; average turns " +
      (summary.averageTurnsToDefeat === null ? "n/a" : summary.averageTurnsToDefeat.toFixed(2)) +
      "; average HP lost " + summary.averageHpDamageTaken.toFixed(1) +
      "; active skills " + summary.activeSkillUses +
      "; blocked skill attempts " + summary.blockedSkillUses + "."
    );
    lines.push("Chapter | Encounter | Turns | HP lost | Skill uses | Outcome");
    for (const result of scenario.results) {
      const turns = result.victory ? String(result.turnsToDefeat) : ">" + String(result.turnsSimulated);
      const outcome = result.victory ? "WIN" : result.partyDefeated ? "PARTY DEFEATED" : "TURN LIMIT";
      lines.push([
        result.stage.name,
        result.encounter.name,
        turns,
        result.totalHpDamageTaken,
        result.totalActiveSkillUses,
        outcome
      ].join(" | "));
    }
  }
  return lines.join("\n");
}
