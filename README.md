# Tactics Arena: Wasteland

**Play Live (GitHub Pages / Solana Mobile Web):** [https://xsa-dev.github.io/tactics-arena-worlds/](https://xsa-dev.github.io/tactics-arena-worlds/)

A deterministic 8×6 squad tactics battle built with Phaser 3, TypeScript, and Vite for **Solana Mobile (Seeker / Saga dApp Store)**, **Web**, and **Yandex Games**.

## Links

- **Live Game:** [https://xsa-dev.github.io/tactics-arena-worlds/](https://xsa-dev.github.io/tactics-arena-worlds/)
- **Web App Manifest:** [https://xsa-dev.github.io/tactics-arena-worlds/manifest.json](https://xsa-dev.github.io/tactics-arena-worlds/manifest.json)
- **Privacy Policy:** [https://xsa-dev.github.io/tactics-arena-worlds/privacy.html](https://xsa-dev.github.io/tactics-arena-worlds/privacy.html)

## Features

- **Deterministic 8×6 Combat Engine (`src/core`):** Pure functional state transitions with zero PRNG, orthogonal movement, Bresenham wall line-of-sight, walkable half-cover mitigation, and once-per-battle unit abilities (`Aimed Shot`, `Burst`, `Medkit`).
- **Human & AI Autoplay (`src/survivor`):** Switch live between manual squad command (`Mode: Human`) and AI-vs-AI autoplay (`Mode: AI Auto`) with `1×`, `2×`, and `4×` presentation speed controls.
- **Solana Mobile & Seeker Integration (`src/solana`):**
  - Native Mobile Wallet Adapter (`@solana-mobile/wallet-standard-mobile`) support for Seed Vault Wallet, Phantom, and Solflare.
  - On-chain **Seeker Genesis Token (SGT)** ownership check (`@solana-mobile/skr-genesis-token`) unlocking the `SEEKER VERIFIED` squad badge.
  - **Self-Verifying `SignedBattleProofV1`:** Sign completed battle replays with Ed25519 and verify both the wallet signature and the deterministic command replay offline.

## Development & Release Commands

```bash
# Local development server
npm run dev

# Typecheck & unit tests
npm run typecheck
npm test

# Browser E2E suites (Playwright)
npm run test:browser
npm run test:browser:ai
npm run test:browser:solana

# Build Solana Mobile / GitHub Pages bundle
RELEASE_PROFILE=solana-mobile npm run build

# Build Android APK via Solana Mobile Webshell
npm run release:solana-webshell
```
