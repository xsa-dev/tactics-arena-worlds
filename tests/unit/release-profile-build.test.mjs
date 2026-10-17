import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createReleaseManifestObject } from "../../scripts/release-tools.mjs";

const roots = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("canonical release profile propagation", () => {
  it.each(["study-draft", "catalog-release", "solana-mobile"])(
    "embeds %s in real Vite bytes and the matching manifest",
    async (profile) => {
      const root = await mkdtemp(join(tmpdir(), "tactics-profile-build-test-"));
      roots.push(root);
      const dist = join(root, "dist");
      execFileSync("npx", ["vite", "build", "--outDir", dist], {
        env: { ...process.env, RELEASE_PROFILE: profile },
        stdio: "pipe",
      });
      const assets = join(dist, "assets");
      const javascript = (
        await Promise.all(
          (await readdir(assets))
            .filter((name) => name.endsWith(".js"))
            .map((name) => readFile(join(assets, name), "utf8")),
        )
      ).join("\n");
      const manifest = createReleaseManifestObject(
        {
          version: "0.1.0",
          profile,
          sourceCommit: "0123456789abcdef0123456789abcdef01234567",
          sourceDateEpoch: 1_800_000_000,
          nodeVersion: process.version,
          npmVersion: "test",
          evidence: [{ id: "test", path: "test", sha256: "a".repeat(64) }],
        },
        { compressedBytes: 1, uncompressedBytes: 1 },
      );
      expect(javascript).toContain(`tactics-release-profile:${profile}`);
      expect(manifest.profile).toBe(profile);
      expect(manifest.sdkEnabled).toBe(profile !== "solana-mobile");
      const indexHtml = await readFile(join(dist, "index.html"), "utf8");
      expect(indexHtml).toContain("manifest.json");
      expect(indexHtml).toContain("privacy.html");
      const webManifest = JSON.parse(
        await readFile(join(dist, "manifest.json"), "utf8"),
      );
      expect(webManifest).toMatchObject({
        orientation: "landscape",
        display: "standalone",
      });
      expect(await readFile(join(dist, "privacy.html"), "utf8")).toContain(
        "Privacy Policy",
      );
    },
    30_000,
  );
});
