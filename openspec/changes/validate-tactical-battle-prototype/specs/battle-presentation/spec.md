## ADDED Requirements

### Requirement: Responsive landscape battle layout
The system SHALL present the complete battle board, current phase, selected unit status, AP, actions, and end-turn control at viewports of at least 640×360 CSS pixels in landscape. Interactive hit targets SHALL be at least 44×44 CSS pixels, body text SHALL be at least 14 CSS pixels, safe-area insets SHALL protect HUD and controls, and the page SHALL have no browser scrolling.

#### Scenario: Small mobile landscape viewport
- **WHEN** the game is displayed at 640×360 CSS pixels in landscape
- **THEN** the complete board and required controls meet the size constraints without overlap or browser-page scrolling

#### Scenario: Device is in portrait
- **WHEN** viewport height exceeds viewport width
- **THEN** the system shows a localized rotate-device screen and accepts no battle commands until landscape is restored

### Requirement: Equivalent pointer and touch control
The system SHALL support the complete battle flow through both pointer clicks and touch taps without hover-dependent actions.

#### Scenario: Selecting and moving by touch
- **WHEN** a player taps a friendly unit and then a highlighted reachable cell
- **THEN** the system performs the same selection and move as equivalent mouse input

### Requirement: Legal-action communication
The system SHALL visually distinguish the selected unit, reachable movement cells, legal attack targets, legal ability targets, current team phase, and unavailable actions.

#### Scenario: Friendly unit is selected
- **WHEN** the player selects a living friendly unit during the player phase
- **THEN** the UI displays its HP and AP and highlights only currently legal destinations and targets

#### Scenario: Invalid action is attempted
- **WHEN** the player attempts an invalid action
- **THEN** the UI displays a concise reason and leaves battle state unchanged

### Requirement: First-battle onboarding
The system SHALL teach selection, AP spending, movement, attacking, cover, each role's once-per-battle ability, and ending the phase through an in-game overlay that can be dismissed and reopened. The first-cohort Russian copy, step order, and trigger points SHALL be frozen before the first valid session and SHALL NOT change within that cohort.

#### Scenario: First battle starts
- **WHEN** no onboarding-complete flag exists locally
- **THEN** the game presents the first onboarding instruction before accepting a battle action

#### Scenario: Rules are reopened
- **WHEN** the player activates the rules control
- **THEN** the onboarding/rules content opens without resetting battle state

### Requirement: Localized prototype copy
The system SHALL provide Russian and English text for all player-facing prototype UI and SHALL fall back to English when the requested language is unavailable.

#### Scenario: Russian language is selected
- **WHEN** the platform adapter reports Russian
- **THEN** all battle controls, onboarding text, action names, and result text use Russian strings

#### Scenario: Unsupported language is reported
- **WHEN** the platform adapter reports a language other than Russian or English
- **THEN** the system displays English strings

### Requirement: Clear enemy action presentation
The system SHALL identify the enemy phase and present enemy actions sequentially so the player can understand resulting movement, damage, defeat, and cover effects.

#### Scenario: Enemy phase executes
- **WHEN** the player ends the player phase
- **THEN** the UI disables player commands, shows the enemy-phase state, and animates enemy actions in resolved order before restoring control

### Requirement: Result and replay presentation
The system SHALL show an unambiguous victory or defeat result with rounds and active elapsed time and one prominent replay control. It SHALL NOT expose a mid-battle restart control.

#### Scenario: Battle reaches a terminal state
- **WHEN** the core reports victory or defeat
- **THEN** the UI displays the result summary and replay control and prevents further board interaction

#### Scenario: Battle is in progress
- **WHEN** the battle has not reached victory or defeat
- **THEN** no restart or replay control is available
