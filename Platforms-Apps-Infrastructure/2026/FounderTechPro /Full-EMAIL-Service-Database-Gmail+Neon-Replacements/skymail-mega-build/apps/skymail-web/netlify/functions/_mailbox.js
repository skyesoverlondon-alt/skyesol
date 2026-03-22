
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');
const MailComposer = require('nodemailer/lib/mail-composer');
const { query } = require('./_db');
const { openSecret, sealSecret } = require('./_utils');

function allowedDomains(){
  const raw = String(process.env.SKYMAIL_PUBLIC_DOMAINS || process.env.SKYMAIL_PRIMARY_DOMAIN || '').trim();
  return raw ? raw.split(',').map((x)=>x.trim().toLowerCase()).filter(Boolean) : [];
}

function primaryDomain(){
  return String(process.env.SKYMAIL_PRIMARY_DOMAIN || allowedDomains()[0] || '').trim().toLowerCase();
}

function validLocalPart(v){
  return /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/i.test(String(v || ''));
}

function parseMessageRef(value){
  const raw = String(value || '').trim();
  const [folderPart, uidPart] = raw.split('::');
  return { folder: decodeURIComponent(folderPart || ''), uid: Number(uidPart || 0) || 0 };
}

function encodeMessageRef(folder, uid){
  return `${encodeURIComponent(String(folder || 'INBOX'))}::${Number(uid || 0)}`;
}

function normalizeSubject(subject){
  return String(subject || '')
    .replace(/^(?:\s*(?:re|fwd|fw)\s*:\s*)+/ig, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function mailboxFolderMap(){
  return {
    INBOX: String(process.env.SKYMAIL_FOLDER_INBOX || 'INBOX'),
    SENT: String(process.env.SKYMAIL_FOLDER_SENT || 'Sent'),
    DRAFT: String(process.env.SKYMAIL_FOLDER_DRAFTS || 'Drafts'),
    SPAM: String(process.env.SKYMAIL_FOLDER_SPAM || 'Junk'),
    TRASH: String(process.env.SKYMAIL_FOLDER_TRASH || 'Trash'),
    ARCHIVE: String(process.env.SKYMAIL_FOLDER_ARCHIVE || 'Archive'),
  };
}

async function loadMailbox(userId){
  const res = await query(`select * from mailbox_accounts where user_id=$1 limit 1`, [userId]);
  return res.rows[0] || null;
}

async function requireMailbox(userId){
  const row = await loadMailbox(userId);
  if (!row) {
    const err = new Error('Mailbox is not provisioned for this account yet.');
    err.statusCode = 404;
    throw err;
  }
  return row;
}

function connectionConfig(row){
  return {
    imap: {
      host: row.imap_host || process.env.SKYMAIL_IMAP_HOST,
      port: Number(row.imap_port || process.env.SKYMAIL_IMAP_PORT || 993),
      secure: String(row.imap_secure ?? process.env.SKYMAIL_IMAP_SECURE ?? 'true') !== 'false',
    },
    smtp: {
      host: row.smtp_host || process.env.SKYMAIL_SMTP_HOST,
      port: Number(row.smtp_port || process.env.SKYMAIL_SMTP_PORT || 465),
      secure: String(row.smtp_secure ?? process.env.SKYMAIL_SMTP_SECURE ?? 'true') !== 'false',
    }
  };
}

async function withImap(userId, fn){
  const mailbox = await requireMailbox(userId);
  const cfg = connectionConfig(mailbox);
  const client = new ImapFlow({
    host: cfg.imap.host,
    port: cfg.imap.port,
    secure: cfg.imap.secure,
    auth: { user: mailbox.email, pass: openSecret(mailbox.mailbox_password_enc) },
    logger: false,
  });
  await client.connect();
  try {
    await ensureSystemFolders(client);
    return await fn(client, mailbox);
  } finally {
    try { await client.logout(); } catch(_err) {}
  }
}

async function smtpTransport(userId){
  const mailbox = await requireMailbox(userId);
  const cfg = connectionConfig(mailbox);
  return nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.secure,
    auth: { user: mailbox.email, pass: openSecret(mailbox.mailbox_password_enc) },
  });
}

