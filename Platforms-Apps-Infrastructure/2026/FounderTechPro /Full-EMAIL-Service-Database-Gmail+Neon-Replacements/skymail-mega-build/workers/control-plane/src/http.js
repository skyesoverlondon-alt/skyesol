export function json(data, status = 200, env) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (env?.CORS_ORIGIN) {
    headers.set('Access-Control-Allow-Origin', env.CORS_ORIGIN);
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  return new Response(JSON.stringify(data, null, 2), { status, headers });
}

export function noContent(env) {
  const headers = new Headers();
  if (env?.CORS_ORIGIN) {
    headers.set('Access-Control-Allow-Origin', env.CORS_ORIGIN);
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  return new Response(null, { status: 204, headers });
}

export async function readJson(request) {
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
}

export function makeDbIdent(prefix, slug) {
  const clean = `${prefix}_${slug.replace(/-/g, '_')}`.replace(/[^a-zA-Z0-9_]/g, '_');
  return clean.slice(0, 50);
}

export function randomSuffix(length = 6) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function strongPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+';
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
