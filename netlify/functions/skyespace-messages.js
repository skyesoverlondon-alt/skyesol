import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest } from "./_lib/http.js";
import { q } from "./_lib/db.js";
import { ensureSkyespaceProfile, mapConversation, mapMessage, requireSkyespaceAuth } from "./_lib/skyespace.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const auth = await requireSkyespaceAuth(req);

  if (req.method === "GET") {
    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversationId");

    if (conversationId) {
      const result = await q(
        `select m.id, m.body, m.author_name, m.created_at, c.topic, c.participant_key
           from skyespace_messages m
           join skyespace_conversations c on c.id = m.conversation_id
          where m.conversation_id = $1
          order by m.created_at asc`,
        [conversationId]
      );

      return json(200, { ok: true, messages: result.rows.map(mapMessage) }, cors);
    }

    const result = await q(
      `select c.id, c.topic, c.participant_key,
              coalesce(m.body, '') as preview,
              m.created_at as last_message_at
         from skyespace_conversations c
         left join lateral (
           select body, created_at
             from skyespace_messages
            where conversation_id = c.id
            order by created_at desc
            limit 1
         ) m on true
        order by m.created_at desc nulls last, c.created_at desc`
    );

    return json(200, { ok: true, conversations: result.rows.map(mapConversation) }, cors);
  }

  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  const body = await req.json().catch(() => ({}));
  if (!body.body) return badRequest("message body is required", cors);

  const profile = await ensureSkyespaceProfile(auth);
  let conversationId = body.conversationId;
  let topic = body.topic || "General thread";
  let participant = body.participant || body.recipient || "SkyeSpace Network";

  if (!conversationId) {
    const conversation = await q(
      `insert into skyespace_conversations(topic, participant_key)
       values ($1,$2)
       on conflict (topic, participant_key)
       do update set topic = excluded.topic
       returning id, topic, participant_key`,
      [topic, participant]
    );
    conversationId = conversation.rows[0].id;
    topic = conversation.rows[0].topic;
    participant = conversation.rows[0].participant_key;
  }

  const inserted = await q(
    `insert into skyespace_messages(conversation_id, author_profile_id, author_name, body)
     values ($1,$2,$3,$4)
     returning id, body, author_name, created_at`,
    [conversationId, profile.id, profile.display_name, body.body]
  );

  return json(200, { ok: true, message: mapMessage({ ...inserted.rows[0], topic, participant_key: participant }) }, cors);
});