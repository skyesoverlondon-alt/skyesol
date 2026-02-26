import { q } from './db.js';

function monthRangeUTC(month) {
  const [y, m] = String(month || '').split('-').map((x) => parseInt(x, 10));
  if (!y || !m || m < 1 || m > 12) return null;
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { start, end };
}

export async function computeInvoiceSnapshot(customer_id, month) {
  const cRes = await q(
    `select id, email, plan_name, monthly_cap_cents, is_active,
            stripe_customer_id, auto_topup_enabled, auto_topup_amount_cents, auto_topup_threshold_cents
     from customers where id=$1`,
    [customer_id]
  );
  if (!cRes.rowCount) return null;
  const customer = cRes.rows[0];

  const uRes = await q(
    `select month, spent_cents, extra_cents, input_tokens, output_tokens
     from monthly_usage where customer_id=$1 and month=$2`,
    [customer_id, month]
  );
  const roll = uRes.rowCount ? uRes.rows[0] : { month, spent_cents: 0, extra_cents: 0, input_tokens: 0, output_tokens: 0 };

  const kRes = await q(
    `select k.id as api_key_id, k.key_last4, k.label,
            coalesce(mk.spent_cents,0)::int as spent_cents,
            coalesce(mk.input_tokens,0)::int as input_tokens,
            coalesce(mk.output_tokens,0)::int as output_tokens,
            coalesce(mk.calls,0)::int as calls
     from api_keys k
     left join monthly_key_usage mk
       on mk.api_key_id=k.id and mk.month=$2
     where k.customer_id=$1
     order by mk.spent_cents desc nulls last, k.created_at asc`,
    [customer_id, month]
  );

  const tRes = await q(
    `select amount_cents, source, stripe_session_id, status, created_at
     from topup_events
     where customer_id=$1 and month=$2
     order by created_at asc`,
    [customer_id, month]
  );

  // --- KaixuPush charges (deploy pushes) ---
  let push = null;
  try {
    const range = monthRangeUTC(month);
    if (range) {
      // pricing cfg (default v1 if not configured for customer)
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

      if (pv.rowCount) {
        const cfg = pv.rows[0];

        const usage = await q(
          `select
              count(*) filter (where event_type='deploy_ready')::int as deploys_ready,
              coalesce(sum(bytes) filter (where event_type='file_upload'),0)::bigint as bytes_uploaded
           from push_usage_events
           where customer_id=$1 and created_at >= $2 and created_at < $3`,
          [customer_id, range.start.toISOString(), range.end.toISOString()]
        );

        const deploys = usage.rows[0]?.deploys_ready || 0;
        const bytes = Number(usage.rows[0]?.bytes_uploaded || 0);
        const gb = bytes / 1073741824;

        const base = cfg.base_month_cents;
        const deployCost = cfg.per_deploy_cents * deploys;
        const gbCost = Math.round(cfg.per_gb_cents * gb);
        const total = base + deployCost + gbCost;

        push = {
          pricing_version: cfg.pricing_version,
          currency: cfg.currency,
          base_month_cents: base,
          per_deploy_cents: cfg.per_deploy_cents,
          per_gb_cents: cfg.per_gb_cents,
          monthly_cap_cents: cfg.monthly_cap_cents,
          deploys_ready: deploys,
          bytes_uploaded: bytes,
          gb_estimate: Math.round(gb * 1000) / 1000,
          deploy_cost_cents: deployCost,
          storage_cost_cents: gbCost,
          total_cents: total
        };
      }
    }
  } catch {
    // If push tables aren't present yet, keep snapshot working for AI invoices.
    push = null;
  }

  const snapshot = {
    generated_at: new Date().toISOString(),
    month,
    customer: {
      id: customer.id,
      email: customer.email,
      plan_name: customer.plan_name,
      monthly_cap_cents: customer.monthly_cap_cents,
      stripe_customer_id: customer.stripe_customer_id || null
    },
    totals: {
      cap_cents: customer.monthly_cap_cents,
      extra_cents: roll.extra_cents || 0,
      spent_cents: roll.spent_cents || 0,
      input_tokens: roll.input_tokens || 0,
      output_tokens: roll.output_tokens || 0,
      total_tokens: (roll.input_tokens || 0) + (roll.output_tokens || 0),
      push_total_cents: push?.total_cents ?? 0,
      grand_total_cents: (roll.spent_cents || 0) + (roll.extra_cents || 0) + (push?.total_cents ?? 0)
    },
    keys: kRes.rows || [],
    topups: tRes.rows || [],
    auto_topup: {
      enabled: !!customer.auto_topup_enabled,
      threshold_cents: customer.auto_topup_threshold_cents ?? null,
      amount_cents: customer.auto_topup_amount_cents ?? null
    },
    push
  };

  return snapshot;
}
