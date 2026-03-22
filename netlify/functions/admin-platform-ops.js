import { requireAdmin } from "./_lib/admin.js";
import { audit } from "./_lib/audit.js";
import { buildCors, json } from "./_lib/http.js";
import { PLATFORM_APPS } from "./_lib/platform-state.js";
import { listPlatformOpsStatus, savePlatformOpsStatus } from "./_lib/platform-ops.js";
import { wrap } from "./_lib/wrap.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);

  const url = new URL(req.url);
  const appId = String(url.searchParams.get("app_id") || "").trim();

  if (req.method === "GET") {
    const opsMap = await listPlatformOpsStatus(appId ? [appId] : Object.keys(PLATFORM_APPS));
    return json(200, {
      ok: true,
      platform_ops: appId ? (opsMap.get(appId) || null) : Object.fromEntries(opsMap.entries())
    }, cors);
  }

  if (req.method === "PUT") {
    const body = await req.json().catch(() => ({}));
    const targetAppId = String(body?.app_id || appId || "").trim();
    if (!targetAppId || !PLATFORM_APPS[targetAppId]) {
      return json(400, { error: "Known app_id is required." }, cors);
    }

    const saved = await savePlatformOpsStatus(targetAppId, body, admin?.role || admin?.via || "admin");
    await audit("admin", "platform_ops.upsert", targetAppId, saved);
    return json(200, { ok: true, platform_ops: saved }, cors);
  }

  return json(405, { error: "Method not allowed" }, cors);
});