
const bcrypt = require('bcryptjs');
const { verifyAuth, parseJson, json, sealSecret } = require('./_utils');
const { query } = require('./_db');
const { requireMailbox } = require('./_mailbox');
const { updateMailboxPassword } = require('./_stalwart');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'POST').toUpperCase() !== 'POST') return json(405, { error:'Method not allowed.' });
    const auth = verifyAuth(event);
    const body = parseJson(event);
    const nextPassword = String(body.new_password || '');
    if (nextPassword.length < 10) return json(400, { error:'New password must be at least 10 characters.' });
    const mailbox = await requireMailbox(auth.sub);
    if (mailbox.stalwart_principal_id) await updateMailboxPassword(mailbox.stalwart_principal_id, nextPassword);
    const passwordHash = await bcrypt.hash(nextPassword, 12);
    await query(`update users set password_hash=$2 where id=$1`, [auth.sub, passwordHash]);
    await query(`update mailbox_accounts set mailbox_password_enc=$2, updated_at=now() where user_id=$1`, [auth.sub, sealSecret(nextPassword)]);
    return json(200, { ok:true });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
