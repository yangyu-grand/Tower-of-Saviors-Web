# Tower-of-Saviors-Web

An original browser-based puzzle RPG prototype with original placeholder characters, visual assets, and combat rules. No proprietary game artwork or copied game data is included.

## Run locally

- Requires Node.js 18 or newer.
- Install test dependencies with `npm install`.
- Install the Chromium browser used by end-to-end tests with `npx playwright install chromium`.
- Run unit and real-browser tests with `npm test`.
- Generate a deterministic chapter/encounter balance baseline with `npm run balance:report`.
- Compare active-skill cooldowns and three representative match distributions with `npm run balance:scenarios`.
- Sweep every cost-valid leader/four-member lineup across all twelve encounters with `npm run balance:parties`.
- Analyze legal adjacent swaps, cascade outcomes, team damage, and heart healing over seeded random boards with `npm run balance:moves`.
- Generate a deterministic, seekable battle event timeline with `npm run replay:sample`.
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
- A representative scenario simulator for steady, balanced, and high-Combo rune matches, including active-skill effects, per-card cooldown timing, healing, conversion, shields, and damage boosts.
- A party-composition balance sweep that enumerates every cost-valid leader/four-member lineup from the 15-card catalog and evaluates all twelve encounters using shared team, combat, enemy-turn, and skill-cooldown rules.
- A shared 6 × 5 rune-board engine with seeded board generation, horizontal/vertical run detection, legal-swap validation, stable gravity/refill, cascade resolution, and automatic reshuffling when no legal move remains.
- A seeded move-quality analyzer that enumerates all 49 adjacent swaps, resolves each legal move with deterministic refill, and scores real team damage/healing against a selected enemy element.
- A versioned battle replay timeline with exact board snapshots, swap positions, per-cascade match indices/refills, active skills, per-element damage attribution (rune counts and elemental matchup), player damage, enemy actions, cooldowns, shields, and turn-end state.
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

This baseline is a repeatable balancing aid, not a player win-rate prediction: it does not simulate random board generation, movement choices, or active-skill timing.

Run `npm run balance:scenarios` to compare three deterministic match profiles across all twelve encounters. The steady profile uses a single three-rune match without active skills; balanced and high-Combo profiles include heart matches, cascades, and a round-robin skill schedule. Skill cooldowns use the live `advanceSkillCooldowns()` rule, including the rule that a newly activated skill does not tick down on that same turn. Conversion scenarios assume the player matches the converted target group; they are not a physics or random-board simulation.

## Party composition balance report

Run `npm run balance:parties` to enumerate all ordered leader choices and unordered four-card member groups that satisfy the configured team cost cap. With the current 15-card catalog and default cost limit of 30, the report evaluates 6,055 valid lineups against all 12 campaign encounters. It ranks the strongest and weakest representative lineups by victories, average turns to defeat, and average HP damage taken. The first card supplies the leader skill; the remaining four cards retain catalog order. Card levels, evolution levels, skill levels, match distribution, initial shield, turn limit, and output ranking limit can be supplied to `buildPartyBalanceReport()`.

This is a deterministic roster-comparison tool, not a random-board simulation or player win-rate prediction. Match profiles assume the selected rune groups are successfully matched, and the skill scheduler uses a cooldown-aware round-robin policy rather than an optimal player policy.

## Rune board engine

The browser game and automated tests share the pure functions in `runeBoard.js`. New boards are generated without an immediate match and with at least one legal adjacent swap; a deterministic fallback keeps generation bounded if a supplied random source stalls. The module also provides seeded random generation, deduplicated horizontal/vertical run detection, row-wrap-safe adjacency checks, stable bottom-up gravity/refill, and a deterministic swap/cascade resolver for tests and future balance simulations. After a live cascade, the game automatically reshuffles a stable board if no legal match-producing swap remains.

## Rune move quality report

Run `npm run balance:moves` to generate 100 reproducible 6 × 5 boards and evaluate every possible adjacent swap. Each candidate uses an isolated seeded refill stream, the selected five-card team's actual leader-adjusted elemental attack, the target enemy element, the shared Combo damage formula, and heart-rune healing. The report summarizes legal-move availability and the average best-move damage, healing, and Combo. It is a deterministic move-quality benchmark, not a human-play or win-rate prediction: it does not model drag-path choices, player reaction time, active-skill decisions, or physical-device input.

## Board-driven encounter simulation

Run `npm run balance:battles` to simulate all twelve encounters from seeded 6 × 5 rune boards. Each turn evaluates legal adjacent swaps with the shared team and elemental combat rules, optionally activates one useful ready skill, applies rune healing, resolves the enemy's real attack/support/special intent, and carries shield, HP, and per-card cooldown state forward. Boss phase thresholds and enrage are evaluated after the player's actual board damage. The default CLI runs two deterministic samples per encounter.

The greedy policy chooses the highest-utility legal swap and at most one useful active skill per turn. This is a reproducible automated benchmark, not a human-play prediction: it does not model manual drag paths, player reaction time, or optimal multi-skill planning.

## Battle replay timeline

