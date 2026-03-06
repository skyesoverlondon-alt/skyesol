// netlify/functions/neon-health.js
// P13.1 — Neon connectivity ping via Neon Data API (PostgREST-compatible)
// Requires env:
//  - NEON_DATA_API_URL (e.g. https://your-data-api-endpoint)
//  - NEON_DATA_API_JWT (Bearer token; should include "sub" claim if RLS is enabled)

function mkHeaders() {
  return {
    "content-type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type,authorization,x-kaixu-app,x-kaixu-build",
    "Access-Control-Allow-Methods": "GET,OPTIONS"
  };
}

function json(statusCode, body) {
  return { statusCode, headers: mkHeaders(), body: JSON.stringify(body) };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: mkHeaders(), body: "" };
  if (event.httpMethod !== "GET") return json(405, { ok: false, error: "Method Not Allowed" });

  const base = process.env.NEON_DATA_API_URL;
  const jwt = process.env.NEON_DATA_API_JWT;

  if (!base || !jwt) {
    return json(500, {
      ok: false,
      error: "Missing Neon env vars",
      required: ["NEON_DATA_API_URL", "NEON_DATA_API_JWT"]
    });
  }

  const url = `${base.replace(/\/$/, "")}/rest/v1/blkaz_leads?select=id&limit=1`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${jwt}`,
        "Content-Type": "application/json"
      }
    });

    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }

    return json(200, { ok: res.ok, status: res.status, endpoint: url, sample: parsed });
  } catch (err) {
    return json(500, { ok: false, error: String(err && err.message ? err.message : err) });
  }
}
