const { verifyAuth, json } = require('./_utils');
const { fetchMessageByRef, loadMailbox } = require('./_mailbox');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') return json(405, { error:'Method not allowed.' });
    const auth = verifyAuth(event);
    const id = String((event.queryStringParameters || {}).id || '').trim();
    if (!id) return json(400, { error:'id required.' });
    const mailbox = await loadMailbox(auth.sub);
    const message = await fetchMessageByRef(auth.sub, id);
    return json(200, { ok:true, mailbox: mailbox?.email || '', message });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
