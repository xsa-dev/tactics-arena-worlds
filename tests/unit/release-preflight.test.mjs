import { describe, expect, it } from "vitest";
import {
  validateLockfileIntegrity,
  validateReleaseInputs,
} from "../../scripts/release-preflight.mjs";

const valid = {
  profile: "study-draft",
  gitStatus: "",
  packageVersion: "0.1.0",
  sourceCommit: "0123456789abcdef0123456789abcdef01234567",
  manifest: {
    version: "0.1.0",
    profile: "study-draft",
    sourceCommit: "0123456789abcdef0123456789abcdef01234567",
    buildTime: "2027-01-15T08:00:00.000Z",
  },
};

describe("release packaging preflight", () => {
  it("refuses catalog packaging while product, advertising, catalog, and moderation prerequisites are unimplemented", () => {
    expect(
      validateReleaseInputs({
        ...valid,
        profile: "catalog-release",
        manifest: { ...valid.manifest, profile: "catalog-release" },
      }),
    ).toContain("catalog-release prerequisites are incomplete");
  });

  it("fails closed for dirty source, lock mismatch, commit/profile errors, or incomplete manifest", () => {
    expect(validateReleaseInputs(valid)).toEqual([]);
    expect(
      validateReleaseInputs({
        ...valid,
        profile: "solana-mobile",
        manifest: { ...valid.manifest, profile: "solana-mobile" },
      }),
    ).toEqual([]);
    expect(
      validateReleaseInputs({ ...valid, gitStatus: " M src/main.ts" }),
    ).toContain("source tree is dirty");
    expect(validateReleaseInputs({ ...valid, sourceCommit: "" })).toContain(
      "source commit is missing",
    );
    expect(validateReleaseInputs({ ...valid, profile: "preview" })).toContain(
      "release profile is unknown",
    );
    expect(
      validateReleaseInputs({
        ...valid,
        manifest: { ...valid.manifest, buildTime: "" },
      }),
    ).toContain("release manifest is incomplete");
  });

  it("validates package-lock integrity with npm ci instead of comparing root versions", () => {
    const calls = [];
    expect(
      validateLockfileIntegrity("/repo", (command, args, options) => {
        calls.push({ command, args, options });
        return { status: 0, stderr: "" };
      }),
    ).toEqual([]);
    expect(calls).toEqual([
      {
        command: "npm",
        args: ["ci", "--ignore-scripts"],
        options: expect.objectContaining({ cwd: "/repo" }),
      },
    ]);
    expect(
      validateLockfileIntegrity("/repo", () => ({
        status: 1,
        stderr: "integrity checksum failed",
      })),
    ).toEqual(["lockfile npm ci failed: integrity checksum failed"]);
  });
});
