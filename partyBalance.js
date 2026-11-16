import { CARD_CATALOG, DEFAULT_COST_LIMIT, buildTeam, getCard } from "./team.js";
import { STAGES } from "./stages.js";
import {
  analyzeEncounterScenario,
  buildCooldownAwareSkillPlan,
  buildRepresentativeMatchProfiles
} from "./balanceScenarios.js";

const DEFAULT_DISTRIBUTION = "balanced";

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(label + " must be an object");
  }
}

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

function combinationCount(n, k) {
  if (k > n) return 0;
  let result = 1;
  for (let index = 1; index <= k; index += 1) {
    result = result * (n - index + 1) / index;
  }
  return result;
}

function compareNullableAscending(a, b) {
  const left = a === null ? Number.POSITIVE_INFINITY : a;
  const right = b === null ? Number.POSITIVE_INFINITY : b;
  return left - right;
}

function compareCardIds(a, b) {
  return a.cardIds.join("|").localeCompare(b.cardIds.join("|"));
}

/**
 * Enumerate every valid five-card lineup from the selected catalog subset.
 * Each unordered group is emitted once for each possible first-slot leader.
 * The remaining four cards retain catalog order, so equivalent permutations
 * are not duplicated.
 */
export function enumerateValidPartyCandidates(options = {}) {
  assertRecord(options, "options");
  const cardIds = options.cardIds ?? CARD_CATALOG.map((card) => card.id);
  if (!Array.isArray(cardIds) || cardIds.length < 5 || cardIds.length > CARD_CATALOG.length) {
    throw new RangeError("cardIds must contain between five and " + CARD_CATALOG.length + " cards");
  }
  if (new Set(cardIds).size !== cardIds.length) {
    throw new RangeError("cardIds cannot contain duplicates");
  }
  cardIds.forEach((cardId) => getCard(cardId));

  const costLimit = options.costLimit ?? DEFAULT_COST_LIMIT;
  assertInteger(costLimit, 0, 100, "costLimit");
  const levels = options.levels ?? {};
  const evolutionLevels = options.evolutionLevels ?? {};
  assertRecord(levels, "levels");
  assertRecord(evolutionLevels, "evolutionLevels");

  const candidates = [];
  const selected = [];

  function visit(startIndex) {
    if (selected.length === 5) {
      const totalCost = selected.reduce((sum, cardId) => sum + getCard(cardId).cost, 0);
      if (totalCost > costLimit) return;

      for (let leaderIndex = 0; leaderIndex < selected.length; leaderIndex += 1) {
        const leaderId = selected[leaderIndex];
        const orderedIds = [
          leaderId,
          ...selected.filter((cardId, index) => index !== leaderIndex)
        ];
        const team = buildTeam(orderedIds, { costLimit, levels, evolutionLevels });
        candidates.push({ cardIds: orderedIds, team });
      }
      return;
    }

    const remaining = 5 - selected.length;
    for (let index = startIndex; index <= cardIds.length - remaining; index += 1) {
      selected.push(cardIds[index]);
      visit(index + 1);
      selected.pop();
    }
  }

  visit(0);
  return candidates;
}

/**
 * Simulate every cost-valid leader/four-member lineup against every campaign
 * encounter. The match profile is deterministic; this is a balance sweep,
 * not a random-board or player-win-rate prediction.
 */
