const { verifyAuth, json } = require('./_utils');
const { labelCounts } = require('./_mailbox');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') return json(405, { error:'Method not allowed.' });
    const auth = verifyAuth(event);
    const items = await labelCounts(auth.sub);
    return json(200, { ok:true, items });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
