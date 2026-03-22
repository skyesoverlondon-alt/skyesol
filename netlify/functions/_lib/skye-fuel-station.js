import { hasConfiguredDb, q } from "./db.js";

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function toNumber(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function monthFromDate(value) {
  try {
    return new Date(value).toISOString().slice(0, 7);
  } catch {
    return "";
  }
}

function redactEmail(email) {
  const raw = String(email || "").trim();
  const at = raw.indexOf("@");
  if (at <= 1) return raw ? "hidden" : "";
  return `${raw.slice(0, 1)}***${raw.slice(at - 1)}`;
}

function numberEnv(name, fallback) {
  const raw = String(process.env[name] || "").trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function stationOrigin(req) {
  const explicit = normalizeBaseUrl(process.env.PUBLIC_APP_ORIGIN || process.env.URL || "");
  if (explicit) return explicit;
  try {
    return normalizeBaseUrl(new URL(req.url).origin);
  } catch {
    return "";
  }
}

export function getSkyeFuelStationConfig(req) {
  const origin = stationOrigin(req);
  const publicPath = "/skyefuelstation/";
  const publicUrl = origin ? `${origin}${publicPath}` : publicPath;
  const adminUrl = origin ? `${origin}/gateway` : "/gateway";
  const brainAdminUrl = normalizeBaseUrl(process.env.SKYEFUEL_STATION_BRAIN_URL || "");
  const brainPublicUrl = normalizeBaseUrl(process.env.SKYEFUEL_STATION_BRAIN_PUBLIC_URL || brainAdminUrl || "");

  const bonusReturnPct = numberEnv("SKYEFUEL_STATION_BONUS_RETURN_PCT", 23);
  const discountPct = numberEnv("SKYEFUEL_STATION_DISCOUNT_PCT", 0);
  const fuelUnitUsd = numberEnv("SKYEFUEL_STATION_FUEL_USD", 1);
  const coinUnitUsd = numberEnv("SKYEFUEL_STATION_COIN_USD", 1);
  const tokenUnitUsd = numberEnv("SKYEFUEL_STATION_TOKEN_USD", 1);
  const keySessionUsd = numberEnv("SKYEFUEL_STATION_KEY_SESSION_USD", 25);

  return {
    name: "SkyeFuelStation",
    tagline: "Fuel, service assets, keys, and usage in one public station.",
    public_path: publicPath,
    public_url: publicUrl,
    admin_url: adminUrl,
    dashboard_url: origin ? `${origin}/gateway/dashboard.html` : "/gateway/dashboard.html",
    brain_gate: {
      configured: !!brainAdminUrl,
      admin_url: brainAdminUrl || null,
      public_url: brainPublicUrl || null
    },
    pricing: {
      service_asset_name: process.env.SKYEFUEL_STATION_SERVICE_ASSET_NAME || "SkyeTokens",
      fuel_asset_name: process.env.SKYEFUEL_STATION_FUEL_ASSET_NAME || "SkyeFuel",
      coin_asset_name: process.env.SKYEFUEL_STATION_COIN_ASSET_NAME || "SkyeCoins",
      access_asset_name: process.env.SKYEFUEL_STATION_ACCESS_ASSET_NAME || "Kaixu Keys",
      bonus_return_pct: bonusReturnPct,
      discount_pct: discountPct,
      rates: {
        fuel_unit_usd: fuelUnitUsd,
        coin_unit_usd: coinUnitUsd,
        token_unit_usd: tokenUnitUsd,
        key_session_usd: keySessionUsd
      }
    },
    assets: [
      {
        id: "fuel",
        name: process.env.SKYEFUEL_STATION_FUEL_ASSET_NAME || "SkyeFuel",
        role: "Usage fuel",
        description: "Powers gateway usage lanes and monthly top-ups.",
        unit_usd: fuelUnitUsd
      },
      {
        id: "tokens",
        name: process.env.SKYEFUEL_STATION_SERVICE_ASSET_NAME || "SkyeTokens",
        role: "Service asset",
        description: "Can be applied toward actual services and carries the bonus-return policy.",
        unit_usd: tokenUnitUsd
      },
      {
        id: "coins",
        name: process.env.SKYEFUEL_STATION_COIN_ASSET_NAME || "SkyeCoins",
        role: "Treasury asset",
        description: "Represents station-side treasury value and promotional currency positioning.",
        unit_usd: coinUnitUsd
      },
      {
        id: "keys",
        name: process.env.SKYEFUEL_STATION_ACCESS_ASSET_NAME || "Kaixu Keys",
        role: "Access credential",
        description: "Authorizes live usage and lets clients inspect live balance from the station.",
        unit_usd: keySessionUsd
      }
    ]
  };
}

export function buildStationPreview(config, spendUsd = 100) {
  const spend = Number.isFinite(Number(spendUsd)) ? Number(spendUsd) : 100;
  const pricing = config?.pricing || {};
  const tokenRate = Number(pricing?.rates?.token_unit_usd || 1);
  const baseUnits = tokenRate > 0 ? spend / tokenRate : 0;
  const bonusUnits = baseUnits * (Number(pricing?.bonus_return_pct || 0) / 100);
  const discountUsd = spend * (Number(pricing?.discount_pct || 0) / 100);
  return {
    spend_usd: spend,
    base_service_units: Number(baseUnits.toFixed(2)),
    bonus_service_units: Number(bonusUnits.toFixed(2)),
    effective_service_units: Number((baseUnits + bonusUnits).toFixed(2)),
    discount_usd: Number(discountUsd.toFixed(2))
  };
}

export async function fetchSkyeFuelBrainOverview() {
  const base = normalizeBaseUrl(process.env.SKYEFUEL_STATION_BRAIN_URL || "");
  if (!base) {
    return { configured: false, connected: false, url: null, endpoint: null, error: null, remote: null };
  }

  const headers = { accept: "application/json" };
  const token = String(process.env.SKYEFUEL_STATION_BRAIN_ADMIN_TOKEN || "").trim();
  if (token) headers.authorization = `Bearer ${token}`;

  const endpoints = ["/admin/overview", "/api/admin/overview", "/overview"];
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${base}${endpoint}`, { method: "GET", headers });
      if (!res.ok) {
        lastError = `HTTP ${res.status} from ${endpoint}`;
        continue;
      }
      const remote = await res.json().catch(() => null);
      return {
        configured: true,
        connected: true,
        url: base,
        endpoint,
        error: null,
        remote
      };
    } catch (err) {
      lastError = err?.message || "Failed to reach configured brain gate";
    }
  }

  return {
    configured: true,
    connected: false,
    url: base,
    endpoint: null,
    error: lastError,
    remote: null
  };
}

function emptySnapshot(month, station, brain) {
  return {
    station,
    preview: buildStationPreview(station, 100),
    overview: {
      month,
      customers: { total: 0, active: 0 },
      keys: { total: 0, active: 0 },
      treasury: {
        total_cap_cents: 0,
        spent_cents: 0,
        extra_cents: 0,
        token_volume: 0,
        topup_count: 0,
        topup_cents: 0
      }
    },
    leaders: [],
    recent_events: [],
    plan_mix: [],
    provider_mix: [],
    topup_sources: [],
    recent_topups: [],
    brain_gate: brain,
    storage_ready: false
  };
}

export async function fetchSkyeFuelStationSnapshot(req, month, { redact = false } = {}) {
  const station = getSkyeFuelStationConfig(req);
  const brain = await fetchSkyeFuelBrainOverview();

  if (!hasConfiguredDb()) {
    return emptySnapshot(month, station, brain);
  }

  const [customerStats, keyStats, usageRollup, topups, leaders, recentEvents, planMix, providerMix, topupSources, recentTopups] = await Promise.all([
    q(`
      select
        count(*) as total_customers,
        count(*) filter (where is_active) as active_customers,
        coalesce(sum(monthly_cap_cents), 0) as total_cap_cents
      from customers
    `),
    q(`
      select
        count(*) as total_keys,
        count(*) filter (where revoked_at is null) as active_keys
      from api_keys
    `),
    q(`
      select
        coalesce(sum(spent_cents), 0) as spent_cents,
        coalesce(sum(extra_cents), 0) as extra_cents,
        coalesce(sum(input_tokens + output_tokens), 0) as token_volume
      from monthly_usage
      where month = $1
    `, [month]),
    q(`
      select
        count(*) as topup_count,
        coalesce(sum(amount_cents), 0) as topup_cents
      from topup_events
      where month = $1
        and status = 'applied'
    `, [month]),
    q(`
      select
        c.id,
        c.email,
        c.plan_name,
        m.spent_cents,
        m.extra_cents,
        (m.input_tokens + m.output_tokens) as token_volume
      from monthly_usage m
      join customers c on c.id = m.customer_id
      where m.month = $1
      order by m.spent_cents desc, c.id asc
      limit 8
    `, [month]),
    q(`
      select
        e.created_at,
        c.email,
        e.provider,
        e.model,
        e.cost_cents,
        (e.input_tokens + e.output_tokens) as token_volume
      from usage_events e
      join customers c on c.id = e.customer_id
      where to_char(e.created_at at time zone 'UTC', 'YYYY-MM') = $1
      order by e.created_at desc
      limit 10
    `, [month]),
    q(`
      select
        c.plan_name,
        count(*) as customer_count,
        count(*) filter (where c.is_active) as active_customer_count,
        coalesce(sum(c.monthly_cap_cents), 0) as total_cap_cents,
        coalesce(sum(m.spent_cents), 0) as spent_cents,
        coalesce(sum(m.input_tokens + m.output_tokens), 0) as token_volume
      from customers c
      left join monthly_usage m
        on m.customer_id = c.id
       and m.month = $1
      group by c.plan_name
      order by spent_cents desc, customer_count desc, c.plan_name asc
    `, [month]),
    q(`
      select
        provider,
        count(*) as event_count,
        coalesce(sum(cost_cents), 0) as spent_cents,
        coalesce(sum(input_tokens + output_tokens), 0) as token_volume
      from usage_events
      where to_char(created_at at time zone 'UTC', 'YYYY-MM') = $1
      group by provider
      order by spent_cents desc, event_count desc, provider asc
    `, [month]),
    q(`
      select
        source,
        count(*) as event_count,
        coalesce(sum(amount_cents), 0) as amount_cents
      from topup_events
      where month = $1
        and status = 'applied'
      group by source
      order by amount_cents desc, event_count desc, source asc
    `, [month]),
    q(`
      select
        created_at,
        source,
        status,
        amount_cents,
        month
      from topup_events
      where month = $1
      order by created_at desc
      limit 8
    `, [month])
  ]);

  const customerRow = customerStats.rows[0] || {};
  const keyRow = keyStats.rows[0] || {};
  const usageRow = usageRollup.rows[0] || {};
  const topupRow = topups.rows[0] || {};

  return {
    station,
    preview: buildStationPreview(station, 100),
    overview: {
      month,
      customers: {
        total: toNumber(customerRow.total_customers),
        active: toNumber(customerRow.active_customers)
      },
      keys: {
        total: toNumber(keyRow.total_keys),
        active: toNumber(keyRow.active_keys)
      },
      treasury: {
        total_cap_cents: toNumber(customerRow.total_cap_cents),
        spent_cents: toNumber(usageRow.spent_cents),
        extra_cents: toNumber(usageRow.extra_cents),
        token_volume: toNumber(usageRow.token_volume),
        topup_count: toNumber(topupRow.topup_count),
        topup_cents: toNumber(topupRow.topup_cents)
      }
    },
    leaders: (leaders.rows || []).map((row) => ({
      id: toNumber(row.id),
      email: redact ? redactEmail(row.email) : (row.email || ""),
      plan_name: row.plan_name || "",
      spent_cents: toNumber(row.spent_cents),
      extra_cents: toNumber(row.extra_cents),
      token_volume: toNumber(row.token_volume)
    })),
    recent_events: (recentEvents.rows || []).map((row) => ({
      created_at: row.created_at,
      month: monthFromDate(row.created_at),
      email: redact ? redactEmail(row.email) : (row.email || ""),
      provider: row.provider || "",
      model: row.model || "",
      cost_cents: toNumber(row.cost_cents),
      token_volume: toNumber(row.token_volume)
    })),
    plan_mix: (planMix.rows || []).map((row) => ({
      plan_name: row.plan_name || "custom",
      customer_count: toNumber(row.customer_count),
      active_customer_count: toNumber(row.active_customer_count),
      total_cap_cents: toNumber(row.total_cap_cents),
      spent_cents: toNumber(row.spent_cents),
      token_volume: toNumber(row.token_volume)
    })),
    provider_mix: (providerMix.rows || []).map((row) => ({
      provider: row.provider || "unknown",
      event_count: toNumber(row.event_count),
      spent_cents: toNumber(row.spent_cents),
      token_volume: toNumber(row.token_volume)
    })),
    topup_sources: (topupSources.rows || []).map((row) => ({
      source: row.source || "manual",
      event_count: toNumber(row.event_count),
      amount_cents: toNumber(row.amount_cents)
    })),
    recent_topups: (recentTopups.rows || []).map((row) => ({
      created_at: row.created_at,
      month: row.month || monthFromDate(row.created_at),
      source: row.source || "manual",
      status: row.status || "unknown",
      amount_cents: toNumber(row.amount_cents)
    })),
    brain_gate: brain,
    storage_ready: true
  };
}

export function buildPublicStationDigest(snapshot) {
  const overview = snapshot?.overview || {};
  const treasury = overview.treasury || {};
  const customers = overview.customers || {};
  const keys = overview.keys || {};

  return {
    month: overview.month || "",
    live_signal: snapshot?.storage_ready ? "connected" : "config-only",
    active_customers: toNumber(customers.active),
    active_keys: toNumber(keys.active),
    monthly_spend_cents: toNumber(treasury.spent_cents),
    monthly_topup_cents: toNumber(treasury.topup_cents),
    monthly_token_volume: toNumber(treasury.token_volume),
    applied_topups: toNumber(treasury.topup_count),
    plan_count: Array.isArray(snapshot?.plan_mix) ? snapshot.plan_mix.length : 0,
    provider_count: Array.isArray(snapshot?.provider_mix) ? snapshot.provider_mix.length : 0
  };
}