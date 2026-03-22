const { query } = require("./_db");
const { json, parseJson, requireEnv, enforceRateLimit, randomToken } = require("./_utils");

async function resendSend({ to, subject, html }){
  const key = requireEnv("RESEND_API_KEY");
  const from = requireEnv("NOTIFY_FROM_EMAIL");

  const res = await fetch("https://api.resend.com/emails", {
    method:"POST",
    headers:{
      "Authorization": `Bearer ${key}`,
      "Content-Type":"application/json"
    },
    body: JSON.stringify({ from, to, subject, html })
  });

  if(!res.ok){
    const t = await res.text();
    throw new Error("Email send failed: " + t);
  }
  return res.json();
}

function siteBase(){
  return process.env.URL || process.env.DEPLOY_PRIME_URL || "";
}

exports.handler = async (event) => {
  try{
    const body = parseJson(event);

    const handle = (body.handle || "").trim();
    const from_name = (body.from_name || "").trim();
    const from_email = (body.from_email || "").trim();
    const encrypted_key_b64 = body.encrypted_key_b64;
    const iv_b64 = body.iv_b64;
    const ciphertext_b64 = body.ciphertext_b64;
    const key_version = Number(body.key_version || 0);

    const hp = (body.website || "").trim();
    if(hp) return json(200, { ok:true });

    if(!handle) return json(400, { error: "handle required" });
    if(!from_email || !from_email.includes("@")) return json(400, { error: "Valid sender email required." });
    if(!encrypted_key_b64 || !iv_b64 || !ciphertext_b64) return json(400, { error: "Encrypted payload required." });
    if(!Number.isFinite(key_version) || key_version < 1) return json(400, { error: "key_version required." });

    const ures = await query(
      `select id, email, handle from users where lower(handle)=lower($1) limit 1`,
      [handle]
    );
    if(!ures.rows.length) return json(404, { error: "Recipient not found." });
    const user = ures.rows[0];

    const kcheck = await query(
      `select 1 from user_keys where user_id=$1 and version=$2 limit 1`,
      [user.id, key_version]
    );
    if(!kcheck.rows.length) return json(409, { error: "Recipient key rotated. Refresh the send page and try again." });

    await enforceRateLimit({
      ipLimit: 10,
      handleLimit: 60,
      ipWindowLabel: "10 minutes",
      handleWindowLabel: "1 hour",
      countIpWindow: async () => {
        const r = await query(
          `select count(*)::int as c
           from messages
           where created_at > now() - interval '10 minutes'
             and from_email=$1`,
          [from_email]
        );
        return r.rows[0].c;
      },
      countHandleWindow: async () => {
        const r = await query(
          `select count(*)::int as c
           from messages
           where created_at > now() - interval '1 hour'
             and user_id=$1`,
          [user.id]
        );
        return r.rows[0].c;
      }
    });

    let threadId = null;
    let threadToken = null;

    const existing = await query(
      `select id, token from threads where user_id=$1 and lower(from_email)=lower($2) order by last_activity_at desc limit 1`,
      [user.id, from_email]
    );

    if(existing.rows.length){
      threadId = existing.rows[0].id;
      threadToken = existing.rows[0].token;
      await query(`update threads set last_activity_at=now() where id=$1`, [threadId]);
    }else{
      threadToken = randomToken(24);
      const tIns = await query(
        `insert into threads(user_id, token, from_name, from_email) values($1,$2,$3,$4) returning id`,
        [user.id, threadToken, from_name || null, from_email]
      );
      threadId = tIns.rows[0].id;
    }

    const mres = await query(
      `insert into messages(user_id, thread_id, from_name, from_email, key_version, encrypted_key_b64, iv_b64, ciphertext_b64)
       values($1,$2,$3,$4,$5,$6,$7,$8)
       returning id, created_at`,
      [user.id, threadId, from_name || null, from_email, key_version, encrypted_key_b64, iv_b64, ciphertext_b64]
    );
    const messageId = mres.rows[0].id;

    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    if(attachments.length){
      if(attachments.length > 6) return json(400, { error: "Max 6 attachments." });
      for(const a of attachments){
        const filename = String(a.filename || "").trim();
        const mime_type = String(a.mime_type || "application/octet-stream").trim();
        const size_bytes = Number(a.size_bytes || 0);
        const a_enc_key = a.encrypted_key_b64;
        const a_iv = a.iv_b64;
        const a_ct_b64 = a.ciphertext_b64;

        if(!filename) return json(400, { error: "Attachment filename required." });
        if(!a_enc_key || !a_iv || !a_ct_b64) return json(400, { error: "Attachment encrypted payload required." });
        if(!Number.isFinite(size_bytes) || size_bytes <= 0) return json(400, { error: "Attachment size_bytes invalid." });
        if(size_bytes > 4_000_000) return json(400, { error: "Attachment too large (max 4MB each)." });

        const ctBuf = Buffer.from(a_ct_b64, "base64");
        await query(
          `insert into attachments(message_id, filename, mime_type, size_bytes, encrypted_key_b64, iv_b64, ciphertext)
           values($1,$2,$3,$4,$5,$6,$7)`,
          [messageId, filename, mime_type, size_bytes, a_enc_key, a_iv, ctBuf]
        );
      }
    }

    const base = siteBase();
    const inboxLink = `${base}/message.html?id=${encodeURIComponent(messageId)}`;
    const threadLink = `${base}/thread.html?token=${encodeURIComponent(threadToken)}`;

    const htmlToRecipient = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>New encrypted message received</h2>
        <p>A new message arrived for <b>${escapeHtml(user.handle)}</b>.</p>
        <p>Sender: <b>${escapeHtml(from_name || "")}</b> &lt;${escapeHtml(from_email)}&gt;</p>
        <p><a href="${inboxLink}" target="_blank" rel="noopener">Open in Skye Mail Vault</a></p>
        <p style="color:#666;font-size:12px">Message content is not included in this email to preserve end-to-end confidentiality.</p>
      </div>
    `;
    await resendSend({ to: user.email, subject: `New encrypted message for ${user.handle}`, html: htmlToRecipient });

    const htmlToSender = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Secure reply link</h2>
        <p>Your secure thread link for <b>${escapeHtml(user.handle)}</b>:</p>
        <p><a href="${threadLink}" target="_blank" rel="noopener">${threadLink}</a></p>
        <p style="color:#666;font-size:12px">No message content is included here. This is only a secure portal link.</p>
      </div>
    `;
    try{
      await resendSend({ to: from_email, subject: `Secure reply link — ${user.handle}`, html: htmlToSender });
    }catch(e){}

    return json(200, { ok:true, id: messageId, thread_token: threadToken });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};

function escapeHtml(s){
  return String(s || "").replace(/[<>&"]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[c]));
}
