
const { json } = require('./_utils');
const { validLocalPart, allowedDomains } = require('./_mailbox');
const { query } = require('./_db');

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const localPart = String(qs.localPart || '').trim().toLowerCase();
    const domain = String(qs.domain || '').trim().toLowerCase();
    if (!validLocalPart(localPart)) return json(400, { error:'Invalid local-part.' });
    if (!allowedDomains().includes(domain)) return json(400, { error:'Domain is not available.' });
    const email = `${localPart}@${domain}`;
    const res = await query(`select 1 from mailbox_accounts where lower(email)=$1 limit 1`, [email]);
    return json(200, { ok:true, available: !res.rows.length, email });
  } catch (err) {
    return json(500, { error: err.message || 'Server error' });
  }
};
