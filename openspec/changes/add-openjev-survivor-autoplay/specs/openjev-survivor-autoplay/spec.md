## ADDED Requirements

### Requirement: OpenJEV controls Survivor turns by default
The system SHALL configure OpenJEV-backed Survivor autoplay as the default control mode of the `ai-exhibition` profile. After onboarding and while an active battle is in the player phase, the system SHALL request and execute Survivor decisions without requiring board input from a human. The existing deterministic Raider phase SHALL remain unchanged.

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

### Requirement: Autoplay waits for committed and presented state convergence
The system SHALL expose an explicit presentation-idle signal. It SHALL enumerate or request a new Survivor decision only when gameplay is unblocked, no presentation event or terminal transition is pending, runtime input is unlocked, and displayed state equals the committed session state. Candidate legality SHALL derive from the same core validation primitives as `dispatch`.

#### Scenario: Raider phase is committed before its animation finishes
- **WHEN** `end-player-phase` has committed Raider results but presentation events remain queued
- **THEN** Survivor autoplay issues no request until the presentation-idle signal confirms displayed and committed state convergence

#### Scenario: Candidate enumeration and dispatch share rules
- **WHEN** a candidate is emitted for the current player phase
- **THEN** it is legal under the same core AP, path, target, ability, phase, and status validation used by `dispatch`

### Requirement: Cancellation behavior is deterministic by cause
The system SHALL distinguish obsolete-state cancellation, lifecycle blocking, and current-state service failure. Obsolete responses SHALL be ignored without fallback. Blocked gameplay SHALL wait and freshly enumerate after unblocking. Current-state service failures SHALL invoke at most one fallback decision. Late transport completions SHALL never regain logical ownership.

#### Scenario: Old battle response arrives after replay
- **WHEN** a response from a prior battle epoch arrives
- **THEN** it is discarded without fallback, diagnostics mutation, or battle-state mutation

#### Scenario: Visibility resumes after cancellation
- **WHEN** visibility blocking cancelled a request and gameplay later becomes unblocked and presentation-idle
- **THEN** the system freshly enumerates current candidates before any new live or fallback selection

#### Scenario: Current request fails while gameplay is active
- **WHEN** the only logical request for the current fingerprint fails and gameplay remains unblocked
- **THEN** exactly one deterministic fallback decision is attempted for freshly validated current candidates

### Requirement: AI exhibition uses an immutable qualified release profile
The system SHALL define a separate `ai-exhibition` release profile with immutable OpenJEV control mode, versioned HTTPS proxy endpoint, contract version, allowed origins, and external-vendor declaration. Runtime query parameters, local storage, and player-controlled input MUST NOT change production endpoint or release mode. The existing human study/release profile and its frozen behavior SHALL remain unchanged.

#### Scenario: AI exhibition release is built
- **WHEN** the production AI exhibition artifact is generated
- **THEN** its manifest contains the validated immutable proxy endpoint and contract version and its browser bundle contains no secret

#### Scenario: Existing human profile is built
- **WHEN** the existing human study/release profile is generated
- **THEN** it retains human controls, the accepted six-step onboarding, existing winning-path flow, and existing analytics semantics without contacting OpenJEV

### Requirement: Public proxy abuse and cost are bounded
The proxy SHALL enforce exact request schema and size limits, candidate-count limits, per-source and per-session token buckets, per-battle request caps, upstream concurrency limits, and a global daily budget ceiling. It SHALL implement a failure/rate-limit circuit breaker and emergency disable switch. CORS and origin checks SHALL NOT be the sole abuse control.

#### Scenario: Client exceeds a bounded quota
- **WHEN** a source, session, battle, concurrency, or global budget limit is exceeded
- **THEN** the proxy performs no upstream request, returns a normalized bounded response, and the browser uses deterministic fallback without an immediate retry loop

#### Scenario: Upstream outage opens the circuit
- **WHEN** configured failure or rate-limit thresholds are reached
- **THEN** the circuit opens for its cooldown, live requests fail fast to fallback, and only bounded health probes may close it

### Requirement: Vendor data is minimized and disclosed
The OpenJEV request SHALL contain only tactical battle state and legal candidate summaries. It MUST exclude tester identifiers, platform identity, analytics history, arbitrary free text, and raw IP addresses. Proxy logs SHALL exclude authorization, raw payloads, and raw IPs; any rate-limit identifier MUST be short-lived and pseudonymous with documented retention. The AI exhibition release SHALL disclose the external AI processor and fallback behavior.

#### Scenario: Upstream request is inspected
- **WHEN** a normalized OpenJEV request is captured in a contract test
- **THEN** it contains only allowlisted tactical fields and no tester, platform, analytics, free-text, authorization, or raw-IP data

#### Scenario: Operational logs are inspected
- **WHEN** proxy logs and metrics are reviewed
- **THEN** they contain normalized codes and aggregate counters without raw payloads, raw IPs, credentials, or private model reasoning

### Requirement: Onboarding and test bootstrap are mode-aware
The AI exhibition profile SHALL use a localized six-step onboarding that preserves required ability content while teaching observation, policy/fallback status, pause/rules, and replay. The human profile SHALL retain its human-action onboarding. Runtime construction SHALL accept typed dependency injection for policy, transport, and clock in tests without exposing production runtime switches.

#### Scenario: AI exhibition onboarding is displayed
- **WHEN** a Russian or English AI exhibition starts at desktop or 640×360 landscape
- **THEN** all six steps fit, describe automated control and required abilities, and do not instruct the player to issue disabled board commands

#### Scenario: Browser test injects a delayed policy response
- **WHEN** an acceptance test supplies a deferred transport and deterministic clock through bootstrap construction
- **THEN** it can prove pending, timeout, cancellation, stale-response, and fallback behavior without changing the production artifact or using a live credential

### Requirement: Accepted decisions produce replayable evidence
The system SHALL record a versioned replay envelope with build and scenario identifiers, initial-state hash, ordered accepted Survivor commands, decision source, and resulting event checksum. Replaying the envelope SHALL not call OpenJEV and SHALL reproduce the same deterministic terminal state for a compatible build/scenario. AI analytics SHALL use stable decision/fallback/circuit events separate from the existing human study funnel.

#### Scenario: Completed AI battle is replayed from evidence
- **WHEN** a compatible replay envelope is executed through the battle engine
- **THEN** recorded Survivor commands and deterministic Raider phases reproduce the recorded terminal state and event checksum without network access

#### Scenario: AI analytics are exported
- **WHEN** AI exhibition diagnostics are exported
- **THEN** decision request, accepted decision, fallback, and circuit events are distinguishable and do not alter the semantics of existing human study events
