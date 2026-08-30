import { describe, expect, it, vi } from "vitest";
import { BattleSession } from "../../src/platform/battle-session";
import { RuntimeLifecycle } from "../../src/platform/runtime-lifecycle";
import { LocalPlatformService } from "../../src/platform";

describe("pause-safe synchronous resolution", () => {
  it("commits core once, pauses input/presentation/time/audio, and resumes without replay", () => {
    const platform = new LocalPlatformService("en");
    const session = new BattleSession(
      platform,
      {
        sessionId: "s",
        testerId: "t",
        manifestVersion: "0.1.0",
        releaseProfile: "study-draft",
        deviceClass: "desktop",
        inputType: "mouse",
        viewport: "800x600",
        locale: "en",
      },
      "battle",
      () => 0,
    );
    session.start();
    const audio = { pause: vi.fn(), resume: vi.fn() };
    const lifecycle = new RuntimeLifecycle(platform, session, audio);
    const resolved = session.execute({ type: "end-player-phase" });
    expect(resolved.accepted).toBe(true);
    lifecycle.enqueue(resolved.events);
    const committed = structuredClone(session.state);
    platform.signalLifecycle("pause");
    expect(lifecycle.inputEnabled).toBe(false);
    expect(lifecycle.takeNext()).toBeUndefined();
    expect(audio.pause).toHaveBeenCalledOnce();
    platform.signalLifecycle("resume");
    expect(lifecycle.inputEnabled).toBe(true);
    const presented = [];
    for (let event = lifecycle.takeNext(); event; event = lifecycle.takeNext())
      presented.push(event);
    expect(presented).toEqual(resolved.events);
    expect(session.state).toEqual(committed);
    expect(audio.resume).toHaveBeenCalledOnce();
    expect(lifecycle.takeNext()).toBeUndefined();
  });
});
