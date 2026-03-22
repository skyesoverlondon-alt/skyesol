const { verifyAuth, json } = require('./_utils');
const { loadMailbox } = require('./_mailbox');

exports.handler = async (event) => {
  try {
    const auth = verifyAuth(event);
    const mailbox = await loadMailbox(auth.sub);
    return json(200, {
      ok:true,
      mailbox: mailbox?.email || '',
      watch: {
        status: mailbox ? 'live' : 'missing',
        sync_version: Number(mailbox?.sync_version || 0),
      },
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
