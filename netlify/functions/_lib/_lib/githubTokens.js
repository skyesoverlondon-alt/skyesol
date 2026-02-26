import { q } from "./db.js";
import { encryptSecret, decryptSecret } from "./crypto.js";

/**
 * Per-customer GitHub tokens (enterprise boundary).
 *
 * Stored encrypted in Netlify DB.
 * Prefer OAuth tokens (scoped) but supports PATs as well.
 */

export async function getGitHubTokenForCustomer(customer_id) {
  const res = await q(`select token_enc from customer_github_tokens where customer_id=$1`, [customer_id]);
  if (res.rows.length) {
    const dec = decryptSecret(res.rows[0].token_enc);
    if (dec) return dec;
  }
  return null;
}

export async function setGitHubTokenForCustomer(customer_id, token_plain, token_type = "oauth", scopes = []) {
  const enc = encryptSecret(token_plain);
  const scopesArr = Array.isArray(scopes) ? scopes.map(s => String(s).trim()).filter(Boolean) : [];
  await q(
    `insert into customer_github_tokens(customer_id, token_enc, token_type, scopes, created_at, updated_at)
     values ($1,$2,$3,$4,now(),now())
     on conflict (customer_id)
     do update set token_enc=excluded.token_enc, token_type=excluded.token_type, scopes=excluded.scopes, updated_at=now()`,
    [customer_id, enc, token_type, scopesArr]
  );
}

export async function clearGitHubTokenForCustomer(customer_id) {
  await q(`delete from customer_github_tokens where customer_id=$1`, [customer_id]);
}
