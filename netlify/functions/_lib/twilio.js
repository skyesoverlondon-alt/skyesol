import crypto from "crypto";

function b64(str) {
  return Buffer.from(str, "utf8").toString("base64");
}

/**
 * Validate X-Twilio-Signature.
 * Twilio signature = base64(HMAC-SHA1(auth_token, url + concat(sorted(params))))
 *
 * Notes:
 * - url must be the full URL Twilio used to make the request (including querystring if present).
 * - params are POST form params OR query params depending on method.
 */
export function computeTwilioSignature({ url, params, authToken }) {
  const keys = Object.keys(params || {}).sort();
  let data = url;
  for (const k of keys) data += k + (params[k] ?? "");
  const h = crypto.createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  return h;
}

export function timingSafeEqual(a, b) {
  const aa = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function validateTwilioRequest({ req, url, params }) {
  const auth = (process.env.TWILIO_AUTH_TOKEN || "").toString();
  if (!auth) return { ok: false, status: 500, error: "Missing TWILIO_AUTH_TOKEN" };

  const sig = req.headers.get("x-twilio-signature") || req.headers.get("X-Twilio-Signature") || "";
  if (!sig) return { ok: false, status: 401, error: "Missing X-Twilio-Signature" };

  const expected = computeTwilioSignature({ url, params, authToken: auth });
  const ok = timingSafeEqual(sig, expected);
  if (!ok) return { ok: false, status: 401, error: "Invalid Twilio signature" };
  return { ok: true };
}

export function twiml(xmlBody) {
  return new Response(xmlBody, {
    status: 200,
    headers: {
      "content-type": "text/xml; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function sayGatherTwiml({ say, actionUrl, language = "en-US", voice = "alice", hints = null, timeout = 3 }) {
  const sayText = escapeXml(say || "");
  const action = escapeXml(actionUrl);
  const hintAttr = hints ? ` speechHints="${escapeXml(hints)}"` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${action}" method="POST" timeout="${timeout}" speechTimeout="auto" language="${escapeXml(language)}"${hintAttr}>
    <Say voice="${escapeXml(voice)}">${sayText}</Say>
  </Gather>
  <Say voice="${escapeXml(voice)}">I didn't catch that. Please say that again.</Say>
  <Redirect method="POST">${action}</Redirect>
</Response>`;
}

export function hangupTwiml({ say, voice = "alice", language = "en-US" }) {
  const sayText = escapeXml(say || "Goodbye.");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeXml(voice)}" language="${escapeXml(language)}">${sayText}</Say>
  <Hangup/>
</Response>`;
}

export function dialTwiml({ say, dialNumber, voice = "alice", language = "en-US" }) {
  const sayText = escapeXml(say || "One moment while I connect you.");
  const num = escapeXml(dialNumber);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeXml(voice)}" language="${escapeXml(language)}">${sayText}</Say>
  <Dial>${num}</Dial>
</Response>`;
}
