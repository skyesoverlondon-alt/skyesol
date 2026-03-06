import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import crypto from 'crypto';

const {
  NEON_DATABASE_URL,
  APP_JWT_SECRET,
  ORIGIN_ALLOWLIST = '',
  APP_BASE_URL = '',
  APP_ENV = 'production',
  ENABLE_RLS = 'false',
  SAML_ENABLED = 'false',
  SIEM_ENABLED = 'true',
  SIEM_MAX_BATCH = '100',
  SIEM_LOCK_SECONDS = '30',
  SIEM_RETRY_BASE_SECONDS = '15',

  // Rate limiting
  RATE_LIMIT_MODE = 'db',               // 'db' (distributed) or 'memory' (best-effort)
  RATE_LIMIT_PER_MINUTE = '120',
  AUTH_RATE_LIMIT_PER_MINUTE = '30',

  // Auth hardening
  LOGIN_MAX_ATTEMPTS = '10',
  LOGIN_LOCK_MINUTES = '15',
  REQUIRE_EMAIL_VERIFICATION = 'false', // when true, blocks project writes until verified
  MAIL_MODE = 'outbox',                 // 'outbox' queues emails into email_outbox; 'dev' returns tokens in responses
  SESSION_TTL_DAYS = '7',

  COOKIE_SECURE = 'true', // set false for localhost http testing
} = process.env;

if (!NEON_DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.error('Missing NEON_DATABASE_URL env var');
}
if (!APP_JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.error('Missing APP_JWT_SECRET env var');
}

const ENV = String(process.env.APP_ENV || 'production').toLowerCase();
const DB_URL = (ENV === 'staging' ? (process.env.NEON_DATABASE_URL_STAGING || NEON_DATABASE_URL) : ENV === 'preview' ? (process.env.NEON_DATABASE_URL_PREVIEW || NEON_DATABASE_URL) : NEON_DATABASE_URL);
const sql = neon(DB_URL);
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

const ALLOWLIST = ORIGIN_ALLOWLIST.split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Basic wildcard support: https://*.netlify.app
function isAllowedOrigin(origin, rules = ALLOWLIST) {
  if (!origin) return false;
  if (rules.length === 0) return true; // default allow if not set (dev-friendly)
  for (const rule of rules) {
    if (rule === origin) return true;
    if (rule.includes('*')) {
      const escaped = rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      const re = new RegExp('^' + escaped + '$');
      if (re.test(origin)) return true;
    }
  }
  return false;
}

function corsHeaders(origin) {
  const ok = isAllowedOrigin(origin);
  return {
    'access-control-allow-origin': ok ? origin : (ALLOWLIST[0] || 'null'),
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,x-csrf-token,x-request-id',
    'access-control-max-age': '600',
    'vary': 'Origin',
  };
}


async function deliverSiemBatch(orgId, maxBatch) {
  // Acquire a batch of due messages with a short lock to prevent duplicate delivery.
  const lockSec = clampInt(process.env.SIEM_LOCK_SECONDS || SIEM_LOCK_SECONDS, 5, 300, 30);
  const batch = clampInt(maxBatch, 1, 500, 100);

  const rows = await sql`
    WITH picked AS (
      SELECT id
      FROM siem_outbox
      WHERE delivered_at IS NULL
        AND next_attempt_at <= now()
        AND (locked_until IS NULL OR locked_until <= now())
        AND org_id = ${orgId}
      ORDER BY created_at ASC
      LIMIT ${batch}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE siem_outbox o
      SET locked_until = now() + make_interval(secs => ${lockSec})
    FROM picked
    WHERE o.id = picked.id
    RETURNING o.id, o.payload_json, o.attempts
  `;

  if (!rows || rows.length === 0) return { ok:true, delivered:0 };

  const cfg = await sql`SELECT endpoint_url, auth_header FROM org_siem_configs WHERE org_id = ${orgId} LIMIT 1`;
  if (!cfg || cfg.length === 0) return { ok:false, error:'siem_not_configured', delivered:0 };

  const endpoint = cfg[0].endpoint_url;
  const auth = cfg[0].auth_header;

  let delivered = 0;

  for (const r of rows) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(auth ? { 'authorization': auth } : {}),
          'x-webpile-org': String(orgId),
        },
        body: JSON.stringify({ id: r.id, ...r.payload_json }),
      });

      if (resp.ok) {
        delivered++;
        await sql`UPDATE siem_outbox SET delivered_at = now(), locked_until = NULL, last_error = NULL WHERE id = ${r.id}`;
        await sql`INSERT INTO metrics_counters (k, v, updated_at) VALUES ('siem.delivered', 1, now())
                  ON CONFLICT (k) DO UPDATE SET v = metrics_counters.v + 1, updated_at = now()`;
      } else {
        const txt = await resp.text().catch(()=> '');
        throw new Error(`http_${resp.status}:${txt.slice(0,200)}`);
      }
    } catch (e) {
      const attempts = Number(r.attempts || 0) + 1;
      const base = clampInt(process.env.SIEM_RETRY_BASE_SECONDS || SIEM_RETRY_BASE_SECONDS, 5, 3600, 15);
      const delay = Math.min(3600, base * Math.pow(2, Math.min(8, attempts))); // capped exponential backoff
      await sql`UPDATE siem_outbox
                SET attempts = ${attempts},
                    next_attempt_at = now() + make_interval(secs => ${delay}),
                    locked_until = NULL,
                    last_error = ${String(e?.message || e)}
                WHERE id = ${r.id}`;
      await sql`INSERT INTO metrics_counters (k, v, updated_at) VALUES ('siem.fail', 1, now())
                ON CONFLICT (k) DO UPDATE SET v = metrics_counters.v + 1, updated_at = now()`;
    }
  }

  return { ok:true, delivered };
}

function json(statusCode, body, origin, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...corsHeaders(origin), ...extraHeaders },
    body: JSON.stringify(body),
  };
}

function text(statusCode, body, origin, extraHeaders = {}) {
  return {
    statusCode,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...corsHeaders(origin), ...extraHeaders },
    body: String(body ?? ''),
  };
}

function requestId(event) {
  const h = event.headers || {};
  return h['x-request-id'] || h['X-Request-Id'] || crypto.randomUUID();
}

function ipOf(event) {
  const h = event.headers || {};
  return (
    h['x-nf-client-connection-ip'] ||
    h['x-forwarded-for']?.split(',')[0]?.trim() ||
    h['client-ip'] ||
    ''
  );
}

function uaOf(event) {
  const h = event.headers || {};
  return h['user-agent'] || h['User-Agent'] || '';
}

// Rate limiting
// Default: distributed rate limiting via Postgres (rate_limits table).
// Fallback: in-memory (best-effort) if DB is unavailable or RATE_LIMIT_MODE=memory.
const RL = new Map();
function rateLimitOkMem(key, limitPerMinute) {
  const now = Date.now();
  const windowMs = 60_000;
  const rec = RL.get(key) || { ts: now, count: 0 };
  if (now - rec.ts > windowMs) {
    rec.ts = now;
    rec.count = 0;
  }
  rec.count += 1;
  RL.set(key, rec);
  return rec.count <= limitPerMinute;
}

async function rateLimitOk(key, limitPerMinute) {
  const mode = String(RATE_LIMIT_MODE || 'db').toLowerCase();
  if (mode !== 'db') return rateLimitOkMem(key, limitPerMinute);

  try {
    const rows = await sql`
      WITH w AS (SELECT date_trunc('minute', now()) AS ws)
      INSERT INTO rate_limits (key, window_start, count, updated_at)
      SELECT ${key}, w.ws, 1, now() FROM w
      ON CONFLICT (key) DO UPDATE
        SET count = CASE
          WHEN rate_limits.window_start = (SELECT ws FROM w) THEN rate_limits.count + 1
          ELSE 1
        END,
        window_start = (SELECT ws FROM w),
        updated_at = now()
      RETURNING count
    `;
    const c = Number(rows?.[0]?.count || 0);
    return c <= limitPerMinute;
  } catch (_) {
    // Table missing / DB hiccup → degrade gracefully.
    return rateLimitOkMem(key, limitPerMinute);
  }
}

function parseBody(event) {
  try {
    if (!event.body) return null;
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function cookiesOf(event) {
  const h = event.headers || {};
  const raw = h.cookie || h.Cookie || '';
  return parseCookie(raw || '');
}

function cookieOptions(event) {
  const secure = String(COOKIE_SECURE).toLowerCase() !== 'false';
  // Netlify uses https by default; Secure cookies should be on.
  // For local testing, set COOKIE_SECURE=false.
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  };
}

function csrfCookieOptions(event) {
  const secure = String(COOKIE_SECURE).toLowerCase() !== 'false';
  return {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
  };
}

function signSession(payload) {
  const days = clampInt(SESSION_TTL_DAYS, 1, 30, 7);
  // jwtid adds per-session uniqueness (helps auditing/debugging)
  return jwt.sign(payload, APP_JWT_SECRET, { expiresIn: `${days}d`, jwtid: crypto.randomUUID() });
}

function verifySession(token) {
  try {
    return jwt.verify(token, APP_JWT_SECRET);
  } catch (_) {
    return null;
  }
}

function requireAuth(event) {
  const c = cookiesOf(event);
  const tok = c.wpp_session;
  if (!tok) return null;
  const sess = verifySession(tok);
  if (!sess || !sess.sub || !sess.orgId) return null;
  if (sess.tv == null) return null;
  return sess;
}



function requireCsrf(event) {
  const method = (event.httpMethod || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
  const c = cookiesOf(event);
  const csrfCookie = c.wpp_csrf || '';
  const h = event.headers || {};
  const csrfHeader = h['x-csrf-token'] || h['X-CSRF-Token'] || '';
  return csrfCookie && csrfHeader && csrfCookie === csrfHeader;

}

async function listUserOrgs(userId) {
  const rows = await sql`
    SELECT m.org_id AS id, o.name, m.role
    FROM memberships m
    JOIN orgs o ON o.id = m.org_id
    WHERE m.user_id = ${userId}
    ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, o.name ASC
  `;
  return rows || [];
}

async function loadSessionContext(event, sess) {
  const rows = await sql`
    SELECT
      u.id AS user_id,
      u.email,
      u.email_verified,
      u.token_version,
      m.org_id,
      m.role,
      o.name AS org_name
    FROM users u
    JOIN memberships m ON m.user_id = u.id
    JOIN orgs o ON o.id = m.org_id
    WHERE u.id = ${sess.sub} AND m.org_id = ${sess.orgId}
    LIMIT 1
  `;
  if (!rows || rows.length === 0) return null;

  const r = rows[0];
  if (Number(r.token_version) !== Number(sess.tv)) return null; // session revoked

  const orgs = await listUserOrgs(r.user_id);

  return {
    userId: r.user_id,
    orgId: r.org_id,
    role: r.role,
    user: { id: r.user_id, email: r.email, emailVerified: !!r.email_verified },
    org: { id: r.org_id, name: r.org_name },
    orgs,
    tokenVersion: Number(r.token_version),
  };
}

function sessionClearingCookies(event) {
  return [
    serializeCookie('wpp_session', '', { ...cookieOptions(event), maxAge: 0 }),
    serializeCookie('wpp_csrf', '', { ...csrfCookieOptions(event), maxAge: 0 }),
  ];
}

function clampInt(n, min, max, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(x)));
}

function validateEmail(email) {
  const s = String(email || '').trim().toLowerCase();
  if (s.length < 5 || s.length > 254) return null;
  // Simple RFC-ish pattern
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}

function validatePassword(pw) {
  const s = String(pw || '');
  // Fortune-500 baseline: length + diversity encouragement
  if (s.length < 10 || s.length > 200) return null;
  return s;
}

const REQUIRE_VERIFY = String(REQUIRE_EMAIL_VERIFICATION || 'false').toLowerCase() === 'true';
const MAILMODE = String(MAIL_MODE || 'outbox').toLowerCase();
const LOGIN_MAX = clampInt(LOGIN_MAX_ATTEMPTS, 3, 50, 10);
const LOGIN_LOCK_MIN = clampInt(LOGIN_LOCK_MINUTES, 1, 120, 15);

function baseUrlOf(event, origin) {
  const explicit = String(APP_BASE_URL || '').trim().replace(/\/+$/, '');
  if (explicit) return explicit;

  // Prefer Origin when it's allowed (helps when behind custom domains).
  if (origin && isAllowedOrigin(origin)) return origin.replace(/\/+$/, '');

  const h = event.headers || {};
  const host = (h['x-forwarded-host'] || h.host || h.Host || '').trim();
  if (!host) return '';
  const proto = (h['x-forwarded-proto'] || 'https').trim();
  return `${proto}://${host}`.replace(/\/+$/, '');
}

function makeOpaqueToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function tokenHash(token) {
  // Pepper with APP_JWT_SECRET so DB leak doesn't expose usable tokens.
  return crypto.createHash('sha256').update(String(token) + String(APP_JWT_SECRET)).digest('hex');
}


function redirect(statusCode, location, origin, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...corsHeaders(origin), Location: location, ...extraHeaders },
    body: '',
  };
}


function samlDecode(b64) {
  const raw = String(b64 || '').replace(/\s/g,'');
  return Buffer.from(raw, 'base64').toString('utf8');
}

function xmlFind(tag, xml) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1] : null;
}

function xmlAttr(tag, attr, xml) {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"[^>]*>`, 'i');
  const m = xml.match(re);
  return m ? m[1] : null;
}

function samlNowOk(notBefore, notOnOrAfter) {
  const now = Date.now();
  const skewMs = 5 * 60 * 1000;
  if (notBefore) {
    const nb = Date.parse(notBefore);
    if (!isNaN(nb) && now + skewMs < nb) return false;
  }
  if (notOnOrAfter) {
    const noa = Date.parse(notOnOrAfter);
    if (!isNaN(noa) && now - skewMs >= noa) return false;
  }
  return true;
}

function pemToKey(pem) {
  return crypto.createPublicKey(pem);
}

// Extremely minimal signature verification: verifies SignatureValue over SignedInfo canonical bytes.
// This covers common IdPs using Exclusive C14N and RSA-SHA256 with simple structures.
// For complex transforms, use a dedicated XML signature library.
function samlCanonicalize(xml) {
  // Best-effort canonicalization (no external deps):
  // - remove XML declaration and comments
  // - normalize inter-tag whitespace
  // - sort attributes in start tags (lexicographic)
  let s = String(xml || '');

  s = s.replace(/<\?xml[^>]*\?>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/>\s+</g, '><').trim();

  // Sort attributes in tags: <tag b="2" a="1"> -> <tag a="1" b="2">
  // Not a full W3C C14N, but covers common SAML outputs.
  s = s.replace(/<([A-Za-z_:][\w:.-]*)(\s+[^<>]*?)?(\/?)>/g, (full, tag, attrs, selfClose) => {
    if (!attrs) return `<${tag}${selfClose ? '/':''}>`;
    const parts = [];
    let buf = '', inQ = false, q = '';
    const a = attrs.trim();
    for (let i=0;i<a.length;i++){
      const ch = a[i];
      if (!inQ && (ch === '"' || ch === "'")) { inQ = true; q = ch; buf += ch; continue; }
      if (inQ && ch === q) { inQ = false; buf += ch; continue; }
      if (!inQ && /\s/.test(ch)) {
        if (buf.trim()) parts.push(buf.trim());
        buf = '';
        continue;
      }
      buf += ch;
    }
    if (buf.trim()) parts.push(buf.trim());
    const norm = parts.filter(Boolean).sort((x,y)=>x.localeCompare(y));
    const outAttrs = norm.length ? ' ' + norm.join(' ') : '';
    return `<${tag}${outAttrs}${selfClose ? '/':''}>`;
  });

  return s;
}

function samlExtractSignedInfoAndSig(xml) {
  const sigBlock = xmlFind('ds:Signature', xml) || xmlFind('Signature', xml);
  if (!sigBlock) return null;

  const signedInfo = xmlFind('ds:SignedInfo', sigBlock) || xmlFind('SignedInfo', sigBlock);
  const sigValueB64 = (xmlFind('ds:SignatureValue', sigBlock) || xmlFind('SignatureValue', sigBlock) || '').replace(/\s/g,'');

  const sigMethodAlg = xmlAttr('ds:SignatureMethod', 'Algorithm', signedInfo || '') || xmlAttr('SignatureMethod', 'Algorithm', signedInfo || '');
  return { sigBlock, signedInfo, sigValueB64, sigMethodAlg };
}

function samlFindReference(signedInfoXml) {
  const ref = xmlFind('ds:Reference', signedInfoXml) || xmlFind('Reference', signedInfoXml);
  if (!ref) return null;

  const uri = xmlAttr('ds:Reference', 'URI', ref) || xmlAttr('Reference','URI', ref) || null;
  const digestMethod = xmlAttr('ds:DigestMethod', 'Algorithm', ref) || xmlAttr('DigestMethod','Algorithm', ref) || '';
  const digestValue = (xmlFind('ds:DigestValue', ref) || xmlFind('DigestValue', ref) || '').replace(/\s/g,'');
  const transformsXml = xmlFind('ds:Transforms', ref) || xmlFind('Transforms', ref) || '';
  const transformAlgs = [];
  transformsXml.replace(/<[^:>]*:?Transform[^>]*Algorithm="([^"]+)"[^>]*\/?>/gi, (_m, a) => { transformAlgs.push(a); return _m; });

  return { uri, digestMethod, digestValue, transformAlgs };
}

function samlGetElementById(xml, id) {
  const re = new RegExp(`<([A-Za-z_:][\\w:.-]*)\\b([^>]*?\\s(?:ID|Id|id)="${id}"[^>]*)>([\\s\\S]*?)<\\/\\1>`, 'i');
  const m = xml.match(re);
  if (m) return `<${m[1]}${m[2]}>${m[3]}</${m[1]}>`;

  const re2 = new RegExp(`<([A-Za-z_:][\\w:.-]*)\\b([^>]*?\\s(?:ID|Id|id)="${id}"[^>]*)\\/?>`, 'i');
  const m2 = xml.match(re2);
  if (m2) return `<${m2[1]}${m2[2]}/>`;
  return null;
}

function samlRemoveEnvelopedSignature(nodeXml) {
  return String(nodeXml || '').replace(/<[^:>]*:?Signature[\s\S]*?<\/[^:>]*:?Signature>/gi, '');
}

