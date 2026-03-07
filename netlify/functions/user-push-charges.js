import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest, getBearer, monthKeyUTC } from "./_lib/http.js";
import { q } from "./_lib/db.js";
import { resolveAuth, requireKeyRole } from "./_lib/authz.js";

function monthRangeUTC(month) {
  const [y, m] = String(month || "").split("-").map((x) => parseInt(x, 10));
  if (!y || !m || m < 1 || m > 12) return null;
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { start, end };
}

function intEnv(name, dflt) {
  const v = parseInt(String(process.env[name] || ""), 10);
  return Number.isFinite(v) ? v : dflt;
}

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  const token = getBearer(req);
  if (!token) return json(401, { error: "Missing Authorization: Bearer <virtual_key>" }, cors);

  const keyRow = await resolveAuth(token);
  if (!keyRow) return json(401, { error: "Invalid or revoked key" }, cors);
  if (!keyRow.is_active) return json(403, { error: "Customer disabled" }, cors);
  requireKeyRole(keyRow, "viewer");

  const url = new URL(req.url);
  const month = (url.searchParams.get("month") || monthKeyUTC()).toString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return badRequest("Invalid month format. Use YYYY-MM.", cors);

  const range = monthRangeUTC(month);
  if (!range) return badRequest("Invalid month format. Use YYYY-MM.", cors);

  // Netlify push pricing config (customer override or default version 1)
  let pv = await q(
    `select b.pricing_version, b.monthly_cap_cents,
            p.base_month_cents, p.per_deploy_cents, p.per_gb_cents, p.currency
     from customer_push_billing b
     join push_pricing_versions p on p.version = b.pricing_version
     where b.customer_id=$1
     limit 1`,
    [keyRow.customer_id]
  );
  if (!pv.rowCount) {
    pv = await q(
      `select 1 as pricing_version, 0 as monthly_cap_cents,
              base_month_cents, per_deploy_cents, per_gb_cents, currency
       from push_pricing_versions where version=1 limit 1`,
      []
    );
  }
  const netlifyCfg = pv.rowCount
    ? pv.rows[0]
    : { pricing_version: 1, monthly_cap_cents: 0, base_month_cents: 0, per_deploy_cents: 0, per_gb_cents: 0, currency: "USD" };

  const pushUsage = await q(
    `select
        count(*) filter (where event_type='deploy_ready')::int as deploys_ready,
        coalesce(sum(bytes) filter (where event_type='file_upload'),0)::bigint as bytes_uploaded
     from push_usage_events
     where customer_id=$1 and created_at >= $2 and created_at < $3`,
    [keyRow.customer_id, range.start.toISOString(), range.end.toISOString()]
  );
  const netlifyDeploys = Number(pushUsage.rows[0]?.deploys_ready || 0);
  const netlifyBytes = Number(pushUsage.rows[0]?.bytes_uploaded || 0);
  const netlifyGb = netlifyBytes / 1073741824;
  const netlifyTotal =
    Number(netlifyCfg.base_month_cents || 0) +
    Number(netlifyCfg.per_deploy_cents || 0) * netlifyDeploys +
    Math.round(Number(netlifyCfg.per_gb_cents || 0) * netlifyGb);

  // GitHub push usage + pricing (env-configurable; defaults keep this transparent and explicit)
  const ghUsage = await q(
    `select
        count(*) filter (where e.event_type='done')::int as pushes_done,
        coalesce(sum(e.bytes) filter (where e.event_type='chunk'),0)::bigint as bytes_uploaded
     from gh_push_events e
     where e.customer_id=$1 and e.created_at >= $2 and e.created_at < $3`,
    [keyRow.customer_id, range.start.toISOString(), range.end.toISOString()]
  );
  const ghPushes = Number(ghUsage.rows[0]?.pushes_done || 0);
  const ghBytes = Number(ghUsage.rows[0]?.bytes_uploaded || 0);
  const ghGb = ghBytes / 1073741824;

  const ghBaseCents = intEnv("GITHUB_PUSH_BASE_MONTH_CENTS", 0);
  const ghPerPushCents = intEnv("GITHUB_PUSH_PER_PUSH_CENTS", 10);
  const ghPerGbCents = intEnv("GITHUB_PUSH_PER_GB_CENTS", 25);
  const ghTotal = ghBaseCents + (ghPerPushCents * ghPushes) + Math.round(ghPerGbCents * ghGb);

  return json(200, {
    month,
    currency: "USD",
    transparency: "Push charges are separate from AI usage but tracked on the same Kaixu key/customer balance by default.",
    netlify: {
      pricing_version: Number(netlifyCfg.pricing_version || 1),
      base_month_cents: Number(netlifyCfg.base_month_cents || 0),
      per_deploy_cents: Number(netlifyCfg.per_deploy_cents || 0),
      per_gb_cents: Number(netlifyCfg.per_gb_cents || 0),
      deploys_ready: netlifyDeploys,
      bytes_uploaded: netlifyBytes,
      gb_estimate: Math.round(netlifyGb * 1000) / 1000,
      total_cents: netlifyTotal
    },
    github: {
      pricing_version: "env",
      base_month_cents: ghBaseCents,
      per_push_cents: ghPerPushCents,
      per_gb_cents: ghPerGbCents,
      pushes_done: ghPushes,
      bytes_uploaded: ghBytes,
      gb_estimate: Math.round(ghGb * 1000) / 1000,
      total_cents: ghTotal
    },
    total_push_cents: netlifyTotal + ghTotal
  }, cors);
});
