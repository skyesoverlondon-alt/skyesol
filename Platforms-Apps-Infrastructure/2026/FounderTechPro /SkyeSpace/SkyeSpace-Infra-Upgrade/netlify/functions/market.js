const { ok, badRequest, serverError } = require('./_shared/http');
const { query } = require('./_shared/db');
const { ensureProfile } = require('./_shared/auth');

exports.handler = async function(event, context){
  try{
    if(event.httpMethod === 'GET'){
      const result = await query(
        `select id, title, category, price_text, seller_name, eta_text, district, details, created_at
         from skyespace_listings
         order by created_at desc
         limit 48`
      );
      return ok({ ok:true, listings: result.rows.map(row => ({
        id: row.id,
        title: row.title,
        category: row.category,
        price: row.price_text,
        seller: row.seller_name,
        eta: row.eta_text,
        district: row.district,
        details: row.details,
        createdAt: row.created_at
      })) });
    }

    if(event.httpMethod === 'POST'){
      const body = JSON.parse(event.body || '{}');
      if(!body.title) return badRequest('title is required');
      const profile = await ensureProfile(context, event);
      const inserted = await query(
        `insert into skyespace_listings(title, category, price_text, seller_name, eta_text, district, details, author_profile_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning id, title, category, price_text, seller_name, eta_text, district, details, created_at`,
        [body.title, body.category || '', body.price || '', profile.display_name, body.eta || '', body.district || '', body.body || '', profile.id]
      );
      return ok({ ok:true, listing: inserted.rows[0] });
    }

    return badRequest('method not allowed');
  }catch(error){
    return serverError(error);
  }
};
