# External Release Steps (Внешние шаги публикации)

Этот документ содержит пошаговый чеклист всех внешних операционных действий (вне исходного кода репозитория), необходимых для выкладки **Tactics Arena: Wasteland** в сторы и подключения внешней инфраструктуры.

---

## 1. Solana Mobile dApp Store (Seeker / Saga APK)

### Что уже сделано в репозитории и работает в онлайне

- Профиль `solana-mobile` опубликован на GitHub Pages: `https://xsa-dev.github.io/tactics-arena-worlds/`
- Опубликованы обязательные для Solana Mobile ресурсы:
  - Web App Manifest: `https://xsa-dev.github.io/tactics-arena-worlds/manifest.json` (`display: "fullscreen"`, `orientation: "landscape"`)
  - Privacy Policy: `https://xsa-dev.github.io/tactics-arena-worlds/privacy.html`
  - Иконки: `public/icons/icon-192.png` (`192×192`) и `public/icons/icon-512.png` (`512×512`)
- В игру встроены Mobile Wallet Adapter (`@solana-mobile/wallet-standard-mobile`), проверка **Seeker Genesis Token (SGT)** (`SEEKER VERIFIED`) и подпись/верификация детерминированных доказательств боя (`SignedBattleProofV1`, Ed25519).
- Конфигурация Android-оболочки подготовлена в `webshell/twa-manifest.json` (`packageId: "dev.xsa.tacticsarena"`, `appVersionName: "0.1.0"`, `appVersionCode: 1`).

Ниже — пошагово всё, что нужно выполнить вам лично для сборки подписанного `.apk` и публикации в **Solana dApp Store**.

---

### Шаг 1.1 — Проверка локального Android-окружения (`JAVA_HOME` и `doctor`)

На вашей машине уже установлены **OpenJDK 21.0.10** и **Android SDK 36.0.0** (`/Users/alxy/Library/Android/sdk`). Единственная рекомендация `solana-mobile doctor` — явно задать `JAVA_HOME` в терминале перед сборкой APK:

```bash
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
npx solana-mobile@latest doctor
```

Ожидаемый результат в блоке `Readiness`:

- `✓ Project creation ready`
- `✓ Android build ready`
- `✓ Ready for Solana Mobile development.`

_(Добавьте `export JAVA_HOME="$(/usr/libexec/java_home -v 21)"` в `~/.zshrc`, чтобы не вводить его каждый раз)._

---

### Шаг 1.2 — Создание и резервное копирование ключа подписи (`tactics-arena.keystore`)

**Важные правила Solana dApp Store:**

1. **Не используйте** ключ подписи, которым вы подписывали приложения для Google Play. Для Solana dApp Store требуется отдельный ключ.
2. **Сохраните резервную копию** файла `tactics-arena.keystore` и пароля к нему в менеджере паролей (1Password / Bitwarden) или на внешнем носителе. Если ключ будет утерян, вы не сможете выпускать обновления для `dev.xsa.tacticsarena`.
3. В репозитории настроена защита: `*.keystore` добавлен в `.gitignore`, а `npm run check:secrets` блокирует случайный коммит ключей.

Выполните в корне проекта:

```bash
keytool -genkey -v \
  -keystore tactics-arena.keystore \
  -alias tactics-arena \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Что вводить при запросах `keytool`:

- `Enter keystore password`: придумайте надёжный пароль (минимум 6 символов) и сохраните его.
- `What is your first and last name?`: `XSA Dev` (или ваше имя/студия).
- `What is the name of your organizational unit?`: `Games`
- `What is the name of your organization?`: `XSA`
- `What is the name of your City / State / two-letter country code?`: укажите ваши данные.
- `Correct?`: введите `yes`.

Чтобы посмотреть SHA-256 отпечаток созданного сертификата (пригодится для проверки подписи и Digital Asset Links):

```bash
keytool -list -v \
  -keystore tactics-arena.keystore \
  -alias tactics-arena
