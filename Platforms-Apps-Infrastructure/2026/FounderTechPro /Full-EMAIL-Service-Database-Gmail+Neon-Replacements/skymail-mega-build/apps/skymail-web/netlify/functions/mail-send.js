const { verifyAuth, parseJson, json } = require('./_utils');
const { sendMessage } = require('./_mailbox');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'POST').toUpperCase() !== 'POST') return json(405, { error:'Method not allowed.' });
    const auth = verifyAuth(event);
    const body = parseJson(event);
    if (!String(body.to || '').trim()) return json(400, { error:'Recipient required.' });
    const data = await sendMessage(auth.sub, body);
    return json(200, { ok:true, mailbox: data.mailbox, from_alias: data.from_alias });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
