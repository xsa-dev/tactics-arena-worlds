import { describe, expect, it, vi } from "vitest";
import { ReadinessCoordinator } from "../../src/platform/readiness";

describe("interactive readiness barrier", () => {
  it("emits product and platform readiness once only after every prerequisite", () => {
    const gameLoaded = vi.fn();
    const platformReady = vi.fn();
    const ready = new ReadinessCoordinator(gameLoaded, platformReady);
    for (const part of ["platform", "scene", "dom", "overlays"] as const)
      ready.mark(part);
    expect(gameLoaded).not.toHaveBeenCalled();
    expect(platformReady).not.toHaveBeenCalled();
    ready.mark("input");
    ready.mark("scene");
    expect(gameLoaded).toHaveBeenCalledOnce();
    expect(platformReady).toHaveBeenCalledOnce();
    expect(ready.isInteractive).toBe(true);
  });

  it("suppresses readiness and exposes a localized recoverable failure", () => {
    const gameLoaded = vi.fn();
    const platformReady = vi.fn();
    const ready = new ReadinessCoordinator(gameLoaded, platformReady);
    ready.fail("scene", "startup.sceneFailed");
    for (const part of [
      "platform",
      "scene",
      "dom",
      "overlays",
      "input",
    ] as const)
      ready.mark(part);
    expect(ready.failure).toEqual({
      part: "scene",
      messageKey: "startup.sceneFailed",
    });
    expect(gameLoaded).not.toHaveBeenCalled();
    expect(platformReady).not.toHaveBeenCalled();
  });

  it("does not commit game_loaded when platform ready throws", () => {
    const gameLoaded = vi.fn();
    const ready = new ReadinessCoordinator(gameLoaded, () => {
      throw new Error("LoadingAPI.ready failed");
    });
    for (const part of [
      "platform",
      "scene",
      "dom",
      "overlays",
      "input",
    ] as const)
      ready.mark(part);
    expect(gameLoaded).not.toHaveBeenCalled();
    expect(ready.isInteractive).toBe(false);
    expect(ready.failure).toEqual({
      part: "platform",
      messageKey: "startup.platformFailed",
    });
  });
});
