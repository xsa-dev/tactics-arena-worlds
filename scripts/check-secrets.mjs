import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean)
  .filter(
    (file) => !file.startsWith("node_modules/") && !file.startsWith(".git/"),
  );
const secretPatterns = [
  /oj_(?:live|test)_[A-Za-z0-9]{20,}/g,
  /Bearer\s+oj_[A-Za-z0-9_-]{20,}/gi,
];
const findings = [];
for (const file of files) {
  try {
    if (!statSync(file).isFile()) continue;
    const content = readFileSync(join(process.cwd(), file), "utf8");
    for (const pattern of secretPatterns) {
      if (pattern.test(content)) findings.push(file);
      pattern.lastIndex = 0;
    }
  } catch {
    // Ignore files that disappear during a concurrent build.
  }
}
if (findings.length) {
  console.error(
    `Potential OpenJEV credential found in: ${[...new Set(findings)].join(", ")}`,
  );
  process.exit(1);
}
console.log(`Secret scan passed for ${files.length} repository files.`);
