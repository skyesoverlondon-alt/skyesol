// Scheduled portal monitoring.
// Runs automatically on Netlify based on the cron expression below.

import { store } from "./_common.mjs";

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
    return { id: portal.id, name: portal.name, url: portal.url, status: null, ok: false, ms, error: String(e?.name === "AbortError" ? "timeout" : (e?.message || e)) };
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

export default async () => {
  const s = store();
  const data = await s.getJSON("portals:list").catch(() => ({ portals: [] }));
  const portals = Array.isArray(data?.portals) ? data.portals : [];
  const results = await runLimited(portals, 4, (p) => checkOne(p));
  results.sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const checked_at = new Date().toISOString();
  const payload = { checked_at, results };
  await s.setJSON("monitor:last", payload);
  const hist = await s.getJSON("monitor:history").catch(() => ({ items: [] }));
  const items = Array.isArray(hist?.items) ? hist.items : [];
  items.push(payload);
  const cap = clamp(parseInt(process.env.MONITOR_HISTORY_CAP || "120", 10), 20, 1000);
  await s.setJSON("monitor:history", { updated_at: checked_at, items: items.slice(-cap) });

  return new Response(JSON.stringify({ ok: true, checked_at }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = {
  // Every 10 minutes (UTC)
  schedule: "*/10 * * * *",
};
