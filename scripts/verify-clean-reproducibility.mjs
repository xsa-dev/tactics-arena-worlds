import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { qualifyTwoCleanCheckouts } from "./release-pipeline.mjs";

const workspace = resolve(".");
const root = await mkdtemp(join(tmpdir(), "tactics-real-repro-test-"));
const repository = join(root, "repository");
const excludedRoots = [".git", "node_modules", "dist", "artifacts/releases"];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

try {
  await cp(workspace, repository, {
    recursive: true,
    filter: (source) => {
      const path = relative(workspace, source).split(sep).join("/");
      return !excludedRoots.some(
        (excluded) => path === excluded || path.startsWith(`${excluded}/`),
      );
    },
  });
  execFileSync("git", ["init", "-q"], { cwd: repository });
  execFileSync("git", ["config", "user.name", "Tactics Reproducibility"], {
    cwd: repository,
  });
  execFileSync("git", ["config", "user.email", "repro@example.invalid"], {
    cwd: repository,
  });
  execFileSync("git", ["add", "-A"], { cwd: repository });
  execFileSync("git", ["commit", "-q", "-m", "temporary release snapshot"], {
    cwd: repository,
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: "2026-08-31T00:00:00Z",
      GIT_COMMITTER_DATE: "2026-08-31T00:00:00Z",
    },
  });
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repository,
    encoding: "utf8",
  }).trim();
  const sourceDateEpoch = Number(
    execFileSync("git", ["show", "-s", "--format=%ct", sourceCommit], {
      cwd: repository,
      encoding: "utf8",
    }).trim(),
  );
  const packageJson = JSON.parse(
    await readFile(join(repository, "package.json"), "utf8"),
  );
  const evidence = await Promise.all(
    [
      ["tdd-red-green", "artifacts/tdd-evidence.md"],
      [
        "scoped-openspec-tasks",
        "openspec/changes/prepare-yandex-games-release/tasks.md",
      ],
    ].map(async ([id, path]) => ({
      id,
      path,
      sha256: sha256(await readFile(join(repository, path))),
    })),
  );
  const npmVersion = execFileSync("npm", ["--version"], {
    encoding: "utf8",
  }).trim();
  const result = await qualifyTwoCleanCheckouts({
    repository,
    sourceCommit,
    outputDir: join(root, "qualified"),
    qualificationStdio: "pipe",
    packageInput: {
      version: packageJson.version,
      profile: "study-draft",
      sourceCommit,
      sourceDateEpoch,
      nodeVersion: process.version,
      npmVersion,
      evidence,
    },
  });
  const manifest = JSON.parse(await readFile(result.manifest, "utf8"));
  console.log(
    JSON.stringify(
      {
        sourceCommit,
        profile: manifest.profile,
        zipSha256: sha256(await readFile(result.zip)),
        manifestSha256: sha256(await readFile(result.manifest)),
        checksumsSha256: sha256(await readFile(result.checksums)),
        evidenceSha256: sha256(await readFile(result.evidence)),
        comparedCleanCheckouts: 2,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
