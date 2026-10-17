## Context

`Tactics Arena: Wasteland` is a deterministic 8×6 grid tactics game built with Phaser 3, TypeScript, and Vite. Its core engine (`src/core`) resolves every command synchronously without a PRNG, and its runtime (`src/presentation/runtime.ts`) already supports both human input and AI-vs-AI autoplay (`src/survivor`). However, release configuration (`src/release/config.ts`), manifest generation (`src/release/manifest.ts`), and platform initialization (`src/platform/index.ts`) currently assume Yandex Games archive hosting (`/sdk.js`) and restrict release profiles to `study-draft`, `catalog-release`, and `ai-exhibition`.

We are adding **Solana Mobile (Solana dApp Store for Seeker and Saga devices)** as a target publication platform, backed by **GitHub Pages** (`https://xsa-dev.github.io/tactics-arena-worlds/`) as the canonical HTTPS origin wrapped by `solana-mobile webshell` (`dev.xsa.tacticsarena`).

Because GitHub Pages is static hosting with no stateful Node.js backend, Web3 features must not depend on server-issued session cookies or mutable database nonces. Instead, we leverage two properties:
1. **Deterministic combat engine**: any sequence of accepted `BattleCommand` values replayed from `createBattle(battleId)` through `dispatch()` deterministically reproduces the exact terminal `BattleState`, enemy Raider phases, and canonical `decisionStateFingerprint`.
2. **Client-side cryptographic verification**: Ed25519 signatures produced via Mobile Wallet Adapter (MWA) and Seeker Genesis Token (SGT) mint ownership queried from a public Solana JSON-RPC endpoint can be verified directly in the browser or offline by any third party.

## Goals / Non-Goals

**Goals:**

- Add an immutable `solana-mobile` release profile targeting `https://xsa-dev.github.io/tactics-arena-worlds/` and Android application ID `dev.xsa.tacticsarena`.
- Implement `SolanaMobilePlatformService` so the game boots immediately without waiting for `/sdk.js`, supports live `EN`/`RU` switching, and pauses/resumes cleanly when Android switches focus to a wallet app during MWA intents.
- Allow players in the `solana-mobile` profile to switch between `Human` control and `AI Autoplay` (`1×`, `2×`, `4×`) directly in the HUD without network failures when `proxyUrl` is empty (`""`).
- Register Mobile Wallet Standard (`@solana-mobile/wallet-standard-mobile` v0.5.1+) dynamically only in the `solana-mobile` profile so Seed Vault Wallet, Phantom, and Solflare work inside both the `solana-mobile webshell` APK and Android Chrome while keeping Yandex bundles untouched.
- Detect Seeker Genesis Token (SGT) ownership for a connected wallet via an injectable `SeekerVerifier` and surface a verified Seeker badge in the HUD and result screen.
- Produce and verify `SignedBattleProofV1` JSON envelopes that bind a deterministic battle replay log and committed `BattleSession` terminal state fingerprint to an Ed25519 wallet signature.
- Ship a complete GitHub Pages deployment pipeline, Web App Manifest, icons, self-contained privacy policy page, and `solana-mobile webshell` configuration with strict secret-leak guards.

**Non-Goals:**

- Modifying core 8×6 combat rules, unit stats, AP costs, cover, line-of-sight, or Raider AI behavior.
- Requiring a wallet connection or SOL expenditure to play the game; wallet connection and victory signing are strictly optional.
- Introducing paid in-app purchases, token wagering, or pay-to-win advantages.
- Breaking or altering existing `study-draft`, `catalog-release`, or `ai-exhibition` OpenSpec contracts.

## Decisions

### 1. Add a dedicated `solana-mobile` release profile with `sdkEnabled: false` and offline AI fallback

`ReleaseConfig` in `src/release/config.ts` and `ReleaseManifest` in `src/release/manifest.ts` currently type `sdkEnabled: true`. We will widen `sdkEnabled` to `boolean` (`true` for Yandex profiles, `false` for `solana-mobile`) and add a `solanaMobile` declaration block containing:
- `appUrl`: `"https://xsa-dev.github.io/tactics-arena-worlds/"`
- `applicationId`: `"dev.xsa.tacticsarena"`
- `chains`: `["solana:mainnet"]`
- `rpcUrl`: `"https://api.mainnet-beta.solana.com"` (injectable for tests)
- `allowControlModeSwitch`: `true`

In `SURVIVOR_PROFILES["solana-mobile"]`, `mode` defaults to `"human"` and `proxyUrl` is `""`. In `GameRuntime`, `ResilientSurvivorPolicy` MUST always be constructed with a primary policy that is `null` whenever `!survivor.proxyUrl.trim()`, so switching from `"human"` to `"openjev"` in `solana-mobile` immediately uses `DeterministicSurvivorPolicy` offline without attempting `fetch("")`.