async function ensureSystemFolders(client){
  const map = mailboxFolderMap();
  for (const folder of Object.values(map)) {
    if (!folder || folder.toUpperCase() === 'INBOX') continue;
    try { await client.mailboxCreate(folder); } catch(_err) {}
  }
}

async function folderStatus(client, folder){
  try {
    const status = await client.status(folder, { messages:true, unseen:true });
    return { total: Number(status.messages || 0), unread: Number(status.unseen || 0) };
  } catch(_err) {
    return { total: 0, unread: 0 };
  }
}

function envelopeAddressLine(list){
  const items = Array.isArray(list) ? list : [];
  return items.map((entry)=> {
    const name = entry.name ? `${entry.name} ` : '';
    const email = `${entry.mailbox || ''}@${entry.host || ''}`.toLowerCase();
    return entry.name ? `${entry.name} <${email}>` : email;
  }).filter(Boolean).join(', ');
}

function hasAttachments(struct){
  if (!struct) return false;
  if (Array.isArray(struct.childNodes)) return struct.childNodes.some(hasAttachments);
  if (struct.disposition && String(struct.disposition.type || '').toLowerCase() === 'attachment') return true;
  if (struct.parameters && struct.parameters.name) return true;
  return false;
}

async function collectMessages(client, folder, opts = {}){
  const { q = '', offset = 0, limit = 25, includeSource = false } = opts;
  await client.mailboxOpen(folder);
  const exists = Number(client.mailbox.exists || 0);
  if (!exists) return { items: [], nextPageToken: null, resultSizeEstimate: 0 };
  const end = Math.max(0, exists - offset);
  const start = Math.max(1, end - Math.max(1, limit) + 1);
  if (end < 1 || start > end) return { items: [], nextPageToken: null, resultSizeEstimate: exists };
  const seqRange = `${start}:${end}`;
  const out = [];
  for await (const msg of client.fetch(seqRange, { uid:true, envelope:true, flags:true, internalDate:true, bodyStructure:true, source: includeSource }, { uid:false })) {
    const subject = msg.envelope?.subject || '(no subject)';
    const from = envelopeAddressLine(msg.envelope?.from || []);
    const to = envelopeAddressLine(msg.envelope?.to || []);
    const record = {
      id: encodeMessageRef(folder, msg.uid),
      thread_id: normalizeSubject(subject) || `uid-${msg.uid}`,
      uid: msg.uid,
      folder,
      subject,
      snippet: '',
      from,
      to,
      internal_date: msg.internalDate ? new Date(msg.internalDate).toISOString() : null,
      unread: !(msg.flags || []).includes('\\Seen'),
      starred: (msg.flags || []).includes('\\Flagged'),
      important: false,
      has_attachments: hasAttachments(msg.bodyStructure),
      labels: [],
      message_id: '',
      references: '',
      in_reply_to: '',
      source: msg.source || null,
    };
    if (q) {
      const hay = `${record.subject} ${record.from} ${record.to}`.toLowerCase();
      if (!hay.includes(String(q).toLowerCase())) continue;
    }
    out.push(record);
  }
  out.sort((a,b)=> new Date(b.internal_date||0) - new Date(a.internal_date||0));
  return {
    items: out,
    nextPageToken: (offset + limit) < exists ? String(offset + limit) : null,
    resultSizeEstimate: exists,
  };
}

