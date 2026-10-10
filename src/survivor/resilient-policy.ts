import type { BattleState } from "../core/types";
import type {
  CandidateSummary,
  FallbackReason,
  SurvivorDecision,
  SurvivorPolicy,
} from "./policy";

export class DeterministicSurvivorPolicy implements SurvivorPolicy {
  async choose(
    _state: BattleState,
    candidates: readonly CandidateSummary[],
  ): Promise<SurvivorDecision> {
    const selected = [...candidates].sort(
      (a, b) => score(b) - score(a) || a.id.localeCompare(b.id),
    )[0];
    if (!selected) throw new Error("no-candidates");
    return { candidateId: selected.id, source: "fallback" };
  }
}

const score = (candidate: CandidateSummary): number => {
  if (candidate.kind === "end-player-phase") return -10_000;
  if (candidate.kind === "ability") return 300;
  if (candidate.kind === "attack") return 200;
  if (candidate.kind === "move") return 10;
  return 0;
};

export class ResilientSurvivorPolicy implements SurvivorPolicy {
  constructor(
    private readonly primary: SurvivorPolicy | null,
    private readonly fallback: SurvivorPolicy = new DeterministicSurvivorPolicy(),
  ) {}

  async choose(
    state: BattleState,
    candidates: readonly CandidateSummary[],
    signal?: AbortSignal,
  ): Promise<SurvivorDecision> {
    if (!this.primary)
      return this.fallbackDecision(state, candidates, "not-configured", signal);
    try {
      const decision = await this.primary.choose(state, candidates, signal);
      if (
        !candidates.some((candidate) => candidate.id === decision.candidateId)
      )
        return this.fallbackDecision(
          state,
          candidates,
          "unknown-candidate",
          signal,
        );
      return decision;
    } catch (error) {
      const reason = classifyFailure(error);
      return this.fallbackDecision(state, candidates, reason, signal);
    }
  }

  private async fallbackDecision(
    state: BattleState,
    candidates: readonly CandidateSummary[],
    reason: FallbackReason,
    signal?: AbortSignal,
  ): Promise<SurvivorDecision> {
    const decision = await this.fallback.choose(state, candidates, signal);
    return { ...decision, source: "fallback", fallbackReason: reason };
  }
}

const classifyFailure = (error: unknown): FallbackReason => {
  const message = error instanceof Error ? error.message : "";
  if (
    message.includes("timeout") ||
    (error instanceof DOMException && error.name === "AbortError")
  )
    return "timeout";
  if (message.includes("unknown-candidate")) return "unknown-candidate";
  if (message.includes("malformed")) return "malformed-response";
  if (message.includes("status")) return "non-success";
  return "transport-failure";
};
