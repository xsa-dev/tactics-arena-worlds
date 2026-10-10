## ADDED Requirements

### Requirement: OpenJEV controls Survivor turns by default
The system SHALL configure OpenJEV-backed Survivor autoplay as the default control mode. After onboarding and while an active battle is in the player phase, the system SHALL request and execute Survivor decisions without requiring board input from a human. The existing deterministic Raider phase SHALL remain unchanged.

#### Scenario: Default battle starts autoplay
- **WHEN** onboarding is dismissed and a new battle enters an unblocked player phase with default configuration
- **THEN** the system begins selecting Survivor commands through the OpenJEV-backed policy and does not wait for a human board command

#### Scenario: Enemy phase follows automated player phase
- **WHEN** Survivor autoplay selects and successfully submits `end-player-phase`
- **THEN** the existing deterministic Raider phase resolves and Survivor autoplay resumes only after the next player phase begins

#### Scenario: Human control override is configured
- **WHEN** the runtime control mode is explicitly configured as `human`
- **THEN** automatic Survivor requests are disabled and the existing human command interaction remains available

### Requirement: Only locally legal commands can be selected
The system SHALL enumerate candidate Survivor commands from the current `BattleState` using local battle rules. OpenJEV SHALL receive candidate identifiers and tactical summaries, not authority to construct or execute arbitrary commands. Every selected identifier MUST map to a candidate from the same current state and the mapped command MUST pass through the existing `dispatch` boundary.

#### Scenario: OpenJEV selects a legal candidate
- **WHEN** OpenJEV returns an identifier present in the candidate set for the unchanged current state
- **THEN** the system submits the mapped command through `dispatch` and presents only the events from an accepted result

#### Scenario: OpenJEV returns an unknown candidate
- **WHEN** the response identifier is absent from the candidate set
- **THEN** the system executes no remote-provided command and invokes the deterministic fallback policy on freshly enumerated candidates

#### Scenario: Candidate becomes stale
- **WHEN** battle epoch, phase, status, or decision-relevant state changes before an OpenJEV response arrives
- **THEN** the system ignores that response without mutating battle state

#### Scenario: Dispatch rejects a selected candidate
- **WHEN** the mapped command is rejected by `dispatch`
- **THEN** the system records a policy failure, refreshes candidates from the current state, and uses deterministic fallback without applying the rejected result

### Requirement: OpenJEV credentials remain server-side
The browser application SHALL call a project-owned HTTPS or same-origin proxy contract and SHALL NOT contain, persist, log, or transmit an OpenJEV API key outside that proxy's server-side upstream request. The proxy MUST read the credential from server-side secret storage, validate request shape and size, apply an upstream timeout, normalize failures, and avoid logging authorization material.

#### Scenario: Browser production assets are built
- **WHEN** the production browser bundle and release archive are inspected
- **THEN** no OpenJEV API key or bearer authorization value is present

#### Scenario: Proxy forwards a valid decision request
- **WHEN** the proxy receives a valid bounded request and its server-side secret is configured
- **THEN** it sends the normalized SystemOne request with server-side authorization and returns only the normalized selected candidate result

#### Scenario: Proxy is unavailable or unconfigured
- **WHEN** the browser cannot reach a configured proxy or no proxy endpoint is configured
- **THEN** Survivor autoplay continues through deterministic fallback without exposing a credential or blocking the battle

#### Scenario: Disclosed credential is encountered
- **WHEN** implementation or deployment configuration references the credential disclosed before this change
- **THEN** qualification fails and requires a newly provisioned secret before live OpenJEV requests are enabled

### Requirement: Autoplay survives service and lifecycle failures
The system SHALL maintain at most one in-flight Survivor policy request. It MUST bound each request by timeout, cancel or invalidate it on pause, visibility loss, replay, terminal result, control-mode change, or accepted state transition, and use deterministic fallback for timeout, transport failure, non-success status, malformed response, unknown candidate, or rejected command.

#### Scenario: OpenJEV request times out
- **WHEN** no valid response arrives before the configured policy timeout
- **THEN** the request is aborted or invalidated and the deterministic fallback selects from the current legal candidates

#### Scenario: Gameplay pauses during a request
- **WHEN** platform, focus, visibility, rules, advertisement, or orientation lifecycle blocks gameplay while a request is active
- **THEN** the active request is cancelled or invalidated and no new policy request starts until gameplay is unblocked

#### Scenario: Replay begins during or after a result
- **WHEN** the user starts a replay
- **THEN** all requests from the previous battle epoch are invalidated and the fresh battle starts with no carried policy state

#### Scenario: OpenJEV repeatedly avoids phase completion
- **WHEN** the configured maximum number of Survivor decisions for one player phase is reached while the battle remains active
- **THEN** the system submits `end-player-phase` instead of issuing another remote request

### Requirement: Deterministic fallback completes AI-vs-AI battles
The system SHALL include a deterministic Survivor policy that selects only supplied legal candidates using documented stable scoring and tie-breakers. The fallback SHALL guarantee forward progress and SHALL eventually end each active player phase. A missing or failing OpenJEV integration MUST NOT prevent a battle from reaching victory, defeat, or the existing round limit.

#### Scenario: No OpenJEV service is available
- **WHEN** an entire battle runs with the proxy unavailable
- **THEN** deterministic Survivor fallback and deterministic Raider AI continue alternating phases until the battle reaches a terminal result

#### Scenario: Equivalent fallback states are evaluated
- **WHEN** the deterministic fallback receives structurally equivalent state and candidate inputs
- **THEN** it selects the same candidate identifier

#### Scenario: No beneficial Survivor action remains
- **WHEN** fallback evaluates a player phase with no selected attack, ability, or movement action under its policy
- **THEN** it selects `end-player-phase`

### Requirement: Automated decisions are visibly paced and observable
The system SHALL present one accepted automated action at a time using the existing event presentation queue. The HUD SHALL identify automated Survivor control and indicate whether the current or most recent decision came from OpenJEV or deterministic fallback. Decision diagnostics MUST be JSON-safe and MUST exclude credentials, authorization headers, and private model reasoning.

#### Scenario: Automated action is accepted
- **WHEN** an OpenJEV or fallback command is accepted
- **THEN** its events finish presenting before the next Survivor decision request begins

#### Scenario: Fallback is used
- **WHEN** deterministic fallback selects a command because OpenJEV did not produce a usable decision
- **THEN** the UI indicates fallback operation without exposing secret or raw upstream error content

#### Scenario: Decision diagnostics are exported
- **WHEN** local session diagnostics are inspected
- **THEN** each automated decision records battle ID, round, state fingerprint, candidate ID, decision source, bounded latency information, fallback reason when applicable, and accepted event types without sensitive authorization data

### Requirement: AI-vs-AI behavior is acceptance tested
The system SHALL provide automated tests for legal-command enumeration, deterministic fallback, stale-response rejection, lifecycle cancellation, proxy normalization, secret exclusion, complete AI-vs-AI termination, and browser-visible autoplay. Tests SHALL NOT require a live production credential in CI.

#### Scenario: Browser autoplay smoke test runs
- **WHEN** the browser acceptance suite starts a default battle at desktop and supported mobile landscape sizes
- **THEN** Survivor and Raider actions occur without board input and the battle reaches a terminal result or the specified bounded test checkpoint without uncaught errors

#### Scenario: Production artifact is qualified
- **WHEN** the release security checks inspect generated assets and archives
- **THEN** they confirm that no configured OpenJEV secret or bearer token is embedded
