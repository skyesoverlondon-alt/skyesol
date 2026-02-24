import {
  badRequest,
  ensureSeed,
  forbidden,
  getUser,
  isAdmin,
  json,
  parseJsonBody,
  slugify,
  store,
} from "./_common.mjs";

export const handler = async (event, context) => {
  await ensureSeed();
  const user = getUser(context);
  if (!user) return forbidden("Missing Identity token");
  if (!isAdmin(user)) return forbidden("Not an admin");

  const body = parseJsonBody(event);
  const dIn = body?.doc;
  if (!dIn) return badRequest("Missing doc");

  const title = String(dIn.title || "").trim();
  const content = String(dIn.content_md || "").trim();
  if (!title) return badRequest("Title is required");
  if (!content) return badRequest("Body is required");

  const id = String(dIn.id || "").trim() || slugify(title);
  const now = new Date().toISOString();
  const s = store();

  const existing = await s.getJSON(`vault:doc:${id}`).catch(() => null);
  const created_at = existing?.created_at || now;

  const audience = (String(dIn.audience || "clients").toLowerCase() === "internal") ? "internal" : "clients";
  const doc = {
    id,
    title,
    audience,
    tags: Array.isArray(dIn.tags) ? dIn.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12) : [],
    content_md: content,
    created_at,
    updated_at: now,
  };

  await s.setJSON(`vault:doc:${id}`, doc);

  const idx = await s.getJSON("vault:index").catch(() => ({ docs: [] }));
  const docs = Array.isArray(idx?.docs) ? idx.docs : [];
  const next = docs.filter((x) => x.id !== id);
  next.push({ id: doc.id, title: doc.title, audience: doc.audience, tags: doc.tags });
  next.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  await s.setJSON("vault:index", { updated_at: now, docs: next });

  return json(200, { ok: true, id });
};
