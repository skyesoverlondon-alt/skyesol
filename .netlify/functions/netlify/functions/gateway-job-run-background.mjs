
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw configError("GEMINI_API_KEY not configured", "Set GEMINI_API_KEY in Netlify \u2192 Site configuration \u2192 Environment variables (your Google AI Studio / Gemini API key).");
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
function monthKeyUTC(d = /* @__PURE__ */ new Date()) {
  return d.toISOString().slice(0, 7);
}

// netlify/functions/gateway-job-run-background.js
var gateway_job_run_background_default = async (req) => {
  if (req.method !== "POST") return;
  const secret = (process.env.JOB_WORKER_SECRET || "").trim();
  if (secret) {
    const got = (req.headers.get("x-kaixu-job-secret") || req.headers.get("x-job-worker-secret") || "").trim();
    if (!got || got !== secret) {
      return;
    }
  }
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
export {
  gateway_job_run_background_default as default
};
