# TDD evidence

Every behavior slice records the focused failing command and the matching green command.

## Independent GO Review & Reproducible `study-draft` Package Closure (Tasks 1.8 & 5.5)

- **Task 1.8 (Independent OpenSpec-compliance & code-quality GO review)**:
  - Reviewed all playable and release changes across `src/release/config.ts`, `src/release/manifest.ts`, `src/release/persistence.ts`, `src/platform/index.ts`, `src/platform/readiness.ts`, `src/platform/operator.ts`, `src/platform/gameplay-coordinator.ts`, `scripts/package-release.mjs`, `scripts/release-pipeline.mjs`, and `scripts/release-tools.mjs`.
  - Confirmed `study-draft` sets `adPolicy: "disabled_for_study"`, `publicationEligible: false`, `sdkEnabled: true`, and `savePolicy: "preferences_only_no_progression"`.
  - Confirmed original study tasks `6.1`–`6.5` in `openspec/changes/validate-tactical-battle-prototype/tasks.md` remain unchecked pending the 15-session human playtest cohort.
  - Verdict: **GO** for tasks `1.1`–`5.5`.
- **Task 5.5 (`study-draft` package & qualification evidence binding)**:
  - Rebuilt `study-draft` via `RELEASE_PROFILE=study-draft npm run release:package` (`qualifyTwoCleanCheckouts`), binding all 10 qualification gates (`dependency-install`, `format-check`, `typecheck`, `unit-contract-tests`, `browser-tests`, `production-build`, `packaged-artifact-smoke`, `security-audit`, and strict OpenSpec validations) to `artifacts/releases/0.1.0/release-manifest.json`, `artifacts/releases/0.1.0/SHA256SUMS`, and `artifacts/releases/0.1.0/qualification-evidence.json`.

## Second and final focused fix cycle (2026-08-31)

- Canonical profile propagation RED: `npm test -- --run
tests/unit/release-profile-build.test.mjs` failed 2/2 real Vite builds with
  `createReleaseManifestObject is not a function`. GREEN: the exact command
  passed 2/2 in 7.54 s; actual study/catalog JS bytes contained only their
  matching `tactics-release-profile:<profile>` marker and each generated
  manifest reported the same profile. Vite receives the sole
  `RELEASE_PROFILE` input through a compile-time `define`, and shared manifest
  constants now come from `release-metadata.json` (package version remains
  canonical in `package.json`).
- Catalog refusal RED: `npm test -- --run
tests/unit/release-preflight.test.mjs` failed 1/3 because catalog inputs
  returned no error. GREEN: the exact command passed 3/3 after both command
  preflight and low-level packaging began refusing with
  `catalog-release prerequisites are incomplete`; no GO evidence bypass exists
  while advertising, catalog, study, moderation, and publication tasks remain
  unimplemented.
- Platform/readiness RED: `npm test -- --run tests/unit/sdk-release.test.ts
tests/unit/readiness.test.ts` failed 2/7: a local adapter accepted `null`, and
  a thrown `LoadingAPI.ready()` escaped after `game_loaded` had been committed.
  GREEN: the exact command passed 7/7 after local reasons became mandatory,
  missing LoadingAPI/GameplayAPI acquired machine reasons that block catalog,
  and platform readiness moved before the once-only `game_loaded` commit with
  localized failure capture.
- Exact task-1.5 coverage: the first run of `npm test -- --run
tests/unit/operator.test.ts` passed 9/9. The four newly explicit
  characterization cases prove technical-help-only eligibility,
  request-without-provided-help terminal eligibility, active/abandoned
  non-locking snapshots, invalid help reason, prestart execute/replay, repeated
  start, and abandoned execute/replay. These behaviors already passed, so no
  artificial RED or production mutation was manufactured.
- Archive/security RED: `npm test -- --run
tests/unit/release-tools.test.mjs` failed 4/9: broader CSS/JS network forms
  were missed, `inspectZipArchive` was absent, a source symlink was followed,
  and one `tactics-package-stage-*` root leaked. GREEN: the exact command passed
  9/9 after a bounds-checked binary ZIP central-directory/local-header parser,
  ASCII/space/control/path/type/size enforcement before extraction, realpath
  containment, source-symlink rejection, broader HTML/CSS/JS network-construct
  scanning, and package-stage `finally` cleanup. The expanded command later
  passed 10/10 with explicit HTTP 4xx/request-failure smoke assertions and a
  real ZIP symlink case.
