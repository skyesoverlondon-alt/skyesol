/* /assets/app.js — Business Launch Kit (AZ) Pack */
/* global KAIXU_ZIP, JSZip */
(function() {
  "use strict";

  const APP = {
    name: "Business Launch Kit (AZ) Pack",
    buildId: "BLK-AZ-P13.1",
    version: "1.1.0",
    errorEndpoint: "/.netlify/functions/client-error-report",
    neonUpsertEndpoint: "/.netlify/functions/neon-lead-upsert",
    neonHealthEndpoint: "/.netlify/functions/neon-health",
    blobStoreEndpoint: "/.netlify/functions/blob-store-pack",
    errorHeaders: {
      "x-kaixu-app": "BusinessLaunchKitAZ",
      "x-kaixu-build": "BLK-AZ-P13"
    },
    storageKeys: {
      inputs: "blkaz_inputs_v1",
      checklist: "blkaz_checklist_v1",
      errors: "blkaz_errors_v1",
      errorQueue: "blkaz_error_queue_v1",
      neonCfg: "blkaz_neon_cfg_v1"
    }
  };

  const CHECKLIST_ITEMS = [
    { id:"entity_type", title:"Choose entity type", badge:"Core", desc:"LLC / Corporation / Partnership — document the choice and why." },
    { id:"name_search", title:"Confirm business name", badge:"Core", desc:"Search availability; consider trademark search for brand." },
    { id:"registered_agent", title:"Registered agent plan", badge:"Core", desc:"Pick a registered agent if required for your entity." },
    { id:"file_azcc", title:"File formation (AZCC)", badge:"Core", desc:"Form the entity with AZ Corporation Commission (as applicable)." },
    { id:"get_ein", title:"Obtain EIN", badge:"Core", desc:"Get your federal EIN to bank and pay taxes." },
    { id:"banking", title:"Open business bank account", badge:"Core", desc:"Separate finances. Set signers and online access." },
    { id:"bookkeeping", title:"Set up bookkeeping categories", badge:"Core", desc:"Chart of accounts, receipt capture, monthly reconciliation routine." },
    { id:"tpt_review", title:"Review TPT licensing need", badge:"AZ", desc:"Determine if you need Transaction Privilege Tax registration." },
    { id:"city_licenses", title:"Check city licensing requirements", badge:"AZ", desc:"Home occupation, signage, local permits for your city." },
    { id:"insurance", title:"Insurance baseline", badge:"Ops", desc:"General liability, professional liability, auto, workers comp (if hiring)." },
    { id:"pricing", title:"Define offers + pricing", badge:"Ops", desc:"Clear packages, scope boundaries, deposit terms." },
    { id:"intake", title:"Client intake + scope template", badge:"Ops", desc:"Standardize discovery, documentation, and approvals." },
    { id:"invoice_flow", title:"Invoice + payment flow", badge:"Ops", desc:"Invoice template, payment processor, and late fee policy." },
    { id:"policies", title:"Privacy/terms starter drafted", badge:"Legal", desc:"Draft starter bullets and have counsel review." },
    { id:"domain_email", title:"Domain + business email", badge:"Web", desc:"Domain, email, and primary contact routes." },
    { id:"website_core", title:"Website with CTA + contact", badge:"Web", desc:"Offer clarity, contact form, mobile responsive." },
    { id:"gbp", title:"Google Business Profile", badge:"Local", desc:"Set up GBP, consistent NAP, photos, services." },
    { id:"analytics", title:"Analytics installed", badge:"Web", desc:"Basic analytics for conversion visibility." },
    { id:"launch", title:"Launch announcement + outreach", badge:"Go", desc:"Announce, email, socials, and outreach routine." }
  ];

  const el = (id) => document.getElementById(id);

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  
  function getNeonCfg() {
    return readJSON(APP.storageKeys.neonCfg, { dataApiUrl: "", jwt: "" });
  }

  function setNeonCfg(cfg) {
    writeJSON(APP.storageKeys.neonCfg, cfg);
  }

  async function neonHealthPing() {
    // Try server function first
    try {
      const res = await fetch(APP.neonHealthEndpoint, { method: "GET" });
      const js = await res.json().catch(() => ({}));
      return { mode: "function", ok: res.ok && !!js, detail: js };
    } catch (e) {
      // ignore, fall through
    }

    // Fallback: direct Data API from client config
    const cfg = getNeonCfg();
    if (!cfg.dataApiUrl || !cfg.jwt) return { mode: "client", ok: false, detail: { error: "Missing local Neon Data API config" } };

    const url = cfg.dataApiUrl.replace(/\/$/, "") + "/rest/v1/blkaz_leads?select=id&limit=1";
    try {
      const res = await fetch(url, { method: "GET", headers: { "Authorization": "Bearer " + cfg.jwt, "Content-Type": "application/json" } });
      const text = await res.text();
      let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
      return { mode: "client", ok: res.ok, status: res.status, detail: parsed };
    } catch (e) {
      return { mode: "client", ok: false, detail: { error: String(e && e.message ? e.message : e) } };
    }
  }


  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getInputs() {
    const inputs = {
      businessName: el("businessName").value.trim(),
      city: el("city").value.trim(),
      industry: el("industry").value.trim(),
      ownersCount: Number(el("ownersCount").value || 1),
      hireEmployees: !!el("hireEmployees").checked
    };
    return inputs;
  }

  function setInputs(inputs) {
    el("businessName").value = inputs.businessName || "";
    el("city").value = inputs.city || "";
    el("industry").value = inputs.industry || "";
    el("ownersCount").value = Number(inputs.ownersCount || 1);
    el("hireEmployees").checked = !!inputs.hireEmployees;
  }

  function checklistState() {
    return readJSON(APP.storageKeys.checklist, {});
  }

  function saveChecklistState(state) {
    writeJSON(APP.storageKeys.checklist, state);
  }

  function computeProgress(state) {
    const total = CHECKLIST_ITEMS.length;
    const done = CHECKLIST_ITEMS.filter(it => !!state[it.id]).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, pct };
  }

  function renderChecklist() {
    const container = el("checklist");
    container.innerHTML = "";
    const state = checklistState();

    for (const item of CHECKLIST_ITEMS) {
      const row = document.createElement("div");
      row.className = "item";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!state[item.id];
      cb.addEventListener("change", () => {
        const next = checklistState();
        next[item.id] = cb.checked;
        saveChecklistState(next);
        refreshSummary();
      });

      const meta = document.createElement("div");
      meta.className = "meta";
      const title = document.createElement("div");
      title.className = "title";
      title.textContent = item.title;

      const desc = document.createElement("div");
      desc.className = "desc";
      desc.textContent = item.desc;

      meta.appendChild(title);
      meta.appendChild(desc);

      const badge = document.createElement("div");
      badge.className = "badge";
      badge.textContent = item.badge;

      row.appendChild(cb);
      row.appendChild(meta);
      row.appendChild(badge);

      container.appendChild(row);
    }
  }

  function fmtBool(v) {
    return v ? "Yes" : "No";
  }

  function refreshSummary() {
    const inputs = readJSON(APP.storageKeys.inputs, getInputs());
    const state = checklistState();
    const prog = computeProgress(state);

    const lines = [];
    lines.push(`Business: ${inputs.businessName || "—"}`);
    lines.push(`City: ${inputs.city || "—"}, AZ`);
    lines.push(`Industry: ${inputs.industry || "—"}`);
    lines.push(`Owners: ${Number(inputs.ownersCount || 1)}`);
    lines.push(`Hire employees: ${fmtBool(!!inputs.hireEmployees)}`);
    lines.push("");
    lines.push(`Checklist: ${prog.done} / ${prog.total} (${prog.pct}%)`);
    lines.push(`Build: ${APP.buildId} • v${APP.version}`);
    lines.push(`Time: ${new Date().toLocaleString()}`);

    el("reportSummary").textContent = lines.join("\n");
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function generateZipPack() {
    const inputs = readJSON(APP.storageKeys.inputs, getInputs());
    const result = await KAIXU_ZIP.buildZipPack(inputs);
    const safeName = (result.ctx.businessName || "Business").replace(/[^a-z0-9]+/ig, "-").replace(/^-+|-+$/g, "");
    const filename = `AZ-Launch-Pack-${safeName}.zip`;
    downloadBlob(result.blob, filename);

    // also log event locally
    pushLocalEvent({
      type: "zip_generated",
      at: new Date().toISOString(),
      file: filename,
      files: result.filenames,
      ctx: result.ctx
    });
  }

  function pushLocalError(rec) {
    const errors = readJSON(APP.storageKeys.errors, []);
    errors.unshift(rec);
    errors.splice(30);
    writeJSON(APP.storageKeys.errors, errors);
  }

  function pushErrorQueue(rec) {
    const q = readJSON(APP.storageKeys.errorQueue, []);
    q.push(rec);
    writeJSON(APP.storageKeys.errorQueue, q);
  }

  function pushLocalEvent(rec) {
    // store in same errors list but marked as event (for diagnostics)
    const errors = readJSON(APP.storageKeys.errors, []);
    errors.unshift(rec);
    errors.splice(30);
    writeJSON(APP.storageKeys.errors, errors);
  }

  async function postError(rec) {
    const payload = JSON.stringify(rec);
    const headers = Object.assign({
      "content-type": "application/json"
    }, APP.errorHeaders);

    const res = await fetch(APP.errorEndpoint, {
      method: "POST",
      headers,
      body: payload
    });
    if (!res.ok) throw new Error("Error report failed: HTTP " + res.status);
    return res.json().catch(() => ({ ok:true }));
  }

  async function reportClientError(kind, err, extra) {
    try {
      const rec = {
        kind,
        message: (err && err.message) ? String(err.message) : String(err || "Unknown error"),
        stack: (err && err.stack) ? String(err.stack) : null,
        href: location.href,
        ua: navigator.userAgent,
        at: new Date().toISOString(),
        buildId: APP.buildId,
        version: APP.version,
        extra: extra || null
      };
      pushLocalError(rec);

      if (navigator.onLine) {
        try {
          await postError(rec);
        } catch (e) {
          pushErrorQueue(rec);
        }
      } else {
        pushErrorQueue(rec);
      }

      updateDiagnostics();
    } catch {
      // swallow, never crash user flow
    }
  }

  async function flushErrorQueue() {
    const q = readJSON(APP.storageKeys.errorQueue, []);
    if (!q.length) return { sent:0 };
    const remaining = [];
    let sent = 0;

    for (const rec of q) {
      try {
        await postError(rec);
        sent += 1;
      } catch (e) {
        remaining.push(rec);
      }
    }
    writeJSON(APP.storageKeys.errorQueue, remaining);
    updateDiagnostics();
    return { sent, remaining: remaining.length };
  }

  function exportProgressJson() {
    const payload = {
      app: APP,
      inputs: readJSON(APP.storageKeys.inputs, getInputs()),
      checklist: checklistState(),
      progress: computeProgress(checklistState()),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    downloadBlob(blob, `BLK-AZ-Progress-${APP.buildId}.json`);
  }

  function markCoreDone() {
    const state = checklistState();
    for (const it of CHECKLIST_ITEMS) {
      if (it.badge === "Core") state[it.id] = true;
    }
    saveChecklistState(state);
    renderChecklist();
    refreshSummary();
  }

  function resetLocalData() {
    localStorage.removeItem(APP.storageKeys.inputs);
    localStorage.removeItem(APP.storageKeys.checklist);
    localStorage.removeItem(APP.storageKeys.errors);
    localStorage.removeItem(APP.storageKeys.errorQueue);
    location.reload();
  }

  // PDF export (jsPDF)
  async function loadImageDataURL(path) {
    const res = await fetch(path);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
  }

  function chunkText(doc, text, x, y, maxWidth, lineHeight) {
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return y + lines.length * lineHeight;
  }

  async function exportPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error("jsPDF is not loaded.");
    const { jsPDF } = window.jspdf;

    const inputs = readJSON(APP.storageKeys.inputs, getInputs());
    const state = checklistState();
    const prog = computeProgress(state);

    const doc = new jsPDF({ unit:"pt", format:"letter" });
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();

    // Background wash
    doc.setFillColor(10, 4, 16);
    doc.rect(0, 0, w, h, "F");

    // Watermark (logo, large, low opacity)
    try {
      const logoData = await loadImageDataURL("/assets/logo.png");
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.10 }));
      const wmW = Math.min(520, w * 0.78);
      const wmH = wmW * 0.62;
      doc.addImage(logoData, "PNG", (w - wmW) / 2, (h - wmH) / 2, wmW, wmH);
      doc.restoreGraphicsState();

      // Header logo
      const headerW = 86;
      const headerH = headerW * 0.62;
      doc.addImage(logoData, "PNG", 40, 36, headerW, headerH);
    } catch (e) {
      // fallback watermark text
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.10 }));
      doc.setTextColor(245, 200, 75);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(64);
      doc.text("SKYES OVER LONDON", w/2, h/2, { align:"center" });
      doc.restoreGraphicsState();
    }

    // Header
    doc.setTextColor(245, 200, 75);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Business Launch Kit (AZ) Pack — Summary", 140, 56);

    doc.setTextColor(244, 238, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Build: ${APP.buildId} • v${APP.version} • ${new Date().toLocaleString()}`, 140, 74);

    // Divider
    doc.setDrawColor(196, 162, 255);
    doc.setLineWidth(1);
    doc.line(40, 96, w - 40, 96);

    let y = 122;

    // Inputs box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(245, 200, 75);
    doc.text("Business Inputs", 40, y);
    y += 14;

    doc.setTextColor(244, 238, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    const inputLines = [
      `Business name: ${inputs.businessName || "—"}`,
      `City: ${inputs.city || "—"}, AZ`,
      `Industry: ${inputs.industry || "—"}`,
      `Owners count: ${Number(inputs.ownersCount || 1)}`,
      `Hire employees: ${inputs.hireEmployees ? "Yes" : "No"}`,
      `Checklist progress: ${prog.done} / ${prog.total} (${prog.pct}%)`
    ];
    for (const line of inputLines) {
      doc.text(line, 40, y);
      y += 14;
    }
    y += 6;

    // Checklist list
    doc.setTextColor(245, 200, 75);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Checklist Snapshot", 40, y);
    y += 14;

    doc.setTextColor(244, 238, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    for (const it of CHECKLIST_ITEMS) {
      const checked = !!state[it.id];
      const mark = checked ? "☑" : "☐";
      const line = `${mark} [${it.badge}] ${it.title}`;
      const nextY = y + 12;
      if (nextY > h - 70) {
        doc.addPage();
        doc.setFillColor(10, 4, 16);
        doc.rect(0, 0, w, h, "F");
        y = 60;
      }
      doc.text(line, 44, y);
      y += 12;
    }

    // Footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(244, 238, 255);
    doc.text("Operational guidance & templates — not legal/tax advice. Review with a licensed professional.", 40, h - 36);

    const safeName = (inputs.businessName || "Business").replace(/[^a-z0-9]+/ig, "-").replace(/^-+|-+$/g, "");
    doc.save(`BLK-AZ-Summary-${safeName}.pdf`);
  }

  // Diagnostics UI
  function updateDiagnostics() {
    const status = {
      app: APP,
      online: navigator.onLine,
      time: new Date().toISOString(),
      jszipLoaded: typeof JSZip !== "undefined",
      jspdfLoaded: !!(window.jspdf && window.jspdf.jsPDF),
      localStorage: (() => {
        try {
          const k = "__t";
          localStorage.setItem(k, "1");
          localStorage.removeItem(k);
          return true;
        } catch {
          return false;
        }
      })(),
      serviceWorker: (() => {
        return {
          supported: "serviceWorker" in navigator,
          controller: !!navigator.serviceWorker?.controller
        };
      })(),
      progress: computeProgress(checklistState()),
      errorQueueSize: readJSON(APP.storageKeys.errorQueue, []).length,
      neonCfg: getNeonCfg()
    };

    const errors = readJSON(APP.storageKeys.errors, []);

    el("diagStatus").textContent = JSON.stringify(status, null, 2);
    el("diagErrors").textContent = JSON.stringify(errors, null, 2);
  }

  async function selfTest() {
    const results = [];
    const push = (ok, msg, extra) => results.push({ ok, msg, extra: extra || null });

    try {
      push(true, "JS runtime OK");
      push(typeof JSZip !== "undefined", "JSZip loaded");
      push(!!(window.jspdf && window.jspdf.jsPDF), "jsPDF loaded");
      push(typeof KAIXU_ZIP !== "undefined", "zip helper present");

      // LocalStorage write/read
      try {
        const k = "__selftest";
        localStorage.setItem(k, JSON.stringify({ t: Date.now() }));
        const v = localStorage.getItem(k);
        localStorage.removeItem(k);
        push(!!v, "localStorage read/write");
      } catch (e) {
        push(false, "localStorage read/write", String(e));
      }

      // Build a small zip
      try {
        const r = await KAIXU_ZIP.buildZipPack({ businessName:"SelfTest", city:"Phoenix", industry:"Test", ownersCount:1, hireEmployees:false });
        push(!!r.blob, "ZIP generation");
      } catch (e) {
        push(false, "ZIP generation", String(e));
      }

      // Error endpoint reachability (non-failing)
      try {
        const ping = {
          kind: "selftest_ping",
          message: "Self-test ping",
          at: new Date().toISOString(),
          href: location.href,
          ua: navigator.userAgent,
          buildId: APP.buildId,
          version: APP.version
        };
        if (navigator.onLine) {
          await postError(ping);
          push(true, "Error endpoint reachable (POST)");
        } else {
          push(true, "Offline: skipped endpoint test");
        }
      } catch (e) {
        push(false, "Error endpoint reachable (POST)", String(e));
      }

      push(true, "Self-test completed");
    } catch (e) {
      push(false, "Self-test exception", String(e));
    }

    return results;
  }

  // PWA install
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = el("btnInstall");
    btn.disabled = false;
  });

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch {}
    deferredPrompt = null;
    el("btnInstall").disabled = true;
  }

  // Starfield (SVS vibe)
  function startStarfield() {
    const canvas = el("starfield");
    const ctx = canvas.getContext("2d", { alpha:true });
    let w = 0, h = 0, dpr = 1;
    const stars = [];

    function resize() {
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      w = Math.floor(window.innerWidth);
      h = Math.floor(window.innerHeight);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr,0,0,dpr,0,0);

      stars.length = 0;
      const count = Math.floor((w*h) / 9000);
      for (let i=0;i<count;i++) {
        stars.push({
          x: Math.random()*w,
          y: Math.random()*h,
          r: Math.random()*1.6 + 0.2,
          v: Math.random()*0.18 + 0.04,
          a: Math.random()*0.6 + 0.15,
          hue: Math.random()<0.18 ? "gold" : "violet"
        });
      }
    }

    function tick() {
      ctx.clearRect(0,0,w,h);

      // soft nebula glows
      const g1 = ctx.createRadialGradient(w*0.2, h*0.15, 0, w*0.2, h*0.15, Math.max(w,h)*0.65);
      g1.addColorStop(0, "rgba(124,44,255,0.18)");
      g1.addColorStop(1, "rgba(124,44,255,0)");
      ctx.fillStyle = g1;
      ctx.fillRect(0,0,w,h);

      const g2 = ctx.createRadialGradient(w*0.85, h*0.18, 0, w*0.85, h*0.18, Math.max(w,h)*0.55);
      g2.addColorStop(0, "rgba(245,200,75,0.12)");
      g2.addColorStop(1, "rgba(245,200,75,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0,0,w,h);

      for (const s of stars) {
        s.y += s.v;
        if (s.y > h + 10) {
          s.y = -10;
          s.x = Math.random()*w;
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        if (s.hue === "gold") ctx.fillStyle = `rgba(245,200,75,${s.a})`;
        else ctx.fillStyle = `rgba(183,132,255,${s.a})`;
        ctx.fill();
      }

      requestAnimationFrame(tick);
    }

    window.addEventListener("resize", resize, { passive:true });
    resize();
    tick();
  }

  
  function encodeForm(data) {
    return Object.keys(data)
      .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(data[k] ?? ""))
      .join("&");
  }

  async function upsertLead(payload) {
    // Try server function first
    try {
      const res = await fetch(APP.neonUpsertEndpoint, {
        method: "POST",
        headers: Object.assign({ "content-type": "application/json" }, APP.errorHeaders),
        body: JSON.stringify(payload)
      });
      const js = await res.json().catch(() => ({}));
      if (res.ok && js && js.ok) return { mode: "function", ok: true, detail: js };
      return { mode: "function", ok: false, detail: js };
    } catch (e) {
      // fall through
    }

    // Fallback: direct Data API from client config
    const cfg = getNeonCfg();
    if (!cfg.dataApiUrl || !cfg.jwt) return { mode: "client", ok: false, detail: { error: "Missing local Neon Data API config" } };

    const url = cfg.dataApiUrl.replace(/\/$/, "") + "/rest/v1/blkaz_leads";
    const row = {
      lead_name: payload.lead?.name || null,
      lead_email: payload.lead?.email || null,
      lead_phone: payload.lead?.phone || null,
      lead_company: payload.lead?.company || null,
      lead_message: payload.lead?.message || null,

      business_name: payload.inputs?.businessName || "Unnamed Business",
      city: payload.inputs?.city || "Phoenix",
      industry: payload.inputs?.industry || "General",
      owners_count: Number(payload.inputs?.ownersCount || 1),
      hire_employees: !!payload.inputs?.hireEmployees,

      report_summary: payload.report_summary || null,
      checklist: payload.checklist || {},

      app_build_id: payload.app?.buildId || null,
      app_version: payload.app?.version || null,
      user_agent: payload.app?.ua || null,
      page_href: payload.app?.href || null
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Authorization": "Bearer " + cfg.jwt, "Content-Type": "application/json", "Prefer": "return=representation" },
        body: JSON.stringify(row)
      });
      const text = await res.text();
      let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
      return { mode: "client", ok: res.ok, status: res.status, detail: parsed };
    } catch (e) {
      return { mode: "client", ok: false, detail: { error: String(e && e.message ? e.message : e) } };
    }
  }

  async function handleLeadSubmit() {
    const inputs = readJSON(APP.storageKeys.inputs, getInputs());
    const state = checklistState();

    const lead = {
      name: el("leadName").value.trim(),
      email: el("leadEmail").value.trim(),
      phone: el("leadPhone").value.trim(),
      company: el("leadCompany").value.trim(),
      message: el("leadMessage").value.trim()
    };

    const payload = {
      lead,
      inputs,
      report_summary: el("reportSummary").textContent || "",
      checklist: state,
      app: { buildId: APP.buildId, version: APP.version, ua: navigator.userAgent, href: location.href }
    };

    const result = await upsertLead(payload);
    pushLocalEvent({ type: "lead_upsert", at: new Date().toISOString(), result });

    // Always submit Netlify form via AJAX (works in Drop mode)
    const formData = { "form-name": "lead", name: lead.name, email: lead.email, phone: lead.phone, company: lead.company, message: lead.message };
    await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: encodeForm(formData) });

    pushLocalEvent({ type: "lead_form_submitted", at: new Date().toISOString() });
    updateDiagnostics();
    return result;
  }

  // Wire up UI

  async function init() {
    el("buildId").textContent = APP.buildId;

    // Load saved inputs
    const saved = readJSON(APP.storageKeys.inputs, null);
    if (saved) setInputs(saved);

    renderChecklist();
    refreshSummary();

    el("btnSave").addEventListener("click", () => {
      const inputs = getInputs();
      writeJSON(APP.storageKeys.inputs, inputs);
      refreshSummary();
      pushLocalEvent({ type:"inputs_saved", at:new Date().toISOString(), inputs });
      updateDiagnostics();
    });

    el("btnGenerateZip").addEventListener("click", async () => {
      try {
        await generateZipPack();
      } catch (e) {
        await reportClientError("zip_generation", e);
        alert("ZIP generation failed. Open Diagnostics for details.");
      }
    });

    el("btnExportPdf").addEventListener("click", async () => {
      try {
        await exportPdf();
        pushLocalEvent({ type:"pdf_exported", at:new Date().toISOString() });
        updateDiagnostics();
      } catch (e) {
        await reportClientError("pdf_export", e);
        alert("PDF export failed. Open Diagnostics for details.");
      }
    });

    el("btnExportJson").addEventListener("click", exportProgressJson);
    el("btnMarkCore").addEventListener("click", markCoreDone);
    el("btnReset").addEventListener("click", resetLocalData);

    // Diagnostics modal
    const modal = el("diagModal");
    el("btnDiagnostics").addEventListener("click", () => {
      updateDiagnostics();
      modal.showModal();
    });
    el("btnCloseDiag").addEventListener("click", () => modal.close());

    el("btnSelfTest").addEventListener("click", async () => {
      const results = await selfTest();
      pushLocalEvent({ type:"self_test", at:new Date().toISOString(), results });
      updateDiagnostics();
      alert("Self-test completed. Results stored in Recent Client Errors (local).");
    });

    el("btnSendTestError").addEventListener("click", async () => {
      await reportClientError("test_error", new Error("Test error from diagnostics button"), { note:"Intentional test" });
      alert("Test error queued/sent. See Recent Client Errors (local).");
    });

    el("btnFlushQueue").addEventListener("click", async () => {
      const r = await flushErrorQueue();
      alert(`Queue flush: sent ${r.sent}. Remaining ${r.remaining || 0}.`);
    });

    el("btnClearErrors").addEventListener("click", () => {
      localStorage.removeItem(APP.storageKeys.errors);
      localStorage.removeItem(APP.storageKeys.errorQueue);
      updateDiagnostics();
    });

    // Install
    el("btnInstall").addEventListener("click", handleInstall);

    // Lead form mirror business name
    el("businessName").addEventListener("input", () => {
      el("leadCompany").value = el("businessName").value;
    });

    // Lead form submit: Netlify Forms + Neon upsert
    const leadForm = el("leadForm");
    leadForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      try {
        const r = await handleLeadSubmit();
        alert(`Lead captured. DB: ${r.ok ? "OK" : "FAILED"} (${r.mode})`);
        leadForm.reset();
      } catch (e) {
        await reportClientError("lead_submit", e);
        alert("Lead submit failed. Open Diagnostics for details.");
      }
    });

    // Neon config + ping (client fallback)
    const cfg = getNeonCfg();
    const urlEl = document.getElementById("neonDataApiUrl");
    const jwtEl = document.getElementById("neonJwt");
    if (urlEl) urlEl.value = cfg.dataApiUrl || "";
    if (jwtEl) jwtEl.value = cfg.jwt || "";

    const saveBtn = document.getElementById("btnSaveNeonCfg");
    if (saveBtn) saveBtn.addEventListener("click", () => {
      const next = { dataApiUrl: (urlEl?.value || "").trim(), jwt: (jwtEl?.value || "").trim() };
      setNeonCfg(next);
      pushLocalEvent({ type:"neon_cfg_saved", at:new Date().toISOString(), hasUrl: !!next.dataApiUrl, hasJwt: !!next.jwt });
      updateDiagnostics();
      alert("Saved Neon config locally.");
    });

    const pingBtn = document.getElementById("btnNeonPing");
    if (pingBtn) pingBtn.addEventListener("click", async () => {
      const r = await neonHealthPing();
      pushLocalEvent({ type:"neon_ping", at:new Date().toISOString(), result:r });
      updateDiagnostics();
      alert(`Neon ping (${r.mode}): ${r.ok ? "OK" : "FAILED"}`);
    });

    // Register SW
    if ("serviceWorker" in navigator) {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch (e) {
        reportClientError("service_worker_register", e);
      }
    }

    // Event listeners for client errors
    window.addEventListener("error", (event) => {
      reportClientError("window_error", event.error || new Error(event.message || "Unknown window error"), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason || "Unhandled rejection"));
      reportClientError("unhandled_rejection", reason);
    });

    window.addEventListener("online", () => {
      flushErrorQueue().catch(() => {});
      updateDiagnostics();
    });

    startStarfield();
    updateDiagnostics();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
