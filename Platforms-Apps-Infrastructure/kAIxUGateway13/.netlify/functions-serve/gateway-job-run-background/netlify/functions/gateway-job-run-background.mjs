
import {createRequire as ___nfyCreateRequire} from "module";
import {fileURLToPath as ___nfyFileURLToPath} from "url";
import {dirname as ___nfyPathDirname} from "path";
let __filename=___nfyFileURLToPath(import.meta.url);
let __dirname=___nfyPathDirname(___nfyFileURLToPath(import.meta.url));
let require=___nfyCreateRequire(import.meta.url);


// netlify/functions/_lib/db.js
import { neon } from "@netlify/neon";
var _sql = null;
var _schemaPromise = null;
function getSql() {
  if (_sql) return _sql;
  const hasDbUrl = !!(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);
  if (!hasDbUrl) {
    const err = new Error("Database not configured (missing NETLIFY_DATABASE_URL). Attach Netlify DB (Neon) to this site.");
    err.code = "DB_NOT_CONFIGURED";
    err.status = 500;
    err.hint = "Netlify UI \u2192 Extensions \u2192 Neon \u2192 Add database (or run: npx netlify db init).";
    throw err;
  }
  _sql = neon();
  return _sql;
}
async function ensureSchema() {
  if (_schemaPromise) return _schemaPromise;
  _schemaPromise = (async () => {
    const sql = getSql();
    const statements = [
      `create table if not exists customers (
        id bigserial primary key,
        email text not null unique,
        plan_name text not null default 'starter',
        monthly_cap_cents integer not null default 2000,
        is_active boolean not null default true,
        stripe_customer_id text,
        stripe_subscription_id text,
        stripe_status text,
        stripe_current_period_end timestamptz,
        auto_topup_enabled boolean not null default false,
        auto_topup_amount_cents integer,
        auto_topup_threshold_cents integer,
        created_at timestamptz not null default now()
      );`,
      `create table if not exists api_keys (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        key_hash text not null unique,
        key_last4 text not null,
        label text,
        monthly_cap_cents integer,
        rpm_limit integer,
        rpd_limit integer,
        created_at timestamptz not null default now(),
        revoked_at timestamptz
      );`,
      `create index if not exists api_keys_customer_id_idx on api_keys(customer_id);`,
      `create table if not exists monthly_usage (
        customer_id bigint not null references customers(id) on delete cascade,
        month text not null,
        spent_cents integer not null default 0,
        extra_cents integer not null default 0,
        input_tokens integer not null default 0,
        output_tokens integer not null default 0,
        updated_at timestamptz not null default now(),
        primary key (customer_id, month)
      );`,
      `create table if not exists monthly_key_usage (
        api_key_id bigint not null references api_keys(id) on delete cascade,
        customer_id bigint not null references customers(id) on delete cascade,
        month text not null,
        spent_cents integer not null default 0,
        input_tokens integer not null default 0,
        output_tokens integer not null default 0,
        calls integer not null default 0,
        updated_at timestamptz not null default now(),
        primary key (api_key_id, month)
      );`,
      `create index if not exists monthly_key_usage_customer_month_idx on monthly_key_usage(customer_id, month);`,
      `alter table monthly_key_usage add column if not exists calls integer not null default 0;`,
      `create table if not exists usage_events (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        api_key_id bigint not null references api_keys(id) on delete cascade,
        provider text not null,
        model text not null,
        input_tokens integer not null default 0,
        output_tokens integer not null default 0,
        cost_cents integer not null default 0,
        created_at timestamptz not null default now()
      );`,
      `create index if not exists usage_events_customer_month_idx on usage_events(customer_id, created_at desc);`,
      `create index if not exists usage_events_key_idx on usage_events(api_key_id, created_at desc);`,
      `create table if not exists audit_events (
        id bigserial primary key,
        actor text not null,
        action text not null,
        target text,
        meta jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );`,
      `create index if not exists audit_events_created_idx on audit_events(created_at desc);`,
      `create table if not exists rate_limit_windows (
        customer_id bigint not null references customers(id) on delete cascade,
        api_key_id bigint not null references api_keys(id) on delete cascade,
        window_start timestamptz not null,
        count integer not null default 0,
        primary key (customer_id, api_key_id, window_start)
      );`,
      `create index if not exists rate_limit_windows_window_idx on rate_limit_windows(window_start desc);`,
      `alter table api_keys add column if not exists last_seen_at timestamptz;`,
      `alter table api_keys add column if not exists last_seen_install_id text;`,
      `alter table usage_events add column if not exists install_id text;`,
      `alter table usage_events add column if not exists ip_hash text;`,
      `alter table usage_events add column if not exists ua text;`,
      `create index if not exists usage_events_install_idx on usage_events(install_id);`,
      `create table if not exists alerts_sent (
        customer_id bigint not null,
        api_key_id bigint not null default 0,
        month text not null,
        alert_type text not null,
        created_at timestamptz not null default now(),
        primary key (customer_id, api_key_id, month, alert_type)
      );`,
      // --- Device binding / seats ---
      `alter table customers add column if not exists max_devices_per_key integer;`,
      `alter table customers add column if not exists require_install_id boolean not null default false;`,
      `alter table customers add column if not exists allowed_providers text[];`,
      `alter table customers add column if not exists allowed_models jsonb;`,
      `alter table customers add column if not exists stripe_current_period_end timestamptz;`,
      `alter table api_keys add column if not exists max_devices integer;`,
      `alter table api_keys add column if not exists require_install_id boolean;`,
      `alter table api_keys add column if not exists allowed_providers text[];`,
      `alter table api_keys add column if not exists allowed_models jsonb;`,
      `create table if not exists key_devices (
        api_key_id bigint not null references api_keys(id) on delete cascade,
        customer_id bigint not null references customers(id) on delete cascade,
        install_id text not null,
        device_label text,
        first_seen_at timestamptz not null default now(),
        last_seen_at timestamptz,
        last_seen_ua text,
        revoked_at timestamptz,
        revoked_by text,
        primary key (api_key_id, install_id)
      );`,
      `create index if not exists key_devices_customer_idx on key_devices(customer_id);`,
      `create index if not exists key_devices_last_seen_idx on key_devices(last_seen_at desc);`,
      // --- Invoice snapshots + topups ---
      `create table if not exists monthly_invoices (
        customer_id bigint not null references customers(id) on delete cascade,
        month text not null,
        snapshot jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (customer_id, month)
      );`,
      `create table if not exists topup_events (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        month text not null,
        amount_cents integer not null,
        source text not null default 'manual',
        stripe_session_id text,
        status text not null default 'applied',
        created_at timestamptz not null default now()
      );`,
      `create index if not exists topup_events_customer_month_idx on topup_events(customer_id, month);`,
      `create table if not exists async_jobs (
        id uuid primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        api_key_id bigint not null references api_keys(id) on delete cascade,
        provider text not null,
        model text not null,
        request jsonb not null default '{}'::jsonb,
        status text not null default 'queued',
        created_at timestamptz not null default now(),
        started_at timestamptz,
        completed_at timestamptz,
        heartbeat_at timestamptz,
        output_text text,
        error text,
        input_tokens integer not null default 0,
        output_tokens integer not null default 0,
        cost_cents integer not null default 0,
        meta jsonb not null default '{}'::jsonb
      );`,
      `create index if not exists async_jobs_customer_created_idx on async_jobs(customer_id, created_at desc);`,
      `create index if not exists async_jobs_status_idx on async_jobs(status, created_at desc);`,
      `create table if not exists gateway_events (
        id bigserial primary key,
        request_id text,
        level text not null default 'info',
        kind text not null,
        function_name text not null,
        method text,
        path text,
        origin text,
        referer text,
        user_agent text,
        ip text,
        app_id text,
        build_id text,
        customer_id bigint,
        api_key_id bigint,
        provider text,
        model text,
        http_status integer,
        duration_ms integer,
        error_code text,
        error_message text,
        error_stack text,
        upstream_status integer,
        upstream_body text,
        extra jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );`,
      // Forward-compatible patching: if gateway_events existed from an older build,
      // it may be missing columns used by monitor inserts.
      `alter table gateway_events add column if not exists request_id text;`,
      `alter table gateway_events add column if not exists level text not null default 'info';`,
      `alter table gateway_events add column if not exists kind text not null default 'event';`,
      `alter table gateway_events add column if not exists function_name text not null default 'unknown';`,
      `alter table gateway_events add column if not exists method text;`,
      `alter table gateway_events add column if not exists path text;`,
      `alter table gateway_events add column if not exists origin text;`,
      `alter table gateway_events add column if not exists referer text;`,
      `alter table gateway_events add column if not exists user_agent text;`,
      `alter table gateway_events add column if not exists ip text;`,
      `alter table gateway_events add column if not exists app_id text;`,
      `alter table gateway_events add column if not exists build_id text;`,
      `alter table gateway_events add column if not exists customer_id bigint;`,
      `alter table gateway_events add column if not exists api_key_id bigint;`,
      `alter table gateway_events add column if not exists provider text;`,
      `alter table gateway_events add column if not exists model text;`,
      `alter table gateway_events add column if not exists http_status integer;`,
      `alter table gateway_events add column if not exists duration_ms integer;`,
      `alter table gateway_events add column if not exists error_code text;`,
      `alter table gateway_events add column if not exists error_message text;`,
      `alter table gateway_events add column if not exists error_stack text;`,
      `alter table gateway_events add column if not exists upstream_status integer;`,
      `alter table gateway_events add column if not exists upstream_body text;`,
      `alter table gateway_events add column if not exists extra jsonb not null default '{}'::jsonb;`,
      `alter table gateway_events add column if not exists created_at timestamptz not null default now();`,
      `create index if not exists gateway_events_created_idx on gateway_events(created_at desc);`,
      `create index if not exists gateway_events_request_idx on gateway_events(request_id);`,
      `create index if not exists gateway_events_level_idx on gateway_events(level, created_at desc);`,
      `create index if not exists gateway_events_fn_idx on gateway_events(function_name, created_at desc);`,
      `create index if not exists gateway_events_app_idx on gateway_events(app_id, created_at desc);`,
      // --- KaixuPush (Deploy Push) enterprise tables ---
      `alter table api_keys add column if not exists role text not null default 'deployer';`,
      `create index if not exists api_keys_role_idx on api_keys(role);`,
      `create table if not exists customer_netlify_tokens (
        customer_id bigint primary key references customers(id) on delete cascade,
        token_enc text not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `create table if not exists push_projects (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        project_id text not null,
        name text not null,
        netlify_site_id text not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (customer_id, project_id)
      );`,
      `create index if not exists push_projects_customer_idx on push_projects(customer_id, created_at desc);`,
      `create table if not exists push_pushes (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        api_key_id bigint not null references api_keys(id) on delete cascade,
        project_row_id bigint not null references push_projects(id) on delete cascade,
        push_id text not null unique,
        branch text not null,
        title text,
        deploy_id text not null,
        state text not null,
        required_digests text[] not null default '{}'::text[],
        uploaded_digests text[] not null default '{}'::text[],
        file_manifest jsonb not null default '{}'::jsonb,
        url text,
        error text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `alter table push_pushes add column if not exists file_manifest jsonb not null default '{}'::jsonb;`,
      `create index if not exists push_pushes_customer_idx on push_pushes(customer_id, created_at desc);`,
      `create table if not exists push_jobs (
        id bigserial primary key,
        push_row_id bigint not null references push_pushes(id) on delete cascade,
        sha1 char(40) not null,
        deploy_path text not null,
        parts integer not null,
        received_parts integer[] not null default '{}'::int[],
        part_bytes jsonb not null default '{}'::jsonb,
        bytes_staged bigint not null default 0,
        status text not null default 'uploading',
        error text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (push_row_id, sha1)
      );`,
      `create index if not exists push_jobs_push_idx on push_jobs(push_row_id, updated_at desc);`,
      `alter table push_jobs add column if not exists bytes_staged bigint not null default 0;`,
      `alter table push_jobs add column if not exists part_bytes jsonb not null default '{}'::jsonb;`,
      `alter table push_jobs add column if not exists attempts integer not null default 0;`,
      `alter table push_jobs add column if not exists next_attempt_at timestamptz;`,
      `alter table push_jobs add column if not exists last_error text;`,
      `alter table push_jobs add column if not exists last_error_at timestamptz;`,
      `create table if not exists push_rate_windows (
        customer_id bigint not null references customers(id) on delete cascade,
        bucket_type text not null,
        bucket_start timestamptz not null,
        count integer not null default 0,
        primary key(customer_id, bucket_type, bucket_start)
      );`,
      `create index if not exists push_rate_windows_bucket_idx on push_rate_windows(bucket_type, bucket_start desc);`,
      `create table if not exists push_files (
        id bigserial primary key,
        push_row_id bigint not null references push_pushes(id) on delete cascade,
        deploy_path text not null,
        sha1 char(40) not null,
        bytes bigint not null default 0,
        mode text not null default 'direct',
        created_at timestamptz not null default now()
      );`,
      `create index if not exists push_files_push_idx on push_files(push_row_id);`,
      `create table if not exists push_usage_events (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        api_key_id bigint not null references api_keys(id) on delete cascade,
        push_row_id bigint references push_pushes(id) on delete set null,
        event_type text not null,
        bytes bigint not null default 0,
        pricing_version integer not null default 1,
        cost_cents integer not null default 0,
        meta jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );`,
      `create index if not exists push_usage_customer_idx on push_usage_events(customer_id, created_at desc);`,
      `create table if not exists push_pricing_versions (
        version integer primary key,
        effective_from date not null default current_date,
        currency text not null default 'USD',
        base_month_cents integer not null default 0,
        per_deploy_cents integer not null default 0,
        per_gb_cents integer not null default 0,
        created_at timestamptz not null default now()
      );`,
      `insert into push_pricing_versions(version, base_month_cents, per_deploy_cents, per_gb_cents)
       values (1, 0, 10, 25) on conflict (version) do nothing;`,
      `create table if not exists customer_push_billing (
        customer_id bigint primary key references customers(id) on delete cascade,
        pricing_version integer not null references push_pricing_versions(version),
        monthly_cap_cents integer not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `create table if not exists push_invoices (
        customer_id bigint not null references customers(id) on delete cascade,
        month text not null,
        pricing_version integer not null references push_pricing_versions(version),
        total_cents integer not null,
        breakdown jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (customer_id, month)
      );`,
      // ------------------------------
      // GitHub Push Gateway (optional)
      // ------------------------------
      `create table if not exists customer_github_tokens (
        customer_id bigint primary key references customers(id) on delete cascade,
        token_enc text not null,
        token_type text not null default 'oauth',
        scopes text[] not null default '{}'::text[],
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `create table if not exists gh_push_jobs (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        api_key_id bigint not null references api_keys(id) on delete cascade,
        job_id text not null unique,
        owner text not null,
        repo text not null,
        branch text not null default 'main',
        commit_message text not null default 'Kaixu GitHub Push',
        parts integer not null default 0,
        received_parts integer[] not null default '{}'::int[],
        part_bytes jsonb not null default '{}'::jsonb,
        bytes_staged bigint not null default 0,
        status text not null default 'uploading',
        attempts integer not null default 0,
        next_attempt_at timestamptz,
        last_error text,
        last_error_at timestamptz,
        result_commit_sha text,
        result_url text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `create index if not exists gh_push_jobs_customer_idx on gh_push_jobs(customer_id, updated_at desc);`,
      `create index if not exists gh_push_jobs_next_attempt_idx on gh_push_jobs(next_attempt_at) where status in ('retry_wait','error_transient');`,
      `create table if not exists gh_push_events (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        api_key_id bigint not null references api_keys(id) on delete cascade,
        job_row_id bigint not null references gh_push_jobs(id) on delete cascade,
        event_type text not null,
        bytes bigint not null default 0,
        meta jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );`,
      `create index if not exists gh_push_events_job_idx on gh_push_events(job_row_id, created_at desc);`,
      `create table if not exists voice_numbers (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        phone_number text not null unique,
        provider text not null default 'twilio',
        twilio_sid text,
        is_active boolean not null default true,
        default_llm_provider text not null default 'openai',
        default_llm_model text not null default 'gpt-4.1-mini',
        voice_name text not null default 'alloy',
        locale text not null default 'en-US',
        timezone text not null default 'America/Phoenix',
        playbook jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );`,
      `create index if not exists voice_numbers_customer_idx on voice_numbers(customer_id);`,
      `create table if not exists voice_calls (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        voice_number_id bigint references voice_numbers(id) on delete set null,
        provider text not null default 'twilio',
        provider_call_sid text not null,
        from_number text,
        to_number text,
        status text not null default 'initiated',
        direction text not null default 'inbound',
        started_at timestamptz not null default now(),
        ended_at timestamptz,
        duration_seconds integer,
        est_cost_cents integer not null default 0,
        bill_cost_cents integer not null default 0,
        meta jsonb not null default '{}'::jsonb
      );`,
      `create unique index if not exists voice_calls_provider_sid_uq on voice_calls(provider, provider_call_sid);`,
      `create index if not exists voice_calls_customer_idx on voice_calls(customer_id, started_at desc);`,
      `create table if not exists voice_call_messages (
        id bigserial primary key,
        call_id bigint not null references voice_calls(id) on delete cascade,
        role text not null, -- user|assistant|system|tool
        content text not null,
        created_at timestamptz not null default now()
      );`,
      `create index if not exists voice_call_messages_call_idx on voice_call_messages(call_id, id);`,
      `create table if not exists voice_usage_monthly (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        month text not null,
        minutes numeric not null default 0,
        est_cost_cents integer not null default 0,
        bill_cost_cents integer not null default 0,
        calls integer not null default 0,
        created_at timestamptz not null default now(),
        unique(customer_id, month)
      );`,
      `create index if not exists voice_usage_monthly_customer_idx on voice_usage_monthly(customer_id, month);`
    ];
    for (const s of statements) {
      await sql.query(s);
    }
  })();
  return _schemaPromise;
}
async function q(text, params = []) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(text, params);
  return { rows: rows || [], rowCount: Array.isArray(rows) ? rows.length : 0 };
}

// netlify/functions/_lib/providers.js
function configError(message, hint) {
  const err = new Error(message);
  err.code = "CONFIG";
  err.status = 500;
  if (hint) err.hint = hint;
  return err;
}
function safeJsonString(v, max = 12e3) {
  try {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    if (!s) return "";
    if (s.length <= max) return s;
    return s.slice(0, max) + `\u2026(+${s.length - max} chars)`;
  } catch {
    const s = String(v || "");
    if (s.length <= max) return s;
    return s.slice(0, max) + `\u2026(+${s.length - max} chars)`;
  }
}
function upstreamError(provider, res, body) {
  const status = res?.status || 0;
  const reqId = res?.headers?.get?.("x-request-id") || res?.headers?.get?.("request-id") || res?.headers?.get?.("x-amzn-requestid") || null;
  let msg = "";
  try {
    msg = body?.error?.message || body?.error?.type || body?.message || "";
  } catch {
  }
  const err = new Error(msg ? `${provider} upstream error ${status}: ${msg}` : `${provider} upstream error ${status}`);
  err.code = "UPSTREAM_ERROR";
  err.status = 502;
  err.upstream = {
    provider,
    status,
    request_id: reqId,
    body: safeJsonString(body)
  };
  return err;
}
async function callOpenAI({ model, messages, max_tokens, temperature }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw configError("OPENAI_API_KEY not configured", "Set OPENAI_API_KEY in Netlify \u2192 Site configuration \u2192 Environment variables (your OpenAI API key).");
  const input = Array.isArray(messages) ? messages.map((m) => ({
    role: m.role,
    content: [{ type: "input_text", text: String(m.content ?? "") }]
  })) : [];
  const body = {
    model,
    input,
    temperature: typeof temperature === "number" ? temperature : 1,
    max_output_tokens: typeof max_tokens === "number" ? max_tokens : 1024,
    store: false
  };
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw upstreamError("openai", res, data);
  let out = "";
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (item?.type === "message" && Array.isArray(item.content)) {
      for (const c of item.content) {
        if (c?.type === "output_text" && typeof c.text === "string") out += c.text;
      }
    }
  }
  const usage = data.usage || {};
  return { output_text: out, input_tokens: usage.input_tokens || 0, output_tokens: usage.output_tokens || 0, raw: data };
}
async function callAnthropic({ model, messages, max_tokens, temperature }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw configError("ANTHROPIC_API_KEY not configured", "Set ANTHROPIC_API_KEY in Netlify \u2192 Site configuration \u2192 Environment variables (your Anthropic API key).");
  const systemParts = [];
  const outMsgs = [];
  const msgs = Array.isArray(messages) ? messages : [];
  for (const m of msgs) {
    const role = String(m.role || "").toLowerCase();
    const text2 = String(m.content ?? "");
    if (!text2) continue;
    if (role === "system" || role === "developer") systemParts.push(text2);
    else if (role === "assistant") outMsgs.push({ role: "assistant", content: text2 });
    else outMsgs.push({ role: "user", content: text2 });
  }
  const body = {
    model,
    max_tokens: typeof max_tokens === "number" ? max_tokens : 1024,
    temperature: typeof temperature === "number" ? temperature : 1,
    messages: outMsgs
  };
  if (systemParts.length) body.system = systemParts.join("\n\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw upstreamError("anthropic", res, data);
  const text = Array.isArray(data?.content) ? data.content.map((c) => c?.text || "").join("") : data?.content?.[0]?.text || data?.completion || "";
  const usage = data?.usage || {};
  return { output_text: text, input_tokens: usage.input_tokens || 0, output_tokens: usage.output_tokens || 0, raw: data };
}
async function callGemini({ model, messages, max_tokens, temperature }) {
  const apiKeyRaw = process.env.GEMINI_API_KEY_LOCAL || process.env.GEMINI_API_KEY;
  const apiKey = String(apiKeyRaw || "").trim().replace(/^"(.*)"$/, "$1").trim();
  if (!apiKey) throw configError("GEMINI_API_KEY not configured", "Set GEMINI_API_KEY (or for local dev: GEMINI_API_KEY_LOCAL) in Netlify \u2192 Site configuration \u2192 Environment variables.");
  const systemParts = [];
  const contents = [];
  const msgs = Array.isArray(messages) ? messages : [];
  for (const m of msgs) {
    const role = m.role;
    const text = String(m.content ?? "");
    if (role === "system") systemParts.push(text);
    else if (role === "assistant") contents.push({ role: "model", parts: [{ text }] });
    else contents.push({ role: "user", parts: [{ text }] });
  }
  const body = {
    contents,
    generationConfig: {
      maxOutputTokens: typeof max_tokens === "number" ? max_tokens : 1024,
      temperature: typeof temperature === "number" ? temperature : 1
    }
  };
  if (systemParts.length) body.systemInstruction = { parts: [{ text: systemParts.join("\n\n") }] };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw upstreamError("gemini", res, data);
  let out = "";
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  for (const cand of candidates) {
    const content = cand?.content;
    if (content?.parts) {
      for (const p of content.parts) if (typeof p.text === "string") out += p.text;
    }
    if (out) break;
  }
  const usage = data.usageMetadata || {};
  return { output_text: out, input_tokens: usage.promptTokenCount || 0, output_tokens: usage.candidatesTokenCount || 0, raw: data };
}

// netlify/functions/_lib/pricing.js
import fs from "fs";
import path from "path";
var cache = null;
function loadPricing() {
  if (cache) return cache;
  const p = path.join(process.cwd(), "pricing", "pricing.json");
  const raw = fs.readFileSync(p, "utf8");
  cache = JSON.parse(raw);
  return cache;
}
function unpricedError(provider, model) {
  const err = new Error(`Unpriced model: ${provider}:${model}`);
  err.code = "UNPRICED_MODEL";
  err.status = 409;
  err.hint = "This model/provider is not enabled for billing. Ask an admin to add it to pricing/pricing.json (and allowlists).";
  return err;
}
function costCents(provider, model, inputTokens, outputTokens) {
  const pricing = loadPricing();
  const entry = pricing?.[provider]?.[model];
  if (!entry) throw unpricedError(provider, model);
  const inRate = Number(entry.input_per_1m_usd);
  const outRate = Number(entry.output_per_1m_usd);
  if (!Number.isFinite(inRate) || !Number.isFinite(outRate)) throw unpricedError(provider, model);
  const inUsd = Number(inputTokens || 0) / 1e6 * inRate;
  const outUsd = Number(outputTokens || 0) / 1e6 * outRate;
  const totalUsd = inUsd + outUsd;
  return Math.max(0, Math.round(totalUsd * 100));
}

// netlify/functions/_lib/http.js
function getBearer(req) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}
function monthKeyUTC(d = /* @__PURE__ */ new Date()) {
  return d.toISOString().slice(0, 7);
}

// netlify/functions/_lib/crypto.js
import crypto from "crypto";
function configError2(message, hint) {
  const err = new Error(message);
  err.code = "CONFIG";
  err.status = 500;
  if (hint) err.hint = hint;
  return err;
}
function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}
function hmacSha256Hex(secret, input) {
  return crypto.createHmac("sha256", secret).update(input).digest("hex");
}
function keyHashHex(input) {
  const pepper = process.env.KEY_PEPPER;
  if (pepper) return hmacSha256Hex(pepper, input);
  return sha256Hex(input);
}
function legacyKeyHashHex(input) {
  return sha256Hex(input);
}
function verifyJwt(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw configError2(
      "Missing JWT_SECRET",
      "Set JWT_SECRET in Netlify \u2192 Site configuration \u2192 Environment variables (use a long random string)."
    );
  }
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = base64url(crypto.createHmac("sha256", secret).update(data).digest());
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(s);
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
    );
    const now = Math.floor(Date.now() / 1e3);
    if (payload.exp && now > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// netlify/functions/_lib/authz.js
function baseSelect() {
  return `select k.id as api_key_id, k.customer_id, k.key_last4, k.label, k.role,
                 k.monthly_cap_cents as key_cap_cents, k.rpm_limit, k.rpd_limit,
                 k.max_devices, k.require_install_id, k.allowed_providers, k.allowed_models,
                 c.monthly_cap_cents as customer_cap_cents, c.is_active,
                 c.max_devices_per_key as customer_max_devices_per_key, c.require_install_id as customer_require_install_id,
                 c.allowed_providers as customer_allowed_providers, c.allowed_models as customer_allowed_models,
                 c.plan_name as customer_plan_name, c.email as customer_email
          from api_keys k
          join customers c on c.id = k.customer_id`;
}
async function lookupKey(plainKey) {
  const preferred = keyHashHex(plainKey);
  let keyRes = await q(
    `${baseSelect()}
     where k.key_hash=$1 and k.revoked_at is null
     limit 1`,
    [preferred]
  );
  if (keyRes.rowCount) return keyRes.rows[0];
  if (process.env.KEY_PEPPER) {
    const legacy = legacyKeyHashHex(plainKey);
    keyRes = await q(
      `${baseSelect()}
       where k.key_hash=$1 and k.revoked_at is null
       limit 1`,
      [legacy]
    );
    if (!keyRes.rowCount) return null;
    const row = keyRes.rows[0];
    try {
      await q(
        `update api_keys set key_hash=$1
         where id=$2 and key_hash=$3`,
        [preferred, row.api_key_id, legacy]
      );
    } catch {
    }
    return row;
  }
  return null;
}
async function lookupKeyById(api_key_id) {
  const keyRes = await q(
    `${baseSelect()}
     where k.id=$1 and k.revoked_at is null
     limit 1`,
    [api_key_id]
  );
  if (!keyRes.rowCount) return null;
  return keyRes.rows[0];
}
async function resolveAuth(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length === 3) {
    const payload = verifyJwt(token);
    if (!payload) return null;
    if (payload.type !== "user_session") return null;
    const row = await lookupKeyById(payload.api_key_id);
    return row;
  }
  return await lookupKey(token);
}
async function getMonthRollup(customer_id, month = monthKeyUTC()) {
  const roll = await q(
    `select spent_cents, extra_cents, input_tokens, output_tokens
     from monthly_usage where customer_id=$1 and month=$2`,
    [customer_id, month]
  );
  if (roll.rowCount === 0) return { spent_cents: 0, extra_cents: 0, input_tokens: 0, output_tokens: 0 };
  return roll.rows[0];
}
async function getKeyMonthRollup(api_key_id, month = monthKeyUTC()) {
  const roll = await q(
    `select spent_cents, input_tokens, output_tokens, calls
     from monthly_key_usage where api_key_id=$1 and month=$2`,
    [api_key_id, month]
  );
  if (roll.rowCount) return roll.rows[0];
  const keyMeta = await q(`select customer_id from api_keys where id=$1`, [api_key_id]);
  const customer_id = keyMeta.rowCount ? keyMeta.rows[0].customer_id : null;
  const agg = await q(
    `select coalesce(sum(cost_cents),0)::int as spent_cents,
            coalesce(sum(input_tokens),0)::int as input_tokens,
            coalesce(sum(output_tokens),0)::int as output_tokens,
            count(*)::int as calls
     from usage_events
     where api_key_id=$1 and to_char(created_at at time zone 'UTC','YYYY-MM')=$2`,
    [api_key_id, month]
  );
  const row = agg.rows[0] || { spent_cents: 0, input_tokens: 0, output_tokens: 0, calls: 0 };
  if (customer_id != null) {
    await q(
      `insert into monthly_key_usage(api_key_id, customer_id, month, spent_cents, input_tokens, output_tokens, calls)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (api_key_id, month)
       do update set
         spent_cents = excluded.spent_cents,
         input_tokens = excluded.input_tokens,
         output_tokens = excluded.output_tokens,
         calls = excluded.calls,
         updated_at = now()`,
      [api_key_id, customer_id, month, row.spent_cents || 0, row.input_tokens || 0, row.output_tokens || 0, row.calls || 0]
    );
  }
  return row;
}
function customerCapCents(keyRow, customerRollup) {
  const base = keyRow.customer_cap_cents || 0;
  const extra = customerRollup.extra_cents || 0;
  return base + extra;
}
function keyCapCents(keyRow, customerRollup) {
  if (keyRow.key_cap_cents != null) return keyRow.key_cap_cents;
  return customerCapCents(keyRow, customerRollup);
}

// netlify/functions/_lib/allowlist.js
function normArray(a) {
  if (!a) return null;
  if (Array.isArray(a)) return a.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof a === "string") return a.split(",").map((s) => s.trim()).filter(Boolean);
  return null;
}
function parseAllowedModels(m) {
  if (!m) return null;
  if (typeof m === "object") return m;
  try {
    return JSON.parse(String(m));
  } catch {
    return null;
  }
}
function effectiveAllowlist(keyRow) {
  const providers = normArray(keyRow.allowed_providers) ?? normArray(keyRow.customer_allowed_providers);
  const models = parseAllowedModels(keyRow.allowed_models) ?? parseAllowedModels(keyRow.customer_allowed_models);
  return { providers, models };
}
function assertAllowed({ provider, model, keyRow }) {
  const { providers, models } = effectiveAllowlist(keyRow);
  if (providers && providers.length) {
    if (!providers.includes("*") && !providers.includes(provider)) {
      return { ok: false, status: 403, error: `Provider not allowed for this key (${provider})` };
    }
  }
  if (models) {
    if (models["*"]) {
      const arr = normArray(models["*"]);
      if (arr && arr.includes("*")) return { ok: true };
    }
    const list = models[provider];
    if (list) {
      const arr = normArray(list) || [];
      if (arr.includes("*")) return { ok: true };
      if (!arr.includes(model)) {
        return { ok: false, status: 403, error: `Model not allowed for this key (${provider}:${model})` };
      }
    } else {
      return { ok: false, status: 403, error: `Provider not allowed by model allowlist (${provider})` };
    }
  }
  return { ok: true };
}

// netlify/functions/_lib/devices.js
async function enforceDevice({ keyRow, install_id, ua, actor = "gateway" }) {
  const requireInstall = !!(keyRow.require_install_id || keyRow.customer_require_install_id);
  const maxDevices = (Number.isFinite(keyRow.max_devices) ? keyRow.max_devices : null) ?? (Number.isFinite(keyRow.customer_max_devices_per_key) ? keyRow.customer_max_devices_per_key : null);
  if ((requireInstall || maxDevices != null && maxDevices > 0) && !install_id) {
    return { ok: false, status: 400, error: "Missing x-kaixu-install-id (required for this key)" };
  }
  if (!install_id) return { ok: true };
  const existing = await q(
    `select api_key_id, install_id, first_seen_at, last_seen_at, revoked_at
     from key_devices
     where api_key_id=$1 and install_id=$2
     limit 1`,
    [keyRow.api_key_id, install_id]
  );
  if (existing.rowCount) {
    const row = existing.rows[0];
    if (row.revoked_at) {
      return { ok: false, status: 403, error: "Device revoked for this key" };
    }
    await q(
      `update key_devices set last_seen_at=now(), last_seen_ua=coalesce($3,last_seen_ua)
       where api_key_id=$1 and install_id=$2`,
      [keyRow.api_key_id, install_id, ua || null]
    );
    return { ok: true };
  }
  if (maxDevices != null && maxDevices > 0) {
    const activeCount = await q(
      `select count(*)::int as n
       from key_devices
       where api_key_id=$1 and revoked_at is null`,
      [keyRow.api_key_id]
    );
    const n = activeCount.rows?.[0]?.n ?? 0;
    if (n >= maxDevices) {
      return { ok: false, status: 403, error: `Device limit reached (${n}/${maxDevices}). Revoke an old device or raise seats.` };
    }
  }
  await q(
    `insert into key_devices(api_key_id, customer_id, install_id, last_seen_at, last_seen_ua)
     values ($1,$2,$3,now(),$4)
     on conflict (api_key_id, install_id)
     do update set last_seen_at=excluded.last_seen_at, last_seen_ua=coalesce(excluded.last_seen_ua,key_devices.last_seen_ua)`,
    [keyRow.api_key_id, keyRow.customer_id, install_id, ua || null]
  );
  return { ok: true };
}

// netlify/functions/gateway-job-run-background.js
var gateway_job_run_background_default = async (req) => {
  if (req.method !== "POST") return;
  const secret = (process.env.JOB_WORKER_SECRET || "").trim();
  const gotSecret = (req.headers.get("x-kaixu-job-secret") || req.headers.get("x-job-worker-secret") || "").trim();
  let body;
  try {
    body = await req.json();
  } catch {
    return;
  }
  const id = (body?.id || "").toString().trim();
  if (!id) return;
  const jr = await q(`select * from async_jobs where id = $1`, [id]);
  if (!jr.rows.length) return;
  const job = jr.rows[0];
  if (job.status === "succeeded" || job.status === "failed") return;
  if (secret) {
    if (!gotSecret || gotSecret !== secret) return;
  } else {
    const token = getBearer(req);
    if (!token) return;
    const invoker = await resolveAuth(token);
    if (!invoker) return;
    if (String(invoker.api_key_id) !== String(job.api_key_id)) return;
    if (String(invoker.customer_id) !== String(job.customer_id)) return;
    if (!invoker.is_active) return;
  }
  const keyRow = await lookupKeyById(job.api_key_id);
  if (!keyRow) {
    await q(
      `update async_jobs set status='failed', completed_at=now(), heartbeat_at=now(), error=$2 where id=$1`,
      [id, "Invalid or revoked key"]
    );
    return;
  }
  if (String(keyRow.customer_id) !== String(job.customer_id)) {
    await q(
      `update async_jobs set status='failed', completed_at=now(), heartbeat_at=now(), error=$2 where id=$1`,
      [id, "Job ownership mismatch"]
    );
    return;
  }
  if (!keyRow.is_active) {
    await q(
      `update async_jobs set status='failed', completed_at=now(), heartbeat_at=now(), error=$2 where id=$1`,
      [id, "Customer disabled"]
    );
    return;
  }
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
  let meta = {};
  try {
    meta = typeof job.meta === "string" ? JSON.parse(job.meta) : job.meta || {};
  } catch {
    meta = job.meta || {};
  }
  const telemetry = meta?.telemetry || {};
  const install_id = (telemetry.install_id || "").toString().trim().slice(0, 80) || null;
  const ip_hash = (telemetry.ip_hash || "").toString().trim().slice(0, 128) || null;
  const ua = (telemetry.ua || "").toString().trim().slice(0, 240) || null;
  const provider = String(job.provider || request.provider || "").toLowerCase();
  const model = String(job.model || request.model || "");
  const messages = Array.isArray(request.messages) ? request.messages : [];
  const max_tokens = Number.isFinite(request.max_tokens) ? parseInt(request.max_tokens, 10) : 4096;
  const temperature = Number.isFinite(request.temperature) ? request.temperature : 1;
  const allow = assertAllowed({ provider, model, keyRow });
  if (!allow.ok) {
    await q(
      `update async_jobs set status='failed', completed_at=now(), heartbeat_at=now(), error=$2 where id=$1`,
      [id, allow.error || "Forbidden"]
    );
    return;
  }
  const dev = await enforceDevice({ keyRow, install_id, ua, actor: "job_worker" });
  if (!dev.ok) {
    await q(
      `update async_jobs set status='failed', completed_at=now(), heartbeat_at=now(), error=$2 where id=$1`,
      [id, dev.error || "Device not allowed"]
    );
    return;
  }
  const month = monthKeyUTC();
  const custRoll = await getMonthRollup(keyRow.customer_id, month);
  const keyRoll = await getKeyMonthRollup(keyRow.api_key_id, month);
  const customer_cap_cents = customerCapCents(keyRow, custRoll);
  const key_cap_cents = keyCapCents(keyRow, custRoll);
  if ((custRoll.spent_cents || 0) >= customer_cap_cents) {
    await q(
      `update async_jobs set status='failed', completed_at=now(), heartbeat_at=now(), error=$2 where id=$1`,
      [id, `Monthly cap reached (customer)`]
    );
    return;
  }
  if ((keyRoll.spent_cents || 0) >= key_cap_cents) {
    await q(
      `update async_jobs set status='failed', completed_at=now(), heartbeat_at=now(), error=$2 where id=$1`,
      [id, `Monthly cap reached (key)`]
    );
    return;
  }
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
    const meta2 = {
      raw: result.raw || null,
      max_tokens,
      temperature
    };
    await q(
      `update async_jobs set status='succeeded', completed_at=now(), heartbeat_at=now(),
        output_text=$2, input_tokens=$3, output_tokens=$4, cost_cents=$5, meta=$6::jsonb
       where id=$1`,
      [id, output_text, input_tokens, output_tokens, cost_cents, JSON.stringify(meta2)]
    );
    const month2 = monthKeyUTC();
    await q(
      `insert into usage_events(customer_id, api_key_id, provider, model, input_tokens, output_tokens, cost_cents, install_id, ip_hash, ua)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [job.customer_id, job.api_key_id, provider, model, input_tokens, output_tokens, cost_cents, install_id, ip_hash, ua]
    );
    await q(
      `update api_keys
       set last_seen_at=now(),
           last_seen_install_id = coalesce($1, last_seen_install_id)
       where id=$2`,
      [install_id, job.api_key_id]
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
      [job.customer_id, month2, cost_cents, input_tokens, output_tokens]
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
      [job.api_key_id, job.customer_id, month2, cost_cents, input_tokens, output_tokens, 1]
    );
  } catch (e) {
    const msg = e?.message || "Job failed";
    await q(
      `update async_jobs set status='failed', completed_at=now(), heartbeat_at=now(), error=$2 where id=$1`,
      [id, msg]
    );
  }
};
export {
  gateway_job_run_background_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9kYi5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL3Byb3ZpZGVycy5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL3ByaWNpbmcuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9odHRwLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvY3J5cHRvLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvYXV0aHouanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9hbGxvd2xpc3QuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9kZXZpY2VzLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL2dhdGV3YXktam9iLXJ1bi1iYWNrZ3JvdW5kLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBuZW9uIH0gZnJvbSBcIkBuZXRsaWZ5L25lb25cIjtcblxuLyoqXG4gKiBOZXRsaWZ5IERCIChOZW9uIFBvc3RncmVzKSBoZWxwZXIuXG4gKlxuICogSU1QT1JUQU5UIChOZW9uIHNlcnZlcmxlc3MgZHJpdmVyLCAyMDI1Kyk6XG4gKiAtIGBuZW9uKClgIHJldHVybnMgYSB0YWdnZWQtdGVtcGxhdGUgcXVlcnkgZnVuY3Rpb24uXG4gKiAtIEZvciBkeW5hbWljIFNRTCBzdHJpbmdzICsgJDEgcGxhY2Vob2xkZXJzLCB1c2UgYHNxbC5xdWVyeSh0ZXh0LCBwYXJhbXMpYC5cbiAqICAgKENhbGxpbmcgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uIGxpa2Ugc3FsKFwiU0VMRUNUIC4uLlwiKSBjYW4gYnJlYWsgb24gbmV3ZXIgZHJpdmVyIHZlcnNpb25zLilcbiAqXG4gKiBOZXRsaWZ5IERCIGF1dG9tYXRpY2FsbHkgaW5qZWN0cyBgTkVUTElGWV9EQVRBQkFTRV9VUkxgIHdoZW4gdGhlIE5lb24gZXh0ZW5zaW9uIGlzIGF0dGFjaGVkLlxuICovXG5cbmxldCBfc3FsID0gbnVsbDtcbmxldCBfc2NoZW1hUHJvbWlzZSA9IG51bGw7XG5cbmZ1bmN0aW9uIGdldFNxbCgpIHtcbiAgaWYgKF9zcWwpIHJldHVybiBfc3FsO1xuXG4gIGNvbnN0IGhhc0RiVXJsID0gISEocHJvY2Vzcy5lbnYuTkVUTElGWV9EQVRBQkFTRV9VUkwgfHwgcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMKTtcbiAgaWYgKCFoYXNEYlVybCkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcIkRhdGFiYXNlIG5vdCBjb25maWd1cmVkIChtaXNzaW5nIE5FVExJRllfREFUQUJBU0VfVVJMKS4gQXR0YWNoIE5ldGxpZnkgREIgKE5lb24pIHRvIHRoaXMgc2l0ZS5cIik7XG4gICAgZXJyLmNvZGUgPSBcIkRCX05PVF9DT05GSUdVUkVEXCI7XG4gICAgZXJyLnN0YXR1cyA9IDUwMDtcbiAgICBlcnIuaGludCA9IFwiTmV0bGlmeSBVSSBcdTIxOTIgRXh0ZW5zaW9ucyBcdTIxOTIgTmVvbiBcdTIxOTIgQWRkIGRhdGFiYXNlIChvciBydW46IG5weCBuZXRsaWZ5IGRiIGluaXQpLlwiO1xuICAgIHRocm93IGVycjtcbiAgfVxuXG4gIF9zcWwgPSBuZW9uKCk7IC8vIGF1dG8tdXNlcyBwcm9jZXNzLmVudi5ORVRMSUZZX0RBVEFCQVNFX1VSTCBvbiBOZXRsaWZ5XG4gIHJldHVybiBfc3FsO1xufVxuXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVTY2hlbWEoKSB7XG4gIGlmIChfc2NoZW1hUHJvbWlzZSkgcmV0dXJuIF9zY2hlbWFQcm9taXNlO1xuXG4gIF9zY2hlbWFQcm9taXNlID0gKGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBzcWwgPSBnZXRTcWwoKTtcbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gW1xuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVycyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgZW1haWwgdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIHBsYW5fbmFtZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3N0YXJ0ZXInLFxuICAgICAgICBtb250aGx5X2NhcF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMjAwMCxcbiAgICAgICAgaXNfYWN0aXZlIGJvb2xlYW4gbm90IG51bGwgZGVmYXVsdCB0cnVlLFxuICAgICAgICBzdHJpcGVfY3VzdG9tZXJfaWQgdGV4dCxcbiAgICAgICAgc3RyaXBlX3N1YnNjcmlwdGlvbl9pZCB0ZXh0LFxuICAgICAgICBzdHJpcGVfc3RhdHVzIHRleHQsXG4gICAgICAgIHN0cmlwZV9jdXJyZW50X3BlcmlvZF9lbmQgdGltZXN0YW1wdHosXG4gICAgICAgIGF1dG9fdG9wdXBfZW5hYmxlZCBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgZmFsc2UsXG4gICAgICAgIGF1dG9fdG9wdXBfYW1vdW50X2NlbnRzIGludGVnZXIsXG4gICAgICAgIGF1dG9fdG9wdXBfdGhyZXNob2xkX2NlbnRzIGludGVnZXIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGFwaV9rZXlzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBrZXlfaGFzaCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAga2V5X2xhc3Q0IHRleHQgbm90IG51bGwsXG4gICAgICAgIGxhYmVsIHRleHQsXG4gICAgICAgIG1vbnRobHlfY2FwX2NlbnRzIGludGVnZXIsXG4gICAgICAgIHJwbV9saW1pdCBpbnRlZ2VyLFxuICAgICAgICBycGRfbGltaXQgaW50ZWdlcixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICByZXZva2VkX2F0IHRpbWVzdGFtcHR6XG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXBpX2tleXNfY3VzdG9tZXJfaWRfaWR4IG9uIGFwaV9rZXlzKGN1c3RvbWVyX2lkKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIG1vbnRobHlfdXNhZ2UgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzcGVudF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgZXh0cmFfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIG1vbnRobHlfa2V5X3VzYWdlIChcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHNwZW50X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNhbGxzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChhcGlfa2V5X2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBtb250aGx5X2tleV91c2FnZV9jdXN0b21lcl9tb250aF9pZHggb24gbW9udGhseV9rZXlfdXNhZ2UoY3VzdG9tZXJfaWQsIG1vbnRoKTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIG1vbnRobHlfa2V5X3VzYWdlIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBjYWxscyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMDtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHVzYWdlX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1vZGVsIHRleHQgbm90IG51bGwsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzX2N1c3RvbWVyX21vbnRoX2lkeCBvbiB1c2FnZV9ldmVudHMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHNfa2V5X2lkeCBvbiB1c2FnZV9ldmVudHMoYXBpX2tleV9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGF1ZGl0X2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgYWN0b3IgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYWN0aW9uIHRleHQgbm90IG51bGwsXG4gICAgICAgIHRhcmdldCB0ZXh0LFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGF1ZGl0X2V2ZW50c19jcmVhdGVkX2lkeCBvbiBhdWRpdF9ldmVudHMoY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHJhdGVfbGltaXRfd2luZG93cyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB3aW5kb3dfc3RhcnQgdGltZXN0YW1wdHogbm90IG51bGwsXG4gICAgICAgIGNvdW50IGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIHdpbmRvd19zdGFydClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyByYXRlX2xpbWl0X3dpbmRvd3Nfd2luZG93X2lkeCBvbiByYXRlX2xpbWl0X3dpbmRvd3Mod2luZG93X3N0YXJ0IGRlc2MpO2AsICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X3NlZW5fYXQgdGltZXN0YW1wdHo7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9zZWVuX2luc3RhbGxfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHVzYWdlX2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgaW5zdGFsbF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgdXNhZ2VfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBpcF9oYXNoIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSB1c2FnZV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVhIHRleHQ7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHNfaW5zdGFsbF9pZHggb24gdXNhZ2VfZXZlbnRzKGluc3RhbGxfaWQpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgYWxlcnRzX3NlbnQgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYWxlcnRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgbW9udGgsIGFsZXJ0X3R5cGUpXG4gICAgICApO2AsXG4gICAgXG4gICAgICAvLyAtLS0gRGV2aWNlIGJpbmRpbmcgLyBzZWF0cyAtLS1cbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1heF9kZXZpY2VzX3Blcl9rZXkgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVxdWlyZV9pbnN0YWxsX2lkIGJvb2xlYW4gbm90IG51bGwgZGVmYXVsdCBmYWxzZTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9wcm92aWRlcnMgdGV4dFtdO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhbGxvd2VkX21vZGVscyBqc29uYjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgc3RyaXBlX2N1cnJlbnRfcGVyaW9kX2VuZCB0aW1lc3RhbXB0ejtgLFxuXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1heF9kZXZpY2VzIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVxdWlyZV9pbnN0YWxsX2lkIGJvb2xlYW47YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9wcm92aWRlcnMgdGV4dFtdO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfbW9kZWxzIGpzb25iO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBrZXlfZGV2aWNlcyAoXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBpbnN0YWxsX2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIGRldmljZV9sYWJlbCB0ZXh0LFxuICAgICAgICBmaXJzdF9zZWVuX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIGxhc3Rfc2Vlbl9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgbGFzdF9zZWVuX3VhIHRleHQsXG4gICAgICAgIHJldm9rZWRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIHJldm9rZWRfYnkgdGV4dCxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGFwaV9rZXlfaWQsIGluc3RhbGxfaWQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMga2V5X2RldmljZXNfY3VzdG9tZXJfaWR4IG9uIGtleV9kZXZpY2VzKGN1c3RvbWVyX2lkKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGtleV9kZXZpY2VzX2xhc3Rfc2Vlbl9pZHggb24ga2V5X2RldmljZXMobGFzdF9zZWVuX2F0IGRlc2MpO2AsXG5cbiAgICAgIC8vIC0tLSBJbnZvaWNlIHNuYXBzaG90cyArIHRvcHVwcyAtLS1cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBtb250aGx5X2ludm9pY2VzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc25hcHNob3QganNvbmIgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHRvcHVwX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYW1vdW50X2NlbnRzIGludGVnZXIgbm90IG51bGwsXG4gICAgICAgIHNvdXJjZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ21hbnVhbCcsXG4gICAgICAgIHN0cmlwZV9zZXNzaW9uX2lkIHRleHQsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2FwcGxpZWQnLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB0b3B1cF9ldmVudHNfY3VzdG9tZXJfbW9udGhfaWR4IG9uIHRvcHVwX2V2ZW50cyhjdXN0b21lcl9pZCwgbW9udGgpO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhc3luY19qb2JzIChcbiAgICAgICAgaWQgdXVpZCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1vZGVsIHRleHQgbm90IG51bGwsXG4gICAgICAgIHJlcXVlc3QganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAncXVldWVkJyxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBzdGFydGVkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBjb21wbGV0ZWRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGhlYXJ0YmVhdF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgb3V0cHV0X3RleHQgdGV4dCxcbiAgICAgICAgZXJyb3IgdGV4dCxcbiAgICAgICAgaW5wdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmJcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhc3luY19qb2JzX2N1c3RvbWVyX2NyZWF0ZWRfaWR4IG9uIGFzeW5jX2pvYnMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhc3luY19qb2JzX3N0YXR1c19pZHggb24gYXN5bmNfam9icyhzdGF0dXMsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICBcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgcmVxdWVzdF9pZCB0ZXh0LFxuICAgICAgICBsZXZlbCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luZm8nLFxuICAgICAgICBraW5kIHRleHQgbm90IG51bGwsXG4gICAgICAgIGZ1bmN0aW9uX25hbWUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbWV0aG9kIHRleHQsXG4gICAgICAgIHBhdGggdGV4dCxcbiAgICAgICAgb3JpZ2luIHRleHQsXG4gICAgICAgIHJlZmVyZXIgdGV4dCxcbiAgICAgICAgdXNlcl9hZ2VudCB0ZXh0LFxuICAgICAgICBpcCB0ZXh0LFxuICAgICAgICBhcHBfaWQgdGV4dCxcbiAgICAgICAgYnVpbGRfaWQgdGV4dCxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50LFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCxcbiAgICAgICAgbW9kZWwgdGV4dCxcbiAgICAgICAgaHR0cF9zdGF0dXMgaW50ZWdlcixcbiAgICAgICAgZHVyYXRpb25fbXMgaW50ZWdlcixcbiAgICAgICAgZXJyb3JfY29kZSB0ZXh0LFxuICAgICAgICBlcnJvcl9tZXNzYWdlIHRleHQsXG4gICAgICAgIGVycm9yX3N0YWNrIHRleHQsXG4gICAgICAgIHVwc3RyZWFtX3N0YXR1cyBpbnRlZ2VyLFxuICAgICAgICB1cHN0cmVhbV9ib2R5IHRleHQsXG4gICAgICAgIGV4dHJhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuXG4gICAgICAvLyBGb3J3YXJkLWNvbXBhdGlibGUgcGF0Y2hpbmc6IGlmIGdhdGV3YXlfZXZlbnRzIGV4aXN0ZWQgZnJvbSBhbiBvbGRlciBidWlsZCxcbiAgICAgIC8vIGl0IG1heSBiZSBtaXNzaW5nIGNvbHVtbnMgdXNlZCBieSBtb25pdG9yIGluc2VydHMuXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlcXVlc3RfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsZXZlbCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luZm8nO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGtpbmQgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdldmVudCc7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZnVuY3Rpb25fbmFtZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3Vua25vd24nO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1ldGhvZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHBhdGggdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBvcmlnaW4gdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByZWZlcmVyIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdXNlcl9hZ2VudCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGlwIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYXBwX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYnVpbGRfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBjdXN0b21lcl9pZCBiaWdpbnQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYXBpX2tleV9pZCBiaWdpbnQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcHJvdmlkZXIgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtb2RlbCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGh0dHBfc3RhdHVzIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZHVyYXRpb25fbXMgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBlcnJvcl9jb2RlIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZXJyb3JfbWVzc2FnZSB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGVycm9yX3N0YWNrIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdXBzdHJlYW1fc3RhdHVzIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdXBzdHJlYW1fYm9keSB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGV4dHJhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpO2AsXG5cbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19jcmVhdGVkX2lkeCBvbiBnYXRld2F5X2V2ZW50cyhjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfcmVxdWVzdF9pZHggb24gZ2F0ZXdheV9ldmVudHMocmVxdWVzdF9pZCk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19sZXZlbF9pZHggb24gZ2F0ZXdheV9ldmVudHMobGV2ZWwsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19mbl9pZHggb24gZ2F0ZXdheV9ldmVudHMoZnVuY3Rpb25fbmFtZSwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX2FwcF9pZHggb24gZ2F0ZXdheV9ldmVudHMoYXBwX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG5cbiAgICAgIC8vIC0tLSBLYWl4dVB1c2ggKERlcGxveSBQdXNoKSBlbnRlcnByaXNlIHRhYmxlcyAtLS1cbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcm9sZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2RlcGxveWVyJztgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFwaV9rZXlzX3JvbGVfaWR4IG9uIGFwaV9rZXlzKHJvbGUpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfbmV0bGlmeV90b2tlbnMgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgcHJpbWFyeSBrZXkgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB0b2tlbl9lbmMgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3Byb2plY3RzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm9qZWN0X2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIG5hbWUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbmV0bGlmeV9zaXRlX2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1bmlxdWUgKGN1c3RvbWVyX2lkLCBwcm9qZWN0X2lkKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfcHJvamVjdHNfY3VzdG9tZXJfaWR4IG9uIHB1c2hfcHJvamVjdHMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3B1c2hlcyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb2plY3Rfcm93X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHJvamVjdHMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwdXNoX2lkIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBicmFuY2ggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgdGl0bGUgdGV4dCxcbiAgICAgICAgZGVwbG95X2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIHN0YXRlIHRleHQgbm90IG51bGwsXG4gICAgICAgIHJlcXVpcmVkX2RpZ2VzdHMgdGV4dFtdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6dGV4dFtdLFxuICAgICAgICB1cGxvYWRlZF9kaWdlc3RzIHRleHRbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OnRleHRbXSxcbiAgICAgICAgZmlsZV9tYW5pZmVzdCBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICB1cmwgdGV4dCxcbiAgICAgICAgZXJyb3IgdGV4dCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX3B1c2hlcyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZmlsZV9tYW5pZmVzdCBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9wdXNoZXNfY3VzdG9tZXJfaWR4IG9uIHB1c2hfcHVzaGVzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9qb2JzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBwdXNoX3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3B1c2hlcyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHNoYTEgY2hhcig0MCkgbm90IG51bGwsXG4gICAgICAgIGRlcGxveV9wYXRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHBhcnRzIGludGVnZXIgbm90IG51bGwsXG4gICAgICAgIHJlY2VpdmVkX3BhcnRzIGludGVnZXJbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OmludFtdLFxuICAgICAgICBwYXJ0X2J5dGVzIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGJ5dGVzX3N0YWdlZCBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd1cGxvYWRpbmcnLFxuICAgICAgICBlcnJvciB0ZXh0LFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdW5pcXVlIChwdXNoX3Jvd19pZCwgc2hhMSlcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX2pvYnNfcHVzaF9pZHggb24gcHVzaF9qb2JzKHB1c2hfcm93X2lkLCB1cGRhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBieXRlc19zdGFnZWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcGFydF9ieXRlcyBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhdHRlbXB0cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbmV4dF9hdHRlbXB0X2F0IHRpbWVzdGFtcHR6O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X2Vycm9yIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxhc3RfZXJyb3JfYXQgdGltZXN0YW1wdHo7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfcmF0ZV93aW5kb3dzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYnVja2V0X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYnVja2V0X3N0YXJ0IHRpbWVzdGFtcHR6IG5vdCBudWxsLFxuICAgICAgICBjb3VudCBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcHJpbWFyeSBrZXkoY3VzdG9tZXJfaWQsIGJ1Y2tldF90eXBlLCBidWNrZXRfc3RhcnQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9yYXRlX3dpbmRvd3NfYnVja2V0X2lkeCBvbiBwdXNoX3JhdGVfd2luZG93cyhidWNrZXRfdHlwZSwgYnVja2V0X3N0YXJ0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9maWxlcyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgcHVzaF9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wdXNoZXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBkZXBsb3lfcGF0aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzaGExIGNoYXIoNDApIG5vdCBudWxsLFxuICAgICAgICBieXRlcyBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtb2RlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZGlyZWN0JyxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9maWxlc19wdXNoX2lkeCBvbiBwdXNoX2ZpbGVzKHB1c2hfcm93X2lkKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfdXNhZ2VfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHVzaF9yb3dfaWQgYmlnaW50IHJlZmVyZW5jZXMgcHVzaF9wdXNoZXMoaWQpIG9uIGRlbGV0ZSBzZXQgbnVsbCxcbiAgICAgICAgZXZlbnRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBieXRlcyBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwcmljaW5nX3ZlcnNpb24gaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDEsXG4gICAgICAgIGNvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF91c2FnZV9jdXN0b21lcl9pZHggb24gcHVzaF91c2FnZV9ldmVudHMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3ByaWNpbmdfdmVyc2lvbnMgKFxuICAgICAgICB2ZXJzaW9uIGludGVnZXIgcHJpbWFyeSBrZXksXG4gICAgICAgIGVmZmVjdGl2ZV9mcm9tIGRhdGUgbm90IG51bGwgZGVmYXVsdCBjdXJyZW50X2RhdGUsXG4gICAgICAgIGN1cnJlbmN5IHRleHQgbm90IG51bGwgZGVmYXVsdCAnVVNEJyxcbiAgICAgICAgYmFzZV9tb250aF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcGVyX2RlcGxveV9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcGVyX2diX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBpbnNlcnQgaW50byBwdXNoX3ByaWNpbmdfdmVyc2lvbnModmVyc2lvbiwgYmFzZV9tb250aF9jZW50cywgcGVyX2RlcGxveV9jZW50cywgcGVyX2diX2NlbnRzKVxuICAgICAgIHZhbHVlcyAoMSwgMCwgMTAsIDI1KSBvbiBjb25mbGljdCAodmVyc2lvbikgZG8gbm90aGluZztgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVyX3B1c2hfYmlsbGluZyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBwcmltYXJ5IGtleSByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByaWNpbmdfdmVyc2lvbiBpbnRlZ2VyIG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wcmljaW5nX3ZlcnNpb25zKHZlcnNpb24pLFxuICAgICAgICBtb250aGx5X2NhcF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX2ludm9pY2VzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcHJpY2luZ192ZXJzaW9uIGludGVnZXIgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3ByaWNpbmdfdmVyc2lvbnModmVyc2lvbiksXG4gICAgICAgIHRvdGFsX2NlbnRzIGludGVnZXIgbm90IG51bGwsXG4gICAgICAgIGJyZWFrZG93biBqc29uYiBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICApO2AsXG5cbiAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgLy8gR2l0SHViIFB1c2ggR2F0ZXdheSAob3B0aW9uYWwpXG4gICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcl9naXRodWJfdG9rZW5zIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IHByaW1hcnkga2V5IHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgdG9rZW5fZW5jIHRleHQgbm90IG51bGwsXG4gICAgICAgIHRva2VuX3R5cGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdvYXV0aCcsXG4gICAgICAgIHNjb3BlcyB0ZXh0W10gbm90IG51bGwgZGVmYXVsdCAne30nOjp0ZXh0W10sXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9qb2JzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgam9iX2lkIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBvd25lciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICByZXBvIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJyYW5jaCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ21haW4nLFxuICAgICAgICBjb21taXRfbWVzc2FnZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ0thaXh1IEdpdEh1YiBQdXNoJyxcbiAgICAgICAgcGFydHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHJlY2VpdmVkX3BhcnRzIGludGVnZXJbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OmludFtdLFxuICAgICAgICBwYXJ0X2J5dGVzIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGJ5dGVzX3N0YWdlZCBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd1cGxvYWRpbmcnLFxuICAgICAgICBhdHRlbXB0cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbmV4dF9hdHRlbXB0X2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBsYXN0X2Vycm9yIHRleHQsXG4gICAgICAgIGxhc3RfZXJyb3JfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIHJlc3VsdF9jb21taXRfc2hhIHRleHQsXG4gICAgICAgIHJlc3VsdF91cmwgdGV4dCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnaF9wdXNoX2pvYnNfY3VzdG9tZXJfaWR4IG9uIGdoX3B1c2hfam9icyhjdXN0b21lcl9pZCwgdXBkYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdoX3B1c2hfam9ic19uZXh0X2F0dGVtcHRfaWR4IG9uIGdoX3B1c2hfam9icyhuZXh0X2F0dGVtcHRfYXQpIHdoZXJlIHN0YXR1cyBpbiAoJ3JldHJ5X3dhaXQnLCdlcnJvcl90cmFuc2llbnQnKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGdoX3B1c2hfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgam9iX3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBnaF9wdXNoX2pvYnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBldmVudF90eXBlIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJ5dGVzIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9ldmVudHNfam9iX2lkeCBvbiBnaF9wdXNoX2V2ZW50cyhqb2Jfcm93X2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG5cblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX251bWJlcnMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHBob25lX251bWJlciB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd0d2lsaW8nLFxuICAgICAgICB0d2lsaW9fc2lkIHRleHQsXG4gICAgICAgIGlzX2FjdGl2ZSBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgdHJ1ZSxcbiAgICAgICAgZGVmYXVsdF9sbG1fcHJvdmlkZXIgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdvcGVuYWknLFxuICAgICAgICBkZWZhdWx0X2xsbV9tb2RlbCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2dwdC00LjEtbWluaScsXG4gICAgICAgIHZvaWNlX25hbWUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdhbGxveScsXG4gICAgICAgIGxvY2FsZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2VuLVVTJyxcbiAgICAgICAgdGltZXpvbmUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdBbWVyaWNhL1Bob2VuaXgnLFxuICAgICAgICBwbGF5Ym9vayBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9udW1iZXJzX2N1c3RvbWVyX2lkeCBvbiB2b2ljZV9udW1iZXJzKGN1c3RvbWVyX2lkKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHZvaWNlX251bWJlcl9pZCBiaWdpbnQgcmVmZXJlbmNlcyB2b2ljZV9udW1iZXJzKGlkKSBvbiBkZWxldGUgc2V0IG51bGwsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwgZGVmYXVsdCAndHdpbGlvJyxcbiAgICAgICAgcHJvdmlkZXJfY2FsbF9zaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgZnJvbV9udW1iZXIgdGV4dCxcbiAgICAgICAgdG9fbnVtYmVyIHRleHQsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luaXRpYXRlZCcsXG4gICAgICAgIGRpcmVjdGlvbiB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luYm91bmQnLFxuICAgICAgICBzdGFydGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIGVuZGVkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBkdXJhdGlvbl9zZWNvbmRzIGludGVnZXIsXG4gICAgICAgIGVzdF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBiaWxsX2Nvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYlxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB1bmlxdWUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsc19wcm92aWRlcl9zaWRfdXEgb24gdm9pY2VfY2FsbHMocHJvdmlkZXIsIHByb3ZpZGVyX2NhbGxfc2lkKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxzX2N1c3RvbWVyX2lkeCBvbiB2b2ljZV9jYWxscyhjdXN0b21lcl9pZCwgc3RhcnRlZF9hdCBkZXNjKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbF9tZXNzYWdlcyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY2FsbF9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyB2b2ljZV9jYWxscyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHJvbGUgdGV4dCBub3QgbnVsbCwgLS0gdXNlcnxhc3Npc3RhbnR8c3lzdGVtfHRvb2xcbiAgICAgICAgY29udGVudCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsX21lc3NhZ2VzX2NhbGxfaWR4IG9uIHZvaWNlX2NhbGxfbWVzc2FnZXMoY2FsbF9pZCwgaWQpO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB2b2ljZV91c2FnZV9tb250aGx5IChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtaW51dGVzIG51bWVyaWMgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBlc3RfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgYmlsbF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjYWxscyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1bmlxdWUoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX3VzYWdlX21vbnRobHlfY3VzdG9tZXJfaWR4IG9uIHZvaWNlX3VzYWdlX21vbnRobHkoY3VzdG9tZXJfaWQsIG1vbnRoKTtgLFxuXG5dO1xuXG4gICAgZm9yIChjb25zdCBzIG9mIHN0YXRlbWVudHMpIHtcbiAgICAgIGF3YWl0IHNxbC5xdWVyeShzKTtcbiAgICB9XG4gIH0pKCk7XG5cbiAgcmV0dXJuIF9zY2hlbWFQcm9taXNlO1xufVxuXG4vKipcbiAqIFF1ZXJ5IGhlbHBlciBjb21wYXRpYmxlIHdpdGggdGhlIHByZXZpb3VzIGBwZ2AtaXNoIGludGVyZmFjZTpcbiAqIC0gcmV0dXJucyB7IHJvd3MsIHJvd0NvdW50IH1cbiAqIC0gc3VwcG9ydHMgJDEsICQyIHBsYWNlaG9sZGVycyArIHBhcmFtcyBhcnJheSB2aWEgc3FsLnF1ZXJ5KC4uLilcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHEodGV4dCwgcGFyYW1zID0gW10pIHtcbiAgYXdhaXQgZW5zdXJlU2NoZW1hKCk7XG4gIGNvbnN0IHNxbCA9IGdldFNxbCgpO1xuICBjb25zdCByb3dzID0gYXdhaXQgc3FsLnF1ZXJ5KHRleHQsIHBhcmFtcyk7XG4gIHJldHVybiB7IHJvd3M6IHJvd3MgfHwgW10sIHJvd0NvdW50OiBBcnJheS5pc0FycmF5KHJvd3MpID8gcm93cy5sZW5ndGggOiAwIH07XG59IiwgImltcG9ydCB7IFRleHREZWNvZGVyIH0gZnJvbSBcInV0aWxcIjtcblxuZnVuY3Rpb24gY29uZmlnRXJyb3IobWVzc2FnZSwgaGludCkge1xuICBjb25zdCBlcnIgPSBuZXcgRXJyb3IobWVzc2FnZSk7XG4gIGVyci5jb2RlID0gXCJDT05GSUdcIjtcbiAgZXJyLnN0YXR1cyA9IDUwMDtcbiAgaWYgKGhpbnQpIGVyci5oaW50ID0gaGludDtcbiAgcmV0dXJuIGVycjtcbn1cblxuXG5mdW5jdGlvbiBzYWZlSnNvblN0cmluZyh2LCBtYXggPSAxMjAwMCkge1xuICB0cnkge1xuICAgIGNvbnN0IHMgPSB0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIiA/IHYgOiBKU09OLnN0cmluZ2lmeSh2KTtcbiAgICBpZiAoIXMpIHJldHVybiBcIlwiO1xuICAgIGlmIChzLmxlbmd0aCA8PSBtYXgpIHJldHVybiBzO1xuICAgIHJldHVybiBzLnNsaWNlKDAsIG1heCkgKyBgXHUyMDI2KCske3MubGVuZ3RoIC0gbWF4fSBjaGFycylgO1xuICB9IGNhdGNoIHtcbiAgICBjb25zdCBzID0gU3RyaW5nKHYgfHwgXCJcIik7XG4gICAgaWYgKHMubGVuZ3RoIDw9IG1heCkgcmV0dXJuIHM7XG4gICAgcmV0dXJuIHMuc2xpY2UoMCwgbWF4KSArIGBcdTIwMjYoKyR7cy5sZW5ndGggLSBtYXh9IGNoYXJzKWA7XG4gIH1cbn1cblxuZnVuY3Rpb24gdXBzdHJlYW1FcnJvcihwcm92aWRlciwgcmVzLCBib2R5KSB7XG4gIGNvbnN0IHN0YXR1cyA9IHJlcz8uc3RhdHVzIHx8IDA7XG4gIGNvbnN0IHJlcUlkID1cbiAgICByZXM/LmhlYWRlcnM/LmdldD8uKFwieC1yZXF1ZXN0LWlkXCIpIHx8XG4gICAgcmVzPy5oZWFkZXJzPy5nZXQ/LihcInJlcXVlc3QtaWRcIikgfHxcbiAgICByZXM/LmhlYWRlcnM/LmdldD8uKFwieC1hbXpuLXJlcXVlc3RpZFwiKSB8fFxuICAgIG51bGw7XG5cbiAgLy8gVHJ5IHRvIHN1cmZhY2UgdGhlIG1vc3QgbWVhbmluZ2Z1bCBwcm92aWRlciBtZXNzYWdlLlxuICBsZXQgbXNnID0gXCJcIjtcbiAgdHJ5IHtcbiAgICBtc2cgPSBib2R5Py5lcnJvcj8ubWVzc2FnZSB8fCBib2R5Py5lcnJvcj8udHlwZSB8fCBib2R5Py5tZXNzYWdlIHx8IFwiXCI7XG4gIH0gY2F0Y2gge31cbiAgY29uc3QgZXJyID0gbmV3IEVycm9yKG1zZyA/IGAke3Byb3ZpZGVyfSB1cHN0cmVhbSBlcnJvciAke3N0YXR1c306ICR7bXNnfWAgOiBgJHtwcm92aWRlcn0gdXBzdHJlYW0gZXJyb3IgJHtzdGF0dXN9YCk7XG4gIGVyci5jb2RlID0gXCJVUFNUUkVBTV9FUlJPUlwiO1xuICBlcnIuc3RhdHVzID0gNTAyO1xuICBlcnIudXBzdHJlYW0gPSB7XG4gICAgcHJvdmlkZXIsXG4gICAgc3RhdHVzLFxuICAgIHJlcXVlc3RfaWQ6IHJlcUlkLFxuICAgIGJvZHk6IHNhZmVKc29uU3RyaW5nKGJvZHkpXG4gIH07XG4gIHJldHVybiBlcnI7XG59XG5cbi8qKlxuICogTm9uLXN0cmVhbSBjYWxsc1xuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2FsbE9wZW5BSSh7IG1vZGVsLCBtZXNzYWdlcywgbWF4X3Rva2VucywgdGVtcGVyYXR1cmUgfSkge1xuICBjb25zdCBhcGlLZXkgPSBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0tFWTtcbiAgaWYgKCFhcGlLZXkpIHRocm93IGNvbmZpZ0Vycm9yKFwiT1BFTkFJX0FQSV9LRVkgbm90IGNvbmZpZ3VyZWRcIiwgXCJTZXQgT1BFTkFJX0FQSV9LRVkgaW4gTmV0bGlmeSBcdTIxOTIgU2l0ZSBjb25maWd1cmF0aW9uIFx1MjE5MiBFbnZpcm9ubWVudCB2YXJpYWJsZXMgKHlvdXIgT3BlbkFJIEFQSSBrZXkpLlwiKTtcblxuICBjb25zdCBpbnB1dCA9IEFycmF5LmlzQXJyYXkobWVzc2FnZXMpID8gbWVzc2FnZXMubWFwKG0gPT4gKHtcbiAgICByb2xlOiBtLnJvbGUsXG4gICAgY29udGVudDogW3sgdHlwZTogXCJpbnB1dF90ZXh0XCIsIHRleHQ6IFN0cmluZyhtLmNvbnRlbnQgPz8gXCJcIikgfV1cbiAgfSkpIDogW107XG5cbiAgY29uc3QgYm9keSA9IHtcbiAgICBtb2RlbCxcbiAgICBpbnB1dCxcbiAgICB0ZW1wZXJhdHVyZTogdHlwZW9mIHRlbXBlcmF0dXJlID09PSBcIm51bWJlclwiID8gdGVtcGVyYXR1cmUgOiAxLFxuICAgIG1heF9vdXRwdXRfdG9rZW5zOiB0eXBlb2YgbWF4X3Rva2VucyA9PT0gXCJudW1iZXJcIiA/IG1heF90b2tlbnMgOiAxMDI0LFxuICAgIHN0b3JlOiBmYWxzZVxuICB9O1xuXG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKFwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MS9yZXNwb25zZXNcIiwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczoge1xuICAgICAgXCJhdXRob3JpemF0aW9uXCI6IGBCZWFyZXIgJHthcGlLZXl9YCxcbiAgICAgIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KVxuICB9KTtcblxuICBjb25zdCBkYXRhID0gYXdhaXQgcmVzLmpzb24oKS5jYXRjaCgoKT0+ICh7fSkpO1xuICBpZiAoIXJlcy5vaykgdGhyb3cgdXBzdHJlYW1FcnJvcihcIm9wZW5haVwiLCByZXMsIGRhdGEpO1xuXG4gIGxldCBvdXQgPSBcIlwiO1xuICBjb25zdCBvdXRwdXQgPSBBcnJheS5pc0FycmF5KGRhdGEub3V0cHV0KSA/IGRhdGEub3V0cHV0IDogW107XG4gIGZvciAoY29uc3QgaXRlbSBvZiBvdXRwdXQpIHtcbiAgICBpZiAoaXRlbT8udHlwZSA9PT0gXCJtZXNzYWdlXCIgJiYgQXJyYXkuaXNBcnJheShpdGVtLmNvbnRlbnQpKSB7XG4gICAgICBmb3IgKGNvbnN0IGMgb2YgaXRlbS5jb250ZW50KSB7XG4gICAgICAgIGlmIChjPy50eXBlID09PSBcIm91dHB1dF90ZXh0XCIgJiYgdHlwZW9mIGMudGV4dCA9PT0gXCJzdHJpbmdcIikgb3V0ICs9IGMudGV4dDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjb25zdCB1c2FnZSA9IGRhdGEudXNhZ2UgfHwge307XG4gIHJldHVybiB7IG91dHB1dF90ZXh0OiBvdXQsIGlucHV0X3Rva2VuczogdXNhZ2UuaW5wdXRfdG9rZW5zIHx8IDAsIG91dHB1dF90b2tlbnM6IHVzYWdlLm91dHB1dF90b2tlbnMgfHwgMCwgcmF3OiBkYXRhIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjYWxsQW50aHJvcGljKHsgbW9kZWwsIG1lc3NhZ2VzLCBtYXhfdG9rZW5zLCB0ZW1wZXJhdHVyZSB9KSB7XG4gIGNvbnN0IGFwaUtleSA9IHByb2Nlc3MuZW52LkFOVEhST1BJQ19BUElfS0VZO1xuICBpZiAoIWFwaUtleSkgdGhyb3cgY29uZmlnRXJyb3IoXCJBTlRIUk9QSUNfQVBJX0tFWSBub3QgY29uZmlndXJlZFwiLCBcIlNldCBBTlRIUk9QSUNfQVBJX0tFWSBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcyAoeW91ciBBbnRocm9waWMgQVBJIGtleSkuXCIpO1xuXG4gIGNvbnN0IHN5c3RlbVBhcnRzID0gW107XG4gIGNvbnN0IG91dE1zZ3MgPSBbXTtcblxuICBjb25zdCBtc2dzID0gQXJyYXkuaXNBcnJheShtZXNzYWdlcykgPyBtZXNzYWdlcyA6IFtdO1xuICBmb3IgKGNvbnN0IG0gb2YgbXNncykge1xuICAgIGNvbnN0IHJvbGUgPSBTdHJpbmcobS5yb2xlIHx8IFwiXCIpLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgdGV4dCA9IFN0cmluZyhtLmNvbnRlbnQgPz8gXCJcIik7XG4gICAgaWYgKCF0ZXh0KSBjb250aW51ZTtcbiAgICBpZiAocm9sZSA9PT0gXCJzeXN0ZW1cIiB8fCByb2xlID09PSBcImRldmVsb3BlclwiKSBzeXN0ZW1QYXJ0cy5wdXNoKHRleHQpO1xuICAgIGVsc2UgaWYgKHJvbGUgPT09IFwiYXNzaXN0YW50XCIpIG91dE1zZ3MucHVzaCh7IHJvbGU6IFwiYXNzaXN0YW50XCIsIGNvbnRlbnQ6IHRleHQgfSk7XG4gICAgZWxzZSBvdXRNc2dzLnB1c2goeyByb2xlOiBcInVzZXJcIiwgY29udGVudDogdGV4dCB9KTtcbiAgfVxuXG4gIGNvbnN0IGJvZHkgPSB7XG4gICAgbW9kZWwsXG4gICAgbWF4X3Rva2VuczogdHlwZW9mIG1heF90b2tlbnMgPT09IFwibnVtYmVyXCIgPyBtYXhfdG9rZW5zIDogMTAyNCxcbiAgICB0ZW1wZXJhdHVyZTogdHlwZW9mIHRlbXBlcmF0dXJlID09PSBcIm51bWJlclwiID8gdGVtcGVyYXR1cmUgOiAxLFxuICAgIG1lc3NhZ2VzOiBvdXRNc2dzXG4gIH07XG4gIGlmIChzeXN0ZW1QYXJ0cy5sZW5ndGgpIGJvZHkuc3lzdGVtID0gc3lzdGVtUGFydHMuam9pbihcIlxcblxcblwiKTtcblxuY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goXCJodHRwczovL2FwaS5hbnRocm9waWMuY29tL3YxL21lc3NhZ2VzXCIsIHtcbiAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgIFwieC1hcGkta2V5XCI6IGFwaUtleSxcbiAgICAgIFwiYW50aHJvcGljLXZlcnNpb25cIjogXCIyMDIzLTA2LTAxXCIsXG4gICAgICBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIlxuICAgIH0sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSlcbiAgfSk7XG5cbiAgY29uc3QgZGF0YSA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCk9PiAoe30pKTtcbiAgaWYgKCFyZXMub2spIHRocm93IHVwc3RyZWFtRXJyb3IoXCJhbnRocm9waWNcIiwgcmVzLCBkYXRhKTtcblxuICBjb25zdCB0ZXh0ID0gQXJyYXkuaXNBcnJheShkYXRhPy5jb250ZW50KSA/IGRhdGEuY29udGVudC5tYXAoYyA9PiBjPy50ZXh0IHx8IFwiXCIpLmpvaW4oXCJcIikgOiAoZGF0YT8uY29udGVudD8uWzBdPy50ZXh0IHx8IGRhdGE/LmNvbXBsZXRpb24gfHwgXCJcIik7XG4gIGNvbnN0IHVzYWdlID0gZGF0YT8udXNhZ2UgfHwge307XG4gIHJldHVybiB7IG91dHB1dF90ZXh0OiB0ZXh0LCBpbnB1dF90b2tlbnM6IHVzYWdlLmlucHV0X3Rva2VucyB8fCAwLCBvdXRwdXRfdG9rZW5zOiB1c2FnZS5vdXRwdXRfdG9rZW5zIHx8IDAsIHJhdzogZGF0YSB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2FsbEdlbWluaSh7IG1vZGVsLCBtZXNzYWdlcywgbWF4X3Rva2VucywgdGVtcGVyYXR1cmUgfSkge1xuICBjb25zdCBhcGlLZXlSYXcgPSBwcm9jZXNzLmVudi5HRU1JTklfQVBJX0tFWV9MT0NBTCB8fCBwcm9jZXNzLmVudi5HRU1JTklfQVBJX0tFWTtcbiAgY29uc3QgYXBpS2V5ID0gU3RyaW5nKGFwaUtleVJhdyB8fCBcIlwiKVxuICAgIC50cmltKClcbiAgICAucmVwbGFjZSgvXlwiKC4qKVwiJC8sIFwiJDFcIilcbiAgICAudHJpbSgpO1xuICBpZiAoIWFwaUtleSkgdGhyb3cgY29uZmlnRXJyb3IoXCJHRU1JTklfQVBJX0tFWSBub3QgY29uZmlndXJlZFwiLCBcIlNldCBHRU1JTklfQVBJX0tFWSAob3IgZm9yIGxvY2FsIGRldjogR0VNSU5JX0FQSV9LRVlfTE9DQUwpIGluIE5ldGxpZnkgXHUyMTkyIFNpdGUgY29uZmlndXJhdGlvbiBcdTIxOTIgRW52aXJvbm1lbnQgdmFyaWFibGVzLlwiKTtcblxuICBjb25zdCBzeXN0ZW1QYXJ0cyA9IFtdO1xuICBjb25zdCBjb250ZW50cyA9IFtdO1xuXG4gIGNvbnN0IG1zZ3MgPSBBcnJheS5pc0FycmF5KG1lc3NhZ2VzKSA/IG1lc3NhZ2VzIDogW107XG4gIGZvciAoY29uc3QgbSBvZiBtc2dzKSB7XG4gICAgY29uc3Qgcm9sZSA9IG0ucm9sZTtcbiAgICBjb25zdCB0ZXh0ID0gU3RyaW5nKG0uY29udGVudCA/PyBcIlwiKTtcbiAgICBpZiAocm9sZSA9PT0gXCJzeXN0ZW1cIikgc3lzdGVtUGFydHMucHVzaCh0ZXh0KTtcbiAgICBlbHNlIGlmIChyb2xlID09PSBcImFzc2lzdGFudFwiKSBjb250ZW50cy5wdXNoKHsgcm9sZTogXCJtb2RlbFwiLCBwYXJ0czogW3sgdGV4dCB9XSB9KTtcbiAgICBlbHNlIGNvbnRlbnRzLnB1c2goeyByb2xlOiBcInVzZXJcIiwgcGFydHM6IFt7IHRleHQgfV0gfSk7XG4gIH1cblxuICBjb25zdCBib2R5ID0ge1xuICAgIGNvbnRlbnRzLFxuICAgIGdlbmVyYXRpb25Db25maWc6IHtcbiAgICAgIG1heE91dHB1dFRva2VuczogdHlwZW9mIG1heF90b2tlbnMgPT09IFwibnVtYmVyXCIgPyBtYXhfdG9rZW5zIDogMTAyNCxcbiAgICAgIHRlbXBlcmF0dXJlOiB0eXBlb2YgdGVtcGVyYXR1cmUgPT09IFwibnVtYmVyXCIgPyB0ZW1wZXJhdHVyZSA6IDFcbiAgICB9XG4gIH07XG4gIGlmIChzeXN0ZW1QYXJ0cy5sZW5ndGgpIGJvZHkuc3lzdGVtSW5zdHJ1Y3Rpb24gPSB7IHBhcnRzOiBbeyB0ZXh0OiBzeXN0ZW1QYXJ0cy5qb2luKFwiXFxuXFxuXCIpIH1dIH07XG5cbiAgY29uc3QgdXJsID0gYGh0dHBzOi8vZ2VuZXJhdGl2ZWxhbmd1YWdlLmdvb2dsZWFwaXMuY29tL3YxYmV0YS9tb2RlbHMvJHtlbmNvZGVVUklDb21wb25lbnQobW9kZWwpfTpnZW5lcmF0ZUNvbnRlbnRgO1xuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgIGhlYWRlcnM6IHsgXCJ4LWdvb2ctYXBpLWtleVwiOiBhcGlLZXksIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSlcbiAgfSk7XG5cbiAgY29uc3QgZGF0YSA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCk9PiAoe30pKTtcbiAgaWYgKCFyZXMub2spIHRocm93IHVwc3RyZWFtRXJyb3IoXCJnZW1pbmlcIiwgcmVzLCBkYXRhKTtcblxuICBsZXQgb3V0ID0gXCJcIjtcbiAgY29uc3QgY2FuZGlkYXRlcyA9IEFycmF5LmlzQXJyYXkoZGF0YS5jYW5kaWRhdGVzKSA/IGRhdGEuY2FuZGlkYXRlcyA6IFtdO1xuICBmb3IgKGNvbnN0IGNhbmQgb2YgY2FuZGlkYXRlcykge1xuICAgIGNvbnN0IGNvbnRlbnQgPSBjYW5kPy5jb250ZW50O1xuICAgIGlmIChjb250ZW50Py5wYXJ0cykgZm9yIChjb25zdCBwIG9mIGNvbnRlbnQucGFydHMpIGlmICh0eXBlb2YgcC50ZXh0ID09PSBcInN0cmluZ1wiKSBvdXQgKz0gcC50ZXh0O1xuICAgIGlmIChvdXQpIGJyZWFrO1xuICB9XG5cbiAgY29uc3QgdXNhZ2UgPSBkYXRhLnVzYWdlTWV0YWRhdGEgfHwge307XG4gIHJldHVybiB7IG91dHB1dF90ZXh0OiBvdXQsIGlucHV0X3Rva2VuczogdXNhZ2UucHJvbXB0VG9rZW5Db3VudCB8fCAwLCBvdXRwdXRfdG9rZW5zOiB1c2FnZS5jYW5kaWRhdGVzVG9rZW5Db3VudCB8fCAwLCByYXc6IGRhdGEgfTtcbn1cblxuLyoqXG4gKiBTdHJlYW0gYWRhcHRlcnM6XG4gKiBFYWNoIHJldHVybnMgeyB1cHN0cmVhbTogUmVzcG9uc2UsIHBhcnNlQ2h1bmsodGV4dCktPntkZWx0YVRleHQsIGRvbmUsIHVzYWdlP31bXSB9LlxuICogV2Ugbm9ybWFsaXplIGludG8gU1NFIGV2ZW50cyBmb3IgdGhlIGNsaWVudDogXCJkZWx0YVwiIGFuZCBcImRvbmVcIi5cbiAqL1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3RyZWFtT3BlbkFJKHsgbW9kZWwsIG1lc3NhZ2VzLCBtYXhfdG9rZW5zLCB0ZW1wZXJhdHVyZSB9KSB7XG4gIGNvbnN0IGFwaUtleSA9IHByb2Nlc3MuZW52Lk9QRU5BSV9BUElfS0VZO1xuICBpZiAoIWFwaUtleSkgdGhyb3cgY29uZmlnRXJyb3IoXCJPUEVOQUlfQVBJX0tFWSBub3QgY29uZmlndXJlZFwiLCBcIlNldCBPUEVOQUlfQVBJX0tFWSBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcyAoeW91ciBPcGVuQUkgQVBJIGtleSkuXCIpO1xuXG4gIGNvbnN0IGlucHV0ID0gQXJyYXkuaXNBcnJheShtZXNzYWdlcykgPyBtZXNzYWdlcy5tYXAobSA9PiAoe1xuICAgIHJvbGU6IG0ucm9sZSxcbiAgICBjb250ZW50OiBbeyB0eXBlOiBcImlucHV0X3RleHRcIiwgdGV4dDogU3RyaW5nKG0uY29udGVudCA/PyBcIlwiKSB9XVxuICB9KSkgOiBbXTtcblxuICBjb25zdCBib2R5ID0ge1xuICAgIG1vZGVsLFxuICAgIGlucHV0LFxuICAgIHRlbXBlcmF0dXJlOiB0eXBlb2YgdGVtcGVyYXR1cmUgPT09IFwibnVtYmVyXCIgPyB0ZW1wZXJhdHVyZSA6IDEsXG4gICAgbWF4X291dHB1dF90b2tlbnM6IHR5cGVvZiBtYXhfdG9rZW5zID09PSBcIm51bWJlclwiID8gbWF4X3Rva2VucyA6IDEwMjQsXG4gICAgc3RvcmU6IGZhbHNlLFxuICAgIHN0cmVhbTogdHJ1ZVxuICB9O1xuXG4gIGNvbnN0IHVwc3RyZWFtID0gYXdhaXQgZmV0Y2goXCJodHRwczovL2FwaS5vcGVuYWkuY29tL3YxL3Jlc3BvbnNlc1wiLCB7XG4gICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICBoZWFkZXJzOiB7XG4gICAgICBcImF1dGhvcml6YXRpb25cIjogYEJlYXJlciAke2FwaUtleX1gLFxuICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICBcImFjY2VwdFwiOiBcInRleHQvZXZlbnQtc3RyZWFtXCJcbiAgICB9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpXG4gIH0pO1xuXG4gIGlmICghdXBzdHJlYW0ub2spIHtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdXBzdHJlYW0uanNvbigpLmNhdGNoKCgpPT4gKHt9KSk7XG4gICAgdGhyb3cgbmV3IEVycm9yKGRhdGE/LmVycm9yPy5tZXNzYWdlIHx8IGBPcGVuQUkgZXJyb3IgJHt1cHN0cmVhbS5zdGF0dXN9YCk7XG4gIH1cblxuICAvLyBQYXJzZSBPcGVuQUkgU1NFIGxpbmVzOiBkYXRhOiB7anNvbn1cbiAgZnVuY3Rpb24gcGFyc2VTc2VMaW5lcyhjaHVua1RleHQpIHtcbiAgICBjb25zdCBvdXQgPSBbXTtcbiAgICBjb25zdCBsaW5lcyA9IGNodW5rVGV4dC5zcGxpdCgvXFxyP1xcbi8pO1xuICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgaWYgKCFsaW5lLnN0YXJ0c1dpdGgoXCJkYXRhOlwiKSkgY29udGludWU7XG4gICAgICBjb25zdCBwYXlsb2FkID0gbGluZS5zbGljZSg1KS50cmltKCk7XG4gICAgICBpZiAoIXBheWxvYWQgfHwgcGF5bG9hZCA9PT0gXCJbRE9ORV1cIikgY29udGludWU7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBvYmogPSBKU09OLnBhcnNlKHBheWxvYWQpO1xuICAgICAgICBjb25zdCB0ID0gb2JqLnR5cGUgfHwgXCJcIjtcbiAgICAgICAgaWYgKHQuaW5jbHVkZXMoXCJvdXRwdXRfdGV4dC5kZWx0YVwiKSAmJiB0eXBlb2Ygb2JqLmRlbHRhID09PSBcInN0cmluZ1wiKSBvdXQucHVzaCh7IHR5cGU6IFwiZGVsdGFcIiwgdGV4dDogb2JqLmRlbHRhIH0pO1xuICAgICAgICBpZiAodCA9PT0gXCJyZXNwb25zZS5jb21wbGV0ZWRcIiB8fCB0ID09PSBcInJlc3BvbnNlLmNvbXBsZXRlXCIgfHwgdC5pbmNsdWRlcyhcInJlc3BvbnNlLmNvbXBsZXRlZFwiKSkge1xuICAgICAgICAgIGNvbnN0IHVzYWdlID0gb2JqLnJlc3BvbnNlPy51c2FnZSB8fCBvYmoudXNhZ2UgfHwge307XG4gICAgICAgICAgb3V0LnB1c2goeyB0eXBlOiBcImRvbmVcIiwgdXNhZ2U6IHsgaW5wdXRfdG9rZW5zOiB1c2FnZS5pbnB1dF90b2tlbnMgfHwgMCwgb3V0cHV0X3Rva2VuczogdXNhZ2Uub3V0cHV0X3Rva2VucyB8fCAwIH0gfSk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2gge31cbiAgICB9XG4gICAgcmV0dXJuIG91dDtcbiAgfVxuXG4gIHJldHVybiB7IHVwc3RyZWFtLCBwYXJzZTogcGFyc2VTc2VMaW5lcyB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3RyZWFtQW50aHJvcGljKHsgbW9kZWwsIG1lc3NhZ2VzLCBtYXhfdG9rZW5zLCB0ZW1wZXJhdHVyZSB9KSB7XG4gIGNvbnN0IGFwaUtleSA9IHByb2Nlc3MuZW52LkFOVEhST1BJQ19BUElfS0VZO1xuICBpZiAoIWFwaUtleSkgdGhyb3cgY29uZmlnRXJyb3IoXCJBTlRIUk9QSUNfQVBJX0tFWSBub3QgY29uZmlndXJlZFwiLCBcIlNldCBBTlRIUk9QSUNfQVBJX0tFWSBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcyAoeW91ciBBbnRocm9waWMgQVBJIGtleSkuXCIpO1xuXG4gIGNvbnN0IHN5c3RlbVBhcnRzID0gW107XG4gIGNvbnN0IG91dE1zZ3MgPSBbXTtcblxuICBjb25zdCBtc2dzID0gQXJyYXkuaXNBcnJheShtZXNzYWdlcykgPyBtZXNzYWdlcyA6IFtdO1xuICBmb3IgKGNvbnN0IG0gb2YgbXNncykge1xuICAgIGNvbnN0IHJvbGUgPSBTdHJpbmcobS5yb2xlIHx8IFwiXCIpLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgdGV4dCA9IFN0cmluZyhtLmNvbnRlbnQgPz8gXCJcIik7XG4gICAgaWYgKCF0ZXh0KSBjb250aW51ZTtcbiAgICBpZiAocm9sZSA9PT0gXCJzeXN0ZW1cIiB8fCByb2xlID09PSBcImRldmVsb3BlclwiKSBzeXN0ZW1QYXJ0cy5wdXNoKHRleHQpO1xuICAgIGVsc2UgaWYgKHJvbGUgPT09IFwiYXNzaXN0YW50XCIpIG91dE1zZ3MucHVzaCh7IHJvbGU6IFwiYXNzaXN0YW50XCIsIGNvbnRlbnQ6IHRleHQgfSk7XG4gICAgZWxzZSBvdXRNc2dzLnB1c2goeyByb2xlOiBcInVzZXJcIiwgY29udGVudDogdGV4dCB9KTtcbiAgfVxuXG4gIGNvbnN0IGJvZHkgPSB7XG4gICAgbW9kZWwsXG4gICAgbWF4X3Rva2VuczogdHlwZW9mIG1heF90b2tlbnMgPT09IFwibnVtYmVyXCIgPyBtYXhfdG9rZW5zIDogMTAyNCxcbiAgICB0ZW1wZXJhdHVyZTogdHlwZW9mIHRlbXBlcmF0dXJlID09PSBcIm51bWJlclwiID8gdGVtcGVyYXR1cmUgOiAxLFxuICAgIHN0cmVhbTogdHJ1ZSxcbiAgICBtZXNzYWdlczogb3V0TXNnc1xuICB9O1xuICBpZiAoc3lzdGVtUGFydHMubGVuZ3RoKSBib2R5LnN5c3RlbSA9IHN5c3RlbVBhcnRzLmpvaW4oXCJcXG5cXG5cIik7XG5cbmNvbnN0IHVwc3RyZWFtID0gYXdhaXQgZmV0Y2goXCJodHRwczovL2FwaS5hbnRocm9waWMuY29tL3YxL21lc3NhZ2VzXCIsIHtcbiAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgIFwieC1hcGkta2V5XCI6IGFwaUtleSxcbiAgICAgIFwiYW50aHJvcGljLXZlcnNpb25cIjogXCIyMDIzLTA2LTAxXCIsXG4gICAgICBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgIFwiYWNjZXB0XCI6IFwidGV4dC9ldmVudC1zdHJlYW1cIlxuICAgIH0sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSlcbiAgfSk7XG5cbiAgaWYgKCF1cHN0cmVhbS5vaykge1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB1cHN0cmVhbS5qc29uKCkuY2F0Y2goKCk9PiAoe30pKTtcbiAgICB0aHJvdyBuZXcgRXJyb3IoZGF0YT8uZXJyb3I/Lm1lc3NhZ2UgfHwgYEFudGhyb3BpYyBlcnJvciAke3Vwc3RyZWFtLnN0YXR1c31gKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHBhcnNlU3NlTGluZXMoY2h1bmtUZXh0KSB7XG4gICAgY29uc3Qgb3V0ID0gW107XG4gICAgY29uc3QgbGluZXMgPSBjaHVua1RleHQuc3BsaXQoL1xccj9cXG4vKTtcbiAgICAvLyBBbnRocm9waWMgU1NFIHVzZXMgXCJldmVudDpcIiBhbmQgXCJkYXRhOlwiIGxpbmVzOyB3ZSBwYXJzZSBkYXRhIGpzb25cbiAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgIGlmICghbGluZS5zdGFydHNXaXRoKFwiZGF0YTpcIikpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgcGF5bG9hZCA9IGxpbmUuc2xpY2UoNSkudHJpbSgpO1xuICAgICAgaWYgKCFwYXlsb2FkIHx8IHBheWxvYWQgPT09IFwiW0RPTkVdXCIpIGNvbnRpbnVlO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgb2JqID0gSlNPTi5wYXJzZShwYXlsb2FkKTtcbiAgICAgICAgY29uc3QgdCA9IG9iai50eXBlIHx8IFwiXCI7XG4gICAgICAgIGlmICh0ID09PSBcImNvbnRlbnRfYmxvY2tfZGVsdGFcIiAmJiBvYmouZGVsdGE/LnR5cGUgPT09IFwidGV4dF9kZWx0YVwiICYmIHR5cGVvZiBvYmouZGVsdGEudGV4dCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgIG91dC5wdXNoKHsgdHlwZTogXCJkZWx0YVwiLCB0ZXh0OiBvYmouZGVsdGEudGV4dCB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodCA9PT0gXCJtZXNzYWdlX2RlbHRhXCIgJiYgb2JqLnVzYWdlKSB7XG4gICAgICAgICAgLy8gaW50ZXJtZWRpYXRlIHVzYWdlIHNvbWV0aW1lc1xuICAgICAgICB9XG4gICAgICAgIGlmICh0ID09PSBcIm1lc3NhZ2Vfc3RvcFwiIHx8IHQgPT09IFwibWVzc2FnZV9lbmRcIiB8fCB0ID09PSBcIm1lc3NhZ2VfY29tcGxldGVcIikge1xuICAgICAgICAgIGNvbnN0IHVzYWdlID0gb2JqLnVzYWdlIHx8IHt9O1xuICAgICAgICAgIG91dC5wdXNoKHsgdHlwZTogXCJkb25lXCIsIHVzYWdlOiB7IGlucHV0X3Rva2VuczogdXNhZ2UuaW5wdXRfdG9rZW5zIHx8IDAsIG91dHB1dF90b2tlbnM6IHVzYWdlLm91dHB1dF90b2tlbnMgfHwgMCB9IH0pO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIHt9XG4gICAgfVxuICAgIHJldHVybiBvdXQ7XG4gIH1cblxuICByZXR1cm4geyB1cHN0cmVhbSwgcGFyc2U6IHBhcnNlU3NlTGluZXMgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHN0cmVhbUdlbWluaSh7IG1vZGVsLCBtZXNzYWdlcywgbWF4X3Rva2VucywgdGVtcGVyYXR1cmUgfSkge1xuICBjb25zdCBhcGlLZXlSYXcgPSBwcm9jZXNzLmVudi5HRU1JTklfQVBJX0tFWV9MT0NBTCB8fCBwcm9jZXNzLmVudi5HRU1JTklfQVBJX0tFWTtcbiAgY29uc3QgYXBpS2V5ID0gU3RyaW5nKGFwaUtleVJhdyB8fCBcIlwiKVxuICAgIC50cmltKClcbiAgICAucmVwbGFjZSgvXlwiKC4qKVwiJC8sIFwiJDFcIilcbiAgICAudHJpbSgpO1xuICBpZiAoIWFwaUtleSkgdGhyb3cgY29uZmlnRXJyb3IoXCJHRU1JTklfQVBJX0tFWSBub3QgY29uZmlndXJlZFwiLCBcIlNldCBHRU1JTklfQVBJX0tFWSAob3IgZm9yIGxvY2FsIGRldjogR0VNSU5JX0FQSV9LRVlfTE9DQUwpIGluIE5ldGxpZnkgXHUyMTkyIFNpdGUgY29uZmlndXJhdGlvbiBcdTIxOTIgRW52aXJvbm1lbnQgdmFyaWFibGVzLlwiKTtcblxuICBjb25zdCBzeXN0ZW1QYXJ0cyA9IFtdO1xuICBjb25zdCBjb250ZW50cyA9IFtdO1xuICBjb25zdCBtc2dzID0gQXJyYXkuaXNBcnJheShtZXNzYWdlcykgPyBtZXNzYWdlcyA6IFtdO1xuICBmb3IgKGNvbnN0IG0gb2YgbXNncykge1xuICAgIGNvbnN0IHJvbGUgPSBtLnJvbGU7XG4gICAgY29uc3QgdGV4dCA9IFN0cmluZyhtLmNvbnRlbnQgPz8gXCJcIik7XG4gICAgaWYgKHJvbGUgPT09IFwic3lzdGVtXCIpIHN5c3RlbVBhcnRzLnB1c2godGV4dCk7XG4gICAgZWxzZSBpZiAocm9sZSA9PT0gXCJhc3Npc3RhbnRcIikgY29udGVudHMucHVzaCh7IHJvbGU6IFwibW9kZWxcIiwgcGFydHM6IFt7IHRleHQgfV0gfSk7XG4gICAgZWxzZSBjb250ZW50cy5wdXNoKHsgcm9sZTogXCJ1c2VyXCIsIHBhcnRzOiBbeyB0ZXh0IH1dIH0pO1xuICB9XG5cbiAgY29uc3QgYm9keSA9IHtcbiAgICBjb250ZW50cyxcbiAgICBnZW5lcmF0aW9uQ29uZmlnOiB7XG4gICAgICBtYXhPdXRwdXRUb2tlbnM6IHR5cGVvZiBtYXhfdG9rZW5zID09PSBcIm51bWJlclwiID8gbWF4X3Rva2VucyA6IDEwMjQsXG4gICAgICB0ZW1wZXJhdHVyZTogdHlwZW9mIHRlbXBlcmF0dXJlID09PSBcIm51bWJlclwiID8gdGVtcGVyYXR1cmUgOiAxXG4gICAgfVxuICB9O1xuICBpZiAoc3lzdGVtUGFydHMubGVuZ3RoKSBib2R5LnN5c3RlbUluc3RydWN0aW9uID0geyBwYXJ0czogW3sgdGV4dDogc3lzdGVtUGFydHMuam9pbihcIlxcblxcblwiKSB9XSB9O1xuXG4gIC8vIHN0cmVhbWluZyBlbmRwb2ludFxuICBjb25zdCB1cmwgPSBgaHR0cHM6Ly9nZW5lcmF0aXZlbGFuZ3VhZ2UuZ29vZ2xlYXBpcy5jb20vdjFiZXRhL21vZGVscy8ke2VuY29kZVVSSUNvbXBvbmVudChtb2RlbCl9OnN0cmVhbUdlbmVyYXRlQ29udGVudGA7XG4gIGNvbnN0IHVwc3RyZWFtID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICBoZWFkZXJzOiB7IFwieC1nb29nLWFwaS1rZXlcIjogYXBpS2V5LCBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpXG4gIH0pO1xuXG4gIGlmICghdXBzdHJlYW0ub2spIHtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdXBzdHJlYW0uanNvbigpLmNhdGNoKCgpPT4gKHt9KSk7XG4gICAgdGhyb3cgdXBzdHJlYW1FcnJvcihcImdlbWluaVwiLCB1cHN0cmVhbSwgZGF0YSk7XG4gIH1cblxuICAvLyBHZW1pbmkgc3RyZWFtIGlzIHR5cGljYWxseSBuZXdsaW5lLWRlbGltaXRlZCBKU09OIG9iamVjdHMgKG5vdCBTU0UpLlxuICBmdW5jdGlvbiBwYXJzZU5kanNvbihjaHVua1RleHQpIHtcbiAgICBjb25zdCBvdXQgPSBbXTtcbiAgICBjb25zdCBwYXJ0cyA9IGNodW5rVGV4dC5zcGxpdCgvXFxyP1xcbi8pLm1hcChzID0+IHMudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgZm9yIChjb25zdCBwIG9mIHBhcnRzKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBvYmogPSBKU09OLnBhcnNlKHApO1xuICAgICAgICAvLyBFeHRyYWN0IGRlbHRhLWlzaCB0ZXh0IGlmIHByZXNlbnRcbiAgICAgICAgY29uc3QgY2FuZGlkYXRlcyA9IEFycmF5LmlzQXJyYXkob2JqLmNhbmRpZGF0ZXMpID8gb2JqLmNhbmRpZGF0ZXMgOiBbXTtcbiAgICAgICAgZm9yIChjb25zdCBjYW5kIG9mIGNhbmRpZGF0ZXMpIHtcbiAgICAgICAgICBjb25zdCBjb250ZW50ID0gY2FuZD8uY29udGVudDtcbiAgICAgICAgICBpZiAoY29udGVudD8ucGFydHMpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcGFydCBvZiBjb250ZW50LnBhcnRzKSB7XG4gICAgICAgICAgICAgIGlmICh0eXBlb2YgcGFydC50ZXh0ID09PSBcInN0cmluZ1wiICYmIHBhcnQudGV4dCkgb3V0LnB1c2goeyB0eXBlOiBcImRlbHRhXCIsIHRleHQ6IHBhcnQudGV4dCB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdXNhZ2UgPSBvYmoudXNhZ2VNZXRhZGF0YTtcbiAgICAgICAgaWYgKHVzYWdlICYmICh1c2FnZS5wcm9tcHRUb2tlbkNvdW50IHx8IHVzYWdlLmNhbmRpZGF0ZXNUb2tlbkNvdW50KSkge1xuICAgICAgICAgIC8vIG5vIHJlbGlhYmxlIFwiZG9uZVwiIG1hcmtlcjsgd2Ugd2lsbCBlbWl0IGRvbmUgYXQgc3RyZWFtIGVuZCB1c2luZyBsYXN0LXNlZW4gdXNhZ2VcbiAgICAgICAgICBvdXQucHVzaCh7IHR5cGU6IFwidXNhZ2VcIiwgdXNhZ2U6IHsgaW5wdXRfdG9rZW5zOiB1c2FnZS5wcm9tcHRUb2tlbkNvdW50IHx8IDAsIG91dHB1dF90b2tlbnM6IHVzYWdlLmNhbmRpZGF0ZXNUb2tlbkNvdW50IHx8IDAgfSB9KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCB7fVxuICAgIH1cbiAgICByZXR1cm4gb3V0O1xuICB9XG5cbiAgcmV0dXJuIHsgdXBzdHJlYW0sIHBhcnNlOiBwYXJzZU5kanNvbiwgaXNOZGpzb246IHRydWUgfTtcbn1cbiIsICJpbXBvcnQgZnMgZnJvbSBcImZzXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuXG5sZXQgY2FjaGUgPSBudWxsO1xuXG5mdW5jdGlvbiBsb2FkUHJpY2luZygpIHtcbiAgaWYgKGNhY2hlKSByZXR1cm4gY2FjaGU7XG4gIGNvbnN0IHAgPSBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgXCJwcmljaW5nXCIsIFwicHJpY2luZy5qc29uXCIpO1xuICBjb25zdCByYXcgPSBmcy5yZWFkRmlsZVN5bmMocCwgXCJ1dGY4XCIpO1xuICBjYWNoZSA9IEpTT04ucGFyc2UocmF3KTtcbiAgcmV0dXJuIGNhY2hlO1xufVxuXG5mdW5jdGlvbiB1bnByaWNlZEVycm9yKHByb3ZpZGVyLCBtb2RlbCkge1xuICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoYFVucHJpY2VkIG1vZGVsOiAke3Byb3ZpZGVyfToke21vZGVsfWApO1xuICBlcnIuY29kZSA9IFwiVU5QUklDRURfTU9ERUxcIjtcbiAgLy8gNDA5IGNvbW11bmljYXRlcyBcInlvdXIgcmVxdWVzdCBpcyB2YWxpZCBKU09OIGJ1dCBjb25mbGljdHMgd2l0aCBzZXJ2ZXIgcG9saWN5L2NvbmZpZ1wiXG4gIGVyci5zdGF0dXMgPSA0MDk7XG4gIGVyci5oaW50ID0gXCJUaGlzIG1vZGVsL3Byb3ZpZGVyIGlzIG5vdCBlbmFibGVkIGZvciBiaWxsaW5nLiBBc2sgYW4gYWRtaW4gdG8gYWRkIGl0IHRvIHByaWNpbmcvcHJpY2luZy5qc29uIChhbmQgYWxsb3dsaXN0cykuXCI7XG4gIHJldHVybiBlcnI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb3N0Q2VudHMocHJvdmlkZXIsIG1vZGVsLCBpbnB1dFRva2Vucywgb3V0cHV0VG9rZW5zKSB7XG4gIGNvbnN0IHByaWNpbmcgPSBsb2FkUHJpY2luZygpO1xuICBjb25zdCBlbnRyeSA9IHByaWNpbmc/Lltwcm92aWRlcl0/Llttb2RlbF07XG4gIGlmICghZW50cnkpIHRocm93IHVucHJpY2VkRXJyb3IocHJvdmlkZXIsIG1vZGVsKTtcblxuICBjb25zdCBpblJhdGUgPSBOdW1iZXIoZW50cnkuaW5wdXRfcGVyXzFtX3VzZCk7XG4gIGNvbnN0IG91dFJhdGUgPSBOdW1iZXIoZW50cnkub3V0cHV0X3Blcl8xbV91c2QpO1xuXG4gIC8vIFRyZWF0IG1pc3NpbmcvTmFOIGFzIG1pc2NvbmZpZ3VyYXRpb24uXG4gIGlmICghTnVtYmVyLmlzRmluaXRlKGluUmF0ZSkgfHwgIU51bWJlci5pc0Zpbml0ZShvdXRSYXRlKSkgdGhyb3cgdW5wcmljZWRFcnJvcihwcm92aWRlciwgbW9kZWwpO1xuXG4gIGNvbnN0IGluVXNkID0gKE51bWJlcihpbnB1dFRva2VucyB8fCAwKSAvIDFfMDAwXzAwMCkgKiBpblJhdGU7XG4gIGNvbnN0IG91dFVzZCA9IChOdW1iZXIob3V0cHV0VG9rZW5zIHx8IDApIC8gMV8wMDBfMDAwKSAqIG91dFJhdGU7XG4gIGNvbnN0IHRvdGFsVXNkID0gaW5Vc2QgKyBvdXRVc2Q7XG5cbiAgcmV0dXJuIE1hdGgubWF4KDAsIE1hdGgucm91bmQodG90YWxVc2QgKiAxMDApKTtcbn1cbiIsICJleHBvcnQgZnVuY3Rpb24gYnVpbGRDb3JzKHJlcSkge1xuICBjb25zdCBhbGxvd1JhdyA9IChwcm9jZXNzLmVudi5BTExPV0VEX09SSUdJTlMgfHwgXCJcIikudHJpbSgpO1xuICBjb25zdCByZXFPcmlnaW4gPSByZXEuaGVhZGVycy5nZXQoXCJvcmlnaW5cIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiT3JpZ2luXCIpO1xuXG4gIC8vIElNUE9SVEFOVDoga2VlcCB0aGlzIGxpc3QgYWxpZ25lZCB3aXRoIHdoYXRldmVyIGhlYWRlcnMgeW91ciBhcHBzIHNlbmQuXG4gIGNvbnN0IGFsbG93SGVhZGVycyA9IFwiYXV0aG9yaXphdGlvbiwgY29udGVudC10eXBlLCB4LWthaXh1LWluc3RhbGwtaWQsIHgta2FpeHUtcmVxdWVzdC1pZCwgeC1rYWl4dS1hcHAsIHgta2FpeHUtYnVpbGQsIHgtYWRtaW4tcGFzc3dvcmQsIHgta2FpeHUtZXJyb3ItdG9rZW4sIHgta2FpeHUtbW9kZSwgeC1jb250ZW50LXNoYTEsIHgtc2V0dXAtc2VjcmV0LCB4LWthaXh1LWpvYi1zZWNyZXQsIHgtam9iLXdvcmtlci1zZWNyZXRcIjtcbiAgY29uc3QgYWxsb3dNZXRob2RzID0gXCJHRVQsUE9TVCxQVVQsUEFUQ0gsREVMRVRFLE9QVElPTlNcIjtcblxuICBjb25zdCBiYXNlID0ge1xuICAgIFwiYWNjZXNzLWNvbnRyb2wtYWxsb3ctaGVhZGVyc1wiOiBhbGxvd0hlYWRlcnMsXG4gICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1tZXRob2RzXCI6IGFsbG93TWV0aG9kcyxcbiAgICBcImFjY2Vzcy1jb250cm9sLWV4cG9zZS1oZWFkZXJzXCI6IFwieC1rYWl4dS1yZXF1ZXN0LWlkXCIsXG4gICAgXCJhY2Nlc3MtY29udHJvbC1tYXgtYWdlXCI6IFwiODY0MDBcIlxuICB9O1xuXG4gIC8vIFNUUklDVCBCWSBERUZBVUxUOlxuICAvLyAtIElmIEFMTE9XRURfT1JJR0lOUyBpcyB1bnNldC9ibGFuayBhbmQgYSBicm93c2VyIE9yaWdpbiBpcyBwcmVzZW50LCB3ZSBkbyBOT1QgZ3JhbnQgQ09SUy5cbiAgLy8gLSBBbGxvdy1hbGwgaXMgb25seSBlbmFibGVkIHdoZW4gQUxMT1dFRF9PUklHSU5TIGV4cGxpY2l0bHkgY29udGFpbnMgXCIqXCIuXG4gIGlmICghYWxsb3dSYXcpIHtcbiAgICAvLyBObyBhbGxvdy1vcmlnaW4gZ3JhbnRlZC4gU2VydmVyLXRvLXNlcnZlciByZXF1ZXN0cyAobm8gT3JpZ2luIGhlYWRlcikgc3RpbGwgd29yayBub3JtYWxseS5cbiAgICByZXR1cm4ge1xuICAgICAgLi4uYmFzZSxcbiAgICAgIC4uLihyZXFPcmlnaW4gPyB7IHZhcnk6IFwiT3JpZ2luXCIgfSA6IHt9KVxuICAgIH07XG4gIH1cblxuICBjb25zdCBhbGxvd2VkID0gYWxsb3dSYXcuc3BsaXQoXCIsXCIpLm1hcCgocykgPT4gcy50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcblxuICAvLyBFeHBsaWNpdCBhbGxvdy1hbGxcbiAgaWYgKGFsbG93ZWQuaW5jbHVkZXMoXCIqXCIpKSB7XG4gICAgY29uc3Qgb3JpZ2luID0gcmVxT3JpZ2luIHx8IFwiKlwiO1xuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlLFxuICAgICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1vcmlnaW5cIjogb3JpZ2luLFxuICAgICAgLi4uKHJlcU9yaWdpbiA/IHsgdmFyeTogXCJPcmlnaW5cIiB9IDoge30pXG4gICAgfTtcbiAgfVxuXG4gIC8vIEV4YWN0LW1hdGNoIGFsbG93bGlzdFxuICBpZiAocmVxT3JpZ2luICYmIGFsbG93ZWQuaW5jbHVkZXMocmVxT3JpZ2luKSkge1xuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlLFxuICAgICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1vcmlnaW5cIjogcmVxT3JpZ2luLFxuICAgICAgdmFyeTogXCJPcmlnaW5cIlxuICAgIH07XG4gIH1cblxuICAvLyBPcmlnaW4gcHJlc2VudCBidXQgbm90IGFsbG93ZWQ6IGRvIG5vdCBncmFudCBhbGxvdy1vcmlnaW4uXG4gIHJldHVybiB7XG4gICAgLi4uYmFzZSxcbiAgICAuLi4ocmVxT3JpZ2luID8geyB2YXJ5OiBcIk9yaWdpblwiIH0gOiB7fSlcbiAgfTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24ganNvbihzdGF0dXMsIGJvZHksIGhlYWRlcnMgPSB7fSkge1xuICByZXR1cm4gbmV3IFJlc3BvbnNlKEpTT04uc3RyaW5naWZ5KGJvZHkpLCB7XG4gICAgc3RhdHVzLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOFwiLFxuICAgICAgLi4uaGVhZGVyc1xuICAgIH1cbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZXh0KHN0YXR1cywgYm9keSwgaGVhZGVycyA9IHt9KSB7XG4gIHJldHVybiBuZXcgUmVzcG9uc2UoYm9keSwgeyBzdGF0dXMsIGhlYWRlcnMgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBiYWRSZXF1ZXN0KG1lc3NhZ2UsIGhlYWRlcnMgPSB7fSkge1xuICByZXR1cm4ganNvbig0MDAsIHsgZXJyb3I6IG1lc3NhZ2UgfSwgaGVhZGVycyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRCZWFyZXIocmVxKSB7XG4gIGNvbnN0IGF1dGggPSByZXEuaGVhZGVycy5nZXQoXCJhdXRob3JpemF0aW9uXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIkF1dGhvcml6YXRpb25cIikgfHwgXCJcIjtcbiAgaWYgKCFhdXRoLnN0YXJ0c1dpdGgoXCJCZWFyZXIgXCIpKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIGF1dGguc2xpY2UoNykudHJpbSgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbW9udGhLZXlVVEMoZCA9IG5ldyBEYXRlKCkpIHtcbiAgcmV0dXJuIGQudG9JU09TdHJpbmcoKS5zbGljZSgwLCA3KTsgLy8gWVlZWS1NTVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5zdGFsbElkKHJlcSkge1xuICByZXR1cm4gKFxuICAgIHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtaW5zdGFsbC1pZFwiKSB8fFxuICAgIHJlcS5oZWFkZXJzLmdldChcIlgtS2FpeHUtSW5zdGFsbC1JZFwiKSB8fFxuICAgIFwiXCJcbiAgKS50b1N0cmluZygpLnRyaW0oKS5zbGljZSgwLCA4MCkgfHwgbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFVzZXJBZ2VudChyZXEpIHtcbiAgcmV0dXJuIChyZXEuaGVhZGVycy5nZXQoXCJ1c2VyLWFnZW50XCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIlVzZXItQWdlbnRcIikgfHwgXCJcIikudG9TdHJpbmcoKS5zbGljZSgwLCAyNDApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q2xpZW50SXAocmVxKSB7XG4gIC8vIE5ldGxpZnkgYWRkcyB4LW5mLWNsaWVudC1jb25uZWN0aW9uLWlwIHdoZW4gZGVwbG95ZWQgKG1heSBiZSBtaXNzaW5nIGluIG5ldGxpZnkgZGV2KS5cbiAgY29uc3QgYSA9IChyZXEuaGVhZGVycy5nZXQoXCJ4LW5mLWNsaWVudC1jb25uZWN0aW9uLWlwXCIpIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpO1xuICBpZiAoYSkgcmV0dXJuIGE7XG5cbiAgLy8gRmFsbGJhY2sgdG8gZmlyc3QgWC1Gb3J3YXJkZWQtRm9yIGVudHJ5LlxuICBjb25zdCB4ZmYgPSAocmVxLmhlYWRlcnMuZ2V0KFwieC1mb3J3YXJkZWQtZm9yXCIpIHx8IFwiXCIpLnRvU3RyaW5nKCk7XG4gIGlmICgheGZmKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgZmlyc3QgPSB4ZmYuc3BsaXQoXCIsXCIpWzBdLnRyaW0oKTtcbiAgcmV0dXJuIGZpcnN0IHx8IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzbGVlcChtcykge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgbXMpKTtcbn0iLCAiaW1wb3J0IGNyeXB0byBmcm9tIFwiY3J5cHRvXCI7XG5cbmZ1bmN0aW9uIGNvbmZpZ0Vycm9yKG1lc3NhZ2UsIGhpbnQpIHtcbiAgY29uc3QgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuICBlcnIuY29kZSA9IFwiQ09ORklHXCI7XG4gIGVyci5zdGF0dXMgPSA1MDA7XG4gIGlmIChoaW50KSBlcnIuaGludCA9IGhpbnQ7XG4gIHJldHVybiBlcnI7XG59XG5cbmZ1bmN0aW9uIGJhc2U2NHVybChpbnB1dCkge1xuICByZXR1cm4gQnVmZmVyLmZyb20oaW5wdXQpXG4gICAgLnRvU3RyaW5nKFwiYmFzZTY0XCIpXG4gICAgLnJlcGxhY2UoLz0vZywgXCJcIilcbiAgICAucmVwbGFjZSgvXFwrL2csIFwiLVwiKVxuICAgIC5yZXBsYWNlKC9cXC8vZywgXCJfXCIpO1xufVxuXG5mdW5jdGlvbiB1bmJhc2U2NHVybChpbnB1dCkge1xuICBjb25zdCBzID0gU3RyaW5nKGlucHV0IHx8IFwiXCIpLnJlcGxhY2UoLy0vZywgXCIrXCIpLnJlcGxhY2UoL18vZywgXCIvXCIpO1xuICBjb25zdCBwYWQgPSBzLmxlbmd0aCAlIDQgPT09IDAgPyBcIlwiIDogXCI9XCIucmVwZWF0KDQgLSAocy5sZW5ndGggJSA0KSk7XG4gIHJldHVybiBCdWZmZXIuZnJvbShzICsgcGFkLCBcImJhc2U2NFwiKTtcbn1cblxuZnVuY3Rpb24gZW5jS2V5KCkge1xuICAvLyBQcmVmZXIgYSBkZWRpY2F0ZWQgZW5jcnlwdGlvbiBrZXkuIEZhbGwgYmFjayB0byBKV1RfU0VDUkVUIGZvciBkcm9wLWZyaWVuZGx5IGluc3RhbGxzLlxuICBjb25zdCByYXcgPSAocHJvY2Vzcy5lbnYuREJfRU5DUllQVElPTl9LRVkgfHwgcHJvY2Vzcy5lbnYuSldUX1NFQ1JFVCB8fCBcIlwiKS50b1N0cmluZygpO1xuICBpZiAoIXJhdykge1xuICAgIHRocm93IGNvbmZpZ0Vycm9yKFxuICAgICAgXCJNaXNzaW5nIERCX0VOQ1JZUFRJT05fS0VZIChvciBKV1RfU0VDUkVUIGZhbGxiYWNrKVwiLFxuICAgICAgXCJTZXQgREJfRU5DUllQVElPTl9LRVkgKHJlY29tbWVuZGVkKSBvciBhdCBtaW5pbXVtIEpXVF9TRUNSRVQgaW4gTmV0bGlmeSBlbnYgdmFycy5cIlxuICAgICk7XG4gIH1cbiAgLy8gRGVyaXZlIGEgc3RhYmxlIDMyLWJ5dGUga2V5LlxuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhhc2goXCJzaGEyNTZcIikudXBkYXRlKHJhdykuZGlnZXN0KCk7XG59XG5cbi8qKlxuICogRW5jcnlwdCBzbWFsbCBzZWNyZXRzIGZvciBEQiBzdG9yYWdlIChBRVMtMjU2LUdDTSkuXG4gKiBGb3JtYXQ6IHYxOjxpdl9iNjR1cmw+Ojx0YWdfYjY0dXJsPjo8Y2lwaGVyX2I2NHVybD5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVuY3J5cHRTZWNyZXQocGxhaW50ZXh0KSB7XG4gIGNvbnN0IGtleSA9IGVuY0tleSgpO1xuICBjb25zdCBpdiA9IGNyeXB0by5yYW5kb21CeXRlcygxMik7XG4gIGNvbnN0IGNpcGhlciA9IGNyeXB0by5jcmVhdGVDaXBoZXJpdihcImFlcy0yNTYtZ2NtXCIsIGtleSwgaXYpO1xuICBjb25zdCBjdCA9IEJ1ZmZlci5jb25jYXQoW2NpcGhlci51cGRhdGUoU3RyaW5nKHBsYWludGV4dCksIFwidXRmOFwiKSwgY2lwaGVyLmZpbmFsKCldKTtcbiAgY29uc3QgdGFnID0gY2lwaGVyLmdldEF1dGhUYWcoKTtcbiAgcmV0dXJuIGB2MToke2Jhc2U2NHVybChpdil9OiR7YmFzZTY0dXJsKHRhZyl9OiR7YmFzZTY0dXJsKGN0KX1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVjcnlwdFNlY3JldChlbmMpIHtcbiAgY29uc3QgcyA9IFN0cmluZyhlbmMgfHwgXCJcIik7XG4gIGlmICghcy5zdGFydHNXaXRoKFwidjE6XCIpKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgcGFydHMgPSBzLnNwbGl0KFwiOlwiKTtcbiAgaWYgKHBhcnRzLmxlbmd0aCAhPT0gNCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IFssIGl2QiwgdGFnQiwgY3RCXSA9IHBhcnRzO1xuICBjb25zdCBrZXkgPSBlbmNLZXkoKTtcbiAgY29uc3QgaXYgPSB1bmJhc2U2NHVybChpdkIpO1xuICBjb25zdCB0YWcgPSB1bmJhc2U2NHVybCh0YWdCKTtcbiAgY29uc3QgY3QgPSB1bmJhc2U2NHVybChjdEIpO1xuICBjb25zdCBkZWNpcGhlciA9IGNyeXB0by5jcmVhdGVEZWNpcGhlcml2KFwiYWVzLTI1Ni1nY21cIiwga2V5LCBpdik7XG4gIGRlY2lwaGVyLnNldEF1dGhUYWcodGFnKTtcbiAgY29uc3QgcHQgPSBCdWZmZXIuY29uY2F0KFtkZWNpcGhlci51cGRhdGUoY3QpLCBkZWNpcGhlci5maW5hbCgpXSk7XG4gIHJldHVybiBwdC50b1N0cmluZyhcInV0ZjhcIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByYW5kb21LZXkocHJlZml4ID0gXCJreF9saXZlX1wiKSB7XG4gIGNvbnN0IGJ5dGVzID0gY3J5cHRvLnJhbmRvbUJ5dGVzKDMyKTtcbiAgcmV0dXJuIHByZWZpeCArIGJhc2U2NHVybChieXRlcykuc2xpY2UoMCwgNDgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hhMjU2SGV4KGlucHV0KSB7XG4gIHJldHVybiBjcnlwdG8uY3JlYXRlSGFzaChcInNoYTI1NlwiKS51cGRhdGUoaW5wdXQpLmRpZ2VzdChcImhleFwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhtYWNTaGEyNTZIZXgoc2VjcmV0LCBpbnB1dCkge1xuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhtYWMoXCJzaGEyNTZcIiwgc2VjcmV0KS51cGRhdGUoaW5wdXQpLmRpZ2VzdChcImhleFwiKTtcbn1cblxuLyoqXG4gKiBLZXkgaGFzaGluZyBzdHJhdGVneTpcbiAqIC0gRGVmYXVsdDogU0hBLTI1NihrZXkpXG4gKiAtIElmIEtFWV9QRVBQRVIgaXMgc2V0OiBITUFDLVNIQTI1NihLRVlfUEVQUEVSLCBrZXkpXG4gKlxuICogSU1QT1JUQU5UOiBQZXBwZXIgaXMgb3B0aW9uYWwgYW5kIGNhbiBiZSBlbmFibGVkIGxhdGVyLlxuICogQXV0aCBjb2RlIHdpbGwgYXV0by1taWdyYXRlIGxlZ2FjeSBoYXNoZXMgb24gZmlyc3Qgc3VjY2Vzc2Z1bCBsb29rdXAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBrZXlIYXNoSGV4KGlucHV0KSB7XG4gIGNvbnN0IHBlcHBlciA9IHByb2Nlc3MuZW52LktFWV9QRVBQRVI7XG4gIGlmIChwZXBwZXIpIHJldHVybiBobWFjU2hhMjU2SGV4KHBlcHBlciwgaW5wdXQpO1xuICByZXR1cm4gc2hhMjU2SGV4KGlucHV0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxlZ2FjeUtleUhhc2hIZXgoaW5wdXQpIHtcbiAgcmV0dXJuIHNoYTI1NkhleChpbnB1dCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaWduSnd0KHBheWxvYWQsIHR0bFNlY29uZHMgPSAzNjAwKSB7XG4gIGNvbnN0IHNlY3JldCA9IHByb2Nlc3MuZW52LkpXVF9TRUNSRVQ7XG4gIGlmICghc2VjcmV0KSB7XG4gICAgdGhyb3cgY29uZmlnRXJyb3IoXG4gICAgICBcIk1pc3NpbmcgSldUX1NFQ1JFVFwiLFxuICAgICAgXCJTZXQgSldUX1NFQ1JFVCBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcyAodXNlIGEgbG9uZyByYW5kb20gc3RyaW5nKS5cIlxuICAgICk7XG4gIH1cblxuICBjb25zdCBoZWFkZXIgPSB7IGFsZzogXCJIUzI1NlwiLCB0eXA6IFwiSldUXCIgfTtcbiAgY29uc3Qgbm93ID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gIGNvbnN0IGJvZHkgPSB7IC4uLnBheWxvYWQsIGlhdDogbm93LCBleHA6IG5vdyArIHR0bFNlY29uZHMgfTtcblxuICBjb25zdCBoID0gYmFzZTY0dXJsKEpTT04uc3RyaW5naWZ5KGhlYWRlcikpO1xuICBjb25zdCBwID0gYmFzZTY0dXJsKEpTT04uc3RyaW5naWZ5KGJvZHkpKTtcbiAgY29uc3QgZGF0YSA9IGAke2h9LiR7cH1gO1xuICBjb25zdCBzaWcgPSBiYXNlNjR1cmwoY3J5cHRvLmNyZWF0ZUhtYWMoXCJzaGEyNTZcIiwgc2VjcmV0KS51cGRhdGUoZGF0YSkuZGlnZXN0KCkpO1xuXG4gIHJldHVybiBgJHtkYXRhfS4ke3NpZ31gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdmVyaWZ5Snd0KHRva2VuKSB7XG4gIGNvbnN0IHNlY3JldCA9IHByb2Nlc3MuZW52LkpXVF9TRUNSRVQ7XG4gIGlmICghc2VjcmV0KSB7XG4gICAgdGhyb3cgY29uZmlnRXJyb3IoXG4gICAgICBcIk1pc3NpbmcgSldUX1NFQ1JFVFwiLFxuICAgICAgXCJTZXQgSldUX1NFQ1JFVCBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcyAodXNlIGEgbG9uZyByYW5kb20gc3RyaW5nKS5cIlxuICAgICk7XG4gIH1cblxuICBjb25zdCBwYXJ0cyA9IHRva2VuLnNwbGl0KFwiLlwiKTtcbiAgaWYgKHBhcnRzLmxlbmd0aCAhPT0gMykgcmV0dXJuIG51bGw7XG5cbiAgY29uc3QgW2gsIHAsIHNdID0gcGFydHM7XG4gIGNvbnN0IGRhdGEgPSBgJHtofS4ke3B9YDtcbiAgY29uc3QgZXhwZWN0ZWQgPSBiYXNlNjR1cmwoY3J5cHRvLmNyZWF0ZUhtYWMoXCJzaGEyNTZcIiwgc2VjcmV0KS51cGRhdGUoZGF0YSkuZGlnZXN0KCkpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgYSA9IEJ1ZmZlci5mcm9tKGV4cGVjdGVkKTtcbiAgICBjb25zdCBiID0gQnVmZmVyLmZyb20ocyk7XG4gICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkgcmV0dXJuIG51bGw7XG4gICAgaWYgKCFjcnlwdG8udGltaW5nU2FmZUVxdWFsKGEsIGIpKSByZXR1cm4gbnVsbDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKFxuICAgICAgQnVmZmVyLmZyb20ocC5yZXBsYWNlKC8tL2csIFwiK1wiKS5yZXBsYWNlKC9fL2csIFwiL1wiKSwgXCJiYXNlNjRcIikudG9TdHJpbmcoXCJ1dGYtOFwiKVxuICAgICk7XG4gICAgY29uc3Qgbm93ID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gICAgaWYgKHBheWxvYWQuZXhwICYmIG5vdyA+IHBheWxvYWQuZXhwKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gcGF5bG9hZDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBxIH0gZnJvbSBcIi4vZGIuanNcIjtcbmltcG9ydCB7IGtleUhhc2hIZXgsIGxlZ2FjeUtleUhhc2hIZXgsIHZlcmlmeUp3dCB9IGZyb20gXCIuL2NyeXB0by5qc1wiO1xuaW1wb3J0IHsgbW9udGhLZXlVVEMgfSBmcm9tIFwiLi9odHRwLmpzXCI7XG5cbmZ1bmN0aW9uIGJhc2VTZWxlY3QoKSB7XG4gIHJldHVybiBgc2VsZWN0IGsuaWQgYXMgYXBpX2tleV9pZCwgay5jdXN0b21lcl9pZCwgay5rZXlfbGFzdDQsIGsubGFiZWwsIGsucm9sZSxcbiAgICAgICAgICAgICAgICAgay5tb250aGx5X2NhcF9jZW50cyBhcyBrZXlfY2FwX2NlbnRzLCBrLnJwbV9saW1pdCwgay5ycGRfbGltaXQsXG4gICAgICAgICAgICAgICAgIGsubWF4X2RldmljZXMsIGsucmVxdWlyZV9pbnN0YWxsX2lkLCBrLmFsbG93ZWRfcHJvdmlkZXJzLCBrLmFsbG93ZWRfbW9kZWxzLFxuICAgICAgICAgICAgICAgICBjLm1vbnRobHlfY2FwX2NlbnRzIGFzIGN1c3RvbWVyX2NhcF9jZW50cywgYy5pc19hY3RpdmUsXG4gICAgICAgICAgICAgICAgIGMubWF4X2RldmljZXNfcGVyX2tleSBhcyBjdXN0b21lcl9tYXhfZGV2aWNlc19wZXJfa2V5LCBjLnJlcXVpcmVfaW5zdGFsbF9pZCBhcyBjdXN0b21lcl9yZXF1aXJlX2luc3RhbGxfaWQsXG4gICAgICAgICAgICAgICAgIGMuYWxsb3dlZF9wcm92aWRlcnMgYXMgY3VzdG9tZXJfYWxsb3dlZF9wcm92aWRlcnMsIGMuYWxsb3dlZF9tb2RlbHMgYXMgY3VzdG9tZXJfYWxsb3dlZF9tb2RlbHMsXG4gICAgICAgICAgICAgICAgIGMucGxhbl9uYW1lIGFzIGN1c3RvbWVyX3BsYW5fbmFtZSwgYy5lbWFpbCBhcyBjdXN0b21lcl9lbWFpbFxuICAgICAgICAgIGZyb20gYXBpX2tleXMga1xuICAgICAgICAgIGpvaW4gY3VzdG9tZXJzIGMgb24gYy5pZCA9IGsuY3VzdG9tZXJfaWRgO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9va3VwS2V5KHBsYWluS2V5KSB7XG4gIC8vIFByZWZlcnJlZCBoYXNoIChwZXBwZXJlZCBpZiBlbmFibGVkKVxuICBjb25zdCBwcmVmZXJyZWQgPSBrZXlIYXNoSGV4KHBsYWluS2V5KTtcbiAgbGV0IGtleVJlcyA9IGF3YWl0IHEoXG4gICAgYCR7YmFzZVNlbGVjdCgpfVxuICAgICB3aGVyZSBrLmtleV9oYXNoPSQxIGFuZCBrLnJldm9rZWRfYXQgaXMgbnVsbFxuICAgICBsaW1pdCAxYCxcbiAgICBbcHJlZmVycmVkXVxuICApO1xuICBpZiAoa2V5UmVzLnJvd0NvdW50KSByZXR1cm4ga2V5UmVzLnJvd3NbMF07XG5cbiAgLy8gSWYgS0VZX1BFUFBFUiBpcyBlbmFibGVkLCBhbGxvdyBsZWdhY3kgU0hBLTI1NiBoYXNoZXMgYW5kIGF1dG8tbWlncmF0ZSBvbiBmaXJzdCBoaXQuXG4gIGlmIChwcm9jZXNzLmVudi5LRVlfUEVQUEVSKSB7XG4gICAgY29uc3QgbGVnYWN5ID0gbGVnYWN5S2V5SGFzaEhleChwbGFpbktleSk7XG4gICAga2V5UmVzID0gYXdhaXQgcShcbiAgICAgIGAke2Jhc2VTZWxlY3QoKX1cbiAgICAgICB3aGVyZSBrLmtleV9oYXNoPSQxIGFuZCBrLnJldm9rZWRfYXQgaXMgbnVsbFxuICAgICAgIGxpbWl0IDFgLFxuICAgICAgW2xlZ2FjeV1cbiAgICApO1xuICAgIGlmICgha2V5UmVzLnJvd0NvdW50KSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IHJvdyA9IGtleVJlcy5yb3dzWzBdO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBxKFxuICAgICAgICBgdXBkYXRlIGFwaV9rZXlzIHNldCBrZXlfaGFzaD0kMVxuICAgICAgICAgd2hlcmUgaWQ9JDIgYW5kIGtleV9oYXNoPSQzYCxcbiAgICAgICAgW3ByZWZlcnJlZCwgcm93LmFwaV9rZXlfaWQsIGxlZ2FjeV1cbiAgICAgICk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBpZ25vcmUgbWlncmF0aW9uIGVycm9yc1xuICAgIH1cblxuICAgIHJldHVybiByb3c7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvb2t1cEtleUJ5SWQoYXBpX2tleV9pZCkge1xuICBjb25zdCBrZXlSZXMgPSBhd2FpdCBxKFxuICAgIGAke2Jhc2VTZWxlY3QoKX1cbiAgICAgd2hlcmUgay5pZD0kMSBhbmQgay5yZXZva2VkX2F0IGlzIG51bGxcbiAgICAgbGltaXQgMWAsXG4gICAgW2FwaV9rZXlfaWRdXG4gICk7XG4gIGlmICgha2V5UmVzLnJvd0NvdW50KSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIGtleVJlcy5yb3dzWzBdO1xufVxuXG4vKipcbiAqIFJlc29sdmUgYW4gQXV0aG9yaXphdGlvbiBCZWFyZXIgdG9rZW4uXG4gKiBTdXBwb3J0ZWQ6XG4gKiAtIEthaXh1IHN1Yi1rZXkgKHBsYWluIHZpcnR1YWwga2V5KVxuICogLSBTaG9ydC1saXZlZCB1c2VyIHNlc3Npb24gSldUICh0eXBlOiAndXNlcl9zZXNzaW9uJylcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlc29sdmVBdXRoKHRva2VuKSB7XG4gIGlmICghdG9rZW4pIHJldHVybiBudWxsO1xuXG4gIC8vIEpXVHMgaGF2ZSAzIGRvdC1zZXBhcmF0ZWQgcGFydHMuIEthaXh1IGtleXMgZG8gbm90LlxuICBjb25zdCBwYXJ0cyA9IHRva2VuLnNwbGl0KFwiLlwiKTtcbiAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMykge1xuICAgIGNvbnN0IHBheWxvYWQgPSB2ZXJpZnlKd3QodG9rZW4pO1xuICAgIGlmICghcGF5bG9hZCkgcmV0dXJuIG51bGw7XG4gICAgaWYgKHBheWxvYWQudHlwZSAhPT0gXCJ1c2VyX3Nlc3Npb25cIikgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCByb3cgPSBhd2FpdCBsb29rdXBLZXlCeUlkKHBheWxvYWQuYXBpX2tleV9pZCk7XG4gICAgcmV0dXJuIHJvdztcbiAgfVxuXG4gIHJldHVybiBhd2FpdCBsb29rdXBLZXkodG9rZW4pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0TW9udGhSb2xsdXAoY3VzdG9tZXJfaWQsIG1vbnRoID0gbW9udGhLZXlVVEMoKSkge1xuICBjb25zdCByb2xsID0gYXdhaXQgcShcbiAgICBgc2VsZWN0IHNwZW50X2NlbnRzLCBleHRyYV9jZW50cywgaW5wdXRfdG9rZW5zLCBvdXRwdXRfdG9rZW5zXG4gICAgIGZyb20gbW9udGhseV91c2FnZSB3aGVyZSBjdXN0b21lcl9pZD0kMSBhbmQgbW9udGg9JDJgLFxuICAgIFtjdXN0b21lcl9pZCwgbW9udGhdXG4gICk7XG4gIGlmIChyb2xsLnJvd0NvdW50ID09PSAwKSByZXR1cm4geyBzcGVudF9jZW50czogMCwgZXh0cmFfY2VudHM6IDAsIGlucHV0X3Rva2VuczogMCwgb3V0cHV0X3Rva2VuczogMCB9O1xuICByZXR1cm4gcm9sbC5yb3dzWzBdO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0S2V5TW9udGhSb2xsdXAoYXBpX2tleV9pZCwgbW9udGggPSBtb250aEtleVVUQygpKSB7XG4gIGNvbnN0IHJvbGwgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3Qgc3BlbnRfY2VudHMsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2VucywgY2FsbHNcbiAgICAgZnJvbSBtb250aGx5X2tleV91c2FnZSB3aGVyZSBhcGlfa2V5X2lkPSQxIGFuZCBtb250aD0kMmAsXG4gICAgW2FwaV9rZXlfaWQsIG1vbnRoXVxuICApO1xuICBpZiAocm9sbC5yb3dDb3VudCkgcmV0dXJuIHJvbGwucm93c1swXTtcblxuICAvLyBCYWNrZmlsbCBmb3IgbWlncmF0ZWQgaW5zdGFsbHMgKHdoZW4gbW9udGhseV9rZXlfdXNhZ2UgZGlkIG5vdCBleGlzdCB5ZXQpLlxuICBjb25zdCBrZXlNZXRhID0gYXdhaXQgcShgc2VsZWN0IGN1c3RvbWVyX2lkIGZyb20gYXBpX2tleXMgd2hlcmUgaWQ9JDFgLCBbYXBpX2tleV9pZF0pO1xuICBjb25zdCBjdXN0b21lcl9pZCA9IGtleU1ldGEucm93Q291bnQgPyBrZXlNZXRhLnJvd3NbMF0uY3VzdG9tZXJfaWQgOiBudWxsO1xuXG4gIGNvbnN0IGFnZyA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBjb2FsZXNjZShzdW0oY29zdF9jZW50cyksMCk6OmludCBhcyBzcGVudF9jZW50cyxcbiAgICAgICAgICAgIGNvYWxlc2NlKHN1bShpbnB1dF90b2tlbnMpLDApOjppbnQgYXMgaW5wdXRfdG9rZW5zLFxuICAgICAgICAgICAgY29hbGVzY2Uoc3VtKG91dHB1dF90b2tlbnMpLDApOjppbnQgYXMgb3V0cHV0X3Rva2VucyxcbiAgICAgICAgICAgIGNvdW50KCopOjppbnQgYXMgY2FsbHNcbiAgICAgZnJvbSB1c2FnZV9ldmVudHNcbiAgICAgd2hlcmUgYXBpX2tleV9pZD0kMSBhbmQgdG9fY2hhcihjcmVhdGVkX2F0IGF0IHRpbWUgem9uZSAnVVRDJywnWVlZWS1NTScpPSQyYCxcbiAgICBbYXBpX2tleV9pZCwgbW9udGhdXG4gICk7XG5cbiAgY29uc3Qgcm93ID0gYWdnLnJvd3NbMF0gfHwgeyBzcGVudF9jZW50czogMCwgaW5wdXRfdG9rZW5zOiAwLCBvdXRwdXRfdG9rZW5zOiAwLCBjYWxsczogMCB9O1xuXG4gIGlmIChjdXN0b21lcl9pZCAhPSBudWxsKSB7XG4gICAgYXdhaXQgcShcbiAgICAgIGBpbnNlcnQgaW50byBtb250aGx5X2tleV91c2FnZShhcGlfa2V5X2lkLCBjdXN0b21lcl9pZCwgbW9udGgsIHNwZW50X2NlbnRzLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnMsIGNhbGxzKVxuICAgICAgIHZhbHVlcyAoJDEsJDIsJDMsJDQsJDUsJDYsJDcpXG4gICAgICAgb24gY29uZmxpY3QgKGFwaV9rZXlfaWQsIG1vbnRoKVxuICAgICAgIGRvIHVwZGF0ZSBzZXRcbiAgICAgICAgIHNwZW50X2NlbnRzID0gZXhjbHVkZWQuc3BlbnRfY2VudHMsXG4gICAgICAgICBpbnB1dF90b2tlbnMgPSBleGNsdWRlZC5pbnB1dF90b2tlbnMsXG4gICAgICAgICBvdXRwdXRfdG9rZW5zID0gZXhjbHVkZWQub3V0cHV0X3Rva2VucyxcbiAgICAgICAgIGNhbGxzID0gZXhjbHVkZWQuY2FsbHMsXG4gICAgICAgICB1cGRhdGVkX2F0ID0gbm93KClgLFxuICAgICAgW2FwaV9rZXlfaWQsIGN1c3RvbWVyX2lkLCBtb250aCwgcm93LnNwZW50X2NlbnRzIHx8IDAsIHJvdy5pbnB1dF90b2tlbnMgfHwgMCwgcm93Lm91dHB1dF90b2tlbnMgfHwgMCwgcm93LmNhbGxzIHx8IDBdXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiByb3c7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlZmZlY3RpdmVDYXBDZW50cyhrZXlSb3csIHJvbGx1cCkge1xuICBjb25zdCBiYXNlID0ga2V5Um93LmtleV9jYXBfY2VudHMgPz8ga2V5Um93LmN1c3RvbWVyX2NhcF9jZW50cztcbiAgY29uc3QgZXh0cmEgPSByb2xsdXAuZXh0cmFfY2VudHMgfHwgMDtcbiAgcmV0dXJuIChiYXNlIHx8IDApICsgZXh0cmE7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXN0b21lckNhcENlbnRzKGtleVJvdywgY3VzdG9tZXJSb2xsdXApIHtcbiAgY29uc3QgYmFzZSA9IGtleVJvdy5jdXN0b21lcl9jYXBfY2VudHMgfHwgMDtcbiAgY29uc3QgZXh0cmEgPSBjdXN0b21lclJvbGx1cC5leHRyYV9jZW50cyB8fCAwO1xuICByZXR1cm4gYmFzZSArIGV4dHJhO1xufVxuXG5leHBvcnQgZnVuY3Rpb24ga2V5Q2FwQ2VudHMoa2V5Um93LCBjdXN0b21lclJvbGx1cCkge1xuICAvLyBJZiBhIGtleSBvdmVycmlkZSBleGlzdHMsIGl0J3MgYSBoYXJkIGNhcCBmb3IgdGhhdCBrZXkuIE90aGVyd2lzZSBpdCBpbmhlcml0cyB0aGUgY3VzdG9tZXIgY2FwLlxuICBpZiAoa2V5Um93LmtleV9jYXBfY2VudHMgIT0gbnVsbCkgcmV0dXJuIGtleVJvdy5rZXlfY2FwX2NlbnRzO1xuICByZXR1cm4gY3VzdG9tZXJDYXBDZW50cyhrZXlSb3csIGN1c3RvbWVyUm9sbHVwKTtcbn1cblxuXG5jb25zdCBST0xFX09SREVSID0gW1widmlld2VyXCIsXCJkZXBsb3llclwiLFwiYWRtaW5cIixcIm93bmVyXCJdO1xuXG5leHBvcnQgZnVuY3Rpb24gcm9sZUF0TGVhc3QoYWN0dWFsLCByZXF1aXJlZCkge1xuICBjb25zdCBhID0gUk9MRV9PUkRFUi5pbmRleE9mKChhY3R1YWwgfHwgXCJkZXBsb3llclwiKS50b0xvd2VyQ2FzZSgpKTtcbiAgY29uc3QgciA9IFJPTEVfT1JERVIuaW5kZXhPZigocmVxdWlyZWQgfHwgXCJkZXBsb3llclwiKS50b0xvd2VyQ2FzZSgpKTtcbiAgcmV0dXJuIGEgPj0gciAmJiBhICE9PSAtMSAmJiByICE9PSAtMTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVpcmVLZXlSb2xlKGtleVJvdywgcmVxdWlyZWRSb2xlKSB7XG4gIGNvbnN0IGFjdHVhbCA9IChrZXlSb3c/LnJvbGUgfHwgXCJkZXBsb3llclwiKS50b0xvd2VyQ2FzZSgpO1xuICBpZiAoIXJvbGVBdExlYXN0KGFjdHVhbCwgcmVxdWlyZWRSb2xlKSkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcIkZvcmJpZGRlblwiKTtcbiAgICBlcnIuc3RhdHVzID0gNDAzO1xuICAgIGVyci5jb2RlID0gXCJGT1JCSURERU5cIjtcbiAgICBlcnIuaGludCA9IGBSZXF1aXJlcyByb2xlICcke3JlcXVpcmVkUm9sZX0nLCBidXQga2V5IHJvbGUgaXMgJyR7YWN0dWFsfScuYDtcbiAgICB0aHJvdyBlcnI7XG4gIH1cbn1cbiIsICJmdW5jdGlvbiBub3JtQXJyYXkoYSkge1xuICBpZiAoIWEpIHJldHVybiBudWxsO1xuICBpZiAoQXJyYXkuaXNBcnJheShhKSkgcmV0dXJuIGEubWFwKFN0cmluZykubWFwKHM9PnMudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XG4gIGlmICh0eXBlb2YgYSA9PT0gJ3N0cmluZycpIHJldHVybiBhLnNwbGl0KCcsJykubWFwKHM9PnMudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XG4gIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIEFsbG93ZWQgbW9kZWxzIHNoYXBlIChKU09OKTpcbiAqIC0geyBcIm9wZW5haVwiOiBbXCJncHQtNG8tbWluaVwiLFwiZ3B0LTQuMVwiXSwgXCJhbnRocm9waWNcIjogW1wiY2xhdWRlLTMtNS1zb25uZXQtMjAyNDEwMjJcIl0sIFwiZ2VtaW5pXCI6IFtcImdlbWluaS0xLjUtZmxhc2hcIiBdIH1cbiAqIC0gT1IgeyBcIipcIjogW1wiKlwiXSB9IHRvIGFsbG93IGFsbFxuICogLSBPUiB7IFwib3BlbmFpXCI6IFtcIipcIl0gfSB0byBhbGxvdyBhbnkgbW9kZWwgd2l0aGluIHRoYXQgcHJvdmlkZXJcbiAqL1xuZnVuY3Rpb24gcGFyc2VBbGxvd2VkTW9kZWxzKG0pIHtcbiAgaWYgKCFtKSByZXR1cm4gbnVsbDtcbiAgaWYgKHR5cGVvZiBtID09PSAnb2JqZWN0JykgcmV0dXJuIG07XG4gIHRyeSB7IHJldHVybiBKU09OLnBhcnNlKFN0cmluZyhtKSk7IH0gY2F0Y2ggeyByZXR1cm4gbnVsbDsgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZWZmZWN0aXZlQWxsb3dsaXN0KGtleVJvdykge1xuICBjb25zdCBwcm92aWRlcnMgPSBub3JtQXJyYXkoa2V5Um93LmFsbG93ZWRfcHJvdmlkZXJzKSA/PyBub3JtQXJyYXkoa2V5Um93LmN1c3RvbWVyX2FsbG93ZWRfcHJvdmlkZXJzKTtcbiAgY29uc3QgbW9kZWxzID0gcGFyc2VBbGxvd2VkTW9kZWxzKGtleVJvdy5hbGxvd2VkX21vZGVscykgPz8gcGFyc2VBbGxvd2VkTW9kZWxzKGtleVJvdy5jdXN0b21lcl9hbGxvd2VkX21vZGVscyk7XG4gIHJldHVybiB7IHByb3ZpZGVycywgbW9kZWxzIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRBbGxvd2VkKHsgcHJvdmlkZXIsIG1vZGVsLCBrZXlSb3cgfSkge1xuICBjb25zdCB7IHByb3ZpZGVycywgbW9kZWxzIH0gPSBlZmZlY3RpdmVBbGxvd2xpc3Qoa2V5Um93KTtcblxuICBpZiAocHJvdmlkZXJzICYmIHByb3ZpZGVycy5sZW5ndGgpIHtcbiAgICBpZiAoIXByb3ZpZGVycy5pbmNsdWRlcygnKicpICYmICFwcm92aWRlcnMuaW5jbHVkZXMocHJvdmlkZXIpKSB7XG4gICAgICByZXR1cm4geyBvazogZmFsc2UsIHN0YXR1czogNDAzLCBlcnJvcjogYFByb3ZpZGVyIG5vdCBhbGxvd2VkIGZvciB0aGlzIGtleSAoJHtwcm92aWRlcn0pYCB9O1xuICAgIH1cbiAgfVxuXG4gIGlmIChtb2RlbHMpIHtcbiAgICAvLyBnbG9iYWwgYWxsb3dcbiAgICBpZiAobW9kZWxzWycqJ10pIHtcbiAgICAgIGNvbnN0IGFyciA9IG5vcm1BcnJheShtb2RlbHNbJyonXSk7XG4gICAgICBpZiAoYXJyICYmIGFyci5pbmNsdWRlcygnKicpKSByZXR1cm4geyBvazogdHJ1ZSB9O1xuICAgIH1cblxuICAgIGNvbnN0IGxpc3QgPSBtb2RlbHNbcHJvdmlkZXJdO1xuICAgIGlmIChsaXN0KSB7XG4gICAgICBjb25zdCBhcnIgPSBub3JtQXJyYXkobGlzdCkgfHwgW107XG4gICAgICBpZiAoYXJyLmluY2x1ZGVzKCcqJykpIHJldHVybiB7IG9rOiB0cnVlIH07XG4gICAgICBpZiAoIWFyci5pbmNsdWRlcyhtb2RlbCkpIHtcbiAgICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBzdGF0dXM6IDQwMywgZXJyb3I6IGBNb2RlbCBub3QgYWxsb3dlZCBmb3IgdGhpcyBrZXkgKCR7cHJvdmlkZXJ9OiR7bW9kZWx9KWAgfTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSWYgYSBtb2RlbHMgb2JqZWN0IGV4aXN0cyBidXQgZG9lc24ndCBpbmNsdWRlIHByb3ZpZGVyLCB0cmVhdCBhcyBkZW55LlxuICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBzdGF0dXM6IDQwMywgZXJyb3I6IGBQcm92aWRlciBub3QgYWxsb3dlZCBieSBtb2RlbCBhbGxvd2xpc3QgKCR7cHJvdmlkZXJ9KWAgfTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBvazogdHJ1ZSB9O1xufVxuIiwgImltcG9ydCB7IHEgfSBmcm9tICcuL2RiLmpzJztcblxuLyoqXG4gKiBFbmZvcmNlIGluc3RhbGwvZGV2aWNlIGJpbmRpbmcgYW5kIHNlYXQgbGltaXRzLlxuICpcbiAqIElucHV0czpcbiAqIC0ga2V5Um93IGNvbnRhaW5zOiBhcGlfa2V5X2lkLCBjdXN0b21lcl9pZFxuICogLSBpbnN0YWxsX2lkOiBzdHJpbmd8bnVsbFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZW5mb3JjZURldmljZSh7IGtleVJvdywgaW5zdGFsbF9pZCwgdWEsIGFjdG9yID0gJ2dhdGV3YXknIH0pIHtcbiAgY29uc3QgcmVxdWlyZUluc3RhbGwgPSAhIShrZXlSb3cucmVxdWlyZV9pbnN0YWxsX2lkIHx8IGtleVJvdy5jdXN0b21lcl9yZXF1aXJlX2luc3RhbGxfaWQpO1xuICBjb25zdCBtYXhEZXZpY2VzID0gKE51bWJlci5pc0Zpbml0ZShrZXlSb3cubWF4X2RldmljZXMpID8ga2V5Um93Lm1heF9kZXZpY2VzIDogbnVsbCkgPz8gKE51bWJlci5pc0Zpbml0ZShrZXlSb3cuY3VzdG9tZXJfbWF4X2RldmljZXNfcGVyX2tleSkgPyBrZXlSb3cuY3VzdG9tZXJfbWF4X2RldmljZXNfcGVyX2tleSA6IG51bGwpO1xuXG4gIGlmICgocmVxdWlyZUluc3RhbGwgfHwgKG1heERldmljZXMgIT0gbnVsbCAmJiBtYXhEZXZpY2VzID4gMCkpICYmICFpbnN0YWxsX2lkKSB7XG4gICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBzdGF0dXM6IDQwMCwgZXJyb3I6ICdNaXNzaW5nIHgta2FpeHUtaW5zdGFsbC1pZCAocmVxdWlyZWQgZm9yIHRoaXMga2V5KScgfTtcbiAgfVxuXG4gIC8vIE5vIGluc3RhbGwgaWQgYW5kIG5vIGVuZm9yY2VtZW50XG4gIGlmICghaW5zdGFsbF9pZCkgcmV0dXJuIHsgb2s6IHRydWUgfTtcblxuICAvLyBMb2FkIGV4aXN0aW5nIHJlY29yZFxuICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBhcGlfa2V5X2lkLCBpbnN0YWxsX2lkLCBmaXJzdF9zZWVuX2F0LCBsYXN0X3NlZW5fYXQsIHJldm9rZWRfYXRcbiAgICAgZnJvbSBrZXlfZGV2aWNlc1xuICAgICB3aGVyZSBhcGlfa2V5X2lkPSQxIGFuZCBpbnN0YWxsX2lkPSQyXG4gICAgIGxpbWl0IDFgLFxuICAgIFtrZXlSb3cuYXBpX2tleV9pZCwgaW5zdGFsbF9pZF1cbiAgKTtcblxuICBpZiAoZXhpc3Rpbmcucm93Q291bnQpIHtcbiAgICBjb25zdCByb3cgPSBleGlzdGluZy5yb3dzWzBdO1xuICAgIGlmIChyb3cucmV2b2tlZF9hdCkge1xuICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBzdGF0dXM6IDQwMywgZXJyb3I6ICdEZXZpY2UgcmV2b2tlZCBmb3IgdGhpcyBrZXknIH07XG4gICAgfVxuICAgIC8vIFVwZGF0ZSBsYXN0IHNlZW4gKGJlc3QtZWZmb3J0KVxuICAgIGF3YWl0IHEoXG4gICAgICBgdXBkYXRlIGtleV9kZXZpY2VzIHNldCBsYXN0X3NlZW5fYXQ9bm93KCksIGxhc3Rfc2Vlbl91YT1jb2FsZXNjZSgkMyxsYXN0X3NlZW5fdWEpXG4gICAgICAgd2hlcmUgYXBpX2tleV9pZD0kMSBhbmQgaW5zdGFsbF9pZD0kMmAsXG4gICAgICBba2V5Um93LmFwaV9rZXlfaWQsIGluc3RhbGxfaWQsIHVhIHx8IG51bGxdXG4gICAgKTtcbiAgICByZXR1cm4geyBvazogdHJ1ZSB9O1xuICB9XG5cbiAgLy8gTmV3IGRldmljZTogc2VhdCBjaGVja1xuICBpZiAobWF4RGV2aWNlcyAhPSBudWxsICYmIG1heERldmljZXMgPiAwKSB7XG4gICAgY29uc3QgYWN0aXZlQ291bnQgPSBhd2FpdCBxKFxuICAgICAgYHNlbGVjdCBjb3VudCgqKTo6aW50IGFzIG5cbiAgICAgICBmcm9tIGtleV9kZXZpY2VzXG4gICAgICAgd2hlcmUgYXBpX2tleV9pZD0kMSBhbmQgcmV2b2tlZF9hdCBpcyBudWxsYCxcbiAgICAgIFtrZXlSb3cuYXBpX2tleV9pZF1cbiAgICApO1xuICAgIGNvbnN0IG4gPSBhY3RpdmVDb3VudC5yb3dzPy5bMF0/Lm4gPz8gMDtcbiAgICBpZiAobiA+PSBtYXhEZXZpY2VzKSB7XG4gICAgICByZXR1cm4geyBvazogZmFsc2UsIHN0YXR1czogNDAzLCBlcnJvcjogYERldmljZSBsaW1pdCByZWFjaGVkICgke259LyR7bWF4RGV2aWNlc30pLiBSZXZva2UgYW4gb2xkIGRldmljZSBvciByYWlzZSBzZWF0cy5gIH07XG4gICAgfVxuICB9XG5cbiAgLy8gSW5zZXJ0IG5ldyBkZXZpY2VcbiAgYXdhaXQgcShcbiAgICBgaW5zZXJ0IGludG8ga2V5X2RldmljZXMoYXBpX2tleV9pZCwgY3VzdG9tZXJfaWQsIGluc3RhbGxfaWQsIGxhc3Rfc2Vlbl9hdCwgbGFzdF9zZWVuX3VhKVxuICAgICB2YWx1ZXMgKCQxLCQyLCQzLG5vdygpLCQ0KVxuICAgICBvbiBjb25mbGljdCAoYXBpX2tleV9pZCwgaW5zdGFsbF9pZClcbiAgICAgZG8gdXBkYXRlIHNldCBsYXN0X3NlZW5fYXQ9ZXhjbHVkZWQubGFzdF9zZWVuX2F0LCBsYXN0X3NlZW5fdWE9Y29hbGVzY2UoZXhjbHVkZWQubGFzdF9zZWVuX3VhLGtleV9kZXZpY2VzLmxhc3Rfc2Vlbl91YSlgLFxuICAgIFtrZXlSb3cuYXBpX2tleV9pZCwga2V5Um93LmN1c3RvbWVyX2lkLCBpbnN0YWxsX2lkLCB1YSB8fCBudWxsXVxuICApO1xuXG4gIHJldHVybiB7IG9rOiB0cnVlIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsaXN0RGV2aWNlc0ZvcktleShhcGlfa2V5X2lkLCBsaW1pdCA9IDIwMCkge1xuICBjb25zdCByZXMgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3QgYXBpX2tleV9pZCwgaW5zdGFsbF9pZCwgZGV2aWNlX2xhYmVsLCBmaXJzdF9zZWVuX2F0LCBsYXN0X3NlZW5fYXQsIHJldm9rZWRfYXQsIHJldm9rZWRfYnksIGxhc3Rfc2Vlbl91YVxuICAgICBmcm9tIGtleV9kZXZpY2VzXG4gICAgIHdoZXJlIGFwaV9rZXlfaWQ9JDFcbiAgICAgb3JkZXIgYnkgbGFzdF9zZWVuX2F0IGRlc2MgbnVsbHMgbGFzdCwgZmlyc3Rfc2Vlbl9hdCBkZXNjXG4gICAgIGxpbWl0ICQyYCxcbiAgICBbYXBpX2tleV9pZCwgbGltaXRdXG4gICk7XG4gIHJldHVybiByZXMucm93cztcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldERldmljZVJldm9rZWQoeyBhcGlfa2V5X2lkLCBpbnN0YWxsX2lkLCByZXZva2VkLCBhY3RvciA9ICdhZG1pbicgfSkge1xuICBpZiAocmV2b2tlZCkge1xuICAgIGF3YWl0IHEoXG4gICAgICBgdXBkYXRlIGtleV9kZXZpY2VzXG4gICAgICAgc2V0IHJldm9rZWRfYXQ9bm93KCksIHJldm9rZWRfYnk9JDNcbiAgICAgICB3aGVyZSBhcGlfa2V5X2lkPSQxIGFuZCBpbnN0YWxsX2lkPSQyIGFuZCByZXZva2VkX2F0IGlzIG51bGxgLFxuICAgICAgW2FwaV9rZXlfaWQsIGluc3RhbGxfaWQsIGFjdG9yXVxuICAgICk7XG4gIH0gZWxzZSB7XG4gICAgYXdhaXQgcShcbiAgICAgIGB1cGRhdGUga2V5X2RldmljZXNcbiAgICAgICBzZXQgcmV2b2tlZF9hdD1udWxsLCByZXZva2VkX2J5PW51bGxcbiAgICAgICB3aGVyZSBhcGlfa2V5X2lkPSQxIGFuZCBpbnN0YWxsX2lkPSQyIGFuZCByZXZva2VkX2F0IGlzIG5vdCBudWxsYCxcbiAgICAgIFthcGlfa2V5X2lkLCBpbnN0YWxsX2lkXVxuICAgICk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBxIH0gZnJvbSBcIi4vX2xpYi9kYi5qc1wiO1xuaW1wb3J0IHsgY2FsbE9wZW5BSSwgY2FsbEFudGhyb3BpYywgY2FsbEdlbWluaSB9IGZyb20gXCIuL19saWIvcHJvdmlkZXJzLmpzXCI7XG5pbXBvcnQgeyBjb3N0Q2VudHMgfSBmcm9tIFwiLi9fbGliL3ByaWNpbmcuanNcIjtcbmltcG9ydCB7IGdldEJlYXJlciwgbW9udGhLZXlVVEMgfSBmcm9tIFwiLi9fbGliL2h0dHAuanNcIjtcbmltcG9ydCB7IHJlc29sdmVBdXRoLCBsb29rdXBLZXlCeUlkLCBnZXRNb250aFJvbGx1cCwgZ2V0S2V5TW9udGhSb2xsdXAsIGN1c3RvbWVyQ2FwQ2VudHMsIGtleUNhcENlbnRzIH0gZnJvbSBcIi4vX2xpYi9hdXRoei5qc1wiO1xuaW1wb3J0IHsgYXNzZXJ0QWxsb3dlZCB9IGZyb20gXCIuL19saWIvYWxsb3dsaXN0LmpzXCI7XG5pbXBvcnQgeyBlbmZvcmNlRGV2aWNlIH0gZnJvbSBcIi4vX2xpYi9kZXZpY2VzLmpzXCI7XG5cbi8vIE5PVEU6IFRoaXMgaXMgYSBOZXRsaWZ5IEJhY2tncm91bmQgRnVuY3Rpb24uXG4vLyBOYW1pbmcgcnVsZTogbXVzdCBpbmNsdWRlIFwiLWJhY2tncm91bmRcIiBpbiBmaWxlbmFtZSAoTmV0bGlmeSBkb2NzKS5cbmV4cG9ydCBkZWZhdWx0IGFzeW5jIChyZXEpID0+IHtcbiAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSByZXR1cm47XG5cbiAgY29uc3Qgc2VjcmV0ID0gKHByb2Nlc3MuZW52LkpPQl9XT1JLRVJfU0VDUkVUIHx8IFwiXCIpLnRyaW0oKTtcbiAgY29uc3QgZ290U2VjcmV0ID0gKHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtam9iLXNlY3JldFwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJ4LWpvYi13b3JrZXItc2VjcmV0XCIpIHx8IFwiXCIpLnRyaW0oKTtcblxuICBsZXQgYm9keTtcbiAgdHJ5IHsgYm9keSA9IGF3YWl0IHJlcS5qc29uKCk7IH0gY2F0Y2ggeyByZXR1cm47IH1cbiAgY29uc3QgaWQgPSAoYm9keT8uaWQgfHwgXCJcIikudG9TdHJpbmcoKS50cmltKCk7XG4gIGlmICghaWQpIHJldHVybjtcblxuICAvLyBMb2FkIGpvYlxuICBjb25zdCBqciA9IGF3YWl0IHEoYHNlbGVjdCAqIGZyb20gYXN5bmNfam9icyB3aGVyZSBpZCA9ICQxYCwgW2lkXSk7XG4gIGlmICghanIucm93cy5sZW5ndGgpIHJldHVybjtcblxuICBjb25zdCBqb2IgPSBqci5yb3dzWzBdO1xuICBpZiAoam9iLnN0YXR1cyA9PT0gXCJzdWNjZWVkZWRcIiB8fCBqb2Iuc3RhdHVzID09PSBcImZhaWxlZFwiKSByZXR1cm47XG5cbiAgLy8gLS0tIEF1dGhvcml6YXRpb24gZm9yIHdvcmtlciBraWNrIC0tLVxuICAvLyBJZiBKT0JfV09SS0VSX1NFQ1JFVCBpcyBjb25maWd1cmVkLCByZXF1aXJlIGl0LlxuICAvLyBPdGhlcndpc2UgcmVxdWlyZSBBdXRob3JpemF0aW9uOiBCZWFyZXIgPGtleXx1c2VyX3Nlc3Npb25fand0PiBtYXRjaGluZyB0aGUgam9iJ3MgYXBpX2tleV9pZC5cbiAgaWYgKHNlY3JldCkge1xuICAgIGlmICghZ290U2VjcmV0IHx8IGdvdFNlY3JldCAhPT0gc2VjcmV0KSByZXR1cm47XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgdG9rZW4gPSBnZXRCZWFyZXIocmVxKTtcbiAgICBpZiAoIXRva2VuKSByZXR1cm47XG4gICAgY29uc3QgaW52b2tlciA9IGF3YWl0IHJlc29sdmVBdXRoKHRva2VuKTtcbiAgICBpZiAoIWludm9rZXIpIHJldHVybjtcbiAgICBpZiAoU3RyaW5nKGludm9rZXIuYXBpX2tleV9pZCkgIT09IFN0cmluZyhqb2IuYXBpX2tleV9pZCkpIHJldHVybjtcbiAgICBpZiAoU3RyaW5nKGludm9rZXIuY3VzdG9tZXJfaWQpICE9PSBTdHJpbmcoam9iLmN1c3RvbWVyX2lkKSkgcmV0dXJuO1xuICAgIGlmICghaW52b2tlci5pc19hY3RpdmUpIHJldHVybjtcbiAgfVxuXG4gIC8vIExvYWQgYXV0aG9yaXRhdGl2ZSBjdXJyZW50IGtleS9jdXN0b21lciBzdGF0ZSAocmV2b2NhdGlvbnMgLyBwbGFuIGNoYW5nZXMpXG4gIGNvbnN0IGtleVJvdyA9IGF3YWl0IGxvb2t1cEtleUJ5SWQoam9iLmFwaV9rZXlfaWQpO1xuICBpZiAoIWtleVJvdykge1xuICAgIGF3YWl0IHEoXG4gICAgICBgdXBkYXRlIGFzeW5jX2pvYnMgc2V0IHN0YXR1cz0nZmFpbGVkJywgY29tcGxldGVkX2F0PW5vdygpLCBoZWFydGJlYXRfYXQ9bm93KCksIGVycm9yPSQyIHdoZXJlIGlkPSQxYCxcbiAgICAgIFtpZCwgXCJJbnZhbGlkIG9yIHJldm9rZWQga2V5XCJdXG4gICAgKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKFN0cmluZyhrZXlSb3cuY3VzdG9tZXJfaWQpICE9PSBTdHJpbmcoam9iLmN1c3RvbWVyX2lkKSkge1xuICAgIGF3YWl0IHEoXG4gICAgICBgdXBkYXRlIGFzeW5jX2pvYnMgc2V0IHN0YXR1cz0nZmFpbGVkJywgY29tcGxldGVkX2F0PW5vdygpLCBoZWFydGJlYXRfYXQ9bm93KCksIGVycm9yPSQyIHdoZXJlIGlkPSQxYCxcbiAgICAgIFtpZCwgXCJKb2Igb3duZXJzaGlwIG1pc21hdGNoXCJdXG4gICAgKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKCFrZXlSb3cuaXNfYWN0aXZlKSB7XG4gICAgYXdhaXQgcShcbiAgICAgIGB1cGRhdGUgYXN5bmNfam9icyBzZXQgc3RhdHVzPSdmYWlsZWQnLCBjb21wbGV0ZWRfYXQ9bm93KCksIGhlYXJ0YmVhdF9hdD1ub3coKSwgZXJyb3I9JDIgd2hlcmUgaWQ9JDFgLFxuICAgICAgW2lkLCBcIkN1c3RvbWVyIGRpc2FibGVkXCJdXG4gICAgKTtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBNYXJrIHJ1bm5pbmcgKGJlc3QtZWZmb3J0KVxuICBhd2FpdCBxKFxuICAgIGB1cGRhdGUgYXN5bmNfam9icyBzZXQgc3RhdHVzID0gJ3J1bm5pbmcnLCBzdGFydGVkX2F0ID0gY29hbGVzY2Uoc3RhcnRlZF9hdCwgbm93KCkpLCBoZWFydGJlYXRfYXQgPSBub3coKVxuICAgICB3aGVyZSBpZCA9ICQxYCxcbiAgICBbaWRdXG4gICk7XG5cbiAgbGV0IHJlcXVlc3Q7XG4gIHRyeSB7XG4gICAgcmVxdWVzdCA9IHR5cGVvZiBqb2IucmVxdWVzdCA9PT0gXCJzdHJpbmdcIiA/IEpTT04ucGFyc2Uoam9iLnJlcXVlc3QpIDogam9iLnJlcXVlc3Q7XG4gIH0gY2F0Y2gge1xuICAgIHJlcXVlc3QgPSBqb2IucmVxdWVzdCB8fCB7fTtcbiAgfVxuXG4gIGxldCBtZXRhID0ge307XG4gIHRyeSB7XG4gICAgbWV0YSA9IHR5cGVvZiBqb2IubWV0YSA9PT0gXCJzdHJpbmdcIiA/IEpTT04ucGFyc2Uoam9iLm1ldGEpIDogKGpvYi5tZXRhIHx8IHt9KTtcbiAgfSBjYXRjaCB7XG4gICAgbWV0YSA9IGpvYi5tZXRhIHx8IHt9O1xuICB9XG5cbiAgY29uc3QgdGVsZW1ldHJ5ID0gbWV0YT8udGVsZW1ldHJ5IHx8IHt9O1xuICBjb25zdCBpbnN0YWxsX2lkID0gKHRlbGVtZXRyeS5pbnN0YWxsX2lkIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpLnNsaWNlKDAsIDgwKSB8fCBudWxsO1xuICBjb25zdCBpcF9oYXNoID0gKHRlbGVtZXRyeS5pcF9oYXNoIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpLnNsaWNlKDAsIDEyOCkgfHwgbnVsbDtcbiAgY29uc3QgdWEgPSAodGVsZW1ldHJ5LnVhIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpLnNsaWNlKDAsIDI0MCkgfHwgbnVsbDtcblxuICBjb25zdCBwcm92aWRlciA9IFN0cmluZyhqb2IucHJvdmlkZXIgfHwgcmVxdWVzdC5wcm92aWRlciB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBtb2RlbCA9IFN0cmluZyhqb2IubW9kZWwgfHwgcmVxdWVzdC5tb2RlbCB8fCBcIlwiKTtcbiAgY29uc3QgbWVzc2FnZXMgPSBBcnJheS5pc0FycmF5KHJlcXVlc3QubWVzc2FnZXMpID8gcmVxdWVzdC5tZXNzYWdlcyA6IFtdO1xuICBjb25zdCBtYXhfdG9rZW5zID0gTnVtYmVyLmlzRmluaXRlKHJlcXVlc3QubWF4X3Rva2VucykgPyBwYXJzZUludChyZXF1ZXN0Lm1heF90b2tlbnMsIDEwKSA6IDQwOTY7XG4gIGNvbnN0IHRlbXBlcmF0dXJlID0gTnVtYmVyLmlzRmluaXRlKHJlcXVlc3QudGVtcGVyYXR1cmUpID8gcmVxdWVzdC50ZW1wZXJhdHVyZSA6IDE7XG5cbiAgLy8gUmUtYXBwbHkgZ292ZXJuYW5jZSBnYXRlcyBhdCBleGVjdXRpb24gdGltZVxuICBjb25zdCBhbGxvdyA9IGFzc2VydEFsbG93ZWQoeyBwcm92aWRlciwgbW9kZWwsIGtleVJvdyB9KTtcbiAgaWYgKCFhbGxvdy5vaykge1xuICAgIGF3YWl0IHEoXG4gICAgICBgdXBkYXRlIGFzeW5jX2pvYnMgc2V0IHN0YXR1cz0nZmFpbGVkJywgY29tcGxldGVkX2F0PW5vdygpLCBoZWFydGJlYXRfYXQ9bm93KCksIGVycm9yPSQyIHdoZXJlIGlkPSQxYCxcbiAgICAgIFtpZCwgYWxsb3cuZXJyb3IgfHwgXCJGb3JiaWRkZW5cIl1cbiAgICApO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGRldiA9IGF3YWl0IGVuZm9yY2VEZXZpY2UoeyBrZXlSb3csIGluc3RhbGxfaWQsIHVhLCBhY3RvcjogXCJqb2Jfd29ya2VyXCIgfSk7XG4gIGlmICghZGV2Lm9rKSB7XG4gICAgYXdhaXQgcShcbiAgICAgIGB1cGRhdGUgYXN5bmNfam9icyBzZXQgc3RhdHVzPSdmYWlsZWQnLCBjb21wbGV0ZWRfYXQ9bm93KCksIGhlYXJ0YmVhdF9hdD1ub3coKSwgZXJyb3I9JDIgd2hlcmUgaWQ9JDFgLFxuICAgICAgW2lkLCBkZXYuZXJyb3IgfHwgXCJEZXZpY2Ugbm90IGFsbG93ZWRcIl1cbiAgICApO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIENhcCBnYXRlIChiZXN0LWVmZm9ydDsgY29zdCBpcyB1bmtub3duIHVudGlsIGFmdGVyIGNvbXBsZXRpb24pXG4gIGNvbnN0IG1vbnRoID0gbW9udGhLZXlVVEMoKTtcbiAgY29uc3QgY3VzdFJvbGwgPSBhd2FpdCBnZXRNb250aFJvbGx1cChrZXlSb3cuY3VzdG9tZXJfaWQsIG1vbnRoKTtcbiAgY29uc3Qga2V5Um9sbCA9IGF3YWl0IGdldEtleU1vbnRoUm9sbHVwKGtleVJvdy5hcGlfa2V5X2lkLCBtb250aCk7XG4gIGNvbnN0IGN1c3RvbWVyX2NhcF9jZW50cyA9IGN1c3RvbWVyQ2FwQ2VudHMoa2V5Um93LCBjdXN0Um9sbCk7XG4gIGNvbnN0IGtleV9jYXBfY2VudHMgPSBrZXlDYXBDZW50cyhrZXlSb3csIGN1c3RSb2xsKTtcblxuICBpZiAoKGN1c3RSb2xsLnNwZW50X2NlbnRzIHx8IDApID49IGN1c3RvbWVyX2NhcF9jZW50cykge1xuICAgIGF3YWl0IHEoXG4gICAgICBgdXBkYXRlIGFzeW5jX2pvYnMgc2V0IHN0YXR1cz0nZmFpbGVkJywgY29tcGxldGVkX2F0PW5vdygpLCBoZWFydGJlYXRfYXQ9bm93KCksIGVycm9yPSQyIHdoZXJlIGlkPSQxYCxcbiAgICAgIFtpZCwgYE1vbnRobHkgY2FwIHJlYWNoZWQgKGN1c3RvbWVyKWBdXG4gICAgKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoKGtleVJvbGwuc3BlbnRfY2VudHMgfHwgMCkgPj0ga2V5X2NhcF9jZW50cykge1xuICAgIGF3YWl0IHEoXG4gICAgICBgdXBkYXRlIGFzeW5jX2pvYnMgc2V0IHN0YXR1cz0nZmFpbGVkJywgY29tcGxldGVkX2F0PW5vdygpLCBoZWFydGJlYXRfYXQ9bm93KCksIGVycm9yPSQyIHdoZXJlIGlkPSQxYCxcbiAgICAgIFtpZCwgYE1vbnRobHkgY2FwIHJlYWNoZWQgKGtleSlgXVxuICAgICk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBsZXQgcmVzdWx0O1xuICAgIGlmIChwcm92aWRlciA9PT0gXCJvcGVuYWlcIikgcmVzdWx0ID0gYXdhaXQgY2FsbE9wZW5BSSh7IG1vZGVsLCBtZXNzYWdlcywgbWF4X3Rva2VucywgdGVtcGVyYXR1cmUgfSk7XG4gICAgZWxzZSBpZiAocHJvdmlkZXIgPT09IFwiYW50aHJvcGljXCIpIHJlc3VsdCA9IGF3YWl0IGNhbGxBbnRocm9waWMoeyBtb2RlbCwgbWVzc2FnZXMsIG1heF90b2tlbnMsIHRlbXBlcmF0dXJlIH0pO1xuICAgIGVsc2UgaWYgKHByb3ZpZGVyID09PSBcImdlbWluaVwiKSByZXN1bHQgPSBhd2FpdCBjYWxsR2VtaW5pKHsgbW9kZWwsIG1lc3NhZ2VzLCBtYXhfdG9rZW5zLCB0ZW1wZXJhdHVyZSB9KTtcbiAgICBlbHNlIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gcHJvdmlkZXIuIFVzZSBvcGVuYWl8YW50aHJvcGljfGdlbWluaS5cIik7XG5cbiAgICBjb25zdCBvdXRwdXRfdGV4dCA9IHJlc3VsdC5vdXRwdXRfdGV4dCB8fCBcIlwiO1xuICAgIGNvbnN0IGlucHV0X3Rva2VucyA9IHJlc3VsdC5pbnB1dF90b2tlbnMgfHwgMDtcbiAgICBjb25zdCBvdXRwdXRfdG9rZW5zID0gcmVzdWx0Lm91dHB1dF90b2tlbnMgfHwgMDtcbiAgICBjb25zdCBjb3N0X2NlbnRzID0gY29zdENlbnRzKHByb3ZpZGVyLCBtb2RlbCwgaW5wdXRfdG9rZW5zLCBvdXRwdXRfdG9rZW5zKTtcblxuICAgIGNvbnN0IG1ldGEgPSB7XG4gICAgICByYXc6IHJlc3VsdC5yYXcgfHwgbnVsbCxcbiAgICAgIG1heF90b2tlbnMsXG4gICAgICB0ZW1wZXJhdHVyZVxuICAgIH07XG5cbiAgICBhd2FpdCBxKFxuICAgICAgYHVwZGF0ZSBhc3luY19qb2JzIHNldCBzdGF0dXM9J3N1Y2NlZWRlZCcsIGNvbXBsZXRlZF9hdD1ub3coKSwgaGVhcnRiZWF0X2F0PW5vdygpLFxuICAgICAgICBvdXRwdXRfdGV4dD0kMiwgaW5wdXRfdG9rZW5zPSQzLCBvdXRwdXRfdG9rZW5zPSQ0LCBjb3N0X2NlbnRzPSQ1LCBtZXRhPSQ2Ojpqc29uYlxuICAgICAgIHdoZXJlIGlkPSQxYCxcbiAgICAgIFtpZCwgb3V0cHV0X3RleHQsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2VucywgY29zdF9jZW50cywgSlNPTi5zdHJpbmdpZnkobWV0YSldXG4gICAgKTtcblxuICAgIC8vIE1ldGVyaW5nIChzYW1lIGxvZ2ljIGFzIGdhdGV3YXktY2hhdClcbiAgICBjb25zdCBtb250aCA9IG1vbnRoS2V5VVRDKCk7XG5cbiAgICBhd2FpdCBxKFxuICAgICAgYGluc2VydCBpbnRvIHVzYWdlX2V2ZW50cyhjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgcHJvdmlkZXIsIG1vZGVsLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnMsIGNvc3RfY2VudHMsIGluc3RhbGxfaWQsIGlwX2hhc2gsIHVhKVxuICAgICAgIHZhbHVlcyAoJDEsJDIsJDMsJDQsJDUsJDYsJDcsJDgsJDksJDEwKWAsXG4gICAgICBbam9iLmN1c3RvbWVyX2lkLCBqb2IuYXBpX2tleV9pZCwgcHJvdmlkZXIsIG1vZGVsLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnMsIGNvc3RfY2VudHMsIGluc3RhbGxfaWQsIGlwX2hhc2gsIHVhXVxuICAgICk7XG5cbiAgICBhd2FpdCBxKFxuICAgICAgYHVwZGF0ZSBhcGlfa2V5c1xuICAgICAgIHNldCBsYXN0X3NlZW5fYXQ9bm93KCksXG4gICAgICAgICAgIGxhc3Rfc2Vlbl9pbnN0YWxsX2lkID0gY29hbGVzY2UoJDEsIGxhc3Rfc2Vlbl9pbnN0YWxsX2lkKVxuICAgICAgIHdoZXJlIGlkPSQyYCxcbiAgICAgIFtpbnN0YWxsX2lkLCBqb2IuYXBpX2tleV9pZF1cbiAgICApO1xuXG4gICAgYXdhaXQgcShcbiAgICAgIGBpbnNlcnQgaW50byBtb250aGx5X3VzYWdlKGN1c3RvbWVyX2lkLCBtb250aCwgc3BlbnRfY2VudHMsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2VucylcbiAgICAgICB2YWx1ZXMgKCQxLCQyLCQzLCQ0LCQ1KVxuICAgICAgIG9uIGNvbmZsaWN0IChjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICAgZG8gdXBkYXRlIHNldFxuICAgICAgICAgc3BlbnRfY2VudHMgPSBtb250aGx5X3VzYWdlLnNwZW50X2NlbnRzICsgZXhjbHVkZWQuc3BlbnRfY2VudHMsXG4gICAgICAgICBpbnB1dF90b2tlbnMgPSBtb250aGx5X3VzYWdlLmlucHV0X3Rva2VucyArIGV4Y2x1ZGVkLmlucHV0X3Rva2VucyxcbiAgICAgICAgIG91dHB1dF90b2tlbnMgPSBtb250aGx5X3VzYWdlLm91dHB1dF90b2tlbnMgKyBleGNsdWRlZC5vdXRwdXRfdG9rZW5zLFxuICAgICAgICAgdXBkYXRlZF9hdCA9IG5vdygpYCxcbiAgICAgIFtqb2IuY3VzdG9tZXJfaWQsIG1vbnRoLCBjb3N0X2NlbnRzLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnNdXG4gICAgKTtcblxuICAgIGF3YWl0IHEoXG4gICAgICBgaW5zZXJ0IGludG8gbW9udGhseV9rZXlfdXNhZ2UoYXBpX2tleV9pZCwgY3VzdG9tZXJfaWQsIG1vbnRoLCBzcGVudF9jZW50cywgaW5wdXRfdG9rZW5zLCBvdXRwdXRfdG9rZW5zLCBjYWxscylcbiAgICAgICB2YWx1ZXMgKCQxLCQyLCQzLCQ0LCQ1LCQ2LCQ3KVxuICAgICAgIG9uIGNvbmZsaWN0IChhcGlfa2V5X2lkLCBtb250aClcbiAgICAgICBkbyB1cGRhdGUgc2V0XG4gICAgICAgICBzcGVudF9jZW50cyA9IG1vbnRobHlfa2V5X3VzYWdlLnNwZW50X2NlbnRzICsgZXhjbHVkZWQuc3BlbnRfY2VudHMsXG4gICAgICAgICBpbnB1dF90b2tlbnMgPSBtb250aGx5X2tleV91c2FnZS5pbnB1dF90b2tlbnMgKyBleGNsdWRlZC5pbnB1dF90b2tlbnMsXG4gICAgICAgICBvdXRwdXRfdG9rZW5zID0gbW9udGhseV9rZXlfdXNhZ2Uub3V0cHV0X3Rva2VucyArIGV4Y2x1ZGVkLm91dHB1dF90b2tlbnMsXG4gICAgICAgICBjYWxscyA9IG1vbnRobHlfa2V5X3VzYWdlLmNhbGxzICsgZXhjbHVkZWQuY2FsbHMsXG4gICAgICAgICB1cGRhdGVkX2F0ID0gbm93KClgLFxuICAgICAgW2pvYi5hcGlfa2V5X2lkLCBqb2IuY3VzdG9tZXJfaWQsIG1vbnRoLCBjb3N0X2NlbnRzLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnMsIDFdXG4gICAgKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnN0IG1zZyA9IGU/Lm1lc3NhZ2UgfHwgXCJKb2IgZmFpbGVkXCI7XG4gICAgYXdhaXQgcShcbiAgICAgIGB1cGRhdGUgYXN5bmNfam9icyBzZXQgc3RhdHVzPSdmYWlsZWQnLCBjb21wbGV0ZWRfYXQ9bm93KCksIGhlYXJ0YmVhdF9hdD1ub3coKSwgZXJyb3I9JDIgd2hlcmUgaWQ9JDFgLFxuICAgICAgW2lkLCBtc2ddXG4gICAgKTtcbiAgfVxufTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7QUFBQSxTQUFTLFlBQVk7QUFhckIsSUFBSSxPQUFPO0FBQ1gsSUFBSSxpQkFBaUI7QUFFckIsU0FBUyxTQUFTO0FBQ2hCLE1BQUksS0FBTSxRQUFPO0FBRWpCLFFBQU0sV0FBVyxDQUFDLEVBQUUsUUFBUSxJQUFJLHdCQUF3QixRQUFRLElBQUk7QUFDcEUsTUFBSSxDQUFDLFVBQVU7QUFDYixVQUFNLE1BQU0sSUFBSSxNQUFNLGdHQUFnRztBQUN0SCxRQUFJLE9BQU87QUFDWCxRQUFJLFNBQVM7QUFDYixRQUFJLE9BQU87QUFDWCxVQUFNO0FBQUEsRUFDUjtBQUVBLFNBQU8sS0FBSztBQUNaLFNBQU87QUFDVDtBQUVBLGVBQWUsZUFBZTtBQUM1QixNQUFJLGVBQWdCLFFBQU87QUFFM0Isb0JBQWtCLFlBQVk7QUFDNUIsVUFBTSxNQUFNLE9BQU87QUFDbkIsVUFBTSxhQUFhO0FBQUEsTUFDakI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFlQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVlBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BV0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFXQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVFBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BT0E7QUFBQSxNQUEyRztBQUFBLE1BQzNHO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVlBO0FBQUEsTUFDQTtBQUFBO0FBQUEsTUFHQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFRQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFtQkE7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQStCQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUdBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFNQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1Ba0JBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFlQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU9BO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVlBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVNBO0FBQUE7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFPQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BY0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BUUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtB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
