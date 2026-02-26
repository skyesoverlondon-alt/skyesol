/**
 * kAIxuGateway13 Client (MANDATORY ROUTING)
 * Routes ALL AI calls through kAIxuGateway13.
 * - Non-stream: POST /api/gateway-chat  (redirects to skyesol gateway)
 * - Stream SSE: POST /api/gateway-stream
 * - Health:     GET  /api/health
 *
 * Authorization: Bearer <KAIXU_VIRTUAL_KEY>
 * Payload:
 * { provider, model, messages, max_tokens, temperature }
 */
(() => {
  "use strict";

  const KAIXU_GATEWAY_BASE = "https://skyesol.netlify.app";

  /* ── BroadcastChannel diagnostics (kAIxuGateway13 integration directive) ── */
  let diagChannel = null;
  try { diagChannel = new BroadcastChannel('kaixu_events'); } catch (_) {}

  function broadcastLog(source, payload) {
    try {
      const msg = { source, payload, app: 'kAIxU-PDF-Pro', timestamp: Date.now() };
      if (diagChannel) diagChannel.postMessage(msg);
    } catch (_) {}
  }

  const ENDPOINTS = {
    chat: "/.netlify/functions/gateway-chat",
    stream: "/.netlify/functions/gateway-stream",
    health: "/.netlify/functions/health"
  };

  function withBase(base, path) {
    if (!base) return path;
    return base.replace(/\/$/, "") + path;
  }

  async function fetchWithFallback(primary, fallback, opts) {
    try { return await fetch(primary, opts); }
    catch (e) {
      if (fallback && fallback !== primary) return await fetch(fallback, opts);
      throw e;
    }
  }

  async function kaixuHealth() {
    const primary = "/api/health";
    const fallback = withBase(KAIXU_GATEWAY_BASE, ENDPOINTS.health);
    const r = await fetchWithFallback(primary, fallback, { method: "GET" });
    return { ok: r.ok, status: r.status, text: await r.text() };
  }

  async function kaixuChat(kaixuKey, payload) {
    const primary = "/api/gateway-chat";
    const fallback = withBase(KAIXU_GATEWAY_BASE, ENDPOINTS.chat);

    broadcastLog('kaixuChat:request', { provider: payload.provider, model: payload.model });

    const r = await fetchWithFallback(primary, fallback, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Authorization": `Bearer ${kaixuKey || ""}`
      },
      body: JSON.stringify(payload)
    });

    const text = await r.text();
    let js = null;
    try { js = JSON.parse(text); } catch {}

    if (!r.ok) {
      const err = js || { status: r.status, body: text };
      err.status = err.status || r.status;
      broadcastLog('kaixuChat:error', { status: err.status });
      throw err;
    }
    if (!js) throw { status: r.status, error: "Invalid JSON from gateway", body: text };
    broadcastLog('kaixuChat:response', { status: r.status });
    return js;
  }

  function parseSSE(buffer) {
    const events = [];
    const parts = buffer.split("\n\n");
    const keep = parts.pop() || "";
    for (const chunk of parts) {
      const lines = chunk.split("\n").filter(Boolean);
      let event = "message";
      const dataLines = [];
      for (const ln of lines) {
        if (ln.startsWith("event:")) event = ln.slice(6).trim();
        else if (ln.startsWith("data:")) dataLines.push(ln.slice(5).trim());
      }
      events.push({ event, dataRaw: dataLines.join("\n") });
    }
    return { events, keep };
  }

  async function kaixuStreamChat(kaixuKey, payload, { onMeta, onDelta, onDone, onError } = {}) {
    const primary = "/api/gateway-stream";
    const fallback = withBase(KAIXU_GATEWAY_BASE, ENDPOINTS.stream);

    broadcastLog('kaixuStreamChat:request', { provider: payload.provider, model: payload.model });

    const r = await fetchWithFallback(primary, fallback, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Authorization": `Bearer ${kaixuKey || ""}`
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const text = await r.text().catch(()=> "");
      let js = null;
      try { js = JSON.parse(text); } catch {}
      const err = js || { status: r.status, body: text };
      err.status = err.status || r.status;
      broadcastLog('kaixuStreamChat:error', { status: err.status });
      if (onError) onError(err);
      throw err;
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let gotDone = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const parsed = parseSSE(buf);
      buf = parsed.keep;

      for (const e of parsed.events) {
        if (!e.dataRaw) continue;

        if (e.event === "meta") {
          let m = null; try { m = JSON.parse(e.dataRaw); } catch {}
          if (m && onMeta) onMeta(m);
        }

        if (e.event === "delta") {
          let d = null; try { d = JSON.parse(e.dataRaw); } catch {}
          const t = d && typeof d.text === "string" ? d.text : "";
          if (t && onDelta) onDelta(t);
        }

        if (e.event === "done") {
          let d = null; try { d = JSON.parse(e.dataRaw); } catch {}
          gotDone = true;
          if (d && onDone) onDone(d);
        }

        if (e.event === "error") {
          let er = null; try { er = JSON.parse(e.dataRaw); } catch {}
          if (onError) onError(er || { error: e.dataRaw });
        }
      }
    }

    if (!gotDone) {
      const err = { status: 500, error: "Stream ended without done event" };
      broadcastLog('kaixuStreamChat:error', { status: 500, reason: 'no_done_event' });
      if (onError) onError(err);
      throw err;
    }

    broadcastLog('kaixuStreamChat:done', { status: 200 });
    return true;
  }

  // Patch: proper gotDone and event dispatch (replaced after write)
  window.kAIxuGateway13 = { KAIXU_GATEWAY_BASE, kaixuHealth, kaixuChat, kaixuStreamChat };
})();
