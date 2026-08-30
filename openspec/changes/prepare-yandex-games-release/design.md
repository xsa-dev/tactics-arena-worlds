## Context

`validate-tactical-battle-prototype` produced a deterministic playable with a pure TypeScript core, Phaser presentation, local/Yandex platform adapters, local analytics export, responsive desktop/mobile UI, and a frozen product-study protocol. The build is not yet a release candidate: independent review found three implementation/spec gaps, monetization is intentionally absent, and release packaging, catalog assets, draft qualification, and moderation evidence do not exist.

Yandex Games requires an integrated SDK, correct Game Ready timing, a finished playable experience, monetization, platform-appropriate behavior, and a compliant archive.[1][2][4] The first public submission is a full moderation that officially targets 3–5 working days, although the current documentation warns that actual queues may be longer.[3]

Stakeholders are the developer/operator, playtest facilitator, Yandex moderation, and players on desktop and mobile landscape. The release process MUST preserve the frozen battle rules and must not accidentally turn publication work into campaign/economy development.

## Goals / Non-Goals

**Goals:**

- Close every accepted independent-review blocker with automated evidence.
- Produce a Yandex-compatible runtime and a deterministic, inspectable release package.
- Add the smallest compliant monetization surface without contaminating the battle itself.
- Prepare exact catalog copy/assets and qualify an uploaded draft on declared platforms.
- Separate a private `study-draft` from the later monetized `catalog-release` so Gate B remains interpretable.
- Make public submission and publication explicit human-controlled gates.

**Non-Goals:**

- Campaign, progression, inventory, economy, cloud saves, leaderboards, purchases, rewarded power, PvP, multiple worlds, additional maps, live operations, or backend services.
- Any advertisement during an active battle or any monetization during the 15-session study cohort.
- Automatic login, automatic moderation submission, or automatic public publication.
- Changing the frozen map, balance, AI, onboarding experiment structure, replay CTA, or primary product metric except for the specifically approved role-ability clarification.

## Decisions

### 1. Use two explicit release profiles

The build pipeline SHALL accept only:

- `study-draft`: SDK enabled, advertisements disabled, frozen Gate B build; uploadable for private draft testing but not eligible for public release.
- `catalog-release`: SDK enabled, one post-battle fullscreen advertisement enabled, built only after a `GO_NEXT_GATE` product verdict; eligible for moderation and publication.

The profile, semantic build version, Git commit, UTC build time, and content-freeze identifiers SHALL be embedded in `release-manifest.json` and exposed to analytics. This avoids silently testing one product and publishing another.

Alternative considered: one build with a runtime query switch. Rejected because a user-modifiable switch can contaminate cohort data and makes the submitted artifact non-deterministic.

### 2. Keep the deterministic battle core untouched

Release work SHALL not modify `src/core` behavior except for a separately approved defect with a new failing regression test. Onboarding, lifecycle, ads, packaging, and operator tooling stay in presentation/platform/release layers.

Alternative considered: adding progression or a second scenario to improve perceived completeness. Rejected because it invalidates the accepted experiment and substantially increases moderation risk.

### 3. Make interactivity a real readiness barrier

`game_loaded` and `LoadingAPI.ready()` SHALL be emitted once only after all of these are true:

1. the platform adapter has completed initialization or selected its defined fallback;
2. the Phaser battle scene has completed `create()` and rendered its first snapshot;
3. DOM controls and orientation blocking are wired;
4. onboarding/result overlays have an initialized state;
5. a legal player command can be accepted when no overlay or lifecycle pause blocks input.

A single `markInteractive()` coordinator SHALL own both the product event and platform notification. Constructors MUST NOT emit readiness events. Readiness does not start measured gameplay: after `LoadingAPI.ready()`, the runtime enters `startup-awaiting`. It authorizes `battle_started`, the active-duration clock, input, and `GameplayAPI.start()` only after onboarding is dismissed and either (a) a startup `game_api_pause` has been followed by `game_api_resume`, or (b) no startup pause has been observed during a fixed 1000 ms quiet window. A pause observed inside that quiet window cancels the timer and requires resume. This prevents Yandex's platform-controlled startup fullscreen advertisement from overlapping an already measured battle.[7]

Alternative considered: retain constructor-time `game_loaded`. Rejected because object construction does not prove that the user can interact.

### 4. Expose facilitator operations through an explicit host API

A typed `window.__TACTICS_OPERATOR__` API SHALL operate on explicit observation-session identifiers and support:

