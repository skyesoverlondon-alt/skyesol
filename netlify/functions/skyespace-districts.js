import { wrap } from "./_lib/wrap.js";
import { buildCors, json } from "./_lib/http.js";
import { q } from "./_lib/db.js";
import { ensureSkyespaceSchema, requireSkyespaceAuth } from "./_lib/skyespace.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  await ensureSkyespaceSchema();
  await requireSkyespaceAuth(req);

  const result = await q(
    `select id, slug, name, vibe, hotspot, active_count, created_at
       from skyespace_districts
      order by active_count desc, name asc`
  );

  return json(200, {
    ok: true,
    districts: result.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      vibe: row.vibe,
      hotspot: row.hotspot,
      activeCount: row.active_count,
      createdAt: row.created_at
    }))
  }, cors);
});