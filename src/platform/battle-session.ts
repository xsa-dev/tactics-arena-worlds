import { dispatch } from "../core/engine";
import { createBattle } from "../core/scenario";
import type { BattleCommand, BattleState, CommandResult } from "../core/types";
import type { Language } from "../localization";
import type { JsonValue, PlatformService, SessionMetadata } from "./index";
import type { AnalyticsEvent } from "./index";
import type { ReleaseProfile } from "../release/config";

export interface AnalyticsContext {
  sessionId: string;
  testerId: string;
  manifestVersion: string;
  releaseProfile: ReleaseProfile;
  deviceClass: "mobile" | "desktop";
  inputType: "touch" | "mouse";
  viewport: string;
  locale: Language;
}

type OnboardingAction = "shown" | "completed" | "dismissed";
export type HelpType = "technical" | "gameplay";
export type HelpReason = "requested" | "timeout" | "technical_issue";
export type AbandonReason =
  "user_left" | "technical_failure" | "facilitator_ended";
export type ObservationState =
  "prestart" | "active" | "terminal" | "abandoned" | "finalized";

export class BattleSession {
  state: BattleState;
  private started = false;
  private loaded = false;
  private firstAction = false;
  private finished = false;
  private abandoned = false;
  private replayed = false;
  private abandonReason: AbandonReason | null = null;
  private frozenExport: string | null = null;
  private invalidActionCount = 0;
  private activeStartedAt = 0;
  private activeAccumulated = 0;
  private paused = false;
  private readonly onboardingEvents = new Set<OnboardingAction>();
  private readonly help: Array<{
    type: HelpType;
    atMs: number;
    reason: HelpReason;
  }> = [];
  private readonly ownEvents: AnalyticsEvent[] = [];
  private helpRequested = false;
  private metadata: SessionMetadata = {
    cohortIteration: "initial",
    tacticsExperience: "none",
    comprehension: null,
  };

  constructor(
    private readonly platform: PlatformService,
    private readonly context: AnalyticsContext,
    battleId: string,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.state = createBattle(battleId);
  }

  private emit(name: string, extra: Record<string, JsonValue> = {}): void {
    const event = {
      name,
      atMs: this.now(),
      properties: { ...this.context, battleId: this.state.battleId, ...extra },
    };
    this.ownEvents.push(structuredClone(event));
    this.platform.emit(event);
  }

  gameLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.emit("game_loaded");
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.activeStartedAt = this.now();
    this.emit("battle_started");
  }

  onboarding(action: OnboardingAction): void {
    if (this.onboardingEvents.has(action)) return;
    this.onboardingEvents.add(action);
    this.emit(`onboarding_${action}`);
  }

  select(unitId: string): void {
    this.emit("unit_selected", { unitId });
  }
  requestHelp(): void {
    if (this.helpRequested) throw new Error("Help request already recorded");
    this.helpRequested = true;
    this.emit("help_requested", { helpAtMs: this.activeDuration() });
  }

  rulesOpened(): void {
    this.emit("rules_opened");
  }

  provideHelp(type: HelpType, reason: HelpReason): void {
    const atMs = this.activeDuration();
    this.help.push({ type, atMs, reason });
    this.emit("facilitator_help_provided", {
      helpType: type,
      helpAtMs: atMs,
      helpReason: reason,
    });
  }

  execute(command: BattleCommand): CommandResult {
    const result = dispatch(this.state, command);
    if (!result.accepted) {
      this.invalidActionCount += 1;
      this.emit("invalid_action", {
        reason: result.reason,
        commandType: command.type,
      });
      return result;
    }
    this.state = result.state;
    if (!this.firstAction) {
      this.firstAction = true;
      this.emit("first_action", { actionType: command.type });
    }
    if (command.type === "move")
      this.emit("move_completed", {
        unitId: command.unitId,
        x: command.to.x,
        y: command.to.y,
      });
    if (command.type === "attack")
      this.emit("attack_completed", {
        unitId: command.unitId,
        targetId: command.targetId,
      });
    if (command.type === "ability")
      this.emit("unit_ability_used", {
        unitId: command.unitId,
        targetId: command.targetId,
      });
    if (command.type === "end-player-phase")
      this.emit("turn_ended", { round: this.state.round });
    if (this.state.status !== "active")
      this.finish(this.state.status, this.state.round);
    return result;
  }

  pause(): void {
    if (!this.started || this.paused || this.finished) return;
    this.activeAccumulated += Math.max(0, this.now() - this.activeStartedAt);
    this.paused = true;
  }

  resume(): void {
    if (!this.paused || this.finished) return;
    this.paused = false;
    this.activeStartedAt = this.now();
  }

  activeDuration(): number {
    if (!this.started) return 0;
    return Math.round(
      this.activeAccumulated +
        (this.paused || this.finished
          ? 0
          : Math.max(0, this.now() - this.activeStartedAt)),
    );
  }

  private helpSummary(): Record<string, JsonValue> {
    const gameplay = this.help.find(({ type }) => type === "gameplay");
    const latest = gameplay ?? this.help.at(-1);
    return {
      facilitatorHelpUsed: Boolean(gameplay),
      facilitatorHelpType: latest?.type ?? null,
      facilitatorHelpAtMs: latest?.atMs ?? null,
      facilitatorHelpReason: latest?.reason ?? null,
      independentCompletion: this.finished && !this.abandoned && !gameplay,
    };
  }

  private finish(result: "victory" | "defeat", rounds: number): void {
    if (this.finished) return;
    if (!this.paused)
      this.activeAccumulated += Math.max(0, this.now() - this.activeStartedAt);
    this.finished = true;
    this.emit("battle_finished", {
      result,
      rounds,
      activeDurationMs: this.activeDuration(),
      invalidActionCount: this.invalidActionCount,
      ...this.helpSummary(),
    });
  }

  abandon(reason: AbandonReason = "facilitator_ended"): boolean {
    if (this.abandoned || this.finished || !this.started) return false;
    this.abandoned = true;
    this.abandonReason = reason;
    if (!this.paused)
      this.activeAccumulated += Math.max(0, this.now() - this.activeStartedAt);
    this.paused = true;
    this.emit("battle_abandoned", {
      activeDurationMs: this.activeDuration(),
      invalidActionCount: this.invalidActionCount,
      abandonReason: reason,
    });
    return true;
  }

  replayClicked(): void {
    if (!this.finished || this.replayed) return;
    this.replayed = true;
    this.emit("replay_clicked");
  }

  export(metadata: SessionMetadata): string {
    this.metadata = { ...metadata };
    return this.exportSnapshot();
  }

  get observationState(): ObservationState {
    if (this.frozenExport) return "finalized";
    if (this.abandoned) return "abandoned";
    if (this.finished) return "terminal";
    if (this.started) return "active";
    return "prestart";
  }

  get analytics(): readonly AnalyticsEvent[] {
    return this.ownEvents;
  }

  setMetadata(metadata: Partial<SessionMetadata>): void {
    const keys = Object.keys(metadata);
    if (
      keys.some(
        (key) =>
          !["cohortIteration", "tacticsExperience", "comprehension"].includes(
            key,
          ),
      ) ||
      (metadata.cohortIteration !== undefined &&
        !["initial", "ui_repeat"].includes(metadata.cohortIteration)) ||
      (metadata.tacticsExperience !== undefined &&
        !["none", "light", "regular"].includes(metadata.tacticsExperience)) ||
      (metadata.comprehension !== undefined &&
        metadata.comprehension !== null &&
        typeof metadata.comprehension !== "boolean")
    )
      throw new Error("Invalid tester metadata schema or value");
    const defined = Object.fromEntries(
      Object.entries(metadata).filter((entry) => entry[1] !== undefined),
    ) as Record<string, JsonValue>;
    this.metadata = { ...this.metadata, ...defined };
  }

  exportSnapshot(): string {
    if (this.frozenExport) return this.frozenExport;
    return this.serialize(false);
  }

  finalize(): string {
    if (this.frozenExport) return this.frozenExport;
    if (!this.finished && !this.abandoned)
      throw new Error(`Cannot finalize ${this.observationState} observation`);
    this.frozenExport = this.serialize(true);
    return this.frozenExport;
  }

  private serialize(exportFinalized: boolean): string {
    return JSON.stringify(
      {
        schemaVersion: 2,
        ...this.metadata,
        manifestVersion: this.context.manifestVersion,
        releaseProfile: this.context.releaseProfile,
        sessionId: this.context.sessionId,
        battleId: this.state.battleId,
        ...this.helpSummary(),
        exportFinalized,
        battleCompleted: this.finished,
        abandoned: this.abandoned,
        abandonReason: this.abandonReason,
        technicalExclusionCandidate: this.abandonReason === "technical_failure",
        events: this.ownEvents,
      },
      null,
      2,
    );
  }
}
