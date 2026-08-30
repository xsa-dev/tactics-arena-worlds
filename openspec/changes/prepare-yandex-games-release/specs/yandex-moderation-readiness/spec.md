## ADDED Requirements

### Requirement: Console prerequisites and draft identity are recorded
Before draft upload, the release operator SHALL confirm access to the Yandex Games developer Console and RSA account, create a dedicated new game draft, and record the developer account, immutable game/draft ID, release profile, and archive checksum in a qualification report.[1]

#### Scenario: New draft is created
- **WHEN** the operator selects Add game in the Console
- **THEN** a new draft ID is recorded and is not a reused draft of a different previously published game

#### Scenario: Account or identity is missing
- **WHEN** developer/RSA access, game ID, profile, or archive checksum is not recorded
- **THEN** draft qualification remains blocked

### Requirement: Uploaded draft is tested with platform tooling
The operator SHALL open the exact uploaded archive in draft mode and with the Yandex debug panel, and SHALL record SDK loader initialization, Game Ready, locale, lifecycle, advertising policy, console errors, and release-manifest identity.[3][4]

#### Scenario: Study draft is qualified
- **WHEN** the `study-draft` archive is opened with the debug panel
- **THEN** SDK initialization, `LoadingAPI.ready()`, SDK locale, lifecycle, frozen battle, analytics export, and disabled-for-study ad policy are verified against its manifest

#### Scenario: Catalog release is qualified
- **WHEN** the `catalog-release` archive is opened with the debug panel
- **THEN** SDK initialization, Game Ready, SDK locale, pause/resume, one actual inventory-dependent fullscreen-request outcome, result/replay recovery, and manifest identity pass, and checksum-bound injected-SDK evidence covers shown, not-shown, error, timeout, duplicate, and stale-callback branches without changing artifact bytes

#### Scenario: Draft differs from local build
- **WHEN** a checksum/version/profile mismatch or Yandex-hosted-only error is observed
- **THEN** local evidence is rejected and the exact uploaded archive must be fixed and requalified

### Requirement: Declared platform matrix is fully exercised
The draft SHALL be tested on every platform declared in the Console. For the initial release this SHALL include desktop and mobile landscape, Russian and English, mouse and touch, 640×360 minimum landscape, portrait rotation blocking, resize, focus loss/resume, and the supported browser/device matrix available to the operator.[2][3]

#### Scenario: Desktop matrix passes
- **WHEN** the draft is tested on declared desktop browsers
- **THEN** board/HUD/actions fit, mouse flow completes, focus pause is idempotent, no page scroll/context menu appears, and no blocking console error occurs

#### Scenario: Mobile matrix passes
- **WHEN** the draft is tested on declared Android/iOS or documented equivalents at landscape sizes including 640×360
- **THEN** touch flow completes with 44×44 controls and 14px text, safe areas are respected, portrait blocks commands with localized rotation UI, and orientation changes do not corrupt the session

#### Scenario: Declared platform lacks evidence
- **WHEN** any selected Console platform/browser/device class has no dated pass evidence
- **THEN** the platform must be removed from the draft or tested before moderation

### Requirement: Draft qualification evidence is auditable
Each qualification run SHALL produce a dated report linked to one manifest/checksum and containing tester/operator, Yandex ID, environment, test cases, event/log exports, screenshots or recordings, console output, pass/fail status, and unresolved deviations.

#### Scenario: Qualification succeeds
- **WHEN** every required draft scenario passes for one unchanged archive
- **THEN** the report records `STUDY_DRAFT_GO` or `CATALOG_CANDIDATE_GO` for that exact artifact

#### Scenario: Evidence is partial or references multiple builds
- **WHEN** logs/screenshots/results cannot be bound to one checksum or required cases are omitted
- **THEN** the report is invalid and no GO verdict is permitted

### Requirement: Product study gates public release
A `study-draft` MAY be uploaded and privately tested before Gate B, but a `catalog-release` MUST NOT be submitted for public moderation unless the complete 15-session study produces exactly `GO_NEXT_GATE` under `validate-tactical-battle-prototype`.[3]

#### Scenario: Study verdict is GO_NEXT_GATE
- **WHEN** the exact 8-mobile/7-desktop valid cohort and decision matrix produce `GO_NEXT_GATE`
- **THEN** work may proceed to the monetized catalog candidate and public-release qualification

#### Scenario: Study needs data or pivots/stops
- **WHEN** the verdict is `TOP_UP_DATA`, `PIVOT_UI`, `NOT_GO_CURRENT_CORE/PIVOT_CORE`, or `NOT_GO`
- **THEN** public moderation submission remains blocked and only the actions authorized by that verdict may proceed

### Requirement: Moderation submission is explicit and fail-closed
Only a catalog candidate with release, product, package, platform, security, and independent-review GO evidence MAY be submitted. Submission SHALL be a deliberate operator action, not an automated side effect.[1][3]

#### Scenario: All submission prerequisites pass
- **WHEN** the release checklist references one unchanged catalog archive and all required GO verdicts
- **THEN** the operator may click `Отправить на модерацию` and record submission time/status

#### Scenario: Any prerequisite is missing
- **WHEN** a test/review/product/platform/asset/checksum gate is failed, missing, or stale
- **THEN** submission is blocked even if the Console enables the button

### Requirement: Delayed publication is the default release control
The draft SHALL use delayed publication unless the user explicitly records a different decision. Approval by moderation SHALL not automatically publish when delayed publication is enabled.[1][3]

#### Scenario: Moderation approves delayed release
- **WHEN** the Console status becomes `Проверен`
- **THEN** the operator performs a final smoke and metadata check before manually selecting `Опубликовать`

#### Scenario: Automatic publication is requested
- **WHEN** the user explicitly chooses automatic publication
- **THEN** the decision, rationale, candidate checksum, and accepted risk are recorded before submission

### Requirement: Rejection and resubmission preserve evidence
If moderation rejects the game, the release operator SHALL record every cited requirement, supplied screenshot/recording, affected artifact, fix change, and new candidate checksum. A rejected artifact MUST NOT be resubmitted unchanged.

#### Scenario: Moderation rejects the draft
- **WHEN** the Console status becomes `Отклонен`
- **THEN** a release issue list is created from the official reasons, each fix receives a regression test or evidence scenario, and a new candidate undergoes all impacted gates

#### Scenario: Resubmission is prepared
- **WHEN** fixes are complete
- **THEN** the operator rechecks applicable requirements and cooldown, qualifies the new checksum, and only then resubmits

## Sources

[1] https://yandex.ru/dev/games/doc/ru/console/add-new-game — Загрузка игры
[2] https://yandex.ru/dev/games/doc/ru/concepts/requirements — Требования к игре
[3] https://yandex.ru/dev/games/doc/ru/concepts/moderation — Модерация
[4] https://yandex.ru/dev/games/doc/ru/sdk/sdk-about — Подключение SDK
