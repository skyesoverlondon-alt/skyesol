function json(statusCode, obj, extraHeaders = {}) {
  return { statusCode, headers: Object.assign({ "Content-Type":"application/json", "Cache-Control":"no-store" }, extraHeaders), body: JSON.stringify(obj) };
}
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { ok:false, error:"Method not allowed" });
  const cookie = "AE_AUTH=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
  return json(200, { ok:true }, { "Set-Cookie": cookie });
};
