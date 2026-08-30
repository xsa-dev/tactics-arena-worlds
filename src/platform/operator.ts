import type { BattleCommand, CommandResult } from "../core/types";
import type { PlatformService, SessionMetadata } from "./index";
import {
  BattleSession,
  type AbandonReason,
  type AnalyticsContext,
  type HelpReason,
  type HelpType,
} from "./battle-session";

export function selectTesterIdentity(
  requested: string | null,
  releaseProfile: boolean,
): string {
  return releaseProfile ? "release-tester" : requested || "local-tester";
}

export class ObservationRegistry {
  private readonly sessions = new Map<string, BattleSession>();
  private current: BattleSession;

  constructor(
    private readonly platform: PlatformService,
    private readonly baseContext: AnalyticsContext,
    private readonly now: () => number = () => performance.now(),
    private readonly createId: () => string = () => crypto.randomUUID(),
  ) {
    this.current = this.createObservation();
  }

  private createObservation(): BattleSession {
    const sessionId = this.createId();
    const battleId = this.createId();
    const session = new BattleSession(
      this.platform,
      { ...this.baseContext, sessionId },
      battleId,
      this.now,
    );
    this.sessions.set(sessionId, session);
    return session;
  }

  private get(sessionId: string): BattleSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Unknown observation session: ${sessionId}`);
    return session;
  }

  private requireState(session: BattleSession, expected: string): void {
    if (session.observationState !== expected)
      throw new Error(
        `Operation rejected in ${session.observationState} state`,
      );
  }

  currentIds(): { sessionId: string; battleId: string } {
    return {
      sessionId: this.currentContextId,
      battleId: this.current.state.battleId,
    };
  }

  private get currentContextId(): string {
    const found = [...this.sessions.entries()].find(
      ([, value]) => value === this.current,
    );
    if (!found) throw new Error("Current observation is not registered");
    return found[0];
  }

  currentSession(): BattleSession {
    return this.current;
  }

  startCurrent(): void {
    this.requireState(this.current, "prestart");
    this.current.start();
  }

  executeCurrent(command: BattleCommand): CommandResult {
    this.requireState(this.current, "active");
    return this.current.execute(command);
  }

  setTesterMetadata(
    sessionId: string,
    metadata: Partial<SessionMetadata>,
  ): void {
    const session = this.get(sessionId);
    this.requireState(session, "prestart");
    session.setMetadata(metadata);
  }

  requestHelp(sessionId: string): void {
    const session = this.get(sessionId);
    this.requireState(session, "active");
    session.requestHelp();
  }

  provideHelp(sessionId: string, type: HelpType, reason: HelpReason): void {
    if (type !== "technical" && type !== "gameplay")
      throw new Error(`Invalid help type: ${String(type)}`);
    if (!["requested", "timeout", "technical_issue"].includes(reason))
      throw new Error(`Invalid help reason: ${String(reason)}`);
    const session = this.get(sessionId);
    this.requireState(session, "active");
    session.provideHelp(type, reason);
  }

  abandonSession(sessionId: string, reason: AbandonReason): void {
    if (
      !["user_left", "technical_failure", "facilitator_ended"].includes(reason)
    )
      throw new Error(`Invalid abandonment reason: ${String(reason)}`);
    const session = this.get(sessionId);
    this.requireState(session, "active");
    session.abandon(reason);
  }

  exportSnapshot(sessionId: string): string {
    return this.get(sessionId).exportSnapshot();
  }

  finalizeSession(sessionId: string): string {
    return this.get(sessionId).finalize();
  }

  analytics(sessionId: string) {
    return structuredClone(this.get(sessionId).analytics);
  }

  inspect(sessionId: string): Readonly<Record<string, unknown>> {
    const session = this.get(sessionId);
    return Object.freeze({
      sessionId,
      battleId: session.state.battleId,
      state: session.observationState,
      eventCount: session.analytics.length,
    });
  }

  replay(): { sessionId: string; battleId: string } {
    this.requireState(this.current, "terminal");
    this.current.replayClicked();
    this.current.finalize();
    this.current = this.createObservation();
    return this.currentIds();
  }
}