```

---

### Шаг 1.3 — Сборка и проверка подписанного APK (`npm run release:solana-webshell`)

Скрипт `scripts/build-solana-webshell.mjs` читает `webshell/twa-manifest.json`, автоматически находит ваш Android SDK (`/Users/alxy/Library/Android/sdk`), прописывает `webshell/android/local.properties` (`sdk.dir=...`) и собирает подписанный APK:

- Если `webshell/android` ещё не инициализирован (или передан флаг `--reinit`), скрипт сначала запускает `solana-mobile webshell init`.
- Если `webshell/android` уже создан, скрипт пропускает повторный `init`, сохраняет `local.properties` и сразу запускает `solana-mobile webshell build`, подписывая APK вашим корневым ключом `tactics-arena.keystore` (пароль от ключа вводится в терминале при запросе `Keystore password`).

Запустите сборку:

```bash
# 1. Проверить точные аргументы CLI без запуска Gradle:
npm run release:solana-webshell -- --dry-run

# 2. Собрать подписанный релизный APK:
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
npm run release:solana-webshell
```

Готовый файл появится по пути:
`webshell/android/app/build/outputs/apk/release/app-release.apk`

Проверьте криптографическую подпись готового APK с помощью `apksigner` из вашего Android SDK:

```bash
~/Library/Android/sdk/build-tools/36.0.0/apksigner verify --print-certs \
  webshell/android/app/build/outputs/apk/release/app-release.apk
```

Ожидаемый вывод: `Verifies` и SHA-256 дайджест вашего сертификата `tactics-arena`.

---

### Шаг 1.4 — Локальная проверка APK на устройстве или эмуляторе (опционально)

Если у вас подключён телефон (Solana Seeker / Saga или любой Android с установленным Phantom / Solflare / Seed Vault simulator) либо запущен эмулятор:

```bash
# Создать эмулятор Solana Mobile (если ещё не создан):
npx solana-mobile@latest emulator create
npx solana-mobile@latest emulator start

# Установить собранный APK:
~/Library/Android/sdk/platform-tools/adb install -r \
  webshell/android/app/build/outputs/apk/release/app-release.apk
```

Что проверить после запуска иконки **Tactics Arena** на устройстве:

1. Игра открывается сразу в полноэкранном горизонтальном режиме (`landscape`) без адресной строки браузера.
2. Переключатели `Mode: Human` ⇄ `Mode: AI Auto`, `EN` ⇄ `RU` и скорости `0.25×`–`4×` работают.
3. Нажатие `Connect Wallet` вызывает системный диалог Mobile Wallet Adapter (MWA), ставит бой на паузу на время переключения в кошелёк и после возврата отображает адрес кошелька и бейдж `SEEKER VERIFIED` (при наличии SGT).
4. В конце боя кнопка `Sign Battle Proof` подписывает результат боя через MWA, а `Verify Proof` подтверждает подпись и детерминированный реплей (`PROOF VERIFIED`).

---

### Шаг 1.5 — Выкладка в Solana dApp Publisher Portal (`publish.solanamobile.com`)

#### 1. Подготовьте кошелёк издателя (Publisher Wallet)

- Создайте или выберите отдельный Solana-кошелёк (Phantom / Solflare) в сети **Mainnet-beta**.
- Пополните баланс примерно на **0.15–0.20 SOL** — эти средства расходуются на ончейн-минт NFT издателя/приложения/релиза и загрузку иконок/скриншотов/APK в децентрализованное хранилище ArDrive/Arweave.

#### 2. Зарегистрируйтесь в Publisher Portal

1. Откройте [https://publish.solanamobile.com](https://publish.solanamobile.com) и подключите кошелёк издателя.
2. Заполните профиль издателя (**Publisher Profile**), укажите название студии/разработчика, сайт (`https://xsa-dev.github.io/tactics-arena-worlds/`) и контактный email, затем сминтите **Publisher NFT** (если ещё не создан).
3. Пройдите быструю проверку издателя (KYC/Publisher attestation) в портале.

#### 3. Создайте карточку приложения (App NFT) и первый релиз (Release NFT)

При создании приложения и релиза используйте следующие готовые данные и файлы из репозитория:

