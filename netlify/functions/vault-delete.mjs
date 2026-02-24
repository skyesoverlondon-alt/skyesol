import {
  badRequest,
  ensureSeed,
  forbidden,
  getUser,
  isAdmin,
  json,
  parseJsonBody,
  store,
} from "./_common.mjs";

export const handler = async (event, context) => {
  await ensureSeed();
  const user = getUser(context);
  if (!user) return forbidden("Missing Identity token");
  if (!isAdmin(user)) return forbidden("Not an admin");

  const body = parseJsonBody(event);
  const id = String(body?.id || "").trim();
  if (!id) return badRequest("Missing id");

  const s = store();
  await s.delete(`vault:doc:${id}`).catch(() => null);

  const idx = await s.getJSON("vault:index").catch(() => ({ docs: [] }));
  const docs = Array.isArray(idx?.docs) ? idx.docs : [];
  const next = docs.filter((d) => d.id !== id);
  await s.setJSON("vault:index", { updated_at: new Date().toISOString(), docs: next });

  return json(200, { ok: true });
};
