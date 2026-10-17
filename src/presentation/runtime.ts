import { dispatch } from "../core/engine";
import {
  decisionStateFingerprint,
  enumerateLegalSurvivorCommands,
} from "../core/survivor-autoplay";
import { reachableCells } from "../core/grid";
import type {
  BattleCommand,
  BattleEvent,
  BattleState,
  Position,
  RejectionReason,
  Unit,
} from "../core/types";
import { t, type Language } from "../localization";
import type { PlatformService } from "../platform";
import {
  BattleSession,
  type AnalyticsContext,
} from "../platform/battle-session";
import { RuntimeLifecycle } from "../platform/runtime-lifecycle";
import { ObservationRegistry } from "../platform/operator";
import {
  ReadinessCoordinator,
  type ReadinessPart,
} from "../platform/readiness";
import { GameplayCoordinator } from "../platform/gameplay-coordinator";
import { ReleasePreferences } from "../release/persistence";
import type { BootstrapDependencies } from "../bootstrap";
import {
  OpenJevSurvivorPolicy,
  openJevConfig,
} from "../survivor/openjev-client";
import {
  ResilientSurvivorPolicy,
  DeterministicSurvivorPolicy,
} from "../survivor/resilient-policy";
import type {
  SurvivorControlMode,
  SurvivorPolicy,
  SurvivorPolicyConfig,
} from "../survivor/policy";

export type ActionMode = "move" | "attack" | "ability";
export type AutoplaySpeed = 0.25 | 0.5 | 1 | 2 | 4;

export interface GameRuntimeOptions {
  survivor?: Partial<SurvivorPolicyConfig> & { policy?: SurvivorPolicy };
  autoplaySpeed?: AutoplaySpeed;
}

export class PresentationClock {
  private speed: AutoplaySpeed;
  constructor(speed: AutoplaySpeed = 1) {
    this.speed = speed;
  }
  get multiplier(): AutoplaySpeed {
    return this.speed;
  }
  set multiplier(value: AutoplaySpeed) {
    this.speed =
      value === 0.25
        ? 0.25
        : value === 0.5
          ? 0.5
          : value === 4
            ? 4
            : value === 2
              ? 2
              : 1;
  }
  duration(baseMs: number): number {
    return Math.max(1, Math.round(baseMs / this.speed));
  }
  setSpeed(value: AutoplaySpeed): void {
    this.multiplier = value;
  }
}

const defaultSurvivorConfig: SurvivorPolicyConfig = {
  mode: "human",
  proxyUrl: "/v1/openjev/choose",
  timeoutMs: 5_000,
  maxActionsPerPhase: 12,
};

const deterministicCandidate = (
  candidates: readonly { id: string; command: BattleCommand }[],
) =>
  candidates.find(({ command }) => command.type === "end-player-phase") ??
  candidates[0];

export class GameRuntime {
  readonly observations: ObservationRegistry;
  lifecycle: RuntimeLifecycle;
  readonly readiness: ReadinessCoordinator;
  readonly gameplay: GameplayCoordinator;
  displayState: BattleState;
  selectedId: string | null = null;
  activeActorId: string | null = null;
  activeTargetId: string | null = null;
  actionMode: ActionMode = "move";
  feedback = "";
  locked = false;
  onboardingOpen = false;
  portrait = false;
  private pendingFinal: BattleState | null = null;
  private lastPresentedAt = 0;
  private readonly listeners = new Set<() => void>();
  private readonly activeBlockers = new Set<
    "focus" | "visibility" | "mwa_intent"
  >();
  private rulesOpen = false;
  private readonly preferences = new ReleasePreferences(localStorage);
  private survivorMode: SurvivorControlMode;
  private readonly survivorPolicy: SurvivorPolicy;
  private readonly maxActionsPerPhase: number;
  readonly presentationClock: PresentationClock;
  private autoplayEpoch = 0;
  private autoplayController: AbortController | null = null;
  private autoplayInFlight = false;
  private autoplayDecisions = 0;
  private nextAutoplayAt = 0;

