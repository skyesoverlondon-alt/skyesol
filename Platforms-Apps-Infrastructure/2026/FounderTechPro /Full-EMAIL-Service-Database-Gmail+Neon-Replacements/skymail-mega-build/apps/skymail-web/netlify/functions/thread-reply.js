const { query } = require("./_db");
const { json, parseJson, getClientIp, enforceRateLimit } = require("./_utils");

exports.handler = async (event) => {
  try{
    const body = parseJson(event);

    const token = (body.token || "").trim();
    const from_name = (body.from_name || "").trim();
    const from_email = (body.from_email || "").trim();
    const encrypted_key_b64 = body.encrypted_key_b64;
    const iv_b64 = body.iv_b64;
    const ciphertext_b64 = body.ciphertext_b64;
    const key_version = Number(body.key_version || 0);

    const hp = (body.website || "").trim();
    if(hp) return json(200, { ok:true });

    if(!token) return json(400, { error: "token required" });
    if(!from_email || !from_email.includes("@")) return json(400, { error: "Valid sender email required." });
    if(!encrypted_key_b64 || !iv_b64 || !ciphertext_b64) return json(400, { error: "Encrypted payload required." });
    if(!Number.isFinite(key_version) || key_version < 1) return json(400, { error: "key_version required." });

    const tres = await query(
      `select id, user_id from threads where token=$1 limit 1`,
      [token]
    );
    if(!tres.rows.length) return json(404, { error: "Thread not found." });

    const threadId = tres.rows[0].id;
    const userId = tres.rows[0].user_id;

    await enforceRateLimit({
      ipLimit: 12,
      handleLimit: 999999,
      ipWindowLabel: "10 minutes",
      handleWindowLabel: "n/a",
      countIpWindow: async () => {
        const r = await query(
          `select count(*)::int as c from messages
           where created_at > now() - interval '10 minutes'
             and from_email=$1`,
          [from_email]
        );
        return r.rows[0].c;
      },
      countHandleWindow: async () => 0
    });

    const mres = await query(
      `insert into messages(user_id, thread_id, from_name, from_email, key_version, encrypted_key_b64, iv_b64, ciphertext_b64)
       values($1,$2,$3,$4,$5,$6,$7,$8)
       returning id`,
      [userId, threadId, from_name || null, from_email, key_version, encrypted_key_b64, iv_b64, ciphertext_b64]
    );

    const messageId = mres.rows[0].id;
    await query(`update threads set last_activity_at=now() where id=$1`, [threadId]);

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

    return json(200, { ok:true, id: messageId });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
