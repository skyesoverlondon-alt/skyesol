import { unauthorized, forbidden } from "./resp.mjs";

function parseAllowlist(value) {
  return String(value || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

async function verifyGateSession(bearer) {
  const gateBase = String(process.env.OMEGA_GATE_URL || "https://0megaskyegate.skyesoverlondon.workers.dev").trim().replace(/\/+$/, "");
  const response = await fetch(`${gateBase}/v1/auth/me`, {
    method: "GET",
    headers: { authorization: `Bearer ${bearer}` }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok || !payload?.session) {
    return null;
  }
  return payload.session;
}

export async function requireAdmin(context, request) {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const gateAdminAllowlist = parseAllowlist(process.env.GATE_ADMIN_APP_IDS);

  if (bearer) {
    const session = await verifyGateSession(bearer).catch(() => null);
    if (session) {
      const appId = String(session.app_id || "").toLowerCase();
      if (session.auth_mode === "founder-gateway" || (appId && gateAdminAllowlist.includes(appId))) {
        return { mode: "identity", actor: session.app_id || "gate-admin" };
      }
      throw forbidden("Gate session is not authorized for admin access");
    }
  }

  throw unauthorized("Missing or invalid gate admin authorization");
}