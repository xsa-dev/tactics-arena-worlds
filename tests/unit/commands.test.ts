import { describe, expect, it } from "vitest";
import { dispatch } from "../../src/core/engine";
import { createBattle } from "../../src/core/scenario";
import type { BattleState, Unit } from "../../src/core/types";

const unit = (state: BattleState, id: string): Unit => {
  const found = state.units.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};

describe("pure player commands", () => {
  it("moves along the resolved path and rejects invalid movement without mutation", () => {
    const initial = createBattle("commands");
    const moved = dispatch(initial, {
      type: "move",
      unitId: "survivor-gunner",
      to: { x: 2, y: 3 },
    });
    expect(moved.accepted).toBe(true);
    expect(unit(moved.state, "survivor-gunner")).toMatchObject({
      position: { x: 2, y: 3 },
      ap: 4,
    });
    const rejected = dispatch(moved.state, {
      type: "move",
      unitId: "survivor-gunner",
      to: { x: 7, y: 0 },
    });
    expect(rejected).toMatchObject({
      accepted: false,
      reason: "insufficient-ap",
    });
    expect(rejected.state).toEqual(moved.state);
  });

  it("resolves normal attacks, half-cover, line of sight and immediate defeat removal", () => {
    const initial = createBattle("combat");
    const covered = dispatch(initial, {
      type: "attack",
      unitId: "survivor-scout",
      targetId: "raider-a",
    });
    expect(covered.accepted).toBe(true);
    expect(unit(covered.state, "raider-a").hp).toBe(4);
    expect(unit(covered.state, "survivor-scout").ap).toBe(3);

    const lethalSetup = structuredClone(covered.state);
    unit(lethalSetup, "raider-a").hp = 2;
    const lethal = dispatch(lethalSetup, {
      type: "attack",
      unitId: "survivor-scout",
      targetId: "raider-a",
    });
    expect(lethal.state.units.some(({ id }) => id === "raider-a")).toBe(false);

    const blockedSetup = createBattle("blocked");
    unit(blockedSetup, "survivor-scout").position = { x: 2, y: 2 };
    unit(blockedSetup, "raider-b").position = { x: 5, y: 2 };
    expect(
      dispatch(blockedSetup, {
        type: "attack",
        unitId: "survivor-scout",
        targetId: "raider-b",
      }),
    ).toMatchObject({ accepted: false, reason: "line-of-sight-blocked" });
  });

  it("implements each once-per-battle ability with exact AP, range and effects", () => {
    const aimed = dispatch(createBattle("aimed"), {
      type: "ability",
      unitId: "survivor-scout",
      targetId: "raider-a",
    });
    expect(aimed.accepted).toBe(true);
    expect(unit(aimed.state, "raider-a").hp).toBe(2);
    expect(unit(aimed.state, "survivor-scout")).toMatchObject({
      ap: 2,
      abilityUsed: true,
    });
    expect(
      dispatch(aimed.state, {
        type: "ability",
        unitId: "survivor-scout",
        targetId: "raider-a",
      }),
    ).toMatchObject({ accepted: false, reason: "ability-unavailable" });

    const burstSetup = createBattle("burst");
    unit(burstSetup, "survivor-gunner").position = { x: 2, y: 3 };
    const burst = dispatch(burstSetup, {
      type: "ability",
      unitId: "survivor-gunner",
      targetId: "raider-b",
    });
    expect(unit(burst.state, "raider-b").hp).toBe(3);
    expect(unit(burst.state, "raider-c").hp).toBe(3);
    expect(unit(burst.state, "survivor-gunner")).toMatchObject({
      ap: 1,
      abilityUsed: true,
    });

    const medkitSetup = createBattle("medkit");
    unit(medkitSetup, "survivor-gunner").hp = 8;
    const healed = dispatch(medkitSetup, {
      type: "ability",
      unitId: "survivor-medic",
      targetId: "survivor-gunner",
    });
    expect(unit(healed.state, "survivor-gunner").hp).toBe(10);
    expect(unit(healed.state, "survivor-medic")).toMatchObject({
      ap: 3,
      abilityUsed: true,
    });
  });
});
