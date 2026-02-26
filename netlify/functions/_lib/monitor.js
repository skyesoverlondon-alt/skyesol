import { q } from "./db.js";

function safeStr(v, max = 8000) {
  if (v == null) return null;
  const s = String(v);
  if (s.length <= max) return s;
  return s.slice(0, max) + `…(+${s.length - max} chars)`;
}

function randomId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {}
  // fallback (not RFC4122-perfect, but unique enough for tracing)
  return "rid_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

export function getRequestId(req) {
  const h = (req.headers.get("x-kaixu-request-id") || req.headers.get("x-request-id") || "").trim();
  return h || randomId();
}

export function inferFunctionName(req) {
  try {
    const u = new URL(req.url);
    const m = u.pathname.match(/\/\.netlify\/functions\/([^\/]+)/i);
    return m ? m[1] : "unknown";
  } catch {
    return "unknown";
  }
}

export function requestMeta(req) {
  let url = null;
  try { url = new URL(req.url); } catch {}
  return {
    method: req.method || null,
    path: url ? url.pathname : null,
    query: url ? Object.fromEntries(url.searchParams.entries()) : {},
    origin: req.headers.get("origin") || req.headers.get("Origin") || null,
    referer: req.headers.get("referer") || req.headers.get("Referer") || null,
    user_agent: req.headers.get("user-agent") || null,
    ip: req.headers.get("x-nf-client-connection-ip") || null,
    app_id: (req.headers.get("x-kaixu-app") || "").trim() || null,
    build_id: (req.headers.get("x-kaixu-build") || "").trim() || null
  };
}

export function serializeError(err) {
  const e = err || {};
  return {
    name: safeStr(e.name, 200),
    message: safeStr(e.message, 4000),
    code: safeStr(e.code, 200),
    status: Number.isFinite(e.status) ? e.status : null,
    hint: safeStr(e.hint, 2000),
    stack: safeStr(e.stack, 12000),
    upstream: e.upstream ? {
      provider: safeStr(e.upstream.provider, 50),
      status: Number.isFinite(e.upstream.status) ? e.upstream.status : null,
      body: safeStr(e.upstream.body, 12000),
      request_id: safeStr(e.upstream.request_id, 200),
      response_headers: e.upstream.response_headers || undefined
    } : undefined
  };
}

export function summarizeJsonBody(body) {
  // Safe summary; avoids logging full prompts by default.
  const b = body || {};
  const provider = (b.provider || "").toString().trim().toLowerCase() || null;
  const model = (b.model || "").toString().trim() || null;

  let messageCount = null;
  let totalChars = null;
  try {
    if (Array.isArray(b.messages)) {
      messageCount = b.messages.length;
      totalChars = b.messages.reduce((acc, m) => acc + String(m?.content ?? "").length, 0);
    }
  } catch {}

  return {
    provider,
    model,
    max_tokens: Number.isFinite(b.max_tokens) ? parseInt(b.max_tokens, 10) : null,
    temperature: typeof b.temperature === "number" ? b.temperature : null,
    message_count: messageCount,
    message_chars: totalChars
  };
}

/**
 * Best-effort monitor event: failures never break the main request.
 */
export async function emitEvent(ev) {
  try {
    const e = ev || {};
    const extra = e.extra || {};
    await q(
      `insert into gateway_events
        (request_id, level, kind, function_name, method, path, origin, referer, user_agent, ip,
         app_id, build_id, customer_id, api_key_id, provider, model, http_status, duration_ms,
         error_code, error_message, error_stack, upstream_status, upstream_body, extra)
       values
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         $11,$12,$13,$14,$15,$16,$17,$18,
         $19,$20,$21,$22,$23,$24,$25::jsonb)`,
      [
        safeStr(e.request_id, 200),
        safeStr(e.level || "info", 20),
        safeStr(e.kind || "event", 80),
        safeStr(e.function_name || "unknown", 120),
        safeStr(e.method, 20),
        safeStr(e.path, 500),
        safeStr(e.origin, 500),
        safeStr(e.referer, 800),
        safeStr(e.user_agent, 800),
        safeStr(e.ip, 200),

        safeStr(e.app_id, 200),
        safeStr(e.build_id, 200),
        Number.isFinite(e.customer_id) ? e.customer_id : null,
        Number.isFinite(e.api_key_id) ? e.api_key_id : null,
        safeStr(e.provider, 80),
        safeStr(e.model, 200),
        Number.isFinite(e.http_status) ? e.http_status : null,
        Number.isFinite(e.duration_ms) ? e.duration_ms : null,

        safeStr(e.error_code, 200),
        safeStr(e.error_message, 4000),
        safeStr(e.error_stack, 12000),
        Number.isFinite(e.upstream_status) ? e.upstream_status : null,
        safeStr(e.upstream_body, 12000),
        JSON.stringify(extra || {})
      ]
    );
  } catch (e) {
    console.warn("monitor emit failed:", e?.message || e);
  }
}
