// Netlify Identity event: login
// Keeps Skyesol Identity roles normalized and synced to the shared database.

import { normalizeIdentityRoles, upsertIdentityMember } from "./_lib/sol-identity.js";

function parseAllowlist() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const handler = async (event) => {
  let payload = null;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    payload = {};
  }
  const user = payload.user;
  if (!user) {
    return { statusCode: 200, body: JSON.stringify({}) };
  }

  const allow = parseAllowlist();
  const email = String(user.email || "").toLowerCase().trim();
  const shouldGrantPresident = allow.includes(email);

  const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
  const nextRoles = normalizeIdentityRoles([
    ...roles,
    shouldGrantPresident ? "president" : null,
  ]);

  await upsertIdentityMember({
    email,
    identityUserId: user.id || null,
    fullName: user.user_metadata?.full_name || user.user_metadata?.name || null,
    roles: nextRoles,
    status: "active",
    source: "identity-login",
    metadata: {
      last_login_event: "identity-login",
    },
    lastLoginAt: new Date().toISOString(),
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      ...user,
      app_metadata: {
        ...(user.app_metadata || {}),
        roles: nextRoles,
      },
    }),
  };
};
