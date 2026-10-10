## 1. Security and configuration foundation

- [ ] 1.1 Revoke the previously disclosed OpenJEV credential and document that implementation and CI require a newly provisioned server-side `OPENJEV_API_KEY`.
- [ ] 1.2 Add typed Survivor control configuration for `openjev` and `human`, with `openjev` as the `ai-exhibition` profile default and explicit immutable proxy URL, timeout, pacing, and per-phase action-cap settings.
- [ ] 1.3 Add release and test guards that fail if an OpenJEV key or bearer token pattern appears in tracked files, generated browser assets, logs, or the release archive.
- [ ] 1.4 Add a separate immutable `ai-exhibition` release profile with versioned HTTPS proxy endpoint, contract version, origin allowlist, vendor declaration, and no runtime query/local-storage overrides; preserve the existing human profile unchanged.
- [ ] 1.5 Define typed bootstrap dependency injection for control mode, `SurvivorPolicy`, proxy transport, deterministic clock, and deferred test responses.

## 2. Legal command candidates and deterministic fallback

- [x] 2.1 Implement a pure legal Survivor command enumerator covering reachable moves, normal attacks, abilities, and `end-player-phase` with stable opaque candidate IDs.
- [x] 2.2 Add compact JSON-safe battle and candidate summaries plus a canonical decision-state fingerprint.
- [x] 2.3 Unit-test that every enumerated candidate is accepted by `dispatch`, illegal commands are absent, equivalent states produce stable IDs/fingerprints, and terminal or enemy phases produce no Survivor decision set.
- [x] 2.4 Implement the deterministic Survivor fallback with documented scoring, stable tie-breakers, a per-phase action cap, and guaranteed `end-player-phase` progress.
- [x] 2.5 Add headless tests showing equivalent fallback inputs choose identically and fallback-versus-Raider battles always terminate within the existing round limit.
- [x] 2.6 Refactor core validation primitives so candidate enumeration and `dispatch` share one legality source rather than duplicating movement, targeting, AP, ability, phase, or status rules.

## 3. Policy and OpenJEV client boundary

- [x] 3.1 Define the asynchronous `SurvivorPolicy` contract, normalized decision result, decision source, and bounded fallback-reason types.
- [x] 3.2 Implement the browser OpenJEV policy client against a project-owned proxy DTO, including timeout and `AbortSignal` support.
- [x] 3.3 Validate proxy responses against the current candidate map and reject malformed, unknown, or stale selections before they reach `dispatch`.
- [x] 3.4 Implement the resilient policy wrapper that invokes deterministic fallback for absent configuration, timeout, transport failure, non-success response, malformed payload, unknown candidate, stale response, or rejected dispatch.
- [x] 3.5 Add unit/contract tests for valid OpenJEV selection and every fallback path without using a live credential.
- [ ] 3.6 Implement and test the cause-specific transition table: obsolete responses ignore, blockers wait then freshly enumerate, and current-state failures invoke one fallback; late transport completion cannot regain ownership.

## 4. Secure proxy integration

- [x] 4.1 Define and document the bounded `/api/openjev/choose` request and response contract independently from the upstream SystemOne payload.
- [x] 4.2 Implement a deployable server/serverless proxy handler that validates shape and size, reads `OPENJEV_API_KEY` only from server-side secret storage, applies an upstream timeout, and calls `https://api.openjev.sh/v1/systemone`.
- [x] 4.3 Normalize upstream success, rate-limit, timeout, authentication, malformed-response, and unavailable-service outcomes without echoing authorization or raw sensitive error data.
- [x] 4.4 Add proxy contract tests with an injected fake upstream transport and tests proving authorization values never enter responses or logs.
- [x] 4.5 Document local development and Yandex-compatible HTTPS deployment setup, including the no-proxy deterministic fallback behavior and required CORS/content-security configuration.
- [ ] 4.6 Add strict method/schema/body/candidate limits, redirect/upstream allowlisting, connect/total timeouts, and normalized `Retry-After` behavior.
- [ ] 4.7 Add per-IP and pseudonymous-session token buckets, per-battle caps, upstream concurrency limits, global daily budget ceiling, circuit breaker, health probe, and emergency disable controls with deterministic tests.
- [ ] 4.8 Add allowlisted tactical-field serialization, privacy/vendor disclosure, pseudonymous short-retention rate-limit identifiers, and log/metric redaction tests.

