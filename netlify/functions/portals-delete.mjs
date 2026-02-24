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
  const data = await s.getJSON("portals:list").catch(() => ({ portals: [] }));
  const portals = Array.isArray(data?.portals) ? data.portals : [];
  const next = portals.filter((p) => p.id !== id);
  await s.setJSON("portals:list", { updated_at: new Date().toISOString(), portals: next });

  return json(200, { ok: true });
};
