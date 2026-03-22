const { query } = require("./_db");
const { json } = require("./_utils");

exports.handler = async (event) => {
  try{
    const handle = (event.queryStringParameters && event.queryStringParameters.handle) ? String(event.queryStringParameters.handle).trim() : "";
    if(!handle) return json(400, { error: "handle required" });

    const ures = await query(
      `select id from users where lower(handle)=lower($1) limit 1`,
      [handle]
    );
    if(!ures.rows.length) return json(404, { error: "Recipient not found." });

    const userId = ures.rows[0].id;

    const kres = await query(
      `select version, rsa_public_key_pem from user_keys where user_id=$1 and is_active=true limit 1`,
      [userId]
    );
    if(!kres.rows.length) return json(500, { error: "Recipient key missing." });

    return json(200, { version: kres.rows[0].version, rsa_public_key_pem: kres.rows[0].rsa_public_key_pem });
  }catch(err){
    return json(500, { error: err.message || "Server error" });
  }
};
