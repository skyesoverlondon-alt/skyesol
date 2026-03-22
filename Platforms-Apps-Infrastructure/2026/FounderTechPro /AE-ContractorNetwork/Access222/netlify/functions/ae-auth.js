const crypto = require("crypto");
function json(statusCode, obj, extraHeaders = {}) {
  return { statusCode, headers: Object.assign({ "Content-Type":"application/json", "Cache-Control":"no-store" }, extraHeaders), body: JSON.stringify(obj) };
}
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { ok:false, error:"Method not allowed" });
  const secret = process.env.AE_PASSPHRASE;
  const signingKey = process.env.AE_SIGNING_KEY;
  if (!secret || !signingKey) return json(500, { ok:false, error:"Server not configured" });
  let body={}; try{ body=JSON.parse(event.body||"{}"); }catch(e){}
  const passphrase = String(body.passphrase||"").trim();
  if(!passphrase) return json(400,{ok:false,error:"Missing passphrase"});
  if(passphrase !== secret) return json(401,{ok:false,error:"Invalid passphrase"});
  const now=Math.floor(Date.now()/1000);
  const exp=now+60*60*6;
  const payloadB64 = Buffer.from(JSON.stringify({v:1,iat:now,exp})).toString("base64url");
  const sig = crypto.createHmac("sha256", signingKey).update(payloadB64).digest("base64url");
  const token = `${payloadB64}.${sig}`;
  const cookie = [`AE_AUTH=${token}`,"Path=/","HttpOnly","Secure","SameSite=Strict",`Max-Age=${60*60*6}`].join("; ");
  return json(200,{ok:true,exp},{ "Set-Cookie": cookie });
};