function samlDigest(algoUri, bytes) {
  const a = String(algoUri || '').toLowerCase();
  if (a.includes('sha256')) return crypto.createHash('sha256').update(bytes).digest('base64');
  if (a.includes('sha512')) return crypto.createHash('sha512').update(bytes).digest('base64');
  if (a.includes('sha1')) return crypto.createHash('sha1').update(bytes).digest('base64');
  return crypto.createHash('sha256').update(bytes).digest('base64');
}

function samlVerifySignature(xml, certPem) {
  const parts = samlExtractSignedInfoAndSig(xml);
  if (!parts) return { ok:false, error:'saml_missing_signature' };
  if (!parts.signedInfo || !parts.sigValueB64) return { ok:false, error:'saml_invalid_signature_block' };

  // Validate reference digests (common SAML pattern)
  const ref = samlFindReference(parts.signedInfo);
  if (ref && ref.uri && ref.uri.startsWith('#')) {
    const id = ref.uri.slice(1);
    let node = samlGetElementById(xml, id);
    if (!node) return { ok:false, error:'saml_reference_not_found' };

    const t = (ref.transformAlgs || []).map(x => String(x).toLowerCase());
    if (t.some(x => x.includes('enveloped-signature'))) node = samlRemoveEnvelopedSignature(node);

    const canonNode = samlCanonicalize(node);
    const dv = samlDigest(ref.digestMethod, Buffer.from(canonNode, 'utf8'));
    if (ref.digestValue && dv.replace(/\s/g,'') !== ref.digestValue.replace(/\s/g,'')) {
      return { ok:false, error:'saml_digest_mismatch' };
    }
  }

  // Verify SignatureValue over canonical SignedInfo
  const alg = String(parts.sigMethodAlg || '').toLowerCase();
  const allowed = [
    'rsa-sha256','rsa-sha1','rsa-sha512',
    'ecdsa-sha256','ecdsa-sha512'
  ];
  if (alg && !allowed.some(x => alg.includes(x))) return { ok:false, error:'saml_alg_not_allowed' };

  const canonSI = samlCanonicalize(parts.signedInfo);
  const sig = Buffer.from(parts.sigValueB64, 'base64');
  const key = pemToKey(certPem);

  let verifyAlg = 'RSA-SHA256';
  if (alg.includes('rsa-sha1')) verifyAlg = 'RSA-SHA1';
  if (alg.includes('rsa-sha512')) verifyAlg = 'RSA-SHA512';
  if (alg.includes('ecdsa-sha256')) verifyAlg = 'sha256';
  if (alg.includes('ecdsa-sha512')) verifyAlg = 'sha512';

  const ok = crypto.verify(verifyAlg, Buffer.from(canonSI, 'utf8'), key, sig);
  return ok ? { ok:true } : { ok:false, error:'saml_signature_invalid' };
}

async function getSamlConfig(orgId, origin, rid) {
  const rows = await sql`SELECT * FROM saml_configs WHERE org_id = ${orgId} LIMIT 1`;
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

function samlMetadataXml(cfg) {
  const spEntity = cfg.sp_entity_id;
  const acs = cfg.acs_url;
  return `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${spEntity}">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="${cfg.want_assertion_signed ? 'true':'false'}" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acs}" index="1" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function sha256buf(buf) {
  return crypto.createHash('sha256').update(buf).digest();
}

function pkceChallenge(verifier) {
  return base64url(sha256buf(Buffer.from(verifier, 'utf8')));
}

const ENC_KEY = crypto.createHash('sha256').update(String(APP_JWT_SECRET || '')).digest(); // 32 bytes
function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return base64url(Buffer.concat([iv, tag, ct]));
}

function decryptSecret(blob) {
  const raw = Buffer.from(String(blob).replace(/-/g,'+').replace(/_/g,'/'), 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}



// ---- OIDC JWKS verification (enterprise requirement)
const OIDC_ALG_ALLOWLIST = String(process.env.OIDC_ALG_ALLOWLIST || 'RS256,ES256').split(',').map(s=>s.trim()).filter(Boolean);
const OIDC_REQUIRE_ID_TOKEN = String(process.env.OIDC_REQUIRE_ID_TOKEN || 'true').toLowerCase() === 'true';
const JWKS_CACHE = new Map(); // jwksUri -> { jwks, expiresAt }

function parseJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  const signature = Buffer.from(s, 'base64url');
  const signingInput = Buffer.from(`${h}.${p}`, 'utf8');
  return { header, payload, signature, signingInput };
}

function jwkToKeyObject(jwk) {
  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

function verifyJwtSignature(parsed, jwks) {
  const alg = String(parsed.header?.alg || '');
  if (!OIDC_ALG_ALLOWLIST.includes(alg)) return { ok:false, error:'oidc_alg_not_allowed' };

  const kid = parsed.header?.kid;
  const keys = Array.isArray(jwks?.keys) ? jwks.keys : [];
  const jwk = keys.find(k => (kid ? k.kid === kid : true) && (k.use ? k.use === 'sig' : true)) || keys[0];
  if (!jwk) return { ok:false, error:'oidc_jwk_not_found' };

  const keyObj = jwkToKeyObject(jwk);

  let verifyAlg = null;
  if (alg === 'RS256' || alg === 'PS256') verifyAlg = 'RSA-SHA256';
  if (alg === 'RS384' || alg === 'PS384') verifyAlg = 'RSA-SHA384';
  if (alg === 'RS512' || alg === 'PS512') verifyAlg = 'RSA-SHA512';
  if (alg === 'ES256') verifyAlg = 'sha256';
  if (alg === 'ES384') verifyAlg = 'sha384';
  if (alg === 'ES512') verifyAlg = 'sha512';
  if (!verifyAlg) return { ok:false, error:'oidc_alg_unsupported' };

  const ok = crypto.verify(verifyAlg, parsed.signingInput, keyObj, parsed.signature);
  return ok ? { ok:true } : { ok:false, error:'oidc_signature_invalid' };
}

function validateIdTokenClaims(payload, issuerUrl, clientId) {
  const iss = String(payload.iss || '');
  if (issuerUrl && iss !== issuerUrl) return { ok:false, error:'oidc_iss_mismatch' };

  const aud = payload.aud;
  const audOk = Array.isArray(aud) ? aud.includes(clientId) : String(aud || '') === String(clientId || '');
  if (!audOk) return { ok:false, error:'oidc_aud_mismatch' };

  const exp = Number(payload.exp || 0);
  const nowSec = Math.floor(Date.now()/1000);
  if (!exp || exp < nowSec - 30) return { ok:false, error:'oidc_token_expired' };

  const iat = Number(payload.iat || 0);
  if (iat && iat > nowSec + 300) return { ok:false, error:'oidc_iat_in_future' };

  return { ok:true };
}

async function fetchJwks(jwksUri, { force = false } = {}) {
  const now = Date.now();

  // In-memory cache
  const cached = JWKS_CACHE.get(jwksUri);
  if (!force && cached && cached.expiresAt > now) return cached.jwks;

  // Persisted cache (DB)
  if (!force) {
    try {
      const rows = await sql`
        SELECT jwks_json, etag, expires_at
        FROM jwks_cache
        WHERE jwks_uri = ${jwksUri}
        LIMIT 1
      `;
      if (rows && rows.length) {
        const exp = new Date(rows[0].expires_at).getTime();
        if (exp > now) {
          JWKS_CACHE.set(jwksUri, { jwks: rows[0].jwks_json, expiresAt: exp });
          return rows[0].jwks_json;
        }
      }
    } catch (_) { /* best-effort */ }
  }

  // Fetch remote JWKS with conditional request (ETag) if available
  let etag = null;
  try {
    const rows = await sql`SELECT etag, jwks_json, expires_at FROM jwks_cache WHERE jwks_uri = ${jwksUri} LIMIT 1`;
    if (rows && rows.length) etag = rows[0].etag || null;
  } catch (_) {}

  const headers = {};
  if (!force && etag) headers['if-none-match'] = etag;

  try {
    const resp = await fetch(jwksUri, { headers });
    if (resp.status === 304) {
      // Not modified: extend expiry based on cache-control or default 5m
      const cc = resp.headers.get('cache-control') || '';
      const m = cc.match(/max-age=(\d+)/i);
      const ttlMs = m ? Math.min(60*60*1000, Number(m[1]) * 1000) : 5*60_000;
      const exp = now + ttlMs;
      try {
        await sql`UPDATE jwks_cache SET fetched_at = now(), expires_at = to_timestamp(${exp/1000.0}) WHERE jwks_uri = ${jwksUri}`;
      } catch (_) {}
      // fall back to existing cached jwks_json from DB
      const rows = await sql`SELECT jwks_json FROM jwks_cache WHERE jwks_uri = ${jwksUri} LIMIT 1`;
      if (rows && rows.length) {
        JWKS_CACHE.set(jwksUri, { jwks: rows[0].jwks_json, expiresAt: exp });
        return rows[0].jwks_json;
      }
    }

    const jwks = await resp.json();
    const newEtag = resp.headers.get('etag') || null;

    // TTL from cache-control, cap at 1h; default 5m.
    const cc = resp.headers.get('cache-control') || '';
    const mm = cc.match(/max-age=(\d+)/i);
    const ttlMs = mm ? Math.min(60*60*1000, Number(mm[1]) * 1000) : 5*60_000;
    const exp = now + ttlMs;

    JWKS_CACHE.set(jwksUri, { jwks, expiresAt: exp });

    try {
      await sql`
        INSERT INTO jwks_cache (jwks_uri, jwks_json, etag, fetched_at, expires_at)
        VALUES (${jwksUri}, ${JSON.stringify(jwks)}::jsonb, ${newEtag}, now(), to_timestamp(${exp/1000.0}))
        ON CONFLICT (jwks_uri) DO UPDATE
          SET jwks_json = EXCLUDED.jwks_json,
              etag = EXCLUDED.etag,
              fetched_at = now(),
              expires_at = EXCLUDED.expires_at,
              last_error_at = NULL,
              last_error = NULL
      `;
    } catch (_) { /* best-effort */ }

    return jwks;
  } catch (e) {
    // Hardening: fall back to last cached JWKS (even if expired) for up to 24h grace.
    try {
      const rows = await sql`SELECT jwks_json, expires_at FROM jwks_cache WHERE jwks_uri = ${jwksUri} LIMIT 1`;
      if (rows && rows.length) {
        const exp = new Date(rows[0].expires_at).getTime();
        if (now - exp < 24*60*60*1000) {
          JWKS_CACHE.set(jwksUri, { jwks: rows[0].jwks_json, expiresAt: now + 60_000 });
          return rows[0].jwks_json;
        }
      }
      await sql`UPDATE jwks_cache SET last_error_at = now(), last_error = ${String(e?.message || e)} WHERE jwks_uri = ${jwksUri}`;
    } catch (_) {}
    throw e;
  }
}

async function verifyIdToken(idToken, issuerUrl, clientId, jwksUri) {
  const parsed = parseJwt(idToken);
  if (!parsed) return { ok:false, error:'oidc_invalid_jwt' };

  // First attempt: cached/persisted JWKS
  let jwks = await fetchJwks(jwksUri, { force: false });
  let sig = verifyJwtSignature(parsed, jwks);
  if (!sig.ok) {
    // Key rotation hardening: force refresh JWKS once and retry.
    jwks = await fetchJwks(jwksUri, { force: true });
    sig = verifyJwtSignature(parsed, jwks);
    if (!sig.ok) return sig;
  }

  const claims = validateIdTokenClaims(parsed.payload, issuerUrl, clientId);
  if (!claims.ok) return claims;

  return { ok:true, payload: parsed.payload };
}

// Test helper: verify using a provided jwks object
function verifyIdTokenWithJwksObject(idToken, issuerUrl, clientId, jwks) {
  const parsed = parseJwt(idToken);
  if (!parsed) return { ok:false, error:'oidc_invalid_jwt' };
  const sig = verifyJwtSignature(parsed, jwks);
  if (!sig.ok) return sig;
  const claims = validateIdTokenClaims(parsed.payload, issuerUrl, clientId);
  if (!claims.ok) return claims;
  return { ok:true, payload: parsed.payload };
}
async function scimContext(event) {
  const h = event.headers || {};
  const auth = (h.authorization || h.Authorization || '').trim();
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  const hash = tokenHash(token);
  const rows = await sql`
    SELECT id, org_id
    FROM scim_tokens
    WHERE token_hash = ${hash}
    LIMIT 1
  `;
  if (!rows || rows.length === 0) return null;
  try { await sql`UPDATE scim_tokens SET last_used_at = now() WHERE id = ${rows[0].id}`; } catch(_) {}
  return { orgId: rows[0].org_id };
}




// ---- SCIM filter parsing (supports and/or, parentheses, eq/co/sw/ew/pr)
function scimTokenize(input) {
  const s = String(input || '');
  const toks = [];
  let i = 0;
  const isWS = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r';
  const isAlpha = (c) => /[A-Za-z_]/.test(c);
  const isAlnum = (c) => /[A-Za-z0-9_\-]/.test(c);

  while (i < s.length) {
    const c = s[i];
    if (isWS(c)) { i++; continue; }
    if (c === '(') { toks.push({t:'LP'}); i++; continue; }
    if (c === ')') { toks.push({t:'RP'}); i++; continue; }

    if (c === '"') {
      let j = i + 1, out = '';
      while (j < s.length) {
        const ch = s[j];
        if (ch === '\\\\' && j + 1 < s.length) { out += s[j+1]; j += 2; continue; }
        if (ch === '"') break;
        out += ch; j++;
      }
      if (j >= s.length || s[j] !== '"') throw new Error('scim_filter_unterminated_string');
      toks.push({t:'STR', v: out});
      i = j + 1;
      continue;
    }

    if (isAlpha(c)) {
      let j = i, out = '';
      while (j < s.length) {
        const ch = s[j];
        if (isAlnum(ch) || ch === '.' || ch === '[' || ch === ']') { out += ch; j++; continue; }
        break;
      }
      const wl = out.toLowerCase();
      if (wl === 'and') toks.push({t:'AND'});
      else if (wl === 'or') toks.push({t:'OR'});
      else if (wl === 'eq' || wl === 'ne' || wl === 'co' || wl === 'sw' || wl === 'ew' || wl === 'pr' || wl === 'gt' || wl === 'ge' || wl === 'lt' || wl === 'le') toks.push({t:'OP', v: wl});
      else if (wl === 'not') toks.push({t:'NOT'});
      else if (wl === 'true' || wl === 'false') toks.push({t:'BOOL', v: wl === 'true'});
      else toks.push({t:'ID', v: out});
      i = j;
      continue;
    }

    if (/[0-9]/.test(c)) {
      let j = i, out = '';
      while (j < s.length && /[0-9]/.test(s[j])) { out += s[j]; j++; }
      toks.push({t:'NUM', v: Number(out)});
      i = j;
      continue;
    }

    throw new Error('scim_filter_invalid_char');
  }

  return toks;
}

function scimParseFilter(input) {
  const toks = scimTokenize(input);
  let pos = 0;
  const peek = () => toks[pos] || null;
  const eat = (t) => { const p = peek(); if (!p || p.t !== t) return null; pos++; return p; };
  const req = (t) => { const p = eat(t); if (!p) throw new Error('scim_filter_expected_'+t); return p; };

  function parsePrimary() {
    if (eat('LP')) { const e = parseOr(); req('RP'); return e; }
    const id = req('ID').v;

    // Normalize bracket form: members[value eq "uuid"] -> members.value eq "uuid"
    const mbr = id.match(/^members\[(.+)\]$/i);
    const em = id.match(/^emails\[(.+)\]$/i);

    // General bracket filters: attribute[<innerFilter>]
    // We parse the inner filter as its own SCIM filter and then map it to supported comparisons.
    if (mbr) {
      const inner = mbr[1];
      const ast2 = scimParseFilter(inner);
      return { type:'bracket', base:'members', ast: ast2 };
    }

    if (em) {
      const inner = em[1];
      const ast2 = scimParseFilter(inner);

      // This app stores only a single email. We accept filter on:
      // - value (eq/ne/co/sw/ew/pr)
      // - type (eq/ne) but we cannot enforce it, so:
      //   * type eq "work" passes through (no-op)
      //   * type ne "work" can never be satisfied in a single-email model, so we reject to avoid lying
      //
      // We also allow AND combinations like: type eq "work" and value co "example.com"
      // Strategy: accept conjunctions where every non-value constraint is type eq "work" or type pr.
      // Compile emails[<inner>] into a special bracket node. Full RFC7644 semantics are supported because we now store multi-emails.
      return { type:'bracket', base:'emails', ast: ast2 };
    }if (kind === 'groups') {
      if (al === 'displayname') return compileText('g.display_name', op, value);
      if (al === 'id') { if (op !== 'eq' && op !== 'ne') throw new Error('scim_filter_unsupported_op'); return op === 'eq' ? `g.id = ${p(value)}::uuid` : `g.id <> ${p(value)}::uuid`; }
      if (al === 'members.value') { if (op !== 'eq' && op !== 'ne') throw new Error('scim_filter_unsupported_op'); 
        const expr = `EXISTS (SELECT 1 FROM scim_group_members gm WHERE gm.group_id = g.id AND gm.user_id = ${p(value)}::uuid)`;
        return op === 'eq' ? expr : `NOT (${expr})`;
      }
      if (al === 'meta.created') return timeExpr('g.created_at');
      if (al === 'meta.lastmodified') return timeExpr('g.updated_at');

      throw new Error('scim_filter_unsupported_attr');
    }

    throw new Error('scim_filter_invalid_kind');
  }

  function compileBracket(node) {
    if (!node || node.type !== 'bracket') throw new Error('scim_filter_invalid_ast');
    if (kind === 'users' && node.base === 'emails') {
      // Compile inner filter against ue columns (value/type/primary)
      const inner = node.ast;
      const paramsBefore = params.length;
      function compileInner(n) {
        if (!n) return 'true';
        if (n.type === 'cmp') {
          const a = String(n.attr||'').toLowerCase();
          if (a === 'value') return compileText('ue.value', n.op, n.value);
          if (a === 'type') return compileText('ue.type', n.op, n.value);
          if (a === 'primary') {
            if (n.op !== 'eq' && n.op !== 'ne') throw new Error('scim_filter_unsupported_op');
            const expr = `ue.primary_email = ${p(!!n.value)}`;
            return (n.op === 'eq') ? expr : `NOT (${expr})`;
          }
          throw new Error('scim_filter_unsupported_attr');
        }
        if (n.type === 'and') return `(${compileInner(n.left)} AND ${compileInner(n.right)})`;
        if (n.type === 'or') return `(${compileInner(n.left)} OR ${compileInner(n.right)})`;
        if (n.type === 'not') return `(NOT ${compileInner(n.node)})`;
        throw new Error('scim_filter_invalid_ast');
      }
      const innerSql = compileInner(inner);
      return `EXISTS (SELECT 1 FROM user_emails ue WHERE ue.user_id = u.id AND (${innerSql}))`;
    }

    if (kind === 'groups' && node.base === 'members') {
      const inner = node.ast;
      function compileInner(n) {
        if (!n) return 'true';
        if (n.type === 'cmp') {
          const a = String(n.attr||'').toLowerCase();
          if (a !== 'value') throw new Error('scim_filter_unsupported_attr');
          // value refers to user_id
          if (n.op === 'eq') return `gm.user_id = ${p(n.value)}::uuid`;
          if (n.op === 'ne') return `gm.user_id <> ${p(n.value)}::uuid`;
          throw new Error('scim_filter_unsupported_op');
        }
        if (n.type === 'and') return `(${compileInner(n.left)} AND ${compileInner(n.right)})`;
        if (n.type === 'or') return `(${compileInner(n.left)} OR ${compileInner(n.right)})`;
        if (n.type === 'not') return `(NOT ${compileInner(n.node)})`;
        throw new Error('scim_filter_invalid_ast');
      }
      const innerSql = compileInner(inner);
      return `EXISTS (SELECT 1 FROM scim_group_members gm WHERE gm.group_id = g.id AND (${innerSql}))`;
    }

    throw new Error('scim_filter_unsupported_attr');
  }

  function compile(node) {
    if (!node) return 'true';
    if (node.type === 'cmp') return `(${compileCmp(node.attr, node.op, node.value)})`;
    if (node.type === 'bracket') return `(${compileBracket(node)})`;
    if (node.type === 'and') return `(${compile(node.left)} AND ${compile(node.right)})`;
    if (node.type === 'or') return `(${compile(node.left)} OR ${compile(node.right)})`;
    if (node.type === 'not') return `(NOT ${compile(node.node)})`;
    throw new Error('scim_filter_invalid_ast');
  }

  return { sql: compile(ast), params }

function scimOrderBy(kind, sortBy, sortOrder) {
  const sb = String(sortBy || '').trim().toLowerCase();
  const so = (String(sortOrder || 'ascending').trim().toLowerCase() === 'descending') ? 'DESC' : 'ASC';

  if (kind === 'users') {
    if (!sb || sb === 'username' || sb === 'emails.value' || sb === 'email') return `u.email ${so}`;
    if (sb === 'id') return `u.id ${so}`;
    if (sb === 'meta.lastmodified') return `u.updated_at ${so}`;
    if (sb === 'meta.created') return `u.created_at ${so}`;
    // default
    return `u.email ${so}`;
  }

  if (kind === 'groups') {
    if (!sb || sb === 'displayname') return `g.display_name ${so}`;
    if (sb === 'id') return `g.id ${so}`;
    if (sb === 'meta.lastmodified') return `g.updated_at ${so}`;
    if (sb === 'meta.created') return `g.created_at ${so}`;
    return `g.display_name ${so}`;
  }

  return so === 'DESC' ? 'id DESC' : 'id ASC';
}
;
}

function parseScimGroupFilter(filterStr) {
  const f = String(filterStr || '').trim();
  if (!f) return {};
  const out = {};

  let m = f.match(/displayName\s+eq\s+\"([^\"]+)\"/i);
  if (m) out.displayName = String(m[1]).trim().slice(0, 120);

  m = f.match(/members\.value\s+eq\s+\"([0-9a-fA-F-]{36})\"/i);
  if (m) out.memberId = m[1];

  m = f.match(/id\s+eq\s+\"([0-9a-fA-F-]{36})\"/i);
  if (m) out.id = m[1];

  return out;
}


function parseScimUserPatch(body) {
  // Returns { active?: boolean, userName?: string, emailsReplace?: array, emailsOps?: array }
  const out = { emailsOps: [] };

  if (body && body.active != null) out.active = !!body.active;
  if (body && body.userName) out.userName = String(body.userName);

  // PUT-like: full emails replace
  if (body && Array.isArray(body.emails)) out.emailsReplace = body.emails;

  if (body && Array.isArray(body.Operations)) {
    for (const op of body.Operations) {
      const operation = String(op.op || op.operation || 'replace').toLowerCase();
      const path = String(op.path || '').trim();
      const val = op.value;

      if (!path || path.toLowerCase() === 'active') {
        if (val != null && (typeof val === 'boolean' || typeof val === 'number')) out.active = !!val;
        if (val && typeof val === 'object' && val.active != null) out.active = !!val.active;
        if (operation === 'remove' && path.toLowerCase() === 'active') out.active = false;
        continue;
      }

      if (path.toLowerCase() === 'username') {
        if (operation === 'remove') out.userName = '';
        else out.userName = String(val || '');
        continue;
      }

      if (path.toLowerCase().startsWith('emails')) {
        out.emailsOps.push({ op: operation, path, value: val });
        continue;
      }
    }
  }

  return out;
}

function parseScimPatch(body) {
  const out = {};
  if (body && body.active != null) out.active = !!body.active;

  const directEmail = body && (body.userName || (Array.isArray(body.emails) && body.emails[0]?.value));
  if (directEmail) {
    const email = validateEmail(directEmail);
    if (email) out.email = email;
  }

  if (body && Array.isArray(body.Operations)) {
    for (const op of body.Operations) {
      const operation = String(op.op || op.operation || 'replace').toLowerCase();
      const path = String(op.path || '').trim().toLowerCase();
      const val = op.value;

      if (!path || path === 'active') {
        if (val != null && (typeof val === 'boolean' || typeof val === 'number')) out.active = !!val;
        if (val && typeof val === 'object' && val.active != null) out.active = !!val.active;
        if (operation === 'remove' && path === 'active') out.active = false;
      }

      if (path === 'username') {
        const email = validateEmail(val);
        if (email) out.email = email;
      }

      if (path && path.startsWith('emails')) {
        const email = validateEmail(val?.value || (Array.isArray(val) ? val[0]?.value : val));
        if (email) out.email = email;
      }
    }
  }
  return out;
}

function etagListFor(label, count, maxUpdated) {
  const v = `${label}:${count || 0}:${maxUpdated || ''}`;
  const h = crypto.createHash('sha256').update(v).digest('hex').slice(0, 16);
  return `W/"${h}"`;
}

function notModified(event, currentEtag) {
  const h = event.headers || {};
  const inm = (h['if-none-match'] || h['If-None-Match'] || '').trim();
  return inm && inm === currentEtag;
}

function etagFor(id, updatedAt) {
  const v = `${id}:${updatedAt || ''}`;
  const h = crypto.createHash('sha256').update(v).digest('hex').slice(0, 16);
  return `W/"${h}"`;
}

function preconditionOk(event, currentEtag) {
  const h = event.headers || {};
  const ifMatch = (h['if-match'] || h['If-Match'] || '').trim();
  if (!ifMatch) return true; // optional
  return ifMatch === currentEtag;
}



async function ensurePrimaryEmailRow(userId, email) {
  // Ensures user_emails contains the primary email (and marks it primary).
  if (!email) return;
  await sql`
    INSERT INTO user_emails (user_id, value, type, primary_email, created_at, updated_at)
    VALUES (${userId}, ${email}, 'work', true, now(), now())
    ON CONFLICT (user_id, value) DO UPDATE
      SET primary_email = true,
          updated_at = now()
  `;
  // Demote other emails if needed (keep one primary)
  await sql`
    UPDATE user_emails
    SET primary_email = false, updated_at = now()
    WHERE user_id = ${userId} AND value <> ${email} AND primary_email = true
  `;
}

async function loadUserEmails(userId, limit = 50, offset = 0) {
  const rows = await sql`
    SELECT value, type, primary_email
    FROM user_emails
    WHERE user_id = ${userId}
    ORDER BY primary_email DESC, value ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return (rows || []).map(r => ({ value: r.value, type: r.type, primary: !!r.primary_email }));
}

async function setUserEmails(userId, emails) {
  // Replace full email set (used for PUT semantics)
  const arr = Array.isArray(emails) ? emails : [];
  const norm = [];
  for (const e of arr) {
    const v = validateEmail(e?.value || e);
    if (!v) continue;
    const t = String(e?.type || 'work').trim().toLowerCase() || 'work';
    const prim = !!e?.primary;
    norm.push({ value: v, type: t, primary: prim });
  }
  // De-dupe by value
  const seen = new Set();
  const uniq = [];
  for (const e of norm) {
    if (seen.has(e.value)) continue;
    seen.add(e.value);
    uniq.push(e);
  }
  await sql`DELETE FROM user_emails WHERE user_id = ${userId}`;
  for (const e of uniq) {
    await sql`
      INSERT INTO user_emails (user_id, value, type, primary_email, created_at, updated_at)
      VALUES (${userId}, ${e.value}, ${e.type}, ${e.primary}, now(), now())
    `;
  }
  // Ensure one primary: if none specified, promote first
  const hasPrimary = uniq.some(x => x.primary);
  if (!hasPrimary && uniq.length) {
    await sql`UPDATE user_emails SET primary_email = true, updated_at = now() WHERE user_id = ${userId} AND value = ${uniq[0].value}`;
  }
  // Sync users.email to the primary
  const prim = await sql`SELECT value FROM user_emails WHERE user_id = ${userId} AND primary_email = true LIMIT 1`;
  if (prim && prim.length) {
    await sql`UPDATE users SET email = ${prim[0].value}, updated_at = now() WHERE id = ${userId}`;
  }
}

async function upsertUserEmail(userId, value, type = 'work', primary = false) {
  const v = validateEmail(value);
  if (!v) return;
  const t = String(type || 'work').trim().toLowerCase() || 'work';
  await sql`
    INSERT INTO user_emails (user_id, value, type, primary_email, created_at, updated_at)
    VALUES (${userId}, ${v}, ${t}, ${!!primary}, now(), now())
    ON CONFLICT (user_id, value) DO UPDATE
      SET type = EXCLUDED.type,
          primary_email = (user_emails.primary_email OR EXCLUDED.primary_email),
          updated_at = now()
  `;
  if (primary) {
    await ensurePrimaryEmailRow(userId, v);
    await sql`UPDATE users SET email = ${v}, updated_at = now() WHERE id = ${userId}`;
  }
}

async function removeUserEmail(userId, value) {
  const v = validateEmail(value);
  if (!v) return;
  await sql`DELETE FROM user_emails WHERE user_id = ${userId} AND value = ${v}`;
  // Ensure there's still a primary email and users.email stays in sync
  const prim = await sql`SELECT value FROM user_emails WHERE user_id = ${userId} AND primary_email = true LIMIT 1`;
  if (prim && prim.length) {
    await sql`UPDATE users SET email = ${prim[0].value}, updated_at = now() WHERE id = ${userId}`;
    return;
  }
  const anyRow = await sql`SELECT value FROM user_emails WHERE user_id = ${userId} ORDER BY value ASC LIMIT 1`;
  if (anyRow && anyRow.length) {
    await ensurePrimaryEmailRow(userId, anyRow[0].value);
    await sql`UPDATE users SET email = ${anyRow[0].value}, updated_at = now() WHERE id = ${userId}`;
  }
}

async function bulkAddGroupMembers(groupId, userIds) {
  const ids = (userIds || []).map(String).filter(Boolean);
  if (!ids.length) return;
  const chunk = 1000;
  for (let i = 0; i < ids.length; i += chunk) {
    const part = ids.slice(i, i + chunk);
    await sql(
      `INSERT INTO scim_group_members (group_id, user_id, created_at, updated_at)
       SELECT $1::uuid, x::uuid, now(), now()
       FROM unnest($2::uuid[]) AS x
       ON CONFLICT (group_id, user_id) DO UPDATE SET updated_at = now()`,
      [groupId, part]
    );
  }
}

async function bulkRemoveGroupMembers(groupId, userIds) {
  const ids = (userIds || []).map(String).filter(Boolean);
  if (!ids.length) return;
  const chunk = 1000;
  for (let i = 0; i < ids.length; i += chunk) {
    const part = ids.slice(i, i + chunk);
    await sql(
      `DELETE FROM scim_group_members
       WHERE group_id = $1::uuid AND user_id = ANY($2::uuid[])`,
      [groupId, part]
    );
  }
}

async function bulkReplaceGroupMembers(groupId, userIds) {
  await sql`DELETE FROM scim_group_members WHERE group_id = ${groupId}`;
  await bulkAddGroupMembers(groupId, userIds);
}

function parseMemberIds(val) {
  const arr = Array.isArray(val) ? val : (val?.members ? val.members : []);
  return arr.map(x => String(x?.value || '').trim()).filter(Boolean);
}

function parseMembersValuePath(path) {
  const m = String(path || '').match(/members\[value\s+eq\s+"([0-9a-fA-F-]{36})"\]/i);
  return m ? m[1] : null;
}

function scimUser(u, orgId, active=true, emails=[]) {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: u.id,
    userName: u.email,
    active: !!active,
    emails: (Array.isArray(emails) && emails.length) ? emails : [{ value: u.email, primary: true, type: 'work' }],
    meta: { resourceType: "User" },
  };
}

