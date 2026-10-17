import type { SurvivorPolicyConfig } from "../survivor/policy";

export type ReleaseProfile =
  "study-draft" | "catalog-release" | "ai-exhibition" | "solana-mobile";
export type AdPolicy = "disabled_for_study" | "post_battle_fullscreen";

export interface ReleaseDeclarations {
  cloudSave: boolean;
  progression: boolean;
  achievements: boolean;
  inventory: boolean;
  purchases: boolean;
  unlocks: boolean;
}

export interface SolanaMobileDeclarations {
  readonly appUrl: string;
  readonly applicationId: string;
  readonly chains: readonly string[];
  readonly rpcUrl: string;
  readonly allowControlModeSwitch: boolean;
}

export interface ReleaseConfig {
  readonly version: string;
  readonly profile: ReleaseProfile;
  readonly sdkEnabled: boolean;
  readonly adPolicy: AdPolicy;
  readonly publicationEligible: boolean;
  readonly scenarioFreezeId: string;
  readonly onboardingFreezeId: string;
  readonly replayFreezeId: string;
  readonly analyticsSchemaVersion: number;
  readonly declarations: ReleaseDeclarations;
  readonly survivor: Readonly<SurvivorPolicyConfig>;
  readonly aiExhibition: Readonly<AiExhibitionDeclarations>;
  readonly solanaMobile: Readonly<SolanaMobileDeclarations>;
}

export interface AiExhibitionDeclarations {
  readonly proxyUrl: string;
  readonly contractVersion: "v1";
  readonly allowedOrigins: readonly string[];
  readonly vendor: "openjev";
  readonly disclosure: "external-ai-with-deterministic-fallback";
}

export const RELEASE_CONSTANTS = {
  version: packageJson.version,
  analyticsSchemaVersion: releaseMetadata.analyticsSchemaVersion,
  freezeIds: releaseMetadata.freezeIds,
} as const;

const NO_PROGRESSION: ReleaseDeclarations = {
  cloudSave: false,
  progression: false,
  achievements: false,
  inventory: false,
  purchases: false,
  unlocks: false,
};

const AI_EXHIBITION: AiExhibitionDeclarations = Object.freeze({
  proxyUrl: "https://proxy.tactics-arena.example/v1/openjev/choose",
  contractVersion: "v1",
  allowedOrigins: Object.freeze([
    "https://yandex.ru",
    "https://games.yandex.ru",
  ]),
  vendor: "openjev",
  disclosure: "external-ai-with-deterministic-fallback",
});

const SURVIVOR_PROFILES: Record<
  ReleaseProfile,
  Readonly<SurvivorPolicyConfig>
> = {
  "study-draft": Object.freeze({
    mode: "human",
    proxyUrl: "",
    timeoutMs: 5_000,
    maxActionsPerPhase: 12,
  }),
  "catalog-release": Object.freeze({
    mode: "human",
    proxyUrl: "",
    timeoutMs: 5_000,
    maxActionsPerPhase: 12,
  }),
  "ai-exhibition": Object.freeze({
    mode: "openjev",
    proxyUrl: AI_EXHIBITION.proxyUrl,
    timeoutMs: 5_000,
    maxActionsPerPhase: 12,
  }),
  "solana-mobile": Object.freeze({
    mode: "human",
    proxyUrl: "",
    timeoutMs: 5_000,
    maxActionsPerPhase: 12,
  }),
};

const SOLANA_MOBILE: SolanaMobileDeclarations = Object.freeze({
  appUrl: "https://xsa-dev.github.io/tactics-arena-worlds/",
  applicationId: "dev.xsa.tacticsarena",
  chains: Object.freeze(["solana:mainnet"]),
  rpcUrl: "https://api.mainnet-beta.solana.com",
  allowControlModeSwitch: true,
});

const INACTIVE_SOLANA_MOBILE: SolanaMobileDeclarations = Object.freeze({
  appUrl: "",
  applicationId: "",
  chains: Object.freeze([]),
  rpcUrl: "",
  allowControlModeSwitch: false,
});

export function createReleaseConfig(
  profile: string | undefined,
  overrides: Partial<
    Pick<
      ReleaseConfig,
      "scenarioFreezeId" | "onboardingFreezeId" | "replayFreezeId"
    >
  > = {},
): ReleaseConfig {
  if (
    profile !== "study-draft" &&
    profile !== "catalog-release" &&
    profile !== "ai-exhibition" &&
    profile !== "solana-mobile"
  )
    throw new Error(
      `Unknown or missing release profile: ${profile ?? "<missing>"}`,
    );
  const freezes = { ...RELEASE_CONSTANTS.freezeIds, ...overrides };
  if (Object.values(freezes).some((value) => value.trim() === ""))
    throw new Error("Every release freeze identifier is mandatory");
  const profileMetadata = releaseMetadata.profiles[profile] as {
    adPolicy: AdPolicy;
    publicationEligible: boolean;
  };
  return Object.freeze({
    version: RELEASE_CONSTANTS.version,
    profile,
    sdkEnabled: profile !== "solana-mobile",
    adPolicy: profileMetadata.adPolicy,
    publicationEligible: profileMetadata.publicationEligible,
    ...freezes,
    analyticsSchemaVersion: RELEASE_CONSTANTS.analyticsSchemaVersion,
    declarations: Object.freeze({ ...NO_PROGRESSION }),
    survivor: SURVIVOR_PROFILES[profile],
    aiExhibition:
      profile === "ai-exhibition"
        ? AI_EXHIBITION
        : Object.freeze({
            proxyUrl: "",
            contractVersion: "v1",
            allowedOrigins: Object.freeze([]),
            vendor: "openjev",
            disclosure: "external-ai-with-deterministic-fallback",
          }),
    solanaMobile:
      profile === "solana-mobile" ? SOLANA_MOBILE : INACTIVE_SOLANA_MOBILE,
  });
}

export const ACTIVE_RELEASE_CONFIG = createReleaseConfig(__RELEASE_PROFILE__);

export const BUILD_RELEASE_PROFILE_MARKER =
  `tactics-release-profile:${__RELEASE_PROFILE__}` as const;
import packageJson from "../../package.json";
import releaseMetadata from "../../release-metadata.json";

declare const __RELEASE_PROFILE__: string;
