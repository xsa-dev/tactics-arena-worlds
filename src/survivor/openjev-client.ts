import type { BattleState } from "../core/types";
import {
  normalizeBattleSummary,
  normalizeResponse,
  type CandidateSummary,
  type SurvivorDecision,
  type SurvivorDecisionRequest,
  type SurvivorPolicy,
  type SurvivorPolicyConfig,
} from "./policy";

export interface OpenJevClientOptions {
  fetchImpl?: typeof fetch;
  endpoint?: string;
  timeoutMs?: number;
}

const endpointPath = "/v1/openjev/choose";

export class OpenJevSurvivorPolicy implements SurvivorPolicy {
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;
  private readonly timeoutMs: number;

  constructor(options: OpenJevClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.endpoint = options.endpoint ?? endpointPath;
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  async choose(
    state: BattleState,
    candidates: readonly CandidateSummary[],
    signal?: AbortSignal,
  ): Promise<SurvivorDecision> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort("timeout"),
      this.timeoutMs,
    );
    const onAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", onAbort, { once: true });
    const request: SurvivorDecisionRequest = {
      contractVersion: "v1",
      state: normalizeBattleSummary(state),
      stateFingerprint: fingerprint(state),
      candidates: [...candidates],
    };
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`proxy status ${response.status}`);
      const normalized = normalizeResponse(await response.json());
      if (!normalized.ok) throw new Error(normalized.code);
      if (
        !candidates.some((candidate) => candidate.id === normalized.candidateId)
      )
        throw new Error("unknown-candidate");
      return { candidateId: normalized.candidateId, source: "openjev" };
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  }
}

export const fingerprint = (state: BattleState): string =>
  JSON.stringify({
    battleId: state.battleId,
    phase: state.phase,
    round: state.round,
    status: state.status,
    units: state.units.map(({ id, team, position, hp, ap, abilityUsed }) => ({
      id,
      team,
      position,
      hp,
      ap,
      abilityUsed,
    })),
  });

export const openJevConfig = (
  config: SurvivorPolicyConfig,
): OpenJevClientOptions => ({
  endpoint: config.proxyUrl,
  timeoutMs: config.timeoutMs,
});
