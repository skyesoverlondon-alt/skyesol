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
  const slug = String(body?.slug || "").trim();
  if (!slug) return badRequest("Missing slug");

  const s = store();
  await s.delete(`blog:post:${slug}`).catch(() => null);
  const idx = await s.getJSON("blog:index").catch(() => ({ posts: [] }));
  const posts = Array.isArray(idx?.posts) ? idx.posts : [];
  const next = posts.filter((p) => p.slug !== slug);
  await s.setJSON("blog:index", { updated_at: new Date().toISOString(), posts: next });

  return json(200, { ok: true });
};
