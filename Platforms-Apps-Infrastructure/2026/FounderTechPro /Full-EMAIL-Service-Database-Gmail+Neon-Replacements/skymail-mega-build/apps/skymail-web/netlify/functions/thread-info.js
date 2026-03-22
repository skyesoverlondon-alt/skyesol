const { query } = require("./_db");
const { json } = require("./_utils");

exports.handler = async (event) => {
  try{
    const token = (event.queryStringParameters && event.queryStringParameters.token) ? String(event.queryStringParameters.token).trim() : "";
    if(!token) return json(400, { error: "token required" });

    const res = await query(
      `select t.id as thread_id, t.from_name, t.from_email, t.created_at, t.last_activity_at,
              u.handle, uk.version as active_version, uk.rsa_public_key_pem
       from threads t
       join users u on u.id=t.user_id
       join user_keys uk on uk.user_id=u.id and uk.is_active=true
       where t.token=$1
       limit 1`,
      [token]
    );
    if(!res.rows.length) return json(404, { error: "Thread not found" });

    const row = res.rows[0];
    return json(200, {
      handle: row.handle,
      from_name: row.from_name,
      from_email: row.from_email,
      created_at: row.created_at,
      last_activity_at: row.last_activity_at,
      recipient_key: { version: row.active_version, rsa_public_key_pem: row.rsa_public_key_pem }
    });

  }catch(err){
    return json(500, { error: err.message || "Server error" });
  }
};
