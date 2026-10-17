# Cohort build freeze

- Manifest version: `0.1.0`; release profiles are `study-draft`,
  `catalog-release`, `ai-exhibition`, and `solana-mobile`.
- Scenario and balance: the exact 8x6 map, units, AP, damage, range, abilities,
  cover, line-of-sight, Raider policy, and round-8 limit in the accepted OpenSpec.
- Theme: post-apocalyptic Survivors versus Raiders with the single Wasteland
  arena presentation included in this build.
- Onboarding: six-step `tactics-onboarding-v1` copy and trigger order in the
  Russian and English catalogs.
- Replay CTA: `Сыграть ещё раз` / `Play again`, available only after a result.

These values must not change after the first valid cohort session. Any change
requires a new build version and, where allowed by the research protocol, a new
cohort iteration.

## Save and refresh policy

This release stores only the `tactics-onboarding-v1` dismissal preference and
the `tactics-locale-v1` language preference in `localStorage` (plus ephemeral
`tactics-mwa-auth-v1` and `tactics-battle-proof-v1` keys in `sessionStorage`
for Solana Mobile wallet/proof state). It
does not store battle progress, records, achievements, unlocks, inventory,
purchases, or cloud-save state. Refreshing during an active battle creates a new
copy of the deterministic frozen battle. Orientation changes pause and block
commands but do not mutate or restore battle progress.

Adding persistent gameplay state requires a separate save/cloud OpenSpec change.
