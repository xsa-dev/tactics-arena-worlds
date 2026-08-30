export type ReleaseProfile = "study-draft" | "catalog-release";
export type AdPolicy = "disabled_for_study" | "post_battle_fullscreen";

export interface ReleaseDeclarations {
  cloudSave: boolean;
  progression: boolean;
  achievements: boolean;
  inventory: boolean;
  purchases: boolean;
  unlocks: boolean;
}

export interface ReleaseConfig {
  readonly version: string;
  readonly profile: ReleaseProfile;
  readonly sdkEnabled: true;
  readonly adPolicy: AdPolicy;
  readonly publicationEligible: boolean;
  readonly scenarioFreezeId: string;
  readonly onboardingFreezeId: string;
  readonly replayFreezeId: string;
  readonly analyticsSchemaVersion: number;
  readonly declarations: ReleaseDeclarations;
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

export function createReleaseConfig(
  profile: string | undefined,
  overrides: Partial<
    Pick<
      ReleaseConfig,
      "scenarioFreezeId" | "onboardingFreezeId" | "replayFreezeId"
    >
  > = {},
): ReleaseConfig {
  if (profile !== "study-draft" && profile !== "catalog-release")
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
    sdkEnabled: true,
    adPolicy: profileMetadata.adPolicy,
    publicationEligible: profileMetadata.publicationEligible,
    ...freezes,
    analyticsSchemaVersion: RELEASE_CONSTANTS.analyticsSchemaVersion,
    declarations: Object.freeze({ ...NO_PROGRESSION }),
  });
}

export const ACTIVE_RELEASE_CONFIG = createReleaseConfig(__RELEASE_PROFILE__);

export const BUILD_RELEASE_PROFILE_MARKER =
  `tactics-release-profile:${__RELEASE_PROFILE__}` as const;
import packageJson from "../../package.json";
import releaseMetadata from "../../release-metadata.json";

declare const __RELEASE_PROFILE__: string;
