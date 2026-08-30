import { describe, expect, it } from "vitest";
import {
  createReleaseConfig,
  RELEASE_CONSTANTS,
} from "../../src/release/config";
import {
  createReleaseManifest,
  validateReleaseManifest,
} from "../../src/release/manifest";

describe("release profiles and manifest", () => {
  it("accepts exactly study-draft and catalog-release with mandatory freeze identifiers", () => {
    expect(createReleaseConfig("study-draft")).toMatchObject({
      profile: "study-draft",
      adPolicy: "disabled_for_study",
      publicationEligible: false,
    });
    expect(createReleaseConfig("catalog-release")).toMatchObject({
      profile: "catalog-release",
      adPolicy: "post_battle_fullscreen",
      publicationEligible: true,
    });
    expect(() => createReleaseConfig(undefined)).toThrow(/profile/);
    expect(() => createReleaseConfig("preview")).toThrow(/profile/);
    expect(() =>
      createReleaseConfig("study-draft", { scenarioFreezeId: "" }),
    ).toThrow(/freeze/);
    expect(Object.values(RELEASE_CONSTANTS.freezeIds).every(Boolean)).toBe(
      true,
    );
  });

  it("creates a complete byte-deterministic manifest from SOURCE_DATE_EPOCH", () => {
    const input = {
      config: createReleaseConfig("study-draft"),
      sourceCommit: "0123456789abcdef0123456789abcdef01234567",
      sourceDateEpoch: 1_800_000_000,
      nodeVersion: "v24.1.0",
      npmVersion: "11.0.0",
      archive: { compressedBytes: 1234, uncompressedBytes: 5678 },
      evidence: [
        {
          id: "tdd-red-green",
          path: "artifacts/tdd-evidence.md",
          sha256: "a".repeat(64),
        },
      ],
    };
    const first = createReleaseManifest(input);
    const second = createReleaseManifest(input);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).toMatchObject({
      buildTime: new Date(1_800_000_000_000).toISOString(),
      sourceCommit: input.sourceCommit,
      profile: "study-draft",
      languages: ["en", "ru"],
      platforms: ["desktop", "mobile"],
      orientation: "landscape",
      savePolicy: "preferences_only_no_progression",
      archive: input.archive,
      evidence: input.evidence,
    });
    expect(validateReleaseManifest(first)).toEqual([]);
    expect(validateReleaseManifest({ ...first, sourceCommit: "" })).toContain(
      "sourceCommit",
    );
  });
});
