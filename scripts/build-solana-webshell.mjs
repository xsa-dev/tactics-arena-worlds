import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
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

export function resolveAndroidSdkPath(env = process.env, home = homedir()) {
  const candidates = [
    env.ANDROID_HOME,
    env.ANDROID_SDK_ROOT,
    join(home, "Library", "Android", "sdk"),
    join(home, "Android", "Sdk"),
  ].filter((value) => typeof value === "string" && value.trim().length > 0);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0] ?? join(home, "Library", "Android", "sdk");
}

export async function ensureAndroidLocalProperties(
  outputDir = "webshell/android",
  sdkPath = resolveAndroidSdkPath(),
) {
  const targetDir = resolve(outputDir);
  await mkdir(targetDir, { recursive: true });
  const localPropertiesPath = join(targetDir, "local.properties");
  const escapedSdkDir = sdkPath.replace(/\\/g, "\\\\");
  await writeFile(localPropertiesPath, `sdk.dir=${escapedSdkDir}\n`, "utf8");
  return localPropertiesPath;
}

export function resolveKeystorePath(manifest, outputDir = "webshell/android") {
  const rootCandidate = resolve(manifest.signingKey.path);
  if (existsSync(rootCandidate)) return rootCandidate;
  const projectCandidate = resolve(outputDir, manifest.signingKey.path);
  if (existsSync(projectCandidate)) return projectCandidate;
  return rootCandidate;
}

export function webshellCliArguments(
  manifest,
  outputDir = "webshell/android",
  keystorePath = manifest.signingKey.path,
) {
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
      keystorePath,
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
      keystorePath,
      "--keystore-alias",
      manifest.signingKey.alias,
    ],
  };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const outputDir = "webshell/android";
  const manifest = await loadWebshellManifest();
  const keystorePath = resolveKeystorePath(manifest, outputDir);
  const sdkPath = resolveAndroidSdkPath();
  const args = webshellCliArguments(manifest, outputDir, keystorePath);
  if (process.argv.includes("--dry-run")) {
    console.log(
      JSON.stringify({ manifest, keystorePath, sdkPath, args }, null, 2),
    );
  } else {
    const alreadyInitialized =
      existsSync(join(resolve(outputDir), "twa-manifest.json")) &&
      existsSync(join(resolve(outputDir), "build.gradle.kts")) &&
      !process.argv.includes("--reinit");
    if (!alreadyInitialized) {
      const initResult = spawnSync("npx", args.init, { stdio: "inherit" });
      if (initResult.status !== 0) process.exit(initResult.status ?? 1);
    }
    await ensureAndroidLocalProperties(outputDir, sdkPath);
    const buildResult = spawnSync("npx", args.build, { stdio: "inherit" });
    if (buildResult.status !== 0) process.exit(buildResult.status ?? 1);
  }
}