async function queueEmail(toEmail, template, subject, body, meta = {}) {
  try {
    await sql`
      INSERT INTO email_outbox (to_email, template, subject, body, meta, status, created_at)
      VALUES (${toEmail}, ${template}, ${subject}, ${body}, ${JSON.stringify(meta)}::jsonb, 'pending', now())
    `;
  } catch (_) {
    // best-effort; email integration may be added later
  }
}

function normalizeProjectName(name) {
  const s = String(name || '').trim();
  if (!s) return null;
  return s.slice(0, 80);
}

function validateFiles(files) {
  if (!Array.isArray(files)) return { ok: false, error: 'files must be an array' };
  if (files.length < 1) return { ok: false, error: 'files cannot be empty' };
  if (files.length > 200) return { ok: false, error: 'too many files (max 200)' };

  let totalBytes = 0;
  const out = [];
  const seen = new Set();

  for (const f of files) {
    const path = String(f?.path || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!path || path.length > 180) return { ok: false, error: 'invalid file path' };
    if (path.includes('..')) return { ok: false, error: 'path traversal not allowed' };
    if (seen.has(path)) return { ok: false, error: 'duplicate path: ' + path };
    seen.add(path);

    const language = String(f?.language || '').trim().slice(0, 40) || 'plaintext';
    const content = String(f?.content ?? '');
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > 600_000) return { ok: false, error: `file too large: ${path} (>600KB)` };

    totalBytes += bytes;
    if (totalBytes > 2_500_000) return { ok: false, error: 'project too large (>2.5MB total)' };

    out.push({ path, language, content });
  }

  return { ok: true, files: out, totalBytes };
}


async function rlsSetOrg(orgId) {
  const enabled = String(process.env.ENABLE_RLS || ENABLE_RLS || 'false').toLowerCase() === 'true';
  if (!enabled) return;
  if (!orgId) return;
  try {
    await sql`SELECT set_config('app.org_id', ${String(orgId)}, true)`;
  } catch (_) {
    // best-effort; if RLS enabled and this fails, queries will be blocked anyway
  }
}

async function enqueueSiemEvent(orgId, payload) {
  const enabled = String(process.env.SIEM_ENABLED || SIEM_ENABLED || 'true').toLowerCase() === 'true';
  if (!enabled) return;
  if (!orgId) return;
  // Only enqueue if org has config
  const cfg = await sql`SELECT endpoint_url FROM org_siem_configs WHERE org_id = ${orgId} LIMIT 1`;
  if (!cfg || cfg.length === 0) return;
  await sql`INSERT INTO siem_outbox (id, org_id, kind, payload_json, attempts, next_attempt_at, created_at)
            VALUES (${crypto.randomUUID()}, ${orgId}, 'audit', ${JSON.stringify(payload)}::jsonb, 0, now(), now())`;
}

async function audit(event, orgId, userId, action, targetType = null, targetId = null, meta = {}) {
  try {
    const ip = ipOf(event);
    const ua = uaOf(event);
    await sql`
      INSERT INTO audit_logs (org_id, user_id, action, target_type, target_id, meta, ip, user_agent, created_at)
      VALUES (${orgId}, ${userId}, ${action}, ${targetType}, ${targetId}, ${JSON.stringify(meta)}::jsonb, ${ip}, ${ua}, now())
    `;
  } catch (_) {
    // best-effort
  }
}

function routeFrom(event) {
  // With Netlify redirect, event.path includes /api/...
  const path = String(event.path || '/');
  const base = path.startsWith('/api') ? path.slice(4) : path;
  const clean = base.startsWith('/') ? base : '/' + base;
  return clean.replace(/\/+$/, '') || '/';
}

