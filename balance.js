import { calculateCombatResult } from "./combat.js";
import { DEFAULT_TEAM, buildTeam } from "./team.js";
import {
  STAGES,
  createCampaignState,
  resolveEnemyTurn,
  mitigateIncomingDamage
} from "./stages.js";

const ATTACK_ELEMENTS = Object.freeze(["fire", "water", "wood", "light", "dark"]);

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

function defaultMatchedElements(team) {
  const leaderElement = team.cards[0].element;
  if (ATTACK_ELEMENTS.includes(leaderElement) && team.attackByElement[leaderElement] > 0) {
    return [leaderElement];
  }
  const strongest = Object.entries(team.attackByElement)
    .filter(([element, attack]) => ATTACK_ELEMENTS.includes(element) && attack > 0)
    .sort((a, b) => b[1] - a[1])[0];
  if (!strongest) throw new RangeError("The selected team has no attack element");
  return [strongest[0]];
}

function validateOptions(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Balance options must be an object");
  }
}

export function analyzeEncounter(options = {}) {
  validateOptions(options);
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
  const matchedElements = options.matchedElements ?? defaultMatchedElements(team);
  if (!Array.isArray(matchedElements) || matchedElements.length < 1 || matchedElements.length > ATTACK_ELEMENTS.length) {
    throw new RangeError("matchedElements must contain one to five attack elements");
  }
  if (new Set(matchedElements).size !== matchedElements.length) {
    throw new RangeError("matchedElements cannot contain duplicates");
  }
  for (const element of matchedElements) {
    if (!ATTACK_ELEMENTS.includes(element) || !(team.attackByElement[element] > 0)) {
      throw new RangeError("Matched element must have positive attack in the selected team: " + String(element));
    }
  }

  const runesPerElement = options.runesPerElement ?? 3;
  assertInteger(runesPerElement, 3, 6, "runesPerElement");
  const heartRunes = options.heartRunes ?? 0;
  assertInteger(heartRunes, 0, 6, "heartRunes");
  const extraCascadeCombos = options.extraCascadeCombos ?? 0;
  assertInteger(extraCascadeCombos, 0, 11, "extraCascadeCombos");
  const combo = matchedElements.length + (heartRunes >= 3 ? 1 : 0) + extraCascadeCombos;
  assertInteger(combo, 1, 12, "resulting combo");

  const counts = Object.fromEntries(matchedElements.map((element) => [element, runesPerElement]));
  if (heartRunes > 0) counts.heart = heartRunes;
  const combat = calculateCombatResult({
    counts,
    combo,
    enemyElement: encounter.element,
    teamAttackByElement: team.attackByElement,
    comboStepBonus: team.leaderSkill?.comboStepBonus ?? 0,
    healingMultiplier: team.leaderSkill?.healingMultiplier ?? 1
  });
  if (combat.damage <= 0) throw new RangeError("The selected match scenario must deal positive damage");

  const initialShield = options.initialShield ?? 0;
  assertSafeInteger(initialShield, 0, 1000000, "initialShield");
  const maxTurns = options.maxTurns ?? 60;
  assertInteger(maxTurns, 1, 200, "maxTurns");
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
  let totalEnemyHealing = 0;
  let totalEnemyDamageBeforeReduction = 0;
  let totalEnemyDamageAfterReduction = 0;
  let totalHpDamageTaken = 0;
  let totalShieldAbsorbed = 0;
  const phaseNames = [];
  const turns = [];

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const enemyHpBeforeAttack = state.enemyHp;
    const damageDealt = Math.min(enemyHpBeforeAttack, combat.damage);
    state = { ...state, enemyHp: Math.max(0, enemyHpBeforeAttack - combat.damage) };
    totalDamageDealt += damageDealt;

    const healingApplied = Math.min(team.totalHp - partyHp, combat.healing);
    partyHp += healingApplied;
    totalHealingApplied += healingApplied;

    if (state.enemyHp === 0) {
      turns.push({
        turn,
        damageDealt,
        healingApplied,
        enemyHpAfterTurn: 0,
        enemyAction: null,
        hpDamageTaken: 0,
        shieldAbsorbed: 0,
        partyHpAfterTurn: partyHp,
        shieldAfterTurn: remainingShield
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
      damageDealt,
      healingApplied,
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
      shieldAfterTurn: remainingShield
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
      matchedElements: [...matchedElements],
      runesPerElement,
      heartRunes,
      extraCascadeCombos,
      combo,
      initialShield,
      maxTurns
    },
    damagePerTurn: combat.damage,
    healingPerTurn: combat.healing,
    comboMultiplier: combat.comboMultiplier,
    matchupBreakdown: combat.breakdown,
    status,
    victory,
    partyDefeated,
    turnsToDefeat: victory ? turns.length : null,
    turnsSimulated: turns.length,
    totalDamageDealt,
    totalHealingApplied,
    totalEnemyHealing,
    totalEnemyDamageBeforeReduction,
    totalEnemyDamageAfterReduction,
    totalHpDamageTaken,
    totalShieldAbsorbed,
    enemyHpRemaining: state.enemyHp,
    remainingPartyHp: partyHp,
    remainingShield,
    phaseNames,
    turns
  };
}

export function buildCampaignBalanceReport(options = {}) {
  validateOptions(options);
  const results = STAGES.flatMap((stage, stageIndex) =>
    stage.waves.map((encounter, waveIndex) => analyzeEncounter({ ...options, stageIndex, waveIndex }))
  );
  const victories = results.filter((result) => result.victory);
  const partyDefeats = results.filter((result) => result.partyDefeated).length;
  const turnLimits = results.filter((result) => result.status === "turn-limit").length;
  const averageTurnsToDefeat = victories.length
    ? victories.reduce((total, result) => total + result.turnsToDefeat, 0) / victories.length
    : null;
  return {
    stageCount: STAGES.length,
    encounterCount: results.length,
    summary: {
      victories: victories.length,
      partyDefeats,
      turnLimits,
      averageTurnsToDefeat
    },
    results
  };
}

export function formatCampaignBalanceReport(report) {
  if (!report || typeof report !== "object" || !Array.isArray(report.results) || !report.summary) {
    throw new TypeError("A campaign balance report is required");
  }
  const lines = [
    "Campaign balance baseline",
    "Assumptions: fixed rune-match pattern each turn; leader skill only; no active skills or random board simulation.",
    "Chapter | Encounter | Element | Enemy HP | Damage/turn | Turns | HP lost | Outcome"
  ];
  for (const result of report.results) {
    const turns = result.victory ? String(result.turnsToDefeat) : ">" + String(result.turnsSimulated);
    const outcome = result.victory ? "WIN" : result.partyDefeated ? "PARTY DEFEATED" : "TURN LIMIT";
    lines.push([
      result.stage.name,
      result.encounter.name,
      result.encounter.element,
      result.encounter.hp,
      result.damagePerTurn,
      turns,
      result.totalHpDamageTaken,
      outcome
    ].join(" | "));
  }
  lines.push(
    "Summary: " + report.summary.victories + "/" + report.encounterCount + " victories; " +
    report.summary.partyDefeats + " party defeats; " + report.summary.turnLimits + " turn limits; average turns " +
    (report.summary.averageTurnsToDefeat === null ? "n/a" : report.summary.averageTurnsToDefeat.toFixed(2)) + "."
  );
  return lines.join("\n");
}