async function fetchParsedMessage(client, folder, uid){
  await client.mailboxOpen(folder);
  let row = null;
  for await (const msg of client.fetch(String(uid), { uid:true, envelope:true, flags:true, internalDate:true, bodyStructure:true, source:true }, { uid:true })) {
    row = msg;
    break;
  }
  if (!row) {
    const err = new Error('Message not found.');
    err.statusCode = 404;
    throw err;
  }
  const parsed = await simpleParser(row.source);
  const headers = {
    from: parsed.from?.text || envelopeAddressLine(row.envelope?.from || []),
    to: parsed.to?.text || envelopeAddressLine(row.envelope?.to || []),
    cc: parsed.cc?.text || '',
    subject: parsed.subject || row.envelope?.subject || '(no subject)',
    date: parsed.date ? parsed.date.toISOString() : (row.internalDate ? new Date(row.internalDate).toISOString() : ''),
    message_id: parsed.messageId || '',
    references: Array.isArray(parsed.references) ? parsed.references.join(' ') : (parsed.headers.get('references') || ''),
    in_reply_to: parsed.inReplyTo || (parsed.headers.get('in-reply-to') || ''),
  };
  const attachments = (parsed.attachments || []).map((item, idx)=>({
    attachment_id: String(idx),
    filename: item.filename || `attachment-${idx+1}`,
    mime_type: item.contentType || 'application/octet-stream',
    size: Number(item.size || (item.content ? item.content.length : 0) || 0),
    cid: item.cid || null,
    data_b64: item.content ? Buffer.from(item.content).toString('base64') : '',
  }));
  return {
    id: encodeMessageRef(folder, uid),
    folder,
    uid,
    snippet: String(parsed.text || parsed.subject || '').slice(0, 220),
    labels: [folder],
    internal_date: row.internalDate ? new Date(row.internalDate).toISOString() : null,
    headers,
    body: { text: parsed.text || '', html: parsed.html ? String(parsed.html) : '' },
    attachments,
    unread: !(row.flags || []).includes('\\Seen'),
    starred: (row.flags || []).includes('\\Flagged'),
  };
}

async function fetchMessageByRef(userId, ref){
  const { folder, uid } = parseMessageRef(ref);
  return withImap(userId, (client)=> fetchParsedMessage(client, folder || mailboxFolderMap().INBOX, uid));
}

async function labelCounts(userId){
  return withImap(userId, async (client)=> {
    const map = mailboxFolderMap();
    const order = [
      ['INBOX', map.INBOX],
      ['SENT', map.SENT],
      ['DRAFT', map.DRAFT],
      ['SPAM', map.SPAM],
      ['TRASH', map.TRASH],
    ];
    const items = [];
    for (const [id, folder] of order) {
      const status = await folderStatus(client, folder);
      items.push({ id, name: folder, messagesUnread: status.unread, messagesTotal: status.total });
    }
    return items;
  });
}

async function listMessages(userId, label, q, pageToken, max){
  return withImap(userId, async (client, mailbox)=> {
    const map = mailboxFolderMap();
    const folder = map[label] || label || map.INBOX;
    const offset = Math.max(0, Number(pageToken || 0));
    const data = await collectMessages(client, folder, { q, offset, limit: Math.max(1, Math.min(25, Number(max || 20))) });
    return { mailbox: mailbox.email, ...data, items: data.items };
  });
}

async function buildRawMessage({ from, to, cc, bcc, subject, text, html, attachments = [], headers = {} }){
  const composer = new MailComposer({
    from,
    to,
    cc,
    bcc,
    subject,
    text,
    html,
    attachments: (attachments || []).map((item)=>({
      filename: item.filename,
      content: item.data_b64 ? Buffer.from(String(item.data_b64), 'base64') : Buffer.alloc(0),
      contentType: item.mime_type || 'application/octet-stream',
    })),
    headers,
  });
  return await composer.compile().build();
}

async function appendSentCopy(client, raw){
  try { await client.append(mailboxFolderMap().SENT, raw, ['\\Seen']); } catch(_err) {}
}

