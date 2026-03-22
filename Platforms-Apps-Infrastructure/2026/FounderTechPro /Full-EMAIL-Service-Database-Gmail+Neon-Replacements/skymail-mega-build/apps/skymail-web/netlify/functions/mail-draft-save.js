const { verifyAuth, parseJson, json } = require('./_utils');
const { saveDraft } = require('./_mailbox');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'POST').toUpperCase() !== 'POST') return json(405, { error:'Method not allowed.' });
    const auth = verifyAuth(event);
    const body = parseJson(event);
    const data = await saveDraft(auth.sub, body);
    return json(200, { ok:true, mailbox:data.mailbox, draft:data.draft });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
