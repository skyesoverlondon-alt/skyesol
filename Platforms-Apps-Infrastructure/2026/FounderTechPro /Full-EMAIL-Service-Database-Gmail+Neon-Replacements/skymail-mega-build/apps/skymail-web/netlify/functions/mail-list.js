const { verifyAuth, json } = require('./_utils');
const { listMessages } = require('./_mailbox');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') return json(405, { error:'Method not allowed.' });
    const auth = verifyAuth(event);
    const qs = event.queryStringParameters || {};
    const max = Math.max(1, Math.min(25, Number(qs.max || 20)));
    const pageToken = String(qs.pageToken || '').trim();
    const q = String(qs.q || '').trim();
    const label = String(qs.label || 'INBOX').trim();
    const data = await listMessages(auth.sub, label, q, pageToken, max);
    return json(200, { ok:true, mailbox: data.mailbox, nextPageToken:data.nextPageToken, resultSizeEstimate:data.resultSizeEstimate, items:data.items });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
