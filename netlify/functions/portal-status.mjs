import { clamp, ensureSeed, json, store } from "./_common.mjs";

async function checkOne(portal, timeoutMs = 6500) {
  const started = Date.now();
  const target = new URL(portal.url);
  const path = portal.path || "/";
  target.pathname = path;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": "SOLEnterprises-Monitor/1.0",
        "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
      },
    });
    const ms = Date.now() - started;
    const status = res.status;
    const ok = status >= 200 && status < 400;
    return {
      id: portal.id,
      name: portal.name,
      url: portal.url,
      path: portal.path || "/",
      status,
      ok,
      ms,
      error: null,
    };
  } catch (e) {
    const ms = Date.now() - started;
    return {
      id: portal.id,
      name: portal.name,
      url: portal.url,
      path: portal.path || "/",
      status: null,
      ok: false,
      ms,
      error: String(e?.name === "AbortError" ? "timeout" : (e?.message || e)),
    };
  } finally {
    clearTimeout(t);
  }
}

async function runLimited(items, limit, fn) {
  const results = [];
  const queue = items.slice();
  const workers = Array.from({ length: clamp(limit, 1, 8) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      const out = await fn(item);
      results.push(out);
    }
  });
  await Promise.all(workers);
  return results;
}

export const handler = async (event) => {
  await ensureSeed();
  const s = store();

  const data = await s.getJSON("portals:list").catch(() => ({ portals: [] }));
  const portals = Array.isArray(data?.portals) ? data.portals : [];

  const onlyPublic = (event.queryStringParameters?.public || "0") === "1";
  const selected = onlyPublic ? portals.filter((p) => !!p.public) : portals;

  const limit = parseInt(event.queryStringParameters?.concurrency || "4", 10);
  const results = await runLimited(selected, limit, (p) => checkOne(p));
  results.sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const checked_at = new Date().toISOString();
  const payload = { checked_at, results };

  // Persist a short history (capped) for the monitoring view.
  try {
    await s.setJSON("monitor:last", payload);
    const hist = await s.getJSON("monitor:history").catch(() => ({ items: [] }));
    const items = Array.isArray(hist?.items) ? hist.items : [];
    items.push({ checked_at, results });
    const cap = clamp(parseInt(process.env.MONITOR_HISTORY_CAP || "120", 10), 20, 1000);
    const sliced = items.slice(-cap);
    await s.setJSON("monitor:history", { updated_at: checked_at, items: sliced });
  } catch {
    // Monitoring storage is best-effort.
  }

  return json(200, payload);
};
