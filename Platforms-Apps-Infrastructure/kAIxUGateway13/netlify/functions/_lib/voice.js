import { q } from "./db.js";
import { voiceBillCents, voiceCostCents, voiceMonthKeyUTC } from "./voice_pricing.js";

export async function getVoiceNumberByTo(toNumber) {
  const to = (toNumber || "").toString().trim();
  if (!to) return null;
  const r = await q(`select * from voice_numbers where phone_number = $1 and is_active = true`, [to]);
  return r.rows[0] || null;
}

export async function upsertCall({ customerId, voiceNumberId, provider, callSid, fromNumber, toNumber, meta = {} }) {
  const r = await q(
    `insert into voice_calls (customer_id, voice_number_id, provider, provider_call_sid, from_number, to_number, meta)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb)
     on conflict (provider, provider_call_sid)
     do update set from_number=excluded.from_number, to_number=excluded.to_number
     returning *`,
    [customerId, voiceNumberId, provider, callSid, fromNumber || null, toNumber || null, JSON.stringify(meta || {})]
  );
  return r.rows[0];
}

export async function addCallMessage(callId, role, content) {
  await q(
    `insert into voice_call_messages (call_id, role, content) values ($1,$2,$3)`,
    [callId, role, (content || "").toString()]
  );
}

export async function getRecentMessages(callId, limit = 12) {
  const r = await q(
    `select role, content from voice_call_messages where call_id=$1 order by id desc limit $2`,
    [callId, limit]
  );
  // reverse to chronological
  return (r.rows || []).reverse();
}

export async function updateCallStatus({ provider, callSid, status, durationSeconds }) {
  const nowEnded = status === "completed" || status === "canceled" || status === "failed" || status === "busy" || status === "no-answer";
  const r = await q(
    `update voice_calls
       set status = $1,
           ended_at = case when $2 then coalesce(ended_at, now()) else ended_at end,
           duration_seconds = case when $3::int is not null then $3::int else duration_seconds end
     where provider = $4 and provider_call_sid = $5
     returning *`,
    [status, nowEnded, Number.isFinite(durationSeconds) ? durationSeconds : null, provider, callSid]
  );
  return r.rows[0] || null;
}

export async function finalizeBillingForCall(callRow) {
  if (!callRow) return null;
  const dur = callRow.duration_seconds || 0;
  const minutes = Math.max(0, Math.ceil(dur / 60));
  const est_cost_cents = voiceCostCents(minutes);
  const bill_cost_cents = voiceBillCents(minutes);

  const upd = await q(
    `update voice_calls
        set est_cost_cents=$1, bill_cost_cents=$2
      where id=$3
      returning *`,
    [est_cost_cents, bill_cost_cents, callRow.id]
  );

  const month = voiceMonthKeyUTC();
  await q(
    `insert into voice_usage_monthly (customer_id, month, minutes, est_cost_cents, bill_cost_cents, calls)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (customer_id, month)
     do update set
        minutes = voice_usage_monthly.minutes + excluded.minutes,
        est_cost_cents = voice_usage_monthly.est_cost_cents + excluded.est_cost_cents,
        bill_cost_cents = voice_usage_monthly.bill_cost_cents + excluded.bill_cost_cents,
        calls = voice_usage_monthly.calls + excluded.calls`,
    [callRow.customer_id, month, minutes, est_cost_cents, bill_cost_cents, 1]
  );

  return upd.rows[0] || null;
}
