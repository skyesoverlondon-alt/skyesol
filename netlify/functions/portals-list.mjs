import { ensureSeed, getUser, isAdmin, json, store } from "./_common.mjs";

export const handler = async (event, context) => {
  await ensureSeed();
  const s = store();

  const user = getUser(context);
  const admin = user && isAdmin(user);
  const scope = (event.queryStringParameters?.scope || "public").toLowerCase();

  const data = await s.getJSON("portals:list").catch(() => ({ portals: [] }));
  const portals = Array.isArray(data?.portals) ? data.portals : [];

  const out = admin && scope === "all" ? portals : portals.filter((p) => !!p.public);
  return json(200, { portals: out, updated_at: data?.updated_at || null });
};
