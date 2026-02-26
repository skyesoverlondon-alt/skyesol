export function buildCors(req) {
  const allowRaw = (process.env.ALLOWED_ORIGINS || "").trim();
  const reqOrigin = req.headers.get("origin") || req.headers.get("Origin");

  // IMPORTANT: keep this list aligned with whatever headers your apps send.
  const allowHeaders = "authorization, content-type, x-kaixu-install-id, x-kaixu-request-id, x-kaixu-app, x-kaixu-build, x-admin-password, x-kaixu-error-token, x-kaixu-mode, x-content-sha1, x-setup-secret, x-kaixu-job-secret, x-job-worker-secret";
  const allowMethods = "GET,POST,PUT,PATCH,DELETE,OPTIONS";

  const base = {
    "access-control-allow-headers": allowHeaders,
    "access-control-allow-methods": allowMethods,
    "access-control-expose-headers": "x-kaixu-request-id",
    "access-control-max-age": "86400"
  };

  // STRICT BY DEFAULT:
  // - If ALLOWED_ORIGINS is unset/blank and a browser Origin is present, we do NOT grant CORS.
  // - Allow-all is only enabled when ALLOWED_ORIGINS explicitly contains "*".
  if (!allowRaw) {
    // No allow-origin granted. Server-to-server requests (no Origin header) still work normally.
    return {
      ...base,
      ...(reqOrigin ? { vary: "Origin" } : {})
    };
  }

  const allowed = allowRaw.split(",").map((s) => s.trim()).filter(Boolean);

  // Explicit allow-all
  if (allowed.includes("*")) {
    const origin = reqOrigin || "*";
    return {
      ...base,
      "access-control-allow-origin": origin,
      ...(reqOrigin ? { vary: "Origin" } : {})
    };
  }

  // Exact-match allowlist
  if (reqOrigin && allowed.includes(reqOrigin)) {
    return {
      ...base,
      "access-control-allow-origin": reqOrigin,
      vary: "Origin"
    };
  }

  // Origin present but not allowed: do not grant allow-origin.
  return {
    ...base,
    ...(reqOrigin ? { vary: "Origin" } : {})
  };
}


export function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

export function text(status, body, headers = {}) {
  return new Response(body, { status, headers });
}

export function badRequest(message, headers = {}) {
  return json(400, { error: message }, headers);
}

export function getBearer(req) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

export function monthKeyUTC(d = new Date()) {
  return d.toISOString().slice(0, 7); // YYYY-MM
}

export function getInstallId(req) {
  return (
    req.headers.get("x-kaixu-install-id") ||
    req.headers.get("X-Kaixu-Install-Id") ||
    ""
  ).toString().trim().slice(0, 80) || null;
}

export function getUserAgent(req) {
  return (req.headers.get("user-agent") || req.headers.get("User-Agent") || "").toString().slice(0, 240);
}

export function getClientIp(req) {
  // Netlify adds x-nf-client-connection-ip when deployed (may be missing in netlify dev).
  const a = (req.headers.get("x-nf-client-connection-ip") || "").toString().trim();
  if (a) return a;

  // Fallback to first X-Forwarded-For entry.
  const xff = (req.headers.get("x-forwarded-for") || "").toString();
  if (!xff) return null;
  const first = xff.split(",")[0].trim();
  return first || null;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}