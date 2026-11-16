import test from "node:test";
import assert from "node:assert/strict";
import { CARD_CATALOG, STARTER_CARD_IDS, DEFAULT_COST_LIMIT, DEFAULT_TEAM, TEAM_SIZE, buildTeam, getCard } from "../team.js";

test("starter team contains five unique cards within the default cost limit", () => {
  const team = buildTeam(DEFAULT_TEAM);
  assert.equal(team.cards.length, TEAM_SIZE);
  assert.equal(new Set(team.cardIds).size, TEAM_SIZE);
  assert.ok(team.totalCost <= DEFAULT_COST_LIMIT);
});

test("team summary aggregates HP and attack by element", () => {
  const team = buildTeam(DEFAULT_TEAM);
  assert.equal(team.baseHp, 5670);
  assert.equal(team.totalHp, 5954);
  assert.deepEqual(team.attackByElement, {
    fire: 216, water: 160, wood: 135, light: 190, dark: 0
  });
});

test("the first card alone supplies the leader skill and its effects", () => {
  const fireLeader = buildTeam(DEFAULT_TEAM);
  assert.equal(fireLeader.leaderSkill.name, "赤焰先鋒");
  assert.equal(fireLeader.attackByElement.fire, 216);
  const waterLeader = buildTeam(["tide_monk", "ember_scout", "moss_guard", "dawn_archer", "heart_priest"]);
  assert.equal(waterLeader.leaderSkill.name, "潮汐韻律");
  assert.equal(waterLeader.attackByElement.water, 192);
  assert.equal(waterLeader.attackByElement.fire, 180);
  assert.equal(waterLeader.leaderSkill.comboStepBonus, 0.05);
});

test("catalog has original cards across all six elements", () => {
  assert.equal(new Set(CARD_CATALOG.map((card) => card.element)).size, 6);
  assert.equal(getCard("heart_priest").element, "heart");
});

test("rejects the wrong number of cards", () => {
  assert.throws(() => buildTeam(DEFAULT_TEAM.slice(0, 4)), RangeError);
});

test("rejects duplicate cards", () => {
  assert.throws(() => buildTeam(["ember_scout", "ember_scout", "moss_guard", "dawn_archer", "heart_priest"]), /duplicate/);
});

test("rejects unknown cards", () => {
  assert.throws(() => getCard("missing_card"), /Unknown card/);
});

test("rejects teams above the configured cost limit", () => {
  assert.throws(() => buildTeam(DEFAULT_TEAM, { costLimit: 27 }), /exceeds limit/);
});

test("rejects invalid cost limits", () => {
  assert.throws(() => buildTeam(DEFAULT_TEAM, { costLimit: -1 }), RangeError);
});

test("catalog contains ten starters and five summon-only cards across three rarity tiers", () => {
  assert.equal(CARD_CATALOG.length, 15);
  assert.equal(STARTER_CARD_IDS.length, 10);
  assert.ok(CARD_CATALOG.every((card) => [3, 4, 5].includes(card.rarity)));
  assert.equal(CARD_CATALOG.filter((card) => card.rarity === 4).length, 3);
  assert.equal(CARD_CATALOG.filter((card) => card.rarity === 5).length, 2);
});


test("evolved card forms increase rarity and stats while preserving level scaling", () => {
  const base = buildTeam(DEFAULT_TEAM);
  const evolved = buildTeam(DEFAULT_TEAM, { evolutionLevels: { ember_scout: 1 } });
  assert.equal(evolved.cards[0].rarity, 4);
  assert.equal(evolved.cards[0].evolutionLevel, 1);
  assert.match(evolved.cards[0].name, /覺醒/);
  assert.ok(evolved.cards[0].hp > base.cards[0].hp);
  assert.ok(evolved.cards[0].atk > base.cards[0].atk);
  assert.ok(evolved.totalHp > base.totalHp);
  assert.ok(evolved.attackByElement.fire > base.attackByElement.fire);
});

test("rarity-specific evolution caps are enforced in team stat calculation", () => {
  assert.throws(() => buildTeam(DEFAULT_TEAM, { evolutionLevels: { ember_scout: 3 } }), /Invalid evolution level/);
  assert.throws(() => buildTeam(DEFAULT_TEAM, { evolutionLevels: [] }), /evolutionLevels/);
});


test("all fifteen original cards define a validated leader skill", () => {
  assert.equal(CARD_CATALOG.length, 15);
  for (const card of CARD_CATALOG) {
    assert.ok(card.leaderSkill, card.id + " should define a leader skill");
    assert.ok(card.leaderSkill.description.length > 0);
    assert.ok((card.leaderSkill.hpMultiplier ?? 1) > 0);
    assert.ok((card.leaderSkill.comboStepBonus ?? 0) <= 0.25);
    assert.ok((card.leaderSkill.healingMultiplier ?? 1) >= 0.5);
    assert.ok((card.leaderSkill.damageReduction ?? 0) <= 0.5);
  }
});

test("leader skill effects cover attack, HP, combo, healing, and damage reduction", () => {
  const effects = CARD_CATALOG.map(card => card.leaderSkill);
  assert.ok(effects.some(skill => Object.keys(skill.attackMultipliers ?? {}).length > 0));
  assert.ok(effects.some(skill => skill.hpMultiplier > 1));
  assert.ok(effects.some(skill => skill.comboStepBonus > 0));
  assert.ok(effects.some(skill => skill.healingMultiplier > 1));
  assert.ok(effects.some(skill => skill.damageReduction > 0));
});
