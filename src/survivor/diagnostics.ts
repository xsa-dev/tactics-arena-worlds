import { dispatch } from "../core/engine";
import { createBattle } from "../core/scenario";
import { decisionStateFingerprint } from "../core/survivor-autoplay";
import type { BattleCommand, BattleEvent, BattleState } from "../core/types";
import { RELEASE_CONSTANTS } from "../release/config";
import { sha256Hex } from "../solana/battle-proof";
import type { DecisionSource, FallbackReason } from "./policy";

export type LatencyBucket =
  "0ms" | "<100ms" | "100-500ms" | "500-2000ms" | ">=2000ms";

export interface DecisionDiagnosticRecord {
  readonly battleId: string;
  readonly round: number;
  readonly stateFingerprint: string;
  readonly candidateId: string;
  readonly source: DecisionSource;
  readonly latencyBucket: LatencyBucket;
  readonly fallbackReason?: FallbackReason;
  readonly acceptedEventTypes: readonly BattleEvent["type"][];
}

export interface RecordedSurvivorDecision {
  readonly candidateId: string;
  readonly command: BattleCommand;
  readonly source: DecisionSource;
  readonly fallbackReason?: FallbackReason;
}

export interface AiReplayEnvelopeV1 {
  readonly schemaVersion: 1;
  readonly buildVersion: string;
  readonly scenarioFreezeId: string;
  readonly battleId: string;
  readonly initialStateHash: string;
  readonly decisions: readonly RecordedSurvivorDecision[];
  readonly terminalStatus: BattleState["status"];
  readonly terminalRound: number;
  readonly terminalStateHash: string;
  readonly eventChecksum: string;
}

export function latencyBucket(ms: number): LatencyBucket {
  if (ms <= 0) return "0ms";
  if (ms < 100) return "<100ms";
  if (ms < 500) return "100-500ms";
  if (ms < 2000) return "500-2000ms";
  return ">=2000ms";
}

const FORBIDDEN_DIAGNOSTIC_PATTERNS = [
  /oj_(?:live|test)_[A-Za-z0-9]+/i,
  /Bearer\s+[A-Za-z0-9._-]+/i,
  /"(?:authorization|apiKey|OPENJEV_API_KEY|reasoning|chainOfThought|rawError)"\s*:/i,
];

export function isRedactedDiagnostic(value: unknown): boolean {
  const serialized = JSON.stringify(value) ?? "";
  return !FORBIDDEN_DIAGNOSTIC_PATTERNS.some((pattern) =>
    pattern.test(serialized),
  );
}

export function assertRedactedDiagnostic(value: unknown): void {
  if (!isRedactedDiagnostic(value)) {
    throw new Error(
      "Unredacted credential or private reasoning in diagnostics",
    );
  }
}

export function createAiReplayEnvelope(input: {
  battleId: string;
  initialState: BattleState;
  terminalState: BattleState;
  decisions: readonly RecordedSurvivorDecision[];
  eventTypes: readonly BattleEvent["type"][];
}): AiReplayEnvelopeV1 {
  return {
    schemaVersion: 1,
    buildVersion: RELEASE_CONSTANTS.version,
    scenarioFreezeId: RELEASE_CONSTANTS.freezeIds.scenarioFreezeId,
    battleId: input.battleId,
    initialStateHash: sha256Hex(decisionStateFingerprint(input.initialState)),
    decisions: structuredClone(input.decisions),
    terminalStatus: input.terminalState.status,
    terminalRound: input.terminalState.round,
    terminalStateHash: sha256Hex(decisionStateFingerprint(input.terminalState)),
    eventChecksum: sha256Hex(JSON.stringify(input.eventTypes)),
  };
}

export function verifyAiReplayEnvelope(envelope: AiReplayEnvelopeV1): {
  valid: boolean;
  reason?: string;
  state?: BattleState;
} {
  if (
    envelope.schemaVersion !== 1 ||
    envelope.scenarioFreezeId !== RELEASE_CONSTANTS.freezeIds.scenarioFreezeId
  ) {
    return { valid: false, reason: "incompatible_envelope" };
  }
  let state = createBattle(envelope.battleId);
  if (
    sha256Hex(decisionStateFingerprint(state)) !== envelope.initialStateHash
  ) {
    return { valid: false, reason: "initial_state_mismatch" };
  }
  const eventTypes: BattleEvent["type"][] = [];
  for (const decision of envelope.decisions) {
    const result = dispatch(state, decision.command);
    if (!result.accepted) {
      return { valid: false, reason: "command_rejected" };
    }
    state = result.state;
    eventTypes.push(...result.events.map((event) => event.type));
  }
  if (
    state.status !== envelope.terminalStatus ||
    state.round !== envelope.terminalRound ||
    sha256Hex(decisionStateFingerprint(state)) !== envelope.terminalStateHash
  ) {
    return { valid: false, reason: "terminal_state_mismatch" };
  }
  if (sha256Hex(JSON.stringify(eventTypes)) !== envelope.eventChecksum) {
    return { valid: false, reason: "event_checksum_mismatch" };
  }
  return { valid: true, state };
}
