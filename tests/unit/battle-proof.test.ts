import { describe, expect, it } from "vitest";
import { FROZEN_WINNING_COMMANDS } from "../../src/core/scenario";
import { LocalPlatformService } from "../../src/platform";
import { BattleSession } from "../../src/platform/battle-session";
import {
  canonicalProofMessage,
  commandsDigest,
  createUnsignedBattleProof,
  encodeBase58,
  signBattleProof,
  verifySignedBattleProof,
} from "../../src/solana/battle-proof";
import type { SolanaSigner } from "../../src/solana/types";

async function createTestEd25519Signer(): Promise<SolanaSigner> {
  const keyPair = (await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const rawPublic = new Uint8Array(
    await crypto.subtle.exportKey("raw", keyPair.publicKey),
  );
  return {
    address: encodeBase58(rawPublic),
    publicKey: rawPublic,
    async signMessage(message: Uint8Array): Promise<Uint8Array> {
      const sig = await crypto.subtle.sign(
        "Ed25519",
        keyPair.privateKey,
        new Uint8Array(message),
      );
      return new Uint8Array(sig);
    },
  };
}

function createCompletedVictorySession(): BattleSession {
  let time = 1000;
  const session = new BattleSession(
    new LocalPlatformService("en"),
    {
      sessionId: "session-proof-1",
      testerId: "tester-proof-1",
      manifestVersion: "0.1.0",
      releaseProfile: "solana-mobile",
      deviceClass: "mobile",
      inputType: "touch",
      viewport: "640x360",
      locale: "en",
    },
    "battle-proof-1",
    () => time,
  );
  session.start();
  for (const command of FROZEN_WINNING_COMMANDS) {
    time += 500;
    expect(session.execute(command, "human").accepted).toBe(true);
  }
  expect(session.state.status).toBe("victory");
  return session;
}

describe("SignedBattleProofV1 creation and verification", () => {
  it("creates, signs, and verifies a completed victory proof from committed BattleSession state", async () => {
    const session = createCompletedVictorySession();
    const signer = await createTestEd25519Signer();
    const unsigned = createUnsignedBattleProof(session);

    expect(unsigned.payload).toMatchObject({
      schema: "tactics-arena.battle-proof.v1",
      manifestVersion: "0.1.0",
      scenarioFreezeId: "wasteland-8x6-v1",
      battleId: "battle-proof-1",
      controlMode: "human",
      result: "victory",
      rounds: 2,
      activeDurationMs: 4500,
    });
    expect(unsigned.acceptedCommands).toEqual(FROZEN_WINNING_COMMANDS);
    expect(unsigned.payload.commandsDigest).toBe(
      await commandsDigest(FROZEN_WINNING_COMMANDS),
    );

    const signed = await signBattleProof(unsigned, signer, {
      seekerGenesisMint: "SGTMint111111111111111111111111111111111111",
      issuedAt: "2026-10-17T12:00:00.000Z",
    });

    expect(signed.message).toBe(canonicalProofMessage(signed.payload));

    // Offline verification (no seekerVerifier provided -> sgtStatus: "unverified_offline")
    const offlineResult = await verifySignedBattleProof(signed);
    expect(offlineResult).toEqual({
      valid: true,
      sgtStatus: "unverified_offline",
    });

    // Verified with seekerVerifier confirming SGT ownership
    const onlineResult = await verifySignedBattleProof(signed, {
      seekerVerifier: {
        verifySeekerGenesisToken: async () => [
          "SGTMint111111111111111111111111111111111111",
        ],
      },
    });
    expect(onlineResult).toEqual({
      valid: true,
      sgtStatus: "verified",
    });
  });

  it("rejects tampered message/digest, tampered commands/rounds, bad signatures, and spoofed SGT mints", async () => {
    const session = createCompletedVictorySession();
    const signer = await createTestEd25519Signer();
    const otherSigner = await createTestEd25519Signer();
    const unsigned = createUnsignedBattleProof(session);
    const signed = await signBattleProof(unsigned, signer, {
      seekerGenesisMint: "SGTMint111111111111111111111111111111111111",
      issuedAt: "2026-10-17T12:00:00.000Z",
    });

    // 1. Payload modified without updating message -> digest_mismatch
    await expect(
      verifySignedBattleProof({
        ...signed,
        payload: { ...signed.payload, rounds: 1 },
      }),
    ).resolves.toMatchObject({
      valid: false,
      reason: "digest_mismatch",
    });

    // 2. Forged signature from a different keypair -> signature_mismatch
    await expect(
      verifySignedBattleProof({
        ...signed,
        payload: { ...signed.payload, walletAddress: otherSigner.address },
        message: canonicalProofMessage({
          ...signed.payload,
          walletAddress: otherSigner.address,
        }),
      }),
    ).resolves.toMatchObject({
      valid: false,
      reason: "signature_mismatch",
    });

    // 3. Signed payload with forged rounds or tampered commands -> replay_mismatch
    const forgedPayload = {
      ...unsigned.payload,
      rounds: 1,
    };
    const forgedSigned = await signBattleProof(
      { payload: forgedPayload, acceptedCommands: unsigned.acceptedCommands },
      signer,
      { issuedAt: "2026-10-17T12:00:00.000Z" },
    );
    await expect(verifySignedBattleProof(forgedSigned)).resolves.toMatchObject({
      valid: false,
      reason: "replay_mismatch",
    });

    // 4. Spoofed seekerGenesisMint rejected when seekerVerifier checks on-chain ownership -> sgt_ownership_mismatch
    await expect(
      verifySignedBattleProof(signed, {
        seekerVerifier: {
          verifySeekerGenesisToken: async () => [],
        },
      }),
    ).resolves.toMatchObject({
      valid: false,
      reason: "sgt_ownership_mismatch",
    });
  });
});
