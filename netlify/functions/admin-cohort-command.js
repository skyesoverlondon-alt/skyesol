import { requireAdmin } from "./_lib/admin.js";
import { audit } from "./_lib/audit.js";
import { buildCors, json } from "./_lib/http.js";
import { getCohortCommandState, saveFounderCohortConfig } from "./_lib/cohort-command.js";
import { wrap } from "./_lib/wrap.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);

  if (req.method === "GET") {
    const doc = await getCohortCommandState();
    return json(200, { ok: true, state: doc?.state || null, platform: doc || null }, cors);
  }

  if (req.method === "PUT") {
    const body = await req.json().catch(() => ({}));
    const saved = await saveFounderCohortConfig(body || {}, admin?.role || admin?.via || "admin");
    await audit("admin", "cohort.config_upsert", "cohort-command", {
      sections: Object.keys(body || {}),
      generated_preview_id: saved?.state?.generatedPreviewId || ""
    });
    return json(200, { ok: true, state: saved?.state || null, platform: saved || null }, cors);
  }

  return json(405, { error: "Method not allowed" }, cors);
});