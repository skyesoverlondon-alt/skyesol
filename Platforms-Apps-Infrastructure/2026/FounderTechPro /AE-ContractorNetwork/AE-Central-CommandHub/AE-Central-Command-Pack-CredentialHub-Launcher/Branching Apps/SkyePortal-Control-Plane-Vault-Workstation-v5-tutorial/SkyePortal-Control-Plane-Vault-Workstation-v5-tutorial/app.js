
(() => {
  "use strict";

  const APP_VERSION = "3.3.0";
  const DB_NAME = "skyeportal_control_plane_vault";
  const DB_VERSION = 3;
  const STORE_META = "meta";
  const STORE_BACKUPS = "backups";
  const STORE_FILES = "files";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const nowISO = () => new Date().toISOString();
  const noop = () => {};

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const BRAND = {
    founderName: "Skyes Over London",
    site: "https://SOLEnterprises.org",
    emailPrimary: "SkyesOverLondonLC@SOLEnterprises.org",
    emailSecondary: "SkyesOverLondon@gmail.com",
    phoneDisplay: "(480) 469-5416",
    phoneLink: "+14804695416"
  };

  const TUTORIAL_VERSION = "vault-workstation-tour-v1";
  const TUTORIAL_STEPS = [
    {
      title: "Dashboard command center",
      tab: "dashboard",
      target: "Dashboard lane",
      hint: "Start here for health, launcher shortcuts, founder surfaces, and a snapshot of what is already in the vault.",
      body: "The dashboard is the offline control surface. It gives you workstation health, quick launch points, recent docs, device watchlists, founder controls, and activity without digging through the nav.",
      bullets: [
        "Use the stats row to see local workload at a glance.",
        "Use Founder Kit when you want a practical starter operating profile fast.",
        "Use the topbar Backup and Export buttons before risky edits."
      ]
    },
    {
      title: "Documents lane",
      tab: "documents",
      target: "Documents lane",
      hint: "This is where runbooks, procedures, briefs, internal memos, checklists, and offline references live.",
      body: "Documents are the proper offline knowledge lane. You can create structured docs, pin the critical ones, tag them, attach files to them, duplicate them, and export them when needed.",
      bullets: [
        "Create a document for each operating procedure or project reference.",
        "Use folders, tags, and pinned status to keep the lane organized.",
        "Attach supporting local files directly from the document actions."
      ]
    },
    {
      title: "Encrypted files lane",
      tab: "files",
      target: "Files lane",
      hint: "Local attachments are stored in the encrypted file locker and can be linked to documents, devices, contacts, or notes.",
      body: "This is the real file locker. Import local attachments, keep their metadata, preview supported file types, link them to the right records, and download them back out later.",
      bullets: [
        "Attach images, PDFs, text exports, and practical workstation files.",
        "Use linked targets so files stay tied to docs, devices, contacts, or notes.",
        "Export the recovery bundle after major file imports so the locker is recoverable."
      ]
    },
    {
      title: "Device inventory",
      tab: "devices",
      target: "Devices lane",
      hint: "Track hardware, ownership, serials, warranty windows, locations, and linked evidence files in one place.",
      body: "The device lane is the offline inventory surface. It is useful for your own stack, client fleet notes, field equipment, replacement planning, and keeping asset records with attached proof files.",
      bullets: [
        "Add owner, location, OS, serial, and asset tag details.",
        "Attach photos, receipts, exports, or configuration references to each device.",
        "Use status values to separate active, spare, repair, or retired hardware."
      ]
    },
    {
      title: "Projects, rules, apps, and env",
      tab: "projects",
      target: "Projects lane",
      hint: "The left nav groups the control-plane lanes so you can map projects, apps, rules packs, and environment profiles together.",
      body: "This workstation is not only storage. It also keeps operational structure. Projects, rules packs, app entries, and env profiles give you an offline command record for your deployment surfaces.",
      bullets: [
        "Use Projects for origin control, environment grouping, and notes.",
        "Use Rules Packs to keep reusable deployable rule text close by.",
        "Use Apps and Env Profiles for launcher URLs and environment block references."
      ]
    },
    {
      title: "Global search",
      tab: "search",
      target: "Search lane",
      hint: "Search cuts across docs, files, devices, contacts, notes, tasks, apps, projects, rules, and env profiles.",
      body: "When the vault gets heavier, search becomes the fast lane. The global search bar and the Search tab both let you jump back into records without manually browsing every section.",
      bullets: [
        "Search names, bodies, notes, tags, IDs, URLs, and linked labels.",
        "Use the topbar search to jump directly into the Search lane.",
        "Keep titles and tags clean so retrieval stays useful offline."
      ]
    },
    {
      title: "Snapshots and recovery",
      tab: "backups",
      target: "Backups lane",
      hint: "This is the safety lane for restore points, verification, and downloadable encrypted recovery bundles.",
      body: "Backups are what make this a workstation instead of theater. Local snapshots protect edits, and the recovery bundle carries the encrypted vault plus the file store for real restoration capability.",
      bullets: [
        "Create a manual snapshot before major edits or imports.",
        "Verify recent backups so you know restore points are sane.",
        "Export a recovery bundle after meaningful milestones and store it somewhere safe."
      ]
    },
    {
      title: "Settings and founder desk",
      tab: "settings",
      target: "Settings lane",
      hint: "Appearance, snapshot policy, background controls, and branded founder surfaces all live here.",
      body: "Settings lets you harden the workstation feel. Adjust the glass UI, load or reset background images, tune retention, keep auto snapshots on, and access the founder-branded offline command desk.",
      bullets: [
        "Use Upload background to personalize the workstation while keeping the UI glass.",
        "Tune retention and auto snapshots to match how risky your workflow is.",
        "Use the founder desk to load the starter operating kit and export a recovery bundle fast."
      ]
    }
  ];

  const state = {
    db: null,
    key: null,
    saltB64u: null,
    unlocked: false,
    meta: null,
    data: createDefaultData(),
    backups: [],
    files: [],
    searchResults: [],
    installEvent: null,
    storageEstimate: { usage: 0, quota: 0 },
    tutorial: { index: 0 }
  };

  const editors = {
    projectId: null,
    ruleId: null,
    appId: null,
    envId: null,
    contactId: null,
    noteId: null,
    taskId: null,
    exportEnvId: null,
    documentId: null,
    deviceId: null,
    fileId: null
  };

  function createDefaultData() {
    return {
      projects: [],
      rulesPacks: [],
      apps: [],
      envProfiles: [],
      contacts: [],
      notes: [],
      tasks: [],
      documents: [],
      devices: [],
      audit: [],
      settings: {
        appearance: {
          preset: "royal",
          backgroundImage: "",
          glass: 72,
          blur: 20,
          tint: 38
        },
        backupRetention: 18,
        autoSnapshots: true,
        broker: {
          baseUrl: "",
          appId: "vault-ui",
          scopes: "config:read,rules:deploy"
        },
        tutorial: {
          completed: false,
          lastStep: 0,
          autostart: true,
          version: TUTORIAL_VERSION
        }
      }
    };
  }

  function mergeDefaults(decoded = {}) {
    const base = createDefaultData();
    const out = {
      ...base,
      ...decoded,
      projects: Array.isArray(decoded.projects) ? decoded.projects : base.projects,
      rulesPacks: Array.isArray(decoded.rulesPacks) ? decoded.rulesPacks : base.rulesPacks,
      apps: Array.isArray(decoded.apps) ? decoded.apps : base.apps,
      envProfiles: Array.isArray(decoded.envProfiles) ? decoded.envProfiles : base.envProfiles,
      contacts: Array.isArray(decoded.contacts) ? decoded.contacts : base.contacts,
      notes: Array.isArray(decoded.notes) ? decoded.notes : base.notes,
      tasks: Array.isArray(decoded.tasks) ? decoded.tasks : base.tasks,
      documents: Array.isArray(decoded.documents) ? decoded.documents : base.documents,
      devices: Array.isArray(decoded.devices) ? decoded.devices : base.devices,
      audit: Array.isArray(decoded.audit) ? decoded.audit : base.audit,
      settings: {
        ...base.settings,
        ...(decoded.settings || {}),
        appearance: {
          ...base.settings.appearance,
          ...((decoded.settings || {}).appearance || {})
        },
        broker: {
          ...base.settings.broker,
          ...((decoded.settings || {}).broker || {})
        },
        tutorial: {
          ...base.settings.tutorial,
          ...((decoded.settings || {}).tutorial || {})
        }
      }
    };

    out.audit = out.audit.slice(0, 400);
    return out;
  }

  function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  }

  function safeJsonParse(text, fallback) {
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  function csvSplit(text) {
    return String(text || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function formatDateOnly(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
  }

  function bytesToHuman(bytes) {
    if (!bytes || bytes < 1) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let n = bytes;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i += 1;
    }
    return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function toast(el, message, ms = 2200) {
    if (!el) return;
    el.textContent = message || "";
    if (!message) return;
    setTimeout(() => {
      if (el.textContent === message) el.textContent = "";
    }, ms);
  }

  function itemEmpty(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function itemCard({ title, subtitle = "", body = "", meta = [], tags = [], actions = "" }) {
    const metaHtml = meta
      .filter(Boolean)
      .map((entry) => `<span>${escapeHtml(entry)}</span>`)
      .join("");
    const tagHtml = tags
      .filter(Boolean)
      .map((tag) => `<span class="badge ${escapeHtml(tag.kind || "")}">${escapeHtml(tag.text || "")}</span>`)
      .join("");
    return `
      <article class="item">
        <div class="item__top">
          <div>
            <div class="item__title">${escapeHtml(title)}</div>
            ${subtitle ? `<div class="item__subtitle">${escapeHtml(subtitle)}</div>` : ""}
            ${metaHtml ? `<div class="item__meta">${metaHtml}</div>` : ""}
            ${body ? `<div class="item__body">${escapeHtml(body)}</div>` : ""}
            ${tagHtml ? `<div class="badges">${tagHtml}</div>` : ""}
          </div>
          ${actions ? `<div class="item__actions">${actions}</div>` : ""}
        </div>
      </article>
    `;
  }

  function button(action, id, label, extra = "") {
    return `<button class="btn btn--ghost" data-action="${escapeHtml(action)}" data-id="${escapeHtml(id)}" ${extra}>${escapeHtml(label)}</button>`;
  }

  function primaryButton(action, id, label, extra = "") {
    return `<button class="btn btn--primary" data-action="${escapeHtml(action)}" data-id="${escapeHtml(id)}" ${extra}>${escapeHtml(label)}</button>`;
  }

  function actionLink(url, label) {
    return `<a class="btn btn--ghost inline-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
  }

  function b64uFromBytes(bytes) {
    const chunk = 0x8000;
    let bin = "";
    for (let i = 0; i < bytes.length; i += chunk) {
      const sub = bytes.subarray(i, i + chunk);
      bin += String.fromCharCode(...sub);
    }
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function bytesFromB64u(value) {
    const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(value || "").length + 3) % 4);
    const bin = atob(normalized);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function standardBase64FromB64u(value) {
    return String(value || "").replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(value || "").length + 3) % 4);
  }

  async function deriveKey(passphrase, existingSalt) {
    const salt = existingSalt ? bytesFromB64u(existingSalt) : crypto.getRandomValues(new Uint8Array(16));
    const baseKey = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 300000,
        hash: "SHA-256"
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    return { key, saltB64u: b64uFromBytes(salt) };
  }

  async function encryptJson(key, payload) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const buffer = enc.encode(JSON.stringify(payload));
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, buffer));
    return { iv: b64uFromBytes(iv), ct: b64uFromBytes(encrypted) };
  }

  async function decryptJson(key, payload) {
    const iv = bytesFromB64u(payload.iv);
    const ct = bytesFromB64u(payload.ct);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return JSON.parse(dec.decode(plain));
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: "key" });
        if (!db.objectStoreNames.contains(STORE_BACKUPS)) db.createObjectStore(STORE_BACKUPS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(STORE_FILES)) db.createObjectStore(STORE_FILES, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
    });
  }

  function tx(storeName, mode, method, ...args) {
    return new Promise((resolve, reject) => {
      const transaction = state.db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = store[method](...args);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getMeta() {
    return (await tx(STORE_META, "readonly", "get", "vault_meta")) || null;
  }

  async function setMeta(meta) {
    await tx(STORE_META, "readwrite", "put", { key: "vault_meta", ...meta });
  }

  async function clearStore(storeName) {
    await tx(storeName, "readwrite", "clear");
  }

  async function getAllBackups() {
    const items = (await tx(STORE_BACKUPS, "readonly", "getAll")) || [];
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async function getAllEncryptedFiles() {
    const items = (await tx(STORE_FILES, "readonly", "getAll")) || [];
    return items.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  }

  async function loadAllFilesDecrypted() {
    const encrypted = await getAllEncryptedFiles();
    const files = [];
    for (const record of encrypted) {
      try {
        const decoded = await decryptJson(state.key, record.sealed);
        files.push(decoded);
      } catch (error) {
        console.error("file decrypt failed", record?.id, error);
      }
    }
    state.files = files.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  }

  function computeStats() {
    return {
      projects: state.data.projects.length,
      rulesPacks: state.data.rulesPacks.length,
      apps: state.data.apps.length,
      envProfiles: state.data.envProfiles.length,
      contacts: state.data.contacts.length,
      notes: state.data.notes.length,
      tasks: state.data.tasks.length,
      documents: state.data.documents.length,
      devices: state.data.devices.length,
      files: state.files.length,
      snapshots: state.backups.length
    };
  }

  async function refreshStorageEstimate() {
    if (!navigator.storage || !navigator.storage.estimate) {
      state.storageEstimate = { usage: 0, quota: 0 };
      return;
    }
    try {
      state.storageEstimate = await navigator.storage.estimate();
    } catch {
      state.storageEstimate = { usage: 0, quota: 0 };
    }
  }

  function audit(action, details = {}) {
    state.data.audit.unshift({
      id: uid("audit"),
      ts: nowISO(),
      action,
      details
    });
    state.data.audit = state.data.audit.slice(0, 400);
  }

  async function persistData({ snapshot = true, snapshotReason = "autosave", snapshotLabel = "", forceSnapshot = false } = {}) {
    if (!state.key) return;
    const sealed = await encryptJson(state.key, state.data);
    const meta = await getMeta();
    state.meta = {
      saltB64u: state.saltB64u,
      sealed,
      createdAt: meta?.createdAt || nowISO(),
      updatedAt: nowISO(),
      version: APP_VERSION
    };
    await setMeta(state.meta);
    if (snapshot && state.data.settings.autoSnapshots) {
      await createSnapshot({ reason: snapshotReason, label: snapshotLabel, force: forceSnapshot });
    }
    await refreshStorageEstimate();
  }

  async function createSnapshot({ reason = "manual", label = "", force = false } = {}) {
    if (!state.key) return null;
    const latest = state.backups[0] || null;
    const latestTime = latest ? new Date(latest.createdAt).getTime() : 0;
    const freshEnough = Date.now() - latestTime < 45000;
    if (!force && freshEnough && latest?.reason === reason) {
      return latest;
    }

    const snapshot = {
      id: uid("backup"),
      kind: "skyeportal_snapshot",
      version: 3,
      reason,
      label: label || readableSnapshotLabel(reason),
      createdAt: nowISO(),
      saltB64u: state.saltB64u,
      sealed: await encryptJson(state.key, state.data),
      stats: computeStats(),
      appVersion: APP_VERSION,
      fileManifest: state.files.map((file) => ({ id: file.id, name: file.name, size: file.size, linkedType: file.linkedType, linkedId: file.linkedId }))
    };

    await tx(STORE_BACKUPS, "readwrite", "put", snapshot);
    state.backups = [snapshot, ...state.backups].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    await trimSnapshots();
    return snapshot;
  }

  function readableSnapshotLabel(reason) {
    const map = {
      manual: "Manual snapshot",
      project_save: "Project change",
      rule_save: "Rules pack change",
      app_save: "App change",
      env_save: "Env profile change",
      contact_save: "Contact desk change",
      note_save: "Notes change",
      task_save: "Task change",
      document_save: "Document change",
      device_save: "Device inventory change",
      settings_save: "Settings change",
      restore_guard: "Pre-restore safeguard"
    };
    return map[reason] || "Vault snapshot";
  }

  async function trimSnapshots() {
    const retention = clamp(Number(state.data.settings.backupRetention || 18), 6, 50);
    const overflow = state.backups.slice(retention);
    if (!overflow.length) return;
    for (const item of overflow) {
      await tx(STORE_BACKUPS, "readwrite", "delete", item.id);
    }
    state.backups = state.backups.slice(0, retention);
  }

  async function initVault(passphrase) {
    const existing = await getMeta();
    if (existing?.saltB64u) {
      toast($("#unlockStatus"), "Vault already exists. Choose unlock.", 3200);
      return false;
    }

    const derived = await deriveKey(passphrase, null);
    state.key = derived.key;
    state.saltB64u = derived.saltB64u;
    state.data = mergeDefaults({});
    state.backups = [];
    state.files = [];
    audit("vault:init", { version: APP_VERSION });
    await persistData({ snapshot: false });
    await createSnapshot({ reason: "manual", label: "Fresh vault", force: true });
    return true;
  }

  async function unlockExisting(passphrase) {
    const meta = await getMeta();
    if (!meta?.sealed || !meta?.saltB64u) {
      toast($("#unlockStatus"), "No vault found. Initialize a new one.", 3200);
      return false;
    }

    const derived = await deriveKey(passphrase, meta.saltB64u);
    try {
      const decoded = await decryptJson(derived.key, meta.sealed);
      state.key = derived.key;
      state.saltB64u = derived.saltB64u;
      state.meta = meta;
      state.data = mergeDefaults(decoded);
      state.backups = await getAllBackups();
      await loadAllFilesDecrypted();
      state.unlocked = true;
      applyAppearance();
      syncSettingsForm();
      syncBrokerFields();
      await refreshStorageEstimate();
      audit("vault:unlock", { version: APP_VERSION });
      await persistData({ snapshot: false });
      showWorkspace();
      renderAll();
      maybeAutostartTutorial();
      return true;
    } catch (error) {
      console.error(error);
      toast($("#unlockStatus"), "Wrong passphrase or corrupt vault.", 3600);
      return false;
    }
  }

  async function unlockFlow() {
    const passphrase = $("#passphrase").value;
    const mode = $("#unlockMode").value;
    if (!passphrase || passphrase.length < 6) {
      toast($("#unlockStatus"), "Use a real passphrase.", 2400);
      return;
    }
    toast($("#unlockStatus"), "Working…", 1800);

    if (mode === "init") {
      const ok = await initVault(passphrase);
      if (!ok) return;
    }

    const unlocked = await unlockExisting(passphrase);
    if (unlocked) toast($("#unlockStatus"), "Unlocked.", 1800);
  }

  function resetRuntime() {
    state.key = null;
    state.saltB64u = null;
    state.unlocked = false;
    state.meta = null;
    state.data = createDefaultData();
    state.backups = [];
    state.files = [];
    state.searchResults = [];
    state.tutorial = { index: 0 };
    Object.keys(editors).forEach((key) => { editors[key] = null; });
  }

  async function lockVault() {
    if (state.unlocked) {
      audit("vault:lock", {});
      await persistData({ snapshot: false });
    }
    resetRuntime();
    showUnlock();
  }

  function showWorkspace() {
    $("#unlockView").classList.add("hidden");
    $("#workspace").classList.remove("hidden");
    $("#btnLock").disabled = false;
    selectTab("dashboard");
  }

  function showUnlock() {
    $("#workspace").classList.add("hidden");
    $("#unlockView").classList.remove("hidden");
    $("#btnLock").disabled = true;
    $("#passphrase").value = "";
    $("#unlockStatus").textContent = "";
  }

  function selectTab(tab) {
    $$(".nav__item").forEach((buttonEl) => {
      buttonEl.classList.toggle("active", buttonEl.dataset.tab === tab);
    });
    $$(".tab").forEach((panel) => panel.classList.add("hidden"));
    const panel = document.getElementById(`tab_${tab}`);
    if (panel) panel.classList.remove("hidden");
  }

  function presetMap(name) {
    const presets = {
      nebula: `
        radial-gradient(1200px 800px at 10% 15%, rgba(157,114,255,.25), transparent 60%),
        radial-gradient(1000px 760px at 88% 10%, rgba(244,205,100,.16), transparent 56%),
        radial-gradient(900px 600px at 50% 110%, rgba(127,214,255,.13), transparent 60%),
        linear-gradient(180deg, #090611, #160e22 46%, #24163a)
      `,
      royal: `
        radial-gradient(1000px 780px at 0% 0%, rgba(120,85,255,.35), transparent 60%),
        radial-gradient(900px 700px at 100% 12%, rgba(244,205,100,.18), transparent 52%),
        linear-gradient(180deg, #07040c, #140a1f 55%, #281340)
      `,
      midnight: `
        radial-gradient(1000px 740px at 12% 14%, rgba(90,130,255,.18), transparent 60%),
        radial-gradient(860px 620px at 84% 14%, rgba(157,114,255,.18), transparent 60%),
        linear-gradient(180deg, #03050b, #0b1420 46%, #151a30)
      `,
      sunrise: `
        radial-gradient(1000px 800px at 8% 18%, rgba(255,180,120,.22), transparent 60%),
        radial-gradient(900px 640px at 88% 20%, rgba(255,233,146,.16), transparent 55%),
        linear-gradient(180deg, #13090e, #24111b 50%, #3f2232)
      `
    };
    return presets[name] || presets.nebula;
  }

  function applyAppearance() {
    const appearance = state.data.settings.appearance;
    const root = document.documentElement;
    root.style.setProperty("--bg-preset", presetMap(appearance.preset));
    root.style.setProperty("--glass", `rgba(20, 14, 32, ${clamp(Number(appearance.glass || 72), 42, 92) / 100})`);
    root.style.setProperty("--blur", `${clamp(Number(appearance.blur || 20), 8, 28)}px`);
    root.style.setProperty("--tint", String(clamp(Number(appearance.tint || 38), 18, 72)));
    root.style.setProperty("--bg-image", appearance.backgroundImage ? `url(${appearance.backgroundImage})` : "none");
  }

  function syncSettingsForm() {
    const settings = state.data.settings;
    $("#settingPreset").value = settings.appearance.preset;
    $("#settingGlass").value = String(settings.appearance.glass);
    $("#settingBlur").value = String(settings.appearance.blur);
    $("#settingTint").value = String(settings.appearance.tint);
    $("#settingRetention").value = String(settings.backupRetention);
    $("#settingAutoSnapshots").checked = !!settings.autoSnapshots;
  }

  function syncBrokerFields() {
    const broker = state.data.settings.broker;
    $("#brokerUrl").value = broker.baseUrl || "";
    $("#brokerAppId").value = broker.appId || "vault-ui";
    $("#brokerScopes").value = broker.scopes || "config:read,rules:deploy";
  }

  function tutorialPrefs() {
    const base = createDefaultData().settings.tutorial;
    state.data.settings.tutorial = {
      ...base,
      ...(state.data.settings.tutorial || {})
    };
    return state.data.settings.tutorial;
  }

  function currentTutorialStartIndex() {
    const tutorial = tutorialPrefs();
    return tutorial.completed ? 0 : clamp(Number(tutorial.lastStep || 0), 0, TUTORIAL_STEPS.length - 1);
  }

  function renderTutorialDialog() {
    const tutorial = tutorialPrefs();
    const index = clamp(Number(state.tutorial.index || 0), 0, TUTORIAL_STEPS.length - 1);
    const step = TUTORIAL_STEPS[index];
    tutorial.lastStep = index;

    if (step.tab) {
      selectTab(step.tab);
      const panel = document.getElementById(`tab_${step.tab}`);
      panel?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    $("#tutorialTitle").textContent = step.title;
    $("#tutorialProgressText").textContent = `Step ${index + 1} of ${TUTORIAL_STEPS.length}`;
    $("#tutorialBody").textContent = step.body;
    $("#tutorialTarget").textContent = step.target;
    $("#tutorialHint").textContent = step.hint;
    $("#tutorialBullets").innerHTML = step.bullets.map((entry) => `<div class="item tutorial-bullet"><div class="item__title">${escapeHtml(entry)}</div></div>`).join("");
    $("#tutorialAutostart").checked = !!tutorial.autostart;
    $("#btnTutorialPrev").disabled = index === 0;
    $("#btnTutorialNext").textContent = index === TUTORIAL_STEPS.length - 1 ? "Finish walkthrough" : "Next";
  }

  async function saveTutorialPrefs() {
    if (!state.unlocked) return;
    const tutorial = tutorialPrefs();
    tutorial.autostart = !!$("#tutorialAutostart").checked;
    tutorial.lastStep = clamp(Number(state.tutorial.index || 0), 0, TUTORIAL_STEPS.length - 1);
    await persistData({ snapshot: false });
    renderDashboard();
    renderSettings();
  }

  function openTutorial(index = currentTutorialStartIndex()) {
    if (!state.unlocked) {
      toast($("#unlockStatus"), "Unlock the workstation first to run the walkthrough.", 2600);
      return;
    }
    state.tutorial.index = clamp(Number(index || 0), 0, TUTORIAL_STEPS.length - 1);
    renderTutorialDialog();
    if (!$("#tutorialDialog").open) $("#tutorialDialog").showModal();
  }

  async function closeTutorial() {
    await saveTutorialPrefs();
    if ($("#tutorialDialog").open) $("#tutorialDialog").close();
  }

  async function previousTutorialStep() {
    state.tutorial.index = clamp(Number(state.tutorial.index || 0) - 1, 0, TUTORIAL_STEPS.length - 1);
    renderTutorialDialog();
    await saveTutorialPrefs();
  }

  async function finishTutorial() {
    const tutorial = tutorialPrefs();
    tutorial.completed = true;
    tutorial.lastStep = TUTORIAL_STEPS.length - 1;
    tutorial.autostart = !!$("#tutorialAutostart").checked;
    audit("tutorial:complete", { version: TUTORIAL_VERSION, steps: TUTORIAL_STEPS.length });
    await persistData({ snapshot: false });
    renderDashboard();
    renderSettings();
    if ($("#tutorialDialog").open) $("#tutorialDialog").close();
    toast($("#tutorialStatus"), "Walkthrough completed.", 2200);
  }

  async function nextTutorialStep() {
    if (Number(state.tutorial.index || 0) >= TUTORIAL_STEPS.length - 1) {
      await finishTutorial();
      return;
    }
    state.tutorial.index = clamp(Number(state.tutorial.index || 0) + 1, 0, TUTORIAL_STEPS.length - 1);
    renderTutorialDialog();
    await saveTutorialPrefs();
  }

  function maybeAutostartTutorial() {
    const tutorial = tutorialPrefs();
    if (!tutorial.completed && tutorial.autostart) {
      setTimeout(() => {
        if (state.unlocked) openTutorial(currentTutorialStartIndex());
      }, 320);
    }
  }

  function getLinkedTargetLabel(linkedType, linkedId) {
    if (!linkedId || !linkedType || linkedType === "general") return "General";
    const maps = {
      document: state.data.documents,
      device: state.data.devices,
      contact: state.data.contacts,
      note: state.data.notes
    };
    const hit = (maps[linkedType] || []).find((item) => item.id === linkedId);
    return hit ? (hit.title || hit.name || linkedId) : linkedId;
  }

  function countLinkedFiles(linkedType, linkedId) {
    return state.files.filter((file) => file.linkedType === linkedType && file.linkedId === linkedId).length;
  }

  function getLinkOptions(type) {
    if (type === "document") return state.data.documents.map((item) => ({ id: item.id, label: item.title }));
    if (type === "device") return state.data.devices.map((item) => ({ id: item.id, label: item.name }));
    if (type === "contact") return state.data.contacts.map((item) => ({ id: item.id, label: item.name }));
    if (type === "note") return state.data.notes.map((item) => ({ id: item.id, label: item.title }));
    return [];
  }

  function updateFileLinkTargets(type = $("#fileLinkedType").value, selected = "") {
    const select = $("#fileLinkedId");
    const options = getLinkOptions(type);
    if (type === "general" || !options.length) {
      select.innerHTML = `<option value="">—</option>`;
      select.disabled = type === "general";
      return;
    }
    select.disabled = false;
    select.innerHTML = [`<option value="">—</option>`]
      .concat(options.map((opt) => `<option value="${escapeHtml(opt.id)}">${escapeHtml(opt.label)}</option>`))
      .join("");
    select.value = selected || "";
  }

  function collectSearchIndex() {
    const groups = [
      ["projects", state.data.projects, (item) => [item.name, item.projectId, item.env, item.notes, JSON.stringify(item.publicConfig || {}), (item.allowedOrigins || []).join(" ")]],
      ["rules", state.data.rulesPacks, (item) => [item.name, item.summary, (item.tags || []).join(" "), item.firestoreRules, item.storageRules]],
      ["apps", state.data.apps, (item) => [item.name, item.appId, item.url, item.notes, (item.allowedOrigins || []).join(" ")]],
      ["env", state.data.envProfiles, (item) => [item.name, item.env, JSON.stringify(item.publicEnv || {}), JSON.stringify(item.privateEnv || {}), item.appId, item.projectId]],
      ["contacts", state.data.contacts, (item) => [item.name, item.company, item.role, item.email, item.phone, item.url, item.notes, (item.tags || []).join(" ")]],
      ["notes", state.data.notes, (item) => [item.title, item.body, (item.tags || []).join(" ")]],
      ["tasks", state.data.tasks, (item) => [item.title, item.status, item.priority, item.notes, (item.tags || []).join(" "), item.dueDate]],
      ["documents", state.data.documents, (item) => [item.title, item.folder, item.type, item.status, item.body, (item.tags || []).join(" ")]],
      ["devices", state.data.devices, (item) => [item.name, item.category, item.status, item.owner, item.serial, item.assetTag, item.os, item.location, item.ipAddress, item.notes, (item.tags || []).join(" ")]],
      ["files", state.files, (item) => [item.name, item.mimeType, item.note, item.textPreview, (item.tags || []).join(" "), item.linkedType, getLinkedTargetLabel(item.linkedType, item.linkedId)]]
    ];

    const entries = [];
    groups.forEach(([tab, items, extractor]) => {
      items.forEach((item) => {
        entries.push({
          tab,
          id: item.id,
          title: item.name || item.title || item.appId || item.projectId || item.id,
          subtitle: tab,
          haystack: extractor(item).join(" ").toLowerCase()
        });
      });
    });
    return entries;
  }

  function runSearch(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    return collectSearchIndex()
      .filter((entry) => entry.haystack.includes(q) || entry.title.toLowerCase().includes(q))
      .slice(0, 100);
  }

  function renderSearchResults(query = "") {
    const list = $("#searchResultsList");
    const meta = $("#searchResultsMeta");
    if (!query.trim()) {
      meta.textContent = "Type a query to search the workstation.";
      list.innerHTML = itemEmpty("No search query yet.");
      return;
    }
    state.searchResults = runSearch(query);
    meta.textContent = `${state.searchResults.length} result${state.searchResults.length === 1 ? "" : "s"} for “${query}”.`;
    if (!state.searchResults.length) {
      list.innerHTML = itemEmpty("No matches.");
      return;
    }
    list.innerHTML = state.searchResults
      .map((entry) =>
        itemCard({
          title: entry.title,
          subtitle: entry.subtitle,
          meta: [`ID: ${entry.id}`],
          actions: `${primaryButton("gotoSearchResult", `${entry.tab}:${entry.id}`, "Open")}`
        })
      )
      .join("");
  }

  function notifyFounderStatus(message) {
    toast($("#founderDeskStatus"), message, 2400);
    toast($("#settingsStatus"), message, 2400);
  }

  async function seedFounderKit() {
    let added = 0;

    const hasContact = state.data.contacts.some((item) => String(item.name || "").toLowerCase() === BRAND.founderName.toLowerCase());
    if (!hasContact) {
      state.data.contacts.unshift({
        id: uid("contact"),
        name: BRAND.founderName,
        company: "Skyes Over London / SOLEnterprises",
        role: "Founder",
        email: BRAND.emailPrimary,
        phone: BRAND.phoneDisplay,
        url: BRAND.site,
        tags: ["founder", "primary", "brand"],
        notes: "Primary founder contact kept inside the offline workstation for quick outreach, ownership reference, and asset alignment.",
        createdAt: nowISO(),
        updatedAt: nowISO()
      });
      added += 1;
    }

    const hasDevice = state.data.devices.some((item) => String(item.name || "").toLowerCase() === "founder primary workstation");
    if (!hasDevice) {
      state.data.devices.unshift({
        id: uid("device"),
        name: "Founder Primary Workstation",
        category: "laptop",
        status: "active",
        owner: BRAND.founderName,
        serial: "",
        assetTag: "FOUNDER-PRIMARY",
        os: "ChromeOS / multi-surface workflow",
        ipAddress: "",
        location: "Founder desk",
        lastSeen: new Date().toISOString().slice(0, 10),
        purchaseDate: "",
        warrantyDate: "",
        tags: ["founder", "primary", "workstation"],
        notes: "Use this record as the canonical offline reference for the founder's main operating surface and attach screenshots, receipts, recovery notes, or handoff files.",
        createdAt: nowISO(),
        updatedAt: nowISO()
      });
      added += 1;
    }

    const hasDoc = state.data.documents.some((item) => String(item.title || "").toLowerCase() === "founder command protocol");
    if (!hasDoc) {
      state.data.documents.unshift({
        id: uid("document"),
        title: "Founder Command Protocol",
        folder: "Operations / Founder",
        type: "procedure",
        status: "active",
        tags: ["founder", "ops", "command"],
        pinned: true,
        body: "1. Unlock the vault workstation.\n2. Review the dashboard health and pending tasks.\n3. Export a recovery bundle before major restructures.\n4. Keep device records, launch surfaces, and documents aligned.\n5. Attach critical files to the correct document, device, contact, or note.\n6. Refresh backups after milestone changes.",
        createdAt: nowISO(),
        updatedAt: nowISO()
      });
      added += 1;
    }

    const hasNote = state.data.notes.some((item) => String(item.title || "").toLowerCase() === "founder quick ops");
    if (!hasNote) {
      state.data.notes.unshift({
        id: uid("note"),
        title: "Founder Quick Ops",
        body: "Keep the local workstation current with the latest devices, core documents, recovery exports, and launch URLs. This note is a standing local reminder that the workstation is a command surface, not only storage.",
        pinned: true,
        tags: ["founder", "ops", "priority"],
        createdAt: nowISO(),
        updatedAt: nowISO()
      });
      added += 1;
    }

    const hasTask = state.data.tasks.some((item) => String(item.title || "").toLowerCase() === "export recovery bundle after major changes");
    if (!hasTask) {
      state.data.tasks.unshift({
        id: uid("task"),
        title: "Export recovery bundle after major changes",
        status: "open",
        priority: "high",
        dueDate: "",
        tags: ["backup", "founder"],
        notes: "After meaningful updates, export an encrypted recovery bundle so the workstation can be restored without exposing the vault payload.",
        createdAt: nowISO(),
        updatedAt: nowISO()
      });
      added += 1;
    }

    const hasApp = state.data.apps.some((item) => String(item.appId || "").toLowerCase() == "solenterprises-hub");
    if (!hasApp) {
      state.data.apps.unshift({
        id: uid("app"),
        name: "SOLEnterprises Hub",
        appId: "solenterprises-hub",
        url: BRAND.site,
        defaultProjectId: "",
        allowedOrigins: [BRAND.site],
        notes: "Primary founder brand surface and main outward launch point.",
        createdAt: nowISO(),
        updatedAt: nowISO()
      });
      added += 1;
    }

    if (!added) {
      notifyFounderStatus("Founder kit already present.");
      return;
    }

    audit("founder:seed", { added });
    await persistData({ snapshotReason: "founder_seed" });
    renderAll();
    notifyFounderStatus(`Founder kit loaded (${added} item${added === 1 ? "" : "s"}).`);
  }

  function renderDashboard() {
    const stats = computeStats();
    $("#statProjects").textContent = String(stats.projects);
    $("#statApps").textContent = String(stats.apps);
    $("#statDocuments").textContent = String(stats.documents);
    $("#statFiles").textContent = String(stats.files);
    $("#statDevices").textContent = String(stats.devices);
    $("#statContacts").textContent = String(stats.contacts);
    $("#statTasks").textContent = String(stats.tasks);
    $("#statBackups").textContent = String(stats.snapshots);

    const latestBackup = state.backups[0];
    const healthItems = [
      `Vault updated: ${formatDate(state.meta?.updatedAt)}`,
      `Latest snapshot: ${latestBackup ? formatDate(latestBackup.createdAt) : "none yet"}`,
      `Encrypted files: ${state.files.length} (${bytesToHuman(state.files.reduce((sum, file) => sum + Number(file.size || 0), 0))})`,
      `Local usage: ${bytesToHuman(state.storageEstimate.usage || 0)} / ${bytesToHuman(state.storageEstimate.quota || 0)}`,
      `Connectivity: ${navigator.onLine ? "online" : "offline"}`,
      `Auto snapshots: ${state.data.settings.autoSnapshots ? "on" : "off"}`,
      `Retention: ${state.data.settings.backupRetention} snapshots`
    ];
    $("#dashboardHealth").innerHTML = healthItems.map((entry) => `<div class="item"><div class="item__title">${escapeHtml(entry)}</div></div>`).join("");

    const launcherItems = state.data.apps.slice(0, 6);
    $("#quickLauncher").innerHTML = launcherItems.length
      ? launcherItems
          .map((app) =>
            itemCard({
              title: app.name,
              subtitle: app.appId,
              meta: [app.url ? app.url : "No launch URL set"],
              actions: `${app.url ? actionLink(app.url, "Open") : ""}${button("editApp", app.id, "Edit")}`
            })
          )
          .join("")
      : itemEmpty("No apps yet.");

    const recentDocs = [...state.data.documents]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 5);
    $("#recentDocuments").innerHTML = recentDocs.length
      ? recentDocs
          .map((doc) =>
            itemCard({
              title: doc.title,
              subtitle: `${doc.type} • ${doc.status}`,
              meta: [doc.folder || "No folder", `Files: ${countLinkedFiles("document", doc.id)}`],
              actions: `${button("editDocument", doc.id, "Edit")}`
            })
          )
          .join("")
      : itemEmpty("No documents yet.");

    const upcoming = [...state.data.tasks]
      .sort((a, b) => String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999")))
      .filter((task) => task.status !== "done")
      .slice(0, 6);
    $("#upcomingTasks").innerHTML = upcoming.length
      ? upcoming
          .map((task) =>
            itemCard({
              title: task.title,
              subtitle: `${task.priority} priority`,
              meta: [task.dueDate ? `Due ${formatDateOnly(task.dueDate)}` : "No due date", `Status: ${task.status}`],
              actions: `${button("toggleTask", task.id, task.status === "done" ? "Mark open" : "Mark done")}${button("editTask", task.id, "Edit")}`
            })
          )
          .join("")
      : itemEmpty("No open tasks.");

    const deviceWatch = [...state.data.devices]
      .sort((a, b) => String(a.status || "").localeCompare(String(b.status || "")) || String(a.name || "").localeCompare(String(b.name || "")))
      .slice(0, 5);
    $("#deviceWatchlist").innerHTML = deviceWatch.length
      ? deviceWatch
          .map((device) =>
            itemCard({
              title: device.name,
              subtitle: `${device.category} • ${device.status}`,
              meta: [device.owner || "No owner", device.location || "No location", `Files: ${countLinkedFiles("device", device.id)}`],
              actions: `${button("editDevice", device.id, "Edit")}`
            })
          )
          .join("")
      : itemEmpty("No devices yet.");

    const founderCards = [
      itemCard({
        title: BRAND.founderName,
        subtitle: "Founder • offline command owner",
        meta: [BRAND.emailPrimary, BRAND.emailSecondary, BRAND.phoneDisplay],
        body: "Brand assets are shipped into this workstation and the footer/contact blocks stay available offline.",
        actions: `${actionLink(BRAND.site, "Open site")}`
      }),
      itemCard({
        title: "Founder kit status",
        subtitle: "Seeded local operator pack",
        meta: [
          `Founder contacts: ${state.data.contacts.filter((item) => Array.isArray(item.tags) && item.tags.includes("founder")).length}`,
          `Founder devices: ${state.data.devices.filter((item) => Array.isArray(item.tags) && item.tags.includes("founder")).length}`,
          `Pinned founder docs: ${state.data.documents.filter((item) => !!item.pinned && Array.isArray(item.tags) && item.tags.includes("founder")).length}`
        ],
        body: "Use the founder kit button to preload a practical starter profile covering docs, notes, tasks, a primary device record, and a brand launcher."
      })
    ];
    $("#founderDesk").innerHTML = founderCards.join("");

    const tutorial = tutorialPrefs();
    const nextStep = TUTORIAL_STEPS[clamp(Number(tutorial.lastStep || 0), 0, TUTORIAL_STEPS.length - 1)];
    $("#tutorialLane").innerHTML = [
      itemCard({
        title: tutorial.completed ? "Walkthrough completed" : `Resume at step ${clamp(Number(tutorial.lastStep || 0), 0, TUTORIAL_STEPS.length - 1) + 1}`,
        subtitle: tutorial.completed ? "Replay it anytime from the dashboard, topbar, or settings." : nextStep.title,
        meta: [
          `Auto-open on unlock: ${tutorial.autostart ? "on" : "off"}`,
          `Tour version: ${tutorial.version}`
        ],
        body: tutorial.completed ? "You have already completed the guided workstation tour. Run it again whenever you want a fast lane-by-lane refresher." : nextStep.body,
        tags: [
          { text: `${TUTORIAL_STEPS.length} guided steps`, kind: "gold" },
          { text: tutorial.completed ? "Complete" : "In progress", kind: tutorial.completed ? "ok" : "warn" }
        ]
      }),
      itemCard({
        title: "What the walkthrough covers",
        subtitle: "Docs, files, devices, search, recovery, and settings",
        body: "The guided walkthrough moves the workspace to the right lane on each step so users can actually see the control plane instead of reading static help text.",
        tags: TUTORIAL_STEPS.slice(0, 5).map((step) => ({ text: step.target.replace(" lane", "") }))
      })
    ].join("");
    $("#btnTutorialStart").textContent = tutorial.completed ? "Replay walkthrough" : tutorial.lastStep > 0 ? "Resume walkthrough" : "Start walkthrough";

    const recent = state.data.audit.slice(0, 6);
    $("#recentActivity").innerHTML = recent.length
      ? recent
          .map((entry) =>
            itemCard({
              title: entry.action,
              subtitle: formatDate(entry.ts),
              body: JSON.stringify(entry.details || {}),
              actions: ""
            })
          )
          .join("")
      : itemEmpty("Audit lane is empty.");
  }

  function renderProjects() {
    const list = $("#projectsList");
    if (!state.data.projects.length) {
      list.innerHTML = itemEmpty("No projects yet.");
      return;
    }
    list.innerHTML = state.data.projects
      .map((project) => {
        const consoleUrl = project.projectId
          ? `https://console.firebase.google.com/project/${encodeURIComponent(project.projectId)}/overview`
          : "";
        return itemCard({
          title: project.name,
          subtitle: `${project.env} • ${project.projectId}`,
          meta: [
            `Origins: ${(project.allowedOrigins || []).length}`,
            `Updated: ${formatDate(project.updatedAt)}`
          ],
          body: project.notes,
          tags: (project.allowedOrigins || []).slice(0, 4).map((origin) => ({ text: origin })),
          actions: `${consoleUrl ? actionLink(consoleUrl, "Console") : ""}${button("copyProjectConfig", project.id, "Copy config")}${button("editProject", project.id, "Edit")}${button("deleteProject", project.id, "Delete")}`
        });
      })
      .join("");
  }

  function renderRules() {
    const list = $("#rulesList");
    if (!state.data.rulesPacks.length) {
      list.innerHTML = itemEmpty("No rules packs yet.");
      return;
    }
    list.innerHTML = state.data.rulesPacks
      .map((rule) =>
        itemCard({
          title: rule.name,
          subtitle: rule.summary || "Reusable rules pack",
          meta: [`Updated: ${formatDate(rule.updatedAt)}`, `Tags: ${(rule.tags || []).length}`],
          tags: (rule.tags || []).map((tag) => ({ text: tag, kind: "gold" })),
          actions: `${button("copyRuleFirestore", rule.id, "Copy Firestore")}${button("copyRuleStorage", rule.id, "Copy Storage")}${button("editRule", rule.id, "Edit")}${button("cloneRule", rule.id, "Clone")}${button("deleteRule", rule.id, "Delete")}`
        })
      )
      .join("");
  }

  function renderApps() {
    const list = $("#appsList");
    if (!state.data.apps.length) {
      list.innerHTML = itemEmpty("No apps yet.");
      return;
    }
    list.innerHTML = state.data.apps
      .map((app) =>
        itemCard({
          title: app.name,
          subtitle: `${app.appId} • ${findById(state.data.projects, app.defaultProjectId)?.name || "No default project"}`,
          meta: [app.url || "No launch URL", `Origins: ${(app.allowedOrigins || []).length}`, `Updated: ${formatDate(app.updatedAt)}`],
          body: app.notes,
          tags: (app.allowedOrigins || []).slice(0, 4).map((origin) => ({ text: origin })),
          actions: `${app.url ? actionLink(app.url, "Open") : ""}${button("editApp", app.id, "Edit")}${button("deleteApp", app.id, "Delete")}`
        })
      )
      .join("");
  }

  function renderEnvProfiles() {
    const list = $("#envList");
    if (!state.data.envProfiles.length) {
      list.innerHTML = itemEmpty("No env profiles yet.");
      return;
    }
    list.innerHTML = state.data.envProfiles
      .map((profile) => {
        const project = findById(state.data.projects, profile.projectId);
        const app = findById(state.data.apps, profile.appId);
        return itemCard({
          title: profile.name,
          subtitle: `${profile.env} • ${project?.name || "No project"} • ${app?.name || "No app"}`,
          meta: [
            `Public keys: ${Object.keys(profile.publicEnv || {}).length}`,
            `Private keys: ${Object.keys(profile.privateEnv || {}).length}`,
            `Updated: ${formatDate(profile.updatedAt)}`
          ],
          actions: `${button("exportEnv", profile.id, "Export blocks")}${button("copyPublicEnv", profile.id, "Copy public JSON")}${button("editEnv", profile.id, "Edit")}${button("deleteEnv", profile.id, "Delete")}`
        });
      })
      .join("");
  }

  function renderContacts() {
    const list = $("#contactsList");
    if (!state.data.contacts.length) {
      list.innerHTML = itemEmpty("No contacts yet.");
      return;
    }
    list.innerHTML = state.data.contacts
      .map((contact) =>
        itemCard({
          title: contact.name,
          subtitle: [contact.company, contact.role].filter(Boolean).join(" • "),
          meta: [contact.email || "No email", contact.phone || "No phone", contact.url || "No URL", `Files: ${countLinkedFiles("contact", contact.id)}`],
          body: contact.notes,
          tags: (contact.tags || []).map((tag) => ({ text: tag })),
          actions: `${contact.email ? actionLink(`mailto:${contact.email}`, "Email") : ""}${contact.phone ? actionLink(`tel:${contact.phone.replace(/[^\d+]/g, "")}`, "Call") : ""}${contact.url ? actionLink(contact.url, "Open") : ""}${button("newFileForContact", contact.id, "Attach file")}${button("editContact", contact.id, "Edit")}${button("deleteContact", contact.id, "Delete")}`
        })
      )
      .join("");
  }

  function renderNotes() {
    const list = $("#notesList");
    if (!state.data.notes.length) {
      list.innerHTML = itemEmpty("No notes yet.");
      return;
    }
    const notes = [...state.data.notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
    list.innerHTML = notes
      .map((note) =>
        itemCard({
          title: note.title,
          subtitle: note.pinned ? "Pinned" : `Updated ${formatDate(note.updatedAt)}`,
          body: note.body,
          tags: [
            ...(note.pinned ? [{ text: "Pinned", kind: "gold" }] : []),
            ...(note.tags || []).map((tag) => ({ text: tag })),
            ...(countLinkedFiles("note", note.id) ? [{ text: `${countLinkedFiles("note", note.id)} file(s)`, kind: "ok" }] : [])
          ],
          actions: `${button("newFileForNote", note.id, "Attach file")}${button("editNote", note.id, "Edit")}${button("deleteNote", note.id, "Delete")}`
        })
      )
      .join("");
  }

  function renderTasks() {
    const list = $("#tasksList");
    if (!state.data.tasks.length) {
      list.innerHTML = itemEmpty("No tasks yet.");
      return;
    }
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    const tasks = [...state.data.tasks].sort((a, b) => {
      const aDone = a.status === "done" ? 1 : 0;
      const bDone = b.status === "done" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      if ((order[a.priority] ?? 99) !== (order[b.priority] ?? 99)) return (order[a.priority] ?? 99) - (order[b.priority] ?? 99);
      return String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999"));
    });
    list.innerHTML = tasks
      .map((task) =>
        itemCard({
          title: task.title,
          subtitle: `${task.status} • ${task.priority}`,
          meta: [task.dueDate ? `Due ${formatDateOnly(task.dueDate)}` : "No due date", `Updated ${formatDate(task.updatedAt)}`],
          body: task.notes,
          tags: [
            { text: task.priority, kind: task.priority === "critical" || task.priority === "high" ? "danger" : task.priority === "medium" ? "warn" : "ok" },
            ...(task.tags || []).map((tag) => ({ text: tag }))
          ],
          actions: `${button("toggleTask", task.id, task.status === "done" ? "Mark open" : "Mark done")}${button("editTask", task.id, "Edit")}${button("deleteTask", task.id, "Delete")}`
        })
      )
      .join("");
  }

  function renderDocuments() {
    const list = $("#documentsList");
    if (!state.data.documents.length) {
      list.innerHTML = itemEmpty("No documents yet.");
      return;
    }
    const docs = [...state.data.documents].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    list.innerHTML = docs
      .map((doc) =>
        itemCard({
          title: doc.title,
          subtitle: `${doc.type} • ${doc.status} ${doc.folder ? `• ${doc.folder}` : ""}`,
          meta: [`Updated ${formatDate(doc.updatedAt)}`, `Files: ${countLinkedFiles("document", doc.id)}`],
          body: doc.body,
          tags: [
            ...(doc.pinned ? [{ text: "Pinned", kind: "gold" }] : []),
            ...(doc.tags || []).map((tag) => ({ text: tag }))
          ],
          actions: `${button("newFileForDocument", doc.id, "Attach file")}${button("exportDocument", doc.id, "Export")}${button("duplicateDocument", doc.id, "Duplicate")}${button("editDocument", doc.id, "Edit")}${button("deleteDocument", doc.id, "Delete")}`
        })
      )
      .join("");
  }

  function renderFiles() {
    const list = $("#filesList");
    if (!state.files.length) {
      list.innerHTML = itemEmpty("No files yet.");
      return;
    }
    list.innerHTML = state.files
      .map((file) =>
        itemCard({
          title: file.name,
          subtitle: `${file.mimeType || "file"} • ${bytesToHuman(Number(file.size || 0))}`,
          meta: [
            `Linked: ${file.linkedType || "general"}${file.linkedId ? ` • ${getLinkedTargetLabel(file.linkedType, file.linkedId)}` : ""}`,
            `Updated ${formatDate(file.updatedAt || file.createdAt)}`
          ],
          body: file.textPreview || file.note || "",
          tags: (file.tags || []).map((tag) => ({ text: tag })),
          actions: `${button("previewFile", file.id, "Preview")}${button("downloadFile", file.id, "Download")}${button("editFile", file.id, "Edit")}${button("deleteFile", file.id, "Delete")}`
        })
      )
      .join("");
  }

  function renderDevices() {
    const list = $("#devicesList");
    if (!state.data.devices.length) {
      list.innerHTML = itemEmpty("No devices yet.");
      return;
    }
    const devices = [...state.data.devices].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    list.innerHTML = devices
      .map((device) =>
        itemCard({
          title: device.name,
          subtitle: `${device.category} • ${device.status}`,
          meta: [
            device.owner || "No owner",
            device.location || "No location",
            device.os || "No OS",
            `Files: ${countLinkedFiles("device", device.id)}`
          ],
          body: device.notes,
          tags: [
            ...(device.tags || []).map((tag) => ({ text: tag })),
            ...(device.serial ? [{ text: `Serial ${device.serial}`, kind: "ok" }] : []),
            ...(device.assetTag ? [{ text: `Asset ${device.assetTag}` }] : [])
          ],
          actions: `${button("newFileForDevice", device.id, "Attach file")}${button("editDevice", device.id, "Edit")}${button("deleteDevice", device.id, "Delete")}`
        })
      )
      .join("");
  }

  function renderBackups() {
    const list = $("#backupsList");
    const latest = state.backups[0];
    $("#backupPolicySummary").innerHTML = [
      `Retention: ${state.data.settings.backupRetention} local snapshots`,
      `Auto snapshots: ${state.data.settings.autoSnapshots ? "enabled" : "disabled"}`,
      `Latest snapshot: ${latest ? formatDate(latest.createdAt) : "none"}`,
      `Recovery bundle file count: ${state.files.length}`
    ]
      .map((entry) => `<div class="item"><div class="item__title">${escapeHtml(entry)}</div></div>`)
      .join("");

    if (!state.backups.length) {
      list.innerHTML = itemEmpty("No snapshots yet.");
      return;
    }

    list.innerHTML = state.backups
      .map((backup) =>
        itemCard({
          title: backup.label || readableSnapshotLabel(backup.reason),
          subtitle: backup.reason,
          meta: [
            `Created ${formatDate(backup.createdAt)}`,
            `Docs ${backup.stats?.documents ?? 0}`,
            `Devices ${backup.stats?.devices ?? 0}`,
            `Files manifest ${backup.fileManifest?.length ?? 0}`
          ],
          actions: `${primaryButton("restoreBackup", backup.id, "Restore")}${button("verifyBackup", backup.id, "Verify")}${button("downloadBackup", backup.id, "Download")}${button("deleteBackup", backup.id, "Delete")}`
        })
      )
      .join("");
  }

  function renderAudit() {
    const list = $("#auditList");
    if (!state.data.audit.length) {
      list.innerHTML = itemEmpty("Audit is empty.");
      return;
    }
    list.innerHTML = state.data.audit
      .map((entry) =>
        itemCard({
          title: entry.action,
          subtitle: formatDate(entry.ts),
          body: JSON.stringify(entry.details || {}, null, 2),
          actions: ""
        })
      )
      .join("");
  }

  function renderSettings() {
    syncSettingsForm();
    const tutorial = tutorialPrefs();
    $("#btnTutorialReplay").textContent = tutorial.completed ? "Replay walkthrough" : tutorial.lastStep > 0 ? "Resume walkthrough" : "Walkthrough";
  }

  function syncSelects() {
    const projectOptions = [`<option value="">—</option>`]
      .concat(state.data.projects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)} (${escapeHtml(project.env)})</option>`))
      .join("");
    $("#appDefaultProject").innerHTML = projectOptions;
    $("#envProject").innerHTML = projectOptions;
    $("#deployProject").innerHTML = projectOptions;

    const appOptions = state.data.apps.length
      ? [`<option value="">—</option>`].concat(state.data.apps.map((app) => `<option value="${escapeHtml(app.id)}">${escapeHtml(app.name)} (${escapeHtml(app.appId)})</option>`)).join("")
      : `<option value="">No apps yet</option>`;
    $("#envApp").innerHTML = appOptions;

    const packOptions = state.data.rulesPacks.length
      ? state.data.rulesPacks.map((rule) => `<option value="${escapeHtml(rule.id)}">${escapeHtml(rule.name)}</option>`).join("")
      : `<option value="">No packs yet</option>`;
    $("#deployPack").innerHTML = packOptions;
  }

  function renderAll() {
    syncSelects();
    updateFileLinkTargets($("#fileLinkedType").value || "general", $("#fileLinkedId").value || "");
    renderDashboard();
    renderDocuments();
    renderFiles();
    renderDevices();
    renderProjects();
    renderRules();
    renderApps();
    renderEnvProfiles();
    renderContacts();
    renderNotes();
    renderTasks();
    renderBackups();
    renderAudit();
    renderSettings();
    renderSearchResults($("#searchTabInput").value || $("#globalSearch").value || "");
    updateConnectivityBadge();
  }

  function findById(collection, id) {
    return collection.find((item) => item.id === id) || null;
  }

  function defaultFirestoreRules() {
    return `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`;
  }

  function defaultStorageRules() {
    return `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}`;
  }

  function openDocumentDialog(doc = null) {
    editors.documentId = doc?.id || null;
    $("#documentDialogTitle").textContent = doc ? "Edit document" : "New document";
    $("#docTitle").value = doc?.title || "";
    $("#docFolder").value = doc?.folder || "";
    $("#docType").value = doc?.type || "procedure";
    $("#docStatus").value = doc?.status || "active";
    $("#docTags").value = (doc?.tags || []).join(", ");
    $("#docPinned").checked = !!doc?.pinned;
    $("#docBody").value = doc?.body || "";
    $("#documentDialog").showModal();
  }

  function openFileDialog(input = null) {
    let fileRecord = null;
    let relation = {};
    if (input && input.id && input.name) fileRecord = input;
    else if (input && typeof input === "object") relation = input;

    editors.fileId = fileRecord?.id || null;
    $("#fileDialogTitle").textContent = fileRecord ? "Edit file metadata" : "Add file";
    $("#fileBinary").value = "";
    $("#fileName").value = fileRecord?.name || "";
    $("#fileLinkedType").value = fileRecord?.linkedType || relation.linkedType || "general";
    updateFileLinkTargets($("#fileLinkedType").value, fileRecord?.linkedId || relation.linkedId || "");
    $("#fileTags").value = (fileRecord?.tags || []).join(", ");
    $("#fileNote").value = fileRecord?.note || "";
    $("#fileBinary").required = !fileRecord;
    $("#fileDialog").showModal();
  }

  function openDeviceDialog(device = null) {
    editors.deviceId = device?.id || null;
    $("#deviceDialogTitle").textContent = device ? "Edit device" : "New device";
    $("#deviceName").value = device?.name || "";
    $("#deviceCategory").value = device?.category || "laptop";
    $("#deviceStatus").value = device?.status || "active";
    $("#deviceOwner").value = device?.owner || "";
    $("#deviceSerial").value = device?.serial || "";
    $("#deviceAssetTag").value = device?.assetTag || "";
    $("#deviceOs").value = device?.os || "";
    $("#deviceIp").value = device?.ipAddress || "";
    $("#deviceLocation").value = device?.location || "";
    $("#deviceLastSeen").value = device?.lastSeen || "";
    $("#devicePurchaseDate").value = device?.purchaseDate || "";
    $("#deviceWarrantyDate").value = device?.warrantyDate || "";
    $("#deviceTags").value = (device?.tags || []).join(", ");
    $("#deviceNotes").value = device?.notes || "";
    $("#deviceDialog").showModal();
  }

  function openProjectDialog(project = null) {
    editors.projectId = project?.id || null;
    $("#projectDialogTitle").textContent = project ? "Edit project" : "New project";
    $("#projName").value = project?.name || "";
    $("#projEnv").value = project?.env || "prod";
    $("#projProjectId").value = project?.projectId || "";
    $("#projOrigins").value = (project?.allowedOrigins || []).join(", ");
    $("#projPublicConfig").value = project?.publicConfig ? JSON.stringify(project.publicConfig, null, 2) : "{}";
    $("#projNotes").value = project?.notes || "";
    $("#projectDialog").showModal();
  }

  function openRuleDialog(rule = null) {
    editors.ruleId = rule?.id || null;
    $("#ruleDialogTitle").textContent = rule ? "Edit rules pack" : "New rules pack";
    $("#ruleName").value = rule?.name || "";
    $("#ruleTags").value = (rule?.tags || []).join(", ");
    $("#ruleSummary").value = rule?.summary || "";
    $("#ruleFirestore").value = rule?.firestoreRules || defaultFirestoreRules();
    $("#ruleStorage").value = rule?.storageRules || defaultStorageRules();
    $("#ruleDialog").showModal();
  }

  function openAppDialog(app = null) {
    editors.appId = app?.id || null;
    $("#appDialogTitle").textContent = app ? "Edit app" : "New app";
    $("#appName").value = app?.name || "";
    $("#appAppId").value = app?.appId || "";
    $("#appOrigins").value = (app?.allowedOrigins || []).join(", ");
    $("#appDefaultProject").value = app?.defaultProjectId || "";
    $("#appUrl").value = app?.url || "";
    $("#appNotes").value = app?.notes || "";
    $("#appDialog").showModal();
  }

  function openEnvDialog(profile = null) {
    editors.envId = profile?.id || null;
    $("#envDialogTitle").textContent = profile ? "Edit env profile" : "New env profile";
    $("#envApp").value = profile?.appId || state.data.apps[0]?.id || "";
    $("#envProject").value = profile?.projectId || state.data.projects[0]?.id || "";
    $("#envName").value = profile?.name || "";
    $("#envStage").value = profile?.env || "prod";
    $("#envPublic").value = profile?.publicEnv ? JSON.stringify(profile.publicEnv, null, 2) : "{}";
    $("#envPrivate").value = profile?.privateEnv ? JSON.stringify(profile.privateEnv, null, 2) : "{}";
    $("#envDialog").showModal();
  }

  function openContactDialog(contact = null) {
    editors.contactId = contact?.id || null;
    $("#contactDialogTitle").textContent = contact ? "Edit contact" : "New contact";
    $("#contactName").value = contact?.name || "";
    $("#contactCompany").value = contact?.company || "";
    $("#contactRole").value = contact?.role || "";
    $("#contactEmail").value = contact?.email || "";
    $("#contactPhone").value = contact?.phone || "";
    $("#contactUrl").value = contact?.url || "";
    $("#contactTags").value = (contact?.tags || []).join(", ");
    $("#contactNotes").value = contact?.notes || "";
    $("#contactDialog").showModal();
  }

  function openNoteDialog(note = null) {
    editors.noteId = note?.id || null;
    $("#noteDialogTitle").textContent = note ? "Edit note" : "New note";
    $("#noteTitle").value = note?.title || "";
    $("#noteTags").value = (note?.tags || []).join(", ");
    $("#noteBody").value = note?.body || "";
    $("#notePinned").checked = !!note?.pinned;
    $("#noteDialog").showModal();
  }

  function openTaskDialog(task = null) {
    editors.taskId = task?.id || null;
    $("#taskDialogTitle").textContent = task ? "Edit task" : "New task";
    $("#taskTitle").value = task?.title || "";
    $("#taskStatus").value = task?.status || "todo";
    $("#taskPriority").value = task?.priority || "medium";
    $("#taskDue").value = task?.dueDate || "";
    $("#taskTags").value = (task?.tags || []).join(", ");
    $("#taskNotes").value = task?.notes || "";
    $("#taskDialog").showModal();
  }

  function saveProjectFromDialog() {
    const payload = {
      id: editors.projectId || uid("project"),
      name: $("#projName").value.trim(),
      env: $("#projEnv").value,
      projectId: $("#projProjectId").value.trim(),
      allowedOrigins: csvSplit($("#projOrigins").value),
      publicConfig: safeJsonParse($("#projPublicConfig").value || "{}", {}),
      notes: $("#projNotes").value.trim(),
      createdAt: findById(state.data.projects, editors.projectId)?.createdAt || nowISO(),
      updatedAt: nowISO()
    };
    if (!payload.name || !payload.projectId) {
      alert("Project needs a name and project ID.");
      return false;
    }
    const index = state.data.projects.findIndex((item) => item.id === payload.id);
    if (index >= 0) state.data.projects[index] = payload;
    else state.data.projects.push(payload);
    audit(index >= 0 ? "project:update" : "project:create", { name: payload.name, projectId: payload.projectId });
    persistData({ snapshotReason: "project_save" }).then(renderAll).catch(console.error);
    return true;
  }

  function saveRuleFromDialog() {
    const payload = {
      id: editors.ruleId || uid("rule"),
      name: $("#ruleName").value.trim(),
      tags: csvSplit($("#ruleTags").value),
      summary: $("#ruleSummary").value.trim(),
      firestoreRules: $("#ruleFirestore").value,
      storageRules: $("#ruleStorage").value,
      createdAt: findById(state.data.rulesPacks, editors.ruleId)?.createdAt || nowISO(),
      updatedAt: nowISO()
    };
    if (!payload.name) {
      alert("Rules pack needs a name.");
      return false;
    }
    const index = state.data.rulesPacks.findIndex((item) => item.id === payload.id);
    if (index >= 0) state.data.rulesPacks[index] = payload;
    else state.data.rulesPacks.push(payload);
    audit(index >= 0 ? "rules:update" : "rules:create", { name: payload.name });
    persistData({ snapshotReason: "rule_save" }).then(renderAll).catch(console.error);
    return true;
  }

  function saveAppFromDialog() {
    const payload = {
      id: editors.appId || uid("app"),
      name: $("#appName").value.trim(),
      appId: $("#appAppId").value.trim(),
      allowedOrigins: csvSplit($("#appOrigins").value),
      defaultProjectId: $("#appDefaultProject").value || "",
      url: $("#appUrl").value.trim(),
      notes: $("#appNotes").value.trim(),
      createdAt: findById(state.data.apps, editors.appId)?.createdAt || nowISO(),
      updatedAt: nowISO()
    };
    if (!payload.name || !payload.appId) {
      alert("App needs a name and app ID.");
      return false;
    }
    const index = state.data.apps.findIndex((item) => item.id === payload.id);
    if (index >= 0) state.data.apps[index] = payload;
    else state.data.apps.push(payload);
    audit(index >= 0 ? "app:update" : "app:create", { name: payload.name, appId: payload.appId });
    persistData({ snapshotReason: "app_save" }).then(renderAll).catch(console.error);
    return true;
  }

  function saveEnvFromDialog() {
    const payload = {
      id: editors.envId || uid("env"),
      appId: $("#envApp").value || "",
      projectId: $("#envProject").value || "",
      name: $("#envName").value.trim(),
      env: $("#envStage").value,
      publicEnv: safeJsonParse($("#envPublic").value || "{}", {}),
      privateEnv: safeJsonParse($("#envPrivate").value || "{}", {}),
      createdAt: findById(state.data.envProfiles, editors.envId)?.createdAt || nowISO(),
      updatedAt: nowISO()
    };
    if (!payload.name) {
      alert("Env profile needs a name.");
      return false;
    }
    const index = state.data.envProfiles.findIndex((item) => item.id === payload.id);
    if (index >= 0) state.data.envProfiles[index] = payload;
    else state.data.envProfiles.push(payload);
    audit(index >= 0 ? "env:update" : "env:create", { name: payload.name });
    persistData({ snapshotReason: "env_save" }).then(renderAll).catch(console.error);
    return true;
  }

  function saveContactFromDialog() {
    const payload = {
      id: editors.contactId || uid("contact"),
      name: $("#contactName").value.trim(),
      company: $("#contactCompany").value.trim(),
      role: $("#contactRole").value.trim(),
      email: $("#contactEmail").value.trim(),
      phone: $("#contactPhone").value.trim(),
      url: $("#contactUrl").value.trim(),
      tags: csvSplit($("#contactTags").value),
      notes: $("#contactNotes").value.trim(),
      createdAt: findById(state.data.contacts, editors.contactId)?.createdAt || nowISO(),
      updatedAt: nowISO()
    };
    if (!payload.name) {
      alert("Contact needs a name.");
      return false;
    }
    const index = state.data.contacts.findIndex((item) => item.id === payload.id);
    if (index >= 0) state.data.contacts[index] = payload;
    else state.data.contacts.push(payload);
    audit(index >= 0 ? "contact:update" : "contact:create", { name: payload.name });
    persistData({ snapshotReason: "contact_save" }).then(renderAll).catch(console.error);
    return true;
  }

  function saveNoteFromDialog() {
    const payload = {
      id: editors.noteId || uid("note"),
      title: $("#noteTitle").value.trim(),
      body: $("#noteBody").value,
      tags: csvSplit($("#noteTags").value),
      pinned: $("#notePinned").checked,
      createdAt: findById(state.data.notes, editors.noteId)?.createdAt || nowISO(),
      updatedAt: nowISO()
    };
    if (!payload.title) {
      alert("Note needs a title.");
      return false;
    }
    const index = state.data.notes.findIndex((item) => item.id === payload.id);
    if (index >= 0) state.data.notes[index] = payload;
    else state.data.notes.push(payload);
    audit(index >= 0 ? "note:update" : "note:create", { title: payload.title });
    persistData({ snapshotReason: "note_save" }).then(renderAll).catch(console.error);
    return true;
  }

  function saveTaskFromDialog() {
    const payload = {
      id: editors.taskId || uid("task"),
      title: $("#taskTitle").value.trim(),
      status: $("#taskStatus").value,
      priority: $("#taskPriority").value,
      dueDate: $("#taskDue").value || "",
      tags: csvSplit($("#taskTags").value),
      notes: $("#taskNotes").value.trim(),
      createdAt: findById(state.data.tasks, editors.taskId)?.createdAt || nowISO(),
      updatedAt: nowISO()
    };
    if (!payload.title) {
      alert("Task needs a title.");
      return false;
    }
    const index = state.data.tasks.findIndex((item) => item.id === payload.id);
    if (index >= 0) state.data.tasks[index] = payload;
    else state.data.tasks.push(payload);
    audit(index >= 0 ? "task:update" : "task:create", { title: payload.title, status: payload.status });
    persistData({ snapshotReason: "task_save" }).then(renderAll).catch(console.error);
    return true;
  }

  function saveDocumentFromDialog() {
    const payload = {
      id: editors.documentId || uid("document"),
      title: $("#docTitle").value.trim(),
      folder: $("#docFolder").value.trim(),
      type: $("#docType").value,
      status: $("#docStatus").value,
      tags: csvSplit($("#docTags").value),
      pinned: $("#docPinned").checked,
      body: $("#docBody").value,
      createdAt: findById(state.data.documents, editors.documentId)?.createdAt || nowISO(),
      updatedAt: nowISO()
    };
    if (!payload.title) {
      alert("Document needs a title.");
      return false;
    }
    const index = state.data.documents.findIndex((item) => item.id === payload.id);
    if (index >= 0) state.data.documents[index] = payload;
    else state.data.documents.push(payload);
    audit(index >= 0 ? "document:update" : "document:create", { title: payload.title, type: payload.type });
    persistData({ snapshotReason: "document_save" }).then(renderAll).catch(console.error);
    return true;
  }

  function saveDeviceFromDialog() {
    const payload = {
      id: editors.deviceId || uid("device"),
      name: $("#deviceName").value.trim(),
      category: $("#deviceCategory").value,
      status: $("#deviceStatus").value,
      owner: $("#deviceOwner").value.trim(),
      serial: $("#deviceSerial").value.trim(),
      assetTag: $("#deviceAssetTag").value.trim(),
      os: $("#deviceOs").value.trim(),
      ipAddress: $("#deviceIp").value.trim(),
      location: $("#deviceLocation").value.trim(),
      lastSeen: $("#deviceLastSeen").value || "",
      purchaseDate: $("#devicePurchaseDate").value || "",
      warrantyDate: $("#deviceWarrantyDate").value || "",
      tags: csvSplit($("#deviceTags").value),
      notes: $("#deviceNotes").value.trim(),
      createdAt: findById(state.data.devices, editors.deviceId)?.createdAt || nowISO(),
      updatedAt: nowISO()
    };
    if (!payload.name) {
      alert("Device needs a name.");
      return false;
    }
    const index = state.data.devices.findIndex((item) => item.id === payload.id);
    if (index >= 0) state.data.devices[index] = payload;
    else state.data.devices.push(payload);
    audit(index >= 0 ? "device:update" : "device:create", { name: payload.name, status: payload.status });
    persistData({ snapshotReason: "device_save" }).then(renderAll).catch(console.error);
    return true;
  }

  function collectionSnapshotReason(collectionName) {
    const map = {
      projects: "project_save",
      rulesPacks: "rule_save",
      apps: "app_save",
      envProfiles: "env_save",
      contacts: "contact_save",
      notes: "note_save",
      tasks: "task_save",
      documents: "document_save",
      devices: "device_save"
    };
    return map[collectionName] || "autosave";
  }

  async function deleteItem(collectionName, id, auditAction) {
    const item = findById(state.data[collectionName], id);
    if (!item) return;
    if (!confirm(`Delete ${item.name || item.title || id}?`)) return;
    state.data[collectionName] = state.data[collectionName].filter((entry) => entry.id !== id);
    audit(auditAction, { id, title: item.name || item.title || id });
    await persistData({ snapshotReason: collectionSnapshotReason(collectionName) });
    renderAll();
  }

  function envToBlock(obj = {}) {
    return Object.entries(obj)
      .filter(([key, value]) => key && value !== undefined)
      .map(([key, value]) => `${key}=${String(value).replace(/\n/g, "\\n")}`)
      .join("\n");
  }

  function copyText(text, okMessage = "Copied.") {
    if (!navigator.clipboard?.writeText) {
      alert("Clipboard unavailable in this browser.");
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      toast($("#settingsStatus"), okMessage, 1800);
    }).catch(() => {
      alert("Copy failed.");
    });
  }

  async function openEnvExport(profileId) {
    const profile = findById(state.data.envProfiles, profileId);
    if (!profile) return;
    editors.exportEnvId = profileId;
    $("#envExportNetlify").value = envToBlock(profile.publicEnv || {});
    $("#envExportDotenv").value = envToBlock(profile.publicEnv || {});
    $("#envExportDialog").showModal();
  }

  function downloadJson(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadText(text, filename, type = "text/plain;charset=utf-8") {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadCsv(rows, filename) {
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
    return text;
  }

  async function exportRecoveryBundle() {
    await persistData({ snapshot: false });
    const bundle = {
      kind: "skyeportal_control_plane_bundle",
      version: 3,
      exportedAt: nowISO(),
      appVersion: APP_VERSION,
      vaultMeta: await getMeta(),
      backups: state.backups,
      files: await getAllEncryptedFiles(),
      manifest: {
        stats: computeStats(),
        fileBytes: state.files.reduce((sum, file) => sum + Number(file.size || 0), 0),
        note: "Encrypted recovery bundle. Requires the original passphrase."
      }
    };
    downloadJson(bundle, `skyeportal-control-plane-workstation-recovery-${Date.now()}.json`);
    audit("bundle:export", { backups: state.backups.length, files: state.files.length });
    await persistData({ snapshot: false });
    toast($("#backupStatus"), "Recovery bundle exported.", 2200);
  }

  async function importBundle(file) {
    const raw = await file.text();
    const parsed = safeJsonParse(raw, null);
    if (!parsed) {
      alert("Invalid JSON bundle.");
      return;
    }

    if (parsed.kind === "skyeportal_control_plane_bundle" && parsed.vaultMeta?.sealed && parsed.vaultMeta?.saltB64u) {
      await setMeta(parsed.vaultMeta);
      await clearStore(STORE_BACKUPS);
      const backups = Array.isArray(parsed.backups) ? parsed.backups : [];
      for (const backup of backups) await tx(STORE_BACKUPS, "readwrite", "put", backup);

      await clearStore(STORE_FILES);
      const files = Array.isArray(parsed.files) ? parsed.files : [];
      for (const record of files) await tx(STORE_FILES, "readwrite", "put", record);

      resetRuntime();
      showUnlock();
      alert("Recovery bundle imported. Unlock with your passphrase.");
      return;
    }

    if (parsed.kind === "skyeportal_vault_export" && parsed.sealed && parsed.saltB64u) {
      await setMeta({ saltB64u: parsed.saltB64u, sealed: parsed.sealed, createdAt: nowISO(), updatedAt: nowISO(), version: APP_VERSION });
      resetRuntime();
      showUnlock();
      alert("Legacy vault export imported. Unlock with your passphrase.");
      return;
    }

    alert("File is not a recognized SkyePortal recovery bundle.");
  }

  async function verifyBackup(id) {
    const backup = findById(state.backups, id);
    if (!backup) return;
    try {
      await decryptJson(state.key, backup.sealed);
      toast($("#backupStatus"), `Verified ${backup.label || backup.id}.`, 2200);
    } catch (error) {
      console.error(error);
      toast($("#backupStatus"), `Could not verify ${backup.label || backup.id}.`, 3200);
    }
  }

  async function restoreBackup(id) {
    const backup = findById(state.backups, id);
    if (!backup) return;
    if (!confirm(`Restore snapshot “${backup.label || backup.id}”? A safeguard snapshot will be created first.`)) return;

    await createSnapshot({ reason: "restore_guard", label: "Pre-restore safeguard", force: true });
    const decoded = await decryptJson(state.key, backup.sealed);
    state.data = mergeDefaults(decoded);
    audit("backup:restore", { backupId: id, label: backup.label || "snapshot" });
    await persistData({ snapshot: false });
    applyAppearance();
    syncSettingsForm();
    syncBrokerFields();
    renderAll();
    toast($("#backupStatus"), "Snapshot restored.", 2200);
  }

  async function deleteBackup(id) {
    const backup = findById(state.backups, id);
    if (!backup) return;
    if (!confirm(`Delete snapshot “${backup.label || backup.id}”?`)) return;
    await tx(STORE_BACKUPS, "readwrite", "delete", id);
    state.backups = state.backups.filter((entry) => entry.id !== id);
    audit("backup:delete", { backupId: id });
    await persistData({ snapshot: false });
    renderBackups();
    renderDashboard();
  }

  function downloadBackup(id) {
    const backup = findById(state.backups, id);
    if (!backup) return;
    downloadJson(backup, `skyeportal-snapshot-${backup.id}.json`);
  }

  async function createManualBackup() {
    const label = $("#manualBackupLabel").value.trim();
    audit("backup:create", { label: label || "Manual snapshot" });
    await createSnapshot({ reason: "manual", label: label || "Manual snapshot", force: true });
    await persistData({ snapshot: false });
    $("#manualBackupLabel").value = "";
    renderBackups();
    renderDashboard();
    toast($("#backupStatus"), "Snapshot created.", 2200);
  }

  async function verifyLatestBackup() {
    const latest = state.backups[0];
    if (!latest) {
      toast($("#backupStatus"), "No snapshots to verify.", 2200);
      return;
    }
    await verifyBackup(latest.id);
  }

  function updateConnectivityBadge() {
    const el = $("#connectivityPill");
    el.className = "pill";
    if (navigator.onLine) {
      el.textContent = "Online";
      el.classList.add("ok");
    } else {
      el.textContent = "Offline ready";
      el.classList.add("warn");
    }
  }

  async function saveSettings() {
    const settings = state.data.settings;
    settings.appearance.preset = $("#settingPreset").value;
    settings.appearance.glass = clamp(Number($("#settingGlass").value || 72), 42, 92);
    settings.appearance.blur = clamp(Number($("#settingBlur").value || 20), 8, 28);
    settings.appearance.tint = clamp(Number($("#settingTint").value || 38), 18, 72);
    settings.backupRetention = clamp(Number($("#settingRetention").value || 18), 6, 50);
    settings.autoSnapshots = $("#settingAutoSnapshots").checked;
    settings.broker.baseUrl = $("#brokerUrl").value.trim();
    settings.broker.appId = $("#brokerAppId").value.trim() || "vault-ui";
    settings.broker.scopes = $("#brokerScopes").value.trim() || "config:read,rules:deploy";
    applyAppearance();
    audit("settings:update", { preset: settings.appearance.preset, retention: settings.backupRetention });
    await persistData({ snapshotReason: "settings_save" });
    renderBackups();
    renderDashboard();
    toast($("#settingsStatus"), "Settings saved.", 1800);
  }

  function readImageAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
  }

  async function handleBackgroundUpload(file) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      alert("Keep the image under 4MB so the vault stays practical offline.");
      return;
    }
    const dataUrl = await readImageAsDataUrl(file);
    state.data.settings.appearance.backgroundImage = dataUrl;
    applyAppearance();
    toast($("#settingsStatus"), "Background loaded. Save settings to keep it.", 2200);
  }

  function resetBackground() {
    state.data.settings.appearance.backgroundImage = "";
    applyAppearance();
    toast($("#settingsStatus"), "Background image removed. Save settings to keep it.", 2200);
  }

  async function testBroker() {
    const status = $("#brokerStatus");
    const baseUrl = $("#brokerUrl").value.trim().replace(/\/$/, "");
    if (!baseUrl) {
      toast(status, "Enter the broker URL.", 2200);
      return;
    }
    if (!navigator.onLine) {
      toast(status, "Offline right now.", 2200);
      return;
    }
    toast(status, "Testing…", 2000);
    try {
      const appId = $("#brokerAppId").value.trim() || "vault-ui";
      const res = await fetch(`${baseUrl}/.netlify/functions/config?app_id=${encodeURIComponent(appId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "broker test failed");
      toast(status, "Broker responded.", 2200);
    } catch (error) {
      console.error(error);
      toast(status, error.message || "Broker test failed.", 3200);
    }
  }

  async function mintToken() {
    const status = $("#brokerStatus");
    const baseUrl = $("#brokerUrl").value.trim().replace(/\/$/, "");
    const appId = $("#brokerAppId").value.trim();
    const secret = $("#brokerSecret").value;
    const scopes = csvSplit($("#brokerScopes").value);
    if (!baseUrl || !appId || !secret) {
      toast(status, "Missing URL, app ID, or secret.", 2600);
      return;
    }
    if (!navigator.onLine) {
      toast(status, "Offline right now.", 2200);
      return;
    }
    toast(status, "Minting…", 1800);
    try {
      const res = await fetch(`${baseUrl}/.netlify/functions/mint`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ app_id: appId, app_secret: secret, scopes })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "mint failed");
      $("#brokerJwt").value = data.token || "";
      toast(status, `Minted token (${data.expires_in || "?"}s).`, 2600);
      state.data.settings.broker.baseUrl = baseUrl;
      state.data.settings.broker.appId = appId;
      state.data.settings.broker.scopes = scopes.join(",");
      await persistData({ snapshot: false });
    } catch (error) {
      console.error(error);
      toast(status, error.message || "mint failed", 3200);
    }
  }

  async function deployRules() {
    const status = $("#deployStatus");
    const baseUrl = $("#brokerUrl").value.trim().replace(/\/$/, "");
    const token = $("#brokerJwt").value.trim();
    const project = findById(state.data.projects, $("#deployProject").value);
    const pack = findById(state.data.rulesPacks, $("#deployPack").value);
    if (!baseUrl || !token || !project || !pack) {
      toast(status, "Missing broker URL, token, project, or rules pack.", 3200);
      return;
    }
    if (!navigator.onLine) {
      toast(status, "Offline right now.", 2200);
      return;
    }
    toast(status, "Deploying…", 2000);
    try {
      const res = await fetch(`${baseUrl}/.netlify/functions/deployRules`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId: project.projectId,
          firestoreRules: $("#deployFirestore").value === "yes" ? pack.firestoreRules : null,
          storageRules: $("#deployStorage").value === "yes" ? pack.storageRules : null
        })
      });
      const data = await res.json().catch(() => ({}));
      $("#deployResult").value = JSON.stringify(data, null, 2);
      if (!res.ok) throw new Error(data.error || "deploy failed");
      toast(status, "Rules deployed.", 2200);
      audit("broker:deploy_rules", { projectId: project.projectId, pack: pack.name });
      await persistData({ snapshot: false });
      renderDashboard();
      renderAudit();
    } catch (error) {
      console.error(error);
      toast(status, error.message || "deploy failed", 3200);
    }
  }

  function exportContactsCsv() {
    const rows = [["Name", "Company", "Role", "Email", "Phone", "URL", "Tags", "Notes"]];
    state.data.contacts.forEach((item) => rows.push([item.name, item.company, item.role, item.email, item.phone, item.url, (item.tags || []).join(" | "), item.notes]));
    downloadCsv(rows, `skyeportal-contacts-${Date.now()}.csv`);
  }

  function exportTasksCsv() {
    const rows = [["Title", "Status", "Priority", "Due", "Tags", "Notes"]];
    state.data.tasks.forEach((item) => rows.push([item.title, item.status, item.priority, item.dueDate, (item.tags || []).join(" | "), item.notes]));
    downloadCsv(rows, `skyeportal-tasks-${Date.now()}.csv`);
  }

  function exportDevicesCsv() {
    const rows = [["Name", "Category", "Status", "Owner", "Serial", "Asset Tag", "OS", "IP", "Location", "Last Seen", "Purchase Date", "Warranty Date", "Tags", "Notes"]];
    state.data.devices.forEach((item) => rows.push([item.name, item.category, item.status, item.owner, item.serial, item.assetTag, item.os, item.ipAddress, item.location, item.lastSeen, item.purchaseDate, item.warrantyDate, (item.tags || []).join(" | "), item.notes]));
    downloadCsv(rows, `skyeportal-devices-${Date.now()}.csv`);
  }

  function exportFilesManifestCsv() {
    const rows = [["Name", "Type", "Size", "Linked Type", "Linked Target", "Tags", "Updated", "Notes"]];
    state.files.forEach((item) => rows.push([item.name, item.mimeType, item.size, item.linkedType, getLinkedTargetLabel(item.linkedType, item.linkedId), (item.tags || []).join(" | "), item.updatedAt || item.createdAt, item.note]));
    downloadCsv(rows, `skyeportal-files-${Date.now()}.csv`);
  }

  function exportDocumentsJson() {
    downloadJson({ exportedAt: nowISO(), documents: state.data.documents }, `skyeportal-documents-${Date.now()}.json`);
  }

  function exportDocument(id) {
    const doc = findById(state.data.documents, id);
    if (!doc) return;
    const header = `# ${doc.title}\n\nType: ${doc.type}\nStatus: ${doc.status}\nFolder: ${doc.folder || "—"}\nTags: ${(doc.tags || []).join(", ")}\nUpdated: ${formatDate(doc.updatedAt)}\n\n---\n\n`;
    downloadText(header + doc.body, `${doc.title.replace(/[^\w.-]+/g, "_") || "document"}.md`, "text/markdown;charset=utf-8");
  }

  function duplicateDocument(id) {
    const doc = findById(state.data.documents, id);
    if (!doc) return;
    const copy = {
      ...doc,
      id: uid("document"),
      title: `${doc.title} Copy`,
      pinned: false,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    state.data.documents.push(copy);
    audit("document:duplicate", { from: doc.id, to: copy.id });
    persistData({ snapshotReason: "document_save" }).then(renderAll).catch(console.error);
  }

  function addStarterDocuments() {
    const seed = [
      {
        id: uid("document"),
        title: "Offline Recovery Runbook",
        folder: "Operations / Recovery",
        type: "procedure",
        status: "active",
        tags: ["recovery", "ops"],
        pinned: false,
        body: "1. Unlock the workstation.\n2. Verify the latest snapshot.\n3. Export a recovery bundle before major changes.\n4. Restore only when necessary.\n5. Re-link local files and confirm critical documents.",
        createdAt: nowISO(),
        updatedAt: nowISO()
      },
      {
        id: uid("document"),
        title: "Device Intake Checklist",
        folder: "Inventory / Intake",
        type: "checklist",
        status: "active",
        tags: ["inventory", "device"],
        pinned: false,
        body: "- Record owner\n- Record serial and asset tag\n- Record OS and IP\n- Record location\n- Attach warranty or purchase files\n- Mark status and last seen date",
        createdAt: nowISO(),
        updatedAt: nowISO()
      },
      {
        id: uid("document"),
        title: "Vault File Classification Guide",
        folder: "Documents / Standards",
        type: "reference",
        status: "active",
        tags: ["files", "standards"],
        pinned: false,
        body: "Use document links for procedures and contracts, device links for warranties and receipts, contact links for agreements and correspondence, and note links for screenshots or snippets tied to a runbook.",
        createdAt: nowISO(),
        updatedAt: nowISO()
      }
    ];
    const existingTitles = new Set(state.data.documents.map((doc) => doc.title.toLowerCase()));
    const toAdd = seed.filter((doc) => !existingTitles.has(doc.title.toLowerCase()));
    if (!toAdd.length) {
      toast($("#settingsStatus"), "Starter docs already present.", 1800);
      return;
    }
    state.data.documents.push(...toAdd);
    audit("documents:seed", { count: toAdd.length });
    persistData({ snapshotReason: "document_save" }).then(renderAll).catch(console.error);
  }

  function handleGotoSearchResult(value) {
    const [tab] = String(value || "").split(":");
    if (tab) selectTab(tab);
  }

  function buildFilePayloadFromRecord(existing, overrides = {}) {
    return {
      ...existing,
      ...overrides,
      updatedAt: nowISO()
    };
  }

  async function readFileBinaryPayload(file) {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let textPreview = "";
    const lowerName = file.name.toLowerCase();
    const isTextLike = file.type.startsWith("text/") || /\.(txt|md|csv|json|log|yaml|yml|xml|html|js|ts|css)$/i.test(lowerName);
    if (isTextLike && file.size <= 180000) {
      try {
        textPreview = dec.decode(bytes).slice(0, 4000);
      } catch {
        textPreview = "";
      }
    }
    return {
      dataB64u: b64uFromBytes(bytes),
      textPreview
    };
  }

  async function saveFileFromDialog() {
    const existing = editors.fileId ? state.files.find((file) => file.id === editors.fileId) : null;
    const selectedFile = $("#fileBinary").files?.[0] || null;
    if (!existing && !selectedFile) {
      alert("Choose a file to add.");
      return false;
    }
    if (selectedFile && selectedFile.size > 12 * 1024 * 1024) {
      alert("Keep files under 12MB per attachment so offline storage stays practical.");
      return false;
    }

    const linkedType = $("#fileLinkedType").value || "general";
    const linkedId = linkedType === "general" ? "" : ($("#fileLinkedId").value || "");
    const payload = buildFilePayloadFromRecord(existing || {
      id: editors.fileId || uid("file"),
      createdAt: nowISO(),
      dataB64u: "",
      textPreview: "",
      size: 0,
      mimeType: ""
    }, {
      name: $("#fileName").value.trim() || selectedFile?.name || existing?.name || "attachment",
      linkedType,
      linkedId,
      tags: csvSplit($("#fileTags").value),
      note: $("#fileNote").value.trim()
    });

    if (selectedFile) {
      const binary = await readFileBinaryPayload(selectedFile);
      payload.dataB64u = binary.dataB64u;
      payload.textPreview = binary.textPreview || payload.textPreview || "";
      payload.size = Number(selectedFile.size || 0);
      payload.mimeType = selectedFile.type || "application/octet-stream";
      if (!$("#fileName").value.trim()) payload.name = selectedFile.name;
    }

    const sealed = await encryptJson(state.key, payload);
    await tx(STORE_FILES, "readwrite", "put", {
      id: payload.id,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
      sealed
    });

    const idx = state.files.findIndex((file) => file.id === payload.id);
    if (idx >= 0) state.files[idx] = payload;
    else state.files.unshift(payload);
    state.files.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    audit(existing ? "file:update" : "file:create", { name: payload.name, linkedType: payload.linkedType });
    await persistData({ snapshot: false });
    renderAll();
    return true;
  }

  async function deleteFile(id) {
    const file = state.files.find((entry) => entry.id === id);
    if (!file) return;
    if (!confirm(`Delete file “${file.name}”?`)) return;
    await tx(STORE_FILES, "readwrite", "delete", id);
    state.files = state.files.filter((entry) => entry.id !== id);
    audit("file:delete", { id, name: file.name });
    await persistData({ snapshot: false });
    renderAll();
  }

  function downloadFile(id) {
    const file = state.files.find((entry) => entry.id === id);
    if (!file) return;
    const bytes = bytesFromB64u(file.dataB64u);
    const blob = new Blob([bytes], { type: file.mimeType || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name || "attachment";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function previewFile(id) {
    const file = state.files.find((entry) => entry.id === id);
    if (!file) return;
    $("#filePreviewTitle").textContent = file.name;
    $("#filePreviewMeta").textContent = `${file.mimeType || "file"} • ${bytesToHuman(file.size)} • Linked to ${file.linkedType || "general"}${file.linkedId ? ` / ${getLinkedTargetLabel(file.linkedType, file.linkedId)}` : ""}`;
    const body = $("#filePreviewBody");
    const mime = file.mimeType || "";
    if (mime.startsWith("image/")) {
      body.innerHTML = `<img alt="${escapeHtml(file.name)}" src="data:${escapeHtml(mime)};base64,${escapeHtml(standardBase64FromB64u(file.dataB64u))}" />`;
    } else if (file.textPreview) {
      body.innerHTML = `<pre>${escapeHtml(file.textPreview)}</pre>`;
    } else {
      body.innerHTML = `<div class="preview-note">Preview is not available for this file type yet. Use Download to open the original file locally.</div>`;
    }
    $("#filePreviewDialog").showModal();
  }

  function defaultFileRelation(kind, id) {
    return { linkedType: kind, linkedId: id };
  }

  async function bindStaticEvents() {
    $("#btnUnlock").addEventListener("click", unlockFlow);
    $("#passphrase").addEventListener("keydown", (event) => {
      if (event.key === "Enter") unlockFlow();
    });

    $("#btnLock").addEventListener("click", () => {
      if (!state.unlocked) return;
      lockVault().catch(console.error);
    });

    $$(".nav__item").forEach((buttonEl) => {
      buttonEl.addEventListener("click", () => selectTab(buttonEl.dataset.tab));
    });

    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-goto],[data-action]");
      if (!trigger) return;
      if (trigger.dataset.goto) {
        selectTab(trigger.dataset.goto);
        return;
      }

      const { action, id } = trigger.dataset;
      const actions = {
        editProject: () => openProjectDialog(findById(state.data.projects, id)),
        deleteProject: () => deleteItem("projects", id, "project:delete").catch(console.error),
        copyProjectConfig: () => {
          const project = findById(state.data.projects, id);
          if (project) copyText(JSON.stringify(project.publicConfig || {}, null, 2), "Project config copied.");
        },
        editRule: () => openRuleDialog(findById(state.data.rulesPacks, id)),
        cloneRule: () => {
          const rule = findById(state.data.rulesPacks, id);
          if (!rule) return;
          const clone = { ...rule, id: uid("rule"), name: `${rule.name} Copy`, createdAt: nowISO(), updatedAt: nowISO() };
          state.data.rulesPacks.push(clone);
          audit("rules:clone", { from: rule.id, to: clone.id });
          persistData({ snapshotReason: "rule_save" }).then(renderAll).catch(console.error);
        },
        deleteRule: () => deleteItem("rulesPacks", id, "rules:delete").catch(console.error),
        copyRuleFirestore: () => {
          const rule = findById(state.data.rulesPacks, id);
          if (rule) copyText(rule.firestoreRules || "", "Firestore rules copied.");
        },
        copyRuleStorage: () => {
          const rule = findById(state.data.rulesPacks, id);
          if (rule) copyText(rule.storageRules || "", "Storage rules copied.");
        },
        editApp: () => openAppDialog(findById(state.data.apps, id)),
        deleteApp: () => deleteItem("apps", id, "app:delete").catch(console.error),
        editEnv: () => openEnvDialog(findById(state.data.envProfiles, id)),
        deleteEnv: () => deleteItem("envProfiles", id, "env:delete").catch(console.error),
        exportEnv: () => openEnvExport(id).catch(console.error),
        copyPublicEnv: () => {
          const profile = findById(state.data.envProfiles, id);
          if (profile) copyText(JSON.stringify(profile.publicEnv || {}, null, 2), "Public env copied.");
        },
        editContact: () => openContactDialog(findById(state.data.contacts, id)),
        deleteContact: () => deleteItem("contacts", id, "contact:delete").catch(console.error),
        editNote: () => openNoteDialog(findById(state.data.notes, id)),
        deleteNote: () => deleteItem("notes", id, "note:delete").catch(console.error),
        editTask: () => openTaskDialog(findById(state.data.tasks, id)),
        deleteTask: () => deleteItem("tasks", id, "task:delete").catch(console.error),
        toggleTask: async () => {
          const task = findById(state.data.tasks, id);
          if (!task) return;
          task.status = task.status === "done" ? "todo" : "done";
          task.updatedAt = nowISO();
          audit("task:toggle", { id: task.id, status: task.status });
          await persistData({ snapshotReason: "task_save" });
          renderAll();
        },
        editDocument: () => openDocumentDialog(findById(state.data.documents, id)),
        deleteDocument: () => deleteItem("documents", id, "document:delete").catch(console.error),
        duplicateDocument: () => duplicateDocument(id),
        exportDocument: () => exportDocument(id),
        editDevice: () => openDeviceDialog(findById(state.data.devices, id)),
        deleteDevice: () => deleteItem("devices", id, "device:delete").catch(console.error),
        editFile: () => openFileDialog(state.files.find((file) => file.id === id)),
        deleteFile: () => deleteFile(id).catch(console.error),
        previewFile: () => previewFile(id),
        downloadFile: () => downloadFile(id),
        newFileForDocument: () => openFileDialog(defaultFileRelation("document", id)),
        newFileForDevice: () => openFileDialog(defaultFileRelation("device", id)),
        newFileForContact: () => openFileDialog(defaultFileRelation("contact", id)),
        newFileForNote: () => openFileDialog(defaultFileRelation("note", id)),
        gotoSearchResult: () => handleGotoSearchResult(id),
        restoreBackup: () => restoreBackup(id).catch(console.error),
        verifyBackup: () => verifyBackup(id).catch(console.error),
        deleteBackup: () => deleteBackup(id).catch(console.error),
        downloadBackup: () => downloadBackup(id)
      };
      if (actions[action]) actions[action]();
    });

    $("#btnRunSearch").addEventListener("click", () => {
      const value = $("#globalSearch").value;
      $("#searchTabInput").value = value;
      selectTab("search");
      renderSearchResults(value);
    });
    $("#btnSearchTab").addEventListener("click", () => renderSearchResults($("#searchTabInput").value));
    $("#searchTabInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter") $("#btnSearchTab").click();
    });
    $("#globalSearch").addEventListener("keydown", (event) => {
      if (event.key === "Enter") $("#btnRunSearch").click();
    });

    $("#btnAddDocument").addEventListener("click", () => openDocumentDialog());
    $("#btnSeedDocuments").addEventListener("click", addStarterDocuments);
    $("#btnExportDocumentsJson").addEventListener("click", exportDocumentsJson);

    $("#btnAddFile").addEventListener("click", () => openFileDialog());
    $("#fileLinkedType").addEventListener("change", () => updateFileLinkTargets($("#fileLinkedType").value, ""));

    $("#btnAddDevice").addEventListener("click", () => openDeviceDialog());
    $("#btnExportDevicesCsv").addEventListener("click", exportDevicesCsv);
    $("#btnExportFilesManifest").addEventListener("click", exportFilesManifestCsv);

    $("#btnAddProject").addEventListener("click", () => openProjectDialog());
    $("#btnAddRule").addEventListener("click", () => openRuleDialog());
    $("#btnAddApp").addEventListener("click", () => openAppDialog());
    $("#btnAddEnv").addEventListener("click", () => openEnvDialog());
    $("#btnAddContact").addEventListener("click", () => openContactDialog());
    $("#btnAddNote").addEventListener("click", () => openNoteDialog());
    $("#btnAddTask").addEventListener("click", () => openTaskDialog());

    $("#documentForm").addEventListener("submit", (event) => {
      event.preventDefault();
      if (saveDocumentFromDialog()) $("#documentDialog").close();
    });
    $("#fileForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const ok = await saveFileFromDialog().catch((error) => {
        console.error(error);
        alert(`Could not save file: ${error.message}`);
        return false;
      });
      if (ok) $("#fileDialog").close();
    });
    $("#deviceForm").addEventListener("submit", (event) => {
      event.preventDefault();
      if (saveDeviceFromDialog()) $("#deviceDialog").close();
    });
    $("#projectForm").addEventListener("submit", (event) => {
      event.preventDefault();
      if (saveProjectFromDialog()) $("#projectDialog").close();
    });
    $("#ruleForm").addEventListener("submit", (event) => {
      event.preventDefault();
      if (saveRuleFromDialog()) $("#ruleDialog").close();
    });
    $("#appForm").addEventListener("submit", (event) => {
      event.preventDefault();
      if (saveAppFromDialog()) $("#appDialog").close();
    });
    $("#envForm").addEventListener("submit", (event) => {
      event.preventDefault();
      if (saveEnvFromDialog()) $("#envDialog").close();
    });
    $("#contactForm").addEventListener("submit", (event) => {
      event.preventDefault();
      if (saveContactFromDialog()) $("#contactDialog").close();
    });
    $("#noteForm").addEventListener("submit", (event) => {
      event.preventDefault();
      if (saveNoteFromDialog()) $("#noteDialog").close();
    });
    $("#taskForm").addEventListener("submit", (event) => {
      event.preventDefault();
      if (saveTaskFromDialog()) $("#taskDialog").close();
    });

    $("#btnCopyNetlify").addEventListener("click", () => copyText($("#envExportNetlify").value, "Netlify block copied."));
    $("#btnCopyDotenv").addEventListener("click", () => copyText($("#envExportDotenv").value, ".env block copied."));

    $("#btnQuickBackup").addEventListener("click", () => state.unlocked && createManualBackup().catch(console.error));
    $("#btnCreateBackup").addEventListener("click", () => state.unlocked && createManualBackup().catch(console.error));
    $("#btnExportBundle").addEventListener("click", () => state.unlocked && exportRecoveryBundle().catch(console.error));
    $("#btnBundleExport").addEventListener("click", () => state.unlocked && exportRecoveryBundle().catch(console.error));
    $("#btnImportTrigger").addEventListener("click", () => $("#fileImport").click());
    $("#btnBundleImport").addEventListener("click", () => $("#fileImport").click());
    $("#fileImport").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) importBundle(file).catch(console.error);
      event.target.value = "";
    });
    $("#btnVerifyAllBackups").addEventListener("click", () => state.unlocked && verifyLatestBackup().catch(console.error));

    $("#btnRefreshHealth").addEventListener("click", () => refreshStorageEstimate().then(renderDashboard).catch(console.error));
    $("#btnClearAudit").addEventListener("click", async () => {
      if (!confirm("Clear the local audit log?")) return;
      state.data.audit = [];
      await persistData({ snapshot: false });
      renderAudit();
      renderDashboard();
    });

    $("#btnSeedFounderKit").addEventListener("click", () => state.unlocked && seedFounderKit().catch(console.error));
    $("#btnSeedFounderKitSettings").addEventListener("click", () => state.unlocked && seedFounderKit().catch(console.error));
    $("#btnFounderEmergencyBackup").addEventListener("click", () => state.unlocked && exportRecoveryBundle().catch(console.error));

    const openTour = () => openTutorial(currentTutorialStartIndex());
    $("#btnTutorial").addEventListener("click", openTour);
    $("#btnTutorialHero").addEventListener("click", openTour);
    $("#btnTutorialStart").addEventListener("click", openTour);
    $("#btnTutorialReplay").addEventListener("click", openTour);
    $("#btnTutorialClose").addEventListener("click", () => closeTutorial().catch(console.error));
    $("#btnTutorialPrev").addEventListener("click", () => previousTutorialStep().catch(console.error));
    $("#btnTutorialNext").addEventListener("click", () => nextTutorialStep().catch(console.error));
    $("#tutorialDialog").addEventListener("close", () => {
      if (!state.unlocked) return;
      saveTutorialPrefs().catch(console.error);
    });

    $("#btnUploadBg").addEventListener("click", () => $("#bgUpload").click());
    $("#bgUpload").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) handleBackgroundUpload(file).catch(console.error);
      event.target.value = "";
    });
    $("#btnResetBg").addEventListener("click", resetBackground);
    $("#btnSaveSettings").addEventListener("click", () => state.unlocked && saveSettings().catch(console.error));

    $("#btnBrokerTest").addEventListener("click", testBroker);
    $("#btnMintToken").addEventListener("click", mintToken);
    $("#btnDeployRules").addEventListener("click", deployRules);

    $("#btnExportContactsCsv").addEventListener("click", exportContactsCsv);
    $("#btnExportTasksCsv").addEventListener("click", exportTasksCsv);

    window.addEventListener("online", updateConnectivityBadge);
    window.addEventListener("offline", updateConnectivityBadge);

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      state.installEvent = event;
      $("#btnInstall").classList.remove("hidden");
    });
    $("#btnInstall").addEventListener("click", async () => {
      if (!state.installEvent) return;
      state.installEvent.prompt();
      await state.installEvent.userChoice.catch(noop);
      state.installEvent = null;
      $("#btnInstall").classList.add("hidden");
    });
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (error) {
      console.error("service worker registration failed", error);
    }
  }

  async function boot() {
    state.db = await openDB();
    applyAppearance();
    await bindStaticEvents();
    await registerServiceWorker();
    updateConnectivityBadge();
    showUnlock();
  }

  boot().catch((error) => {
    console.error(error);
    alert(`SkyePortal failed to boot: ${error.message}`);
  });
})();
