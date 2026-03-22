
import {createRequire as ___nfyCreateRequire} from "module";
import {fileURLToPath as ___nfyFileURLToPath} from "url";
import {dirname as ___nfyPathDirname} from "path";
let __filename=___nfyFileURLToPath(import.meta.url);
let __dirname=___nfyPathDirname(___nfyFileURLToPath(import.meta.url));
let require=___nfyCreateRequire(import.meta.url);


// netlify/functions/_common.mjs
import { getStore } from "@netlify/blobs";
var STORE_NAME = process.env.BLOBS_STORE || "sol_growth";
var _textDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
function decodeValue(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) {
    return _textDecoder ? _textDecoder.decode(raw) : Buffer.from(raw).toString();
  }
  if (typeof raw === "object" && typeof raw.toString === "function") {
    return raw.toString();
  }
  return String(raw);
}
function wrapStore(base) {
  const fallback = {
    async getJSON() {
      return null;
    },
    async setJSON() {
      return;
    }
  };
  if (!base) return fallback;
  return {
    ...base,
    async getJSON(key) {
      const raw = await base.get(key);
      const text = decodeValue(raw);
      if (text == null) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    },
    async setJSON(key, value) {
      const payload = JSON.stringify(value ?? null);
      await base.set(key, payload);
    }
  };
}
var cachedStore;
function store() {
  if (cachedStore) return cachedStore;
  try {
    const base = getStore(STORE_NAME);
    cachedStore = wrapStore(base);
    return cachedStore;
  } catch (err) {
    console.error("[-] Netlify Blobs unavailable", err?.message || err);
    cachedStore = wrapStore(null);
    return cachedStore;
  }
}

// netlify/functions/monitor-cron.mjs
async function checkOne(portal, timeoutMs = 6500) {
  const started = Date.now();
  const target = new URL(portal.url);
  target.pathname = portal.path || "/";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(target.toString(), { method: "GET", redirect: "follow", signal: ctrl.signal });
    const ms = Date.now() - started;
    const ok = res.status >= 200 && res.status < 400;
    return { id: portal.id, name: portal.name, url: portal.url, status: res.status, ok, ms, error: null };
  } catch (e) {
    const ms = Date.now() - started;
    return { id: portal.id, name: portal.name, url: portal.url, status: null, ok: false, ms, error: String(e?.name === "AbortError" ? "timeout" : e?.message || e) };
  } finally {
    clearTimeout(t);
  }
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
async function runLimited(items, limit, fn) {
  const results = [];
  const queue = items.slice();
  const workers = Array.from({ length: clamp(limit, 1, 8) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      results.push(await fn(item));
    }
  });
  await Promise.all(workers);
  return results;
}
var monitor_cron_default = async () => {
  const s = store();
  const data = await s.getJSON("portals:list").catch(() => ({ portals: [] }));
  const portals = Array.isArray(data?.portals) ? data.portals : [];
  const results = await runLimited(portals, 4, (p) => checkOne(p));
  results.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const checked_at = (/* @__PURE__ */ new Date()).toISOString();
  const payload = { checked_at, results };
  await s.setJSON("monitor:last", payload);
  const hist = await s.getJSON("monitor:history").catch(() => ({ items: [] }));
  const items = Array.isArray(hist?.items) ? hist.items : [];
  items.push(payload);
  const cap = clamp(parseInt(process.env.MONITOR_HISTORY_CAP || "120", 10), 20, 1e3);
  await s.setJSON("monitor:history", { updated_at: checked_at, items: items.slice(-cap) });
  return new Response(JSON.stringify({ ok: true, checked_at }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
var config = {
  // Every 10 minutes (UTC)
  schedule: "*/10 * * * *"
};
export {
  config,
  monitor_cron_default as default
};
