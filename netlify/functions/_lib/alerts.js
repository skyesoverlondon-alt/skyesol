import { q } from "./db.js";

function pct(spent, cap) {
  if (!cap || cap <= 0) return 0;
  return (spent / cap) * 100;
}

async function recordOnce({ customer_id, api_key_id = 0, month, alert_type }) {
  const res = await q(
    `insert into alerts_sent(customer_id, api_key_id, month, alert_type)
     values ($1,$2,$3,$4)
     on conflict (customer_id, api_key_id, month, alert_type) do nothing
     returning customer_id`,
    [customer_id, api_key_id || 0, month, alert_type]
  );
  return res.rowCount > 0;
}

async function postWebhook(payload) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;

  // Best-effort: webhook failures must NOT break gateway usage.
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch {
    // ignore
  }
}

/**
 * Sends a warning (and/or reached) alert once per key/customer per month.
 * Uses alerts_sent table for de-dupe.
 */
export async function maybeCapAlerts({
  customer_id,
  api_key_id,
  month,
  customer_cap_cents,
  customer_spent_cents,
  key_cap_cents,
  key_spent_cents
}) {
  const warnPct = parseFloat(process.env.CAP_WARN_PCT || "80");

  const custP = pct(customer_spent_cents || 0, customer_cap_cents || 0);
  const keyP = pct(key_spent_cents || 0, key_cap_cents || 0);

  // Customer-level warnings
  if (custP >= warnPct && custP < 100) {
    const ok = await recordOnce({ customer_id, api_key_id: 0, month, alert_type: "CAP_WARN_CUSTOMER" });
    if (ok) {
      await postWebhook({
        type: "CAP_WARN_CUSTOMER",
        month,
        customer_id,
        customer_cap_cents,
        customer_spent_cents,
        pct: custP
      });
    }
  }

  // Key-level warnings
  if (keyP >= warnPct && keyP < 100) {
    const ok = await recordOnce({ customer_id, api_key_id: api_key_id || 0, month, alert_type: "CAP_WARN_KEY" });
    if (ok) {
      await postWebhook({
        type: "CAP_WARN_KEY",
        month,
        customer_id,
        api_key_id,
        key_cap_cents,
        key_spent_cents,
        pct: keyP
      });
    }
  }
}
