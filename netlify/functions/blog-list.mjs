import { ensureSeed, getUser, isAdmin, json, store } from "./_common.mjs";

export const handler = async (event, context) => {
  await ensureSeed();
  const s = store();

  const user = getUser(context);
  const admin = user && isAdmin(user);

  const statusParam = (event.queryStringParameters?.status || "published").toLowerCase();
  const includeAll = admin && statusParam === "all";

  const idx = await s.getJSON("blog:index").catch(() => ({ posts: [] }));
  const posts = Array.isArray(idx?.posts) ? idx.posts : [];
  const filtered = includeAll ? posts : posts.filter((p) => (p.status || "").toLowerCase() === "published");

  // Public responses can be cached briefly, but we keep it no-store to avoid stale during edits.
  return json(200, { posts: filtered, updated_at: idx?.updated_at || null });
};
