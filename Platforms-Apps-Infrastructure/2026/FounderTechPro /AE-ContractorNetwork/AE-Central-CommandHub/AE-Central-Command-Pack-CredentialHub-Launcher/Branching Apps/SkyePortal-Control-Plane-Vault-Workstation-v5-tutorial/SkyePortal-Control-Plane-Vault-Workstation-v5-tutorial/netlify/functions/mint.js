import { json, safeJsonParse, isString } from "./_lib/utils.js";
import { signHS256 } from "./_lib/jwt.js";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });

    const body = safeJsonParse(event.body || "{}", {});
    const app_id = body.app_id;
    const app_secret = body.app_secret;
    const scopes = Array.isArray(body.scopes) ? body.scopes : [];

    if (!isString(app_id) || !isString(app_secret)) return json(400, { error: "missing_app_id_or_secret" });

    const secretsRaw = process.env.VAULT_APP_SECRETS || "{}";
    const secrets = JSON.parse(secretsRaw);

    if (!secrets[app_id] || secrets[app_id] !== app_secret) return json(401, { error: "invalid_credentials" });

    const signing = process.env.VAULT_SIGNING_SECRET;
    if (!isString(signing)) return json(500, { error: "missing_VAULT_SIGNING_SECRET" });

    const ttl = Number(process.env.VAULT_TOKEN_TTL_SECONDS || "300");
    const { token, exp } = signHS256({ sub: app_id, scopes }, signing, ttl);

    const now = Math.floor(Date.now() / 1000);
    return json(200, {
      token,
      expires_in: exp - now
    });
  } catch (e) {
    return json(500, { error: "mint_error", message: e.message });
  }
};
