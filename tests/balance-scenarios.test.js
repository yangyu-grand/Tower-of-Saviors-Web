import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TEAM } from "../team.js";
import {
  analyzeEncounterScenario,
  buildCooldownAwareSkillPlan,
  buildRepresentativeMatchProfiles,
  buildRepresentativeCampaignReport,
  formatRepresentativeCampaignReport
} from "../balanceScenarios.js";

test("cooldown-aware rotation waits until the turn after the full cooldown has elapsed", () => {
  const plan = buildCooldownAwareSkillPlan(DEFAULT_TEAM, 12);
  assert.deepEqual(plan.slice(0, 6).map((entry) => [entry.turn, entry.cardId]), [
    [1, "ember_scout"],
    [2, "tide_monk"],
    [3, "moss_guard"],
    [4, "dawn_archer"],
    [5, "heart_priest"],
    [6, "ember_scout"]
  ]);
  assert.equal(plan.some((entry) => entry.turn === 5 && entry.cardId === "ember_scout"), false);
});

test("a scheduled damage skill boosts only the attack on its activation turn", () => {
  const options = {
    stageIndex: 0,
    waveIndex: 0,
    matchProfiles: [{ matchedElements: ["fire"], runesPerElement: 3 }],
    maxTurns: 8
  };
  const baseline = analyzeEncounterScenario(options);
  const boosted = analyzeEncounterScenario({
    ...options,
    skillPlan: [{ turn: 1, cardId: "ember_scout" }]
  });
  assert.equal(boosted.turns[0].damageMultiplier, 1.5);
  assert.ok(boosted.turns[0].damageDealt > baseline.turns[0].damageDealt);
  assert.equal(boosted.turns[0].skillEvents[0].activated, true);
  assert.equal(boosted.turns[0].cooldownsAfterTurn.ember_scout.remaining, 4);
});

test("a conversion skill contributes its converted attack group to the selected post-skill match", () => {
  const result = analyzeEncounterScenario({
    stageIndex: 0,
    waveIndex: 0,
    matchProfiles: [{ matchedElements: ["fire"], runesPerElement: 3 }],
    skillPlan: [{ turn: 1, cardId: "tide_monk" }]
  });
  assert.equal(result.turns[0].skillEvents[0].type, "convert");
  assert.equal(result.turns[0].skillEvents[0].changed, 5);
  assert.deepEqual(result.turns[0].matchProfile.matchedElements, ["fire", "water"]);
  assert.equal(result.turns[0].combo, 2);
  assert.ok(result.turns[0].damageDealt > 216);
});

test("shield skills are applied before the enemy action and use the shared mitigation rules", () => {
  const result = analyzeEncounterScenario({
    stageIndex: 0,
    waveIndex: 0,
    matchProfiles: [{ matchedElements: ["fire"], runesPerElement: 3 }],
    skillPlan: [{ turn: 1, cardId: "moss_guard" }]
  });
  assert.equal(result.turns[0].skillEvents[0].shieldAdded, 20);
  assert.equal(result.turns[0].shieldAbsorbed, 9);
  assert.equal(result.turns[0].hpDamageTaken, 0);
  assert.equal(result.turns[0].shieldAfterTurn, 11);
});

test("healing skills apply immediately and cap at the party HP maximum", () => {
  const team = (await import("../team.js")).buildTeam(DEFAULT_TEAM);
  const result = analyzeEncounterScenario({
    stageIndex: 0,
    waveIndex: 0,
    startingPartyHp: team.totalHp - 100,
    matchProfiles: [{ matchedElements: ["fire"], runesPerElement: 3 }],
    skillPlan: [{ turn: 1, cardId: "heart_priest" }]
  });
  assert.equal(result.turns[0].skillEvents[0].restored, 100);
  assert.equal(result.turns[0].partyHpAfterTurn, team.totalHp - 9);
  assert.equal(result.totalSkillHealing, 100);
});

test("a skill scheduled during cooldown is blocked and becomes usable again on the correct turn", () => {
  const result = analyzeEncounterScenario({
    stageIndex: 3,
    waveIndex: 2,
    maxTurns: 10,
    matchProfiles: [{ matchedElements: ["fire"], runesPerElement: 3 }],
    skillPlan: [
      { turn: 1, cardId: "ember_scout" },
      { turn: 2, cardId: "ember_scout" },
      { turn: 6, cardId: "ember_scout" }
    ]
  });
  assert.equal(result.turns[0].skillEvents[0].activated, true);
  assert.equal(result.turns[1].skillEvents[0].activated, false);
  assert.equal(result.turns[1].skillEvents[0].reason, "cooldown");
  assert.equal(result.turns[5].skillEvents[0].activated, true);
  assert.equal(result.totalBlockedSkillUses, 1);
});

test("representative match profiles cover steady, balanced, and high-combo play", () => {
  const steady = buildRepresentativeMatchProfiles(DEFAULT_TEAM, "steady");
  const balanced = buildRepresentativeMatchProfiles(DEFAULT_TEAM, "balanced");
  const highCombo = buildRepresentativeMatchProfiles(DEFAULT_TEAM, "high-combo");
  assert.equal(steady[0].combo ?? 1, 1);
  assert.equal(balanced[0].heartRunes, 3);
  assert.equal(highCombo[0].matchedElements.length, 2);
  assert.equal(highCombo[0].extraCascadeCombos, 2);
});

test("representative campaign report covers every encounter for all three distributions", () => {
  const report = buildRepresentativeCampaignReport();
  assert.equal(report.scenarios.length, 3);
  assert.deepEqual(report.scenarios.map((scenario) => scenario.id), ["steady", "balanced", "high-combo"]);
  assert.ok(report.scenarios.every((scenario) => scenario.results.length === 12));
  assert.match(formatRepresentativeCampaignReport(report), /櫻月天狐/);
  assert.match(formatRepresentativeCampaignReport(report), /cooldown-aware rotation/);
});

test("invalid skill schedules, profiles, and distribution names are rejected", () => {
  assert.throws(() => analyzeEncounterScenario({
    skillPlan: [{ turn: 1, cardId: "not_in_team" }]
  }), /not in the selected team/);
  assert.throws(() => analyzeEncounterScenario({
    matchProfiles: [{ matchedElements: ["heart"] }]
  }), /positive attack/);
  assert.throws(() => buildRepresentativeMatchProfiles(DEFAULT_TEAM, "unlucky"));
});