Run `npm run replay:sample` to generate a deterministic event timeline for a seeded encounter. The replay stores the board at turn start, the board after active-skill effects, the selected adjacent swap, every cascade's matched cell indices and post-refill board, player damage/healing, enemy response, cooldowns, shields, and the board carried into the next turn. Replay schema version 1 is JSON-serializable and can be validated or queried by event index without rerunning combat.

The replay is derived from the simulator's exact seeded refill stream; it does not approximate cascade frames or infer match positions from summary counts. The browser includes an interactive replay viewer with play/pause, previous/next event stepping, timeline seeking, exact 6 × 5 board snapshots, and validated JSON import/export. A fixed-seed Boss sample can be generated in the page; imported replay files are schema-validated before they replace the current viewer state. The viewer displays simulator-generated, imported, and live human-controlled replays; the live recorder stores the latest completed encounter in browser storage.

## Next priorities

1. Add explicit phase-transition callouts when a Boss crosses an HP threshold, while preserving the replay schema and exact seek behavior.
2. Compare greedy, random-legal, and conservative policies against recorded live-player replay samples before changing Boss or enemy values.
3. Complete physical-device mobile QA for touch dragging, audio permission behavior, and layout on real iOS/Android browsers. Chromium currently covers desktop flows and mobile viewport/touch-event emulation in CI.

## Project structure

- `index.html` — game interface, party selection, rune board, and browser interaction.
- `combat.js` — pure elemental matchup and party-powered damage calculations.
- `team.js` — original card catalog, team validation, and leader-skill aggregation.
- `skills.js` — active-skill definitions, activation effects, and cooldown state transitions.
- `stages.js` — campaign data, wave progression, data-driven single/heavy/multi-hit/support patterns, HP-threshold boss phases, enemy intent previews, and per-hit shield mitigation.
- `enemyCodex.js` — searchable/filterable enemy catalog derived directly from the campaign source of truth.
- `balance.js` — deterministic per-encounter and full-campaign balance simulation using the same combat, team, and enemy-turn modules.
- `balanceScenarios.js` — active-skill cooldown-aware simulations and representative match-distribution reports.
- `partyBalance.js` — exhaustive cost-valid party enumeration and twelve-encounter composition ranking.
- `runeBoard.js` — seeded 6 × 5 board generation, match detection, legal swaps, gravity/refill, and cascade resolution.
- `runeMoveAnalysis.js` — deterministic evaluation of legal adjacent swaps using shared team/combat rules and per-element damage attribution across cascades.
- `runeBattleSimulation.js` — seeded board-driven encounter turns with active skills, enemy responses, boss phases, shields, and HP tracking.
- `runeBattleReplay.js` — validated, JSON-serializable battle event timelines with exact cascade board snapshots.
- `replayViewer.js` — validated replay-viewer state, bounded step/seek/playback transitions, board-snapshot lookup, and localized event summaries.
- `replayPlayback.js` — validated replay-speed multipliers and minimum-bounded playback intervals.
- `replayKeyboard.js` — replay-panel-scoped keyboard shortcuts with native-control and modifier exclusions.
- `replayCombatFeedback.js` — validated player/enemy feedback, per-element damage, active-skill and Boss-phase callouts, and deterministic enemy-HP lookup at any replay event.
- `tests/replay-combat-feedback.test.js` — combat feedback, healing/shield separation, HP timeline, and invalid-input coverage.
- `tests/replay-phase-skill-feedback.test.js` — bounded skill summaries, Boss phase labels, and explicit enrage-state validation.
- `tests/replay-playback.test.js` and `tests/replay-keyboard.test.js` — deterministic playback timing and keyboard-action tests.
- `scripts/rune-battle-replay-report.js` — deterministic sample replay timeline report.
- `scripts/balance-report.js` — command-line campaign balance report.
- `scripts/balance-scenarios.js` — command-line representative scenario matrix.
- `scripts/party-balance-report.js` — command-line full party-composition sweep.
- `scripts/rune-move-quality-report.js` — command-line seeded move-quality report.
- `scripts/rune-battle-report.js` — command-line seeded full encounter-turn simulation report.
- `tests/balance-scenarios.test.js` — active-skill timing, cooldown, conversion, shield, healing, and match-distribution tests.
- `tests/party-balance.test.js` — lineup enumeration, cost filtering, leader-slot coverage, deterministic encounter reports, and progression-stat tests.
- `tests/rune-board.test.js` — seeded generation, match detection, adjacency, gravity, valid/invalid swaps, and cascade snapshots.
- `tests/rune-move-analysis.test.js` — deterministic move ranking, team/element modifiers, heart healing, and board-sample reports.
- `tests/rune-battle-simulation.test.js` — seeded encounter turns, enemy responses, boss phases, active skills, and campaign reports.
- `tests/rune-battle-replay.test.js` — replay snapshot integrity, event ordering, deterministic serialization, and safe event seeking.
- `tests/replay-viewer.test.js` — replay viewer state, step/seek bounds, playback completion, detached board snapshots, and event summaries.
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
- `tests/browser-e2e.test.js` — real Chromium browser checks for core gameplay, persistence, sound, replay playback/import/export, and responsive/touch behavior.
- `tests/browser-script.test.js` — embedded browser-module syntax and UI integration checks.
- `tests/battle-feedback.test.js` — opt-in audio, unsupported-audio fallback, animation hooks, and reduced-motion tests.
- `tests/tutorial.test.js` — tutorial progression, event gates, skip behavior, and storage validation tests.
- Other `tests/*.test.js` files — deterministic unit tests for combat, team, skills, campaign, inventory, summoning, progression, evolution, and the card codex.


