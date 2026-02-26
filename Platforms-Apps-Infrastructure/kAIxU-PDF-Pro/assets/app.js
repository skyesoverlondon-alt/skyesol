(() => {
  "use strict";

  const APP_ID = "skyesoverlondon-kaixu-suite";
  const BUILD_ID = "2026.02.26.3";
  const PROVIDER = "Skyes Over London";
  const INTELLIGENCE = "kAIxU";
  const LOGO_URL = "https://cdn1.sharemyimage.com/2026/02/16/logo1_transparent.png";

  const VAULT = {
    list: "/.netlify/functions/vault-list",
    get: "/.netlify/functions/vault-get",
    save: "/.netlify/functions/vault-save",
    del: "/.netlify/functions/vault-delete",
    blobPut: "/.netlify/functions/blob-put",
    blobGet: "/.netlify/functions/blob-get",
    upload: "/.netlify/functions/attachment-upload"
  };

  const LS_KEY = "kaixu_suite_state_v1";

  const $ = (id) => document.getElementById(id);

  const state = {
    toolId: "01-valuation",
    lastResult: null,
    lastInputs: {},
    workspaces: {
      currentId: null,
      list: []
    },
    lastError: null,
    attachments: []
  };

  function nowISO() {
    return new Date().toISOString();
  }

  function uid(prefix = "KX") {
    const s = Math.random().toString(16).slice(2, 10).toUpperCase();
    const t = Date.now().toString(16).toUpperCase().slice(-6);
    return `${prefix}-${t}-${s}`;
  }

  
  function showLoader(on) {
    const l = document.getElementById("cineloader");
    if (!l) return;
    if (on) l.classList.add("on");
    else l.classList.remove("on");
  }

  function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function toast(msg, ok=true){
    const id = "kaixuToast";
    let t = document.getElementById(id);
    if (!t) {
      t = document.createElement("div");
      t.id = id;
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.dataset.ok = ok ? "1" : "0";
    t.classList.add("on");
    clearTimeout(t.__tm);
    t.__tm = setTimeout(()=>t.classList.remove("on"), 2600);
  }

function safeJSONParse(text) {
    try { return JSON.parse(text); } catch { return null; }
  }

  function loadState() {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = safeJSONParse(raw);
    if (!parsed) return;
    Object.assign(state, parsed);
  }

  function saveState() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  function ensureDefaultWorkspace() {
    if (!state.workspaces || !Array.isArray(state.workspaces.list)) {
      state.workspaces = { currentId: null, list: [] };
    }
    if (state.workspaces.list.length === 0) {
      const id = uid("WS");
      state.workspaces.list.push({
        id,
        name: "Default Workspace",
        drafts: {},
        history: []
      });
      state.workspaces.currentId = id;
      saveState();
    }
    if (!state.workspaces.currentId) {
      state.workspaces.currentId = state.workspaces.list[0].id;
      saveState();
    }
  }

  function getCurrentWorkspace() {
    return state.workspaces.list.find(w => w.id === state.workspaces.currentId) || state.workspaces.list[0];
  }

  function setLastError(errObj) {
    state.lastError = errObj ? {
      at: nowISO(),
      toolId: state.toolId,
      error: errObj
    } : null;
    saveState();
    renderDiagnostics();
    vaultRefreshUI().catch(()=>{});
    renderAttachments();
    tryReportClientError(errObj).catch(()=>{});
  }

  async function tryReportClientError(errObj) {
    if (!errObj) return;
    await fetch("/.netlify/functions/client-error-report", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kaixu-app": APP_ID,
        "x-kaixu-build": BUILD_ID
      },
      body: JSON.stringify({
        app: APP_ID,
        build: BUILD_ID,
        provider: PROVIDER,
        intelligence: INTELLIGENCE,
        toolId: state.toolId,
        at: nowISO(),
        error: errObj
      })
    });
  }

  function parseToolFromHash() {
    const h = (location.hash || "").replace(/^#/, "").trim();
    if (!h) return "01-valuation";
    if (h === "diagnostics") return "diagnostics";
    const m = h.match(/tool\s*=\s*([a-z0-9\-]+)/i);
    return (m && m[1]) ? m[1] : h;
  }

  function setHashTool(toolId) {
    location.hash = `#${toolId}`;
  }

  function toolById(id) {
    return (window.KAIXU_TOOLS || []).find(t => t.id === id);
  }

  function formatDateShort(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, { year:"numeric", month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit" });
    } catch { return iso; }
  }

  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined) n.textContent = txt;
    return n;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  /* UPDATED: renderNav targets top tabs (toolTabs). Keeps backward-compat if toolNav exists. */
  function renderNav(filterText = "") {
    const tabsHost = $("toolTabs") || $("toolNav");
    if (!tabsHost) return;
    clear(tabsHost);

    const ft = filterText.trim().toLowerCase();
    const tools = (window.KAIXU_TOOLS || []).slice();

    tools
      .filter(t => !ft || (t.name + " " + t.tagline + " " + t.id + " " + t.number).toLowerCase().includes(ft))
      .forEach(t => {
        const a = document.createElement("a");
        a.href = `./tool.html#${t.id}`;
        a.className = $("toolTabs") ? "tab" : "";
        if (t.id === state.toolId) a.classList.add("active");
        a.title = t.tagline;

        if ($("toolTabs")) {
          const num = el("span", "tnum", t.number);
          const name = el("span", "tname", t.name);
          a.appendChild(num);
          a.appendChild(name);
        } else {
          const left = el("div", null);
          left.appendChild(el("div", null, `${t.number} — ${t.name}`));
          left.appendChild(el("small", null, t.tagline));
          const right = el("div", "mono muted", t.id);
          a.appendChild(left);
          a.appendChild(right);
        }

        tabsHost.appendChild(a);
      });

    if ($("toolTabs")) {
      const d = document.createElement("a");
      d.href = `./tool.html#diagnostics`;
      d.className = "tab diag";
      if (state.toolId === "diagnostics") d.classList.add("active");
      d.title = "Diagnostics";
      d.appendChild(el("span", "tnum", "DX"));
      d.appendChild(el("span", "tname", "Diagnostics"));
      tabsHost.appendChild(d);
    }
  }

  function renderWorkspaceUI() {
    const sel = $("wsSelect");
    const nm = $("wsName");
    if (!sel || !nm) return;

    clear(sel);
    state.workspaces.list.forEach(w => {
      const opt = document.createElement("option");
      opt.value = w.id;
      opt.textContent = w.name;
      sel.appendChild(opt);
    });
    sel.value = state.workspaces.currentId;

    const ws = getCurrentWorkspace();
    nm.value = ws?.name || "";
  }

  function renderHeader() {
    const tool = toolById(state.toolId);
    const title = $("toolTitle");
    const tag = $("toolTagline");
    if (!title || !tag) return;

    if (state.toolId === "diagnostics") {
      title.textContent = "Diagnostics";
      tag.textContent = `Provider: ${PROVIDER}`;
      return;
    }

    title.textContent = `${tool?.number || ""} — ${tool?.name || "Tool"}`;
    tag.textContent = tool?.tagline ? `${tool.tagline} • Provider: ${PROVIDER}` : `Provider: ${PROVIDER}`;
  }

  function buildField(field, values) {
    const wrap = el("div", "field");
    const lab = el("label", null, field.label + (field.required ? " *" : ""));
    wrap.appendChild(lab);

    let input;
    const val = values[field.key] ?? field.default ?? "";

    if (field.type === "textarea") {
      input = el("textarea", "textarea");
      input.value = val;
    } else if (field.type === "select") {
      input = el("select", "select");
      (field.options || []).forEach(o => {
        const opt = document.createElement("option");
        opt.value = o;
        opt.textContent = o;
        input.appendChild(opt);
      });
      input.value = val;
    } else if (field.type === "checkbox") {
      const row = el("div", "checkrow");
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!val;
      row.appendChild(input);
      row.appendChild(el("div", null, field.placeholder || "Enabled"));
      wrap.appendChild(row);
      if (field.hint) wrap.appendChild(el("div", "hint", field.hint));
      input.dataset.key = field.key;
      input.dataset.type = field.type;
      return wrap;
    } else {
      input = el("input", "input");
      input.type = field.type === "number" ? "number" : (field.type || "text");
      input.value = val;
      if (field.placeholder) input.placeholder = field.placeholder;
    }

    input.dataset.key = field.key;
    input.dataset.type = field.type;

    wrap.appendChild(input);
    if (field.hint) wrap.appendChild(el("div", "hint", field.hint));
    return wrap;
  }

  function gatherFormValues() {
    const form = $("toolForm");
    if (!form) return {};
    const out = {};
    form.querySelectorAll("[data-key]").forEach(node => {
      const key = node.dataset.key;
      const type = node.dataset.type;
      if (type === "checkbox") out[key] = node.checked;
      else if (type === "number") out[key] = node.value === "" ? null : Number(node.value);
      else out[key] = node.value;
    });
    return out;
  }

  function validateRequired(tool, values) {
    const missing = [];
    (tool.fields || []).forEach(f => {
      if (!f.required) return;
      const v = values[f.key];
      const ok = (typeof v === "number") ? Number.isFinite(v) : (v !== null && v !== undefined && String(v).trim() !== "");
      if (!ok) missing.push(f.label);
    });
    return missing;
  }

  function renderForm() {
    const form = $("toolForm");
    if (!form) return;
    clear(form);

    if (state.toolId === "diagnostics") {
      form.appendChild(el("div","muted","Diagnostics has no inputs."));
      return;
    }

    const tool = toolById(state.toolId);
    const ws = getCurrentWorkspace();
    const draft = ws?.drafts?.[state.toolId] || {};
    const values = { ...(state.lastInputs[state.toolId] || {}), ...(draft || {}) };

    (tool.fields || []).forEach(f => {
      form.appendChild(buildField(f, values));
    });
  }

  function renderHistory() {
    const box = $("history");
    if (!box) return;
    clear(box);

    const ws = getCurrentWorkspace();
    const hist = (ws.history || []).slice().reverse().filter(h => h.toolId === state.toolId);

    if (hist.length === 0) {
      box.appendChild(el("div","muted","No runs yet for this tool in this workspace."));
      return;
    }

    hist.slice(0, 8).forEach(h => {
      const row = el("div","hitem");
      const meta = el("div","hmeta");
      meta.appendChild(el("div","htitle", h.title || `${state.toolId} run`));
      meta.appendChild(el("div","hsub", `${formatDateShort(h.at)} • Cert: ${h.certificate_id || "—"}`));

      const act = el("div","hactions");
      const open = el("button","btn ghost small","Open");
      open.addEventListener("click", () => {
        state.lastResult = h.result || null;
        saveState();
        renderResults();
      });
      const pdf = el("button","btn ghost small","PDF");
      pdf.addEventListener("click", () => exportPDF(h.result || null));

      act.appendChild(open);
      act.appendChild(pdf);

      row.appendChild(meta);
      row.appendChild(act);
      box.appendChild(row);
    });
  }

  function renderResults() {
    const out = $("resultSummary");
    if (!out) return;
    clear(out);

    const r = state.lastResult;
    if (!r) {
      out.appendChild(el("div","muted","Run kAIxU to generate a structured result, then export PDF."));
      return;
    }

    const meta = r.meta || {};
    out.appendChild(el("div","mono muted", `Provider: ${meta.provider || PROVIDER} • Intelligence: ${INTELLIGENCE} • Generated: ${meta.generated_at || nowISO()}`));
    out.appendChild(el("div","mono muted", `Certificate ID: ${meta.certificate_id || "—"}`));

    const summary = r.summary || {};
    if (summary.title) out.appendChild(el("h3", null, summary.title));
    if (summary.subtitle) out.appendChild(el("div","muted", summary.subtitle));

    if (Array.isArray(summary.highlights) && summary.highlights.length) {
      const ul = document.createElement("ul");
      summary.highlights.slice(0, 8).forEach(x => ul.appendChild(el("li", null, String(x))));
      out.appendChild(ul);
    }

    const metrics = Array.isArray(r.metrics) ? r.metrics : [];
    if (metrics.length) {
      const grid = el("div","kpi");
      metrics.slice(0, 6).forEach(m => {
        const c = el("div","kcard");
        c.appendChild(el("div","klabel", m.label || "Metric"));
        c.appendChild(el("div","kvalue", m.value || "—"));
        if (m.note) c.appendChild(el("div","muted", m.note));
        grid.appendChild(c);
      });
      out.appendChild(grid);
    }

    const sections = Array.isArray(r.sections) ? r.sections : [];
    sections.forEach(s => {
      if (s.heading) out.appendChild(el("h3", null, s.heading));
      if (s.body) out.appendChild(el("div","muted", s.body));

      if (Array.isArray(s.bullets) && s.bullets.length) {
        const ul = document.createElement("ul");
        s.bullets.slice(0, 12).forEach(b => ul.appendChild(el("li", null, String(b))));
        out.appendChild(ul);
      }

      if (s.table && Array.isArray(s.table.headers) && Array.isArray(s.table.rows)) {
        out.appendChild(renderTable(s.table.headers, s.table.rows));
      }
    });

    if (Array.isArray(r.next_steps) && r.next_steps.length) {
      out.appendChild(el("h3", null, "Next Steps"));
      const ul = document.createElement("ul");
      r.next_steps.slice(0, 10).forEach(n => ul.appendChild(el("li", null, String(n))));
      out.appendChild(ul);
    }

    if (Array.isArray(r.disclaimers) && r.disclaimers.length) {
      out.appendChild(el("h3", null, "Disclaimers"));
      const ul = document.createElement("ul");
      r.disclaimers.slice(0, 8).forEach(d => ul.appendChild(el("li","muted", String(d))));
      out.appendChild(ul);
    }
  }

  function renderTable(headers, rows) {
    const wrap = el("div", null);
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.margin = "8px 0 14px";
    table.style.fontSize = "13px";

    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    headers.forEach(h => {
      const th = document.createElement("th");
      th.textContent = String(h);
      th.style.textAlign = "left";
      th.style.padding = "8px";
      th.style.borderBottom = "1px solid rgba(255,255,255,.12)";
      th.style.color = "rgba(245,240,255,.85)";
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.slice(0, 18).forEach(r => {
      const tr = document.createElement("tr");
      (r || []).forEach(cell => {
        const td = document.createElement("td");
        td.textContent = cell === null || cell === undefined ? "" : String(cell);
        td.style.padding = "8px";
        td.style.borderBottom = "1px solid rgba(255,255,255,.08)";
        td.style.color = "rgba(245,240,255,.78)";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function renderDiagnostics() {
    const a = $("diagApp");
    const b = $("diagBuild");
    if (a) a.textContent = APP_ID;
    if (b) b.textContent = BUILD_ID;

    const pre = $("lastErr");
    if (pre) pre.textContent = state.lastError ? JSON.stringify(state.lastError, null, 2) : "(none)";
  }

  function setStatus(text, ok = null) {
    const s = $("runStatus");
    if (!s) return;
    s.textContent = text;
    if (ok === true) s.style.color = "rgba(52,211,153,.95)";
    else if (ok === false) s.style.color = "rgba(255,77,109,.95)";
    else s.style.color = "rgba(245,240,255,.72)";
  }

  
  function getKaixuKey() {
    return localStorage.getItem("KAIXU_VIRTUAL_KEY") || "";
  }

  function setKaixuKey(v) {
    const key = String(v || "").trim();
    if (!key) localStorage.removeItem("KAIXU_VIRTUAL_KEY");
    else localStorage.setItem("KAIXU_VIRTUAL_KEY", key);
  }

  function extractJsonCandidate(text) {
    const t = String(text || "").trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence && fence[1]) return fence[1].trim();
    const b1 = t.indexOf("{"), b2 = t.lastIndexOf("}");
    if (b1 !== -1 && b2 !== -1 && b2 > b1) return t.slice(b1, b2 + 1);
    return t;
  }

  function updateBudget(month) {
    const badge = $("budgetBadge");
    if (!badge || !month) return;
    const cap = Number(month.cap_cents ?? 0);
    const spent = Number(month.spent_cents ?? 0);
    const remain = Math.max(0, cap - spent);
    badge.textContent = `Budget: $${(remain/100).toFixed(2)} left`;
    badge.title = `Month ${month.month || ""} • Cap $${(cap/100).toFixed(2)} • Spent $${(spent/100).toFixed(2)}`;
  }

  function mapGatewayError(err) {
    const status = Number(err?.status || err?.statusCode || 0);
    if (status === 401) return "Invalid/missing Kaixu Key (401).";
    if (status === 402) return "Monthly cap reached (402).";
    if (status === 429) return "Rate limited (429). Try again shortly.";
    if (status >= 500) return "Gateway/provider error (500+).";
    return "Request failed.";
  }

  async function callKaixu(tool, inputs, quality) {
    // Internal mapping (not user-facing).
    const provider = "gemini";
    const model =
      quality === "pro"  ? "gemini-2.5-pro" :
      quality === "lite" ? "gemini-2.0-flash" :
                           "gemini-2.0-flash";

    const maxTokens =
      quality === "pro"  ? 8192 :
      quality === "lite" ? 4096 :
                           8192;

    const temperature =
      quality === "pro"  ? 0.25 :
      quality === "lite" ? 0.35 :
                           0.25;

    const certificateId = uid("KX");
    const generatedAt = nowISO();

    const systemInstruction = [
      `You are ${INTELLIGENCE}, the intelligence layer operated by ${PROVIDER}.`,
      `Never mention any underlying vendor names, model names, or other providers.`,
      `Never mention any provider besides ${PROVIDER}.`,
      `Return ONLY valid JSON (no markdown, no extra text).`,
      `Write in an enterprise binder voice: crisp, structured, decisive.`,
      `Include meta.provider="${PROVIDER}", meta.intelligence="${INTELLIGENCE}", and meta.certificate_id="${certificateId}".`
    ].join("\n");

    const userPrompt = [
      `TOOL: ${tool.name} (${tool.id})`,
      `GOAL: ${tool.prompt_goal || ""}`,
      `PROVIDER: ${PROVIDER}`,
      `INTELLIGENCE: ${INTELLIGENCE}`,
      ``,
      `INPUTS (JSON):`,
      JSON.stringify(inputs, null, 2),
      ``,
      `OUTPUT REQUIREMENTS:`,
      `- Produce an object with keys: meta, summary, metrics, sections, next_steps, disclaimers, pdf.`,
      `- meta must include: provider, intelligence, tool_id, tool_name, certificate_id, generated_at.`,
      `- summary must include: title, subtitle, highlights (array).`,
      `- metrics: array of {label, value, note}.`,
      `- sections: array of {heading, body, bullets, table}.`,
      `- pdf should include: filename, watermarkText, qrPayload.`,
      `- Provide at least 4 sections, each with bullets. If numbers are needed, be explicit.`,
      `- Add practical next steps and clear disclaimers (not legal advice / not financial advice where appropriate).`
    ].join("\n");

    const payload = {
      provider,
      model,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt }
      ],
      max_tokens: maxTokens,
      temperature
    };

    const kaixuKey = getKaixuKey();
    if (!kaixuKey) throw { status: 401, error: "Missing KAIXU_VIRTUAL_KEY" };

    if (!window.kAIxuGateway13 || !window.kAIxuGateway13.kaixuStreamChat) {
      throw { status: 500, error: "Gateway client missing" };
    }

    let buffer = "";
    let lastMonth = null;
    let lastUsage = null;

    await window.kAIxuGateway13.kaixuStreamChat(kaixuKey, payload, {
      onMeta: (m) => {
        if (m && m.month) {
          lastMonth = m.month;
          updateBudget(m.month);
        }
      },
      onDelta: (txt) => {
        buffer += txt;
        const tail = buffer.slice(-60).replace(/\s+/g, " ").trim();
        if (tail) setStatus(`Streaming… ${tail}`, null);
      },
      onDone: (d) => {
        if (d && d.month) {
          lastMonth = d.month;
          updateBudget(d.month);
        }
        if (d && d.usage) lastUsage = d.usage;
      },
      onError: (e) => {
        setLastError(e);
      }
    });

    const extracted = extractJsonCandidate(buffer);
    const out = safeJSONParse(extracted);
    if (!out) throw { status: 502, error: "Non-JSON output from kAIxU", raw: buffer.slice(0, 2000) };

    out.meta = out.meta || {};
    out.meta.provider = PROVIDER;
    out.meta.intelligence = INTELLIGENCE;
    out.meta.tool_id = tool.id;
    out.meta.tool_name = tool.name;
    out.meta.certificate_id = out.meta.certificate_id || certificateId;
    out.meta.generated_at = out.meta.generated_at || generatedAt;

    out.pdf = out.pdf || {};
    out.pdf.watermarkText = PROVIDER;
    out.pdf.filename = out.pdf.filename || `${tool.id}-${out.meta.certificate_id}.pdf`;
    out.pdf.qrPayload = out.pdf.qrPayload || `${location.origin}/tool.html#${tool.id}`;

    out.__usage = lastUsage;
    out.__month = lastMonth;

    return out;
  }
async function runTool() {
    if (state.toolId === "diagnostics") return;

    const tool = toolById(state.toolId);
    if (!tool) return;

    const inputs = gatherFormValues();
    try {
      const include = document.getElementById('attachInclude');
      if (include && include.checked && Array.isArray(state.attachments) && state.attachments.length) {
        inputs.__attachments = state.attachments.map(a => ({ key: a.key, name: a.name, type: a.type }));
      }
    } catch {}

    const missing = validateRequired(tool, inputs);
    if (missing.length) {
      setStatus("Missing required: " + missing.join(", "), false);
      return;
    }

    state.lastInputs[state.toolId] = inputs;
    saveState();

    const quality = $("qualityMode") ? $("qualityMode").value : "fast";

    setStatus("Running kAIxU…", null);
    setLastError(null);

    const t0 = performance.now();
    try {
      const result = await callKaixu(tool, inputs, quality);
      const t1 = performance.now();

      state.lastResult = result;
      saveState();

      const ws = getCurrentWorkspace();
      ws.history = ws.history || [];
      const cert = (result.meta && result.meta.certificate_id) ? result.meta.certificate_id : uid("KX");
      ws.history.push({
        id: uid("RUN"),
        at: nowISO(),
        toolId: state.toolId,
        title: (result.summary && result.summary.title) ? result.summary.title : `${tool.name} result`,
        certificate_id: cert,
        result
      });
      saveState();

      setStatus(`Complete • ${(t1 - t0).toFixed(0)}ms`, true);
      renderResults();
      renderHistory();
    } catch (err) {
      setStatus((typeof mapGatewayError==="function"?mapGatewayError(err):"Error (see Diagnostics)"), false);
      setLastError(err);
    }
  }

  async function loadImageDataURL(url) {
    try {
      const r = await fetch(url, { mode: "cors" });
      if (!r.ok) return null;
      const blob = await r.blob();
      return await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => resolve(null);
        fr.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  function wrapText(doc, text, x, y, maxWidth, lineHeight) {
    const lines = doc.splitTextToSize(String(text || ""), maxWidth);
    lines.forEach((ln, i) => doc.text(ln, x, y + i * lineHeight));
    return y + lines.length * lineHeight;
  }

  async function exportPDF(forcedResult = null) {
    const result = forcedResult || state.lastResult;
    if (!result) {
      setStatus("No result to export yet.", false);
      return;
    }

    setStatus("Building PDF…", null);

    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      setStatus("PDF library missing.", false);
      return;
    }

    const meta = result.meta || {};
    const summary = result.summary || {};
    const sections = Array.isArray(result.sections) ? result.sections : [];
    const metrics = Array.isArray(result.metrics) ? result.metrics : [];
    const nextSteps = Array.isArray(result.next_steps) ? result.next_steps : [];
    const disclaimers = Array.isArray(result.disclaimers) ? result.disclaimers : [];

    const certId = meta.certificate_id || uid("KX");
    const pdfName = (result.pdf && result.pdf.filename) ? result.pdf.filename : `${state.toolId}-${certId}.pdf`;

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const margin = 46;
    const line = 16;

    const logoData = await loadImageDataURL(LOGO_URL);

    function drawHeaderFooter(pageNum) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(PROVIDER, margin, 28);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`${INTELLIGENCE} • Certificate: ${certId}`, margin, 44);

      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Provider: ${PROVIDER} • Generated: ${meta.generated_at || nowISO()}`, margin, pageH - 26);
      doc.text(`Page ${pageNum}`, pageW - margin, pageH - 26, { align: "right" });
      doc.setTextColor(0);
    }

    function drawWatermark() {
      doc.saveGraphicsState && doc.saveGraphicsState();
      if (doc.setGState) {
        const g = new doc.GState({ opacity: 0.10 });
        doc.setGState(g);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(42);
      doc.setTextColor(80);
      doc.text(PROVIDER.toUpperCase(), pageW/2, pageH/2, { align: "center", angle: 24 });
      doc.setTextColor(0);
      doc.restoreGraphicsState && doc.restoreGraphicsState();
    }

    drawWatermark();
    if (logoData && doc.addImage) {
      try { doc.addImage(logoData, "PNG", margin, 70, 90, 90); } catch {}
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(summary.title || `${PROVIDER} — Document`, margin, 190);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(80);
    doc.text(summary.subtitle || "Official binder export", margin, 214);
    doc.setTextColor(0);

    doc.setFontSize(11);
    doc.text(`Provider: ${PROVIDER}`, margin, 250);
    doc.text(`Intelligence: ${INTELLIGENCE}`, margin, 268);
    doc.text(`Certificate ID: ${certId}`, margin, 286);
    doc.text(`Generated: ${meta.generated_at || nowISO()}`, margin, 304);

    const qrPayload = (result.pdf && result.pdf.qrPayload)
      ? String(result.pdf.qrPayload)
      : `${location.origin}/tool.html#${state.toolId}`;

    try {
      const canvas = document.createElement("canvas");
      // eslint-disable-next-line no-undef
      new QRious({ element: canvas, value: qrPayload, size: 140, level: "M" });
      const qrData = canvas.toDataURL("image/png");
      doc.addImage(qrData, "PNG", pageW - margin - 140, 250, 140, 140);
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text("Verification QR", pageW - margin - 70, 404, { align: "center" });
      doc.setTextColor(0);
    } catch {}

    drawHeaderFooter(1);

    doc.addPage();
    let pageNum = 2;

    function newPageIfNeeded(yNeeded) {
      if (yNeeded > pageH - margin - 40) {
        drawHeaderFooter(pageNum);
        doc.addPage();
        pageNum += 1;
        drawWatermark();
        return margin;
      }
      return yNeeded;
    }

    drawWatermark();
    let y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Executive Summary", margin, y);
    y += 20;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    y = wrapText(doc, (summary.subtitle || ""), margin, y, pageW - margin*2, line) + 6;

    if (Array.isArray(summary.highlights) && summary.highlights.length) {
      doc.setFont("helvetica", "bold");
      doc.text("Highlights", margin, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      summary.highlights.slice(0, 12).forEach(h => {
        y = newPageIfNeeded(y);
        y = wrapText(doc, `• ${h}`, margin, y, pageW - margin*2, line);
      });
      y += 8;
    }

    if (metrics.length) {
      y = newPageIfNeeded(y + 14);
      doc.setFont("helvetica", "bold");
      doc.text("Key Metrics", margin, y);
      y += 16;
      doc.setFont("helvetica", "normal");

      metrics.slice(0, 12).forEach(m => {
        y = newPageIfNeeded(y);
        const lineText = `${m.label || "Metric"}: ${m.value || "—"}${m.note ? ` (${m.note})` : ""}`;
        y = wrapText(doc, `• ${lineText}`, margin, y, pageW - margin*2, line);
      });
      y += 8;
    }

    sections.forEach(sec => {
      y = newPageIfNeeded(y + 18);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(sec.heading || "Section", margin, y);
      y += 16;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      if (sec.body) {
        y = newPageIfNeeded(y);
        y = wrapText(doc, sec.body, margin, y, pageW - margin*2, line) + 6;
      }

      if (Array.isArray(sec.bullets) && sec.bullets.length) {
        sec.bullets.slice(0, 16).forEach(b => {
          y = newPageIfNeeded(y);
          y = wrapText(doc, `• ${b}`, margin, y, pageW - margin*2, line);
        });
        y += 6;
      }

      if (sec.table && Array.isArray(sec.table.headers) && Array.isArray(sec.table.rows)) {
        y = newPageIfNeeded(y + 8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        const headers = sec.table.headers.map(String);
        doc.text(headers.join(" | "), margin, y);
        y += 14;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        sec.table.rows.slice(0, 14).forEach(row => {
          y = newPageIfNeeded(y);
          const lineRow = (row || []).map(v => (v === null || v === undefined ? "" : String(v))).join(" | ");
          y = wrapText(doc, lineRow, margin, y, pageW - margin*2, 13);
        });
        y += 10;
      }
    });

    if (nextSteps.length) {
      y = newPageIfNeeded(y + 18);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Next Steps", margin, y);
      y += 16;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      nextSteps.slice(0, 14).forEach(n => {
        y = newPageIfNeeded(y);
        y = wrapText(doc, `• ${n}`, margin, y, pageW - margin*2, line);
      });
      y += 8;
    }

    if (disclaimers.length) {
      y = newPageIfNeeded(y + 18);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Disclaimers", margin, y);
      y += 16;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      disclaimers.slice(0, 10).forEach(d => {
        y = newPageIfNeeded(y);
        y = wrapText(doc, `• ${d}`, margin, y, pageW - margin*2, 14);
      });
    }

    drawHeaderFooter(pageNum);

    doc.save(pdfName);
    setStatus(`PDF exported: ${pdfName}`, true);
  }


  async function vaultPing() {
    try {
      const r = await fetch(VAULT.list + "?ping=1", { headers: { "x-kaixu-app": APP_ID, "x-kaixu-build": BUILD_ID } });
      return r.ok;
    } catch { return false; }
  }

  function vaultUIStatus(text, live=true) {
    const s = $("vaultStatus");
    if (!s) return;
    s.textContent = text;
    s.className = live ? "badge badge-live" : "badge";
  }

  function currentWorkspaceId() {
    return state.workspaces.currentId || "default";
  }

  async function vaultListAll() {
    const q = encodeURIComponent(currentWorkspaceId());
    const r = await fetch(`${VAULT.list}?workspace_id=${q}`, { headers: { "x-kaixu-app": APP_ID, "x-kaixu-build": BUILD_ID } });
    const t = await r.text();
    const js = safeJSONParse(t);
    if (!r.ok) throw (js || { status: r.status, body: t });
    return js;
  }

  async function vaultGet(runId) {
    const r = await fetch(`${VAULT.get}?run_id=${encodeURIComponent(runId)}`, { headers: { "x-kaixu-app": APP_ID, "x-kaixu-build": BUILD_ID } });
    const t = await r.text();
    const js = safeJSONParse(t);
    if (!r.ok) throw (js || { status: r.status, body: t });
    return js;
  }

  async function vaultDelete(runId) {
    const r = await fetch(VAULT.del, {
      method: "POST",
      headers: { "content-type": "application/json", "x-kaixu-app": APP_ID, "x-kaixu-build": BUILD_ID },
      body: JSON.stringify({ run_id: runId })
    });
    const t = await r.text();
    const js = safeJSONParse(t);
    if (!r.ok) throw (js || { status: r.status, body: t });
    return js;
  }

  async function vaultRefreshUI() {
    const list = $("vaultList");
    if (!list) return;
    list.innerHTML = "";

    try {
      const ok = await vaultPing();
      if (!ok) {
        vaultUIStatus("Cloud: OFF (set DATABASE_URL)", false);
        list.innerHTML = "<div class='muted'>Vault is offline. Set DATABASE_URL for Neon, then redeploy.</div>";
        return;
      }

      vaultUIStatus("Cloud: ONLINE", true);
      const data = await vaultListAll();
      const items = (data && data.items) ? data.items : [];

      const query = ($("vaultQuery")?.value || "").trim().toLowerCase();
      const filtered = !query ? items : items.filter(x =>
        String(x.title||"").toLowerCase().includes(query) ||
        String(x.tool_name||"").toLowerCase().includes(query) ||
        String(x.tool_id||"").toLowerCase().includes(query)
      );

      if (filtered.length === 0) {
        list.innerHTML = "<div class='muted'>No vault entries yet for this workspace.</div>";
        return;
      }

      filtered.slice(0, 40).forEach(x => {
        const row = document.createElement("div");
        row.className = "vault-row";

        const meta = document.createElement("div");
        meta.className = "meta";
        const title = document.createElement("div");
        title.className = "title";
        title.textContent = x.title || "Saved run";
        const sub = document.createElement("div");
        sub.className = "sub";
        sub.textContent = `${x.tool_id || ""} • ${formatDateShort(x.created_at || x.at || "")}`;
        meta.appendChild(title);
        meta.appendChild(sub);

        const actions = document.createElement("div");
        actions.className = "actions";

        const openBtn = document.createElement("button");
        openBtn.className = "btn ghost small";
        openBtn.textContent = "Open";
        openBtn.onclick = async () => {
          showLoader(true);
          try {
            const full = await vaultGet(x.run_id);
            state.lastResult = full.result || null;
            state.lastInputs[state.tool_id || state.toolId] = full.inputs || {};
            saveState();
            renderResults();
            toast("Loaded from Vault.", true);
          } catch (e) {
            setLastError(e);
            toast("Vault load failed.", false);
          } finally {
            showLoader(false);
          }
        };

        const pdfBtn = document.createElement("button");
        pdfBtn.className = "btn neon small";
        pdfBtn.textContent = "PDF";
        pdfBtn.onclick = () => {
          const key = x.pdf_blob_key;
          if (!key) { toast("No PDF saved for this run.", false); return; }
          window.open(`${VAULT.blobGet}?key=${encodeURIComponent(key)}`, "_blank");
        };

        const delBtn = document.createElement("button");
        delBtn.className = "btn ghost small";
        delBtn.textContent = "Delete";
        delBtn.onclick = async () => {
          if (!confirm("Delete this vault entry?")) return;
          showLoader(true);
          try { await vaultDelete(x.run_id); toast("Deleted.", true); await vaultRefreshUI(); }
          catch (e) { setLastError(e); toast("Delete failed.", false); }
          finally { showLoader(false); }
        };

        actions.appendChild(openBtn);
        actions.appendChild(pdfBtn);
        actions.appendChild(delBtn);
        row.appendChild(meta);
        row.appendChild(actions);
        list.appendChild(row);
      });
    } catch (e) {
      vaultUIStatus("Cloud: ERROR", false);
      setLastError(e);
      list.innerHTML = "<div class='muted'>Vault error. See Diagnostics.</div>";
    }
  }

  async function putBlobFromDataUrl(dataUrl, filename, meta = {}) {
    const r = await fetch(VAULT.blobPut, {
      method: "POST",
      headers: { "content-type": "application/json", "x-kaixu-app": APP_ID, "x-kaixu-build": BUILD_ID },
      body: JSON.stringify({ dataUrl, filename, meta })
    });
    const t = await r.text();
    const js = safeJSONParse(t);
    if (!r.ok) throw (js || { status: r.status, body: t });
    return js;
  }

  async function saveRunToVault(withPdf = false) {
    const ok = await vaultPing();
    if (!ok) { toast("Vault is offline (set DATABASE_URL).", false); return; }
    if (!state.lastResult) { toast("Run kAIxU first.", false); return; }

    showLoader(true);
    try {
      const tool = toolById(state.toolId);
      const inputs = state.lastInputs[state.toolId] || gatherFormValues();
      const title = (state.lastResult?.summary?.title) || (tool?.name ? `${tool.number} — ${tool.name}` : "kAIxU Run");

      let pdf_blob_key = null;
      if (withPdf) {
        // reuse existing exportPDF() then pull doc output from jsPDF via a slim re-export
        const { jsPDF } = window.jspdf || {};
        if (!jsPDF) throw { message: "PDF library missing" };
        // call existing exportPDF() for download and also create dataUri
        const dataUrl = await (async () => {
          const doc = await buildPdfDocFromLastResult(); // injected below
          return doc.output("datauristring");
        })();
        const up = await putBlobFromDataUrl(dataUrl, `${state.toolId}-${(state.lastResult.meta?.certificate_id || uid("KX"))}.pdf`, {
          tool_id: state.toolId,
          certificate_id: state.lastResult.meta?.certificate_id || "",
          provider: PROVIDER
        });
        pdf_blob_key = up.key;
      }

      const payload = {
        workspace_id: currentWorkspaceId(),
        tool_id: state.toolId,
        tool_name: tool?.name || state.toolId,
        title,
        inputs,
        result: state.lastResult,
        attachments: state.attachments || [],
        pdf_blob_key
      };

      const r = await fetch(VAULT.save, {
        method: "POST",
        headers: { "content-type": "application/json", "x-kaixu-app": APP_ID, "x-kaixu-build": BUILD_ID },
        body: JSON.stringify(payload)
      });
      const t = await r.text();
      const js = safeJSONParse(t);
      if (!r.ok) throw (js || { status: r.status, body: t });

      toast(withPdf ? "Saved run + PDF to Vault." : "Saved run to Vault.", true);
      await vaultRefreshUI();
    } catch (e) {
      setLastError(e);
      toast("Vault save failed.", false);
    } finally {
      showLoader(false);
    }
  }

  async function uploadAttachment(file) {
    const form = new FormData();
    form.append("file", file);
    form.append("workspace_id", currentWorkspaceId());
    form.append("tool_id", state.toolId);

    const r = await fetch(VAULT.upload, {
      method: "POST",
      headers: { "x-kaixu-app": APP_ID, "x-kaixu-build": BUILD_ID },
      body: form
    });
    const t = await r.text();
    const js = safeJSONParse(t);
    if (!r.ok) throw (js || { status: r.status, body: t });
    return js;
  }

  function renderAttachments() {
    const host = $("attachList");
    if (!host) return;
    host.innerHTML = "";
    const list = state.attachments || [];
    if (list.length === 0) { host.innerHTML = "<div class='muted'>No uploads yet.</div>"; return; }

    list.slice().reverse().forEach(item => {
      const row = document.createElement("div");
      row.className = "attach-item";
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML = `<div class="name">${escapeHtml(item.name||"Attachment")}</div><div class="key">${escapeHtml(item.key||"")}</div>`;
      const actions = document.createElement("div");
      actions.className = "actions";
      const open = document.createElement("button");
      open.className = "btn neon small";
      open.textContent = "Open";
      open.onclick = () => window.open(`${VAULT.blobGet}?key=${encodeURIComponent(item.key)}`, "_blank");
      const remove = document.createElement("button");
      remove.className = "btn ghost small";
      remove.textContent = "Remove";
      remove.onclick = () => { state.attachments = (state.attachments||[]).filter(x => x.key !== item.key); saveState(); renderAttachments(); };
      actions.appendChild(open);
      actions.appendChild(remove);
      row.appendChild(meta);
      row.appendChild(actions);
      host.appendChild(row);
    });
  }

  function attachEvents() {
    const search = $("toolSearch");
    if (search) search.addEventListener("input", () => { renderNav(search.value); vaultRefreshUI().catch(()=>{}); });

    const keyInput = $("kaixuKey");
    const keySave = $("saveKaixuKey");
    if (keyInput) keyInput.value = (localStorage.getItem("KAIXU_VIRTUAL_KEY") || "");
    if (keySave) keySave.addEventListener("click", () => {
      const v = keyInput ? keyInput.value : "";
      if (!v) {
        localStorage.removeItem("KAIXU_VIRTUAL_KEY");
        toast("Kaixu Key cleared.", true);
      } else {
        localStorage.setItem("KAIXU_VIRTUAL_KEY", String(v).trim());
        toast("Kaixu Key saved.", true);
      }
    });

    const vq = $("vaultQuery");
    if (vq) vq.addEventListener("input", () => vaultRefreshUI().catch(()=>{}));


    const run = $("runBtn");
    if (run) run.addEventListener("click", runTool);

    const pdf = $("pdfBtn");
    if (pdf) pdf.addEventListener("click", () => exportPDF(null));

    const diagBtn = $("openDiagnostics");
    if (diagBtn) diagBtn.addEventListener("click", () => setHashTool("diagnostics"));

    const wsSelect = $("wsSelect");
    if (wsSelect) wsSelect.addEventListener("change", () => {
      state.workspaces.currentId = wsSelect.value;
      saveState();
      renderWorkspaceUI();
      renderForm();
      renderHistory();
    });

    const wsNew = $("wsNew");
    if (wsNew) wsNew.addEventListener("click", () => {
      const id = uid("WS");
      state.workspaces.list.push({ id, name: `Workspace ${state.workspaces.list.length+1}`, drafts: {}, history: [] });
      state.workspaces.currentId = id;
      saveState();
      renderWorkspaceUI();
      renderForm();
      renderHistory();
    });

    const wsSave = $("wsSave");
    if (wsSave) wsSave.addEventListener("click", () => {
      const nm = $("wsName");
      const ws = getCurrentWorkspace();
      if (ws && nm) {
        ws.name = String(nm.value || "Workspace").slice(0, 60);
        saveState();
        renderWorkspaceUI();
      }
    });

    const saveDraft = $("saveDraft");
    if (saveDraft) saveDraft.addEventListener("click", () => {
      if (state.toolId === "diagnostics") return;
      const ws = getCurrentWorkspace();
      ws.drafts = ws.drafts || {};
      ws.drafts[state.toolId] = gatherFormValues();
      saveState();
      setStatus("Draft saved.", true);
    });

    const loadDraft = $("loadDraft");
    if (loadDraft) loadDraft.addEventListener("click", () => {
      if (state.toolId === "diagnostics") return;
      renderForm();
      setStatus("Draft loaded.", true);
    });

    const clearDraft = $("clearDraft");
    if (clearDraft) clearDraft.addEventListener("click", () => {
      if (state.toolId === "diagnostics") return;
      const ws = getCurrentWorkspace();
      if (ws.drafts) delete ws.drafts[state.toolId];
      state.lastInputs[state.toolId] = {};
      saveState();
      renderForm();
      setStatus("Cleared.", true);
    });

    const pingFn = $("pingFn");
    if (pingFn) pingFn.addEventListener("click", async () => {
      const out = $("pingOut");
      if (out) out.textContent = "Pinging…";
      try {
        const r = await fetch("/api/health", {
          headers: { "x-kaixu-app": APP_ID, "x-kaixu-build": BUILD_ID }
        });
        const t = await r.text();
        if (out) out.textContent = `${r.status}: ${t}`;
      } catch (e) {
        if (out) out.textContent = "Ping failed.";
        setLastError({ message: "Ping failed", detail: String(e) });
      }
    });

    const clearErr = $("clearErr");
    if (clearErr) clearErr.addEventListener("click", () => setLastError(null));


    const vr = $("vaultRefresh");
    if (vr) vr.addEventListener("click", () => vaultRefreshUI().catch(()=>{}));
    const vs = $("vaultSave");
    if (vs) vs.addEventListener("click", () => saveRunToVault(false));
    const vsp = $("vaultSavePdf");
    if (vsp) vsp.addEventListener("click", () => saveRunToVault(true));

    const au = $("attachUpload");
    if (au) au.addEventListener("click", async () => {
      const input = $("attachFile");
      if (!input || !input.files || !input.files[0]) { toast("Choose a file first.", false); return; }
      showLoader(true);
      try {
        const res = await uploadAttachment(input.files[0]);
        state.attachments = state.attachments || [];
        state.attachments.push({ key: res.key, name: res.name, type: res.type || "", size: res.size || 0 });
        saveState();
        renderAttachments();
        toast("Uploaded to Blobs.", true);
      } catch (e) {
        setLastError(e);
        toast("Upload failed.", false);
      } finally {
        showLoader(false);
        input.value = "";
      }
    });

    const sf = document.getElementById("supportForm");
    if (sf) sf.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const status = document.getElementById("supportStatus");
      if (status) status.textContent = "Sending…";
      try {
        const fd = new FormData(sf);
        const r = await fetch("/", { method: "POST", body: new URLSearchParams(fd) });
        if (r.ok) {
          if (status) status.textContent = "Sent. Skyes Over London has it.";
          toast("Support request sent.", true);
          sf.reset();
        } else {
          if (status) status.textContent = "Send failed. Try again.";
          toast("Support send failed.", false);
        }
      } catch {
        if (status) status.textContent = "Send failed. Try again.";
        toast("Support send failed.", false);
      }
    });

    renderAttachments();
    vaultRefreshUI().catch(()=>{});

    window.addEventListener("hashchange", () => {
      const newTool = parseToolFromHash();
      if (newTool && newTool !== state.toolId) {
        state.toolId = newTool;
        saveState();
        render();
      }
    });
  }

  function render() {
    renderNav($("toolSearch") ? $("toolSearch").value : "");
    renderWorkspaceUI();
    renderHeader();
    renderForm();
    renderResults();
    renderHistory();
    renderDiagnostics();
    vaultRefreshUI().catch(()=>{});
    renderAttachments();
  }

  loadState();
  ensureDefaultWorkspace();
  state.toolId = parseToolFromHash();
  saveState();

  attachEvents();
  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  }
})();

  async function buildPdfDocFromLastResult(){
    const result = state.lastResult;
    const { jsPDF } = window.jspdf || {};
    if (!result || !jsPDF) throw new Error('PDF not ready');
    // lightweight PDF doc: reuse existing exportPDF() by calling it first for formatting? We'll rebuild a minimal doc.
    const meta = result.meta || {};
    const summary = result.summary || {};
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 46;
    doc.setFont('helvetica','bold');
    doc.setFontSize(18);
    doc.text(summary.title || 'Skyes Over London — Document', margin, 90);
    doc.setFont('helvetica','normal');
    doc.setFontSize(11);
    doc.text(`Provider: ${PROVIDER} • Intelligence: ${INTELLIGENCE}`, margin, 112);
    doc.text(`Certificate: ${meta.certificate_id || uid('KX')}`, margin, 130);
    return doc;
  }