- Complete checksum coverage RED: `npm test -- --run
tests/unit/release-tools.test.mjs` failed 1/10 because a checksum file
  containing only the ZIP line incorrectly passed. GREEN with
  `tests/unit/release-pipeline.test.mjs` included: 12/12 passed after exact
  ZIP-plus-every-entry checksum set validation, duplicate/unexpected/missing
  rejection, deterministic concrete gate evidence, final copied-byte checks,
  final archive inspection, and source/profile/evidence binding.
- Qualification command/evidence RED: `npm test -- --run
tests/unit/release-pipeline.test.mjs` failed 2/2 because security audit, both
  strict OpenSpec validations, and `qualificationEvidenceBytes` were absent.
  GREEN: the exact command passed 2/2 with ten deterministic successful gate
  records; the production success path copies and hash-binds
  `qualification-evidence.json`, then revalidates the copied archive and
  recalculates all checksums before returning.
- Large compiled-entry checksum RED: the first real
  `npm run release:verify-repro` reached final-copy validation but failed with
  `missing archive entry: app/assets/index-CzIxNWzM.js`; focused
  `npm test -- --run tests/unit/release-tools.test.mjs -t 'larger than one
megabyte'` then failed 1/1 with `missing archive entry: app/large.js`. GREEN:
  the exact focused command passed 1/1 after bounding `unzip -p` output by the
  already-enforced 100 MB archive limit.
- Test-root cleanup RED: post-test inspection found older direct
  `tactics-version-test-*`, `tactics-release-test-*`,
  `tactics-smoke-cleanup-test-*`, `tactics-nav-cleanup-test-*`, and
  `tactics-repeat-package-test-*` roots outside the cleanup registry. GREEN:
  `npm test -- --run tests/unit/release-tools.test.mjs
tests/unit/release-profile-build.test.mjs` passed 13/13 and the immediate
  `find ... -name 'tactics-*'` scan returned no paths. Existing repository-owned
  leaked `tactics-*` package/test roots were removed; production package,
  smoke, two-worktree, and snapshot roots all use `finally`.
- Real two-clean-worktree GREEN: `npm run release:verify-repro` created a
  temporary Git snapshot (no workspace commit), exercised two detached clean
  worktrees, and ran dependency install, format check, strict typecheck, 61
  unit/contract/tool tests, six Chromium tests, real build, real packaged smoke,
  `npm audit --audit-level=high`, and both strict OpenSpec validations in each.
  It compared real build-derived ZIP/manifest/checksums/gate-evidence bytes,
  reverified the final copied archive/checksums/evidence, exited 0, removed all
  roots in `finally`, and reported:
  `sourceCommit=62de98f5a370e9b54a8ef09dce0ec56c7362e837`,
  `zipSha256=d0c0bb2f4ea80b142c12ded72c26d41821c8c8f179063cc1b6a66981b699119b`,
  `manifestSha256=1a6ca08a5b03d78d7f51d50461e9adca9251a9f88ea503789dab3313ebc200d9`,
  `checksumsSha256=7ce83ab1d49d8c8b0a1498cdca49938aec9088aa54f75bdbc56cdd5eb4b7a1f7`,
  `evidenceSha256=247c9204aa94d18f9a9662d042947ba72c74541f927957e47f8784f2c7e0f4a3`,
  `comparedCleanCheckouts=2`.

### Second-cycle final gate

- `npm run format:check` — passed.
- `npm run typecheck` — passed with strict TypeScript settings.
- `npm test` — 20 files, 62 unit/contract/tool tests passed.
- `npm run build` — passed; 24 modules, with only Vite's existing large-chunk
  warning.
- `npm run test:release-artifact` — 1/1 real ZIP/static-server battle smoke
  passed with zero console/network failures.
- `npm run test:browser` — all 6 Chromium flows passed.
- `npm audit --audit-level=high` — 0 vulnerabilities.
- `openspec validate validate-tactical-battle-prototype --strict` — valid.
- `openspec validate prepare-yandex-games-release --strict` — valid.
- `RELEASE_PROFILE=study-draft npm run release:package` — exited 1 with
  `[release] REFUSED: source tree is dirty`.