| Поле в Publisher Portal        | Значение                                                                                                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **App Name**                   | `Tactics Arena: Wasteland`                                                                                                                                                                                             |
| **Short Name**                 | `Tactics Arena`                                                                                                                                                                                                        |
| **Android Package Name**       | `dev.xsa.tacticsarena`                                                                                                                                                                                                 |
| **Category**                   | `Games` → `Strategy` / `Turn-Based Tactics`                                                                                                                                                                            |
| **Website URL**                | `https://xsa-dev.github.io/tactics-arena-worlds/`                                                                                                                                                                      |
| **Privacy Policy URL**         | `https://xsa-dev.github.io/tactics-arena-worlds/privacy.html`                                                                                                                                                          |
| **Short Description (EN)**     | `Deterministic 8×6 squad tactics with Seeker SGT badge & signed battle proofs.`                                                                                                                                        |
| **Short Description (RU)**     | `Детерминированная тактика 8×6 с поддержкой Seeker SGT и крипто-доказательствами боя.`                                                                                                                                 |
| **App Icon (512×512 PNG)**     | `public/icons/icon-512.png`                                                                                                                                                                                            |
| **Screenshots (16:9 PNG)**     | `artifacts/screenshots/desktop-1280x720-en.png`, `artifacts/screenshots/mobile-640x360-ru.png`                                                                                                                         |
| **APK File**                   | `webshell/android/app/build/outputs/apk/release/app-release.apk`                                                                                                                                                       |
| **What's New (Release Notes)** | `Initial Solana Mobile release (v0.1.0): 8×6 tactical battle, Human & AI Auto modes with 0.25x–4x speed controls, Mobile Wallet Adapter, Seeker Genesis Token verification, and Ed25519 self-verifying battle proofs.` |

**Описание для карточки стора (Full Description — можно скопировать):**

> **Tactics Arena: Wasteland** is a deterministic 8×6 turn-based squad tactics game built for Solana Mobile (Seeker & Saga).
>
> - **Pure Tactical Combat (Zero RNG):** Command a 3-unit Survivor squad (Scout, Gunner, Medic) against Raiders using orthogonal movement, Bresenham line-of-sight, half-cover mitigation, and once-per-battle unit abilities (_Aimed Shot_, _Burst_, _Medkit_).
> - **Human & AI Autoplay (`0.25×`–`4×`):** Take manual command or switch live into AI-vs-AI autoplay with slow-motion (`0.25×`, `0.5×`) and fast-forward (`2×`, `4×`) controls.
> - **Native Solana Mobile Integration:** Connect via Mobile Wallet Adapter (Seed Vault Wallet, Phantom, Solflare), unlock the on-chain **SEEKER VERIFIED** squad badge with a Seeker Genesis Token (SGT), and sign completed battles with **SignedBattleProofV1** (offline Ed25519 signature + deterministic command replay verification).

После загрузки APK и медиафайлов подпишите транзакцию создания **Release NFT** в кошельке и нажмите **Submit for Review** в портале.

---

### Шаг 1.6 — Как выпускать обновления после публикации

- **Обновление контента, UI, баланса или AI (без перевыпуска APK):**
  Поскольку APK работает через `solana-mobile webshell` и загружает `https://xsa-dev.github.io/tactics-arena-worlds/`, любой коммит в ветку `main` автоматически деплоится через GitHub Actions (`.github/workflows/deploy-pages.yml`) и сразу становится доступен пользователям приложения.