export async function handler(event) {
  const origin = (event.headers?.origin || event.headers?.Origin || '').trim();
  const rid = requestId(event);
  const ip = ipOf(event);

  if (origin && !isAllowedOrigin(origin)) {
    return json(403, { ok: false, error: 'origin_denied', requestId: rid }, origin, { 'x-request-id': rid });
  }

  const method = (event.httpMethod || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: { ...corsHeaders(origin), 'x-request-id': rid } };
  }

  const path = routeFrom(event);

  const normalLimit = clampInt(RATE_LIMIT_PER_MINUTE, 30, 2000, 120);
  const authLimit = clampInt(AUTH_RATE_LIMIT_PER_MINUTE, 10, 600, 30);
  const bucket = (path.split('/')[1] || 'root');
  const limit = bucket === 'auth' ? authLimit : normalLimit;
  const rlKey = `${ip || 'unknown'}:${bucket}`;

  if (!(await rateLimitOk(rlKey, limit))) {
    return json(429, { ok: false, error: 'rate_limited', requestId: rid }, origin, { 'x-request-id': rid });
  }


  try {
    // ---- Health
    if (method === 'GET' && path === '/metrics/prometheus') {
      const rows = await sql`SELECT k, v, updated_at FROM metrics_counters ORDER BY k ASC`;
      let out = '';
      for (const r of (rows || [])) {
        const name = String(r.k || '').replace(/[^a-zA-Z0-9_:]/g, '_');
        out += `# TYPE ${name} counter\n`;
        out += `${name} ${Number(r.v || 0)}\n`;
      }
      return { statusCode: 200, headers: { ...corsHeaders(origin), 'content-type': 'text/plain; version=0.0.4', 'x-request-id': rid }, body: out };
    }

    if (method === 'GET' && path === '/metrics') {
      const rows = await sql`SELECT k, v, updated_at FROM metrics_counters ORDER BY k ASC`;
      return json(200, { ok:true, data: rows || [], requestId: rid }, origin, { 'x-request-id': rid });
    }

    if (method === 'GET' && path === '/health') {
      return json(200, { ok: true, service: 'webpile-api', time: new Date().toISOString(), requestId: rid }, origin, { 'x-request-id': rid });
    }

    // ---- Auth: register
        // ---- Auth: register
    if (method === 'POST' && path === '/auth/register') {
      const body = parseBody(event) || {};
      const email = validateEmail(body.email);
      const pw = validatePassword(body.password);
      const orgName = String(body.orgName || 'My Organization').trim().slice(0, 80) || 'My Organization';

      if (!email || !pw) return json(400, { ok: false, error: 'invalid_credentials', requestId: rid }, origin, { 'x-request-id': rid });

      const passwordHash = await bcrypt.hash(pw, 12);
      const userId = crypto.randomUUID();
      const orgId = crypto.randomUUID();

      // Create org + user + membership (owner)
      try {
        await sql`
          WITH new_org AS (
            INSERT INTO orgs (id, name, created_at)
            VALUES (${orgId}, ${orgName}, now())
            RETURNING id
          ),
          new_user AS (
            INSERT INTO users (
              id, email, password_hash,
              email_verified, token_version, failed_login_count,
              password_changed_at, created_at, last_login_at
            )
            VALUES (
              ${userId}, ${email}, ${passwordHash},
              false, 0, 0,
              now(), now(), now()
            )
            RETURNING id
          )
          INSERT INTO memberships (org_id, user_id, role, created_at)
          SELECT ${orgId}, ${userId}, 'owner', now()
        `;
      } catch (e) {
        const msg = String(e?.message || '').toLowerCase();
        if (msg.includes('duplicate') || msg.includes('unique')) {
          return json(409, { ok: false, error: 'email_exists', requestId: rid }, origin, { 'x-request-id': rid });
        }
        throw e;
      }

      // Email verification token + outbox
      const verifyToken = makeOpaqueToken();
      const verifyUrlBase = baseUrlOf(event, origin);
      const verifyUrl = verifyUrlBase ? `${verifyUrlBase}/?verifyToken=${encodeURIComponent(verifyToken)}` : '';
      try {
        await sql`
          INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, created_at, ip, user_agent)
          VALUES (${crypto.randomUUID()}, ${userId}, ${tokenHash(verifyToken)}, now() + interval '24 hours', now(), ${ip}, ${uaOf(event)})
        `;
      } catch (_) { /* best-effort */ }

      if (verifyUrl) {
        await queueEmail(
          email,
          'verify_email',
          'Verify your email',
          `Welcome to WebPile Pro.\n\nVerify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`,
          { verifyUrl }
        );
      }

      const csrf = crypto.randomUUID();
      const token = signSession({ sub: userId, orgId, email, role: 'owner', tv: 0 });

      const setCookie = [
        serializeCookie('wpp_session', token, { ...cookieOptions(event), maxAge: 60 * 60 * 24 * clampInt(SESSION_TTL_DAYS, 1, 30, 7) }),
        serializeCookie('wpp_csrf', csrf, { ...csrfCookieOptions(event), maxAge: 60 * 60 * 24 * clampInt(SESSION_TTL_DAYS, 1, 30, 7) }),
      ];

      await audit(event, orgId, userId, 'auth.register', 'user', userId, { email });

      const data = {
        user: { id: userId, email, emailVerified: false },
        org: { id: orgId, name: orgName },
        role: 'owner',
        orgs: [{ id: orgId, name: orgName, role: 'owner' }],
        emailVerification: { required: REQUIRE_VERIFY, verified: false },
      };

      if (MAILMODE === 'dev') {
        data.dev = { verifyToken, verifyUrl };
      }

      return json(200, { ok: true, data, requestId: rid }, origin, { 'set-cookie': setCookie, 'x-request-id': rid });
    }


    // ---- Auth: login
        // ---- Auth: login
    if (method === 'POST' && path === '/auth/login') {
      const body = parseBody(event) || {};
      const email = validateEmail(body.email);
      const pw = String(body.password || '');
      const desiredOrgId = String(body.orgId || '').trim() || null;

      if (!email || !pw) return json(400, { ok: false, error: 'invalid_credentials', requestId: rid }, origin, { 'x-request-id': rid });

      const users = await sql`
        SELECT id, email, password_hash, email_verified, token_version, failed_login_count, locked_until, last_failed_at
        FROM users
        WHERE email = ${email}
        LIMIT 1
      `;

      // Avoid user enumeration: use same response for missing users.
      if (!users || users.length === 0) {
        return json(401, { ok: false, error: 'invalid_login', requestId: rid }, origin, { 'x-request-id': rid });
      }

      const u = users[0];

      if (u.locked_until && new Date(u.locked_until).getTime() > Date.now()) {
        const retryAfterSec = Math.max(1, Math.ceil((new Date(u.locked_until).getTime() - Date.now()) / 1000));
        return json(423, { ok: false, error: 'locked', retryAfterSec, requestId: rid }, origin, { 'x-request-id': rid, 'retry-after': String(retryAfterSec) });
      }

      const ok = await bcrypt.compare(pw, u.password_hash);

      if (!ok) {
        // Update failed attempt counters + lockout
        const upd = await sql`
          WITH cur AS (
            SELECT failed_login_count, last_failed_at, locked_until
            FROM users
            WHERE id = ${u.id}
            FOR UPDATE
          ),
          calc AS (
            SELECT
              CASE
                WHEN cur.last_failed_at IS NULL OR (now() - cur.last_failed_at) > interval '15 minutes' THEN 1
                ELSE cur.failed_login_count + 1
              END AS new_count
            FROM cur
          ),
          upd AS (
            UPDATE users x
            SET failed_login_count = calc.new_count,
                last_failed_at = now(),
                locked_until = CASE
                  WHEN calc.new_count >= ${LOGIN_MAX} THEN now() + make_interval(mins => ${LOGIN_LOCK_MIN})
                  ELSE x.locked_until
                END
            FROM calc
            WHERE x.id = ${u.id}
            RETURNING x.failed_login_count, x.locked_until
          )
          SELECT * FROM upd
        `;

        const locked = upd?.[0]?.locked_until && new Date(upd[0].locked_until).getTime() > Date.now();
        if (locked) {
          const retryAfterSec = Math.max(1, Math.ceil((new Date(upd[0].locked_until).getTime() - Date.now()) / 1000));
          return json(423, { ok: false, error: 'locked', retryAfterSec, requestId: rid }, origin, { 'x-request-id': rid, 'retry-after': String(retryAfterSec) });
        }

        return json(401, { ok: false, error: 'invalid_login', requestId: rid }, origin, { 'x-request-id': rid });
      }

      // Successful login → clear lockout and update last_login_at
      await sql`
        UPDATE users
        SET last_login_at = now(),
            failed_login_count = 0,
            last_failed_at = NULL,
            locked_until = NULL
        WHERE id = ${u.id}
      `;

      const orgs = await listUserOrgs(u.id);
      if (!orgs || orgs.length === 0) {
        return json(403, { ok: false, error: 'no_org_membership', requestId: rid }, origin, { 'x-request-id': rid });
      }

      let selected = orgs[0];
      if (desiredOrgId) {
        const hit = orgs.find(o => String(o.id) === desiredOrgId);
        if (hit) selected = hit;
      }

      const csrf = crypto.randomUUID();
      const token = signSession({ sub: u.id, orgId: selected.id, email: u.email, role: selected.role, tv: Number(u.token_version || 0) });

      const maxAgeSec = 60 * 60 * 24 * clampInt(SESSION_TTL_DAYS, 1, 30, 7);
      const setCookie = [
        serializeCookie('wpp_session', token, { ...cookieOptions(event), maxAge: maxAgeSec }),
        serializeCookie('wpp_csrf', csrf, { ...csrfCookieOptions(event), maxAge: maxAgeSec }),
      ];

      await audit(event, selected.id, u.id, 'auth.login', 'user', u.id, { email });

      return json(
        200,
        {
          ok: true,
          data: {
            user: { id: u.id, email: u.email, emailVerified: !!u.email_verified },
            org: { id: selected.id, name: selected.name },
            role: selected.role,
            orgs,
          },
          requestId: rid
        },
        origin,
        { 'set-cookie': setCookie, 'x-request-id': rid }
      );
    }


    // ---- Auth: verify email (token from email link)
    if (method === 'POST' && path === '/auth/verify-email') {
      const body = parseBody(event) || {};
      const token = String(body.token || '').trim();
      if (!token) return json(400, { ok:false, error:'invalid_token', requestId: rid }, origin, { 'x-request-id': rid });

      const h = tokenHash(token);
      const rows = await sql`
        SELECT id, user_id, expires_at, used_at
        FROM email_verification_tokens
        WHERE token_hash = ${h}
        LIMIT 1
      `;
      if (!rows || rows.length === 0) return json(400, { ok:false, error:'invalid_token', requestId: rid }, origin, { 'x-request-id': rid });

      const r = rows[0];
      if (r.used_at) return json(400, { ok:false, error:'token_used', requestId: rid }, origin, { 'x-request-id': rid });
      if (new Date(r.expires_at).getTime() < Date.now()) return json(400, { ok:false, error:'token_expired', requestId: rid }, origin, { 'x-request-id': rid });

      await sql`
        UPDATE email_verification_tokens
        SET used_at = now()
        WHERE id = ${r.id} AND used_at IS NULL
      `;
      await sql`UPDATE users SET email_verified = true WHERE id = ${r.user_id}`;

      // Audit for each org the user belongs to (best-effort)
      try {
        const orgs = await listUserOrgs(r.user_id);
        for (const o of orgs) await audit(event, o.id, r.user_id, 'auth.email_verified', 'user', r.user_id, {});
      } catch (_) {}

      return json(200, { ok:true, data:{ verified:true }, requestId: rid }, origin, { 'x-request-id': rid });
    }

    // ---- Auth: resend verification email
    if (method === 'POST' && path === '/auth/resend-verification') {
      const body = parseBody(event) || {};
      const email = validateEmail(body.email);
      if (!email) return json(200, { ok:true, data:{ sent:true }, requestId: rid }, origin, { 'x-request-id': rid });

      const users = await sql`SELECT id, email_verified FROM users WHERE email=${email} LIMIT 1`;
      if (!users || users.length === 0) return json(200, { ok:true, data:{ sent:true }, requestId: rid }, origin, { 'x-request-id': rid });

      const u = users[0];
      if (u.email_verified) return json(200, { ok:true, data:{ sent:true }, requestId: rid }, origin, { 'x-request-id': rid });

      const verifyToken = makeOpaqueToken();
      const verifyUrlBase = baseUrlOf(event, origin);
      const verifyUrl = verifyUrlBase ? `${verifyUrlBase}/?verifyToken=${encodeURIComponent(verifyToken)}` : '';

      try {
        await sql`
          INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, created_at, ip, user_agent)
          VALUES (${crypto.randomUUID()}, ${u.id}, ${tokenHash(verifyToken)}, now() + interval '24 hours', now(), ${ip}, ${uaOf(event)})
        `;
      } catch (_) { /* best-effort */ }

      if (verifyUrl) {
        await queueEmail(
          email,
          'verify_email',
          'Verify your email',
          `Verify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`,
          { verifyUrl }
        );
      }

      const data = { sent:true };
      if (MAILMODE === 'dev') data.dev = { verifyToken, verifyUrl };
      return json(200, { ok:true, data, requestId: rid }, origin, { 'x-request-id': rid });
    }

    // ---- Auth: request password reset (always returns ok to avoid enumeration)
    if (method === 'POST' && path === '/auth/request-reset') {
      const body = parseBody(event) || {};
      const email = validateEmail(body.email);

      if (!email) return json(200, { ok:true, data:{ sent:true }, requestId: rid }, origin, { 'x-request-id': rid });

      const users = await sql`SELECT id FROM users WHERE email=${email} LIMIT 1`;
      if (!users || users.length === 0) return json(200, { ok:true, data:{ sent:true }, requestId: rid }, origin, { 'x-request-id': rid });

      const userId = users[0].id;

      const resetToken = makeOpaqueToken();
      const resetUrlBase = baseUrlOf(event, origin);
      const resetUrl = resetUrlBase ? `${resetUrlBase}/?resetToken=${encodeURIComponent(resetToken)}` : '';

      try {
        await sql`
          INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at, ip, user_agent)
          VALUES (${crypto.randomUUID()}, ${userId}, ${tokenHash(resetToken)}, now() + interval '30 minutes', now(), ${ip}, ${uaOf(event)})
        `;
      } catch (_) { /* best-effort */ }

      if (resetUrl) {
        await queueEmail(
          email,
          'password_reset',
          'Reset your password',
          `Reset your password: ${resetUrl}\n\nThis link expires in 30 minutes.`,
          { resetUrl }
        );
      }

      const data = { sent:true };
      if (MAILMODE === 'dev') data.dev = { resetToken, resetUrl };
      return json(200, { ok:true, data, requestId: rid }, origin, { 'x-request-id': rid });
    }

    // ---- Auth: reset password (token + new password)
    if (method === 'POST' && path === '/auth/reset') {
      const body = parseBody(event) || {};
      const token = String(body.token || '').trim();
      const newPw = validatePassword(body.newPassword);

      if (!token || !newPw) return json(400, { ok:false, error:'invalid_reset', requestId: rid }, origin, { 'x-request-id': rid });

      const h = tokenHash(token);
      const rows = await sql`
        SELECT t.id, t.user_id, t.expires_at, t.used_at
        FROM password_reset_tokens t
        WHERE t.token_hash = ${h}
        LIMIT 1
      `;
      if (!rows || rows.length === 0) return json(400, { ok:false, error:'invalid_token', requestId: rid }, origin, { 'x-request-id': rid });

      const r = rows[0];
      if (r.used_at) return json(400, { ok:false, error:'token_used', requestId: rid }, origin, { 'x-request-id': rid });
      if (new Date(r.expires_at).getTime() < Date.now()) return json(400, { ok:false, error:'token_expired', requestId: rid }, origin, { 'x-request-id': rid });

      const passwordHash = await bcrypt.hash(newPw, 12);

      // Update password + revoke all sessions by incrementing token_version
      await sql`
        UPDATE users
        SET password_hash = ${passwordHash},
            password_changed_at = now(),
            token_version = token_version + 1,
            failed_login_count = 0,
            last_failed_at = NULL,
            locked_until = NULL
        WHERE id = ${r.user_id}
      `;
      await sql`UPDATE password_reset_tokens SET used_at = now() WHERE id = ${r.id} AND used_at IS NULL`;

      // Best-effort audit (per org membership)
      try {
        const orgs = await listUserOrgs(r.user_id);
        for (const o of orgs) await audit(event, o.id, r.user_id, 'auth.password_reset', 'user', r.user_id, {});
      } catch (_) {}

      // Clear cookies to force fresh login
      const setCookie = sessionClearingCookies(event);
      return json(200, { ok:true, requestId: rid }, origin, { 'set-cookie': setCookie, 'x-request-id': rid });
    }

    // ---- Auth: logout
    if (method === 'POST' && path === '/auth/logout') {
      if (!requireCsrf(event)) return json(403, { ok: false, error: 'csrf_failed', requestId: rid }, origin, { 'x-request-id': rid });

      const sess = requireAuth(event);
      const setCookie = sessionClearingCookies(event);

      if (sess) {
        let orgId = sess.orgId;
        let userId = sess.sub;
        try {
          const c2 = await loadSessionContext(event, sess);
          if (c2) { orgId = c2.orgId; userId = c2.userId; }
        } catch (_) {}
        await audit(event, orgId, userId, 'auth.logout', 'user', userId, {});
      }

      return json(200, { ok: true, requestId: rid }, origin, { 'set-cookie': setCookie, 'x-request-id': rid });
    }

    // ---- Me
        // ---- Me
    if (method === 'GET' && path === '/me') {
      const sess = requireAuth(event);
      if (!sess) return json(200, { ok: true, data: null, requestId: rid }, origin, { 'x-request-id': rid });

      let ctx = null;
      try {
        ctx = await loadSessionContext(event, sess);
      } catch (_) {
        ctx = null;
      }

      if (!ctx) {
        // Session invalid/revoked: clear cookies so the client can recover cleanly.
        const setCookie = sessionClearingCookies(event);
        return json(200, { ok: true, data: null, requestId: rid }, origin, { 'set-cookie': setCookie, 'x-request-id': rid });
      }

      return json(
        200,
        { ok: true, data: { user: ctx.user, org: ctx.org, role: ctx.role, orgs: ctx.orgs }, requestId: rid },
        origin,
        { 'x-request-id': rid }
      );
    }


        // ---- Auth: list orgs (requires auth)
    if (method === 'GET' && path === '/auth/orgs') {
      const sess = requireAuth(event);
      if (!sess) return json(401, { ok:false, error:'unauthorized', requestId: rid }, origin, { 'x-request-id': rid });

      const ctx = await loadSessionContext(event, sess);
      if (!ctx) return json(401, { ok:false, error:'unauthorized', requestId: rid }, origin, { 'set-cookie': sessionClearingCookies(event), 'x-request-id': rid });

      return json(200, { ok:true, data: ctx.orgs, requestId: rid }, origin, { 'x-request-id': rid });
    }

    // ---- Auth: switch org (requires auth + CSRF)
    if (method === 'POST' && path === '/auth/switch-org') {
      if (!requireCsrf(event)) return json(403, { ok:false, error:'csrf_failed', requestId: rid }, origin, { 'x-request-id': rid });

      const sess = requireAuth(event);
      if (!sess) return json(401, { ok:false, error:'unauthorized', requestId: rid }, origin, { 'x-request-id': rid });

      const body = parseBody(event) || {};
      const desiredOrgId = String(body.orgId || '').trim();
      if (!desiredOrgId) return json(400, { ok:false, error:'missing_org', requestId: rid }, origin, { 'x-request-id': rid });

      // Validate session + get user details
      const ctx = await loadSessionContext(event, sess);
      if (!ctx) return json(401, { ok:false, error:'unauthorized', requestId: rid }, origin, { 'set-cookie': sessionClearingCookies(event), 'x-request-id': rid });

      const orgs = await listUserOrgs(ctx.userId);
      const hit = orgs.find(o => String(o.id) === desiredOrgId);
      if (!hit) return json(403, { ok:false, error:'forbidden', requestId: rid }, origin, { 'x-request-id': rid });

      const csrf = crypto.randomUUID();
      const token = signSession({ sub: ctx.userId, orgId: hit.id, email: ctx.user.email, role: hit.role, tv: ctx.tokenVersion });
      const maxAgeSec = 60 * 60 * 24 * clampInt(SESSION_TTL_DAYS, 1, 30, 7);

      const setCookie = [
        serializeCookie('wpp_session', token, { ...cookieOptions(event), maxAge: maxAgeSec }),
        serializeCookie('wpp_csrf', csrf, { ...csrfCookieOptions(event), maxAge: maxAgeSec }),
      ];

      await audit(event, hit.id, ctx.userId, 'auth.switch_org', 'org', hit.id, { fromOrgId: ctx.orgId, toOrgId: hit.id });

      return json(
        200,
        { ok:true, data:{ user: ctx.user, org: { id: hit.id, name: hit.name }, role: hit.role, orgs }, requestId: rid },
        origin,
        { 'set-cookie': setCookie, 'x-request-id': rid }
      );
    }



    // ---- Admin: OIDC config (owner/admin)
    if ((method === 'GET' || method === 'PUT') && path === '/admin/oidc') {
      const sess = requireAuth(event);
      if (!sess) return json(401, { ok:false, error:'unauthorized', requestId: rid }, origin, { 'x-request-id': rid });
      const ctx = await loadSessionContext(event, sess);
      if (!ctx) return json(401, { ok:false, error:'unauthorized', requestId: rid }, origin, { 'set-cookie': sessionClearingCookies(event), 'x-request-id': rid });
      if (!requireCsrf(event)) return json(403, { ok:false, error:'csrf_failed', requestId: rid }, origin, { 'x-request-id': rid });
      if (ctx.role !== 'owner' && ctx.role !== 'admin') return json(403, { ok:false, error:'forbidden', requestId: rid }, origin, { 'x-request-id': rid });

      if (method === 'GET') {
        const rows = await sql`SELECT org_id, issuer_url, client_id, redirect_uri, scopes, updated_at FROM oidc_configs WHERE org_id = ${ctx.orgId} LIMIT 1`;
        return json(200, { ok:true, data: rows?.[0] || null, requestId: rid }, origin, { 'x-request-id': rid });
      }

      const body = parseBody(event) || {};
      const issuerUrl = String(body.issuerUrl || '').trim().replace(/\/+$/, '');
      const clientId = String(body.clientId || '').trim();
      const clientSecret = String(body.clientSecret || '').trim();
      const scopes = String(body.scopes || 'openid email profile').trim();
      if (!issuerUrl || !clientId || !clientSecret) {
        return json(400, { ok:false, error:'invalid_oidc_config', requestId: rid }, origin, { 'x-request-id': rid });
      }
      const base = baseUrlOf(event, origin);
      const redirectUri = base ? `${base}/api/oidc/callback` : `${issuerUrl}/api/oidc/callback`;

      const enc = encryptSecret(clientSecret);
      await sql`
        INSERT INTO oidc_configs (org_id, issuer_url, client_id, client_secret_enc, redirect_uri, scopes, created_at, updated_at)
        VALUES (${ctx.orgId}, ${issuerUrl}, ${clientId}, ${enc}, ${redirectUri}, ${scopes}, now(), now())
        ON CONFLICT (org_id) DO UPDATE
          SET issuer_url = EXCLUDED.issuer_url,
              client_id = EXCLUDED.client_id,
              client_secret_enc = EXCLUDED.client_secret_enc,
              redirect_uri = EXCLUDED.redirect_uri,
              scopes = EXCLUDED.scopes,
              updated_at = now()
      `;
      await audit(event, ctx.orgId, ctx.userId, 'oidc.config.update', 'org', ctx.orgId, { issuerUrl });
      return json(200, { ok:true, requestId: rid }, origin, { 'x-request-id': rid });
    }

    
    // ---- Admin: SIEM config (owner/admin)
    if ((method === 'GET' || method === 'PUT') && path === '/admin/siem') {
      const sess = requireAuth(event);
      if (!sess) return json(401, { ok:false, error:'unauthorized', requestId: rid }, origin, { 'x-request-id': rid });
      const ctx = await loadSessionContext(event, sess);
      if (!ctx) return json(401, { ok:false, error:'unauthorized', requestId: rid }, origin, { 'set-cookie': sessionClearingCookies(event), 'x-request-id': rid });
      if (!requireCsrf(event)) return json(403, { ok:false, error:'csrf_failed', requestId: rid }, origin, { 'x-request-id': rid });
      if (ctx.role !== 'owner' && ctx.role !== 'admin') return json(403, { ok:false, error:'forbidden', requestId: rid }, origin, { 'x-request-id': rid });

      if (method === 'GET') {
        const rows = await sql`SELECT endpoint_url, auth_header, updated_at FROM org_siem_configs WHERE org_id = ${ctx.orgId} LIMIT 1`;
        return json(200, { ok:true, data: rows?.[0] || null, requestId: rid }, origin, { 'x-request-id': rid });
      }

      const body = parseBody(event) || {};
      const endpointUrl = String(body.endpointUrl || '').trim();
      const authHeader = (body.authHeader == null) ? null : String(body.authHeader).trim();
      if (!endpointUrl || !/^https?:\/\//i.test(endpointUrl)) return json(400, { ok:false, error:'invalid_endpoint', requestId: rid }, origin, { 'x-request-id': rid });

      await sql`
        INSERT INTO org_siem_configs (org_id, endpoint_url, auth_header, created_at, updated_at)
        VALUES (${ctx.orgId}, ${endpointUrl}, ${authHeader}, now(), now())
        ON CONFLICT (org_id) DO UPDATE
          SET endpoint_url = EXCLUDED.endpoint_url,
              auth_header = EXCLUDED.auth_header,
              updated_at = now()
      `;
      await audit(event, ctx.orgId, ctx.userId, 'siem.config.update', 'org', ctx.orgId, { endpointUrl });
      return json(200, { ok:true, requestId: rid }, origin, { 'x-request-id': rid });
    }

    // ---- Manual SIEM delivery trigger (owner/admin)
    if (method === 'POST' && path === '/siem/deliver') {
      const sess = requireAuth(event);
      if (!sess) return json(401, { ok:false, error:'unauthorized', requestId: rid }, origin, { 'x-request-id': rid });
      const ctx = await loadSessionContext(event, sess);
      if (!ctx) return json(401, { ok:false, error:'unauthorized', requestId: rid }, origin, { 'set-cookie': sessionClearingCookies(event), 'x-request-id': rid });
      if (!requireCsrf(event)) return json(403, { ok:false, error:'csrf_failed', requestId: rid }, origin, { 'x-request-id': rid });
      if (ctx.role !== 'owner' && ctx.role !== 'admin') return json(403, { ok:false, error:'forbidden', requestId: rid }, origin, { 'x-request-id': rid });

      const maxBatch = clampInt(process.env.SIEM_MAX_BATCH || SIEM_MAX_BATCH, 1, 500, 100);
      const res = await deliverSiemBatch(ctx.orgId, maxBatch);
      return json(200, { ok:true, data: res, requestId: rid }, origin, { 'x-request-id': rid });
    }


    // ---- Admin: SAML config (owner/admin)
    if ((method === 'GET' || method === 'PUT') && path === '/admin/saml') {
      const sess = requireAuth(event);
      if (!sess) return json(401, { ok:false, error:'unauthorized', requestId: rid }, origin, { 'x-request-id': rid });
      const ctx = await loadSessionContext(event, sess);
      if (!ctx) return json(401, { ok:false, error:'unauthorized', requestId: rid }, origin, { 'set-cookie': sessionClearingCookies(event), 'x-request-id': rid });
      if (!requireCsrf(event)) return json(403, { ok:false, error:'csrf_failed', requestId: rid }, origin, { 'x-request-id': rid });
      if (ctx.role !== 'owner' && ctx.role !== 'admin') return json(403, { ok:false, error:'forbidden', requestId: rid }, origin, { 'x-request-id': rid });

      if (method === 'GET') {
        const rows = await sql`SELECT org_id, idp_entity_id, idp_sso_url, sp_entity_id, acs_url, audience, want_response_signed, want_assertion_signed, updated_at FROM saml_configs WHERE org_id = ${ctx.orgId} LIMIT 1`;
        return json(200, { ok:true, data: rows?.[0] || null, requestId: rid }, origin, { 'x-request-id': rid });
      }

      const body = parseBody(event) || {};
      const idpEntityId = String(body.idpEntityId || '').trim();
      const idpSsoUrl = String(body.idpSsoUrl || '').trim();
      const spEntityId = String(body.spEntityId || '').trim();
      const acsUrl = String(body.acsUrl || '').trim();
      const audience = String(body.audience || spEntityId || '').trim();
      const certPem = String(body.x509CertPem || '').trim();
      const wantResponseSigned = (body.wantResponseSigned == null) ? true : !!body.wantResponseSigned;
      const wantAssertionSigned = (body.wantAssertionSigned == null) ? true : !!body.wantAssertionSigned;

      if (!idpEntityId || !idpSsoUrl || !spEntityId || !acsUrl || !audience || !certPem) {
        return json(400, { ok:false, error:'invalid_saml_config', requestId: rid }, origin, { 'x-request-id': rid });
      }

      await sql`
        INSERT INTO saml_configs (org_id, idp_entity_id, idp_sso_url, sp_entity_id, acs_url, audience, x509_cert_pem, want_response_signed, want_assertion_signed, created_at, updated_at)
        VALUES (${ctx.orgId}, ${idpEntityId}, ${idpSsoUrl}, ${spEntityId}, ${acsUrl}, ${audience}, ${certPem}, ${wantResponseSigned}, ${wantAssertionSigned}, now(), now())
        ON CONFLICT (org_id) DO UPDATE
          SET idp_entity_id = EXCLUDED.idp_entity_id,
              idp_sso_url = EXCLUDED.idp_sso_url,
              sp_entity_id = EXCLUDED.sp_entity_id,
              acs_url = EXCLUDED.acs_url,
              audience = EXCLUDED.audience,
              x509_cert_pem = EXCLUDED.x509_cert_pem,
              want_response_signed = EXCLUDED.want_response_signed,
              want_assertion_signed = EXCLUDED.want_assertion_signed,
              updated_at = now()
      `;
      await audit(event, ctx.orgId, ctx.userId, 'saml.config.update', 'org', ctx.orgId, { idpEntityId });
      return json(200, { ok:true, requestId: rid }, origin, { 'x-request-id': rid });
    }

    // ---- SAML metadata (public)
    if (method === 'GET' && path === '/saml/metadata') {
      const q = event.queryStringParameters || {};
      const orgId = String(q.orgId || '').trim();
      if (!orgId) return json(400, { ok:false, error:'missing_org', requestId: rid }, origin, { 'x-request-id': rid });

      const cfg = await getSamlConfig(orgId, origin, rid);
      if (!cfg) return json(404, { ok:false, error:'saml_not_configured', requestId: rid }, origin, { 'x-request-id': rid });

      return { statusCode: 200, headers: { ...corsHeaders(origin), 'content-type': 'application/xml', 'x-request-id': rid }, body: samlMetadataXml(cfg) };
    }

    // ---- SAML start (public)
    if (method === 'GET' && path === '/saml/start') {
      const enabled = String(process.env.SAML_ENABLED || SAML_ENABLED || 'false').toLowerCase() === 'true';
      if (!enabled) return json(404, { ok:false, error:'saml_disabled', requestId: rid }, origin, { 'x-request-id': rid });

      const q = event.queryStringParameters || {};
      const orgId = String(q.orgId || '').trim();
      const next = String(q.next || '/').trim();
      if (!orgId) return json(400, { ok:false, error:'missing_org', requestId: rid }, origin, { 'x-request-id': rid });

      const cfg = await getSamlConfig(orgId, origin, rid);
      if (!cfg) return json(404, { ok:false, error:'saml_not_configured', requestId: rid }, origin, { 'x-request-id': rid });

      // RelayState via cookie
      const setCookie = serializeCookie('wpp_saml_next', encodeURIComponent(next), { ...csrfCookieOptions(event), maxAge: 600 });

      // IdP-initiated or SP-initiated: here we do redirect to IdP SSO with no AuthnRequest (minimal). Many IdPs support IdP-initiated flows.
      return redirect(302, cfg.idp_sso_url, origin, { 'set-cookie': setCookie, 'x-request-id': rid });
    }

    // ---- SAML ACS (public HTTP-POST)
    if (method === 'POST' && path === '/saml/acs') {
      const enabled = String(process.env.SAML_ENABLED || SAML_ENABLED || 'false').toLowerCase() === 'true';
      if (!enabled) return json(404, { ok:false, error:'saml_disabled', requestId: rid }, origin, { 'x-request-id': rid });

      const body = parseBody(event) || {};
      const orgId = String(body.orgId || (event.queryStringParameters || {}).orgId || '').trim();
      const samlResponse = String(body.SAMLResponse || '').trim();
      if (!orgId || !samlResponse) return json(400, { ok:false, error:'invalid_saml_response', requestId: rid }, origin, { 'x-request-id': rid });

      const cfg = await getSamlConfig(orgId, origin, rid);
      if (!cfg) return json(404, { ok:false, error:'saml_not_configured', requestId: rid }, origin, { 'x-request-id': rid });

      const xml = samlDecode(samlResponse);

      // Basic issuer/audience/time checks
      const issuer = xmlFind('saml:Issuer', xml) || xmlFind('Issuer', xml);
      if (!issuer || issuer.trim() !== cfg.idp_entity_id) return json(401, { ok:false, error:'saml_issuer_mismatch', requestId: rid }, origin, { 'x-request-id': rid });

      const audience = xmlFind('saml:Audience', xml) || xmlFind('Audience', xml);
      if (audience && audience.trim() !== cfg.audience) return json(401, { ok:false, error:'saml_audience_mismatch', requestId: rid }, origin, { 'x-request-id': rid });

      const notBefore = xmlAttr('saml:Conditions', 'NotBefore', xml) || xmlAttr('Conditions','NotBefore',xml);
      const notOnOrAfter = xmlAttr('saml:Conditions', 'NotOnOrAfter', xml) || xmlAttr('Conditions','NotOnOrAfter',xml);
      if (!samlNowOk(notBefore, notOnOrAfter)) return json(401, { ok:false, error:'saml_time_invalid', requestId: rid }, origin, { 'x-request-id': rid });

      // Signature verify (best-effort)
      const v = samlVerifySignature(xml, cfg.x509_cert_pem);
      if (!v.ok) return json(401, { ok:false, error:v.error, requestId: rid }, origin, { 'x-request-id': rid });

      // Extract NameID (email)
      const nameId = xmlFind('saml:NameID', xml) || xmlFind('NameID', xml);
      const email = validateEmail(nameId);
      if (!email) return json(401, { ok:false, error:'saml_missing_nameid', requestId: rid }, origin, { 'x-request-id': rid });

      // SessionIndex (optional)
      const sessionIndex = xmlAttr('saml:AuthnStatement', 'SessionIndex', xml) || xmlAttr('AuthnStatement','SessionIndex',xml) || null;

      // Upsert user + membership
      const userRows = await sql`SELECT id, email, token_version FROM users WHERE email = ${email} LIMIT 1`;
      let userId = userRows?.[0]?.id || crypto.randomUUID();
      if (!userRows || userRows.length === 0) {
        const pw = await bcrypt.hash(makeOpaqueToken(), 12);
        await sql`INSERT INTO users (id, email, password_hash, email_verified, token_version, created_at, updated_at, last_login_at)
                  VALUES (${userId}, ${email}, ${pw}, true, 0, now(), now(), now())`;
      } else {
        userId = userRows[0].id;
        await sql`UPDATE users SET email_verified = true, last_login_at = now(), updated_at = now() WHERE id = ${userId}`;
      }
      await ensurePrimaryEmailRow(userId, email);

      await sql`
        INSERT INTO memberships (org_id, user_id, role, active, created_at, updated_at)
        VALUES (${orgId}, ${userId}, 'member', true, now(), now())
        ON CONFLICT (org_id, user_id) DO UPDATE SET active = true, updated_at = now()
      `;

      // Record SAML session mapping
      await sql`INSERT INTO saml_sessions (id, org_id, user_id, name_id, session_index, created_at)
                VALUES (${crypto.randomUUID()}, ${orgId}, ${userId}, ${email}, ${sessionIndex}, now())`;

      const m = await sql`
        SELECT m.role, u.token_version
        FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.org_id = ${orgId} AND m.user_id = ${userId}
        LIMIT 1
      `;
      const role = m?.[0]?.role || 'member';
      const tv = Number(m?.[0]?.token_version || 0);

      const csrf = crypto.randomUUID();
      const token = signSession({ sub: userId, orgId, email, role, tv });
      const maxAgeSec = 60 * 60 * 24 * clampInt(SESSION_TTL_DAYS, 1, 30, 7);

      const c = cookiesOf(event);
      const nextRaw = c.wpp_saml_next ? decodeURIComponent(String(c.wpp_saml_next)) : '/';
      const nextUrl = (nextRaw && nextRaw.startsWith('/')) ? nextRaw : '/';

      const setCookie = [
        serializeCookie('wpp_session', token, { ...cookieOptions(event), maxAge: maxAgeSec }),
        serializeCookie('wpp_csrf', csrf, { ...csrfCookieOptions(event), maxAge: maxAgeSec }),
        serializeCookie('wpp_saml_next', '', { ...csrfCookieOptions(event), maxAge: 0 }),
      ];

      await audit(event, orgId, userId, 'auth.saml_login', 'user', userId, { email });

      return redirect(302, nextUrl, origin, { 'set-cookie': setCookie, 'x-request-id': rid });
    }

// ---- OIDC: start (SSO) — public endpoint
    if (method === 'GET' && path === '/oidc/start') {
      const q = event.queryStringParameters || {};
      const orgId = String(q.orgId || '').trim();
      const next = String(q.next || '/').trim();
      if (!orgId) return json(400, { ok:false, error:'missing_org', requestId: rid }, origin, { 'x-request-id': rid });

      const cfgRows = await sql`SELECT issuer_url, client_id, client_secret_enc, redirect_uri, scopes FROM oidc_configs WHERE org_id = ${orgId} LIMIT 1`;
      if (!cfgRows || cfgRows.length === 0) return json(404, { ok:false, error:'oidc_not_configured', requestId: rid }, origin, { 'x-request-id': rid });
      const cfg = cfgRows[0];

      // Discovery
      const discUrl = `${cfg.issuer_url.replace(/\/+$/,'')}/.well-known/openid-configuration`;
      const disc = await fetch(discUrl).then(r => r.json());
      const authz = disc.authorization_endpoint;
      if (!authz) return json(500, { ok:false, error:'oidc_discovery_failed', requestId: rid }, origin, { 'x-request-id': rid });

      const stateId = crypto.randomUUID();
      const verifier = makeOpaqueToken();
      const nonce = makeOpaqueToken(); // 32 bytes base64url
      const challenge = pkceChallenge(verifier);

      await sql`
        INSERT INTO oidc_states (id, org_id, code_verifier, nonce, created_at, expires_at)
        VALUES (${stateId}, ${orgId}, ${verifier}, ${nonce}, now(), now() + interval '10 minutes')`;

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: cfg.client_id,
        redirect_uri: cfg.redirect_uri,
        scope: cfg.scopes || 'openid email profile',
        state: stateId,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        nonce,
      });

      // store intended redirect in non-HttpOnly cookie (low sensitivity)
      const setCookie = serializeCookie('wpp_oidc_next', encodeURIComponent(next), { ...csrfCookieOptions(event), maxAge: 600 });

      return redirect(302, `${authz}?${params.toString()}`, origin, { 'set-cookie': setCookie, 'x-request-id': rid });
    }

    // ---- OIDC: callback — public endpoint
    if (method === 'GET' && path === '/oidc/callback') {
      const q = event.queryStringParameters || {};
      const code = String(q.code || '').trim();
      const stateId = String(q.state || '').trim();
      if (!code || !stateId) return json(400, { ok:false, error:'invalid_callback', requestId: rid }, origin, { 'x-request-id': rid });

      const st = await sql`SELECT id, org_id, code_verifier, nonce, expires_at FROM oidc_states WHERE id = ${stateId} LIMIT 1`;
      if (!st || st.length === 0) return json(400, { ok:false, error:'state_not_found', requestId: rid }, origin, { 'x-request-id': rid });
      if (new Date(st[0].expires_at).getTime() < Date.now()) return json(400, { ok:false, error:'state_expired', requestId: rid }, origin, { 'x-request-id': rid });

      const orgId = st[0].org_id;
      const cfgRows = await sql`SELECT issuer_url, client_id, client_secret_enc, redirect_uri FROM oidc_configs WHERE org_id = ${orgId} LIMIT 1`;
      if (!cfgRows || cfgRows.length === 0) return json(404, { ok:false, error:'oidc_not_configured', requestId: rid }, origin, { 'x-request-id': rid });
      const cfg = cfgRows[0];

      const discUrl = `${cfg.issuer_url.replace(/\/+$/,'')}/.well-known/openid-configuration`;
      const disc = await fetch(discUrl).then(r => r.json());
      const tokenEndpoint = disc.token_endpoint;
      const userinfoEndpoint = disc.userinfo_endpoint;
      if (!tokenEndpoint || !userinfoEndpoint) return json(500, { ok:false, error:'oidc_discovery_failed', requestId: rid }, origin, { 'x-request-id': rid });

      const secret = decryptSecret(cfg.client_secret_enc);

      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: cfg.redirect_uri,
        client_id: cfg.client_id,
        code_verifier: st[0].code_verifier,
      });

      const tokResp = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'authorization': 'Basic ' + Buffer.from(`${cfg.client_id}:${secret}`).toString('base64'),
        },
        body: body.toString(),
      }).then(r => r.json());

      if (!tokResp || !tokResp.access_token) return json(401, { ok:false, error:'oidc_token_exchange_failed', requestId: rid }, origin, { 'x-request-id': rid });

      // JWKS signature verification for id_token
      const jwksUri = disc.jwks_uri;
      if (!jwksUri) return json(500, { ok:false, error:'oidc_discovery_failed', requestId: rid }, origin, { 'x-request-id': rid });
      if (OIDC_REQUIRE_ID_TOKEN && !tokResp.id_token) {
        return json(401, { ok:false, error:'oidc_missing_id_token', requestId: rid }, origin, { 'x-request-id': rid });
      }

      let claimsEmail = null;
      if (tokResp.id_token) {
        const v = await verifyIdToken(tokResp.id_token, cfg.issuer_url, cfg.client_id, jwksUri);
        if (!v.ok) return json(401, { ok:false, error: v.error || 'oidc_id_token_invalid', requestId: rid }, origin, { 'x-request-id': rid });
        claimsEmail = validateEmail(v.payload.email || v.payload.preferred_username || v.payload.upn);
        // Nonce binds the id_token to the original authorization request
        if (st[0].nonce && String(v.payload.nonce || '') !== String(st[0].nonce)) {
          return json(401, { ok:false, error:'oidc_nonce_mismatch', requestId: rid }, origin, { 'x-request-id': rid });
        }
      }

      const userinfo = await fetch(userinfoEndpoint, {
        headers: { 'authorization': `Bearer ${tokResp.access_token}` }
      }).then(r => r.json());

      const email = validateEmail(claimsEmail || userinfo.email || userinfo.preferred_username || userinfo.upn);
      if (!email) return json(400, { ok:false, error:'oidc_missing_email', requestId: rid }, origin, { 'x-request-id': rid });

      // Upsert user + membership
      const userRows = await sql`SELECT id, email, token_version FROM users WHERE email = ${email} LIMIT 1`;
      let userId = userRows?.[0]?.id || crypto.randomUUID();
      if (!userRows || userRows.length === 0) {
        const pw = await bcrypt.hash(makeOpaqueToken(), 12);
        await sql`
          INSERT INTO users (id, email, password_hash, email_verified, token_version, failed_login_count, password_changed_at, created_at, last_login_at)
          VALUES (${userId}, ${email}, ${pw}, true, 0, 0, now(), now(), now())
        `;
      
      await ensurePrimaryEmailRow(userId, email);
} else {
        userId = userRows[0].id;
        await sql`UPDATE users SET email_verified = true, last_login_at = now(), updated_at = now() WHERE id = ${userId}`;
        await ensurePrimaryEmailRow(userId, email);
      }

      await sql`
        INSERT INTO memberships (org_id, user_id, role, active, created_at)
        VALUES (${orgId}, ${userId}, 'member', true, now())
        ON CONFLICT (org_id, user_id) DO UPDATE SET active = true
      `;

      const m = await sql`
        SELECT m.role, u.token_version, o.name AS org_name
        FROM memberships m JOIN users u ON u.id = m.user_id JOIN orgs o ON o.id = m.org_id
        WHERE m.org_id = ${orgId} AND m.user_id = ${userId}
        LIMIT 1
      `;
      const role = m?.[0]?.role || 'member';
      const tv = Number(m?.[0]?.token_version || 0);
      const csrf = crypto.randomUUID();
      const token = signSession({ sub: userId, orgId, email, role, tv });
      const maxAgeSec = 60 * 60 * 24 * clampInt(SESSION_TTL_DAYS, 1, 30, 7);

      const c = cookiesOf(event);
      const nextRaw = c.wpp_oidc_next ? decodeURIComponent(String(c.wpp_oidc_next)) : '/';
      const nextUrl = (nextRaw && nextRaw.startsWith('/')) ? nextRaw : '/';

      const setCookie = [
        serializeCookie('wpp_session', token, { ...cookieOptions(event), maxAge: maxAgeSec }),
        serializeCookie('wpp_csrf', csrf, { ...csrfCookieOptions(event), maxAge: maxAgeSec }),
        serializeCookie('wpp_oidc_next', '', { ...csrfCookieOptions(event), maxAge: 0 }),
      ];

      await sql`DELETE FROM oidc_states WHERE id = ${stateId}`;
      await audit(event, orgId, userId, 'auth.oidc_login', 'user', userId, { email });

      return redirect(302, nextUrl, origin, { 'set-cookie': setCookie, 'x-request-id': rid });
    }

    // ---- Admin: SCIM token (owner/admin)
    if ((method === 'GET' || method === 'POST') && path === '/admin/scim/tokens') {
      const sess = requireAuth(event);
      if (!sess) return json(401, { ok:false, error:'unauthorized', requestId: rid }, origin, { 'x-request-id': rid });
      const ctx = await loadSessionContext(event, sess);
      if (!ctx) return json(401, { ok:false, error:'unauthorized', requestId: rid }, origin, { 'set-cookie': sessionClearingCookies(event), 'x-request-id': rid });
      if (!requireCsrf(event)) return json(403, { ok:false, error:'csrf_failed', requestId: rid }, origin, { 'x-request-id': rid });
      if (ctx.role !== 'owner' && ctx.role !== 'admin') return json(403, { ok:false, error:'forbidden', requestId: rid }, origin, { 'x-request-id': rid });

      if (method === 'GET') {
        const rows = await sql`SELECT id, name, created_at, last_used_at FROM scim_tokens WHERE org_id = ${ctx.orgId} ORDER BY created_at DESC LIMIT 20`;
        return json(200, { ok:true, data: rows, requestId: rid }, origin, { 'x-request-id': rid });
      }

      const body = parseBody(event) || {};
      const name = String(body.name || 'default').trim().slice(0, 60) || 'default';
      const raw = makeOpaqueToken();
      const hash = tokenHash(raw);
      const id = crypto.randomUUID();
      await sql`INSERT INTO scim_tokens (id, org_id, name, token_hash, created_at) VALUES (${id}, ${ctx.orgId}, ${name}, ${hash}, now())`;
      await audit(event, ctx.orgId, ctx.userId, 'scim.token.create', 'scim_token', id, { name });
      return json(200, { ok:true, data:{ id, name, token: raw }, requestId: rid }, origin, { 'x-request-id': rid });
    }

    // ---- SCIM (public, bearer token)
    if (method === 'POST' && path === '/_scheduled/siem') {
      // Scheduled SIEM drain across all orgs that are configured.
      const maxBatch = clampInt(process.env.SIEM_MAX_BATCH || SIEM_MAX_BATCH, 1, 500, 100);
      const orgs = await sql`SELECT org_id FROM org_siem_configs`;
      let total = 0;
      for (const o of (orgs || [])) {
        try {
          await rlsSetOrg(o.org_id);
          const res = await deliverSiemBatch(o.org_id, maxBatch);
          total += Number(res?.delivered || 0);
        } catch (_) {}
      }
      return json(200, { ok:true, data:{ delivered: total }, requestId: rid }, origin, { 'x-request-id': rid });
    }

    if (path.startsWith('/scim/v2')) {
      const sc = await scimContext(event);
      if (!sc) return json(401, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"401", detail:"Unauthorized" }, origin, { 'x-request-id': rid });

      const orgId = sc.orgId;

      // ServiceProviderConfig
      if (method === 'GET' && path === '/scim/v2/ServiceProviderConfig') {
        return json(200, {
          schemas:["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
          patch:{ supported:true },
          bulk:{ supported:false },
          filter:{ supported:true, maxResults:200 },
          changePassword:{ supported:false },
          sort:{ supported:false },
          etag:{ supported:false },
          authenticationSchemes:[{ type:"oauthbearertoken", name:"Bearer", description:"Bearer token" }]
        }, origin, { 'x-request-id': rid });
      }

      // ---- Bulk (IdP probe hardening)
      if (path === '/scim/v2/Bulk' && method === 'POST') {
        const body = parseBody(event) || {};
        const ops = Array.isArray(body.Operations) ? body.Operations : [];
        const failOnErrors = Number(body.failOnErrors || 0) || 0;
        const maxOps = 100;

        if (ops.length > maxOps) {
          return json(413, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"413", detail:`Too many operations (max ${maxOps})` }, origin, { 'x-request-id': rid });
        }

        let errors = 0;
        const results = [];

        async function opError(op, status, detail) {
          errors++;
          results.push({
            method: String(op.method || '').toUpperCase() || "POST",
            bulkId: op.bulkId,
            path: op.path,
            status: String(status),
            response: { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:String(status), detail }
          });
        }

        for (const op of ops) {
          if (failOnErrors && errors >= failOnErrors) break;

          const method2 = String(op.method || 'POST').toUpperCase();
          const path2 = String(op.path || '').trim();
          const data = op.data || op.value || {};

          try {
            // POST /Users
            if (path2 === '/Users' && method2 === 'POST') {
              const email = validateEmail(data.userName || data.emails?.[0]?.value);
              if (!email) { await opError(op, 400, "Invalid userName/email"); continue; }

              const u = await sql`SELECT id, email FROM users WHERE email = ${email} LIMIT 1`;
              let userId = u?.[0]?.id || crypto.randomUUID();
              if (!u || u.length === 0) {
                const pw = await bcrypt.hash(makeOpaqueToken(), 12);
                await sql`INSERT INTO users (id, email, password_hash, email_verified, token_version, created_at, updated_at) VALUES (${userId}, ${email}, ${pw}, true, 0, now(), now())`;
              }
              await sql`
                INSERT INTO memberships (org_id, user_id, role, active, created_at, updated_at)
                VALUES (${orgId}, ${userId}, 'member', true, now(), now())
                ON CONFLICT (org_id, user_id) DO UPDATE SET active = true, updated_at = now()
              `;
              await audit(event, orgId, userId, 'scim.user.provision', 'user', userId, { email, bulk: true });
              results.push({ method: method2, bulkId: op.bulkId, path: op.path, status:"201", response: scimUser({ id:userId, email }, orgId, true) });
              continue;
            }

            // PATCH/PUT/DELETE /Users/:id
            const um = path2.match(/^\/Users\/([0-9a-fA-F-]{36})$/);
            if (um && (method2 === 'PATCH' || method2 === 'PUT' || method2 === 'DELETE')) {
              const userId = um[1];

              if (method2 === 'DELETE') {
                await sql`UPDATE memberships SET active = false, updated_at = now() WHERE org_id = ${orgId} AND user_id = ${userId}`;
                await sql`UPDATE users SET token_version = token_version + 1, updated_at = now() WHERE id = ${userId}`;
                await audit(event, orgId, userId, 'scim.user.delete', 'user', userId, { bulk: true });
                results.push({ method: method2, bulkId: op.bulkId, path: op.path, status:"204" });
                continue;
              }

              const patch = parseScimPatch(data);
              const active = (patch.active == null) ? true : !!patch.active;

          const emailUpdate = validateEmail(patch.userName);


              if (patch.email) {
                try { await sql`UPDATE users SET email = ${patch.email}, updated_at = now() WHERE id = ${userId}`; }
                catch (_) { await opError(op, 409, "email already exists"); continue; }
              }

              await sql`
                INSERT INTO memberships (org_id, user_id, role, active, created_at, updated_at)
                VALUES (${orgId}, ${userId}, 'member', ${active}, now(), now())
                ON CONFLICT (org_id, user_id) DO UPDATE SET active = EXCLUDED.active, updated_at = now()
              `;

              if (!active) {
                await sql`UPDATE users SET token_version = token_version + 1, updated_at = now() WHERE id = ${userId}`;
                await audit(event, orgId, userId, 'scim.user.deprovision', 'user', userId, { bulk: true });
              } else {
                await audit(event, orgId, userId, 'scim.user.update', 'user', userId, { bulk: true, email: patch.email || null, active });
              }

              const rows = await sql`SELECT id, email FROM users WHERE id = ${userId} LIMIT 1`;
              if (!rows || rows.length === 0) { await opError(op, 404, "Not found"); continue; }
              results.push({ method: method2, bulkId: op.bulkId, path: op.path, status:"200", response: scimUser({ id: rows[0].id, email: rows[0].email }, orgId, active) });
              continue;
            }

            // POST /Groups
            if (path2 === '/Groups' && method2 === 'POST') {
              const displayName = String(data.displayName || '').trim().slice(0,120);
              if (!displayName) { await opError(op, 400, "Missing displayName"); continue; }

              const gid = crypto.randomUUID();
              await sql`INSERT INTO scim_groups (id, org_id, display_name, created_at, updated_at) VALUES (${gid}, ${orgId}, ${displayName}, now(), now())`;

              const members = Array.isArray(data.members) ? data.members : [];
              for (const m of members.slice(0, 200)) {
                const uid = String(m?.value || '').trim();
                if (!uid) continue;
                await sql`INSERT INTO scim_group_members (group_id, user_id, created_at, updated_at) VALUES (${gid}, ${uid}, now(), now())
                          ON CONFLICT (group_id, user_id) DO UPDATE SET updated_at = now()`;
              }

              await audit(event, orgId, null, 'scim.group.create', 'group', gid, { displayName, bulk: true });
              results.push({ method: method2, bulkId: op.bulkId, path: op.path, status:"201", response: { schemas:["urn:ietf:params:scim:schemas:core:2.0:Group"], id: gid, displayName } });
              continue;
            }

            // PATCH/PUT/DELETE /Groups/:id
            const gm = path2.match(/^\/Groups\/([0-9a-fA-F-]{36})$/);
            if (gm && (method2 === 'PATCH' || method2 === 'PUT' || method2 === 'DELETE')) {
              const groupId = gm[1];

              if (method2 === 'DELETE') {
                await sql`DELETE FROM scim_groups WHERE org_id = ${orgId} AND id = ${groupId}`;
                await audit(event, orgId, null, 'scim.group.delete', 'group', groupId, { bulk: true });
                results.push({ method: method2, bulkId: op.bulkId, path: op.path, status:"204" });
                continue;
              }

              let displayName = null;
              if (data.displayName != null) displayName = String(data.displayName || '').trim().slice(0,120);

              if (Array.isArray(data.Operations)) {
                for (const op2 of data.Operations) {
                  const operation = String(op2.op || 'replace').toLowerCase();
                  const pth = String(op2.path || '').toLowerCase();
                  const val = op2.value;
                  if (pth === 'displayname' && val != null) displayName = String(val || '').trim().slice(0,120);

                  if (pth.startsWith('members') || pth === 'members') {
                    const arr = Array.isArray(val) ? val : (val?.members ? val.members : []);
                    const ids = arr.map(x => String(x?.value || '').trim()).filter(Boolean).slice(0,500);

                    if (operation === 'replace') {
                      await bulkReplaceGroupMembers(groupId, ids);
                    } else if (operation === 'add') {
                      await bulkAddGroupMembers(groupId, ids);
                    } else if (operation === 'remove') {
                      await bulkRemoveGroupMembers(groupId, ids);
                    }
                  }
                }
              } else if (Array.isArray(data.members)) {
                const ids = data.members.map(x => String(x?.value || '').trim()).filter(Boolean).slice(0,500);
                await bulkReplaceGroupMembers(groupId, ids);
              }

              if (displayName) {
                await sql`UPDATE scim_groups SET display_name = ${displayName}, updated_at = now() WHERE id = ${groupId} AND org_id = ${orgId}`;
              } else {
                await sql`UPDATE scim_groups SET updated_at = now() WHERE id = ${groupId} AND org_id = ${orgId}`;
              }

              await audit(event, orgId, null, 'scim.group.update', 'group', groupId, { bulk: true, displayName: displayName || null });
              results.push({ method: method2, bulkId: op.bulkId, path: op.path, status:"200" });
              continue;
            }

            await opError(op, 501, "Operation not supported");
          } catch (e) {
            await opError(op, 500, String(e?.message || e));
          }
        }

        return json(200, { schemas:["urn:ietf:params:scim:api:messages:2.0:BulkResponse"], Operations: results }, origin, { 'x-request-id': rid });
      }


      // Users collection
                  if (path === '/scim/v2/Users' && method === 'GET') {
        const q = event.queryStringParameters || {};
        const startIndex = Math.max(1, Number(q.startIndex || 1));
        const count = Math.min(200, Math.max(1, Number(q.count || 50)));
        const filterStr = String(q.filter || '').trim();
        const includeEmails = String(q.includeEmails || '').toLowerCase() === 'true' || String(q.includeEmails || '') === '1';
        const emailsStartIndex = Math.max(1, Number(q.emailsStartIndex || 1));
        const emailsCount = Math.min(50, Math.max(1, Number(q.emailsCount || 10)));
        const sortBy = String(q.sortBy || '').trim();
        const sortOrder = String(q.sortOrder || '').trim();
        const orderBy = scimOrderBy('users', sortBy, sortOrder);

        let ast = null;
        if (filterStr) {
          try { ast = scimParseFilter(filterStr); }
          catch (_) {
            return json(400, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"400", detail:"Invalid filter" }, origin, { 'x-request-id': rid });
          }
        }

        let compiled = { sql: "true", params: [] };
        if (ast) {
          try { compiled = scimCompileFilter(ast, 'users'); }
          catch (_) {
            return json(400, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"400", detail:"Unsupported filter" }, origin, { 'x-request-id': rid });
          }
        }

        const whereSql = `WHERE m.org_id = $1 AND m.active = true AND (${compiled.sql})`;
        const params = [orgId, ...compiled.params];

        const fh = crypto.createHash('sha256').update(filterStr).digest('hex').slice(0, 8);
        const agg = await sql(
          `SELECT count(*)::int AS c, max(u.updated_at) AS max_u, max(m.updated_at) AS max_m
           FROM memberships m JOIN users u ON u.id = m.user_id
           ${whereSql}`,
          params
        );

        const listEtag = etagListFor(`users:${fh}`, agg?.[0]?.c || 0, `${agg?.[0]?.max_u || ''}:${agg?.[0]?.max_m || ''}`);
        if (notModified(event, listEtag)) {
          return { statusCode: 304, headers: { ...corsHeaders(origin), 'x-request-id': rid, 'ETag': listEtag }, body: '' };
        }

        const rows = await sql(
          `SELECT u.id, u.email, u.updated_at, m.active
           FROM memberships m JOIN users u ON u.id = m.user_id
           ${whereSql}
           ORDER BY ${orderBy}
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, count, startIndex - 1]
        );

        return json(200, {
          schemas:["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
          totalResults: agg?.[0]?.c || 0,
          startIndex,
          itemsPerPage: count,
          Resources: await Promise.all((rows || []).map(async (r) => {
          const meta = { resourceType:"User", version: etagFor(r.id, r.updated_at) };
          if (!includeEmails) return { ...scimUser({ id:r.id, email:r.email }, orgId, r.active), meta };
          const emails = await loadUserEmails(r.id, emailsCount, emailsStartIndex - 1);
          return { ...scimUser({ id:r.id, email:r.email }, orgId, r.active, emails), meta: { ...meta, emailsStartIndex, emailsItemsPerPage: emailsCount } };
        })),
        }, origin, { 'x-request-id': rid, 'ETag': listEtag });
      }

      if (path === '/scim/v2/Users' && method === 'POST') {
        const body = parseBody(event) || {};
        const email = validateEmail(body.userName || body.emails?.[0]?.value);
        if (!email) return json(400, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"400", detail:"Invalid userName/email" }, origin, { 'x-request-id': rid });

        const u = await sql`SELECT id, email FROM users WHERE email = ${email} LIMIT 1`;
        let userId = u?.[0]?.id || crypto.randomUUID();
        if (!u || u.length === 0) {
          const pw = await bcrypt.hash(makeOpaqueToken(), 12);
          await sql`INSERT INTO users (id, email, password_hash, email_verified, token_version, created_at, updated_at) VALUES (${userId}, ${email}, ${pw}, true, 0, now(), now())`;
        }

        
        // Multi-email support
        if (Array.isArray(body.emails) && body.emails.length) {
          await setUserEmails(userId, body.emails);
        } else {
          await ensurePrimaryEmailRow(userId, email);
        }

await sql`
          INSERT INTO memberships (org_id, user_id, role, active, created_at)
          VALUES (${orgId}, ${userId}, 'member', true, now())
          ON CONFLICT (org_id, user_id) DO UPDATE SET active = true
        `;

        await audit(event, orgId, userId, 'scim.user.provision', 'user', userId, { email });
        return json(201, scimUser({ id:userId, email }, orgId, true), origin, { 'x-request-id': rid });
      }

      
      const userEmailsMatch = path.match(/^\/scim\/v2\/Users\/([0-9a-fA-F-]{36})\/emails$/);
      if (userEmailsMatch && method === 'GET') {
        const userId = userEmailsMatch[1];
        const q = event.queryStringParameters || {};
        const startIndex = Math.max(1, Number(q.startIndex || 1));
        const count = Math.min(200, Math.max(1, Number(q.count || 50)));

        const cur = await sql`
          SELECT u.id, u.updated_at
          FROM users u
          JOIN memberships m ON m.user_id = u.id
          WHERE m.org_id = ${orgId} AND m.active = true AND u.id = ${userId}
          LIMIT 1
        `;
        if (!cur || cur.length === 0) return json(404, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"404", detail:"Not found" }, origin, { 'x-request-id': rid });

        const totalRows = await sql`SELECT count(*)::int AS c FROM user_emails WHERE user_id = ${userId}`;
        const rows = await sql`
          SELECT value, type, primary_email
          FROM user_emails
          WHERE user_id = ${userId}
          ORDER BY primary_email DESC, value ASC
          LIMIT ${count} OFFSET ${startIndex - 1}
        `;

        const listEtag = etagListFor(`user-emails:${userId}`, totalRows?.[0]?.c || 0, String(cur[0].updated_at || ''));
        if (notModified(event, listEtag)) {
          return { statusCode: 304, headers: { ...corsHeaders(origin), 'x-request-id': rid, 'ETag': listEtag }, body: '' };
        }

        return json(200, {
          schemas:["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
          totalResults: totalRows?.[0]?.c || 0,
          startIndex,
          itemsPerPage: count,
          Resources: (rows || []).map(r => ({ value: r.value, type: r.type, primary: !!r.primary_email })),
        }, origin, { 'x-request-id': rid, 'ETag': listEtag });
      }

const userMatch = path.match(/^\/scim\/v2\/Users\/([0-9a-fA-F-]{36})$/);
      if (userMatch) {
        const userId = userMatch[1];

        if (method === 'GET') {
          const rows = await sql`
            SELECT u.id, u.email, u.updated_at, m.active
            FROM memberships m
            JOIN users u ON u.id = m.user_id
            WHERE m.org_id = ${orgId} AND u.id = ${userId}
            LIMIT 1
          `;
          if (!rows || rows.length === 0) 

      // ---- Groups collection
                  if (path === '/scim/v2/Groups' && method === 'GET') {
        const q = event.queryStringParameters || {};
        const startIndex = Math.max(1, Number(q.startIndex || 1));
        const count = Math.min(200, Math.max(1, Number(q.count || 50)));
        const filterStr = String(q.filter || '').trim();

        let ast = null;
        if (filterStr) {
          try { ast = scimParseFilter(filterStr); }
          catch (_) {
            return json(400, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"400", detail:"Invalid filter" }, origin, { 'x-request-id': rid });
          }
        }

        let compiled = { sql: "true", params: [] };
        if (ast) {
          try { compiled = scimCompileFilter(ast, 'groups'); }
          catch (_) {
            return json(400, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"400", detail:"Unsupported filter" }, origin, { 'x-request-id': rid });
          }
        }

        const whereSql = `WHERE g.org_id = $1 AND (${compiled.sql})`;
        const params = [orgId, ...compiled.params];

        const fh = crypto.createHash('sha256').update(filterStr).digest('hex').slice(0, 8);
        const agg = await sql(
          `SELECT count(*)::int AS c, max(g.updated_at) AS max_g
           FROM scim_groups g
           ${whereSql}`,
          params
        );

        const listEtag = etagListFor(`groups:${fh}`, agg?.[0]?.c || 0, String(agg?.[0]?.max_g || ''));
        if (notModified(event, listEtag)) {
          return { statusCode: 304, headers: { ...corsHeaders(origin), 'x-request-id': rid, 'ETag': listEtag }, body: '' };
        }

        const rows = await sql(
          `SELECT g.id, g.display_name, g.updated_at
           FROM scim_groups g
           ${whereSql}
           ORDER BY ${orderBy}
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, count, startIndex - 1]
        );

        const Resources = (rows || []).map(g => ({
          schemas:["urn:ietf:params:scim:schemas:core:2.0:Group"],
          id: g.id,
          displayName: g.display_name,
          members: [],
          meta: { resourceType:"Group", version: etagFor(g.id, g.updated_at) }
        }));

        return json(200, {
          schemas:["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
          totalResults: agg?.[0]?.c || 0,
          startIndex,
          itemsPerPage: count,
          Resources,
        }, origin, { 'x-request-id': rid, 'ETag': listEtag });
      }

      if (path === '/scim/v2/Groups' && method === 'POST') {
        const body = parseBody(event) || {};
        const displayName = String(body.displayName || '').trim().slice(0, 120);
        if (!displayName) return json(400, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"400", detail:"Missing displayName" }, origin, { 'x-request-id': rid });

        const gid = crypto.randomUUID();
        await sql`INSERT INTO scim_groups (id, org_id, display_name, created_at, updated_at) VALUES (${gid}, ${orgId}, ${displayName}, now(), now())`;

        // Optional: initial members
        const members = Array.isArray(body.members) ? body.members : [];
        for (const m of members.slice(0, 200)) {
          const uid = String(m?.value || '').trim();
          if (!uid) continue;
          await sql`
            INSERT INTO scim_group_members (group_id, user_id, created_at, updated_at)
            VALUES (${gid}, ${uid}, now(), now())
            ON CONFLICT (group_id, user_id) DO UPDATE SET updated_at = now()
          `;
        }

        await audit(event, orgId, null, 'scim.group.create', 'group', gid, { displayName });

        const etag = etagFor(gid, new Date().toISOString());
        return json(201, {
          schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
          id: gid,
          displayName,
          members: members.map(x => ({ value: String(x.value||'') })).filter(x=>x.value),
          meta: { resourceType:"Group", version: etag, membersStartIndex: startIndex2, membersItemsPerPage: count2 }
        }, origin, { 'x-request-id': rid, 'ETag': etag });
      }

      
      const groupMembersMatch = path.match(/^\/scim\/v2\/Groups\/([0-9a-fA-F-]{36})\/members$/);
      if (groupMembersMatch && method === 'GET') {
        const groupId = groupMembersMatch[1];
        const q = event.queryStringParameters || {};
        const startIndex = Math.max(1, Number(q.startIndex || 1));
        const count = Math.min(200, Math.max(1, Number(q.count || 50)));
        const sortBy = String(q.sortBy || '').trim();
        const sortOrder = String(q.sortOrder || '').trim();
        const orderBy = scimOrderBy('groups', sortBy, sortOrder);

        const g = await sql`SELECT id, updated_at FROM scim_groups WHERE org_id = ${orgId} AND id = ${groupId} LIMIT 1`;
        if (!g || g.length === 0) return json(404, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"404", detail:"Not found" }, origin, { 'x-request-id': rid });

        const totalRows = await sql`SELECT count(*)::int AS c FROM scim_group_members WHERE group_id = ${groupId}`;
        const rows = await sql`
          SELECT u.id, u.email
          FROM scim_group_members gm
          JOIN users u ON u.id = gm.user_id
          WHERE gm.group_id = ${groupId}
          ORDER BY ${orderBy}
          LIMIT ${count} OFFSET ${startIndex - 1}
        `;

        const listEtag = etagListFor(`group-members:${groupId}`, totalRows?.[0]?.c || 0, String(g[0].updated_at || ''));
        if (notModified(event, listEtag)) {
          return { statusCode: 304, headers: { ...corsHeaders(origin), 'x-request-id': rid, 'ETag': listEtag }, body: '' };
        }

        return json(200, {
          schemas:["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
          totalResults: totalRows?.[0]?.c || 0,
          startIndex,
          itemsPerPage: count,
          Resources: (rows || []).map(r => ({ value: r.id, display: r.email })),
        }, origin, { 'x-request-id': rid, 'ETag': listEtag });
      }

