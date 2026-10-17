import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

const FORBIDDEN_PATH_PATTERN =
  /(?:\.(?:keystore|jks|p12)|(?:^|\/|-)keypair\.json)$/i;

const SECRET_CONTENT_PATTERNS = [
  /oj_(?:live|test)_[A-Za-z0-9]{20,}/g,
  /Bearer\s+oj_[A-Za-z0-9_-]{20,}/gi,
  /(?:SOLANA_MOBILE_KEYSTORE_PASSWORD|SOLANA_MOBILE_KEY_PASSWORD|DAPP_STORE_API_KEY)\s*(?:=|:)\s*["']?[A-Za-z0-9_!@#$%^&*.-]{6,}/g,
  /\[\s*(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*){63}(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*\]/g,
];

export function scanEntriesForSecrets(entries) {
  const findings = [];
  for (const entry of entries) {
    if (FORBIDDEN_PATH_PATTERN.test(entry.path)) {
      findings.push(entry.path);
      continue;
    }
    const content = entry.content ?? "";
    for (const pattern of SECRET_CONTENT_PATTERNS) {
      if (pattern.test(content)) findings.push(entry.path);
      pattern.lastIndex = 0;
    }
  }
  return [...new Set(findings)];
}

function collectDistFiles(rootDir, currentDir = join(rootDir, "dist")) {
  if (!existsSync(currentDir)) return [];
  const results = [];
  for (const name of readdirSync(currentDir)) {
    const absolute = join(currentDir, name);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      results.push(...collectDistFiles(rootDir, absolute));
    } else if (stat.isFile()) {
      results.push(relative(rootDir, absolute).split(sep).join("/"));
    }
  }
  return results;
}

export function runSecretScan(rootDir = process.cwd()) {
  const gitFiles = execFileSync(
    "git",
    ["ls-files", "-co", "--exclude-standard"],
    { cwd: rootDir, encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean)
    .filter(
      (file) => !file.startsWith("node_modules/") && !file.startsWith(".git/"),
    );
  const allPaths = [...new Set([...gitFiles, ...collectDistFiles(rootDir)])];
  const entries = [];
  for (const file of allPaths) {
    try {
      const absolute = join(rootDir, file);
      if (!statSync(absolute).isFile()) continue;
      const content = /\.(?:png|jpg|jpeg|gif|webp|zip|keystore|jks|p12)$/i.test(
        file,
      )
        ? ""
        : readFileSync(absolute, "utf8");
      entries.push({ path: file, content });
    } catch {
      // Ignore files that disappear during a concurrent build.
    }
  }
  return {
    scannedCount: entries.length,
    findings: scanEntriesForSecrets(entries),
  };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const { scannedCount, findings } = runSecretScan();
  if (findings.length) {
    console.error(
      `Potential credential or secret file found in: ${findings.join(", ")}`,
    );
    process.exit(1);
  }
  console.log(`Secret scan passed for ${scannedCount} repository files.`);
}
