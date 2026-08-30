import type { BattleMap, BattleState, Position } from "./types";

const NEIGHBORS: readonly Position[] = [
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
];

export const positionKey = ({ x, y }: Position): string => `${x},${y}`;
export const samePosition = (a: Position, b: Position): boolean =>
  a.x === b.x && a.y === b.y;
export const inBounds = (map: BattleMap, p: Position): boolean =>
  p.x >= 0 && p.x < map.width && p.y >= 0 && p.y < map.height;
export const manhattan = (a: Position, b: Position): number =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const isWall = (map: BattleMap, p: Position): boolean =>
  map.walls.some((wall) => samePosition(wall, p));
export const isHalfCover = (map: BattleMap, p: Position): boolean =>
  map.halfCover.some((cover) => samePosition(cover, p));

function isOccupied(
  state: BattleState,
  p: Position,
  movingUnitId: string,
): boolean {
  return state.units.some(
    (unit) => unit.id !== movingUnitId && samePosition(unit.position, p),
  );
}

export function shortestPath(
  state: BattleState,
  from: Position,
  to: Position,
  movingUnitId: string,
): Position[] | null {
  if (
    !inBounds(state.map, to) ||
    isWall(state.map, to) ||
    isOccupied(state, to, movingUnitId)
  )
    return null;
  const queue: Position[][] = [[from]];
  const visited = new Set([positionKey(from)]);
  while (queue.length > 0) {
    const path = queue.shift();
    if (!path) break;
    const current = path[path.length - 1];
    if (!current) continue;
    if (samePosition(current, to)) return path;
    for (const delta of NEIGHBORS) {
      const next = { x: current.x + delta.x, y: current.y + delta.y };
      const key = positionKey(next);
      if (
        visited.has(key) ||
        !inBounds(state.map, next) ||
        isWall(state.map, next) ||
        isOccupied(state, next, movingUnitId)
      )
        continue;
      visited.add(key);
      queue.push([...path, next]);
    }
  }
  return null;
}

export function reachableCells(
  state: BattleState,
  unitId: string,
  ap?: number,
): Position[] {
  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (!unit) return [];
  const budget = ap ?? unit.ap;
  const result: Position[] = [];
  const queue: Array<{ position: Position; distance: number }> = [
    { position: unit.position, distance: 0 },
  ];
  const visited = new Set([positionKey(unit.position)]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.distance >= budget) continue;
    for (const delta of NEIGHBORS) {
      const next = {
        x: current.position.x + delta.x,
        y: current.position.y + delta.y,
      };
      const key = positionKey(next);
      if (
        visited.has(key) ||
        !inBounds(state.map, next) ||
        isWall(state.map, next) ||
        isOccupied(state, next, unitId)
      )
        continue;
      visited.add(key);
      result.push(next);
      queue.push({ position: next, distance: current.distance + 1 });
    }
  }
  return result;
}

export function hasLineOfSight(
  map: BattleMap,
  from: Position,
  to: Position,
): boolean {
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let error = dx - dy;
  while (!(x === to.x && y === to.y)) {
    const twice = error * 2;
    if (twice > -dy) {
      error -= dy;
      x += sx;
    }
    if (twice < dx) {
      error += dx;
      y += sy;
    }
    if (!(x === to.x && y === to.y) && isWall(map, { x, y })) return false;
  }
  return true;
}
