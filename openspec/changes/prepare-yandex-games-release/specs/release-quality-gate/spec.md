## ADDED Requirements

### Requirement: Role-specific onboarding is complete
The system SHALL keep the accepted six-step onboarding structure and SHALL teach the name, role, AP cost, targeting rule, deterministic effect, cover interaction, and once-per-battle limit of Aimed Shot, Burst, and Medkit in both Russian and English.

#### Scenario: New Russian player reads the ability step
- **WHEN** a new player opens the first battle in Russian
- **THEN** step 5 names Разведчик — Точный выстрел, Стрелок — Очередь, and Медик — Аптечка and explains each ability's cost and effect

#### Scenario: New English player reads the ability step
- **WHEN** a new player opens the first battle in English
- **THEN** step 5 names Scout — Aimed Shot, Gunner — Burst, and Medic — Medkit and explains each ability's cost and effect

#### Scenario: Minimum landscape viewport shows onboarding
- **WHEN** onboarding is displayed at 640×360 CSS pixels
- **THEN** its panel may scroll internally but no text, dismiss control, or modal boundary is clipped and the browser page does not scroll

### Requirement: Interactivity readiness is emitted at the correct boundary
The system SHALL emit `game_loaded` and invoke platform Game Ready exactly once through a single readiness coordinator only after the first Phaser snapshot is rendered, DOM controls and orientation handling are wired, overlays are initialized, and legal player input can be accepted when not blocked by onboarding or lifecycle pause.

#### Scenario: Runtime object is constructed
- **WHEN** the battle runtime and session are constructed but the scene or DOM controls are not ready
- **THEN** neither `game_loaded` nor `LoadingAPI.ready()` is emitted

#### Scenario: All readiness prerequisites complete
- **WHEN** the platform, Phaser scene, DOM controls, overlays, and input state report ready
- **THEN** `game_loaded` and `LoadingAPI.ready()` are each emitted once and subsequent ready signals do not duplicate either event

#### Scenario: Readiness prerequisite fails
- **WHEN** the scene fails before first render or required controls are missing
- **THEN** the system does not report interactive readiness and exposes a localized recoverable startup error

### Requirement: Facilitator operations are reproducible
The system SHALL expose a typed, player-invisible host API keyed by observation `sessionId` for provided assistance, explicit player help requests, abandonment, tester metadata, event inspection, repeatable snapshot export, and exactly-once finalization. Its closed states SHALL be `prestart`, `active`, `terminal`, `abandoned`, and `finalized`; it MUST validate every enum and transition and MUST make primary-eligibility fields reproducible from exported data.

#### Scenario: Prestart operations are constrained
- **WHEN** an observation is `prestart`
- **THEN** tester metadata and snapshots are allowed, while help request/provision, abandonment, and finalization are rejected without analytics mutation

#### Scenario: Technical help is recorded
- **WHEN** the facilitator calls `provideHelp(sessionId, "technical", "technical_issue")` during an active battle
- **THEN** one `facilitator_help_provided` event records type, active-time timestamp, and reason while `facilitatorHelpUsed` remains false and independent completion remains possible

#### Scenario: Gameplay help is recorded
- **WHEN** the facilitator calls `provideHelp(sessionId, "gameplay", "requested")` during an active battle
- **THEN** one event records the assistance and the final summary has `facilitatorHelpUsed=true` and `independentCompletion=false`

#### Scenario: Rules are reopened
- **WHEN** a player reopens the rules without asking a facilitator for help
- **THEN** `rules_opened` is emitted without automatically emitting `help_requested` or `facilitator_help_provided`

#### Scenario: Explicit player help request is recorded
- **WHEN** the facilitator invokes `requestHelp(sessionId)` because the player explicitly asked outside the ordinary Rules UI
- **THEN** one `help_requested` event records active time and does not imply that help was provided

#### Scenario: Session is abandoned
- **WHEN** the facilitator invokes `abandonSession` with `user_left`, `technical_failure`, or `facilitator_ended`
- **THEN** one `battle_abandoned` record and the final export contain `abandoned=true`, the exact reason, `battleCompleted=false`, `independentCompletion=false`, and `technicalExclusionCandidate=true` only for `technical_failure`

