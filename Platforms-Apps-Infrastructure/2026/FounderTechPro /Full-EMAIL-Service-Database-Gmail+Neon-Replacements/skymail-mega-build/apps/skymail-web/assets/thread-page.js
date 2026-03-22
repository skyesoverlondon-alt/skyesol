(async function(){
  const boot = await SMV.withBoot('dashboard', 'Thread View', 'Conversation stack with quick reply');
  if(!boot) return;
  const statusEl = qs('#statusText');
  const stackEl = qs('#threadStack');
  const params = new URLSearchParams(location.search);
  const id = params.get('id') || '';
  let thread = null;
  function note(msg, kind=''){ setStatus(statusEl, msg, kind); }
  if(!id){ stackEl.innerHTML = '<div class="empty">Thread id missing.</div>'; return; }
  function renderMessage(m){
    return `<article class="thread-message">
      <div class="message-header">
        <div>
          <div class="mail-subject">${safe(m.headers.subject || '(no subject)')}</div>
          <div class="mail-from">From: ${safe(m.headers.from || '')}</div>
          <div class="mail-from">To: ${safe(m.headers.to || '')}</div>
          ${m.headers.cc ? `<div class="mail-from">Cc: ${safe(m.headers.cc)}</div>` : ''}
        </div>
        <div class="mini">${safe(fmtDate(m.internal_date || m.headers.date || ''))}</div>
      </div>
      <div class="chiprow">${m.labels.map((label)=>`<span class="chip">${safe(label)}</span>`).join('')}</div>
      <div class="message-body">${SMV.htmlMessage(m.body)}</div>
      ${m.attachments?.length ? `<div class="attachments">${m.attachments.map((a)=>`<a class="attachment" href="/.netlify/functions/mail-attachment?id=${encodeURIComponent(m.id)}&attachmentId=${encodeURIComponent(a.attachment_id)}&filename=${encodeURIComponent(a.filename)}">${safe(a.filename)} • ${safe(a.mime_type)}</a>`).join('')}</div>` : ''}
      <div class="mail-actions">
        <a class="btn small" href="/message.html?id=${encodeURIComponent(m.id)}">Open Message</a>
        <button class="btn small" type="button" data-star="${safe(m.id)}" data-on="${m.starred ? '1':'0'}">${m.starred ? 'Unstar':'Star'}</button>
        <button class="btn small" type="button" data-archive="${safe(m.id)}">Archive</button>
      </div>
    </article>`;
  }
  function attachActions(){
    document.querySelectorAll('[data-star]').forEach((btn)=> btn.onclick = async ()=> {
      try{ await apiFetch('/mail-modify', { method:'POST', body: JSON.stringify({ id: btn.dataset.star, addLabelIds: btn.dataset.on==='1' ? [] : ['STARRED'], removeLabelIds: btn.dataset.on==='1' ? ['STARRED'] : [] }) }); await load(); }
      catch(err){ note(err.message || 'Star update failed.', 'danger'); }
    });
    document.querySelectorAll('[data-archive]').forEach((btn)=> btn.onclick = async ()=> {
      try{ await apiFetch('/mail-modify', { method:'POST', body: JSON.stringify({ id: btn.dataset.archive, addLabelIds: [], removeLabelIds:['INBOX'] }) }); await load(); }
      catch(err){ note(err.message || 'Archive failed.', 'danger'); }
    });
  }
  async function load(){
    try{
      const data = await apiFetch(`/mail-thread-get?id=${encodeURIComponent(id)}`);
      thread = data.thread;
      qs('#threadTitle').textContent = thread.subject || '(no subject)';
      qs('#threadMeta').textContent = `${thread.message_count} message(s) • ${thread.participants.length} participant line(s)`;
      stackEl.innerHTML = thread.messages.map(renderMessage).join('');
      attachActions();
      const latest = thread.messages[thread.messages.length - 1];
      qs('#replySummary').textContent = latest ? `Replying in thread with ${latest.headers.from || 'sender'}` : 'Reply in thread';
      note('Thread loaded.', 'ok');
    }catch(err){ stackEl.innerHTML = '<div class="empty">Thread load failed.</div>'; note(err.message || 'Thread load failed.', 'danger'); }
  }
  qs('#replySendBtn').onclick = async ()=> {
    if(!thread || !thread.messages.length) return;
    const latest = thread.messages[thread.messages.length - 1];
    const body = qs('#replyText').value;
    if(!body.trim()){ note('Write a reply first.', 'danger'); return; }
    try{
      await apiFetch('/mail-send', { method:'POST', body: JSON.stringify({
        to: SMV.emailOnly(latest.headers.from || ''),
        subject: /^Re:/i.test(thread.subject || '') ? thread.subject : `Re: ${thread.subject || ''}`,
        text: body,
        reply_message_id: latest.id,
        reply_thread_id: thread.id,
      }) });
      qs('#replyText').value='';
      note('Reply sent.', 'ok');
      await load();
    }catch(err){ note(err.message || 'Reply send failed.', 'danger'); }
  };
  qs('#replyComposeBtn').onclick = ()=> {
    if(!thread || !thread.messages.length) return;
    const latest = thread.messages[thread.messages.length - 1];
    location.href = `/compose.html?to=${encodeURIComponent(SMV.emailOnly(latest.headers.from || ''))}&subject=${encodeURIComponent(/^Re:/i.test(thread.subject || '') ? thread.subject : `Re: ${thread.subject || ''}`)}&reply_message_id=${encodeURIComponent(latest.id)}&reply_thread_id=${encodeURIComponent(thread.id)}`;
  };
  await load();
})();