const groupMatch = path.match(/^\/scim\/v2\/Groups\/([0-9a-fA-F-]{36})$/);
      if (groupMatch) {
        const groupId = groupMatch[1];

        if (method === 'GET') {
          const g = await sql`SELECT id, display_name, updated_at FROM scim_groups WHERE org_id = ${orgId} AND id = ${groupId} LIMIT 1`;
          if (!g || g.length === 0) return json(404, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"404", detail:"Not found" }, origin, { 'x-request-id': rid });

          const q2 = event.queryStringParameters || {};
          const startIndex2 = Math.max(1, Number(q2.startIndex || 1));
          const count2 = Math.min(500, Math.max(1, Number(q2.count || 200)));

          const mem = await sql`
            SELECT u.id, u.email
            FROM scim_group_members gm
            JOIN users u ON u.id = gm.user_id
            WHERE gm.group_id = ${groupId}
            ORDER BY ${orderBy}
            LIMIT ${count2} OFFSET ${startIndex2 - 1}
          `;

          const etag = etagFor(g[0].id, g[0].updated_at);
          return json(200, {
            schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
            id: g[0].id,
            displayName: g[0].display_name,
            members: (mem || []).map(r => ({ value: r.id, display: r.email })),
            meta: { resourceType:"Group", version: etag, membersStartIndex: startIndex2, membersItemsPerPage: count2 }
          }, origin, { 'x-request-id': rid, 'ETag': etag });
        }

        if (method === 'PUT' || method === 'PATCH') {
          const body = parseBody(event) || {};
          const q2 = event.queryStringParameters || {};
          const startIndex2 = Math.max(1, Number(q2.startIndex || 1));
          const count2 = Math.min(500, Math.max(1, Number(q2.count || 200)));
          const sortBy2 = String(q2.sortBy || '').trim();
          const sortOrder2 = String(q2.sortOrder || '').trim();
          const orderBy = scimOrderBy('groups', sortBy2, sortOrder2);

          const g = await sql`SELECT id, updated_at FROM scim_groups WHERE org_id = ${orgId} AND id = ${groupId} LIMIT 1`;
          if (!g || g.length === 0) return json(404, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"404", detail:"Not found" }, origin, { 'x-request-id': rid });

          const currentEtag = etagFor(g[0].id, g[0].updated_at);
          if (!preconditionOk(event, currentEtag)) {
            return json(412, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"412", detail:"ETag mismatch" }, origin, { 'x-request-id': rid, 'ETag': currentEtag });
          }

          let displayName = null;
          if (body.displayName != null) displayName = String(body.displayName || '').trim().slice(0,120);

          // PATCH operations support add/remove/replace members + displayName
          if (Array.isArray(body.Operations)) {
            for (const op of body.Operations) {
              const operation = String(op.op || 'replace').toLowerCase();
              const path = String(op.path || '').toLowerCase();
              const val = op.value;

              if (path === 'displayname' && val != null) displayName = String(val || '').trim().slice(0,120);

              if (path.startsWith('members') || path === 'members') {
                const arr = Array.isArray(val) ? val : (val?.members ? val.members : []);
                const ids = arr.map(x => String(x?.value || '').trim()).filter(Boolean).slice(0,500);

                if (operation === 'replace') {
                  await bulkReplaceGroupMembers(groupId, ids);
                } else if (operation === 'add') {
                  await bulkAddGroupMembers(groupId, ids);
                } else if (operation === 'remove') {
                  // Also allow remove via path filter members[value eq "uuid"] when value is omitted
                  const fromPath = parseMembersValuePath(op.path);
                  const ids2 = fromPath ? [fromPath] : ids;
                  await bulkRemoveGroupMembers(groupId, ids2);
                }
              }
            }
          } else if (Array.isArray(body.members)) {
            // PUT-like replace
            const ids = body.members.map(x => String(x?.value || '').trim()).filter(Boolean).slice(0, 5000);
            await bulkReplaceGroupMembers(groupId, ids);
          }

          if (displayName) {
            await sql`UPDATE scim_groups SET display_name = ${displayName}, updated_at = now() WHERE id = ${groupId} AND org_id = ${orgId}`;
          } else {
            await sql`UPDATE scim_groups SET updated_at = now() WHERE id = ${groupId} AND org_id = ${orgId}`;
          }

          const g2 = await sql`SELECT id, display_name, updated_at FROM scim_groups WHERE org_id = ${orgId} AND id = ${groupId} LIMIT 1`;
          const mem = await sql`
            SELECT u.id, u.email
            FROM scim_group_members gm
            JOIN users u ON u.id = gm.user_id
            WHERE gm.group_id = ${groupId}
            ORDER BY ${orderBy}
            LIMIT ${count2} OFFSET ${startIndex2 - 1}
          `;

          const etag = etagFor(g2[0].id, g2[0].updated_at);
          await audit(event, orgId, null, 'scim.group.update', 'group', groupId, { displayName: g2[0].display_name });

          return json(200, {
            schemas:["urn:ietf:params:scim:schemas:core:2.0:Group"],
            id: g2[0].id,
            displayName: g2[0].display_name,
            members: (mem || []).map(r => ({ value: r.id, display: r.email })),
            meta: { resourceType:"Group", version: etag, membersStartIndex: startIndex2, membersItemsPerPage: count2 }
          }, origin, { 'x-request-id': rid, 'ETag': etag });
        }

        if (method === 'DELETE') {
          const cur = await sql`SELECT u.id, u.updated_at FROM users u JOIN memberships m ON m.user_id = u.id WHERE m.org_id = ${orgId} AND u.id = ${userId} LIMIT 1`;
          if (cur && cur.length) {
            const currentEtag = etagFor(cur[0].id, cur[0].updated_at);
            if (!preconditionOk(event, currentEtag)) {
              return json(412, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"412", detail:"ETag mismatch" }, origin, { 'x-request-id': rid, 'ETag': currentEtag });
            }
          }
          const g = await sql`SELECT id, updated_at FROM scim_groups WHERE org_id = ${orgId} AND id = ${groupId} LIMIT 1`;
          if (!g || g.length === 0) return { statusCode: 204, headers: { ...corsHeaders(origin), 'x-request-id': rid }, body: '' };

          const currentEtag = etagFor(g[0].id, g[0].updated_at);
          if (!preconditionOk(event, currentEtag)) {
            return json(412, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"412", detail:"ETag mismatch" }, origin, { 'x-request-id': rid, 'ETag': currentEtag });
          }

          await sql`DELETE FROM scim_groups WHERE org_id = ${orgId} AND id = ${groupId}`;
          await audit(event, orgId, null, 'scim.group.delete', 'group', groupId, {});
          return { statusCode: 204, headers: { ...corsHeaders(origin), 'x-request-id': rid }, body: '' };
        }
      }

