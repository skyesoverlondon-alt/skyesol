const { query } = require("./_db");
const { json, verifyAuth, parseJson } = require("./_utils");

exports.handler = async (event) => {
  try{
    const auth = verifyAuth(event);
    const userId = auth.sub;
    const body = parseJson(event);

    const rsa_public_key_pem = body.rsa_public_key_pem;
    const vault_wrap_json = body.vault_wrap_json;

    if(!rsa_public_key_pem || !rsa_public_key_pem.includes("BEGIN PUBLIC KEY")) return json(400, { error: "rsa_public_key_pem required (PEM)." });
    if(!vault_wrap_json) return json(400, { error: "vault_wrap_json required." });

    const cur = await query(
      `select coalesce(max(version),0) as maxv from user_keys where user_id=$1`,
      [userId]
    );
    const nextV = Number(cur.rows[0].maxv) + 1;

    await query(`update user_keys set is_active=false where user_id=$1`, [userId]);
    await query(
      `insert into user_keys(user_id, version, is_active, rsa_public_key_pem, vault_wrap_json)
       values($1,$2,true,$3,$4)`,
      [userId, nextV, rsa_public_key_pem, vault_wrap_json]
    );

    return json(200, { ok:true, active_version: nextV });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
