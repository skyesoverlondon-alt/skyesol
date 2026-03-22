(async function(){
  const boot = await SMV.withBoot(document.body.dataset.pageId, document.body.dataset.pageName, document.body.dataset.pageHint);
  if(!boot) return;

  const statusEl = qs('#statusText');
  const badgeEl = qs('#mailboxBadge');
  const watchEl = qs('#watchText');
  const listEl = qs('#mailList');
  const pageTokenEl = qs('#pageTokenText');
  const state = { nextPageToken:null, currentToken:null, prevStack:[], viewLabel: document.body.dataset.label || '', items:[] };

  function setNote(msg, kind=''){ setStatus(statusEl, msg, kind); }
  function setHeaderStatus(status){
    if(status && status.connected && status.mailbox){
      badgeEl.textContent = `Mailbox live • ${status.mailbox.email}`;
      watchEl.textContent = `Push watch ${status.mailbox.watch_status || 'inactive'} • sync ${status.mailbox.sync_version || 0}`;
    } else {
      badgeEl.textContent = 'No hosted mailbox provisioned';
      watchEl.textContent = 'Create a mailbox on the provisioning page.';
    }
  }

  function selectedIds(){ return SMV.getCheckedIds(); }
  function updateSelectionSummary(){
    const count = selectedIds().length;
    const summaryEl = qs('#selectionSummary');
    if(summaryEl) summaryEl.textContent = count ? `${count} message${count===1?'':'s'} selected` : 'No messages selected';
  }

  function bulkButtons(){
    const label = state.viewLabel;
    const buttons = [];
    buttons.push('<button class="btn small" type="button" id="bulkReadBtn">Mark Read</button>');
    buttons.push('<button class="btn small" type="button" id="bulkUnreadBtn">Mark Unread</button>');
    buttons.push('<button class="btn small" type="button" id="bulkStarBtn">Star</button>');
    buttons.push('<button class="btn small" type="button" id="bulkUnstarBtn">Unstar</button>');
    if(label === 'TRASH'){
      buttons.push('<button class="btn small ok" type="button" id="bulkRestoreBtn">Restore</button>');
      buttons.push('<button class="btn small danger" type="button" id="bulkDeleteBtn">Delete Forever</button>');
    }else{
      buttons.push('<button class="btn small" type="button" id="bulkArchiveBtn">Archive</button>');
      buttons.push('<button class="btn small danger" type="button" id="bulkTrashBtn">Move to Trash</button>');
    }
    return buttons.join('');
  }

  function rowActions(item){
    const actions = [];
    actions.push(`<a class="btn small" href="/thread.html?id=${encodeURIComponent(item.thread_id || item.id)}">Thread</a>`);
    actions.push(`<a class="btn small" href="/message.html?id=${encodeURIComponent(item.id)}">Open</a>`);
    actions.push(`<button class="btn small" type="button" data-single-star="${item.id}" data-on="${item.starred ? '1':'0'}">${item.starred ? 'Unstar':'Star'}</button>`);
    if(state.viewLabel === 'TRASH'){
      actions.push(`<button class="btn small ok" type="button" data-single-restore="${item.id}">Restore</button>`);
      actions.push(`<button class="btn small danger" type="button" data-single-delete="${item.id}">Delete Forever</button>`);
    }else{
      actions.push(`<button class="btn small" type="button" data-single-archive="${item.id}">Archive</button>`);
      actions.push(`<button class="btn small danger" type="button" data-single-trash="${item.id}">Trash</button>`);
    }
    return actions.join('');
  }

  function render(items){
    state.items = items || [];
    const selected = new Set(selectedIds());
    if(!state.items.length){
      listEl.innerHTML = '<div class="empty">No messages matched this mailbox view.</div>';
      updateSelectionSummary();
      return;
    }
    listEl.innerHTML = state.items.map((item)=>`
      <article class="mail ${item.unread ? 'unread':''}">
        <div class="mail-check"><input type="checkbox" data-mail-check value="${safe(item.id)}" ${selected.has(item.id)?'checked':''} /></div>
        <div class="mail-main">
          <div class="mail-top">
            <div>
              <div class="mail-subject"><a href="/thread.html?id=${encodeURIComponent(item.thread_id || item.id)}">${safe(item.subject || '(no subject)')}</a></div>
              <div class="mail-from">${safe(item.from || 'Unknown sender')}</div>
            </div>
            <div class="mini">${safe(fmtDate(item.internal_date || item.date || ''))}</div>
          </div>
          <div class="mail-snippet">${safe(item.snippet || '')}</div>
          <div class="mail-meta">
            ${item.unread ? '<span class="chip">Unread</span>' : ''}
            ${item.starred ? '<span class="chip">Starred</span>' : ''}
            ${item.important ? '<span class="chip">Important</span>' : ''}
            ${item.has_attachments ? '<span class="chip">Attachments</span>' : ''}
          </div>
        </div>
        <div class="mail-actions">${rowActions(item)}</div>
      </article>`).join('');

    document.querySelectorAll('[data-mail-check]').forEach((el)=> el.onchange = updateSelectionSummary);
    document.querySelectorAll('[data-single-star]').forEach((btn)=> btn.onclick = async ()=> {
      try{
        await apiFetch('/mail-modify', { method:'POST', body: JSON.stringify({ id: btn.dataset.singleStar, addLabelIds: btn.dataset.on === '1' ? [] : ['STARRED'], removeLabelIds: btn.dataset.on === '1' ? ['STARRED'] : [] }) });
        await refreshInbox();
      }catch(err){ setNote(err.message || 'Mailbox update failed.', 'danger'); }
    });
    document.querySelectorAll('[data-single-archive]').forEach((btn)=> btn.onclick = async ()=> { try{ await apiFetch('/mail-modify', { method:'POST', body: JSON.stringify({ id: btn.dataset.singleArchive, addLabelIds: [], removeLabelIds:['INBOX'] }) }); await refreshInbox(); }catch(err){ setNote(err.message || 'Archive failed.', 'danger'); } });
    document.querySelectorAll('[data-single-trash]').forEach((btn)=> btn.onclick = async ()=> { try{ await SMV.trashMessages([btn.dataset.singleTrash]); await refreshInbox(); }catch(err){ setNote(err.message || 'Trash failed.', 'danger'); } });
    document.querySelectorAll('[data-single-restore]').forEach((btn)=> btn.onclick = async ()=> { try{ await SMV.untrashMessages([btn.dataset.singleRestore]); await refreshInbox(); }catch(err){ setNote(err.message || 'Restore failed.', 'danger'); } });
    document.querySelectorAll('[data-single-delete]').forEach((btn)=> btn.onclick = async ()=> { try{ await SMV.deleteMessages([btn.dataset.singleDelete]); await refreshInbox(); }catch(err){ setNote(err.message || 'Delete failed.', 'danger'); } });
    updateSelectionSummary();
  }

  async function loadInbox(token=null, pushHistory=false){
    if(!(boot.status && boot.status.connected)){ render([]); setNote('Create a hosted mailbox to open this view.'); return; }
    try{
      const q = encodeURIComponent(qs('#q').value.trim());
      const includeSpamTrash = ['SPAM','TRASH'].includes(state.viewLabel) ? '&includeSpamTrash=true' : '';
      const page = token ? `&pageToken=${encodeURIComponent(token)}` : '';
      setNote(`Loading ${document.body.dataset.pageName || 'mail'}…`);
      const data = await apiFetch(`/mail-list?max=25&q=${q}&label=${encodeURIComponent(state.viewLabel)}${page}${includeSpamTrash}`);
      if(pushHistory) state.prevStack.push(state.currentToken);
      state.currentToken = token;
      state.nextPageToken = data.nextPageToken || null;
      pageTokenEl.textContent = data.nextPageToken ? 'More mail available' : 'End of current mailbox window';
      render(data.items || []);
      setNote(`Loaded ${data.items?.length || 0} message(s) from ${data.mailbox}.`, 'ok');
    }catch(err){
      listEl.innerHTML = '<div class="empty">Mailbox load failed.</div>';
      setNote(err.message || 'Mailbox load failed.', 'danger');
    }
  }
  async function refreshInbox(){ state.prevStack=[]; state.currentToken=null; state.nextPageToken=null; await loadInbox(null, false); }

  async function runBulk(fn){
    try{ await fn(selectedIds()); await refreshInbox(); }
    catch(err){ setNote(err.message || 'Bulk action failed.', 'danger'); }
  }

  qs('#applyBtn').onclick = refreshInbox;
  qs('#clearBtn').onclick = ()=> { qs('#q').value=''; refreshInbox(); };
  qs('#refreshBtn').onclick = refreshInbox;
  qs('#connectBtn').onclick = ()=> { location.href='/onboarding.html'; };
  qs('#watchBtn').onclick = async ()=> { try{ const data = await SMV.enableWatch(); setNote(`Mailbox status refreshed • sync ${data.watch?.sync_version ?? 'n/a'}.`, 'ok'); }catch(err){ setNote(err.message || 'Mailbox status refresh failed.', 'danger'); } };
  qs('#disconnectBtn').onclick = ()=> { location.href='/settings.html'; };
  qs('#nextBtn').onclick = ()=> state.nextPageToken ? loadInbox(state.nextPageToken, true) : null;
  qs('#prevBtn').onclick = ()=> state.prevStack.length ? loadInbox(state.prevStack.pop() || null, false) : setNote('No previous page in this session.');

  document.querySelector('#bulkBar').innerHTML = `<div>${document.body.dataset.pageName} selection</div><div class="bulk-actions">${bulkButtons()}</div><div class="mini" id="selectionSummary">No messages selected</div>`;
  document.querySelector('#bulkReadBtn').onclick = ()=> runBulk((ids)=>SMV.batchModify(ids, [], ['UNREAD']));
  document.querySelector('#bulkUnreadBtn').onclick = ()=> runBulk((ids)=>SMV.batchModify(ids, ['UNREAD'], []));
  document.querySelector('#bulkStarBtn').onclick = ()=> runBulk((ids)=>SMV.batchModify(ids, ['STARRED'], []));
  document.querySelector('#bulkUnstarBtn').onclick = ()=> runBulk((ids)=>SMV.batchModify(ids, [], ['STARRED']));
  if(document.querySelector('#bulkArchiveBtn')) document.querySelector('#bulkArchiveBtn').onclick = ()=> runBulk((ids)=>SMV.batchModify(ids, [], ['INBOX']));
  if(document.querySelector('#bulkTrashBtn')) document.querySelector('#bulkTrashBtn').onclick = ()=> runBulk((ids)=>SMV.trashMessages(ids));
  if(document.querySelector('#bulkRestoreBtn')) document.querySelector('#bulkRestoreBtn').onclick = ()=> runBulk((ids)=>SMV.untrashMessages(ids));
  if(document.querySelector('#bulkDeleteBtn')) document.querySelector('#bulkDeleteBtn').onclick = ()=> runBulk((ids)=>SMV.deleteMessages(ids));

  setHeaderStatus(boot.status);
  await refreshInbox();
})();
