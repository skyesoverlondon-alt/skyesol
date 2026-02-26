function normArray(a) {
  if (!a) return null;
  if (Array.isArray(a)) return a.map(String).map(s=>s.trim()).filter(Boolean);
  if (typeof a === 'string') return a.split(',').map(s=>s.trim()).filter(Boolean);
  return null;
}

/**
 * Allowed models shape (JSON):
 * - { "openai": ["gpt-4o-mini","gpt-4.1"], "anthropic": ["claude-3-5-sonnet-20241022"], "gemini": ["gemini-1.5-flash" ] }
 * - OR { "*": ["*"] } to allow all
 * - OR { "openai": ["*"] } to allow any model within that provider
 */
function parseAllowedModels(m) {
  if (!m) return null;
  if (typeof m === 'object') return m;
  try { return JSON.parse(String(m)); } catch { return null; }
}

export function effectiveAllowlist(keyRow) {
  const providers = normArray(keyRow.allowed_providers) ?? normArray(keyRow.customer_allowed_providers);
  const models = parseAllowedModels(keyRow.allowed_models) ?? parseAllowedModels(keyRow.customer_allowed_models);
  return { providers, models };
}

export function assertAllowed({ provider, model, keyRow }) {
  const { providers, models } = effectiveAllowlist(keyRow);

  if (providers && providers.length) {
    if (!providers.includes('*') && !providers.includes(provider)) {
      return { ok: false, status: 403, error: `Provider not allowed for this key (${provider})` };
    }
  }

  if (models) {
    // global allow
    if (models['*']) {
      const arr = normArray(models['*']);
      if (arr && arr.includes('*')) return { ok: true };
    }

    const list = models[provider];
    if (list) {
      const arr = normArray(list) || [];
      if (arr.includes('*')) return { ok: true };
      if (!arr.includes(model)) {
        return { ok: false, status: 403, error: `Model not allowed for this key (${provider}:${model})` };
      }
    } else {
      // If a models object exists but doesn't include provider, treat as deny.
      return { ok: false, status: 403, error: `Provider not allowed by model allowlist (${provider})` };
    }
  }

  return { ok: true };
}
