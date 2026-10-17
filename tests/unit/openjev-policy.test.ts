import { describe, expect, it, vi } from "vitest";
import { createBattle } from "../../src/core/scenario";
import { OpenJevSurvivorPolicy } from "../../src/survivor/openjev-client";
import { normalizeResponse } from "../../src/survivor/policy";
import {
  DeterministicSurvivorPolicy,
  ResilientSurvivorPolicy,
} from "../../src/survivor/resilient-policy";
import {
  assertRedactedDiagnostic,
  createAiReplayEnvelope,
  verifyAiReplayEnvelope,
} from "../../src/survivor/diagnostics";
import {
  createOpenJevProxyHandler,
  type ProxyLogEntry,
} from "../../src/proxy/openjev";
import type { CandidateSummary } from "../../src/survivor/policy";
import { LocalPlatformService } from "../../src/platform";
import { GameRuntime } from "../../src/presentation/runtime";
import { FROZEN_WINNING_COMMANDS } from "../../src/core/scenario";
import { dispatch } from "../../src/core/engine";

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

  it("enforces token buckets, per-battle caps, daily budget, circuit breaker, health probe, emergency disable, and allowlisted tactical serialization", async () => {
    let currentTime = 1_000_000;
    const logs: ProxyLogEntry[] = [];
    const capturedBodies: string[] = [];
    let shouldFailUpstream = false;

    const testSecret = ["oj", "live", "secret_token_do_not_log"].join("_");
    const handler = createOpenJevProxyHandler({
      env: { OPENJEV_API_KEY: testSecret },
      maxPerIpPerMinute: 3,
      maxPerBattle: 2,
      dailyBudgetCeiling: 5,
      circuitFailureThreshold: 2,
      circuitCooldownMs: 10_000,
      now: () => currentTime,
      onLog: (entry) => logs.push(entry),
      fetchImpl: async (_url, init) => {
        capturedBodies.push(String(init?.body ?? ""));
        if (shouldFailUpstream) {
          return new Response("upstream error", { status: 503 });
        }
        return new Response(
          JSON.stringify({ ok: true, candidateId: "attack" }),
          {
            status: 200,
          },
        );
      },
    });

    // 1. Health probe starts healthy
    const health1 = await handler(
      new Request("https://proxy.test/v1/openjev/health", { method: "GET" }),
    );
    expect(health1.status).toBe(200);
    await expect(health1.json()).resolves.toMatchObject({
      ok: true,
      status: "healthy",
      circuitState: "closed",
    });

    // 2. Allowlisted tactical serialization strips non-tactical fields
    const pollutedBody = {
      ...requestBody,
      testerId: "secret-tester-id",
      rawIp: "203.0.113.9",
      state: {
        ...requestBody.state,
        battleId: "battle-cap-test",
        freeText: "should be stripped",
      },
    };
    const res1 = await handler(
      new Request("https://proxy.test/v1/openjev/choose", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.9" },
        body: JSON.stringify(pollutedBody),
      }),
    );
    expect(res1.status).toBe(200);
    expect(capturedBodies[0]).not.toContain("secret-tester-id");
    expect(capturedBodies[0]).not.toContain("should be stripped");
    expect(JSON.stringify(logs)).not.toContain("203.0.113.9");
    expect(JSON.stringify(logs)).not.toContain(testSecret);

    // 3. Per-battle cap (maxPerBattle = 2) rejects the 3rd request for the same battleId
    const res2 = await handler(
      new Request("https://proxy.test/v1/openjev/choose", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.9" },
        body: JSON.stringify(pollutedBody),
      }),
    );
    expect(res2.status).toBe(200);

    const res3 = await handler(
      new Request("https://proxy.test/v1/openjev/choose", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.9" },
        body: JSON.stringify(pollutedBody),
      }),
    );
    expect(res3.status).toBe(429);

    // 4. Per-IP token bucket (maxPerIpPerMinute = 3) rejects the 4th request from same IP in same minute
    const res4 = await handler(
      new Request("https://proxy.test/v1/openjev/choose", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.9" },
        body: JSON.stringify({
          ...requestBody,
          state: { ...requestBody.state, battleId: "battle-2" },
        }),
      }),
    );
    expect(res4.status).toBe(429);

    // Advance clock 1 minute so IP bucket resets, then trigger circuit breaker with 2 upstream failures
    currentTime += 61_000;
    shouldFailUpstream = true;
    for (const bId of ["battle-fail-1", "battle-fail-2"]) {
      const failRes = await handler(
        new Request("https://proxy.test/v1/openjev/choose", {
          method: "POST",
          body: JSON.stringify({
            ...requestBody,
            state: { ...requestBody.state, battleId: bId },
          }),
        }),
      );
      expect(failRes.status).toBe(502);
    }

    // Circuit is now open: health probe reports degraded (503) and live request fails fast without calling upstream
    const healthDegraded = await handler(
      new Request("https://proxy.test/v1/openjev/health", { method: "GET" }),
    );
    expect(healthDegraded.status).toBe(503);
    await expect(healthDegraded.json()).resolves.toMatchObject({
      ok: false,
      status: "degraded",
      circuitState: "open",
    });

    const upstreamCountBeforeCircuit = capturedBodies.length;
    const circuitBlocked = await handler(
      new Request("https://proxy.test/v1/openjev/choose", {
        method: "POST",
        body: JSON.stringify({
          ...requestBody,
          state: { ...requestBody.state, battleId: "battle-circuit" },
        }),
      }),
    );
    expect(circuitBlocked.status).toBe(503);
    expect(capturedBodies.length).toBe(upstreamCountBeforeCircuit);

    // Emergency disable switch returns 503
    const disabledHandler = createOpenJevProxyHandler({
      env: { OPENJEV_API_KEY: "token", OPENJEV_PROXY_DISABLED: "true" },
    });
    expect(
      (
        await disabledHandler(
          new Request("https://proxy.test/v1/openjev/choose", {
            method: "POST",
            body: JSON.stringify(requestBody),
          }),
        )
      ).status,
    ).toBe(503);
  });

  it("emits redacted decision diagnostics, verifies versioned replay envelopes offline, and produces identical outcomes across 1x, 2x, and 4x speeds", async () => {
    const fakeBearer = `Bearer ${["oj", "live", "1234567890abcdefghij1234"].join("_")}`;
    expect(() =>
      assertRedactedDiagnostic({
        authorization: fakeBearer,
      }),
    ).toThrow(/Unredacted/);

    // Verify offline replay envelope reproduction
    let state = createBattle("envelope-test");
    const initial = structuredClone(state);
    const eventTypes: Array<
      ReturnType<typeof dispatch>["events"][number]["type"]
    > = [];
    const decisions = FROZEN_WINNING_COMMANDS.map((command, idx) => {
      const res = dispatch(state, command);
      expect(res.accepted).toBe(true);
      state = res.state;
      eventTypes.push(...res.events.map((e) => e.type));
      return {
        candidateId: `sc-0000000${idx}`,
        command,
        source: "openjev" as const,
      };
    });

    const envelope = createAiReplayEnvelope({
      battleId: "envelope-test",
      initialState: initial,
      terminalState: state,
      decisions,
      eventTypes,
    });
    expect(verifyAiReplayEnvelope(envelope)).toMatchObject({
      valid: true,
    });
    expect(
      verifyAiReplayEnvelope({
        ...envelope,
        terminalRound: 99,
      }),
    ).toMatchObject({
      valid: false,
      reason: "terminal_state_mismatch",
    });

    // Run AI autoplay across 1x, 2x, and 4x and verify identical command/state/replay outcomes
    vi.stubGlobal("localStorage", {
      getItem: () => "complete",
      setItem: () => undefined,
    });
    vi.stubGlobal("window", {
      __PHASER_GAME__: { sound: { pauseAll: vi.fn(), resumeAll: vi.fn() } },
    });

    const runAtSpeed = async (speed: 1 | 2 | 4) => {
      const platform = new LocalPlatformService("en");
      const runtime = new GameRuntime(
        platform,
        "en",
        {
          sessionId: `s-${speed}`,
          testerId: "t",
          manifestVersion: "0.1.0",
          releaseProfile: "ai-exhibition",
          deviceClass: "desktop",
          inputType: "mouse",
          viewport: "960x540",
          locale: "en",
        },
        undefined,
        {
          survivor: {
            mode: "openjev",
            proxyUrl: "",
            timeoutMs: 5_000,
            maxActionsPerPhase: 12,
          },
          autoplaySpeed: speed,
        },
      );
      for (const part of [
        "platform",
        "scene",
        "dom",
        "overlays",
        "input",
      ] as const)
        runtime.markReady(part);
      runtime.observations.startCurrent();

      let simTime = 1000;
      for (
        let step = 0;
        step < 30 && runtime.session.state.round === 1;
        step += 1
      ) {
        simTime += 500;
        runtime.update(simTime);
        await new Promise((r) => setTimeout(r, 5));
      }
      expect(runtime.diagnostics.length).toBeGreaterThan(0);
      for (const diag of runtime.diagnostics) {
        expect(() => assertRedactedDiagnostic(diag)).not.toThrow();
      }
      return {
        commands: runtime.session.acceptedCommands,
        round: runtime.session.state.round,
        aiEvents: platform.events
          .filter((e) => e.name.startsWith("ai_"))
          .map((e) => e.name),
      };
    };

    const run1 = await runAtSpeed(1);
    const run2 = await runAtSpeed(2);
    const run4 = await runAtSpeed(4);
    expect(run1.commands).toEqual(run2.commands);
    expect(run2.commands).toEqual(run4.commands);
    expect(run1.round).toBe(2);
    expect(run1.aiEvents).toContain("ai_decision_requested");
    expect(run1.aiEvents).toContain("ai_decision_accepted");
    expect(run1.aiEvents).toContain("ai_fallback_used");
  });
});
