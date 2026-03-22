const { query } = require("./_db");
const { json, requireEnv } = require("./_utils");

/*
  Admin recovery export:
  - ONLY returns the stored admin-encrypted private key blob if recovery_enabled=true.
  - Requires ADMIN_RECOVERY_TOKEN.
  - This endpoint does NOT decrypt anything server-side.
  - Admin can decrypt the blob offline with ADMIN_RECOVERY_PRIVATE_KEY_PEM.
*/
exports.handler = async (event) => {
  try{
    const token = (event.headers && (event.headers["x-admin-token"] || event.headers["X-Admin-Token"])) ? String(event.headers["x-admin-token"] || event.headers["X-Admin-Token"]) : "";
    const need = requireEnv("ADMIN_RECOVERY_TOKEN");
    if(!token || token !== need) return json(401, { error: "Unauthorized" });

    const handle = (event.queryStringParameters && event.queryStringParameters.handle) ? String(event.queryStringParameters.handle).trim() : "";
    if(!handle) return json(400, { error: "handle required" });

    const res = await query(
      `select recovery_enabled, recovery_blob_json from users where lower(handle)=lower($1) limit 1`,
      [handle]
    );
    if(!res.rows.length) return json(404, { error: "User not found" });
    if(!res.rows[0].recovery_enabled) return json(403, { error: "Recovery not enabled for this user." });
    if(!res.rows[0].recovery_blob_json) return json(500, { error: "Recovery blob missing." });

    return json(200, { handle, recovery_blob_json: res.rows[0].recovery_blob_json });

  }catch(err){
    return json(500, { error: err.message || "Server error" });
  }
};
