window.SMV = (function(){
  const CONTACT_HTML = 'Skyes Over London LC • SkyesOverLondonLC@SOLEnterprises.org • SkyesOverLondon@gmail.com • B2B@solenterprises.org • (480) 469-5416';
  const NAV_ITEMS = [
    { id:'dashboard', href:'/dashboard.html', label:'Inbox', labelId:'INBOX', hint:'Primary mailbox lane' },
    { id:'sent', href:'/sent.html', label:'Sent', labelId:'SENT', hint:'Outbound history' },
    { id:'drafts', href:'/drafts.html', label:'Drafts', labelId:'DRAFT', hint:'Saved drafts' },
    { id:'spam', href:'/spam.html', label:'Spam', labelId:'SPAM', hint:'Filtered mail' },
    { id:'trash', href:'/trash.html', label:'Trash', labelId:'TRASH', hint:'Recovery + delete' },
    { id:'contacts', href:'/contacts.html', label:'Contacts', hint:'People + shortcuts' },
    { id:'settings', href:'/settings.html', label:'Settings', hint:'Identity + signature' }
  ];

  function footerHtml(){
    return `<div class="footer"><div class="inner"><p>${CONTACT_HTML}</p></div></div>`;
  }
  function mountFooter(){ const el = document.querySelector('#appFooter'); if(el) el.innerHTML = footerHtml(); }

  async function fetchStatus(){
    try{ return await apiFetch('/mail-status'); }
    catch(err){ return { ok:false, connected:false, error: err.message || 'Status failed' }; }
  }
  async function fetchLabels(){
    try{ const data = await apiFetch('/mail-labels'); return data.items || []; }
    catch(_err){ return []; }
  }
  function labelsMap(items){ const map = {}; (items||[]).forEach((item)=>{ map[item.id] = item; }); return map; }
  function countFor(labelMap, labelId){ const row = labelMap[labelId]; if(!row) return ''; const count = Number(row.messagesUnread || row.messagesTotal || 0); return String(count); }

  function renderRail({ activeId, labelMap = {}, status = null }){
    const rail = document.querySelector('#leftRail');
    if(!rail) return;
    const mailbox = status && status.connected && status.mailbox ? status.mailbox.email : 'No mailbox provisioned';
    const provider = status && status.connected && status.mailbox ? (status.mailbox.provider || 'SkyMail Host') : 'SkyMail Host';
    rail.innerHTML = `
      <div class="rail-card">
        <div class="rail-title">Mailbox Surface</div>
        <div class="mini">${safe(mailbox)}</div>
        <div class="mini" style="margin-top:6px">Provider: ${safe(provider)}</div>
      </div>
      <div class="rail-card">
        <div class="rail-title">Navigation</div>
        <div class="navlist">
          ${NAV_ITEMS.map((item)=>`
            <a class="navitem ${item.id===activeId?'active':''}" href="${item.href}">
              <div class="left"><span>${item.label}</span><small>${item.hint || ''}</small></div>
              ${item.labelId ? `<span class="count">${safe(countFor(labelMap, item.labelId))}</span>` : ''}
            </a>`).join('')}
        </div>
      </div>
      <div class="rail-card">
        <div class="rail-title">Quick Actions</div>
        <div class="btnrow" style="margin-top:0">
          <a class="btn gold" href="/compose.html">Compose</a>
          <a class="btn" href="/onboarding.html">Provisioning</a>
          <button class="btn danger" type="button" id="railLogoutBtn">Logout</button>
        </div>
      </div>
      <div class="rail-card">
        <div class="rail-title">Operator Contact</div>
        <div class="mini">${CONTACT_HTML}</div>
      </div>`;
    const logoutBtn = document.querySelector('#railLogoutBtn');
    if(logoutBtn) logoutBtn.onclick = logout;
  }

  function renderTopbar(activeId, pageName, pageHint){
    const top = document.querySelector('#pageTopbar');
    if(!top) return;
    top.innerHTML = `
      <div class="topbar">
        <div class="nav">
          <div class="brand">
            <img src="https://cdn1.sharemyimage.com/2026/02/16/logo1_transparent.png" alt="Skyes Over London LC Logo" />
            <div class="name"><b>SkyMail Host</b><span>${safe(pageName || 'Mail command center')} • ${safe(pageHint || 'Provisioned mailbox control plane')}</span></div>
          </div>
          <div class="navlinks">
            ${NAV_ITEMS.slice(0,5).map((item)=>`<a class="pill ${item.id===activeId?'active':''}" href="${item.href}">${item.label}</a>`).join('')}
            <a class="pill" href="/compose.html">Compose</a>
            <button class="pill" id="topLogoutBtn" type="button">Logout</button>
          </div>
        </div>
      </div>`;
    const btn = document.querySelector('#topLogoutBtn');
    if(btn) btn.onclick = logout;
  }

  function getCheckedIds(selector='[data-mail-check]:checked'){ return Array.from(document.querySelectorAll(selector)).map((el)=>String(el.value||'').trim()).filter(Boolean); }
  async function batchModify(ids, addLabelIds=[], removeLabelIds=[]){ if(!ids.length) throw new Error('Select at least one message first.'); return await apiFetch('/mail-batch-modify', { method:'POST', body: JSON.stringify({ ids, addLabelIds, removeLabelIds }) }); }
  async function trashMessages(ids){ if(!ids.length) throw new Error('Select at least one message first.'); return await apiFetch('/mail-message-trash', { method:'POST', body: JSON.stringify({ ids, action:'trash' }) }); }
  async function untrashMessages(ids){ if(!ids.length) throw new Error('Select at least one message first.'); return await apiFetch('/mail-message-trash', { method:'POST', body: JSON.stringify({ ids, action:'untrash' }) }); }
  async function deleteMessages(ids){ if(!ids.length) throw new Error('Select at least one message first.'); return await apiFetch('/mail-batch-delete', { method:'POST', body: JSON.stringify({ ids }) }); }
  async function openProvisioning(next='/onboarding.html'){ location.href = next || '/onboarding.html'; }
  async function disconnectMailbox(){ throw new Error('Mailbox disconnect is disabled in the hosted build. Use admin controls to suspend or delete an account.'); }
  async function enableWatch(){ return await apiFetch('/mailbox-watch', { method:'POST', body: JSON.stringify({}) }); }

  async function withBoot(activeId, pageName, pageHint){
    if(!requireAuthOrRedirect()) return null;
    renderTopbar(activeId, pageName, pageHint);
    const [status, labels] = await Promise.all([fetchStatus(), fetchLabels()]);
    renderRail({ activeId, status, labelMap: labelsMap(labels) });
    mountFooter();
    return { status, labels };
  }

  function emailOnly(value){
    const s = String(value || '');
    const m = s.match(/<([^>]+)>/);
    if(m) return m[1].trim().toLowerCase();
    const plain = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return plain ? plain[0].trim().toLowerCase() : '';
  }
  function nameFromAddress(value){
    const s = String(value || '').trim();
    if(!s) return '';
    const m = s.match(/^\s*"?([^"<]+?)"?\s*</);
    if(m) return m[1].trim();
    const email = emailOnly(s);
    return email ? email.split('@')[0] : s;
  }
  function encodeAttr(value){ return String(value || '').replace(/[&<>"]/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
  function htmlMessage(body){
    const html = String(body && body.html || '');
    const text = String(body && body.text || '');
    if(html) return `<iframe class="message-frame" sandbox="" srcdoc="${encodeAttr(html)}"></iframe>`;
    return `<pre class="message-pre">${safe(text)}</pre>`;
  }

  return {
    NAV_ITEMS, footerHtml, mountFooter, fetchStatus, fetchLabels, labelsMap, renderRail, renderTopbar,
    getCheckedIds, batchModify, trashMessages, untrashMessages, deleteMessages,
    openProvisioning, disconnectMailbox, enableWatch, withBoot, emailOnly, nameFromAddress, encodeAttr, htmlMessage,
  };
})();
