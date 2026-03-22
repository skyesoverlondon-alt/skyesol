const { ok, serverError } = require('./_shared/http');
const { query } = require('./_shared/db');

exports.handler = async function(){
  try{
    const [profiles, districts, posts, listings, signals, conversations, messages] = await Promise.all([
      query('select count(*)::int as count from skyespace_profiles'),
      query('select count(*)::int as count from skyespace_districts'),
      query('select count(*)::int as count from skyespace_posts'),
      query('select count(*)::int as count from skyespace_listings'),
      query('select count(*)::int as count from skyespace_signals'),
      query('select count(*)::int as count from skyespace_conversations'),
      query('select count(*)::int as count from skyespace_messages')
    ]);
    return ok({
      ok:true,
      metrics: {
        profiles: profiles.rows[0].count,
        districts: districts.rows[0].count,
        posts: posts.rows[0].count,
        listings: listings.rows[0].count,
        signals: signals.rows[0].count,
        conversations: conversations.rows[0].count,
        messages: messages.rows[0].count
      }
    });
  }catch(error){
    return serverError(error);
  }
};
