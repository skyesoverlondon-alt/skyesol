import { requireAdmin } from "./_lib/admin.js";
import { audit } from "./_lib/audit.js";
import { buildCors, json } from "./_lib/http.js";
import { deleteSkymailLaneItem, getSkymailLaneItems, upsertSkymailLaneItem } from "./_lib/skymail-suite.js";
import { wrap } from "./_lib/wrap.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);

  const url = new URL(req.url);
  const collection = String(url.searchParams.get("collection") || "").trim();
  if (!collection) return json(400, { error: "collection is required." }, cors);

  if (req.method === "GET") {
    const items = await getSkymailLaneItems(collection);
    return json(200, { ok: true, collection, items }, cors);
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    if (!body?.item || typeof body.item !== "object") return json(400, { error: "item object is required." }, cors);
    const saved = await upsertSkymailLaneItem(collection, body.item, admin?.role || admin?.via || "admin");
    await audit("admin", `skymail.item_upsert.${collection}`, body.item.id || null, { collection, item_id: body.item.id || null });
    return json(200, { ok: true, collection, ...saved }, cors);
  }

  if (req.method === "DELETE") {
    const body = await req.json().catch(() => ({}));
    const itemId = String(body?.item_id || body?.id || url.searchParams.get("item_id") || "").trim();
    if (!itemId) return json(400, { error: "item_id is required." }, cors);
    const deleted = await deleteSkymailLaneItem(collection, itemId, admin?.role || admin?.via || "admin");
    await audit("admin", `skymail.item_delete.${collection}`, itemId, { collection, item_id: itemId });
    return json(200, { ok: true, collection, ...deleted }, cors);
  }

  return json(405, { error: "Method not allowed" }, cors);
});