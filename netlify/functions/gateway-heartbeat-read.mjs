/**
 * gateway-heartbeat-read.mjs
 *
 * Public GET endpoint — returns the stored gateway heartbeat data.
 * No authentication required; exposes server health status only.
 *
 * GET /.netlify/functions/gateway-heartbeat-read
 *   ?history=1   → include full 24-h history
 */

import { store } from "./_common.mjs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const wantHistory = url.searchParams.get("history") === "1";

  const s = store();
  const last = await s.getJSON("gateway:heartbeat:last").catch(() => null);
  const failures = await s.getJSON("gateway:heartbeat:failures").catch(() => null);

  const payload = { ok: true, last: last ?? null, failures: failures ?? null };
  if (wantHistory) {
    const hist = await s.getJSON("gateway:heartbeat:history").catch(() => null);
    payload.history = hist ?? { items: [] };
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
};
