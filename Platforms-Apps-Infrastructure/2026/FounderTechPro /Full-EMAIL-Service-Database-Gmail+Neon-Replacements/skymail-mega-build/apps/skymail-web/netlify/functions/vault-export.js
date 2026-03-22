const { query } = require("./_db");
const { json, verifyAuth } = require("./_utils");

exports.handler = async (event) => {
  try{
    const auth = verifyAuth(event);
    const userId = auth.sub;

    const ures = await query(`select handle, email, recovery_enabled, created_at from users where id=$1 limit 1`, [userId]);
    if(!ures.rows.length) return json(401, { error: "Unauthorized" });

    const kres = await query(
      `select version, is_active, rsa_public_key_pem, vault_wrap_json, created_at
       from user_keys where user_id=$1 order by version asc`,
      [userId]
    );

    const active = kres.rows.find(k => k.is_active) || null;

    return json(200, {
      schema: "SMV_VAULT_PACK_V1",
      exported_at: new Date().toISOString(),
      user: {
        handle: ures.rows[0].handle,
        email: ures.rows[0].email,
        created_at: ures.rows[0].created_at,
        recovery_enabled: ures.rows[0].recovery_enabled
      },
      keys: kres.rows.map(k => ({
        version: k.version,
        is_active: k.is_active,
        rsa_public_key_pem: k.rsa_public_key_pem,
        vault_wrap_json: k.vault_wrap_json,
        created_at: k.created_at
      })),
      active_version: active ? active.version : null
    });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
