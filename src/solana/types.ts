import type { BattleCommand } from "../core/types";
import type { SessionControlMode } from "../platform/battle-session";

export interface SolanaSigner {
  readonly address: string;
  readonly publicKey: Uint8Array;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

export interface WalletAdapterLike {
  readonly name?: string;
  connect(): Promise<SolanaSigner>;
}

export interface SeekerVerifier {
  verifySeekerGenesisToken(walletAddress: string): Promise<string[]>;
}

export interface BattleProofPayloadV1 {
  readonly schema: "tactics-arena.battle-proof.v1";
  readonly manifestVersion: string;
  readonly scenarioFreezeId: string;
  readonly battleId: string;
  readonly controlMode: SessionControlMode;
  readonly result: "victory" | "defeat";
  readonly rounds: number;
  readonly activeDurationMs: number;
  readonly initialStateFingerprint: string;
  readonly terminalStateFingerprint: string;
  readonly commandsDigest: string;
  readonly walletAddress: string;
  readonly seekerGenesisMint: string | null;
  readonly issuedAt: string;
}

export interface UnsignedBattleProofV1 {
  readonly payload: Omit<
    BattleProofPayloadV1,
    "walletAddress" | "seekerGenesisMint" | "issuedAt"
  >;
  readonly acceptedCommands: readonly BattleCommand[];
}

export interface SignedBattleProofV1 {
  readonly payload: BattleProofPayloadV1;
  readonly acceptedCommands: readonly BattleCommand[];
  readonly message: string;
  readonly signature: string;
}

export type ProofRejectionReason =
  | "signature_mismatch"
  | "digest_mismatch"
  | "replay_mismatch"
  | "sgt_ownership_mismatch";

export type SgtVerificationStatus = "verified" | "unverified_offline" | "none";

export interface ProofVerificationResult {
  readonly valid: boolean;
  readonly reason?: ProofRejectionReason;
  readonly sgtStatus: SgtVerificationStatus;
}