export function buildPartyBalanceReport(options = {}) {
  assertRecord(options, "options");
  const cardIds = options.cardIds ?? CARD_CATALOG.map((card) => card.id);
  const costLimit = options.costLimit ?? DEFAULT_COST_LIMIT;
  const maxTurns = options.maxTurns ?? 60;
  const limit = options.limit ?? 10;
  const distributionId = options.distributionId ?? DEFAULT_DISTRIBUTION;
  const initialShield = options.initialShield ?? 0;
  const levels = options.levels ?? {};
  const evolutionLevels = options.evolutionLevels ?? {};
  const skillLevels = options.skillLevels ?? {};

  assertInteger(maxTurns, 1, 200, "maxTurns");
  assertInteger(limit, 1, 50, "limit");
  assertSafeInteger(initialShield, 0, 1000000, "initialShield");
  assertRecord(skillLevels, "skillLevels");

  const candidates = enumerateValidPartyCandidates({
    cardIds,
    costLimit,
    levels,
    evolutionLevels
  });
  if (!candidates.length) {
    throw new RangeError("No five-card lineup satisfies the selected cost limit");
  }

  const encounters = STAGES.flatMap((stage, stageIndex) =>
    stage.waves.map((encounter, waveIndex) => ({ stageIndex, waveIndex, encounter }))
  );
  const teamSummaries = [];
  let totalVictories = 0;
  let totalPartyDefeats = 0;
  let totalTurnLimits = 0;
  let totalTurnsToDefeat = 0;
  let totalHpDamageTaken = 0;
  let totalActiveSkillUses = 0;
  let totalBlockedSkillUses = 0;

  for (const candidate of candidates) {
    const teamOptions = { levels, evolutionLevels };
    const matchProfiles = buildRepresentativeMatchProfiles(
      candidate.cardIds,
      distributionId,
      teamOptions
    );
    const skillPlan = buildCooldownAwareSkillPlan(
      candidate.cardIds,
      maxTurns,
      skillLevels
    );

    let victories = 0;
    let partyDefeats = 0;
    let turnLimits = 0;
    let turnsToDefeat = 0;
    let hpDamageTaken = 0;
    let activeSkillUses = 0;
    let blockedSkillUses = 0;
    const bossPhases = new Set();

    for (const entry of encounters) {
      const result = analyzeEncounterScenario({
        stageIndex: entry.stageIndex,
        waveIndex: entry.waveIndex,
        teamIds: candidate.cardIds,
        levels,
        evolutionLevels,
        skillLevels,
        matchProfiles,
        skillPlan,
        maxTurns,
        initialShield
      });

      if (result.victory) {
        victories += 1;
        turnsToDefeat += result.turnsToDefeat;
      } else if (result.partyDefeated) {
        partyDefeats += 1;
      } else {
        turnLimits += 1;
      }
      hpDamageTaken += result.totalHpDamageTaken;
      activeSkillUses += result.totalActiveSkillUses;
      blockedSkillUses += result.totalBlockedSkillUses;
      result.phaseNames.forEach((phaseName) => bossPhases.add(phaseName));
    }

    const encounterCount = encounters.length;
    const averageTurnsToDefeat = victories ? turnsToDefeat / victories : null;
    const averageHpDamageTaken = hpDamageTaken / encounterCount;
    const summary = {
      cardIds: [...candidate.cardIds],
      cardNames: candidate.team.cards.map((card) => card.name),
      leaderSkill: candidate.team.leaderSkill?.name ?? null,
      totalCost: candidate.team.totalCost,
      totalHp: candidate.team.totalHp,
      attackByElement: { ...candidate.team.attackByElement },
      encounterCount,
      victories,
      partyDefeats,
      turnLimits,
      averageTurnsToDefeat,
      averageHpDamageTaken,
      averageHpLossPercent: candidate.team.totalHp
        ? (averageHpDamageTaken / candidate.team.totalHp) * 100
        : 0,
      activeSkillUses,
      blockedSkillUses,
      bossPhasesReached: [...bossPhases].sort()
    };

    teamSummaries.push(summary);
    totalVictories += victories;
    totalPartyDefeats += partyDefeats;
    totalTurnLimits += turnLimits;
    totalTurnsToDefeat += turnsToDefeat;
    totalHpDamageTaken += hpDamageTaken;
    totalActiveSkillUses += activeSkillUses;
    totalBlockedSkillUses += blockedSkillUses;
  }

  const bestFirst = [...teamSummaries].sort((a, b) =>
    (b.victories - a.victories) ||
    compareNullableAscending(a.averageTurnsToDefeat, b.averageTurnsToDefeat) ||
    (a.averageHpDamageTaken - b.averageHpDamageTaken) ||
    (b.totalHp - a.totalHp) ||
    compareCardIds(a, b)
  );
  const weakestFirst = [...teamSummaries].sort((a, b) =>
    (a.victories - b.victories) ||
    (b.averageHpDamageTaken - a.averageHpDamageTaken) ||
    compareNullableAscending(b.averageTurnsToDefeat, a.averageTurnsToDefeat) ||
    (a.totalHp - b.totalHp) ||
    compareCardIds(a, b)
  );

  const theoreticalTeamCount = combinationCount(cardIds.length, 5) * 5;
  const encounterSimulations = candidates.length * encounters.length;
  return {
    settings: {
      distributionId,
      costLimit,
      maxTurns,
      initialShield,
      skillLevels: { ...skillLevels },
      levels: { ...levels },
      evolutionLevels: { ...evolutionLevels }
    },
    summary: {
      theoreticalTeamCount,
      validTeamCount: candidates.length,
      encounterCountPerTeam: encounters.length,
      encounterSimulations,
      victories: totalVictories,
      partyDefeats: totalPartyDefeats,
      turnLimits: totalTurnLimits,
      averageTurnsToDefeat: totalVictories ? totalTurnsToDefeat / totalVictories : null,
      averageHpDamageTaken: encounterSimulations ? totalHpDamageTaken / encounterSimulations : 0,
      activeSkillUses: totalActiveSkillUses,
      blockedSkillUses: totalBlockedSkillUses
    },
    topTeams: bestFirst.slice(0, limit).map((team, index) => ({ rank: index + 1, ...team })),
    weakestTeams: weakestFirst.slice(0, limit).map((team, index) => ({ rank: index + 1, ...team }))
  };
}