  constructor(
    public readonly platform: PlatformService,
    public language: Language,
    context: AnalyticsContext,
    _dependencies?: BootstrapDependencies,
    options: GameRuntimeOptions = {},
  ) {
    const survivor = {
      ...defaultSurvivorConfig,
      ...options.survivor,
      mode:
        _dependencies?.controlMode ??
        options.survivor?.mode ??
        defaultSurvivorConfig.mode,
    };
    this.survivorMode = survivor.mode;
    const savedLocale =
      context.releaseProfile === "solana-mobile"
        ? this.preferences.getLocale()
        : null;
    if (savedLocale) this.language = savedLocale;
    this.observations = new ObservationRegistry(
      platform,
      { ...context, locale: this.language },
      undefined,
      undefined,
      this.survivorMode,
    );
    this.maxActionsPerPhase = Math.max(
      1,
      Math.floor(survivor.maxActionsPerPhase),
    );
    this.presentationClock = new PresentationClock(options.autoplaySpeed ?? 1);
    const hasProxyUrl = Boolean(survivor.proxyUrl?.trim());
    const primary =
      _dependencies?.survivorPolicy ??
      survivor.policy ??
      (hasProxyUrl ? new OpenJevSurvivorPolicy(openJevConfig(survivor)) : null);
    this.survivorPolicy = new ResilientSurvivorPolicy(
      primary,
      new DeterministicSurvivorPolicy(),
    );
    this.lifecycle = this.newLifecycle();
    this.displayState = structuredClone(this.session.state);
    this.onboardingOpen = !this.preferences.isOnboardingDismissed();
    if (this.onboardingOpen) this.session.onboarding("shown");
    this.gameplay = new GameplayCoordinator({
      startGameplay: () => this.platform.startGameplay(),
      stopGameplay: () => this.platform.stopGameplay(),
      startBattle: () => this.observations.startCurrent(),
      pauseRuntime: () => this.lifecycle.setPaused("platform", true),
      resumeRuntime: () => this.lifecycle.setPaused("platform", false),
    });
    if (!this.onboardingOpen) this.gameplay.dismissOnboarding();
    this.readiness = new ReadinessCoordinator(
      () => this.session.gameLoaded(),
      () => {
        this.platform.markInteractive();
        this.gameplay.markReady();
        this.notify();
      },
    );
    this.platform.subscribeLifecycle((event) =>
      this.gameplay.setPlatformPaused(event === "pause"),
    );
  }

  get session(): BattleSession {
    return this.observations.currentSession();
  }

