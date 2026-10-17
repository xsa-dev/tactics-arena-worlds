## Why

The playable battle and OpenJEV autoplay systems are currently tied to Yandex Games release profiles (`study-draft`, `catalog-release`, and `ai-exhibition`) and flat archive packaging. Publishing `Tactics Arena: Wasteland` to the Solana dApp Store (targeting Solana Mobile Seeker and Saga devices) and hosting the live web build on GitHub Pages (`https://xsa-dev.github.io/tactics-arena-worlds/`) requires a first-class `solana-mobile` release profile, Mobile Wallet Adapter (MWA) integration, Seeker Genesis Token (SGT) recognition, verifiable Ed25519 battle proofs that work without a stateful backend, user-selectable Human versus AI control in the HUD, and an Android WebView shell (`solana-mobile webshell`) APK pipeline.[1][2][3][4]

## What Changes

- Add a `solana-mobile` release profile (`sdkEnabled: false`, `applicationId: "dev.xsa.tacticsarena"`, `appUrl: "https://xsa-dev.github.io/tactics-arena-worlds/"`) and `SolanaMobilePlatformService` (`platformKind: "solana-mobile"`) that skips Yandex `/sdk.js` loading, defaults to `navigator.language` (`en`/`ru`) with a live in-HUD language toggle, and coordinates Android WebView / wallet-intent focus and visibility pauses cleanly.
- Expose a touch-safe (`>= 44×44` CSS px) top-right HUD toolbar (`#top-controls`) for `Human` ⇄ `AI Autoplay` mode switching, `EN` ⇄ `RU` locale switching, wallet connection, and Seeker badge display, while placing `0.25×`/`0.5×`/`1×`/`2×`/`4×` presentation speed controls (`>= 44×44` CSS px) in the bottom-left strip so `640×360` landscape never overflows or overlaps the board or roster.
- Integrate Mobile Wallet Standard (`@solana-mobile/wallet-standard-mobile` v0.5.1+, `@wallet-standard/app`, and `@solana/kit`) dynamically in the `solana-mobile` profile so Android Chrome and the `solana-mobile webshell` APK connect natively to Seed Vault Wallet, Phantom, and Solflare via Android intents without contaminating Yandex release bundles.[2][3]
- Add optional Seeker Genesis Token (SGT) verification via Solana RPC (`@solana-mobile/skr-genesis-token`) with injectable `SeekerVerifier` support to unlock a verified Seeker squad badge (`SEEKER VERIFIED`) in the HUD and battle proofs while degrading gracefully when absent or offline.[4]
- Introduce a self-verifying `SignedBattleProofV1` envelope constructed strictly from committed `BattleSession` state: after a battle finishes, a connected wallet can sign a canonical message binding `scenarioFreezeId`, `battleId`, `rounds`, `activeDurationMs`, `controlMode` (`"human"`, `"openjev"`, or `"hybrid"`), `commandsDigest`, `initialStateFingerprint`, `terminalStateFingerprint`, `walletAddress`, and optional `seekerGenesisMint`. Any client can recompute the canonical message, verify the Ed25519 signature, deterministically replay `acceptedCommands` through `dispatch` offline, and optionally verify `seekerGenesisMint` ownership via `SeekerVerifier`.
- Prepare static GitHub Pages deployment (`https://xsa-dev.github.io/tactics-arena-worlds/`), including a Web App Manifest (`public/manifest.json`), `192×192` and `512×512` PNG icons, a self-contained `public/privacy.html` page (with no external links that would trip Yandex archive checks), profile-scoped archive validation in `scripts/release-tools.mjs`, and a GitHub Actions deployment workflow.[1][5]
- Add reproducible `solana-mobile webshell` configuration (`dev.xsa.tacticsarena`), APK build/verification scripts, and secret checks preventing Solana keypairs, seed phrases, or Android keystore files/passwords from entering the repository or browser bundle.

## Capabilities

### New Capabilities

- `solana-mobile-platform`: Defines the `solana-mobile` release profile, `SolanaMobilePlatformService`, wallet-intent pause/resume coordination, live `Human` ⇄ `AI Autoplay` mode switching (with offline `DeterministicSurvivorPolicy` fallback when `proxyUrl` is empty), live `EN`/`RU` language toggling, and `640×360` HUD ergonomics.
- `seeker-identity-and-proofs`: Defines Mobile Wallet Adapter registration, optional wallet connection, Seeker Genesis Token verification, deterministic `SignedBattleProofV1` signing, and offline Ed25519 + replay + SGT verification.
- `github-pages-and-webshell-package`: Defines the GitHub Pages static bundle, Web App Manifest, icons, privacy policy page, profile-scoped archive host validation, `solana-mobile webshell` Android project configuration, and secret-scanner guards.

### Modified Capabilities

None. Existing `study-draft`, `catalog-release`, and `ai-exhibition` profiles and core combat rules remain unchanged.

## Impact

- Code: `src/release/config.ts`, `src/release/manifest.ts`, `src/release/persistence.ts`, `src/platform/`, `src/presentation/runtime.ts`, `src/presentation/BattleScene.ts`, `src/main.ts`, `src/solana/` (new dynamically imported module for MWA, SGT, and signed battle proofs), `public/manifest.json`, `public/privacy.html`, `docs/build-freeze.md`.
- Scripts & CI: `scripts/release-preflight.mjs`, `scripts/release-tools.mjs`, `scripts/check-secrets.mjs`, `scripts/build-solana-webshell.mjs`, `.github/workflows/deploy-pages.yml`.
- Dependencies: `@solana-mobile/wallet-standard-mobile`, `@solana-mobile/skr-genesis-token`, `@solana/kit`, `@wallet-standard/app`.

## Sources

[1] https://docs.solanamobile.com/recipes/general/publishing-a-web-app.md
[2] https://docs.solanamobile.com/cli/webshell.md
[3] https://docs.solanamobile.com/get-started/web/installation.md
[4] https://docs.solanamobile.com/recipes/general/detecting-seeker-users.md
[5] https://solanamobile.com/publisher-policy-web
