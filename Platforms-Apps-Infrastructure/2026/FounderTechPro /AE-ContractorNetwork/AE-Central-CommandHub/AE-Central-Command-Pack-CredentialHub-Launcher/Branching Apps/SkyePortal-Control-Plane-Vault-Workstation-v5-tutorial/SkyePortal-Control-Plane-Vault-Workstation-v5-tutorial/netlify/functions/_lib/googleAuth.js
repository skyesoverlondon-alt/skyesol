import crypto from "crypto";
import { base64urlEncode } from "./utils.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function getAccessTokenFromServiceAccount(saJson, scopes) {
  const sa = JSON.parse(saJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };

  const claim = {
    iss: sa.client_email,
    scope: Array.isArray(scopes) ? scopes.join(" ") : scopes,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  };

  const unsigned = `${base64urlEncode(Buffer.from(JSON.stringify(header)))}.${base64urlEncode(Buffer.from(JSON.stringify(claim)))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(sa.private_key);
  const jwt = `${unsigned}.${base64urlEncode(signature)}`;

  const form = new URLSearchParams();
  form.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  form.set("assertion", jwt);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error_description || data?.error || "token_error";
    throw new Error(msg);
  }
  return { access_token: data.access_token, expires_in: data.expires_in };
}
