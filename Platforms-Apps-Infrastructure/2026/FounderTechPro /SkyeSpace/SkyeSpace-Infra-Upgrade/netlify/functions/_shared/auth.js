const { query } = require('./db');

function normalizeIdentity(context, event){
  const netlifyUser = context?.clientContext?.user;
  if(netlifyUser?.sub){
    return {
      identityKey: `netlify:${netlifyUser.sub}`,
      displayName: netlifyUser.user_metadata?.full_name || netlifyUser.user_metadata?.name || netlifyUser.email || 'Member',
      email: netlifyUser.email || '',
      handle: netlifyUser.email ? '@' + String(netlifyUser.email).split('@')[0].replace(/[^a-zA-Z0-9_]/g,'').toLowerCase() : null
    };
  }
  const demoName = event.headers['x-skye-actor'] || event.headers['X-Skye-Actor'];
  return {
    identityKey: 'public:guest',
    displayName: demoName || 'Guest Operator',
    email: '',
    handle: '@guest'
  };
}

async function ensureProfile(context, event){
  const actor = normalizeIdentity(context, event);
  const existing = await query(
    `select * from skyespace_profiles where identity_key = $1 limit 1`,
    [actor.identityKey]
  );
  if(existing.rows[0]) return existing.rows[0];
  const inserted = await query(
    `insert into skyespace_profiles(identity_key, handle, display_name, title, bio)
     values ($1, $2, $3, '', '')
     returning *`,
    [actor.identityKey, actor.handle, actor.displayName]
  );
  return inserted.rows[0];
}

module.exports = { normalizeIdentity, ensureProfile };
