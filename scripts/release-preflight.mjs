import { spawnSync } from "node:child_process";

export function validateReleaseInputs(input) {
  const errors = [];
  if (input.gitStatus.trim()) errors.push("source tree is dirty");
  if (!/^[0-9a-f]{40}$/i.test(input.sourceCommit))
    errors.push("source commit is missing");
  if (input.profile !== "study-draft" && input.profile !== "catalog-release")
    errors.push("release profile is unknown");
  if (input.profile === "catalog-release")
    errors.push("catalog-release prerequisites are incomplete");
  const requiredManifest = ["version", "profile", "sourceCommit", "buildTime"];
  if (!input.manifest || requiredManifest.some((key) => !input.manifest[key]))
    errors.push("release manifest is incomplete");
  return errors;
}

export function validateLockfileIntegrity(repository, run = spawnSync) {
  const result = run("npm", ["ci", "--ignore-scripts"], {
    cwd: repository,
    encoding: "utf8",
  });
  if (result.status === 0) return [];
  const detail = String(
    result.stderr || result.stdout || `exit ${result.status}`,
  )
    .trim()
    .replace(/\s+/g, " ");
  return [`lockfile npm ci failed: ${detail}`];
}
