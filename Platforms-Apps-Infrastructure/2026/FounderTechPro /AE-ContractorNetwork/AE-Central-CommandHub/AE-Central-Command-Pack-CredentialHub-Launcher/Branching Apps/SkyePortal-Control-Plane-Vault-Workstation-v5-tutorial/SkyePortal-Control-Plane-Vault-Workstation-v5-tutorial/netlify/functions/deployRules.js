import { json, safeJsonParse, getAuthBearer, isString } from "./_lib/utils.js";
import { verifyHS256 } from "./_lib/jwt.js";
import { getAccessTokenFromServiceAccount } from "./_lib/googleAuth.js";
import { createRuleset, updateRelease, toFiles } from "./_lib/rulesApi.js";

// Firebase Rules API release names:
// - Firestore: "cloud.firestore"
// - Storage:  "firebase.storage"

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });

    const signing = process.env.VAULT_SIGNING_SECRET;
    if (!isString(signing)) return json(500, { error: "missing_VAULT_SIGNING_SECRET" });

    const token = getAuthBearer(event);
    const v = verifyHS256(token, signing);
    if (!v.ok) return json(401, { error: v.error });

    const scopes = v.payload?.scopes || [];
    if (!Array.isArray(scopes) || !scopes.includes("rules:deploy")) return json(403, { error: "insufficient_scope" });

    const body = safeJsonParse(event.body || "{}", {});
    const projectId = body.projectId;
    const firestoreRules = body.firestoreRules || null;
    const storageRules = body.storageRules || null;

    if (!isString(projectId)) return json(400, { error: "missing_projectId" });
    if (!firestoreRules && !storageRules) return json(400, { error: "no_rules_provided" });

    const saJson = process.env.VAULT_GOOGLE_SA_JSON;
    if (!isString(saJson)) return json(500, { error: "missing_VAULT_GOOGLE_SA_JSON" });

    // Scope for Firebase Rules API
    const scopesNeeded = ["https://www.googleapis.com/auth/firebase"];
    const { access_token } = await getAccessTokenFromServiceAccount(saJson, scopesNeeded);

    // Create ruleset
    const files = toFiles({ firestoreRules, storageRules });
    const ruleset = await createRuleset({ accessToken: access_token, projectId, files });

    const deployed = {};

    if (firestoreRules) {
      const rel = await updateRelease({
        accessToken: access_token,
        projectId,
        releaseName: "cloud.firestore",
        rulesetName: ruleset.name
      });
      deployed.firestore = rel?.name || "cloud.firestore";
    }

    if (storageRules) {
      const rel = await updateRelease({
        accessToken: access_token,
        projectId,
        releaseName: "firebase.storage",
        rulesetName: ruleset.name
      });
      deployed.storage = rel?.name || "firebase.storage";
    }

    return json(200, {
      ok: true,
      projectId,
      ruleset: ruleset.name,
      deployed
    });

  } catch (e) {
    return json(500, { error: "deploy_error", message: e.message });
  }
};
