## Why

The playable battle is functional, but it is not yet safe to submit to Yandex Games: an independent review found three unresolved specification gaps, the build has no publication-required monetization, and no verified release archive, catalog package, or draft-moderation evidence exists. Yandex requires correct SDK integration, monetization, a finished experience, a compliant ZIP archive, and testing in the developer draft before moderation.[1][2][3][4]

## What Changes

- Close the three accepted playable-review blockers: role-specific ability onboarding, correctly timed `game_loaded`, and a real facilitator-help host/operator interface.
- Integrate the official Yandex Games SDK lifecycle in production while preserving local fallback for development and automated tests.
- Add one minimal fullscreen advertisement only at the post-battle logical pause; never show ads during a battle or use purchases/rewarded power in this release.
- Define release-safe pause/resume, audio, active-time, and analytics behavior around advertisements and platform lifecycle events.
- Define the no-progression save policy for this release and persist only user-facing local preferences that actually exist.
- Produce a byte-reproducible production ZIP with normalized timestamps, modes, and entry order; `index.html` at the archive root; ASCII-only paths; an uncompressed size below 100 MB; and a manifest/checksum report.
- Prepare frozen Russian and English catalog copy, technical settings, icon, cover, and screenshots that match the shipped battle.
- Qualify the uploaded Yandex draft with the debug panel and a declared desktop/mobile browser matrix before moderation.
- Keep public catalog release behind two independent gates: release qualification and the previously specified 15-session product study. Draft upload and private testing do not imply product GO.

## Capabilities

### New Capabilities

- `release-quality-gate`: Closes accepted review blockers and defines the verified release candidate, freeze, and regression gate.
- `yandex-release-integration`: Defines SDK loading, language, lifecycle, Game Ready, post-battle advertising, fallback, and save-policy behavior.
- `yandex-release-package`: Defines the production ZIP, release manifest, catalog metadata, localization, and promotional assets.
- `yandex-moderation-readiness`: Defines draft/debug testing, platform coverage, evidence, submission controls, and the boundary between private draft testing and public release.

### Modified Capabilities

None. The playable change remains an immutable baseline until this release change is applied; this change adds release-layer contracts without expanding the battle, progression, economy, PvP, or content scope.

## Impact

- Code: `src/main.ts`, `src/presentation/runtime.ts`, `src/localization/`, `src/platform/`, post-battle result flow, tests, and release scripts.
- Tests: unit/contract tests, Playwright browser flows, SDK mocks, advertisement lifecycle tests, archive validation, and draft qualification evidence.
- Build: `dist/`, a generated Yandex ZIP, release manifest, checksums, and frozen build version.
- Product operations: Yandex developer account/RSA setup, draft fields, assets, debug-panel checks, moderation submission, and publication mode.
- Explicitly excluded: campaign, persistent progression, cloud saves, purchases, rewarded gameplay advantages, mid-battle ads, PvP, multiple worlds, and public launch before the product-study verdict.

## Sources

[1] https://yandex.ru/dev/games/doc/ru/console/add-new-game — Загрузка игры
[2] https://yandex.ru/dev/games/doc/ru/concepts/requirements — Требования к игре
[3] https://yandex.ru/dev/games/doc/ru/concepts/moderation — Модерация
[4] https://yandex.ru/dev/games/doc/ru/sdk/sdk-about — Подключение SDK
