import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest, getBearer } from "./_lib/http.js";
import { lookupKey, requireKeyRole } from "./_lib/authz.js";
import { audit } from "./_lib/audit.js";
import { setNetlifyTokenForCustomer, clearNetlifyTokenForCustomer, getNetlifyTokenForCustomer } from "./_lib/netlifyTokens.js";

const NETLIFY_API = "https://api.netlify.com/api/v1";

async function netlifyWhoAmI(token) {
  const res = await fetch(`${NETLIFY_API}/user`, {
    method: "GET",
    headers: { authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const key = getBearer(req);
  if (!key) return json(401, { error: "Missing Authorization Bearer Kaixu Key" }, cors);

  const krow = await lookupKey(key);
  if (!krow) return json(401, { error: "Invalid Kaixu Key" }, cors);

  if (req.method === "GET") {
    requireKeyRole(krow, "viewer");

    const token = await getNetlifyTokenForCustomer(krow.customer_id);
    const connected = !!token;

    let whoami = null;
    if (connected && (krow.role === "admin" || krow.role === "owner")) {
      try {
        whoami = await netlifyWhoAmI(token);
      } catch {
        whoami = null;
      }
    }

    return json(200, {
      ok: true,
      connected,
      whoami
    }, cors);
  }

  if (req.method === "POST") {
    requireKeyRole(krow, "admin");

    let body;
    try { body = await req.json(); } catch { return badRequest("Invalid JSON", cors); }

    const token = (body.token || "").toString().trim();
    if (!token) return badRequest("Missing token", cors);

    await setNetlifyTokenForCustomer(krow.customer_id, token);

    await audit(`key:${krow.key_last4}`, "NETLIFY_TOKEN_SET", `customer:${krow.customer_id}`);

    return json(200, { ok: true }, cors);
  }

  if (req.method === "DELETE") {
    requireKeyRole(krow, "admin");

    await clearNetlifyTokenForCustomer(krow.customer_id);

    await audit(`key:${krow.key_last4}`, "NETLIFY_TOKEN_CLEAR", `customer:${krow.customer_id}`);

    return json(200, { ok: true }, cors);
  }

  return json(405, { error: "Method not allowed" }, cors);
});
