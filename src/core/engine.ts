import {
  hasLineOfSight,
  inBounds,
  isHalfCover,
  isWall,
  manhattan,
  reachableCells,
  shortestPath,
} from "./grid";
import type {
  BattleCommand,
  BattleEvent,
  BattleState,
  CommandResult,
  RejectionReason,
  Unit,
} from "./types";

const reject = (
  state: BattleState,
  reason: RejectionReason,
): CommandResult => ({ accepted: false, state, events: [], reason });
const clone = (state: BattleState): BattleState => structuredClone(state);

function findUnit(state: BattleState, id: string): Unit | undefined {
  return state.units.find((unit) => unit.id === id);
}

function finishIfTerminal(state: BattleState, events: BattleEvent[]): void {
  const survivors = state.units.some((unit) => unit.team === "survivor");
  const raiders = state.units.some((unit) => unit.team === "raider");
  if (survivors && raiders) return;
  state.status = raiders ? "defeat" : "victory";
  events.push({
    type: "battle-finished",
    result: state.status,
    round: state.round,
  });
}

function damage(
  state: BattleState,
  source: Unit,
  target: Unit,
  rawDamage: number,
  ignoresCover: boolean,
  events: BattleEvent[],
): void {
  const coverMitigated =
    !ignoresCover && isHalfCover(state.map, target.position);
  const amount = Math.max(1, rawDamage - (coverMitigated ? 1 : 0));
  target.hp = Math.max(0, target.hp - amount);
  events.push({
    type: "unit-damaged",
    sourceId: source.id,
    targetId: target.id,
    amount,
    coverMitigated,
  });
  if (target.hp === 0) {
    state.units = state.units.filter((unit) => unit.id !== target.id);
    events.push({ type: "unit-defeated", unitId: target.id });
    finishIfTerminal(state, events);
  }
}

function validatePlayerUnit(
  state: BattleState,
  unitId: string,
): RejectionReason | Unit {
  const unit = findUnit(state, unitId);
  if (!unit) return "unit-not-found";
  if (unit.team !== "survivor") return "not-player-unit";
  return unit;
}

function move(
  state: BattleState,
  unitId: string,
  to: { x: number; y: number },
): CommandResult {
  const checked = validatePlayerUnit(state, unitId);
  if (typeof checked === "string") return reject(state, checked);
  if (!inBounds(state.map, to)) return reject(state, "out-of-bounds");
  if (
    isWall(state.map, to) ||
    state.units.some(
      (unit) => unit.position.x === to.x && unit.position.y === to.y,
    )
  )
    return reject(state, "blocked");
  const path = shortestPath(state, checked.position, to, checked.id);
  if (!path) return reject(state, "blocked");
  const cost = path.length - 1;
  if (cost > checked.ap) return reject(state, "insufficient-ap");
  const next = clone(state);
  const moving = findUnit(next, unitId);
  if (!moving) return reject(state, "unit-not-found");
  const from = { ...moving.position };
  moving.position = { ...to };
  moving.ap -= cost;
  return {
    accepted: true,
    state: next,
    events: [
      { type: "unit-moved", unitId, from, to: { ...to }, path, apSpent: cost },
    ],
  };
}

function attack(
  state: BattleState,
  unitId: string,
  targetId: string,
): CommandResult {
  const checked = validatePlayerUnit(state, unitId);
  if (typeof checked === "string") return reject(state, checked);
  const target = findUnit(state, targetId);
  if (!target) return reject(state, "target-not-found");
  if (target.team !== "raider") return reject(state, "not-enemy");
  if (checked.ap < 3) return reject(state, "insufficient-ap");
  if (manhattan(checked.position, target.position) > checked.range)
    return reject(state, "out-of-range");
  if (!hasLineOfSight(state.map, checked.position, target.position))
    return reject(state, "line-of-sight-blocked");
  const next = clone(state);
  const sourceNext = findUnit(next, unitId);
  const targetNext = findUnit(next, targetId);
  if (!sourceNext || !targetNext) return reject(state, "invalid-command");
  sourceNext.ap -= 3;
  const events: BattleEvent[] = [];
  damage(next, sourceNext, targetNext, sourceNext.damage, false, events);
  return { accepted: true, state: next, events };
}

