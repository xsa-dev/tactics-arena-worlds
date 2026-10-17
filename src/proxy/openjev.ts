import { sha256Hex } from "../solana/battle-proof";
import {
  normalizeResponse,
  type CandidateSummary,
  type SurvivorBattleSummary,
  type SurvivorDecisionRequest,
} from "../survivor/policy";

export interface ProxyEnv {
  OPENJEV_API_KEY?: string;
  OPENJEV_PROXY_DISABLED?: string;
}

export type CircuitState = "closed" | "open" | "half-open";

export interface ProxyLogEntry {
  readonly code: string;
  readonly status: number;
  readonly clientHash: string;
  readonly sessionHash: string;
  readonly circuitState: CircuitState;
  readonly dailyCount: number;
}

export interface ProxyOptions {
  env?: ProxyEnv;
  fetchImpl?: typeof fetch;
  upstreamTimeoutMs?: number;
  maxBodyBytes?: number;
  maxCandidates?: number;
  maxPerIpPerMinute?: number;
  maxPerSessionPerMinute?: number;
  maxPerBattle?: number;
  maxConcurrentUpstream?: number;
  dailyBudgetCeiling?: number;
  circuitFailureThreshold?: number;
  circuitCooldownMs?: number;
  now?: () => number;
  onLog?: (entry: ProxyLogEntry) => void;
}

const ALLOWED_UPSTREAM_URL = "https://api.openjev.sh/v1/systemone";

const json = (
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const validCandidate = (value: unknown): value is CandidateSummary => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    /^[A-Za-z0-9_-]{1,64}$/.test(record.id) &&
    typeof record.kind === "string" &&
    ["move", "attack", "ability", "end-player-phase"].includes(record.kind)
  );
};

const validRequest = (
  value: unknown,
  maxCandidates: number,
): value is SurvivorDecisionRequest => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const state = record.state as Record<string, unknown> | undefined;
  return (
    record.contractVersion === "v1" &&
    typeof record.stateFingerprint === "string" &&
    record.stateFingerprint.length > 0 &&
    record.stateFingerprint.length <= 4096 &&
    Boolean(state && typeof state === "object") &&
    typeof state?.battleId === "string" &&
    state.battleId.length > 0 &&
    state.battleId.length <= 128 &&
    typeof state?.round === "number" &&
    Array.isArray(record.candidates) &&
    record.candidates.length > 0 &&
    record.candidates.length <= maxCandidates &&
    record.candidates.every(validCandidate)
  );
};

export function sanitizeTacticalPayload(body: SurvivorDecisionRequest): {
  state: SurvivorBattleSummary;
  candidates: Array<{
    id: string;
    kind: CandidateSummary["kind"];
    actorId?: string;
    targetId?: string;
    to?: { x: number; y: number };
  }>;
} {
  const { state, candidates } = body;
  return {
    state: {
      battleId: String(state.battleId).slice(0, 128),
      phase: state.phase === "enemy" ? "enemy" : "player",
      round: Number(state.round) || 1,
      status:
        state.status === "victory" || state.status === "defeat"
          ? state.status
          : "active",
      survivors: Array.isArray(state.survivors)
        ? state.survivors.map((u) => ({
            id: String(u.id),
            position: { x: Number(u.position.x), y: Number(u.position.y) },
            hp: Number(u.hp),
            maxHp: Number(u.maxHp),
            ap: Number(u.ap),
            ability: u.ability ?? null,
          }))
        : [],
      raiders: Array.isArray(state.raiders)
        ? state.raiders.map((u) => ({
            id: String(u.id),
            position: { x: Number(u.position.x), y: Number(u.position.y) },
            hp: Number(u.hp),
            maxHp: Number(u.maxHp),
            range: Number(u.range),
          }))
        : [],
    },
    candidates: candidates.map((c) => ({
      id: String(c.id),
      kind: c.kind,
      ...(typeof c.actorId === "string" ? { actorId: c.actorId } : {}),
      ...(typeof c.targetId === "string" ? { targetId: c.targetId } : {}),
      ...(c.to && typeof c.to.x === "number" && typeof c.to.y === "number"
        ? { to: { x: c.to.x, y: c.to.y } }
        : {}),
    })),
  };
}