### 2. Dynamically load MWA & Wallet Standard only in `solana-mobile`

Only when `ACTIVE_RELEASE_CONFIG.profile === "solana-mobile"` (or via injected `BootstrapDependencies.walletCoordinator`), the browser runtime dynamically imports `src/solana/` and invokes `registerMwa` from `@solana-mobile/wallet-standard-mobile` (>= 0.5.1) with:
- `appIdentity`: `{ name: "Tactics Arena: Wasteland", uri: "https://xsa-dev.github.io/tactics-arena-worlds/", icon: "icons/icon-192.png" }`
- `authorizationCache`: a `sessionStorage`-backed cache under allowed key `"tactics-mwa-auth-v1"` (avoiding unapproved `localStorage` keys)
- `chains`: `["solana:mainnet"]`

Wallet discovery uses `getWallets()` from `@wallet-standard/app`. Dynamic import ensures Yandex builds (`study-draft`, `catalog-release`, `ai-exhibition`) never bundle `@solana-mobile/wallet-standard-mobile` or its embedded `solanamobile.com`/`localhost` strings.

### 3. Coordinate MWA intent lifecycle with `RuntimeLifecycle` and `GameplayCoordinator`

Invoking MWA `authorize` or `signMessage` foregrounds the wallet activity, triggering browser `blur` and `visibilitychange`. We widen `InternalBlocker` in `src/platform/gameplay-coordinator.ts` and `GameRuntime.setLifecycleBlocker` to accept `"focus" | "visibility" | "mwa_intent"`. While an MWA request is in flight, `SolanaWalletCoordinator` asserts `"mwa_intent"` (which calls `cancelAutoplay()`, pauses active duration, and pauses presentation) and clears it in `finally`. `GameRuntime.replay()` preserves active blockers on the new lifecycle instance.

### 4. Injectable Seeker Genesis Token (SGT) verification

Once a wallet connects, `SolanaWalletCoordinator` calls an injectable `SeekerVerifier.verifySeekerGenesisToken(walletAddress)`:
- Default production implementation uses `@solana-mobile/skr-genesis-token` (`getSeekerGenesisTokens`) with `createSolanaRpc(config.solanaMobile.rpcUrl)` from `@solana/kit` and caches the result per wallet address in memory for the session.
- If at least one SGT mint is returned, the coordinator records `seekerGenesisMint` and displays the localized `SEEKER VERIFIED` badge.
- If the wallet holds no SGT or the public RPC throws/rate-limits/CORS-blocks, the coordinator catches the error, sets `seekerGenesisMint: null`, and keeps wallet connection and proof signing fully functional.

### 5. Self-verifying `SignedBattleProofV1` from committed `BattleSession` state

To avoid the 180 ms presentation delay window where `runtime.displayState` lags behind `runtime.session.state` on Raider-phase defeat:
- `BattleSession` records `acceptedCommands: BattleCommand[]`, `initialStateFingerprint`, and tracks which control modes executed accepted commands in that battle (`"human"`, `"openjev"`, or `"hybrid"` if both modes executed commands or if mode was toggled after an accepted command).
- When `BattleSession` reaches a terminal state (`victory` or `defeat`), it constructs the canonical unsigned `BattleProofPayloadV1`:
  ```json
  {
    "schema": "tactics-arena.battle-proof.v1",
    "manifestVersion": "0.1.0",
    "scenarioFreezeId": "wasteland-8x6-v1",
    "battleId": "...",
    "controlMode": "human",
    "result": "victory",
    "rounds": 2,
    "activeDurationMs": 14200,
    "initialStateFingerprint": "...",
    "terminalStateFingerprint": "...",
    "commandsDigest": "<sha256-hex-of-canonical-acceptedCommands-json>",
    "walletAddress": "<base58-pubkey>",
    "seekerGenesisMint": "<base58-mint-or-null>",
    "issuedAt": "2026-10-17T12:00:00.000Z"
  }
  ```
- The unsigned replay envelope is also cached in `sessionStorage` under `"tactics-battle-proof-v1"` so if Android WebView reloads while switching to the wallet app, the completed battle can still be signed upon return.
- When the user activates **Sign Battle Proof**, the wallet signs the canonical UTF-8 JSON bytes of `payload` via Ed25519 (`signMessage`), producing `SignedBattleProofV1` (`{ payload, acceptedCommands, message, signature }`).
- `verifySignedBattleProof(proof, options?)`:
  1. Recomputes the canonical message string from `proof.payload` and rejects if `proof.message` differs (`digest_mismatch`).
  2. Recomputes `commandsDigest` from `proof.acceptedCommands` and replays `proof.acceptedCommands` from `createBattle(proof.payload.battleId)` through `dispatch()`, verifying that `scenarioFreezeId` matches, every command is accepted, and the resulting `status`, `round`, `initialStateFingerprint`, and `terminalStateFingerprint` match `proof.payload` (`replay_mismatch`).
  3. Verifies the Ed25519 `signature` over the canonical message bytes against the base58-decoded 32-byte `walletAddress` public key using Web Crypto `crypto.subtle.verify("Ed25519", ...)` (`signature_mismatch`).
  4. If `proof.payload.seekerGenesisMint` is non-null: when `options?.seekerVerifier` is provided, verifies on-chain SGT ownership and rejects spoofed mints with `sgt_ownership_mismatch` (returning `sgtStatus: "verified"` on match); when no verifier is provided offline, returns `sgtStatus: "unverified_offline"`.

