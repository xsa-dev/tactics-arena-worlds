## Context

The battle domain already exposes serializable `BattleState`, a closed `BattleCommand` union, pure command validation through `dispatch`, and a deterministic Raider phase. The presentation currently waits for a human to issue Survivor commands. The target behavior is an unattended battle in which OpenJEV selects Survivor commands while the existing Raider algorithm resolves enemy phases.

The shipped browser bundle is static and cannot safely contain `OPENJEV_API_KEY`. Network decisions are asynchronous while battle commands, replay, pause, visibility, and result transitions can invalidate an in-flight answer. The experience must therefore remain playable and terminable without network access, and all remote selections must be treated as untrusted suggestions.

## Goals / Non-Goals

**Goals:**

- Make OpenJEV Survivor autoplay the default configured control mode.
- Keep command legality, state mutation, damage, pathing, AP, abilities, and outcomes entirely inside `src/core`.
- Run complete AI-vs-AI battles without human board interaction after onboarding.
- Keep the OpenJEV credential outside browser assets and repository content.
- Guarantee forward progress through timeout, invalid-answer, unavailable-proxy, and lifecycle cases.
- Preserve useful visual pacing and expose enough diagnostics to understand each accepted decision.
- Retain a human-control override for development and accessibility validation.

**Non-Goals:**

- Replacing or changing the deterministic Raider policy.
- Allowing OpenJEV to invent commands, mutate state, calculate damage, or bypass `dispatch`.
- Adding progression, matchmaking, cloud persistence, or a general-purpose backend.
- Guaranteeing bit-identical outcomes when live OpenJEV decisions are requested again.
- Shipping the disclosed API key or treating a client-side environment variable as secret.

## Decisions

### 1. Enumerate legal commands locally and let OpenJEV select only a candidate ID

A pure `enumerateLegalSurvivorCommands(state)` function will produce every currently accepted `BattleCommand`, including legal moves, normal attacks, abilities, and `end-player-phase`. Each candidate receives a stable opaque ID and a compact tactical summary derived from the same state snapshot. The remote request contains the summarized snapshot and a `choice` question whose options correspond exactly to those IDs.

The response is accepted only if its ID exists in the candidate map for the still-current snapshot. The runtime then submits the mapped command through `dispatch`; a rejected command is treated as policy failure and triggers fallback selection against a freshly enumerated state.

**Alternative considered:** ask the model to emit arbitrary JSON commands. This creates parsing, hallucination, coordinate, and legality failures without improving the tactical experiment.

### 2. Use a policy boundary with OpenJEV and deterministic implementations

The runtime will depend on an asynchronous `SurvivorPolicy.choose(state, candidates, signal)` interface. `OpenJevSurvivorPolicy` calls the proxy. `DeterministicSurvivorPolicy` uses stable tactical scoring and tie-breakers and never performs network I/O. A resilient wrapper selects OpenJEV first and invokes the deterministic policy on missing configuration, timeout, transport failure, non-success status, malformed payload, unknown candidate, stale answer, or rejected dispatch.

The deterministic policy SHALL always select from the supplied candidates and SHALL eventually select `end-player-phase`, preventing an infinite action loop.

**Alternative considered:** stop the battle and show an error when OpenJEV is unavailable. That would make the default experience depend on an optional external service and would fail on the current static deployment.

### 3. Put credentials behind a narrow versioned HTTPS proxy contract

The browser will call the immutable HTTPS endpoint declared by the `ai-exhibition` release profile at the versioned path `/v1/openjev/choose`. The proxy reads `OPENJEV_API_KEY` from server-side secret storage and calls OpenJEV SystemOne. Browser and proxy communicate through project-owned DTOs rather than exposing the upstream payload as an application contract. The proxy SHALL reject oversized or structurally invalid requests, apply an upstream timeout, return normalized error codes, and never echo or log authorization headers.

Local builds and the preserved human profile do not call the proxy. Development and tests may inject a local transport through typed bootstrap dependencies. Deployment of the operator-managed proxy is independently qualified so static Yandex packaging remains reproducible; live OpenJEV behavior requires the exact declared HTTPS endpoint to pass origin/CSP and health qualification.

**Alternative considered:** use `import.meta.env.VITE_OPENJEV_API_KEY`. Vite embeds `VITE_` values into public JavaScript and therefore cannot protect a credential.

### 4. Guard asynchronous decisions with battle epochs and state fingerprints

Every battle/replay owns an epoch. Each policy request captures the epoch and a canonical fingerprint of the decision-relevant state. Pause, visibility loss, result, replay, control-mode change, or a newly accepted command aborts the active request. A response is ignored unless its epoch and fingerprint still match the current battle.

Only one Survivor decision request may be active at a time. The next request starts after the accepted command's presentation completes and a short configurable pacing delay. When the selected command is `end-player-phase`, the existing synchronous Raider resolution remains authoritative and its events are presented before the next Survivor request.

**Alternative considered:** queue multiple predicted commands. Later commands become unsafe as soon as damage, defeat, movement, or phase state changes.

