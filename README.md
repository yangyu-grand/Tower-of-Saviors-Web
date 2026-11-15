# Tower-of-Saviors-Web

An original browser-based puzzle RPG prototype with original placeholder characters, visual assets and combat rules. No proprietary game artwork or copied game data is included.

## Run locally

- Requires Node.js 18 or newer for tests.
- Run deterministic combat tests with `npm test`.
- Serve the project root with a static server because browser ES modules may not work from a `file://` URL. Example: `python3 -m http.server 8000`, then open `http://localhost:8000`.

## Implemented

- 6 × 5 rune board with six rune types.
- Adjacent swaps by click/tap and pointer drag (mouse and touch).
- Horizontal/vertical match-3 clearing, gravity refill and cascading combos.
- Score, player HP, heart-rune healing and sequential enemies.
- Data-driven elemental matchup and pure combat calculation module, now powered by the selected party's element-specific attack stats.\n- Five-slot party formation with an original starter card roster, team cost validation, total HP, and a leader skill.
- Responsive layout for narrow screens.
- Deterministic Node.js tests for elemental matchups and damage calculations.

## Original elemental rules

- Fire has advantage over wood; wood over water; water over fire.
- Light and dark have reciprocal advantage over each other.
- Advantage: 1.5× damage; disadvantage: 0.5×; other matchups: 1×.
- Heart-element enemies are neutral to all five attack elements.
- Each matched attack rune contributes 11 base damage.
- Combo multiplier is `1 + 0.25 × (combo - 1)` for each cascade step.
- Each matched heart rune restores 7 HP and does not deal damage.

These are original prototype rules, not copied commercial-game formulas.

## Next priorities

1. Add party members, card data, team formation and leader/active skills.
2. Add stages, enemy attack patterns and boss mechanics.
3. Add inventory, summoning, progression and persistent saves.
4. Improve animations, sound and browser/mobile QA.

## Project structure

- `index.html` — game interface and board interaction.
- `combat.js` — pure elemental matchup and damage calculations.
- `tests/combat.test.js` — deterministic combat unit tests.
