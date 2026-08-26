## Why

The full “Tactics Arena: Worlds” concept mixes a deep combat simulator, RPG progression, multiple settings, PvP, advertising, and payments before its core appeal has been tested. Current Yandex Games signals justify testing a mobile-friendly midcore tactics experience, but public catalog data cannot establish demand; a small instrumented battle is the cheapest honest validation step.

## What Changes

- Build a Phaser 3 + TypeScript + Vite prototype centered on one 5–8 minute squad battle.
- Implement an 8×6 grid with three player units, three AI units, team turns, AP, movement, ranged attacks, one ability per player unit, half-cover, range, and line-of-sight.
- Use a frozen post-apocalyptic scenario with fully deterministic combat and no PRNG so command sequences and acceptance tests are reproducible.
- Add responsive landscape UI down to 640×360 CSS pixels with equivalent pointer/touch interaction, plus Russian and English strings.
- Add a platform boundary for Yandex SDK initialization, pause/resume, and analytics events with a safe local fallback.
- Instrument comprehension diagnostics and replay intent with an exportable local session log.
- Exclude progression, multiple worlds, PvP, payments, and mid-battle advertising from this change.
- Record the market rationale, frozen 15-person cohort protocol, exhaustive GO/PIVOT/NOT-GO matrix, and limits of inference in `docs/research/yandex-market-discovery.md`.

## Capabilities

### New Capabilities

- `grid-tactics-battle`: Deterministic player-versus-AI squad battle with AP-based movement, targeting, cover, line-of-sight, victory, defeat, and replay.
- `battle-presentation`: Responsive mouse/touch battle interface that makes legal actions, AP costs, current phase, outcomes, and onboarding legible in Russian and English.
- `yandex-prototype-integration`: Yandex SDK boundary with local fallback, lifecycle pause/resume behavior, and prototype analytics event emission.

### Modified Capabilities

- None.

## Impact

- **Code:** new Phaser/TypeScript application under `src/`, static assets under `public/`, unit tests for pure battle rules, and browser-level smoke coverage for the critical battle loop.
- **Dependencies:** `phaser`, `typescript`, `vite`, and a lightweight test runner; no backend or account system.
- **Platform:** browser desktop and mobile landscape; Yandex Games adapter remains non-blocking during localhost development.
- **Product:** the playable build and the observed 15-person study are separate gates. A passing study validates only readiness for a larger unattended audience test—not retention, economy, monetization, PvP, content production, or the multi-world premise.
- **Research:** `docs/research/yandex-market-discovery.md` is the evidence and experiment brief for this change.
