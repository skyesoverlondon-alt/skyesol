import { wrap } from "./_lib/wrap.js";
import { buildCors, json } from "./_lib/http.js";
import { q } from "./_lib/db.js";
import { ensureSkyespaceSchema, requireSkyespaceAuth } from "./_lib/skyespace.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  await ensureSkyespaceSchema();
  await requireSkyespaceAuth(req);

  const [profiles, districts, posts, listings, signals, conversations, messages] = await Promise.all([
    q("select count(*)::int as count from skyespace_profiles"),
    q("select count(*)::int as count from skyespace_districts"),
    q("select count(*)::int as count from skyespace_posts"),
    q("select count(*)::int as count from skyespace_listings"),
    q("select count(*)::int as count from skyespace_signals"),
    q("select count(*)::int as count from skyespace_conversations"),
    q("select count(*)::int as count from skyespace_messages")
  ]);

  return json(200, {
    ok: true,
    metrics: {
      profiles: profiles.rows[0].count,
      districts: districts.rows[0].count,
      posts: posts.rows[0].count,
      listings: listings.rows[0].count,
      signals: signals.rows[0].count,
      conversations: conversations.rows[0].count,
      messages: messages.rows[0].count
    }
  }, cors);
});