- `provideHelp(sessionId, helpType, helpReason)`;
- `requestHelp(sessionId)` only when the player explicitly asks the facilitator outside the ordinary Rules UI;
- `abandonSession(sessionId, reason)` where reason is `user_left`, `technical_failure`, or `facilitator_ended`;
- `setTesterMetadata(sessionId, ...)` before `battle_started`;
- repeatable `exportSnapshot(sessionId)` that does not lock the session;
- exactly-once `finalizeSession(sessionId)` allowed only after terminal completion or abandonment and returning the final locked JSON;
- read-only inspection of sanitized analytics and current identifiers.

The operator lifecycle is a closed transition table:

| State | Allowed writes/transitions | Rejected operations |
|---|---|---|
| `prestart` | tester metadata, snapshot; readiness may transition to `active` | help request/provision, abandonment, finalization |
| `active` | help request/provision, snapshot, abandonment to `abandoned`, terminal result to `terminal` | metadata edits, finalization |
| `terminal` | snapshot, finalization, replay | help request/provision, abandonment, metadata edits |
| `abandoned` | snapshot, finalization | help request/provision, replay, metadata edits, repeated abandonment |
| `finalized` | read-only inspection, snapshot/final export, idempotent repeated finalization | every write and state transition |

Abandonment before `battle_started` is rejected and does not create `battle_abandoned`. Replay from `terminal` atomically appends `replay_clicked`, finalizes the completed observation record exactly once, and then creates a new `prestart` observation with new `sessionId` and `battleId`; the immutable old record remains addressable by its session ID and a later `finalizeSession(oldSessionId)` returns identical bytes. Finalization never consumes or mutates analytics and cannot include later events. Snapshot export from `prestart`, `active`, `terminal`, or `abandoned` returns a non-locking view with `exportFinalized=false`; snapshot export for `finalized` returns the same frozen bytes as final export with `exportFinalized=true`. Final export includes `exportFinalized`, `battleCompleted`, `abandoned`, `abandonReason`, `technicalExclusionCandidate`, and `independentCompletion`; only a terminal battle completed without gameplay help can have `independentCompletion=true`. No facilitator controls are shown to ordinary players. Browser contract tests SHALL prove every allowed/rejected table cell, technical-help eligibility, gameplay-help invalidation, request-without-help, abandonment fields, replay rollover, immutable final bytes, and that opening Rules does not automatically imply a help request.

Alternative considered: visible facilitator buttons. Rejected because they could confuse players and alter the study.

### 5. Clarify abilities inside the fixed six-step onboarding

Step 5 SHALL name all role/effect pairs in both languages:

- Scout / Разведчик — Aimed Shot / Точный выстрел: 4 AP, 4 damage, range 5, ignores half-cover;
- Gunner / Стрелок — Burst / Очередь: 5 AP, damages the target and orthogonally adjacent Raiders, cover applied per target;
- Medic / Медик — Medkit / Аптечка: 3 AP, heals 4 HP within range 3, no overheal.

The modal MAY scroll internally at 640×360, but the battle page MUST NOT scroll. The copy and six-step order are frozen after acceptance.

### 6. Isolate advertisements behind `AdvertisingService`

The domain core and `BattleSession` SHALL not call Yandex advertising APIs. `AdvertisingService` owns a state machine:

`idle -> requesting -> opened? -> awaiting-close -> terminal -> idle`.

Only `catalog-release` can request `ysdk.adv.showFullscreenAdv`. The request occurs at most once per terminal battle, after `battle_finished` and before the next battle starts, at a post-battle logical pause. The result/replay screen remains recoverable if advertising is unavailable, blocked, errors, or closes without display.

Every request receives a monotonically increasing token. `onError` records an error candidate but is not terminal because Yandex may call `onClose` afterward.[6] Terminal precedence is: `onClose(true) -> shown`; `onClose(false)` after an error candidate -> `error`; `onClose(false)` without error -> `not_shown`; local timeout before close -> `error` when an error candidate exists, otherwise `timeout`. The first terminal result wins; duplicate or late callbacks for a completed/stale token are ignored. Pause acquisition occurs once when requesting starts and release occurs once at terminal arbitration, so callback combinations cannot double-resume. During the request, input, presentation sequencing, audio, and active-duration clocks are paused using the existing lifecycle coordinator. No rewarded ads, purchases, extra AP, resurrection, or pay-to-continue exist.

