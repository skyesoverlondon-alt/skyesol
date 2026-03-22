import { json } from "./_lib/utils.js";

export const handler = async (event) => {
  try {
    const appId = event.queryStringParameters?.app_id || "";
    const cfgRaw = process.env.VAULT_PUBLIC_CONFIG_JSON || "{}";
    const cfg = JSON.parse(cfgRaw);

    // Return only app-specific config
    const appCfg = cfg[appId] || null;
    if (!appCfg) return json(404, { error: "unknown_app" });

    return json(200, {
      app_id: appId,
      public: appCfg.public || {},
      endpoints: appCfg.endpoints || {}
    });
  } catch (e) {
    return json(500, { error: "config_error", message: e.message });
  }
};
