/**
 * kAIxU inference gateway (server-side).
 * - Keeps KAIXU_VIRTUAL_KEY on the server (Netlify env var)
 * - Routes ALL AI calls through kAIxuGateway13 (no direct provider calls)
 * - UI never exposes provider details; UI only says "kAIxU"
 */
exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };

  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ ok: false, error: "Method Not Allowed" }),
      };
    }

    // Back-compat: KAIXU_API_KEY previously meant a provider key in older builds.
    // Going forward, we treat it as a Kaixu Gateway virtual key if KAIXU_VIRTUAL_KEY is not set.
    const kaixuVirtualKey = (process.env.KAIXU_VIRTUAL_KEY || process.env.KAIXU_API_KEY || "").trim();
    if (!kaixuVirtualKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          ok: false,
          error: "Missing server environment variable: KAIXU_VIRTUAL_KEY",
        }),
      };
    }

    const body = safeJson(event.body);
    const prompt = (body?.prompt || "").trim();
    const mode = (body?.mode || "general").trim();
    const intensity = (body?.intensity || "balanced").trim(); // rapid | balanced | deep
    const maxTokens = clampInt(body?.maxTokens, 128, 2048, 900);
    const temperature = clampFloat(body?.temperature, 0.0, 1.2, 0.7);

    if (!prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: "Missing prompt" }),
      };
    }

    // Model mapping lives server-side (override with KAIXU_MODEL if desired).
    // Default is aligned with Gateway13 smoke tests.
    const overrideModel = (process.env.KAIXU_MODEL || "").trim();
    const model = overrideModel || "gemini-2.5-flash";

    // IMPORTANT: Do not silently default to an old gateway origin.
    // Set this explicitly in the BrandKit site environment.
    // Expected (current) deployment: https://skyesol.netlify.app
    const gatewayBaseRaw = (process.env.KAIXU_GATEWAY_BASE || process.env.KAIXU_GATEWAY_ORIGIN || "").trim();
    if (!gatewayBaseRaw) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          ok: false,
          error: "Missing server environment variable: KAIXU_GATEWAY_BASE",
          hint: "Set KAIXU_GATEWAY_BASE=https://skyesol.netlify.app",
        }),
      };
    }

    const gatewayBase = gatewayBaseRaw.replace(/\/$/, "");
    const url = `${gatewayBase}/.netlify/functions/gateway-chat`;

    // JSON-only response contract (helps reliable parsing).
    const systemBlock =
      `You are kAIxU — the internal creative engine for SkyesOverLondon.\n` +
      `Return STRICT JSON only. No markdown. No commentary.\n` +
      `Always follow this JSON envelope shape:\n` +
      `{\n` +
      `  "ok": true,\n` +
      `  "mode": "${escapeJson(mode)}",\n` +
      `  "names": [],\n` +
      `  "taglines": [],\n` +
      `  "bannerCopy": [],\n` +
      `  "palette": [{"label":"","hex":""}],\n` +
      `  "notes": ""\n` +
      `}\n`;

    // IMPORTANT: ALL inference goes through the Kaixu Gateway.
    // The gateway enforces its own canonical system prompt; this systemBlock adds JSON-only constraints.
    const payload = {
      provider: "gemini",
      model,
      messages: [
        { role: "system", content: systemBlock },
        { role: "user", content: `REQUEST:\n${prompt}` },
      ],
      max_tokens: maxTokens,
      temperature,
    };

    const installId = (event.headers?.["x-kaixu-install-id"] || event.headers?.["X-Kaixu-Install-Id"] || "").toString().trim();
    const appId = (event.headers?.["x-kaixu-app"] || event.headers?.["X-Kaixu-App"] || "kAIxUBrandKit").toString().trim();
    const buildId = (event.headers?.["x-kaixu-build"] || event.headers?.["X-Kaixu-Build"] || "v1").toString().trim();

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${kaixuVirtualKey}`,
        ...(installId ? { "x-kaixu-install-id": installId } : {}),
        "x-kaixu-app": appId,
        "x-kaixu-build": buildId,
      },
      body: JSON.stringify(payload),
    });

    const raw = await resp.text();

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers,
        body: JSON.stringify({
          ok: false,
          error: "kAIxU inference failed",
          status: resp.status,
          details: safeTrim(raw, 1200),
        }),
      };
    }

    const data = safeJson(raw);
    const text = (data && typeof data.output_text === "string") ? data.output_text : "";

    const extracted = extractJsonObject(text);
    if (extracted) {
      const parsed = safeJson(extracted);
      if (parsed && typeof parsed === "object") {
        parsed.ok = true;
        parsed.mode = parsed.mode || mode;
        parsed.names = Array.isArray(parsed.names) ? parsed.names : [];
        parsed.taglines = Array.isArray(parsed.taglines) ? parsed.taglines : [];
        parsed.bannerCopy = Array.isArray(parsed.bannerCopy) ? parsed.bannerCopy : [];
        parsed.palette = Array.isArray(parsed.palette) ? parsed.palette : [];
        parsed.notes = typeof parsed.notes === "string" ? parsed.notes : "";
        return { statusCode: 200, headers, body: JSON.stringify(parsed) };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        mode,
        names: [],
        taglines: [],
        bannerCopy: [],
        palette: [],
        notes: text || "",
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        error: "Server error",
        details: String(err?.message || err),
      }),
    };
  }
};

function safeJson(s) {
  try { return JSON.parse(s || "{}"); } catch { return null; }
}
function safeTrim(s, max) {
  const t = String(s || "");
  return t.length > max ? t.slice(0, max) + "…" : t;
}
function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return Math.max(min, Math.min(max, i));
}
function clampFloat(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function extractJsonObject(text) {
  const t = String(text || "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return t.slice(start, end + 1);
}
function escapeJson(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
