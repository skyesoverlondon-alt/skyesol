import { sleep } from "./http.js";
import { encodeURIComponentSafePath } from "./pushPath.js";

const API = "https://api.netlify.com/api/v1";

function token(netlify_token) {
  const t = (netlify_token || process.env.NETLIFY_AUTH_TOKEN || "").toString().trim();
  if (!t) {
    const err = new Error("Missing Netlify token");
    err.code = "CONFIG";
    err.status = 500;
    err.hint = "Set a per-customer Netlify token (recommended) or set NETLIFY_AUTH_TOKEN in Netlify env vars.";
    throw err;
  }
  return t;
}

async function nfFetch(url, init = {}, netlify_token = null) {
  const method = ((init.method || "GET") + "").toUpperCase();
  const body = init.body;

  const isWebReadableStream = body && typeof body === "object" && typeof body.getReader === "function";
  const isBuffer = typeof Buffer !== "undefined" && Buffer.isBuffer(body);
  const isUint8 = body instanceof Uint8Array;
  const isArrayBuffer = body instanceof ArrayBuffer;
  const isString = typeof body === "string";

  // Only retry idempotent-ish requests where the body can be safely replayed.
  // - GET/HEAD: safe
  // - PUT with Buffer/Uint8Array/ArrayBuffer/string: safe-ish
  // - Streams: NOT safely replayable, so no retries.
  const canReplayBody = !body || isBuffer || isUint8 || isArrayBuffer || isString;
  const canRetry = (method === "GET" || method === "HEAD" || (method === "PUT" && canReplayBody)) && !isWebReadableStream;

  const maxAttempts = canRetry ? 5 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const headers = {
      authorization: `Bearer ${token(netlify_token)}`,
      ...(init.headers || {})
    };

    let res;
    let text = "";
    let data = null;

    try {
      res = await fetch(url, { ...init, headers });
      text = await res.text();
      try { data = JSON.parse(text); } catch {}
    } catch (e) {
      // Network-level failure; retry if allowed.
      if (canRetry && attempt < maxAttempts) {
        const backoff = Math.min(8000, 250 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 150));
        await sleep(backoff);
        continue;
      }
      const err = new Error("Netlify API fetch failed");
      err.code = "NETLIFY_FETCH";
      err.status = 502;
      err.detail = String(e && e.message ? e.message : e);
      throw err;
    }

    if (res.ok) return data ?? text;

    const status = res.status;
    const retryable = status === 429 || status === 502 || status === 503 || status === 504;

    if (canRetry && retryable && attempt < maxAttempts) {
      // Respect Retry-After if present (seconds).
      const ra = res.headers.get("retry-after");
      let waitMs = 0;
      const sec = ra ? parseInt(ra, 10) : NaN;
      if (Number.isFinite(sec) && sec >= 0) waitMs = Math.min(15000, sec * 1000);
      if (!waitMs) waitMs = Math.min(15000, 300 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200));
      await sleep(waitMs);
      continue;
    }

    const err = new Error(`Netlify API error ${status}`);
    err.code = "NETLIFY_API";
    err.status = status;
    err.detail = data || text;
    throw err;
  }
}
export async function createDigestDeploy({ site_id, branch, title, files, netlify_token = null }) {
  const cleanFiles = {};
  for (const [p, sha] of Object.entries(files || {})) {
    const k = (p && p[0] === "/") ? p.slice(1) : String(p || "");
    if (k) cleanFiles[k] = sha;
  }
  const filesForNetlify = cleanFiles;
  const qs = new URLSearchParams();
  if (branch) qs.set("branch", branch);
  if (title) qs.set("title", title);
  const url = `${API}/sites/${encodeURIComponent(site_id)}/deploys?${qs.toString()}`;
  return nfFetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ async: true, draft: false, files: filesForNetlify })
  }, netlify_token);
}

export async function getSiteDeploy({ site_id, deploy_id, netlify_token = null }) {
  const url = `${API}/sites/${encodeURIComponent(site_id)}/deploys/${encodeURIComponent(deploy_id)}`;
  return nfFetch(url, { method: "GET" }, netlify_token);
}

export async function getDeploy({ deploy_id, netlify_token = null }) {
  const url = `${API}/deploys/${encodeURIComponent(deploy_id)}`;
  return nfFetch(url, { method: "GET" }, netlify_token);
}

export async function putDeployFile({ deploy_id, deploy_path, body, netlify_token = null }) {
  const encoded = encodeURIComponentSafePath(deploy_path);
  const url = `${API}/deploys/${encodeURIComponent(deploy_id)}/files/${encoded}`;
  return nfFetch(url, {
    method: "PUT",
    headers: { "content-type": "application/octet-stream" },
    body,
    duplex: "half"
  }, netlify_token);
}

export async function pollDeployUntil({ site_id, deploy_id, timeout_ms = 60000, netlify_token = null }) {
  const start = Date.now();
  let d = await getSiteDeploy({ site_id, deploy_id, netlify_token });
  while (Date.now() - start < timeout_ms) {
    const st = d?.state || "";
    const hasReq = Array.isArray(d?.required) && d.required.length > 0;
    if (st === "ready" || st === "error" || hasReq || (st && st !== "preparing")) return d;
    await sleep(1200);
    d = await getSiteDeploy({ site_id, deploy_id, netlify_token });
  }
  return d;
}
