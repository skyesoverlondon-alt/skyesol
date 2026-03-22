const { verifyAuth, parseJson, json } = require('./_utils');
const { query } = require('./_db');

function toTimestamptz(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'POST').toUpperCase() !== 'POST') return json(405, { error:'Method not allowed.' });
    const auth = verifyAuth(event);
    const body = parseJson(event);
    await query(
      `insert into user_preferences (
         user_id, display_name, profile_title, profile_phone, profile_company, profile_website,
         signature_text, signature_html, preferred_from_alias,
         vacation_enabled, vacation_subject, vacation_response_text, vacation_response_html,
         vacation_restrict_contacts, vacation_restrict_domain, vacation_start_at, vacation_end_at,
         created_at, updated_at
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(),now())
       on conflict (user_id)
       do update set display_name=excluded.display_name,
                     profile_title=excluded.profile_title,
                     profile_phone=excluded.profile_phone,
                     profile_company=excluded.profile_company,
                     profile_website=excluded.profile_website,
                     signature_text=excluded.signature_text,
                     signature_html=excluded.signature_html,
                     preferred_from_alias=excluded.preferred_from_alias,
                     vacation_enabled=excluded.vacation_enabled,
                     vacation_subject=excluded.vacation_subject,
                     vacation_response_text=excluded.vacation_response_text,
                     vacation_response_html=excluded.vacation_response_html,
                     vacation_restrict_contacts=excluded.vacation_restrict_contacts,
                     vacation_restrict_domain=excluded.vacation_restrict_domain,
                     vacation_start_at=excluded.vacation_start_at,
                     vacation_end_at=excluded.vacation_end_at,
                     updated_at=now()`,
      [
        auth.sub,
        String(body.display_name || '').trim() || null,
        String(body.profile_title || '').trim() || null,
        String(body.profile_phone || '').trim() || null,
        String(body.profile_company || '').trim() || null,
        String(body.profile_website || '').trim() || null,
        String(body.signature_text || '').trim() || null,
        String(body.signature_html || '').trim() || null,
        String(body.preferred_from_alias || '').trim().toLowerCase() || null,
        Boolean(body.vacation_enabled),
        String(body.vacation_subject || '').trim() || null,
        String(body.vacation_response_text || '').trim() || null,
        String(body.vacation_response_html || '').trim() || null,
        Boolean(body.vacation_restrict_contacts),
        Boolean(body.vacation_restrict_domain),
        toTimestamptz(body.vacation_start),
        toTimestamptz(body.vacation_end),
      ]
    );
    return json(200, { ok:true, mailbox_updated:true });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
