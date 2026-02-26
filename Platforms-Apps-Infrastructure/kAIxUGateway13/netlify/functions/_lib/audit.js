import { q } from "./db.js";

/**
 * Best-effort audit log: failures never break the main request.
 */
export async function audit(actor, action, target = null, meta = {}) {
  try {
    await q(
      `insert into audit_events(actor, action, target, meta) values ($1,$2,$3,$4::jsonb)`,
      [actor, action, target, JSON.stringify(meta || {})]
    );
  } catch (e) {
    console.warn("audit failed:", e?.message || e);
  }
}
