/**
 * gateway-heartbeat.mjs
 *
 * Runs every 1 minute, 24/7 via Netlify scheduled functions.
 * Pings the gateway health endpoint, retries on failure, and writes
 * structured results to Netlify Blobs. No login or button press required.
 *
 * Stored keys:
 *   gateway:heartbeat:last     → latest result
 *   gateway:heartbeat:history  → last 1440 checks (24 h @ 1/min)
 *   gateway:heartbeat:failures → consecutive failure streak
 */

import { store } from "./_common.mjs";

// ── Config ──────────────────────────────────────────────────────────────────
const GATEWAY_URL = (process.env.GATEWAY_URL || "https://skyesol.netlify.app").replace(/\/$/, "");
const HEALTH_PATH = "/.netlify/functions/health";
const TIMEOUT_MS  = 10_000;
const MAX_RETRIES = 2;       // 3 total attempts before giving up
const RETRY_DELAY = 1_500;   // ms, scales × attempt number
const HISTORY_CAP = 1440;    // 24 h × 60 checks/h

// ── Error classification ─────────────────────────────────────────────────────
function classifyError(e) {
  if (!e) return "unknown";
  if (e.name === "AbortError") return "timeout";
  const msg = String(e?.message || "").toLowerCase();
  if (msg.includes("fetch failed") || msg.includes("econnrefused") || msg.includes("network")) return "network";
  if (msg.includes("dns") || msg.includes("getaddrinfo") || msg.includes("enotfound")) return "dns";
  return "error";
}

// ── Single ping ──────────────────────────────────────────────────────────────
async function pingOnce(timeoutMs) {
  const url   = GATEWAY_URL + HEALTH_PATH;
  const ctrl  = new AbortController();
  const tid   = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow", signal: ctrl.signal });
    const ms  = Date.now() - start;
    let body = null, parseErr = null;
    try { body = await res.json(); } catch (pe) { parseErr = pe?.message || "json_parse_error"; }
    const httpOk = res.status >= 200 && res.status < 400;
    const dbOk   = body?.db?.ok ?? null;
    return {
      ok:         httpOk && dbOk !== false,
      http_ok:    httpOk,
      db_ok:      dbOk,
      status:     res.status,
      ms,
      error:      !httpOk ? `HTTP ${res.status}` : (dbOk === false ? "db_down" : parseErr),
      error_type: !httpOk ? "http"               : (dbOk === false ? "db"       : (parseErr ? "parse" : null)),
      build:      body?.build || null,
    };
  } catch (e) {
    return {
      ok: false, http_ok: false, db_ok: null, status: null,
      ms:         Date.now() - start,
      error:      e?.name === "AbortError" ? `timeout (>${timeoutMs}ms)` : (e?.message || String(e)),
      error_type: classifyError(e),
      build:      null,
    };
  } finally {
    clearTimeout(tid);
  }
}

// ── Ping with retry + exponential back-off ────────────────────────────────────
async function pingWithRetry() {
  let last;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    last = await pingOnce(TIMEOUT_MS);
    if (last.ok) return { ...last, attempt };
    if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, RETRY_DELAY * (attempt + 1)));
  }
  return { ...last, attempt: MAX_RETRIES + 1 };
}

// ── Scheduled handler ─────────────────────────────────────────────────────────
export default async () => {
  const ts = new Date().toISOString();
  const s  = store();
  let result;

  try {
    result = await pingWithRetry();
  } catch (fatal) {
    result = { ok: false, http_ok: false, db_ok: null, status: null, ms: 0,
               attempt: 0, error: String(fatal?.message || fatal), error_type: "fatal", build: null };
  }

  const record = { ts, ...result };

  // Persist latest check
  try { await s.setJSON("gateway:heartbeat:last", record); }
  catch (e) { console.error("[gateway-heartbeat] write last:", e?.message || e); }

  // Rolling 24-h history
  try {
    const hist  = await s.getJSON("gateway:heartbeat:history").catch(() => null);
    const items = Array.isArray(hist?.items) ? hist.items : [];
    items.push(record);
    await s.setJSON("gateway:heartbeat:history", { updated_at: ts, items: items.slice(-HISTORY_CAP) });
  } catch (e) { console.error("[gateway-heartbeat] write history:", e?.message || e); }

  // Consecutive failure streak
  try {
    const prev   = await s.getJSON("gateway:heartbeat:failures").catch(() => null);
    const streak = result.ok ? 0 : ((prev?.streak || 0) + 1);
    await s.setJSON("gateway:heartbeat:failures", {
      streak,
      last_failure: result.ok ? (prev?.last_failure || null) : ts,
      last_ok:      result.ok ? ts : (prev?.last_ok || null),
    });
  } catch (e) { console.error("[gateway-heartbeat] write failures:", e?.message || e); }

  const log = `[gateway-heartbeat] ${ts} ok=${result.ok} status=${result.status} ms=${result.ms} type=${result.error_type || "—"} attempts=${result.attempt ?? 0}`;
  result.ok ? console.log(log) : console.error(log, "|", result.error);

  return new Response(JSON.stringify({ ok: true, ts, result }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};

// Every 1 minute, 24/7
export const config = {
  schedule: "* * * * *",
};
