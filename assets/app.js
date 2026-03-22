// Shared client script shim.
// Keep the root asset safe for the main site while exposing the helper surface
// expected by the nested SkyMail app when it mounts from root aliases.

const API_BASE = window.API_BASE || "/.netlify/functions";
window.API_BASE = API_BASE;

function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

function setStatus(el, msg, kind = "") {
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = kind === "danger"
    ? "var(--danger)"
    : kind === "ok"
      ? "var(--ok)"
      : "var(--muted)";
}

function getToken() { return localStorage.getItem("SMV_TOKEN") || ""; }
function setToken(token) { localStorage.setItem("SMV_TOKEN", token); }
function clearToken() { localStorage.removeItem("SMV_TOKEN"); }

function getHandle() { return localStorage.getItem("SMV_HANDLE") || ""; }
function setHandle(handle) { localStorage.setItem("SMV_HANDLE", handle); }

async function apiFetch(route, opts = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
  const token = getToken();
  if (token) headers.Authorization = "Bearer " + token;

  const res = await fetch(API_BASE + route, Object.assign({}, opts, { headers }));
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    const looksHtml = /<\s*!doctype\s+html/i.test(text || "");
    const hint = (res.status === 404 && looksHtml)
      ? "Server functions not found. This app requires Netlify Functions."
      : "Non-JSON response";
    data = { error: hint, raw: text };
  }

  if (!res.ok) {
    const err = new Error((data && data.error) ? data.error : ("HTTP " + res.status));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function requireAuthOrRedirect() {
  const token = getToken();
  if (!token) {
    location.href = "/login.html";
    return false;
  }
  return true;
}

function logout() {
  clearToken();
  location.href = "/";
}

function safe(value) {
  return String(value || "").replace(/[<>&"]/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
  })[char]);
}

window.qs = window.qs || qs;
window.qsa = window.qsa || qsa;
window.setStatus = window.setStatus || setStatus;
window.getToken = window.getToken || getToken;
window.setToken = window.setToken || setToken;
window.clearToken = window.clearToken || clearToken;
window.getHandle = window.getHandle || getHandle;
window.setHandle = window.setHandle || setHandle;
window.apiFetch = window.apiFetch || apiFetch;
window.fmtDate = window.fmtDate || fmtDate;
window.requireAuthOrRedirect = window.requireAuthOrRedirect || requireAuthOrRedirect;
window.logout = window.logout || logout;
window.safe = window.safe || safe;

(function () {
  const KEY = "smv_search_index_v1";

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function save(arr) {
    try {
      localStorage.setItem(KEY, JSON.stringify(arr.slice(0, 2000)));
    } catch {
      // no-op
    }
  }

  function upsert(item) {
    const arr = load();
    const index = arr.findIndex((entry) => entry.id === item.id);
    if (index >= 0) arr[index] = { ...arr[index], ...item };
    else arr.unshift(item);

    const seen = new Set();
    const out = [];
    for (const entry of arr) {
      if (!entry || !entry.id || seen.has(entry.id)) continue;
      seen.add(entry.id);
      out.push(entry);
    }
    save(out);
  }

  function search(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return load();
    return load().filter((entry) => {
      const haystack = `${entry.subject || ""} ${entry.snippet || ""} ${entry.from_email || ""} ${entry.from_name || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }

  function clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // no-op
    }
  }

  window.SMVSearchIndex = window.SMVSearchIndex || { load, upsert, search, clear };
  window.SOL_ASSETS_APP = window.SOL_ASSETS_APP || { loaded: true };
})();
