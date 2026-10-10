import Phaser from "phaser";
import "./style.css";
import {
  normalizeLanguage,
  t,
  type Language,
  type UiKey,
} from "./localization";
import {
  createPlatformService,
  createSdkLoader,
  assertPlatformQualified,
  selectFallbackLanguage,
  selectRuntimeLanguage,
  type YandexSdk,
} from "./platform";
import type { AnalyticsContext } from "./platform/battle-session";
import { BattleScene, BootScene } from "./presentation/BattleScene";
import { GameRuntime } from "./presentation/runtime";
import {
  ACTIVE_RELEASE_CONFIG,
  BUILD_RELEASE_PROFILE_MARKER,
} from "./release/config";
import type {
  AbandonReason,
  HelpReason,
  HelpType,
} from "./platform/battle-session";
import { selectTesterIdentity } from "./platform/operator";
import { createBootstrapDependencies } from "./bootstrap";

declare global {
  interface Window {
    YaGames?: { init(): Promise<YandexSdk> };
    __PHASER_GAME__?: Phaser.Game;
    __TACTICS__: {
      snapshot(): ReturnType<
        typeof structuredClone<GameRuntime["session"]["state"]>
      >;
      eventNames(): string[];
      readonly interactiveReady: boolean;
      analytics(): ReturnType<GameRuntime["observations"]["analytics"]>;
      provideHelp(type: HelpType, reason: HelpReason): void;
    };
    __TACTICS_OPERATOR__: {
      currentIds(): { sessionId: string; battleId: string };
      provideHelp(sessionId: string, type: HelpType, reason: HelpReason): void;
      requestHelp(sessionId: string): void;
      abandonSession(sessionId: string, reason: AbandonReason): void;
      setTesterMetadata: GameRuntime["observations"]["setTesterMetadata"];
      exportSnapshot(sessionId: string): string;
      finalizeSession(sessionId: string): string;
      inspect: GameRuntime["observations"]["inspect"];
      analytics: GameRuntime["observations"]["analytics"];
    };
  }
}

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
};

function showStartupError(
  language: Language,
  bodyKey: UiKey = "startup.body",
): void {
  document.getElementById("startup-error-title")!.textContent = t(
    language,
    "startup.title",
  );
  document.getElementById("startup-error-body")!.textContent = t(
    language,
    bodyKey,
  );
  document.getElementById("startup-error-retry")!.textContent = t(
    language,
    "startup.retry",
  );
  document.getElementById("startup-error")!.classList.remove("hidden");
}

