import type { BattleSession } from "../platform/battle-session";
import { ALLOWED_SESSION_KEYS } from "../release/persistence";
import {
  createUnsignedBattleProof,
  decodeBase58,
  signBattleProof,
  verifySignedBattleProof,
} from "./battle-proof";
import type {
  ProofVerificationResult,
  SeekerVerifier,
  SignedBattleProofV1,
  SolanaSigner,
  UnsignedBattleProofV1,
  WalletAdapterLike,
} from "./types";

export interface AuthorizationCacheLike<T = unknown> {
  clear(): Promise<void>;
  get(): Promise<T | undefined>;
  set(value: T): Promise<void>;
}

export function createSessionStorageAuthCache<T = unknown>(
  storage: Storage,
): AuthorizationCacheLike<T> {
  const key = ALLOWED_SESSION_KEYS[0];
  return {
    async clear(): Promise<void> {
      storage.removeItem(key);
    },
    async get(): Promise<T | undefined> {
      const raw = storage.getItem(key);
      if (!raw) return undefined;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return undefined;
      }
    },
    async set(value: T): Promise<void> {
      storage.setItem(key, JSON.stringify(value));
    },
  };
}

export async function registerSolanaMobileWalletAdapter(
  appUrl: string,
  storage: Storage,
): Promise<void> {
  const {
    createDefaultChainSelector,
    createDefaultWalletNotFoundHandler,
    registerMwa,
  } = await import("@solana-mobile/wallet-standard-mobile");
  registerMwa({
    appIdentity: {
      name: "Tactics Arena: Wasteland",
      uri: appUrl,
      icon: "icons/icon-192.png",
    },
    authorizationCache: createSessionStorageAuthCache(storage) as never,
    chains: ["solana:mainnet"],
    chainSelector: createDefaultChainSelector(),
    onWalletNotFound: createDefaultWalletNotFoundHandler(),
  });
}

export function createRpcSeekerVerifier(rpcUrl: string): SeekerVerifier {
  const cache = new Map<string, string[]>();
  return {
    async verifySeekerGenesisToken(walletAddress: string): Promise<string[]> {
      const cached = cache.get(walletAddress);
      if (cached) return cached;
      const [{ getSeekerGenesisTokens }, { address, createSolanaRpc }] =
        await Promise.all([
          import("@solana-mobile/skr-genesis-token"),
          import("@solana/kit"),
        ]);
      const rpc = createSolanaRpc(rpcUrl);
      const tokens = await getSeekerGenesisTokens(
        rpc as never,
        address(walletAddress),
      );
      const mints = tokens.map((token) => String(token.mint));
      cache.set(walletAddress, mints);
      return mints;
    },
  };
}

export function createWalletStandardAdapter(): WalletAdapterLike {
  return {
    async connect(): Promise<SolanaSigner> {
      const { getWallets } = await import("@wallet-standard/app");
      const wallets = getWallets().get();
      const wallet = wallets.find(
        (candidate) =>
          "standard:connect" in candidate.features &&
          "solana:signMessage" in candidate.features,
      );
      if (!wallet) throw new Error("No Solana Wallet Standard wallet found");
      const connectFeature = wallet.features["standard:connect"] as {
        connect(): Promise<{
          accounts: ReadonlyArray<{
            address: string;
            publicKey: Uint8Array;
          }>;
        }>;
      };
      const signFeature = wallet.features["solana:signMessage"] as {
        signMessage(
          ...inputs: Array<{ account: unknown; message: Uint8Array }>
        ): Promise<ReadonlyArray<{ signature: Uint8Array }>>;
      };
      const { accounts } = await connectFeature.connect();
      const account = accounts[0];
      if (!account) throw new Error("Wallet returned no account");
      const pubKey =
        account.publicKey?.length === 32
          ? new Uint8Array(account.publicKey)
          : (decodeBase58(account.address) ?? new Uint8Array(32));
      return {
        address: account.address,
        publicKey: pubKey,
        async signMessage(message: Uint8Array): Promise<Uint8Array> {
          const results = await signFeature.signMessage({ account, message });
          const first = results[0];
          if (!first?.signature)
            throw new Error("Wallet did not return signature");
          return new Uint8Array(first.signature);
        },
      };
    },
  };
}

export interface SolanaWalletCoordinatorOptions {
  readonly sessionStorage: Storage;
  readonly setBlocker: (source: "mwa_intent", blocked: boolean) => void;
  readonly emitAnalytics: (
    name: string,
    properties: Record<string, string | number | boolean | null>,
  ) => void;
  readonly walletAdapter?: WalletAdapterLike;
  readonly seekerVerifier?: SeekerVerifier;
  readonly rpcUrl?: string;
}

