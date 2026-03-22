const { verifyAuth, parseJson, json } = require('./_utils');
const { modifyFlags } = require('./_mailbox');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'POST').toUpperCase() !== 'POST') return json(405, { error:'Method not allowed.' });
    const auth = verifyAuth(event);
    const body = parseJson(event);
    const ids = Array.isArray(body.ids) ? body.ids : [];
    for (const id of ids) await modifyFlags(auth.sub, id, body.addLabelIds || [], body.removeLabelIds || []);
    return json(200, { ok:true, updated: ids.length });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
