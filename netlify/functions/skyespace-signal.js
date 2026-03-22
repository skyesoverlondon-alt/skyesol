import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest } from "./_lib/http.js";
import { q } from "./_lib/db.js";
import { ensureSkyespaceProfile, ensureSkyespaceSchema, mapSignal, requireSkyespaceAuth } from "./_lib/skyespace.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  if (req.method === "GET") {
    await ensureSkyespaceSchema();
    await requireSkyespaceAuth(req);

    const result = await q(
      `select id, severity, title, detail, source_name, created_at
         from skyespace_signals
        order by created_at desc
        limit 48`
    );

    return json(200, { ok: true, signals: result.rows.map(mapSignal) }, cors);
  }

  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  const auth = await requireSkyespaceAuth(req);
  const profile = await ensureSkyespaceProfile(auth);
  const body = await req.json().catch(() => ({}));
  if (!body.title) return badRequest("title is required", cors);

  const inserted = await q(
    `insert into skyespace_signals(severity, title, detail, source_name)
     values ($1,$2,$3,$4)
     returning id, severity, title, detail, source_name, created_at`,
    [body.severity || "medium", body.title, body.body || "", profile.display_name]
  );

  return json(200, { ok: true, signal: mapSignal(inserted.rows[0]) }, cors);
});