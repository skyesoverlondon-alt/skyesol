const { query } = require("./_db");
const { json, parseJson, requireEnv, getSiteUrl, requireBasicAuth } = require("./_utils");
const { hybridEncryptWithPublicKeyPem } = require("./_hybrid");

async function resendSend({ to, subject, html }){
  const key = requireEnv("RESEND_API_KEY");
  const from = requireEnv("NOTIFY_FROM_EMAIL");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if(!res.ok){
    const t = await res.text();
    throw new Error("Email send failed: " + t);
  }
  return res.json();
}

function getHeaderValue(headers, name){
  const n = String(name || "").toLowerCase();
  if(!Array.isArray(headers)) return "";
  const h = headers.find(x => x && String(x.Name || "").toLowerCase() === n);
  return h ? String(h.Value || "") : "";
}

function stripHtml(html){
  return String(html || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/?p\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function handleFromEmailAddress(addr){
  const s = String(addr || "").trim();
  const at = s.indexOf("@");
  const local = at >= 0 ? s.slice(0, at) : s;
  const base = local.split("+")[0];
  const handle = base.trim();
  if(!/^[a-z0-9][a-z0-9-]{2,31}$/i.test(handle)) return "";
  return handle;
}

function safeText(s, max){
  const out = String(s || "");
  if(out.length <= max) return out;
  return out.slice(0, max) + "\n\n[Truncated to protect system limits]";
}

exports.handler = async (event) => {
  try{
    if(event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    // Optional Basic Auth guard (recommended)
    requireBasicAuth(event);

    const payload = parseJson(event);

    // Spam score filter (optional)
    const spamScoreMax = Number.isFinite(Number(process.env.INBOUND_SPAM_SCORE_MAX)) ? Number(process.env.INBOUND_SPAM_SCORE_MAX) : 7.0;
    const spamScoreStr = getHeaderValue(payload.Headers, "X-Spam-Score");
    const spamScore = spamScoreStr ? Number.parseFloat(spamScoreStr) : NaN;
    if(Number.isFinite(spamScore) && spamScore > spamScoreMax){
      return json(200, { ok:true, ignored:true, reason:"spam_score", spamScore, spamScoreMax });
    }

    const toFull = Array.isArray(payload.ToFull) ? payload.ToFull : [];
    const toEmails = toFull.map(x => x && x.Email).filter(Boolean);
    if(!toEmails.length) return json(200, { ok:true, ignored:true, reason:"no_recipients" });

    // We import into EACH matching recipient handle found.
    // If multiple To: addresses map to the same handle, we de-dupe.
    const handles = Array.from(new Set(toEmails.map(handleFromEmailAddress).filter(Boolean)));
    if(!handles.length) return json(200, { ok:true, ignored:true, reason:"no_valid_handles" });

    const fromEmail = String(payload.From || "").trim();
    const fromName = String(payload.FromName || "").trim();

    const subj = String(payload.Subject || "(no subject)");
    const bodyText = payload.StrippedTextReply || payload.TextBody || stripHtml(payload.HtmlBody || "");
    const maxChars = Number.isFinite(Number(process.env.INBOUND_MAX_TEXT_CHARS)) ? Number(process.env.INBOUND_MAX_TEXT_CHARS) : 200000;

    const attachments = Array.isArray(payload.Attachments) ? payload.Attachments : [];
    const attachMeta = attachments.map(a => ({
      name: String(a.Name || ""),
      content_type: String(a.ContentType || ""),
      content_length: Number(a.ContentLength || 0) || 0,
    })).filter(a => a.name || a.content_type || a.content_length);

    const base = getSiteUrl() || requireEnv("PUBLIC_BASE_URL");

    const inserted = [];
    for(const handle of handles){
      const ures = await query(
        `select id, email, handle, rsa_public_key_pem from users where lower(handle)=lower($1) limit 1`,
        [handle]
      );
      if(!ures.rows.length) continue;
      const user = ures.rows[0];

      const msgPayload = {
        subject: subj,
        message: safeText(bodyText, maxChars),
        source: "email",
        source_provider: "postmark",
        inbound: {
          original_recipient: String(payload.OriginalRecipient || ""),
          mailbox_hash: String(payload.MailboxHash || ""),
          message_id: String(payload.MessageID || ""),
          date: String(payload.Date || ""),
          reply_to: String(payload.ReplyTo || ""),
          to: toEmails,
          cc: String(payload.Cc || ""),
          bcc: String(payload.Bcc || ""),
          has_attachments: attachMeta.length > 0,
          attachments: attachMeta,
          spam: {
            x_spam_status: getHeaderValue(payload.Headers, "X-Spam-Status"),
            x_spam_score: spamScoreStr,
            x_spam_tests: getHeaderValue(payload.Headers, "X-Spam-Tests"),
          }
        }
      };

      const enc = hybridEncryptWithPublicKeyPem(user.rsa_public_key_pem, JSON.stringify(msgPayload));

      const mres = await query(
        `insert into messages(user_id, from_name, from_email, encrypted_key_b64, iv_b64, ciphertext_b64)
         values($1,$2,$3,$4,$5,$6)
         returning id, created_at`,
        [user.id, fromName || null, fromEmail || null, enc.encrypted_key_b64, enc.iv_b64, enc.ciphertext_b64]
      );

      const messageId = mres.rows[0].id;
      inserted.push({ handle: user.handle, id: messageId });

      const inboxLink = `${base}/message.html?id=${encodeURIComponent(messageId)}`;
      const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2>New imported email</h2>
          <p>A new email was received for <b>${escapeHtml(user.handle)}</b> and imported into Skye Mail Vault.</p>
          <p>From: <b>${escapeHtml(fromName || "")}</b> &lt;${escapeHtml(fromEmail)}&gt;</p>
          <p><a href="${inboxLink}" target="_blank" rel="noopener">Open in Skye Mail Vault</a></p>
          <p style="color:#666;font-size:12px">Content is encrypted at rest in the Vault database. This notification does not include message content.</p>
        </div>
      `;

      await resendSend({
        to: user.email,
        subject: `New email imported for ${user.handle}`,
        html,
      });
    }

    if(!inserted.length) return json(200, { ok:true, ignored:true, reason:"no_matching_users" });
    return json(200, { ok:true, inserted });

  }catch(err){
    const status = err.statusCode || 500;
    if(status === 401) return json(401, { error: "Unauthorized" });
    return json(status, { error: err.message || "Server error" });
  }
};

function escapeHtml(s){
  return String(s || "").replace(/[<>&"]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[c]));
}
