import { dispatch } from "../core/engine";
import { createBattle } from "../core/scenario";
import { decisionStateFingerprint } from "../core/survivor-autoplay";
import type { BattleCommand } from "../core/types";
import type { BattleSession } from "../platform/battle-session";
import { RELEASE_CONSTANTS } from "../release/config";
import type {
  BattleProofPayloadV1,
  ProofVerificationResult,
  SeekerVerifier,
  SignedBattleProofV1,
  SolanaSigner,
  UnsignedBattleProofV1,
} from "./types";

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  let zeroes = 0;
  while (zeroes < bytes.length && bytes[zeroes] === 0) zeroes += 1;
  const digits = [0];
  for (let i = zeroes; i < bytes.length; i += 1) {
    let carry = bytes[i]!;
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j]! << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let output = "1".repeat(zeroes);
  for (let i = digits.length - 1; i >= 0; i -= 1)
    output += BASE58_ALPHABET[digits[i]!]!;
  return output;
}

export function decodeBase58(input: string): Uint8Array | null {
  if (!input) return new Uint8Array(0);
  let zeroes = 0;
  while (zeroes < input.length && input[zeroes] === "1") zeroes += 1;
  const bytes = [0];
  for (let i = zeroes; i < input.length; i += 1) {
    const value = BASE58_ALPHABET.indexOf(input[i]!);
    if (value < 0) return null;
    let carry = value;
    for (let j = 0; j < bytes.length; j += 1) {
      carry += bytes[j]! * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const result = new Uint8Array(
    zeroes + (input.length === zeroes ? 0 : bytes.length),
  );
  for (let i = 0; i < result.length - zeroes; i += 1)
    result[zeroes + i] = bytes[bytes.length - 1 - i]!;
  return result;
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

export function sha256Hex(text: string): string {
  const raw = new TextEncoder().encode(text);
  const bitLen = raw.length * 8;
  const paddedLen = ((raw.length + 9 + 63) >> 6) << 6;
  const padded = new Uint8Array(paddedLen);
  padded.set(raw);
  padded[raw.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1)
      w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i += 1) {
      const s0 =
        rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i]! + w[i]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("");
}

function canonicalCommandJson(command: BattleCommand): string {
  if (command.type === "end-player-phase")
    return JSON.stringify({ type: "end-player-phase" });
  if (command.type === "move")
    return JSON.stringify({
      type: "move",
      unitId: command.unitId,
      to: { x: command.to.x, y: command.to.y },
    });
  return JSON.stringify({
    type: command.type,
    unitId: command.unitId,
    targetId: command.targetId,
  });
}

export function commandsDigest(commands: readonly BattleCommand[]): string {
  return sha256Hex(`[${commands.map(canonicalCommandJson).join(",")}]`);
}

export function canonicalProofMessage(payload: BattleProofPayloadV1): string {
  return JSON.stringify({
    schema: payload.schema,
    manifestVersion: payload.manifestVersion,
    scenarioFreezeId: payload.scenarioFreezeId,
    battleId: payload.battleId,
    controlMode: payload.controlMode,
    result: payload.result,
    rounds: payload.rounds,
    activeDurationMs: payload.activeDurationMs,
    initialStateFingerprint: payload.initialStateFingerprint,
    terminalStateFingerprint: payload.terminalStateFingerprint,
    commandsDigest: payload.commandsDigest,
    walletAddress: payload.walletAddress,
    seekerGenesisMint: payload.seekerGenesisMint,
    issuedAt: payload.issuedAt,
  });
}

export function createUnsignedBattleProof(
  session: BattleSession,
): UnsignedBattleProofV1 {
  const { state } = session;
  if (state.status !== "victory" && state.status !== "defeat")
    throw new Error("Cannot create battle proof before terminal result");
  const acceptedCommands = structuredClone(
    session.acceptedCommands,
  ) as BattleCommand[];
  return {
    payload: {
      schema: "tactics-arena.battle-proof.v1",
      manifestVersion: RELEASE_CONSTANTS.version,
      scenarioFreezeId: RELEASE_CONSTANTS.freezeIds.scenarioFreezeId,
      battleId: state.battleId,
      controlMode: session.controlMode,
      result: state.status,
      rounds: state.round,
      activeDurationMs: session.activeDuration(),
      initialStateFingerprint: session.initialStateFingerprint,
      terminalStateFingerprint: decisionStateFingerprint(state),
      commandsDigest: commandsDigest(acceptedCommands),
    },
    acceptedCommands,
  };
}

export async function signBattleProof(
  unsigned: UnsignedBattleProofV1,
  signer: SolanaSigner,
  options: { seekerGenesisMint?: string | null; issuedAt?: string } = {},
): Promise<SignedBattleProofV1> {
  const payload: BattleProofPayloadV1 = {
    ...unsigned.payload,
    walletAddress: signer.address,
    seekerGenesisMint: options.seekerGenesisMint ?? null,
    issuedAt: options.issuedAt ?? new Date().toISOString(),
  };
  const message = canonicalProofMessage(payload);
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = await signer.signMessage(messageBytes);
  return {
    payload,
    acceptedCommands: structuredClone(
      unsigned.acceptedCommands,
    ) as BattleCommand[],
    message,
    signature: encodeBase58(signatureBytes),
  };
}

export async function verifySignedBattleProof(
  proof: SignedBattleProofV1,
  options: { seekerVerifier?: SeekerVerifier } = {},
): Promise<ProofVerificationResult> {
  if (
    !proof?.payload ||
    proof.payload.schema !== "tactics-arena.battle-proof.v1"
  )
    return { valid: false, reason: "digest_mismatch", sgtStatus: "none" };

  const expectedMessage = canonicalProofMessage(proof.payload);
  if (
    proof.message !== expectedMessage ||
    commandsDigest(proof.acceptedCommands) !== proof.payload.commandsDigest
  )
    return { valid: false, reason: "digest_mismatch", sgtStatus: "none" };

  const publicKeyBytes = decodeBase58(proof.payload.walletAddress);
  const signatureBytes = decodeBase58(proof.signature);
  if (
    !publicKeyBytes ||
    publicKeyBytes.length !== 32 ||
    !signatureBytes ||
    signatureBytes.length !== 64
  )
    return { valid: false, reason: "signature_mismatch", sgtStatus: "none" };

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(publicKeyBytes),
      "Ed25519",
      false,
      ["verify"],
    );
    const verified = await crypto.subtle.verify(
      "Ed25519",
      key,
      new Uint8Array(signatureBytes),
      new TextEncoder().encode(expectedMessage),
    );
    if (!verified)
      return { valid: false, reason: "signature_mismatch", sgtStatus: "none" };
  } catch {
    return { valid: false, reason: "signature_mismatch", sgtStatus: "none" };
  }

  if (
    proof.payload.scenarioFreezeId !==
    RELEASE_CONSTANTS.freezeIds.scenarioFreezeId
  )
    return { valid: false, reason: "replay_mismatch", sgtStatus: "none" };

  let state = createBattle(proof.payload.battleId);
  if (decisionStateFingerprint(state) !== proof.payload.initialStateFingerprint)
    return { valid: false, reason: "replay_mismatch", sgtStatus: "none" };

  for (const command of proof.acceptedCommands) {
    const step = dispatch(state, command);
    if (!step.accepted)
      return { valid: false, reason: "replay_mismatch", sgtStatus: "none" };
    state = step.state;
  }

  if (
    state.status !== proof.payload.result ||
    state.round !== proof.payload.rounds ||
    decisionStateFingerprint(state) !== proof.payload.terminalStateFingerprint
  )
    return { valid: false, reason: "replay_mismatch", sgtStatus: "none" };

  if (!proof.payload.seekerGenesisMint)
    return { valid: true, sgtStatus: "none" };

  if (!options.seekerVerifier)
    return { valid: true, sgtStatus: "unverified_offline" };

  try {
    const mints = await options.seekerVerifier.verifySeekerGenesisToken(
      proof.payload.walletAddress,
    );
    if (!mints.includes(proof.payload.seekerGenesisMint))
      return {
        valid: false,
        reason: "sgt_ownership_mismatch",
        sgtStatus: "none",
      };
    return { valid: true, sgtStatus: "verified" };
  } catch {
    return { valid: true, sgtStatus: "unverified_offline" };
  }
}
