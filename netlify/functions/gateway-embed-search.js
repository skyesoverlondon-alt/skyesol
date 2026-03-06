import { getStore } from "@netlify/blobs";
import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest, getBearer } from "./_lib/http.js";
import { resolveAuth } from "./_lib/authz.js";

const STORE_NAME = process.env.KAIXU_EMBED_COLLECTION_STORE || "kaixu-embed-collections";

function normalizeName(name) {
  return String(name || "").trim().replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return -1;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const av = Number(a[i]) || 0;
    const bv = Number(b[i]) || 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (!denom) return -1;
  return dot / denom;
}

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  const token = getBearer(req);
  if (!token) return json(401, { error: "Missing Authorization: Bearer <virtual_key>" }, cors);
  const keyRow = await resolveAuth(token);
  if (!keyRow) return json(401, { error: "Invalid or revoked key" }, cors);

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON", cors);
  }

  const collection = normalizeName(body.collection || "");
  const queryText = String(body.query || body.input || "").trim();
  const provider = String(body.provider || "gemini").trim();
  const model = String(body.model || "gemini-embedding-001").trim();
  const topK = Math.max(1, Math.min(50, Number(body.top_k || body.topK || 8) || 8));

  if (!collection) return badRequest("Missing collection", cors);
  if (!queryText) return badRequest("Missing query/input text", cors);

  const origin = new URL(req.url).origin;
  const embedResponse = await fetch(`${origin}/.netlify/functions/gateway-embed`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ provider, model, input: queryText })
  });

  if (!embedResponse.ok) {
    const detail = await embedResponse.text().catch(() => "");
    return json(embedResponse.status, { error: "Embedding step failed", detail }, cors);
  }

  const embedData = await embedResponse.json().catch(() => ({}));
  const queryEmbedding = Array.isArray(embedData.embeddings) ? embedData.embeddings[0] : null;
  if (!Array.isArray(queryEmbedding) || !queryEmbedding.length) {
    return json(500, { error: "Embedding response missing vectors" }, cors);
  }

  const store = getStore(STORE_NAME);
  const key = `${keyRow.customer_id}/${collection}.json`;
  const col = await store.get(key, { type: "json" }).catch(() => null);

  if (!col || !Array.isArray(col.items)) {
    return json(200, {
      ok: true,
      collection,
      top_k: topK,
      total_items: 0,
      matches: [],
      hint: "No stored vectors found for this collection."
    }, cors);
  }

  const ranked = col.items
    .map((item) => {
      const embedding = Array.isArray(item.embedding) ? item.embedding : [];
      return {
        id: item.id || null,
        text: item.text || "",
        metadata: item.metadata || {},
        score: cosineSimilarity(queryEmbedding, embedding)
      };
    })
    .filter((item) => Number.isFinite(item.score) && item.score > -1)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return json(200, {
    ok: true,
    collection,
    top_k: topK,
    total_items: col.items.length,
    matches: ranked
  }, cors);
});
