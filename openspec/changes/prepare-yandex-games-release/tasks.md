## 1. Restore and close the accepted playable review

- [x] 1.1 Preserve the current working tree, record the playable baseline commit/status, and confirm that the only intentional RED tests are the new onboarding/readiness/operator regressions.
- [x] 1.2 RED→GREEN: first add/run the failing bilingual role/cost/target/effect/cover tests, then implement only the Aimed Shot, Burst, and Medkit onboarding copy needed to pass.
- [x] 1.3 RED→GREEN: first add/run a failing 640×360 browser readability/no-page-scroll assertion, then make the minimum modal layout change and rerun targeted/full tests.
- [x] 1.4 RED→GREEN: first add/run readiness contract/browser tests proving once-only success and suppression on partial/failed startup, then remove constructor-time `game_loaded` and implement the minimal shared render/DOM/overlay/orientation/input barrier.
- [x] 1.5 RED→GREEN one transition at a time: first add/run failures for every allowed/rejected `prestart`, `active`, `terminal`, `abandoned`, and `finalized` operation—including technical/gameplay help, explicit request, abandonment reasons, metadata lock, nonfinal snapshots with `exportFinalized=false`, byte-identical finalized snapshots with `exportFinalized=true`, replay rollover, immutable old-session bytes, exactly-once finalization, and invalid IDs/enums/order—then implement only the transition needed for each GREEN step.
- [x] 1.6 RED→GREEN: first add/run a regression proving Rules emits only `rules_opened`, then remove its automatic `help_requested` emission and verify exported eligibility fields remain deterministic.
- [x] 1.7 Run formatter, strict typecheck, all unit/contract tests, all existing browser flows, production build, strict validation of `validate-tactical-battle-prototype`, and desktop/640×360 visual inspection.
- [x] 1.8 Obtain independent OpenSpec-compliance and code-quality GO reviews of all tracked and untracked playable changes; leave original study tasks 6.1–6.5 unchecked.

## 2. Release profiles, manifest, and qualification model

- [x] 2.1 Write failing tests for the allowed `study-draft` and `catalog-release` profiles, unknown-profile rejection, and mandatory freeze identifiers.
- [x] 2.2 Implement typed release configuration with compile-time constants for profile, version, ad policy, publication eligibility, scenario/onboarding/replay freeze IDs, and analytics schema version.
- [x] 2.3 RED→GREEN: first add/run manifest schema/determinism tests, then generate `release-manifest.json` with source commit, canonical UTC time derived from `SOURCE_DATE_EPOCH`, Node/npm versions, profile, freeze IDs, supported platforms/languages/orientation, ad/save policies, and fixed evidence references.
- [x] 2.4 Update analytics context/export so every release event and session summary carries manifest version/profile rather than the hardcoded `0.1.0-frozen` string.
- [x] 2.5 Add a fail-closed command that refuses release packaging for a dirty source tree, inconsistent lockfile, missing source commit, unknown profile, or incomplete manifest.

## 3. Yandex SDK and lifecycle release integration

- [x] 3.1 RED→GREEN: first add/run adapter contract tests for LoadingAPI, GameplayAPI, lifecycle events, environment language, and fullscreen callback signatures; then extend only the required SDK types/fakes without purchase/rewarded APIs.
- [x] 3.2 Add tests proving archive builds load `/sdk.js` before `YaGames.init()`, while localhost/automated tests use the local adapter without attempting SDK or monetization calls.
- [x] 3.3 RED→GREEN: first add/run tests that SDK `i18n.lang` controls `ru`, Russian variants, and English fallback in release profiles, then remove release query-language overrides while retaining explicit overrides only in local/test mode.
- [x] 3.4 RED→GREEN: first add/run tests that every SDK/local fallback has a machine-readable reason and blocks `catalog-release` GO, then implement the minimum reason/qualification contract.
- [x] 3.5 RED→GREEN: first add/run failures for onboarding, 1000 ms startup quiet window, startup pause/resume, Rules, result, replay, and overlapping SDK/focus/visibility blockers; then implement one GameplayAPI owner and source-aware lifecycle coordinator with no direct GameplayAPI calls from SDK pause/resume handlers.
- [x] 3.6 Verify transition-table call counts: no start during onboarding, one start when the first battle becomes unblocked, one stop/start around Rules only when all blockers clear, one stop at terminal, and no duplicate call from overlap.
- [x] 3.7 RED→GREEN: first add/run a failing startup-error test for missing controls/scene failure and suppressed readiness, then implement the localized recoverable state.

