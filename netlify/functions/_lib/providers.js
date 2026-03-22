import { TextDecoder } from "util";

function configError(message, hint) {
  const err = new Error(message);
  err.code = "CONFIG";
  err.status = 500;
  if (hint) err.hint = hint;
  return err;
}


function safeJsonString(v, max = 12000) {
  try {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    if (!s) return "";
    if (s.length <= max) return s;
    return s.slice(0, max) + `…(+${s.length - max} chars)`;
  } catch {
    const s = String(v || "");
    if (s.length <= max) return s;
    return s.slice(0, max) + `…(+${s.length - max} chars)`;
  }
}

function upstreamError(provider, res, body) {
  const status = res?.status || 0;
  const reqId =
    res?.headers?.get?.("x-request-id") ||
    res?.headers?.get?.("request-id") ||
    res?.headers?.get?.("x-amzn-requestid") ||
    null;

  // Try to surface the most meaningful provider message.
  let msg = "";
  try {
    msg = body?.error?.message || body?.error?.type || body?.message || "";
  } catch {}
  const err = new Error(msg ? `${provider} upstream error ${status}: ${msg}` : `${provider} upstream error ${status}`);
  err.code = "UPSTREAM_ERROR";
  err.status = 502;
  err.upstream = {
    provider,
    status,
    request_id: reqId,
    body: safeJsonString(body)
  };
  return err;
}

/**
 * Non-stream calls
 */
export async function callOpenAI({ model, messages, max_tokens, temperature }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw configError("OPENAI_API_KEY not configured", "Set OPENAI_API_KEY in Netlify → Site configuration → Environment variables (your OpenAI API key).");

  const input = Array.isArray(messages) ? messages.map(m => ({
    role: m.role,
    content: [{ type: "input_text", text: String(m.content ?? "") }]
  })) : [];

  const body = {
    model,
    input,
    temperature: typeof temperature === "number" ? temperature : 1,
    max_output_tokens: typeof max_tokens === "number" ? max_tokens : 1024,
    store: false
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(()=> ({}));
  if (!res.ok) throw upstreamError("openai", res, data);

  let out = "";
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (item?.type === "message" && Array.isArray(item.content)) {
      for (const c of item.content) {
        if (c?.type === "output_text" && typeof c.text === "string") out += c.text;
      }
    }
  }

  const usage = data.usage || {};
  return { output_text: out, input_tokens: usage.input_tokens || 0, output_tokens: usage.output_tokens || 0, raw: data };
}

export async function callAnthropic({ model, messages, max_tokens, temperature }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw configError("ANTHROPIC_API_KEY not configured", "Set ANTHROPIC_API_KEY in Netlify → Site configuration → Environment variables (your Anthropic API key).");

  const systemParts = [];
  const outMsgs = [];

  const msgs = Array.isArray(messages) ? messages : [];
  for (const m of msgs) {
    const role = String(m.role || "").toLowerCase();
    const text = String(m.content ?? "");
    if (!text) continue;
    if (role === "system" || role === "developer") systemParts.push(text);
    else if (role === "assistant") outMsgs.push({ role: "assistant", content: text });
    else outMsgs.push({ role: "user", content: text });
  }

  const body = {
    model,
    max_tokens: typeof max_tokens === "number" ? max_tokens : 1024,
    temperature: typeof temperature === "number" ? temperature : 1,
    messages: outMsgs
  };
  if (systemParts.length) body.system = systemParts.join("\n\n");

const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(()=> ({}));
  if (!res.ok) throw upstreamError("anthropic", res, data);

  const text = Array.isArray(data?.content) ? data.content.map(c => c?.text || "").join("") : (data?.content?.[0]?.text || data?.completion || "");
  const usage = data?.usage || {};
  return { output_text: text, input_tokens: usage.input_tokens || 0, output_tokens: usage.output_tokens || 0, raw: data };
}