- **Выпуск новой версии APK в Solana dApp Store (если меняются иконка, права Android или версия оболочки):**
  1. В файле `webshell/twa-manifest.json` увеличьте `appVersionCode` на `+1` (например, с `1` на `2`) и обновите `appVersionName` (например, `"0.1.1"`).
  2. Соберите APK тем же ключом `tactics-arena.keystore`: `npm run release:solana-webshell`.
  3. Загрузите новый `app-release.apk` в карточку приложения на [publish.solanamobile.com](https://publish.solanamobile.com) как новый релиз.

---

## 2. Живой OpenJEV HTTPS-прокси (`add-openjev-survivor-autoplay`)

По умолчанию в профиле `solana-mobile` автобой (`Mode: AI Auto`) работает полностью автономно на встроенной детерминированной политике `DeterministicSurvivorPolicy`. Чтобы закрыть оставшиеся внешние пункты `1.1`, `7.5` и `7.8` в `openspec/changes/add-openjev-survivor-autoplay/tasks.md`:

1. **Пункт 1.1 (Ротация секрета)**: отзовите старый тестовый ключ OpenJEV и выпустите новый серверный секрет в панели OpenJEV.
2. **Деплой прокси (`src/proxy/openjev.ts`)**: разверните функцию `createOpenJevProxyHandler` на внешнем HTTPS-воркере (Cloudflare Workers / Vercel Edge / Node HTTP), передав ключ через серверное хранилище секретов (не коммитьте значение в репозиторий).
3. **Пункт 7.5 и 7.8 (Проверка `/v1/openjev/health` и `/v1/openjev/choose`)**:
   - Проверьте, что `GET https://<ваш-прокси>/v1/openjev/health` возвращает `200 {"ok":true,"status":"healthy","circuitState":"closed"}`.
   - Укажите рабочий HTTPS-адрес прокси в `src/release/config.ts` и проведите один квалификационный бой с живым ответом OpenJEV и проверкой автоматического отката на `DeterministicSurvivorPolicy` при отключении прокси.

---

## 3. Яндекс Игры — Публикация в каталог (Черновик `ID: 633082`, 100% бесплатно)

Публикация в **Яндекс Игры** не требует взносов или криптокошелька — черновик уже создан под **`ID: 633082`** (`https://yandex.ru/games/app/633082?draft=true`) в [Консоли разработчика Яндекс Игр](https://games.yandex.ru/console/). Все файлы для загрузки и тексты карточки подготовлены в репозитории.

### Шаг 3.1 — Готовые файлы в репозитории для загрузки в консоль

| Назначение в консоли Яндекс Игр   | Требования Яндекс Игр                                                          | Готовый файл в репозитории                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **Архив игры (`*.zip`)**          | Корень с `index.html`, `/sdk.js`, `LoadingAPI.ready()`, `GameplayAPI`, <100 МБ | `artifacts/releases/0.1.0/tactics-arena-0.1.0.zip`                                                 |
| **Иконка (`512×512 PNG`)**        | 24-bit RGB без прозрачности и рамок                                            | `public/icons/icon-512.png`                                                                        |
| **Обложка (`800×470 PNG`)**       | 24-bit RGB без элементов интерфейса ОС/браузера                                | `artifacts/screenshots/cover-800x470.png`                                                          |
| **Скриншоты RU (`1280×720 PNG`)** | 16:9, минимум 2 шт., ≥1280px по длинной стороне, 24-bit RGB                    | `artifacts/screenshots/desktop-1280x720-ru.png`, `artifacts/screenshots/desktop-1280x720-ru-2.png` |
| **Скриншоты EN (`1280×720 PNG`)** | 16:9, минимум 2 шт., ≥1280px по длинной стороне, 24-bit RGB                    | `artifacts/screenshots/desktop-1280x720-en.png`, `artifacts/screenshots/desktop-1280x720-en-2.png` |

---

### Шаг 3.2 — Пошаговое заполнение черновика (`ID: 633082`) в `games.yandex.ru/console`

1. Откройте ваш черновик `ID: 633082` в [https://games.yandex.ru/console/](https://games.yandex.ru/console/).
2. В разделе **«Файлы игры»** убедитесь, что загружен архив:
   `artifacts/releases/0.1.0/tactics-arena-0.1.0.zip` (`1.24 Mb` в распакованном виде).
3. Проверьте технические настройки в блоке **«Общее»**:
   - **Ориентация**: `Альбомная (Landscape)`
   - **Поддерживаемые платформы**: `Десктоп`, `Мобильные (Android, iOS)`
   - **Языки**: `Русский`, `Английский`
   - **Возрастной рейтинг**: `12+`
   - **Категории (до 2)**: **обязательно уберите `Для двоих`** (иначе модерация отклонит из-за отсутствия локального мультиплеера) и выберите **`Стратегии`** (+ `Настольные` или `Приключения`).
   - **Теги**: `пошаговые`, `стратегические`, `настольные`
   - **Ключевые слова (`0/100`, через запятую)**:
     `тактика, пошаговая стратегия, отряд, постапокалипсис, бой, укрытия, арена`
   - **Игра использует облачные сохранения**: **Выключено** (не ставить галочку).
   - **Отсроченная публикация**: **Включено** (поставить галочку).

---

### Шаг 3.3 — Готовые тексты карточки на русском языке (RU)

Скопируйте значения в русскую локализацию черновика (все длины проверены под лимиты Яндекс Игр):

- **Название (RU):**
  `Тактика Арены: Пустошь`
- **Категория (до 2):**
  `Стратегии`, `Настольные и карточные` (или `Приключения`)
- **Теги:**
  `тактика`, `пошаговая стратегия`, `отряд`, `постапокалипсис`
- **Краткое описание (до 70 символов — 64 символа):**
  `Пошаговая тактика 8×6: укрытия, линия огня и способности отряда.`
- **Описание для SEO (50–160 символов — 126 символов):**
  `Командуйте отрядом из трёх бойцов на тактическом поле 8×6: используйте укрытия, линию обзора и уникальные умения в битве с рейдерами.`
- **Об игре (100–1000 символов — 412 символов):**
  `Тактика Арены: Пустошь — детерминированная пошаговая тактическая битва на поле 8×6 без случайного разброса урона. Под вашим началом три бойца Выживших: Разведчик, Пулемётчик и Медик. Каждый ход требует точного расчёта очков действия (AP), использования полуукрытий, контроля линии огня за сплошными стенами и своевременного применения уникальных способностей отряда против превосходящих сил Рейдеров.`
- **Как играть (100–1000 символов — 438 символов):**
  `Выберите бойца кликом мыши или касанием экрана. У каждого бойца 2 очка действия (AP) на ход. Перемещение до 3 клеток расходует 1 AP, обычная атака — 1 AP. Полуукрытия снижают входящий урон на 1, а стены полностью блокируют линию огня. Раз за бой каждый боец может применить способность: Разведчик — Прицельный выстрел (2 AP), Пулемётчик — Очередь (2 AP), Медик — Аптечка (1 AP, лечит 3 HP). Победите всех 3 Рейдеров!`

---

### Шаг 3.4 — Готовые тексты карточки на английском языке (EN)

Скопируйте значения в английскую локализацию черновика:

- **Title (EN):**
  `Tactics Arena: Wasteland`
- **Short Description (≤70 chars — 64 chars):**
  `Turn-based 8×6 squad tactics with cover, line of sight & skills.`
- **SEO Description (50–160 chars — 132 chars):**
  `Command a 3-unit squad on an 8×6 tactical grid. Use half-cover, line-of-sight blocking walls, and unit abilities to defeat Raiders.`
- **About the Game (100–1000 chars — 398 chars):**
  `Tactics Arena: Wasteland is a deterministic 8×6 turn-based squad tactics battle with zero random hit rolls. Lead three Survivor specialists—Scout, Gunner, and Medic—against an opposing Raider squad. Plan every Action Point (AP), position behind half-cover to reduce incoming fire, use solid walls to break line of sight, and trigger once-per-battle abilities to secure a decisive tactical victory.`
- **How to Play (100–1000 chars — 424 chars):**
  `Click or tap a friendly unit to select it. Each unit has 2 Action Points (AP) per turn: moving up to 3 orthogonal tiles costs 1 AP, and a standard attack costs 1 AP. Half-cover reduces incoming ranged damage by 1, while solid walls block line of sight. Each specialist has one ability per battle: Scout — Aimed Shot (2 AP), Gunner — Burst (2 AP), Medic — Medkit (1 AP, heals 3 HP). Defeat all 3 Raiders to win!`

---

### Шаг 3.5 — Комментарий для модератора и быстрая самопроверка перед отправкой

В поле **«Комментарий для модератора»** можно вставить:

> Пошаговая тактическая битва 8×6 на один завершённый сценарий с возможностью переигровки. Полная поддержка Яндекс SDK (`YaGames.init()`, `LoadingAPI.ready()`, `GameplayAPI.start()/stop()`, определение языка `i18n.lang` RU/EN, адаптация под десктоп и мобильный landscape от 640×360 с экраном поворота в портретной ориентации). Покупки и облачные сохранения не используются.

Перед нажатием **«Отправить на модерацию»** откройте ссылку **«Черновик»** в консоли:

1. Убедитесь, что игра загружается без ошибок в консоли браузера, язык соответствует языку платформы (`ru`/`en`), а в debug-панели Яндекс Игр загорается `LoadingAPI.ready()`.
2. Нажмите **«Отправить на модерацию»**.
