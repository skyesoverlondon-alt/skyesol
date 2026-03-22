const { verifyAuth, json } = require('./_utils');
const { query } = require('./_db');
const { loadMailbox } = require('./_mailbox');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') return json(405, { error:'Method not allowed.' });
    const auth = verifyAuth(event);
    const prefRes = await query(`select display_name, profile_title, profile_phone, profile_company, profile_website, signature_text, signature_html, preferred_from_alias, vacation_enabled, vacation_subject, vacation_response_text, vacation_response_html, vacation_restrict_contacts, vacation_restrict_domain, vacation_start_at, vacation_end_at, updated_at from user_preferences where user_id=$1 limit 1`, [auth.sub]);
    const prefs = prefRes.rows[0] || null;
    const mailbox = await loadMailbox(auth.sub);
    const aliases = mailbox ? [{ sendAsEmail: mailbox.email, displayName: prefs?.display_name || mailbox.local_part, isPrimary:true, isDefault:true, treatAsAlias:false, verificationStatus:'accepted', signature: prefs?.signature_html || '' }] : [];
    return json(200, {
      ok:true,
      profile: prefs ? {
        display_name: prefs.display_name || '',
        profile_title: prefs.profile_title || '',
        profile_phone: prefs.profile_phone || '',
        profile_company: prefs.profile_company || '',
        profile_website: prefs.profile_website || '',
        signature_text: prefs.signature_text || '',
        signature_html: prefs.signature_html || '',
        preferred_from_alias: prefs.preferred_from_alias || mailbox?.email || '',
        updated_at: prefs.updated_at || null,
      } : null,
      mailbox: {
        connected: !!mailbox,
        google_email: mailbox?.email || '',
        email: mailbox?.email || '',
        signature_scope_ready: !!mailbox,
        aliases,
        sendAs: aliases[0] || null,
        vacation: prefs ? {
          enableAutoReply: !!prefs.vacation_enabled,
          responseSubject: prefs.vacation_subject || '',
          responseBodyPlainText: prefs.vacation_response_text || '',
          responseBodyHtml: prefs.vacation_response_html || '',
          restrictToContacts: !!prefs.vacation_restrict_contacts,
          restrictToDomain: !!prefs.vacation_restrict_domain,
          startTime: prefs.vacation_start_at ? new Date(prefs.vacation_start_at).getTime() : null,
          endTime: prefs.vacation_end_at ? new Date(prefs.vacation_end_at).getTime() : null,
        } : null,
        scope_note: mailbox ? 'Primary SkyMail identity is live.' : 'Create a mailbox first.',
      },
      gmail: {
        connected: !!mailbox,
        google_email: mailbox?.email || '',
        email: mailbox?.email || '',
        signature_scope_ready: !!mailbox,
        aliases,
        sendAs: aliases[0] || null,
        vacation: prefs ? {
          enableAutoReply: !!prefs.vacation_enabled,
          responseSubject: prefs.vacation_subject || '',
          responseBodyPlainText: prefs.vacation_response_text || '',
          responseBodyHtml: prefs.vacation_response_html || '',
          restrictToContacts: !!prefs.vacation_restrict_contacts,
          restrictToDomain: !!prefs.vacation_restrict_domain,
          startTime: prefs.vacation_start_at ? new Date(prefs.vacation_start_at).getTime() : null,
          endTime: prefs.vacation_end_at ? new Date(prefs.vacation_end_at).getTime() : null,
        } : null,
        scope_note: mailbox ? 'Primary SkyMail identity is live.' : 'Create a mailbox first.',
      },
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