  private newLifecycle(): RuntimeLifecycle {
    return new RuntimeLifecycle(this.platform, this.session, {
      pause: () => window.__PHASER_GAME__?.sound.pauseAll(),
      resume: () => window.__PHASER_GAME__?.sound.resumeAll(),
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  notify(): void {
    this.listeners.forEach((listener) => listener());
  }
  get inputEnabled(): boolean {
    return (
      this.readiness.isInteractive &&
      this.session.observationState === "active" &&
      this.lifecycle.inputEnabled &&
      !this.locked &&
      !this.onboardingOpen &&
      !this.portrait &&
      this.session.state.status === "active" &&
      !(this.autoplayActive && this.session.state.phase === "player")
    );
  }
  get autoplayActive(): boolean {
    return this.survivorMode === "openjev";
  }
  get controlMode(): SurvivorControlMode {
    return this.survivorMode;
  }
  setControlMode(mode: SurvivorControlMode): void {
    if (mode === this.survivorMode) return;
    this.cancelAutoplay();
    this.survivorMode = mode;
    this.selectedId = null;
    this.activeActorId = null;
    this.activeTargetId = null;
    this.actionMode = "move";
    this.feedback = "";
    this.observations.setControlMode(mode);
    this.notify();
  }
  setLanguage(language: Language): void {
    if (language === this.language) {
      this.preferences.setLocale(language);
      return;
    }
    this.language = language;
    this.preferences.setLocale(language);
    this.observations.setLocale(language);
    this.notify();
  }
  get presentationIdle(): boolean {
    return (
      this.lifecycle.pendingCount === 0 &&
      !this.locked &&
      !this.pendingFinal &&
      !this.lifecycle.isPaused &&
      !this.onboardingOpen &&
      !this.portrait &&
      this.session.state.status === "active" &&
      this.session.state.phase === "player" &&
      decisionStateFingerprint(this.displayState) ===
        decisionStateFingerprint(this.session.state)
    );
  }
  get selected(): Unit | undefined {
    return this.displayState.units.find(({ id }) => id === this.selectedId);
  }

  setPortrait(value: boolean): void {
    this.cancelAutoplay();
    this.portrait = value;
    this.lifecycle.setPaused("portrait", value);
    this.gameplay.setBlocker("portrait", value);
    this.notify();
  }

  markReady(part: ReadinessPart): void {
    this.readiness.mark(part);
  }

  failReady(part: ReadinessPart, messageKey: string): void {
    this.readiness.fail(part, messageKey);
    this.notify();
  }

  setLifecycleBlocker(
    source: "focus" | "visibility" | "mwa_intent",
    blocked: boolean,
  ): void {
    if (blocked) {
      this.activeBlockers.add(source);
      this.cancelAutoplay();
    } else {
      this.activeBlockers.delete(source);
    }
    this.lifecycle.setPaused(source, blocked);
    this.gameplay.setBlocker(source, blocked);
    this.notify();
  }

  setMode(mode: ActionMode): void {
    if (!this.inputEnabled || !this.selected) return;
    this.actionMode = mode;
    this.feedback =
      mode === "move"
        ? t(this.language, "action.move")
        : t(this.language, "feedback.target");
    this.notify();
  }

  legalCells(): Position[] {
    if (!this.selected || this.actionMode !== "move" || !this.inputEnabled)
      return [];
    return reachableCells(this.session.state, this.selected.id);
  }

  legalTargetIds(): string[] {
    const selected = this.selected;
    if (!selected || this.actionMode === "move" || !this.inputEnabled)
      return [];
    return this.session.state.units
      .filter((candidate) => {
        const command: BattleCommand =
          this.actionMode === "attack"
            ? { type: "attack", unitId: selected.id, targetId: candidate.id }
            : { type: "ability", unitId: selected.id, targetId: candidate.id };
        return dispatch(this.session.state, command).accepted;
      })
      .map(({ id }) => id);
  }

  handleCell(position: Position): void {
    if (!this.inputEnabled) return;
    const clicked = this.session.state.units.find(
      (unit) =>
        unit.position.x === position.x && unit.position.y === position.y,
    );
    if (clicked?.team === "survivor") {
      this.selectedId = clicked.id;
      this.actionMode = "move";
      this.session.select(clicked.id);
      this.feedback = "";
      this.notify();
      return;
    }
    const selected = this.selected;
    if (!selected) {
      this.feedback = t(this.language, "feedback.select");
      this.notify();
      return;
    }
    let command: BattleCommand;
    if (this.actionMode === "move")
      command = { type: "move", unitId: selected.id, to: position };
    else if (!clicked) {
      this.feedback = t(this.language, "feedback.target");
      this.notify();
      return;
    } else
      command = {
        type: this.actionMode,
        unitId: selected.id,
        targetId: clicked.id,
      };
    this.resolve(command);
  }

  endTurn(): void {
    if (this.inputEnabled) this.resolve({ type: "end-player-phase" });
  }

  private resolve(
    command: BattleCommand,
    sourceMode: SurvivorControlMode = this.survivorMode,
  ): void {
    const before = structuredClone(this.displayState);
    const result = this.session.execute(command, sourceMode);
    if (!result.accepted) {
      this.feedback = t(
        this.language,
        `reject.${result.reason}` as `reject.${RejectionReason}`,
      );
      this.notify();
      return;
    }
    if (result.accepted) {
      this.cancelAutoplay();
      this.autoplayDecisions += 1;
      this.nextAutoplayAt = 0;
    }
    if (command.type === "end-player-phase") {
      this.displayState = before;
      this.pendingFinal = structuredClone(result.state);
      this.lifecycle.enqueue(result.events);
      this.locked = true;
      this.activeActorId = null;
      this.activeTargetId = null;
      this.feedback = t(this.language, "feedback.enemy");
    } else {
      this.displayState = structuredClone(result.state);
      this.activeActorId = "unitId" in command ? command.unitId : null;
      this.activeTargetId = "targetId" in command ? command.targetId : null;
      if (this.autoplayActive && "unitId" in command)
        this.selectedId = command.unitId;
      this.feedback = this.describeEvents(result.events);
      if (!this.displayState.units.some(({ id }) => id === this.selectedId))
        this.selectedId = null;
    }
    if (this.session.state.status !== "active") this.gameplay.setTerminal(true);
    this.notify();
  }

  private cancelAutoplay(): void {
    this.autoplayEpoch += 1;
    this.autoplayController?.abort();
    this.autoplayController = null;
    this.autoplayInFlight = false;
  }

  private maybeAutoplay(time: number): void {
    if (
      !this.autoplayActive ||
      !this.presentationIdle ||
      this.autoplayInFlight ||
      time < this.nextAutoplayAt
    )
      return;
    const decisionSet = enumerateLegalSurvivorCommands(this.session.state);
    if (!decisionSet.candidates.length) return;
    const epoch = this.autoplayEpoch;
    const controller = new AbortController();
    this.autoplayController = controller;
    this.autoplayInFlight = true;
    const candidates = decisionSet.candidates.map(
      ({ id, command, summary }) => ({
        id,
        command,
        kind: summary.kind,
        ...(summary.unitId ? { actorId: summary.unitId } : {}),
        ...(summary.targetId ? { targetId: summary.targetId } : {}),
        ...(summary.to ? { to: summary.to } : {}),
      }),
    );
    void this.survivorPolicy
      .choose(this.session.state, candidates, controller.signal)
      .then((decision) => {
        if (
          epoch !== this.autoplayEpoch ||
          controller.signal.aborted ||
          !this.presentationIdle
        )
          return;
        const current = enumerateLegalSurvivorCommands(this.session.state);
        if (current.fingerprint !== decisionSet.fingerprint) return;
        const candidate =
          this.autoplayDecisions >= this.maxActionsPerPhase
            ? deterministicCandidate(current.candidates)
            : (current.candidates.find(
                ({ id }) => id === decision.candidateId,
              ) ?? deterministicCandidate(current.candidates));
        if (candidate) this.resolve(candidate.command, "openjev");
      })
      .catch(() => undefined)
      .finally(() => {
        if (epoch === this.autoplayEpoch) {
          this.autoplayInFlight = false;
          this.autoplayController = null;
          this.nextAutoplayAt = time + this.presentationClock.duration(400);
          this.notify();
        }
      });
  }
  private describeEvents(events: readonly BattleEvent[]): string {
    if (events.some(({ type }) => type === "unit-defeated"))
      return t(this.language, "feedback.defeated");
    if (
      events.some(
        (event) => event.type === "unit-damaged" && event.coverMitigated,
      )
    )
      return t(this.language, "feedback.cover");
    return "";
  }

  update(time: number): void {
    if (
      this.locked &&
      !this.lifecycle.isPaused &&
      time - this.lastPresentedAt >= this.presentationClock.duration(360)
    ) {
      const event = this.lifecycle.takeNext();
      if (event) {
        this.lastPresentedAt = time;
        this.applyPresentation(event);
        this.feedback =
          this.describeEvents([event]) ||
          (event.type === "unit-moved"
            ? `${event.unitId} → ${event.to.x},${event.to.y}`
            : this.feedback);
        this.notify();
      } else if (this.lifecycle.pendingCount === 0 && this.pendingFinal) {
        this.displayState = this.pendingFinal;
        this.pendingFinal = null;
        this.locked = false;
        this.autoplayDecisions = 0;
        this.selectedId = null;
        this.activeActorId = null;
        this.activeTargetId = null;
        this.feedback = "";
        this.notify();
      }
    }
    this.maybeAutoplay(time);
  }

  private applyPresentation(event: BattleEvent): void {
    const unit = (id: string) =>
      this.displayState.units.find((candidate) => candidate.id === id);
    if (event.type === "unit-moved") {
      this.activeActorId = event.unitId;
      this.activeTargetId = null;
      const found = unit(event.unitId);
      if (found) found.position = { ...event.to };
    }
    if (event.type === "unit-damaged") {
      this.activeActorId = event.sourceId;
      this.activeTargetId = event.targetId;
      const found = unit(event.targetId);
      if (found) found.hp = Math.max(0, found.hp - event.amount);
    }
    if (event.type === "unit-healed") {
      this.activeActorId = event.sourceId;
      this.activeTargetId = event.targetId;
      const found = unit(event.targetId);
      if (found) found.hp = Math.min(found.maxHp, found.hp + event.amount);
    }
    if (event.type === "unit-defeated")
      this.displayState.units = this.displayState.units.filter(
        ({ id }) => id !== event.unitId,
      );
    if (event.type === "phase-changed") {
      this.displayState.phase = event.phase;
      this.displayState.round = event.round;
    }
    if (event.type === "battle-finished")
      this.displayState.status = event.result;
  }

  dismissOnboarding(): void {
    if (!this.onboardingOpen) return;
    this.onboardingOpen = false;
    if (this.rulesOpen) {
      this.rulesOpen = false;
      this.gameplay.setBlocker("rules", false);
      this.lifecycle.setPaused("rules", false);
    } else {
      this.preferences.dismissOnboarding();
      this.gameplay.dismissOnboarding();
    }
    this.session.onboarding("completed");
    this.session.onboarding("dismissed");
    this.notify();
  }

  openRules(): void {
    this.cancelAutoplay();
    this.onboardingOpen = true;
    this.rulesOpen = true;
    this.gameplay.setBlocker("rules", true);
    this.lifecycle.setPaused("rules", true);
    this.session.onboarding("shown");
    this.session.rulesOpened();
    this.notify();
  }

  replay(): void {
    if (this.session.state.status === "active") return;
    this.cancelAutoplay();
    this.lifecycle.destroy();
    this.observations.replay();
    this.lifecycle = this.newLifecycle();
    this.lifecycle.setPaused("portrait", this.portrait);
    for (const blocker of this.activeBlockers)
      this.lifecycle.setPaused(blocker, true);
    this.gameplay.beginReplay();
    this.displayState = structuredClone(this.session.state);
    this.pendingFinal = null;
    this.selectedId = null;
    this.activeActorId = null;
    this.activeTargetId = null;
    this.actionMode = "move";
    this.autoplayDecisions = 0;
    this.nextAutoplayAt = 0;
    this.locked = false;
    this.feedback = "";
    this.notify();
  }

  exportJson(): void {
    const { sessionId } = this.observations.currentIds();
    if (this.session.observationState === "active")
      this.observations.abandonSession(sessionId, "facilitator_ended");
    const json = this.observations.finalizeSession(sessionId);
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `tactics-session-${sessionId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