## 4. No-progression save policy

- [x] 4.1 Inventory all persistent values and add tests proving this release stores only onboarding dismissal and explicitly declared non-gameplay preferences.
- [x] 4.2 Verify refresh/orientation behavior and document that refreshing an active battle starts a new deterministic battle with no claim of saved battle progress.
- [x] 4.3 Add a release assertion that cloud-save, progress, achievement, inventory, purchase, or unlock declarations cannot be enabled for this build.

## 5. Reproducible study-draft package

- [x] 5.1 Write failing archive-validator tests for missing/duplicate/non-root `index.html`, `dist/` wrapper, non-ASCII/space-containing paths, forbidden absolute hosts, and an uncompressed size of 100 MB or more.
- [x] 5.2 RED→GREEN: first add/run a two-clean-checkout reproducibility test; then implement `SOURCE_DATE_EPOCH` from commit time plus normalized manifest time, ZIP entry order, timestamps, and modes under `artifacts/releases/<version>/`.
- [x] 5.3 Generate SHA-256 checksums for the ZIP and extracted application files and verify that mutation invalidates qualification evidence.
- [x] 5.4 Add a temporary-unpack/static-server smoke that checks asset loading, interactive readiness, console/page errors, and one critical battle flow from the packaged artifact.
- [x] 5.5 Build `study-draft`, prove advertising is disabled and SDK integration remains enabled, and bind all test/build/review evidence to its manifest/checksum.
- [x] 5.6 Upload the exact study ZIP to a newly created Yandex draft only after the user confirms developer Console/RSA access; record developer account, immutable game ID, checksum, and draft URL without storing credentials. (`ID: 633082`, `https://yandex.ru/games/app/633082?draft=true`, ZIP SHA-256 `1b0301bd4cdf422b8dcead691f977c0842098a1786f03c8b331f9270d563044b`)
- [ ] 5.7 Qualify the Yandex-hosted study draft with the debug panel for SDK initialization, Game Ready, SDK locale, lifecycle, local JSON export, ru/en, mouse/touch, 640×360 landscape, and portrait rotation blocking.

## 6. Separate product-study prerequisite

- [ ] 6.1 Complete the still-open study tasks 6.1–6.5 in `validate-tactical-battle-prototype` against the exact qualified `study-draft`, including facilitator materials, exactly 15 valid sessions (8 mobile and 7 desktop), help records, reproducible eligibility, and one allowed verdict.
- [ ] 6.2 Record the study artifact checksum, cohort iteration, exported-session validation, and exact verdict in the release qualification report.
- [ ] 6.3 Block all catalog-ad implementation/submission when the verdict is `TOP_UP_DATA`, `PIVOT_UI`, `NOT_GO_CURRENT_CORE/PIVOT_CORE`, or `NOT_GO`; proceed only for exactly `GO_NEXT_GATE`.

## 7. Post-battle fullscreen advertising after product GO

- [ ] 7.1 After `GO_NEXT_GATE`, RED→GREEN one state transition at a time for `AdvertisingService`: idle→requesting, optional opened/showing, and each terminal return to idle.
- [ ] 7.2 RED→GREEN: first prove one request token per terminal battle and no request during onboarding, Rules, player/enemy phases, pause, or nonterminal state; then implement local/Yandex adapters with no automatic retry.
- [ ] 7.3 RED→GREEN: first exercise `onError→onClose(true)`, `onError→onClose(false)`, close(false), timeout with/without prior error, duplicate callbacks, and stale tokens; then implement first-terminal-wins arbitration and exactly-once pause release.
- [ ] 7.4 RED→GREEN: first add/run integration failures for post-`battle_finished` ordering, recoverable result/replay, and platform-controlled startup advertising via lifecycle only; then wire the minimum catalog request boundary.
- [ ] 7.5 RED→GREEN: prove request/open pauses input/audio/presentation/active time and terminal arbitration resumes once without replaying core events.
- [ ] 7.6 RED→GREEN: first add/run analytics failures for enabled catalog events and zero study ad calls/events with summary policy `disabled_for_study`; then implement the minimum analytics behavior and rerun targeted/full suites.
- [ ] 7.7 Add static/runtime spies proving the release contains and calls no rewarded-ad, purchase, payment, extra-AP, resurrection, pay-to-continue, or external-commerce API.
- [ ] 7.8 Run deterministic injected-SDK Playwright flows against the unchanged artifact under a mapped non-local hostname for shown, not-shown, error, timeout, duplicates, locale, lifecycle, replay, and unchanged core; keep pure local fallback tests separate.

