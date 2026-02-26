
import { neon } from "@neondatabase/serverless";

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

function dbUrl() {
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.KAIXU_DATABASE_URL || "";
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

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response("", { status: 204 });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const u = dbUrl();
  if (!u) return json({ error: "Vault disabled. Set DATABASE_URL." }, 501);

  const payload = await req.json().catch(() => null);
  if (!payload) return json({ error: "Invalid JSON" }, 400);

  const run_id = String(payload.run_id || "");
  if (!run_id) return json({ error: "run_id required" }, 400);

  const sql = neon(u);
  await ensureSchema(sql);
  await sql(`DELETE FROM kaixu_runs WHERE run_id = $1;`, [run_id]);
  return json({ ok: true });
}