return json(404, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"404", detail:"Not found" }, origin, { 'x-request-id': rid });
          const etag = etagFor(rows[0].id, rows[0].updated_at);
          const emails = await loadUserEmails(rows[0].id, 50, 0);
          return json(200, { ...scimUser({ id: rows[0].id, email: rows[0].email }, orgId, rows[0].active, emails), meta: { resourceType: 'User', version: etag } }, origin, { 'x-request-id': rid, 'ETag': etag });
        }

        if (method === 'PATCH' || method === 'PUT') {
          const cur = await sql`SELECT u.id, u.updated_at FROM users u JOIN memberships m ON m.user_id = u.id WHERE m.org_id = ${orgId} AND u.id = ${userId} LIMIT 1`;
          if (!cur || cur.length === 0) return json(404, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"404", detail:"Not found" }, origin, { 'x-request-id': rid });
          const currentEtag = etagFor(cur[0].id, cur[0].updated_at);
          if (!preconditionOk(event, currentEtag)) {
            return json(412, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"412", detail:"ETag mismatch" }, origin, { 'x-request-id': rid, 'ETag': currentEtag });
          }
          const body = parseBody(event) || {};
          const patch = parseScimUserPatch(body);

          const active = (patch.active == null) ? true : !!patch.active;

          const emailUpdate = validateEmail(patch.userName);


          
          // Email changes:
          // 1) userName update (canonical) -> update users.email and ensurePrimaryEmailRow
          if (emailUpdate) {
            try {
              await sql`UPDATE users SET email = ${emailUpdate}, updated_at = now() WHERE id = ${userId}`;
            } catch (e) {
              return json(409, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"409", detail:"email already exists" }, origin, { 'x-request-id': rid });
            }
            await ensurePrimaryEmailRow(userId, emailUpdate);
          }

          // 2) PUT-like full emails replace
          if (patch.emailsReplace) {
            await setUserEmails(userId, patch.emailsReplace);
          }

          // 3) PATCH emails operations
          if (Array.isArray(patch.emailsOps) && patch.emailsOps.length) {
            for (const opx of patch.emailsOps) {
              const op = String(opx.op || 'replace').toLowerCase();
              const path = String(opx.path || '').trim();

              // remove: emails[value eq "x"]
              const mVal = path.match(/emails\[value\s+eq\s+"([^"]+)"\]/i);
              const mType = path.match(/emails\[type\s+eq\s+"([^"]+)"\]/i);

              const val = opx.value;

              if (op === 'remove') {
                if (mVal) {
                  await removeUserEmail(userId, mVal[1]);
                  continue;
                }
                // remove by value in payload
                if (val && typeof val === 'object' && val.value) {
                  await removeUserEmail(userId, val.value);
                  continue;
                }
                if (Array.isArray(val)) {
                  for (const v of val) if (v?.value) await removeUserEmail(userId, v.value);
                  continue;
                }
              }

              if (op === 'add') {
                const arr = Array.isArray(val) ? val : (val ? [val] : []);
                for (const e of arr) {
                  await upsertUserEmail(userId, e?.value, e?.type || 'work', !!e?.primary);
                }
                continue;
              }

              // replace:
              // - emails: [ ... ] or {value,type,primary}
              // - emails[type eq "work"].value pattern isn't used here; handle full replace by setUserEmails if array
              if (op === 'replace') {
                if (Array.isArray(val)) {
                  await setUserEmails(userId, val);
                  continue;
                }
                if (val && typeof val === 'object' && (val.value || val.type || val.primary != null)) {
                  // targeted replace: update matching by mVal or by type filter
                  if (mVal) {
                    await removeUserEmail(userId, mVal[1]);
                    await upsertUserEmail(userId, val.value, val.type || 'work', !!val.primary);
                    continue;
                  }
                  if (mType) {
                    // update all emails of a type (rare); add new value as that type
                    await upsertUserEmail(userId, val.value, mType[1], !!val.primary);
                    continue;
                  }
                  await upsertUserEmail(userId, val.value, val.type || 'work', !!val.primary);
                  continue;
                }
              }
            }
          }

