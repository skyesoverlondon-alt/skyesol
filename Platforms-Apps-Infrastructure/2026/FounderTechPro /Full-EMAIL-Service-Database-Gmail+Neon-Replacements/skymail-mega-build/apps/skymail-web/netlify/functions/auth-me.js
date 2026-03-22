
const { query } = require('./_db');
const { json, verifyAuth } = require('./_utils');
const { loadMailbox } = require('./_mailbox');

exports.handler = async (event) => {
  try {
    const auth = verifyAuth(event);
    const userId = auth.sub;
    const ures = await query(`select handle, email, recovery_enabled from users where id=$1 limit 1`, [userId]);
    if (!ures.rows.length) return json(401, { error:'Unauthorized' });
    const mailbox = await loadMailbox(userId);
    return json(200, {
      handle: ures.rows[0].handle,
      email: mailbox?.email || ures.rows[0].email,
      recovery_enabled: ures.rows[0].recovery_enabled,
      mailbox: mailbox ? { email: mailbox.email, local_part: mailbox.local_part, domain: mailbox.domain } : null,
      keys: [],
      active_version: null,
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
