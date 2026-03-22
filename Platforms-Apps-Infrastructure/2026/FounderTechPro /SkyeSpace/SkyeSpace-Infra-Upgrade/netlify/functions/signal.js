const { ok, badRequest, serverError } = require('./_shared/http');
const { query } = require('./_shared/db');
const { ensureProfile } = require('./_shared/auth');

exports.handler = async function(event, context){
  try{
    if(event.httpMethod === 'GET'){
      const result = await query(
        `select id, severity, title, detail, source_name, created_at
         from skyespace_signals
         order by created_at desc
         limit 48`
      );
      return ok({ ok:true, signals: result.rows.map(row => ({
        id: row.id,
        severity: row.severity,
        title: row.title,
        detail: row.detail,
        source: row.source_name,
        age: row.created_at
      })) });
    }

    if(event.httpMethod === 'POST'){
      const body = JSON.parse(event.body || '{}');
      if(!body.title) return badRequest('title is required');
      const profile = await ensureProfile(context, event);
      const inserted = await query(
        `insert into skyespace_signals(severity, title, detail, source_name)
         values ($1,$2,$3,$4)
         returning id, severity, title, detail, source_name, created_at`,
        [body.severity || 'medium', body.title, body.body || body.detail || '', profile.display_name]
      );
      return ok({ ok:true, signal: inserted.rows[0] });
    }

    return badRequest('method not allowed');
  }catch(error){
    return serverError(error);
  }
};
