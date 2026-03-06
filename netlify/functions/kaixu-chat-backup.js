const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-kaixu-app, x-kaixu-build",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...extraHeaders },
    body: JSON.stringify(body)
  };
}

function parseBody(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function normalizeMessages(body) {
  if (Array.isArray(body.messages) && body.messages.length) {
    return body.messages
      .map((m) => ({ role: m.role || "user", content: String(m.content || "") }))
      .filter((m) => m.content.trim().length > 0);
  }

  const prompt = String(body.prompt || body.input || "").trim();
  if (!prompt) return [];
  return [{ role: "user", content: prompt }];
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const apiKey = process.env.KAIXU_BACKUP_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(503, {
      ok: false,
      error: "Backup brain is off (missing KAIXU_BACKUP_OPENAI_API_KEY or OPENAI_API_KEY)."
    }, { "x-kaixu-backup": "off" });
  }

  const body = parseBody(event.body);
  const model = String(body.model || process.env.KAIXU_BACKUP_MODEL || "gpt-4o-mini").trim();
  const temperature = typeof body.temperature === "number" ? body.temperature : 0.7;
  const max_tokens = Number(body.max_tokens || body.maxTokens || 900);
  const messages = normalizeMessages(body);

  if (!messages.length) {
    return json(400, { ok: false, error: "Missing prompt or messages[]" }, { "x-kaixu-backup": "on" });
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens
      })
    });

    const text = await upstream.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!upstream.ok) {
      return json(upstream.status, {
        ok: false,
        error: data?.error?.message || "Backup provider request failed",
        provider: "openai",
        model
      }, { "x-kaixu-backup": "on" });
    }

    const content = data?.choices?.[0]?.message?.content || "";

    return json(200, {
      ok: true,
      provider: "openai",
      lane: "kaixu-chat-backup",
      model: data?.model || model,
      text: content,
      usage: data?.usage || null,
      raw: data
    }, { "x-kaixu-backup": "on" });
  } catch (err) {
    return json(502, {
      ok: false,
      error: String(err?.message || err),
      provider: "openai",
      model
    }, { "x-kaixu-backup": "on" });
  }
};
