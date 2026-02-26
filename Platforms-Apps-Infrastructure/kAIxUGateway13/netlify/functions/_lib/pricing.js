import fs from "fs";
import path from "path";

let cache = null;

function loadPricing() {
  if (cache) return cache;
  const p = path.join(process.cwd(), "pricing", "pricing.json");
  const raw = fs.readFileSync(p, "utf8");
  cache = JSON.parse(raw);
  return cache;
}

function unpricedError(provider, model) {
  const err = new Error(`Unpriced model: ${provider}:${model}`);
  err.code = "UNPRICED_MODEL";
  // 409 communicates "your request is valid JSON but conflicts with server policy/config"
  err.status = 409;
  err.hint = "This model/provider is not enabled for billing. Ask an admin to add it to pricing/pricing.json (and allowlists).";
  return err;
}

export function costCents(provider, model, inputTokens, outputTokens) {
  const pricing = loadPricing();
  const entry = pricing?.[provider]?.[model];
  if (!entry) throw unpricedError(provider, model);

  const inRate = Number(entry.input_per_1m_usd);
  const outRate = Number(entry.output_per_1m_usd);

  // Treat missing/NaN as misconfiguration.
  if (!Number.isFinite(inRate) || !Number.isFinite(outRate)) throw unpricedError(provider, model);

  const inUsd = (Number(inputTokens || 0) / 1_000_000) * inRate;
  const outUsd = (Number(outputTokens || 0) / 1_000_000) * outRate;
  const totalUsd = inUsd + outUsd;

  return Math.max(0, Math.round(totalUsd * 100));
}
