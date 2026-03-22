const { query } = require("./_db");
const { json, verifyAuth } = require("./_utils");

exports.handler = async (event) => {
  try{
    const auth = verifyAuth(event);
    const userId = auth.sub;

    const res = await query(
      `select id, thread_id, from_name, from_email, key_version, created_at, read_at
       from messages
       where user_id=$1
       order by created_at desc
       limit 200`,
      [userId]
    );

    return json(200, { items: res.rows });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
