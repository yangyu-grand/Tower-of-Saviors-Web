import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TEAM, DEFAULT_COST_LIMIT, buildTeam } from "../team.js";
import {
  enumerateValidPartyCandidates,
  buildPartyBalanceReport,
  formatPartyBalanceReport
} from "../partyBalance.js";

test("enumerates each leader choice once for a fixed five-card roster", () => {
  const candidates = enumerateValidPartyCandidates({ cardIds: DEFAULT_TEAM });
  assert.equal(candidates.length, 5);
  assert.equal(new Set(candidates.map((candidate) => candidate.cardIds[0])).size, 5);
  assert.ok(candidates.every((candidate) => candidate.cardIds.length === 5));
  assert.ok(candidates.every((candidate) => candidate.team.totalCost <= DEFAULT_COST_LIMIT));
});

test("filters lineups by the same team cost validation used by the game", () => {
  const overBudget = enumerateValidPartyCandidates({
    cardIds: DEFAULT_TEAM,
    costLimit: 27
  });
  const atBudget = enumerateValidPartyCandidates({
    cardIds: DEFAULT_TEAM,
    costLimit: 28
  });
  assert.equal(overBudget.length, 0);
  assert.equal(atBudget.length, 5);
  assert.ok(atBudget.every((candidate) => candidate.team.totalCost === 28));
});

test("full fifteen-card catalog enumerates 6,055 valid leader/party lineups", () => {
  const candidates = enumerateValidPartyCandidates();
  assert.equal(candidates.length, 6055);
  assert.ok(candidates.every((candidate) => candidate.cardIds.length === 5));
  assert.ok(candidates.every((candidate) => new Set(candidate.cardIds).size === 5));
  assert.ok(candidates.every((candidate) => candidate.team.totalCost <= DEFAULT_COST_LIMIT));
});

test("party report deterministically evaluates every encounter for every leader slot", () => {
  const options = { cardIds: DEFAULT_TEAM, maxTurns: 40, limit: 5 };
  const first = buildPartyBalanceReport(options);
  const second = buildPartyBalanceReport(options);
  assert.equal(first.summary.theoreticalTeamCount, 5);
  assert.equal(first.summary.validTeamCount, 5);
  assert.equal(first.summary.encounterCountPerTeam, 12);
  assert.equal(first.summary.encounterSimulations, 60);
  assert.equal(first.topTeams.length, 5);
  assert.equal(first.weakestTeams.length, 5);
  assert.deepEqual(first, second);
  assert.match(formatPartyBalanceReport(first), /Party composition balance report/);
});

test("card level and evolution options feed the shared team-stat calculation", () => {
  const baseline = buildTeam(DEFAULT_TEAM);
  const candidates = enumerateValidPartyCandidates({
    cardIds: DEFAULT_TEAM,
    levels: { ember_scout: 10 },
    evolutionLevels: { ember_scout: 1 }
  });
  assert.equal(candidates.length, 5);
  assert.ok(candidates.every((candidate) =>
    candidate.team.cards.find((card) => card.id === "ember_scout").level === 10
  ));
  assert.ok(candidates.every((candidate) =>
    candidate.team.cards.find((card) => card.id === "ember_scout").evolutionLevel === 1
  ));
  assert.ok(candidates.every((candidate) => candidate.team.totalHp > baseline.totalHp));
});

test("rejects duplicate, unknown, undersized, and invalid team configurations", () => {
  assert.throws(() => enumerateValidPartyCandidates({
    cardIds: ["ember_scout", "ember_scout", "moss_guard", "dawn_archer", "heart_priest"]
  }), /duplicates/);
  assert.throws(() => enumerateValidPartyCandidates({
    cardIds: ["missing", ...DEFAULT_TEAM.slice(1)]
  }), /Unknown card/);
  assert.throws(() => enumerateValidPartyCandidates({
    cardIds: DEFAULT_TEAM.slice(0, 4)
  }), /between five/);
  assert.throws(() => enumerateValidPartyCandidates({
    cardIds: DEFAULT_TEAM,
    costLimit: -1
  }), /costLimit/);
  assert.throws(() => buildPartyBalanceReport({
    cardIds: DEFAULT_TEAM,
    distributionId: "random"
  }), /Unknown match distribution/);
});