export async function callGemini({ model, messages, max_tokens, temperature }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw configError("GEMINI_API_KEY not configured", "Set GEMINI_API_KEY in Netlify → Site configuration → Environment variables (your Google AI Studio / Gemini API key).");

  const systemParts = [];
  const contents = [];

  const msgs = Array.isArray(messages) ? messages : [];
  for (const m of msgs) {
    const role = m.role;
    const text = String(m.content ?? "");
    if (role === "system") systemParts.push(text);
    else if (role === "assistant") contents.push({ role: "model", parts: [{ text }] });
    else contents.push({ role: "user", parts: [{ text }] });
  }

  const body = {
    contents,
    generationConfig: {
      maxOutputTokens: typeof max_tokens === "number" ? max_tokens : 1024,
      temperature: typeof temperature === "number" ? temperature : 1
    }
  };
  if (systemParts.length) body.systemInstruction = { parts: [{ text: systemParts.join("\n\n") }] };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(()=> ({}));
  if (!res.ok) throw upstreamError("gemini", res, data);

  let out = "";
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  for (const cand of candidates) {
    const content = cand?.content;
    if (content?.parts) for (const p of content.parts) if (typeof p.text === "string") out += p.text;
    if (out) break;
  }

  const usage = data.usageMetadata || {};
  return { output_text: out, input_tokens: usage.promptTokenCount || 0, output_tokens: usage.candidatesTokenCount || 0, raw: data };
}

/**
 * Gemini Embedding — calls /v1beta/models/{model}:embedContent
 * Returns { embedding: number[], input_tokens: number }
 */
export async function callGeminiEmbed({ model, input, taskType, title, outputDimensionality }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw configError("GEMINI_API_KEY not configured", "Set GEMINI_API_KEY in Netlify → Site configuration → Environment variables (your Google AI Studio / Gemini API key).");

  const body = {
    content: { parts: [{ text: String(input ?? "") }] }
  };
  if (taskType) body.taskType = String(taskType);
  if (title) body.title = String(title);
  if (Number.isFinite(outputDimensionality) && outputDimensionality > 0) body.outputDimensionality = outputDimensionality;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw upstreamError("gemini", res, data);

  const values = data?.embedding?.values;
  if (!Array.isArray(values)) throw new Error("Gemini embed response missing embedding.values");

  // Gemini embedContent doesn't return token counts per-request in v1beta,
  // so we approximate: ~4 chars per token (conservative).
  const approxTokens = Math.max(1, Math.ceil(String(input ?? "").length / 4));

  return { embedding: values, dimensions: values.length, input_tokens: approxTokens };
}

/**
 * Stream adapters:
 * Each returns { upstream: Response, parseChunk(text)->{deltaText, done, usage?}[] }.
 * We normalize into SSE events for the client: "delta" and "done".
 */

export async function streamOpenAI({ model, messages, max_tokens, temperature }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw configError("OPENAI_API_KEY not configured", "Set OPENAI_API_KEY in Netlify → Site configuration → Environment variables (your OpenAI API key).");

  const input = Array.isArray(messages) ? messages.map(m => ({
    role: m.role,
    content: [{ type: "input_text", text: String(m.content ?? "") }]
  })) : [];

  const body = {
    model,
    input,
    temperature: typeof temperature === "number" ? temperature : 1,
    max_output_tokens: typeof max_tokens === "number" ? max_tokens : 1024,
    store: false,
    stream: true
  };

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json",
      "accept": "text/event-stream"
    },
    body: JSON.stringify(body)
  });

  if (!upstream.ok) {
    const data = await upstream.json().catch(()=> ({}));
    throw new Error(data?.error?.message || `OpenAI error ${upstream.status}`);
  }

  // Parse OpenAI SSE lines: data: {json}
  function parseSseLines(chunkText) {
    const out = [];
    const lines = chunkText.split(/\r?\n/);
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload);
        const t = obj.type || "";
        if (t.includes("output_text.delta") && typeof obj.delta === "string") out.push({ type: "delta", text: obj.delta });
        if (t === "response.completed" || t === "response.complete" || t.includes("response.completed")) {
          const usage = obj.response?.usage || obj.usage || {};
          out.push({ type: "done", usage: { input_tokens: usage.input_tokens || 0, output_tokens: usage.output_tokens || 0 } });
        }
      } catch {}
    }
    return out;
  }

  return { upstream, parse: parseSseLines };
}

