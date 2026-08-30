import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalPlatformService } from "../../src/platform";
import { GameRuntime } from "../../src/presentation/runtime";

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
  });
});
