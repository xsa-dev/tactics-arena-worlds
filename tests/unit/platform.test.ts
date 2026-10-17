import { describe, expect, it, vi } from "vitest";
import {
  LocalPlatformService,
  SolanaMobilePlatformService,
  createPlatformService,
  createSdkLoader,
} from "../../src/platform";
import { BattleSession } from "../../src/platform/battle-session";
import { FROZEN_WINNING_COMMANDS } from "../../src/core/scenario";

describe("platform adapters", () => {
  it("normalizes language, publishes lifecycle, buffers events, and exports ordered JSON", async () => {
    const platform = new LocalPlatformService("ru-RU");
    await platform.initialize();
    expect(platform.language).toBe("ru");
    const lifecycle: string[] = [];
    const unsubscribe = platform.subscribeLifecycle((event) =>
      lifecycle.push(event),
    );
    platform.signalLifecycle("pause");
    platform.signalLifecycle("resume");
    unsubscribe();
    platform.emit({ name: "game_loaded", atMs: 1, properties: { order: 1 } });
    platform.emit({
      name: "battle_started",
      atMs: 2,
      properties: { order: 2 },
    });
    expect(lifecycle).toEqual(["pause", "resume"]);
    expect(platform.events.map(({ name }) => name)).toEqual([
      "game_loaded",
      "battle_started",
    ]);
    expect(
      JSON.parse(
        platform.exportSession({
          cohortIteration: "initial",
          tacticsExperience: "none",
          comprehension: null,
        }),
      ).events[1].properties.order,
    ).toBe(2);
  });

  it("wraps official Yandex initialization and signals ready only when interactive", async () => {
    const calls: string[] = [];
    const listeners = new Map<string, () => void>();
    const sdk = {
      environment: { i18n: { lang: "en-US" } },
      features: {
        LoadingAPI: { ready: vi.fn(() => calls.push("ready")) },
        GameplayAPI: {
          start: vi.fn(() => calls.push("start")),
          stop: vi.fn(() => calls.push("stop")),
        },
      },
      on: vi.fn((name: string, listener: () => void) =>
        listeners.set(name, listener),
      ),
      off: vi.fn((name: string) => listeners.delete(name)),
      adv: { showFullscreenAdv: vi.fn(), showRewardedVideo: vi.fn() },
      getPayments: vi.fn(),
    };
    const platform = await createPlatformService(async () => sdk, 50, "ru");
    expect(platform.kind).toBe("yandex");
    expect(platform.language).toBe("en");
    expect(calls).toEqual([]);
    platform.markInteractive();
    expect(calls).toEqual(["ready"]);
    platform.startGameplay();
    expect(calls).toEqual(["ready", "start"]);
    const lifecycle: string[] = [];
    platform.subscribeLifecycle((event) => lifecycle.push(event));
    listeners.get("game_api_pause")?.();
    listeners.get("game_api_resume")?.();
    expect(lifecycle).toEqual(["pause", "resume"]);
    const battle = new BattleSession(
      platform,
      {
        sessionId: "s",
        testerId: "t",
        manifestVersion: "0.1.0",
        releaseProfile: "study-draft",
        deviceClass: "desktop",
        inputType: "mouse",
        viewport: "1280x720",
        locale: "en",
      },
      "battle-yandex",
      () => 0,
    );
    battle.start();
    for (const command of FROZEN_WINNING_COMMANDS)
      expect(battle.execute(command).accepted).toBe(true);
    battle.replayClicked();
    expect(sdk.adv.showFullscreenAdv).not.toHaveBeenCalled();
    expect(sdk.adv.showRewardedVideo).not.toHaveBeenCalled();
    expect(sdk.getPayments).not.toHaveBeenCalled();
  });

  it("falls back locally when SDK is absent, rejects, or times out", async () => {
    await expect(
      createPlatformService(undefined, 5, "ru"),
    ).resolves.toMatchObject({ kind: "local", language: "ru" });
    await expect(
      createPlatformService(
        async () => {
          throw new Error("no sdk");
        },
        5,
        "en",
      ),
    ).resolves.toMatchObject({ kind: "local" });
    await expect(
      createPlatformService(() => new Promise(() => undefined), 5, "en"),
    ).resolves.toMatchObject({ kind: "local" });
  });

  it("initializes SolanaMobilePlatformService immediately without /sdk.js and supports lifecycle events", async () => {
    const loadScript = vi.fn();
    expect(
      createSdkLoader({
        hostname: "xsa-dev.github.io",
        automated: false,
        sdkEnabled: false,
        loadScript,
        initialize: vi.fn(),
      }),
    ).toBeUndefined();
    expect(loadScript).not.toHaveBeenCalled();

    const platform = new SolanaMobilePlatformService("en-US");
    await platform.initialize();
    expect(platform.kind).toBe("solana-mobile");
    expect(platform.platformKind).toBe("solana-mobile");
    expect(platform.language).toBe("en");
    expect(platform.fallbackReason).toBeNull();
    const lifecycle: string[] = [];
    platform.subscribeLifecycle((event) => lifecycle.push(event));
    platform.signalLifecycle("pause");
    platform.signalLifecycle("resume");
    expect(lifecycle).toEqual(["pause", "resume"]);
  });
});
