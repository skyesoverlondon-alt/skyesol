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

function normalizeUrl(u) {
  try {
    const url = new URL(u);
    return url.toString();
  } catch {
    return null;
  }
}

export const handler = async (event, context) => {
  await ensureSeed();

  const user = getUser(context);
  if (!user) return forbidden("Missing Identity token");
  if (!isAdmin(user)) return forbidden("Not an admin");

  const body = parseJsonBody(event);
  const pIn = body?.portal;
  if (!pIn) return badRequest("Missing portal");

  const name = String(pIn.name || "").trim();
  const urlRaw = String(pIn.url || "").trim();
  const url = normalizeUrl(urlRaw);
  if (!name) return badRequest("Name is required");
  if (!url) return badRequest("Valid URL is required");

  const id = String(pIn.id || "").trim() || slugify(name);
  const path = String(pIn.path || "/").trim() || "/";
  const now = new Date().toISOString();

  const portal = {
    id,
    name,
    url,
    path: path.startsWith("/") ? path : `/${path}`,
    category: pIn.category ? String(pIn.category).trim() : null,
    public: !!pIn.public,
    notes: pIn.notes ? String(pIn.notes).trim() : null,
    updated_at: now,
  };

  const s = store();
  const data = await s.getJSON("portals:list").catch(() => ({ portals: [] }));
  const portals = Array.isArray(data?.portals) ? data.portals : [];
  const next = portals.filter((x) => x.id !== id);
  next.push(portal);
  next.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  await s.setJSON("portals:list", { updated_at: now, portals: next });

  return json(200, { ok: true, id });
};
