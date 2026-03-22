
function normalizeRole(role) {
  return String(role || '').trim().toLowerCase().replace(/\s+/g, '_');
}
function tokenRoles(user) {
  const out = [];
  const appRoles = user && user.app_metadata && Array.isArray(user.app_metadata.roles) ? user.app_metadata.roles : [];
  const userRole = user && user.user_metadata && user.user_metadata.role ? [user.user_metadata.role] : [];
  for (const role of [...appRoles, ...userRole]) {
    const n = normalizeRole(role);
    if (n) out.push(n);
  }
  return Array.from(new Set(out));
}
function hasRole(ctx, allowed) {
  const roles = Array.from(new Set([...(ctx.roles || []), ...(ctx.profileRole ? [ctx.profileRole] : [])].map(normalizeRole).filter(Boolean)));
  const wanted = (allowed || []).map(normalizeRole).filter(Boolean);
  if (!wanted.length) return true;
  return wanted.some(role => roles.includes(role));
}
module.exports = { normalizeRole, tokenRoles, hasRole };
