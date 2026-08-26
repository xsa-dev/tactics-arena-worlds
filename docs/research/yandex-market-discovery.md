# Market discovery: Tactics Arena: Worlds

## Decision summary

**Recommendation: GO for a narrowly scoped prototype, not for the full product.** The platform now has a credible audience for midcore games, but the current idea combines too many unvalidated systems. The first experiment should test one claim: **does a readable, touch-friendly 5–8 minute grid battle create enough tactical interest for players to finish and replay?**

Confidence is **medium-low** because public catalog pages reveal positioning and ratings, but not impressions, retention, revenue, or unit economics. Demand must therefore be validated with a playable build and platform analytics rather than inferred from competitor presence.

## Market signals

- Yandex reports an audience split of 61% men / 39% women, with 49% aged 35–44. Devices are 50% phones, 40% computers, and 10% tablets/TV; average time on the platform is 55 minutes.[1] This supports a tactics theme but makes mobile-first interaction a launch requirement, not a later port.
- About 40% of traffic is international. Yandex recommends at least Russian and English localization and prioritizing Android/mobile adaptation.[2]
- According to Yandex Games' 2025 business review, the platform exceeded 50 million monthly active players, midcore entered its top five genre groups, and developer revenue from in-app purchases grew 75% year over year.[5] This supports the category direction, but it does not prove demand for this specific combat model.
- The same review says the catalog contracted to roughly 19,000 games after low-quality titles were removed, indicating that a thin prototype can validate mechanics but is unlikely to be publishable or discoverable as a low-polish final product.[5]

## Competitive reading

The public “turn-based” category is broad and noisy: its leading entries include screw-removal, match-3, sorting, football simulation, classic Heroes-like games, and strategy titles.[6] Explicitly tactical entries visible in the category include “Тактика Трона” with a catalog rating of 51 and “Средневековье: Пошаговая тактика” with 58, while familiar Heroes-like entries sit higher.[6]

This produces two opposing interpretations:

1. **Whitespace hypothesis:** a polished, immediately legible squad-tactics game is underrepresented and can stand out.
2. **Demand-risk hypothesis:** low visibility/ratings of explicit tactics titles may reflect weak platform demand or poor mobile fit rather than lack of supply.

The prototype should resolve this ambiguity. Competitor count alone is not sufficient evidence to greenlight a content-heavy RPG.

## Positioning recommendation

Do not lead with “Fallout Tactics in the browser” or a multi-world RPG. Those promises imply depth, content volume, and PC-oriented controls that the prototype cannot deliver.

Use a narrower promise:

> **A five-minute squad tactics puzzle where every AP matters. Move three fighters, use cover, and eliminate the enemy squad before the round limit.**

The frozen prototype fantasy is **post-apocalyptic Survivors versus Raiders**: one arena, Scout/Gunner/Medic versus three raiders, and consistent icon/silhouette placeholder presentation. “Multiple worlds” becomes a later content framework only if the battle proves engaging.

## Prototype scope

### In scope

- One 8×6 orthogonal grid arena.
- Three player units and three deterministic AI enemies.
- Team turns: player phase, then enemy phase.
- Four actions: move, ranged attack, one unit-specific ability, end turn.
- Six AP per unit; visible AP costs and reachable/targetable cells.
- Binary half-cover, range, and line-of-sight.
- Fully deterministic combat with no PRNG or misses; randomness may be tested only in a later change.
- Victory by eliminating all enemies; defeat by losing the squad or exceeding 8 rounds.
- “Play again” only after a terminal result; no mid-battle restart.
- Responsive landscape layout supporting mouse and touch down to 640×360 CSS pixels with 44×44 CSS-pixel hit targets.
- Russian and English UI strings.
- Local analytics event adapter with Yandex-ready event names.
- Yandex SDK adapter that safely falls back in local development.

### Explicitly out of scope

- Campaign, hub, character progression, inventory, morale, suppression, wounds.
- Multiple worlds, classes, skill trees, procedural generation.
- PvP, leagues, clans, backend, accounts, cloud saves.
- Payments, premium account, purchasable AP, resurrection, or power.
- Interstitial ads inside rounds or between unit turns.
- Full art pipeline and content production.

## Monetization finding

The pasted concept places interstitial advertising between rounds. That is a poor product choice and a moderation risk: Yandex requires ads to appear in logical pauses, requires gameplay and sound to pause during fullscreen ads, and says rewarded-video rewards must be optional bonuses rather than required to continue.[3] A tactical round is part of one continuous decision sequence, so an ad there would damage comprehension and likely replay intent.

For the prototype:

- no monetization is needed during internal validation;
- if a public test requires monetization, use at most an interstitial after a completed battle;
- rewarded video, if later tested, should grant a cosmetic reroll or post-battle bonus—not an extra turn or resurrection that invalidates tactical outcomes;
- in-app purchases belong after retention is demonstrated.

## Validation plan

### Primary hypothesis

Among new testers who independently finish the frozen battle and pass the comprehension rubric, at least half will voluntarily activate replay before the facilitator asks any opinion question. This is the primary behavioral signal of immediate replay intent. Start rate, independent completion, time to first action, invalid actions, help use, result, and comprehension are diagnostic outcomes rather than parts of the primary claim.

Passing this gate authorizes only a larger unattended audience/platform-demand test. It does not authorize campaign, progression, monetization, PvP, multiple worlds, or content production.

### Frozen cohort protocol

