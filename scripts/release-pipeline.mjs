import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import {
  createDeterministicPackage,
  inspectZipArchive,
  verifyChecksums,
} from "./release-tools.mjs";

export const qualificationCommands = () => [
  ["npm", ["ci"]],
  ["npm", ["run", "format:check"]],
  ["npm", ["run", "typecheck"]],
  ["npm", ["test"]],
  ["npm", ["run", "test:browser"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "test:release-artifact"]],
  ["npm", ["audit", "--audit-level=high"]],
  ["openspec", ["validate", "validate-tactical-battle-prototype", "--strict"]],
  ["openspec", ["validate", "prepare-yandex-games-release", "--strict"]],
];

const gateIds = [
  "dependency-install",
  "format-check",
  "typecheck",
  "unit-contract-tests",
  "browser-tests",
  "production-build",
  "packaged-artifact-smoke",
  "security-audit",
  "openspec-validate-tactical-battle-prototype",
  "openspec-prepare-yandex-games-release",
];

export function qualificationEvidenceBytes({
  sourceCommit,
  profile,
  commands,
}) {
  if (commands.length !== gateIds.length)
    throw new Error("qualification gate evidence is incomplete");
  return Buffer.from(
    `${JSON.stringify(
      {
        schemaVersion: 1,
        sourceCommit,
        profile,
        gates: commands.map(([command, args], index) => ({
          id: gateIds[index],
          command: [command, ...args],
          status: "passed",
        })),
      },
      null,
      2,
    )}\n`,
  );
}

const runQualification = (checkout, env, stdio) => {
  for (const [command, args] of qualificationCommands())
    execFileSync(command, args, { cwd: checkout, env, stdio });
};

const bytesEqual = async (left, right) =>
  (await readFile(left)).equals(await readFile(right));

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function verifyFinalReleaseArtifacts(result, expected) {
  inspectZipArchive(result.zip);
  const checksumErrors = await verifyChecksums(result.zip, result.checksums);
  if (checksumErrors.length)
    throw new Error(
      `final checksum verification failed: ${checksumErrors.join(", ")}`,
    );
  const manifest = JSON.parse(await readFile(result.manifest, "utf8"));
  if (
    manifest.profile !== expected.profile ||
    manifest.sourceCommit !== expected.sourceCommit
  )
    throw new Error("final manifest source/profile binding failed");
  const evidenceIdentity = manifest.evidence?.find(
    ({ id }) => id === "qualification-gates",
  );
  if (
    !evidenceIdentity ||
    evidenceIdentity.path !== "qualification-evidence.json" ||
    sha256(await readFile(result.evidence)) !== evidenceIdentity.sha256
  )
    throw new Error("final qualification evidence binding failed");
}

export async function qualifyTwoCleanCheckouts({
  repository,
  sourceCommit,
  outputDir,
  packageInput,
  qualificationStdio = "inherit",
}) {
  const root = await mkdtemp(join(tmpdir(), "tactics-release-worktrees-"));
  const checkouts = [join(root, "one"), join(root, "two")];
  const temporaryOutputs = [join(root, "out-one"), join(root, "out-two")];
  const artifacts = [];
  const commands = qualificationCommands();
  const evidenceBytes = qualificationEvidenceBytes({
    sourceCommit,
    profile: packageInput.profile,
    commands,
  });
  const qualifiedPackageInput = {
    ...packageInput,
    evidence: [
      ...packageInput.evidence,
      {
        id: "qualification-gates",
        path: "qualification-evidence.json",
        sha256: sha256(evidenceBytes),
      },
    ],
  };
  try {
    for (let index = 0; index < checkouts.length; index += 1) {
      const checkout = checkouts[index];
      execFileSync(
        "git",
        ["worktree", "add", "--detach", checkout, sourceCommit],
        { cwd: repository, stdio: "inherit" },
      );
      runQualification(
        checkout,
        {
          ...process.env,
          RELEASE_PROFILE: packageInput.profile,
          SOURCE_DATE_EPOCH: String(packageInput.sourceDateEpoch),
        },
        qualificationStdio,
      );
      const artifact = await createDeterministicPackage(
        join(checkout, "dist"),
        temporaryOutputs[index],
        qualifiedPackageInput,
      );
      const evidence = join(
        dirname(artifact.manifest),
        "qualification-evidence.json",
      );
      await writeFile(evidence, evidenceBytes);
      artifacts.push({ ...artifact, evidence });
    }
    for (const key of ["zip", "manifest", "checksums", "evidence"])
      if (!(await bytesEqual(artifacts[0][key], artifacts[1][key])))
        throw new Error(`reproducibility mismatch: ${key}`);

    const releaseDir = resolve(outputDir, packageInput.version);
    await rm(releaseDir, { recursive: true, force: true });
    await mkdir(releaseDir, { recursive: true });
    const result = {};
    for (const key of ["zip", "manifest", "checksums", "evidence"]) {
      const destination = join(releaseDir, basename(artifacts[0][key]));
      await cp(artifacts[0][key], destination);
      if (!(await bytesEqual(artifacts[0][key], destination)))
        throw new Error(`copied artifact mismatch: ${key}`);
      result[key] = destination;
    }
    await verifyFinalReleaseArtifacts(result, qualifiedPackageInput);
    return result;
  } finally {
    for (const checkout of checkouts) {
      try {
        execFileSync("git", ["worktree", "remove", "--force", checkout], {
          cwd: repository,
          stdio: "ignore",
        });
      } catch {
        // A checkout may not exist when an earlier gate fails.
      }
    }
    await rm(root, { recursive: true, force: true });
  }
}