## 8. Catalog copy and promotional assets

- [ ] 8.1 Ask the user to freeze publisher display name, global/localized title strategy, age rating, target release countries, and delayed-versus-automatic publication; record decisions without guessing.
- [ ] 8.2 Define and test a machine-readable catalog schema covering common technical fields plus Russian/English title, short description, about, how-to-play, SEO, category/tags, orientation, platforms/languages, monetization/save flags, and developer comment.
- [ ] 8.3 Draft truthful Russian and English metadata that describes only the shipped one-battle tactics experience and validates short description ≤70 characters, about/how-to-play 100–1000, and SEO 50–160.
- [ ] 8.4 Create a truthful 512×512 24-bit PNG icon and 800×470 24-bit PNG cover with the frozen post-apocalyptic theme and no OS/browser/Yandex chrome, frames, rounded corners, clipped text, or unshipped mechanics.
- [ ] 8.5 Capture representative 16:9 desktop/mobile gameplay screenshots at 1280–2560 pixels on the long side from the exact catalog candidate.
- [ ] 8.6 Add automated media validation for dimensions, format, color mode, aspect ratio, filenames, and manifest hashes.
- [ ] 8.7 Conduct an independent visual/copy review against the exact build and resolve every title, localization, truthfulness, readability, or quality blocker.

## 9. Catalog-release package and local qualification

- [ ] 9.1 Build the `catalog-release` profile only after tasks 6.1–6.3 authorize it and verify its manifest enables only post-battle fullscreen advertising.
- [ ] 9.2 Run formatting, strict typecheck, full unit/contract/browser suites, production build, archive validation, unpacked static smoke, dependency/security audit, and strict validation of both OpenSpec changes.
- [ ] 9.3 Exercise and capture desktop, 640×360 touch landscape, portrait blocker, ru/en, terminal/replay, ad close/no-fill/error/timeout, and focus/lifecycle flows from the packaged artifact.
- [ ] 9.4 Produce final ZIP, manifest, checksums, catalog payload, media hashes, test logs, screenshots, and local qualification report in one immutable release directory.
- [ ] 9.5 Obtain independent product/release-spec and technical/security GO reviews tied to the exact source commit and ZIP checksum.

## 10. Yandex catalog-draft qualification

- [ ] 10.1 Upload the exact catalog ZIP and corresponding Russian/English fields/assets to the recorded Yandex game draft; record checksum and Console revision.
- [ ] 10.2 With the debug panel, verify SDK loader state, `YaGames.init()`, SDK language, `LoadingAPI.ready()`, GameplayAPI/lifecycle, and zero blocking console/network errors.
- [ ] 10.3 On the exact Yandex-hosted artifact, observe one real fullscreen request and its actual inventory-dependent outcome plus pause/result/replay recovery; rely on injected-SDK contract/browser evidence—not production query switches—to cover every forced error/timeout/duplicate branch.
- [ ] 10.4 Execute and record the declared desktop browser matrix and available real Android/iOS landscape/touch matrix, including minimum viewport, safe areas, orientation, focus, and long-tap/context-menu behavior.
- [ ] 10.5 Bind logs, JSON exports, screenshots/recordings, device/browser versions, operator, date, and every pass/fail result to the exact catalog ZIP checksum.
- [ ] 10.6 Resolve every failed draft check with a regression test/evidence update and repeat only against a newly checksummed artifact until `CATALOG_CANDIDATE_GO`.

## 11. Moderation and controlled publication

- [ ] 11.1 Run a final submission checklist proving `RELEASE_CANDIDATE_GO`, `GO_NEXT_GATE`, `CATALOG_CANDIDATE_GO`, complete metadata/assets, unchanged checksum, and zero unresolved independent-review blockers.
- [ ] 11.2 Enable delayed publication by default; if the user chooses automatic publication, record the explicit decision, rationale, checksum, and accepted risk.
- [ ] 11.3 After explicit user approval, submit the qualified draft to moderation and record submission time, Console status, and candidate checksum.
- [ ] 11.4 If rejected, record each official requirement/reproduction asset, add a failing regression or evidence case, produce a new candidate/checksum, respect the moderation cooldown, and requalify before resubmission.
- [ ] 11.5 If approved with delayed publication, perform a final catalog-card and playable smoke check, confirm the approved checksum/profile, and ask for explicit user approval before clicking `Опубликовать`.
- [ ] 11.6 Record the final public URL, publication time, release manifest, and post-release monitoring baseline without treating publication itself as evidence of retention or product-market fit.
