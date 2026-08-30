export type Team = "survivor" | "raider";
export type Phase = "player" | "enemy";
export type BattleStatus = "active" | "victory" | "defeat";
export type Terrain = "floor" | "half-cover" | "wall";
export type AbilityId = "aimed-shot" | "burst" | "medkit";

export interface Position {
  x: number;
  y: number;
}

export interface BattleMap {
  width: 8;
  height: 6;
  walls: Position[];
  halfCover: Position[];
}

export interface Unit {
  id: string;
  nameKey: string;
  team: Team;
  position: Position;
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: 6;
  damage: number;
  range: number;
  ability: AbilityId | null;
  abilityUsed: boolean;
}

export interface BattleState {
  battleId: string;
  map: BattleMap;
  units: Unit[];
  phase: Phase;
  round: number;
  status: BattleStatus;
}

export type BattleCommand =
  | { type: "move"; unitId: string; to: Position }
  | { type: "attack"; unitId: string; targetId: string }
  | { type: "ability"; unitId: string; targetId: string }
  | { type: "end-player-phase" };

export type BattleEvent =
  | {
      type: "unit-moved";
      unitId: string;
      from: Position;
      to: Position;
      path: Position[];
      apSpent: number;
    }
  | {
      type: "unit-damaged";
      sourceId: string;
      targetId: string;
      amount: number;
      coverMitigated: boolean;
    }
  | { type: "unit-healed"; sourceId: string; targetId: string; amount: number }
  | { type: "unit-defeated"; unitId: string }
  | { type: "ability-used"; unitId: string; ability: AbilityId }
  | { type: "phase-changed"; phase: Phase; round: number }
  | {
      type: "battle-finished";
      result: Exclude<BattleStatus, "active">;
      round: number;
    };

export type RejectionReason =
  | "battle-complete"
  | "wrong-phase"
  | "unit-not-found"
  | "not-player-unit"
  | "target-not-found"
  | "not-enemy"
  | "not-ally"
  | "blocked"
  | "out-of-bounds"
  | "out-of-range"
  | "line-of-sight-blocked"
  | "insufficient-ap"
  | "ability-unavailable"
  | "target-full-health"
  | "invalid-command";

export type CommandResult =
  | { accepted: true; state: BattleState; events: BattleEvent[] }
  | {
      accepted: false;
      state: BattleState;
      events: [];
      reason: RejectionReason;
    };
