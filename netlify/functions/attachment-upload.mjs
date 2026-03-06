
import { getStore } from "@netlify/blobs";

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

function makeKey(prefix="upload", name="file") {
  const rand = Math.random().toString(16).slice(2,10).toUpperCase();
  const t = Date.now().toString(16).toUpperCase().slice(-6);
  const safe = String(name).replace(/[^a-z0-9\.\-_]/gi, "_");
  return `${prefix}/${t}-${rand}-${safe}`;
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response("", { status: 204 });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: "Expected multipart/form-data" }, 400);

  const file = form.get("file");
  if (!file) return json({ error: "file required" }, 400);

  const workspace_id = String(form.get("workspace_id") || "default");
  const tool_id = String(form.get("tool_id") || "unknown");

  const store = getStore("kaixu-artifacts");
  const key = makeKey("upload", file.name || "file");

  await store.set(key, file, {
    metadata: { kind: "upload", filename: file.name || "file", contentType: file.type || "application/octet-stream", workspace_id, tool_id }
  });

  return json({ ok: true, key, name: file.name || "file", type: file.type || "", size: file.size || 0 });
}
