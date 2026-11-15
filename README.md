# Tower-of-Saviors-Web

An original browser-based puzzle RPG prototype with original placeholder characters, visual assets, and combat rules. No proprietary game artwork or copied game data is included.

## Run locally

- Requires Node.js 18 or newer.
- Run deterministic unit tests with `npm test`.
- Serve the project root with a static server because browser ES modules may not work from a `file://` URL. Example: `python3 -m http.server 8000`, then open `http://localhost:8000`.

## Implemented

- 6 × 5 rune board with six rune types.
- Adjacent swaps by click/tap and pointer drag (mouse and touch).
- Horizontal/vertical match-3 clearing, gravity refill, and cascading combos.
- Score, party HP, heart-rune healing, and a three-stage campaign with three waves per stage.
- Data-driven elemental matchups and a pure combat calculation module.
- Five-slot party formation with an original starter card roster.
- Ten original active skills: damage boosts, rune conversion, shields, and healing.
- Per-card cooldowns advance only after successful rune-match turns; the skill used on a turn does not lose a cooldown count immediately.
- Active skills are wired into the game UI and affect the next attack, board, incoming damage mitigation, or team HP.
- Three original stages with nine encounters, boss telegraphs, enrage thresholds, and shield-piercing special attacks.
- Enemy intent previews, wave transitions, stage-clear rewards, and campaign completion.
- A ten-card starter inventory with card quantities, levels, and owned-card-only team selection.
- Gold and summon-stone currencies with encounter and boss-clear rewards.
- Versioned local saves for inventory, team, campaign/wave, rune board, HP, score, shields, and active-skill cooldowns.
- Automatic checkpoint saves after stable gameplay actions plus a manual save control; invalid saves fall back safely without deleting the stored data.
- Team cost validation, team HP aggregation, element-specific attack totals, and a fire leader skill.
- Party attack stats are applied to matched-rune damage; extra runes beyond three add a small bonus.
- Responsive layout for narrow screens.
- Deterministic Node.js tests for combat rules, team validation, and leader-stat aggregation.

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

## Next priorities

1. Add summoning, card progression, and duplicate-card handling.
2. Expand leader skills and balance active-skill and boss values.
3. Improve animations, sound, and browser/mobile QA.

## Project structure

- `index.html` — game interface, party selection, and board interaction.
- `combat.js` — pure elemental matchup and party-powered damage calculations.
- `team.js` — original card catalog, team validation, and leader-skill aggregation.
- `skills.js` — active-skill definitions, activation effects, and cooldown state transitions.
- `stages.js` — campaign data, wave progression, enemy intents, boss phases, and shield mitigation.
- `inventory.js` — owned-card inventory, currency operations, save validation, and browser storage adapter.
- `tests/combat.test.js` — deterministic combat unit tests.
- `tests/team.test.js` — deterministic party and card validation tests.
- `tests/skills.test.js` — deterministic active-skill and cooldown tests.
- `tests/stages.test.js` — deterministic campaign, wave, enemy-turn, and boss tests.
- `tests/inventory.test.js` — deterministic inventory, save validation, storage-failure, and currency tests.
