const { ok, badRequest, serverError } = require('./_shared/http');
const { query } = require('./_shared/db');
const { ensureProfile } = require('./_shared/auth');

exports.handler = async function(event, context){
  try{
    if(event.httpMethod === 'GET'){
      const profile = await ensureProfile(context, event);
      return ok({ ok:true, profile: {
        id: profile.id,
        name: profile.display_name,
        handle: profile.handle,
        title: profile.title,
        bio: profile.bio,
        avatarUrl: profile.avatar_url || ''
      }});
    }

    if(event.httpMethod === 'POST'){
      const body = JSON.parse(event.body || '{}');
      if(!body.name) return badRequest('name is required');
      const profile = await ensureProfile(context, event);
      const updated = await query(
        `update skyespace_profiles
         set display_name = $2,
             handle = $3,
             title = $4,
             bio = $5,
             updated_at = now()
         where id = $1
         returning *`,
        [profile.id, body.name, body.handle || profile.handle || null, body.title || '', body.bio || '']
      );
      const row = updated.rows[0];
      return ok({ ok:true, profile: {
        id: row.id,
        name: row.display_name,
        handle: row.handle,
        title: row.title,
        bio: row.bio,
        avatarUrl: row.avatar_url || ''
      }});
    }

    return badRequest('method not allowed');
  }catch(error){
    return serverError(error);
  }
};
