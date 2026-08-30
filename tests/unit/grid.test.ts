import { describe, expect, it } from "vitest";
import { createBattle } from "../../src/core/scenario";
import {
  hasLineOfSight,
  manhattan,
  reachableCells,
  shortestPath,
} from "../../src/core/grid";

describe("deterministic grid rules", () => {
  it("uses bounds, occupancy and up/left/right/down shortest-path ties", () => {
    const state = createBattle("grid");
    expect(
      shortestPath(state, { x: 0, y: 1 }, { x: 2, y: 2 }, "survivor-scout"),
    ).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ]);
    expect(
      shortestPath(state, { x: 0, y: 1 }, { x: 3, y: 2 }, "survivor-scout"),
    ).toBeNull();
    expect(reachableCells(state, "survivor-scout", 1)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
    ]);
  });

  it("uses Manhattan range and wall-only Bresenham blocking", () => {
    const state = createBattle("los");
    expect(manhattan({ x: 0, y: 1 }, { x: 5, y: 1 })).toBe(5);
    expect(hasLineOfSight(state.map, { x: 0, y: 1 }, { x: 5, y: 1 })).toBe(
      true,
    );
    expect(hasLineOfSight(state.map, { x: 2, y: 2 }, { x: 5, y: 2 })).toBe(
      false,
    );
    expect(hasLineOfSight(state.map, { x: 2, y: 1 }, { x: 6, y: 1 })).toBe(
      true,
    );
  });
});