async function sendMessage(userId, payload){
  const mailbox = await requireMailbox(userId);
  const prefsRes = await query(`select display_name, signature_text, signature_html, preferred_from_alias from user_preferences where user_id=$1 limit 1`, [userId]);
  const prefs = prefsRes.rows[0] || {};
  const fromEmail = mailbox.email;
  const displayName = prefs.display_name || mailbox.local_part;
  const from = `${displayName} <${fromEmail}>`;
  const text = String(payload.text || '');
  const html = String(payload.html || '');
  const headers = {};
  if (payload.reply_message_id) {
    try {
      const msg = await fetchMessageByRef(userId, payload.reply_message_id);
      if (msg.headers.message_id) headers['In-Reply-To'] = msg.headers.message_id;
      if (msg.headers.references) headers['References'] = `${msg.headers.references} ${msg.headers.message_id || ''}`.trim();
      else if (msg.headers.message_id) headers['References'] = msg.headers.message_id;
    } catch(_err) {}
  }
  const raw = await buildRawMessage({
    from,
    to: payload.to,
    cc: payload.cc,
    bcc: payload.bcc,
    subject: payload.subject,
    text: text + (prefs.signature_text && !text.includes(prefs.signature_text) ? `\n\n${prefs.signature_text}` : ''),
    html: html || (text ? undefined : ''),
    attachments: payload.attachments,
    headers,
  });
  const transport = await smtpTransport(userId);
  await transport.sendMail({ envelope: { from: fromEmail, to: [payload.to, payload.cc, payload.bcc].filter(Boolean).join(',') }, raw });
  await withImap(userId, async (client)=> appendSentCopy(client, raw));
  return { mailbox: mailbox.email, from_alias: fromEmail, raw };
}

async function saveDraft(userId, payload){
  const mailbox = await requireMailbox(userId);
  const prefsRes = await query(`select display_name from user_preferences where user_id=$1 limit 1`, [userId]);
  const displayName = prefsRes.rows[0]?.display_name || mailbox.local_part;
  const from = `${displayName} <${mailbox.email}>`;
  const raw = await buildRawMessage({
    from,
    to: payload.to,
    cc: payload.cc,
    bcc: payload.bcc,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    attachments: payload.attachments,
  });
  return await withImap(userId, async (client)=> {
    const draftFolder = mailboxFolderMap().DRAFT;
    if (payload.id) {
      const ref = parseMessageRef(payload.id);
      try {
        await client.mailboxOpen(ref.folder || draftFolder);
        await client.messageDelete(String(ref.uid), { uid:true });
        if (typeof client.expunge === 'function') await client.expunge();
      } catch(_err) {}
    }
    const appended = await client.append(draftFolder, raw, ['\\Seen', '\\Draft']);
    const uid = Number(appended?.uid || 0);
    return {
      mailbox: mailbox.email,
      draft: {
        id: encodeMessageRef(draftFolder, uid),
        thread_id: normalizeSubject(payload.subject || ''),
      }
    };
  });
}

async function listDrafts(userId, q, pageToken, max){
  return withImap(userId, async (client, mailbox)=> {
    const folder = mailboxFolderMap().DRAFT;
    const offset = Math.max(0, Number(pageToken || 0));
    const data = await collectMessages(client, folder, { q, offset, limit: Math.max(1, Math.min(30, Number(max || 20))) });
    return {
      mailbox: mailbox.email,
      nextPageToken: data.nextPageToken,
      resultSizeEstimate: data.resultSizeEstimate,
      items: data.items.map((item)=>({
        draft_id: item.id,
        message_id: item.id,
        thread_id: item.thread_id,
        id: item.id,
        subject: item.subject,
        from: item.from,
        snippet: item.snippet,
        internal_date: item.internal_date,
        unread: item.unread,
        starred: item.starred,
        important: item.important,
        has_attachments: item.has_attachments,
      }))
    };
  });
}

async function deleteDraft(userId, ref){
  return withImap(userId, async (client)=> {
    const { folder, uid } = parseMessageRef(ref);
    await client.mailboxOpen(folder || mailboxFolderMap().DRAFT);
    await client.messageDelete(String(uid), { uid:true });
    if (typeof client.expunge === 'function') await client.expunge();
    return { ok:true };
  });
}

