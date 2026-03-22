(async function(){
  const boot = await SMV.withBoot('drafts', 'Drafts', 'Saved hosted-mail drafts inside the SkyMail shell');
  if(!boot) return;
  const statusEl = qs('#statusText');
  const badgeEl = qs('#mailboxBadge');
  const listEl = qs('#draftList');
  const state = { nextPageToken:null, currentToken:null, prevStack:[] };
  function note(msg, kind=''){ setStatus(statusEl, msg, kind); }
  badgeEl.textContent = boot.status && boot.status.connected && boot.status.mailbox ? `Mailbox live • ${boot.status.mailbox.email}` : 'No hosted mailbox provisioned';

  function render(items){
    if(!items.length){ listEl.innerHTML = '<div class="empty">No drafts found in this mailbox.</div>'; return; }
    listEl.innerHTML = items.map((item)=>`
      <article class="mail">
        <div class="mail-main">
          <div class="mail-top">
            <div>
              <div class="mail-subject">${safe(item.subject || '(no subject)')}</div>
              <div class="mail-from">${safe(item.to || item.from || 'No recipient yet')}</div>
            </div>
            <div class="mini">${safe(fmtDate(item.internal_date || ''))}</div>
          </div>
          <div class="mail-snippet">${safe(item.snippet || '')}</div>
        </div>
        <div class="mail-actions">
          <a class="btn small gold" href="/compose.html?draft_id=${encodeURIComponent(item.draft_id)}">Open Draft</a>
          <button class="btn small danger" type="button" data-delete="${item.draft_id}">Delete</button>
        </div>
      </article>`).join('');
    document.querySelectorAll('[data-delete]').forEach((btn)=> btn.onclick = async ()=> {
      if(!confirm('Delete this draft permanently?')) return;
      try{ await apiFetch('/mail-draft-delete', { method:'POST', body: JSON.stringify({ id: btn.dataset.delete }) }); await refresh(); }
      catch(err){ note(err.message || 'Draft delete failed.', 'danger'); }
    });
  }
  async function load(token=null, pushHistory=false){
    if(!(boot.status && boot.status.connected)){ listEl.innerHTML = '<div class="empty">Create a hosted mailbox first.</div>'; return; }
    try{
      const q = encodeURIComponent(qs('#q').value.trim());
      const page = token ? `&pageToken=${encodeURIComponent(token)}` : '';
      const data = await apiFetch(`/mail-drafts-list?max=20&q=${q}${page}`);
      if(pushHistory) state.prevStack.push(state.currentToken);
      state.currentToken = token;
      state.nextPageToken = data.nextPageToken || null;
      render(data.items || []);
      note(`Loaded ${data.items?.length || 0} draft(s).`, 'ok');
    }catch(err){ listEl.innerHTML = '<div class="empty">Draft load failed.</div>'; note(err.message || 'Draft load failed.', 'danger'); }
  }
  async function refresh(){ state.prevStack=[]; state.currentToken=null; state.nextPageToken=null; await load(null, false); }
  qs('#applyBtn').onclick = refresh;
  qs('#clearBtn').onclick = ()=> { qs('#q').value=''; refresh(); };
  qs('#refreshBtn').onclick = refresh;
  qs('#nextBtn').onclick = ()=> state.nextPageToken ? load(state.nextPageToken, true) : null;
  qs('#prevBtn').onclick = ()=> state.prevStack.length ? load(state.prevStack.pop() || null, false) : note('No previous page in this session.');
  await refresh();
})();