#### Scenario: Abandonment is attempted outside active state
- **WHEN** abandonment is requested in `prestart`, `terminal`, `abandoned`, or `finalized`
- **THEN** it is rejected without adding or changing `battle_abandoned`

#### Scenario: Snapshot is exported
- **WHEN** `exportSnapshot(sessionId)` is called in `prestart`, `active`, `terminal`, or `abandoned`
- **THEN** it returns current ordered JSON with `exportFinalized=false` and does not lock any operation otherwise allowed in that state

#### Scenario: Finalized snapshot is exported
- **WHEN** `exportSnapshot(finalizedSessionId)` is called
- **THEN** it returns the byte-identical frozen final record with `exportFinalized=true` and does not create or mutate an event

#### Scenario: Session is finalized
- **WHEN** `finalizeSession(sessionId)` is called after terminal completion or abandonment
- **THEN** it returns one locked JSON with `exportFinalized=true`, rejects subsequent writes, and repeated finalization returns the same bytes without another event

#### Scenario: Help is attempted after active state
- **WHEN** help request or provision is attempted in `terminal`, `abandoned`, or `finalized`
- **THEN** it is rejected without changing help or eligibility fields

#### Scenario: Replay rolls observation identity
- **WHEN** replay is activated from `terminal`
- **THEN** `replay_clicked` is appended, the old observation is finalized once, and a new `prestart` observation receives new session and battle IDs while the old final bytes remain addressable and immutable

#### Scenario: Finalized record is addressed again
- **WHEN** snapshot, inspection, or finalization is requested with the old finalized session ID after replay
- **THEN** read operations return the frozen record and repeated finalization returns byte-identical JSON, while every write/transition is rejected

#### Scenario: Invalid operator call
- **WHEN** a caller supplies an unknown help/abandonment enum, edits tester metadata outside `prestart`, provides help outside `active`, or finalizes `prestart`/`active`
- **THEN** the API rejects the call without adding or mutating analytics events

### Requirement: Frozen battle behavior remains unchanged
The release work SHALL preserve the accepted deterministic map, unit stats, AP costs, abilities, cover, line-of-sight, AI, victory route, terminal rules, replay CTA, and absence of mid-battle restart.

#### Scenario: Golden winning sequence is replayed
- **WHEN** the documented winning command sequence is applied to the release candidate
- **THEN** it produces the same ordered core states/events and victory during player phase of round 2

#### Scenario: Release-layer work changes core behavior
- **WHEN** a core snapshot, event sequence, or golden AI result differs from the accepted playable baseline
- **THEN** release qualification fails unless a separate approved defect change and failing regression test authorize the difference

### Requirement: Release profiles are explicit and immutable
The build SHALL support exactly `study-draft` and `catalog-release` profiles and SHALL embed the profile, version, source commit, build time, scenario freeze ID, onboarding freeze ID, replay CTA freeze ID, analytics schema version, and ad policy in a release manifest.

#### Scenario: Study draft is built
- **WHEN** profile `study-draft` is selected
- **THEN** SDK integration is enabled, advertisements are disabled, and the manifest declares the build ineligible for public publication

#### Scenario: Catalog release is built
- **WHEN** profile `catalog-release` is selected after a `GO_NEXT_GATE` verdict
- **THEN** post-battle fullscreen advertising is enabled and the manifest declares the build eligible for draft qualification but not automatically approved for submission

#### Scenario: Unknown or incomplete profile is supplied
- **WHEN** the profile is absent, unknown, or missing a freeze identifier
- **THEN** the build fails before producing a release archive

### Requirement: Release candidate quality gate is fail-closed
A release candidate SHALL pass formatting, strict typecheck, unit/contract tests, all critical browser flows, production build, archive validation, OpenSpec strict validation, automated security checks, and independent specification/code review with no unresolved blockers.

#### Scenario: Every gate passes
- **WHEN** all required commands and two independent reviews return green evidence for the same manifest and source commit
- **THEN** the candidate receives `RELEASE_CANDIDATE_GO`

#### Scenario: Any gate fails or evidence is stale
- **WHEN** a required command fails, a blocker remains, or evidence references another commit/manifest
- **THEN** the candidate remains NOT-GO and no moderation-ready archive is declared
