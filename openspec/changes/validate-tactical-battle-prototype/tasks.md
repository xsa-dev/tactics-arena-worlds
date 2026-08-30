## 1. Project foundation

- [x] 1.1 Scaffold a Vite + TypeScript application with Phaser 3, strict TypeScript settings, Vitest, formatting scripts, and production build scripts.
- [x] 1.2 Create `src/core`, `src/presentation`, `src/platform`, and `src/localization` boundaries and document the command flow from UI to core state.
- [x] 1.3 Add a responsive full-viewport game shell that prevents browser scrolling, text selection, context menus, and touch refresh during play.

## 2. Deterministic battle domain

- [x] 2.1 Define serializable map, terrain, cover, unit, ability, phase, command, event, and terminal battle-state types.
- [x] 2.2 Encode the exact frozen 8×6 post-apocalyptic scenario, coordinates, Survivor/Raider stats, AP costs, and once-per-battle abilities from the battle spec.
- [x] 2.3 Implement bounds, immediate defeated-unit removal, deterministic orthogonal shortest paths, reachable cells, Manhattan range, walkable half-cover mitigation, and Bresenham wall-blocking line-of-sight with focused unit tests.
- [x] 2.4 Implement pure command validation and AP spending for movement, normal attacks, Aimed Shot, Burst, and Medkit.
- [x] 2.5 Implement player/enemy phase transitions, 6-AP refresh, round counting, victory, squad-loss defeat, round-8 defeat, and command rejection after completion.
- [x] 2.6 Implement the complete deterministic Raider activation and tie-breaking contract with golden-state tests for lethal/nonlethal targets, movement, two attacks, no-path behavior, and terminal interruption.
- [x] 2.7 Add replay tests proving that identical command sequences produce identical state/event sequences and add one documented winning smoke sequence that finishes by round 8.

## 3. Battle presentation and onboarding

- [x] 3.1 Implement the Phaser boot and battle scenes, rendering the board, terrain, cover, units, HP, AP, selected unit, phase, and round from core snapshots.
- [x] 3.2 Implement click/tap selection and legal movement/target highlights, dispatch valid core commands, and show concise reasons for rejected commands.
- [x] 3.3 Implement the bottom action bar, explicit AP costs, ability targeting, end-phase control, and disabled states without hover-only behavior.
- [x] 3.4 Present enemy actions sequentially from core events while locking player input, including movement, damage, cover mitigation, and unit defeat feedback.
- [x] 3.5 Add first-battle onboarding for selection, AP, movement, attacks, cover, and phase ending; persist dismissal locally and allow reopening rules.
- [x] 3.6 Add Russian and English string catalogs, normalized language selection, English fallback, and tests that every required UI key exists in both catalogs.
- [x] 3.7 Add victory/defeat summary with result, rounds, active duration, and post-result replay; verify that no mid-battle restart exists and replay resets all state with a new battle ID.
- [x] 3.8 Verify the complete layout at 640×360 landscape with 44×44 hit targets, 14px body text, safe-area insets, no page scroll, and a noninteractive localized portrait rotation screen.

## 4. Platform and measurement

- [x] 4.1 Define `PlatformService` and implement `LocalPlatformService` with language, lifecycle subscription, buffered analytics, inspectable logging, and ordered JSON session export.
- [x] 4.2 Implement `YandexPlatformService` around the official SDK with initialization timeout, local fallback, and loading-complete notification only after the game is interactive.
- [x] 4.3 Resolve core commands synchronously and wire pause/resume only to input, presentation queue, active-duration timing, and audio; test that resume cannot repeat or reapply core events.
- [x] 4.4 Implement every specified analytics trigger, cardinality, shared property, abandonment path, rejection reason, and exactly-once invariant with contract tests.
- [x] 4.5 Verify by test spies that battle completion and replay never invoke advertising or purchase APIs.

## 5. Playable-build gate

- [x] 5.1 Run focused unit tests for core rules plus platform analytics/lifecycle contract tests; do not require a separate E2E test for every normative sentence.
- [x] 5.2 Add 2–3 critical browser smoke flows covering a legal player/enemy turn, pause/resume without duplicated state, terminal result/replay, both locales, and touch at 640×360.
- [x] 5.3 Run typecheck, unit/contract tests, browser smoke tests, and production build; verify the static build runs without Yandex SDK and record desktop/mobile screenshots.
- [x] 5.4 Freeze the accepted build version, scenario, onboarding, theme, replay CTA, and balance before recruiting the cohort.

## 6. Separate playtest-study gate

- [ ] 6.1 Prepare the facilitator script, four-question comprehension rubric with reference answers, neutral replay-reason question, tester metadata sheet, technical exclusion log, and JSON export procedure from the research brief.
- [ ] 6.2 Recruit exactly 15 valid unseen Russian-speaking friends/colleagues for 8 mobile and 7 desktop sessions, recording prior tactics experience and replacing every technically invalid session with a new tester from the same device class.
- [ ] 6.3 Conduct sessions without gameplay help for the first 90 seconds unless explicitly requested; separately record help requests and provided technical/gameplay assistance with type, timestamp, reason, and derived `independentCompletion`.
- [ ] 6.4 Verify on an exported fixture that the primary eligible set is reproducible without manual interpretation, then aggregate required diagnostic segments and apply the branch for `initial` or `ui_repeat` exactly once.
- [ ] 6.5 Record exactly one verdict: TOP_UP_DATA, PIVOT_UI, GO_NEXT_GATE, NOT_GO_CURRENT_CORE/PIVOT_CORE, or NOT_GO; do not propose progression, monetization, PvP, or multiple worlds from this study.
