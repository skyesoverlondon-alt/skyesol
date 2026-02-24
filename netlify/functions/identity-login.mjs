// Netlify Identity event: login
// Assigns admin role automatically when the user's email is in ADMIN_EMAILS.

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
  const shouldAdmin = allow.includes(email);

  const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
  const nextRoles = shouldAdmin
    ? Array.from(new Set([...roles, "admin"]))
    : roles.filter((r) => r !== "admin");

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
