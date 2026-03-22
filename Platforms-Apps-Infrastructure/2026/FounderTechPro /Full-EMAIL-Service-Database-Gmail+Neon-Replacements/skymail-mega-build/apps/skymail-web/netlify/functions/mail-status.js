const { verifyAuth, json } = require('./_utils');
const { loadMailbox, mailboxFolderMap } = require('./_mailbox');
const { query } = require('./_db');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') return json(405, { error:'Method not allowed.' });
    const auth = verifyAuth(event);
    const mailbox = await loadMailbox(auth.sub);
    const userRes = await query(`select handle from users where id=$1 limit 1`, [auth.sub]);
    if (!mailbox) return json(200, { ok:true, connected:false, handle:userRes.rows[0]?.handle || '' });
    return json(200, {
      ok:true,
      connected:true,
      mailbox: {
        email: mailbox.email,
        mailbox_email: mailbox.email,
        provider: 'SkyMail Host',
        local_part: mailbox.local_part,
        domain: mailbox.domain,
        watch_status: 'live',
        sync_version: Number(mailbox.sync_version || 0),
        folders: mailboxFolderMap(),
      }
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
