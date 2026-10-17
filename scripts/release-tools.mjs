import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { chromium } from "@playwright/test";

const LIMIT = 100 * 1024 * 1024;
const ALLOWED_ABSOLUTE_HOSTS = new Set();
const SOLANA_MOBILE_ALLOWED_HOSTS = new Set([
  "xsa-dev.github.io",
  "api.mainnet-beta.solana.com",
  "solanamobile.com",
  "localhost",
]);
const RELEASE_METADATA = JSON.parse(
  await readFile(new URL("../release-metadata.json", import.meta.url), "utf8"),
);

const portable = (path) => path.split(sep).join("/");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function contained(root, candidate) {
  const path = relative(root, candidate);
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function isSafeRelativeArchivePath(path) {
  if (
    !path ||
    path.startsWith("/") ||
    /^[A-Za-z]:\//.test(path) ||
    path.includes("\\")
  )
    return false;
  const segments = path.split("/");
  return segments.every(
    (segment) =>
      segment !== "" &&
      segment !== "." &&
      segment !== ".." &&
      !segment.startsWith("-"),
  );
}

export const zipArguments = (zipPath, paths) => [
  "-X",
  "-q",
  zipPath,
  "--",
  ...paths,
];

async function walk(root, current = root, rootReal = undefined) {
  if (!rootReal) {
    const rootInfo = await lstat(root);
    if (rootInfo.isSymbolicLink())
      throw new Error(`source symbolic link is forbidden: ${root}`);
    rootReal = await realpath(root);
  }
  const result = [];
  for (const name of (await readdir(current)).sort()) {
    const absolute = join(current, name);
    const info = await lstat(absolute);
    if (info.isSymbolicLink())
      throw new Error(
        `source symbolic link is forbidden: ${portable(relative(root, absolute))}`,
      );
    const actual = await realpath(absolute);
    if (!contained(rootReal, actual))
      throw new Error(
        `source path escapes build root: ${portable(relative(root, absolute))}`,
      );
    if (info.isDirectory())
      result.push(...(await walk(root, absolute, rootReal)));
    else if (info.isFile())
      result.push({
        path: portable(relative(root, absolute)),
        absolute,
        size: info.size,
      });
    else
      throw new Error(
        `non-regular source entry is forbidden: ${portable(relative(root, absolute))}`,
      );
  }
  return result;
}

function networkHosts(path, content) {
  const hosts = [];
  const patterns = [];
  if (/\.html?$/i.test(path))
    patterns.push(
      /(?:src|href|action|formaction|poster|data)\s*=\s*["'](?:(?:https?|wss?):)?\/\/([A-Za-z0-9.-]+)/gi,
      /<meta\s+[^>]*content\s*=\s*["'][^"']*(?:(?:https?|wss?):)?\/\/([A-Za-z0-9.-]+)/gi,
    );
  if (/\.css$/i.test(path))
    patterns.push(
      /(?:url\s*\(|@import\s+)["']?(?:(?:https?|wss?):)?\/\/([A-Za-z0-9.-]+)/gi,
    );
  if (/\.m?js$/i.test(path))
    patterns.push(
      /(?:fetch|importScripts|WebSocket|EventSource|sendBeacon)\s*\(\s*(?:new\s+URL\s*\(\s*)?["'](?:(?:https?|wss?):)?\/\/([A-Za-z0-9.-]+)/gi,
      /new\s+URL\s*\(\s*["'](?:(?:https?|wss?):)?\/\/([A-Za-z0-9.-]+)/gi,
      /\.open\s*\(\s*["'][A-Z]+["']\s*,\s*["'](?:(?:https?|wss?):)?\/\/([A-Za-z0-9.-]+)/gi,
      /\.(?:src|href)\s*=\s*["'](?:(?:https?|wss?):)?\/\/([A-Za-z0-9.-]+)/gi,
      /import\s*\(\s*["'](?:(?:https?|wss?):)?\/\/([A-Za-z0-9.-]+)/gi,
    );
  for (const pattern of patterns)
    for (const match of content.matchAll(pattern)) {
      const host = match[1];
      if (host) hosts.push(host.toLowerCase());
    }
  return hosts;
}

export function validateArchiveEntries(entries, options = {}) {
  const errors = [];
  const allowedHosts =
    options.profile === "solana-mobile"
      ? SOLANA_MOBILE_ALLOWED_HOSTS
      : ALLOWED_ABSOLUTE_HOSTS;
  const indexes = entries.filter(({ path }) => basename(path) === "index.html");
  const rootIndexes = entries.filter(({ path }) => path === "index.html");
  if (indexes.length === 0) errors.push("missing root index.html");
  else if (indexes.length > 1) errors.push("duplicate index.html");
  if (indexes.length === 1 && rootIndexes.length !== 1)
    errors.push("index.html must be at archive root");
  if (entries.some(({ path }) => path === "dist" || path.startsWith("dist/")))
    errors.push("dist wrapper is forbidden");
  for (const entry of entries) {
    if (!isSafeRelativeArchivePath(entry.path))
      errors.push(`unsafe archive path: ${entry.path}`);
    if (!/^[\x20-\x7e]+$/.test(entry.path) || entry.path.includes(" "))
      errors.push(`path must be ASCII and space-free: ${entry.path}`);
    const content = entry.content ?? "";
    if (/\.(?:html|css|m?js)$/i.test(entry.path))
      for (const host of networkHosts(entry.path, content)) {
        if (!allowedHosts.has(host))
          errors.push(`forbidden absolute host: ${host}`);
      }
  }
  if (entries.reduce((sum, { size }) => sum + size, 0) >= LIMIT)
    errors.push("uncompressed size must be below 100 MB");
  return [...new Set(errors)];
}

export function validateZipListing(entries) {
  const errors = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!isSafeRelativeArchivePath(entry.path))
      errors.push(`unsafe archive path: ${entry.path}`);
    if (!/^[\x20-\x7e]+$/.test(entry.path) || entry.path.includes(" "))
      errors.push(`path must be ASCII and space-free: ${entry.path}`);
    if (entry.type !== "file")
      errors.push(`non-regular archive entry: ${entry.path}`);
    if (
      !Number.isSafeInteger(entry.uncompressedSize) ||
      entry.uncompressedSize < 0
    )
      errors.push(`invalid archive entry size: ${entry.path}`);
    if (seen.has(entry.path))
      errors.push(`duplicate archive entry: ${entry.path}`);
    seen.add(entry.path);
  }
  const indexes = entries.filter(({ path }) => path === "index.html");
  if (indexes.length !== 1)
    errors.push("ZIP must contain exactly one root index.html");
  if (
    entries.reduce((sum, { uncompressedSize }) => sum + uncompressedSize, 0) >=
    LIMIT
  )
    errors.push("ZIP uncompressed size must be below 100 MB");
  return [...new Set(errors)];
}

function parseZipCentralDirectory(bytes) {
  const minimumEocd = 22;
  const firstCandidate = Math.max(0, bytes.length - 65_557);
  let eocd = -1;
  for (
    let offset = bytes.length - minimumEocd;
    offset >= firstCandidate;
    offset -= 1
  )
    if (bytes.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  if (eocd < 0) throw new Error("ZIP end-of-central-directory is missing");
  const commentLength = bytes.readUInt16LE(eocd + 20);
  if (eocd + minimumEocd + commentLength !== bytes.length)
    throw new Error("ZIP end-of-central-directory length is invalid");
  const disk = bytes.readUInt16LE(eocd + 4);
  const centralDisk = bytes.readUInt16LE(eocd + 6);
  const diskEntries = bytes.readUInt16LE(eocd + 8);
  const totalEntries = bytes.readUInt16LE(eocd + 10);
  const centralSize = bytes.readUInt32LE(eocd + 12);
  const centralOffset = bytes.readUInt32LE(eocd + 16);
  if (
    disk !== 0 ||
    centralDisk !== 0 ||
    diskEntries !== totalEntries ||
    totalEntries === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  )
    throw new Error("multi-disk and ZIP64 archives are forbidden");
  if (centralOffset + centralSize !== eocd)
    throw new Error("ZIP central-directory bounds are invalid");
  const entries = [];
  let offset = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > eocd || bytes.readUInt32LE(offset) !== 0x02014b50)
      throw new Error("ZIP central-directory entry is malformed");
    const flags = bytes.readUInt16LE(offset + 8);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const entryCommentLength = bytes.readUInt16LE(offset + 32);
    const externalAttributes = bytes.readUInt32LE(offset + 38);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const end = offset + 46 + nameLength + extraLength + entryCommentLength;
    if (
      end > eocd ||
      flags & 1 ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff
    )
      throw new Error("encrypted, ZIP64, or truncated entries are forbidden");
    const rawName = bytes.subarray(offset + 46, offset + 46 + nameLength);
    const path = rawName.toString("utf8");
    if (
      localOffset + 30 > centralOffset ||
      bytes.readUInt32LE(localOffset) !== 0x04034b50
    )
      throw new Error("ZIP local entry is malformed");
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const localNameStart = localOffset + 30;
    const localNameEnd = localNameStart + localNameLength;
    if (
      localNameEnd + localExtraLength > centralOffset ||
      !bytes.subarray(localNameStart, localNameEnd).equals(rawName)
    )
      throw new Error("ZIP local and central names do not match");
    const unixMode = (externalAttributes >>> 16) & 0xffff;
    const fileType = unixMode & 0o170000;
    const type =
      fileType === 0o120000
        ? "symlink"
        : path.endsWith("/") ||
            fileType === 0o040000 ||
            (externalAttributes & 0x10) !== 0
          ? "directory"
          : fileType === 0 || fileType === 0o100000
            ? "file"
            : "special";
    entries.push({
      path,
      uncompressedSize,
      type,
    });
    offset = end;
  }
  if (entries.length === 0 || offset !== eocd)
    throw new Error("ZIP central directory contained no exact entry set");
  return entries;
}

export function inspectZipArchive(zipPath) {
  const entries = parseZipCentralDirectory(readFileSync(zipPath));
  const errors = validateZipListing(entries);
  if (errors.length) throw new Error(errors.join("\n"));
  return entries;
}

export function createReleaseManifestObject(input, archive) {
  if (!/^(study-draft|catalog-release|solana-mobile)$/.test(input.profile))
    throw new Error(`Unknown release profile: ${input.profile}`);
  if (!/^[0-9a-f]{40}$/i.test(input.sourceCommit))
    throw new Error("Missing or invalid source commit");
  if (!Number.isInteger(input.sourceDateEpoch) || input.sourceDateEpoch <= 0)
    throw new Error("Missing SOURCE_DATE_EPOCH");
  if (
    !Array.isArray(input.evidence) ||
    input.evidence.length === 0 ||
    input.evidence.some(
      ({ id, path, sha256: checksum }) =>
        !id || !path || !/^[0-9a-f]{64}$/.test(checksum),
    )
  )
    throw new Error("Evidence identities must include id, path, and SHA-256");
  const profileMetadata = RELEASE_METADATA.profiles[input.profile];
  return {
    manifestVersion: RELEASE_METADATA.manifestVersion,
    version: input.version,
    profile: input.profile,
    sourceCommit: input.sourceCommit,
    buildTime: new Date(input.sourceDateEpoch * 1000).toISOString(),
    nodeVersion: input.nodeVersion,
    npmVersion: input.npmVersion,
    ...RELEASE_METADATA.freezeIds,
    analyticsSchemaVersion: RELEASE_METADATA.analyticsSchemaVersion,
    adPolicy: profileMetadata.adPolicy,
    publicationEligible: profileMetadata.publicationEligible,
    sdkEnabled: input.profile !== "solana-mobile",
    languages: RELEASE_METADATA.languages,
    platforms: RELEASE_METADATA.platforms,
    orientation: RELEASE_METADATA.orientation,
    savePolicy: RELEASE_METADATA.savePolicy,
    archive,
    evidence: input.evidence,
  };
}

export async function createDeterministicPackage(sourceDir, outputDir, input) {
  if (input.profile === "catalog-release")
    throw new Error("catalog-release prerequisites are incomplete");
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(input.version))
    throw new Error(`Invalid release version: ${input.version}`);
  const sourceEntries = await walk(sourceDir);
  const entries = [];
  for (const entry of sourceEntries)
    entries.push({
      ...entry,
      content: /\.(?:html|css|m?js|json|webmanifest)$/i.test(entry.path)
        ? await readFile(entry.absolute, "utf8")
        : "",
    });
  const validation = validateArchiveEntries(entries, {
    profile: input.profile,
  });
  if (validation.length) throw new Error(validation.join("\n"));

  const releaseDir = resolve(outputDir, input.version);
  await mkdir(releaseDir, { recursive: true });
  const stage = await mkdtemp(join(tmpdir(), "tactics-package-stage-"));
  try {
    for (const entry of sourceEntries) {
      const destination = join(stage, entry.path);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(entry.absolute, destination);
    }
    const epoch = new Date(input.sourceDateEpoch * 1000);
    const stagedEntries = await walk(stage);
    for (const entry of stagedEntries) {
      await chmod(entry.absolute, 0o644);
      await utimes(entry.absolute, epoch, epoch);
    }
    const paths = stagedEntries.map(({ path }) => path).sort();
    const zip = join(releaseDir, `tactics-arena-${input.version}.zip`);
    await rm(zip, { force: true });
    execFileSync("zip", zipArguments(zip, paths), { cwd: stage });
    inspectZipArchive(zip);
    const manifestObject = createReleaseManifestObject(input, {
      compressedBytes: (await stat(zip)).size,
      uncompressedBytes: sourceEntries.reduce(
        (total, entry) => total + entry.size,
        0,
      ),
    });
    const manifestBytes = `${JSON.stringify(manifestObject, null, 2)}\n`;
    const manifest = join(releaseDir, "release-manifest.json");
    await writeFile(manifest, manifestBytes);
    const checksumLines = [];
    checksumLines.push(`${sha256(await readFile(zip))}  ${basename(zip)}`);
    for (const path of paths)
      checksumLines.push(
        `${sha256(await readFile(join(stage, path)))}  app/${path}`,
      );
    const checksums = join(releaseDir, "SHA256SUMS");
    await writeFile(checksums, `${checksumLines.join("\n")}\n`);
    return { zip, manifest, checksums };
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

export async function verifyChecksums(zipPath, checksumPath) {
  const errors = [];
  let archiveEntries;
  try {
    archiveEntries = inspectZipArchive(zipPath);
  } catch (error) {
    return [
      `invalid archive: ${error instanceof Error ? error.message : String(error)}`,
    ];
  }
  const expectedNames = new Set([
    basename(zipPath),
    ...archiveEntries.map(({ path }) => `app/${path}`),
  ]);
  const seenNames = new Set();
  const lines = (await readFile(checksumPath, "utf8")).trim().split("\n");
  for (const line of lines) {
    const [expected, name] = line.split(/\s{2}/);
    if (!expected || !name) {
      errors.push(`invalid checksum line: ${line}`);
      continue;
    }
    if (!expectedNames.has(name)) {
      errors.push(`unexpected checksum: ${name}`);
      continue;
    }
    if (seenNames.has(name)) {
      errors.push(`duplicate checksum: ${name}`);
      continue;
    }
    seenNames.add(name);
    let bytes;
    if (name === basename(zipPath)) bytes = await readFile(zipPath);
    else {
      const result = spawnSync(
        "unzip",
        ["-p", zipPath, name.replace(/^app\//, "")],
        { maxBuffer: LIMIT },
      );
      if (result.status !== 0) {
        errors.push(`missing archive entry: ${name}`);
        continue;
      }
      bytes = result.stdout;
    }
    if (sha256(bytes) !== expected) errors.push(`checksum mismatch: ${name}`);
  }
  for (const name of expectedNames)
    if (!seenNames.has(name)) errors.push(`missing checksum: ${name}`);
  return errors;
}

const contentType = (path) =>
  ({
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
  })[extname(path)] ?? "application/octet-stream";

export async function smokePackagedArtifact(zipPath, options = {}) {
  const root = await mkdtemp(join(tmpdir(), "tactics-package-smoke-"));
  const errors = [];
  let server;
  let browser;
  const requestHandler = async (request, response) => {
    try {
      const requestPath = decodeURIComponent(
        (request.url ?? "/").split("?")[0],
      );
      const relativePath =
        requestPath === "/nested/"
          ? "index.html"
          : requestPath.replace(/^\/nested\//, "");
      const absolute = resolve(root, relativePath || "index.html");
      const containment = relative(resolve(root), absolute);
      if (
        containment === ".." ||
        containment.startsWith(`..${sep}`) ||
        isAbsolute(containment)
      )
        throw new Error("invalid path");
      response.setHeader("content-type", contentType(absolute));
      response.end(await readFile(absolute));
    } catch {
      response.statusCode = 404;
      response.end("not found");
    }
  };
  try {
    inspectZipArchive(zipPath);
    execFileSync("unzip", ["-q", zipPath, "-d", root]);
    server = options.createHttpServer
      ? options.createHttpServer(requestHandler)
      : createServer(requestHandler);
    await new Promise((resolveListen, rejectListen) => {
      const onError = (error) => rejectListen(error);
      server.once?.("error", onError);
      server.listen(0, "127.0.0.1", () => {
        server.removeListener?.("error", onError);
        resolveListen();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("smoke server did not bind");
    browser = await (options.launchBrowser
      ? options.launchBrowser()
      : chromium.launch());
    const page = await browser.newPage();
    let step = "navigation";
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400)
        errors.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    page.on("requestfailed", (request) =>
      errors.push(
        `request failed: ${request.url()}: ${request.failure()?.errorText ?? "unknown error"}`,
      ),
    );
    try {
      const response = await page.goto(
        `http://127.0.0.1:${address.port}/nested/`,
      );
      if (!response?.ok())
        errors.push(`HTTP ${response?.status() ?? "no response"}`);
      if (errors.length) throw new Error(errors.join("; "));
      step = "interactive readiness";
      await page.waitForFunction(
        () => window.__TACTICS__?.interactiveReady === true,
        undefined,
        { timeout: 10_000 },
      );
      const dismiss = page.locator("#onboarding-dismiss");
      if (await dismiss.isVisible()) await dismiss.click();
      step = "battle start after startup settling";
      await page.waitForFunction(
        () => window.__TACTICS__.eventNames().includes("battle_started"),
        undefined,
        { timeout: 10_000 },
      );
      const canvas = page.locator("canvas");
      const clickCell = async (x, y) => {
        const box = await canvas.boundingBox();
        if (!box) throw new Error("packaged canvas missing");
        const scale = box.width / 960;
        await page.mouse.click(
          box.x + (20 + x * 66 + 33) * scale,
          box.y + (66 + y * 66 + 33) * scale,
        );
      };
      step = "round one actions";
      await clickCell(0, 1);
      await page.locator("#ability-action").click();
      await clickCell(5, 1);
      await clickCell(0, 3);
      await page.locator("#move-action").click();
      await clickCell(2, 3);
      await page.locator("#attack-action").click();
      await clickCell(6, 3);
      await clickCell(1, 4);
      await page.locator("#move-action").click();
      await clickCell(2, 4);
      await page.locator("#attack-action").click();
      await clickCell(6, 4);
      await page.locator("#end-turn").click();
      step = "enemy queue to round two";
      await page.waitForFunction(
        () => window.__TACTICS__.snapshot().round === 2,
        undefined,
        { timeout: 10_000 },
      );
      await page.waitForFunction(
        () => !document.querySelector("#end-turn")?.disabled,
        undefined,
        { timeout: 10_000 },
      );
      step = "round two victory actions";
      await clickCell(0, 1);
      await page.locator("#attack-action").click();
      await clickCell(4, 1);
      await clickCell(2, 3);
      await page.locator("#ability-action").click();
      await clickCell(6, 3);
      await clickCell(2, 4);
      await page.locator("#attack-action").click();
      await clickCell(6, 4);
      step = "terminal result";
      await page.waitForFunction(
        () =>
          !document
            .querySelector("#result-overlay")
            ?.classList.contains("hidden"),
        undefined,
        { timeout: 10_000 },
      );
      const criticalFlow =
        (await page.evaluate(() => window.__TACTICS__.snapshot().status)) ===
        "victory";
      return { ready: true, criticalFlow, errors };
    } catch (error) {
      const snapshot = await page
        .evaluate(() => window.__TACTICS__?.snapshot())
        .catch(() => null);
      throw new Error(
        `packaged smoke failed at ${step}: ${error instanceof Error ? error.message : String(error)}; snapshot=${JSON.stringify(snapshot)}`,
      );
    }
  } finally {
    if (browser) await browser.close();
    if (server)
      await new Promise((resolveClose) => {
        try {
          server.close(resolveClose);
        } catch {
          resolveClose();
        }
      });
    await rm(root, { recursive: true, force: true });
  }
}
