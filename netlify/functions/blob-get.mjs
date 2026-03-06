
import { getStore } from "@netlify/blobs";

export default async function handler(req) {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response("", { status: 204 });
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const key = url.searchParams.get("key");
  if (!key) return new Response("key required", { status: 400 });

  const store = getStore("kaixu-artifacts");
  const entry = await store.getWithMetadata(key, { type: "stream", consistency: "strong" });
  if (!entry) return new Response("Not found", { status: 404 });

  const data = entry.data;
  const md = entry.metadata || {};
  const ct = md.contentType || (String(key).endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
  const name = md.filename || "download";

  return new Response(data, {
    status: 200,
    headers: { "content-type": ct, "content-disposition": `inline; filename="${name}"` }
  });
}
