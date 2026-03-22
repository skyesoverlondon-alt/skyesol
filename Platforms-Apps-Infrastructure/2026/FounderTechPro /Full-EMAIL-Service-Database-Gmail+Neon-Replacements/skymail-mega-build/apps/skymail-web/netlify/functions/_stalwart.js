
const { requireEnv } = require('./_utils');

function stalwartBaseUrl(){
  return String(requireEnv('STALWART_BASE_URL')).replace(/\/$/, '');
}

function stalwartHeaders(extra = {}){
  const headerName = String(process.env.STALWART_MANAGEMENT_AUTH_HEADER || 'Authorization').trim();
  const prefix = String(process.env.STALWART_MANAGEMENT_AUTH_PREFIX || 'Bearer ').replace(/\$\{token\}/g, '');
  const token = requireEnv('STALWART_MANAGEMENT_API_KEY');
  const headers = { 'Accept':'application/json', [headerName]: `${prefix}${token}` };
  if (extra && extra['Content-Type']) headers['Content-Type'] = extra['Content-Type'];
  return Object.assign(headers, extra || {});
}

async function stalwartRequest(path, opts = {}){
  const res = await fetch(`${stalwartBaseUrl()}${path}`, Object.assign({}, opts, { headers: stalwartHeaders(opts.headers || {}) }));
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch(_err){ data = { raw:text }; }
  if (!res.ok) {
    const msg = data?.detail || data?.error || data?.message || text || `Stalwart API failed (${res.status}).`;
    const err = new Error(msg);
    err.statusCode = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function listPrincipalsByType(type){
  const data = await stalwartRequest(`/api/principal?limit=500&types=${encodeURIComponent(type)}`);
  return Array.isArray(data?.data?.items) ? data.data.items : [];
}

async function createPrincipal(payload){
  const data = await stalwartRequest('/api/principal', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(payload),
  });
  return data?.data;
}

async function fetchPrincipal(id){
  const data = await stalwartRequest(`/api/principal/${encodeURIComponent(id)}`);
  return data?.data || null;
}

async function patchPrincipal(id, patchOps){
  const data = await stalwartRequest(`/api/principal/${encodeURIComponent(id)}`, {
    method:'PATCH',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(patchOps),
  });
  return data?.data || null;
}

async function deletePrincipal(id){
  const data = await stalwartRequest(`/api/principal/${encodeURIComponent(id)}`, { method:'DELETE' });
  return data?.data || null;
}

async function findDomainPrincipal(domain){
  const domains = await listPrincipalsByType('domain');
  const target = String(domain || '').toLowerCase();
  return domains.find((row)=> String(row.name || row.description || '').toLowerCase() === target || String(row.emails || '').toLowerCase() === target) || null;
}

async function ensureDomainPrincipal(domain){
  const existing = await findDomainPrincipal(domain);
  if (existing) return existing;
  await createPrincipal({
    type: 'domain',
    quota: 0,
    name: domain,
    description: `${domain} public mailbox domain`,
    secrets: [],
    emails: [],
    urls: [],
    memberOf: [],
    roles: [],
    lists: [],
    members: [],
    enabledPermissions: [],
    disabledPermissions: [],
    externalMembers: [],
  });
  return await findDomainPrincipal(domain);
}

async function findPrincipalByEmail(email){
  const items = await listPrincipalsByType('individual');
  const target = String(email || '').toLowerCase();
  return items.find((row)=> {
    const emails = [];
    const raw = row.emails;
    if (Array.isArray(raw)) emails.push(...raw);
    else if (typeof raw === 'string') emails.push(...raw.split(/[\s,]+/g));
    return emails.map((x)=>String(x||'').toLowerCase()).includes(target);
  }) || null;
}

async function createMailboxPrincipal({ localPart, domain, password, displayName, quotaMb = 1024 }){
  await ensureDomainPrincipal(domain);
  const email = `${localPart}@${domain}`.toLowerCase();
  const existing = await findPrincipalByEmail(email);
  if (existing) {
    const err = new Error('That mailbox address is already taken.');
    err.statusCode = 409;
    throw err;
  }
  const principalId = await createPrincipal({
    type: 'individual',
    quota: Number(quotaMb || 1024) * 1024 * 1024,
    name: localPart,
    description: displayName || localPart,
    secrets: [password],
    emails: [email],
    urls: [],
    memberOf: [],
    roles: ['user'],
    lists: ['all'],
    members: [],
    enabledPermissions: [],
    disabledPermissions: [],
    externalMembers: [],
  });
  return { id: principalId, email };
}

async function updateMailboxPassword(principalId, password){
  await patchPrincipal(principalId, [{ action:'set', field:'secrets', value:[password] }]);
}

module.exports = {
  stalwartBaseUrl,
  stalwartRequest,
  listPrincipalsByType,
  createPrincipal,
  fetchPrincipal,
  patchPrincipal,
  deletePrincipal,
  findDomainPrincipal,
  ensureDomainPrincipal,
  findPrincipalByEmail,
  createMailboxPrincipal,
  updateMailboxPassword,
};
