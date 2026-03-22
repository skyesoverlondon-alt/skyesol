import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest } from "./_lib/http.js";
import { q } from "./_lib/db.js";
import { ensureSkyespaceProfile, ensureSkyespaceSchema, mapListing, requireSkyespaceAuth } from "./_lib/skyespace.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  if (req.method === "GET") {
    await ensureSkyespaceSchema();
    await requireSkyespaceAuth(req);

    const result = await q(
      `select id, title, category, price_text, seller_name, eta_text, district, details, created_at
         from skyespace_listings
        order by created_at desc
        limit 48`
    );

    return json(200, { ok: true, listings: result.rows.map(mapListing) }, cors);
  }

  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  const auth = await requireSkyespaceAuth(req);
  const profile = await ensureSkyespaceProfile(auth);
  const body = await req.json().catch(() => ({}));
  if (!body.title) return badRequest("title is required", cors);

  const inserted = await q(
    `insert into skyespace_listings(title, category, price_text, seller_name, eta_text, district, details, author_profile_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning id, title, category, price_text, seller_name, eta_text, district, details, created_at`,
    [body.title, body.category || "", body.price || "", profile.display_name, body.eta || "", body.district || "", body.body || "", profile.id]
  );

  return json(200, { ok: true, listing: mapListing(inserted.rows[0]) }, cors);
});