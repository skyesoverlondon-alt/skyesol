const { query } = require("./_db");
const { json, verifyAuth, parseJson } = require("./_utils");

exports.handler = async (event) => {
  try{
    const auth = verifyAuth(event);
    const userId = auth.sub;
    const body = parseJson(event);

    if(!body || body.schema !== "SMV_VAULT_PACK_V1") return json(400, { error: "Invalid vault pack schema." });
    if(!Array.isArray(body.keys) || !body.keys.length) return json(400, { error: "Vault pack keys required." });

    await query(`delete from user_keys where user_id=$1`, [userId]);

    for(const k of body.keys){
      if(!k.rsa_public_key_pem || !String(k.rsa_public_key_pem).includes("BEGIN PUBLIC KEY")) return json(400, { error: "Invalid rsa_public_key_pem in pack." });
      if(!k.vault_wrap_json) return json(400, { error: "Invalid vault_wrap_json in pack." });
      const version = Number(k.version);
      const is_active = !!k.is_active;
      if(!Number.isFinite(version) || version < 1) return json(400, { error: "Invalid key version in pack." });

      await query(
        `insert into user_keys(user_id, version, is_active, rsa_public_key_pem, vault_wrap_json)
         values($1,$2,$3,$4,$5)`,
        [userId, version, is_active, k.rsa_public_key_pem, k.vault_wrap_json]
      );
    }

    const activeV = Number(body.active_version || 0);
    if(activeV > 0){
      await query(`update user_keys set is_active=(version=$2) where user_id=$1`, [userId, activeV]);
    }else{
      const cur = await query(`select max(version) as v from user_keys where user_id=$1`, [userId]);
      const v = Number(cur.rows[0].v || 1);
      await query(`update user_keys set is_active=(version=$2) where user_id=$1`, [userId, v]);
    }

    return json(200, { ok:true });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
