import { dispatch } from "./engine";
import { inBounds, positionKey } from "./grid";
import type { BattleCommand, BattleState, Position, Unit } from "./types";

export interface SurvivorBattleSummary {
  phase: BattleState["phase"];
  round: number;
  status: BattleState["status"];
  survivors: Array<Pick<Unit, "id" | "hp" | "maxHp" | "ap" | "ability" | "abilityUsed"> & { x: number; y: number }>;
  raiders: Array<Pick<Unit, "id" | "hp" | "maxHp"> & { x: number; y: number }>;
}

export interface SurvivorCandidateSummary {
  kind: BattleCommand["type"];
  unitId?: string;
  targetId?: string;
  to?: Position;
  apCost: number;
  tactical: string;
}

export interface SurvivorCommandCandidate {
  id: string;
  command: BattleCommand;
  summary: SurvivorCandidateSummary;
}

export interface SurvivorDecisionSet {
  battle: SurvivorBattleSummary;
  fingerprint: string;
  candidates: SurvivorCommandCandidate[];
}

const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
    .join(",")}}`;
};

const hash = (input: string): string => {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(16).padStart(8, "0");
};

const commandKey = (command: BattleCommand): string => canonical(command);

export function summarizeSurvivorBattle(state: BattleState): SurvivorBattleSummary {
  const compact = (unit: Unit) => ({
    id: unit.id,
    hp: unit.hp,
    maxHp: unit.maxHp,
    ap: unit.ap,
    ability: unit.ability,
    abilityUsed: unit.abilityUsed,
    x: unit.position.x,
    y: unit.position.y,
  });
  return {
    phase: state.phase,
    round: state.round,
    status: state.status,
    survivors: state.units
      .filter((unit) => unit.team === "survivor")
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(compact),
    raiders: state.units
      .filter((unit) => unit.team === "raider")
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((unit) => ({ id: unit.id, hp: unit.hp, maxHp: unit.maxHp, x: unit.position.x, y: unit.position.y })),
  };
}

export function decisionStateFingerprint(state: BattleState): string {
  return hash(canonical({
    map: state.map,
    phase: state.phase,
    round: state.round,
    status: state.status,
    units: state.units
      .map(({ id, team, position, hp, maxHp, ap, ability, abilityUsed }) => ({
        id, team, position, hp, maxHp, ap, ability, abilityUsed,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  }));
}

function candidateSummary(state: BattleState, command: BattleCommand): SurvivorCandidateSummary {
  if (command.type === "move") {
    const unit = state.units.find(({ id }) => id === command.unitId);
    const cost = unit ? Math.abs(unit.position.x - command.to.x) + Math.abs(unit.position.y - command.to.y) : 0;
    return { kind: command.type, unitId: command.unitId, to: command.to, apCost: cost, tactical: `move ${command.unitId} to ${positionKey(command.to)}` };
  }
  if (command.type === "end-player-phase") return { kind: command.type, apCost: 0, tactical: "end player phase" };
  const unit = state.units.find(({ id }) => id === command.unitId);
  const apCost = command.type === "attack" ? 3 : unit?.ability === "aimed-shot" ? 4 : unit?.ability === "burst" ? 5 : 3;
  return {
    kind: command.type,
    unitId: command.unitId,
    targetId: command.targetId,
    apCost,
    tactical: `${command.type} ${command.unitId} -> ${command.targetId}`,
  };
}

export function enumerateLegalSurvivorCommands(state: BattleState): SurvivorDecisionSet {
  if (state.status !== "active" || state.phase !== "player") {
    return { battle: summarizeSurvivorBattle(state), fingerprint: decisionStateFingerprint(state), candidates: [] };
  }
  const commands: BattleCommand[] = [];
  const survivors = state.units.filter((unit) => unit.team === "survivor").sort((a, b) => a.id.localeCompare(b.id));
  const targets = state.units.map((unit) => unit.id).sort();
  for (const unit of survivors) {
    for (let y = 0; y < state.map.height; y += 1) {
      for (let x = 0; x < state.map.width; x += 1) {
        const to = { x, y };
        if (!inBounds(state.map, to)) continue;
        commands.push({ type: "move", unitId: unit.id, to });
      }
    }
    for (const targetId of targets) commands.push({ type: "attack", unitId: unit.id, targetId });
    for (const targetId of targets) commands.push({ type: "ability", unitId: unit.id, targetId });
  }
  commands.push({ type: "end-player-phase" });
  const candidates = commands
    .filter((command) => dispatch(state, command).accepted)
    .sort((a, b) => commandKey(a).localeCompare(commandKey(b)))
    .map((command) => ({
      id: `sc-${hash(commandKey(command))}`,
      command,
      summary: candidateSummary(state, command),
    }));
  return { battle: summarizeSurvivorBattle(state), fingerprint: decisionStateFingerprint(state), candidates };
}

export function deterministicSurvivorFallback(
  candidates: readonly SurvivorCommandCandidate[],
  decisionsThisPhase = 0,
  actionCap = 12,
): SurvivorCommandCandidate {
  const end = candidates.find(({ command }) => command.type === "end-player-phase");
  if (!end) throw new Error("legal Survivor candidates must include end-player-phase");
  if (decisionsThisPhase >= actionCap) return end;
  const score = (candidate: SurvivorCommandCandidate): [number, string] => {
    const { command } = candidate;
    if (command.type === "attack") return [300, candidate.id];
    if (command.type === "ability" && candidate.summary.tactical.includes("aimed-shot")) return [290, candidate.id];
    if (command.type === "ability") return [200, candidate.id];
    if (command.type === "move") return [100, candidate.id];
    return [0, candidate.id];
  };
  return [...candidates].sort((a, b) => {
    const [scoreA, keyA] = score(a);
    const [scoreB, keyB] = score(b);
    return scoreB - scoreA || keyA.localeCompare(keyB);
  })[0] ?? end;
}
