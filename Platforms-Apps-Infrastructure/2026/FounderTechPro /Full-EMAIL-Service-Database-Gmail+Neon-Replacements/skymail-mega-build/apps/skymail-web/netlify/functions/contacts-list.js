
const { verifyAuth, json } = require('./_utils');
const { query } = require('./_db');
const { withImap } = require('./_mailbox');

function emailOnly(value) {
  const s = String(value || '');
  const m = s.match(/<([^>]+)>/);
  if (m) return m[1].trim().toLowerCase();
  const plain = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return plain ? plain[0].trim().toLowerCase() : '';
}
function nameFromAddress(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  const m = s.match(/^\s*"?([^"<]+?)"?\s*</);
  if (m) return m[1].trim();
  const email = emailOnly(s);
  return email ? email.split('@')[0] : s;
}

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') return json(405, { error:'Method not allowed.' });
    const auth = verifyAuth(event);
    const qs = event.queryStringParameters || {};
    const q = `%${String(qs.q || '').trim().toLowerCase()}%`;
    const savedRes = await query(
      `select id, email, full_name, company, phone, notes, favorite, source, source_resource_name, photo_url, last_used_at, created_at, updated_at
         from mail_contacts
        where user_id=$1
          and (
            $2='%%' or lower(email) like $2 or lower(coalesce(full_name,'')) like $2 or lower(coalesce(company,'')) like $2 or lower(coalesce(notes,'')) like $2 or lower(coalesce(phone,'')) like $2
          )
        order by favorite desc, coalesce(last_used_at, updated_at) desc nulls last, email asc`,
      [auth.sub, q]
    );
    const saved = savedRes.rows || [];
    const seen = new Set(saved.map((row)=>String(row.email || '').toLowerCase()));
    const recent = [];
    try {
      await withImap(auth.sub, async (client, mailbox)=> {
        for (const folder of ['INBOX', 'Sent']) {
          try {
            await client.mailboxOpen(folder);
            const exists = Number(client.mailbox.exists || 0);
            const start = Math.max(1, exists - 24);
            const end = Math.max(start, exists);
            for await (const msg of client.fetch(`${start}:${end}`, { envelope:true, uid:true }, { uid:false })) {
              const lines = [];
              const addrs = [].concat(msg.envelope?.from || [], msg.envelope?.to || [], msg.envelope?.cc || []);
              for (const entry of addrs) {
                const email = `${entry.mailbox || ''}@${entry.host || ''}`.toLowerCase();
                if (!email || email === String(mailbox.email || '').toLowerCase() || seen.has(email)) continue;
                seen.add(email);
                recent.push({ id:null, email, full_name: entry.name || email.split('@')[0], company:'', phone:'', notes:'', favorite:false, source:'recent_mail', source_resource_name:null, photo_url:'' });
                if (recent.length >= 20) break;
              }
              if (recent.length >= 20) break;
            }
          } catch(_err) {}
          if (recent.length >= 20) break;
        }
      });
    } catch(_err) {}
    return json(200, { ok:true, saved, recent, sync:{ connected:true, last_sync_at:null, last_sync_count: recent.length, sync_error:null } });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