export async function streamAnthropic({ model, messages, max_tokens, temperature }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw configError("ANTHROPIC_API_KEY not configured", "Set ANTHROPIC_API_KEY in Netlify → Site configuration → Environment variables (your Anthropic API key).");

  const systemParts = [];
  const outMsgs = [];

  const msgs = Array.isArray(messages) ? messages : [];
  for (const m of msgs) {
    const role = String(m.role || "").toLowerCase();
    const text = String(m.content ?? "");
    if (!text) continue;
    if (role === "system" || role === "developer") systemParts.push(text);
    else if (role === "assistant") outMsgs.push({ role: "assistant", content: text });
    else outMsgs.push({ role: "user", content: text });
  }

  const body = {
    model,
    max_tokens: typeof max_tokens === "number" ? max_tokens : 1024,
    temperature: typeof temperature === "number" ? temperature : 1,
    stream: true,
    messages: outMsgs
  };
  if (systemParts.length) body.system = systemParts.join("\n\n");

const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "accept": "text/event-stream"
    },
    body: JSON.stringify(body)
  });

  if (!upstream.ok) {
    const data = await upstream.json().catch(()=> ({}));
    throw new Error(data?.error?.message || `Anthropic error ${upstream.status}`);
  }

  function parseSseLines(chunkText) {
    const out = [];
    const lines = chunkText.split(/\r?\n/);
    // Anthropic SSE uses "event:" and "data:" lines; we parse data json
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload);
        const t = obj.type || "";
        if (t === "content_block_delta" && obj.delta?.type === "text_delta" && typeof obj.delta.text === "string") {
          out.push({ type: "delta", text: obj.delta.text });
        }
        if (t === "message_delta" && obj.usage) {
          // intermediate usage sometimes
        }
        if (t === "message_stop" || t === "message_end" || t === "message_complete") {
          const usage = obj.usage || {};
          out.push({ type: "done", usage: { input_tokens: usage.input_tokens || 0, output_tokens: usage.output_tokens || 0 } });
        }
      } catch {}
    }
    return out;
  }

  return { upstream, parse: parseSseLines };
}

export async function streamGemini({ model, messages, max_tokens, temperature }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw configError("GEMINI_API_KEY not configured", "Set GEMINI_API_KEY in Netlify → Site configuration → Environment variables (your Google AI Studio / Gemini API key).");

  const systemParts = [];
  const contents = [];
  const msgs = Array.isArray(messages) ? messages : [];
  for (const m of msgs) {
    const role = m.role;
    const text = String(m.content ?? "");
    if (role === "system") systemParts.push(text);
    else if (role === "assistant") contents.push({ role: "model", parts: [{ text }] });
    else contents.push({ role: "user", parts: [{ text }] });
  }

  const body = {
    contents,
    generationConfig: {
      maxOutputTokens: typeof max_tokens === "number" ? max_tokens : 1024,
      temperature: typeof temperature === "number" ? temperature : 1
    }
  };
  if (systemParts.length) body.systemInstruction = { parts: [{ text: systemParts.join("\n\n") }] };

  // streaming endpoint
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent`;
  const upstream = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!upstream.ok) {
    const data = await upstream.json().catch(()=> ({}));
    throw upstreamError("gemini", upstream, data);
  }

  // Gemini stream is typically newline-delimited JSON objects (not SSE).
  function parseNdjson(chunkText) {
    const out = [];
    const parts = chunkText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      try {
        const obj = JSON.parse(p);
        // Extract delta-ish text if present
        const candidates = Array.isArray(obj.candidates) ? obj.candidates : [];
        for (const cand of candidates) {
          const content = cand?.content;
          if (content?.parts) {
            for (const part of content.parts) {
              if (typeof part.text === "string" && part.text) out.push({ type: "delta", text: part.text });
            }
          }
        }
        const usage = obj.usageMetadata;
        if (usage && (usage.promptTokenCount || usage.candidatesTokenCount)) {
          // no reliable "done" marker; we will emit done at stream end using last-seen usage
          out.push({ type: "usage", usage: { input_tokens: usage.promptTokenCount || 0, output_tokens: usage.candidatesTokenCount || 0 } });
        }
      } catch {}
    }
    return out;
  }

  return { upstream, parse: parseNdjson, isNdjson: true };
}
