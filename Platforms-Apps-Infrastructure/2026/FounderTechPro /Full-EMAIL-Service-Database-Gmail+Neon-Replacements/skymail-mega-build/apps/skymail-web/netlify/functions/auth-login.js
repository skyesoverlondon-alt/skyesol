
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('./_db');
const { json, parseJson, requireEnv } = require('./_utils');

exports.handler = async (event) => {
  try {
    const body = parseJson(event);
    const ident = String(body.ident || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!ident) return json(400, { error:'Email or handle required.' });
    if (!password) return json(400, { error:'Password required.' });

    const res = await query(
      `select u.id, u.handle, u.email as recovery_email, u.password_hash, m.email as mailbox_email
         from users u
         left join mailbox_accounts m on m.user_id=u.id
        where lower(u.handle)=$1 or lower(u.email)=$1 or lower(coalesce(m.email,''))=$1
        limit 1`,
      [ident]
    );
    if (!res.rows.length) return json(401, { error:'Invalid credentials.' });
    const u = res.rows[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return json(401, { error:'Invalid credentials.' });

    const token = jwt.sign({ sub: u.id, handle: u.handle, email: u.mailbox_email || u.recovery_email }, requireEnv('JWT_SECRET'), { expiresIn:'14d' });
    return json(200, { token, handle: u.handle, email: u.mailbox_email || u.recovery_email, mailbox_email: u.mailbox_email || null });
  } catch (err) {
    return json(500, { error: err.message || 'Server error' });
  }
};
