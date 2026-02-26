(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const store = {
    get token() { return localStorage.getItem("GPX_ADMIN_TOKEN") || ""; },
    set token(v) { v ? localStorage.setItem("GPX_ADMIN_TOKEN", v) : localStorage.removeItem("GPX_ADMIN_TOKEN"); }
  };

  const toastEl = $("#alerts");
  function toast(msg, ok = true) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.className = "toast" + (ok ? "" : " bad");
    toastEl.style.display = "block";
    setTimeout(() => (toastEl.style.display = "none"), 4500);
  }

  let rawData = [];
  let filtered = [];
  let sortKey = "created_at";
  let sortDir = -1;
  let charts = { timeline: null, providers: null, levels: null };

  function parseDate(v) {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d) ? null : d;
  }

  function normalizeRow(row) {
    const r = { ...row };
    // Normalize common fields
    r.created_at = r.created_at || r.createdAt || r.time || r.timestamp || null;
    r.level = (r.level || r.severity || "").toString().toLowerCase();
    r.provider = r.provider || r.vendor || "";
    r.model = r.model || r.engine || "";
    if (r.http_status == null && r.status) r.http_status = Number(r.status) || null;
    if (r.duration_ms == null && r.duration) r.duration_ms = Number(r.duration) || null;
    return r;
  }

  function loadCsv(text) {
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    const rows = (parsed.data || []).map(normalizeRow);
    return rows.filter((r) => Object.keys(r).length > 0);
  }

  function loadNdjson(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    const rows = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        rows.push(normalizeRow(obj));
      } catch {
        // skip bad line
      }
    }
    return rows;
  }

  async function handleFile(file) {
    const text = await file.text();
    let rows = [];
    if (file.name.toLowerCase().endsWith(".csv")) rows = loadCsv(text);
    else rows = loadNdjson(text);
    rawData = rows;
    toast(`Loaded ${rows.length} rows from ${file.name}`, true);
    applyFilters();
  }

  function applyFilters() {
    const q = $("#fSearch").value.trim().toLowerCase();
    const level = $("#fLevel").value.trim().toLowerCase();
    const provider = $("#fProvider").value.trim().toLowerCase();
    const model = $("#fModel").value.trim().toLowerCase();
    const status = $("#fStatus").value.trim();
    const limit = Math.max(10, Math.min(5000, parseInt($("#fLimit").value || "500", 10)));
    const from = parseDate($("#fFrom").value);
    const to = parseDate($("#fTo").value);

    filtered = rawData.filter((r) => {
      const t = parseDate(r.created_at);
      if (from && t && t < from) return false;
      if (to && t && t > to) return false;
      if (level && r.level !== level) return false;
      if (provider && !String(r.provider || "").toLowerCase().includes(provider)) return false;
      if (model && !String(r.model || "").toLowerCase().includes(model)) return false;
      if (status && String(r.http_status || "").trim() !== status) return false;
      if (q) {
        const blob = JSON.stringify(r).toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });

    sortAndLimit(limit);
    renderStats();
    renderTable();
    renderCharts();
  }

  function sortAndLimit(limit) {
    filtered.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (sortKey === "created_at") {
        const ad = parseDate(av)?.getTime() || 0;
        const bd = parseDate(bv)?.getTime() || 0;
        return (ad - bd) * sortDir;
      }
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sortDir;
      return String(av || "").localeCompare(String(bv || "")) * sortDir;
    });
    filtered = filtered.slice(0, limit);
  }

  function renderStats() {
    const rows = filtered;
    const errors = rows.filter((r) => r.level === "error").length;
    const warns = rows.filter((r) => r.level === "warn").length;
    const providers = new Set(rows.map((r) => r.provider).filter(Boolean));
    const models = new Set(rows.map((r) => r.model).filter(Boolean));

    $("#statRows").textContent = rows.length;
    $("#statErrors").textContent = errors;
    $("#statWarns").textContent = warns;
    $("#statProviders").textContent = providers.size;
    $("#statModels").textContent = models.size;
  }

  function renderTable() {
    const tbody = $("#dataTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    const rows = filtered;
    for (const r of rows) {
      const tr = document.createElement("tr");
      const t = parseDate(r.created_at);
      tr.innerHTML = `
        <td>${t ? t.toLocaleString() : ""}</td>
        <td>${escapeHtml(r.level)}</td>
        <td>${escapeHtml(r.provider)}</td>
        <td>${escapeHtml(r.model)}</td>
        <td>${r.http_status ?? ""}</td>
        <td>${escapeHtml(r.function_name || "")}</td>
        <td>${escapeHtml(r.request_id || "")}</td>
        <td>${escapeHtml(r.app_id || "")}</td>
        <td>${r.duration_ms ?? ""}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function bucketByDay(rows) {
    const buckets = {};
    for (const r of rows) {
      const d = parseDate(r.created_at);
      if (!d) continue;
      const key = d.toISOString().slice(0, 10);
      buckets[key] = (buckets[key] || 0) + 1;
    }
    return Object.entries(buckets).sort((a, b) => a[0].localeCompare(b[0]));
  }

  function tally(rows, key) {
    const m = new Map();
    for (const r of rows) {
      const k = (r[key] || "unknown").toString();
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }

  function renderCharts() {
    const rows = filtered;
    const ctxTimeline = $("#chartTimeline");
    const ctxProviders = $("#chartProviders");
    const ctxLevels = $("#chartLevels");

    const dayData = bucketByDay(rows);
    const providerData = tally(rows, "provider");
    const levelData = tally(rows, "level");

    destroyCharts();

    charts.timeline = new Chart(ctxTimeline, {
      type: "line",
      data: {
        labels: dayData.map((d) => d[0]),
        datasets: [{
          label: "Requests",
          data: dayData.map((d) => d[1]),
          borderColor: "#5cf4d3",
          backgroundColor: "rgba(92,244,211,0.25)",
          tension: 0.3,
          fill: true
        }]
      },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#9fb2d8" } }, y: { ticks: { color: "#9fb2d8" } } } }
    });

    charts.providers = new Chart(ctxProviders, {
      type: "bar",
      data: {
        labels: providerData.map((d) => d[0]),
        datasets: [{ label: "By provider", data: providerData.map((d) => d[1]), backgroundColor: "#6ea8ff" }]
      },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#9fb2d8" } }, y: { ticks: { color: "#9fb2d8" } } } }
    });

    charts.levels = new Chart(ctxLevels, {
      type: "doughnut",
      data: {
        labels: levelData.map((d) => d[0]),
        datasets: [{ data: levelData.map((d) => d[1]), backgroundColor: ["#5cf4d3", "#ffc857", "#ff7b7b", "#6ea8ff"] }]
      },
      options: { plugins: { legend: { position: "bottom", labels: { color: "#f4f7ff" } } } }
    });
  }

  function destroyCharts() {
    Object.values(charts).forEach((c) => c && c.destroy());
  }

  function toCsv(rows) {
    if (!rows.length) return "";
    const headers = Array.from(rows.reduce((acc, r) => { Object.keys(r).forEach((k) => acc.add(k)); return acc; }, new Set()));
    const lines = [headers.join(",")];
    for (const r of rows) {
      const line = headers.map((h) => {
        const v = r[h];
        if (v == null) return "";
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      }).join(",");
      lines.push(line);
    }
    return lines.join("\n");
  }

  function downloadFile(name, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function listArchive() {
    const token = $("#adminToken").value.trim();
    if (token) store.token = token;
    const prefix = "gateway_events/";
    const res = await fetch("/.netlify/functions/monitor-archive-access?prefix=" + encodeURIComponent(prefix), {
      headers: authHeaders()
    });
    if (!res.ok) {
      toast("Archive list failed", false);
      return;
    }
    const data = await res.json();
    const list = data.items || [];
    const el = $("#archiveList");
    el.innerHTML = "";
    if (!list.length) { el.innerHTML = '<div class="muted">No archive batches found.</div>'; return; }
    for (const item of list) {
      const div = document.createElement("div");
      div.className = "archive-item";
      const date = item.updated_at ? new Date(item.updated_at).toLocaleString() : "";
      div.innerHTML = `
        <div>
          <div>${item.key}</div>
          <div class="meta">${(item.size || 0)} bytes · ${date}</div>
        </div>
        <button class="btn ghost" data-key="${item.key}">Load</button>
      `;
      el.appendChild(div);
    }
    el.querySelectorAll("button[data-key]").forEach((btn) => {
      btn.addEventListener("click", () => fetchArchive(btn.getAttribute("data-key")));
    });
  }

  async function fetchArchive(key) {
    const token = $("#adminToken").value.trim();
    if (token) store.token = token;
    const url = "/.netlify/functions/monitor-archive-access?key=" + encodeURIComponent(key);
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) { toast("Download failed", false); return; }
    const text = await res.text();
    rawData = loadNdjson(text);
    toast(`Loaded ${rawData.length} rows from archive`, true);
    applyFilters();
  }

  function authHeaders() {
    const t = store.token || $("#adminToken").value.trim();
    const h = { };
    if (t) h.authorization = "Bearer " + t;
    return h;
  }

  function bindEvents() {
    $("#fileInput").addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f).catch((err) => toast(err.message || "Upload failed", false));
    });

    ["#fSearch", "#fLevel", "#fProvider", "#fModel", "#fStatus", "#fFrom", "#fTo", "#fLimit"].forEach((id) => {
      const el = $(id);
      el?.addEventListener("input", () => applyFilters());
      el?.addEventListener("change", () => applyFilters());
    });

    $("#exportCsvBtn").addEventListener("click", () => {
      const csv = toCsv(filtered);
      downloadFile("gate-proofx-export.csv", csv, "text/csv");
    });

    $("#exportPdfBtn").addEventListener("click", () => window.print());

    $("#listArchiveBtn").addEventListener("click", () => listArchive().catch((e) => toast(e.message || "List failed", false)));
    $("#fetchArchiveBtn").addEventListener("click", () => {
      const key = $("#archiveKey").value.trim();
      if (!key) return toast("Provide an archive key", false);
      fetchArchive(key).catch((e) => toast(e.message || "Load failed", false));
    });

    $("#saveTokenBtn").addEventListener("click", () => {
      const v = $("#adminToken").value.trim();
      store.token = v;
      toast("Token saved", true);
    });

    const modal = $("#tutorialModal");
    const helpBtn = $("#helpBtn");
    const closeBtn = $("#closeTutorial");
    const hideModal = () => { if (modal) modal.style.display = "none"; };
    const showModal = () => { if (modal) modal.style.display = "flex"; };
    helpBtn?.addEventListener("click", showModal);
    closeBtn?.addEventListener("click", hideModal);
    modal?.addEventListener("click", (e) => { if (e.target === modal) hideModal(); });

    // Restore token if present
    if (store.token) $("#adminToken").value = store.token;

    $$("#dataTable th").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-key");
        if (sortKey === key) sortDir = -sortDir;
        else { sortKey = key; sortDir = -1; }
        applyFilters();
      });
    });
  }

  // Kickoff
  bindEvents();
  applyFilters();
})();
