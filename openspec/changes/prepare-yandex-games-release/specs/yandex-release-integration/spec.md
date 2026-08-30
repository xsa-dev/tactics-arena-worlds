## ADDED Requirements

### Requirement: Official Yandex SDK is loaded and initialized
The system SHALL load the archive-hosted Yandex Games SDK from the relative `/sdk.js` path before `YaGames.init()`, SHALL use SDK language and lifecycle APIs when available, and SHALL retain a deterministic local/test fallback.[2][4]

#### Scenario: Yandex-hosted SDK is available
- **WHEN** `/sdk.js` loads and `YaGames.init()` resolves in a draft or catalog environment
- **THEN** the Yandex adapter becomes active, reports `platformKind=yandex`, and exposes the normalized SDK locale

#### Scenario: Local development has no SDK
- **WHEN** the game runs on localhost or in an automated browser without `YaGames`
- **THEN** it starts through `LocalPlatformService`, records `platformKind=local` and a fallback reason, and never attempts advertising or purchases

#### Scenario: Catalog qualification uses fallback
- **WHEN** a `catalog-release` draft reaches gameplay with any SDK fallback reason
- **THEN** draft qualification fails even if the battle remains locally playable

### Requirement: Platform language controls release localization
The system SHALL normalize `ysdk.environment.i18n.lang` to `ru` for Russian variants and `en` for all other unsupported variants. A query-language override SHALL be available only in local/test tooling and SHALL not override the SDK in a release profile.

#### Scenario: Russian SDK locale is received
- **WHEN** the SDK reports `ru`, `ru-RU`, or another Russian locale variant
- **THEN** all gameplay, onboarding, result, rotate, error, and ad-related UI uses the Russian catalog

#### Scenario: Unsupported SDK locale is received
- **WHEN** the SDK reports a locale without a shipped catalog
- **THEN** the entire UI uses the English fallback and emits no missing-key placeholder

#### Scenario: Release URL contains a language query
- **WHEN** a release-profile URL contains `?lang=` different from the SDK locale
- **THEN** the SDK locale wins and the attempted override is ignored

### Requirement: Gameplay lifecycle pauses exactly once
The system SHALL route Yandex pause/resume, focus/visibility, and advertisement callbacks through one source-aware lifecycle coordinator that controls input, presentation queue, audio, and active-duration timing without rolling back or replaying core commands. A resume from one source MUST NOT clear another active pause source.

#### Scenario: Pause is duplicated
- **WHEN** both `game_api_pause` and page visibility loss occur for the same interruption
- **THEN** the system enters one paused state, stops input/audio/timing once, and does not double-accumulate active duration

#### Scenario: Resume is duplicated
- **WHEN** focus, visibility, and `game_api_resume` signals arrive after one interruption
- **THEN** the system resumes once and no domain or analytics event is reapplied

#### Scenario: Interruption occurs during enemy presentation
- **WHEN** the platform pauses while enemy events remain queued
- **THEN** core final state stays committed, presentation stops at its current queue position, and resume continues with the next event exactly once

### Requirement: GameplayAPI ownership and timing are deterministic
One application gameplay coordinator SHALL own all direct `GameplayAPI.start()` and `GameplayAPI.stop()` calls. SDK `game_api_pause` and `game_api_resume` handlers SHALL update the platform pause source and runtime state but MUST NOT directly call GameplayAPI because the platform synchronizes those events with GameplayAPI.[7][8]

#### Scenario: Initial onboarding is visible
- **WHEN** Game Ready has fired but onboarding remains open
- **THEN** measured battle time and `battle_started` have not begun and the application does not call `GameplayAPI.start()`

#### Scenario: Startup advertisement occurs
- **WHEN** `game_api_pause` occurs during the 1000 ms quiet window after Game Ready
- **THEN** the pending battle start is cancelled, input/time remain stopped, and the first `battle_started` plus one `GameplayAPI.start()` can occur only after `game_api_resume` and onboarding dismissal

