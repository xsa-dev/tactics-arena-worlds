## Context

This is a greenfield browser prototype intended to validate one tactical battle loop before investing in progression, content, economy, or monetization. The target is Yandex Games, whose audience is materially mobile, while grid tactics traditionally favor desktop precision. The implementation must therefore keep rules independent from Phaser, make touch interaction first-class, and expose enough events to measure comprehension and replay intent.

Stakeholders are the solo developer/product owner, external playtesters, and a future Yandex Games moderation/release process. The build should be achievable in several focused development days; every architectural choice is subordinate to that constraint.

## Goals / Non-Goals

**Goals:**

- Deliver one complete, replayable 3-vs-3 battle in 5–8 minutes.
- Keep battle rules deterministic and unit-testable outside Phaser.
- Make legal actions, AP costs, cover, range, phase, and outcome readable on touch and mouse.
- Run locally without Yandex SDK while preserving a narrow production integration seam.
- Emit a stable event funnel for observed playtests and a later Yandex deployment.

**Non-Goals:**

- Production-ready RPG progression, economy, ads, payments, backend, cloud saves, PvP, or LiveOps.
- Multiple battle maps, worlds, procedural content, equipment, morale, suppression, wounds, or character creation.
- Final balance or art quality.
- Proving long-term retention or monetization from an internal prototype.

## Decisions

### 1. Separate a pure deterministic battle domain from Phaser

`src/core/` will contain serializable state and pure commands such as `moveUnit`, `attackUnit`, `useAbility`, and `endPlayerPhase`. Phaser scenes will render snapshots and dispatch commands but MUST NOT own combat rules.

The first build contains no PRNG. The fixed starting state and deterministic rules make command sequences exactly reproducible. Randomness remains a separate post-validation change rather than dormant prototype infrastructure.

**Alternative considered:** placing state directly in `BattleScene`. This is quicker for the first hour but makes AI, replay, analytics, and regression tests fragile; the small domain boundary pays for itself within this prototype.

### 2. Use team turns rather than individual initiative

All surviving player units act in the player phase, followed by all surviving enemies in the enemy phase. Each player unit refreshes to 6 AP at phase start. Movement costs 1 AP per orthogonal tile; attacks and abilities have explicit fixed costs.

**Alternative considered:** per-unit initiative. It adds ordering UI and balancing complexity without being necessary to test AP, positioning, cover, and replay intent.

### 3. Use deterministic tactical rules, not d20, for the first test

Attacks within Manhattan range and unobstructed Bresenham line-of-sight always resolve. A normal attack costs 3 AP. Walkable half-cover terrain reduces incoming normal damage by 1, to a minimum of 1; it does not affect hit chance. Opaque wall terrain is unwalkable and blocks line-of-sight. The UI therefore teaches positioning without requiring probability explanations.

**Alternative considered:** the proposed d20 attack formula. Random misses confound a very small usability test: a tester may dislike variance rather than tactics. A seeded probabilistic mode can be evaluated only after the deterministic loop is understood and replayed.

### 4. Use one selected-unit interaction model

Tap/click selects a player unit. Legal movement cells and legal targets are highlighted. Selecting a highlighted cell or target executes the currently valid contextual action; abilities are chosen from a bottom action bar. Invalid actions do not consume AP and show a short reason.

The board uses a fixed logical coordinate system and Phaser FIT scaling. The minimum supported viewport is 640×360 CSS pixels in landscape, with 44×44 CSS-pixel minimum hit targets and 14 CSS-pixel minimum body text. The page has no browser scrolling; safe-area insets are applied to HUD and controls. Portrait shows a rotate-device screen and does not accept battle commands. Controls never depend on hover.

**Alternative considered:** drag-to-move. Drag gestures conflict with board panning and are harder to make discoverable and equivalent on desktop.

### 5. Use a small deterministic AI policy

Enemies activate once each in ID order. During an activation, an enemy repeats the following until it cannot act or the battle ends: attack a legal lethal target; otherwise attack the legal target with the lowest current HP; otherwise move once along a shortest orthogonal path to a reachable cell minimizing Manhattan distance to a position from which any living player can be attacked, then reevaluate. Attack ties resolve by target HP, distance, then target ID. Destination ties resolve by distance-to-attack, path length, Y, then X. An enemy may attack twice when it retains 3 AP; it never enters an occupied cell. If no path or legal action exists, its activation ends. Core actions resolve immediately; Phaser only queues their presentation events.

**Alternative considered:** behavior trees or minimax. Both exceed the validation need and increase nondeterminism/debugging cost.

### 6. Treat platform services as optional adapters

`PlatformService` exposes initialization, lifecycle subscription, language, and analytics emission. `LocalPlatformService` logs/buffers events. `YandexPlatformService` wraps the official SDK. Startup waits for adapter initialization with a timeout, then continues through the local behavior if unavailable.

Phaser game and audio pause on platform pause/focus-loss signals and resume only on the matching resume signal. This boundary intentionally excludes ads and purchases.

### 7. Pre-register analytics semantics

Events use stable names and JSON-safe properties. A playtest session receives `sessionId`, `testerId`, and `buildVersion`; each battle receives a generated `battleId`. `first_action` and `battle_finished` are emitted exactly once per battle. There is no mid-battle restart and therefore no `restartCount`; replay exists only after a terminal result and creates a new `battleId`. UI rendering must not emit product events. The local adapter buffers an exportable JSON session log for the first observed study.

### 8. Freeze one post-apocalyptic scenario for the cohort

The first cohort uses one post-apocalyptic arena: Survivors (Scout, Gunner, Medic) versus Raiders. The exact coordinates, stats, terrain, abilities, and AI contract live in `specs/grid-tactics-battle/spec.md` and are frozen for a cohort. Placeholder art uses consistent silhouettes/icons and one polish level; theme, onboarding copy, replay CTA, map, and balance cannot change within a cohort.

## Risks / Trade-offs

- **[The simplified battle does not represent the proposed deep RPG]** → State clearly that this change validates tactical comprehension/replay only; progression is a separate gate.
- **[Deterministic attacks feel flat]** → Do not add variance until the baseline test is complete; treat bounded randomness as a separate experiment.
- **[Three units plus controls do not fit small screens]** → Support landscape only, use FIT scaling, touch hit targets, and test at a representative small viewport.
- **[AI turns feel slow or opaque]** → Animate one action at a time with short delays and an enemy-phase banner; keep domain resolution instantaneous.
- **[Yandex SDK absence blocks local work]** → Adapter timeout and local fallback are mandatory and covered by tests.
- **[Analytics metrics are overinterpreted]** → Keep internal gates in the research brief and avoid calling them platform benchmarks.

## Migration Plan

1. Scaffold Vite/TypeScript/Phaser and unit-test tooling.
2. Implement and test pure grid, path, line-of-sight, combat, turn, and AI rules.
3. Add the Phaser battle presentation and onboarding.
4. Add local platform lifecycle and exportable analytics; keep the Yandex adapter as a narrow build-time boundary.
5. Run core tests, platform contract tests, 2–3 browser smoke flows, and production build; package a static build for playtests.
6. Conduct the 15-person study as a separate calendar gate after the playable build is accepted.

Rollback is deletion of this greenfield prototype change; no user data or production system is migrated.

## Open Questions

- Which external analytics sink, if any, will replace JSON export for a later unattended Yandex traffic test?
- If the first gate passes, should the next experiment test a second deterministic scenario or bounded attack variance first?
