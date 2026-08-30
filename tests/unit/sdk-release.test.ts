import { describe, expect, it, vi } from "vitest";
import { createReleaseConfig } from "../../src/release/config";
import {
  LocalPlatformService,
  YandexPlatformService,
  createPlatformService,
  createSdkLoader,
  assertPlatformQualified,
  qualifyPlatform,
  selectFallbackLanguage,
  selectRuntimeLanguage,
} from "../../src/platform";

function fakeSdk(language = "ru-RU") {
  const listeners = new Map<string, () => void>();
  return {
    listeners,
    sdk: {
      environment: { i18n: { lang: language } },
      features: {
        LoadingAPI: { ready: vi.fn() },
        GameplayAPI: { start: vi.fn(), stop: vi.fn() },
      },
      on: vi.fn((name: string, listener: () => void) =>
        listeners.set(name, listener),
      ),
      off: vi.fn((name: string) => listeners.delete(name)),
      adv: { showFullscreenAdv: vi.fn() },
    },
  };
}

describe("Yandex release adapter contracts", () => {
  it("requires a machine reason for local adapters and blocks incomplete Yandex feature sets", () => {
    expect(() => new LocalPlatformService("en", null as never)).toThrow(
      /fallback reason/i,
    );
    const missingLoading = fakeSdk().sdk;
    delete (missingLoading.features as { LoadingAPI?: unknown }).LoadingAPI;
    const loadingPlatform = new YandexPlatformService(missingLoading);
    expect(loadingPlatform.fallbackReason).toBe("loading_api_unavailable");
    expect(
      qualifyPlatform(createReleaseConfig("catalog-release"), loadingPlatform),
    ).toContain("loading_api_unavailable");

    const missingGameplay = fakeSdk().sdk;
    delete (missingGameplay.features as { GameplayAPI?: unknown }).GameplayAPI;
    const gameplayPlatform = new YandexPlatformService(missingGameplay);
    expect(gameplayPlatform.fallbackReason).toBe("gameplay_api_unavailable");
    expect(
      qualifyPlatform(createReleaseConfig("catalog-release"), gameplayPlatform),
    ).toContain("gameplay_api_unavailable");
  });

  it("owns LoadingAPI and GameplayAPI calls without direct calls from SDK lifecycle handlers", () => {
    const { sdk, listeners } = fakeSdk();
    const platform = new YandexPlatformService(sdk);
    platform.markInteractive();
    platform.markInteractive();
    expect(sdk.features.LoadingAPI.ready).toHaveBeenCalledOnce();
    expect(sdk.features.GameplayAPI.start).not.toHaveBeenCalled();
    platform.startGameplay();
    platform.stopGameplay();
    expect(sdk.features.GameplayAPI.start).toHaveBeenCalledOnce();
    expect(sdk.features.GameplayAPI.stop).toHaveBeenCalledOnce();
    const lifecycle: string[] = [];
    platform.subscribeLifecycle((event) => lifecycle.push(event));
    listeners.get("game_api_pause")?.();
    listeners.get("game_api_resume")?.();
    expect(lifecycle).toEqual(["pause", "resume"]);
    expect(sdk.features.GameplayAPI.start).toHaveBeenCalledOnce();
    expect(sdk.features.GameplayAPI.stop).toHaveBeenCalledOnce();
  });

  it("loads /sdk.js before init only for archive hosts and keeps local/test SDK-free", async () => {
    const order: string[] = [];
    const loader = createSdkLoader({
      hostname: "games.example",
      automated: false,
      loadScript: async (path) => order.push(`load:${path}`),
      initialize: async () => {
        order.push("init");
        return fakeSdk().sdk;
      },
    });
    await loader?.();
    expect(order).toEqual(["load:/sdk.js", "init"]);
    expect(
      createSdkLoader({
        hostname: "localhost",
        automated: false,
        loadScript: vi.fn(),
        initialize: vi.fn(),
      }),
    ).toBeUndefined();
    expect(
      createSdkLoader({
        hostname: "games.example",
        automated: true,
        loadScript: vi.fn(),
        initialize: vi.fn(),
      }),
    ).toBeUndefined();
  });

  it("uses SDK locale in release, allows local overrides only locally, and records every fallback reason", async () => {
    const yandex = new YandexPlatformService(fakeSdk("ru-KZ").sdk);
    expect(selectRuntimeLanguage(yandex, "en", true)).toBe("ru");
    const local = new LocalPlatformService("en", "localhost");
    expect(selectRuntimeLanguage(local, "ru", false)).toBe("ru");
    expect(selectFallbackLanguage("ru", "en-US", true)).toBe("en");
    expect(selectFallbackLanguage("ru", "en-US", false)).toBe("ru");
    const missing = await createPlatformService(undefined, 5, "en");
    const rejected = await createPlatformService(
      async () => {
        throw new Error("no sdk");
      },
      5,
      "en",
    );
    expect(missing.fallbackReason).toBe("sdk_loader_unavailable");
    expect(rejected.fallbackReason).toBe("sdk_initialization_failed");
    expect(
      qualifyPlatform(createReleaseConfig("catalog-release"), missing),
    ).toContain("sdk_loader_unavailable");
    expect(
      qualifyPlatform(createReleaseConfig("study-draft"), missing),
    ).toEqual([]);
    expect(() =>
      assertPlatformQualified(createReleaseConfig("catalog-release"), missing),
    ).toThrow(/sdk_loader_unavailable/);
    expect(() =>
      assertPlatformQualified(createReleaseConfig("study-draft"), missing),
    ).not.toThrow();
  });
});
