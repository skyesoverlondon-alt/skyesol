const { ok, badRequest, serverError } = require('./_shared/http');
const { query } = require('./_shared/db');
const { ensureProfile } = require('./_shared/auth');

exports.handler = async function(event, context){
  try{
    if(event.httpMethod !== 'POST') return badRequest('method not allowed');
    const body = JSON.parse(event.body || '{}');
    const lane = body.lane || 'feed';
    const profile = await ensureProfile(context, event);

    if(!body.title && lane !== 'messages') return badRequest('title is required');

    if(lane === 'market'){
      const inserted = await query(
        `insert into skyespace_listings(title, category, price_text, seller_name, eta_text, district, details, author_profile_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning id`,
        [body.title, body.category || '', body.price || '', profile.display_name, body.eta || '', body.district || '', body.body || '', profile.id]
      );
      return ok({ ok:true, lane, id: inserted.rows[0].id });
    }

    if(lane === 'signal'){
      const inserted = await query(
        `insert into skyespace_signals(severity, title, detail, source_name)
         values ($1,$2,$3,$4)
         returning id`,
        [body.severity || 'medium', body.title, body.body || '', profile.display_name]
      );
      return ok({ ok:true, lane, id: inserted.rows[0].id });
    }

    if(lane === 'messages'){
      let conversationId = body.conversationId;
      if(!conversationId){
        const convo = await query(
          `insert into skyespace_conversations(topic, participant_key)
           values ($1,$2)
           on conflict (topic, participant_key)
           do update set topic = excluded.topic
           returning id`,
          [body.title || 'Quick message', body.participant || body.district || 'SkyeSpace Network']
        );
        conversationId = convo.rows[0].id;
      }
      const inserted = await query(
        `insert into skyespace_messages(conversation_id, author_profile_id, author_name, body)
         values ($1,$2,$3,$4)
         returning id`,
        [conversationId, profile.id, profile.display_name, body.body || body.title || 'New message']
      );
      return ok({ ok:true, lane, id: inserted.rows[0].id });
    }

    const inserted = await query(
      `insert into skyespace_posts(lane, category, title, body, district, author_profile_id, author_name, author_role)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning id`,
      [lane, body.category || '', body.title, body.body || '', body.district || '', profile.id, profile.display_name, profile.title || body.category || 'Member']
    );
    return ok({ ok:true, lane, id: inserted.rows[0].id });
  }catch(error){
    return serverError(error);
  }
};
