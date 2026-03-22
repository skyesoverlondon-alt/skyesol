import { wrap } from "./_lib/wrap.js";
import { buildCors, json } from "./_lib/http.js";
import { requireAdmin } from "./_lib/admin.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);

  return json(200, { ok: true, role: "admin" }, cors);
});