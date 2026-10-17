## ADDED Requirements

### Requirement: Solana Mobile release profile is supported and isolated from Yandex SDK
The system SHALL support a `solana-mobile` release profile with `sdkEnabled=false`, Android application identifier `dev.xsa.tacticsarena`, and canonical web origin `https://xsa-dev.github.io/tactics-arena-worlds/`. When running under `solana-mobile`, the runtime SHALL NOT load `/sdk.js` or invoke `YaGames.init()`, SHALL initialize `SolanaMobilePlatformService` with `platformKind="solana-mobile"` immediately, and SHALL dynamically load Solana wallet modules only in the `solana-mobile` profile so Yandex release bundles remain unchanged.[1][2]

#### Scenario: Solana Mobile profile boots without Yandex SDK
- **WHEN** the application starts with `RELEASE_PROFILE="solana-mobile"`
- **THEN** it does not request `/sdk.js`, initializes `SolanaMobilePlatformService` without a 2500 ms SDK timeout, and marks the `platform` readiness barrier ready

#### Scenario: Existing Yandex profiles remain unchanged
- **WHEN** the application builds or starts with `study-draft`, `catalog-release`, or `ai-exhibition`
- **THEN** existing Yandex SDK loader rules, freeze identifiers, and zero-external-host archive validations remain in force

### Requirement: Interactive control mode and locale toggles fit 640×360 landscape and preserve runtime invariants
In the `solana-mobile` profile, the HUD SHALL expose touch-safe (`>= 44×44` CSS pixels) controls in a top-right toolbar (`#top-controls`) to switch between `Human` and `AI Autoplay` control modes and between `en` and `ru` locales without reloading the page, and SHALL place `1×`, `2×`, and `4×` speed buttons (`>= 44×44` CSS pixels) in a non-overlapping bottom-left bar (`#ai-speed`) so `640×360` landscape has no page scroll or board/roster occlusion. When `proxyUrl` is empty in `solana-mobile`, `AI Autoplay` SHALL use `DeterministicSurvivorPolicy` offline without making network requests.

#### Scenario: Player switches from Human to AI Autoplay mid-battle
- **WHEN** the player activates the AI Autoplay toggle during an active player phase in `solana-mobile`
- **THEN** any active unit selection is cleared, board pointer input is suppressed, the autoplay coordinator enumerates and executes Survivor decisions using `DeterministicSurvivorPolicy` when `proxyUrl` is empty, and the session records `controlMode="hybrid"` if human commands were already accepted in that battle

#### Scenario: Player switches from AI Autoplay to Human control
- **WHEN** the player activates the Human control toggle while an AI decision is in flight or after AI commands were accepted
- **THEN** the in-flight autoplay request is aborted immediately, board input is enabled once presentation is idle, no stale AI response is dispatched, and the session records `controlMode="hybrid"` once a human command is accepted in the same battle

#### Scenario: Player switches UI language in Solana Mobile profile
- **WHEN** the player toggles the language control between `EN` and `RU`
- **THEN** all HUD, action bar, canvas labels (`BattleScene`), rules/onboarding copy (`onboarding.*` for `human`, `onboarding.ai.*` for `openjev`), wallet controls, and result strings re-render immediately in the selected language and `tactics-locale-v1` is updated in local storage

### Requirement: Wallet intent lifecycle pauses and resumes the battle cleanly
The system SHALL treat an active Mobile Wallet Adapter (MWA) session (`authorize` or `signMessage`) as a lifecycle pause source (`mwa_intent`) coordinated with `focus` and `visibility` blockers in both `RuntimeLifecycle` and `GameplayCoordinator` so active battle duration, autoplay, and queued animations pause while the Android wallet activity is foregrounded and resume once all blockers clear.

#### Scenario: Wallet intent opens during or after battle
- **WHEN** an MWA request is initiated and browser focus/visibility is lost while the wallet app is shown
- **THEN** runtime cancels any in-flight autoplay, enters a single paused state, stops active duration accumulation and presentation playback, and resumes once after the MWA promise settles and focus/visibility return
