import { q } from "./db.js";

export const SOL_IDENTITY_ROLE_ORDER = ["president", "vp", "cfo", "team_owner", "player"];

const LEGACY_ROLE_MAP = new Map([
  ["admin", "president"],
  ["owner", "team_owner"],
  ["client", "player"],
]);

function coerceRoles(input) {
  if (Array.isArray(input)) return input;
  if (input && Array.isArray(input.app_metadata?.roles)) return input.app_metadata.roles;
  return [];
}

export function normalizeIdentityRoles(input) {
  const seen = new Set();
  for (const raw of coerceRoles(input)) {
    const role = String(raw || "").trim().toLowerCase();
    const mapped = LEGACY_ROLE_MAP.get(role) || role;
    if (SOL_IDENTITY_ROLE_ORDER.includes(mapped)) seen.add(mapped);
  }
  if (!seen.size) seen.add("player");
  return SOL_IDENTITY_ROLE_ORDER.filter((role) => seen.has(role));
}

export function hasControlPanelAccess(userOrRoles) {
  const roles = coerceRoles(userOrRoles).map((role) => String(role || "").trim().toLowerCase());
  return roles.some((role) => role === "admin" || role === "president" || role === "vp" || role === "cfo");
}

export async function upsertIdentityMember({
  email,
  identityUserId = null,
  fullName = null,
  roles = ["player"],
  status = "active",
  source = "netlify_identity",
  metadata = {},
  lastLoginAt = null,
}) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) return null;

  const normalizedRoles = normalizeIdentityRoles(roles);
  const primaryRole = normalizedRoles[0] || "player";
  const safeMetadata = metadata && typeof metadata === "object" ? metadata : {};

  const member = await q(
    `insert into sol_identity_members (
       email,
       identity_user_id,
       full_name,
       primary_role,
       roles,
       status,
       source,
       profile,
       last_login_at,
       updated_at
     )
     values ($1,$2,$3,$4,$5::text[],$6,$7,$8::jsonb,$9,now())
     on conflict (email) do update set
       identity_user_id = coalesce(excluded.identity_user_id, sol_identity_members.identity_user_id),
       full_name = coalesce(excluded.full_name, sol_identity_members.full_name),
       primary_role = excluded.primary_role,
       roles = excluded.roles,
       status = excluded.status,
       source = excluded.source,
       profile = sol_identity_members.profile || excluded.profile,
       last_login_at = coalesce(excluded.last_login_at, sol_identity_members.last_login_at),
       updated_at = now()
     returning id`,
    [
      cleanEmail,
      identityUserId,
      fullName,
      primaryRole,
      normalizedRoles,
      status,
      source,
      JSON.stringify(safeMetadata),
      lastLoginAt,
    ]
  );

  const memberId = member.rows?.[0]?.id;
  if (!memberId) return null;

  await q(
    `update sol_identity_role_grants
        set revoked_at = now()
      where member_id = $1
        and role <> all($2::text[])
        and revoked_at is null`,
    [memberId, normalizedRoles]
  );

  await q(
    `insert into sol_identity_role_grants (member_id, role, grant_source, granted_by, meta)
     select $1, role_name, $2, $3, $4::jsonb
       from unnest($5::text[]) as role_name
     on conflict (member_id, role) do update set
       revoked_at = null,
       grant_source = excluded.grant_source,
       granted_by = excluded.granted_by,
       meta = excluded.meta`,
    [memberId, source, source, JSON.stringify(safeMetadata), normalizedRoles]
  );

  return { id: memberId, email: cleanEmail, roles: normalizedRoles };
}