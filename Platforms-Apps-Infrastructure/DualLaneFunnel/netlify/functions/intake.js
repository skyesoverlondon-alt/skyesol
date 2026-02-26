const { Pool } = require('pg');
const { getStore } = require('@netlify/blobs');

let pool;

function getIp(headers){
  const h = headers || {};
  return (
    h['x-nf-client-connection-ip'] ||
    (h['x-forwarded-for'] ? String(h['x-forwarded-for']).split(',')[0].trim() : '') ||
    ''
  );
}

function safeTrim(v, max = 5000){
  if (v == null) return '';
  const s = String(v).trim();
  return s.length > max ? s.slice(0, max) : s;
}

function validateEmail(email){
  const e = String(email || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

async function db(){
  const url = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool){
    pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

async function ensureSchema(p){
  await p.query(`
    CREATE TABLE IF NOT EXISTS intake_submissions (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      lane TEXT NOT NULL,
      name TEXT,
      email TEXT,
      phone TEXT,
      company TEXT,
      role TEXT,
      ip TEXT,
      user_agent TEXT,
      payload JSONB NOT NULL
    );
  `);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST'){
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k,v]) => [k.toLowerCase(), v]));
    const ip = getIp(headers);
    const ua = safeTrim(headers['user-agent'] || '', 500);

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      body = {};
    }

    const lane = safeTrim(body.lane || 'unknown', 40);
    const fields = body.fields && typeof body.fields === 'object' ? body.fields : {};

    // normalize common fields
    const name = safeTrim(fields.name || fields.contact || '', 200);
    const email = safeTrim(fields.email || '', 200);
    const phone = safeTrim(fields.phone || '', 60);
    const company = safeTrim(fields.company || '', 240);
    const role = safeTrim(fields.target_role || fields.roles_needed || '', 240);

    if (!validateEmail(email)){
      return {
        statusCode: 400,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'Invalid email.' })
      };
    }

    const payload = {
      lane,
      fields,
      meta: {
        ip,
        userAgent: ua,
        receivedAt: new Date().toISOString()
      }
    };

    // 1) Blobs (redundant retention)
    let blobKey = null;
    try {
      const store = getStore('sol-intake');
      blobKey = `${lane}/${Date.now()}-${Math.random().toString(16).slice(2)}`;
      await store.set(blobKey, JSON.stringify(payload));
    } catch (e) {
      // If blobs aren’t available, we still proceed.
      blobKey = null;
    }

    // 2) Neon Postgres (optional)
    let dbId = null;
    const p = await db();
    if (p){
      await ensureSchema(p);
      const r = await p.query(
        `INSERT INTO intake_submissions (lane, name, email, phone, company, role, ip, user_agent, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [lane, name || null, email || null, phone || null, company || null, role || null, ip || null, ua || null, payload]
      );
      dbId = r.rows && r.rows[0] ? r.rows[0].id : null;
    }

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, lane, db: { inserted: Boolean(dbId), id: dbId }, blobs: { stored: Boolean(blobKey), key: blobKey } })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
