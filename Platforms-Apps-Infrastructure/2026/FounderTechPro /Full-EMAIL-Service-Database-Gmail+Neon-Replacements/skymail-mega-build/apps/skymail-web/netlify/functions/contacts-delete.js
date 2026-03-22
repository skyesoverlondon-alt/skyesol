const { verifyAuth, parseJson, json } = require('./_utils');
const { query } = require('./_db');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'POST').toUpperCase() !== 'POST') return json(405, { error:'Method not allowed.' });
    const auth = verifyAuth(event);
    const body = parseJson(event);
    const id = String(body.id || '').trim();
    if (!id) return json(400, { error:'id required.' });
    await query(`delete from mail_contacts where user_id=$1 and id=$2`, [auth.sub, id]);
    return json(200, { ok:true });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
