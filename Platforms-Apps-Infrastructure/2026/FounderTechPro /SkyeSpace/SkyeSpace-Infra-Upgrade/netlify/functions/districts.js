const { ok, serverError } = require('./_shared/http');
const { query } = require('./_shared/db');

exports.handler = async function(){
  try{
    const result = await query(
      `select id, slug, name, vibe, hotspot, active_count, created_at
       from skyespace_districts
       order by active_count desc, name asc`
    );
    return ok({ ok:true, districts: result.rows.map(row => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      vibe: row.vibe,
      hotspot: row.hotspot,
      active: `${Number(row.active_count || 0).toLocaleString()} active`
    })) });
  }catch(error){
    return serverError(error);
  }
};