### 6. Ergonomic `640×360` HUD Layout, Live Mode Switching, and Live Locale Redraw

At `640×360` landscape (`2/3` canvas scale), the Roster panel ends at CSS `y=268px` and `#game-controls` sits at `y=316..360px` (`left: 32%`). To prevent overlap and ensure `>= 44×44` CSS-pixel hit targets:
- **Top-right toolbar (`#top-controls`)**: Positioned at `top: max(4px, env(safe-area-inset-top)); right: max(6px, env(safe-area-inset-right)); height: 44px`, overlaying the empty right half of the canvas top bar (`x=420..634px`). Contains `#mode-toggle` (`Human` / `AI`), `#locale-toggle` (`EN` / `RU`), `#wallet-button` (`Connect` / truncated address), and `#seeker-badge`.
- **Bottom-left speed bar (`#ai-speed`)**: Positioned at `bottom: max(0px, env(safe-area-inset-bottom)); left: max(6px, env(safe-area-inset-left)); height: 44px` (`x=6..200px, y=316..360px`, below the board and left of `#game-controls`) with `pointer-events: auto` and `min-width: 44px; min-height: 44px` buttons for `1×`, `2×`, and `4×`.
- **State cleanup & live redraw**: `runtime.setControlMode(mode)` cancels in-flight autoplay, clears `selectedId = null`, resets `actionMode = "move"`, and notifies listeners. `runtime.replay()` resets `autoplayDecisions = 0`, `nextAutoplayAt = 0`, `pendingFinal = null`, and initializes the new session with the current HUD control mode. `runtime.setLanguage(lang)` updates `runtime.language`, persists `tactics-locale-v1`, redraws `BattleScene` (replacing hardcoded `"SURVIVORS"` / `"RAIDERS"` with localized keys), and re-renders all DOM controls and `#onboarding-list` (`onboarding.*` for `human`, `onboarding.ai.*` for `openjev`).

### 7. Profile-scoped archive validation, GitHub Pages bundle, and `solana-mobile webshell`

- `public/manifest.json` declares `name`, `short_name`, `start_url: "./"`, `scope: "./"`, `display: "standalone"`, `orientation: "landscape"`, `background_color: "#101416"`, `theme_color: "#151a1d"`, and PNG icons at `192×192` and `512×512`.
- `public/privacy.html` is a self-contained static HTML document with no external `http://` or `https://` attributes (using plain text for domain names) so its presence in `dist/` never triggers `forbidden absolute host` in `study-draft` or `catalog-release` builds.
- `scripts/release-tools.mjs` only reads UTF-8 content for text files (`/\.(?:html|css|m?js|json|webmanifest)$/i`) and scopes `validateArchiveEntries(entries, { profile })` so Yandex profiles keep an empty host allowlist while `solana-mobile` allows `xsa-dev.github.io`, `api.mainnet-beta.solana.com`, `solanamobile.com`, and `localhost`.
- `scripts/check-secrets.mjs` scans tracked files and `dist/` (when present), blocks `.keystore`, `.jks`, `.p12`, and `*-keypair.json` files by path, and checks for `SOLANA_MOBILE_KEYSTORE_PASSWORD`, `DAPP_STORE_API_KEY`, and 64-byte Solana secret key arrays without self-flagging variable names.

## Risks / Trade-offs

- **[Public Solana RPC rate-limits or CORS-blocks browser requests]** -> Inject `SeekerVerifier` in tests, cache SGT checks per wallet address, and degrade gracefully to standard wallet status without blocking gameplay or proof signing.
- **[Wallet app switch on Android causes WebView reload]** -> Persist the last completed battle's unsigned proof payload and `acceptedCommands` in `sessionStorage` (`tactics-battle-proof-v1`) and restore the result overlay signing state on reload.
- **[Client-signed `seekerGenesisMint` claim is untrusted offline]** -> `verifySignedBattleProof` reports `sgtStatus: "unverified_offline"` unless verified via an injected `seekerVerifier`, which rejects spoofed SGT mints with `"sgt_ownership_mismatch"`.
