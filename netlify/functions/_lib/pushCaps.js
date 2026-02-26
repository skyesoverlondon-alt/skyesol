import { q } from "./db.js";

function monthRangeUTC(month) {
  const [y, m] = String(month || "").split("-").map((x) => parseInt(x, 10));
  if (!y || !m || m < 1 || m > 12) return null;
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { start, end };
}

export async function getPushPricing(customer_id) {
  let pv = await q(
    `select b.pricing_version, b.monthly_cap_cents,
            p.base_month_cents, p.per_deploy_cents, p.per_gb_cents, p.currency
     from customer_push_billing b
     join push_pricing_versions p on p.version = b.pricing_version
     where b.customer_id=$1
     limit 1`,
    [customer_id]
  );

  if (!pv.rowCount) {
    pv = await q(
      `select 1 as pricing_version, 0 as monthly_cap_cents,
              base_month_cents, per_deploy_cents, per_gb_cents, currency
       from push_pricing_versions where version=1 limit 1`,
      []
    );
  }
  return pv.rowCount ? pv.rows[0] : null;
}

async function getPushUsage(customer_id, range) {
  const usage = await q(
    `select
        count(*) filter (where event_type='deploy_ready')::int as deploys_ready,
        count(*) filter (where event_type='deploy_init')::int as deploys_init,
        coalesce(sum(bytes) filter (where event_type='file_upload'),0)::bigint as bytes_uploaded
     from push_usage_events
     where customer_id=$1 and created_at >= $2 and created_at < $3`,
    [customer_id, range.start.toISOString(), range.end.toISOString()]
  );
  return usage.rows[0] || { deploys_ready: 0, deploys_init: 0, bytes_uploaded: 0 };
}

async function getStagedBytes(customer_id, range) {
  // Count bytes staged in chunk jobs that have not been completed/cleared.
  const res = await q(
    `select coalesce(sum(j.bytes_staged),0)::bigint as bytes_staged
     from push_jobs j
     join push_pushes p on p.id=j.push_row_id
     where p.customer_id=$1
       and p.created_at >= $2 and p.created_at < $3
       and j.status in ('uploading','queued','assembling')`,
    [customer_id, range.start.toISOString(), range.end.toISOString()]
  );
  return Number(res.rows[0]?.bytes_staged || 0);
}

export async function enforcePushCap({ customer_id, month, extra_deploys = 0, extra_bytes = 0 }) {
  const range = monthRangeUTC(month);
  if (!range) {
    const err = new Error("Invalid month (YYYY-MM)");
    err.code = "BAD_MONTH";
    err.status = 400;
    throw err;
  }

  const cfg = await getPushPricing(customer_id);
  if (!cfg) return { ok: true, cfg: null }; // If push pricing not configured, don't block.

  const cap = Number(cfg.monthly_cap_cents || 0);
  if (!cap || cap <= 0) return { ok: true, cfg }; // cap=0 => unlimited

  const usage = await getPushUsage(customer_id, range);
  const staged = await getStagedBytes(customer_id, range);

  const deploys_init = Number(usage.deploys_init || 0);
  const deploys_ready = Number(usage.deploys_ready || 0);
  const deploys_reserved = Math.max(0, deploys_init - deploys_ready); // in-progress / attempted deploys
  const deploys_used = deploys_ready + deploys_reserved + Number(extra_deploys || 0);
  const bytes_total = Number(usage.bytes_uploaded || 0) + Number(staged || 0) + Number(extra_bytes || 0);

  const gb = bytes_total / 1073741824; // GiB
  const base = Number(cfg.base_month_cents || 0);
  const deployCost = Number(cfg.per_deploy_cents || 0) * deploys_used;
  const gbCost = Math.round(Number(cfg.per_gb_cents || 0) * gb);
  const total = base + deployCost + gbCost;

  if (total > cap) {
    const err = new Error("Push monthly cap reached");
    err.code = "PUSH_CAP_REACHED";
    err.status = 402;
    err.payload = {
      code: "PUSH_CAP_REACHED",
      month,
      pricing_version: cfg.pricing_version,
      monthly_cap_cents: cap,
      projected_total_cents: total,
      current: {
        deploys_init,
        deploys_ready,
        deploys_reserved,
        bytes_uploaded: Number(usage.bytes_uploaded || 0),
        bytes_staged: Number(staged || 0)
      },
      proposed: {
        extra_deploys: Number(extra_deploys || 0),
        extra_bytes: Number(extra_bytes || 0)
      }
    };
    throw err;
  }

  return {
    ok: true,
    cfg,
    month,
    projected_total_cents: total,
    monthly_cap_cents: cap,
    current: {
      deploys_init,
      deploys_ready,
      deploys_reserved,
      bytes_uploaded: Number(usage.bytes_uploaded || 0),
      bytes_staged: Number(staged || 0)
    }
  };
}
