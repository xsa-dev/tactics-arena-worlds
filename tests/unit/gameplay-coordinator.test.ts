import { describe, expect, it, vi } from "vitest";
import { GameplayCoordinator } from "../../src/platform/gameplay-coordinator";

describe("GameplayAPI ownership transition table", () => {
  it("settles startup, handles startup pause, Rules, terminal, replay, and overlaps exactly once", () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const coordinator = new GameplayCoordinator({
      startGameplay: () => calls.push("api:start"),
      stopGameplay: () => calls.push("api:stop"),
      startBattle: () => calls.push("battle:start"),
      pauseRuntime: () => calls.push("runtime:pause"),
      resumeRuntime: () => calls.push("runtime:resume"),
    });
    coordinator.markReady();
    coordinator.dismissOnboarding();
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(999);
    expect(calls).toEqual([]);
    coordinator.setPlatformPaused(true);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual(["runtime:pause"]);
    coordinator.setPlatformPaused(false);
    expect(calls).toEqual([
      "runtime:pause",
      "runtime:resume",
      "battle:start",
      "api:start",
    ]);
    coordinator.setBlocker("rules", true);
    coordinator.setBlocker("rules", true);
    expect(calls.at(-1)).toBe("api:stop");
    coordinator.setBlocker("focus", true);
    coordinator.setBlocker("rules", false);
    expect(calls.filter((call) => call === "api:start")).toHaveLength(1);
    coordinator.setBlocker("focus", false);
    expect(calls.filter((call) => call === "api:start")).toHaveLength(2);
    coordinator.setTerminal(true);
    coordinator.setTerminal(true);
    expect(calls.filter((call) => call === "api:stop")).toHaveLength(2);
    coordinator.beginReplay();
    expect(calls.filter((call) => call === "battle:start")).toHaveLength(2);
    expect(calls.filter((call) => call === "api:start")).toHaveLength(3);
    coordinator.setPlatformPaused(true);
    coordinator.setBlocker("visibility", true);
    coordinator.setPlatformPaused(false);
    expect(calls.filter((call) => call === "api:start")).toHaveLength(3);
    coordinator.setBlocker("visibility", false);
    expect(calls.filter((call) => call === "api:start")).toHaveLength(4);
    vi.useRealTimers();
  });

  it("starts after a quiet 1000 ms when onboarding is already dismissed", () => {
    vi.useFakeTimers();
    const startGameplay = vi.fn();
    const startBattle = vi.fn();
    const coordinator = new GameplayCoordinator({
      startGameplay,
      stopGameplay: vi.fn(),
      startBattle,
      pauseRuntime: vi.fn(),
      resumeRuntime: vi.fn(),
    });
    coordinator.dismissOnboarding();
    coordinator.markReady();
    vi.advanceTimersByTime(1000);
    expect(startBattle).toHaveBeenCalledOnce();
    expect(startGameplay).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
