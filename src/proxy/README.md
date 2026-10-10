# OpenJEV proxy contract

The browser sends a bounded `POST /v1/openjev/choose` JSON request containing `contractVersion: "v1"`, a compact tactical `state`, a `stateFingerprint`, and a finite `candidates` array. The proxy returns either `{ "ok": true, "candidateId": "..." }` or a normalized error `{ "ok": false, "code": "..." }` with an optional bounded `retryAfterMs`.

Local development and tests inject `fetchImpl` and `env.OPENJEV_API_KEY` into `createOpenJevProxyHandler`. No browser build or local-storage/query-string setting supplies a credential. When the proxy URL is absent or unavailable, `ResilientSurvivorPolicy` uses deterministic fallback and the battle remains playable.

For Yandex-compatible deployment, expose the handler from an operator-managed HTTPS origin, allow only the declared game origins with explicit CORS, and permit the versioned proxy path in the game's Content-Security-Policy `connect-src`. Store `OPENJEV_API_KEY` in server-side secret storage only. The handler forwards only normalized project DTOs to `https://api.openjev.sh/v1/systemone`, applies an upstream timeout, and never returns authorization material or raw upstream errors.
