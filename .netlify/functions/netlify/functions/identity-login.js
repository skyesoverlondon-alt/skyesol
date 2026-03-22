var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/identity-login.mjs
var identity_login_exports = {};
__export(identity_login_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(identity_login_exports);
function parseAllowlist() {
  return (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}
var handler = async (event) => {
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
  const nextRoles = shouldAdmin ? Array.from(/* @__PURE__ */ new Set([...roles, "admin"])) : roles.filter((r) => r !== "admin");
  return {
    statusCode: 200,
    body: JSON.stringify({
      ...user,
      app_metadata: {
        ...user.app_metadata || {},
        roles: nextRoles
      }
    })
  };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
