import type { BattleCommand, BattleMap, BattleState, Unit } from "./types";

export const FROZEN_MAP: BattleMap = {
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
};

/** Acceptance sequence frozen in the battle specification. */
export const FROZEN_WINNING_COMMANDS: readonly BattleCommand[] = [
  { type: "ability", unitId: "survivor-scout", targetId: "raider-a" },
  { type: "move", unitId: "survivor-gunner", to: { x: 2, y: 3 } },
  { type: "attack", unitId: "survivor-gunner", targetId: "raider-b" },
  { type: "move", unitId: "survivor-medic", to: { x: 2, y: 4 } },
  { type: "attack", unitId: "survivor-medic", targetId: "raider-c" },
  { type: "end-player-phase" },
  { type: "attack", unitId: "survivor-scout", targetId: "raider-a" },
  { type: "ability", unitId: "survivor-gunner", targetId: "raider-b" },
  { type: "attack", unitId: "survivor-medic", targetId: "raider-c" },
];

const unit = (input: Omit<Unit, "ap" | "maxAp" | "abilityUsed">): Unit => ({
  ...input,
  ap: 6,
  maxAp: 6,
  abilityUsed: false,
});

export function createBattle(battleId: string): BattleState {
  return {
    battleId,
    map: structuredClone(FROZEN_MAP),
    phase: "player",
    round: 1,
    status: "active",
    units: [
      unit({
        id: "survivor-scout",
        nameKey: "unit.scout",
        team: "survivor",
        position: { x: 0, y: 1 },
        hp: 7,
        maxHp: 7,
        damage: 3,
        range: 5,
        ability: "aimed-shot",
      }),
      unit({
        id: "survivor-gunner",
        nameKey: "unit.gunner",
        team: "survivor",
        position: { x: 0, y: 3 },
        hp: 10,
        maxHp: 10,
        damage: 3,
        range: 4,
        ability: "burst",
      }),
      unit({
        id: "survivor-medic",
        nameKey: "unit.medic",
        team: "survivor",
        position: { x: 1, y: 4 },
        hp: 8,
        maxHp: 8,
        damage: 2,
        range: 4,
        ability: "medkit",
      }),
      unit({
        id: "raider-a",
        nameKey: "unit.raiderA",
        team: "raider",
        position: { x: 5, y: 1 },
        hp: 6,
        maxHp: 6,
        damage: 2,
        range: 4,
        ability: null,
      }),
      unit({
        id: "raider-b",
        nameKey: "unit.raiderB",
        team: "raider",
        position: { x: 6, y: 3 },
        hp: 6,
        maxHp: 6,
        damage: 2,
        range: 4,
        ability: null,
      }),
      unit({
        id: "raider-c",
        nameKey: "unit.raiderC",
        team: "raider",
        position: { x: 6, y: 4 },
        hp: 6,
        maxHp: 6,
        damage: 2,
        range: 4,
        ability: null,
      }),
    ],
  };
}