await sql`
            INSERT INTO memberships (org_id, user_id, role, active, created_at)
            VALUES (${orgId}, ${userId}, 'member', ${active}, now())
            ON CONFLICT (org_id, user_id) DO UPDATE SET active = EXCLUDED.active, updated_at = now()
          `;

          if (!active) {
            await sql`UPDATE users SET token_version = token_version + 1 WHERE id = ${userId}`;
            await audit(event, orgId, userId, 'scim.user.deprovision', 'user', userId, {});
          } else {
            await audit(event, orgId, userId, 'scim.user.update', 'user', userId, { email: patch.email || null, active });
          }

          const rows = await sql`SELECT id, email FROM users WHERE id = ${userId} LIMIT 1`;
          if (!rows || rows.length === 0) return json(404, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"404", detail:"Not found" }, origin, { 'x-request-id': rid });
          const emails = await loadUserEmails(rows[0].id, 50, 0);
          return json(200, scimUser({ id: rows[0].id, email: rows[0].email }, orgId, active, emails), origin, { 'x-request-id': rid });
        }

        if (method === 'DELETE') {
          const cur = await sql`SELECT u.id, u.updated_at FROM users u JOIN memberships m ON m.user_id = u.id WHERE m.org_id = ${orgId} AND u.id = ${userId} LIMIT 1`;
          if (cur && cur.length) {
            const currentEtag = etagFor(cur[0].id, cur[0].updated_at);
            if (!preconditionOk(event, currentEtag)) {
              return json(412, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"412", detail:"ETag mismatch" }, origin, { 'x-request-id': rid, 'ETag': currentEtag });
            }
          }
          await sql`UPDATE memberships SET active = false WHERE org_id = ${orgId} AND user_id = ${userId}`;
          await sql`UPDATE users SET token_version = token_version + 1 WHERE id = ${userId}`;
          await audit(event, orgId, userId, 'scim.user.delete', 'user', userId, {});
          return { statusCode: 204, headers: { ...corsHeaders(origin), 'x-request-id': rid }, body: '' };
        }
      }

      return json(404, { schemas:["urn:ietf:params:scim:api:messages:2.0:Error"], status:"404", detail:"Not found" }, origin, { 'x-request-id': rid });
    }


