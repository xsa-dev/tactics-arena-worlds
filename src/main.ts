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
import type {
  ProofVerificationResult,
  SeekerVerifier,
  SignedBattleProofV1,
  WalletAdapterLike,
} from "./solana/types";
import type { SolanaWalletCoordinator } from "./solana/wallet-coordinator";

declare const __RELEASE_PROFILE__: string | undefined;

declare global {
  interface Window {
    YaGames?: { init(): Promise<YandexSdk> };
    __PHASER_GAME__?: Phaser.Game;
    __TACTICS_SOLANA_MOCK__?: {
      walletAdapter?: WalletAdapterLike;
      seekerVerifier?: SeekerVerifier;
    };
    __TACTICS__: {
      snapshot(): ReturnType<
        typeof structuredClone<GameRuntime["session"]["state"]>
      >;
      eventNames(): string[];
      readonly interactiveReady: boolean;
      analytics(): ReturnType<GameRuntime["observations"]["analytics"]>;
      provideHelp(type: HelpType, reason: HelpReason): void;
      setControlMode(mode: "human" | "openjev"): void;
      setLanguage(language: Language): void;
      connectWallet?(): Promise<string>;
      signLastBattleProof?(): Promise<SignedBattleProofV1>;
      verifyProof?(
        proof?: SignedBattleProofV1,
      ): Promise<ProofVerificationResult>;
      lastSignedProof?(): SignedBattleProofV1 | null;
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
    sdkEnabled: ACTIVE_RELEASE_CONFIG.sdkEnabled,
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
    ACTIVE_RELEASE_CONFIG.profile,
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
    {
      ...(window.__TACTICS_SOLANA_MOCK__?.walletAdapter
        ? { walletAdapter: window.__TACTICS_SOLANA_MOCK__.walletAdapter }
        : {}),
      ...(window.__TACTICS_SOLANA_MOCK__?.seekerVerifier
        ? { seekerVerifier: window.__TACTICS_SOLANA_MOCK__.seekerVerifier }
        : {}),
    },
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
  const topControls = $("top-controls");
  const modeToggle = $<HTMLButtonElement>("mode-toggle");
  const localeToggle = $<HTMLButtonElement>("locale-toggle");
  const walletButton = $<HTMLButtonElement>("wallet-button");
  const seekerBadge = $("seeker-badge");
  const signProofButton = $<HTMLButtonElement>("sign-proof");
  const verifyProofButton = $<HTMLButtonElement>("verify-proof");
  const proofStatus = $("result-proof-status");
  const aiStatus = $("ai-status");
  const aiSpeed = $("ai-speed");
  const aiSpeedLabel = $("ai-speed-label");
  const speedButtons = [
    [$("speed-0-25"), 0.25],
    [$("speed-0-5"), 0.5],
    [$("speed-1"), 1],
    [$("speed-2"), 2],
    [$("speed-4"), 4],
  ] as const;
  const isSolanaMobile = ACTIVE_RELEASE_CONFIG.profile === "solana-mobile";
  topControls.classList.toggle("hidden", !isSolanaMobile);
  walletButton.classList.toggle("hidden", !isSolanaMobile);
  let walletCoordinator: SolanaWalletCoordinator | null = null;
  let lastCachedBattleId = "";

  if (
    typeof __RELEASE_PROFILE__ !== "undefined" &&
    __RELEASE_PROFILE__ === "solana-mobile" &&
    isSolanaMobile
  ) {
    const solanaModule = await import("./solana/wallet-coordinator");
    void solanaModule
      .registerSolanaMobileWalletAdapter(
        ACTIVE_RELEASE_CONFIG.solanaMobile.appUrl,
        sessionStorage,
      )
      .catch(() => undefined);
    walletCoordinator = new solanaModule.SolanaWalletCoordinator({
      sessionStorage,
      setBlocker: (source, blocked) =>
        runtime.setLifecycleBlocker(source, blocked),
      emitAnalytics: (name, properties) =>
        platform.emit({
          name,
          atMs: performance.now(),
          properties: {
            ...context,
            locale: runtime.language,
            battleId: runtime.session.state.battleId,
            ...properties,
          },
        }),
      ...(dependencies.walletAdapter
        ? { walletAdapter: dependencies.walletAdapter }
        : {}),
      ...(dependencies.seekerVerifier
        ? { seekerVerifier: dependencies.seekerVerifier }
        : {}),
      rpcUrl: ACTIVE_RELEASE_CONFIG.solanaMobile.rpcUrl,
    });
  }

  for (const [button, value] of speedButtons) {
    button.addEventListener("click", () => {
      runtime.presentationClock.multiplier = value;
      renderSpeed();
    });
  }
  modeToggle.addEventListener("click", () => {
    runtime.setControlMode(
      runtime.controlMode === "openjev" ? "human" : "openjev",
    );
  });
  localeToggle.addEventListener("click", () => {
    runtime.setLanguage(runtime.language === "en" ? "ru" : "en");
  });
  walletButton.addEventListener("click", () => {
    void walletCoordinator?.connect().catch(() => undefined);
  });
  signProofButton.addEventListener("click", () => {
    void walletCoordinator?.signLastBattleProof().catch(() => undefined);
  });
  verifyProofButton.addEventListener("click", () => {
    void walletCoordinator?.verifyProof().catch(() => undefined);
  });

  move.addEventListener("click", () => runtime.setMode("move"));
  attack.addEventListener("click", () => runtime.setMode("attack"));
  ability.addEventListener("click", () => runtime.setMode("ability"));
  endTurn.addEventListener("click", () => runtime.endTurn());
  $("rules").addEventListener("click", () => runtime.openRules());
  $("onboarding-dismiss").addEventListener("click", () =>
    runtime.dismissOnboarding(),
  );
  $("replay").addEventListener("click", () => {
    walletCoordinator?.clearCachedBattle();
    runtime.replay();
  });
  $("export").addEventListener("click", () => runtime.exportJson());
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  runtime.markReady("dom");

  const renderDom = () => {
    const lang = runtime.language;
    const isAi = runtime.controlMode === "openjev";
    document.documentElement.lang = lang;
    document.title = t(lang, "game.title");
    move.textContent = t(lang, "action.move");
    attack.textContent = t(lang, "action.attack");
    endTurn.textContent = t(lang, "action.endTurn");
    aiStatus.textContent = isAi ? t(lang, "ai.status") : "";
    aiSpeed.classList.toggle("hidden", !isAi && !isSolanaMobile);
    aiSpeedLabel.textContent = t(lang, "ai.speed");
    for (const [button, value] of speedButtons) {
      button.textContent = t(
        lang,
        `ai.speed.${value}` as Parameters<typeof t>[1],
      );
      button.setAttribute("aria-label", `${t(lang, "ai.speed")} ${value}×`);
    }
    modeToggle.textContent = t(lang, isAi ? "mode.ai" : "mode.human");
    modeToggle.classList.toggle("active", isAi);
    localeToggle.textContent = t(lang, "locale.switch");
    const connectedAddress = walletCoordinator?.walletAddress ?? null;
    if (connectedAddress) {
      walletButton.dataset.connected = "true";
      walletButton.textContent = `${t(lang, "wallet.connected")}: ${connectedAddress.slice(0, 4)}…${connectedAddress.slice(-4)}`;
    } else {
      delete walletButton.dataset.connected;
      walletButton.textContent = t(lang, "wallet.connect");
    }
    const seekerVerified = Boolean(walletCoordinator?.seekerVerified);
    seekerBadge.textContent = t(lang, "wallet.seekerVerified");
    seekerBadge.classList.toggle("hidden", !isSolanaMobile || !seekerVerified);
    $("rules").setAttribute("aria-label", t(lang, "action.rules"));
    $("onboarding-title").textContent = t(lang, "onboarding.title");
    $("onboarding-list").innerHTML = [1, 2, 3, 4, 5, 6]
      .map((index) => {
        const key = isAi ? `onboarding.ai.${index}` : `onboarding.${index}`;
        const copy = t(lang, key as Parameters<typeof t>[1]);
        if (index !== 5) return `<li>${copy}</li>`;
        return `<li class="ability-briefing">${copy
          .split("; ")
          .map((rule) => `<span class="ability-rule">${rule}</span>`)
          .join("")}</li>`;
      })
      .join("");
    $("onboarding-dismiss").textContent = t(lang, "onboarding.dismiss");
    $("replay").textContent = t(lang, "action.replay");
    $("export").textContent = t(lang, "action.export");
    $("rotate-title").textContent = t(lang, "rotate.title");
    $("rotate-body").textContent = t(lang, "rotate.body");

    const readinessFailure = runtime.readiness.failure;
    if (readinessFailure)
      showStartupError(lang, readinessFailure.messageKey as UiKey);
    onboarding.classList.toggle("hidden", !runtime.onboardingOpen);
    if (
      walletCoordinator &&
      runtime.session.state.status !== "active" &&
      lastCachedBattleId !== runtime.session.state.battleId
    ) {
      lastCachedBattleId = runtime.session.state.battleId;
      walletCoordinator.cacheCompletedBattle(runtime.session);
    }
    const hasCachedProof =
      isSolanaMobile && Boolean(walletCoordinator?.hasUnsignedProof);
    const terminal =
      runtime.displayState.status !== "active" ||
      (hasCachedProof &&
        !runtime.onboardingOpen &&
        runtime.session.acceptedCommands.length === 0);
    result.classList.toggle("hidden", !terminal);
    if (terminal) {
      const cachedUnsigned = walletCoordinator?.readCachedUnsignedProof();
      const resultStatus =
        runtime.displayState.status !== "active"
          ? runtime.displayState.status
          : (cachedUnsigned?.payload.result ?? "victory");
      const resultRounds =
        runtime.displayState.status !== "active"
          ? runtime.displayState.round
          : (cachedUnsigned?.payload.rounds ?? 1);
      const resultDurationMs =
        runtime.displayState.status !== "active"
          ? runtime.session.activeDuration()
          : (cachedUnsigned?.payload.activeDurationMs ?? 0);
      $("result-title").textContent = t(
        lang,
        resultStatus === "victory" ? "result.victory" : "result.defeat",
      );
      $("result-stats").textContent =
        `${t(lang, "result.rounds")}: ${resultRounds} · ${t(lang, "result.duration")}: ${Math.ceil(resultDurationMs / 1000)}s`;
    }
    signProofButton.classList.toggle("hidden", !isSolanaMobile || !terminal);
    const signedProof = walletCoordinator?.lastSignedProof ?? null;
    signProofButton.textContent = t(
      lang,
      signedProof ? "proof.signed" : "proof.sign",
    );
    verifyProofButton.classList.toggle(
      "hidden",
      !isSolanaMobile || !signedProof,
    );
    verifyProofButton.textContent = t(lang, "proof.verify");
    const verification = walletCoordinator?.lastVerificationResult ?? null;
    if (isSolanaMobile && (signedProof || verification)) {
      proofStatus.classList.remove("hidden");
      const statusParts: string[] = [];
      if (seekerVerified) statusParts.push(t(lang, "wallet.seekerVerified"));
      if (verification)
        statusParts.push(
          t(lang, verification.valid ? "proof.verified" : "proof.invalid"),
        );
      else if (signedProof) statusParts.push(t(lang, "proof.signed"));
      proofStatus.textContent = statusParts.join(" · ");
    } else {
      proofStatus.classList.add("hidden");
      proofStatus.textContent = "";
    }
    const selected = runtime.selected;
    $("selected-status").textContent = selected
      ? `${t(lang, selected.nameKey as Parameters<typeof t>[1])} · ${selected.hp}/${selected.maxHp} ${t(lang, "hp")} · ${selected.ap} ${t(lang, "ap")}`
      : "";
    $("feedback").textContent = runtime.feedback;
    ability.textContent = selected?.ability
      ? t(lang, `action.${selected.ability}` as Parameters<typeof t>[1])
      : t(lang, "action.ability");
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
  walletCoordinator?.subscribe(renderDom);
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
    setControlMode: (mode) => runtime.setControlMode(mode),
    setLanguage: (lang) => runtime.setLanguage(lang),
    ...(walletCoordinator
      ? {
          connectWallet: () => walletCoordinator.connect(),
          signLastBattleProof: () => walletCoordinator.signLastBattleProof(),
          verifyProof: (proof) => walletCoordinator.verifyProof(proof),
          lastSignedProof: () => walletCoordinator.lastSignedProof,
        }
      : {}),
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
