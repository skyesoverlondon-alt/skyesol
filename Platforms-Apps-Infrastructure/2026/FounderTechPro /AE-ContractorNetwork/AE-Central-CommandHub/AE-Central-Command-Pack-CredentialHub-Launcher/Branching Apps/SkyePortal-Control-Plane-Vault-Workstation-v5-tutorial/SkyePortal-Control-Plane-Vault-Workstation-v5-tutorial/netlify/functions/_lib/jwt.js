import crypto from "crypto";
import { base64urlEncode, base64urlDecode } from "./utils.js";

export function signHS256(payload, secret, ttlSeconds = 300, extra = {}) {
  const header = { alg: "HS256", typ: "JWT" };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSeconds;
  const body = { ...payload, iat, exp, ...extra };

  const headB64 = base64urlEncode(Buffer.from(JSON.stringify(header)));
  const bodyB64 = base64urlEncode(Buffer.from(JSON.stringify(body)));
  const data = `${headB64}.${bodyB64}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest();
  const sigB64 = base64urlEncode(sig);
  return { token: `${data}.${sigB64}`, exp };
}

export function verifyHS256(token, secret) {
  if (!token || token.split(".").length !== 3) return { ok: false, error: "bad_token" };
  const [h, p, s] = token.split(".");
  const data = `${h}.${p}`;
  const expected = base64urlEncode(crypto.createHmac("sha256", secret).update(data).digest());
  if (!timingSafeEqual(expected, s)) return { ok: false, error: "bad_signature" };
  const payload = JSON.parse(base64urlDecode(p).toString("utf-8"));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return { ok: false, error: "expired" };
  return { ok: true, payload };
}

function timingSafeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
