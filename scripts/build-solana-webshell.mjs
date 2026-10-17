import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function loadWebshellManifest(
  manifestPath = resolve("webshell/twa-manifest.json"),
) {
  const raw = JSON.parse(await readFile(manifestPath, "utf8"));
  if (
    raw.packageId !== "dev.xsa.tacticsarena" ||
    raw.webManifestUrl !==
      "https://xsa-dev.github.io/tactics-arena-worlds/manifest.json" ||
    raw.orientation !== "landscape"
  ) {
    throw new Error("Invalid webshell/twa-manifest.json configuration");
  }
  return raw;
}

export function webshellCliArguments(manifest, outputDir = "webshell/android") {
  return {
    init: [
      "solana-mobile@latest",
      "webshell",
      "init",
      outputDir,
      "--manifest",
      manifest.webManifestUrl,
      "--application-id",
      manifest.packageId,
      "--app-name",
      manifest.name,
      "--version-name",
      manifest.appVersionName,
      "--version-code",
      String(manifest.appVersionCode),
      "--keystore-path",
      manifest.signingKey.path,
      "--keystore-alias",
      manifest.signingKey.alias,
      "--force",
    ],
    build: [
      "solana-mobile@latest",
      "webshell",
      "build",
      outputDir,
      "--keystore-path",
      manifest.signingKey.path,
      "--keystore-alias",
      manifest.signingKey.alias,
    ],
  };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const manifest = await loadWebshellManifest();
  const args = webshellCliArguments(manifest);
  if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify({ manifest, args }, null, 2));
  } else {
    for (const step of [args.init, args.build]) {
      const result = spawnSync("npx", step, { stdio: "inherit" });
      if (result.status !== 0) process.exit(result.status ?? 1);
    }
  }
}
