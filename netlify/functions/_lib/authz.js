import { q } from "./db.js";
import { keyHashHex, legacyKeyHashHex, verifyJwt } from "./crypto.js";
import { monthKeyUTC } from "./http.js";

function baseSelect() {
  return `select k.id as api_key_id, k.customer_id, k.key_last4, k.label, k.role,
                 k.monthly_cap_cents as key_cap_cents, k.rpm_limit, k.rpd_limit,
                 k.max_devices, k.require_install_id, k.allowed_providers, k.allowed_models,
                 c.monthly_cap_cents as customer_cap_cents, c.is_active,
                 c.max_devices_per_key as customer_max_devices_per_key, c.require_install_id as customer_require_install_id,
                 c.allowed_providers as customer_allowed_providers, c.allowed_models as customer_allowed_models,
                 c.plan_name as customer_plan_name, c.email as customer_email
          from api_keys k
          join customers c on c.id = k.customer_id`;
}

export async function lookupKey(plainKey) {
  // Preferred hash (peppered if enabled)
  const preferred = keyHashHex(plainKey);
  let keyRes = await q(
    `${baseSelect()}
     where k.key_hash=$1 and k.revoked_at is null
     limit 1`,
    [preferred]
  );
  if (keyRes.rowCount) return keyRes.rows[0];

  // If KEY_PEPPER is enabled, allow legacy SHA-256 hashes and auto-migrate on first hit.
  if (process.env.KEY_PEPPER) {
    const legacy = legacyKeyHashHex(plainKey);
    keyRes = await q(
      `${baseSelect()}
       where k.key_hash=$1 and k.revoked_at is null
       limit 1`,
      [legacy]
    );
    if (!keyRes.rowCount) return null;

    const row = keyRes.rows[0];
    try {
      await q(
        `update api_keys set key_hash=$1
         where id=$2 and key_hash=$3`,
        [preferred, row.api_key_id, legacy]
      );
    } catch {
      // ignore migration errors
    }

    return row;
  }

  return null;
}

export async function lookupKeyById(api_key_id) {
  const keyRes = await q(
    `${baseSelect()}
     where k.id=$1 and k.revoked_at is null
     limit 1`,
    [api_key_id]
  );
  if (!keyRes.rowCount) return null;
  return keyRes.rows[0];
}

/**
 * Resolve an Authorization Bearer token.
 * Supported:
 * - Kaixu sub-key (plain virtual key, must start with "kx_live_")
 * - Short-lived user session JWT (type: 'user_session')
 */
export async function resolveAuth(token) {
  if (!token) return null;

  // JWTs have 3 dot-separated parts. Kaixu keys do not.
  const parts = token.split(".");
  if (parts.length === 3) {
    const payload = verifyJwt(token);
    if (!payload) return null;
    if (payload.type !== "user_session") return null;

    const row = await lookupKeyById(payload.api_key_id);
    return row;
  }

  // Reject tokens that are clearly not kAIxu keys.
  // Prevents provider API keys (OpenAI sk-*, Gemini AI…, Anthropic sk-ant-*) from
  // being hashed and looked up needlessly.
  if (!token.startsWith("kx_live_")) return null;

  return await lookupKey(token);
}

export async function getMonthRollup(customer_id, month = monthKeyUTC()) {
  const roll = await q(
    `select spent_cents, extra_cents, input_tokens, output_tokens
     from monthly_usage where customer_id=$1 and month=$2`,
    [customer_id, month]
  );
  if (roll.rowCount === 0) return { spent_cents: 0, extra_cents: 0, input_tokens: 0, output_tokens: 0 };
  return roll.rows[0];
}

export async function getKeyMonthRollup(api_key_id, month = monthKeyUTC()) {
  const roll = await q(
    `select spent_cents, input_tokens, output_tokens, calls
     from monthly_key_usage where api_key_id=$1 and month=$2`,
    [api_key_id, month]
  );
  if (roll.rowCount) return roll.rows[0];

  // Backfill for migrated installs (when monthly_key_usage did not exist yet).
  const keyMeta = await q(`select customer_id from api_keys where id=$1`, [api_key_id]);
  const customer_id = keyMeta.rowCount ? keyMeta.rows[0].customer_id : null;

  const agg = await q(
    `select coalesce(sum(cost_cents),0)::int as spent_cents,
            coalesce(sum(input_tokens),0)::int as input_tokens,
            coalesce(sum(output_tokens),0)::int as output_tokens,
            count(*)::int as calls
     from usage_events
     where api_key_id=$1 and to_char(created_at at time zone 'UTC','YYYY-MM')=$2`,
    [api_key_id, month]
  );

  const row = agg.rows[0] || { spent_cents: 0, input_tokens: 0, output_tokens: 0, calls: 0 };

  if (customer_id != null) {
    await q(
      `insert into monthly_key_usage(api_key_id, customer_id, month, spent_cents, input_tokens, output_tokens, calls)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (api_key_id, month)
       do update set
         spent_cents = excluded.spent_cents,
         input_tokens = excluded.input_tokens,
         output_tokens = excluded.output_tokens,
         calls = excluded.calls,
         updated_at = now()`,
      [api_key_id, customer_id, month, row.spent_cents || 0, row.input_tokens || 0, row.output_tokens || 0, row.calls || 0]
    );
  }

  return row;
}

export function effectiveCapCents(keyRow, rollup) {
  const base = keyRow.key_cap_cents ?? keyRow.customer_cap_cents;
  const extra = rollup.extra_cents || 0;
  return (base || 0) + extra;
}

export function customerCapCents(keyRow, customerRollup) {
  const base = keyRow.customer_cap_cents || 0;
  const extra = customerRollup.extra_cents || 0;
  return base + extra;
}

export function keyCapCents(keyRow, customerRollup) {
  // If a key override exists, it's a hard cap for that key. Otherwise it inherits the customer cap.
  if (keyRow.key_cap_cents != null) return keyRow.key_cap_cents;
  return customerCapCents(keyRow, customerRollup);
}


const ROLE_ORDER = ["viewer","deployer","admin","owner"];

export function roleAtLeast(actual, required) {
  const a = ROLE_ORDER.indexOf((actual || "deployer").toLowerCase());
  const r = ROLE_ORDER.indexOf((required || "deployer").toLowerCase());
  return a >= r && a !== -1 && r !== -1;
}

export function requireKeyRole(keyRow, requiredRole) {
  const actual = (keyRow?.role || "deployer").toLowerCase();
  if (!roleAtLeast(actual, requiredRole)) {
    const err = new Error("Forbidden");
    err.status = 403;
    err.code = "FORBIDDEN";
    err.hint = `Requires role '${requiredRole}', but key role is '${actual}'.`;
    throw err;
  }
}
