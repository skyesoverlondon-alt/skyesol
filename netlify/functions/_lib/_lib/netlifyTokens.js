import { q } from "./db.js";
import { encryptSecret, decryptSecret } from "./crypto.js";

/**
 * Per-customer Netlify API tokens (enterprise boundary).
 *
 * - Stored encrypted in Netlify DB.
 * - Used by KaixuPush to create deploys/uploads in the customer's Netlify account.
 * - Falls back to process.env.NETLIFY_AUTH_TOKEN if no customer token exists (back-compat).
 */

export async function getNetlifyTokenForCustomer(customer_id) {
  const res = await q(`select token_enc from customer_netlify_tokens where customer_id=$1`, [customer_id]);
  if (res.rows.length) {
    const dec = decryptSecret(res.rows[0].token_enc);
    if (dec) return dec;
  }
  return (process.env.NETLIFY_AUTH_TOKEN || "").trim() || null;
}

export async function setNetlifyTokenForCustomer(customer_id, token_plain) {
  const enc = encryptSecret(token_plain);
  await q(
    `insert into customer_netlify_tokens(customer_id, token_enc, created_at, updated_at)
     values ($1,$2,now(),now())
     on conflict (customer_id)
     do update set token_enc=excluded.token_enc, updated_at=now()`,
    [customer_id, enc]
  );
}

export async function clearNetlifyTokenForCustomer(customer_id) {
  await q(`delete from customer_netlify_tokens where customer_id=$1`, [customer_id]);
}
