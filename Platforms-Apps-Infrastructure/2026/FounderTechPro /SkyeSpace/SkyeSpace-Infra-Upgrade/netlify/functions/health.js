const { ok, serverError } = require('./_shared/http');
const { query } = require('./_shared/db');

exports.handler = async function(){
  try{
    const result = await query('select now() as now, current_database() as db');
    return ok({ ok:true, live:true, service:'skyespace-infra', database: result.rows[0].db, now: result.rows[0].now });
  }catch(error){
    return serverError(error);
  }
};
