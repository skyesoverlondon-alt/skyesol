
import { neon } from "@neondatabase/serverless";

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

function dbUrl() {
  return process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || process.env.KAIXU_DATABASE_URL || "";
}

async function ensureSchema(sql) {
  await sql(`
    CREATE TABLE IF NOT EXISTS kaixu_runs (
      run_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      tool_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      inputs JSONB NOT NULL,
      result JSONB NOT NULL,
      attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
      pdf_blob_key TEXT
    );
  `);
  await sql(`CREATE INDEX IF NOT EXISTS kaixu_runs_ws_idx ON kaixu_runs (workspace_id, created_at DESC);`);
}

function makeId(prefix="RUN") {
  const rand = Math.random().toString(16).slice(2,10).toUpperCase();
  const t = Date.now().toString(16).toUpperCase().slice(-6);
  return `${prefix}-${t}-${rand}`;
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response("", { status: 204 });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const u = dbUrl();
  if (!u) return json({ error: "Vault disabled. Set NEON_DATABASE_URL for the shared Skyesol database." }, 501);

  const payload = await req.json().catch(() => null);
  if (!payload) return json({ error: "Invalid JSON" }, 400);

  const workspace_id = String(payload.workspace_id || "default");
  const tool_id = String(payload.tool_id || "");
  const tool_name = String(payload.tool_name || tool_id);
  const title = String(payload.title || "kAIxU Run");
  const inputs = payload.inputs || {};
  const result = payload.result || {};
  const attachments = payload.attachments || [];
  const pdf_blob_key = payload.pdf_blob_key ? String(payload.pdf_blob_key) : null;
  if (!tool_id) return json({ error: "tool_id required" }, 400);

  const sql = neon(u);
  await ensureSchema(sql);

  const run_id = makeId("RUN");
  await sql(
    `INSERT INTO kaixu_runs (run_id, workspace_id, tool_id, tool_name, title, inputs, result, attachments, pdf_blob_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9);`,
    [run_id, workspace_id, tool_id, tool_name, title, inputs, result, attachments, pdf_blob_key]
  );
  return json({ ok: true, run_id });
}
