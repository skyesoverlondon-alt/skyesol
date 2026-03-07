import { wrap } from "./_lib/wrap.js";
import { json, buildCors } from "./_lib/http.js";
import { q } from "./_lib/db.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const PUBLIC_PROVIDER_NAME = process.env.KAIXU_PUBLIC_PROVIDER_NAME || "Skyes Over London";
  const PUBLIC_MODEL_NAME = process.env.KAIXU_PUBLIC_MODEL_NAME || "skAIxU Flow6.7";

  const out = {
    ok: true,
    ts: new Date().toISOString(),
    service: "kAIxu Gateway",
    branding: {
      provider: PUBLIC_PROVIDER_NAME,
      model: PUBLIC_MODEL_NAME
    },
    runtime_ready: !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY),
    db: { ok: false }
  };

  try {
    const r = await q("select now() as now");
    out.db = { ok: true, now: r.rows?.[0]?.now || null };
  } catch {
    out.db = { ok: false };
  }

  return json(200, out, cors);
});