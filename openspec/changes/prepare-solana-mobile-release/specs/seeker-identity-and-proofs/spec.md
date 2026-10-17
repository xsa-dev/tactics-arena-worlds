## ADDED Requirements

### Requirement: Mobile Wallet Standard is registered for Solana Mobile Web and Webshell
In the `solana-mobile` profile, the browser runtime SHALL register Mobile Wallet Adapter via `@solana-mobile/wallet-standard-mobile` (`v0.5.1` or newer) with a `sessionStorage`-backed authorization cache (`tactics-mwa-auth-v1`) and the canonical app identity for `https://xsa-dev.github.io/tactics-arena-worlds/`, discover wallets via `@wallet-standard/app`, support test wallet injection via `BootstrapDependencies`, and allow gameplay to proceed without a connected wallet.[1][2]

#### Scenario: User plays without connecting a wallet
- **WHEN** a user dismisses onboarding and plays a complete battle without pressing Connect Wallet
- **THEN** the battle starts, resolves, and allows replay normally with zero wallet prompts or errors

#### Scenario: User connects a wallet via MWA or injected Wallet Standard adapter
- **WHEN** the user activates Connect Wallet and approves authorization
- **THEN** the runtime stores the connected `walletAddress`, updates the HUD wallet status badge, and emits a `wallet_connected` analytics event with no private key or seed material

### Requirement: Seeker Genesis Token ownership is checked and surfaced gracefully
When a wallet connects in the `solana-mobile` profile, the system SHALL check whether the wallet holds a Seeker Genesis Token (SGT) via the configured `SeekerVerifier` (`@solana-mobile/skr-genesis-token`), surface a verified Seeker badge when present, and degrade gracefully when absent or when RPC queries fail.[3]

#### Scenario: Connected wallet owns a Seeker Genesis Token
- **WHEN** the SGT verifier returns at least one valid SGT mint for the connected wallet address
- **THEN** the HUD and result overlay display the localized `SEEKER VERIFIED` status and bind the SGT mint address to subsequent battle proofs in that session

#### Scenario: Connected wallet has no SGT or RPC is unreachable
- **WHEN** the SGT verifier returns an empty list or throws a network/rate-limit/CORS error
- **THEN** the wallet remains connected as a standard Solana wallet, no unhandled error is thrown, and gameplay plus battle proof signing remain available

### Requirement: Completed battles can be signed and verified offline as deterministic proofs
After a battle reaches a terminal state (`victory` or `defeat`), the system SHALL construct a canonical `SignedBattleProofV1` payload strictly from committed `BattleSession` state (`scenarioFreezeId`, `battleId`, `rounds`, `activeDurationMs`, `controlMode`, `result`, `initialStateFingerprint`, `terminalStateFingerprint`, `commandsDigest`, `walletAddress`, and `seekerGenesisMint`), cache the unsigned proof in `sessionStorage` (`tactics-battle-proof-v1`) for WebView reload resilience, allow the connected wallet to sign its canonical UTF-8 bytes with Ed25519, and provide a pure `verifySignedBattleProof(proof, options?)` function plus UI/test verification hooks that validate the canonical message, Ed25519 signature, deterministic command replay, and optional SGT ownership.

#### Scenario: Connected player signs a completed victory
- **WHEN** a battle finishes in `victory` and the connected user activates Sign Battle Proof
- **THEN** the wallet signs the canonical proof message, the runtime produces a downloadable/verifiable `SignedBattleProofV1` JSON artifact, and `verifySignedBattleProof` returns `{ valid: true }`

#### Scenario: Tampered command log, forged round count, or spoofed SGT mint is rejected
- **WHEN** `verifySignedBattleProof` is given a proof whose `rounds`, `result`, `walletAddress`, `message`, or `acceptedCommands` were modified after signing, or whose `seekerGenesisMint` fails an injected `seekerVerifier` check
- **THEN** `verifySignedBattleProof` returns `{ valid: false }` with a machine-readable reason (`signature_mismatch`, `digest_mismatch`, `replay_mismatch`, or `sgt_ownership_mismatch`)