### 5. Default to autoplay but retain an explicit human override

The typed runtime configuration selects `openjev` for the `ai-exhibition` profile and `human` for the preserved human profile. Development and browser tests can inject either mode through bootstrap dependencies. Human board input is disabled while autoplay owns the Survivor phase, except for global lifecycle and UI controls such as rules, pause, language, and replay. The HUD visibly labels the active policy and whether a decision used OpenJEV or fallback.

**Alternative considered:** remove human controls entirely. Keeping the override reduces rollback risk and preserves the current acceptance path.

### 6. Record accepted decisions, not private reasoning

Diagnostics will record battle ID, round, state fingerprint, selected candidate ID, source (`openjev` or `fallback`), latency bucket, fallback reason, and the resulting accepted event types. They will not record API keys, authorization headers, raw upstream traces, or hidden model reasoning. The accepted command log is sufficient to replay a completed battle through the deterministic engine.

### 7. Use one legality source and a presentation-idle boundary

Candidate enumeration SHALL be implemented in `src/core` from the same validation primitives used by `dispatch`; presentation code SHALL NOT duplicate AP, path, target, ability, or phase rules. `dispatch` remains the only state-mutation boundary. Because `end-player-phase` currently commits the complete Raider resolution synchronously while `displayState` presents queued events later, the autoplay coordinator SHALL request another decision only after runtime explicitly reports presentation idle: no lock, no pending terminal transition, no queued event, no active blocker, and displayed state equal to committed session state.

The runtime will expose a narrow `whenPresentationIdle`/subscription seam rather than polling Phaser internals. Tests will be able to drive that seam with a deterministic clock.

### 8. Define cancellation and fallback ownership by cause

The coordinator uses the following transition rules:

- A response from an obsolete battle epoch, replay, terminal battle, changed phase, or already-advanced fingerprint is discarded with no fallback.
- Lifecycle blocking aborts or invalidates the request, starts no fallback while blocked, and performs fresh enumeration after presentation becomes idle and gameplay is unblocked.
- Timeout, transport failure, normalized upstream failure, malformed response, unknown candidate, or dispatch rejection for the still-current unblocked fingerprint invokes one deterministic fallback decision.
- Aborted or stale requests do not consume the accepted-action cap. Attempted live requests do consume the per-battle remote-request budget even if their transport settles late.
- Logical ownership ends immediately on abort; a late physical transport completion cannot reacquire ownership. At most one logical request exists for an epoch/fingerprint, and late completions are ignored.

### 9. Fix the production proxy and release-profile contract

Implementation will provide a provider-neutral Node-compatible edge/serverless handler deployed by the operator as a separate HTTPS service. Its public contract is versioned at `/v1/openjev/choose`. The `ai-exhibition` release profile MUST contain an immutable HTTPS endpoint, contract version, allowed game origins, and external-dependency declaration. The production artifact MUST NOT accept query-string or local-storage switches that alter endpoint or control mode. Local development injects configuration through the bootstrap factory; release configuration is compile-time validated.

The proxy permits only `POST` with JSON, enforces an exact schema, caps request bytes and candidate count, validates candidate identifiers, rejects redirects and arbitrary upstream URLs, and applies both connect and total timeouts. CORS is an allowlist and never treated as authentication.

### 10. Bound anonymous abuse, cost, and outage amplification

Because a static game cannot hold a client credential, the public proxy is deliberately anonymous but bounded. It applies token buckets by normalized source IP and opaque installation/session token, caps requests per battle, limits concurrent upstream requests, and enforces a global daily request/spend ceiling. It returns only normalized codes with `Retry-After` where relevant. A circuit breaker opens after configured upstream failure/rate-limit thresholds, serves immediate fallback signals during cooldown, and closes only after bounded health probes. No browser retry loop is allowed; the next live attempt follows the circuit policy rather than every gameplay action.

Operational configuration, thresholds, secret rotation ownership, health endpoint, and emergency disable switch are documented and release-qualified. The browser always remains functional through deterministic fallback.

### 11. Minimize vendor data and preserve the frozen human study

The OpenJEV payload contains only map dimensions/terrain identifiers, unit identifiers and combat attributes, phase/round, and legal candidate summaries. It excludes tester ID, session ID, platform player identity, locale-derived personal data, analytics history, free text, and IP address. The proxy may use IP transiently for rate limiting but SHALL not place raw IPs or request payloads in application logs; short-lived keyed hashes and aggregate counters are permitted with documented retention. Product privacy copy and release metadata disclose the external AI processor and fallback behavior.

Autoplay ships in a separate `ai-exhibition` profile with its own onboarding freeze and analytics interpretation. The accepted human study/release profile, six-step human-control onboarding, frozen winning-path browser flow, and study metrics remain unchanged. The autoplay six-step onboarding preserves required ability names/effects but teaches observation, AI/fallback status, pause/rules, and replay rather than unusable board gestures.

### 12. Make configuration, testing, analytics, and replay executable

