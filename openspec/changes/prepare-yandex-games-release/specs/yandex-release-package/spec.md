## ADDED Requirements

### Requirement: Production build is reproducible
The release pipeline SHALL use the committed lockfile and an explicit release profile, SHALL set `SOURCE_DATE_EPOCH` to the source commit timestamp, SHALL derive manifest build time from that epoch, and SHALL normalize archive entry order, timestamps, and modes so two clean builds of the same source/profile produce byte-identical application files, manifest, and ZIP SHA-256.

#### Scenario: Clean release build is executed
- **WHEN** the pipeline runs from a clean checkout with the accepted lockfile and profile
- **THEN** dependency install, formatting check, typecheck, unit/contract tests, browser tests, and production build complete before packaging

#### Scenario: Working tree or lockfile is inconsistent
- **WHEN** source changes are uncommitted, the lockfile would change, or dependency installation reports an unresolved integrity problem
- **THEN** production packaging fails and identifies the inconsistent input

#### Scenario: Two clean builds are compared
- **WHEN** the same source commit, lockfile, profile, and `SOURCE_DATE_EPOCH` are built in two separate clean temporary checkouts
- **THEN** application file lists/bytes, manifest bytes, lexicographically ordered ZIP entries, fixed modes/timestamps, and final ZIP checksum are identical

#### Scenario: Nondeterministic output is detected
- **WHEN** either build contains a differing byte, timestamp, mode, entry order, generated identifier, cache, or report
- **THEN** reproducibility fails and no release archive is qualified

### Requirement: Yandex archive structure is compliant
The generated ZIP SHALL contain exactly one `index.html` at its root, SHALL package the contents of `dist/` without a `dist/` directory wrapper, SHALL use only ASCII space-free file/directory names, and SHALL be below 100 MB uncompressed.[1][2]

#### Scenario: Valid archive is generated
- **WHEN** the production output meets all structural constraints
- **THEN** the pipeline creates `artifacts/releases/<version>/<slug>-<version>.zip` and archive inspection confirms root `index.html`, valid paths, and measured compressed/uncompressed sizes

#### Scenario: Archive contains invalid structure or path
- **WHEN** `index.html` is missing/not root/duplicated, a path contains spaces/non-ASCII characters, or uncompressed size is 100 MB or more
- **THEN** packaging fails and no moderation-ready archive is declared

### Requirement: Release manifest and checksums bind all evidence
Each release directory SHALL contain a JSON manifest and SHA-256 checksum file covering the ZIP and its application files. The manifest SHALL include version, profile, source commit, build time, Node/npm versions, freeze identifiers, analytics schema, ad policy, supported languages/platforms/orientation, archive sizes, and exact test/review evidence identifiers.

#### Scenario: Manifest is complete
- **WHEN** packaging succeeds
- **THEN** schema validation confirms every mandatory field and recalculated checksums match the ZIP and extracted files

#### Scenario: Artifact changes after qualification
- **WHEN** any archived byte changes after checksums or evidence were produced
- **THEN** checksum verification fails and all prior draft/review evidence is stale for that artifact

### Requirement: Packaged build runs without origin assumptions
The application SHALL load all bundled game assets through relative paths, SHALL not depend on a developer server, and SHALL run from an unpacked static server with or without the local SDK fallback.

#### Scenario: ZIP is unpacked into a temporary directory
- **WHEN** a static server hosts the extracted package at a non-root path
- **THEN** the game loads its JS/CSS/assets, reaches interactive state, and completes a critical battle smoke flow without 404 or uncaught console errors

#### Scenario: Forbidden external dependency is detected
- **WHEN** release scanning finds an undeclared absolute host, external purchase URL, or most game content loaded outside the archive
- **THEN** qualification fails until the dependency is removed or explicitly approved through the platform host process

### Requirement: Catalog metadata is versioned in Russian and English
The repository SHALL store machine-readable Russian and English draft metadata for title, short description, about text, how-to-play text, SEO description, category/tags, orientation, supported platforms/languages, age rating, monetization/save declarations, and developer comment. Required text SHALL satisfy current Console length/content rules and match shipped behavior.[1][5]

#### Scenario: Metadata validates
- **WHEN** the release validator reads both locale payloads
- **THEN** titles are consistent with assets, short descriptions are no more than 70 characters, about/how-to-play are 100–1000 characters, SEO descriptions are 50–160 characters, and all gameplay-significant text exists in both languages

#### Scenario: Metadata overpromises features
- **WHEN** copy mentions campaign, progression, multiplayer, multiple worlds, purchases, cloud saves, or any unavailable mechanic
- **THEN** validation or release review fails and the field must be corrected before draft upload

#### Scenario: Developer comment is generated
- **WHEN** the draft payload is prepared
- **THEN** it declares the no-progression refresh behavior, mobile landscape orientation, study/catalog profile, and any intentional release limitation relevant to moderation

### Requirement: Catalog visual assets meet exact technical constraints
The release package SHALL provide a 512×512 24-bit PNG icon, an 800×470 24-bit PNG cover, and representative 16:9 gameplay screenshots whose long side is 1280–2560 pixels.[5]

#### Scenario: Visual assets pass automated checks
- **WHEN** asset validation reads dimensions, format, color mode, and aspect ratio
- **THEN** every required asset matches the declared constraints and screenshots are assigned to the supported desktop/mobile platform set

#### Scenario: Visual assets undergo manual truthfulness review
- **WHEN** reviewers inspect icon, cover, and screenshots against the same release build
- **THEN** assets show actual theme/gameplay, contain no OS/browser/Yandex chrome, clipped text, frames, rounded corners, unsupported mechanic, or title mismatch

### Requirement: Release copy and assets are frozen per manifest
Catalog payloads and visual assets SHALL be identified by content hashes in the release manifest. Changing any copy or media after qualification requires a new manifest and the applicable content/draft review.

#### Scenario: Copy or media changes
- **WHEN** any localized field, icon, cover, or screenshot hash differs from the qualified manifest
- **THEN** the release identifier changes and stale qualification evidence cannot be reused

## Sources

[1] https://yandex.ru/dev/games/doc/ru/console/add-new-game — Загрузка игры
[2] https://yandex.ru/dev/games/doc/ru/concepts/requirements — Требования к игре
[5] https://yandex.ru/dev/games/doc/ru/console/add-new-game/draft — Заполнение черновика
