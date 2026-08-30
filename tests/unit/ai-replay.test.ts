import { describe, expect, it } from "vitest";
import { dispatch, runEnemyPhase } from "../../src/core/engine";
import { createBattle, FROZEN_WINNING_COMMANDS } from "../../src/core/scenario";
import type { BattleCommand, BattleState } from "../../src/core/types";

function accepted(state: BattleState, command: BattleCommand): BattleState {
  const result = dispatch(state, command);
  expect(result.accepted).toBe(true);
  return result.state;
}

function unit(state: BattleState, id: string) {
  const found = state.units.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

describe("deterministic Raider phase and replay", () => {
  it("moves once, reevaluates, selects targets deterministically and may attack twice", () => {
    let state = createBattle("ai");
    for (const command of FROZEN_WINNING_COMMANDS.slice(0, 5))
      state = accepted(state, command);
    const result = dispatch(state, { type: "end-player-phase" });
    expect(result.accepted).toBe(true);
    expect(result.events.map((event) => event.type)).toEqual([
      "phase-changed",
      "unit-moved",
      "unit-damaged",
      "unit-damaged",
      "unit-damaged",
      "unit-damaged",
      "unit-damaged",
      "phase-changed",
    ]);
    expect(unit(result.state, "raider-a")).toMatchObject({
      position: { x: 4, y: 1 },
      ap: 2,
    });
    expect(unit(result.state, "survivor-scout").hp).toBe(5);
    expect(unit(result.state, "survivor-gunner").hp).toBe(8);
    expect(unit(result.state, "survivor-medic").hp).toBe(4);
    expect(result.state).toMatchObject({ phase: "player", round: 2 });
  });

  it("prioritizes lethal targets and interrupts the phase on terminal defeat", () => {
    const state = createBattle("lethal");
    state.units = state.units.filter(
      ({ id }) => id === "survivor-scout" || id.startsWith("raider"),
    );
    unit(state, "survivor-scout").position = { x: 1, y: 1 };
    unit(state, "survivor-scout").hp = 1;
    unit(state, "raider-a").position = { x: 4, y: 1 };
    const result = runEnemyPhase(state);
    expect(result.state.status).toBe("defeat");
    expect(
      result.events.filter((event) => event.type === "unit-damaged"),
    ).toHaveLength(1);
    expect(result.events.at(-1)).toMatchObject({
      type: "battle-finished",
      result: "defeat",
    });
  });

  it("ends activation when no path exists and enforces defeat after enemy round 8", () => {
    const trapped = createBattle("trapped");
    trapped.units = trapped.units.filter(
      ({ id }) => id === "survivor-scout" || id === "raider-a",
    );
    unit(trapped, "raider-a").position = { x: 7, y: 5 };
    trapped.map.walls.push({ x: 6, y: 5 }, { x: 7, y: 4 });
    const noPath = runEnemyPhase(trapped);
    expect(unit(noPath.state, "raider-a").position).toEqual({ x: 7, y: 5 });

    const limit = createBattle("limit");
    limit.round = 8;
    limit.units
      .filter(({ team }) => team === "raider")
      .forEach((raider) => {
        raider.ap = 0;
      });
    const ended = runEnemyPhase(limit);
    expect(ended.state).toMatchObject({ round: 8, status: "defeat" });
    expect(ended.events.at(-1)).toMatchObject({
      type: "battle-finished",
      result: "defeat",
    });
  });

  it("replays identically and the documented path wins in player phase of round 2", () => {
    const play = (id: string) => {
      let state = createBattle(id);
      const eventTypes: string[] = [];
      for (const command of FROZEN_WINNING_COMMANDS) {
        const result = dispatch(state, command);
        expect(result.accepted).toBe(true);
        state = result.state;
        eventTypes.push(...result.events.map((event) => event.type));
      }
      return { state: { ...state, battleId: "<stable>" }, eventTypes };
    };
    expect(play("one")).toEqual(play("two"));
    expect(play("win").state).toMatchObject({
      status: "victory",
      round: 2,
      units: expect.not.arrayContaining([
        expect.objectContaining({ team: "raider" }),
      ]),
    });
    expect(
      dispatch(play("done").state, { type: "end-player-phase" }),
    ).toMatchObject({ accepted: false, reason: "battle-complete" });
  });
});