Alternative considered: interstitial each round. Rejected because it interrupts the core loop and violates the logical-pause intent.

### 7. Preserve local fallback without masking release qualification

Localhost, automated tests, and `study-draft` SHALL remain playable if the SDK is absent. The adapter records `platformKind` and `sdkFallbackReason`. A `catalog-release` draft qualification SHALL fail if the SDK did not initialize, `LoadingAPI.ready()` was not observed, language was not sourced from the SDK, or the fullscreen advertisement mock/real test did not complete.

The archive-hosted SDK path remains `/sdk.js`, which is the recommended relative path for Yandex-hosted archives.[4] No absolute Yandex S3 SDK URL is bundled.

Testing is split by trust boundary. Pure local-adapter tests prove SDK absence and zero monetization calls. Injected SDK contract/unit tests instantiate the Yandex adapter with deterministic callback fakes. Packaged browser tests use an unchanged artifact served under a mapped non-local hostname and inject host-provided `window.YaGames` before application code, matching the platform boundary without a runtime query switch. Yandex-hosted qualification MUST observe real loader/Game Ready/language/lifecycle behavior and one real fullscreen request outcome, but only injected tests are required to force error, timeout, duplicate, and late-callback branches.

### 8. Give one coordinator ownership of GameplayAPI intent

The application gameplay coordinator, not individual platform event handlers or UI components, owns direct `GameplayAPI.start()` and `stop()` calls. It derives one desired state from source-aware blockers: `startup`, `onboarding`, `rules`, `result`, `ad`, and `platform`. It calls `start()` only on a transition from blocked to unblocked after measured battle start is authorized, and calls `stop()` only on a transition from unblocked to blocked. SDK `game_api_pause/resume` handlers update the platform blocker and runtime pause state but MUST NOT directly call GameplayAPI because Yandex synchronizes those events with GameplayAPI itself.[7][8]

Onboarding and Rules are non-gameplay: onboarding dismissal can authorize the first `battle_started`/`start()` only after startup settling; opening Rules during an active battle causes one manual `stop()`; closing Rules causes one `start()` only when no other blocker remains. Victory/defeat causes one `stop()` and the result screen remains stopped. A game-initiated post-battle ad does not add another stop if terminal/result already owns a blocker. Replay begins a new battle and calls `start()` only after result/ad/platform blockers are all clear. This ownership table is verified against the Yandex debug gameplay indicator.

### 9. Declare a no-progression save policy

This release has no persistent player progression, records, unlocks, achievements, inventory, or purchases. It SHALL persist only onboarding dismissal and non-gameplay preferences locally. Refreshing during a battle starts a new deterministic battle and this limitation SHALL be disclosed in the developer comment. Adding progression or purchases requires a future save capability and new OpenSpec change.

### 10. Generate and validate the release package

A release script SHALL use `SOURCE_DATE_EPOCH` equal to the source commit timestamp, derive the manifest build time from that epoch, sort archive entries lexicographically, normalize ZIP entry timestamps to the epoch and file modes to fixed values, and exclude nondeterministic caches/reports from the archive. It SHALL:

1. run clean install/lockfile verification, formatting, typecheck, unit/contract tests, browser tests, and production build;
2. reject unexpected absolute external URLs and forbidden monetization APIs;
3. validate that all archive paths are ASCII and space-free;
4. validate exactly one root `index.html` and uncompressed total below 100 MB;[1][2]
5. write `release-manifest.json` and SHA-256 checksums;
6. create ZIP from the contents of `dist/`, not from the directory wrapper;
7. build twice from separate clean temporary checkouts using the same epoch and compare application file lists, bytes, manifest, ZIP entry metadata/order, and final SHA-256 exactly;
8. unpack into a temporary directory and rerun a static-server smoke test.

Artifacts SHALL go under `artifacts/releases/<version>/` and generated archives SHALL not be committed unless explicitly chosen.

### 11. Treat catalog content as versioned release input

Russian and English catalog data SHALL be stored as machine-readable files and validated for required fields and current Console limits. Visuals SHALL include a 512×512 PNG icon, 800×470 PNG cover, and representative 16:9 screenshots with a 1280–2560 pixel long side.[5] Media MUST show actual game content, contain no browser/OS/Yandex chrome, avoid clipped text, frames, and rounded corners, and use the same title as the draft.

### 12. Require evidence-based draft qualification

Draft qualification produces a dated report containing:

- archive identity and checksums;
- Yandex game/draft ID;
- debug-panel SDK and Game Ready observations;
- language checks for `ru` and `en`;
- desktop/mobile landscape, portrait blocker, focus/pause, ad close/error, replay, and console-error results;
- tested browser/OS/device matrix;
- screenshots or recordings for failures and final passes;
- unresolved deviations.

A failed required check blocks moderation. Automated local tests are necessary but do not substitute for the Yandex-hosted draft.

### 13. Separate qualification, moderation, and publication decisions

The pipeline has ordered gates:

1. `RELEASE_CANDIDATE_GO`: all local release specs/tests/package checks pass.
2. `STUDY_DRAFT_GO`: Yandex-hosted `study-draft` passes SDK/debug/platform checks.
3. `PRODUCT_GO_NEXT_GATE`: Gate B returns exactly `GO_NEXT_GATE`.
4. `CATALOG_CANDIDATE_GO`: monetized `catalog-release` passes draft qualification.
5. `SUBMIT_MODERATION`: explicit user action.
6. `PUBLISH`: only after approval; delayed publication is the default recommendation.

Any earlier `TOP_UP_DATA`, `PIVOT_UI`, `NOT_GO_CURRENT_CORE/PIVOT_CORE`, or `NOT_GO` blocks public submission. Private draft testing remains allowed.

## Risks / Trade-offs

- **[Risk] Ads alter replay intent** → Keep ads disabled in `study-draft`; create `catalog-release` only after Gate B.
- **[Risk] SDK fallback hides a broken integration** → Record fallback reason and make any fallback a qualification failure for catalog release.
- **[Risk] Game appears unfinished despite technical compliance** → Add a manual visual-quality gate for the game and every catalog asset.
- **[Risk] Large Phaser bundle delays first interaction** → Record load timing on target devices and optimize only if the acceptance threshold is missed; do not refactor core preemptively.
- **[Risk] Moderation requirements change** → Store the checked documentation date and re-run the checklist immediately before submission.
- **[Risk] Human-entered catalog data drifts from the build** → Version catalog JSON and validate title/languages/build profile against the release manifest.
- **[Risk] Operator API is abused by game code** → Keep it write-limited, enum-validated, non-discoverable in player UI, and covered by contract tests.
- **[Risk] A rejected moderation attempt causes cooldown** → Use delayed publication, test the draft/debug panel thoroughly, and submit only after both release reviews return GO.

## Migration Plan

1. Finish the currently RED regression tests for the three accepted review blockers.
2. Restore the playable baseline to full green and re-review it.
3. Add release configuration and manifest generation without ads.
4. Implement/verify SDK readiness and operator API.
5. Build and qualify `study-draft`; freeze and run Gate B.
6. If and only if Gate B returns `GO_NEXT_GATE`, implement post-battle fullscreen advertising behind `AdvertisingService`.
7. Produce catalog metadata/assets and `catalog-release` ZIP.
8. Upload and qualify the monetized draft with debug-panel evidence.
9. Obtain independent product and technical GO.
10. Submit with delayed publication; after approval, perform a final smoke check and publish manually.

Rollback: retain the last qualified ZIP, manifest, checksums, catalog payload, and draft evidence. If a catalog candidate fails, restore the last qualified draft archive; never replace the public game with `study-draft` or an unqualified build.

## Open Questions

- Final developer/publisher display name for the catalog card.
- Whether the public title remains `Арена тактики: Пустошь` / `Tactics Arena: Wasteland` or uses one untranslated global title.
- Exact Yandex draft/game ID after the user creates the Console entry.
- Whether the user wants automatic publication or delayed publication; this design recommends delayed publication.
- Which real Android and iOS devices are available for final qualification.

## Sources

[1] https://yandex.ru/dev/games/doc/ru/console/add-new-game — Загрузка игры
[2] https://yandex.ru/dev/games/doc/ru/concepts/requirements — Требования к игре
[3] https://yandex.ru/dev/games/doc/ru/concepts/moderation — Модерация
[4] https://yandex.ru/dev/games/doc/ru/sdk/sdk-about — Подключение SDK
[5] https://yandex.ru/dev/games/doc/ru/console/add-new-game/draft — Заполнение черновика
[6] https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv — Реклама SDK
[7] https://yandex.ru/dev/games/doc/ru/sdk/sdk-events — События SDK
[8] https://yandex.ru/dev/games/doc/ru/sdk/sdk-game-events — Game Ready и GameplayAPI