- Recruit 15 valid Russian-speaking friends or colleagues who have not seen or played the build: exactly 8 on mobile landscape and 7 on desktop. Record prior tactics experience as none/light/regular rather than balancing on it after recruitment.
- Freeze build version, map, balance, post-apocalyptic placeholder theme, onboarding copy, replay CTA, and difficulty before the first valid session.
- Use one facilitator script. Give no gameplay hint during the first 90 seconds unless the tester explicitly asks. Any explanation of a legal action, AP, cover, target, ability, or goal counts as `gameplay` facilitator help; device/browser assistance that reveals no game rule counts as `technical` help. Record every request and every assistance actually provided separately.
- Show the terminal replay CTA before asking questions. After replay/non-replay is recorded, ask the neutral question: “Почему вы решили сыграть ещё раз или не играть ещё раз?”
- A valid session requires a new tester, a supported device/viewport, no technical blocker, and a complete exported event log. Exclude only technical failures or corrupt/missing logs—never poor play. Replace every excluded tester with a new tester from the same device class until the final valid cohort contains exactly 8 mobile and 7 desktop sessions.
- Segment completion and replay by battle result, device class, prior tactics experience, comprehension, and facilitator-help use.

### Comprehension rubric

After the first terminal result or abandonment, ask four fixed questions without teaching first:

1. How is movement cost calculated?
2. How many AP does a normal attack cost?
3. What does half-cover change?
4. How often can a unit use its special ability?

A tester passes by answering at least 3 of 4 correctly, with both movement/AP economy and half-cover answered correctly. The rubric result is recorded separately from replay.

### Instrumentation events

- `game_loaded`
- `battle_started`
- `onboarding_shown`, `onboarding_completed`, `onboarding_dismissed`
- `unit_selected`, `move_completed`, `attack_completed`
- `first_action`
- `turn_ended`
- `unit_ability_used`
- `invalid_action`, `help_requested`, `rules_opened`
- `battle_abandoned`
- `battle_finished` with result, rounds, active duration, invalid-action count, and help use
- `replay_clicked`

Every event carries `sessionId`, `testerId`, `buildVersion`, device/input, viewport, locale, and—when applicable—`battleId`. `help_requested` records a request; `facilitator_help_provided` records assistance actually given with `helpType`, `helpAtMs`, and `helpReason`. The exported battle summary contains `facilitatorHelpUsed` (true only for gameplay help), `facilitatorHelpType`, `facilitatorHelpAtMs`, `facilitatorHelpReason`, and `independentCompletion`. Technical help does not invalidate independent completion; any gameplay help does. The local adapter exports an ordered JSON session log; the facilitator adds prior tactics experience and comprehension result to the session record.

Yandex provides built-in product, monetization, conversion, and retention metrics and recommends comparing against category leaders and testing hypotheses via experiments.[4]

### Prototype success criteria

These are **pre-registered internal gates**, not claimed platform benchmarks:

- exactly 15 valid sessions: 8 mobile and 7 desktop;
- at least 9 valid testers have `independentCompletion=true` (technical assistance is allowed; gameplay assistance is not);
- at least 10 valid testers pass the comprehension rubric;
- at least 8 valid testers both finish independently and pass comprehension (the primary eligible set);
- at least 50% of the primary eligible set activate replay before interview questions;
- median time to first legal action is at most 45 seconds;
- no blocker at 640×360 mobile landscape or on the tested desktop viewport.

### Exhaustive decision matrix

Record `cohortIteration` as `initial` or `ui_repeat`, then apply the matching branch. A second UI repeat is forbidden.

First apply the data-completeness rule for either iteration:

1. **TOP_UP_DATA:** the valid cohort is not exactly 8 mobile plus 7 desktop sessions. Recruit same-device-class replacements without changing the build. This is not a product verdict, and no other rule is evaluated until the quota is complete.

For `cohortIteration = initial`:

2. **PIVOT_UI:** any blocker at the mandatory mobile viewport, fewer than 9 independent finishes, fewer than 10 comprehension passes, or fewer than 8 primary-eligible testers. Permit exactly one onboarding/layout/usability revision, freeze a new build version, and run one new 8-mobile/7-desktop cohort marked `ui_repeat`.
3. **GO_NEXT_GATE:** all comprehension/completion/mobile conditions pass and at least 50% of the primary eligible set activates replay.
4. **NOT_GO_CURRENT_CORE / PIVOT_CORE:** all comprehension/completion/mobile conditions pass but fewer than 50% of the primary eligible set activates replay. Do not add progression; a new OpenSpec must change exactly one tactical hook before another test.

For `cohortIteration = ui_repeat`:

5. **GO_NEXT_GATE:** every GO condition above passes, including replay of at least 50% of the primary eligible set.
6. **NOT_GO:** any GO condition fails. No second PIVOT_UI or PIVOT_CORE verdict is available; stop this prototype branch or write a materially different core-loop proposal.

No participant may be excluded for losing, misunderstanding, declining replay, or requesting help. Missing values fail the affected condition unless the entire session meets the technical exclusion rule above.

## Platform constraints captured for implementation

Yandex requires the SDK, guest play with progress preservation where progression exists, pause/mute on focus loss, correct responsive behavior, touch control on mobile, and save-after-action for games with progression.[3] The prototype has no persistent progression, but its platform adapter should already handle pause/resume and local SDK fallback.

## Sources

[1] https://yandex.ru/dev/games/doc/ru — Преимущества Яндекс Игр
[2] https://yandex.ru/dev/games/doc/ru/concepts/promotion — Привлечение игроков
[3] https://yandex.ru/dev/games/doc/ru/concepts/requirements — Требования к игре
[4] https://yandex.ru/dev/games/doc/ru/concepts/analytics — Аналитика
[5] https://wnhub.io/ru/news/other/item-49945 — Итоги Яндекс Игр 2025
[6] https://yandex.ru/games/tag/poshagovye_790 — Каталог пошаговых игр
