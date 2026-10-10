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

### 3. Put credentials behind a narrow same-origin proxy contract

The browser will call a configurable same-origin endpoint such as `/api/openjev/choose`. The proxy reads `OPENJEV_API_KEY` from server-side secret storage and calls OpenJEV SystemOne. The browser request and response use project-owned DTOs rather than exposing the upstream payload as an application contract. The proxy SHALL reject oversized or structurally invalid requests, apply an upstream timeout, return normalized error codes, and never echo or log authorization headers.

Local/static builds with no endpoint use deterministic fallback immediately. Deployment of the proxy is independently configurable so Yandex static packaging remains possible, although live OpenJEV behavior requires a reachable HTTPS proxy permitted by the host platform.

**Alternative considered:** use `import.meta.env.VITE_OPENJEV_API_KEY`. Vite embeds `VITE_` values into public JavaScript and therefore cannot protect a credential.

### 4. Guard asynchronous decisions with battle epochs and state fingerprints

Every battle/replay owns an epoch. Each policy request captures the epoch and a canonical fingerprint of the decision-relevant state. Pause, visibility loss, result, replay, control-mode change, or a newly accepted command aborts the active request. A response is ignored unless its epoch and fingerprint still match the current battle.

Only one Survivor decision request may be active at a time. The next request starts after the accepted command's presentation completes and a short configurable pacing delay. When the selected command is `end-player-phase`, the existing synchronous Raider resolution remains authoritative and its events are presented before the next Survivor request.

**Alternative considered:** queue multiple predicted commands. Later commands become unsafe as soon as damage, defeat, movement, or phase state changes.

### 5. Default to autoplay but retain an explicit human override

A typed runtime configuration selects `openjev` by default and permits `human` for development, browser tests, and accessibility inspection. Human input is disabled while autoplay owns the Survivor phase, except for global lifecycle and UI controls such as rules, pause, language, and replay. The HUD visibly labels the active policy and whether a decision used OpenJEV or fallback.

**Alternative considered:** remove human controls entirely. Keeping the override reduces rollback risk and preserves the current acceptance path.

### 6. Record accepted decisions, not private reasoning

Diagnostics will record battle ID, round, state fingerprint, selected candidate ID, source (`openjev` or `fallback`), latency bucket, fallback reason, and the resulting accepted event types. They will not record API keys, authorization headers, raw upstream traces, or hidden model reasoning. The accepted command log is sufficient to replay a completed battle through the deterministic engine.

## Risks / Trade-offs

- **[OpenJEV latency makes turns feel stalled]** → Show a deciding indicator, impose a short timeout, abort stale requests, and fall back locally.
- **[Static Yandex hosting cannot keep a secret]** → Require a separately hosted HTTPS proxy for live OpenJEV and preserve deterministic fallback when it is absent.
- **[Remote policy quality is inconsistent]** → Restrict selection to legal candidates, retain local tactical scoring, and log source/outcome metrics.
- **[Repeated API calls increase cost or hit rate limits]** → Make one request per accepted Survivor command, cap actions per player phase, cache only exact state fingerprints when safe, and fall back on rate limits.
- **[A policy repeatedly avoids ending the phase]** → Enforce a maximum decision count per player phase and then submit `end-player-phase`.
- **[Replay is not identical across new live calls]** → Persist the accepted command log for diagnostics; exact replay uses recorded commands rather than re-querying OpenJEV.
- **[Previously disclosed credential is abused]** → Revoke it before implementation and provision a new secret only in the proxy environment.

## Migration Plan

1. Revoke the disclosed OpenJEV credential and prepare a new server-side secret outside the repository.
2. Add legal-command enumeration and deterministic Survivor policy with unit tests, without changing the default mode yet.
3. Add the policy interface, autoplay coordinator, lifecycle cancellation, diagnostics, and browser tests behind a development flag.
4. Implement and contract-test the same-origin proxy adapter using injected upstream transport and no real credential in CI.
5. Validate human mode, fallback AI-vs-AI, live proxy staging, pause/resume, replay, mobile layout, and terminal battle behavior.
6. Change the configured default to `openjev` only after fallback and browser acceptance paths pass.

Rollback sets the runtime mode back to `human` or disables the proxy configuration. The core battle state and saved-data format require no migration.

## Open Questions

- Which HTTPS/serverless host will serve the proxy for the Yandex release, and what outbound/CORS constraints apply?
- What timeout, per-battle request cap, and spend ceiling should production use?
- Should the product expose the human/openjev toggle to players, or keep it as build/runtime configuration only?
- Should exact command logs remain local diagnostics or be included in an opt-in analytics export?
