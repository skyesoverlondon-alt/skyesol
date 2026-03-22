import { q } from "./_lib/db.js";
import { callOpenAI, callAnthropic, callGemini } from "./_lib/providers.js";
import { costCents } from "./_lib/pricing.js";
import { monthKeyUTC } from "./_lib/http.js";

// NOTE: This is a Netlify Background Function.
// Naming rule: must include "-background" in filename (Netlify docs).
export default async (req) => {
  if (req.method !== "POST") return;

  const secret = (process.env.JOB_WORKER_SECRET || "").trim();
  if (secret) {
        const got = (req.headers.get("x-kaixu-job-secret") || req.headers.get("x-job-worker-secret") || "").trim();
    if (!got || got !== secret) {
      // Intentionally do nothing: background functions can't return custom responses anyway.
      return;
    }
  }

  let body;
  try { body = await req.json(); } catch { return; }
  const id = (body?.id || "").toString().trim();
  if (!id) return;

  // Load job
  const jr = await q(`select * from async_jobs where id = $1`, [id]);
  if (!jr.rows.length) return;

  const job = jr.rows[0];
  if (job.status === "succeeded" || job.status === "failed") return;

  // Mark running (best-effort)
  await q(
    `update async_jobs set status = 'running', started_at = coalesce(started_at, now()), heartbeat_at = now()
     where id = $1`,
    [id]
  );

  let request;
  try {
    request = typeof job.request === "string" ? JSON.parse(job.request) : job.request;
  } catch {
    request = job.request || {};
  }

  const provider = String(job.provider || request.provider || "").toLowerCase();
  const model = String(job.model || request.model || "");
  const messages = Array.isArray(request.messages) ? request.messages : [];
  const max_tokens = Number.isFinite(request.max_tokens) ? parseInt(request.max_tokens, 10) : 4096;
  const temperature = Number.isFinite(request.temperature) ? request.temperature : 1;

  try {
    let result;
    if (provider === "openai") result = await callOpenAI({ model, messages, max_tokens, temperature });
    else if (provider === "anthropic") result = await callAnthropic({ model, messages, max_tokens, temperature });
    else if (provider === "gemini") result = await callGemini({ model, messages, max_tokens, temperature });
    else throw new Error("Unknown provider. Use openai|anthropic|gemini.");

    const output_text = result.output_text || "";
    const input_tokens = result.input_tokens || 0;
    const output_tokens = result.output_tokens || 0;
    const cost_cents = costCents(provider, model, input_tokens, output_tokens);

    const meta = {
      raw: result.raw || null,
      max_tokens,
      temperature
    };

    await q(
      `update async_jobs set status='succeeded', completed_at=now(), heartbeat_at=now(),
        output_text=$2, input_tokens=$3, output_tokens=$4, cost_cents=$5, meta=$6::jsonb
       where id=$1`,
      [id, output_text, input_tokens, output_tokens, cost_cents, JSON.stringify(meta)]
    );

    // Metering (same logic as gateway-chat)
    const month = monthKeyUTC();

    await q(
      `insert into usage_events(customer_id, api_key_id, provider, model, input_tokens, output_tokens, cost_cents)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [job.customer_id, job.api_key_id, provider, model, input_tokens, output_tokens, cost_cents]
    );

    await q(
      `insert into monthly_usage(customer_id, month, spent_cents, input_tokens, output_tokens)
       values ($1,$2,$3,$4,$5)
       on conflict (customer_id, month)
       do update set
         spent_cents = monthly_usage.spent_cents + excluded.spent_cents,
         input_tokens = monthly_usage.input_tokens + excluded.input_tokens,
         output_tokens = monthly_usage.output_tokens + excluded.output_tokens,
         updated_at = now()`,
      [job.customer_id, month, cost_cents, input_tokens, output_tokens]
    );

    await q(
      `insert into monthly_key_usage(api_key_id, customer_id, month, spent_cents, input_tokens, output_tokens, calls)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (api_key_id, month)
       do update set
         spent_cents = monthly_key_usage.spent_cents + excluded.spent_cents,
         input_tokens = monthly_key_usage.input_tokens + excluded.input_tokens,
         output_tokens = monthly_key_usage.output_tokens + excluded.output_tokens,
         calls = monthly_key_usage.calls + excluded.calls,
         updated_at = now()`,
      [job.api_key_id, job.customer_id, month, cost_cents, input_tokens, output_tokens, 1]
    );
  } catch (e) {
    const msg = e?.message || "Job failed";
    await q(
      `update async_jobs set status='failed', completed_at=now(), heartbeat_at=now(), error=$2 where id=$1`,
      [id, msg]
    );
  }
};
