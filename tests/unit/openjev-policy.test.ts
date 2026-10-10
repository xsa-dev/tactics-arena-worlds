import { describe, expect, it, vi } from "vitest";
import { createBattle } from "../../src/core/scenario";
import { OpenJevSurvivorPolicy } from "../../src/survivor/openjev-client";
import { normalizeResponse } from "../../src/survivor/policy";
import {
  DeterministicSurvivorPolicy,
  ResilientSurvivorPolicy,
} from "../../src/survivor/resilient-policy";
import { createOpenJevProxyHandler } from "../../src/proxy/openjev";
import type { CandidateSummary } from "../../src/survivor/policy";

const candidates: CandidateSummary[] = [
  {
    id: "end",
    kind: "end-player-phase",
    command: { type: "end-player-phase" },
  },
  {
    id: "attack",
    kind: "attack",
    actorId: "survivor-scout",
    targetId: "raider-a",
    command: { type: "attack", unitId: "survivor-scout", targetId: "raider-a" },
  },
];

describe("Survivor policy boundary", () => {
  it("normalizes only bounded response shapes", () => {
    expect(normalizeResponse({ ok: true, candidateId: "attack" })).toEqual({
      ok: true,
      candidateId: "attack",
    });
    expect(
      normalizeResponse({ ok: true, candidateId: "x".repeat(129) }),
    ).toEqual({ ok: false, code: "malformed" });
    expect(
      normalizeResponse({
        ok: false,
        code: "rate-limited",
        retryAfterMs: 999999,
      }),
    ).toEqual({ ok: false, code: "rate-limited", retryAfterMs: 300000 });
  });

  it("accepts a valid OpenJEV choice and rejects unknown candidates", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, candidateId: "attack" }), {
        status: 200,
      }),
    );
    const policy = new OpenJevSurvivorPolicy({
      fetchImpl,
      endpoint: "https://proxy.test/v1/openjev/choose",
    });
    await expect(
      policy.choose(createBattle("valid"), candidates),
    ).resolves.toMatchObject({ candidateId: "attack", source: "openjev" });
    fetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, candidateId: "unknown" }), {
        status: 200,
      }),
    );
    await expect(
      policy.choose(createBattle("unknown"), candidates),
    ).rejects.toThrow("unknown-candidate");
  });

  it("uses deterministic fallback when primary is absent or fails", async () => {
    const state = createBattle("fallback");
    const fallback = new ResilientSurvivorPolicy(null);
    await expect(fallback.choose(state, candidates)).resolves.toMatchObject({
      source: "fallback",
      fallbackReason: "not-configured",
    });
    const failing = new ResilientSurvivorPolicy({
      choose: async () => {
        throw new Error("timeout");
      },
    });
    await expect(failing.choose(state, candidates)).resolves.toMatchObject({
      source: "fallback",
      fallbackReason: "timeout",
    });
    await expect(
      new DeterministicSurvivorPolicy().choose(state, candidates),
    ).resolves.toMatchObject({ candidateId: "attack" });
  });
});

describe("OpenJEV proxy contract", () => {
  const requestBody = {
    contractVersion: "v1",
    stateFingerprint: "fp",
    state: {
      battleId: "b",
      phase: "player",
      round: 1,
      status: "active",
      survivors: [],
      raiders: [],
    },
    candidates,
  };
  it("normalizes upstream success and never returns authorization", async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, candidateId: "attack" }), {
        status: 200,
      }),
    );
    const handler = createOpenJevProxyHandler({
      env: { OPENJEV_API_KEY: "secret-token" },
      fetchImpl: upstream,
    });
    const response = await handler(
      new Request("https://proxy.test/v1/openjev/choose", {
        method: "POST",
        body: JSON.stringify(requestBody),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("secret-token");
    expect(upstream).toHaveBeenCalledWith(
      expect.stringContaining("api.openjev.sh/v1/systemone"),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer secret-token",
        }),
      }),
    );
  });

  it("bounds method, missing-secret, upstream failure, and malformed responses", async () => {
    const handler = createOpenJevProxyHandler({ env: {} });
    expect(
      (await handler(new Request("https://proxy.test", { method: "GET" })))
        .status,
    ).toBe(405);
    expect(
      (
        await handler(
          new Request("https://proxy.test", {
            method: "POST",
            body: JSON.stringify(requestBody),
          }),
        )
      ).status,
    ).toBe(503);
    const malformed = createOpenJevProxyHandler({
      env: { OPENJEV_API_KEY: "token" },
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("{}", { status: 200 })),
    });
    expect(
      (
        await malformed(
          new Request("https://proxy.test", {
            method: "POST",
            body: JSON.stringify(requestBody),
          }),
        )
      ).status,
    ).toBe(502);
  });
});
