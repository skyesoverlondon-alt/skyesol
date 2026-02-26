import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest } from "./_lib/http.js";
import { q } from "./_lib/db.js";
import { randomKey, keyHashHex } from "./_lib/crypto.js";
import { audit } from "./_lib/audit.js";

/**
 * Self-service kAIxu key provisioning.
 *
 * POST /.netlify/functions/request-key
 * Body: { "email": "user@example.com" }
 *
 * Flow:
 *   1. Validate email (basic format check).
 *   2. Find or create a "starter" customer row.
 *   3. Check if the customer already has an active (non-revoked) key.
 *      — If yes, revoke it (they'll get a fresh one).
 *   4. Generate a new kx_live_* key, store hash + last4.
 *   5. Return the raw key ONCE. It is never stored or retrievable again.
 *
 * Starter plan defaults (configurable via env):
 *   monthly_cap_cents : DEFAULT_SELFSERVE_CAP_CENTS  || 2000  ($20)
 *   rpm_limit         : DEFAULT_SELFSERVE_RPM        || 10
 *   max_devices       : DEFAULT_SELFSERVE_MAX_DEVICES || 3
 *
 * Rate-limit: max 5 key requests per email per hour (abuse protection).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST only" }, cors);

  let body;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON", cors); }

  const email = (body.email || "").toString().trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return badRequest("A valid email address is required.", cors);
  }

  // ── Abuse guard: max 5 key requests per email per hour ──
  const recentKeys = await q(
    `select count(*) as cnt from api_keys k
     join customers c on c.id = k.customer_id
     where c.email = $1 and k.created_at > now() - interval '1 hour'`,
    [email]
  );
  if (parseInt(recentKeys.rows[0]?.cnt || "0", 10) >= 5) {
    return json(429, {
      error: "Too many key requests. Please wait an hour before requesting again."
    }, cors);
  }

  // ── Defaults (env-configurable) ──
  const cap = parseInt(process.env.DEFAULT_SELFSERVE_CAP_CENTS || "2000", 10);
  const rpm = parseInt(process.env.DEFAULT_SELFSERVE_RPM || "10", 10);
  const maxDevices = parseInt(process.env.DEFAULT_SELFSERVE_MAX_DEVICES || "3", 10);
  const planName = process.env.DEFAULT_SELFSERVE_PLAN || "starter";

  // ── Find or create customer ──
  let customerRow = (await q(
    `select id, is_active from customers where email = $1 limit 1`,
    [email]
  )).rows[0];

  if (customerRow && !customerRow.is_active) {
    return json(403, { error: "This account has been suspended. Contact support." }, cors);
  }

  if (!customerRow) {
    const ins = await q(
      `insert into customers(email, plan_name, monthly_cap_cents)
       values ($1, $2, $3)
       on conflict (email) do update set email = excluded.email
       returning id`,
      [email, planName, cap]
    );
    customerRow = ins.rows[0];

    await audit("self-service", "CUSTOMER_CREATE", `customer:${customerRow.id}`, {
      email, plan_name: planName, monthly_cap_cents: cap, source: "request-key"
    });
  }

  // ── Revoke any existing active keys for this customer ──
  const revoked = await q(
    `update api_keys
     set revoked_at = now()
     where customer_id = $1 and revoked_at is null
     returning id, key_last4`,
    [customerRow.id]
  );
  if (revoked.rowCount > 0) {
    await audit("self-service", "KEY_REVOKE_ROTATION", `customer:${customerRow.id}`, {
      revoked_keys: revoked.rows.map(r => ({ id: r.id, last4: r.key_last4 })),
      reason: "new self-service key requested"
    });
  }

  // ── Generate new key ──
  const rawKey = randomKey("kx_live_");
  const keyHash = keyHashHex(rawKey);
  const keyLast4 = rawKey.slice(-4);

  const keyIns = await q(
    `insert into api_keys(customer_id, key_hash, key_last4, label, role,
                          monthly_cap_cents, rpm_limit, max_devices)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id, created_at`,
    [customerRow.id, keyHash, keyLast4, "self-service", "deployer", cap, rpm, maxDevices]
  );

  await audit("self-service", "KEY_CREATE", `key:${keyIns.rows[0].id}`, {
    customer_id: customerRow.id,
    email,
    key_last4: keyLast4,
    plan: planName,
    cap_cents: cap,
    rpm,
    max_devices: maxDevices,
    source: "request-key"
  });

  return json(200, {
    ok: true,
    message: "Your kAIxu API key has been generated. Copy it now — it will not be shown again.",
    key: rawKey,
    key_last4: keyLast4,
    customer_id: customerRow.id,
    plan: planName,
    limits: {
      monthly_cap_cents: cap,
      monthly_cap_dollars: `$${(cap / 100).toFixed(2)}`,
      requests_per_minute: rpm,
      max_devices: maxDevices
    },
    endpoints: {
      chat: "https://skyesol.netlify.app/.netlify/functions/gateway-chat",
      stream: "https://skyesol.netlify.app/.netlify/functions/gateway-stream",
      health: "https://skyesol.netlify.app/.netlify/functions/health"
    },
    usage: "Set header: Authorization: Bearer <your-key>"
  }, cors);
});
