const { query } = require("./_db");
const { json, verifyAuth } = require("./_utils");

exports.handler = async (event) => {
  try{
    const auth = verifyAuth(event);
    const userId = auth.sub;

    const id = (event.queryStringParameters && event.queryStringParameters.id) ? String(event.queryStringParameters.id).trim() : "";
    if(!id) return json(400, { error: "id required" });

    const res = await query(
      `select a.id, a.filename, a.mime_type, a.size_bytes, a.encrypted_key_b64, a.iv_b64,
              encode(a.ciphertext,'base64') as ciphertext_b64,
              m.user_id
       from attachments a
       join messages m on m.id=a.message_id
       where a.id=$1
       limit 1`,
      [id]
    );
    if(!res.rows.length) return json(404, { error: "Not found" });
    if(res.rows[0].user_id !== userId) return json(403, { error: "Forbidden" });

    const row = res.rows[0];
    return json(200, {
      id: row.id,
      filename: row.filename,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      encrypted_key_b64: row.encrypted_key_b64,
      iv_b64: row.iv_b64,
      ciphertext_b64: row.ciphertext_b64
    });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