## 5. Autoplay runtime coordination

- [ ] 5.1 Implement a Survivor autoplay coordinator that starts only during an active unblocked player phase and permits at most one in-flight decision.
- [ ] 5.2 Add battle epochs, state-fingerprint checks, and cancellation on pause, visibility loss, rules, advertisement, orientation block, replay, terminal result, mode change, or accepted command.
- [ ] 5.3 Submit selected commands only through `dispatch`, refresh candidates after every accepted state transition, and route rejected selections through fresh deterministic fallback.
- [ ] 5.4 Integrate autoplay with the existing presentation queue so each accepted action finishes animating before the next request and Raider events finish before Survivor autoplay resumes.
- [ ] 5.5 Enforce configurable pacing and a maximum number of decisions per player phase, then force `end-player-phase` to prevent loops and unbounded API usage.
- [ ] 5.6 Preserve the existing human interaction path when `human` mode is configured and suppress battle-board input while autoplay owns Survivor control.
- [ ] 5.7 Add an explicit presentation-idle runtime seam and require unlocked input, empty queues, no pending terminal state, no blockers, and displayed/committed state convergence before enumeration or request.
- [ ] 5.8 Add a presentation-clock abstraction with bounded `1×`, `2×`, and `4×` multipliers that scales only queued animation/delay/observation durations and applies changes at safe event boundaries.

## 6. Presentation and diagnostics

- [ ] 6.1 Add localized HUD states for OpenJEV deciding, OpenJEV action, deterministic fallback, paused autoplay, and unavailable proxy in Russian and English.
- [ ] 6.2 Keep global rules, pause/lifecycle, language, result, and replay controls available while automated board commands are disabled.
- [ ] 6.3 Emit JSON-safe decision diagnostics containing battle ID, round, state fingerprint, candidate ID, source, latency bucket, bounded fallback reason, and accepted event types.
- [ ] 6.4 Add localization completeness and diagnostics redaction tests that reject credentials, authorization headers, raw upstream errors, and private reasoning fields.
- [ ] 6.5 Create a separate localized six-step AI exhibition onboarding freeze for RU/EN and 640×360 that preserves ability teaching while explaining observation, policy/fallback status, pause/rules, and replay.
- [ ] 6.6 Define stable AI-specific analytics events without changing the existing human study funnel semantics.
- [ ] 6.7 Implement the versioned replay envelope and verify offline replay of accepted Survivor commands plus deterministic Raider phases against terminal state and event checksum.
- [ ] 6.8 Add localized touch-safe speed controls and labels, default `1×`, current-session persistence across replay, fresh-session reset, and minimum-readable phase/policy/result indicators at `4×`.

## 7. Acceptance, release, and default enablement

- [ ] 7.1 Add browser tests at desktop and 640×360 mobile landscape proving a default battle advances through Survivor and Raider actions without board input.
- [ ] 7.2 Add browser tests for pause/resume during a pending decision, stale late response rejection, fallback after proxy failure, terminal result, and clean replay with a new battle epoch.
- [ ] 7.3 Run and pass formatting, strict typecheck, full unit/contract/browser suites, production build, release packaging, archive validation, and dependency/security audit.
- [ ] 7.4 Inspect the generated bundle and release archive to prove no OpenJEV credential or bearer value is embedded.
- [ ] 7.5 Validate one staging battle through the real HTTPS proxy with a newly provisioned secret, recording only non-sensitive evidence of OpenJEV and fallback behavior.
- [ ] 7.6 Set `openjev` as the default Survivor control mode only after all fallback and acceptance gates pass, while retaining the documented `human` rollback override.
- [ ] 7.7 Run strict validation for `add-openjev-survivor-autoplay` and re-run the existing prototype and release OpenSpec validations to confirm no regression in their contracts.
- [ ] 7.8 Qualify exact AI exhibition artifact connectivity to the declared proxy under production CSP/origin rules, plus fail-fast fallback when health, circuit, quota, or budget gates reject live service.
- [ ] 7.9 Re-run the accepted human browser flow explicitly with human bootstrap and prove onboarding, winning path, analytics semantics, and release package remain unchanged.
- [ ] 7.10 Add deterministic unit/browser coverage proving identical command/event/state/replay outcomes at `1×`, `2×`, and `4×`, safe mid-animation switching, pause/resume without duplicates, and usable controls at desktop and 640×360.
