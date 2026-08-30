import type { ReleaseConfig } from "./config";

export interface ReleaseManifestInput {
  config: ReleaseConfig;
  sourceCommit: string;
  sourceDateEpoch: number;
  nodeVersion: string;
  npmVersion: string;
  archive: ArchiveSizes;
  evidence: readonly EvidenceIdentity[];
}

export interface ArchiveSizes {
  compressedBytes: number;
  uncompressedBytes: number;
}

export interface EvidenceIdentity {
  id: string;
  path: string;
  sha256: string;
}

export interface ReleaseManifest {
  manifestVersion: 1;
  version: string;
  profile: ReleaseConfig["profile"];
  sourceCommit: string;
  buildTime: string;
  nodeVersion: string;
  npmVersion: string;
  scenarioFreezeId: string;
  onboardingFreezeId: string;
  replayFreezeId: string;
  analyticsSchemaVersion: number;
  adPolicy: ReleaseConfig["adPolicy"];
  publicationEligible: boolean;
  sdkEnabled: true;
  languages: readonly ["en", "ru"];
  platforms: readonly ["desktop", "mobile"];
  orientation: "landscape";
  savePolicy: "preferences_only_no_progression";
  archive: ArchiveSizes;
  evidence: readonly EvidenceIdentity[];
}

export function createReleaseManifest(
  input: ReleaseManifestInput,
): ReleaseManifest {
  if (!/^[0-9a-f]{40}$/i.test(input.sourceCommit))
    throw new Error("sourceCommit must be a full Git SHA");
  if (!Number.isInteger(input.sourceDateEpoch) || input.sourceDateEpoch <= 0)
    throw new Error("SOURCE_DATE_EPOCH must be a positive integer");
  if (
    !Number.isInteger(input.archive.compressedBytes) ||
    input.archive.compressedBytes < 0 ||
    !Number.isInteger(input.archive.uncompressedBytes) ||
    input.archive.uncompressedBytes < 0
  )
    throw new Error("archive sizes must be non-negative integers");
  if (
    input.evidence.length === 0 ||
    input.evidence.some(
      ({ id, path, sha256 }) => !id || !path || !/^[0-9a-f]{64}$/.test(sha256),
    )
  )
    throw new Error("evidence must have checksum-bound identities");
  const { config } = input;
  return {
    manifestVersion: 1,
    version: config.version,
    profile: config.profile,
    sourceCommit: input.sourceCommit,
    buildTime: new Date(input.sourceDateEpoch * 1000).toISOString(),
    nodeVersion: input.nodeVersion,
    npmVersion: input.npmVersion,
    scenarioFreezeId: config.scenarioFreezeId,
    onboardingFreezeId: config.onboardingFreezeId,
    replayFreezeId: config.replayFreezeId,
    analyticsSchemaVersion: config.analyticsSchemaVersion,
    adPolicy: config.adPolicy,
    publicationEligible: config.publicationEligible,
    sdkEnabled: true,
    languages: ["en", "ru"],
    platforms: ["desktop", "mobile"],
    orientation: "landscape",
    savePolicy: "preferences_only_no_progression",
    archive: { ...input.archive },
    evidence: input.evidence.map((identity) => ({ ...identity })),
  };
}

export function validateReleaseManifest(
  input: Partial<ReleaseManifest>,
): string[] {
  const required: ReadonlyArray<keyof ReleaseManifest> = [
    "manifestVersion",
    "version",
    "profile",
    "sourceCommit",
    "buildTime",
    "nodeVersion",
    "npmVersion",
    "scenarioFreezeId",
    "onboardingFreezeId",
    "replayFreezeId",
    "analyticsSchemaVersion",
    "adPolicy",
    "publicationEligible",
    "sdkEnabled",
    "languages",
    "platforms",
    "orientation",
    "savePolicy",
    "archive",
    "evidence",
  ];
  return required.filter((key) => {
    const value = input[key];
    return value === undefined || value === null || value === "";
  });
}
