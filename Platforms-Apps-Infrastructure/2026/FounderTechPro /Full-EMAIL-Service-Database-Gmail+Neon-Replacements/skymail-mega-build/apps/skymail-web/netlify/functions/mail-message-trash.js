const { verifyAuth, parseJson, json } = require('./_utils');
const { moveToTrash } = require('./_mailbox');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'POST').toUpperCase() !== 'POST') return json(405, { error:'Method not allowed.' });
    const auth = verifyAuth(event);
    const body = parseJson(event);
    const ids = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);
    if (!ids.length) return json(400, { error:'ids required.' });
    await moveToTrash(auth.sub, ids, body.action === 'untrash' ? 'untrash' : 'trash');
    return json(200, { ok:true, updated: ids.length });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
