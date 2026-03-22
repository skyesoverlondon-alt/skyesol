import { wrap } from "./_lib/wrap.js";
import { buildCors, json } from "./_lib/http.js";
import { q } from "./_lib/db.js";
import { ensureSkyespaceSchema, mapFeedPost, requireSkyespaceAuth } from "./_lib/skyespace.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  await ensureSkyespaceSchema();
  await requireSkyespaceAuth(req);

  const result = await q(
    `select id, lane, category, title, body, district, author_name, author_role, created_at
       from skyespace_posts
      order by created_at desc
      limit 24`
  );

  return json(200, { ok: true, feed: result.rows.map(mapFeedPost) }, cors);
});