async function modifyFlags(userId, ref, addLabelIds = [], removeLabelIds = []){
  return withImap(userId, async (client)=> {
    const { folder, uid } = parseMessageRef(ref);
    await client.mailboxOpen(folder || mailboxFolderMap().INBOX);
    const addFlags = [];
    const removeFlags = [];
    if (addLabelIds.includes('STARRED')) addFlags.push('\\Flagged');
    if (addLabelIds.includes('UNREAD')) removeFlags.push('\\Seen');
    if (removeLabelIds.includes('STARRED')) removeFlags.push('\\Flagged');
    if (removeLabelIds.includes('UNREAD')) addFlags.push('\\Seen');
    if (addFlags.length) await client.messageFlagsAdd(String(uid), addFlags, { uid:true });
    if (removeFlags.length) await client.messageFlagsRemove(String(uid), removeFlags, { uid:true });
    if (removeLabelIds.includes('INBOX')) {
      try { await client.messageMove(String(uid), mailboxFolderMap().ARCHIVE, { uid:true }); } catch(_err) {}
    }
    return { ok:true };
  });
}

async function moveToTrash(userId, ids, action){
  return withImap(userId, async (client)=> {
    const map = mailboxFolderMap();
    for (const id of ids) {
      const { folder, uid } = parseMessageRef(id);
      await client.mailboxOpen(folder || map.INBOX);
      if (action === 'untrash') await client.messageMove(String(uid), map.INBOX, { uid:true });
      else await client.messageMove(String(uid), map.TRASH, { uid:true });
    }
    return { ok:true };
  });
}

async function deleteForever(userId, ids){
  return withImap(userId, async (client)=> {
    for (const id of ids) {
      const { folder, uid } = parseMessageRef(id);
      await client.mailboxOpen(folder || mailboxFolderMap().TRASH);
      await client.messageDelete(String(uid), { uid:true });
      if (typeof client.expunge === 'function') await client.expunge();
    }
    return { ok:true };
  });
}

async function attachmentByRef(userId, ref, attachmentId){
  const msg = await fetchMessageByRef(userId, ref);
  const att = (msg.attachments || [])[Number(attachmentId || 0)];
  if (!att || !att.data_b64) {
    const err = new Error('Attachment not found.');
    err.statusCode = 404;
    throw err;
  }
  return { attachment: att, content: Buffer.from(att.data_b64, 'base64') };
}

async function threadBySubject(userId, ref){
  const seed = await fetchMessageByRef(userId, ref);
  const subjectKey = normalizeSubject(seed.headers.subject);
  const folders = [mailboxFolderMap().INBOX, mailboxFolderMap().SENT, mailboxFolderMap().DRAFT];
  const bucket = [];
  await withImap(userId, async (client)=> {
    for (const folder of folders) {
      const page = await collectMessages(client, folder, { q: '', offset: 0, limit: 80, includeSource: true });
      for (const row of page.items) {
        const key = normalizeSubject(row.subject);
        if (key !== subjectKey) continue;
        try {
          bucket.push(await fetchParsedMessage(client, folder, row.uid));
        } catch(_err) {}
      }
    }
  });
  bucket.sort((a,b)=> new Date(a.internal_date||0) - new Date(b.internal_date||0));
  return {
    thread: {
      id: subjectKey || seed.id,
      subject: seed.headers.subject || '(no subject)',
      message_count: bucket.length,
      participants: Array.from(new Set(bucket.flatMap((m)=>[m.headers.from, m.headers.to]).filter(Boolean))),
      messages: bucket,
    }
  };
}

module.exports = {
  allowedDomains,
  primaryDomain,
  validLocalPart,
  parseMessageRef,
  encodeMessageRef,
  normalizeSubject,
  mailboxFolderMap,
  loadMailbox,
  requireMailbox,
  connectionConfig,
  withImap,
  labelCounts,
  listMessages,
  fetchMessageByRef,
  sendMessage,
  saveDraft,
  listDrafts,
  deleteDraft,
  modifyFlags,
  moveToTrash,
  deleteForever,
  attachmentByRef,
  threadBySubject,
};
