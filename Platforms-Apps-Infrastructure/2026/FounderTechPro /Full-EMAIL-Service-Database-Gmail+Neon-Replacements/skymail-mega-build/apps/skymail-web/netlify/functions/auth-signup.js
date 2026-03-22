
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('./_db');
const { json, parseJson, requireEnv, sealSecret } = require('./_utils');
const { validLocalPart, allowedDomains, primaryDomain } = require('./_mailbox');
const { createMailboxPrincipal } = require('./_stalwart');

exports.handler = async (event) => {
  let insertedUserId = null;
  let createdPrincipalId = null;
  try {
    const body = parseJson(event);
    const handle = String(body.handle || '').trim().toLowerCase();
    const recoveryEmail = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const localPart = String(body.mailbox_local_part || handle).trim().toLowerCase();
    const domain = String(body.mailbox_domain || primaryDomain()).trim().toLowerCase();
    const displayName = String(body.display_name || handle).trim();

    if (!/^[a-z0-9][a-z0-9-]{2,31}$/i.test(handle)) return json(400, { error:'Invalid handle format.' });
    if (recoveryEmail && !recoveryEmail.includes('@')) return json(400, { error:'Recovery email must be valid.' });
    if (!password || password.length < 10) return json(400, { error:'Password must be at least 10 characters.' });
    if (!validLocalPart(localPart)) return json(400, { error:'Invalid mailbox name format.' });
    if (!allowedDomains().includes(domain)) return json(400, { error:'Mailbox domain is not available.' });

    const mailboxEmail = `${localPart}@${domain}`;
    const dupRes = await query(`select 1 from users where lower(handle)=$1 limit 1`, [handle]);
    if (dupRes.rows.length) return json(409, { error:'Handle already exists.' });
    const dupMail = await query(`select 1 from mailbox_accounts where lower(email)=$1 limit 1`, [mailboxEmail]);
    if (dupMail.rows.length) return json(409, { error:'Mailbox address already exists.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const ures = await query(
      `insert into users(handle, email, password_hash, recovery_enabled, recovery_blob_json)
       values($1,$2,$3,false,null)
       returning id`,
      [handle, recoveryEmail || mailboxEmail, passwordHash]
    );
    insertedUserId = ures.rows[0].id;

    const principal = await createMailboxPrincipal({
      localPart,
      domain,
      password,
      displayName,
      quotaMb: Number(process.env.SKYMAIL_DEFAULT_QUOTA_MB || 1024),
    });
    createdPrincipalId = principal.id;

    await query(
      `insert into mailbox_accounts(user_id, local_part, domain, email, mailbox_password_enc, stalwart_principal_id, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, created_at, updated_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now())`,
      [
        insertedUserId,
        localPart,
        domain,
        mailboxEmail,
        sealSecret(password),
        String(createdPrincipalId),
        process.env.SKYMAIL_IMAP_HOST || null,
        Number(process.env.SKYMAIL_IMAP_PORT || 993),
        String(process.env.SKYMAIL_IMAP_SECURE ?? 'true') !== 'false',
        process.env.SKYMAIL_SMTP_HOST || null,
        Number(process.env.SKYMAIL_SMTP_PORT || 465),
        String(process.env.SKYMAIL_SMTP_SECURE ?? 'true') !== 'false',
      ]
    );

    await query(
      `insert into user_preferences(user_id, display_name, profile_company, profile_website, created_at, updated_at)
       values($1,$2,$3,$4,now(),now())
       on conflict (user_id) do nothing`,
      [insertedUserId, displayName || localPart, 'SkyMail', process.env.PUBLIC_BASE_URL || null]
    );

    const token = jwt.sign({ sub: insertedUserId, handle, email: mailboxEmail }, requireEnv('JWT_SECRET'), { expiresIn: '14d' });
    return json(200, { ok:true, token, handle, email: mailboxEmail, mailbox_email: mailboxEmail });
  } catch (err) {
    if (insertedUserId) {
      try { await query(`delete from users where id=$1`, [insertedUserId]); } catch(_e) {}
    }
    const msg = err.message || 'Server error';
    const status = err.statusCode || (/duplicate key value/i.test(msg) ? 409 : 500);
    return json(status, { error: msg });
  }
};