#### Scenario: No startup pause occurs
- **WHEN** onboarding is dismissed and the 1000 ms post-Ready quiet window completes without `game_api_pause`
- **THEN** the coordinator emits `battle_started`, starts active duration, enables input, and calls `GameplayAPI.start()` once

#### Scenario: Rules open and close during active battle
- **WHEN** Rules opens and later closes
- **THEN** the coordinator calls `GameplayAPI.stop()` once on the transition to blocked and calls `start()` once on the transition to unblocked only when no platform/ad/result blocker remains

#### Scenario: Battle reaches terminal result
- **WHEN** victory or defeat is committed
- **THEN** the coordinator calls `GameplayAPI.stop()` once and the result screen remains non-gameplay until a new replay battle is actually unblocked

#### Scenario: Platform pause overlaps an internal blocker
- **WHEN** platform pause/resume occurs while Rules, result, onboarding, or ad blocker is active
- **THEN** SDK events do not cause a direct application GameplayAPI call and resume cannot mark gameplay active until every blocker is clear

### Requirement: Startup platform advertising is separated from measured battle
The game SHALL accept that Yandex may automatically show fullscreen advertising after Game Ready and SHALL handle it through `game_api_pause` and `game_api_resume`; the prohibition in this change applies only to game-initiated advertising requests.[7]

#### Scenario: Platform controls startup advertising
- **WHEN** Yandex shows startup advertising without game callbacks
- **THEN** runtime input/audio/timing remain paused through SDK lifecycle events and no measured battle starts until the startup-settling rules pass

### Requirement: Fullscreen advertising occurs only after a battle
The `catalog-release` SHALL initiate at most one Yandex fullscreen-advertisement request for each terminal battle, only after `battle_finished` and only at the post-battle logical pause. Game code MUST never request advertising during an active battle; platform-controlled startup advertising is handled separately.[2][7]

#### Scenario: Battle reaches victory or defeat
- **WHEN** a catalog-release battle emits its terminal result
- **THEN** the result state is committed and the advertising service may make one fullscreen request before a new battle starts

#### Scenario: Player is mid-battle
- **WHEN** any player/enemy phase, onboarding, rules overlay, pause, or nonterminal state is active
- **THEN** fullscreen and rewarded advertising calls are forbidden

#### Scenario: Replay is activated after ad close
- **WHEN** the post-battle ad closes and the player activates replay
- **THEN** exactly one new battle ID is created and the previous battle never requests another ad

### Requirement: Advertising failure never blocks replay
The result screen and replay control SHALL recover from unavailable inventory, SDK absence, callback error, timeout, or a close callback indicating that no ad was shown. Every request SHALL have a unique token; `onError` records a candidate and waits for `onClose` or timeout; the first terminal arbitration wins and all duplicate/late callbacks for a completed or stale token are ignored.[6]

#### Scenario: Fullscreen advertisement opens and closes
- **WHEN** Yandex calls open and close callbacks
- **THEN** input/audio/timing are paused during the ad, resumed once on close, and the result/replay UI remains usable

#### Scenario: Advertisement errors or times out
- **WHEN** the SDK reports an error or no terminal callback arrives within the configured timeout
- **THEN** `onError` alone remains pending; `onClose(false)` after error resolves `error`; timeout resolves `error` if an error candidate exists and otherwise `timeout`; the service returns to idle and enables result/replay without retrying

#### Scenario: Close reports a shown advertisement after an error callback
- **WHEN** `onError` is followed by `onClose(true)` for the same request token
- **THEN** terminal outcome is `shown`, exactly one `ad_finished` is emitted, and pause is released once

#### Scenario: Close reports no advertisement without an error
- **WHEN** `onClose(false)` is the first terminal callback for the current request token
- **THEN** terminal outcome is `not_shown`, exactly one `ad_finished` is emitted, and pause is released once

#### Scenario: Callback arrives after terminal arbitration
- **WHEN** duplicate close/error/open callbacks or any callback for an expired token arrives after terminal outcome
- **THEN** it is ignored without analytics, state, timer, input, audio, or resume changes

