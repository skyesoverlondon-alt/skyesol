const { query } = require("./_db");
const { json, parseJson, requireEnv, enforceRateLimit, randomToken } = require("./_utils");
const crypto = require("crypto");

function escapeHtml(s){
  return String(s || "").replace(/[<>&"]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[c]));
}

function siteBase(){
  // Prefer explicit PUBLIC_BASE_URL when set; otherwise fall back to Netlify URL vars.
  return process.env.PUBLIC_BASE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || "";
}

/**
 * Signature format:
 *  X-SMV-Signature: t=<unix_seconds>, v1=<hex_hmac_sha256>
 * where signed payload is: `${t}.${rawBody}`
 */
function verifyBridgeSignature(event){
  const secret = requireEnv("SMTP_BRIDGE_SECRET");
  const sig = (event.headers && (event.headers["x-smv-signature"] || event.headers["X-SMV-Signature"])) ?
    String(event.headers["x-smv-signature"] || event.headers["X-SMV-Signature"]) : "";

  if(!sig) {
    const err = new Error("Missing bridge signature.");
    err.statusCode = 401;
    throw err;
  }

  const mT = sig.match(/(?:^|,)\s*t=([0-9]{10,})\s*/i);
  const mV = sig.match(/(?:^|,)\s*v1=([a-f0-9]{64})\s*/i);
  if(!mT || !mV){
    const err = new Error("Invalid bridge signature format.");
    err.statusCode = 401;
    throw err;
  }

  const t = Number(mT[1]);
  const v1 = mV[1];
  const now = Math.floor(Date.now()/1000);
  const maxSkew = 300; // 5 minutes
  if(Math.abs(now - t) > maxSkew){
    const err = new Error("Bridge signature expired.");
    err.statusCode = 401;
    throw err;
  }

  const raw = event.body || "";
  const signed = `${t}.${raw}`;
  const mac = crypto.createHmac("sha256", secret).update(signed, "utf8").digest("hex");

  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(v1, "hex");
  const ok = (a.length === b.length) && crypto.timingSafeEqual(a,b);

  if(!ok){
    const err = new Error("Bridge signature invalid.");
    err.statusCode = 401;
    throw err;
  }
}

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

exports.handler = async (event) => {
  try{
    // Only allow POST
    if(event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    // Authenticate bridge caller
    verifyBridgeSignature(event);

    const body = parseJson(event);

    // EXPECTED INPUT (from VPS bridge):
    // {
    //   handle, from_name, from_email,
    //   key_version, encrypted_key_b64, iv_b64, ciphertext_b64,
    //   attachments?: [{ filename, mime_type, size_bytes, encrypted_key_b64, iv_b64, ciphertext_b64 }]
    // }
    const handle = (body.handle || "").trim();
    const from_name = (body.from_name || "").trim();
    const from_email = (body.from_email || "").trim();
    const encrypted_key_b64 = body.encrypted_key_b64;
    const iv_b64 = body.iv_b64;
    const ciphertext_b64 = body.ciphertext_b64;
    const key_version = Number(body.key_version || 0);

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
    if(!kcheck.rows.length) return json(409, { error: "Recipient key version not found." });

    // Bridge-side spam defenses are primary; still enforce basic rate limits here.
    await enforceRateLimit({
      ipLimit: 999999,
      handleLimit: 120,
      ipWindowLabel: "n/a",
      handleWindowLabel: "1 hour",
      countIpWindow: async () => 0,
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
       returning id`,
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

    // Optional: send thread portal link to sender (they can reply via portal)
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
