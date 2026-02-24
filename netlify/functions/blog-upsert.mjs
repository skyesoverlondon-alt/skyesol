import {
  badRequest,
  ensureSeed,
  forbidden,
  getUser,
  isAdmin,
  json,
  parseJsonBody,
  serverError,
  slugify,
  store,
} from "./_common.mjs";

export const handler = async (event, context) => {
  await ensureSeed();

  const user = getUser(context);
  if (!user) return forbidden("Missing Identity token");
  if (!isAdmin(user)) return forbidden("Not an admin");

  const body = parseJsonBody(event);
  const postIn = body?.post;
  if (!postIn) return badRequest("Missing post");

  const title = String(postIn.title || "").trim();
  const content = String(postIn.content_md || "").trim();
  if (!title) return badRequest("Title is required");
  if (!content) return badRequest("Body is required");

  const s = store();
  const slug = String(postIn.slug || "").trim() || slugify(title);
  const now = new Date().toISOString();

  const existing = await s.getJSON(`blog:post:${slug}`).catch(() => null);
  const created_at = existing?.created_at || now;

  const status = (String(postIn.status || "draft").toLowerCase() === "published") ? "published" : "draft";
  const published_at = status === "published" ? (existing?.published_at || now) : (existing?.published_at || null);

  const post = {
    slug,
    title,
    excerpt: String(postIn.excerpt || "").trim(),
    cover_image: postIn.cover_image ? String(postIn.cover_image).trim() : null,
    tags: Array.isArray(postIn.tags) ? postIn.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12) : [],
    status,
    author: String(postIn.author || existing?.author || user.email || "Skyes Over London LC").trim(),
    content_md: content,
    created_at,
    updated_at: now,
    published_at,
  };

  try {
    await s.setJSON(`blog:post:${slug}`, post);

    const idx = await s.getJSON("blog:index").catch(() => ({ posts: [] }));
    const posts = Array.isArray(idx?.posts) ? idx.posts : [];
    const next = posts.filter((p) => p.slug !== slug);
    next.push({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      cover_image: post.cover_image,
      tags: post.tags,
      status: post.status,
      published_at: post.published_at,
      updated_at: post.updated_at,
      author: post.author,
    });

    // Sort newest first (published_at fallback updated_at)
    next.sort((a, b) => new Date(b.published_at || b.updated_at || 0) - new Date(a.published_at || a.updated_at || 0));
    await s.setJSON("blog:index", { updated_at: now, posts: next });

    return json(200, { ok: true, slug });
  } catch (e) {
    return serverError("Failed to save post", String(e?.message || e));
  }
};