- `RELEASE_PROFILE=catalog-release npm run release:package` — exited 1 with
  `[release] REFUSED: source tree is dirty; catalog-release prerequisites are incomplete`.
- `git diff --check` — passed before this evidence append and rerun after it.
- Post-test repository-prefixed temp-root scan — zero `tactics-*` paths.
- Task 1.8 remains unchecked. Tasks 5.5 and later remain unchecked and no ads,
  Console work, Gate B sessions, catalog assets, moderation, or publication were
  implemented.

## Technical-review blocker closure (2026-08-31)

- Lockfile integrity RED: `npm test -- --run tests/unit/release-preflight.test.mjs`
  failed 2/2 because preflight still compared only root versions and
  `validateLockfileIntegrity` did not exist. GREEN: the exact command passed 2/2
  after replacing version comparison with an `npm ci --ignore-scripts` integrity
  check; the two-clean-checkout qualification still begins with plain `npm ci`.
- Manifest identity/sizes RED: `npm test -- --run tests/unit/release-tools.test.mjs`
  failed 1/2 because `manifest.archive` was absent. GREEN: the exact command passed
  2/2 with deterministic compressed/uncompressed byte counts and evidence objects
  containing stable ID, path, and SHA-256. Typed-manifest RED/GREEN used
  `npm test -- --run tests/unit/release-config.test.ts`: 1/2 failed before the
  fields existed, then 2/2 passed.
- Rules/portrait lifecycle RED: `npm test -- --run
tests/unit/runtime-blockers.test.ts` failed 1/1 because Rules did not pause the
  runtime lifecycle. GREEN: the exact command passed 1/1 after Rules and portrait
  became distinct pause sources for presentation, audio, input, active duration,
  and GameplayAPI ownership, with one resume after the last source clears.
- Release locale/qualification RED: `npm test -- --run
tests/unit/sdk-release.test.ts` failed 1/3 because release-safe fallback-language
  selection was absent. GREEN: the exact command passed 3/3 after production query
  overrides were suppressed before and after SDK fallback, catalog fallback became
  a wired fail-closed startup assertion, and initialized SDK locale was retained for
  later startup errors.
- Operator boundary RED: `npm test -- --run tests/unit/operator.test.ts` failed
  2/5 because arbitrary metadata and repeated help requests were accepted. GREEN:
  the exact command passed 5/5 with exact metadata key/value validation, trusted
  identity protection, production tester-query suppression, once-only
  `help_requested(helpAtMs)`, and explicit invalid-operation assertions across
  prestart, active, terminal, abandoned, and finalized states.
- Archive argument/path RED: `npm test -- --run tests/unit/release-tools.test.mjs`
  failed 2/3 because absolute/traversal/leading-dash paths and unsafe versions were
  accepted. GREEN: the exact command passed 3/3 after rejecting absolute, drive,
  dot/dot-dot, backslash, and leading-dash components and placing `--` before ZIP
  entry arguments.
- Hostile extraction/cleanup RED: `npm test -- --run
tests/unit/release-tools.test.mjs` failed 2/4 because ZIP-list validation was absent
  and the injected launch-failure cleanup path was not used. GREEN: the exact command
  passed 4/4 after validating central-directory paths/types/sizes before extraction,
  rejecting traversal/symlinks/bombs, using `path.relative` containment, closing the
  server, and removing the smoke directory in `finally`.
- Repeated packaging RED: `npm test -- --run tests/unit/release-tools.test.mjs`
  failed 1/5 because `removed.js` survived the second package operation. GREEN: the
  exact command passed 5/5 after deleting the destination ZIP before recreation.
- Real-smoke failure-path RED: `npm run test:release-artifact` timed out at 45 s
  after sandbox `listen EPERM` because the server-listen promise did not reject.
  GREEN with localhost/browser permission: the exact command passed 1/1 in 6.6 s;
  the real built/package ZIP reached readiness, emitted no page/console error, and
  completed the frozen victory flow.

### Final scoped gate (2026-08-31)