function formatTeam(team) {
  const turns = team.averageTurnsToDefeat === null
    ? "n/a"
    : team.averageTurnsToDefeat.toFixed(2);
  return [
    String(team.rank) + ". " + team.cardNames.join(" + "),
    "Leader: " + (team.leaderSkill ?? "none"),
    "Cost " + team.totalCost + " | HP " + team.totalHp,
    "Wins " + team.victories + "/" + team.encounterCount +
      " | Avg turns " + turns +
      " | Avg HP loss " + team.averageHpDamageTaken.toFixed(1) +
      " (" + team.averageHpLossPercent.toFixed(2) + "%)" +
      " | Skill uses " + team.activeSkillUses
  ].join("\n   ");
}

export function formatPartyBalanceReport(report) {
  if (!report || typeof report !== "object" || !report.summary ||
      !Array.isArray(report.topTeams) || !Array.isArray(report.weakestTeams)) {
    throw new TypeError("A party balance report is required");
  }

  const summary = report.summary;
  const averageTurns = summary.averageTurnsToDefeat === null
    ? "n/a"
    : summary.averageTurnsToDefeat.toFixed(2);
  const lines = [
    "Party composition balance report",
    "Assumptions: first slot supplies the leader skill; remaining four cards retain catalog order; fixed " +
      report.settings.distributionId + " match profiles and cooldown-aware skill rotation; no random board or player-move simulation.",
    "Candidate lineups: " + summary.theoreticalTeamCount +
      " theoretical, " + summary.validTeamCount + " within cost " + report.settings.costLimit + ".",
    "Encounter simulations: " + summary.encounterSimulations +
      " (" + summary.encounterCountPerTeam + " per lineup).",
    "Results: " + summary.victories + " victories, " + summary.partyDefeats +
      " party defeats, " + summary.turnLimits + " turn limits.",
    "Average turns to defeat: " + averageTurns +
      "; average HP damage per encounter: " + summary.averageHpDamageTaken.toFixed(1) + ".",
    "Active skill uses: " + summary.activeSkillUses +
      "; blocked skill uses: " + summary.blockedSkillUses + ".",
    "",
    "Top lineups",
    ...report.topTeams.map(formatTeam),
    "",
    "Weakest lineups",
    ...report.weakestTeams.map(formatTeam)
  ];
  return lines.join("\n");
}
