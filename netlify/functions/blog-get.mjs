import {
  badRequest,
  ensureSeed,
  forbidden,
  getUser,
  isAdmin,
  json,
  store,
} from "./_common.mjs";

export const handler = async (event, context) => {
  await ensureSeed();
  const s = store();

  const slug = (event.queryStringParameters?.slug || "").trim();
  if (!slug) return badRequest("Missing slug");

  const user = getUser(context);
  const admin = user && isAdmin(user);
  const scope = (event.queryStringParameters?.status || "published").toLowerCase();
  const allowDraft = admin && scope === "all";

  const post = await s.getJSON(`blog:post:${slug}`).catch(() => null);
  if (!post) return json(404, { error: "Not found" });

  const status = (post.status || "draft").toLowerCase();
  if (status !== "published" && !allowDraft) return forbidden("Not published");

  return json(200, { post });
};