## 玩家實戰錄製與重播

- `liveBattleRecorder.js` 將瀏覽器中的真實玩家回合記錄為既有 Replay Schema v1 事件：回合開始、技能、相鄰交換、每次 Cascade 補珠盤面、玩家攻擊、敵人反擊、回合結束及戰鬥結算。
- 戰鬥重播面板新增「載入最近實戰」；成功擊敗一個敵人或隊伍戰敗後，最近一場實戰會保存至瀏覽器 localStorage（`tower_of_saviors_live_replay_v1`），重新載入頁面仍可在重播檢視器中開啟。
- 示範模擬與玩家實戰使用相同的事件檢視器及 JSON 格式；匯出檔名以 `tower-live-replay-seed-` 區分玩家實戰。
- 實戰紀錄以玩家當下實際盤面與行動為準，不會用 Greedy 模擬結果冒充玩家操作；每個新敵人波次獨立建立一份最近戰鬥紀錄。
- 驗證：`npm test` 包含 live recorder 單元測試與 Chromium 實際轉珠、勝利後重播、重新載入後恢復紀錄的端對端測試。

## Replay playback speed

- The replay toolbar provides 0.5×, 1×, 1.5×, 2×, 3×, and 4× playback speeds.
- Changing the speed while playback is active restarts the timer at the selected interval without changing the current event index or pausing the replay.
- `replayPlayback.js` validates supported multipliers and calculates the interval from the 650 ms default, with a 50 ms minimum interval to keep fast playback readable.
- Validation: `tests/replay-playback.test.js` covers supported speeds, interval scaling, invalid values, and the minimum interval; Chromium end-to-end coverage verifies the speed selector and live speed changes.


## Replay keyboard shortcuts

- Focus the replay panel, then press Space to play or pause.
- Use Left/Right Arrow to move to the previous or next event.
- Use Home/End to jump to the first or last event.
- Shortcuts are scoped to the replay panel and ignored while a native input, select, button, link, label, or editable region has focus; modifier combinations and key repeats are ignored.
- Validation: unit tests cover key mapping and exclusions; Chromium end-to-end coverage verifies navigation, playback, and that the speed selector keeps its native keyboard behavior.


## Replay board animations

- Sequential forward playback and Next Step animate adjacent rune swaps, cascade refill cells, and affected gravity columns; skill, player-action, and enemy-action events receive subtle board-level feedback.
- Non-adjacent timeline seeks intentionally render a stable snapshot instead of inventing motion across skipped events.
- Replay animation plans are generated by the pure `replayAnimation.js` module from validated event data; the recorded replay JSON schema is unchanged.
- Animations honor `prefers-reduced-motion` and remain limited to the replay board, without changing the live battle board.
- Validation: `tests/replay-animation.test.js` covers swap geometry, cascade columns, malformed event data, and action feedback; Chromium end-to-end coverage verifies swap and refill keyframes.


## Replay combat feedback and enemy HP

- Sequential player-action events display the recorded Combo count, damage dealt, and combined rune/skill healing as transient, text-safe callouts.
- Sequential enemy-action events separate party HP damage from shield absorption; when an action causes no HP/shield change, its action label, pre-mitigation attack, or healing is still shown without misreporting it as HP damage.
- The replay event panel shows the enemy's current HP and maximum HP. The value is reconstructed from the initial encounter HP, each recorded enemyHpAfterTurn, and the authoritative final enemyHpRemaining event.
- Timeline seeks update the HP snapshot immediately; sequential playback animates the bar. The replay JSON schema remains version 1 and live-player recordings use the same path.
- Combat callouts use DOM text nodes, respect prefers-reduced-motion, and never alter the live battle state.
- Validation: tests/replay-combat-feedback.test.js covers event parsing, safe numeric handling, healing/shield separation, HP reconstruction, and boundary validation; Chromium end-to-end coverage verifies sequential damage feedback and HP transitions.


## Replay Boss phases and active-skill callouts

- Sequential `skill` events show the recorded skill name and a bounded effect summary, so replay playback explains why the board, shield, HP, or next attack changed.
- Sequential `enemy-action` events show the recorded Boss phase (for example, 花霧姿態 or 月蝕姿態) and an explicit 狂暴 label only when the recorded action marks the enemy as enraged.
- Phase and skill details are read from existing event payloads; Replay Schema v1 is unchanged. Older replays without phase fields remain valid.
- Labels are whitespace-normalized, length-bounded, and rendered through DOM `textContent`, not interpreted as HTML.
- Validation: `tests/replay-phase-skill-feedback.test.js` covers skill summaries, fallback labels, phase/enrage validation, and bounds; Chromium end-to-end coverage imports a Boss replay and verifies both callout types.
