import { json } from "./utils.js";

const API = "https://firebaserules.googleapis.com/v1";

export async function createRuleset({ accessToken, projectId, files, label }) {
  const res = await fetch(`${API}/projects/${encodeURIComponent(projectId)}/rulesets`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      source: { files },
      metadata: label ? { services: [], } : undefined
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || "create_ruleset_failed");
  return data; // includes name: projects/{project}/rulesets/{id}
}

export async function updateRelease({ accessToken, projectId, releaseName, rulesetName }) {
  const url = `${API}/projects/${encodeURIComponent(projectId)}/releases/${encodeURIComponent(releaseName)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "authorization": `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      rulesetName
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `update_release_failed:${releaseName}`);
  return data;
}

export function toFiles({ firestoreRules, storageRules }) {
  const files = [];
  if (firestoreRules) {
    files.push({ name: "firestore.rules", content: firestoreRules });
  }
  if (storageRules) {
    files.push({ name: "storage.rules", content: storageRules });
  }
  return files;
}
