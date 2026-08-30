import { describe, expect, it } from "vitest";
import {
  qualificationCommands,
  qualificationEvidenceBytes,
} from "../../scripts/release-pipeline.mjs";

describe("clean release qualification pipeline", () => {
  it("runs every required gate before packaging the real build", () => {
    expect(qualificationCommands()).toEqual([
      ["npm", ["ci"]],
      ["npm", ["run", "format:check"]],
      ["npm", ["run", "typecheck"]],
      ["npm", ["test"]],
      ["npm", ["run", "test:browser"]],
      ["npm", ["run", "build"]],
      ["npm", ["run", "test:release-artifact"]],
      ["npm", ["audit", "--audit-level=high"]],
      [
        "openspec",
        ["validate", "validate-tactical-battle-prototype", "--strict"],
      ],
      ["openspec", ["validate", "prepare-yandex-games-release", "--strict"]],
    ]);
  });

  it("serializes concrete successful gate evidence deterministically", () => {
    const input = {
      sourceCommit: "0123456789abcdef0123456789abcdef01234567",
      profile: "study-draft",
      commands: qualificationCommands(),
    };
    const first = qualificationEvidenceBytes(input);
    const second = qualificationEvidenceBytes(input);
    expect(first).toEqual(second);
    expect(JSON.parse(first.toString("utf8"))).toMatchObject({
      schemaVersion: 1,
      sourceCommit: input.sourceCommit,
      profile: input.profile,
      gates: expect.arrayContaining([
        {
          id: "security-audit",
          command: ["npm", "audit", "--audit-level=high"],
          status: "passed",
        },
        {
          id: "openspec-prepare-yandex-games-release",
          command: [
            "openspec",
            "validate",
            "prepare-yandex-games-release",
            "--strict",
          ],
          status: "passed",
        },
      ]),
    });
  });
});
