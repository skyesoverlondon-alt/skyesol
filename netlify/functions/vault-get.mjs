import { badRequest, ensureSeed, forbidden, getUser, isAdmin, json, store } from "./_common.mjs";

export const handler = async (event, context) => {
  await ensureSeed();
  const user = getUser(context);
  if (!user) return forbidden("Missing Identity token");

  const id = String(event.queryStringParameters?.id || "").trim();
  if (!id) return badRequest("Missing id");

  const admin = isAdmin(user);
  const scope = (event.queryStringParameters?.scope || "clients").toLowerCase();
  const allowAll = admin && scope === "all";

  const s = store();
  const doc = await s.getJSON(`vault:doc:${id}`).catch(() => null);
  if (!doc) return json(404, { error: "Not found" });

  if (!allowAll && (doc.audience || "clients") !== "clients") return forbidden("Not allowed");
  return json(200, { doc });
};