function ability(
  state: BattleState,
  unitId: string,
  targetId: string,
): CommandResult {
  const checked = validatePlayerUnit(state, unitId);
  if (typeof checked === "string") return reject(state, checked);
  if (!checked.ability || checked.abilityUsed)
    return reject(state, "ability-unavailable");
  const target = findUnit(state, targetId);
  if (!target) return reject(state, "target-not-found");
  const costs = { "aimed-shot": 4, burst: 5, medkit: 3 } as const;
  const cost = costs[checked.ability];
  if (checked.ap < cost) return reject(state, "insufficient-ap");
  const isMedkit = checked.ability === "medkit";
  if (isMedkit) {
    if (target.team !== "survivor") return reject(state, "not-ally");
    if (manhattan(checked.position, target.position) > 3)
      return reject(state, "out-of-range");
    if (target.hp >= target.maxHp) return reject(state, "target-full-health");
  } else {
    if (target.team !== "raider") return reject(state, "not-enemy");
    if (manhattan(checked.position, target.position) > checked.range)
      return reject(state, "out-of-range");
    if (!hasLineOfSight(state.map, checked.position, target.position))
      return reject(state, "line-of-sight-blocked");
  }
  const next = clone(state);
  const sourceNext = findUnit(next, unitId);
  const targetNext = findUnit(next, targetId);
  if (!sourceNext || !targetNext || !sourceNext.ability)
    return reject(state, "invalid-command");
  sourceNext.ap -= cost;
  sourceNext.abilityUsed = true;
  const events: BattleEvent[] = [
    { type: "ability-used", unitId, ability: sourceNext.ability },
  ];
  if (sourceNext.ability === "medkit") {
    const amount = Math.min(4, targetNext.maxHp - targetNext.hp);
    targetNext.hp += amount;
    events.push({
      type: "unit-healed",
      sourceId: sourceNext.id,
      targetId: targetNext.id,
      amount,
    });
  } else if (sourceNext.ability === "aimed-shot") {
    damage(next, sourceNext, targetNext, 4, true, events);
  } else {
    const affectedIds = next.units
      .filter(
        (candidate) =>
          candidate.team === "raider" &&
          (candidate.id === targetId ||
            manhattan(candidate.position, targetNext.position) === 1),
      )
      .map(({ id }) => id);
    for (const affectedId of affectedIds) {
      const affected = findUnit(next, affectedId);
      if (affected) damage(next, sourceNext, affected, 3, false, events);
      if (next.status !== "active") break;
    }
  }
  return { accepted: true, state: next, events };
}

function legalEnemyTargets(state: BattleState, raider: Unit): Unit[] {
  return state.units
    .filter(
      (candidate) =>
        candidate.team === "survivor" &&
        manhattan(raider.position, candidate.position) <= raider.range &&
        hasLineOfSight(state.map, raider.position, candidate.position),
    )
    .sort((a, b) => {
      const lethalA =
        a.hp <=
        Math.max(
          1,
          raider.damage - (isHalfCover(state.map, a.position) ? 1 : 0),
        );
      const lethalB =
        b.hp <=
        Math.max(
          1,
          raider.damage - (isHalfCover(state.map, b.position) ? 1 : 0),
        );
      if (lethalA !== lethalB) return lethalA ? -1 : 1;
      return (
        a.hp - b.hp ||
        manhattan(raider.position, a.position) -
          manhattan(raider.position, b.position) ||
        a.id.localeCompare(b.id)
      );
    });
}

