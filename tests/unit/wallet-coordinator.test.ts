import { describe, expect, it, vi } from "vitest";
import { FROZEN_WINNING_COMMANDS } from "../../src/core/scenario";
import { LocalPlatformService } from "../../src/platform";
import { BattleSession } from "../../src/platform/battle-session";
import {
  encodeBase58,
  verifySignedBattleProof,
} from "../../src/solana/battle-proof";
import {
  SolanaWalletCoordinator,
  createSessionStorageAuthCache,
} from "../../src/solana/wallet-coordinator";
import type { SolanaSigner } from "../../src/solana/types";

function createFakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
}

async function makeSigner(): Promise<SolanaSigner> {
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

describe("SolanaWalletCoordinator", () => {
  it("stores MWA authorization cache in sessionStorage under tactics-mwa-auth-v1", async () => {
    const sessionStorage = createFakeStorage();
    const cache = createSessionStorageAuthCache(sessionStorage);
    await expect(cache.get()).resolves.toBeUndefined();
    await cache.set({ accounts: [] } as never);
    expect(sessionStorage.getItem("tactics-mwa-auth-v1")).toBe(
      JSON.stringify({ accounts: [] }),
    );
    await expect(cache.get()).resolves.toEqual({ accounts: [] });
    await cache.clear();
    await expect(cache.get()).resolves.toBeUndefined();
  });

  it("connects wallet with mwa_intent blocker, verifies Seeker SGT, caches unsigned battle proof in sessionStorage, and signs proof", async () => {
    const sessionStorage = createFakeStorage();
    const signer = await makeSigner();
    const blockerLog: Array<[string, boolean]> = [];
    const emitted: Array<{
      name: string;
      properties: Record<string, unknown>;
    }> = [];

    let observedBlockerDuringConnect = false;
    let observedBlockerDuringSign = false;

    const coordinator = new SolanaWalletCoordinator({
      sessionStorage,
      setBlocker: (source, blocked) => {
        blockerLog.push([source, blocked]);
      },
      emitAnalytics: (name, properties) => {
        emitted.push({ name, properties });
      },
      walletAdapter: {
        connect: async () => {
          observedBlockerDuringConnect =
            blockerLog.at(-1)?.[0] === "mwa_intent" &&
            blockerLog.at(-1)?.[1] === true;
          return signer;
        },
      },
      seekerVerifier: {
        verifySeekerGenesisToken: async (walletAddress) => {
          expect(walletAddress).toBe(signer.address);
          return ["SeekerMint111111111111111111111111111111111"];
        },
      },
    });

    await coordinator.connect();
    expect(observedBlockerDuringConnect).toBe(true);
    expect(blockerLog).toEqual([
      ["mwa_intent", true],
      ["mwa_intent", false],
    ]);
    expect(coordinator.walletAddress).toBe(signer.address);
    expect(coordinator.seekerVerified).toBe(true);
    expect(coordinator.seekerGenesisMint).toBe(
      "SeekerMint111111111111111111111111111111111",
    );
    expect(emitted[0]).toEqual({
      name: "wallet_connected",
      properties: {
        walletAddress: signer.address,
        seekerVerified: true,
      },
    });

    // Finish a battle and cache unsigned proof
    const session = new BattleSession(
      new LocalPlatformService("en"),
      {
        sessionId: "s-1",
        testerId: "t-1",
        manifestVersion: "0.1.0",
        releaseProfile: "solana-mobile",
        deviceClass: "mobile",
        inputType: "touch",
        viewport: "640x360",
        locale: "en",
      },
      "battle-wallet-1",
      () => 2000,
    );
    session.start();
    for (const command of FROZEN_WINNING_COMMANDS)
      expect(session.execute(command, "human").accepted).toBe(true);

    coordinator.cacheCompletedBattle(session);
    expect(sessionStorage.getItem("tactics-battle-proof-v1")).toBeTruthy();

    // Simulate a WebView reload by creating a second coordinator reading the same sessionStorage
    const reloadedCoordinator = new SolanaWalletCoordinator({
      sessionStorage,
      setBlocker: (source, blocked) => {
        blockerLog.push([source, blocked]);
      },
      emitAnalytics: (name, properties) => {
        emitted.push({ name, properties });
      },
      walletAdapter: {
        connect: async () => ({
          ...signer,
          signMessage: async (msg) => {
            observedBlockerDuringSign =
              blockerLog.at(-1)?.[0] === "mwa_intent" &&
              blockerLog.at(-1)?.[1] === true;
            return signer.signMessage(msg);
          },
        }),
      },
      seekerVerifier: {
        verifySeekerGenesisToken: async () => [
          "SeekerMint111111111111111111111111111111111",
        ],
      },
    });

    expect(reloadedCoordinator.hasUnsignedProof).toBe(true);
    const signed = await reloadedCoordinator.signLastBattleProof();
    expect(observedBlockerDuringSign).toBe(true);
    expect(signed.payload.battleId).toBe("battle-wallet-1");
    expect(signed.payload.seekerGenesisMint).toBe(
      "SeekerMint111111111111111111111111111111111",
    );
    await expect(
      verifySignedBattleProof(signed, {
        seekerVerifier: {
          verifySeekerGenesisToken: async () => [
            "SeekerMint111111111111111111111111111111111",
          ],
        },
      }),
    ).resolves.toEqual({ valid: true, sgtStatus: "verified" });
  });

  it("degrades gracefully when SGT RPC throws or returns empty", async () => {
    const signer = await makeSigner();
    const coordinator = new SolanaWalletCoordinator({
      sessionStorage: createFakeStorage(),
      setBlocker: vi.fn(),
      emitAnalytics: vi.fn(),
      walletAdapter: {
        connect: async () => signer,
      },
      seekerVerifier: {
        verifySeekerGenesisToken: async () => {
          throw new Error("RPC 429 Too Many Requests");
        },
      },
    });

    await expect(coordinator.connect()).resolves.toBe(signer.address);
    expect(coordinator.walletAddress).toBe(signer.address);
    expect(coordinator.seekerVerified).toBe(false);
    expect(coordinator.seekerGenesisMint).toBeNull();
  });
});
