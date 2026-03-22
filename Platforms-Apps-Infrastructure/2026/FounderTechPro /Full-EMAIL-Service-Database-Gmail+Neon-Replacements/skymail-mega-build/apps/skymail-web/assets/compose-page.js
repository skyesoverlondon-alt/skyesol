(async function(){
  const boot = await SMV.withBoot('dashboard', 'Compose', 'Send, draft, alias, and attachment lane');
  if(!boot) return;
  const statusEl = qs('#statusText');
  const params = new URLSearchParams(location.search);
  const draftId = params.get('draft_id') || '';
  let settings = null;
  function mailboxSettings(){ return settings?.mailbox || settings?.gmail || {}; }
  const state = { attachments: [] };

  function note(msg, kind=''){ setStatus(statusEl, msg, kind); }

  function renderAttachments(){
    const el = qs('#attachmentList');
    if(!el) return;
    if(!state.attachments.length){
      el.innerHTML = '<div class="mini">No attachments queued.</div>';
      return;
    }
    el.innerHTML = state.attachments.map((item, idx)=>`
      <div class="attachment-pill">
        <div>
          <b>${safe(item.filename || 'attachment')}</b>
          <div class="mini">${safe(item.mime_type || 'application/octet-stream')} • ${safe(item.size_label || '')}${item.existing ? ' • existing draft file' : ''}</div>
        </div>
        <button class="btn small danger" type="button" data-remove-attachment="${idx}">Remove</button>
      </div>`).join('');
    el.querySelectorAll('[data-remove-attachment]').forEach((btn)=> btn.onclick = ()=> {
      state.attachments.splice(Number(btn.dataset.removeAttachment), 1);
      renderAttachments();
    });
  }

  function humanBytes(bytes){
    const n = Number(bytes || 0);
    if(n < 1024) return `${n} B`;
    if(n < 1024*1024) return `${(n/1024).toFixed(1)} KB`;
    return `${(n/(1024*1024)).toFixed(2)} MB`;
  }

  function populateAliases(){
    const select = qs('#from_alias');
    if(!select) return;
    const aliases = mailboxSettings().aliases || [];
    const preferred = settings?.profile?.preferred_from_alias || '';
    select.innerHTML = aliases.length
      ? aliases.map((item)=>`<option value="${safe(item.sendAsEmail)}">${safe(item.displayName || item.sendAsEmail)} • ${safe(item.sendAsEmail)}${item.verificationStatus ? ` • ${safe(item.verificationStatus)}` : ''}</option>`).join('')
      : '<option value="">Primary mailbox</option>';
    if(preferred && aliases.some((item)=> String(item.sendAsEmail || '').toLowerCase() === preferred.toLowerCase())) {
      select.value = preferred;
    }
  }

  async function loadSettings(){
    try{ settings = await apiFetch('/mail-settings-get'); }catch(_err){}
    const mail = mailboxSettings();
    if(mail.connected) qs('#mailboxBadge').textContent = `Mailbox live • ${mail.email}`;
    else qs('#mailboxBadge').textContent = 'No hosted mailbox provisioned';
    populateAliases();
  }

  async function loadDraft(){
    if(!draftId) return;
    try{
      const data = await apiFetch(`/mail-draft-get?id=${encodeURIComponent(draftId)}`);
      const d = data.draft;
      qs('#draft_id').value = d.id || '';
      qs('#thread_id').value = d.thread_id || '';
      qs('#to').value = d.to || '';
      qs('#cc').value = d.cc || '';
      qs('#bcc').value = d.bcc || '';
      qs('#subject').value = d.subject || '';
      qs('#text').value = d.body?.text || '';
      qs('#html').value = d.body?.html || '';
      const fromHeader = String(d.from || '');
      const aliasMatch = fromHeader.match(/<([^>]+)>/);
      if(aliasMatch && qs('#from_alias')) qs('#from_alias').value = aliasMatch[1].trim().toLowerCase();
      state.attachments = (d.attachments || []).map((a)=>({
        filename: a.filename,
        mime_type: a.mime_type,
        data_b64: a.data_b64 || '',
        size_bytes: Number(a.size || 0),
        size_label: humanBytes(a.size || 0),
        existing: true,
      })).filter((a)=>a.data_b64);
      renderAttachments();
      note('Draft loaded.', 'ok');
    }catch(err){ note(err.message || 'Draft load failed.', 'danger'); }
  }

  function applySignature(){
    const alias = String(qs('#from_alias')?.value || '').toLowerCase();
    const aliasInfo = (mailboxSettings().aliases || []).find((item)=> String(item.sendAsEmail || '').toLowerCase() === alias) || mailboxSettings().sendAs || null;
    const sigText = settings?.profile?.signature_text || '';
    const sigHtml = aliasInfo?.signature || settings?.profile?.signature_html || '';
    if(sigText && !qs('#text').value.includes(sigText.trim())){
      qs('#text').value = `${qs('#text').value}${qs('#text').value ? '\n\n' : ''}${sigText}`;
    }
    if(sigHtml && !qs('#html').value.includes(sigHtml.trim())){
      qs('#html').value = `${qs('#html').value}${qs('#html').value ? '\n' : ''}${sigHtml}`;
    }
  }

  function fillFromQuery(){
    if(params.get('to')) qs('#to').value = params.get('to');
    if(params.get('subject')) qs('#subject').value = params.get('subject');
    if(params.get('body')) qs('#text').value = params.get('body');
    if(params.get('reply_message_id')) qs('#reply_message_id').value = params.get('reply_message_id');
    if(params.get('reply_thread_id')) qs('#thread_id').value = params.get('reply_thread_id');
  }

  async function saveDraft(){
    try{
      const payload = {
        id: qs('#draft_id').value.trim(),
        to: qs('#to').value.trim(),
        cc: qs('#cc').value.trim(),
        bcc: qs('#bcc').value.trim(),
        subject: qs('#subject').value.trim(),
        text: qs('#text').value,
        html: qs('#html').value,
        thread_id: qs('#thread_id').value.trim(),
        reply_message_id: qs('#reply_message_id').value.trim(),
        from_alias: qs('#from_alias').value.trim(),
        attachments: state.attachments,
      };
      const data = await apiFetch('/mail-draft-save', { method:'POST', body: JSON.stringify(payload) });
      qs('#draft_id').value = data.draft?.id || '';
      qs('#thread_id').value = data.draft?.thread_id || qs('#thread_id').value;
      note(`Draft saved in ${data.mailbox}.`, 'ok');
    }catch(err){ note(err.message || 'Draft save failed.', 'danger'); }
  }

  async function sendMail(){
    try{
      const payload = {
        to: qs('#to').value.trim(),
        cc: qs('#cc').value.trim(),
        bcc: qs('#bcc').value.trim(),
        subject: qs('#subject').value.trim(),
        text: qs('#text').value,
        html: qs('#html').value,
        reply_message_id: qs('#reply_message_id').value.trim(),
        reply_thread_id: qs('#thread_id').value.trim(),
        from_alias: qs('#from_alias').value.trim(),
        attachments: state.attachments,
      };
      const data = await apiFetch('/mail-send', { method:'POST', body: JSON.stringify(payload) });
      note(`Email sent from ${data.from_alias || data.mailbox}.`, 'ok');
      setTimeout(()=>{ location.href='/sent.html'; }, 700);
    }catch(err){ note(err.message || 'Send failed.', 'danger'); }
  }

  async function loadContacts(){
    try{
      const data = await apiFetch('/contacts-list');
      const all = [...(data.saved||[]), ...(data.recent||[])].slice(0,18);
      qs('#contactsQuick').innerHTML = all.length ? all.map((c)=>`<button class="btn small" type="button" data-contact="${safe(c.email)}">${safe(c.full_name || c.email)}</button>`).join('') : '<div class="mini">No contacts available yet.</div>';
      qs('#contactsQuick').querySelectorAll('[data-contact]').forEach((btn)=> btn.onclick = ()=> {
        const val = qs('#to').value.trim();
        const email = btn.dataset.contact;
        qs('#to').value = val ? `${val}, ${email}` : email;
      });
    }catch(_err){}
  }

  async function addFiles(fileList){
    const files = Array.from(fileList || []).slice(0, 10);
    for(const file of files){
      const dataB64 = await new Promise((resolve, reject)=>{
        const reader = new FileReader();
        reader.onload = ()=> {
          const raw = String(reader.result || '');
          const base64 = raw.includes(',') ? raw.split(',').pop() : raw;
          resolve(base64 || '');
        };
        reader.onerror = ()=> reject(new Error(`Failed to read ${file.name}`));
        reader.readAsDataURL(file);
      });
      state.attachments.push({
        filename: file.name,
        mime_type: file.type || 'application/octet-stream',
        data_b64: dataB64,
        size_bytes: file.size || 0,
        size_label: humanBytes(file.size || 0),
        existing: false,
      });
    }
    renderAttachments();
  }

  qs('#sendBtn').onclick = sendMail;
  qs('#saveDraftBtn').onclick = saveDraft;
  qs('#signatureBtn').onclick = applySignature;
  qs('#attachInput').addEventListener('change', async (ev)=>{
    try{
      await addFiles(ev.target.files || []);
      ev.target.value = '';
      note('Attachment queue updated.', 'ok');
    }catch(err){ note(err.message || 'Attachment load failed.', 'danger'); }
  });

  await loadSettings();
  fillFromQuery();
  await loadDraft();
  await loadContacts();
  renderAttachments();
  note('Compose surface ready.', 'ok');
})();
