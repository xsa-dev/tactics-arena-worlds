import type { BattleCommand, BattleState, Position } from "../core/types";

export type SurvivorControlMode = "openjev" | "human";
export type DecisionSource = "openjev" | "fallback";
export type FallbackReason =
  | "not-configured"
  | "timeout"
  | "transport-failure"
  | "non-success"
  | "malformed-response"
  | "unknown-candidate"
  | "stale-response"
  | "dispatch-rejected";

export interface SurvivorPolicyConfig {
  mode: SurvivorControlMode;
  proxyUrl: string;
  timeoutMs: number;
  maxActionsPerPhase: number;
}

export interface CandidateSummary {
  id: string;
  command: BattleCommand;
  kind: BattleCommand["type"];
  actorId?: string;
  targetId?: string;
  to?: Position;
}

export interface SurvivorBattleSummary {
  battleId: string;
  phase: BattleState["phase"];
  round: number;
  status: BattleState["status"];
  survivors: Array<
    Pick<
      BattleState["units"][number],
      "id" | "position" | "hp" | "maxHp" | "ap" | "ability"
    >
  >;
  raiders: Array<
    Pick<
      BattleState["units"][number],
      "id" | "position" | "hp" | "maxHp" | "range"
    >
  >;
}

export interface SurvivorDecisionRequest {
  contractVersion: "v1";
  state: SurvivorBattleSummary;
  stateFingerprint: string;
  candidates: CandidateSummary[];
}

export type NormalizedDecisionResponse =
  | {
      ok: true;
      candidateId: string;
    }
  | {
      ok: false;
      code:
        | "timeout"
        | "rate-limited"
        | "unauthorized"
        | "bad-request"
        | "malformed"
        | "unavailable";
      retryAfterMs?: number;
    };

export interface SurvivorDecision {
  candidateId: string;
  source: DecisionSource;
  fallbackReason?: FallbackReason;
}

export interface SurvivorPolicy {
  choose(
    state: BattleState,
    candidates: readonly CandidateSummary[],
    signal?: AbortSignal,
  ): Promise<SurvivorDecision>;
}

export const normalizeBattleSummary = (
  state: BattleState,
): SurvivorBattleSummary => ({
  battleId: state.battleId,
  phase: state.phase,
  round: state.round,
  status: state.status,
  survivors: state.units
    .filter((unit) => unit.team === "survivor")
    .map(({ id, position, hp, maxHp, ap, ability }) => ({
      id,
      position,
      hp,
      maxHp,
      ap,
      ability,
    })),
  raiders: state.units
    .filter((unit) => unit.team === "raider")
    .map(({ id, position, hp, maxHp, range }) => ({
      id,
      position,
      hp,
      maxHp,
      range,
    })),
});

export const normalizeResponse = (
  value: unknown,
): NormalizedDecisionResponse => {
  if (!value || typeof value !== "object")
    return { ok: false, code: "malformed" };
  const record = value as Record<string, unknown>;
  if (
    record.ok === true &&
    typeof record.candidateId === "string" &&
    record.candidateId.length <= 128
  )
    return { ok: true, candidateId: record.candidateId };
  if (
    record.ok === false &&
    typeof record.code === "string" &&
    [
      "timeout",
      "rate-limited",
      "unauthorized",
      "bad-request",
      "malformed",
      "unavailable",
    ].includes(record.code)
  ) {
    const code = record.code as Extract<
      NormalizedDecisionResponse,
      { ok: false }
    >["code"];
    const retryAfterMs =
      typeof record.retryAfterMs === "number" &&
      Number.isFinite(record.retryAfterMs)
        ? Math.max(0, Math.min(300_000, Math.floor(record.retryAfterMs)))
        : undefined;
    return retryAfterMs === undefined
      ? { ok: false, code }
      : { ok: false, code, retryAfterMs };
  }
  return { ok: false, code: "malformed" };
};
