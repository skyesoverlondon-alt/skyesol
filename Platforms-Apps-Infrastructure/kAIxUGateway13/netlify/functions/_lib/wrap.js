import { buildCors, json } from "./http.js";
import { emitEvent, getRequestId, inferFunctionName, requestMeta, serializeError } from "./monitor.js";

function normalizeError(err) {
  const status = err?.status || 500;
  const code = err?.code || "SERVER_ERROR";
  const message = err?.message || "Unknown error";
  const hint = err?.hint;
  return { status, body: { error: message, code, ...(hint ? { hint } : {}) } };
}

function withRequestId(res, request_id) {
  try {
    const h = new Headers(res.headers || {});
    h.set("x-kaixu-request-id", request_id);
    return new Response(res.body, { status: res.status, headers: h });
  } catch {
    return res;
  }
}

async function safeBodyPreview(res) {
  try {
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const clone = res.clone();
    if (ct.includes("application/json")) {
      const data = await clone.json().catch(() => null);
      return data;
    }
    const t = await clone.text().catch(() => "");
    if (typeof t === "string" && t.length > 12000) return t.slice(0, 12000) + `…(+${t.length - 12000} chars)`;
    return t;
  } catch {
    return null;
  }
}

export function wrap(handler) {
  return async (req, context) => {
    const start = Date.now();
    const cors = buildCors(req);
    const request_id = getRequestId(req);
    const function_name = inferFunctionName(req);
    const meta = requestMeta(req);

    try {
      const res = await handler(req, cors, context);

      const duration_ms = Date.now() - start;
      const out = res instanceof Response ? withRequestId(res, request_id) : res;

      const status = out instanceof Response ? out.status : 200;
      const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      const kind = status >= 400 ? "http_error_response" : "http_response";

      let extra = {};
      if (status >= 400 && out instanceof Response) {
        extra.response = await safeBodyPreview(out);
      }
      if (duration_ms >= 15000) {
        extra.slow = true;
      }

      await emitEvent({
        request_id,
        level,
        kind,
        function_name,
        ...meta,
        http_status: status,
        duration_ms,
        extra
      });

      return out;
    } catch (err) {
      const duration_ms = Date.now() - start;

      // Best-effort detailed monitor record.
      const ser = serializeError(err);
      await emitEvent({
        request_id,
        level: "error",
        kind: "thrown_error",
        function_name,
        ...meta,
        provider: ser?.upstream?.provider || undefined,
        http_status: ser?.status || 500,
        duration_ms,
        error_code: ser?.code || "SERVER_ERROR",
        error_message: ser?.message || "Unknown error",
        error_stack: ser?.stack || null,
        upstream_status: ser?.upstream?.status || null,
        upstream_body: ser?.upstream?.body || null,
        extra: { error: ser }
      });

      // Avoid 502s: always return JSON.
      console.error("Function error:", err);
      const { status, body } = normalizeError(err);
      return json(status, { ...body, request_id }, { ...cors, "x-kaixu-request-id": request_id });
    }
  };
}
