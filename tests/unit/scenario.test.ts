import { describe, expect, it } from "vitest";
import { createBattle } from "../../src/core/scenario";

describe("frozen battle scenario", () => {
  it("creates the exact 8x6 arena and combatants", () => {
    const battle = createBattle("battle-test");
    expect(battle.map).toEqual({
      width: 8,
      height: 6,
      walls: [
        { x: 3, y: 2 },
        { x: 4, y: 2 },
      ],
      halfCover: [
        { x: 2, y: 1 },
        { x: 2, y: 3 },
        { x: 5, y: 1 },
        { x: 5, y: 3 },
      ],
    });
    expect(battle.phase).toBe("player");
    expect(battle.round).toBe(1);
    expect(battle.status).toBe("active");
    expect(
      battle.units.map(
        ({ id, position, hp, maxHp, ap, damage, range, ability }) => ({
          id,
          position,
          hp,
          maxHp,
          ap,
          damage,
          range,
          ability,
        }),
      ),
    ).toMatchInlineSnapshot(`
      [
        {
          "ability": "aimed-shot",
          "ap": 6,
          "damage": 3,
          "hp": 7,
          "id": "survivor-scout",
          "maxHp": 7,
          "position": {
            "x": 0,
            "y": 1,
          },
          "range": 5,
        },
        {
          "ability": "burst",
          "ap": 6,
          "damage": 3,
          "hp": 10,
          "id": "survivor-gunner",
          "maxHp": 10,
          "position": {
            "x": 0,
            "y": 3,
          },
          "range": 4,
        },
        {
          "ability": "medkit",
          "ap": 6,
          "damage": 2,
          "hp": 8,
          "id": "survivor-medic",
          "maxHp": 8,
          "position": {
            "x": 1,
            "y": 4,
          },
          "range": 4,
        },
        {
          "ability": null,
          "ap": 6,
          "damage": 2,
          "hp": 6,
          "id": "raider-a",
          "maxHp": 6,
          "position": {
            "x": 5,
            "y": 1,
          },
          "range": 4,
        },
        {
          "ability": null,
          "ap": 6,
          "damage": 2,
          "hp": 6,
          "id": "raider-b",
          "maxHp": 6,
          "position": {
            "x": 6,
            "y": 3,
          },
          "range": 4,
        },
        {
          "ability": null,
          "ap": 6,
          "damage": 2,
          "hp": 6,
          "id": "raider-c",
          "maxHp": 6,
          "position": {
            "x": 6,
            "y": 4,
          },
          "range": 4,
        },
      ]
    `);
  });
});
