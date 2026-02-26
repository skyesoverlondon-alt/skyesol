// netlify/functions/client-error-report.js
// Receives client-side error reports and logs them (server-side).
// This function is intentionally minimal and safe-by-default.

export async function handler(event) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type,x-kaixu-app,x-kaixu-build",
    "Access-Control-Allow-Methods": "POST,OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: "Method Not Allowed" }) };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const app = event.headers["x-kaixu-app"] || event.headers["X-Kaixu-App"] || "unknown";
    const build = event.headers["x-kaixu-build"] || event.headers["X-Kaixu-Build"] || "unknown";

    const record = {
      receivedAt: new Date().toISOString(),
      app,
      build,
      ip: event.headers["x-nf-client-connection-ip"] || null,
      report: body
    };

    // Log to Netlify function logs (view in Netlify dashboard).
    console.log("[client-error-report]", JSON.stringify(record));

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.log("[client-error-report] parse_error", String(err && err.message ? err.message : err));
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Bad Request" }) };
  }
}