export class SolanaWalletCoordinator {
  private signer: SolanaSigner | null = null;
  private sgtMint: string | null = null;
  private lastSigned: SignedBattleProofV1 | null = null;
  private lastVerification: ProofVerificationResult | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly walletAdapter: WalletAdapterLike;
  private readonly seekerVerifier: SeekerVerifier;

  constructor(private readonly options: SolanaWalletCoordinatorOptions) {
    this.walletAdapter = options.walletAdapter ?? createWalletStandardAdapter();
    this.seekerVerifier =
      options.seekerVerifier ??
      createRpcSeekerVerifier(
        options.rpcUrl ?? "https://api.mainnet-beta.solana.com",
      );
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  get walletAddress(): string | null {
    return this.signer?.address ?? null;
  }

  get seekerVerified(): boolean {
    return this.sgtMint !== null;
  }

  get seekerGenesisMint(): string | null {
    return this.sgtMint;
  }

  get lastSignedProof(): SignedBattleProofV1 | null {
    return this.lastSigned;
  }

  get lastVerificationResult(): ProofVerificationResult | null {
    return this.lastVerification;
  }

  get hasUnsignedProof(): boolean {
    return this.readCachedUnsignedProof() !== null;
  }

  async connect(): Promise<string> {
    this.options.setBlocker("mwa_intent", true);
    let connectedSigner: SolanaSigner;
    try {
      connectedSigner = await this.walletAdapter.connect();
      this.signer = connectedSigner;
    } finally {
      this.options.setBlocker("mwa_intent", false);
    }

    try {
      const mints = await this.seekerVerifier.verifySeekerGenesisToken(
        connectedSigner.address,
      );
      this.sgtMint = mints[0] ?? null;
    } catch {
      this.sgtMint = null;
    }

    this.options.emitAnalytics("wallet_connected", {
      walletAddress: connectedSigner.address,
      seekerVerified: this.sgtMint !== null,
    });
    this.notify();
    return connectedSigner.address;
  }

  cacheCompletedBattle(session: BattleSession): UnsignedBattleProofV1 {
    const unsigned = createUnsignedBattleProof(session);
    this.options.sessionStorage.setItem(
      ALLOWED_SESSION_KEYS[1],
      JSON.stringify(unsigned),
    );
    this.lastSigned = null;
    this.lastVerification = null;
    this.notify();
    return unsigned;
  }

  clearCachedBattle(): void {
    this.options.sessionStorage.removeItem(ALLOWED_SESSION_KEYS[1]);
    this.lastSigned = null;
    this.lastVerification = null;
    this.notify();
  }

  readCachedUnsignedProof(): UnsignedBattleProofV1 | null {
    const raw = this.options.sessionStorage.getItem(ALLOWED_SESSION_KEYS[1]);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UnsignedBattleProofV1;
    } catch {
      return null;
    }
  }

  async signLastBattleProof(issuedAt?: string): Promise<SignedBattleProofV1> {
    const unsigned = this.readCachedUnsignedProof();
    if (!unsigned)
      throw new Error("No completed battle proof available to sign");
    if (!this.signer) await this.connect();
    const activeSigner = this.signer;
    if (!activeSigner) throw new Error("Wallet not connected");

    this.options.setBlocker("mwa_intent", true);
    try {
      const signed = await signBattleProof(unsigned, activeSigner, {
        seekerGenesisMint: this.sgtMint,
        ...(issuedAt ? { issuedAt } : {}),
      });
      this.lastSigned = signed;
      this.options.emitAnalytics("battle_proof_signed", {
        battleId: signed.payload.battleId,
        result: signed.payload.result,
        rounds: signed.payload.rounds,
        seekerVerified: signed.payload.seekerGenesisMint !== null,
      });
      this.notify();
      return signed;
    } finally {
      this.options.setBlocker("mwa_intent", false);
    }
  }

  async verifyProof(
    proof: SignedBattleProofV1 | null = this.lastSigned,
  ): Promise<ProofVerificationResult> {
    if (!proof) {
      const result: ProofVerificationResult = {
        valid: false,
        reason: "digest_mismatch",
        sgtStatus: "none",
      };
      this.lastVerification = result;
      this.notify();
      return result;
    }
    const result = await verifySignedBattleProof(proof, {
      seekerVerifier: this.seekerVerifier,
    });
    this.lastVerification = result;
    this.notify();
    return result;
  }
}
