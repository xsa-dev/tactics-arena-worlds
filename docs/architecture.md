# Prototype architecture

The UI in `src/presentation` translates pointer/touch intent into serializable
commands. `src/core` validates and resolves each command synchronously into a new
battle snapshot plus ordered domain events. Presentation renders the snapshot and
plays those events without owning rules. `src/platform` supplies locale, lifecycle,
analytics, and export services; `src/localization` maps stable keys to Russian or
English strings. Platform pauses suspend input, event presentation, audio, and the
active clock, but never mutate or re-run core state.

`UI intent -> BattleCommand -> core.dispatch -> BattleState + BattleEvent[] -> Phaser render/queue`

Release readiness is a five-part barrier (platform, first scene render, DOM,
overlays, and input/orientation wiring). One gameplay coordinator owns all direct
GameplayAPI intent and derives it from startup, onboarding, Rules, result, ad,
platform, focus, and visibility blockers. The player-invisible
`window.__TACTICS_OPERATOR__` API addresses immutable observation records by
session ID; replay finalizes the old record before creating new session and
battle IDs.
