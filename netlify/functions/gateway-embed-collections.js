import { getStore } from "@netlify/blobs";
import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest, getBearer } from "./_lib/http.js";
import { resolveAuth } from "./_lib/authz.js";

const STORE_NAME = process.env.KAIXU_EMBED_COLLECTION_STORE || "kaixu-embed-collections";

function normalizeName(name) {
  return String(name || "").trim().replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const token = getBearer(req);
  if (!token) return json(401, { error: "Missing Authorization: Bearer <virtual_key>" }, cors);
  const keyRow = await resolveAuth(token);
  if (!keyRow) return json(401, { error: "Invalid or revoked key" }, cors);

  const url = new URL(req.url);
  const name = normalizeName(url.searchParams.get("name") || "");
  const store = getStore(STORE_NAME);
  const prefix = `${keyRow.customer_id}/`;

  if (req.method === "GET") {
    if (name) {
      const key = `${prefix}${name}.json`;
      const value = await store.get(key, { type: "json" }).catch(() => null);
      if (!value) return json(404, { error: "Collection not found", name }, cors);
      return json(200, { ok: true, collection: value }, cors);
    }

    const listed = await store.list({ prefix }).catch(() => ({ blobs: [] }));
    const collections = (listed.blobs || []).map((b) => {
      const raw = String(b.key || "").replace(prefix, "");
      return raw.replace(/\.json$/i, "");
    }).filter(Boolean);

    return json(200, { ok: true, collections }, cors);
  }

  if (req.method === "DELETE") {
    if (!name) return badRequest("Missing collection name (?name=...)", cors);
    const key = `${prefix}${name}.json`;
    await store.delete(key);
    return json(200, { ok: true, deleted: name }, cors);
  }

  return json(405, { error: "Method not allowed" }, cors);
});
