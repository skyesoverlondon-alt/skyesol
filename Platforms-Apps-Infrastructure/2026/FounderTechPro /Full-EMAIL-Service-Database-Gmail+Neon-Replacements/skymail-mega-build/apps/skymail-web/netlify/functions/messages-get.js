const { query } = require("./_db");
const { json, verifyAuth } = require("./_utils");

exports.handler = async (event) => {
  try{
    const auth = verifyAuth(event);
    const userId = auth.sub;

    const id = (event.queryStringParameters && event.queryStringParameters.id) ? String(event.queryStringParameters.id).trim() : "";
    if(!id) return json(400, { error: "id required" });

    const res = await query(
      `select id, thread_id, from_name, from_email, key_version, encrypted_key_b64, iv_b64, ciphertext_b64, created_at, read_at
       from messages
       where id=$1 and user_id=$2
       limit 1`,
      [id, userId]
    );
    if(!res.rows.length) return json(404, { error: "Not found" });

    const ares = await query(
      `select id, filename, mime_type, size_bytes, encrypted_key_b64, iv_b64
       from attachments where message_id=$1 order by created_at asc`,
      [id]
    );

    return json(200, { ...res.rows[0], attachments: ares.rows });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
