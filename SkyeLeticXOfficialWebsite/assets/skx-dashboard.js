
(function(){
  const IDENTITY_URL = 'https://identity.netlify.com/v1/netlify-identity-widget.js';
  function loadIdentity(){
    return new Promise((resolve)=>{
      if (window.netlifyIdentity) return resolve(window.netlifyIdentity);
      const existing = document.querySelector(`script[src="${IDENTITY_URL}"]`);
      if (existing) {
        existing.addEventListener('load', ()=>resolve(window.netlifyIdentity), { once:true });
        return;
      }
      const s = document.createElement('script');
      s.src = IDENTITY_URL;
      s.async = true;
      s.onload = ()=>resolve(window.netlifyIdentity);
      document.head.appendChild(s);
    });
  }
  function esc(v){return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function money(v){
    const n = Number(v || 0);
    return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
  }
  function shortDate(v){
    if(!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString();
  }
  async function currentUser(){
    const ident = await loadIdentity();
    return ident && ident.currentUser ? ident.currentUser() : null;
  }
  async function authToken(){
    const user = await currentUser();
    if (!user || !user.jwt) return null;
    try { return await user.jwt(); } catch { return null; }
  }
  async function api(action, options={}){
    const method = (options.method || (options.data ? 'POST' : 'GET')).toUpperCase();
    const url = method === 'GET'
      ? `/.netlify/functions/skx-portal?action=${encodeURIComponent(action)}${options.query ? '&'+options.query : ''}`
      : '/.netlify/functions/skx-portal';
    const headers = { 'Accept':'application/json' };
    const token = await authToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (method !== 'GET') headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method,
      headers,
      body: method === 'GET' ? undefined : JSON.stringify({ action, ...(options.data || {}) })
    });
    const data = await res.json().catch(()=>({ ok:false, error:'Invalid response' }));
    if (!res.ok || data.ok === false) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.data = data;
      throw err;
    }
    return data;
  }
  async function publicSubmit(action, payload){
    const res = await fetch('/.netlify/functions/skx-portal', {
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({ action, ...(payload || {}) })
    });
    const data = await res.json().catch(()=>({ ok:false, error:'Invalid response' }));
    if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }
  function setText(id, value){
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
  function setHTML(id, value){
    const el = document.getElementById(id);
    if (el) el.innerHTML = value;
  }
  function showNotice(targetId, message, type=''){
    const el = document.getElementById(targetId);
    if (!el) return;
    el.className = `notice ${type}`.trim();
    el.innerHTML = message;
  }
  function roleList(ctx){
    return Array.from(new Set([...(ctx?.roles || []), ...(ctx?.profileRole ? [ctx.profileRole] : [])].filter(Boolean)));
  }
  function hasRole(ctx, allowed=[]){
    const roles = roleList(ctx).map(v=>String(v).toLowerCase());
    if (!allowed || !allowed.length) return true;
    return allowed.map(v=>String(v).toLowerCase()).some(v => roles.includes(v));
  }
  async function boot(options={}){
    const { roles = [], authStateId='authState', gateId='authGate', summary=false } = options;
    await loadIdentity();
    const ident = window.netlifyIdentity;
    if (ident) {
      ident.on('login', () => location.reload());
      ident.on('logout', () => location.reload());
      const loginBtn = document.querySelectorAll('[data-auth="login"]');
      loginBtn.forEach(btn => btn.addEventListener('click', ()=>ident.open('login')));
      const logoutBtn = document.querySelectorAll('[data-auth="logout"]');
      logoutBtn.forEach(btn => btn.addEventListener('click', async ()=>{ try { await ident.logout(); } catch {} }));
    }
    const ctx = await api('bootstrap').catch(err => ({ ok:false, error: err.message }));
    if (!ctx.ok) {
      showNotice(authStateId, `${esc(ctx.error || 'Unable to load dashboard bootstrap.')}`, 'error');
      return { ok:false, authorized:false, roles:[] };
    }
    const authLabel = ctx.user ? `Signed in as ${esc(ctx.user.email)}${roleList(ctx).length ? ` • ${esc(roleList(ctx).join(', '))}` : ''}` : 'Not signed in';
    showNotice(authStateId, authLabel, ctx.user ? 'success' : '');
    const authorized = roles.length ? hasRole(ctx, roles) : true;
    const gate = document.getElementById(gateId);
    if (gate && !authorized) {
      gate.classList.add('active');
      gate.innerHTML = `<div class="notice error">This dashboard requires ${esc(roles.join(' / '))} access through Netlify Identity or a linked profile role in the league office.</div>`;
    }
    if (gate && authorized) gate.classList.remove('active');
    if (summary && ctx.summary) {
      setText('metricPlayers', ctx.summary.player_count || '0');
      setText('metricTeams', ctx.summary.team_count || '0');
      setText('metricCombines', ctx.summary.combine_count || '0');
      setText('metricOpenFees', money(ctx.summary.open_fees || 0));
    }
    return { ...ctx, authorized };
  }
  function tableHTML(rows, cols){
    if (!rows || !rows.length) return '<div class="empty">No records yet.</div>';
    const head = cols.map(c=>`<th>${esc(c.label)}</th>`).join('');
    const body = rows.map(row=>`<tr>${cols.map(c=>`<td>${typeof c.render === 'function' ? c.render(row) : esc(row[c.key] ?? '—')}</td>`).join('')}</tr>`).join('');
    return `<div class="table-wrap"><table class="table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  window.SKX = { loadIdentity, currentUser, authToken, api, publicSubmit, boot, money, shortDate, esc, tableHTML, showNotice, roleList, hasRole };
})();
