# External Release Steps (Внешние шаги публикации)

Этот документ содержит пошаговый чеклист всех внешних операционных действий (вне исходного кода репозитория), необходимых для выкладки **Tactics Arena: Wasteland** в сторы и подключения внешней инфраструктуры.

---

## 1. Solana Mobile dApp Store (Seeker / Saga APK)

Веб-сборка профиля `solana-mobile` уже опубликована на GitHub Pages (`https://xsa-dev.github.io/tactics-arena-worlds/`), содержит `manifest.json`, иконки `192×192` / `512×512` и страницу `privacy.html`. Для выпуска подписанного Android `.apk` в Solana dApp Store:

### Шаг 1.1 — Проверка локального Android-окружения

Убедитесь, что на рабочей машине установлены **JDK 17+** и **Android SDK** (`apksigner`, `build-tools`):

```bash
npx solana-mobile@latest doctor
```

### Шаг 1.2 — Создание релизного ключа подписи (Keystore)

Создайте отдельный ключ подписи для Solana dApp Store (не используйте ключ от Google Play). Файлы `*.keystore` добавлены в `.gitignore` и блокируются `npm run check:secrets`, поэтому ключ остаётся только у вас локально:

```bash
keytool -genkey -v \
  -keystore tactics-arena.keystore \
  -alias tactics-arena \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

### Шаг 1.3 — Сборка и проверка подписанного APK через `solana-mobile webshell`

Конфигурация оболочки уже подготовлена в `webshell/twa-manifest.json` (`packageId: "dev.xsa.tacticsarena"`, `webManifestUrl: "https://xsa-dev.github.io/tactics-arena-worlds/manifest.json"`). Запустите сборку:

```bash
# Предварительный просмотр команд без запуска Gradle:
npm run release:solana-webshell -- --dry-run

# Полная генерация Android-проекта и сборка подписанного APK:
npm run release:solana-webshell
```

Проверьте подпись готового APK:

```bash
apksigner verify --print-certs webshell/android/app/build/outputs/apk/release/app-release.apk
```

### Шаг 1.4 — Отправка в Solana dApp Publisher Portal

1. Откройте [Solana dApp Publisher Portal](https://publish.solanamobile.com), пройдите верификацию издателя и подключите кошелёк издателя (~0.2 SOL для ArDrive и минта Release NFT).
2. Создайте приложение `Tactics Arena: Wasteland` (`dev.xsa.tacticsarena`), укажите:
   - **Privacy Policy URL**: `https://xsa-dev.github.io/tactics-arena-worlds/privacy.html`
   - **Icon (512×512)**: `public/icons/icon-512.png`
   - **Screenshots**: `artifacts/screenshots/desktop-1280x720-en.png`, `artifacts/screenshots/mobile-640x360-ru.png`
3. Загрузите `app-release.apk` через портал или через `@solana-mobile/dapp-store-cli`:

```bash
dapp-store \
  --apk-file ./webshell/android/app/build/outputs/apk/release/app-release.apk \
  --keypair /path/to/publisher-wallet.json \
  --whats-new "Initial Solana Mobile release with MWA, Seeker SGT badge, and Ed25519 battle proofs"
```

---

## 2. Живой OpenJEV HTTPS-прокси (`add-openjev-survivor-autoplay`)

По умолчанию в профиле `solana-mobile` автобой (`Mode: AI Auto`) работает полностью автономно на встроенной детерминированной политике `DeterministicSurvivorPolicy`. Чтобы закрыть оставшиеся внешние пункты `1.1`, `7.5` и `7.8` в `openspec/changes/add-openjev-survivor-autoplay/tasks.md`:

1. **Пункт 1.1 (Ротация секрета)**: отзовите старый тестовый ключ OpenJEV и выпустите новый серверный секрет в панели OpenJEV.
2. **Деплой прокси (`src/proxy/openjev.ts`)**: разверните функцию `createOpenJevProxyHandler` на внешнем HTTPS-воркере (Cloudflare Workers / Vercel Edge / Node HTTP), передав ключ через серверное хранилище секретов (не коммитьте значение в репозиторий).
3. **Пункт 7.5 и 7.8 (Проверка `/v1/openjev/health` и `/v1/openjev/choose`)**:
   - Проверьте, что `GET https://<ваш-прокси>/v1/openjev/health` возвращает `200 {"ok":true,"status":"healthy","circuitState":"closed"}`.
   - Укажите рабочий HTTPS-адрес прокси в `src/release/config.ts` и проведите один квалификационный бой с живым ответом OpenJEV и проверкой автоматического отката на `DeterministicSurvivorPolicy` при отключении прокси.

---

## 3. Яндекс Игры (`validate-tactical-battle-prototype` и `prepare-yandex-games-release`)

1. **Черновик исследования (`study-draft`, пункты 5.5–5.7)**:
   - Соберите воспроизводимый архив `RELEASE_PROFILE=study-draft npm run release:package` (`artifacts/releases/0.1.0/tactics-arena-0.1.0.zip`).
   - Загрузите архив в черновик консоли Яндекс Игр и проверьте инициализацию `/sdk.js`, `LoadingAPI.ready()`, `GameplayAPI` и локаль `ru`/`en` через debug-панель.
2. **Плейтест-когорта (блок 6 в `validate-tactical-battle-prototype` и блок 6 в `prepare-yandex-games-release`)**:
   - Проведите 15 валидных сессий (8 мобильных landscape, 7 десктопных) по протоколу из `docs/research/yandex-market-discovery.md`.
   - Экспортируйте JSON-логи сессий через `window.__TACTICS_OPERATOR__.finalizeSession(sessionId)` и зафиксируйте итоговый вердикт (`GO_NEXT_GATE`).
3. **Публичный каталог (`catalog-release`, блоки 7–11 в `prepare-yandex-games-release`)**:
   - После получения вердикта `GO_NEXT_GATE` подключите показ полноэкранной рекламы строго после окончания боя (`AdvertisingService`), подготовьте обложку `800×470` и отправьте `catalog-release` на модерацию с отложенной публикацией.
