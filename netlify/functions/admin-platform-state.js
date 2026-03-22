import { requireAdmin } from "./_lib/admin.js";
import { audit } from "./_lib/audit.js";
import { hasConfiguredDb } from "./_lib/db.js";
import { buildCors, json } from "./_lib/http.js";
import { deletePlatformState, getPlatformState, PLATFORM_APPS, savePlatformState } from "./_lib/platform-state.js";
import { wrap } from "./_lib/wrap.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);

  const url = new URL(req.url);
  const appId = (url.searchParams.get("app_id") || "").trim();
  if (!appId || !PLATFORM_APPS[appId]) {
    return json(400, { error: "Known app_id is required." }, cors);
  }

  if (!hasConfiguredDb()) {
    return json(503, {
      error: "Database not configured.",
      code: "DB_NOT_CONFIGURED",
      hint: "Set NEON_DATABASE_URL for shared platform state persistence."
    }, cors);
  }

  if (req.method === "GET") {
    const platform = await getPlatformState(appId);
    return json(200, { ok: true, app: PLATFORM_APPS[appId], state: platform?.state || null, platform }, cors);
  }

  if (req.method === "PUT") {
    const body = await req.json().catch(() => ({}));
    if (!body || typeof body.state !== "object" || Array.isArray(body.state) || !body.state) {
      return json(400, { error: "Body must include a state object." }, cors);
    }

    const saved = await savePlatformState(appId, body.state, admin?.role || admin?.via || "admin");
    await audit("admin", "platform_state.upsert", appId, {
      app_id: appId,
      summary: saved?.summary || {},
      visibility: saved?.visibility || "admin"
    });
    return json(200, { ok: true, platform: saved }, cors);
  }

  if (req.method === "DELETE") {
    const deleted = await deletePlatformState(appId);
    await audit("admin", "platform_state.delete", appId, { app_id: appId });
    return json(200, { ok: true, ...deleted }, cors);
  }

  return json(405, { error: "Method not allowed" }, cors);
});