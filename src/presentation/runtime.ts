import { dispatch } from "../core/engine";
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

export type ActionMode = "move" | "attack" | "ability";

export class GameRuntime {
  readonly observations: ObservationRegistry;
  lifecycle: RuntimeLifecycle;
  readonly readiness: ReadinessCoordinator;
  readonly gameplay: GameplayCoordinator;
  displayState: BattleState;
  selectedId: string | null = null;
  actionMode: ActionMode = "move";
  feedback = "";
  locked = false;
  onboardingOpen = false;
  portrait = false;
  private pendingFinal: BattleState | null = null;
  private lastPresentedAt = 0;
  private readonly listeners = new Set<() => void>();
  private rulesOpen = false;
  private readonly preferences = new ReleasePreferences(localStorage);

  constructor(
    public readonly platform: PlatformService,
    public readonly language: Language,
    context: AnalyticsContext,
  ) {
    this.observations = new ObservationRegistry(platform, context);
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
      this.session.state.status === "active"
    );
  }
  get selected(): Unit | undefined {
    return this.displayState.units.find(({ id }) => id === this.selectedId);
  }

  setPortrait(value: boolean): void {
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

  setLifecycleBlocker(source: "focus" | "visibility", blocked: boolean): void {
    this.lifecycle.setPaused(source, blocked);
    this.gameplay.setBlocker(source, blocked);
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

  private resolve(command: BattleCommand): void {
    const before = structuredClone(this.displayState);
    const result = this.session.execute(command);
    if (!result.accepted) {
      this.feedback = t(
        this.language,
        `reject.${result.reason}` as `reject.${RejectionReason}`,
      );
      this.notify();
      return;
    }
    if (command.type === "end-player-phase") {
      this.displayState = before;
      this.pendingFinal = structuredClone(result.state);
      this.lifecycle.enqueue(result.events);
      this.locked = true;
      this.feedback = t(this.language, "feedback.enemy");
    } else {
      this.displayState = structuredClone(result.state);
      this.feedback = this.describeEvents(result.events);
      if (!this.displayState.units.some(({ id }) => id === this.selectedId))
        this.selectedId = null;
    }
    if (this.session.state.status !== "active") this.gameplay.setTerminal(true);
    this.notify();
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
      !this.locked ||
      this.lifecycle.isPaused ||
      time - this.lastPresentedAt < 180
    )
      return;
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
      return;
    }
    if (this.lifecycle.pendingCount === 0 && this.pendingFinal) {
      this.displayState = this.pendingFinal;
      this.pendingFinal = null;
      this.locked = false;
      this.selectedId = null;
      this.feedback = "";
      this.notify();
    }
  }

  private applyPresentation(event: BattleEvent): void {
    const unit = (id: string) =>
      this.displayState.units.find((candidate) => candidate.id === id);
    if (event.type === "unit-moved") {
      const found = unit(event.unitId);
      if (found) found.position = { ...event.to };
    }
    if (event.type === "unit-damaged") {
      const found = unit(event.targetId);
      if (found) found.hp = Math.max(0, found.hp - event.amount);
    }
    if (event.type === "unit-healed") {
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
    this.lifecycle.destroy();
    this.observations.replay();
    this.lifecycle = this.newLifecycle();
    this.lifecycle.setPaused("portrait", this.portrait);
    this.gameplay.beginReplay();
    this.displayState = structuredClone(this.session.state);
    this.selectedId = null;
    this.actionMode = "move";
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
