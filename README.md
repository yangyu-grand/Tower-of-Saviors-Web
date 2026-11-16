# Tower-of-Saviors-Web

An original browser-based puzzle RPG prototype with original placeholder characters, visual assets, and combat rules. No proprietary game artwork or copied game data is included.

## Run locally

- Requires Node.js 18 or newer.
- Install test dependencies with `npm install`.
- Install the Chromium browser used by end-to-end tests with `npx playwright install chromium`.
- Run unit and real-browser tests with `npm test`.
- Generate a deterministic chapter/encounter balance baseline with `npm run balance:report`.
- Serve the project root with a static server because browser ES modules may not work from a `file://` URL. Example: `python3 -m http.server 8000`, then open `http://localhost:8000`.

## Implemented

- 6 × 5 rune board with six rune types.
- Adjacent swaps by click/tap and pointer drag (mouse and touch).
- Horizontal/vertical match-3 clearing, gravity refill, and cascading combos.
- Score, party HP, heart-rune healing, and a four-stage campaign with three waves per stage.
- Data-driven elemental matchups and a pure combat calculation module.
- Five-slot party formation with an original starter card roster.
- Ten original active skills: damage boosts, rune conversion, shields, and healing.
- Per-card cooldowns advance only after successful rune-match turns; the skill used on a turn does not lose a cooldown count immediately.
- Active skills are wired into the game UI and affect the next attack, board, incoming damage mitigation, or team HP.
- Four original stages with twelve encounters, named enemy attacks, telegraphed heavy strikes, multi-hit attacks with per-hit shield mitigation, a self-healing support enemy, and a two-phase fourth-chapter boss with escalating specials and enrage thresholds.
- A deterministic campaign balance simulator that reuses live team, leader-skill, elemental, Combo, enemy-phase, support-healing, shield, and damage-reduction rules across all twelve encounters.
- Searchable enemy codex for all twelve encounters, with chapter/element/role filters and data-driven attack, support, special-skill, and boss-phase details.
- Enemy intent previews, wave transitions, stage-clear rewards, and campaign completion.
- A ten-card starter inventory plus five original summon-only characters across three rarity tiers; owned-card-only team selection.
- Gold and summon-stone currencies with encounter and boss-clear rewards.
- Single and ten-pull summoning with 3★/4★/5★ rates, a guaranteed 4★+ result per ten-pull, duplicate-card quantities, and a 20-pull 5★ pity counter.
- Card progression up to level 99, with battle EXP distributed to the active five-card team and gold-funded one-level training for any owned card.
- Card HP and ATK grow by 2.5% per level; leveled team stats feed into party HP, elemental attack, leader-skill calculations, and save validation.
- Duplicate copies can be consumed with gold to enhance a card's active skill up to skill level 5; damage boosts, rune conversion counts, shields, healing, and level-5 cooldowns improve with skill level.
- Versioned local saves (version 4) persist skill levels, evolution, materials, inventory, team, campaign/wave, rune board, HP, score, shields, active-skill cooldowns, and per-stage battle-result statistics; version-1/version-2/version-3 saves migrate without discarding existing progression.
- Automatic checkpoint saves after stable gameplay actions plus a manual save control; invalid saves fall back safely without deleting the stored data.
- Team cost validation, team HP aggregation, element-specific attack totals, and data-driven leader skills for all 15 original cards.
- Party attack stats are applied to matched-rune damage; extra runes beyond three add a small bonus.
- Responsive layout for narrow screens.
- Opt-in, synthesized Web Audio feedback and reduced-motion-aware battle animations; no external audio or art assets are required.
- First-run onboarding tutorial covering rune matching, cascading Combo, active skills, five-card party formation, inventory progression, and summoning; tutorial completion/skip is stored separately from the game save, and existing saved profiles are not interrupted.
- Persistent stage-clear result screen with per-stage turn, Combo, damage, healing, mitigation, EXP, score, and cumulative reward summaries; rewards are credited during combat and are never claimed again from the result screen.
- Deterministic Node.js unit tests plus Playwright Chromium end-to-end coverage for game boot, onboarding progression, rune dragging and matching, codex filters, save/reload persistence, sound controls, distinct enemy intent previews, mobile layout emulation, and reduced-motion preference.

## Original prototype combat rules