function distanceToAttack(
  state: BattleState,
  position: { x: number; y: number },
  range: number,
): number {
  const survivors = state.units.filter((unit) => unit.team === "survivor");
  const attackPositions: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < state.map.height; y += 1) {
    for (let x = 0; x < state.map.width; x += 1) {
      const candidate = { x, y };
      const occupiedBySurvivor = survivors.some(
        (unit) => unit.position.x === x && unit.position.y === y,
      );
      if (isWall(state.map, candidate) || occupiedBySurvivor) continue;
      if (
        survivors.some(
          (target) =>
            manhattan(candidate, target.position) <= range &&
            hasLineOfSight(state.map, candidate, target.position),
        )
      )
        attackPositions.push(candidate);
    }
  }
  return attackPositions.length === 0
    ? Number.POSITIVE_INFINITY
    : Math.min(
        ...attackPositions.map((candidate) => manhattan(position, candidate)),
      );
}

export function runEnemyPhase(input: BattleState): {
  state: BattleState;
  events: BattleEvent[];
} {
  const state = clone(input);
  const events: BattleEvent[] = [];
  state.phase = "enemy";
  state.units
    .filter((unit) => unit.team === "survivor")
    .forEach((unit) => {
      unit.ap = 0;
    });
  state.units
    .filter((unit) => unit.team === "raider")
    .forEach((unit) => {
      unit.ap = unit.maxAp;
    });
  events.push({ type: "phase-changed", phase: "enemy", round: state.round });
  const raiderIds = state.units
    .filter((unit) => unit.team === "raider")
    .map(({ id }) => id)
    .sort();
  for (const raiderId of raiderIds) {
    let moved = false;
    while (state.status === "active") {
      const raider = findUnit(state, raiderId);
      if (!raider) break;
      const targets = raider.ap >= 3 ? legalEnemyTargets(state, raider) : [];
      const target = targets[0];
      if (target) {
        raider.ap -= 3;
        damage(state, raider, target, raider.damage, false, events);
        continue;
      }
      if (moved || raider.ap <= 0) break;
      const destinations = reachableCells(state, raider.id)
        .map((position) => {
          const path = shortestPath(
            state,
            raider.position,
            position,
            raider.id,
          );
          return {
            position,
            path,
            distanceToAttack: distanceToAttack(state, position, raider.range),
          };
        })
        .filter(
          (
            candidate,
          ): candidate is {
            position: { x: number; y: number };
            path: { x: number; y: number }[];
            distanceToAttack: number;
          } => candidate.path !== null,
        )
        .sort(
          (a, b) =>
            a.distanceToAttack - b.distanceToAttack ||
            a.path.length - b.path.length ||
            a.position.y - b.position.y ||
            a.position.x - b.position.x,
        );
      const destination = destinations[0];
      if (!destination || !Number.isFinite(destination.distanceToAttack)) break;
      const from = { ...raider.position };
      const cost = destination.path.length - 1;
      raider.position = { ...destination.position };
      raider.ap -= cost;
      moved = true;
      events.push({
        type: "unit-moved",
        unitId: raider.id,
        from,
        to: { ...raider.position },
        path: destination.path,
        apSpent: cost,
      });
    }
    if (state.status !== "active") break;
  }
  if (state.status === "active") {
    if (state.round >= 8) {
      state.status = "defeat";
      events.push({
        type: "battle-finished",
        result: "defeat",
        round: state.round,
      });
    } else {
      state.round += 1;
      state.phase = "player";
      state.units
        .filter((unit) => unit.team === "survivor")
        .forEach((unit) => {
          unit.ap = unit.maxAp;
        });
      events.push({
        type: "phase-changed",
        phase: "player",
        round: state.round,
      });
    }
  }
  return { state, events };
}

export function dispatch(
  state: BattleState,
  command: BattleCommand,
): CommandResult {
  if (state.status !== "active") return reject(state, "battle-complete");
  if (state.phase !== "player") return reject(state, "wrong-phase");
  switch (command.type) {
    case "move":
      return move(state, command.unitId, command.to);
    case "attack":
      return attack(state, command.unitId, command.targetId);
    case "ability":
      return ability(state, command.unitId, command.targetId);
    case "end-player-phase": {
      const resolved = runEnemyPhase(state);
      return { accepted: true, state: resolved.state, events: resolved.events };
    }
  }
}