async function start(): Promise<void> {
  document.documentElement.dataset.releaseProfile =
    BUILD_RELEASE_PROFILE_MARKER;
  const requestedLanguage = new URLSearchParams(location.search).get("lang");
  const releaseRuntime = import.meta.env.PROD;
  const sdkLoader = createSdkLoader({
    hostname: location.hostname,
    automated: navigator.webdriver,
    loadScript: async (path) => {
      if (window.YaGames) return;
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = path;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error("Yandex SDK script unavailable"));
        document.head.append(script);
      });
    },
    initialize: async () => {
      if (!window.YaGames) throw new Error("YaGames is unavailable");
      return window.YaGames.init();
    },
  });
  const platform = await createPlatformService(
    sdkLoader,
    2500,
    selectFallbackLanguage(
      requestedLanguage,
      navigator.language,
      releaseRuntime,
    ),
  );
  const language = selectRuntimeLanguage(
    platform,
    requestedLanguage,
    releaseRuntime,
  );
  startupLanguage = language;
  assertPlatformQualified(ACTIVE_RELEASE_CONFIG, platform);
  document.documentElement.lang = language;
  document.title = t(language, "game.title");
  const hasTouch =
    navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches;
  const context: AnalyticsContext = {
    sessionId: "bootstrap",
    testerId: selectTesterIdentity(
      new URLSearchParams(location.search).get("tester"),
      releaseRuntime,
    ),
    manifestVersion: ACTIVE_RELEASE_CONFIG.version,
    releaseProfile: ACTIVE_RELEASE_CONFIG.profile,
    deviceClass: innerWidth <= 767 ? "mobile" : "desktop",
    inputType: hasTouch ? "touch" : "mouse",
    viewport: `${innerWidth}x${innerHeight}`,
    locale: language,
  };
  const dependencies = createBootstrapDependencies(
    ACTIVE_RELEASE_CONFIG.survivor.mode,
  );
  const runtime = new GameRuntime(platform, language, context, dependencies, {
    survivor: ACTIVE_RELEASE_CONFIG.survivor,
  });
  runtime.markReady("platform");
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: 960,
    height: 540,
    backgroundColor: "#151a1d",
    scene: [new BootScene(), new BattleScene(runtime)],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 960,
      height: 540,
    },
    render: { antialias: true, pixelArt: false },
  });
  window.__PHASER_GAME__ = game;

  const controls = $("game-controls");
  const onboarding = $("onboarding");
  const result = $("result-overlay");
  const rotate = $("rotate-overlay");
  const move = $<HTMLButtonElement>("move-action");
  const attack = $<HTMLButtonElement>("attack-action");
  const ability = $<HTMLButtonElement>("ability-action");
  const endTurn = $<HTMLButtonElement>("end-turn");
  const aiStatus = $("ai-status");
  const aiSpeed = $("ai-speed");
  const aiSpeedLabel = $("ai-speed-label");
  const speedButtons = [
    [$("speed-1"), 1],
    [$("speed-2"), 2],
    [$("speed-4"), 4],
  ] as const;
  move.textContent = t(language, "action.move");
  attack.textContent = t(language, "action.attack");
  endTurn.textContent = t(language, "action.endTurn");
  const isAi = ACTIVE_RELEASE_CONFIG.survivor.mode === "openjev";
  aiStatus.textContent = isAi ? t(language, "ai.status") : "";
  aiSpeed.classList.toggle("hidden", !isAi);
  aiSpeedLabel.textContent = t(language, "ai.speed");
  for (const [button, value] of speedButtons) {
    button.textContent = t(
      language,
      `ai.speed.${value}` as Parameters<typeof t>[1],
    );
    button.setAttribute("aria-label", `${t(language, "ai.speed")} ${value}×`);
    button.addEventListener("click", () => {
      runtime.presentationClock.multiplier = value;
      renderSpeed();
    });
  }
  $("rules").setAttribute("aria-label", t(language, "action.rules"));
  $("onboarding-title").textContent = t(language, "onboarding.title");
  $("onboarding-list").innerHTML = [1, 2, 3, 4, 5, 6]
    .map((index) => {
      const key = isAi ? `onboarding.ai.${index}` : `onboarding.${index}`;
      const copy = t(language, key as Parameters<typeof t>[1]);
      if (index !== 5) return `<li>${copy}</li>`;
      return `<li class="ability-briefing">${copy
        .split("; ")
        .map((rule) => `<span class="ability-rule">${rule}</span>`)
        .join("")}</li>`;
    })
    .join("");
  $("onboarding-dismiss").textContent = t(language, "onboarding.dismiss");
  $("replay").textContent = t(language, "action.replay");
  $("export").textContent = t(language, "action.export");
  $("rotate-title").textContent = t(language, "rotate.title");
  $("rotate-body").textContent = t(language, "rotate.body");

  move.addEventListener("click", () => runtime.setMode("move"));
  attack.addEventListener("click", () => runtime.setMode("attack"));
  ability.addEventListener("click", () => runtime.setMode("ability"));
  endTurn.addEventListener("click", () => runtime.endTurn());
  $("rules").addEventListener("click", () => runtime.openRules());
  $("onboarding-dismiss").addEventListener("click", () =>
    runtime.dismissOnboarding(),
  );
  $("replay").addEventListener("click", () => runtime.replay());
  $("export").addEventListener("click", () => runtime.exportJson());
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  runtime.markReady("dom");

  const renderDom = () => {
    const readinessFailure = runtime.readiness.failure;
    if (readinessFailure)
      showStartupError(language, readinessFailure.messageKey as UiKey);
    onboarding.classList.toggle("hidden", !runtime.onboardingOpen);
    const terminal = runtime.displayState.status !== "active";
    result.classList.toggle("hidden", !terminal);
    if (terminal) {
      $("result-title").textContent = t(
        language,
        runtime.displayState.status === "victory"
          ? "result.victory"
          : "result.defeat",
      );
      $("result-stats").textContent =
        `${t(language, "result.rounds")}: ${runtime.displayState.round} · ${t(language, "result.duration")}: ${Math.ceil(runtime.session.activeDuration() / 1000)}s`;
    }
    const selected = runtime.selected;
    $("selected-status").textContent = selected
      ? `${t(language, selected.nameKey as Parameters<typeof t>[1])} · ${selected.hp}/${selected.maxHp} ${t(language, "hp")} · ${selected.ap} ${t(language, "ap")}`
      : "";
    $("feedback").textContent = runtime.feedback;
    ability.textContent = selected?.ability
      ? t(language, `action.${selected.ability}` as Parameters<typeof t>[1])
      : t(language, "action.ability");
    const disabled = !runtime.inputEnabled || !selected;
    move.disabled = disabled;
    attack.disabled = disabled;
    ability.disabled = disabled || !selected?.ability || selected.abilityUsed;
    endTurn.disabled = !runtime.inputEnabled;
    for (const [button, mode] of [
      [move, "move"],
      [attack, "attack"],
      [ability, "ability"],
    ] as const)
      button.classList.toggle(
        "active",
        runtime.actionMode === mode && Boolean(selected),
      );
  };
  runtime.subscribe(renderDom);
  const renderSpeed = () => {
    for (const [button, value] of speedButtons)
      button.classList.toggle(
        "active",
        runtime.presentationClock.multiplier === value,
      );
  };
  renderSpeed();
  renderDom();
  runtime.markReady("overlays");

  const updateOrientation = () => {
    const portrait = innerHeight > innerWidth;
    rotate.classList.toggle("hidden", !portrait);
    if (portrait) controls.setAttribute("inert", "");
    else controls.removeAttribute("inert");
    runtime.setPortrait(portrait);
  };
  addEventListener("resize", updateOrientation);
  updateOrientation();
  runtime.markReady("input");
  addEventListener("blur", () => runtime.setLifecycleBlocker("focus", true));
  addEventListener("focus", () => runtime.setLifecycleBlocker("focus", false));
  document.addEventListener("visibilitychange", () =>
    runtime.setLifecycleBlocker("visibility", document.hidden),
  );
  addEventListener("beforeunload", () => {
    if (runtime.session.observationState === "active") {
      const { sessionId } = runtime.observations.currentIds();
      runtime.observations.abandonSession(sessionId, "user_left");
    }
  });

  window.__TACTICS__ = {
    snapshot: () => structuredClone(runtime.session.state),
    eventNames: () => platform.events.map(({ name }) => name),
    get interactiveReady() {
      return runtime.readiness.isInteractive;
    },
    analytics: () =>
      runtime.observations.analytics(
        runtime.observations.currentIds().sessionId,
      ),
    provideHelp: (type, reason) =>
      runtime.observations.provideHelp(
        runtime.observations.currentIds().sessionId,
        type,
        reason,
      ),
  };
  window.__TACTICS_OPERATOR__ = {
    currentIds: () => runtime.observations.currentIds(),
    provideHelp: (sessionId, type, reason) =>
      runtime.observations.provideHelp(sessionId, type, reason),
    requestHelp: (sessionId) => runtime.observations.requestHelp(sessionId),
    abandonSession: (sessionId, reason) =>
      runtime.observations.abandonSession(sessionId, reason),
    setTesterMetadata: (sessionId, metadata) =>
      runtime.observations.setTesterMetadata(sessionId, metadata),
    exportSnapshot: (sessionId) =>
      runtime.observations.exportSnapshot(sessionId),
    finalizeSession: (sessionId) =>
      runtime.observations.finalizeSession(sessionId),
    inspect: (sessionId) => runtime.observations.inspect(sessionId),
    analytics: (sessionId) => runtime.observations.analytics(sessionId),
  };
}

let startupLanguage = normalizeLanguage(navigator.language);
void start().catch((error: unknown) => {
  console.error("[startup]", error);
  showStartupError(startupLanguage);
});