// ---- Protected routes from here
    const sess = requireAuth(event);
    if (!sess) return json(401, { ok: false, error: 'unauthorized', requestId: rid }, origin, { 'x-request-id': rid });

    const ctx = await loadSessionContext(event, sess);
    if (!ctx) {
      return json(401, { ok: false, error: 'unauthorized', requestId: rid }, origin, { 'set-cookie': sessionClearingCookies(event), 'x-request-id': rid });
    }

    if (!requireCsrf(event)) {
      return json(403, { ok: false, error: 'csrf_failed', requestId: rid }, origin, { 'x-request-id': rid });
    }

    const isWrite = method !== 'GET' && method !== 'HEAD';
    if (REQUIRE_VERIFY && isWrite && !ctx.user.emailVerified) {
      return json(403, { ok: false, error: 'email_not_verified', requestId: rid }, origin, { 'x-request-id': rid });
    }

// ---- Projects list
    if (method === 'GET' && path === '/projects') {
      const rows = await sql`
        SELECT id, name, created_at, updated_at
        FROM projects
        WHERE org_id = ${ctx.orgId}
        ORDER BY updated_at DESC
        LIMIT 200
      `;
      return json(200, { ok: true, data: rows, requestId: rid }, origin, { 'x-request-id': rid });
    }

    // ---- Create project
    if (method === 'POST' && path === '/projects') {
      const body = parseBody(event) || {};
      const name = normalizeProjectName(body.name) || 'Untitled Project';
      const pid = crypto.randomUUID();

      const vf = validateFiles(body.files || []);
      if (!vf.ok) return json(400, { ok: false, error: 'invalid_files', detail: vf.error, requestId: rid }, origin, { 'x-request-id': rid });

      await sql`
        WITH p AS (
          INSERT INTO projects (id, org_id, name, created_at, updated_at)
          VALUES (${pid}, ${ctx.orgId}, ${name}, now(), now())
          RETURNING id
        )
        INSERT INTO project_files (project_id, path, language, content, updated_at)
        SELECT p.id, x.path, x.language, x.content, now()
        FROM p,
        jsonb_to_recordset(${JSON.stringify(vf.files)}::jsonb)
          AS x(path text, language text, content text)
      `;

      await audit(event, ctx.orgId, ctx.userId, 'project.create', 'project', pid, { name, totalBytes: vf.totalBytes, fileCount: vf.files.length });

      return json(200, { ok: true, data: { id: pid }, requestId: rid }, origin, { 'x-request-id': rid });
    }

    // ---- Get project
    const projMatch = path.match(/^\/projects\/([a-f0-9\-]+)$/i);
    if (method === 'GET' && projMatch) {
      const pid = projMatch[1];
      const rows = await sql`
        SELECT id, name, created_at, updated_at
        FROM projects
        WHERE id = ${pid} AND org_id = ${ctx.orgId}
        LIMIT 1
      `;
      if (!rows || rows.length === 0) return json(404, { ok: false, error: 'not_found', requestId: rid }, origin, { 'x-request-id': rid });

      const files = await sql`
        SELECT path, language, content, updated_at
        FROM project_files
        WHERE project_id = ${pid}
        ORDER BY path ASC
      `;
      return json(200, { ok: true, data: { project: rows[0], files }, requestId: rid }, origin, { 'x-request-id': rid });
    }

    // ---- Update project (sync files)
    if (method === 'PUT' && projMatch) {
      const pid = projMatch[1];
      const body = parseBody(event) || {};
      const name = body.name != null ? (normalizeProjectName(body.name) || null) : null;

      const vf = validateFiles(body.files || []);
      if (!vf.ok) return json(400, { ok: false, error: 'invalid_files', detail: vf.error, requestId: rid }, origin, { 'x-request-id': rid });

      const updated = await sql`
        WITH target AS (
          SELECT id
          FROM projects
          WHERE id = ${pid} AND org_id = ${ctx.orgId}
          FOR UPDATE
        ),
        incoming AS (
          SELECT * FROM jsonb_to_recordset(${JSON.stringify(vf.files)}::jsonb)
          AS x(path text, language text, content text)
        ),
        upsert AS (
          INSERT INTO project_files (project_id, path, language, content, updated_at)
          SELECT t.id, i.path, i.language, i.content, now()
          FROM target t, incoming i
          ON CONFLICT (project_id, path) DO UPDATE
            SET language = EXCLUDED.language,
                content  = EXCLUDED.content,
                updated_at = now()
        ),
        del AS (
          DELETE FROM project_files
          WHERE project_id = (SELECT id FROM target)
            AND path NOT IN (SELECT path FROM incoming)
        )
        UPDATE projects
          SET name = COALESCE(${name}, name),
              updated_at = now()
        WHERE id = (SELECT id FROM target)
        RETURNING id, name, updated_at
      `;


      if (!updated || updated.length === 0) return json(404, { ok: false, error: 'not_found', requestId: rid }, origin, { 'x-request-id': rid });

      await audit(event, ctx.orgId, ctx.userId, 'project.update', 'project', pid, { name: updated[0].name, totalBytes: vf.totalBytes, fileCount: vf.files.length });

      return json(200, { ok: true, data: { id: pid, name: updated[0].name, updatedAt: updated[0].updated_at }, requestId: rid }, origin, { 'x-request-id': rid });
    }

    // ---- Delete project
    if (method === 'DELETE' && projMatch) {
      const pid = projMatch[1];

      const del = await sql`
        DELETE FROM projects
        WHERE id = ${pid} AND org_id = ${ctx.orgId}
        RETURNING id
      `;
      if (!del || del.length === 0) return json(404, { ok: false, error: 'not_found', requestId: rid }, origin, { 'x-request-id': rid });

      await audit(event, ctx.orgId, ctx.userId, 'project.delete', 'project', pid, {});
      return json(200, { ok: true, requestId: rid }, origin, { 'x-request-id': rid });
    }

    // ---- Snapshots
    const snapListMatch = path.match(/^\/projects\/([a-f0-9\-]+)\/snapshots$/i);
    if (snapListMatch && method === 'GET') {
      const pid = snapListMatch[1];
      // Ensure project belongs to org
      const exists = await sql`SELECT 1 FROM projects WHERE id=${pid} AND org_id=${ctx.orgId} LIMIT 1`;
      if (!exists || exists.length === 0) return json(404, { ok:false, error:'not_found', requestId: rid }, origin, { 'x-request-id': rid });

      const snaps = await sql`
        SELECT id, created_at, label
        FROM snapshots
        WHERE project_id = ${pid}
        ORDER BY created_at DESC
        LIMIT 50
      `;
      return json(200, { ok:true, data: snaps, requestId: rid }, origin, { 'x-request-id': rid });
    }

    if (snapListMatch && method === 'POST') {
      const pid = snapListMatch[1];
      const body = parseBody(event) || {};
      const label = String(body.label || '').trim().slice(0, 120);
      const projectJson = body.projectJson;

      if (!projectJson || typeof projectJson !== 'object') {
        return json(400, { ok:false, error:'invalid_snapshot', requestId: rid }, origin, { 'x-request-id': rid });
      }

      // Ensure project belongs to org
      const exists = await sql`SELECT 1 FROM projects WHERE id=${pid} AND org_id=${ctx.orgId} LIMIT 1`;
      if (!exists || exists.length === 0) return json(404, { ok:false, error:'not_found', requestId: rid }, origin, { 'x-request-id': rid });

      const sid = crypto.randomUUID();
      await sql`
        INSERT INTO snapshots (id, project_id, created_at, label, project_json)
        VALUES (${sid}, ${pid}, now(), ${label}, ${JSON.stringify(projectJson)}::jsonb)
      `;
      await audit(event, ctx.orgId, ctx.userId, 'snapshot.create', 'snapshot', sid, { projectId: pid, label });
      return json(200, { ok:true, data:{ id: sid }, requestId: rid }, origin, { 'x-request-id': rid });
    }

    const snapGetMatch = path.match(/^\/snapshots\/([a-f0-9\-]+)$/i);
    if (snapGetMatch && method === 'GET') {
      const sid = snapGetMatch[1];
      const rows = await sql`
        SELECT s.id, s.project_id, s.created_at, s.label, s.project_json
        FROM snapshots s
        JOIN projects p ON p.id = s.project_id
        WHERE s.id = ${sid} AND p.org_id = ${ctx.orgId}
        LIMIT 1
      `;
      if (!rows || rows.length === 0) return json(404, { ok:false, error:'not_found', requestId: rid }, origin, { 'x-request-id': rid });
      return json(200, { ok:true, data: rows[0], requestId: rid }, origin, { 'x-request-id': rid });
    }


    if (snapGetMatch && method === 'DELETE') {
      const sid = snapGetMatch[1];
      const del = await sql`
        DELETE FROM snapshots s
        USING projects p
        WHERE s.project_id = p.id
          AND s.id = ${sid}
          AND p.org_id = ${ctx.orgId}
        RETURNING s.id
      `;
      if (!del || del.length === 0) return json(404, { ok:false, error:'not_found', requestId: rid }, origin, { 'x-request-id': rid });
      await audit(event, ctx.orgId, ctx.userId, 'snapshot.delete', 'snapshot', sid, {});
      return json(200, { ok:true, requestId: rid }, origin, { 'x-request-id': rid });
    }


    // ---- Audit log read (admin/owner)
    if (method === 'GET' && path.startsWith('/audit')) {
      const q = event.queryStringParameters || {};
      const lim = clampInt(q.limit || '50', 1, 200, 50);
      if (ctx.role !== 'owner' && ctx.role !== 'admin') {
        return json(403, { ok:false, error:'forbidden', requestId: rid }, origin, { 'x-request-id': rid });
      }
      const rows = await sql`
        SELECT id, action, target_type, target_id, meta, ip, user_agent, created_at, user_id
        FROM audit_logs
        WHERE org_id = ${ctx.orgId}
        ORDER BY created_at DESC
        LIMIT ${lim}
      `;
      return json(200, { ok:true, data: rows, requestId: rid }, origin, { 'x-request-id': rid });
    }

    return json(404, { ok: false, error: 'not_found', path, requestId: rid }, origin, { 'x-request-id': rid });

  } catch (e) {
    const msg = String(e?.message || 'server_error');
    // eslint-disable-next-line no-console
    console.error('API error', { rid, path, method, msg });
    return json(500, { ok: false, error: 'server_error', message: msg.slice(0, 240), requestId: rid }, origin, { 'x-request-id': rid });
  }
}


// Test-only exports (no secrets beyond public helpers)
export const __internal = {
  isAllowedOrigin,
  corsHeaders,
  requireCsrf,
  validateEmail,
  validatePassword,
  tokenHash,
  routeFrom,
  rateLimitOkMem,
  verifyIdTokenWithJwksObject,
  parseJwt,
  validateIdTokenClaims,
  verifyJwtSignature,
  parseScimPatch,
  parseScimGroupFilter,
  scimTokenize,
  scimParseFilter,
  scimCompileFilter,
  scimOrderBy,
  deliverSiemBatch,
  rlsSetOrg,
  samlVerifySignature,
  samlCanonicalize,
  samlExtractSignedInfoAndSig,
  samlFindReference,
  samlGetElementById,
  samlRemoveEnvelopedSignature,
  samlDigest,

  
  
  
  
  etagFor,
  preconditionOk,
  
  
};
