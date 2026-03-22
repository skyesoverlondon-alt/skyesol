(async function(){
  const boot = await SMV.withBoot('settings', 'Settings', 'Mailbox identity, signatures, profile, and security');
  if(!boot) return;
  const statusEl = qs('#statusText');
  let settings = null;

  function note(msg, kind=''){ setStatus(statusEl, msg, kind); }
  function toDateTimeLocal(value){
    if(!value) return '';
    const d = new Date(Number(value));
    if(!Number.isFinite(d.getTime())) return '';
    const pad = (n)=> String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function renderAliases(list){
    const el = qs('#aliasList');
    if(!el) return;
    if(!list.length){
      el.innerHTML = '<div class="empty">No mailbox identities are available yet.</div>';
      return;
    }
    el.innerHTML = list.map((item)=>`
      <div class="alias-card">
        <div><b>${safe(item.displayName || item.sendAsEmail)}</b></div>
        <div class="mini">${safe(item.sendAsEmail)} • ${item.isPrimary ? 'primary identity' : 'alternate identity'}</div>
        <div class="contact-meta" style="margin-top:8px">
          ${item.isPrimary ? '<span class="chip">Primary</span>' : ''}
          ${item.isDefault ? '<span class="chip">Default</span>' : ''}
          ${item.treatAsAlias ? '<span class="chip">Alias</span>' : '<span class="chip">Mailbox</span>'}
        </div>
      </div>`).join('');
  }

  async function load(){
    try{
      settings = await apiFetch('/mail-settings-get');
      const profile = settings.profile || {};
      const mail = settings.mailbox || settings.gmail || {};
      qs('#display_name').value = profile.display_name || mail.sendAs?.displayName || '';
      qs('#profile_title').value = profile.profile_title || '';
      qs('#profile_company').value = profile.profile_company || 'Skyes Over London LC';
      qs('#profile_phone').value = profile.profile_phone || '(480) 469-5416';
      qs('#profile_website').value = profile.profile_website || 'https://SOLEnterprises.org';
      qs('#signature_text').value = profile.signature_text || '';
      qs('#signature_html').value = profile.signature_html || mail.sendAs?.signature || '';
      qs('#preferred_from_alias').innerHTML = (mail.aliases || []).map((item)=>`<option value="${safe(item.sendAsEmail)}">${safe(item.displayName || item.sendAsEmail)} • ${safe(item.sendAsEmail)}</option>`).join('') || '<option value="">Primary mailbox</option>';
      if(profile.preferred_from_alias) qs('#preferred_from_alias').value = profile.preferred_from_alias;
      qs('#mailboxStatus').textContent = mail.connected ? `Mailbox live • ${mail.email}` : 'No hosted mailbox provisioned';
      qs('#scopeStatus').textContent = mail.connected ? 'Hosted mailbox identity is active and ready.' : 'Create a mailbox first to activate mailbox settings.';
      qs('#contactsScope').textContent = mail.connected ? 'Address book is stored locally and recent correspondents are discovered from mailbox traffic.' : 'No mailbox available yet for address-book discovery.';
      renderAliases(mail.aliases || []);
      const vacation = mail.vacation || {};
      qs('#vacation_enabled').checked = !!vacation.enableAutoReply;
      qs('#vacation_subject').value = vacation.responseSubject || '';
      qs('#vacation_response_text').value = vacation.responseBodyPlainText || '';
      qs('#vacation_response_html').value = vacation.responseBodyHtml || '';
      qs('#vacation_restrict_contacts').checked = !!vacation.restrictToContacts;
      qs('#vacation_restrict_domain').checked = !!vacation.restrictToDomain;
      qs('#vacation_start').value = toDateTimeLocal(vacation.startTime);
      qs('#vacation_end').value = toDateTimeLocal(vacation.endTime);
      note('Settings loaded.', 'ok');
    }catch(err){
      note(err.message || 'Settings load failed.', 'danger');
    }
  }

  async function save(){
    try{
      const payload = {
        display_name: qs('#display_name').value.trim(),
        profile_title: qs('#profile_title').value.trim(),
        profile_company: qs('#profile_company').value.trim(),
        profile_phone: qs('#profile_phone').value.trim(),
        profile_website: qs('#profile_website').value.trim(),
        signature_text: qs('#signature_text').value,
        signature_html: qs('#signature_html').value,
        preferred_from_alias: qs('#preferred_from_alias').value.trim(),
        vacation_enabled: qs('#vacation_enabled').checked,
        vacation_subject: qs('#vacation_subject').value,
        vacation_response_text: qs('#vacation_response_text').value,
        vacation_response_html: qs('#vacation_response_html').value,
        vacation_restrict_contacts: qs('#vacation_restrict_contacts').checked,
        vacation_restrict_domain: qs('#vacation_restrict_domain').checked,
        vacation_start: qs('#vacation_start').value,
        vacation_end: qs('#vacation_end').value,
      };
      await apiFetch('/mail-settings-save', { method:'POST', body: JSON.stringify(payload) });
      note('Mailbox settings saved.', 'ok');
      await load();
    }catch(err){
      note(err.message || 'Settings save failed.', 'danger');
    }
  }

  async function rotatePassword(){
    const nextPassword = String(qs('#new_password').value || '');
    if(nextPassword.length < 10){
      note('New password must be at least 10 characters.', 'danger');
      return;
    }
    try{
      await apiFetch('/mailbox-password-change', { method:'POST', body: JSON.stringify({ new_password: nextPassword }) });
      qs('#new_password').value = '';
      note('Mailbox password updated.', 'ok');
    }catch(err){
      note(err.message || 'Password update failed.', 'danger');
    }
  }

  qs('#saveBtn').onclick = save;
  qs('#syncBtn').onclick = async ()=> { await save(); await load(); };
  qs('#watchBtn').onclick = async ()=> {
    try{
      const data = await SMV.enableWatch();
      note(`Mailbox live status refreshed • sync ${data.watch?.sync_version ?? 'n/a'}.`, 'ok');
      await load();
    }catch(err){ note(err.message || 'Mailbox status refresh failed.', 'danger'); }
  };
  qs('#connectBtn').onclick = ()=> { location.href = '/onboarding.html'; };
  qs('#disconnectBtn').onclick = ()=> { location.href = '/dashboard.html'; };
  qs('#passwordBtn').onclick = rotatePassword;

  await load();
})();
