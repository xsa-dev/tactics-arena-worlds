## ADDED Requirements

### Requirement: GitHub Pages static bundle includes Web App Manifest, icons, and privacy policy
The production build for `solana-mobile` SHALL emit a static bundle suitable for GitHub Pages (`https://xsa-dev.github.io/tactics-arena-worlds/`) with relative asset paths, a root `manifest.json` declaring landscape standalone display and `192×192` / `512×512` PNG icons, and a truthful, self-contained `privacy.html` page compliant with the Solana Mobile Publisher Policy that contains no external URL attributes that would fail Yandex archive checks.[1][2][3]

#### Scenario: Static build is inspected for Solana Mobile web manifest and privacy policy
- **WHEN** the `solana-mobile` production build completes
- **THEN** `dist/index.html` links to `manifest.json` and `privacy.html`, `dist/manifest.json` references valid `192×192` and `512×512` PNG icons with `"orientation": "landscape"` and `"display": "standalone"`, and `dist/privacy.html` exists without breaking `study-draft` archive host validation

### Requirement: Solana Mobile Webshell configuration is reproducible and secret-safe
The repository SHALL provide a reproducible `solana-mobile webshell` configuration (`dev.xsa.tacticsarena`) seeded from the web manifest, profile-scoped archive validation in `scripts/release-tools.mjs`, and a secret-check guard that rejects committed Android keystores, keystore passwords, Solana CLI keypair files, or dApp Store API keys across tracked files and `dist/`.[2][4]

#### Scenario: Secret scanner runs on repository and build output
- **WHEN** `npm run check:secrets` executes
- **THEN** it fails if any tracked file or built `dist/` asset contains an OpenJEV key, a 64-byte Solana private keypair array, an Android `.keystore`/`.jks`/`.p12` file, `SOLANA_MOBILE_KEYSTORE_PASSWORD` assignment, or `DAPP_STORE_API_KEY` assignment

#### Scenario: Release preflight and archive validator run for Solana Mobile profile
- **WHEN** release validation runs with `RELEASE_PROFILE="solana-mobile"`
- **THEN** preflight and archive validation accept `solana-mobile`, allow only the declared Solana Mobile hosts (`xsa-dev.github.io`, `api.mainnet-beta.solana.com`, `solanamobile.com`, `localhost`) while keeping the allowlist empty for Yandex profiles, and verify that the packaged static bundle boots cleanly in a headless browser at desktop and `640×360` mobile landscape viewports
