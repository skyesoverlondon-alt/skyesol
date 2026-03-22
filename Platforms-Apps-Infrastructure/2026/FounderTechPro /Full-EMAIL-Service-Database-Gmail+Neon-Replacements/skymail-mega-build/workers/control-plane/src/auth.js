function decodeBase64Url(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return JSON.parse(Buffer.from(normalized + padding, 'base64').toString('utf8'));
}

async function verifyHmac(secret, signingInput, signatureB64Url) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const normalized = signatureB64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const signature = Uint8Array.from(Buffer.from(normalized + padding, 'base64'));
  return crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(signingInput));
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function isSuperAdminEmail(email, env) {
  return parseCsv(env.SUPERADMIN_EMAILS).includes(String(email || '').trim().toLowerCase());
}

export async function requireAuth(request, env) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) throw new Error('Missing Bearer token');

  if (env.BOOTSTRAP_ADMIN_TOKEN && token === env.BOOTSTRAP_ADMIN_TOKEN) {
    return {
      actor: 'bootstrap-admin',
      mode: 'bootstrap',
      user_id: null,
      email: 'bootstrap-admin',
      is_super_admin: true,
      claims: {},
    };
  }

  if (!env.NETLIFY_IDENTITY_JWT_SECRET) {
    throw new Error('No matching bootstrap token and NETLIFY_IDENTITY_JWT_SECRET is not configured');
  }

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const [headerB64, payloadB64, sigB64] = parts;
  const header = decodeBase64Url(headerB64);
  const payload = decodeBase64Url(payloadB64);

  if (header.alg !== 'HS256') throw new Error('Unsupported JWT algorithm');
  const ok = await verifyHmac(env.NETLIFY_IDENTITY_JWT_SECRET, `${headerB64}.${payloadB64}`, sigB64);
  if (!ok) throw new Error('JWT verification failed');
  if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error('JWT expired');

  const email = String(payload.email || '').trim().toLowerCase();
  const roles = [];
  if (Array.isArray(payload.app_metadata?.roles)) roles.push(...payload.app_metadata.roles);
  if (Array.isArray(payload.user_metadata?.roles)) roles.push(...payload.user_metadata.roles);
  const normalizedRoles = roles.map((role) => String(role || '').toLowerCase());
  const isSuperAdmin = normalizedRoles.includes('superadmin') || normalizedRoles.includes('owner') || isSuperAdminEmail(email, env);

  return {
    actor: payload.email || payload.sub || 'identity-user',
    mode: 'netlify-identity',
    user_id: null,
    email,
    full_name: payload.user_metadata?.full_name || payload.user_metadata?.name || payload.email || '',
    auth_subject: payload.sub || email,
    is_super_admin: isSuperAdmin,
    claims: payload,
  };
}
