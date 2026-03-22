import { requireAdmin } from "./_lib/admin.js";
import { audit } from "./_lib/audit.js";
import { hasConfiguredDb } from "./_lib/db.js";
import { buildCors, json } from "./_lib/http.js";
import { savePlatformState } from "./_lib/platform-state.js";
import { getSkymailSuiteState, saveSkymailSuiteState } from "./_lib/skymail-suite.js";
import { wrap } from "./_lib/wrap.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);
  if (!hasConfiguredDb()) {
    return json(503, {
      error: "Database not configured.",
      code: "DB_NOT_CONFIGURED",
      hint: "Set NEON_DATABASE_URL for dedicated SkyMail persistence."
    }, cors);
  }

  if (req.method === "GET") {
    const payload = await getSkymailSuiteState();
    return json(200, { ok: true, ...(payload || { state: null, summary: null, storage_mode: "dedicated-mail-tables" }) }, cors);
  }

  if (req.method === "PUT") {
    const body = await req.json().catch(() => ({}));
    if (!body || typeof body.state !== "object" || Array.isArray(body.state) || !body.state) {
      return json(400, { error: "Body must include a state object." }, cors);
    }

    const saved = await saveSkymailSuiteState(body.state, admin?.role || admin?.via || "admin");
    await savePlatformState("skymail-suite", saved?.state || body.state, admin?.role || admin?.via || "admin");
    await audit("admin", "skymail_suite.upsert", "skymail-suite", {
      storage_mode: saved?.storage_mode || "dedicated-mail-tables",
      summary: saved?.summary || {}
    });
    return json(200, { ok: true, ...saved }, cors);
  }

  return json(405, { error: "Method not allowed" }, cors);
});