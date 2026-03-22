#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const API_BASE = String(process.env.SKYEDB_API_BASE || '').replace(/\/$/, '');
const TOKEN = String(process.env.SKYEDB_BOOTSTRAP_TOKEN || '');
const ORG_NAME = String(process.env.SKYEDB_ORG_NAME || 'SkyMail Platform');
const PROJECT_NAME = String(process.env.SKYEDB_PROJECT_NAME || 'SkyMail Host');
const ENV_NAME = String(process.env.SKYEDB_ENV_NAME || 'production');
const DB_NAME = String(process.env.SKYEDB_DB_NAME || 'skymail-app');
const PLAN = String(process.env.SKYEDB_PLAN_CODE || 'starter');

if (!API_BASE || !TOKEN) {
  console.error('Missing SKYEDB_API_BASE or SKYEDB_BOOTSTRAP_TOKEN.');
  process.exit(1);
}

async function api(method, pathname, body) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_err) { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || text || `${method} ${pathname} failed (${res.status})`);
  }
  return data;
}

function sleep(ms){ return new Promise((resolve)=> setTimeout(resolve, ms)); }

async function findOrCreateOrg() {
  const orgs = await api('GET', '/v1/orgs');
  const existing = (orgs || []).find((row)=> String(row.name || '').toLowerCase() === ORG_NAME.toLowerCase());
  if (existing) return existing;
  return await api('POST', '/v1/orgs', { name: ORG_NAME, mode: 'customer' });
}

async function findOrCreateProject(orgId) {
  const projects = await api('GET', '/v1/projects');
  const existing = (projects || []).find((row)=> row.org_id === orgId && String(row.name || '').toLowerCase() === PROJECT_NAME.toLowerCase());
  if (existing) return existing;
  return await api('POST', '/v1/projects', { org_id: orgId, name: PROJECT_NAME, plan_code: PLAN });
}

async function findOrCreateEnvironment(projectId) {
  const envs = await api('GET', '/v1/environments');
  const existing = (envs || []).find((row)=> row.project_id === projectId && String(row.name || '').toLowerCase() === ENV_NAME.toLowerCase());
  if (existing) return existing;
  return await api('POST', '/v1/environments', { project_id: projectId, name: ENV_NAME, kind: 'production' });
}

async function findOrCreateDatabase(projectId, environmentId) {
  const dbs = await api('GET', '/v1/databases');
  const existing = (dbs || []).find((row)=> row.project_id === projectId && String(row.name || '').toLowerCase() === DB_NAME.toLowerCase());
  if (existing) return existing;
  return await api('POST', '/v1/databases', {
    project_id: projectId,
    environment_id: environmentId,
    name: DB_NAME,
    plan_code: PLAN
  });
}

async function waitForDatabase(id) {
  for (let i = 0; i < 90; i += 1) {
    const row = await api('GET', `/v1/databases/${id}`);
    process.stdout.write(`Waiting for database ${row.name}... ${row.status}\n`);
    if (String(row.status || '').toLowerCase() === 'ready') return row;
    await sleep(4000);
  }
  throw new Error('Timed out waiting for database to become ready.');
}

(async function main(){
  const org = await findOrCreateOrg();
  const project = await findOrCreateProject(org.id);
  const env = await findOrCreateEnvironment(project.id);
  let db = await findOrCreateDatabase(project.id, env.id);
  db = await waitForDatabase(db.id);

  const connectionUri = db.connection_uri;
  if (!connectionUri) throw new Error('Database is ready but no connection_uri was returned.');

  const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const client = new Client({ connectionString: connectionUri, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(schemaSql);
  } finally {
    await client.end();
  }

  console.log('\nSkyMail database is ready. Use this in Netlify:');
  console.log(`SKYMAIL_DATABASE_URL=${connectionUri}`);
})();
