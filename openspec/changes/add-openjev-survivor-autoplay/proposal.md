## Why

The current prototype requires a human to control the Survivor team, which prevents unattended AI-vs-AI demonstrations and automated observation of complete battles. OpenJEV can act as the Survivor decision policy while the existing deterministic Raider policy remains unchanged, creating a visible AI-vs-AI mode without moving combat legality or state mutation outside the trusted battle engine.

## What Changes

- Enable Survivor autoplay by default after onboarding so OpenJEV chooses actions instead of waiting for human input.
- Generate the complete set of legal Survivor commands locally and expose only opaque candidate IDs plus tactical summaries to the remote policy.
- Execute a response only when it maps to a currently legal command and is accepted by the existing `dispatch` boundary.
- Route OpenJEV requests through a server-side proxy so API credentials never enter the browser bundle, repository, analytics, or battle state.
- Add bounded request timeouts, cancellation on pause/replay/state change, and a deterministic local fallback that guarantees the battle continues when OpenJEV is unavailable or returns an invalid answer.
- Preserve the existing deterministic Raider phase and core combat rules.
- Record policy decisions and fallback reasons in JSON-safe diagnostics so an AI-vs-AI battle can be understood and reproduced from its accepted command log.
- Provide an explicit runtime/configuration override for human control during development and accessibility testing, while keeping OpenJEV autoplay as the default configured mode.

## Capabilities

### New Capabilities

- `openjev-survivor-autoplay`: Automatic Survivor turns driven by validated OpenJEV choices, secure proxy integration, lifecycle handling, deterministic fallback, and observable AI-vs-AI execution.

### Modified Capabilities

None. The battle rules and Raider activation contract remain unchanged; the new capability controls how legal Survivor commands are selected and submitted.

## Impact

- Affects the battle runtime/presentation coordinator, command-selection helpers, platform lifecycle integration, configuration, diagnostics, and browser tests.
- Adds a deployable server-side or serverless proxy contract for `https://api.openjev.sh/v1/systemone` and a secret `OPENJEV_API_KEY` available only to that proxy.
- Requires a legal-command enumerator for Survivor actions and a deterministic local Survivor fallback policy.
- Requires release behavior for missing proxy configuration, network failure, malformed responses, stale decisions, and API rate limits.
- The API key disclosed during exploration must be revoked and must not be reused for implementation or testing.
