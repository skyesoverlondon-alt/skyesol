(function(){
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  
  // Gateway base override (lets this UI talk to a dedicated gateway without rebuilding)
  const baseStore = {
    get apiBase(){ return (localStorage.getItem("KAIXU_API_BASE") || "").trim(); },
    set apiBase(v){ localStorage.setItem("KAIXU_API_BASE", (v || "").trim()); }
  };

  // Optional: report user dashboard errors into Monitor (client_error events)
  try {
    if (globalThis.KaixuClient?.installGlobalErrorHooks) {
      globalThis.KaixuClient.installGlobalErrorHooks({
        apiBase: baseStore.apiBase || "",
        app: "KaixuGatewayUser",
        build: "gateway-user",
        tags: { panel: "user" }
      });
    }
  } catch {}
  function normalizeBase(b){
    b = (b || "").trim();
    if (!b) return "";
    return b.replace(/\/+$/, "");
  }
  function apiUrl(path){
    const base = normalizeBase(baseStore.apiBase);
    if (!base) return path;
    if (/^https?:\/\//i.test(path)) return path;
    return base + path;
  }
const store = {
    get key(){ return localStorage.getItem("KAIXU_VIRTUAL_KEY") || ""; },
    set key(v){ localStorage.setItem("KAIXU_VIRTUAL_KEY", v || ""); }
  };

  const toast = $("#toast");
  function showToast(msg, ok=true){
    toast.textContent = msg;
    toast.className = "toast " + (ok ? "good" : "bad");
    toast.style.display = "block";
    setTimeout(()=> toast.style.display="none", 4500);
  }

  function money(cents){
    const n = Math.round(Number(cents || 0));
    return "$" + (n/100).toFixed(2);
  }

  function monthKeyUTC(){
    return new Date().toISOString().slice(0,7);
  }

  function escapeHtml(str){
    return String(str || "").replace(/[&<>'"]/g, (c)=> ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));
  }

  async function apiJson(path, { method = "GET", body = null } = {}){
    const headers = { "content-type": "application/json" };
    const key = store.key;
    if (key) headers.authorization = "Bearer " + key;

    const res = await fetch(apiUrl(path), { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(()=> ({}));
    if (!res.ok) {
      const err = new Error(data?.error || ("HTTP " + res.status));
      err.status = res.status;
      err.detail = data;
      throw err;
    }

    return data;
  }

  async function apiBinary(path, { method = "PUT", body = null, headers = {} } = {}){
    const h = Object.assign({}, headers || {});
    const key = store.key;
    if (key) h.authorization = "Bearer " + key;

    const res = await fetch(apiUrl(path), { method, headers: h, body });
    const data = await res.json().catch(()=> ({}));
    if (!res.ok) {
      const err = new Error(data?.error || ("HTTP " + res.status));
      err.status = res.status;
      err.detail = data;
      throw err;
    }
    return data;
  }

  async function downloadWithAuth(path, filename){
    const headers = {};
    const key = store.key;
    if (key) headers.authorization = "Bearer " + key;

    const res = await fetch(apiUrl(path), { method: "GET", headers });
    if (!res.ok) {
      const data = await res.json().catch(()=> ({}));
      throw new Error(data?.error || ("HTTP " + res.status));
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "export.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function switchTab(name){
    $$(".tab").forEach(b=> b.classList.remove("active"));
    const btn = $(`.tab[data-tab="${name}"]`);
    if (btn) btn.classList.add("active");
    $$(".tabpanel").forEach(p=> p.style.display="none");
    const panel = $("#tab-" + name);
    if (panel) panel.style.display = "block";

    // lazy-load extra panels
    if (name === "devices") loadDevices().catch(e=> showToast(e.message || "Failed to load devices", false));
    if (name === "exports") loadInvoicePreview().catch(e=> showToast(e.message || "Failed to load invoice", false));
    if (name === "ghpush") loadGitHubPush().catch(e=> showToast(e.message || "Failed to load GitHub Push", false));
    if (name === "voice") loadVoice().catch(e=> showToast(e.message || "Failed to load Voice", false));
    if (name === "monitor") refreshMonitorTab().catch(() => {});
  }

  $$(".tab").forEach(btn=> btn.addEventListener("click", ()=> switchTab(btn.dataset.tab)));

  const keyInput = $("#kaixuKey");
  const dashView = $("#dashView");

  function setConnected(isConnected){
    dashView.style.display = isConnected ? "block" : "none";
  }

  async function loadSummary(month){
    const qs = new URLSearchParams();
    if (month) qs.set("month", month);
    const data = await apiJson("/.netlify/functions/user-summary" + (qs.toString() ? ("?"+qs.toString()) : ""));

    $("#summary").style.display = "grid";

    $("#sCustCap").textContent    = money(data?.month?.customer_cap_cents   ?? data?.month?.cap_cents   ?? 0);
    $("#sCustSpent").textContent  = money(data?.month?.customer_spent_cents  ?? data?.month?.spent_cents ?? 0);
    $("#sCustRemaining").textContent = money(data?.month?.customer_remaining_cents ?? 0);
    $("#sKeyCap").textContent     = money(data?.month?.key_cap_cents  ?? 0);
    $("#sKeySpent").textContent   = money(data?.month?.key_spent_cents ?? 0);

    // Token totals from summary
    const totalTok = (data?.month?.key_tokens || 0);
    if ($("#sTotalTokens")) $("#sTotalTokens").textContent = totalTok ? totalTok.toLocaleString() : "—";

    // Live-as-of timestamp
    const asOfEl = $("#liveAsOf");
    if (asOfEl) asOfEl.textContent = "as of " + new Date().toLocaleTimeString();
    const dotEl = $("#livePollingDot");
    if (dotEl) dotEl.style.display = "inline-block";

    $("#sCustomer").textContent = "#" + String(data?.customer?.id ?? "—");
    $("#sPlan").textContent = String(data?.customer?.plan_name ?? "—");
    $("#sLabel").textContent = String(data?.key?.label || "—");

    // Full key display — user owns this key, show it
    const fullKey = store.key;
    const keyMasked = fullKey
      ? fullKey.slice(0, 8) + "\u2022".repeat(Math.max(0, fullKey.length - 12)) + fullKey.slice(-4)
      : "—";
    let _keyRevealed = false;

    const keyDisplayEl = $("#sKeyDisplay");
    const copyFullKeyBtn = $("#copyFullKey");
    const toggleMaskBtn = $("#toggleKeyMask");

    if (keyDisplayEl) {
      keyDisplayEl.textContent = keyMasked;
      keyDisplayEl.title = "Click to copy full key";
      keyDisplayEl.onclick = async () => {
        try {
          await navigator.clipboard.writeText(fullKey);
          showToast("Full key copied.", true);
        } catch { showToast("Clipboard unavailable.", false); }
      };
    }
    if (copyFullKeyBtn && fullKey) {
      copyFullKeyBtn.style.display = "inline-flex";
      copyFullKeyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(fullKey);
          showToast("Full key copied.", true);
        } catch { showToast("Clipboard unavailable.", false); }
      };
    }
    if (toggleMaskBtn && fullKey) {
      toggleMaskBtn.style.display = "inline-flex";
      toggleMaskBtn.textContent = "Show Key";
      toggleMaskBtn.onclick = () => {
        _keyRevealed = !_keyRevealed;
        if (keyDisplayEl) keyDisplayEl.textContent = _keyRevealed ? fullKey : keyMasked;
        toggleMaskBtn.textContent = _keyRevealed ? "Hide Key" : "Show Key";
      };
    }

    return data;
  }

  async function loadLogs(month){
    const qs = new URLSearchParams();
    if (month) qs.set("month", month);
    qs.set("limit", "200");
    let data;
    try {
      data = await apiJson("/.netlify/functions/user-events?" + qs.toString());
    } catch (e) {
      showToast((e.message || "Failed to load logs") + (e.status ? ` (${e.status})` : ""), false);
      return;
    }
    const body = $("#userEventsTable tbody");
    body.innerHTML = "";

    // Tally calls + avg cost from the events
    const rows = data?.events || [];
    const totalCalls = rows.length;
    const totalCostCents = rows.reduce((s, r) => s + Number(r.cost_cents || 0), 0);
    if ($("#sTotalCalls")) $("#sTotalCalls").textContent = totalCalls.toLocaleString();
    if ($("#sAvgCost") && totalCalls) $("#sAvgCost").textContent = money(Math.round(totalCostCents / totalCalls));

    // Provider breakdown table
    const provRows = data?.summary_by_provider || [];
    const provBody = $("#providerTableBody");
    const provDiv  = $("#providerBreakdown");
    if (provBody && provRows.length) {
      provBody.innerHTML = provRows.map(r =>
        `<tr><td>${escapeHtml(r.provider)}</td><td>${Number(r.calls || 0).toLocaleString()}</td><td>${money(r.cost_cents)}</td><td>${Number(r.input_tokens || 0).toLocaleString()}</td><td>${Number(r.output_tokens || 0).toLocaleString()}</td></tr>`
      ).join("");
      if (provDiv) provDiv.style.display = "block";
    } else if (provDiv) {
      provDiv.style.display = "none";
    }

    for (const ev of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(ev.created_at).toLocaleString()}</td>
        <td>${escapeHtml(ev.provider)}</td>
        <td>${escapeHtml(ev.model)}</td>
        <td>${Number(ev.input_tokens || 0)}</td>
        <td>${Number(ev.output_tokens || 0)}</td>
        <td>${escapeHtml(ev.install_id || "")}</td>
        <td>${Number(ev.cost_cents || 0)}</td>
      `;
      body.appendChild(tr);
    }
    return data;
  }

  // ── Live polling — auto-refreshes caps/calls/cost every 30s when connected ──
  let _livePollingTimer = null;

  function startLivePolling() {
    stopLivePolling();
    _livePollingTimer = setInterval(async () => {
      if (!store.key) return stopLivePolling();
      const m = $("#monthPicker")?.value?.trim() || "";
      try { await loadSummary(m); } catch {}
      try { await loadLogs(m);    } catch {}
    }, 30_000);
  }

  function stopLivePolling() {
    if (_livePollingTimer) { clearInterval(_livePollingTimer); _livePollingTimer = null; }
    const dot = $("#livePollingDot");
    if (dot) dot.style.display = "none";
  }

  async function loadDevices(){
    const data = await apiJson("/.netlify/functions/user-devices");
    const tbody = $("#devicesTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    for (const d of (data.devices || [])) {
      const tr = document.createElement("tr");
      const revoked = !!d.revoked_at;
      tr.innerHTML = `
        <td><code>${escapeHtml(d.install_id)}</code></td>
        <td>${d.first_seen_at ? new Date(d.first_seen_at).toLocaleString() : ""}</td>
        <td>${d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : ""}</td>
        <td>${revoked ? "Yes" : "No"}</td>
        <td style="max-width:420px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(d.last_seen_ua || "")}</td>
        <td>
          <button class="btn ${revoked ? 'ghost' : 'danger'}" data-install="${escapeHtml(d.install_id)}" data-revoked="${revoked ? '1':'0'}">
            ${revoked ? 'Unrevoke' : 'Revoke'}
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll("button[data-install]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const install_id = btn.getAttribute("data-install");
        const revokedNow = btn.getAttribute("data-revoked") === "1";
        try {
          await apiJson("/.netlify/functions/user-devices", { method: "PATCH", body: { install_id, revoked: !revokedNow } });
          showToast(!revokedNow ? "Device revoked." : "Device unrevoked.", true);
          await loadDevices();
        } catch (e) {
          showToast(e.message || "Failed", false);
        }
      });
    });

    return data;
  }

  function currentExportMonth(){
    const v = $("#exportMonthPicker")?.value?.trim();
    if (v) return v;
    const v2 = $("#monthPicker")?.value?.trim();
    return v2 || monthKeyUTC();
  }

  async function loadInvoicePreview(){
    const m = currentExportMonth();
    const qs = new URLSearchParams({ month: m });
    const data = await apiJson("/.netlify/functions/user-invoices?" + qs.toString());
    const pre = $("#invoiceJson");
    if (pre) pre.textContent = JSON.stringify(data.snapshot || data, null, 2);
    return data;
  }

  async function refreshAll(){
    const month = $("#monthPicker").value.trim();
    const m = month || "";
    try { await loadSummary(m); } catch(e) { showToast(e.message || "Failed to load summary", false); }
    try { await loadLogs(m);    } catch(e) { showToast(e.message || "Failed to load logs", false); }
  }

  async function connect(){
    const k = keyInput.value.trim();
    if (!k) return showToast("Paste a key first.", false);
    store.key = k;

    try {
      await refreshAll();
      setConnected(true);
      showToast("Connected.", true);
      switchTab("overview");
      startLivePolling();

      // prefill export month picker
      const exp = $("#exportMonthPicker");
      if (exp && !exp.value) exp.value = $("#monthPicker")?.value?.trim() || monthKeyUTC();

    } catch (e) {
      setConnected(false);
      showToast(e.message || "Unable to connect", false);
    }
  }

  function disconnect(){
    store.key = "";
    keyInput.value = "";
    setConnected(false);
    stopLivePolling();
    showToast("Disconnected.", true);
  }

  function bindFirstClick(selectors, handler){
    for (const selector of selectors) {
      const el = $(selector);
      if (!el) continue;
      el.addEventListener("click", handler);
      return el;
    }
    return null;
  }

  // --- Show/hide key input toggle ---
  (function(){
    const inp = $("#kaixuKey");
    const btn = $("#toggleKeyInput");
    if (!btn || !inp) return;
    btn.addEventListener("click", () => {
      const hidden = inp.type === "password";
      inp.type = hidden ? "text" : "password";
      btn.textContent = hidden ? "Hide" : "Show";
    });
  })();

  // --- UI wiring ---
  bindFirstClick(["#saveKeyBtn", "#connectBtn"], connect);
  bindFirstClick(["#refreshBtn", "#loadMonthBtn", "#monthBtn"], refreshAll);
  bindFirstClick(["#clearKeyBtn", "#disconnectBtn"], disconnect);

  keyInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      connect();
    }
  });

  $("#refreshDevicesBtn")?.addEventListener("click", ()=> loadDevices().catch(e=> showToast(e.message || "Failed", false)));

  // exports
  $("#exportMonthBtn")?.addEventListener("click", ()=>{
    const val = $("#exportMonthPicker")?.value?.trim();
    if (val && !/^\d{4}-\d{2}$/.test(val)) return showToast("Month must be YYYY-MM", false);
    loadInvoicePreview().catch(e=> showToast(e.message || "Failed", false));
  });

  $("#dlEventsBtn")?.addEventListener("click", async ()=>{
    try {
      const m = currentExportMonth();
      await downloadWithAuth(`/.netlify/functions/user-export?type=events&month=${encodeURIComponent(m)}`, `kaixu-events-${m}.csv`);
      showToast("Download started.", true);
    } catch(e){ showToast(e.message || "Export failed", false); }
  });
  $("#dlSummaryBtn")?.addEventListener("click", async ()=>{
    try {
      const m = currentExportMonth();
      await downloadWithAuth(`/.netlify/functions/user-export?type=summary&month=${encodeURIComponent(m)}`, `kaixu-summary-${m}.csv`);
      showToast("Download started.", true);
    } catch(e){ showToast(e.message || "Export failed", false); }
  });
  $("#dlInvoiceBtn")?.addEventListener("click", async ()=>{
    try {
      const m = currentExportMonth();
      await downloadWithAuth(`/.netlify/functions/user-export?type=invoice&month=${encodeURIComponent(m)}`, `kaixu-invoice-${m}.csv`);
      showToast("Download started.", true);
    } catch(e){ showToast(e.message || "Export failed", false); }
  });

  $("#refreshInvoiceBtn")?.addEventListener("click", ()=> loadInvoicePreview().catch(e=> showToast(e.message || "Failed", false)));

  // Stripe top-up
  $("#topupBtn")?.addEventListener("click", async ()=>{
    const m = currentExportMonth();
    const amtStr = $("#topupAmount")?.value?.trim() || "";
    const usd = Number(amtStr);
    if (!Number.isFinite(usd) || usd <= 0) return showToast("Enter a valid USD amount.", false);
    const amount_cents = Math.round(usd * 100);

    try {
      const data = await apiJson("/.netlify/functions/user-topup-checkout", { method: "POST", body: { amount_cents, month: m } });
      const a = $("#topupLink");
      if (a) {
        a.href = data.url;
        a.style.display = "inline-flex";
      }
      showToast("Checkout created.", true);
    } catch (e) {
      showToast(e.message || "Stripe not configured", false);
    }
  });

  // load stored key on boot
  (function boot(){
    const k = store.key;
    if (k) {
      keyInput.value = k;
      connect();
    } else {
      setConnected(false);
      $("#monthPicker").value = monthKeyUTC();
      const exp = $("#exportMonthPicker");
      if (exp) exp.value = monthKeyUTC();
    }
  })();

  // ── 24/7 Gateway Heartbeat Monitor ───────────────────────────────────────
  // Reads data recorded by the scheduled function (gateway-heartbeat.mjs)
  // Runs on page load and auto-refreshes every 60 s. No user action needed.

  function renderBars(containerId, items) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = "";
    const sample = items.slice(-288); // max 24h
    sample.forEach(r => {
      const bar = document.createElement("div");
      const ms = Number(r.ms || 0);
      // height proportional to response time, clamp 4–40px
      const h = Math.max(4, Math.min(40, 4 + (ms / 2000) * 36));
      bar.style.cssText = `width:3px;height:${h}px;border-radius:2px;flex-shrink:0;background:${r.ok ? "#4ade80" : "#f87171"};opacity:0.85;`;
      bar.title = `${new Date(r.ts).toLocaleString()} | ${r.ok ? "OK" : "DOWN"} | ${ms}ms`;
      el.appendChild(bar);
    });
  }

  function renderHbTable(tbodyId, items) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const recent = items.slice().reverse().slice(0, 50);
    tbody.innerHTML = recent.map(r => {
      const t = new Date(r.ts).toLocaleString();
      const ok = r.ok ? `<span style="color:#4ade80;">\u2714 UP</span>` : `<span style="color:#f87171;">\u2716 DOWN</span>`;
      const http = r.status != null ? r.status : "-";
      const db = r.db === true ? "\u2714" : r.db === false ? "\u2716" : "-";
      const ms = r.ms != null ? r.ms + " ms" : "-";
      const err = escapeHtml(r.error || "");
      return `<tr><td>${t}</td><td>${ok}</td><td>${http}</td><td>${db}</td><td>${ms}</td><td style="color:rgba(255,100,100,0.85);">${err}</td></tr>`;
    }).join("");
  }

  function calcUptime(items) {
    if (!items.length) return null;
    const ok = items.filter(r => r.ok).length;
    return ((ok / items.length) * 100).toFixed(1) + "%";
  }

  async function loadHeartbeat(includeHistory) {
    const qs = includeHistory ? "?history=1" : "";
    try {
      const base = normalizeBase(baseStore.apiBase);
      const url = (base || "") + "/.netlify/functions/gateway-heartbeat-read" + qs;
      const res = await fetch(url);
      return await res.json();
    } catch { return null; }
  }

  async function refreshStatusStrip() {
    const data = await loadHeartbeat(true);
    const dot = document.getElementById("hbDot");
    const statusEl = document.getElementById("hbStatus");
    const checkedEl = document.getElementById("hbLastChecked");
    const uptimeEl = document.getElementById("hbUptimePct");

    if (!data || !data.last) {
      if (dot) dot.style.background = "#888";
      if (statusEl) statusEl.textContent = "No heartbeat data yet — first run in up to 5 min";
      return;
    }

    const last = data.last;
    const items = data.history?.items || [];
    const ok = last.ok;

    if (dot) dot.style.background = ok ? "#4ade80" : "#f87171";
    const streak = data.failures?.streak || 0;
    if (statusEl) statusEl.textContent = ok
      ? `UP · ${last.ms} ms${last.db_ok === false ? " · ⚠ DB degraded" : ""}`
      : `DOWN · ${last.error_type || "error"}: ${last.error || "no response"}${streak > 1 ? ` · ${streak} consecutive failures` : ""}`;
    if (checkedEl) checkedEl.textContent = last.ts ? `Last check: ${new Date(last.ts).toLocaleString()}` : "";
    if (uptimeEl && items.length) uptimeEl.textContent = `24h uptime: ${calcUptime(items)}`;

    renderBars("hbBars", items);
    renderHbTable("hbTableBody", items.slice(-20));
  }

  async function refreshMonitorTab() {
    const data = await loadHeartbeat(true);
    const last = data?.last;
    const items = data?.history?.items || [];

    const statusVal = document.getElementById("monStatusVal");
    const msVal = document.getElementById("monMsVal");
    const uptimeVal = document.getElementById("monUptimeVal");
    const checkedVal = document.getElementById("monCheckedVal");
    const lastRefresh = document.getElementById("monLastRefresh");

    if (lastRefresh) lastRefresh.textContent = `Refreshed: ${new Date().toLocaleTimeString()}`;

    if (!last) {
      if (statusVal) statusVal.textContent = "No data yet";
      return;
    }
    if (statusVal) {
      const streak = data?.failures?.streak || 0;
      statusVal.textContent = last.ok ? "✔ UP" : "✖ DOWN";
      statusVal.style.color = last.ok ? "#4ade80" : "#f87171";
      if (!last.ok && streak > 0) {
        statusVal.textContent += ` (${streak} in a row)`;
      }
      if (last.db_ok === false) {
        statusVal.textContent += " · ⚠ DB";
      }
    }
    if (msVal) msVal.textContent = last.ms != null ? last.ms + " ms" : "—";
    if (uptimeVal) uptimeVal.textContent = items.length ? calcUptime(items) : "—";
    if (checkedVal && last.ts) checkedVal.textContent = new Date(last.ts).toLocaleString();

    renderBars("monBars", items);
    renderHbTable("monTableBody", items);
  }

  // Auto-start monitoring on page load — no button press needed
  refreshStatusStrip();
  setInterval(refreshStatusStrip, 30_000); // refresh strip every 30 s

  // History toggle for the strip
  const hbHistBtn = document.getElementById("hbHistoryToggle");
  const hbHistPanel = document.getElementById("hbHistoryPanel");
  if (hbHistBtn && hbHistPanel) {
    hbHistBtn.addEventListener("click", () => {
      const open = hbHistPanel.style.display !== "none";
      hbHistPanel.style.display = open ? "none" : "block";
      hbHistBtn.textContent = open ? "History" : "Hide History";
    });
  }

  // Monitor tab refresh button
  const monRefreshBtn = document.getElementById("monRefreshBtn");
  if (monRefreshBtn) {
    monRefreshBtn.addEventListener("click", () => refreshMonitorTab().catch(() => {}));
  }


  // Base switch UI (optional: only runs if the modal exists on the page)
  function effectiveBase(){
    const b = normalizeBase(baseStore.apiBase);
    return b || window.location.origin;
  }

  function openBaseModal(){
    const modal = document.getElementById("baseModal");
    if (!modal) return;
    const input = document.getElementById("apiBaseInput");
    const current = document.getElementById("apiBaseCurrent");
    const health = document.getElementById("apiBaseHealthLink");
    const saved = normalizeBase(baseStore.apiBase);
    if (input) input.value = saved;
    if (current) current.textContent = effectiveBase();
    if (health) health.href = effectiveBase() + "/.netlify/functions/health";
    modal.style.display = "grid";
  }

  function closeBaseModal(){
    const modal = document.getElementById("baseModal");
    if (!modal) return;
    modal.style.display = "none";
  }

  function saveBase(){
    const input = document.getElementById("apiBaseInput");
    if (!input) return;
    const raw = (input.value || "").trim();
    if (raw && !/^https?:\/\//i.test(raw)) {
      showToast("Gateway Base must start with http:// or https:// (or leave blank for this site).", false);
      return;
    }
    baseStore.apiBase = normalizeBase(raw);
    const current = document.getElementById("apiBaseCurrent");
    const health = document.getElementById("apiBaseHealthLink");
    if (current) current.textContent = effectiveBase();
    if (health) health.href = effectiveBase() + "/.netlify/functions/health";
    showToast("Gateway Base saved. This dashboard will now call: " + effectiveBase(), true);
  }

  const baseBtn = document.getElementById("gatewayBaseBtn");
  if (baseBtn) baseBtn.addEventListener("click", openBaseModal);

  const baseClose = document.getElementById("apiBaseClose");
  if (baseClose) baseClose.addEventListener("click", closeBaseModal);

  const baseSave = document.getElementById("apiBaseSave");
  if (baseSave) baseSave.addEventListener("click", saveBase);

  const baseUseThis = document.getElementById("apiBaseUseThisSite");
  if (baseUseThis) baseUseThis.addEventListener("click", ()=>{
    baseStore.apiBase = "";
    const input = document.getElementById("apiBaseInput");
    if (input) input.value = "";
    saveBase();
  });

  const modal = document.getElementById("baseModal");
  if (modal) {
    modal.addEventListener("click", (e)=>{
      if (e.target === modal) closeBaseModal();
    });
    window.addEventListener("keydown", (e)=>{
      if (e.key === "Escape") closeBaseModal();
    });
  }

  // -----------------------------
  // GitHub Push UI (User Dashboard)
  // -----------------------------
  let ghHandlersInstalled = false;
  let ghLastJobId = null;
  let ghRole = null;

  function setGhProgress(text){
    const box = document.getElementById("ghProgressBox");
    if (box) box.textContent = text || "";
  }

  function setGhTokenStatus(text){
    const el = document.getElementById("ghTokenStatus");
    if (el) el.textContent = text || "";
  }

  function setGhJobs(rows){
    const body = document.getElementById("ghJobsBody");
    if (!body) return;
    if (!rows || !rows.length){
      body.innerHTML = `<tr><td colspan="7" class="muted">No jobs yet.</td></tr>`;
      return;
    }
    body.innerHTML = rows.map(j=>{
      const when = new Date(j.created_at || j.updated_at || Date.now()).toLocaleString();
      const repo = `${j.owner}/${j.repo}`;
      const commit = j.result_url ? `<a href="${j.result_url}" target="_blank" rel="noopener">link</a>` : (j.result_commit_sha ? j.result_commit_sha.slice(0,7) : "");
      const next = j.next_attempt_at ? new Date(j.next_attempt_at).toLocaleString() : "";
      const status = j.status || "";
      const attempts = (j.attempts ?? 0);
      return `<tr>
        <td>${when}</td>
        <td>${repo}</td>
        <td>${j.branch || "main"}</td>
        <td>${status}</td>
        <td>${commit}</td>
        <td>${attempts}</td>
        <td>${next}</td>
      </tr>`;
    }).join("");
  }

  async function loadGhJobs(){
    try {
      const data = await apiJson("/.netlify/functions/gh-my-jobs?limit=25");
      setGhJobs(data.jobs || []);
    } catch (e) {
      setGhJobs([]);
    }
  }

  function fillRepoSelect(repos){
    const sel = document.getElementById("ghRepoSelect");
    if (!sel) return;
    sel.innerHTML = `<option value="">Select a repo…</option>` + (repos || []).map(r=>{
      const full = r.full_name || `${r.owner?.login || ""}/${r.name || ""}`;
      return `<option value="${full}">${full}</option>`;
    }).join("");
  }

  async function loadRepos(){
    const data = await apiJson("/.netlify/functions/github-repos");
    // github-repos returns { repos: [...] }
    fillRepoSelect(data.repos || []);
    showToast("Repos loaded.", true);
  }

  async function refreshGitHubStatus(){
    setGhTokenStatus("Status: checking…");
    try {
      const st = await apiJson("/.netlify/functions/github-token");
      if (st.connected) {
        const who = st.whoami?.login ? ` (@${st.whoami.login})` : "";
        const typ = st.token_type ? ` · ${st.token_type}` : "";
        setGhTokenStatus(`Status: connected${who}${typ}`);
      } else {
        setGhTokenStatus("Status: not connected");
      }
    } catch (e) {
      setGhTokenStatus("Status: unknown (check key / permissions)");
    }
  }

  async function loadGitHubPush(){
    // role detection (for UI guidance)
    try {
      const who = await apiJson("/.netlify/functions/push-whoami");
      ghRole = who.role || "deployer";
    } catch {
      ghRole = null;
    }

    await refreshGitHubStatus();
    await loadGhJobs();

    // enable/disable controls based on role
    const canAdmin = (ghRole === "admin" || ghRole === "owner");
    const oauthBtn = document.getElementById("ghOauthBtn");
    const savePatBtn = document.getElementById("ghSavePatBtn");
    const clearBtn = document.getElementById("ghClearTokenBtn");
    const loadReposBtn = document.getElementById("ghLoadReposBtn");

    [oauthBtn, savePatBtn, clearBtn, loadReposBtn].forEach(b=>{
      if (!b) return;
      b.disabled = !canAdmin && (b === oauthBtn || b === savePatBtn || b === clearBtn || b === loadReposBtn);
      b.title = (!canAdmin && (b === oauthBtn || b === savePatBtn || b === clearBtn || b === loadReposBtn))
        ? "Requires an admin Kaixu Key for this tenant"
        : "";
    });

    if (!ghHandlersInstalled) {
      ghHandlersInstalled = true;

      const refreshBtn = document.getElementById("ghRefreshBtn");
      if (refreshBtn) refreshBtn.addEventListener("click", ()=> loadGitHubPush().catch(()=>{}));

      const repoSel = document.getElementById("ghRepoSelect");
      if (repoSel) repoSel.addEventListener("change", ()=>{
        const v = repoSel.value || "";
        if (!v.includes("/")) return;
        const [o,r] = v.split("/",2);
        const owner = document.getElementById("ghOwner");
        const repo = document.getElementById("ghRepo");
        if (owner) owner.value = o;
        if (repo) repo.value = r;
      });

      const loadReposBtn2 = document.getElementById("ghLoadReposBtn");
      if (loadReposBtn2) loadReposBtn2.addEventListener("click", async ()=>{
        try { await loadRepos(); } catch(e){ showToast(e.detail?.error || e.message || "Failed to load repos", false); }
      });

      const oauth = document.getElementById("ghOauthBtn");
      if (oauth) oauth.addEventListener("click", async ()=>{
        try {
          const data = await apiJson("/.netlify/functions/github-oauth-start", {
            method: "POST",
            body: { scopes: ["repo","workflow"], return_to: window.location.href }
          });
          if (data.authorize_url) window.location.href = data.authorize_url;
        } catch (e) {
          showToast(e.detail?.error || e.message || "OAuth start failed", false);
        }
      });

      const savePat = document.getElementById("ghSavePatBtn");
      if (savePat) savePat.addEventListener("click", async ()=>{
        const inp = document.getElementById("ghPatInput");
        const token = (inp && inp.value ? inp.value.trim() : "");
        if (!token) { showToast("Paste a GitHub token first.", false); return; }
        try {
          await apiJson("/.netlify/functions/github-token", { method: "POST", body: { token, token_type: "pat" }});
          if (inp) inp.value = "";
          showToast("Token saved.", true);
          await refreshGitHubStatus();
        } catch (e) {
          showToast(e.detail?.error || e.message || "Failed to save token", false);
        }
      });

      const clearTok = document.getElementById("ghClearTokenBtn");
      if (clearTok) clearTok.addEventListener("click", async ()=>{
        if (!confirm("Clear GitHub token for this tenant?")) return;
        try {
          await apiJson("/.netlify/functions/github-token", { method: "DELETE" });
          showToast("Token cleared.", true);
          await refreshGitHubStatus();
        } catch (e) {
          showToast(e.detail?.error || e.message || "Failed to clear token", false);
        }
      });

      const copyJob = document.getElementById("ghCopyJobBtn");
      if (copyJob) copyJob.addEventListener("click", async ()=>{
        if (!ghLastJobId) return;
        try {
          await navigator.clipboard.writeText(String(ghLastJobId));
          showToast("Job ID copied.", true);
        } catch {
          showToast("Clipboard not available.", false);
        }
      });

      const start = document.getElementById("ghStartPushBtn");
      if (start) start.addEventListener("click", async ()=>{
        const owner = (document.getElementById("ghOwner")?.value || "").trim();
        const repo = (document.getElementById("ghRepo")?.value || "").trim();
        const branch = (document.getElementById("ghBranch")?.value || "main").trim();
        const msg = (document.getElementById("ghMessage")?.value || "Kaixu GitHub Push").trim();
        const chunkMb = parseInt(document.getElementById("ghChunkMb")?.value || "4", 10);
        const fileEl = document.getElementById("ghZipFile");
        const file = fileEl && fileEl.files && fileEl.files[0] ? fileEl.files[0] : null;

        if (!owner || !repo) { showToast("Owner and Repo are required.", false); return; }
        if (!file) { showToast("Choose a ZIP file.", false); return; }
        if (!/\.zip$/i.test(file.name)) { showToast("File must be a .zip", false); return; }

        try {
          await runGitHubZipPush({ owner, repo, branch, message: msg, file, chunkMb });
        } catch (e) {
          showToast(e.detail?.error || e.message || "Push failed", false);
        }
      });
    }
  }

  async function runGitHubZipPush({ owner, repo, branch, message, file, chunkMb }){
    const chunkSize = Math.max(1, Math.min(16, chunkMb || 4)) * 1024 * 1024;
    setGhProgress("Initializing job…");

    const init = await apiJson("/.netlify/functions/gh-push-init", {
      method: "POST",
      body: { owner, repo, branch, message }
    });

    const jobId = init.jobId || init.job_id || init.id;
    if (!jobId) throw new Error("No jobId returned.");

    ghLastJobId = jobId;
    const copyBtn = document.getElementById("ghCopyJobBtn");
    if (copyBtn) copyBtn.disabled = false;

    const parts = Math.ceil(file.size / chunkSize);
    setGhProgress(`Job ${jobId}\nUploading ${parts} chunks…`);

    for (let i = 0; i < parts; i++) {
      const start = i * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const slice = file.slice(start, end);
      const buf = await slice.arrayBuffer();

      await apiBinary(`/.netlify/functions/gh-push-upload-chunk?jobId=${encodeURIComponent(jobId)}&part=${i}&parts=${parts}`, {
        method: "PUT",
        body: buf,
        headers: { "content-type": "application/octet-stream" }
      });

      const pct = Math.round(((i + 1) / parts) * 100);
      setGhProgress(`Job ${jobId}\nUploading… ${pct}% (${i+1}/${parts})`);
    }

    setGhProgress(`Job ${jobId}\nQueuing background commit…`);
    await apiJson("/.netlify/functions/gh-push-upload-complete", { method: "POST", body: { jobId } });

    // Poll status
    let done = false;
    while (!done) {
      const st = await apiJson(`/.netlify/functions/gh-push-status?jobId=${encodeURIComponent(jobId)}`);
      const status = st?.job?.status || st?.status || "";
      const attempts = st?.job?.attempts ?? st?.attempts ?? 0;
      const next = st?.job?.next_attempt_at || st?.next_attempt_at || "";
      const url = st?.job?.result_url || st?.result_url || "";
      const sha = st?.job?.result_commit_sha || st?.result_commit_sha || "";
      const err = st?.job?.last_error || st?.last_error || "";

      let line = `Job ${jobId}\nStatus: ${status} (attempts: ${attempts})`;
      if (next) line += `\nNext attempt: ${new Date(next).toLocaleString()}`;
      if (sha) line += `\nCommit: ${sha}`;
      if (url) line += `\nURL: ${url}`;
      if (err && status !== "done") line += `\nLast error: ${err}`;
      setGhProgress(line);

      if (status === "done") {
        showToast("GitHub push complete.", true);
        done = true;
      } else if (status === "error") {
        throw new Error(err || "GitHub push failed");
      } else {
        await new Promise(r=> setTimeout(r, 2000));
      }
    }

    await loadGhJobs();
  }



  async function loadVoice(){
    const summary = await apiJson("/.netlify/functions/user-voice-summary");
    const nums = summary?.voice?.numbers || [];
    const pricing = summary?.voice?.pricing || {};

    const numbersEl = $("#voiceNumbers");
    const pricingEl = $("#voicePricing");
    if (numbersEl){
      if (!nums.length) numbersEl.innerHTML = "<div class='muted'>No voice numbers mapped to this customer yet.</div>";
      else numbersEl.innerHTML = nums.map(n => `
        <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
          <div><b>${esc(n.phone_number)}</b> <span class="pill">${esc(n.provider)}</span> ${n.is_active ? "" : "<span class='pill danger'>disabled</span>"}</div>
          <div class="muted">LLM: ${esc(n.default_llm_provider)} · ${esc(n.default_llm_model)} · ${esc(n.locale)} · ${esc(n.timezone)}</div>
        </div>
      `).join("");
    }
    if (pricingEl){
      pricingEl.innerHTML = `
        <div>markup_pct: <b>${esc(pricing.markup_pct)}</b></div>
        <div>usd_per_minute_est: <b>${esc(pricing.usd_per_minute_est)}</b></div>
      `;
    }

    await loadVoiceCalls();
  }

  async function loadVoiceCalls(){
    const callsRes = await apiJson("/.netlify/functions/user-voice-calls?limit=50");
    const calls = callsRes?.calls || [];
    const el = $("#voiceCalls");
    if (!el) return;
    if (!calls.length){
      el.innerHTML = "<div class='muted'>No calls yet.</div>";
      return;
    }
    el.innerHTML = calls.map(c => `
      <div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
        <div><b>${esc(c.from_number||"unknown")}</b> → <b>${esc(c.to_number||"")}</b> <span class="pill">${esc(c.status)}</span></div>
        <div class="muted">${esc(c.started_at)}${c.ended_at ? " · ended " + esc(c.ended_at) : ""}${c.duration_seconds ? " · " + esc(c.duration_seconds) + "s" : ""}</div>
        <div class="muted">est_cost_cents: ${esc(c.est_cost_cents)} · bill_cost_cents: ${esc(c.bill_cost_cents)}</div>
      </div>
    `).join("");
  }


  // Voice refresh
  const refreshVoiceBtn = $("#refreshVoiceBtn");
  if (refreshVoiceBtn) refreshVoiceBtn.addEventListener("click", ()=> loadVoice().catch(()=>{}));

})();