`src/main.ts` will construct runtime dependencies from a typed bootstrap object. Production release profiles provide immutable mode/proxy values; unit and browser tests may inject a `SurvivorPolicy`, proxy transport, deterministic clock, and deferred responses without runtime query switches. Existing browser flows explicitly bootstrap `human`; new AI exhibition flows bootstrap `openjev` with deterministic valid, delayed, malformed, rate-limited, and failed transports.

Accepted-command diagnostics form a replay envelope containing schema version, build version, scenario identifier/hash, initial battle state hash, ordered accepted Survivor commands, decision source, and resulting event-type checksum. Replaying uses recorded accepted commands and the deterministic Raider engine without contacting OpenJEV. Stable analytics events distinguish `ai_decision_requested`, `ai_decision_accepted`, `ai_fallback_used`, and `ai_circuit_state_changed`; rendering does not emit them, and existing human study funnel semantics are not reinterpreted.

### 13. Separate observable presentation speed from simulation and policy timing

The AI exhibition starts at `1×`, tuned so movement paths, attacks, damage/heal feedback, phase changes, policy source, and terminal results remain readable without unnecessary dead time. The HUD exposes touch-safe `1×`, `2×`, and `4×` controls. A speed change affects only presentation delays, tweens, and the post-action observation gap for events not yet started. It SHALL NOT change battle state, command order, policy timeout, proxy retry/circuit timing, request or action budgets, analytics timestamps, or replay-envelope content.

The next policy decision still waits for presentation idle at every speed. Changing speed during an active tween may apply at the next safe event boundary rather than seeking or skipping the current event. Pause and lifecycle blockers stop presentation and autoplay regardless of speed; resume continues at the selected speed without duplicating or dropping events. Result and replay controls remain readable and are never auto-dismissed. The selected speed lasts for the current browser session and resets to `1×` for a new session; it is presentation preference, not a release-mode override.

Tests use the deterministic presentation clock to assert ordering and state equality across all speeds rather than wall-clock sleeps.

## Risks / Trade-offs

- **[OpenJEV latency makes turns feel stalled]** → Show a deciding indicator, impose a short timeout, abort stale requests, and fall back locally.
- **[Static Yandex hosting cannot keep a secret]** → Require a separately hosted HTTPS proxy for live OpenJEV and preserve deterministic fallback when it is absent.
- **[Remote policy quality is inconsistent]** → Restrict selection to legal candidates, retain local tactical scoring, and log source/outcome metrics.
- **[Repeated API calls increase cost or hit rate limits]** → Make one request per accepted Survivor command, cap actions per player phase, cache only exact state fingerprints when safe, and fall back on rate limits.
- **[A policy repeatedly avoids ending the phase]** → Enforce a maximum decision count per player phase and then submit `end-player-phase`.
- **[Replay is not identical across new live calls]** → Persist the accepted command log for diagnostics; exact replay uses recorded commands rather than re-querying OpenJEV.
- **[Previously disclosed credential is abused]** → Revoke it before implementation and provision a new secret only in the proxy environment.
- **[Anonymous clients abuse the public proxy]** → Apply layered token buckets, concurrency/request caps, a global budget breaker, origin checks, and emergency disable while treating CORS only as browser containment.
- **[Autoplay invalidates the frozen human cohort]** → Ship it as a separate qualified `ai-exhibition` profile and leave the accepted human profile and analytics cohort unchanged.
- **[Committed state advances ahead of animation]** → Gate every new request on the explicit presentation-idle seam and fingerprint the displayed/committed snapshot.
- **[Fast playback hides important tactical feedback]** → Keep `1×` as the default, provide only bounded `2×`/`4×` options, preserve event order and minimum readable phase/result indicators, and test at desktop and 640×360.

## Migration Plan

1. Revoke the disclosed OpenJEV credential and prepare a new server-side secret outside the repository.
2. Add legal-command enumeration and deterministic Survivor policy with unit tests, without changing the default mode yet.
3. Add the policy interface, autoplay coordinator, lifecycle cancellation, diagnostics, and browser tests behind a development flag.
4. Implement and contract-test the versioned HTTPS proxy, abuse controls, circuit breaker, privacy redaction, and injected upstream transport with no real credential in CI.
5. Add the separate `ai-exhibition` release profile, mode-aware onboarding, typed bootstrap injection, presentation-idle seam, analytics, and replay envelope.
6. Validate human profile, fallback AI-vs-AI, live proxy staging, pause/resume, replay, mobile layout, terminal behavior, budget breaker, and exact release-artifact endpoint/CSP behavior.
7. Make `openjev` the default only for the qualified `ai-exhibition` profile; retain the existing human profile as rollback and frozen-study behavior.

Rollback sets the runtime mode back to `human` or disables the proxy configuration. The core battle state and saved-data format require no migration.

## Open Questions

- Which operator account and infrastructure repository own deployment of the provider-neutral HTTPS handler?
- What numeric timeout, rate, concurrency, per-battle, and daily budget values are approved after staging load/cost measurement?
- Should replay envelopes remain local diagnostics or be included in a separately consented export?
