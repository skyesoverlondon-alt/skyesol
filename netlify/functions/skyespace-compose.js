import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest } from "./_lib/http.js";
import { q } from "./_lib/db.js";
import { ensureSkyespaceProfile, mapConversation, mapFeedPost, mapListing, mapMessage, mapSignal, requireSkyespaceAuth } from "./_lib/skyespace.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  const auth = await requireSkyespaceAuth(req);
  const profile = await ensureSkyespaceProfile(auth);
  const body = await req.json().catch(() => ({}));
  const lane = body.lane || "feed";

  if (!body.title && lane !== "messages") return badRequest("title is required", cors);

  if (lane === "market") {
    const inserted = await q(
      `insert into skyespace_listings(title, category, price_text, seller_name, eta_text, district, details, author_profile_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning id, title, category, price_text, seller_name, eta_text, district, details, created_at`,
      [body.title, body.category || "", body.price || "", profile.display_name, body.eta || "", body.district || "", body.body || "", profile.id]
    );
    return json(200, { ok: true, lane, listing: mapListing(inserted.rows[0]) }, cors);
  }

  if (lane === "signal") {
    const inserted = await q(
      `insert into skyespace_signals(severity, title, detail, source_name)
       values ($1,$2,$3,$4)
       returning id, severity, title, detail, source_name, created_at`,
      [body.severity || "medium", body.title, body.body || "", profile.display_name]
    );
    return json(200, { ok: true, lane, signal: mapSignal(inserted.rows[0]) }, cors);
  }

  if (lane === "messages") {
    let conversationId = body.conversationId;
    if (!conversationId) {
      const conversation = await q(
        `insert into skyespace_conversations(topic, participant_key)
         values ($1,$2)
         on conflict (topic, participant_key)
         do update set topic = excluded.topic
         returning id, topic, participant_key`,
        [body.topic || body.title || "Quick message", body.participant || body.district || "SkyeSpace Network"]
      );
      conversationId = conversation.rows[0].id;
    }
    const inserted = await q(
      `insert into skyespace_messages(conversation_id, author_profile_id, author_name, body)
       values ($1,$2,$3,$4)
       returning id, body, author_name, created_at`,
      [conversationId, profile.id, profile.display_name, body.body || body.title || "New message"]
    );
    return json(200, { ok: true, lane, message: mapMessage({ ...inserted.rows[0], topic: body.topic || "Quick message", participant_key: body.participant || "SkyeSpace Network" }) }, cors);
  }

  const inserted = await q(
    `insert into skyespace_posts(lane, category, title, body, district, author_profile_id, author_name, author_role)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning id, lane, category, title, body, district, author_name, author_role, created_at`,
    [lane, body.category || "", body.title, body.body || "", body.district || "", profile.id, profile.display_name, profile.title || body.category || "Member"]
  );

  return json(200, { ok: true, lane, post: mapFeedPost(inserted.rows[0]) }, cors);
});