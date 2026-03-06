// netlify/functions/blob-store-pack.js
// P13.1 — Optional: store generated ZIP/PDF server-side using Netlify Blobs.
// This endpoint is OPTIONAL and will only work in environments where `@netlify/blobs` is available.
//
// Env:
//  - BLOBS_STORE (optional; default "blkaz-packs")
//
// Payload (JSON):
//  {
//    key: "string",              // required
//    content_type: "application/zip" | "application/pdf",
//    data_base64: "....",        // required (base64 payload)
//    meta: { ... }               // optional metadata
//  }

function mkHeaders() {
  return {
    "content-type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type,authorization,x-kaixu-app,x-kaixu-build",
    "Access-Control-Allow-Methods": "POST,OPTIONS"
  };
}

function json(statusCode, body) {
  return { statusCode, headers: mkHeaders(), body: JSON.stringify(body) };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: mkHeaders(), body: "" };
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method Not Allowed" });

  let payload = {};
  try { payload = event.body ? JSON.parse(event.body) : {}; }
  catch { return json(400, { ok:false, error:"Invalid JSON body" }); }

  const key = String(payload.key || "").trim();
  const contentType = String(payload.content_type || "application/octet-stream");
  const b64 = String(payload.data_base64 || "");
  const meta = payload.meta || {};

  if (!key || !b64) return json(400, { ok:false, error:"Missing key or data_base64" });

  let getStore;
  try {
    ({ getStore } = await import("@netlify/blobs"));
  } catch (err) {
    return json(500, {
      ok: false,
      error: "Missing @netlify/blobs dependency. Deploy via Git/CLI where dependencies can be installed/bundled.",
      detail: String(err && err.message ? err.message : err)
    });
  }

  try {
    const storeName = process.env.BLOBS_STORE || "blkaz-packs";
    const store = getStore(storeName);

    const buf = Buffer.from(b64, "base64");
    await store.set(key, buf, { metadata: { contentType, ...meta } });

    return json(200, { ok:true, store: storeName, key, bytes: buf.length });
  } catch (err) {
    return json(500, { ok:false, error: String(err && err.message ? err.message : err) });
  }
}
