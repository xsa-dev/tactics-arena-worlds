import {
  normalizeResponse,
  type SurvivorDecisionRequest,
} from "../survivor/policy";

export interface ProxyEnv {
  OPENJEV_API_KEY?: string;
}
export interface ProxyOptions {
  env?: ProxyEnv;
  fetchImpl?: typeof fetch;
  upstreamTimeoutMs?: number;
  maxBodyBytes?: number;
  maxCandidates?: number;
}

const upstreamUrl = "https://api.openjev.sh/v1/systemone";
const json = (
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const validRequest = (
  value: unknown,
  maxCandidates: number,
): value is SurvivorDecisionRequest => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.contractVersion === "v1" &&
    typeof record.stateFingerprint === "string" &&
    record.stateFingerprint.length <= 4096 &&
    Array.isArray(record.candidates) &&
    record.candidates.length > 0 &&
    record.candidates.length <= maxCandidates
  );
};

export const createOpenJevProxyHandler = (options: ProxyOptions = {}) => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const env = options.env ?? {};
  const timeoutMs = options.upstreamTimeoutMs ?? 8_000;
  const maxBodyBytes = options.maxBodyBytes ?? 64_000;
  const maxCandidates = options.maxCandidates ?? 64;
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST")
      return json({ ok: false, code: "bad-request" }, 405, { allow: "POST" });
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > maxBodyBytes)
      return json({ ok: false, code: "bad-request" }, 413);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, code: "bad-request" }, 400);
    }
    if (!validRequest(body, maxCandidates))
      return json({ ok: false, code: "bad-request" }, 400);
    if (!env.OPENJEV_API_KEY)
      return json({ ok: false, code: "unavailable" }, 503);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const upstream = await fetchImpl(upstreamUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env.OPENJEV_API_KEY}`,
        },
        body: JSON.stringify({
          state: body.state,
          candidates: body.candidates,
        }),
        signal: controller.signal,
      });
      if (upstream.status === 401 || upstream.status === 403)
        return json({ ok: false, code: "unauthorized" }, 502);
      if (upstream.status === 429)
        return json(
          { ok: false, code: "rate-limited", retryAfterMs: 1_000 },
          429,
          { "retry-after": "1" },
        );
      if (!upstream.ok) return json({ ok: false, code: "unavailable" }, 502);
      const normalized = normalizeResponse(await upstream.json());
      return normalized.ok
        ? json(normalized, 200)
        : json({ ok: false, code: "malformed" }, 502);
    } catch (error) {
      return json(
        {
          ok: false,
          code:
            error instanceof DOMException && error.name === "AbortError"
              ? "timeout"
              : "unavailable",
        },
        504,
      );
    } finally {
      clearTimeout(timeout);
    }
  };
};

export const OPENJEV_PROXY_UPSTREAM = upstreamUrl;
