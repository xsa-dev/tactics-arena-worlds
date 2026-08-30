import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  validateLockfileIntegrity,
  validateReleaseInputs,
} from "./release-preflight.mjs";
import { qualifyTwoCleanCheckouts } from "./release-pipeline.mjs";

function fail(message) {
  console.error(`[release] REFUSED: ${message}`);
  process.exitCode = 1;
}

const profile = process.env.RELEASE_PROFILE;
const evidencePaths = [
  ["tdd-red-green", "artifacts/tdd-evidence.md"],
  [
    "scoped-openspec-tasks",
    "openspec/changes/prepare-yandex-games-release/tasks.md",
  ],
];
const gitStatus = execFileSync("git", ["status", "--porcelain"], {
  encoding: "utf8",
});
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const sourceDateEpoch = /^[0-9a-f]{40}$/.test(sourceCommit)
  ? Number(
      execFileSync("git", ["show", "-s", "--format=%ct", sourceCommit], {
        encoding: "utf8",
      }).trim(),
    )
  : 0;
const manifest = {
  version: packageJson.version,
  profile,
  sourceCommit,
  buildTime:
    sourceDateEpoch > 0 ? new Date(sourceDateEpoch * 1000).toISOString() : "",
};
const errors = validateReleaseInputs({
  profile,
  gitStatus,
  sourceCommit,
  manifest,
});

if (errors.length === 0)
  errors.push(...validateLockfileIntegrity(resolve(".")));

if (errors.length) {
  fail(errors.join("; "));
} else {
  const npmVersion = execFileSync("npm", ["--version"], {
    encoding: "utf8",
  }).trim();
  const evidence = await Promise.all(
    evidencePaths.map(async ([id, path]) => ({
      id,
      path,
      sha256: createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
    })),
  );
  const result = await qualifyTwoCleanCheckouts({
    repository: resolve("."),
    sourceCommit,
    outputDir: resolve("artifacts/releases"),
    packageInput: {
      version: packageJson.version,
      profile,
      sourceCommit,
      sourceDateEpoch,
      nodeVersion: process.version,
      npmVersion,
      evidence,
    },
  });
  console.log(JSON.stringify(result));
}
