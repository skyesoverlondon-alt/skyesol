import { ensureSeed, forbidden, getUser, isAdmin, json, store } from "./_common.mjs";

export const handler = async (event, context) => {
  await ensureSeed();
  const user = getUser(context);
  if (!user) return forbidden("Missing Identity token");

  const admin = isAdmin(user);
  const scope = (event.queryStringParameters?.scope || "clients").toLowerCase();
  const allowAll = admin && scope === "all";

  const s = store();
  const idx = await s.getJSON("vault:index").catch(() => ({ docs: [] }));
  const docs = Array.isArray(idx?.docs) ? idx.docs : [];
  const filtered = allowAll ? docs : docs.filter((d) => (d.audience || "clients") === "clients");

  return json(200, { docs: filtered, updated_at: idx?.updated_at || null });
};
