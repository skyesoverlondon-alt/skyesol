const { query } = require("./_db");
const { json, verifyAuth, parseJson } = require("./_utils");

exports.handler = async (event) => {
  try{
    const auth = verifyAuth(event);
    const userId = auth.sub;

    const body = parseJson(event);
    const id = (body.id || "").trim();
    if(!id) return json(400, { error: "id required" });

    await query(`delete from messages where id=$1 and user_id=$2`, [id, userId]);
    return json(200, { ok:true });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