- Fire has advantage over wood; wood over water; water over fire.
- Light and dark have reciprocal advantage over each other.
- Advantage: 1.5× damage; disadvantage: 0.5×; other matchups: 1×.
- Heart-element enemies are neutral to all five attack elements.
- A matched attack element uses the team's summed attack for that element.
- Matching more than three runes adds 10% damage per extra rune.
- Combo multiplier is `1 + 0.25 × (combo - 1)` for each cascade step.
- Each matched heart rune restores 7 HP and does not deal damage.
- The default fire leader increases fire attack by 20% and team HP by 5%.

These are original prototype rules and are intentionally data-driven so they can be balanced later.

## Leader skills

- All 15 original cards now have a distinct leader skill; only the first team slot activates its leader skill.
- Leader skills can provide elemental attack multipliers, team HP multipliers, extra Combo scaling, improved heart-rune healing, or incoming-damage reduction.
- Leader modifiers are validated and applied by the shared combat and team calculations, not just displayed in the UI.
- Combo bonus changes the per-step Combo multiplier; healing bonuses round to whole HP; damage reduction is applied before shield mitigation.

## Campaign balance report

Run `npm run balance:report` to print a deterministic baseline for every encounter. The default scenario repeatedly matches three runes of the current leader element, applies the active leader skill, and simulates enemy attack cadence, Boss phase thresholds, support healing, leader damage reduction, and a configurable initial shield. Tests can supply additional matched elements, heart runes, extra cascades, card levels, evolution levels, and starting HP.

This is a repeatable balancing aid, not a player win-rate prediction: it does not simulate random board generation, movement choices, active-skill cooldowns, or skill timing. Compare scenarios before changing encounter values.

## Next priorities

1. Complete physical-device mobile QA for touch dragging, audio permission behavior, and layout on real iOS/Android browsers. Chromium now covers desktop browser flows and mobile viewport/touch-event emulation in CI.
2. Extend balance scenarios with active-skill cooldown timing and representative player match distributions before adjusting encounter values.

## Project structure

- `index.html` — game interface, party selection, rune board, and browser interaction.
- `combat.js` — pure elemental matchup and party-powered damage calculations.
- `team.js` — original card catalog, team validation, and leader-skill aggregation.
- `skills.js` — active-skill definitions, activation effects, and cooldown state transitions.
- `stages.js` — campaign data, wave progression, data-driven single/heavy/multi-hit/support patterns, HP-threshold boss phases, enemy intent previews, and per-hit shield mitigation.
- `enemyCodex.js` — searchable/filterable enemy catalog derived directly from the campaign source of truth.
- `balance.js` — deterministic per-encounter and full-campaign balance simulation using the same combat, team, and enemy-turn modules.
- `scripts/balance-report.js` — command-line campaign balance report.
- `tests/balance.test.js` — deterministic baseline, elemental matchup, support-healing, Boss-phase, shield, and campaign-report tests.
- `inventory.js` — owned-card inventory, currency operations, backward-compatible save validation, and browser storage adapter.
- `summon.js` — rarity rolls, ten-pull guarantee, duplicate handling, and epic pity.
- `progression.js` — card experience, level caps, team EXP distribution, stat growth, and gold-funded training.
- `skillEnhancement.js` — duplicate-card consumption, gold costs, and active-skill enhancement validation.
- `evolution.js` — original evolution recipes, material costs, validation, and evolved team-stat lookup.
- `codex.js` — searchable card catalog and element, rarity, ownership, and evolution filters.
- `battleFeedback.js` — reduced-motion-aware visual feedback and opt-in synthesized audio.
- `tutorial.js` — versioned first-run tutorial steps, event-gated progression, and independent browser-storage persistence.
- `battleResults.js` — validated per-stage combat statistics, idempotent encounter reward accounting, and resumable stage-clear summaries.
- `tests/browser-e2e.test.js` — real Chromium browser checks for core gameplay, persistence, sound, and responsive/touch behavior.
- `tests/browser-script.test.js` — embedded browser-module syntax and UI integration checks.
- `tests/battle-feedback.test.js` — opt-in audio, unsupported-audio fallback, animation hooks, and reduced-motion tests.
- `tests/tutorial.test.js` — tutorial progression, event gates, skip behavior, and storage validation tests.
- Other `tests/*.test.js` files — deterministic unit tests for combat, team, skills, campaign, inventory, summoning, progression, evolution, and the card codex.