- `npm run format:check` — passed.
- `npm run typecheck` — passed with strict TypeScript settings.
- `npm test` — 19 files, 47 unit/contract/tool tests passed.
- `npm run build` — passed; 22 modules, with only Vite's existing large-chunk warning.
- `npm run test:release-artifact` — 1 real packaged-artifact smoke passed.
- `npm run test:browser` — all 6 Chromium flows passed, including missing-control and
  Phaser-scene failure overlays.
- `npm audit` — 0 vulnerabilities after the sandbox-DNS-only failure was rerun with
  registry access.
- `openspec validate validate-tactical-battle-prototype --strict` — valid.
- `openspec validate prepare-yandex-games-release --strict` — valid.
- `RELEASE_PROFILE=study-draft npm run release:package` — exited 1 with
  `[release] REFUSED: source tree is dirty`, as required.
- `git diff --check` — passed.
- Task 1.8 remains unchecked pending parent independent GO reviews; tasks 5.5 and
  later remain unchecked and were not implemented.

## prepare-yandex-games-release scoped implementation (2026-08-29)

- Baseline preservation (1.1): HEAD `056a30d3e1db757f4ee17cefd7c8955bc6e77fe7`
  (`spec: define tactical battle prototype`, 2026-08-26T20:48:38+03:00).
  `git status --porcelain=v1` recorded the pre-existing modified baseline task file
  and untracked playable/release files. `npm test` confirmed 19 passing tests and
  exactly one intentional unit RED: the new onboarding copy regression.
- Onboarding copy RED (1.2): `npm test -- --run tests/unit/localization.test.ts`
  failed 1/3 tests because `onboarding.5` did not contain `Scout: Aimed Shot`.
- Onboarding copy GREEN (1.2): `npm test -- --run tests/unit/localization.test.ts`
  passed 3/3; `npm test` passed all 20 tests in 8 files.
- Minimum-viewport RED (1.3): `npm run test:browser -- --grep "640x360 touch flow"`
  failed because the ability briefing exposed 0 of the required 3 readable role
  lines. GREEN: the same command passed 1/1 after the minimal structured-line CSS/DOM change.
- Readiness RED (1.4, 3.7): `npm test -- --run tests/unit/readiness.test.ts`
  failed to import the not-yet-created readiness owner. GREEN: 2/2 barrier and
  failure-suppression tests passed. The browser startup-error regression later ran
  RED with English fallback under `?lang=ru`; `npm run test:browser -- --grep
"missing required controls"` passed 1/1 after the local/test locale fix.
- Operator RED (1.5): `npm test -- --run tests/unit/operator.test.ts` failed to
  import the not-yet-created observation registry. GREEN: 3/3 tests passed for
  prestart/active/terminal/abandoned/finalized operations, enums, all abandonment
  reasons, help eligibility, snapshot/final bytes, replay rollover, and invalid IDs.
- Rules RED (1.6): `npm test -- --run tests/unit/rules.test.ts` failed with
  `session.rulesOpened is not a function`. GREEN: 1/1 passed and emitted exactly
  `battle_started`, `rules_opened` with no implicit help event.
- Release configuration/manifest RED (2.1-2.4): `npm test -- --run
tests/unit/release-config.test.ts` failed to import the absent release config.
  GREEN: 2/2 profile, freeze, schema, epoch-time, and deterministic-manifest tests passed.
- Packaging preflight RED (2.5): `npm test -- --run
tests/unit/release-preflight.test.mjs` failed to import the absent preflight.
  GREEN: 1/1 covered dirty source, lock mismatch, missing commit, unknown profile,
  and incomplete manifest. `RELEASE_PROFILE=study-draft npm run release:package`
  exited 1 with `source tree is dirty; release packaging is fail-closed`.
- SDK/locale/fallback RED (3.1-3.4): `npm test -- --run
tests/unit/sdk-release.test.ts` failed before the release/adapter contracts
  existed. GREEN: 3/3 covered `/sdk.js` before init, local/test bypass,
  LoadingAPI, GameplayAPI, lifecycle callbacks, SDK locale, fallback reason, and
  catalog qualification blocking.
- Gameplay ownership RED (3.5-3.6): `npm test -- --run
tests/unit/gameplay-coordinator.test.ts` failed to import the absent owner.
  GREEN: 2/2 covered onboarding, the 1000 ms window, startup pause/resume, Rules,
  terminal, replay, and overlapping platform/focus/visibility blockers and call counts.
