const crypto = require("crypto");
function json(statusCode, obj){ return { statusCode, headers:{ "Content-Type":"application/json", "Cache-Control":"no-store" }, body: JSON.stringify(obj) }; }
function getCookie(h, name){
  if(!h) return null;
  const parts = h.split(";").map(s=>s.trim());
  for(const p of parts){ if(p.startsWith(name+"=")) return p.slice(name.length+1); }
  return null;
}
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { ok:false, error:"Method not allowed" });
  const signingKey = process.env.AE_SIGNING_KEY;
  if (!signingKey) return json(500, { ok:false, error:"Server not configured" });
  const token = getCookie(event.headers.cookie || event.headers.Cookie, "AE_AUTH");
  if(!token || !token.includes(".")) return json(401,{ok:false,error:"Not authenticated"});
  const [payloadB64, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", signingKey).update(payloadB64).digest("base64url");
  if(sig !== expected) return json(401,{ok:false,error:"Bad signature"});
  let payload=null; try{ payload=JSON.parse(Buffer.from(payloadB64,"base64url").toString("utf8")); }catch(e){}
  if(!payload || !payload.exp) return json(401,{ok:false,error:"Bad token"});
  if(Math.floor(Date.now()/1000) >= payload.exp) return json(401,{ok:false,error:"Expired"});
  return json(200,{ok:true, exp: payload.exp});
};
