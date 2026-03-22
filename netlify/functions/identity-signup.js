import { normalizeIdentityRoles, upsertIdentityMember } from "./_lib/sol-identity.js";

function parseAllowlist() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function requestedSignupRole(user) {
  const requested = String(user?.user_metadata?.requested_role || user?.user_metadata?.role || "")
    .trim()
    .toLowerCase();
  return requested === "team_owner" ? "team_owner" : "player";
}

export const handler = async (event) => {
  try {
    const { user } = JSON.parse(event.body);
    const email = String(user?.email || "").trim().toLowerCase();
    const shouldGrantPresident = parseAllowlist().includes(email);

    const roles = normalizeIdentityRoles([
      requestedSignupRole(user),
      shouldGrantPresident ? "president" : null,
    ]);

    await upsertIdentityMember({
      email,
      identityUserId: user?.id || null,
      fullName: user?.user_metadata?.full_name || user?.user_metadata?.name || null,
      roles,
      status: "pending",
      source: "identity-signup",
      metadata: {
        requested_role: requestedSignupRole(user),
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        app_metadata: {
          roles,
        },
      }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid request body" }),
    };
  }
};
