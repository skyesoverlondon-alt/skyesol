import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest } from "./_lib/http.js";
import { q } from "./_lib/db.js";
import { ensureSkyespaceProfile, mapProfile, requireSkyespaceAuth } from "./_lib/skyespace.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const auth = await requireSkyespaceAuth(req);
  const profile = await ensureSkyespaceProfile(auth);

  if (req.method === "GET") {
    return json(200, { ok: true, profile: mapProfile(profile) }, cors);
  }

  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  const body = await req.json().catch(() => ({}));
  if (!body.name) return badRequest("name is required", cors);

  const updated = await q(
    `update skyespace_profiles
        set display_name = $2,
            handle = $3,
            title = $4,
            bio = $5,
            updated_at = now()
      where id = $1
      returning *`,
    [profile.id, body.name, body.handle || profile.handle || null, body.title || "", body.bio || ""]
  );

  return json(200, { ok: true, profile: mapProfile(updated.rows[0]) }, cors);
});