import type { SurvivorPolicy } from "./survivor/policy";
import type { SeekerVerifier, WalletAdapterLike } from "./solana/types";

export interface ProxyTransport {
  request(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface DeterministicClock {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface DeferredTestResponses {
  readonly enabled: boolean;
}

export interface BootstrapDependencies {
  readonly controlMode: "openjev" | "human";
  readonly survivorPolicy?: SurvivorPolicy;
  readonly proxyTransport?: ProxyTransport;
  readonly clock?: DeterministicClock;
  readonly deferredResponses?: DeferredTestResponses;
  readonly walletAdapter?: WalletAdapterLike;
  readonly seekerVerifier?: SeekerVerifier;
}

export const systemClock: DeterministicClock = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) =>
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export const createBootstrapDependencies = (
  controlMode: BootstrapDependencies["controlMode"],
  overrides: Omit<BootstrapDependencies, "controlMode"> = {},
): BootstrapDependencies =>
  Object.freeze({
    controlMode,
    clock: overrides.clock ?? systemClock,
    ...overrides,
  });
