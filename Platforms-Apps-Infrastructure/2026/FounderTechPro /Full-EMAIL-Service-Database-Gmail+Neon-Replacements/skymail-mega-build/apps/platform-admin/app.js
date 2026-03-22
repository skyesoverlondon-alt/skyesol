const query = new URLSearchParams(window.location.search);
const state = {
  apiBase: localStorage.getItem('skyedb_api_base') || query.get('apiBase') || '',
  manualToken: localStorage.getItem('skyedb_manual_token') || '',
  pendingSignupToken: query.get('signup_token') || localStorage.getItem('skyedb_pending_signup_token') || '',
  identityUser: null,
  identityToken: '',
  authUser: null,
  plans: [],
  orgs: [],
  orgDetail: null,
  projects: [],
  environments: [],
  databases: [],
  jobs: [],
  backups: [],
  audit: [],
  signups: [],
  billingSummary: null,
  usage: { summary: [], recent: [] },
  activeOrgId: localStorage.getItem('skyedb_active_org_id') || '',
};

const el = (id) => document.getElementById(id);

function log(message, payload = null) {
  const target = el('activity-log');
  const time = new Date().toLocaleTimeString();
  const line = payload ? `${time}  ${message}
${JSON.stringify(payload, null, 2)}

` : `${time}  ${message}

`;
  target.textContent = line + target.textContent;
}

function getToken() {
  return state.identityToken || state.manualToken || '';
}

function getModeLabel() {
  if (!state.authUser) return 'Customer';
  return state.authUser.is_super_admin ? 'Owner' : 'Customer';
}

function updateAuthStatus() {
  el('auth-status').textContent = getToken() ? 'Connected' : 'Not connected';
  el('mode-status').textContent = getModeLabel();
}

