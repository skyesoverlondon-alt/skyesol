const API_BASE = "/.netlify/functions";

function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

function setStatus(el, msg, kind=""){
  if(!el) return;
  el.textContent = msg || "";
  el.style.color = kind === "danger" ? "var(--danger)"
    : kind === "ok" ? "var(--ok)"
    : "var(--muted)";
}

function getToken(){ return localStorage.getItem("SMV_TOKEN") || ""; }
function setToken(t){ localStorage.setItem("SMV_TOKEN", t); }
function clearToken(){ localStorage.removeItem("SMV_TOKEN"); }

function getHandle(){ return localStorage.getItem("SMV_HANDLE") || ""; }
function setHandle(h){ localStorage.setItem("SMV_HANDLE", h); }

async function apiFetch(path, opts = {}){
  const headers = Object.assign({ "Content-Type":"application/json" }, opts.headers || {});
  const token = getToken();
  if(token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(API_BASE + path, Object.assign({}, opts, { headers }));
  const text = await res.text();
  let data = null;
  try{
    data = text ? JSON.parse(text) : null;
  }catch(e){
    // Helpful hint when Functions aren't actually deployed (common when using static-only deploy methods).
    const looksHtml = /<\s*!doctype\s+html/i.test(text || "");
    const hint = (res.status === 404 && looksHtml)
      ? "Server functions not found. This app requires Netlify Functions (deploy as a Netlify site with Functions, not a static-only drop)."
      : "Non-JSON response";
    data = { error: hint, raw: text };
  }

  if(!res.ok){
    const err = new Error((data && data.error) ? data.error : ("HTTP " + res.status));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function fmtDate(iso){
  try{
    const d = new Date(iso);
    return d.toLocaleString(undefined, { year:"numeric", month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit" });
  }catch(e){ return iso; }
}

function requireAuthOrRedirect(){
  const token = getToken();
  if(!token){
    location.href = "/login.html";
    return false;
  }
  return true;
}

function logout(){
  clearToken();
  location.href = "/";
}

function safe(s){ return (s || "").replace(/[<>&"]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[c])); }



// --- Client-side Search Index (local-only) ---
// Stores decrypted subjects/snippets locally so the user can search without server plaintext.
(function(){
  const KEY = "smv_search_index_v1";
  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }
  function save(arr){
    try{
      localStorage.setItem(KEY, JSON.stringify(arr.slice(0, 2000)));
    }catch(e){}
  }
  function upsert(item){
    const arr = load();
    const i = arr.findIndex(x => x.id === item.id);
    if(i >= 0) arr[i] = { ...arr[i], ...item };
    else arr.unshift(item);
    // de-dupe + keep newest first by created_at if present
    const seen = new Set();
    const out = [];
    for(const x of arr){
      if(!x || !x.id || seen.has(x.id)) continue;
      seen.add(x.id); out.push(x);
    }
    save(out);
  }
  function search(q){
    q = String(q || "").trim().toLowerCase();
    if(!q) return load();
    const arr = load();
    return arr.filter(x => {
      const hay = `${x.subject||""} ${x.snippet||""} ${x.from_email||""} ${x.from_name||""}`.toLowerCase();
      return hay.includes(q);
    });
  }
  function clear(){ try{ localStorage.removeItem(KEY); }catch(e){} }
  window.SMVSearchIndex = { load, upsert, search, clear };
})();