#### Scenario: Local fallback reaches terminal state
- **WHEN** a battle finishes without a Yandex advertising API
- **THEN** no network/ad call is attempted and replay remains immediately available

### Requirement: Advertising analytics are stable and non-duplicating
For an enabled catalog request, the system SHALL emit `ad_requested`, optional `ad_opened`, and exactly one terminal `ad_finished` with shared session/build/battle/profile/request-token fields and a sanitized outcome of `shown`, `not_shown`, `error`, or `timeout`. A disabled study profile SHALL emit no ad lifecycle events; its manifest and session summary SHALL record policy `disabled_for_study`.

#### Scenario: Advertisement is shown
- **WHEN** a fullscreen request opens and closes normally
- **THEN** event order is `battle_finished`, `ad_requested`, `ad_opened`, `ad_finished(shown)` with each ad event emitted once

#### Scenario: Advertisement is disabled in study draft
- **WHEN** a study-draft battle finishes
- **THEN** no Yandex ad method and no `ad_requested`, `ad_opened`, or `ad_finished` event occurs, while the release/session summary records ad policy `disabled_for_study`

### Requirement: SDK and advertisement tests respect trust boundaries
Qualification SHALL distinguish pure local fallback tests, deterministic injected-SDK contract/browser tests, and observation of the unchanged Yandex-hosted artifact. Runtime query switches MUST NOT alter release behavior.

#### Scenario: Local fallback is tested
- **WHEN** tests run without `YaGames`
- **THEN** they verify local playability and zero SDK/advertising calls

#### Scenario: Injected SDK branches are tested
- **WHEN** adapter tests use callback fakes or the unchanged package is served under a mapped non-local hostname with host-provided `window.YaGames`
- **THEN** shown, not-shown, error, timeout, duplicate, late-callback, language, and lifecycle branches are deterministic without changing artifact bytes

#### Scenario: Yandex-hosted draft is qualified
- **WHEN** the exact uploaded artifact runs with platform SDK/debug tooling
- **THEN** real loader, Game Ready, language, gameplay indicator, lifecycle, and one actual fullscreen-request outcome are observed, while deterministic forcing of every error/timeout branch is not required on real inventory

### Requirement: Forbidden monetization surfaces remain absent
This release MUST NOT call rewarded-advertising, purchase, payment, consumable, extra-AP, resurrection, pay-to-continue, or external-commerce APIs.

#### Scenario: Release code is statically and dynamically inspected
- **WHEN** the release gate scans imports, adapter methods, and runtime spies
- **THEN** no forbidden monetization surface exists or is invoked

### Requirement: No-progression save policy is explicit
The release SHALL persist only onboarding dismissal and declared non-gameplay preferences. It SHALL not claim persistent progression, achievements, unlocks, records, inventory, or cloud saves, and the developer comment SHALL disclose that refreshing an active battle starts a new deterministic battle.

#### Scenario: Player refreshes during a battle
- **WHEN** the page reloads before terminal state
- **THEN** a new battle starts and the release does not claim that battle progress was saved

#### Scenario: Player completed onboarding
- **WHEN** the player reloads on the same browser after dismissing onboarding
- **THEN** the dismissal preference remains stored and Rules can still reopen the same frozen instructions

#### Scenario: Progression or purchases are later introduced
- **WHEN** a future change adds records, unlocks, achievements, inventory, or purchases
- **THEN** this no-progression policy no longer qualifies the build and a new save/cloud contract is required

## Sources

[2] https://yandex.ru/dev/games/doc/ru/concepts/requirements — Требования к игре
[4] https://yandex.ru/dev/games/doc/ru/sdk/sdk-about — Подключение SDK
[6] https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv — Реклама SDK
[7] https://yandex.ru/dev/games/doc/ru/sdk/sdk-events — События SDK
[8] https://yandex.ru/dev/games/doc/ru/sdk/sdk-game-events — Game Ready и GameplayAPI
