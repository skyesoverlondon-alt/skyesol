/* ══════════════════════════════════════════════
   Growth Platform JS
   - Blog rendering
   - Portal status dashboard
   - Gated Vault + Admin console helpers
   
   Designed to work even if Functions are not deployed:
   - Public pages render “read-only mode” with friendly messaging.
   ══════════════════════════════════════════════ */

(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const state = {
    apiBase: '/.netlify/functions',
    identityReady: false,
    user: null,
  };

  const staticPosts = [
    {
      slug: 'sol-ops-field-brief',
      title: 'Sol Ops Field Brief: Gateways & Command Bridges',
      excerpt: 'A static dispatch from Skyes Over London LC about the procedural safeguards that let our operators move fast and stay grounded.',
      published_at: '2026-02-24T09:00:00.000Z',
      tags: ['Operations', 'Command', 'Field Notes'],
      cover_image: 'https://cdn1.sharemyimage.com/2026/02/16/blog-fieldops.png',
      staticUrl: 'Blogs/sol-ops-field-brief.html',
    }
  ];

  function esc(s){
    return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function fmtDate(iso){
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' });
    } catch { return iso || ''; }
  }

  async function jsonFetch(url, opts={}){
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        ...(opts.headers || {})
      },
      ...opts,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) ? (data.error || data.message) : `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function miniMarkdown(md){
    // Safe-ish markdown subset: headings, bold/italics, code, links, lists, paragraphs.
    // We intentionally do NOT support raw HTML.
    const lines = String(md || '').split(/\r?\n/);
    const out = [];
    let inCode = false;
    let listOpen = false;

    function closeList(){
      if (listOpen) { out.push('</ul>'); listOpen = false; }
    }

    for (let i=0;i<lines.length;i++){
      let line = lines[i];

      if (line.trim().startsWith('```')){
        closeList();
        inCode = !inCode;
        out.push(inCode ? '<pre class="md-code"><code>' : '</code></pre>');
        continue;
      }

      if (inCode){
        out.push(esc(line) + '\n');
        continue;
      }

      // headings
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h){
        closeList();
        const lvl = h[1].length;
        out.push(`<h${lvl} class="md-h${lvl}">${inlineMd(h[2])}</h${lvl}>`);
        continue;
      }

      // list
      const li = line.match(/^\s*[-*]\s+(.*)$/);
      if (li){
        if (!listOpen){ out.push('<ul class="md-ul">'); listOpen = true; }
        out.push(`<li>${inlineMd(li[1])}</li>`);
        continue;
      }

      // blank line
      if (!line.trim()){
        closeList();
        out.push('<div class="md-spacer"></div>');
        continue;
      }

      closeList();
      out.push(`<p class="md-p">${inlineMd(line)}</p>`);
    }

    closeList();
    return out.join('\n');

    function inlineMd(text){
      let t = esc(text);
      // code
      t = t.replace(/`([^`]+)`/g, (_, c) => `<code class="md-inline">${esc(c)}</code>`);
      // bold
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      // italics
      t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      // links [text](url)
      t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      return t;
    }
  }

  // ─────────────────────────────────────────────
  // Identity helpers (optional)
  // ─────────────────────────────────────────────
  function initIdentity(){
    if (!window.netlifyIdentity) return;
    state.identityReady = true;
    try {
      state.user = window.netlifyIdentity.currentUser();
    } catch {}

    window.netlifyIdentity.on('login', user => {
      state.user = user;
      refreshAuthUI();
    });
    window.netlifyIdentity.on('logout', () => {
      state.user = null;
      refreshAuthUI();
    });
    refreshAuthUI();
  }

  async function getToken(){
    if (!state.user) return null;
    const token = await state.user.jwt(true);
    return token;
  }

  function refreshAuthUI(){
    const el = $('#authBadge');
    if (!el) return;
    if (!state.identityReady) {
      el.innerHTML = '<span class="auth-pill">Auth: Off</span>';
      return;
    }
    if (!state.user){
      el.innerHTML = '<button class="btn-outline btn-sm" id="btnLogin">Login</button>';
      const b = $('#btnLogin');
      if (b) b.addEventListener('click', () => window.netlifyIdentity.open('login'));
      return;
    }
    const email = (state.user.email || '').trim();
    el.innerHTML = `<span class="auth-pill">${esc(email || 'Signed in')}</span><button class="btn-outline btn-sm" id="btnLogout">Logout</button>`;
    const b = $('#btnLogout');
    if (b) b.addEventListener('click', () => window.netlifyIdentity.logout());
  }

  // ─────────────────────────────────────────────
  // Blog (public)
  // ─────────────────────────────────────────────
  async function renderBlogList(){
    const mount = $('#blogList');
    if (!mount) return;

    const search = $('#blogSearch');
    const tagSelect = $('#blogTag');
    const notice = $('#blogNotice');

      let posts = [];
    let mode = 'api';
    try {
      const data = await jsonFetch(`${state.apiBase}/blog-list`);
      posts = Array.isArray(data.posts) ? data.posts : [];
    } catch (e){
      mode = 'readonly';
      // fall back to a tiny baked-in seed so the page never looks broken
      posts = [
        {
          slug: 'welcome',
          title: 'Field Notes: Welcome to the SOL Growth Platform',
          excerpt: 'This blog is live. Publishing and gated vault features activate when Netlify Functions + Blobs are deployed.',
          published_at: new Date().toISOString(),
          tags: ['Ops', 'Platform'],
          cover_image: null,
        }
      ];
      if (notice) {
        notice.style.display = 'block';
        notice.innerHTML = 'Blog is running in <strong>read-only mode</strong> (Functions not detected). Deploy with Netlify CLI to enable CMS publishing.';
      }
    }

    const merged = staticPosts.filter(sp => !posts.some(p => p.slug === sp.slug));
    posts = [...merged, ...posts];
    const allTags = new Set();
    posts.forEach(p => (p.tags || []).forEach(t => allTags.add(t)));
    if (tagSelect) {
      const existing = new Set($$('option', tagSelect).map(o => o.value));
      [...allTags].sort().forEach(t => {
        if (existing.has(t)) return;
        const opt = document.createElement('option');
        opt.value = t; opt.textContent = t;
        tagSelect.appendChild(opt);
      });
    }

    function applyFilters(){
      const q = (search?.value || '').trim().toLowerCase();
      const tag = (tagSelect?.value || '').trim();
      const filtered = posts.filter(p => {
        const hay = `${p.title||''} ${p.excerpt||''} ${(p.tags||[]).join(' ')}`.toLowerCase();
        const okQ = !q || hay.includes(q);
        const okT = !tag || (p.tags||[]).includes(tag);
        return okQ && okT;
      }).sort((a,b) => new Date(b.published_at||0) - new Date(a.published_at||0));
      mount.innerHTML = filtered.map(p => blogCard(p)).join('') || '<div class="empty-state">No posts match your filters.</div>';
    }

    if (search) search.addEventListener('input', applyFilters);
    if (tagSelect) tagSelect.addEventListener('change', applyFilters);

    applyFilters();

    function blogCard(p){
      const img = p.cover_image ? `<div class="blog-cover"><img src="${esc(p.cover_image)}" alt="${esc(p.title)}" loading="lazy"></div>` : '';
      const tags = (p.tags||[]).slice(0,4).map(t => `<span class="chip">${esc(t)}</span>`).join('');
      const href = p.staticUrl ? p.staticUrl : (mode === 'readonly' && p.slug === 'welcome' ? 'post.html?s=welcome&local=1' : `post.html?s=${encodeURIComponent(p.slug)}`);
      return `
        <article class="blog-card reveal">
          ${img}
          <div class="blog-body">
            <div class="blog-meta">${esc(fmtDate(p.published_at))}</div>
            <h3>${esc(p.title || '')}</h3>
            <p>${esc(p.excerpt || '')}</p>
            <div class="chip-row">${tags}</div>
            <a class="card-link" href="${href}">Read →</a>
          </div>
        </article>
      `;
    }
  }

  async function renderBlogPost(){
    const mount = $('#postMount');
    if (!mount) return;
    const params = new URLSearchParams(location.search);
    const slug = params.get('s') || '';
    const local = params.get('local') === '1';
    const notice = $('#postNotice');

    if (!slug){
      mount.innerHTML = '<div class="empty-state">Missing post slug.</div>';
      return;
    }

    let post = null;
    try {
      if (local && slug === 'welcome') {
        post = {
          title: 'Field Notes: Welcome to the SOL Growth Platform',
          published_at: new Date().toISOString(),
          author: 'Skyes Over London LC',
          content_md: [
            '## What you are looking at',
            '',
            'This site now supports:',
            '- Blog publishing (CMS) backed by Netlify Blobs',
            '- Gated Client Vault content (Identity + Functions)',
            '- Portal Status + Monitoring dashboard',
            '',
            'Right now you are viewing a built-in fallback post because Functions were not detected during load.',
            '',
            '## Turn on the “real” platform',
            '',
            'Deploy with Netlify CLI (no Git required), enable Netlify Identity, and set your admin emails.',
            '',
            'Once that is done, open **Admin** to publish posts and manage portals.'
          ].join('\n'),
          tags: ['Ops','Platform']
        };
      } else {
        const data = await jsonFetch(`${state.apiBase}/blog-get?slug=${encodeURIComponent(slug)}`);
        post = data.post;
      }
    } catch (e){
      if (notice) {
        notice.style.display = 'block';
        notice.innerHTML = 'This post could not be loaded. If you expected it to exist, deploy Functions (Netlify CLI/Git).';
      }
      mount.innerHTML = '<div class="empty-state">Post unavailable.</div>';
      return;
    }

    $('#postTitle') && ($('#postTitle').textContent = post.title || '');
    $('#postMeta') && ($('#postMeta').textContent = `${fmtDate(post.published_at)} · ${post.author || 'Skyes Over London LC'}`);

    mount.innerHTML = miniMarkdown(post.content_md || '');
  }

  // ─────────────────────────────────────────────
  // Status (public) + Dashboard (gated-ish)
  // ─────────────────────────────────────────────
  async function renderStatus(){
    const mount = $('#statusMount');
    if (!mount) return;
    const notice = $('#statusNotice');

    mount.innerHTML = '<div class="loading">Checking portals…</div>';
    try {
      const data = await jsonFetch(`${state.apiBase}/portal-status`);
      const rows = (data.results || []).map(r => {
        const ok = r.ok ? 'ok' : 'bad';
        const badge = r.ok ? 'OK' : (r.status ? `HTTP ${r.status}` : 'DOWN');
        const ms = (typeof r.ms === 'number') ? `${Math.round(r.ms)} ms` : '—';
        const err = r.error ? `<div class="small-dim">${esc(r.error)}</div>` : '';
        return `
          <div class="status-row ${ok}">
            <div>
              <div class="status-name">${esc(r.name || r.url)}</div>
              <div class="status-url">${esc(r.url)}</div>
              ${err}
            </div>
            <div class="status-right">
              <span class="status-badge ${ok}">${esc(badge)}</span>
              <div class="status-ms">${esc(ms)}</div>
              <a class="status-link" href="${esc(r.url)}" target="_blank" rel="noopener">Open →</a>
            </div>
          </div>
        `;
      }).join('');

      const at = data.checked_at ? fmtDate(data.checked_at) + ' ' + new Date(data.checked_at).toLocaleTimeString() : '';
      $('#statusAt') && ($('#statusAt').textContent = at ? `Last check: ${at}` : '');
      mount.innerHTML = rows || '<div class="empty-state">No portals configured yet.</div>';
    } catch (e){
      if (notice) {
        notice.style.display = 'block';
        notice.innerHTML = 'Status is in <strong>read-only mode</strong>. Deploy Functions (Netlify CLI/Git) to enable live checks.';
      }
      mount.innerHTML = '<div class="empty-state">Live status unavailable.</div>';
    }
  }

  async function renderDashboard(){
    const mount = $('#dashMount');
    if (!mount) return;
    const notice = $('#dashNotice');
    mount.innerHTML = '<div class="loading">Loading dashboard…</div>';

    try {
      const data = await jsonFetch(`${state.apiBase}/portal-status`);
      const up = (data.results||[]).filter(r=>r.ok).length;
      const total = (data.results||[]).length;
      $('#dashKpi') && ($('#dashKpi').textContent = total ? `${up}/${total} UP` : '—');
      mount.innerHTML = (data.results||[]).map(r => {
        const ok = r.ok ? 'ok' : 'bad';
        const ms = (typeof r.ms === 'number') ? `${Math.round(r.ms)} ms` : '—';
        return `
          <div class="dash-card ${ok}">
            <div class="dash-title">${esc(r.name || r.url)}</div>
            <div class="dash-sub">${esc(r.url)}</div>
            <div class="dash-metrics">
              <div class="dash-metric"><span class="k">Status</span><span class="v">${r.ok ? 'OK' : (r.status ? `HTTP ${r.status}` : 'DOWN')}</span></div>
              <div class="dash-metric"><span class="k">Latency</span><span class="v">${esc(ms)}</span></div>
            </div>
          </div>
        `;
      }).join('') || '<div class="empty-state">No portals configured.</div>';

    } catch (e){
      if (notice) {
        notice.style.display = 'block';
        notice.innerHTML = 'Dashboard needs Functions + a portal list. Deploy with Netlify CLI and configure portals in Admin.';
      }
      mount.innerHTML = '<div class="empty-state">Dashboard unavailable.</div>';
    }
  }

  // ─────────────────────────────────────────────
  // Admin console
  // ─────────────────────────────────────────────
  async function initAdmin(){
    const root = $('#adminApp');
    if (!root) return;

    const gate = $('#adminGate');
    const app = $('#adminMain');
    const msg = $('#adminMsg');

    async function ensure(){
      if (!state.identityReady) {
        gate.style.display = 'block';
        app.style.display = 'none';
        msg.innerHTML = 'Netlify Identity is not enabled yet. Enable it in your Netlify site settings to use Admin.';
        return;
      }

      const u = window.netlifyIdentity.currentUser();
      if (!u){
        gate.style.display = 'block';
        app.style.display = 'none';
        msg.innerHTML = 'Sign in to manage blog posts, vault content, and portal monitoring.';
        return;
      }

      // Check admin permissions by calling the server
      try {
        const token = await getToken();
        await jsonFetch(`${state.apiBase}/admin-whoami`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        gate.style.display = 'none';
        app.style.display = 'block';
        await renderAdminPosts();
        await renderAdminPortals();
        await renderAdminVault();
      } catch (e){
        gate.style.display = 'block';
        app.style.display = 'none';
        msg.innerHTML = `Access denied. Your account is not an admin for this site.`;
      }
    }

    $('#adminLogin')?.addEventListener('click', () => window.netlifyIdentity.open('login'));
    $('#adminLogout')?.addEventListener('click', () => window.netlifyIdentity.logout());
    window.netlifyIdentity.on('login', ensure);
    window.netlifyIdentity.on('logout', ensure);

    // Tabs
    $$('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');
      $$('.tab-panel').forEach(p => p.style.display = (p.getAttribute('data-tab') === tab ? 'block' : 'none'));
    }));

    // Blog editor
    $('#postSave')?.addEventListener('click', async () => {
      const token = await getToken();
      const post = collectPostForm();
      await jsonFetch(`${state.apiBase}/blog-upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ post })
      });
      toast('Saved post.');
      clearPostForm();
      await renderAdminPosts();
    });
    $('#postDelete')?.addEventListener('click', async () => {
      const slug = ($('#postSlug')?.value || '').trim();
      if (!slug) return toast('No slug selected.', true);
      const token = await getToken();
      await jsonFetch(`${state.apiBase}/blog-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ slug })
      });
      toast('Deleted post.');
      clearPostForm();
      await renderAdminPosts();
    });
    $('#postNew')?.addEventListener('click', () => { clearPostForm(); toast('New draft ready.'); });

    // Portal editor
    $('#portalSave')?.addEventListener('click', async () => {
      const token = await getToken();
      const portal = collectPortalForm();
      await jsonFetch(`${state.apiBase}/portals-upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ portal })
      });
      toast('Saved portal.');
      clearPortalForm();
      await renderAdminPortals();
    });
    $('#portalDelete')?.addEventListener('click', async () => {
      const id = ($('#portalId')?.value || '').trim();
      if (!id) return toast('No portal selected.', true);
      const token = await getToken();
      await jsonFetch(`${state.apiBase}/portals-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id })
      });
      toast('Deleted portal.');
      clearPortalForm();
      await renderAdminPortals();
    });
    $('#portalNew')?.addEventListener('click', () => { clearPortalForm(); toast('New portal ready.'); });

    // Vault editor
    $('#vaultSave')?.addEventListener('click', async () => {
      const token = await getToken();
      const doc = collectVaultForm();
      await jsonFetch(`${state.apiBase}/vault-upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ doc })
      });
      toast('Saved vault document.');
      clearVaultForm();
      await renderAdminVault();
    });
    $('#vaultDelete')?.addEventListener('click', async () => {
      const id = ($('#vaultId')?.value || '').trim();
      if (!id) return toast('No document selected.', true);
      const token = await getToken();
      await jsonFetch(`${state.apiBase}/vault-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id })
      });
      toast('Deleted vault document.');
      clearVaultForm();
      await renderAdminVault();
    });
    $('#vaultNew')?.addEventListener('click', () => { clearVaultForm(); toast('New vault document ready.'); });

    // Monitoring
    $('#runCheck')?.addEventListener('click', async () => {
      const data = await jsonFetch(`${state.apiBase}/portal-status?refresh=1`);
      const up = (data.results||[]).filter(r=>r.ok).length;
      const total = (data.results||[]).length;
      $('#monKpi') && ($('#monKpi').textContent = total ? `${up}/${total} UP` : '—');
      $('#monOut') && ($('#monOut').innerHTML = (data.results||[]).map(r => {
        const ok = r.ok ? 'ok' : 'bad';
        const ms = (typeof r.ms === 'number') ? `${Math.round(r.ms)} ms` : '—';
        return `<div class="mon-row ${ok}"><span>${esc(r.name || r.url)}</span><span class="right">${r.ok ? 'OK' : (r.status ? `HTTP ${r.status}` : 'DOWN')} · ${esc(ms)}</span></div>`;
      }).join('') || '<div class="empty-state">No portals configured.</div>');
    });

    await ensure();

    function collectPostForm(){
      const slugRaw = ($('#postSlug')?.value || '').trim();
      const title = ($('#postTitleIn')?.value || '').trim();
      const slug = slugRaw || slugify(title || `post-${Date.now()}`);
      return {
        slug,
        title,
        excerpt: ($('#postExcerpt')?.value || '').trim(),
        cover_image: ($('#postCover')?.value || '').trim() || null,
        tags: ($('#postTags')?.value || '').split(',').map(s=>s.trim()).filter(Boolean),
        status: ($('#postStatus')?.value || 'draft').trim(),
        content_md: ($('#postBody')?.value || '').trim(),
      };
    }
    function clearPostForm(){
      ['postSlug','postTitleIn','postExcerpt','postCover','postTags','postBody'].forEach(id => { const el = $('#'+id); if (el) el.value=''; });
      $('#postStatus') && ($('#postStatus').value='draft');
    }

    function collectPortalForm(){
      const idRaw = ($('#portalId')?.value || '').trim();
      const name = ($('#portalName')?.value || '').trim();
      const id = idRaw || slugify(name || `portal-${Date.now()}`);
      const url = ($('#portalUrl')?.value || '').trim();
      const path = ($('#portalPath')?.value || '').trim() || '/';
      return {
        id,
        name,
        url,
        path,
        category: ($('#portalCategory')?.value || '').trim() || null,
        public: ($('#portalPublic')?.checked) ? true : false,
        notes: ($('#portalNotes')?.value || '').trim() || null,
      };
    }
    function clearPortalForm(){
      ['portalId','portalName','portalUrl','portalPath','portalCategory','portalNotes'].forEach(id => { const el = $('#'+id); if (el) el.value=''; });
      $('#portalPublic') && ($('#portalPublic').checked = true);
    }

    function collectVaultForm(){
      const idRaw = ($('#vaultId')?.value || '').trim();
      const title = ($('#vaultTitle')?.value || '').trim();
      const id = idRaw || slugify(title || `doc-${Date.now()}`);
      return {
        id,
        title,
        audience: ($('#vaultAudience')?.value || 'clients').trim(),
        tags: ($('#vaultTags')?.value || '').split(',').map(s=>s.trim()).filter(Boolean),
        content_md: ($('#vaultBody')?.value || '').trim(),
      };
    }
    function clearVaultForm(){
      ['vaultId','vaultTitle','vaultTags','vaultBody'].forEach(id => { const el = $('#'+id); if (el) el.value=''; });
      $('#vaultAudience') && ($('#vaultAudience').value='clients');
    }

    async function renderAdminPosts(){
      const token = await getToken();
      const data = await jsonFetch(`${state.apiBase}/blog-list?status=all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const list = $('#adminPostList');
      if (!list) return;
      list.innerHTML = (data.posts||[]).sort((a,b)=>new Date(b.published_at||0)-new Date(a.published_at||0)).map(p => {
        const s = p.status === 'published' ? 'pub' : 'draft';
        return `<button class="list-item" data-slug="${esc(p.slug)}"><span class="pill ${s}">${esc(p.status||'draft')}</span> ${esc(p.title||p.slug)} <span class="dim">· ${esc(fmtDate(p.published_at))}</span></button>`;
      }).join('') || '<div class="empty-state">No posts yet.</div>';

      $$('.list-item', list).forEach(btn => btn.addEventListener('click', async () => {
        const slug = btn.getAttribute('data-slug');
        const postData = await jsonFetch(`${state.apiBase}/blog-get?slug=${encodeURIComponent(slug)}&status=all`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const p = postData.post;
        $('#postSlug').value = p.slug || '';
        $('#postTitleIn').value = p.title || '';
        $('#postExcerpt').value = p.excerpt || '';
        $('#postCover').value = p.cover_image || '';
        $('#postTags').value = (p.tags||[]).join(', ');
        $('#postStatus').value = p.status || 'draft';
        $('#postBody').value = p.content_md || '';
        toast('Loaded post.');
      }));
    }

    async function renderAdminPortals(){
      const token = await getToken();
      const data = await jsonFetch(`${state.apiBase}/portals-list?scope=all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const list = $('#adminPortalList');
      if (!list) return;
      list.innerHTML = (data.portals||[]).map(p => {
        const s = p.public ? 'pub' : 'draft';
        return `<button class="list-item" data-id="${esc(p.id)}"><span class="pill ${s}">${p.public ? 'public' : 'private'}</span> ${esc(p.name||p.id)} <span class="dim">· ${esc(p.url||'')}</span></button>`;
      }).join('') || '<div class="empty-state">No portals configured.</div>';

      $$('.list-item', list).forEach(btn => btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const p = (data.portals||[]).find(x => x.id === id);
        if (!p) return;
        $('#portalId').value = p.id || '';
        $('#portalName').value = p.name || '';
        $('#portalUrl').value = p.url || '';
        $('#portalPath').value = p.path || '/';
        $('#portalCategory').value = p.category || '';
        $('#portalPublic').checked = !!p.public;
        $('#portalNotes').value = p.notes || '';
        toast('Loaded portal.');
      }));
    }

    async function renderAdminVault(){
      const token = await getToken();
      const data = await jsonFetch(`${state.apiBase}/vault-list?scope=all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const list = $('#adminVaultList');
      if (!list) return;
      list.innerHTML = (data.docs||[]).map(d => {
        return `<button class="list-item" data-id="${esc(d.id)}"><span class="pill pub">${esc(d.audience||'clients')}</span> ${esc(d.title||d.id)} <span class="dim">· ${(d.tags||[]).slice(0,2).map(esc).join(', ')}</span></button>`;
      }).join('') || '<div class="empty-state">No vault documents.</div>';

      $$('.list-item', list).forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const docData = await jsonFetch(`${state.apiBase}/vault-get?id=${encodeURIComponent(id)}&scope=all`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = docData.doc;
        $('#vaultId').value = d.id || '';
        $('#vaultTitle').value = d.title || '';
        $('#vaultAudience').value = d.audience || 'clients';
        $('#vaultTags').value = (d.tags||[]).join(', ');
        $('#vaultBody').value = d.content_md || '';
        toast('Loaded vault document.');
      }));
    }

    function slugify(s){
      return String(s||'')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g,'')
        .trim()
        .replace(/\s+/g,'-')
        .replace(/-+/g,'-')
        .slice(0,80) || `item-${Date.now()}`;
    }

    function toast(text, isErr=false){
      const t = $('#toast');
      if (!t) return;
      t.textContent = text;
      t.classList.toggle('err', !!isErr);
      t.classList.add('show');
      setTimeout(()=>t.classList.remove('show'), 2200);
    }
  }

  // ─────────────────────────────────────────────
  // Vault (client gated)
  // ─────────────────────────────────────────────
  async function initVault(){
    const mount = $('#vaultMount');
    if (!mount) return;

    const gate = $('#vaultGate');
    const list = $('#vaultList');
    const viewer = $('#vaultViewer');
    const msg = $('#vaultMsg');

    async function ensure(){
      if (!state.identityReady) {
        gate.style.display = 'block';
        mount.style.display = 'none';
        msg.innerHTML = 'Netlify Identity is not enabled yet. Enable it to use the Client Vault.';
        return;
      }

      const u = window.netlifyIdentity.currentUser();
      if (!u){
        gate.style.display = 'block';
        mount.style.display = 'none';
        msg.innerHTML = 'Sign in to access gated content.';
        return;
      }

      try {
        const token = await getToken();
        const data = await jsonFetch(`${state.apiBase}/vault-list`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        gate.style.display = 'none';
        mount.style.display = 'block';
        list.innerHTML = (data.docs||[]).map(d => `<button class="list-item" data-id="${esc(d.id)}">${esc(d.title || d.id)}</button>`).join('') || '<div class="empty-state">No documents yet.</div>';
        $$('.list-item', list).forEach(btn => btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const docData = await jsonFetch(`${state.apiBase}/vault-get?id=${encodeURIComponent(id)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const d = docData.doc;
          $('#vaultTitleOut') && ($('#vaultTitleOut').textContent = d.title || '');
          viewer.innerHTML = miniMarkdown(d.content_md || '');
        }));
      } catch (e){
        gate.style.display = 'block';
        mount.style.display = 'none';
        msg.innerHTML = 'Vault unavailable. Deploy Functions + Blobs and ensure your account is active.';
      }
    }

    $('#vaultLogin')?.addEventListener('click', () => window.netlifyIdentity.open('login'));
    $('#vaultLogout')?.addEventListener('click', () => window.netlifyIdentity.logout());
    window.netlifyIdentity.on('login', ensure);
    window.netlifyIdentity.on('logout', ensure);
    await ensure();
  }

  // ─────────────────────────────────────────────
  // Boot
  // ─────────────────────────────────────────────
  function boot(){
    // Identity script loads async; poll a little.
    const tries = 30;
    let n = 0;
    const t = setInterval(() => {
      n++;
      if (window.netlifyIdentity){
        clearInterval(t);
        initIdentity();
      }
      if (n >= tries) clearInterval(t);
    }, 120);

    renderBlogList();
    renderBlogPost();
    renderStatus();
    renderDashboard();
    initAdmin();
    initVault();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
