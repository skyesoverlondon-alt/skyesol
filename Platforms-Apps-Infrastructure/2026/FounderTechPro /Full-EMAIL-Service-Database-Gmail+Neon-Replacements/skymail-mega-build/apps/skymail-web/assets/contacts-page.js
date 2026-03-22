(async function(){
  const boot = await SMV.withBoot('contacts', 'Contacts', 'Address book and recent correspondents');
  if(!boot) return;
  const statusEl = qs('#statusText');
  const savedEl = qs('#savedContacts');
  const recentEl = qs('#recentContacts');
  let currentSaved = [];
  let syncInfo = null;

  function note(msg, kind=''){ setStatus(statusEl, msg, kind); }
  function formReset(){ qs('#contact_id').value=''; qs('#email').value=''; qs('#full_name').value=''; qs('#company').value=''; qs('#phone').value=''; qs('#notes').value=''; qs('#favorite').checked=false; }
  function sourceLabel(source){
    return source === 'recent_mail' ? 'Recent Mail' : source === 'mail_import' ? 'Imported' : 'Local';
  }
  function render(items, el, allowEdit){
    if(!items.length){ el.innerHTML = '<div class="empty">No contacts found in this lane.</div>'; return; }
    el.innerHTML = items.map((item)=>`
      <article class="contact">
        <div class="contact-main">
          <div class="contact-title">
            ${item.photo_url ? `<img class="avatar" src="${safe(item.photo_url)}" alt="${safe(item.full_name || item.email)}" />` : `<div class="avatar"></div>`}
            <div>
              <div><b>${safe(item.full_name || item.email)}</b></div>
              <div class="mini">${safe(item.email || '')}</div>
            </div>
          </div>
          <div class="contact-meta">
            <span class="chip">${safe(sourceLabel(item.source))}</span>
            ${item.company ? `<span class="chip">${safe(item.company)}</span>` : ''}
            ${item.phone ? `<span class="chip">${safe(item.phone)}</span>` : ''}
            ${item.favorite ? '<span class="chip">Favorite</span>' : ''}
          </div>
          ${item.notes ? `<div class="mini">${safe(item.notes)}</div>` : ''}
        </div>
        <div class="contact-actions">
          <a class="btn small gold" href="/compose.html?to=${encodeURIComponent(item.email || '')}">Compose</a>
          ${allowEdit ? `<button class="btn small" type="button" data-edit="${safe(item.id || '')}">Edit</button><button class="btn small danger" type="button" data-delete="${safe(item.id || '')}">Delete</button>` : ''}
        </div>
      </article>`).join('');
    el.querySelectorAll('[data-edit]').forEach((btn)=> btn.onclick = ()=> {
      const item = currentSaved.find((row)=> row.id === btn.dataset.edit);
      if(!item) return;
      qs('#contact_id').value = item.id || '';
      qs('#email').value = item.email || '';
      qs('#full_name').value = item.full_name || '';
      qs('#company').value = item.company || '';
      qs('#phone').value = item.phone || '';
      qs('#notes').value = item.notes || '';
      qs('#favorite').checked = !!item.favorite;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    el.querySelectorAll('[data-delete]').forEach((btn)=> btn.onclick = async ()=> {
      if(!confirm('Delete this contact?')) return;
      try{
        const data = await apiFetch('/contacts-delete', { method:'POST', body: JSON.stringify({ id: btn.dataset.delete }) });
        await load();
        note(data.note || 'Contact deleted.', 'ok');
      } catch(err){ note(err.message || 'Delete failed.', 'danger'); }
    });
  }
  function syncLabel(){
    const el = qs('#syncMeta');
    if(!el) return;
    const count = Number(syncInfo?.last_sync_count || 0);
    el.textContent = `Saved contacts are stored in your account database. Recent mailbox discovery currently sees ${count} correspondent(s).`;
  }
  async function load(){
    try{
      const q = qs('#contactSearch').value.trim();
      const data = await apiFetch(`/contacts-list?q=${encodeURIComponent(q)}`);
      syncInfo = data.sync || null;
      currentSaved = data.saved || [];
      render(currentSaved, savedEl, true);
      render(data.recent || [], recentEl, false);
      syncLabel();
      note('Contacts loaded.', 'ok');
    }catch(err){ note(err.message || 'Contacts load failed.', 'danger'); }
  }
  qs('#saveBtn').onclick = async ()=> {
    try{
      const payload = {
        id: qs('#contact_id').value.trim(),
        email: qs('#email').value.trim(),
        full_name: qs('#full_name').value.trim(),
        company: qs('#company').value.trim(),
        phone: qs('#phone').value.trim(),
        notes: qs('#notes').value.trim(),
        favorite: qs('#favorite').checked,
      };
      await apiFetch('/contacts-save', { method:'POST', body: JSON.stringify(payload) });
      note('Contact saved.', 'ok');
      await load();
    }catch(err){ note(err.message || 'Contact save failed.', 'danger'); }
  };
  qs('#newBtn').onclick = ()=> { formReset(); };
  qs('#applySearchBtn').onclick = load;
  qs('#clearSearchBtn').onclick = ()=> { qs('#contactSearch').value=''; load(); };
  formReset();
  await load();
})();