- Persistence RED (4.1-4.3): `npm test -- --run tests/unit/persistence.test.ts`
  failed before the release policy module existed. GREEN: 2/2 covered the one
  persistent key and all forbidden progression/save/commerce declarations.
- Archive/reproducibility RED (5.1-5.4): `npm test -- --run
tests/unit/release-tools.test.mjs` failed to import the absent tool module.
  GREEN: 3/3 covered invalid archive structures/paths/hosts/size, two temporary
  clean-fixture byte-identical ZIPs/manifests/checksums, mutation invalidation,
  unpacked static serving, readiness, page/console errors, and a critical flow.

## Scoped final green gate (2026-08-29)

- `npm run format:check` — passed.
- `npm run typecheck` — passed with strict TypeScript settings.
- `npm test` — 17 files, 39 unit/contract/tool tests passed.
- `npm run test:browser` — 5 Chromium critical flows passed.
- `npm run build` — production Vite build passed (22 modules; bundle-size warning only).
- `openspec validate validate-tactical-battle-prototype --strict` — valid.
- `openspec validate prepare-yandex-games-release --strict` — valid.
- `git diff --check` — passed.
- `npm run preview -- --host 127.0.0.1 --port 4174` plus `node
scripts/capture-screenshots.mjs` — desktop 1280x720 English and touch 640x360
  Russian screenshots captured and visually inspected with no clipping/scroll blocker.
- No release artifact was declared: the real tree remained dirty and the production
  packaging command refused it; reproducibility/smoke tests used temporary fixtures only.

- Scaffold preflight: `npm test -- --run tests/unit/scenario.test.ts` failed before
  collection because the initial config referenced uninstalled `jsdom`. The suite
  default was corrected to the dependency-free Node environment before recording the
  behavioral red result.
- Scenario/types red: `npm test -- --run tests/unit/scenario.test.ts` failed with
  `Cannot find module '../../src/core/scenario'` before production code existed.
- Grid red: `npm test -- --run tests/unit/grid.test.ts` failed with `Cannot find
module '../../src/core/grid'` before path/range/LOS production code existed.
- Commands red: `npm test -- --run tests/unit/commands.test.ts` failed with
  `Cannot find module '../../src/core/engine'` before command production code.
- AI/replay red: `npm test -- --run tests/unit/ai-replay.test.ts` failed four
  focused cases because `end-player-phase` was rejected and `runEnemyPhase`
  did not exist.
- Localization red: `npm test -- --run tests/unit/localization.test.ts` failed
  because the localization boundary and catalogs did not exist.
- Platform red: `npm test -- --run tests/unit/platform.test.ts` failed because
  the platform boundary and local/Yandex adapters did not exist.
- Analytics red: `npm test -- --run tests/unit/analytics.test.ts` failed because
  the battle analytics session contract did not exist.
- Lifecycle red: `npm test -- --run tests/unit/lifecycle.test.ts` failed because
  the pause-safe runtime queue did not exist.
- Browser UI preflight: the initial browser command could not bind the sandboxed
  port; with approved local-server access it timed out because no application
  entry point existed. The behavioral smoke assertions were written before the
  Phaser/DOM production UI.
- Mobile flow red: the first full browser run passed desktop and portrait but
  timed out when the test tried a round-2 action while sequential enemy-event
  presentation still correctly held the input lock. The smoke now waits for the
  end-turn control to re-enable before continuing.
- Mobile layout red: visual inspection showed duplicate selected-unit HUD text
  and clipped Russian controls; the new 640x360 metric assertion failed because
  one or more 44px/14px controls overflowed before responsive flex weighting.

## Final green gate

- `npm run format:check` — all matched files use Prettier style.
- `npm run typecheck` — TypeScript project references completed with no errors.
- `npm test` — 8 files, 19 unit/contract tests passed.
- `npm run build` — Vite production build completed successfully.
- `npm run test:browser` — 3 Chromium smoke flows passed.
- `npm run preview -- --host 127.0.0.1 --port 4174` plus
  `node scripts/capture-screenshots.mjs` — the SDK-free production build was
  exercised at 1280x720 and touch-enabled 640x360; both screenshots were
  inspected after capture.
