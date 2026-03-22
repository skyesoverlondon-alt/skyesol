(async function(){
  const boot = await SMV.withBoot('dashboard', 'Message', 'Single-message review surface');
  if(!boot) return;
  const statusEl = qs('#statusText');
  const contentEl = qs('#messageContent');
  const params = new URLSearchParams(location.search);
  const id = params.get('id') || '';
  function note(msg, kind=''){ setStatus(statusEl, msg, kind); }
  if(!id){ contentEl.innerHTML = '<div class="empty">Message id missing.</div>'; return; }
  try{
    const data = await apiFetch(`/mail-get?id=${encodeURIComponent(id)}`);
    const m = data.message;
    qs('#pageTitle').textContent = m.headers.subject || '(no subject)';
    qs('#metaFrom').textContent = m.headers.from || '';
    qs('#metaTo').textContent = m.headers.to || '';
    qs('#metaDate').textContent = fmtDate(m.internal_date || m.headers.date || '');
    qs('#replyBtn').href = `/compose.html?to=${encodeURIComponent(SMV.emailOnly(m.headers.from || ''))}&subject=${encodeURIComponent(/^Re:/i.test(m.headers.subject||'') ? m.headers.subject : `Re: ${m.headers.subject || ''}`)}&reply_message_id=${encodeURIComponent(m.id)}&reply_thread_id=${encodeURIComponent(m.thread_id || '')}`;
    qs('#threadBtn').href = `/thread.html?id=${encodeURIComponent(m.thread_id || m.id)}`;
    contentEl.innerHTML = `
      <div class="chiprow">
        ${m.labels.map((label)=>`<span class="chip">${safe(label)}</span>`).join('')}
      </div>
      <div class="message-body">${SMV.htmlMessage(m.body)}</div>
      ${m.attachments?.length ? `<div class="attachments">${m.attachments.map((a)=>`<a class="attachment" href="/.netlify/functions/mail-attachment?id=${encodeURIComponent(m.id)}&attachmentId=${encodeURIComponent(a.attachment_id)}&filename=${encodeURIComponent(a.filename)}">${safe(a.filename)} • ${safe(a.mime_type)}</a>`).join('')}</div>` : ''}`;
    if(m.labels.includes('UNREAD')){ await apiFetch('/mail-modify', { method:'POST', body: JSON.stringify({ id: m.id, addLabelIds: [], removeLabelIds:['UNREAD'] }) }); }
    note('Message loaded.', 'ok');
  }catch(err){ contentEl.innerHTML = '<div class="empty">Message load failed.</div>'; note(err.message || 'Message load failed.', 'danger'); }
})();
