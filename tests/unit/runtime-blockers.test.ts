import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalPlatformService } from "../../src/platform";
import { GameRuntime, PresentationClock } from "../../src/presentation/runtime";

const context = {
  sessionId: "bootstrap",
  testerId: "tester",
  manifestVersion: "0.1.0",
  releaseProfile: "study-draft" as const,
  deviceClass: "desktop" as const,
  inputType: "mouse" as const,
  viewport: "800x600",
  locale: "en" as const,
};

describe("runtime UI lifecycle blockers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pauses Rules and portrait by source and resumes audio/time once after both clear", () => {
    const pauseAll = vi.fn();
    const resumeAll = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
    vi.stubGlobal("window", {
      __PHASER_GAME__: { sound: { pauseAll, resumeAll } },
    });
    const runtime = new GameRuntime(
      new LocalPlatformService("en"),
      "en",
      context,
    );
    runtime.dismissOnboarding();
    runtime.observations.startCurrent();

    runtime.openRules();
    expect(runtime.lifecycle.isPaused).toBe(true);
    expect(pauseAll).toHaveBeenCalledOnce();
    runtime.setPortrait(true);
    expect(pauseAll).toHaveBeenCalledOnce();

    runtime.dismissOnboarding();
    expect(runtime.lifecycle.isPaused).toBe(true);
    expect(resumeAll).not.toHaveBeenCalled();
    runtime.setPortrait(false);
    runtime.setPortrait(false);
    expect(runtime.lifecycle.isPaused).toBe(false);
    expect(resumeAll).toHaveBeenCalledOnce();

    runtime.setLifecycleBlocker("mwa_intent", true);
    expect(runtime.lifecycle.isPaused).toBe(true);
    expect(pauseAll).toHaveBeenCalledTimes(2);
    runtime.setLifecycleBlocker("focus", true);
    runtime.setLifecycleBlocker("mwa_intent", false);
    expect(runtime.lifecycle.isPaused).toBe(true);
    expect(resumeAll).toHaveBeenCalledOnce();
    runtime.setLifecycleBlocker("focus", false);
    expect(runtime.lifecycle.isPaused).toBe(false);
    expect(resumeAll).toHaveBeenCalledTimes(2);
  });

  it("switches Human and AI Autoplay live with offline fallback, tracks hybrid mode bidirectionally, resets on replay, and toggles EN/RU locale", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    });
    vi.stubGlobal("window", {
      __PHASER_GAME__: { sound: { pauseAll: vi.fn(), resumeAll: vi.fn() } },
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const runtime = new GameRuntime(
      new LocalPlatformService("en"),
      "en",
      { ...context, releaseProfile: "solana-mobile" },
      undefined,
      {
        survivor: {
          mode: "human",
          proxyUrl: "",
          timeoutMs: 5_000,
          maxActionsPerPhase: 12,
        },
      },
    );
    for (const part of [
      "platform",
      "scene",
      "dom",
      "overlays",
      "input",
    ] as const)
      runtime.markReady(part);
    runtime.dismissOnboarding();
    runtime.observations.startCurrent();

    expect(runtime.controlMode).toBe("human");
    expect(runtime.session.controlMode).toBe("human");

    // Select a unit in human mode and execute one move
    runtime.handleCell({ x: 0, y: 1 });
    expect(runtime.selectedId).toBe("survivor-scout");
    runtime.handleCell({ x: 1, y: 1 });
    expect(runtime.session.acceptedCommands).toHaveLength(1);
    expect(runtime.session.controlMode).toBe("human");

    // Switch to AI Autoplay mid-battle: clears selection, marks session hybrid, and uses offline fallback without fetch
    runtime.setControlMode("openjev");
    expect(runtime.controlMode).toBe("openjev");
    expect(runtime.selectedId).toBeNull();
    expect(runtime.session.controlMode).toBe("hybrid");

    runtime.update(1000);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(runtime.session.acceptedCommands.length).toBeGreaterThan(1);

    // Toggle language live
    runtime.setLanguage("ru");
    expect(runtime.language).toBe("ru");
    expect(store.get("tactics-locale-v1")).toBe("ru");

    // Finish battle and verify replay resets hybrid mode to current HUD controlMode ("openjev") and resets state
    while (runtime.session.state.status === "active") {
      runtime.session.execute({ type: "end-player-phase" }, "openjev");
    }
    runtime.replay();
    expect(runtime.controlMode).toBe("openjev");
    expect(runtime.session.controlMode).toBe("openjev");
    expect(runtime.session.acceptedCommands).toHaveLength(0);

    // Now test reverse direction: AI command -> switch to Human -> Human command => hybrid
    runtime.observations.startCurrent();
    runtime.update(2000);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(runtime.session.acceptedCommands.length).toBeGreaterThan(0);
    expect(runtime.session.controlMode).toBe("openjev");

    runtime.setControlMode("human");
    expect(runtime.controlMode).toBe("human");
    expect(runtime.session.controlMode).toBe("hybrid");

    // Verify PresentationClock slow-motion (0.25x, 0.5x) and fast-forward (1x, 2x, 4x) multipliers
    const clock = new PresentationClock();
    expect(clock.multiplier).toBe(1);
    expect(clock.duration(400)).toBe(400);
    clock.multiplier = 0.5;
    expect(clock.multiplier).toBe(0.5);
    expect(clock.duration(400)).toBe(800);
    clock.multiplier = 0.25;
    expect(clock.multiplier).toBe(0.25);
    expect(clock.duration(400)).toBe(1600);
    clock.multiplier = 2;
    expect(clock.duration(400)).toBe(200);
    clock.multiplier = 4;
    expect(clock.duration(400)).toBe(100);
  });
});