export const createOpenJevProxyHandler = (options: ProxyOptions = {}) => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const env = options.env ?? {};
  const timeoutMs = options.upstreamTimeoutMs ?? 8_000;
  const maxBodyBytes = options.maxBodyBytes ?? 64_000;
  const maxCandidates = options.maxCandidates ?? 64;
  const maxPerIpPerMinute = options.maxPerIpPerMinute ?? 60;
  const maxPerSessionPerMinute = options.maxPerSessionPerMinute ?? 40;
  const maxPerBattle = options.maxPerBattle ?? 48;
  const maxConcurrentUpstream = options.maxConcurrentUpstream ?? 8;
  const dailyBudgetCeiling = options.dailyBudgetCeiling ?? 5_000;
  const circuitFailureThreshold = options.circuitFailureThreshold ?? 5;
  const circuitCooldownMs = options.circuitCooldownMs ?? 30_000;
  const now = options.now ?? (() => Date.now());

  const ipBuckets = new Map<string, { windowStart: number; count: number }>();
  const sessionBuckets = new Map<
    string,
    { windowStart: number; count: number }
  >();
  const battleCounts = new Map<string, number>();
  let activeUpstream = 0;
  let dailyDay = Math.floor(now() / 86_400_000);
  let dailyCount = 0;
  let consecutiveFailures = 0;
  let circuitOpenedAt: number | null = null;

  const getCircuitState = (currentTime: number): CircuitState => {
    if (circuitOpenedAt === null) return "closed";
    if (currentTime - circuitOpenedAt >= circuitCooldownMs) return "half-open";
    return "open";
  };

  const recordUpstreamFailure = (currentTime: number): void => {
    consecutiveFailures += 1;
    if (consecutiveFailures >= circuitFailureThreshold) {
      circuitOpenedAt = currentTime;
    }
  };

  const recordUpstreamSuccess = (): void => {
    consecutiveFailures = 0;
    circuitOpenedAt = null;
  };

  const checkBucket = (
    map: Map<string, { windowStart: number; count: number }>,
    key: string,
    limit: number,
    currentTime: number,
  ): boolean => {
    const existing = map.get(key);
    if (!existing || currentTime - existing.windowStart >= 60_000) {
      map.set(key, { windowStart: currentTime, count: 1 });
      return true;
    }
    if (existing.count >= limit) return false;
    existing.count += 1;
    return true;
  };

  return async (request: Request): Promise<Response> => {
    const currentTime = now();
    const dayBucket = Math.floor(currentTime / 86_400_000);
    if (dayBucket !== dailyDay) {
      dailyDay = dayBucket;
      dailyCount = 0;
    }

    const rawIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "anonymous-ip";
    const rawSession =
      request.headers.get("x-session-token")?.trim() ?? "anonymous-session";
    const clientHash = `ip-${sha256Hex(`${dayBucket}:${rawIp}`).slice(0, 12)}`;
    const sessionHash = `s-${sha256Hex(`${dayBucket}:${rawSession}`).slice(0, 12)}`;

    const logOutcome = (code: string, status: number): void => {
      options.onLog?.({
        code,
        status,
        clientHash,
        sessionHash,
        circuitState: getCircuitState(currentTime),
        dailyCount,
      });
    };

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname.endsWith("/health")) {
      const disabled =
        env.OPENJEV_PROXY_DISABLED === "true" ||
        env.OPENJEV_PROXY_DISABLED === "1" ||
        !env.OPENJEV_API_KEY;
      const circuitState = getCircuitState(currentTime);
      const status = disabled
        ? "disabled"
        : circuitState === "open"
          ? "degraded"
          : "healthy";
      logOutcome(status, disabled || circuitState === "open" ? 503 : 200);
      return json(
        { ok: status === "healthy", status, circuitState },
        status === "healthy" ? 200 : 503,
      );
    }

    if (request.method !== "POST") {
      logOutcome("bad-request", 405);
      return json({ ok: false, code: "bad-request" }, 405, { allow: "POST" });
    }

    if (
      env.OPENJEV_PROXY_DISABLED === "true" ||
      env.OPENJEV_PROXY_DISABLED === "1"
    ) {
      logOutcome("unavailable", 503);
      return json({ ok: false, code: "unavailable" }, 503);
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > maxBodyBytes) {
      logOutcome("bad-request", 413);
      return json({ ok: false, code: "bad-request" }, 413);
    }

    let rawText: string;
    try {
      rawText = await request.text();
    } catch {
      logOutcome("bad-request", 400);
      return json({ ok: false, code: "bad-request" }, 400);
    }
    if (new TextEncoder().encode(rawText).byteLength > maxBodyBytes) {
      logOutcome("bad-request", 413);
      return json({ ok: false, code: "bad-request" }, 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawText);
    } catch {
      logOutcome("bad-request", 400);
      return json({ ok: false, code: "bad-request" }, 400);
    }

    if (!validRequest(body, maxCandidates)) {
      logOutcome("bad-request", 400);
      return json({ ok: false, code: "bad-request" }, 400);
    }

    if (!env.OPENJEV_API_KEY) {
      logOutcome("unavailable", 503);
      return json({ ok: false, code: "unavailable" }, 503);
    }

    const circuit = getCircuitState(currentTime);
    if (circuit === "open") {
      const retryMs = Math.max(
        1_000,
        circuitCooldownMs - (currentTime - (circuitOpenedAt ?? currentTime)),
      );
      logOutcome("unavailable", 503);
      return json(
        { ok: false, code: "unavailable", retryAfterMs: retryMs },
        503,
        { "retry-after": String(Math.ceil(retryMs / 1000)) },
      );
    }

    if (
      !checkBucket(ipBuckets, clientHash, maxPerIpPerMinute, currentTime) ||
      !checkBucket(
        sessionBuckets,
        sessionHash,
        maxPerSessionPerMinute,
        currentTime,
      )
    ) {
      logOutcome("rate-limited", 429);
      return json(
        { ok: false, code: "rate-limited", retryAfterMs: 1_000 },
        429,
        { "retry-after": "1" },
      );
    }

    const battleId = body.state.battleId;
    const battleCount = (battleCounts.get(battleId) ?? 0) + 1;
    if (battleCount > maxPerBattle) {
      logOutcome("rate-limited", 429);
      return json(
        { ok: false, code: "rate-limited", retryAfterMs: 1_000 },
        429,
        { "retry-after": "1" },
      );
    }
    battleCounts.set(battleId, battleCount);

    if (
      activeUpstream >= maxConcurrentUpstream ||
      dailyCount >= dailyBudgetCeiling
    ) {
      logOutcome("rate-limited", 429);
      return json(
        { ok: false, code: "rate-limited", retryAfterMs: 5_000 },
        429,
        { "retry-after": "5" },
      );
    }

    activeUpstream += 1;
    dailyCount += 1;
    const sanitized = sanitizeTacticalPayload(body);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const upstream = await fetchImpl(ALLOWED_UPSTREAM_URL, {
        method: "POST",
        redirect: "error",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env.OPENJEV_API_KEY}`,
        },
        body: JSON.stringify(sanitized),
        signal: controller.signal,
      });
      if (upstream.status === 401 || upstream.status === 403) {
        recordUpstreamFailure(currentTime);
        logOutcome("unauthorized", 502);
        return json({ ok: false, code: "unauthorized" }, 502);
      }
      if (upstream.status === 429) {
        recordUpstreamFailure(currentTime);
        const headerRetry = Number(upstream.headers.get("retry-after") ?? "1");
        const retryAfterMs = Math.max(
          1_000,
          Math.min(
            300_000,
            (Number.isFinite(headerRetry) ? headerRetry : 1) * 1_000,
          ),
        );
        logOutcome("rate-limited", 429);
        return json({ ok: false, code: "rate-limited", retryAfterMs }, 429, {
          "retry-after": String(Math.ceil(retryAfterMs / 1000)),
        });
      }
      if (!upstream.ok) {
        recordUpstreamFailure(currentTime);
        logOutcome("unavailable", 502);
        return json({ ok: false, code: "unavailable" }, 502);
      }
      const normalized = normalizeResponse(await upstream.json());
      if (!normalized.ok) {
        recordUpstreamFailure(currentTime);
        logOutcome("malformed", 502);
        return json({ ok: false, code: "malformed" }, 502);
      }
      recordUpstreamSuccess();
      logOutcome("ok", 200);
      return json(normalized, 200);
    } catch (error) {
      recordUpstreamFailure(currentTime);
      const code =
        error instanceof DOMException && error.name === "AbortError"
          ? "timeout"
          : "unavailable";
      logOutcome(code, 504);
      return json({ ok: false, code }, 504);
    } finally {
      activeUpstream = Math.max(0, activeUpstream - 1);
      clearTimeout(timeout);
    }
  };
};

export const OPENJEV_PROXY_UPSTREAM = ALLOWED_UPSTREAM_URL;