async function api(path, options = {}) {
  if (!state.apiBase) throw new Error('Set the Worker API base URL first.');
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${state.apiBase}${path}`, { ...options, headers });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function badge(value) {
  return value ? `<span class="badge ${value}">${value}</span>` : '';
}

function fillSelect(id, rows, labelFn, valueFn = (row) => row.id, includeBlank = false) {
  const node = el(id);
  const selected = node.value;
  const blank = includeBlank ? '<option value="">—</option>' : '';
  node.innerHTML = blank + rows.map((row) => `<option value="${valueFn(row)}">${labelFn(row)}</option>`).join('');
  if (rows.some((row) => String(valueFn(row)) === String(selected))) {
    node.value = selected;
  } else if (id === 'active-org' && state.activeOrgId && rows.some((row) => String(row.id) === String(state.activeOrgId))) {
    node.value = state.activeOrgId;
  } else if (!node.value && rows[0]) {
    node.value = valueFn(rows[0]);
  }
}

function renderList(id, rows, renderFn) {
  const target = el(id);
  if (!rows.length) {
    target.innerHTML = '<div class="item"><span class="muted">No records yet.</span></div>';
    return;
  }
  target.innerHTML = rows.map(renderFn).join('');
}

function byActiveOrg(rows, key = 'org_id') {
  if (!state.activeOrgId) return rows;
  return rows.filter((row) => !row[key] || row[key] === state.activeOrgId);
}

function renderPlans() {
  renderList('plan-list', state.plans, (plan) => `
    <div class="item">
      <strong>${plan.display_name}</strong>
      <div class="meta"><span>${plan.plan_code}</span><span>Seats ${plan.seats}</span></div>
      <pre class="code small" style="margin-top:10px;">${JSON.stringify(plan.quotas, null, 2)}</pre>
    </div>
  `);
  ['org-plan', 'db-plan', 'billing-plan'].forEach((id) => {
    fillSelect(id, state.plans, (plan) => `${plan.display_name} · ${plan.plan_code}`, (plan) => plan.plan_code);
  });
}

function renderOrganizations() {
  renderList('org-list', state.orgs, (org) => `
    <div class="item">
      <strong>${org.name}</strong>
      <div class="meta">
        <span>${org.slug}</span>
        ${badge(org.subscription?.plan_code || org.plan_code || 'starter')}
        <span>Members ${org.member_count}</span>
        <span>Projects ${org.project_count}</span>
        <span>Databases ${org.database_count}</span>
      </div>
    </div>
  `);
  fillSelect('project-org', state.orgs, (org) => `${org.name} · ${org.subscription?.plan_code || org.plan_code || 'starter'}`);
  fillSelect('member-org', state.orgs, (org) => org.name);
  fillSelect('active-org', state.orgs, (org) => org.name);
}

function renderOrgDetail() {
  if (!state.orgDetail) {
    el('org-detail').innerHTML = '<div class="item"><span class="muted">Select or sync an organization first.</span></div>';
    return;
  }
  const subscription = state.orgDetail.subscription || {};
  const memberCards = (state.orgDetail.members || []).map((member) => `
    <div class="item">
      <strong>${member.full_name || member.email}</strong>
      <div class="meta"><span>${member.email}</span>${badge(member.role)}${member.is_super_admin ? badge('super_admin') : ''}</div>
    </div>
  `).join('');
  el('org-detail').innerHTML = `
    <div class="item">
      <strong>${state.orgDetail.name}</strong>
      <div class="meta"><span>${state.orgDetail.slug}</span>${badge(subscription.plan_code || 'starter')}<span>Seats ${subscription.seats || 0}</span></div>
      <pre class="code small" style="margin-top:10px;">${JSON.stringify(subscription.quotas || {}, null, 2)}</pre>
    </div>
    ${memberCards || '<div class="item"><span class="muted">No members yet.</span></div>'}
  `;
}

function renderProjects() {
  renderList('project-list', byActiveOrg(state.projects), (project) => `
    <div class="item">
      <strong>${project.name}</strong>
      <div class="meta"><span>${project.org_name}</span><span>${project.slug}</span><span>Envs ${project.environment_count}</span><span>DBs ${project.database_count}</span></div>
    </div>
  `);
  fillSelect('environment-project', byActiveOrg(state.projects), (project) => `${project.name} · ${project.org_name}`);
  fillSelect('db-project', byActiveOrg(state.projects), (project) => `${project.name} · ${project.org_name}`);
  fillSelect('api-key-project', byActiveOrg(state.projects), (project) => `${project.name} · ${project.org_name}`);
}

function renderEnvironments() {
  renderList('environment-list', byActiveOrg(state.environments), (env) => `
    <div class="item">
      <strong>${env.name}</strong>
      <div class="meta"><span>${env.org_name}</span><span>${env.project_name}</span><span>${env.kind}</span><span>${env.slug}</span></div>
    </div>
  `);
  fillSelect('db-environment', byActiveOrg(state.environments), (env) => `${env.project_name} · ${env.name}`, (env) => env.id, true);
}

function renderDatabases() {
  renderList('database-list', byActiveOrg(state.databases), (db) => {
    const dsn = db.connection_uri ? `<div class="dsn">${db.connection_uri}</div>` : '';
    return `
      <div class="item">
        <strong>${db.name}</strong>
        <div class="meta">
          <span>${db.org_name}</span>
          <span>${db.project_name}</span>
          <span>${db.environment_name || 'no env'}</span>
          ${badge(db.status)}
          <span>${db.plan_code}</span>
        </div>
        <div class="meta" style="margin-top:8px;">
          <span>${db.db_name}</span>
          <span>${db.db_user}</span>
          <span>${db.public_hostname}:${db.public_port}</span>
          <span>SSL ${db.public_ssl_mode}</span>
        </div>
        ${db.password ? `<div class="meta" style="margin-top:8px;"><span>Password ${db.password}</span></div>` : ''}
        ${dsn}
      </div>
    `;
  });
  fillSelect('branch-source', byActiveOrg(state.databases), (db) => `${db.name} · ${db.status}`);
  fillSelect('backup-instance', byActiveOrg(state.databases), (db) => `${db.name} · ${db.db_name}`);
}

function renderJobs() {
  renderList('job-list', byActiveOrg(state.jobs), (job) => `
    <div class="item">
      <strong>${job.job_type}</strong>
      <div class="meta">
        ${badge(job.status)}
        <span>${job.org_name || ''}</span>
        <span>${job.project_name || ''}</span>
        <span>${job.instance_name || ''}</span>
        <span>${new Date(job.created_at).toLocaleString()}</span>
      </div>
      ${job.error ? `<div class="meta" style="margin-top:8px;color:#fecaca;">${job.error}</div>` : ''}
      <pre class="code small" style="margin-top:10px;">${JSON.stringify(job.result || {}, null, 2)}</pre>
    </div>
  `);
}

function renderBackups() {
  renderList('backup-list', byActiveOrg(state.backups), (backup) => `
    <div class="item">
      <strong>${backup.instance_name || backup.instance_id}</strong>
      <div class="meta">
        ${badge(backup.status)}
        <span>${backup.org_name || ''}</span>
        <span>${backup.project_name || ''}</span>
        <span>${backup.object_key || 'pending object key'}</span>
        <span>${backup.size_bytes || 0} bytes</span>
      </div>
    </div>
  `);
  fillSelect('restore-backup', byActiveOrg(state.backups), (backup) => `${backup.instance_name || backup.instance_id} · ${backup.status} · ${backup.id}`);
}

function renderAudit() {
  renderList('audit-list', byActiveOrg(state.audit), (event) => `
    <div class="item">
      <strong>${event.action}</strong>
      <div class="meta"><span>${event.actor}</span><span>${event.org_name || 'platform'}</span><span>${event.entity_type}</span><span>${new Date(event.created_at).toLocaleString()}</span></div>
      <pre class="code small" style="margin-top:10px;">${JSON.stringify(event.details || {}, null, 2)}</pre>
    </div>
  `);
}

function renderUsage() {
  renderList('usage-summary', byActiveOrg(state.usage.summary), (row) => `
    <div class="item">
      <strong>${row.event_type}</strong>
      <div class="meta"><span>${row.org_name}</span><span>${row.total_quantity} ${row.unit}</span><span>${new Date(row.last_seen_at).toLocaleString()}</span></div>
    </div>
  `);
  renderList('usage-recent', byActiveOrg(state.usage.recent), (row) => `
    <div class="item">
      <strong>${row.event_type}</strong>
      <div class="meta"><span>${row.org_name}</span><span>${row.project_name || ''}</span><span>${row.instance_name || ''}</span><span>${row.quantity} ${row.unit}</span></div>
      <pre class="code small" style="margin-top:10px;">${JSON.stringify(row.metadata || {}, null, 2)}</pre>
    </div>
  `);
}

function renderBilling() {
  if (!state.billingSummary || !state.billingSummary.org) {
    el('billing-summary').innerHTML = '<div class="item"><span class="muted">Pick an organization to load billing.</span></div>';
    fillSelect('billing-invoice-select', [], (row) => row.invoice_number, (row) => row.id, true);
    return;
  }
  const { org, billing_customer, subscription, invoices, checkout_sessions } = state.billingSummary;
  if (subscription) el('billing-plan').value = subscription.plan_code || subscription.plan?.plan_code || el('billing-plan').value;
  el('billing-email').value = billing_customer?.billing_email || subscription?.billing_email || '';
  el('billing-legal-name').value = billing_customer?.legal_name || org.name || '';
  el('billing-cancel-at-period-end').checked = Boolean(subscription?.cancel_at_period_end);
  fillSelect('billing-invoice-select', invoices || [], (row) => `${row.invoice_number} · ${row.status} · ${(Number(row.total_cents || 0) / 100).toFixed(2)} ${row.currency}`, (row) => row.id, true);
  el('billing-summary').innerHTML = `
    <div class="item">
      <strong>${org.name}</strong>
      <div class="meta">${badge(subscription?.status || 'inactive')}<span>${subscription?.plan?.display_name || subscription?.plan_code || 'none'}</span><span>${billing_customer?.billing_email || 'no billing email'}</span></div>
      <div class="meta" style="margin-top:8px;"><span>Amount ${(Number(subscription?.amount_cents || 0) / 100).toFixed(2)} ${(subscription?.currency || 'usd').toUpperCase()} / ${subscription?.billing_interval || 'month'}</span><span>Trial ends ${subscription?.trial_ends_at ? new Date(subscription.trial_ends_at).toLocaleString() : '—'}</span></div>
    </div>
    <div class="item">
      <strong>Invoices</strong>
      ${(invoices || []).slice(0, 5).map((invoice) => `<div class="meta"><span>${invoice.invoice_number}</span>${badge(invoice.status)}<span>${(Number(invoice.total_cents || 0) / 100).toFixed(2)} ${invoice.currency}</span></div>`).join('') || '<div class="meta"><span>No invoices yet.</span></div>'}
    </div>
    <div class="item">
      <strong>Checkout sessions</strong>
      ${(checkout_sessions || []).slice(0, 5).map((session) => `<div class="meta"><span>${session.session_token}</span>${badge(session.status)}<span>${(Number(session.amount_cents || 0) / 100).toFixed(2)} ${session.currency}</span></div>`).join('') || '<div class="meta"><span>No checkout sessions yet.</span></div>'}
    </div>
  `;
}

function renderSignups() {
  renderList('signup-list', state.signups, (signup) => `
    <div class="item">
      <strong>${signup.org_name}</strong>
      <div class="meta"><span>${signup.email}</span>${badge(signup.status)}<span>${signup.desired_plan_code}</span><span>${new Date(signup.created_at).toLocaleString()}</span></div>
      <div class="meta" style="margin-top:8px;"><span>${signup.activated_org_name || 'pending activation'}</span><span>${signup.activated_user_email || ''}</span></div>
    </div>
  `);
}

async function refreshPlans() { state.plans = await api('/v1/plans'); renderPlans(); }

async function refreshAuthSync(createPersonal = false) {
  const payload = createPersonal
    ? { org_name: el('personal-org-name').value.trim() || 'My Workspace' }
    : { create_personal_org: !state.pendingSignupToken };
  if (state.pendingSignupToken) payload.signup_token = state.pendingSignupToken;
  const body = await api('/v1/auth/sync', { method: 'POST', body: JSON.stringify(payload) });
  state.authUser = body.user;
  if (!state.activeOrgId && body.default_org_id) {
    state.activeOrgId = body.default_org_id;
    localStorage.setItem('skyedb_active_org_id', state.activeOrgId);
  }
  if (body.activated_signup) {
    state.pendingSignupToken = '';
    localStorage.removeItem('skyedb_pending_signup_token');
    el('pending-signup-token').value = '';
  }
  updateAuthStatus();
  log('Auth synced', body);
  return body;
}

async function refreshOrganizations() { state.orgs = await api('/v1/orgs'); if (!state.activeOrgId && state.orgs[0]) { state.activeOrgId = state.orgs[0].id; localStorage.setItem('skyedb_active_org_id', state.activeOrgId); } renderOrganizations(); }
async function refreshOrgDetail() { if (!state.activeOrgId) { state.orgDetail = null; renderOrgDetail(); return; } state.orgDetail = await api(`/v1/orgs/${state.activeOrgId}`); renderOrgDetail(); }
async function refreshProjects() { state.projects = await api('/v1/projects'); renderProjects(); }
async function refreshEnvironments() { state.environments = await api('/v1/environments'); renderEnvironments(); }
async function refreshDatabases() { const rows = await api('/v1/databases'); state.databases = await Promise.all(rows.map((db) => api(`/v1/databases/${db.id}`))); renderDatabases(); }
async function refreshJobs() { state.jobs = await api('/v1/jobs'); renderJobs(); }
async function refreshBackups() { state.backups = await api('/v1/backups'); renderBackups(); }
async function refreshAudit() { state.audit = await api('/v1/audit'); renderAudit(); }
async function refreshUsage() { state.usage = await api('/v1/usage'); renderUsage(); }
async function refreshBilling() { if (!state.activeOrgId) { state.billingSummary = null; renderBilling(); return; } state.billingSummary = await api(`/v1/orgs/${state.activeOrgId}/billing`); renderBilling(); }
async function refreshSignups() { try { state.signups = await api('/v1/signups'); } catch (error) { state.signups = []; } renderSignups(); }

async function refreshAll() {
  await Promise.all([refreshPlans(), refreshOrganizations(), refreshProjects(), refreshEnvironments(), refreshDatabases(), refreshJobs(), refreshBackups(), refreshAudit(), refreshUsage(), refreshSignups()]);
  await refreshOrgDetail();
  await refreshBilling();
}

async function checkHealth() {
  if (!state.apiBase) throw new Error('Set the Worker API base URL first.');
  const response = await fetch(`${state.apiBase}/v1/health`);
  const body = await response.json();
  el('health-status').textContent = body.ok ? 'Healthy' : 'Unhealthy';
  log('Health checked', body);
}

function bootIdentity() {
  if (!window.netlifyIdentity) return;
  window.netlifyIdentity.on('init', async (user) => {
    state.identityUser = user || null;
    if (user) {
      state.identityToken = await user.jwt();
      el('identity-output').textContent = JSON.stringify({ email: user.email, role: user.role || 'user' }, null, 2);
      updateAuthStatus();
    }
  });
  window.netlifyIdentity.on('login', async (user) => {
    state.identityUser = user;
    state.identityToken = await user.jwt();
    el('identity-output').textContent = JSON.stringify({ email: user.email, role: user.role || 'user' }, null, 2);
    updateAuthStatus();
    log('Netlify Identity login success', { email: user.email });
    try { await refreshAuthSync(false); await refreshAll(); } catch (error) { log('Refresh after identity login failed', { error: error.message }); }
    window.netlifyIdentity.close();
  });
  window.netlifyIdentity.on('logout', () => { state.identityUser = null; state.identityToken = ''; state.authUser = null; el('identity-output').textContent = ''; updateAuthStatus(); });
  window.netlifyIdentity.init();
}

function bindEvents() {
  el('api-base').value = state.apiBase;
  el('manual-token').value = state.manualToken;
  el('pending-signup-token').value = state.pendingSignupToken;

  el('save-settings').addEventListener('click', () => {
    state.apiBase = el('api-base').value.trim().replace(/\/$/, '');
    state.manualToken = el('manual-token').value.trim();
    state.pendingSignupToken = el('pending-signup-token').value.trim();
    localStorage.setItem('skyedb_api_base', state.apiBase);
    localStorage.setItem('skyedb_manual_token', state.manualToken);
    if (state.pendingSignupToken) localStorage.setItem('skyedb_pending_signup_token', state.pendingSignupToken); else localStorage.removeItem('skyedb_pending_signup_token');
    updateAuthStatus();
    log('Settings saved', { apiBase: state.apiBase, manualTokenLoaded: Boolean(state.manualToken), pendingSignupToken: Boolean(state.pendingSignupToken) });
  });
  el('clear-signup-token').addEventListener('click', () => { state.pendingSignupToken = ''; el('pending-signup-token').value = ''; localStorage.removeItem('skyedb_pending_signup_token'); log('Pending signup token cleared'); });

  el('check-health').addEventListener('click', () => checkHealth().catch((error) => log('Health check failed', { error: error.message })));
  el('identity-login').addEventListener('click', () => window.netlifyIdentity && window.netlifyIdentity.open());
  el('identity-logout').addEventListener('click', () => window.netlifyIdentity && window.netlifyIdentity.logout());
  el('sync-auth').addEventListener('click', async () => { try { await refreshAuthSync(false); await refreshAll(); } catch (error) { log('Auth sync failed', { error: error.message }); } });
  el('sync-auth-create').addEventListener('click', async () => { try { await refreshAuthSync(true); await refreshAll(); } catch (error) { log('Auth sync + create failed', { error: error.message }); } });

  el('active-org').addEventListener('change', async (event) => {
    state.activeOrgId = event.target.value;
    localStorage.setItem('skyedb_active_org_id', state.activeOrgId);
    renderProjects(); renderEnvironments(); renderDatabases(); renderJobs(); renderBackups(); renderAudit(); renderUsage();
    await refreshOrgDetail().catch((error) => log('Refresh org detail failed', { error: error.message }));
    await refreshBilling().catch((error) => log('Refresh billing failed', { error: error.message }));
  });

  el('create-org').addEventListener('click', async () => { try { const body = await api('/v1/orgs', { method: 'POST', body: JSON.stringify({ name: el('org-name').value.trim(), plan_code: el('org-plan').value }) }); log('Organization created', body); el('org-name').value = ''; await refreshOrganizations(); await refreshOrgDetail(); await refreshBilling(); } catch (error) { log('Create org failed', { error: error.message }); } });
  el('add-member').addEventListener('click', async () => { try { const orgId = el('member-org').value; const body = await api(`/v1/orgs/${orgId}/members`, { method: 'POST', body: JSON.stringify({ email: el('member-email').value.trim(), role: el('member-role').value }) }); log('Member upserted', body); el('member-email').value = ''; if (orgId === state.activeOrgId) await refreshOrgDetail(); } catch (error) { log('Add member failed', { error: error.message }); } });
  el('create-project').addEventListener('click', async () => { try { const body = await api('/v1/projects', { method: 'POST', body: JSON.stringify({ org_id: el('project-org').value, name: el('project-name').value.trim() }) }); log('Project created', body); el('project-name').value = ''; await refreshProjects(); await refreshOrgDetail(); } catch (error) { log('Create project failed', { error: error.message }); } });
  el('create-environment').addEventListener('click', async () => { try { const body = await api('/v1/environments', { method: 'POST', body: JSON.stringify({ project_id: el('environment-project').value, name: el('environment-name').value.trim(), kind: el('environment-kind').value }) }); log('Environment created', body); el('environment-name').value = ''; await refreshEnvironments(); } catch (error) { log('Create environment failed', { error: error.message }); } });
  el('create-api-key').addEventListener('click', async () => { try { const body = await api(`/v1/projects/${el('api-key-project').value}/api-keys`, { method: 'POST', body: JSON.stringify({ name: el('api-key-name').value.trim() }) }); el('api-key-output').textContent = JSON.stringify(body, null, 2); log('Project API key created', { prefix: body.prefix, project_id: body.project_id }); el('api-key-name').value = ''; } catch (error) { log('Create API key failed', { error: error.message }); } });
  el('refresh-api-keys').addEventListener('click', async () => { try { const body = await api(`/v1/projects/${el('api-key-project').value}/api-keys`); el('api-key-output').textContent = JSON.stringify(body, null, 2); log('Loaded API keys', { count: body.api_keys?.length || 0 }); } catch (error) { log('Load API keys failed', { error: error.message }); } });
  el('create-db').addEventListener('click', async () => { try { const body = await api('/v1/databases', { method: 'POST', body: JSON.stringify({ project_id: el('db-project').value, environment_id: el('db-environment').value || null, name: el('db-name').value.trim(), plan_code: el('db-plan').value }) }); log('Database job queued', body); el('db-name').value = ''; await refreshDatabases(); await refreshJobs(); await refreshOrgDetail(); } catch (error) { log('Create database failed', { error: error.message }); } });
  el('branch-db').addEventListener('click', async () => { try { const sourceId = el('branch-source').value; const body = await api(`/v1/databases/${sourceId}/branch`, { method: 'POST', body: JSON.stringify({ name: el('branch-name').value.trim() }) }); log('Branch job queued', body); el('branch-name').value = ''; await refreshDatabases(); await refreshJobs(); await refreshOrgDetail(); } catch (error) { log('Branch database failed', { error: error.message }); } });
  el('run-backup').addEventListener('click', async () => { try { const body = await api(`/v1/databases/${el('backup-instance').value}/backup`, { method: 'POST' }); log('Backup queued', body); await refreshBackups(); await refreshJobs(); } catch (error) { log('Backup failed', { error: error.message }); } });
  el('run-rotate').addEventListener('click', async () => { try { const body = await api(`/v1/databases/${el('backup-instance').value}/rotate-password`, { method: 'POST' }); log('Rotate queued', body); await refreshDatabases(); await refreshJobs(); } catch (error) { log('Rotate failed', { error: error.message }); } });
  el('run-restore').addEventListener('click', async () => { try { const body = await api(`/v1/databases/${el('backup-instance').value}/restore`, { method: 'POST', body: JSON.stringify({ backup_id: el('restore-backup').value }) }); log('Restore queued', body); await refreshJobs(); } catch (error) { log('Restore failed', { error: error.message }); } });

  el('update-subscription').addEventListener('click', async () => { try { const body = await api(`/v1/orgs/${state.activeOrgId}/billing/subscription`, { method: 'POST', body: JSON.stringify({ plan_code: el('billing-plan').value, billing_email: el('billing-email').value.trim(), legal_name: el('billing-legal-name').value.trim(), cancel_at_period_end: el('billing-cancel-at-period-end').checked, issue_invoice: true }) }); state.billingSummary = body; renderBilling(); log('Subscription updated', body.subscription); await refreshOrganizations(); await refreshOrgDetail(); } catch (error) { log('Update subscription failed', { error: error.message }); } });
  el('create-checkout-session').addEventListener('click', async () => { try { const body = await api(`/v1/orgs/${state.activeOrgId}/billing/checkout-sessions`, { method: 'POST', body: JSON.stringify({ plan_code: el('billing-plan').value }) }); log('Checkout session created', body); await refreshBilling(); } catch (error) { log('Create checkout session failed', { error: error.message }); } });
  el('mark-invoice-paid').addEventListener('click', async () => { try { const invoiceId = el('billing-invoice-select').value; if (!invoiceId) throw new Error('Select an invoice first'); const body = await api(`/v1/orgs/${state.activeOrgId}/billing/invoices/${invoiceId}/pay`, { method: 'POST' }); log('Invoice marked paid', body); await refreshBilling(); await refreshOrganizations(); await refreshOrgDetail(); } catch (error) { log('Mark invoice paid failed', { error: error.message }); } });

  [['refresh-orgs', refreshOrganizations], ['refresh-org-detail', refreshOrgDetail], ['refresh-projects', refreshProjects], ['refresh-environments', refreshEnvironments], ['refresh-databases', refreshDatabases], ['refresh-jobs', refreshJobs], ['refresh-backups', refreshBackups], ['refresh-audit', refreshAudit], ['refresh-usage', refreshUsage], ['refresh-plans', refreshPlans], ['refresh-billing', refreshBilling], ['refresh-signups', refreshSignups]].forEach(([id, fn]) => { el(id).addEventListener('click', () => fn().catch((error) => log(`${id} failed`, { error: error.message }))); });
}

async function boot() {
  bindEvents();
  bootIdentity();
  updateAuthStatus();
  try { if (state.apiBase) { await checkHealth(); await refreshPlans(); } } catch (error) { log('Initial health check failed', { error: error.message }); }
}

window.addEventListener('load', () => { boot().catch((error) => log('Boot failed', { error: error.message })); });
