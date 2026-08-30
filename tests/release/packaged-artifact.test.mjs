import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  createDeterministicPackage,
  smokePackagedArtifact,
} from "../../scripts/release-tools.mjs";

describe("real packaged tactics artifact", () => {
  it("reaches readiness without console errors and completes the frozen battle", async () => {
    const root = await mkdtemp(join(tmpdir(), "tactics-real-smoke-"));
    try {
      const artifact = await createDeterministicPackage(
        resolve("dist"),
        join(root, "out"),
        {
          version: "0.1.0",
          profile: "study-draft",
          sourceCommit: "0123456789abcdef0123456789abcdef01234567",
          sourceDateEpoch: 1_800_000_000,
          nodeVersion: process.version,
          npmVersion: "test",
          evidence: [
            {
              id: "packaged-smoke-test",
              path: "tests/release/packaged-artifact.test.mjs",
              sha256: "c".repeat(64),
            },
          ],
        },
      );
      await expect(smokePackagedArtifact(artifact.zip)).resolves.toMatchObject({
        ready: true,
        criticalFlow: true,
        errors: [],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
