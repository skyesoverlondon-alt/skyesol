const { ok, badRequest, serverError } = require('./_shared/http');
const { query } = require('./_shared/db');
const { ensureProfile } = require('./_shared/auth');

exports.handler = async function(event, context){
  try{
    if(event.httpMethod === 'GET'){
      const params = new URLSearchParams(event.queryStringParameters || {});
      const conversationId = params.get('conversationId');
      if(conversationId){
        const result = await query(
          `select m.id, m.body, m.author_name, m.created_at, c.topic, c.participant_key
           from skyespace_messages m
           join skyespace_conversations c on c.id = m.conversation_id
           where m.conversation_id = $1
           order by m.created_at asc`,
          [conversationId]
        );
        return ok({ ok:true, messages: result.rows.map(row => ({
          id: row.id,
          body: row.body,
          author: row.author_name,
          ts: row.created_at,
          topic: row.topic,
          participant: row.participant_key
        })) });
      }

      const result = await query(
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
      return ok({ ok:true, conversations: result.rows.map(row => ({
        id: row.id,
        from: row.participant_key,
        topic: row.topic,
        preview: row.preview,
        updatedAt: row.last_message_at
      })) });
    }

    if(event.httpMethod === 'POST'){
      const body = JSON.parse(event.body || '{}');
      if(!body.body) return badRequest('message body is required');
      const profile = await ensureProfile(context, event);

      let conversationId = body.conversationId;
      if(!conversationId){
        const topic = body.topic || 'General thread';
        const participantKey = body.participant || body.recipient || 'SkyeSpace Network';
        const convo = await query(
          `insert into skyespace_conversations(topic, participant_key)
           values ($1,$2)
           on conflict (topic, participant_key)
           do update set topic = excluded.topic
           returning id, topic, participant_key`,
          [topic, participantKey]
        );
        conversationId = convo.rows[0].id;
      }

      const inserted = await query(
        `insert into skyespace_messages(conversation_id, author_profile_id, author_name, body)
         values ($1,$2,$3,$4)
         returning id, conversation_id, author_name, body, created_at`,
        [conversationId, profile.id, profile.display_name, body.body]
      );
      return ok({ ok:true, message: inserted.rows[0] });
    }

    return badRequest('method not allowed');
  }catch(error){
    return serverError(error);
  }
};
