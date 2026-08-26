## ADDED Requirements

### Requirement: Non-blocking platform initialization
The system SHALL initialize through a platform-service interface and SHALL remain playable through a local fallback when the Yandex SDK is absent, rejects initialization, or exceeds the startup timeout.

#### Scenario: SDK is available
- **WHEN** the official Yandex SDK initializes before the timeout
- **THEN** the system uses the Yandex platform adapter and signals that loading is complete after the game is ready

#### Scenario: SDK is unavailable locally
- **WHEN** the Yandex SDK is not present
- **THEN** the system uses the local platform adapter and starts the game without an uncaught error

### Requirement: Platform lifecycle pause and resume
The system SHALL resolve accepted core commands synchronously before presentation. When the platform or browser requests pause, it SHALL pause player input, the presentation-event queue, active-duration timing, and audio, then resume only after the corresponding resume signal. Resuming SHALL NOT repeat, roll back, or reapply a core event.

#### Scenario: Platform pause occurs during enemy actions
- **WHEN** a pause signal arrives while the enemy phase is being presented
- **THEN** enemy presentation, player input, elapsed-time tracking, and audio pause until a resume signal arrives

### Requirement: Stable battle analytics funnel
The system SHALL emit JSON-safe events through the platform-service interface. Every event SHALL include `sessionId`, `testerId`, `buildVersion`, `deviceClass`, `inputType`, `viewport`, and `locale`. Battle events SHALL also include `battleId`. The contract SHALL include:

- `game_loaded`: once when the interactive battle UI is ready;
- `battle_started`: once for each fresh battle;
- `onboarding_shown`, `onboarding_completed`, `onboarding_dismissed`: at most once each per battle;
- `unit_selected`, `move_completed`, `attack_completed`, `turn_ended`, `unit_ability_used`, `invalid_action`, `rules_opened`, and `help_requested`: once per matching user action;
- `facilitator_help_provided`: once for each assistance actually provided, with `helpType` equal to `technical` or `gameplay`, `helpAtMs`, and `helpReason` equal to `requested`, `timeout`, or `technical_issue`;
- `first_action`: once on the first legal move, attack, ability, or end-phase action;
- `battle_abandoned`: once when a started nonterminal battle is closed or the session ends;
- `battle_finished`: once on terminal state with `result`, `rounds`, `activeDurationMs`, `invalidActionCount`, `facilitatorHelpUsed`, `facilitatorHelpType`, `facilitatorHelpAtMs`, `facilitatorHelpReason`, and `independentCompletion`;
- `replay_clicked`: once when the terminal replay CTA is activated.

`help_requested` SHALL NOT imply that assistance was delivered. `facilitatorHelpUsed` SHALL be true if and only if at least one `gameplay` assistance event occurred. Technical assistance SHALL NOT invalidate independent completion. `independentCompletion` SHALL be true if and only if the battle reached a terminal result without gameplay assistance. The local service SHALL buffer and export the complete session as JSON. There is no `restartCount` because mid-battle restart does not exist.

#### Scenario: First legal action occurs
- **WHEN** the player completes the first legal action of a battle
- **THEN** the system emits `first_action` exactly once for that battle identifier

#### Scenario: Battle finishes
- **WHEN** a battle enters victory or defeat
- **THEN** the system emits one `battle_finished` containing all mandatory context and result properties

#### Scenario: Invalid action occurs
- **WHEN** the player attempts a command rejected by the core
- **THEN** the system emits one `invalid_action` with a stable rejection reason and increments the battle's invalid-action count

#### Scenario: Player requests help but none is provided
- **WHEN** the player explicitly requests help and the facilitator does not provide an explanation
- **THEN** the system records `help_requested` without changing `facilitatorHelpUsed` or `independentCompletion`

#### Scenario: Technical help is provided
- **WHEN** the facilitator assists with device or browser operation without revealing a game rule
- **THEN** the system emits `facilitator_help_provided` with `helpType=technical` and preserves eligibility for independent completion

#### Scenario: Gameplay help is provided
- **WHEN** the facilitator explains a legal action, AP, cover, target, ability, or battle goal
- **THEN** the system emits `facilitator_help_provided` with `helpType=gameplay`, sets `facilitatorHelpUsed=true`, and sets `independentCompletion=false`

#### Scenario: Nonterminal session ends
- **WHEN** a started battle has not finished and the test session is closed
- **THEN** the system emits one `battle_abandoned` before exporting the session log

#### Scenario: Replay begins
- **WHEN** the player activates replay after a terminal result
- **THEN** the system emits one `replay_clicked` for the completed battle and one `battle_started` with a new battle identifier

#### Scenario: UI rerenders
- **WHEN** presentation objects rerender without a player or lifecycle action
- **THEN** no product analytics event is emitted

#### Scenario: Session log is exported
- **WHEN** the facilitator exports a completed observed session
- **THEN** the JSON contains all buffered events in order plus `cohortIteration`, tester tactics-experience classification, comprehension result, facilitator-help summary fields, and `independentCompletion`

### Requirement: Platform-provided language selection
The system SHALL request the environment language from the platform adapter and expose a normalized supported language to presentation code.

#### Scenario: Platform reports Russian locale variant
- **WHEN** the platform reports `ru` or a Russian locale variant
- **THEN** the service exposes `ru`

#### Scenario: Platform reports an unsupported locale
- **WHEN** the platform reports a locale other than Russian or English
- **THEN** the service exposes `en`

### Requirement: Prototype excludes monetization calls
The system SHALL NOT invoke fullscreen advertising, rewarded advertising, or purchase APIs in this prototype change.

#### Scenario: Battle or replay completes
- **WHEN** a player completes a battle or starts a replay
- **THEN** no advertising or purchase API is invoked
