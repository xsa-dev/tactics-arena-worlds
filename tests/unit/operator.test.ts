import { describe, expect, it } from "vitest";
import { FROZEN_WINNING_COMMANDS } from "../../src/core/scenario";
import { LocalPlatformService } from "../../src/platform";
import {
  ObservationRegistry,
  selectTesterIdentity,
} from "../../src/platform/operator";

const context = {
  sessionId: "ignored",
  testerId: "tester",
  manifestVersion: "0.1.0",
  releaseProfile: "study-draft" as const,
  deviceClass: "desktop" as const,
  inputType: "mouse" as const,
  viewport: "1280x720",
  locale: "en" as const,
};

describe("operator observation state machine", () => {
  it("keeps a technical-help-only terminal completion independently eligible", () => {
    const registry = new ObservationRegistry(
      new LocalPlatformService("en"),
      context,
      () => 50,
    );
    const { sessionId } = registry.currentIds();
    registry.startCurrent();
    registry.provideHelp(sessionId, "technical", "technical_issue");
    for (const command of FROZEN_WINNING_COMMANDS)
      registry.executeCurrent(command);
    expect(JSON.parse(registry.exportSnapshot(sessionId))).toMatchObject({
      facilitatorHelpUsed: false,
      facilitatorHelpType: "technical",
      facilitatorHelpReason: "technical_issue",
      independentCompletion: true,
      battleCompleted: true,
    });
  });

  it("keeps a terminal help request eligible when no help was provided", () => {
    const registry = new ObservationRegistry(
      new LocalPlatformService("en"),
      context,
      () => 75,
    );
    const { sessionId } = registry.currentIds();
    registry.startCurrent();
    registry.requestHelp(sessionId);
    for (const command of FROZEN_WINNING_COMMANDS)
      registry.executeCurrent(command);
    const snapshot = JSON.parse(registry.exportSnapshot(sessionId));
    expect(snapshot).toMatchObject({
      facilitatorHelpUsed: false,
      facilitatorHelpType: null,
      independentCompletion: true,
      battleCompleted: true,
    });
    expect(
      snapshot.events.filter(({ name }: { name: string }) =>
        name.startsWith("facilitator_help_"),
      ),
    ).toEqual([]);
  });

  it("does not lock active or abandoned observations when exporting snapshots", () => {
    const registry = new ObservationRegistry(
      new LocalPlatformService("en"),
      context,
      () => 100,
    );
    const { sessionId } = registry.currentIds();
    registry.startCurrent();
    expect(JSON.parse(registry.exportSnapshot(sessionId))).toMatchObject({
      exportFinalized: false,
      battleCompleted: false,
      abandoned: false,
    });
    registry.provideHelp(sessionId, "technical", "requested");
    registry.abandonSession(sessionId, "facilitator_ended");
    expect(JSON.parse(registry.exportSnapshot(sessionId))).toMatchObject({
      exportFinalized: false,
      abandoned: true,
    });
    expect(JSON.parse(registry.finalizeSession(sessionId))).toMatchObject({
      exportFinalized: true,
      abandoned: true,
    });
  });

  it("rejects invalid help reasons and remaining state transitions without mutation", () => {
    const registry = new ObservationRegistry(
      new LocalPlatformService("en"),
      context,
      () => 125,
    );
    const { sessionId } = registry.currentIds();
    expect(() => registry.executeCurrent({ type: "end-player-phase" })).toThrow(
      /prestart/,
    );
    expect(() => registry.replay()).toThrow(/prestart/);
    registry.startCurrent();
    const activeEvents = registry.analytics(sessionId);
    expect(() =>
      registry.provideHelp(sessionId, "technical", "bad" as never),
    ).toThrow(/help reason/);
    expect(() => registry.startCurrent()).toThrow(/active/);
    expect(registry.analytics(sessionId)).toEqual(activeEvents);
    registry.abandonSession(sessionId, "user_left");
    expect(() => registry.executeCurrent({ type: "end-player-phase" })).toThrow(
      /abandoned/,
    );
    expect(() => registry.replay()).toThrow(/abandoned/);
  });

  it("enforces prestart, active, terminal and finalized transitions with frozen bytes", () => {
    const platform = new LocalPlatformService("en");
    let sequence = 0;
    const registry = new ObservationRegistry(
      platform,
      context,
      () => 100,
      () => `id-${++sequence}`,
    );
    const first = registry.currentIds();
    expect(registry.inspect(first.sessionId).state).toBe("prestart");
    registry.setTesterMetadata(first.sessionId, {
      cohortIteration: "initial",
      tacticsExperience: "light",
      comprehension: true,
    });
    expect(
      JSON.parse(registry.exportSnapshot(first.sessionId)).exportFinalized,
    ).toBe(false);
    expect(() => registry.requestHelp(first.sessionId)).toThrow(/prestart/);
    expect(() => registry.abandonSession(first.sessionId, "user_left")).toThrow(
      /prestart/,
    );
    expect(() => registry.finalizeSession(first.sessionId)).toThrow(/prestart/);

    registry.startCurrent();
    expect(() => registry.finalizeSession(first.sessionId)).toThrow(/active/);
    registry.requestHelp(first.sessionId);
    registry.provideHelp(first.sessionId, "technical", "technical_issue");
    registry.provideHelp(first.sessionId, "gameplay", "requested");
    expect(() => registry.setTesterMetadata(first.sessionId, {})).toThrow(
      /active/,
    );
    for (const command of FROZEN_WINNING_COMMANDS)
      expect(registry.executeCurrent(command).accepted).toBe(true);
    expect(registry.inspect(first.sessionId).state).toBe("terminal");
    expect(() =>
      registry.provideHelp(first.sessionId, "technical", "timeout"),
    ).toThrow(/terminal/);
    expect(() => registry.requestHelp(first.sessionId)).toThrow(/terminal/);
    expect(() => registry.setTesterMetadata(first.sessionId, {})).toThrow(
      /terminal/,
    );
    expect(() => registry.abandonSession(first.sessionId, "user_left")).toThrow(
      /terminal/,
    );
    const nonfinal = JSON.parse(registry.exportSnapshot(first.sessionId));
    expect(nonfinal).toMatchObject({
      exportFinalized: false,
      battleCompleted: true,
      abandoned: false,
      independentCompletion: false,
    });
    const final = registry.finalizeSession(first.sessionId);
    expect(JSON.parse(final).exportFinalized).toBe(true);
    expect(registry.finalizeSession(first.sessionId)).toBe(final);
    expect(registry.exportSnapshot(first.sessionId)).toBe(final);
    expect(() => registry.requestHelp(first.sessionId)).toThrow(/finalized/);
    expect(() =>
      registry.provideHelp(first.sessionId, "technical", "requested"),
    ).toThrow(/finalized/);
    expect(() => registry.abandonSession(first.sessionId, "user_left")).toThrow(
      /finalized/,
    );
    expect(() => registry.setTesterMetadata(first.sessionId, {})).toThrow(
      /finalized/,
    );
    expect(() => registry.replay()).toThrow(/finalized/);
  });

  it("records each abandonment reason and technical exclusion deterministically", () => {
    for (const reason of [
      "user_left",
      "technical_failure",
      "facilitator_ended",
    ] as const) {
      const registry = new ObservationRegistry(
        new LocalPlatformService("en"),
        context,
        () => 5,
      );
      const { sessionId } = registry.currentIds();
      registry.startCurrent();
      registry.abandonSession(sessionId, reason);
      const data = JSON.parse(registry.finalizeSession(sessionId));
      expect(data).toMatchObject({
        abandoned: true,
        abandonReason: reason,
        battleCompleted: false,
        independentCompletion: false,
        technicalExclusionCandidate: reason === "technical_failure",
      });
      expect(() => registry.abandonSession(sessionId, reason)).toThrow();
    }
  });

  it("atomically finalizes replay, rolls IDs, and rejects invalid calls without mutation", () => {
    let sequence = 0;
    const registry = new ObservationRegistry(
      new LocalPlatformService("en"),
      context,
      () => 9,
      () => `roll-${++sequence}`,
    );
    const old = registry.currentIds();
    registry.startCurrent();
    for (const command of FROZEN_WINNING_COMMANDS)
      registry.executeCurrent(command);
    const next = registry.replay();
    expect(next.sessionId).not.toBe(old.sessionId);
    expect(next.battleId).not.toBe(old.battleId);
    const oldBytes = registry.finalizeSession(old.sessionId);
    expect(registry.exportSnapshot(old.sessionId)).toBe(oldBytes);
    expect(registry.inspect(next.sessionId).state).toBe("prestart");
    const eventCount = registry.analytics(next.sessionId).length;
    expect(() =>
      registry.provideHelp("missing", "technical", "requested"),
    ).toThrow(/Unknown/);
    expect(() =>
      registry.provideHelp(next.sessionId, "bad" as never, "requested"),
    ).toThrow(/help type/);
    expect(() =>
      registry.abandonSession(next.sessionId, "bad" as never),
    ).toThrow(/reason/);
    expect(registry.analytics(next.sessionId)).toHaveLength(eventCount);
  });

  it("validates metadata keys and values without allowing trusted identity overrides", () => {
    const registry = new ObservationRegistry(
      new LocalPlatformService("en"),
      context,
      () => 1,
      () => "trusted-session",
    );
    const { sessionId, battleId } = registry.currentIds();
    const before = registry.exportSnapshot(sessionId);
    for (const metadata of [
      { manifestVersion: "spoofed" },
      { releaseProfile: "catalog-release" },
      { sessionId: "spoofed" },
      { battleId: "spoofed" },
      { cohortIteration: "bad" },
      { tacticsExperience: "expert" },
      { comprehension: "yes" },
    ])
      expect(() =>
        registry.setTesterMetadata(sessionId, metadata as never),
      ).toThrow(/metadata/i);
    expect(registry.exportSnapshot(sessionId)).toBe(before);
    expect(JSON.parse(before)).toMatchObject({
      manifestVersion: context.manifestVersion,
      releaseProfile: context.releaseProfile,
      sessionId,
      battleId,
    });
    expect(selectTesterIdentity("spoofed", true)).toBe("release-tester");
    expect(selectTesterIdentity("local-id", false)).toBe("local-id");
  });

  it("records one explicit help request at active duration and rejects every later-state write", () => {
    let now = 100;
    const registry = new ObservationRegistry(
      new LocalPlatformService("en"),
      context,
      () => now,
      () => "once-id",
    );
    const { sessionId } = registry.currentIds();
    expect(() =>
      registry.provideHelp(sessionId, "technical", "requested"),
    ).toThrow(/prestart/);
    registry.startCurrent();
    now = 275;
    registry.requestHelp(sessionId);
    expect(() => registry.requestHelp(sessionId)).toThrow(/already/i);
    const requests = registry
      .analytics(sessionId)
      .filter(({ name }) => name === "help_requested");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.properties.helpAtMs).toBe(175);
    registry.abandonSession(sessionId, "user_left");
    for (const operation of [
      () => registry.requestHelp(sessionId),
      () => registry.provideHelp(sessionId, "technical", "requested"),
      () => registry.setTesterMetadata(sessionId, {}),
      () => registry.replay(),
    ])
      expect(operation).toThrow(/abandoned/);
    registry.finalizeSession(sessionId);
    for (const operation of [
      () => registry.requestHelp(sessionId),
      () => registry.provideHelp(sessionId, "technical", "requested"),
      () => registry.abandonSession(sessionId, "user_left"),
      () => registry.setTesterMetadata(sessionId, {}),
      () => registry.replay(),
    ])
      expect(operation).toThrow(/finalized/);
  });
});
