import { sleep } from "./http.js";

function base() {
  return (process.env.GITHUB_API_BASE || "https://api.github.com").trim() || "https://api.github.com";
}

function apiVersion() {
  return (process.env.GITHUB_API_VERSION || "2022-11-28").trim() || "2022-11-28";
}

function parseRetryAfter(h) {
  const ra = h.get("retry-after");
  if (!ra) return null;
  const n = parseInt(ra, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseRateResetSeconds(h) {
  const reset = h.get("x-ratelimit-reset");
  if (!reset) return null;
  const n = parseInt(reset, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, n - now);
}

export class GitHubApiError extends Error {
  constructor(message, status, code, meta = {}) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
}

export async function ghFetch({ token, method, path, body, accept = "application/vnd.github+json", allowRetry = true }) {
  const url = base().replace(/\/$/, "") + path;
  const headers = new Headers();
  headers.set("accept", accept);
  headers.set("x-github-api-version", apiVersion());
  headers.set("authorization", `Bearer ${token}`);
  if (body !== undefined && body !== null) headers.set("content-type", "application/json");

  const maxAttempts = allowRetry ? 5 : 1;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    let res;
    try {
      res = await fetch(url, { method, headers, body: body !== undefined && body !== null ? JSON.stringify(body) : undefined });
    } catch (e) {
      // network error
      if (attempt >= maxAttempts) throw new GitHubApiError(`GitHub network error: ${e?.message || "unknown"}`, 502, "GITHUB_NETWORK");
      const backoff = Math.min(8000, 500 * (2 ** (attempt - 1))) + Math.floor(Math.random() * 250);
      await sleep(backoff);
      continue;
    }

    // Rate limit / retry handling
    if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
      if (attempt >= maxAttempts) {
        const t = await safeText(res);
        throw new GitHubApiError(`GitHub transient error (${res.status})`, res.status, "GITHUB_TRANSIENT", { body: t });
      }
      const ra = parseRetryAfter(res.headers);
      const waitMs = (ra !== null ? ra * 1000 : Math.min(8000, 500 * (2 ** (attempt - 1))) + Math.floor(Math.random() * 250));
      await sleep(waitMs);
      continue;
    }

    // GitHub rate limit is often a 403 with remaining=0
    if (res.status === 403) {
      const remaining = res.headers.get("x-ratelimit-remaining");
      const rem = remaining ? parseInt(remaining, 10) : null;
      if (rem === 0) {
        const resetSec = parseRateResetSeconds(res.headers);
        const t = await safeText(res);
        throw new GitHubApiError("GitHub rate limit reached", 429, "GITHUB_RATE_LIMIT", { reset_seconds: resetSec, body: t });
      }
    }

    if (!res.ok) {
      const t = await safeText(res);
      let code = "GITHUB_ERROR";
      if (res.status === 401) code = "GITHUB_UNAUTHORIZED";
      if (res.status === 404) code = "GITHUB_NOT_FOUND";
      if (res.status === 409) code = "GITHUB_CONFLICT";
      throw new GitHubApiError(`GitHub API error (${res.status})`, res.status, code, { body: t });
    }

    // Some endpoints return 204
    if (res.status === 204) return { ok: true, status: 204, headers: res.headers, data: null };

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      const data = await res.json();
      return { ok: true, status: res.status, headers: res.headers, data };
    }
    const text = await res.text();
    return { ok: true, status: res.status, headers: res.headers, data: text };
  }

  throw new GitHubApiError("GitHub request failed", 502, "GITHUB_UNKNOWN");
}

async function safeText(res) {
  try { return await res.text(); } catch { return ""; }
}

// Convenience wrappers
export async function ghGet({ token, path }) {
  return ghFetch({ token, method: "GET", path });
}
export async function ghPost({ token, path, body }) {
  return ghFetch({ token, method: "POST", path, body });
}
export async function ghPatch({ token, path, body }) {
  return ghFetch({ token, method: "PATCH", path, body });
}
