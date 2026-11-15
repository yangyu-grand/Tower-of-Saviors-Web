# Tower-of-Saviors-Web

An original, browser-based puzzle RPG prototype. The project uses original placeholder characters, visual assets and combat rules; it does not include proprietary game artwork or copied game data.

## Run locally

- Requires Node.js 18 or newer for the test runner.
- Run the deterministic combat tests with `npm test`.
- Serve the project root with a local static server (ES modules are not supported by every browser when opening `index.html` directly as a `file://` URL). For example: `python3 -m http.server 8000`, then open `http://localhost:8000`.

## Implemented

- 6×5 rune board with six rune types.
- Adjacent rune swapping, match detection, gravity refill and cascading combos.
- Score, player HP, heart-rune healing and sequential enemies.
- Data-driven elemental matchup and pure combat calculation module.
- Responsive layout for narrow screens.
- Deterministic Node.js tests for elemental matchups and damage calculations.

## Original elemental rules

- Fire has advantage over wood; wood over water; water over fire.
- Light and dark have reciprocal advantage over each other.
- Advantage damage multiplier: 1.5×.
- Disadvantage damage multiplier: 0.5×.
- Other matchups are neutral at 1×. Heart-element enemies are neutral to all attack elements.
- Each matched attack rune contributes 11 base damage.
- Combo multiplier is `1 + 0.25 × (combo - 1)` for each cascade step.
- Each matched heart rune restores 7 HP and does not deal damage.

These are original prototype rules and are intentionally data-driven so they can be balanced later.

## Current development priorities

1. Add party members, card data and leader/active skills.
2. Add stages, enemy attack patterns and boss mechanics.
3. Add inventory, summoning, progression and persistent saves.
4. Improve animations, sound and browser/mobile QA.

## Project structure

- `index.html` — game interface and board interaction.
- `combat.js` — pure elemental matchup and damage calculations.
- `tests/combat.test.js` — deterministic combat unit tests.
