
import { getStore } from "@netlify/blobs";

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

function makeKey(prefix="pdf", name="artifact.pdf") {
  const rand = Math.random().toString(16).slice(2,10).toUpperCase();
  const t = Date.now().toString(16).toUpperCase().slice(-6);
  const safe = String(name).replace(/[^a-z0-9\.\-_]/gi, "_");
  return `${prefix}/${t}-${rand}-${safe}`;
}

function dataUrlToArrayBuffer(dataUrl) {
  const m = String(dataUrl || "").match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return { type: "application/octet-stream", buf: null };
  const type = m[1];
  const bin = Buffer.from(m[2], "base64");
  const ab = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
  return { type, buf: ab };
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response("", { status: 204 });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const payload = await req.json().catch(() => null);
  if (!payload) return json({ error: "Invalid JSON" }, 400);

  const dataUrl = payload.dataUrl;
  const filename = String(payload.filename || "artifact.pdf");
  const meta = payload.meta || {};
  if (!dataUrl) return json({ error: "dataUrl required" }, 400);

  const store = getStore("kaixu-artifacts");
  const key = makeKey("pdf", filename);
  const { type, buf } = dataUrlToArrayBuffer(dataUrl);
  if (!buf) return json({ error: "Invalid dataUrl" }, 400);

  await store.set(key, buf, { metadata: { ...meta, filename, contentType: type, kind: "pdf" } });
  return json({ ok: true, key, name: filename, type });
}
