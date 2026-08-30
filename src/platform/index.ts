import { normalizeLanguage, type Language } from "../localization";
import type { ReleaseConfig } from "../release/config";

export type LifecycleEvent = "pause" | "resume";
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface AnalyticsEvent {
  name: string;
  atMs: number;
  properties: Record<string, JsonValue>;
}

export interface SessionMetadata {
  cohortIteration: "initial" | "ui_repeat";
  tacticsExperience: "none" | "light" | "regular";
  comprehension: boolean | null;
}

export interface PlatformService {
  readonly kind: "local" | "yandex";
  readonly platformKind: "local" | "yandex";
  readonly language: Language;
  readonly languageSource: "sdk" | "fallback";
  readonly fallbackReason: string | null;
  readonly events: readonly AnalyticsEvent[];
  initialize(): Promise<void>;
  subscribeLifecycle(listener: (event: LifecycleEvent) => void): () => void;
  emit(event: AnalyticsEvent): void;
  markInteractive(): void;
  startGameplay(): void;
  stopGameplay(): void;
  exportSession(metadata: SessionMetadata): string;
}

export class LocalPlatformService implements PlatformService {
  readonly kind: "local" | "yandex" = "local";
  readonly platformKind: "local" | "yandex" = "local";
  readonly language: Language;
  readonly languageSource: "sdk" | "fallback" = "fallback";
  readonly fallbackReason: string | null;
  readonly events: AnalyticsEvent[] = [];
  private readonly listeners = new Set<(event: LifecycleEvent) => void>();

  constructor(language?: string, fallbackReason: string = "local_environment") {
    if (!fallbackReason?.trim())
      throw new Error("Local platform fallback reason is required");
    this.language = normalizeLanguage(language);
    this.fallbackReason = fallbackReason;
  }
  async initialize(): Promise<void> {
    return Promise.resolve();
  }
  subscribeLifecycle(listener: (event: LifecycleEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  signalLifecycle(event: LifecycleEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
  emit(event: AnalyticsEvent): void {
    const safe = JSON.parse(JSON.stringify(event)) as AnalyticsEvent;
    this.events.push(safe);
    console.info("[analytics]", safe.name, safe.properties);
  }
  markInteractive(): void {
    /* Local runtime has no loading screen. */
  }
  startGameplay(): void {
    /* Local runtime has no GameplayAPI. */
  }
  stopGameplay(): void {
    /* Local runtime has no GameplayAPI. */
  }
  exportSession(metadata: SessionMetadata): string {
    return JSON.stringify(
      { schemaVersion: 1, ...metadata, events: this.events },
      null,
      2,
    );
  }
}

export interface YandexSdk {
  environment: { i18n: { lang: string } };
  features: {
    LoadingAPI?: { ready(): unknown };
    GameplayAPI?: { start(): unknown; stop(): unknown };
  };
  adv?: {
    showFullscreenAdv(options: {
      callbacks: {
        onOpen?(): void;
        onClose?(wasShown: boolean): void;
        onError?(error: unknown): void;
      };
    }): unknown;
  };
  on(name: string, listener: () => void): unknown;
  off(name: string, listener: () => void): unknown;
}

export class YandexPlatformService extends LocalPlatformService {
  override readonly kind = "yandex" as const;
  override readonly platformKind = "yandex" as const;
  override readonly language: Language;
  override readonly languageSource = "sdk" as const;
  override readonly fallbackReason: string | null;
  private interactive = false;
  private readonly pauseHandler: () => void;
  private readonly resumeHandler: () => void;

  constructor(private readonly sdk: YandexSdk) {
    super(sdk.environment.i18n.lang, "yandex_sdk_initialized");
    const missingFeatures = [
      sdk.features.LoadingAPI ? null : "loading_api_unavailable",
      sdk.features.GameplayAPI ? null : "gameplay_api_unavailable",
    ].filter((reason): reason is string => reason !== null);
    this.fallbackReason =
      missingFeatures.length > 0 ? missingFeatures.join(",") : null;
    this.language = normalizeLanguage(sdk.environment.i18n.lang);
    this.pauseHandler = () => {
      this.signalLifecycle("pause");
    };
    this.resumeHandler = () => {
      this.signalLifecycle("resume");
    };
    sdk.on("game_api_pause", this.pauseHandler);
    sdk.on("game_api_resume", this.resumeHandler);
  }

  override markInteractive(): void {
    if (this.interactive) return;
    this.sdk.features.LoadingAPI?.ready();
    this.interactive = true;
  }

  override startGameplay(): void {
    this.sdk.features.GameplayAPI?.start();
  }

  override stopGameplay(): void {
    this.sdk.features.GameplayAPI?.stop();
  }
}

export type SdkLoader = () => Promise<YandexSdk>;

interface SdkLoaderOptions {
  hostname: string;
  automated: boolean;
  loadScript(path: string): Promise<unknown>;
  initialize(): Promise<YandexSdk>;
}

export function createSdkLoader(
  options: SdkLoaderOptions,
): SdkLoader | undefined {
  if (
    options.automated ||
    options.hostname === "localhost" ||
    options.hostname === "127.0.0.1"
  )
    return undefined;
  return async () => {
    await options.loadScript("/sdk.js");
    return options.initialize();
  };
}

export function selectRuntimeLanguage(
  platform: PlatformService,
  requested: string | null,
  releaseProfile: boolean,
): Language {
  if (releaseProfile || !requested) return platform.language;
  return normalizeLanguage(requested);
}

export function selectFallbackLanguage(
  requested: string | null,
  environmentLanguage: string,
  releaseProfile: boolean,
): Language {
  return normalizeLanguage(
    releaseProfile || !requested ? environmentLanguage : requested,
  );
}

export function qualifyPlatform(
  config: ReleaseConfig,
  platform: PlatformService,
): string[] {
  if (config.profile !== "catalog-release") return [];
  return platform.fallbackReason ? [platform.fallbackReason] : [];
}

export function assertPlatformQualified(
  config: ReleaseConfig,
  platform: PlatformService,
): void {
  const errors = qualifyPlatform(config, platform);
  if (errors.length)
    throw new Error(`Platform qualification failed: ${errors.join(", ")}`);
}

export async function createPlatformService(
  loader: SdkLoader | undefined,
  timeoutMs = 2500,
  fallbackLanguage?: string,
): Promise<PlatformService> {
  const local = new LocalPlatformService(
    fallbackLanguage,
    loader ? "sdk_initialization_failed" : "sdk_loader_unavailable",
  );
  await local.initialize();
  if (!loader) return local;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const sdk = await Promise.race([
      loader(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Yandex SDK timeout")),
          timeoutMs,
        );
      }),
    ]);
    if (timeout) clearTimeout(timeout);
    const yandex = new YandexPlatformService(sdk);
    await yandex.initialize();
    return yandex;
  } catch (error) {
    if (timeout) clearTimeout(timeout);
    console.warn("[platform] Using local fallback", error);
    return local;
  }
}
