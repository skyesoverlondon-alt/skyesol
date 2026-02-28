/* ══════════════════════════════════════════════
   kAIxu Gate Client v2.0
   All AI calls → https://kaixu67.skyesoverlondon.workers.dev
   Replaces /api/gateway-chat + /api/gateway-stream + kaixugateway13 fallbacks.

   ⚠ NOTE: Uses /v1/generate (NOT /v1/stream) for ALL calls.
   Netlify CDN buffers SSE responses, breaking streaming. The generate
   endpoint returns the complete response and is fully compatible with
   Netlify-hosted apps.

   API preserved:
     postToGateway(endpoints, payload)               → Response
     kaixuStreamChat(key, payload, callbacks)         → void (async)

   Payload auto-transform (old → new gate format):
     messages[{ role:'system' }] → top-level system field
     model: 'gemini-2.0-flash'  → 'gemini-2.5-flash'
     max_tokens, temperature     → generationConfig.*
     provider field              → stripped (not sent to gate)

   Streaming callbacks (onMeta / onDelta / onDone / onError):
     onMeta  → fires once with { provider, model } branding
     onDelta → fires once with full { text, label:'response' }
     onDone  → fires once with { result, usage }
     onError → fires on HTTP error or network failure
   ══════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const GATE_BASE  = 'https://kaixu67.skyesoverlondon.workers.dev';
  const GATE_MODEL = 'gemini-2.5-flash';

  /* ──────────────────────────────────────────────────────────
     Internal: transform old multi-key payload → gate v2 body
     ────────────────────────────────────────────────────────── */
  function buildGateBody(payload) {
    const msgs    = payload.messages || [];
    const sysMsg  = msgs.find(m => m.role === 'system');
    const userMsgs = msgs.filter(m => m.role !== 'system');

    // Upgrade model name
    let model = payload.model || GATE_MODEL;
    if (model === 'gemini-2.0-flash' || model === 'skAIxU Flow6.7') {
      model = GATE_MODEL;
    }

    const body = {
      model,
      generationConfig: {
        temperature:     payload.temperature != null ? payload.temperature : 0.7,
        maxOutputTokens: payload.max_tokens  || 8192
      }
    };

    if (sysMsg)           body.system   = sysMsg.content;
    if (userMsgs.length)  body.messages = userMsgs;
    else if (payload.input) body.input  = payload.input;

    return body;
  }

  /* ──────────────────────────────────────────────────────────
     postToGateway(endpoints, payload)
     Drop-in for the old helper. Ignores endpoint list — always
     calls the gate. Returns a native Response object so existing
     handleNonStreamResponse status-code checks continue to work.
     ────────────────────────────────────────────────────────── */
  async function postToGateway(_endpoints, payload) {
    const key = (typeof kaixuKey === 'string' && kaixuKey.trim())
              || localStorage.getItem('kaixu_virtual_key')
              || '';

    return fetch(`${GATE_BASE}/v1/generate`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(buildGateBody(payload))
    });
  }

  /* ──────────────────────────────────────────────────────────
     kaixuStreamChat(key, payload, callbacks)
     Drop-in for the old SSE streaming helper.
     Uses /v1/generate (blocking) instead of /v1/stream because
     Netlify CDN buffers the entire SSE response before delivering
     it, which breaks streaming. The full response is then emitted
     as a single onDelta chunk and onDone is called immediately.
     ────────────────────────────────────────────────────────── */
  async function kaixuStreamChat(
    key,
    payload,
    { controller, onMeta, onDelta, onDone, onError, onAbort } = {}
  ) {
    const signal = controller?.signal;
    if (signal && onAbort) {
      signal.addEventListener('abort', () => onAbort(), { once: true });
    }

    let res;
    try {
      res = await fetch(`${GATE_BASE}/v1/generate`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${key}`
        },
        body:   JSON.stringify(buildGateBody(payload)),
        signal
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        onError?.({ code: 'abort', message: 'Stream aborted' });
      } else {
        onError?.({ code: 'network', message: err.message || 'Network error' });
      }
      return;
    }

    // HTTP error gate — same status codes as old gateway
    if (res.status === 401) { onError?.({ code: 401, message: 'Invalid gate token — check your kAIxu key.' }); return; }
    if (res.status === 402) { onError?.({ code: 402, message: 'Monthly cap reached' }); return; }
    if (res.status === 429) { onError?.({ code: 429, message: 'Rate limited — retry shortly' }); return; }
    if (res.status >= 500)  { onError?.({ code: res.status, message: `Gateway error ${res.status}` }); return; }
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      onError?.({ code: res.status, message: errBody || `HTTP ${res.status}` });
      return;
    }

    let data;
    try {
      data = await res.json();
    } catch {
      onError?.({ code: 'parse', message: 'Could not parse gate response' });
      return;
    }

    if (!data.ok) {
      onError?.({ message: data.error || 'Gate returned ok:false' });
      return;
    }

    // Synthetic meta — branding consistent; no budget data in gate v2
    onMeta?.({ provider: 'Skyes Over London', model: data.model || GATE_MODEL });

    // Full response as one delta chunk (UI renders as normal text)
    if (data.text) onDelta?.({ text: data.text, label: 'response' });

    // Done — usage is { promptTokens, candidatesTokens, totalTokens }
    onDone?.({ result: data.text, usage: data.usage });
  }

  /* ──────────────────────────────────────────────────────────
     Expose as window globals.
     kaixuGate namespace is unique — app local functions can
     delegate to it without shadowing issues:
       async function postToGateway(e, p) { return kaixuGate.generate(e, p); }
       async function kaixuStreamChat(k, p, cb) { return kaixuGate.streamChat(k, p, cb); }
     ────────────────────────────────────────────────────────── */
  global.KAIXU_GATE_BASE  = GATE_BASE;
  global.KAIXU_GATE_MODEL = GATE_MODEL;
  global.postToGateway    = postToGateway;    // may be shadowed by app-local — use kaixuGate.generate instead
  global.kaixuStreamChat  = kaixuStreamChat;  // may be shadowed by app-local — use kaixuGate.streamChat instead
  global.kaixuGate = {
    generate:   postToGateway,
    streamChat: kaixuStreamChat,
    buildBody:  buildGateBody,
    BASE:       GATE_BASE,
    MODEL:      GATE_MODEL
  };

})(window);
