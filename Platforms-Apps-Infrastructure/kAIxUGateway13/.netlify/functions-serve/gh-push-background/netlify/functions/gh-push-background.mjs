
import {createRequire as ___nfyCreateRequire} from "module";
import {fileURLToPath as ___nfyFileURLToPath} from "url";
import {dirname as ___nfyPathDirname} from "path";
let __filename=___nfyFileURLToPath(import.meta.url);
let __dirname=___nfyPathDirname(___nfyFileURLToPath(import.meta.url));
let require=___nfyCreateRequire(import.meta.url);


// netlify/functions/gh-push-background.js
import fs from "fs";
import * as yauzl from "yauzl";
import { getStore } from "@netlify/blobs";

// netlify/functions/_lib/http.js
function buildCors(req) {
  const allowRaw = (process.env.ALLOWED_ORIGINS || "").trim();
  const reqOrigin = req.headers.get("origin") || req.headers.get("Origin");
  const allowHeaders = "authorization, content-type, x-kaixu-install-id, x-kaixu-request-id, x-kaixu-app, x-kaixu-build, x-admin-password, x-kaixu-error-token, x-kaixu-mode, x-content-sha1, x-setup-secret, x-kaixu-job-secret, x-job-worker-secret";
  const allowMethods = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
  const base2 = {
    "access-control-allow-headers": allowHeaders,
    "access-control-allow-methods": allowMethods,
    "access-control-expose-headers": "x-kaixu-request-id",
    "access-control-max-age": "86400"
  };
  if (!allowRaw) {
    return {
      ...base2,
      ...reqOrigin ? { vary: "Origin" } : {}
    };
  }
  const allowed = allowRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.includes("*")) {
    const origin = reqOrigin || "*";
    return {
      ...base2,
      "access-control-allow-origin": origin,
      ...reqOrigin ? { vary: "Origin" } : {}
    };
  }
  if (reqOrigin && allowed.includes(reqOrigin)) {
    return {
      ...base2,
      "access-control-allow-origin": reqOrigin,
      vary: "Origin"
    };
  }
  return {
    ...base2,
    ...reqOrigin ? { vary: "Origin" } : {}
  };
}
function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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

// netlify/functions/_lib/monitor.js
function safeStr(v, max = 8e3) {
  if (v == null) return null;
  const s = String(v);
  if (s.length <= max) return s;
  return s.slice(0, max) + `\u2026(+${s.length - max} chars)`;
}
function randomId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
  }
  return "rid_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}
function getRequestId(req) {
  const h = (req.headers.get("x-kaixu-request-id") || req.headers.get("x-request-id") || "").trim();
  return h || randomId();
}
function inferFunctionName(req) {
  try {
    const u = new URL(req.url);
    const m = u.pathname.match(/\/\.netlify\/functions\/([^\/]+)/i);
    return m ? m[1] : "unknown";
  } catch {
    return "unknown";
  }
}
function requestMeta(req) {
  let url = null;
  try {
    url = new URL(req.url);
  } catch {
  }
  return {
    method: req.method || null,
    path: url ? url.pathname : null,
    query: url ? Object.fromEntries(url.searchParams.entries()) : {},
    origin: req.headers.get("origin") || req.headers.get("Origin") || null,
    referer: req.headers.get("referer") || req.headers.get("Referer") || null,
    user_agent: req.headers.get("user-agent") || null,
    ip: req.headers.get("x-nf-client-connection-ip") || null,
    app_id: (req.headers.get("x-kaixu-app") || "").trim() || null,
    build_id: (req.headers.get("x-kaixu-build") || "").trim() || null
  };
}
function serializeError(err) {
  const e = err || {};
  return {
    name: safeStr(e.name, 200),
    message: safeStr(e.message, 4e3),
    code: safeStr(e.code, 200),
    status: Number.isFinite(e.status) ? e.status : null,
    hint: safeStr(e.hint, 2e3),
    stack: safeStr(e.stack, 12e3),
    upstream: e.upstream ? {
      provider: safeStr(e.upstream.provider, 50),
      status: Number.isFinite(e.upstream.status) ? e.upstream.status : null,
      body: safeStr(e.upstream.body, 12e3),
      request_id: safeStr(e.upstream.request_id, 200),
      response_headers: e.upstream.response_headers || void 0
    } : void 0
  };
}
async function emitEvent(ev) {
  try {
    const e = ev || {};
    const extra = e.extra || {};
    await q(
      `insert into gateway_events
        (request_id, level, kind, function_name, method, path, origin, referer, user_agent, ip,
         app_id, build_id, customer_id, api_key_id, provider, model, http_status, duration_ms,
         error_code, error_message, error_stack, upstream_status, upstream_body, extra)
       values
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         $11,$12,$13,$14,$15,$16,$17,$18,
         $19,$20,$21,$22,$23,$24,$25::jsonb)`,
      [
        safeStr(e.request_id, 200),
        safeStr(e.level || "info", 20),
        safeStr(e.kind || "event", 80),
        safeStr(e.function_name || "unknown", 120),
        safeStr(e.method, 20),
        safeStr(e.path, 500),
        safeStr(e.origin, 500),
        safeStr(e.referer, 800),
        safeStr(e.user_agent, 800),
        safeStr(e.ip, 200),
        safeStr(e.app_id, 200),
        safeStr(e.build_id, 200),
        Number.isFinite(e.customer_id) ? e.customer_id : null,
        Number.isFinite(e.api_key_id) ? e.api_key_id : null,
        safeStr(e.provider, 80),
        safeStr(e.model, 200),
        Number.isFinite(e.http_status) ? e.http_status : null,
        Number.isFinite(e.duration_ms) ? e.duration_ms : null,
        safeStr(e.error_code, 200),
        safeStr(e.error_message, 4e3),
        safeStr(e.error_stack, 12e3),
        Number.isFinite(e.upstream_status) ? e.upstream_status : null,
        safeStr(e.upstream_body, 12e3),
        JSON.stringify(extra || {})
      ]
    );
  } catch (e) {
    console.warn("monitor emit failed:", e?.message || e);
  }
}

// netlify/functions/_lib/wrap.js
function normalizeError(err) {
  const status = err?.status || 500;
  const code = err?.code || "SERVER_ERROR";
  const message = err?.message || "Unknown error";
  const hint = err?.hint;
  return { status, body: { error: message, code, ...hint ? { hint } : {} } };
}
function withRequestId(res, request_id) {
  try {
    const h = new Headers(res.headers || {});
    h.set("x-kaixu-request-id", request_id);
    return new Response(res.body, { status: res.status, headers: h });
  } catch {
    return res;
  }
}
async function safeBodyPreview(res) {
  try {
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const clone = res.clone();
    if (ct.includes("application/json")) {
      const data = await clone.json().catch(() => null);
      return data;
    }
    const t = await clone.text().catch(() => "");
    if (typeof t === "string" && t.length > 12e3) return t.slice(0, 12e3) + `\u2026(+${t.length - 12e3} chars)`;
    return t;
  } catch {
    return null;
  }
}
function wrap(handler) {
  return async (req, context) => {
    const start = Date.now();
    const cors = buildCors(req);
    const request_id = getRequestId(req);
    const function_name = inferFunctionName(req);
    const meta = requestMeta(req);
    try {
      const res = await handler(req, cors, context);
      const duration_ms = Date.now() - start;
      const out = res instanceof Response ? withRequestId(res, request_id) : res;
      const status = out instanceof Response ? out.status : 200;
      const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      const kind = status >= 400 ? "http_error_response" : "http_response";
      let extra = {};
      if (status >= 400 && out instanceof Response) {
        extra.response = await safeBodyPreview(out);
      }
      if (duration_ms >= 15e3) {
        extra.slow = true;
      }
      await emitEvent({
        request_id,
        level,
        kind,
        function_name,
        ...meta,
        http_status: status,
        duration_ms,
        extra
      });
      return out;
    } catch (err) {
      const duration_ms = Date.now() - start;
      const ser = serializeError(err);
      await emitEvent({
        request_id,
        level: "error",
        kind: "thrown_error",
        function_name,
        ...meta,
        provider: ser?.upstream?.provider || void 0,
        http_status: ser?.status || 500,
        duration_ms,
        error_code: ser?.code || "SERVER_ERROR",
        error_message: ser?.message || "Unknown error",
        error_stack: ser?.stack || null,
        upstream_status: ser?.upstream?.status || null,
        upstream_body: ser?.upstream?.body || null,
        extra: { error: ser }
      });
      console.error("Function error:", err);
      const { status, body } = normalizeError(err);
      return json(status, { ...body, request_id }, { ...cors, "x-kaixu-request-id": request_id });
    }
  };
}

// netlify/functions/_lib/audit.js
async function audit(actor, action, target = null, meta = {}) {
  try {
    await q(
      `insert into audit_events(actor, action, target, meta) values ($1,$2,$3,$4::jsonb)`,
      [actor, action, target, JSON.stringify(meta || {})]
    );
  } catch (e) {
    console.warn("audit failed:", e?.message || e);
  }
}

// netlify/functions/_lib/crypto.js
import crypto from "crypto";
function configError(message, hint) {
  const err = new Error(message);
  err.code = "CONFIG";
  err.status = 500;
  if (hint) err.hint = hint;
  return err;
}
function unbase64url(input) {
  const s = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - s.length % 4);
  return Buffer.from(s + pad, "base64");
}
function encKey() {
  const raw = (process.env.DB_ENCRYPTION_KEY || process.env.JWT_SECRET || "").toString();
  if (!raw) {
    throw configError(
      "Missing DB_ENCRYPTION_KEY (or JWT_SECRET fallback)",
      "Set DB_ENCRYPTION_KEY (recommended) or at minimum JWT_SECRET in Netlify env vars."
    );
  }
  return crypto.createHash("sha256").update(raw).digest();
}
function decryptSecret(enc) {
  const s = String(enc || "");
  if (!s.startsWith("v1:")) return null;
  const parts = s.split(":");
  if (parts.length !== 4) return null;
  const [, ivB, tagB, ctB] = parts;
  const key = encKey();
  const iv = unbase64url(ivB);
  const tag = unbase64url(tagB);
  const ct = unbase64url(ctB);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

// netlify/functions/_lib/githubTokens.js
async function getGitHubTokenForCustomer(customer_id) {
  const res = await q(`select token_enc from customer_github_tokens where customer_id=$1`, [customer_id]);
  if (res.rows.length) {
    const dec = decryptSecret(res.rows[0].token_enc);
    if (dec) return dec;
  }
  return null;
}

// netlify/functions/_lib/github.js
function base() {
  return (process.env.GITHUB_API_BASE || "https://api.github.com").trim() || "https://api.github.com";
}
function apiVersion() {
  return (process.env.GITHUB_API_VERSION || "2022-11-28").trim() || "2022-11-28";
}
function parseRetryAfter(h) {
  const ra = h.get("retry-after");
  if (!ra) return null;
  const n = parseInt(ra, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function parseRateResetSeconds(h) {
  const reset = h.get("x-ratelimit-reset");
  if (!reset) return null;
  const n = parseInt(reset, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const now = Math.floor(Date.now() / 1e3);
  return Math.max(0, n - now);
}
var GitHubApiError = class extends Error {
  constructor(message, status, code, meta = {}) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
};
async function ghFetch({ token, method, path, body, accept = "application/vnd.github+json", allowRetry = true }) {
  const url = base().replace(/\/$/, "") + path;
  const headers = new Headers();
  headers.set("accept", accept);
  headers.set("x-github-api-version", apiVersion());
  headers.set("authorization", `Bearer ${token}`);
  if (body !== void 0 && body !== null) headers.set("content-type", "application/json");
  const maxAttempts = allowRetry ? 5 : 1;
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    let res;
    try {
      res = await fetch(url, { method, headers, body: body !== void 0 && body !== null ? JSON.stringify(body) : void 0 });
    } catch (e) {
      if (attempt >= maxAttempts) throw new GitHubApiError(`GitHub network error: ${e?.message || "unknown"}`, 502, "GITHUB_NETWORK");
      const backoff = Math.min(8e3, 500 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
      await sleep(backoff);
      continue;
    }
    if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
      if (attempt >= maxAttempts) {
        const t = await safeText(res);
        throw new GitHubApiError(`GitHub transient error (${res.status})`, res.status, "GITHUB_TRANSIENT", { body: t });
      }
      const ra = parseRetryAfter(res.headers);
      const waitMs = ra !== null ? ra * 1e3 : Math.min(8e3, 500 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
      await sleep(waitMs);
      continue;
    }
    if (res.status === 403) {
      const remaining = res.headers.get("x-ratelimit-remaining");
      const rem = remaining ? parseInt(remaining, 10) : null;
      if (rem === 0) {
        const resetSec = parseRateResetSeconds(res.headers);
        const t = await safeText(res);
        throw new GitHubApiError("GitHub rate limit reached", 429, "GITHUB_RATE_LIMIT", { reset_seconds: resetSec, body: t });
      }
    }
    if (!res.ok) {
      const t = await safeText(res);
      let code = "GITHUB_ERROR";
      if (res.status === 401) code = "GITHUB_UNAUTHORIZED";
      if (res.status === 404) code = "GITHUB_NOT_FOUND";
      if (res.status === 409) code = "GITHUB_CONFLICT";
      throw new GitHubApiError(`GitHub API error (${res.status})`, res.status, code, { body: t });
    }
    if (res.status === 204) return { ok: true, status: 204, headers: res.headers, data: null };
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      const data = await res.json();
      return { ok: true, status: res.status, headers: res.headers, data };
    }
    const text = await res.text();
    return { ok: true, status: res.status, headers: res.headers, data: text };
  }
  throw new GitHubApiError("GitHub request failed", 502, "GITHUB_UNKNOWN");
}
async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
async function ghGet({ token, path }) {
  return ghFetch({ token, method: "GET", path });
}
async function ghPost({ token, path, body }) {
  return ghFetch({ token, method: "POST", path, body });
}
async function ghPatch({ token, path, body }) {
  return ghFetch({ token, method: "PATCH", path, body });
}

// netlify/functions/gh-push-background.js
function chunkStore() {
  return getStore({ name: "kaixu_github_push_chunks", consistency: "strong" });
}
function intEnv(name, dflt) {
  const n = parseInt((process.env[name] || "").toString(), 10);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}
function sanitizeRepoPath(p) {
  let s = String(p || "").replace(/\\/g, "/");
  s = s.replace(/^\./, "");
  s = s.replace(/^\//, "");
  if (!s) return null;
  if (s.split("/").some((seg) => seg === ".." || seg === "." || seg === "")) return null;
  const lower = s.toLowerCase();
  if (lower.startsWith(".git/") || lower === ".git") return null;
  if (lower.startsWith("node_modules/")) return null;
  if (lower.endsWith(".ds_store")) return null;
  return s;
}
async function writeZipToTmp(jobId, parts, store) {
  const tmp = `/tmp/${jobId}.zip`;
  const out = fs.createWriteStream(tmp);
  for (let i = 0; i < parts; i++) {
    const ab = await store.get(`ghzip/${jobId}/${i}`, { type: "arrayBuffer" });
    if (!ab) throw new Error(`Missing chunk blob ${i}`);
    out.write(Buffer.from(ab));
  }
  await new Promise((resolve, reject) => {
    out.end();
    out.on("finish", resolve);
    out.on("error", reject);
  });
  return tmp;
}
function openZip(tmpPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(tmpPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      resolve(zipfile);
    });
  });
}
function readEntry(zipfile, entry) {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err) return reject(err);
      const chunks = [];
      let total = 0;
      stream.on("data", (c) => {
        chunks.push(c);
        total += c.length;
      });
      stream.on("end", () => resolve({ buf: Buffer.concat(chunks), bytes: total }));
      stream.on("error", reject);
    });
  });
}
async function getHead({ token, owner, repo, branch }) {
  try {
    const r = await ghGet({ token, path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}` });
    return r.data?.object?.sha || null;
  } catch (e) {
    if (e instanceof GitHubApiError && e.status === 404) return null;
    throw e;
  }
}
async function getCommitTree({ token, owner, repo, commitSha }) {
  const r = await ghGet({ token, path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${commitSha}` });
  return r.data?.tree?.sha || null;
}
async function createRef({ token, owner, repo, branch, sha }) {
  return ghPost({
    token,
    path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`,
    body: { ref: `refs/heads/${branch}`, sha }
  });
}
async function updateRef({ token, owner, repo, branch, sha }) {
  return ghPatch({
    token,
    path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(branch)}`,
    body: { sha, force: false }
  });
}
function computeBackoffMs(attempt) {
  const base2 = intEnv("GITHUB_JOB_RETRY_BASE_MS", 1e3);
  const max = intEnv("GITHUB_JOB_RETRY_MAX_MS", 6e4);
  const exp = Math.min(max, base2 * 2 ** Math.max(0, attempt - 1));
  return exp + Math.floor(Math.random() * 400);
}
async function markRetry(jobRowId, attempt, msg, resetSeconds = null) {
  const delayMs = resetSeconds !== null ? resetSeconds * 1e3 : computeBackoffMs(attempt);
  const next = new Date(Date.now() + delayMs).toISOString();
  await q(
    `update gh_push_jobs
     set status='retry_wait', next_attempt_at=$2::timestamptz, last_error=$3, last_error_at=now(), updated_at=now()
     where id=$1`,
    [jobRowId, next, msg]
  );
}
async function markFail(jobRowId, msg) {
  await q(
    `update gh_push_jobs
     set status='error', last_error=$2, last_error_at=now(), updated_at=now()
     where id=$1`,
    [jobRowId, msg]
  );
}
var gh_push_background_default = wrap(async (req) => {
  try {
    const secret = (process.env.JOB_WORKER_SECRET || "").trim();
    if (!secret) return new Response("", { status: 202 });
    const got = (req.headers.get("x-kaixu-job-secret") || "").toString();
    if (got !== secret) return new Response("", { status: 202 });
    if (req.method !== "POST") return new Response("", { status: 202 });
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response("", { status: 202 });
    }
    const jobId = (body.jobId || "").toString();
    if (!jobId) return new Response("", { status: 202 });
    const r = await q(`select * from gh_push_jobs where job_id=$1 limit 1`, [jobId]);
    if (!r.rowCount) return new Response("", { status: 202 });
    const job = r.rows[0];
    const maxAttempts = intEnv("GITHUB_JOB_MAX_ATTEMPTS", 10);
    const attempts = (job.attempts || 0) + 1;
    if (attempts > maxAttempts) {
      await markFail(job.id, `Exceeded max attempts (${maxAttempts})`);
      return new Response("", { status: 202 });
    }
    if (job.next_attempt_at) {
      const t = new Date(job.next_attempt_at).getTime();
      if (Date.now() < t - 500) return new Response("", { status: 202 });
    }
    await q(`update gh_push_jobs set attempts=$2, status='running', updated_at=now() where id=$1`, [job.id, attempts]);
    const token = await getGitHubTokenForCustomer(job.customer_id);
    if (!token) {
      await markFail(job.id, "No GitHub token configured");
      return new Response("", { status: 202 });
    }
    const owner = job.owner;
    const repo = job.repo;
    const branch = job.branch || "main";
    const message = job.commit_message || "Kaixu GitHub Push";
    const parts = parseInt(job.parts || "0", 10);
    if (!parts || parts < 1) {
      await markFail(job.id, "Missing parts (no uploaded zip)");
      return new Response("", { status: 202 });
    }
    const store = chunkStore();
    let tmpZip;
    try {
      tmpZip = await writeZipToTmp(jobId, parts, store);
    } catch (e) {
      await markRetry(job.id, attempts, `Zip assemble failed: ${e?.message || "unknown"}`);
      return new Response("", { status: 202 });
    }
    const maxFiles = intEnv("GITHUB_PUSH_MAX_FILES", 3e3);
    const maxTotal = intEnv("GITHUB_PUSH_MAX_TOTAL_BYTES", 104857600);
    const maxFile = intEnv("GITHUB_PUSH_MAX_FILE_BYTES", 10485760);
    let zipfile;
    try {
      zipfile = await openZip(tmpZip);
    } catch (e) {
      await markFail(job.id, `Invalid zip: ${e?.message || "unknown"}`);
      return new Response("", { status: 202 });
    }
    const treeEntries = [];
    let totalBytes = 0;
    let fileCount = 0;
    const headSha = await (async () => {
      try {
        return await getHead({ token, owner, repo, branch });
      } catch (e) {
        if (e instanceof GitHubApiError && e.code === "GITHUB_RATE_LIMIT") {
          await markRetry(job.id, attempts, "GitHub rate limited (head)", e.meta?.reset_seconds ?? 60);
          zipfile.close();
          return null;
        }
        throw e;
      }
    })();
    const baseTreeSha = headSha ? await (async () => {
      try {
        return await getCommitTree({ token, owner, repo, commitSha: headSha });
      } catch (e) {
        if (e instanceof GitHubApiError && e.code === "GITHUB_RATE_LIMIT") {
          await markRetry(job.id, attempts, "GitHub rate limited (commit)", e.meta?.reset_seconds ?? 60);
          zipfile.close();
          return null;
        }
        throw e;
      }
    })() : null;
    const loopResult = await new Promise((resolve, reject) => {
      zipfile.readEntry();
      zipfile.on("entry", async (entry) => {
        try {
          if (/\/$/.test(entry.fileName)) {
            zipfile.readEntry();
            return;
          }
          const repoPath = sanitizeRepoPath(entry.fileName);
          if (!repoPath) {
            zipfile.readEntry();
            return;
          }
          fileCount++;
          if (fileCount > maxFiles) throw new Error(`Too many files (>${maxFiles})`);
          const { buf, bytes } = await readEntry(zipfile, entry);
          if (bytes > maxFile) throw new Error(`File too large: ${repoPath} (${bytes} bytes)`);
          totalBytes += bytes;
          if (totalBytes > maxTotal) throw new Error(`Total size too large (>${maxTotal} bytes)`);
          const contentB64 = buf.toString("base64");
          let blobSha;
          try {
            const b = await ghPost({ token, path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`, body: { content: contentB64, encoding: "base64" } });
            blobSha = b.data?.sha;
          } catch (e) {
            if (e instanceof GitHubApiError && e.code === "GITHUB_RATE_LIMIT") {
              await markRetry(job.id, attempts, "GitHub rate limited (blob)", e.meta?.reset_seconds ?? 60);
              zipfile.close();
              resolve("retry");
              return;
            }
            if (e instanceof GitHubApiError && (e.code === "GITHUB_TRANSIENT" || e.code === "GITHUB_NETWORK")) {
              await markRetry(job.id, attempts, "GitHub transient error (blob)");
              zipfile.close();
              resolve("retry");
              return;
            }
            throw e;
          }
          if (!blobSha) throw new Error("Missing blob sha");
          treeEntries.push({ path: repoPath, mode: "100644", type: "blob", sha: blobSha });
          zipfile.readEntry();
        } catch (e) {
          zipfile.close();
          reject(e);
        }
      });
      zipfile.on("end", () => resolve("done"));
      zipfile.on("error", reject);
    }).catch(async (e) => {
      await markFail(job.id, `Zip processing failed: ${e?.message || "unknown"}`);
      try {
        zipfile.close();
      } catch {
      }
      return "failed";
    });
    if (loopResult !== "done") return new Response("", { status: 202 });
    const statusNow = await q(`select status from gh_push_jobs where id=$1`, [job.id]);
    if (statusNow.rows[0]?.status === "retry_wait") return new Response("", { status: 202 });
    if (statusNow.rows[0]?.status === "error") return new Response("", { status: 202 });
    let treeSha;
    try {
      const tr = await ghPost({
        token,
        path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`,
        body: baseTreeSha ? { base_tree: baseTreeSha, tree: treeEntries } : { tree: treeEntries }
      });
      treeSha = tr.data?.sha;
    } catch (e) {
      if (e instanceof GitHubApiError && e.code === "GITHUB_RATE_LIMIT") {
        await markRetry(job.id, attempts, "GitHub rate limited (tree)", e.meta?.reset_seconds ?? 60);
        return new Response("", { status: 202 });
      }
      if (e instanceof GitHubApiError && (e.code === "GITHUB_TRANSIENT" || e.code === "GITHUB_NETWORK")) {
        await markRetry(job.id, attempts, "GitHub transient error (tree)");
        return new Response("", { status: 202 });
      }
      await markFail(job.id, `Tree create failed: ${e?.message || "unknown"}`);
      return new Response("", { status: 202 });
    }
    if (!treeSha) {
      await markFail(job.id, "Missing tree sha");
      return new Response("", { status: 202 });
    }
    let commitSha;
    try {
      const cr = await ghPost({
        token,
        path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`,
        body: headSha ? { message, tree: treeSha, parents: [headSha] } : { message, tree: treeSha, parents: [] }
      });
      commitSha = cr.data?.sha;
    } catch (e) {
      if (e instanceof GitHubApiError && e.code === "GITHUB_RATE_LIMIT") {
        await markRetry(job.id, attempts, "GitHub rate limited (commit)", e.meta?.reset_seconds ?? 60);
        return new Response("", { status: 202 });
      }
      if (e instanceof GitHubApiError && (e.code === "GITHUB_TRANSIENT" || e.code === "GITHUB_NETWORK")) {
        await markRetry(job.id, attempts, "GitHub transient error (commit)");
        return new Response("", { status: 202 });
      }
      await markFail(job.id, `Commit create failed: ${e?.message || "unknown"}`);
      return new Response("", { status: 202 });
    }
    if (!commitSha) {
      await markFail(job.id, "Missing commit sha");
      return new Response("", { status: 202 });
    }
    try {
      if (headSha) await updateRef({ token, owner, repo, branch, sha: commitSha });
      else await createRef({ token, owner, repo, branch, sha: commitSha });
    } catch (e) {
      if (e instanceof GitHubApiError && e.code === "GITHUB_RATE_LIMIT") {
        await markRetry(job.id, attempts, "GitHub rate limited (ref)", e.meta?.reset_seconds ?? 60);
        return new Response("", { status: 202 });
      }
      await markFail(job.id, `Ref update failed: ${e?.message || "unknown"}`);
      return new Response("", { status: 202 });
    }
    const resultUrl = `https://github.com/${owner}/${repo}/commit/${commitSha}`;
    await q(
      `update gh_push_jobs
       set status='done', result_commit_sha=$2, result_url=$3, last_error=null, last_error_at=null, next_attempt_at=null, updated_at=now()
       where id=$1`,
      [job.id, commitSha, resultUrl]
    );
    await q(
      `insert into gh_push_events(customer_id, api_key_id, job_row_id, event_type, bytes, meta)
       values ($1,$2,$3,'done',$4,$5::jsonb)`,
      [job.customer_id, job.api_key_id, job.id, totalBytes, JSON.stringify({ files: fileCount, commit: commitSha, url: resultUrl })]
    );
    await audit("system", "GITHUB_PUSH_DONE", `gh:${jobId}`, { owner, repo, branch, commit: commitSha, files: fileCount, bytes: totalBytes });
    try {
      for (let i = 0; i < parts; i++) await store.delete(`ghzip/${jobId}/${i}`);
    } catch {
    }
    return new Response("", { status: 202 });
  } catch {
    return new Response("", { status: 202 });
  }
});
export {
  gh_push_background_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibmV0bGlmeS9mdW5jdGlvbnMvZ2gtcHVzaC1iYWNrZ3JvdW5kLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvaHR0cC5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2RiLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvbW9uaXRvci5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL3dyYXAuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9hdWRpdC5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2NyeXB0by5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2dpdGh1YlRva2Vucy5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2dpdGh1Yi5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xuaW1wb3J0ICogYXMgeWF1emwgZnJvbSBcInlhdXpsXCI7XG5pbXBvcnQgeyBnZXRTdG9yZSB9IGZyb20gXCJAbmV0bGlmeS9ibG9ic1wiO1xuaW1wb3J0IHsgd3JhcCB9IGZyb20gXCIuL19saWIvd3JhcC5qc1wiO1xuaW1wb3J0IHsgcSB9IGZyb20gXCIuL19saWIvZGIuanNcIjtcbmltcG9ydCB7IGF1ZGl0IH0gZnJvbSBcIi4vX2xpYi9hdWRpdC5qc1wiO1xuaW1wb3J0IHsgZ2V0R2l0SHViVG9rZW5Gb3JDdXN0b21lciB9IGZyb20gXCIuL19saWIvZ2l0aHViVG9rZW5zLmpzXCI7XG5pbXBvcnQgeyBnaEdldCwgZ2hQb3N0LCBnaFBhdGNoLCBHaXRIdWJBcGlFcnJvciB9IGZyb20gXCIuL19saWIvZ2l0aHViLmpzXCI7XG5cbmZ1bmN0aW9uIGNodW5rU3RvcmUoKSB7XG4gIHJldHVybiBnZXRTdG9yZSh7IG5hbWU6IFwia2FpeHVfZ2l0aHViX3B1c2hfY2h1bmtzXCIsIGNvbnNpc3RlbmN5OiBcInN0cm9uZ1wiIH0pO1xufVxuXG5mdW5jdGlvbiBpbnRFbnYobmFtZSwgZGZsdCkge1xuICBjb25zdCBuID0gcGFyc2VJbnQoKHByb2Nlc3MuZW52W25hbWVdIHx8IFwiXCIpLnRvU3RyaW5nKCksIDEwKTtcbiAgcmV0dXJuIE51bWJlci5pc0Zpbml0ZShuKSAmJiBuID4gMCA/IG4gOiBkZmx0O1xufVxuXG5mdW5jdGlvbiBzYW5pdGl6ZVJlcG9QYXRoKHApIHtcbiAgbGV0IHMgPSBTdHJpbmcocCB8fCBcIlwiKS5yZXBsYWNlKC9cXFxcL2csIFwiL1wiKTtcbiAgcyA9IHMucmVwbGFjZSgvXlxcLi8sIFwiXCIpOyAvLyBzdHJpcCBsZWFkaW5nIGRvdFxuICBzID0gcy5yZXBsYWNlKC9eXFwvLywgXCJcIik7XG4gIGlmICghcykgcmV0dXJuIG51bGw7XG4gIGlmIChzLnNwbGl0KFwiL1wiKS5zb21lKHNlZyA9PiBzZWcgPT09IFwiLi5cIiB8fCBzZWcgPT09IFwiLlwiIHx8IHNlZyA9PT0gXCJcIikpIHJldHVybiBudWxsO1xuICBjb25zdCBsb3dlciA9IHMudG9Mb3dlckNhc2UoKTtcbiAgaWYgKGxvd2VyLnN0YXJ0c1dpdGgoXCIuZ2l0L1wiKSB8fCBsb3dlciA9PT0gXCIuZ2l0XCIpIHJldHVybiBudWxsO1xuICBpZiAobG93ZXIuc3RhcnRzV2l0aChcIm5vZGVfbW9kdWxlcy9cIikpIHJldHVybiBudWxsO1xuICBpZiAobG93ZXIuZW5kc1dpdGgoXCIuZHNfc3RvcmVcIikpIHJldHVybiBudWxsO1xuICByZXR1cm4gcztcbn1cblxuYXN5bmMgZnVuY3Rpb24gd3JpdGVaaXBUb1RtcChqb2JJZCwgcGFydHMsIHN0b3JlKSB7XG4gIGNvbnN0IHRtcCA9IGAvdG1wLyR7am9iSWR9LnppcGA7XG4gIGNvbnN0IG91dCA9IGZzLmNyZWF0ZVdyaXRlU3RyZWFtKHRtcCk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcGFydHM7IGkrKykge1xuICAgIGNvbnN0IGFiID0gYXdhaXQgc3RvcmUuZ2V0KGBnaHppcC8ke2pvYklkfS8ke2l9YCwgeyB0eXBlOiBcImFycmF5QnVmZmVyXCIgfSk7XG4gICAgaWYgKCFhYikgdGhyb3cgbmV3IEVycm9yKGBNaXNzaW5nIGNodW5rIGJsb2IgJHtpfWApO1xuICAgIG91dC53cml0ZShCdWZmZXIuZnJvbShhYikpO1xuICB9XG4gIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBvdXQuZW5kKCk7XG4gICAgb3V0Lm9uKFwiZmluaXNoXCIsIHJlc29sdmUpO1xuICAgIG91dC5vbihcImVycm9yXCIsIHJlamVjdCk7XG4gIH0pO1xuICByZXR1cm4gdG1wO1xufVxuXG5mdW5jdGlvbiBvcGVuWmlwKHRtcFBhdGgpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICB5YXV6bC5vcGVuKHRtcFBhdGgsIHsgbGF6eUVudHJpZXM6IHRydWUgfSwgKGVyciwgemlwZmlsZSkgPT4ge1xuICAgICAgaWYgKGVycikgcmV0dXJuIHJlamVjdChlcnIpO1xuICAgICAgcmVzb2x2ZSh6aXBmaWxlKTtcbiAgICB9KTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHJlYWRFbnRyeSh6aXBmaWxlLCBlbnRyeSkge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIHppcGZpbGUub3BlblJlYWRTdHJlYW0oZW50cnksIChlcnIsIHN0cmVhbSkgPT4ge1xuICAgICAgaWYgKGVycikgcmV0dXJuIHJlamVjdChlcnIpO1xuICAgICAgY29uc3QgY2h1bmtzID0gW107XG4gICAgICBsZXQgdG90YWwgPSAwO1xuICAgICAgc3RyZWFtLm9uKFwiZGF0YVwiLCAoYykgPT4geyBjaHVua3MucHVzaChjKTsgdG90YWwgKz0gYy5sZW5ndGg7IH0pO1xuICAgICAgc3RyZWFtLm9uKFwiZW5kXCIsICgpID0+IHJlc29sdmUoeyBidWY6IEJ1ZmZlci5jb25jYXQoY2h1bmtzKSwgYnl0ZXM6IHRvdGFsIH0pKTtcbiAgICAgIHN0cmVhbS5vbihcImVycm9yXCIsIHJlamVjdCk7XG4gICAgfSk7XG4gIH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRIZWFkKHsgdG9rZW4sIG93bmVyLCByZXBvLCBicmFuY2ggfSkge1xuICB0cnkge1xuICAgIGNvbnN0IHIgPSBhd2FpdCBnaEdldCh7IHRva2VuLCBwYXRoOiBgL3JlcG9zLyR7ZW5jb2RlVVJJQ29tcG9uZW50KG93bmVyKX0vJHtlbmNvZGVVUklDb21wb25lbnQocmVwbyl9L2dpdC9yZWYvaGVhZHMvJHtlbmNvZGVVUklDb21wb25lbnQoYnJhbmNoKX1gIH0pO1xuICAgIHJldHVybiByLmRhdGE/Lm9iamVjdD8uc2hhIHx8IG51bGw7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAoZSBpbnN0YW5jZW9mIEdpdEh1YkFwaUVycm9yICYmIGUuc3RhdHVzID09PSA0MDQpIHJldHVybiBudWxsO1xuICAgIHRocm93IGU7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0Q29tbWl0VHJlZSh7IHRva2VuLCBvd25lciwgcmVwbywgY29tbWl0U2hhIH0pIHtcbiAgY29uc3QgciA9IGF3YWl0IGdoR2V0KHsgdG9rZW4sIHBhdGg6IGAvcmVwb3MvJHtlbmNvZGVVUklDb21wb25lbnQob3duZXIpfS8ke2VuY29kZVVSSUNvbXBvbmVudChyZXBvKX0vZ2l0L2NvbW1pdHMvJHtjb21taXRTaGF9YCB9KTtcbiAgcmV0dXJuIHIuZGF0YT8udHJlZT8uc2hhIHx8IG51bGw7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVJlZih7IHRva2VuLCBvd25lciwgcmVwbywgYnJhbmNoLCBzaGEgfSkge1xuICByZXR1cm4gZ2hQb3N0KHtcbiAgICB0b2tlbixcbiAgICBwYXRoOiBgL3JlcG9zLyR7ZW5jb2RlVVJJQ29tcG9uZW50KG93bmVyKX0vJHtlbmNvZGVVUklDb21wb25lbnQocmVwbyl9L2dpdC9yZWZzYCxcbiAgICBib2R5OiB7IHJlZjogYHJlZnMvaGVhZHMvJHticmFuY2h9YCwgc2hhIH1cbiAgfSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVJlZih7IHRva2VuLCBvd25lciwgcmVwbywgYnJhbmNoLCBzaGEgfSkge1xuICByZXR1cm4gZ2hQYXRjaCh7XG4gICAgdG9rZW4sXG4gICAgcGF0aDogYC9yZXBvcy8ke2VuY29kZVVSSUNvbXBvbmVudChvd25lcil9LyR7ZW5jb2RlVVJJQ29tcG9uZW50KHJlcG8pfS9naXQvcmVmcy9oZWFkcy8ke2VuY29kZVVSSUNvbXBvbmVudChicmFuY2gpfWAsXG4gICAgYm9keTogeyBzaGEsIGZvcmNlOiBmYWxzZSB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBjb21wdXRlQmFja29mZk1zKGF0dGVtcHQpIHtcbiAgY29uc3QgYmFzZSA9IGludEVudihcIkdJVEhVQl9KT0JfUkVUUllfQkFTRV9NU1wiLCAxMDAwKTtcbiAgY29uc3QgbWF4ID0gaW50RW52KFwiR0lUSFVCX0pPQl9SRVRSWV9NQVhfTVNcIiwgNjAwMDApO1xuICBjb25zdCBleHAgPSBNYXRoLm1pbihtYXgsIGJhc2UgKiAoMiAqKiBNYXRoLm1heCgwLCBhdHRlbXB0IC0gMSkpKTtcbiAgcmV0dXJuIGV4cCArIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDQwMCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG1hcmtSZXRyeShqb2JSb3dJZCwgYXR0ZW1wdCwgbXNnLCByZXNldFNlY29uZHMgPSBudWxsKSB7XG4gIGNvbnN0IGRlbGF5TXMgPSByZXNldFNlY29uZHMgIT09IG51bGwgPyAocmVzZXRTZWNvbmRzICogMTAwMCkgOiBjb21wdXRlQmFja29mZk1zKGF0dGVtcHQpO1xuICBjb25zdCBuZXh0ID0gbmV3IERhdGUoRGF0ZS5ub3coKSArIGRlbGF5TXMpLnRvSVNPU3RyaW5nKCk7XG4gIGF3YWl0IHEoXG4gICAgYHVwZGF0ZSBnaF9wdXNoX2pvYnNcbiAgICAgc2V0IHN0YXR1cz0ncmV0cnlfd2FpdCcsIG5leHRfYXR0ZW1wdF9hdD0kMjo6dGltZXN0YW1wdHosIGxhc3RfZXJyb3I9JDMsIGxhc3RfZXJyb3JfYXQ9bm93KCksIHVwZGF0ZWRfYXQ9bm93KClcbiAgICAgd2hlcmUgaWQ9JDFgLFxuICAgIFtqb2JSb3dJZCwgbmV4dCwgbXNnXVxuICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBtYXJrRmFpbChqb2JSb3dJZCwgbXNnKSB7XG4gIGF3YWl0IHEoXG4gICAgYHVwZGF0ZSBnaF9wdXNoX2pvYnNcbiAgICAgc2V0IHN0YXR1cz0nZXJyb3InLCBsYXN0X2Vycm9yPSQyLCBsYXN0X2Vycm9yX2F0PW5vdygpLCB1cGRhdGVkX2F0PW5vdygpXG4gICAgIHdoZXJlIGlkPSQxYCxcbiAgICBbam9iUm93SWQsIG1zZ11cbiAgKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgd3JhcChhc3luYyAocmVxKSA9PiB7XG4gIC8vIFNlY3JldC1vbmx5IGludGVybmFsIHdvcmtlciAobGlrZSBLYWl4dVB1c2ggam9iIHdvcmtlcnMpXG4gIHRyeSB7XG4gICAgY29uc3Qgc2VjcmV0ID0gKHByb2Nlc3MuZW52LkpPQl9XT1JLRVJfU0VDUkVUIHx8IFwiXCIpLnRyaW0oKTtcbiAgICBpZiAoIXNlY3JldCkgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuXG4gICAgY29uc3QgZ290ID0gKHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtam9iLXNlY3JldFwiKSB8fCBcIlwiKS50b1N0cmluZygpO1xuICAgIGlmIChnb3QgIT09IHNlY3JldCkgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuXG4gICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG5cbiAgICBsZXQgYm9keTtcbiAgICB0cnkgeyBib2R5ID0gYXdhaXQgcmVxLmpzb24oKTsgfSBjYXRjaCB7IHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwMiB9KTsgfVxuICAgIGNvbnN0IGpvYklkID0gKGJvZHkuam9iSWQgfHwgXCJcIikudG9TdHJpbmcoKTtcbiAgICBpZiAoIWpvYklkKSByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG5cbiAgICBjb25zdCByID0gYXdhaXQgcShgc2VsZWN0ICogZnJvbSBnaF9wdXNoX2pvYnMgd2hlcmUgam9iX2lkPSQxIGxpbWl0IDFgLCBbam9iSWRdKTtcbiAgICBpZiAoIXIucm93Q291bnQpIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwMiB9KTtcbiAgICBjb25zdCBqb2IgPSByLnJvd3NbMF07XG5cbiAgICBjb25zdCBtYXhBdHRlbXB0cyA9IGludEVudihcIkdJVEhVQl9KT0JfTUFYX0FUVEVNUFRTXCIsIDEwKTtcbiAgICBjb25zdCBhdHRlbXB0cyA9IChqb2IuYXR0ZW1wdHMgfHwgMCkgKyAxO1xuICAgIGlmIChhdHRlbXB0cyA+IG1heEF0dGVtcHRzKSB7XG4gICAgICBhd2FpdCBtYXJrRmFpbChqb2IuaWQsIGBFeGNlZWRlZCBtYXggYXR0ZW1wdHMgKCR7bWF4QXR0ZW1wdHN9KWApO1xuICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuICAgIH1cblxuICAgIC8vIHJlc3BlY3QgbmV4dF9hdHRlbXB0X2F0XG4gICAgaWYgKGpvYi5uZXh0X2F0dGVtcHRfYXQpIHtcbiAgICAgIGNvbnN0IHQgPSBuZXcgRGF0ZShqb2IubmV4dF9hdHRlbXB0X2F0KS5nZXRUaW1lKCk7XG4gICAgICBpZiAoRGF0ZS5ub3coKSA8IHQgLSA1MDApIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwMiB9KTtcbiAgICB9XG5cbiAgICBhd2FpdCBxKGB1cGRhdGUgZ2hfcHVzaF9qb2JzIHNldCBhdHRlbXB0cz0kMiwgc3RhdHVzPSdydW5uaW5nJywgdXBkYXRlZF9hdD1ub3coKSB3aGVyZSBpZD0kMWAsIFtqb2IuaWQsIGF0dGVtcHRzXSk7XG5cbiAgICBjb25zdCB0b2tlbiA9IGF3YWl0IGdldEdpdEh1YlRva2VuRm9yQ3VzdG9tZXIoam9iLmN1c3RvbWVyX2lkKTtcbiAgICBpZiAoIXRva2VuKSB7XG4gICAgICBhd2FpdCBtYXJrRmFpbChqb2IuaWQsIFwiTm8gR2l0SHViIHRva2VuIGNvbmZpZ3VyZWRcIik7XG4gICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3duZXIgPSBqb2Iub3duZXI7XG4gICAgY29uc3QgcmVwbyA9IGpvYi5yZXBvO1xuICAgIGNvbnN0IGJyYW5jaCA9IGpvYi5icmFuY2ggfHwgXCJtYWluXCI7XG4gICAgY29uc3QgbWVzc2FnZSA9IGpvYi5jb21taXRfbWVzc2FnZSB8fCBcIkthaXh1IEdpdEh1YiBQdXNoXCI7XG4gICAgY29uc3QgcGFydHMgPSBwYXJzZUludChqb2IucGFydHMgfHwgXCIwXCIsIDEwKTtcbiAgICBpZiAoIXBhcnRzIHx8IHBhcnRzIDwgMSkge1xuICAgICAgYXdhaXQgbWFya0ZhaWwoam9iLmlkLCBcIk1pc3NpbmcgcGFydHMgKG5vIHVwbG9hZGVkIHppcClcIik7XG4gICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG4gICAgfVxuXG4gICAgY29uc3Qgc3RvcmUgPSBjaHVua1N0b3JlKCk7XG5cbiAgICAvLyBBc3NlbWJsZSB6aXAgdG8gL3RtcFxuICAgIGxldCB0bXBaaXA7XG4gICAgdHJ5IHtcbiAgICAgIHRtcFppcCA9IGF3YWl0IHdyaXRlWmlwVG9UbXAoam9iSWQsIHBhcnRzLCBzdG9yZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgYXdhaXQgbWFya1JldHJ5KGpvYi5pZCwgYXR0ZW1wdHMsIGBaaXAgYXNzZW1ibGUgZmFpbGVkOiAke2U/Lm1lc3NhZ2UgfHwgXCJ1bmtub3duXCJ9YCk7XG4gICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgbWF4RmlsZXMgPSBpbnRFbnYoXCJHSVRIVUJfUFVTSF9NQVhfRklMRVNcIiwgMzAwMCk7XG4gICAgY29uc3QgbWF4VG90YWwgPSBpbnRFbnYoXCJHSVRIVUJfUFVTSF9NQVhfVE9UQUxfQllURVNcIiwgMTA0ODU3NjAwKTtcbiAgICBjb25zdCBtYXhGaWxlID0gaW50RW52KFwiR0lUSFVCX1BVU0hfTUFYX0ZJTEVfQllURVNcIiwgMTA0ODU3NjApO1xuXG4gICAgbGV0IHppcGZpbGU7XG4gICAgdHJ5IHsgemlwZmlsZSA9IGF3YWl0IG9wZW5aaXAodG1wWmlwKTsgfSBjYXRjaCAoZSkge1xuICAgICAgYXdhaXQgbWFya0ZhaWwoam9iLmlkLCBgSW52YWxpZCB6aXA6ICR7ZT8ubWVzc2FnZSB8fCBcInVua25vd25cIn1gKTtcbiAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwMiB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB0cmVlRW50cmllcyA9IFtdO1xuICAgIGxldCB0b3RhbEJ5dGVzID0gMDtcbiAgICBsZXQgZmlsZUNvdW50ID0gMDtcblxuICAgIGNvbnN0IGhlYWRTaGEgPSBhd2FpdCAoYXN5bmMgKCkgPT4ge1xuICAgICAgdHJ5IHsgcmV0dXJuIGF3YWl0IGdldEhlYWQoeyB0b2tlbiwgb3duZXIsIHJlcG8sIGJyYW5jaCB9KTsgfVxuICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBHaXRIdWJBcGlFcnJvciAmJiBlLmNvZGUgPT09IFwiR0lUSFVCX1JBVEVfTElNSVRcIikge1xuICAgICAgICAgIGF3YWl0IG1hcmtSZXRyeShqb2IuaWQsIGF0dGVtcHRzLCBcIkdpdEh1YiByYXRlIGxpbWl0ZWQgKGhlYWQpXCIsIGUubWV0YT8ucmVzZXRfc2Vjb25kcyA/PyA2MCk7XG4gICAgICAgICAgemlwZmlsZS5jbG9zZSgpO1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IGU7XG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIGNvbnN0IGJhc2VUcmVlU2hhID0gaGVhZFNoYSA/IGF3YWl0IChhc3luYyAoKSA9PiB7XG4gICAgICB0cnkgeyByZXR1cm4gYXdhaXQgZ2V0Q29tbWl0VHJlZSh7IHRva2VuLCBvd25lciwgcmVwbywgY29tbWl0U2hhOiBoZWFkU2hhIH0pOyB9XG4gICAgICBjYXRjaCAoZSkge1xuICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIEdpdEh1YkFwaUVycm9yICYmIGUuY29kZSA9PT0gXCJHSVRIVUJfUkFURV9MSU1JVFwiKSB7XG4gICAgICAgICAgYXdhaXQgbWFya1JldHJ5KGpvYi5pZCwgYXR0ZW1wdHMsIFwiR2l0SHViIHJhdGUgbGltaXRlZCAoY29tbWl0KVwiLCBlLm1ldGE/LnJlc2V0X3NlY29uZHMgPz8gNjApO1xuICAgICAgICAgIHppcGZpbGUuY2xvc2UoKTtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuICAgIH0pKCkgOiBudWxsO1xuXG4gICAgLy8gSXRlcmF0ZSB6aXAgZW50cmllc1xuICAgIGNvbnN0IGxvb3BSZXN1bHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB6aXBmaWxlLnJlYWRFbnRyeSgpO1xuXG4gICAgICB6aXBmaWxlLm9uKFwiZW50cnlcIiwgYXN5bmMgKGVudHJ5KSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgaWYgKC9cXC8kLy50ZXN0KGVudHJ5LmZpbGVOYW1lKSkgeyB6aXBmaWxlLnJlYWRFbnRyeSgpOyByZXR1cm47IH1cbiAgICAgICAgICBjb25zdCByZXBvUGF0aCA9IHNhbml0aXplUmVwb1BhdGgoZW50cnkuZmlsZU5hbWUpO1xuICAgICAgICAgIGlmICghcmVwb1BhdGgpIHsgemlwZmlsZS5yZWFkRW50cnkoKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBmaWxlQ291bnQrKztcbiAgICAgICAgICBpZiAoZmlsZUNvdW50ID4gbWF4RmlsZXMpIHRocm93IG5ldyBFcnJvcihgVG9vIG1hbnkgZmlsZXMgKD4ke21heEZpbGVzfSlgKTtcblxuICAgICAgICAgIGNvbnN0IHsgYnVmLCBieXRlcyB9ID0gYXdhaXQgcmVhZEVudHJ5KHppcGZpbGUsIGVudHJ5KTtcbiAgICAgICAgICBpZiAoYnl0ZXMgPiBtYXhGaWxlKSB0aHJvdyBuZXcgRXJyb3IoYEZpbGUgdG9vIGxhcmdlOiAke3JlcG9QYXRofSAoJHtieXRlc30gYnl0ZXMpYCk7XG5cbiAgICAgICAgICB0b3RhbEJ5dGVzICs9IGJ5dGVzO1xuICAgICAgICAgIGlmICh0b3RhbEJ5dGVzID4gbWF4VG90YWwpIHRocm93IG5ldyBFcnJvcihgVG90YWwgc2l6ZSB0b28gbGFyZ2UgKD4ke21heFRvdGFsfSBieXRlcylgKTtcblxuICAgICAgICAgIGNvbnN0IGNvbnRlbnRCNjQgPSBidWYudG9TdHJpbmcoXCJiYXNlNjRcIik7XG5cbiAgICAgICAgICBsZXQgYmxvYlNoYTtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYiA9IGF3YWl0IGdoUG9zdCh7IHRva2VuLCBwYXRoOiBgL3JlcG9zLyR7ZW5jb2RlVVJJQ29tcG9uZW50KG93bmVyKX0vJHtlbmNvZGVVUklDb21wb25lbnQocmVwbyl9L2dpdC9ibG9ic2AsIGJvZHk6IHsgY29udGVudDogY29udGVudEI2NCwgZW5jb2Rpbmc6IFwiYmFzZTY0XCIgfSB9KTtcbiAgICAgICAgICAgIGJsb2JTaGEgPSBiLmRhdGE/LnNoYTtcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIEdpdEh1YkFwaUVycm9yICYmIGUuY29kZSA9PT0gXCJHSVRIVUJfUkFURV9MSU1JVFwiKSB7XG4gICAgICAgICAgICAgIGF3YWl0IG1hcmtSZXRyeShqb2IuaWQsIGF0dGVtcHRzLCBcIkdpdEh1YiByYXRlIGxpbWl0ZWQgKGJsb2IpXCIsIGUubWV0YT8ucmVzZXRfc2Vjb25kcyA/PyA2MCk7XG4gICAgICAgICAgICAgIHppcGZpbGUuY2xvc2UoKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZShcInJldHJ5XCIpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIEdpdEh1YkFwaUVycm9yICYmIChlLmNvZGUgPT09IFwiR0lUSFVCX1RSQU5TSUVOVFwiIHx8IGUuY29kZSA9PT0gXCJHSVRIVUJfTkVUV09SS1wiKSkge1xuICAgICAgICAgICAgICBhd2FpdCBtYXJrUmV0cnkoam9iLmlkLCBhdHRlbXB0cywgXCJHaXRIdWIgdHJhbnNpZW50IGVycm9yIChibG9iKVwiKTtcbiAgICAgICAgICAgICAgemlwZmlsZS5jbG9zZSgpO1xuICAgICAgICAgICAgICByZXNvbHZlKFwicmV0cnlcIik7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKCFibG9iU2hhKSB0aHJvdyBuZXcgRXJyb3IoXCJNaXNzaW5nIGJsb2Igc2hhXCIpO1xuXG4gICAgICAgICAgdHJlZUVudHJpZXMucHVzaCh7IHBhdGg6IHJlcG9QYXRoLCBtb2RlOiBcIjEwMDY0NFwiLCB0eXBlOiBcImJsb2JcIiwgc2hhOiBibG9iU2hhIH0pO1xuICAgICAgICAgIHppcGZpbGUucmVhZEVudHJ5KCk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICB6aXBmaWxlLmNsb3NlKCk7XG4gICAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgemlwZmlsZS5vbihcImVuZFwiLCAoKSA9PiByZXNvbHZlKFwiZG9uZVwiKSk7XG4gICAgICB6aXBmaWxlLm9uKFwiZXJyb3JcIiwgcmVqZWN0KTtcbiAgICB9KS5jYXRjaChhc3luYyAoZSkgPT4ge1xuICAgICAgYXdhaXQgbWFya0ZhaWwoam9iLmlkLCBgWmlwIHByb2Nlc3NpbmcgZmFpbGVkOiAke2U/Lm1lc3NhZ2UgfHwgXCJ1bmtub3duXCJ9YCk7XG4gICAgICB0cnkgeyB6aXBmaWxlLmNsb3NlKCk7IH0gY2F0Y2gge31cbiAgICAgIHJldHVybiBcImZhaWxlZFwiO1xuICAgIH0pO1xuXG4gICAgaWYgKGxvb3BSZXN1bHQgIT09IFwiZG9uZVwiKSByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG5cbiAgICAvLyBJZiBqb2Igd2VudCB0byByZXRyeV93YWl0IGluc2lkZSBsb29wLCBzdG9wLlxuICAgIGNvbnN0IHN0YXR1c05vdyA9IGF3YWl0IHEoYHNlbGVjdCBzdGF0dXMgZnJvbSBnaF9wdXNoX2pvYnMgd2hlcmUgaWQ9JDFgLCBbam9iLmlkXSk7XG4gICAgaWYgKHN0YXR1c05vdy5yb3dzWzBdPy5zdGF0dXMgPT09IFwicmV0cnlfd2FpdFwiKSByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG4gICAgaWYgKHN0YXR1c05vdy5yb3dzWzBdPy5zdGF0dXMgPT09IFwiZXJyb3JcIikgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuXG4gICAgLy8gQ3JlYXRlIHRyZWVcbiAgICBsZXQgdHJlZVNoYTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdHIgPSBhd2FpdCBnaFBvc3Qoe1xuICAgICAgICB0b2tlbixcbiAgICAgICAgcGF0aDogYC9yZXBvcy8ke2VuY29kZVVSSUNvbXBvbmVudChvd25lcil9LyR7ZW5jb2RlVVJJQ29tcG9uZW50KHJlcG8pfS9naXQvdHJlZXNgLFxuICAgICAgICBib2R5OiBiYXNlVHJlZVNoYSA/IHsgYmFzZV90cmVlOiBiYXNlVHJlZVNoYSwgdHJlZTogdHJlZUVudHJpZXMgfSA6IHsgdHJlZTogdHJlZUVudHJpZXMgfVxuICAgICAgfSk7XG4gICAgICB0cmVlU2hhID0gdHIuZGF0YT8uc2hhO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgR2l0SHViQXBpRXJyb3IgJiYgZS5jb2RlID09PSBcIkdJVEhVQl9SQVRFX0xJTUlUXCIpIHtcbiAgICAgICAgYXdhaXQgbWFya1JldHJ5KGpvYi5pZCwgYXR0ZW1wdHMsIFwiR2l0SHViIHJhdGUgbGltaXRlZCAodHJlZSlcIiwgZS5tZXRhPy5yZXNldF9zZWNvbmRzID8/IDYwKTtcbiAgICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuICAgICAgfVxuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBHaXRIdWJBcGlFcnJvciAmJiAoZS5jb2RlID09PSBcIkdJVEhVQl9UUkFOU0lFTlRcIiB8fCBlLmNvZGUgPT09IFwiR0lUSFVCX05FVFdPUktcIikpIHtcbiAgICAgICAgYXdhaXQgbWFya1JldHJ5KGpvYi5pZCwgYXR0ZW1wdHMsIFwiR2l0SHViIHRyYW5zaWVudCBlcnJvciAodHJlZSlcIik7XG4gICAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwMiB9KTtcbiAgICAgIH1cbiAgICAgIGF3YWl0IG1hcmtGYWlsKGpvYi5pZCwgYFRyZWUgY3JlYXRlIGZhaWxlZDogJHtlPy5tZXNzYWdlIHx8IFwidW5rbm93blwifWApO1xuICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuICAgIH1cblxuICAgIGlmICghdHJlZVNoYSkgeyBhd2FpdCBtYXJrRmFpbChqb2IuaWQsIFwiTWlzc2luZyB0cmVlIHNoYVwiKTsgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pOyB9XG5cbiAgICAvLyBDcmVhdGUgY29tbWl0XG4gICAgbGV0IGNvbW1pdFNoYTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgY3IgPSBhd2FpdCBnaFBvc3Qoe1xuICAgICAgICB0b2tlbixcbiAgICAgICAgcGF0aDogYC9yZXBvcy8ke2VuY29kZVVSSUNvbXBvbmVudChvd25lcil9LyR7ZW5jb2RlVVJJQ29tcG9uZW50KHJlcG8pfS9naXQvY29tbWl0c2AsXG4gICAgICAgIGJvZHk6IGhlYWRTaGEgPyB7IG1lc3NhZ2UsIHRyZWU6IHRyZWVTaGEsIHBhcmVudHM6IFtoZWFkU2hhXSB9IDogeyBtZXNzYWdlLCB0cmVlOiB0cmVlU2hhLCBwYXJlbnRzOiBbXSB9XG4gICAgICB9KTtcbiAgICAgIGNvbW1pdFNoYSA9IGNyLmRhdGE/LnNoYTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZSBpbnN0YW5jZW9mIEdpdEh1YkFwaUVycm9yICYmIGUuY29kZSA9PT0gXCJHSVRIVUJfUkFURV9MSU1JVFwiKSB7XG4gICAgICAgIGF3YWl0IG1hcmtSZXRyeShqb2IuaWQsIGF0dGVtcHRzLCBcIkdpdEh1YiByYXRlIGxpbWl0ZWQgKGNvbW1pdClcIiwgZS5tZXRhPy5yZXNldF9zZWNvbmRzID8/IDYwKTtcbiAgICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuICAgICAgfVxuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBHaXRIdWJBcGlFcnJvciAmJiAoZS5jb2RlID09PSBcIkdJVEhVQl9UUkFOU0lFTlRcIiB8fCBlLmNvZGUgPT09IFwiR0lUSFVCX05FVFdPUktcIikpIHtcbiAgICAgICAgYXdhaXQgbWFya1JldHJ5KGpvYi5pZCwgYXR0ZW1wdHMsIFwiR2l0SHViIHRyYW5zaWVudCBlcnJvciAoY29tbWl0KVwiKTtcbiAgICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuICAgICAgfVxuICAgICAgYXdhaXQgbWFya0ZhaWwoam9iLmlkLCBgQ29tbWl0IGNyZWF0ZSBmYWlsZWQ6ICR7ZT8ubWVzc2FnZSB8fCBcInVua25vd25cIn1gKTtcbiAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwMiB9KTtcbiAgICB9XG5cbiAgICBpZiAoIWNvbW1pdFNoYSkgeyBhd2FpdCBtYXJrRmFpbChqb2IuaWQsIFwiTWlzc2luZyBjb21taXQgc2hhXCIpOyByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7IH1cblxuICAgIC8vIFVwZGF0ZS9jcmVhdGUgcmVmXG4gICAgdHJ5IHtcbiAgICAgIGlmIChoZWFkU2hhKSBhd2FpdCB1cGRhdGVSZWYoeyB0b2tlbiwgb3duZXIsIHJlcG8sIGJyYW5jaCwgc2hhOiBjb21taXRTaGEgfSk7XG4gICAgICBlbHNlIGF3YWl0IGNyZWF0ZVJlZih7IHRva2VuLCBvd25lciwgcmVwbywgYnJhbmNoLCBzaGE6IGNvbW1pdFNoYSB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZSBpbnN0YW5jZW9mIEdpdEh1YkFwaUVycm9yICYmIGUuY29kZSA9PT0gXCJHSVRIVUJfUkFURV9MSU1JVFwiKSB7XG4gICAgICAgIGF3YWl0IG1hcmtSZXRyeShqb2IuaWQsIGF0dGVtcHRzLCBcIkdpdEh1YiByYXRlIGxpbWl0ZWQgKHJlZilcIiwgZS5tZXRhPy5yZXNldF9zZWNvbmRzID8/IDYwKTtcbiAgICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuICAgICAgfVxuICAgICAgYXdhaXQgbWFya0ZhaWwoam9iLmlkLCBgUmVmIHVwZGF0ZSBmYWlsZWQ6ICR7ZT8ubWVzc2FnZSB8fCBcInVua25vd25cIn1gKTtcbiAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwMiB9KTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHRVcmwgPSBgaHR0cHM6Ly9naXRodWIuY29tLyR7b3duZXJ9LyR7cmVwb30vY29tbWl0LyR7Y29tbWl0U2hhfWA7XG5cbiAgICBhd2FpdCBxKFxuICAgICAgYHVwZGF0ZSBnaF9wdXNoX2pvYnNcbiAgICAgICBzZXQgc3RhdHVzPSdkb25lJywgcmVzdWx0X2NvbW1pdF9zaGE9JDIsIHJlc3VsdF91cmw9JDMsIGxhc3RfZXJyb3I9bnVsbCwgbGFzdF9lcnJvcl9hdD1udWxsLCBuZXh0X2F0dGVtcHRfYXQ9bnVsbCwgdXBkYXRlZF9hdD1ub3coKVxuICAgICAgIHdoZXJlIGlkPSQxYCxcbiAgICAgIFtqb2IuaWQsIGNvbW1pdFNoYSwgcmVzdWx0VXJsXVxuICAgICk7XG5cbiAgICBhd2FpdCBxKFxuICAgICAgYGluc2VydCBpbnRvIGdoX3B1c2hfZXZlbnRzKGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCBqb2Jfcm93X2lkLCBldmVudF90eXBlLCBieXRlcywgbWV0YSlcbiAgICAgICB2YWx1ZXMgKCQxLCQyLCQzLCdkb25lJywkNCwkNTo6anNvbmIpYCxcbiAgICAgIFtqb2IuY3VzdG9tZXJfaWQsIGpvYi5hcGlfa2V5X2lkLCBqb2IuaWQsIHRvdGFsQnl0ZXMsIEpTT04uc3RyaW5naWZ5KHsgZmlsZXM6IGZpbGVDb3VudCwgY29tbWl0OiBjb21taXRTaGEsIHVybDogcmVzdWx0VXJsIH0pXVxuICAgICk7XG5cbiAgICBhd2FpdCBhdWRpdChcInN5c3RlbVwiLCBcIkdJVEhVQl9QVVNIX0RPTkVcIiwgYGdoOiR7am9iSWR9YCwgeyBvd25lciwgcmVwbywgYnJhbmNoLCBjb21taXQ6IGNvbW1pdFNoYSwgZmlsZXM6IGZpbGVDb3VudCwgYnl0ZXM6IHRvdGFsQnl0ZXMgfSk7XG5cbiAgICAvLyBDbGVhbnVwIHppcCBjaHVua3MgYmVzdC1lZmZvcnRcbiAgICB0cnkgeyBmb3IgKGxldCBpID0gMDsgaSA8IHBhcnRzOyBpKyspIGF3YWl0IHN0b3JlLmRlbGV0ZShgZ2h6aXAvJHtqb2JJZH0vJHtpfWApOyB9IGNhdGNoIHt9XG5cbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwMiB9KTtcbiAgfVxufSk7XG4iLCAiZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkQ29ycyhyZXEpIHtcbiAgY29uc3QgYWxsb3dSYXcgPSAocHJvY2Vzcy5lbnYuQUxMT1dFRF9PUklHSU5TIHx8IFwiXCIpLnRyaW0oKTtcbiAgY29uc3QgcmVxT3JpZ2luID0gcmVxLmhlYWRlcnMuZ2V0KFwib3JpZ2luXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIk9yaWdpblwiKTtcblxuICAvLyBJTVBPUlRBTlQ6IGtlZXAgdGhpcyBsaXN0IGFsaWduZWQgd2l0aCB3aGF0ZXZlciBoZWFkZXJzIHlvdXIgYXBwcyBzZW5kLlxuICBjb25zdCBhbGxvd0hlYWRlcnMgPSBcImF1dGhvcml6YXRpb24sIGNvbnRlbnQtdHlwZSwgeC1rYWl4dS1pbnN0YWxsLWlkLCB4LWthaXh1LXJlcXVlc3QtaWQsIHgta2FpeHUtYXBwLCB4LWthaXh1LWJ1aWxkLCB4LWFkbWluLXBhc3N3b3JkLCB4LWthaXh1LWVycm9yLXRva2VuLCB4LWthaXh1LW1vZGUsIHgtY29udGVudC1zaGExLCB4LXNldHVwLXNlY3JldCwgeC1rYWl4dS1qb2Itc2VjcmV0LCB4LWpvYi13b3JrZXItc2VjcmV0XCI7XG4gIGNvbnN0IGFsbG93TWV0aG9kcyA9IFwiR0VULFBPU1QsUFVULFBBVENILERFTEVURSxPUFRJT05TXCI7XG5cbiAgY29uc3QgYmFzZSA9IHtcbiAgICBcImFjY2Vzcy1jb250cm9sLWFsbG93LWhlYWRlcnNcIjogYWxsb3dIZWFkZXJzLFxuICAgIFwiYWNjZXNzLWNvbnRyb2wtYWxsb3ctbWV0aG9kc1wiOiBhbGxvd01ldGhvZHMsXG4gICAgXCJhY2Nlc3MtY29udHJvbC1leHBvc2UtaGVhZGVyc1wiOiBcIngta2FpeHUtcmVxdWVzdC1pZFwiLFxuICAgIFwiYWNjZXNzLWNvbnRyb2wtbWF4LWFnZVwiOiBcIjg2NDAwXCJcbiAgfTtcblxuICAvLyBTVFJJQ1QgQlkgREVGQVVMVDpcbiAgLy8gLSBJZiBBTExPV0VEX09SSUdJTlMgaXMgdW5zZXQvYmxhbmsgYW5kIGEgYnJvd3NlciBPcmlnaW4gaXMgcHJlc2VudCwgd2UgZG8gTk9UIGdyYW50IENPUlMuXG4gIC8vIC0gQWxsb3ctYWxsIGlzIG9ubHkgZW5hYmxlZCB3aGVuIEFMTE9XRURfT1JJR0lOUyBleHBsaWNpdGx5IGNvbnRhaW5zIFwiKlwiLlxuICBpZiAoIWFsbG93UmF3KSB7XG4gICAgLy8gTm8gYWxsb3ctb3JpZ2luIGdyYW50ZWQuIFNlcnZlci10by1zZXJ2ZXIgcmVxdWVzdHMgKG5vIE9yaWdpbiBoZWFkZXIpIHN0aWxsIHdvcmsgbm9ybWFsbHkuXG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmJhc2UsXG4gICAgICAuLi4ocmVxT3JpZ2luID8geyB2YXJ5OiBcIk9yaWdpblwiIH0gOiB7fSlcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgYWxsb3dlZCA9IGFsbG93UmF3LnNwbGl0KFwiLFwiKS5tYXAoKHMpID0+IHMudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XG5cbiAgLy8gRXhwbGljaXQgYWxsb3ctYWxsXG4gIGlmIChhbGxvd2VkLmluY2x1ZGVzKFwiKlwiKSkge1xuICAgIGNvbnN0IG9yaWdpbiA9IHJlcU9yaWdpbiB8fCBcIipcIjtcbiAgICByZXR1cm4ge1xuICAgICAgLi4uYmFzZSxcbiAgICAgIFwiYWNjZXNzLWNvbnRyb2wtYWxsb3ctb3JpZ2luXCI6IG9yaWdpbixcbiAgICAgIC4uLihyZXFPcmlnaW4gPyB7IHZhcnk6IFwiT3JpZ2luXCIgfSA6IHt9KVxuICAgIH07XG4gIH1cblxuICAvLyBFeGFjdC1tYXRjaCBhbGxvd2xpc3RcbiAgaWYgKHJlcU9yaWdpbiAmJiBhbGxvd2VkLmluY2x1ZGVzKHJlcU9yaWdpbikpIHtcbiAgICByZXR1cm4ge1xuICAgICAgLi4uYmFzZSxcbiAgICAgIFwiYWNjZXNzLWNvbnRyb2wtYWxsb3ctb3JpZ2luXCI6IHJlcU9yaWdpbixcbiAgICAgIHZhcnk6IFwiT3JpZ2luXCJcbiAgICB9O1xuICB9XG5cbiAgLy8gT3JpZ2luIHByZXNlbnQgYnV0IG5vdCBhbGxvd2VkOiBkbyBub3QgZ3JhbnQgYWxsb3ctb3JpZ2luLlxuICByZXR1cm4ge1xuICAgIC4uLmJhc2UsXG4gICAgLi4uKHJlcU9yaWdpbiA/IHsgdmFyeTogXCJPcmlnaW5cIiB9IDoge30pXG4gIH07XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGpzb24oc3RhdHVzLCBib2R5LCBoZWFkZXJzID0ge30pIHtcbiAgcmV0dXJuIG5ldyBSZXNwb25zZShKU09OLnN0cmluZ2lmeShib2R5KSwge1xuICAgIHN0YXR1cyxcbiAgICBoZWFkZXJzOiB7XG4gICAgICBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9dXRmLThcIixcbiAgICAgIC4uLmhlYWRlcnNcbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGV4dChzdGF0dXMsIGJvZHksIGhlYWRlcnMgPSB7fSkge1xuICByZXR1cm4gbmV3IFJlc3BvbnNlKGJvZHksIHsgc3RhdHVzLCBoZWFkZXJzIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYmFkUmVxdWVzdChtZXNzYWdlLCBoZWFkZXJzID0ge30pIHtcbiAgcmV0dXJuIGpzb24oNDAwLCB7IGVycm9yOiBtZXNzYWdlIH0sIGhlYWRlcnMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QmVhcmVyKHJlcSkge1xuICBjb25zdCBhdXRoID0gcmVxLmhlYWRlcnMuZ2V0KFwiYXV0aG9yaXphdGlvblwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJBdXRob3JpemF0aW9uXCIpIHx8IFwiXCI7XG4gIGlmICghYXV0aC5zdGFydHNXaXRoKFwiQmVhcmVyIFwiKSkgcmV0dXJuIG51bGw7XG4gIHJldHVybiBhdXRoLnNsaWNlKDcpLnRyaW0oKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1vbnRoS2V5VVRDKGQgPSBuZXcgRGF0ZSgpKSB7XG4gIHJldHVybiBkLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgNyk7IC8vIFlZWVktTU1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEluc3RhbGxJZChyZXEpIHtcbiAgcmV0dXJuIChcbiAgICByZXEuaGVhZGVycy5nZXQoXCJ4LWthaXh1LWluc3RhbGwtaWRcIikgfHxcbiAgICByZXEuaGVhZGVycy5nZXQoXCJYLUthaXh1LUluc3RhbGwtSWRcIikgfHxcbiAgICBcIlwiXG4gICkudG9TdHJpbmcoKS50cmltKCkuc2xpY2UoMCwgODApIHx8IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRVc2VyQWdlbnQocmVxKSB7XG4gIHJldHVybiAocmVxLmhlYWRlcnMuZ2V0KFwidXNlci1hZ2VudFwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJVc2VyLUFnZW50XCIpIHx8IFwiXCIpLnRvU3RyaW5nKCkuc2xpY2UoMCwgMjQwKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldENsaWVudElwKHJlcSkge1xuICAvLyBOZXRsaWZ5IGFkZHMgeC1uZi1jbGllbnQtY29ubmVjdGlvbi1pcCB3aGVuIGRlcGxveWVkIChtYXkgYmUgbWlzc2luZyBpbiBuZXRsaWZ5IGRldikuXG4gIGNvbnN0IGEgPSAocmVxLmhlYWRlcnMuZ2V0KFwieC1uZi1jbGllbnQtY29ubmVjdGlvbi1pcFwiKSB8fCBcIlwiKS50b1N0cmluZygpLnRyaW0oKTtcbiAgaWYgKGEpIHJldHVybiBhO1xuXG4gIC8vIEZhbGxiYWNrIHRvIGZpcnN0IFgtRm9yd2FyZGVkLUZvciBlbnRyeS5cbiAgY29uc3QgeGZmID0gKHJlcS5oZWFkZXJzLmdldChcIngtZm9yd2FyZGVkLWZvclwiKSB8fCBcIlwiKS50b1N0cmluZygpO1xuICBpZiAoIXhmZikgcmV0dXJuIG51bGw7XG4gIGNvbnN0IGZpcnN0ID0geGZmLnNwbGl0KFwiLFwiKVswXS50cmltKCk7XG4gIHJldHVybiBmaXJzdCB8fCBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2xlZXAobXMpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyKSA9PiBzZXRUaW1lb3V0KHIsIG1zKSk7XG59IiwgImltcG9ydCB7IG5lb24gfSBmcm9tIFwiQG5ldGxpZnkvbmVvblwiO1xuXG4vKipcbiAqIE5ldGxpZnkgREIgKE5lb24gUG9zdGdyZXMpIGhlbHBlci5cbiAqXG4gKiBJTVBPUlRBTlQgKE5lb24gc2VydmVybGVzcyBkcml2ZXIsIDIwMjUrKTpcbiAqIC0gYG5lb24oKWAgcmV0dXJucyBhIHRhZ2dlZC10ZW1wbGF0ZSBxdWVyeSBmdW5jdGlvbi5cbiAqIC0gRm9yIGR5bmFtaWMgU1FMIHN0cmluZ3MgKyAkMSBwbGFjZWhvbGRlcnMsIHVzZSBgc3FsLnF1ZXJ5KHRleHQsIHBhcmFtcylgLlxuICogICAoQ2FsbGluZyB0aGUgdGVtcGxhdGUgZnVuY3Rpb24gbGlrZSBzcWwoXCJTRUxFQ1QgLi4uXCIpIGNhbiBicmVhayBvbiBuZXdlciBkcml2ZXIgdmVyc2lvbnMuKVxuICpcbiAqIE5ldGxpZnkgREIgYXV0b21hdGljYWxseSBpbmplY3RzIGBORVRMSUZZX0RBVEFCQVNFX1VSTGAgd2hlbiB0aGUgTmVvbiBleHRlbnNpb24gaXMgYXR0YWNoZWQuXG4gKi9cblxubGV0IF9zcWwgPSBudWxsO1xubGV0IF9zY2hlbWFQcm9taXNlID0gbnVsbDtcblxuZnVuY3Rpb24gZ2V0U3FsKCkge1xuICBpZiAoX3NxbCkgcmV0dXJuIF9zcWw7XG5cbiAgY29uc3QgaGFzRGJVcmwgPSAhIShwcm9jZXNzLmVudi5ORVRMSUZZX0RBVEFCQVNFX1VSTCB8fCBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwpO1xuICBpZiAoIWhhc0RiVXJsKSB7XG4gICAgY29uc3QgZXJyID0gbmV3IEVycm9yKFwiRGF0YWJhc2Ugbm90IGNvbmZpZ3VyZWQgKG1pc3NpbmcgTkVUTElGWV9EQVRBQkFTRV9VUkwpLiBBdHRhY2ggTmV0bGlmeSBEQiAoTmVvbikgdG8gdGhpcyBzaXRlLlwiKTtcbiAgICBlcnIuY29kZSA9IFwiREJfTk9UX0NPTkZJR1VSRURcIjtcbiAgICBlcnIuc3RhdHVzID0gNTAwO1xuICAgIGVyci5oaW50ID0gXCJOZXRsaWZ5IFVJIFx1MjE5MiBFeHRlbnNpb25zIFx1MjE5MiBOZW9uIFx1MjE5MiBBZGQgZGF0YWJhc2UgKG9yIHJ1bjogbnB4IG5ldGxpZnkgZGIgaW5pdCkuXCI7XG4gICAgdGhyb3cgZXJyO1xuICB9XG5cbiAgX3NxbCA9IG5lb24oKTsgLy8gYXV0by11c2VzIHByb2Nlc3MuZW52Lk5FVExJRllfREFUQUJBU0VfVVJMIG9uIE5ldGxpZnlcbiAgcmV0dXJuIF9zcWw7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZVNjaGVtYSgpIHtcbiAgaWYgKF9zY2hlbWFQcm9taXNlKSByZXR1cm4gX3NjaGVtYVByb21pc2U7XG5cbiAgX3NjaGVtYVByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHNxbCA9IGdldFNxbCgpO1xuICAgIGNvbnN0IHN0YXRlbWVudHMgPSBbXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBlbWFpbCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgcGxhbl9uYW1lIHRleHQgbm90IG51bGwgZGVmYXVsdCAnc3RhcnRlcicsXG4gICAgICAgIG1vbnRobHlfY2FwX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAyMDAwLFxuICAgICAgICBpc19hY3RpdmUgYm9vbGVhbiBub3QgbnVsbCBkZWZhdWx0IHRydWUsXG4gICAgICAgIHN0cmlwZV9jdXN0b21lcl9pZCB0ZXh0LFxuICAgICAgICBzdHJpcGVfc3Vic2NyaXB0aW9uX2lkIHRleHQsXG4gICAgICAgIHN0cmlwZV9zdGF0dXMgdGV4dCxcbiAgICAgICAgc3RyaXBlX2N1cnJlbnRfcGVyaW9kX2VuZCB0aW1lc3RhbXB0eixcbiAgICAgICAgYXV0b190b3B1cF9lbmFibGVkIGJvb2xlYW4gbm90IG51bGwgZGVmYXVsdCBmYWxzZSxcbiAgICAgICAgYXV0b190b3B1cF9hbW91bnRfY2VudHMgaW50ZWdlcixcbiAgICAgICAgYXV0b190b3B1cF90aHJlc2hvbGRfY2VudHMgaW50ZWdlcixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgYXBpX2tleXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGtleV9oYXNoIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBrZXlfbGFzdDQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbGFiZWwgdGV4dCxcbiAgICAgICAgbW9udGhseV9jYXBfY2VudHMgaW50ZWdlcixcbiAgICAgICAgcnBtX2xpbWl0IGludGVnZXIsXG4gICAgICAgIHJwZF9saW1pdCBpbnRlZ2VyLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHJldm9rZWRfYXQgdGltZXN0YW1wdHpcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhcGlfa2V5c19jdXN0b21lcl9pZF9pZHggb24gYXBpX2tleXMoY3VzdG9tZXJfaWQpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgbW9udGhseV91c2FnZSAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHNwZW50X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBleHRyYV9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgaW5wdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgbW9udGhseV9rZXlfdXNhZ2UgKFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc3BlbnRfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY2FsbHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGFwaV9rZXlfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIG1vbnRobHlfa2V5X3VzYWdlX2N1c3RvbWVyX21vbnRoX2lkeCBvbiBtb250aGx5X2tleV91c2FnZShjdXN0b21lcl9pZCwgbW9udGgpO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgbW9udGhseV9rZXlfdXNhZ2UgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGNhbGxzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbW9kZWwgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgaW5wdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHNfY3VzdG9tZXJfbW9udGhfaWR4IG9uIHVzYWdlX2V2ZW50cyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHVzYWdlX2V2ZW50c19rZXlfaWR4IG9uIHVzYWdlX2V2ZW50cyhhcGlfa2V5X2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgYXVkaXRfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBhY3RvciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBhY3Rpb24gdGV4dCBub3QgbnVsbCxcbiAgICAgICAgdGFyZ2V0IHRleHQsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXVkaXRfZXZlbnRzX2NyZWF0ZWRfaWR4IG9uIGF1ZGl0X2V2ZW50cyhjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcmF0ZV9saW1pdF93aW5kb3dzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHdpbmRvd19zdGFydCB0aW1lc3RhbXB0eiBub3QgbnVsbCxcbiAgICAgICAgY291bnQgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgd2luZG93X3N0YXJ0KVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHJhdGVfbGltaXRfd2luZG93c193aW5kb3dfaWR4IG9uIHJhdGVfbGltaXRfd2luZG93cyh3aW5kb3dfc3RhcnQgZGVzYyk7YCwgICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxhc3Rfc2Vlbl9hdCB0aW1lc3RhbXB0ejtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X3NlZW5faW5zdGFsbF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgdXNhZ2VfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBpbnN0YWxsX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSB1c2FnZV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGlwX2hhc2ggdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHVzYWdlX2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdWEgdGV4dDtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHVzYWdlX2V2ZW50c19pbnN0YWxsX2lkeCBvbiB1c2FnZV9ldmVudHMoaW5zdGFsbF9pZCk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhbGVydHNfc2VudCAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBhbGVydF90eXBlIHRleHQgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCBtb250aCwgYWxlcnRfdHlwZSlcbiAgICAgICk7YCxcbiAgICBcbiAgICAgIC8vIC0tLSBEZXZpY2UgYmluZGluZyAvIHNlYXRzIC0tLVxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbWF4X2RldmljZXNfcGVyX2tleSBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByZXF1aXJlX2luc3RhbGxfaWQgYm9vbGVhbiBub3QgbnVsbCBkZWZhdWx0IGZhbHNlO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhbGxvd2VkX3Byb3ZpZGVycyB0ZXh0W107YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfbW9kZWxzIGpzb25iO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBzdHJpcGVfY3VycmVudF9wZXJpb2RfZW5kIHRpbWVzdGFtcHR6O2AsXG5cbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbWF4X2RldmljZXMgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByZXF1aXJlX2luc3RhbGxfaWQgYm9vbGVhbjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhbGxvd2VkX3Byb3ZpZGVycyB0ZXh0W107YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9tb2RlbHMganNvbmI7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGtleV9kZXZpY2VzIChcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGluc3RhbGxfaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgZGV2aWNlX2xhYmVsIHRleHQsXG4gICAgICAgIGZpcnN0X3NlZW5fYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgbGFzdF9zZWVuX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBsYXN0X3NlZW5fdWEgdGV4dCxcbiAgICAgICAgcmV2b2tlZF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgcmV2b2tlZF9ieSB0ZXh0LFxuICAgICAgICBwcmltYXJ5IGtleSAoYXBpX2tleV9pZCwgaW5zdGFsbF9pZClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBrZXlfZGV2aWNlc19jdXN0b21lcl9pZHggb24ga2V5X2RldmljZXMoY3VzdG9tZXJfaWQpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMga2V5X2RldmljZXNfbGFzdF9zZWVuX2lkeCBvbiBrZXlfZGV2aWNlcyhsYXN0X3NlZW5fYXQgZGVzYyk7YCxcblxuICAgICAgLy8gLS0tIEludm9pY2Ugc25hcHNob3RzICsgdG9wdXBzIC0tLVxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIG1vbnRobHlfaW52b2ljZXMgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzbmFwc2hvdCBqc29uYiBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdG9wdXBfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBhbW91bnRfY2VudHMgaW50ZWdlciBub3QgbnVsbCxcbiAgICAgICAgc291cmNlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnbWFudWFsJyxcbiAgICAgICAgc3RyaXBlX3Nlc3Npb25faWQgdGV4dCxcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAnYXBwbGllZCcsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHRvcHVwX2V2ZW50c19jdXN0b21lcl9tb250aF9pZHggb24gdG9wdXBfZXZlbnRzKGN1c3RvbWVyX2lkLCBtb250aCk7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGFzeW5jX2pvYnMgKFxuICAgICAgICBpZCB1dWlkIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbW9kZWwgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcmVxdWVzdCBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdxdWV1ZWQnLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHN0YXJ0ZWRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGNvbXBsZXRlZF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgaGVhcnRiZWF0X2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBvdXRwdXRfdGV4dCB0ZXh0LFxuICAgICAgICBlcnJvciB0ZXh0LFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYlxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFzeW5jX2pvYnNfY3VzdG9tZXJfY3JlYXRlZF9pZHggb24gYXN5bmNfam9icyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFzeW5jX2pvYnNfc3RhdHVzX2lkeCBvbiBhc3luY19qb2JzKHN0YXR1cywgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgIFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICByZXF1ZXN0X2lkIHRleHQsXG4gICAgICAgIGxldmVsIHRleHQgbm90IG51bGwgZGVmYXVsdCAnaW5mbycsXG4gICAgICAgIGtpbmQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgZnVuY3Rpb25fbmFtZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtZXRob2QgdGV4dCxcbiAgICAgICAgcGF0aCB0ZXh0LFxuICAgICAgICBvcmlnaW4gdGV4dCxcbiAgICAgICAgcmVmZXJlciB0ZXh0LFxuICAgICAgICB1c2VyX2FnZW50IHRleHQsXG4gICAgICAgIGlwIHRleHQsXG4gICAgICAgIGFwcF9pZCB0ZXh0LFxuICAgICAgICBidWlsZF9pZCB0ZXh0LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50LFxuICAgICAgICBwcm92aWRlciB0ZXh0LFxuICAgICAgICBtb2RlbCB0ZXh0LFxuICAgICAgICBodHRwX3N0YXR1cyBpbnRlZ2VyLFxuICAgICAgICBkdXJhdGlvbl9tcyBpbnRlZ2VyLFxuICAgICAgICBlcnJvcl9jb2RlIHRleHQsXG4gICAgICAgIGVycm9yX21lc3NhZ2UgdGV4dCxcbiAgICAgICAgZXJyb3Jfc3RhY2sgdGV4dCxcbiAgICAgICAgdXBzdHJlYW1fc3RhdHVzIGludGVnZXIsXG4gICAgICAgIHVwc3RyZWFtX2JvZHkgdGV4dCxcbiAgICAgICAgZXh0cmEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG5cbiAgICAgIC8vIEZvcndhcmQtY29tcGF0aWJsZSBwYXRjaGluZzogaWYgZ2F0ZXdheV9ldmVudHMgZXhpc3RlZCBmcm9tIGFuIG9sZGVyIGJ1aWxkLFxuICAgICAgLy8gaXQgbWF5IGJlIG1pc3NpbmcgY29sdW1ucyB1c2VkIGJ5IG1vbml0b3IgaW5zZXJ0cy5cbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVxdWVzdF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxldmVsIHRleHQgbm90IG51bGwgZGVmYXVsdCAnaW5mbyc7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMga2luZCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2V2ZW50JztgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBmdW5jdGlvbl9uYW1lIHRleHQgbm90IG51bGwgZGVmYXVsdCAndW5rbm93bic7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbWV0aG9kIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcGF0aCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG9yaWdpbiB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlZmVyZXIgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyB1c2VyX2FnZW50IHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgaXAgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhcHBfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBidWlsZF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGN1c3RvbWVyX2lkIGJpZ2ludDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhcGlfa2V5X2lkIGJpZ2ludDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBwcm92aWRlciB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1vZGVsIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgaHR0cF9zdGF0dXMgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBkdXJhdGlvbl9tcyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGVycm9yX2NvZGUgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBlcnJvcl9tZXNzYWdlIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZXJyb3Jfc3RhY2sgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyB1cHN0cmVhbV9zdGF0dXMgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyB1cHN0cmVhbV9ib2R5IHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZXh0cmEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCk7YCxcblxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX2NyZWF0ZWRfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19yZXF1ZXN0X2lkeCBvbiBnYXRld2F5X2V2ZW50cyhyZXF1ZXN0X2lkKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX2xldmVsX2lkeCBvbiBnYXRld2F5X2V2ZW50cyhsZXZlbCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX2ZuX2lkeCBvbiBnYXRld2F5X2V2ZW50cyhmdW5jdGlvbl9uYW1lLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfYXBwX2lkeCBvbiBnYXRld2F5X2V2ZW50cyhhcHBfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcblxuICAgICAgLy8gLS0tIEthaXh1UHVzaCAoRGVwbG95IFB1c2gpIGVudGVycHJpc2UgdGFibGVzIC0tLVxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByb2xlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZGVwbG95ZXInO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXBpX2tleXNfcm9sZV9pZHggb24gYXBpX2tleXMocm9sZSk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcl9uZXRsaWZ5X3Rva2VucyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBwcmltYXJ5IGtleSByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHRva2VuX2VuYyB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfcHJvamVjdHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb2plY3RfaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbmFtZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBuZXRsaWZ5X3NpdGVfaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVuaXF1ZSAoY3VzdG9tZXJfaWQsIHByb2plY3RfaWQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9wcm9qZWN0c19jdXN0b21lcl9pZHggb24gcHVzaF9wcm9qZWN0cyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfcHVzaGVzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJvamVjdF9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wcm9qZWN0cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHB1c2hfaWQgdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIGJyYW5jaCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICB0aXRsZSB0ZXh0LFxuICAgICAgICBkZXBsb3lfaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc3RhdGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcmVxdWlyZWRfZGlnZXN0cyB0ZXh0W10gbm90IG51bGwgZGVmYXVsdCAne30nOjp0ZXh0W10sXG4gICAgICAgIHVwbG9hZGVkX2RpZ2VzdHMgdGV4dFtdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6dGV4dFtdLFxuICAgICAgICBmaWxlX21hbmlmZXN0IGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIHVybCB0ZXh0LFxuICAgICAgICBlcnJvciB0ZXh0LFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfcHVzaGVzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBmaWxlX21hbmlmZXN0IGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmI7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX3B1c2hlc19jdXN0b21lcl9pZHggb24gcHVzaF9wdXNoZXMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX2pvYnMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIHB1c2hfcm93X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHVzaGVzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgc2hhMSBjaGFyKDQwKSBub3QgbnVsbCxcbiAgICAgICAgZGVwbG95X3BhdGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcGFydHMgaW50ZWdlciBub3QgbnVsbCxcbiAgICAgICAgcmVjZWl2ZWRfcGFydHMgaW50ZWdlcltdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6aW50W10sXG4gICAgICAgIHBhcnRfYnl0ZXMganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgYnl0ZXNfc3RhZ2VkIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3VwbG9hZGluZycsXG4gICAgICAgIGVycm9yIHRleHQsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1bmlxdWUgKHB1c2hfcm93X2lkLCBzaGExKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfam9ic19wdXNoX2lkeCBvbiBwdXNoX2pvYnMocHVzaF9yb3dfaWQsIHVwZGF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGJ5dGVzX3N0YWdlZCBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBwYXJ0X2J5dGVzIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGF0dGVtcHRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBuZXh0X2F0dGVtcHRfYXQgdGltZXN0YW1wdHo7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxhc3RfZXJyb3IgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9lcnJvcl9hdCB0aW1lc3RhbXB0ejtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9yYXRlX3dpbmRvd3MgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBidWNrZXRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBidWNrZXRfc3RhcnQgdGltZXN0YW1wdHogbm90IG51bGwsXG4gICAgICAgIGNvdW50IGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwcmltYXJ5IGtleShjdXN0b21lcl9pZCwgYnVja2V0X3R5cGUsIGJ1Y2tldF9zdGFydClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX3JhdGVfd2luZG93c19idWNrZXRfaWR4IG9uIHB1c2hfcmF0ZV93aW5kb3dzKGJ1Y2tldF90eXBlLCBidWNrZXRfc3RhcnQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX2ZpbGVzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBwdXNoX3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3B1c2hlcyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGRlcGxveV9wYXRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHNoYTEgY2hhcig0MCkgbm90IG51bGwsXG4gICAgICAgIGJ5dGVzIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1vZGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdkaXJlY3QnLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX2ZpbGVzX3B1c2hfaWR4IG9uIHB1c2hfZmlsZXMocHVzaF9yb3dfaWQpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF91c2FnZV9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwdXNoX3Jvd19pZCBiaWdpbnQgcmVmZXJlbmNlcyBwdXNoX3B1c2hlcyhpZCkgb24gZGVsZXRlIHNldCBudWxsLFxuICAgICAgICBldmVudF90eXBlIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJ5dGVzIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHByaWNpbmdfdmVyc2lvbiBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMSxcbiAgICAgICAgY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX3VzYWdlX2N1c3RvbWVyX2lkeCBvbiBwdXNoX3VzYWdlX2V2ZW50cyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfcHJpY2luZ192ZXJzaW9ucyAoXG4gICAgICAgIHZlcnNpb24gaW50ZWdlciBwcmltYXJ5IGtleSxcbiAgICAgICAgZWZmZWN0aXZlX2Zyb20gZGF0ZSBub3QgbnVsbCBkZWZhdWx0IGN1cnJlbnRfZGF0ZSxcbiAgICAgICAgY3VycmVuY3kgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdVU0QnLFxuICAgICAgICBiYXNlX21vbnRoX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwZXJfZGVwbG95X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwZXJfZ2JfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGluc2VydCBpbnRvIHB1c2hfcHJpY2luZ192ZXJzaW9ucyh2ZXJzaW9uLCBiYXNlX21vbnRoX2NlbnRzLCBwZXJfZGVwbG95X2NlbnRzLCBwZXJfZ2JfY2VudHMpXG4gICAgICAgdmFsdWVzICgxLCAwLCAxMCwgMjUpIG9uIGNvbmZsaWN0ICh2ZXJzaW9uKSBkbyBub3RoaW5nO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfcHVzaF9iaWxsaW5nIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IHByaW1hcnkga2V5IHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJpY2luZ192ZXJzaW9uIGludGVnZXIgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3ByaWNpbmdfdmVyc2lvbnModmVyc2lvbiksXG4gICAgICAgIG1vbnRobHlfY2FwX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfaW52b2ljZXMgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBwcmljaW5nX3ZlcnNpb24gaW50ZWdlciBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHJpY2luZ192ZXJzaW9ucyh2ZXJzaW9uKSxcbiAgICAgICAgdG90YWxfY2VudHMgaW50ZWdlciBub3QgbnVsbCxcbiAgICAgICAgYnJlYWtkb3duIGpzb25iIG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcblxuICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAvLyBHaXRIdWIgUHVzaCBHYXRld2F5IChvcHRpb25hbClcbiAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVyX2dpdGh1Yl90b2tlbnMgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgcHJpbWFyeSBrZXkgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB0b2tlbl9lbmMgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgdG9rZW5fdHlwZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ29hdXRoJyxcbiAgICAgICAgc2NvcGVzIHRleHRbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OnRleHRbXSxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBnaF9wdXNoX2pvYnMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBqb2JfaWQgdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIG93bmVyIHRleHQgbm90IG51bGwsXG4gICAgICAgIHJlcG8gdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYnJhbmNoIHRleHQgbm90IG51bGwgZGVmYXVsdCAnbWFpbicsXG4gICAgICAgIGNvbW1pdF9tZXNzYWdlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnS2FpeHUgR2l0SHViIFB1c2gnLFxuICAgICAgICBwYXJ0cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcmVjZWl2ZWRfcGFydHMgaW50ZWdlcltdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6aW50W10sXG4gICAgICAgIHBhcnRfYnl0ZXMganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgYnl0ZXNfc3RhZ2VkIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3VwbG9hZGluZycsXG4gICAgICAgIGF0dGVtcHRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBuZXh0X2F0dGVtcHRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGxhc3RfZXJyb3IgdGV4dCxcbiAgICAgICAgbGFzdF9lcnJvcl9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgcmVzdWx0X2NvbW1pdF9zaGEgdGV4dCxcbiAgICAgICAgcmVzdWx0X3VybCB0ZXh0LFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdoX3B1c2hfam9ic19jdXN0b21lcl9pZHggb24gZ2hfcHVzaF9qb2JzKGN1c3RvbWVyX2lkLCB1cGRhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9qb2JzX25leHRfYXR0ZW1wdF9pZHggb24gZ2hfcHVzaF9qb2JzKG5leHRfYXR0ZW1wdF9hdCkgd2hlcmUgc3RhdHVzIGluICgncmV0cnlfd2FpdCcsJ2Vycm9yX3RyYW5zaWVudCcpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBqb2Jfcm93X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGdoX3B1c2hfam9icyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGV2ZW50X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYnl0ZXMgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnaF9wdXNoX2V2ZW50c19qb2JfaWR4IG9uIGdoX3B1c2hfZXZlbnRzKGpvYl9yb3dfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcblxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfbnVtYmVycyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcGhvbmVfbnVtYmVyIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3R3aWxpbycsXG4gICAgICAgIHR3aWxpb19zaWQgdGV4dCxcbiAgICAgICAgaXNfYWN0aXZlIGJvb2xlYW4gbm90IG51bGwgZGVmYXVsdCB0cnVlLFxuICAgICAgICBkZWZhdWx0X2xsbV9wcm92aWRlciB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ29wZW5haScsXG4gICAgICAgIGRlZmF1bHRfbGxtX21vZGVsIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZ3B0LTQuMS1taW5pJyxcbiAgICAgICAgdm9pY2VfbmFtZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2FsbG95JyxcbiAgICAgICAgbG9jYWxlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZW4tVVMnLFxuICAgICAgICB0aW1lem9uZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ0FtZXJpY2EvUGhvZW5peCcsXG4gICAgICAgIHBsYXlib29rIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX251bWJlcnNfY3VzdG9tZXJfaWR4IG9uIHZvaWNlX251bWJlcnMoY3VzdG9tZXJfaWQpO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxscyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgdm9pY2VfbnVtYmVyX2lkIGJpZ2ludCByZWZlcmVuY2VzIHZvaWNlX251bWJlcnMoaWQpIG9uIGRlbGV0ZSBzZXQgbnVsbCxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd0d2lsaW8nLFxuICAgICAgICBwcm92aWRlcl9jYWxsX3NpZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBmcm9tX251bWJlciB0ZXh0LFxuICAgICAgICB0b19udW1iZXIgdGV4dCxcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAnaW5pdGlhdGVkJyxcbiAgICAgICAgZGlyZWN0aW9uIHRleHQgbm90IG51bGwgZGVmYXVsdCAnaW5ib3VuZCcsXG4gICAgICAgIHN0YXJ0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgZW5kZWRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGR1cmF0aW9uX3NlY29uZHMgaW50ZWdlcixcbiAgICAgICAgZXN0X2Nvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGJpbGxfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHVuaXF1ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxzX3Byb3ZpZGVyX3NpZF91cSBvbiB2b2ljZV9jYWxscyhwcm92aWRlciwgcHJvdmlkZXJfY2FsbF9zaWQpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbHNfY3VzdG9tZXJfaWR4IG9uIHZvaWNlX2NhbGxzKGN1c3RvbWVyX2lkLCBzdGFydGVkX2F0IGRlc2MpO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsX21lc3NhZ2VzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjYWxsX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIHZvaWNlX2NhbGxzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcm9sZSB0ZXh0IG5vdCBudWxsLCAtLSB1c2VyfGFzc2lzdGFudHxzeXN0ZW18dG9vbFxuICAgICAgICBjb250ZW50IHRleHQgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxfbWVzc2FnZXNfY2FsbF9pZHggb24gdm9pY2VfY2FsbF9tZXNzYWdlcyhjYWxsX2lkLCBpZCk7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX3VzYWdlX21vbnRobHkgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1pbnV0ZXMgbnVtZXJpYyBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGVzdF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBiaWxsX2Nvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNhbGxzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVuaXF1ZShjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfdXNhZ2VfbW9udGhseV9jdXN0b21lcl9pZHggb24gdm9pY2VfdXNhZ2VfbW9udGhseShjdXN0b21lcl9pZCwgbW9udGgpO2AsXG5cbl07XG5cbiAgICBmb3IgKGNvbnN0IHMgb2Ygc3RhdGVtZW50cykge1xuICAgICAgYXdhaXQgc3FsLnF1ZXJ5KHMpO1xuICAgIH1cbiAgfSkoKTtcblxuICByZXR1cm4gX3NjaGVtYVByb21pc2U7XG59XG5cbi8qKlxuICogUXVlcnkgaGVscGVyIGNvbXBhdGlibGUgd2l0aCB0aGUgcHJldmlvdXMgYHBnYC1pc2ggaW50ZXJmYWNlOlxuICogLSByZXR1cm5zIHsgcm93cywgcm93Q291bnQgfVxuICogLSBzdXBwb3J0cyAkMSwgJDIgcGxhY2Vob2xkZXJzICsgcGFyYW1zIGFycmF5IHZpYSBzcWwucXVlcnkoLi4uKVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcSh0ZXh0LCBwYXJhbXMgPSBbXSkge1xuICBhd2FpdCBlbnN1cmVTY2hlbWEoKTtcbiAgY29uc3Qgc3FsID0gZ2V0U3FsKCk7XG4gIGNvbnN0IHJvd3MgPSBhd2FpdCBzcWwucXVlcnkodGV4dCwgcGFyYW1zKTtcbiAgcmV0dXJuIHsgcm93czogcm93cyB8fCBbXSwgcm93Q291bnQ6IEFycmF5LmlzQXJyYXkocm93cykgPyByb3dzLmxlbmd0aCA6IDAgfTtcbn0iLCAiaW1wb3J0IHsgcSB9IGZyb20gXCIuL2RiLmpzXCI7XG5cbmZ1bmN0aW9uIHNhZmVTdHIodiwgbWF4ID0gODAwMCkge1xuICBpZiAodiA9PSBudWxsKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgcyA9IFN0cmluZyh2KTtcbiAgaWYgKHMubGVuZ3RoIDw9IG1heCkgcmV0dXJuIHM7XG4gIHJldHVybiBzLnNsaWNlKDAsIG1heCkgKyBgXHUyMDI2KCske3MubGVuZ3RoIC0gbWF4fSBjaGFycylgO1xufVxuXG5mdW5jdGlvbiByYW5kb21JZCgpIHtcbiAgdHJ5IHtcbiAgICBpZiAoZ2xvYmFsVGhpcy5jcnlwdG8/LnJhbmRvbVVVSUQpIHJldHVybiBnbG9iYWxUaGlzLmNyeXB0by5yYW5kb21VVUlEKCk7XG4gIH0gY2F0Y2gge31cbiAgLy8gZmFsbGJhY2sgKG5vdCBSRkM0MTIyLXBlcmZlY3QsIGJ1dCB1bmlxdWUgZW5vdWdoIGZvciB0cmFjaW5nKVxuICByZXR1cm4gXCJyaWRfXCIgKyBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDE2KS5zbGljZSgyKSArIFwiX1wiICsgRGF0ZS5ub3coKS50b1N0cmluZygxNik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRSZXF1ZXN0SWQocmVxKSB7XG4gIGNvbnN0IGggPSAocmVxLmhlYWRlcnMuZ2V0KFwieC1rYWl4dS1yZXF1ZXN0LWlkXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIngtcmVxdWVzdC1pZFwiKSB8fCBcIlwiKS50cmltKCk7XG4gIHJldHVybiBoIHx8IHJhbmRvbUlkKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmZlckZ1bmN0aW9uTmFtZShyZXEpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCB1ID0gbmV3IFVSTChyZXEudXJsKTtcbiAgICBjb25zdCBtID0gdS5wYXRobmFtZS5tYXRjaCgvXFwvXFwubmV0bGlmeVxcL2Z1bmN0aW9uc1xcLyhbXlxcL10rKS9pKTtcbiAgICByZXR1cm4gbSA/IG1bMV0gOiBcInVua25vd25cIjtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFwidW5rbm93blwiO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXF1ZXN0TWV0YShyZXEpIHtcbiAgbGV0IHVybCA9IG51bGw7XG4gIHRyeSB7IHVybCA9IG5ldyBVUkwocmVxLnVybCk7IH0gY2F0Y2gge31cbiAgcmV0dXJuIHtcbiAgICBtZXRob2Q6IHJlcS5tZXRob2QgfHwgbnVsbCxcbiAgICBwYXRoOiB1cmwgPyB1cmwucGF0aG5hbWUgOiBudWxsLFxuICAgIHF1ZXJ5OiB1cmwgPyBPYmplY3QuZnJvbUVudHJpZXModXJsLnNlYXJjaFBhcmFtcy5lbnRyaWVzKCkpIDoge30sXG4gICAgb3JpZ2luOiByZXEuaGVhZGVycy5nZXQoXCJvcmlnaW5cIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiT3JpZ2luXCIpIHx8IG51bGwsXG4gICAgcmVmZXJlcjogcmVxLmhlYWRlcnMuZ2V0KFwicmVmZXJlclwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJSZWZlcmVyXCIpIHx8IG51bGwsXG4gICAgdXNlcl9hZ2VudDogcmVxLmhlYWRlcnMuZ2V0KFwidXNlci1hZ2VudFwiKSB8fCBudWxsLFxuICAgIGlwOiByZXEuaGVhZGVycy5nZXQoXCJ4LW5mLWNsaWVudC1jb25uZWN0aW9uLWlwXCIpIHx8IG51bGwsXG4gICAgYXBwX2lkOiAocmVxLmhlYWRlcnMuZ2V0KFwieC1rYWl4dS1hcHBcIikgfHwgXCJcIikudHJpbSgpIHx8IG51bGwsXG4gICAgYnVpbGRfaWQ6IChyZXEuaGVhZGVycy5nZXQoXCJ4LWthaXh1LWJ1aWxkXCIpIHx8IFwiXCIpLnRyaW0oKSB8fCBudWxsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVFcnJvcihlcnIpIHtcbiAgY29uc3QgZSA9IGVyciB8fCB7fTtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBzYWZlU3RyKGUubmFtZSwgMjAwKSxcbiAgICBtZXNzYWdlOiBzYWZlU3RyKGUubWVzc2FnZSwgNDAwMCksXG4gICAgY29kZTogc2FmZVN0cihlLmNvZGUsIDIwMCksXG4gICAgc3RhdHVzOiBOdW1iZXIuaXNGaW5pdGUoZS5zdGF0dXMpID8gZS5zdGF0dXMgOiBudWxsLFxuICAgIGhpbnQ6IHNhZmVTdHIoZS5oaW50LCAyMDAwKSxcbiAgICBzdGFjazogc2FmZVN0cihlLnN0YWNrLCAxMjAwMCksXG4gICAgdXBzdHJlYW06IGUudXBzdHJlYW0gPyB7XG4gICAgICBwcm92aWRlcjogc2FmZVN0cihlLnVwc3RyZWFtLnByb3ZpZGVyLCA1MCksXG4gICAgICBzdGF0dXM6IE51bWJlci5pc0Zpbml0ZShlLnVwc3RyZWFtLnN0YXR1cykgPyBlLnVwc3RyZWFtLnN0YXR1cyA6IG51bGwsXG4gICAgICBib2R5OiBzYWZlU3RyKGUudXBzdHJlYW0uYm9keSwgMTIwMDApLFxuICAgICAgcmVxdWVzdF9pZDogc2FmZVN0cihlLnVwc3RyZWFtLnJlcXVlc3RfaWQsIDIwMCksXG4gICAgICByZXNwb25zZV9oZWFkZXJzOiBlLnVwc3RyZWFtLnJlc3BvbnNlX2hlYWRlcnMgfHwgdW5kZWZpbmVkXG4gICAgfSA6IHVuZGVmaW5lZFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3VtbWFyaXplSnNvbkJvZHkoYm9keSkge1xuICAvLyBTYWZlIHN1bW1hcnk7IGF2b2lkcyBsb2dnaW5nIGZ1bGwgcHJvbXB0cyBieSBkZWZhdWx0LlxuICBjb25zdCBiID0gYm9keSB8fCB7fTtcbiAgY29uc3QgcHJvdmlkZXIgPSAoYi5wcm92aWRlciB8fCBcIlwiKS50b1N0cmluZygpLnRyaW0oKS50b0xvd2VyQ2FzZSgpIHx8IG51bGw7XG4gIGNvbnN0IG1vZGVsID0gKGIubW9kZWwgfHwgXCJcIikudG9TdHJpbmcoKS50cmltKCkgfHwgbnVsbDtcblxuICBsZXQgbWVzc2FnZUNvdW50ID0gbnVsbDtcbiAgbGV0IHRvdGFsQ2hhcnMgPSBudWxsO1xuICB0cnkge1xuICAgIGlmIChBcnJheS5pc0FycmF5KGIubWVzc2FnZXMpKSB7XG4gICAgICBtZXNzYWdlQ291bnQgPSBiLm1lc3NhZ2VzLmxlbmd0aDtcbiAgICAgIHRvdGFsQ2hhcnMgPSBiLm1lc3NhZ2VzLnJlZHVjZSgoYWNjLCBtKSA9PiBhY2MgKyBTdHJpbmcobT8uY29udGVudCA/PyBcIlwiKS5sZW5ndGgsIDApO1xuICAgIH1cbiAgfSBjYXRjaCB7fVxuXG4gIHJldHVybiB7XG4gICAgcHJvdmlkZXIsXG4gICAgbW9kZWwsXG4gICAgbWF4X3Rva2VuczogTnVtYmVyLmlzRmluaXRlKGIubWF4X3Rva2VucykgPyBwYXJzZUludChiLm1heF90b2tlbnMsIDEwKSA6IG51bGwsXG4gICAgdGVtcGVyYXR1cmU6IHR5cGVvZiBiLnRlbXBlcmF0dXJlID09PSBcIm51bWJlclwiID8gYi50ZW1wZXJhdHVyZSA6IG51bGwsXG4gICAgbWVzc2FnZV9jb3VudDogbWVzc2FnZUNvdW50LFxuICAgIG1lc3NhZ2VfY2hhcnM6IHRvdGFsQ2hhcnNcbiAgfTtcbn1cblxuLyoqXG4gKiBCZXN0LWVmZm9ydCBtb25pdG9yIGV2ZW50OiBmYWlsdXJlcyBuZXZlciBicmVhayB0aGUgbWFpbiByZXF1ZXN0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZW1pdEV2ZW50KGV2KSB7XG4gIHRyeSB7XG4gICAgY29uc3QgZSA9IGV2IHx8IHt9O1xuICAgIGNvbnN0IGV4dHJhID0gZS5leHRyYSB8fCB7fTtcbiAgICBhd2FpdCBxKFxuICAgICAgYGluc2VydCBpbnRvIGdhdGV3YXlfZXZlbnRzXG4gICAgICAgIChyZXF1ZXN0X2lkLCBsZXZlbCwga2luZCwgZnVuY3Rpb25fbmFtZSwgbWV0aG9kLCBwYXRoLCBvcmlnaW4sIHJlZmVyZXIsIHVzZXJfYWdlbnQsIGlwLFxuICAgICAgICAgYXBwX2lkLCBidWlsZF9pZCwgY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIHByb3ZpZGVyLCBtb2RlbCwgaHR0cF9zdGF0dXMsIGR1cmF0aW9uX21zLFxuICAgICAgICAgZXJyb3JfY29kZSwgZXJyb3JfbWVzc2FnZSwgZXJyb3Jfc3RhY2ssIHVwc3RyZWFtX3N0YXR1cywgdXBzdHJlYW1fYm9keSwgZXh0cmEpXG4gICAgICAgdmFsdWVzXG4gICAgICAgICgkMSwkMiwkMywkNCwkNSwkNiwkNywkOCwkOSwkMTAsXG4gICAgICAgICAkMTEsJDEyLCQxMywkMTQsJDE1LCQxNiwkMTcsJDE4LFxuICAgICAgICAgJDE5LCQyMCwkMjEsJDIyLCQyMywkMjQsJDI1Ojpqc29uYilgLFxuICAgICAgW1xuICAgICAgICBzYWZlU3RyKGUucmVxdWVzdF9pZCwgMjAwKSxcbiAgICAgICAgc2FmZVN0cihlLmxldmVsIHx8IFwiaW5mb1wiLCAyMCksXG4gICAgICAgIHNhZmVTdHIoZS5raW5kIHx8IFwiZXZlbnRcIiwgODApLFxuICAgICAgICBzYWZlU3RyKGUuZnVuY3Rpb25fbmFtZSB8fCBcInVua25vd25cIiwgMTIwKSxcbiAgICAgICAgc2FmZVN0cihlLm1ldGhvZCwgMjApLFxuICAgICAgICBzYWZlU3RyKGUucGF0aCwgNTAwKSxcbiAgICAgICAgc2FmZVN0cihlLm9yaWdpbiwgNTAwKSxcbiAgICAgICAgc2FmZVN0cihlLnJlZmVyZXIsIDgwMCksXG4gICAgICAgIHNhZmVTdHIoZS51c2VyX2FnZW50LCA4MDApLFxuICAgICAgICBzYWZlU3RyKGUuaXAsIDIwMCksXG5cbiAgICAgICAgc2FmZVN0cihlLmFwcF9pZCwgMjAwKSxcbiAgICAgICAgc2FmZVN0cihlLmJ1aWxkX2lkLCAyMDApLFxuICAgICAgICBOdW1iZXIuaXNGaW5pdGUoZS5jdXN0b21lcl9pZCkgPyBlLmN1c3RvbWVyX2lkIDogbnVsbCxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUuYXBpX2tleV9pZCkgPyBlLmFwaV9rZXlfaWQgOiBudWxsLFxuICAgICAgICBzYWZlU3RyKGUucHJvdmlkZXIsIDgwKSxcbiAgICAgICAgc2FmZVN0cihlLm1vZGVsLCAyMDApLFxuICAgICAgICBOdW1iZXIuaXNGaW5pdGUoZS5odHRwX3N0YXR1cykgPyBlLmh0dHBfc3RhdHVzIDogbnVsbCxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUuZHVyYXRpb25fbXMpID8gZS5kdXJhdGlvbl9tcyA6IG51bGwsXG5cbiAgICAgICAgc2FmZVN0cihlLmVycm9yX2NvZGUsIDIwMCksXG4gICAgICAgIHNhZmVTdHIoZS5lcnJvcl9tZXNzYWdlLCA0MDAwKSxcbiAgICAgICAgc2FmZVN0cihlLmVycm9yX3N0YWNrLCAxMjAwMCksXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShlLnVwc3RyZWFtX3N0YXR1cykgPyBlLnVwc3RyZWFtX3N0YXR1cyA6IG51bGwsXG4gICAgICAgIHNhZmVTdHIoZS51cHN0cmVhbV9ib2R5LCAxMjAwMCksXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KGV4dHJhIHx8IHt9KVxuICAgICAgXVxuICAgICk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zb2xlLndhcm4oXCJtb25pdG9yIGVtaXQgZmFpbGVkOlwiLCBlPy5tZXNzYWdlIHx8IGUpO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgYnVpbGRDb3JzLCBqc29uIH0gZnJvbSBcIi4vaHR0cC5qc1wiO1xuaW1wb3J0IHsgZW1pdEV2ZW50LCBnZXRSZXF1ZXN0SWQsIGluZmVyRnVuY3Rpb25OYW1lLCByZXF1ZXN0TWV0YSwgc2VyaWFsaXplRXJyb3IgfSBmcm9tIFwiLi9tb25pdG9yLmpzXCI7XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUVycm9yKGVycikge1xuICBjb25zdCBzdGF0dXMgPSBlcnI/LnN0YXR1cyB8fCA1MDA7XG4gIGNvbnN0IGNvZGUgPSBlcnI/LmNvZGUgfHwgXCJTRVJWRVJfRVJST1JcIjtcbiAgY29uc3QgbWVzc2FnZSA9IGVycj8ubWVzc2FnZSB8fCBcIlVua25vd24gZXJyb3JcIjtcbiAgY29uc3QgaGludCA9IGVycj8uaGludDtcbiAgcmV0dXJuIHsgc3RhdHVzLCBib2R5OiB7IGVycm9yOiBtZXNzYWdlLCBjb2RlLCAuLi4oaGludCA/IHsgaGludCB9IDoge30pIH0gfTtcbn1cblxuZnVuY3Rpb24gd2l0aFJlcXVlc3RJZChyZXMsIHJlcXVlc3RfaWQpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBoID0gbmV3IEhlYWRlcnMocmVzLmhlYWRlcnMgfHwge30pO1xuICAgIGguc2V0KFwieC1rYWl4dS1yZXF1ZXN0LWlkXCIsIHJlcXVlc3RfaWQpO1xuICAgIHJldHVybiBuZXcgUmVzcG9uc2UocmVzLmJvZHksIHsgc3RhdHVzOiByZXMuc3RhdHVzLCBoZWFkZXJzOiBoIH0pO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gcmVzO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNhZmVCb2R5UHJldmlldyhyZXMpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBjdCA9IChyZXMuaGVhZGVycy5nZXQoXCJjb250ZW50LXR5cGVcIikgfHwgXCJcIikudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBjbG9uZSA9IHJlcy5jbG9uZSgpO1xuICAgIGlmIChjdC5pbmNsdWRlcyhcImFwcGxpY2F0aW9uL2pzb25cIikpIHtcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBjbG9uZS5qc29uKCkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG4gICAgY29uc3QgdCA9IGF3YWl0IGNsb25lLnRleHQoKS5jYXRjaCgoKSA9PiBcIlwiKTtcbiAgICBpZiAodHlwZW9mIHQgPT09IFwic3RyaW5nXCIgJiYgdC5sZW5ndGggPiAxMjAwMCkgcmV0dXJuIHQuc2xpY2UoMCwgMTIwMDApICsgYFx1MjAyNigrJHt0Lmxlbmd0aCAtIDEyMDAwfSBjaGFycylgO1xuICAgIHJldHVybiB0O1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JhcChoYW5kbGVyKSB7XG4gIHJldHVybiBhc3luYyAocmVxLCBjb250ZXh0KSA9PiB7XG4gICAgY29uc3Qgc3RhcnQgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IGNvcnMgPSBidWlsZENvcnMocmVxKTtcbiAgICBjb25zdCByZXF1ZXN0X2lkID0gZ2V0UmVxdWVzdElkKHJlcSk7XG4gICAgY29uc3QgZnVuY3Rpb25fbmFtZSA9IGluZmVyRnVuY3Rpb25OYW1lKHJlcSk7XG4gICAgY29uc3QgbWV0YSA9IHJlcXVlc3RNZXRhKHJlcSk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzID0gYXdhaXQgaGFuZGxlcihyZXEsIGNvcnMsIGNvbnRleHQpO1xuXG4gICAgICBjb25zdCBkdXJhdGlvbl9tcyA9IERhdGUubm93KCkgLSBzdGFydDtcbiAgICAgIGNvbnN0IG91dCA9IHJlcyBpbnN0YW5jZW9mIFJlc3BvbnNlID8gd2l0aFJlcXVlc3RJZChyZXMsIHJlcXVlc3RfaWQpIDogcmVzO1xuXG4gICAgICBjb25zdCBzdGF0dXMgPSBvdXQgaW5zdGFuY2VvZiBSZXNwb25zZSA/IG91dC5zdGF0dXMgOiAyMDA7XG4gICAgICBjb25zdCBsZXZlbCA9IHN0YXR1cyA+PSA1MDAgPyBcImVycm9yXCIgOiBzdGF0dXMgPj0gNDAwID8gXCJ3YXJuXCIgOiBcImluZm9cIjtcbiAgICAgIGNvbnN0IGtpbmQgPSBzdGF0dXMgPj0gNDAwID8gXCJodHRwX2Vycm9yX3Jlc3BvbnNlXCIgOiBcImh0dHBfcmVzcG9uc2VcIjtcblxuICAgICAgbGV0IGV4dHJhID0ge307XG4gICAgICBpZiAoc3RhdHVzID49IDQwMCAmJiBvdXQgaW5zdGFuY2VvZiBSZXNwb25zZSkge1xuICAgICAgICBleHRyYS5yZXNwb25zZSA9IGF3YWl0IHNhZmVCb2R5UHJldmlldyhvdXQpO1xuICAgICAgfVxuICAgICAgaWYgKGR1cmF0aW9uX21zID49IDE1MDAwKSB7XG4gICAgICAgIGV4dHJhLnNsb3cgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCBlbWl0RXZlbnQoe1xuICAgICAgICByZXF1ZXN0X2lkLFxuICAgICAgICBsZXZlbCxcbiAgICAgICAga2luZCxcbiAgICAgICAgZnVuY3Rpb25fbmFtZSxcbiAgICAgICAgLi4ubWV0YSxcbiAgICAgICAgaHR0cF9zdGF0dXM6IHN0YXR1cyxcbiAgICAgICAgZHVyYXRpb25fbXMsXG4gICAgICAgIGV4dHJhXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIG91dDtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnN0IGR1cmF0aW9uX21zID0gRGF0ZS5ub3coKSAtIHN0YXJ0O1xuXG4gICAgICAvLyBCZXN0LWVmZm9ydCBkZXRhaWxlZCBtb25pdG9yIHJlY29yZC5cbiAgICAgIGNvbnN0IHNlciA9IHNlcmlhbGl6ZUVycm9yKGVycik7XG4gICAgICBhd2FpdCBlbWl0RXZlbnQoe1xuICAgICAgICByZXF1ZXN0X2lkLFxuICAgICAgICBsZXZlbDogXCJlcnJvclwiLFxuICAgICAgICBraW5kOiBcInRocm93bl9lcnJvclwiLFxuICAgICAgICBmdW5jdGlvbl9uYW1lLFxuICAgICAgICAuLi5tZXRhLFxuICAgICAgICBwcm92aWRlcjogc2VyPy51cHN0cmVhbT8ucHJvdmlkZXIgfHwgdW5kZWZpbmVkLFxuICAgICAgICBodHRwX3N0YXR1czogc2VyPy5zdGF0dXMgfHwgNTAwLFxuICAgICAgICBkdXJhdGlvbl9tcyxcbiAgICAgICAgZXJyb3JfY29kZTogc2VyPy5jb2RlIHx8IFwiU0VSVkVSX0VSUk9SXCIsXG4gICAgICAgIGVycm9yX21lc3NhZ2U6IHNlcj8ubWVzc2FnZSB8fCBcIlVua25vd24gZXJyb3JcIixcbiAgICAgICAgZXJyb3Jfc3RhY2s6IHNlcj8uc3RhY2sgfHwgbnVsbCxcbiAgICAgICAgdXBzdHJlYW1fc3RhdHVzOiBzZXI/LnVwc3RyZWFtPy5zdGF0dXMgfHwgbnVsbCxcbiAgICAgICAgdXBzdHJlYW1fYm9keTogc2VyPy51cHN0cmVhbT8uYm9keSB8fCBudWxsLFxuICAgICAgICBleHRyYTogeyBlcnJvcjogc2VyIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBBdm9pZCA1MDJzOiBhbHdheXMgcmV0dXJuIEpTT04uXG4gICAgICBjb25zb2xlLmVycm9yKFwiRnVuY3Rpb24gZXJyb3I6XCIsIGVycik7XG4gICAgICBjb25zdCB7IHN0YXR1cywgYm9keSB9ID0gbm9ybWFsaXplRXJyb3IoZXJyKTtcbiAgICAgIHJldHVybiBqc29uKHN0YXR1cywgeyAuLi5ib2R5LCByZXF1ZXN0X2lkIH0sIHsgLi4uY29ycywgXCJ4LWthaXh1LXJlcXVlc3QtaWRcIjogcmVxdWVzdF9pZCB9KTtcbiAgICB9XG4gIH07XG59XG4iLCAiaW1wb3J0IHsgcSB9IGZyb20gXCIuL2RiLmpzXCI7XG5cbi8qKlxuICogQmVzdC1lZmZvcnQgYXVkaXQgbG9nOiBmYWlsdXJlcyBuZXZlciBicmVhayB0aGUgbWFpbiByZXF1ZXN0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXVkaXQoYWN0b3IsIGFjdGlvbiwgdGFyZ2V0ID0gbnVsbCwgbWV0YSA9IHt9KSB7XG4gIHRyeSB7XG4gICAgYXdhaXQgcShcbiAgICAgIGBpbnNlcnQgaW50byBhdWRpdF9ldmVudHMoYWN0b3IsIGFjdGlvbiwgdGFyZ2V0LCBtZXRhKSB2YWx1ZXMgKCQxLCQyLCQzLCQ0Ojpqc29uYilgLFxuICAgICAgW2FjdG9yLCBhY3Rpb24sIHRhcmdldCwgSlNPTi5zdHJpbmdpZnkobWV0YSB8fCB7fSldXG4gICAgKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUud2FybihcImF1ZGl0IGZhaWxlZDpcIiwgZT8ubWVzc2FnZSB8fCBlKTtcbiAgfVxufVxuIiwgImltcG9ydCBjcnlwdG8gZnJvbSBcImNyeXB0b1wiO1xuXG5mdW5jdGlvbiBjb25maWdFcnJvcihtZXNzYWdlLCBoaW50KSB7XG4gIGNvbnN0IGVyciA9IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgZXJyLmNvZGUgPSBcIkNPTkZJR1wiO1xuICBlcnIuc3RhdHVzID0gNTAwO1xuICBpZiAoaGludCkgZXJyLmhpbnQgPSBoaW50O1xuICByZXR1cm4gZXJyO1xufVxuXG5mdW5jdGlvbiBiYXNlNjR1cmwoaW5wdXQpIHtcbiAgcmV0dXJuIEJ1ZmZlci5mcm9tKGlucHV0KVxuICAgIC50b1N0cmluZyhcImJhc2U2NFwiKVxuICAgIC5yZXBsYWNlKC89L2csIFwiXCIpXG4gICAgLnJlcGxhY2UoL1xcKy9nLCBcIi1cIilcbiAgICAucmVwbGFjZSgvXFwvL2csIFwiX1wiKTtcbn1cblxuZnVuY3Rpb24gdW5iYXNlNjR1cmwoaW5wdXQpIHtcbiAgY29uc3QgcyA9IFN0cmluZyhpbnB1dCB8fCBcIlwiKS5yZXBsYWNlKC8tL2csIFwiK1wiKS5yZXBsYWNlKC9fL2csIFwiL1wiKTtcbiAgY29uc3QgcGFkID0gcy5sZW5ndGggJSA0ID09PSAwID8gXCJcIiA6IFwiPVwiLnJlcGVhdCg0IC0gKHMubGVuZ3RoICUgNCkpO1xuICByZXR1cm4gQnVmZmVyLmZyb20ocyArIHBhZCwgXCJiYXNlNjRcIik7XG59XG5cbmZ1bmN0aW9uIGVuY0tleSgpIHtcbiAgLy8gUHJlZmVyIGEgZGVkaWNhdGVkIGVuY3J5cHRpb24ga2V5LiBGYWxsIGJhY2sgdG8gSldUX1NFQ1JFVCBmb3IgZHJvcC1mcmllbmRseSBpbnN0YWxscy5cbiAgY29uc3QgcmF3ID0gKHByb2Nlc3MuZW52LkRCX0VOQ1JZUFRJT05fS0VZIHx8IHByb2Nlc3MuZW52LkpXVF9TRUNSRVQgfHwgXCJcIikudG9TdHJpbmcoKTtcbiAgaWYgKCFyYXcpIHtcbiAgICB0aHJvdyBjb25maWdFcnJvcihcbiAgICAgIFwiTWlzc2luZyBEQl9FTkNSWVBUSU9OX0tFWSAob3IgSldUX1NFQ1JFVCBmYWxsYmFjaylcIixcbiAgICAgIFwiU2V0IERCX0VOQ1JZUFRJT05fS0VZIChyZWNvbW1lbmRlZCkgb3IgYXQgbWluaW11bSBKV1RfU0VDUkVUIGluIE5ldGxpZnkgZW52IHZhcnMuXCJcbiAgICApO1xuICB9XG4gIC8vIERlcml2ZSBhIHN0YWJsZSAzMi1ieXRlIGtleS5cbiAgcmV0dXJuIGNyeXB0by5jcmVhdGVIYXNoKFwic2hhMjU2XCIpLnVwZGF0ZShyYXcpLmRpZ2VzdCgpO1xufVxuXG4vKipcbiAqIEVuY3J5cHQgc21hbGwgc2VjcmV0cyBmb3IgREIgc3RvcmFnZSAoQUVTLTI1Ni1HQ00pLlxuICogRm9ybWF0OiB2MTo8aXZfYjY0dXJsPjo8dGFnX2I2NHVybD46PGNpcGhlcl9iNjR1cmw+XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmNyeXB0U2VjcmV0KHBsYWludGV4dCkge1xuICBjb25zdCBrZXkgPSBlbmNLZXkoKTtcbiAgY29uc3QgaXYgPSBjcnlwdG8ucmFuZG9tQnl0ZXMoMTIpO1xuICBjb25zdCBjaXBoZXIgPSBjcnlwdG8uY3JlYXRlQ2lwaGVyaXYoXCJhZXMtMjU2LWdjbVwiLCBrZXksIGl2KTtcbiAgY29uc3QgY3QgPSBCdWZmZXIuY29uY2F0KFtjaXBoZXIudXBkYXRlKFN0cmluZyhwbGFpbnRleHQpLCBcInV0ZjhcIiksIGNpcGhlci5maW5hbCgpXSk7XG4gIGNvbnN0IHRhZyA9IGNpcGhlci5nZXRBdXRoVGFnKCk7XG4gIHJldHVybiBgdjE6JHtiYXNlNjR1cmwoaXYpfToke2Jhc2U2NHVybCh0YWcpfToke2Jhc2U2NHVybChjdCl9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlY3J5cHRTZWNyZXQoZW5jKSB7XG4gIGNvbnN0IHMgPSBTdHJpbmcoZW5jIHx8IFwiXCIpO1xuICBpZiAoIXMuc3RhcnRzV2l0aChcInYxOlwiKSkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHBhcnRzID0gcy5zcGxpdChcIjpcIik7XG4gIGlmIChwYXJ0cy5sZW5ndGggIT09IDQpIHJldHVybiBudWxsO1xuICBjb25zdCBbLCBpdkIsIHRhZ0IsIGN0Ql0gPSBwYXJ0cztcbiAgY29uc3Qga2V5ID0gZW5jS2V5KCk7XG4gIGNvbnN0IGl2ID0gdW5iYXNlNjR1cmwoaXZCKTtcbiAgY29uc3QgdGFnID0gdW5iYXNlNjR1cmwodGFnQik7XG4gIGNvbnN0IGN0ID0gdW5iYXNlNjR1cmwoY3RCKTtcbiAgY29uc3QgZGVjaXBoZXIgPSBjcnlwdG8uY3JlYXRlRGVjaXBoZXJpdihcImFlcy0yNTYtZ2NtXCIsIGtleSwgaXYpO1xuICBkZWNpcGhlci5zZXRBdXRoVGFnKHRhZyk7XG4gIGNvbnN0IHB0ID0gQnVmZmVyLmNvbmNhdChbZGVjaXBoZXIudXBkYXRlKGN0KSwgZGVjaXBoZXIuZmluYWwoKV0pO1xuICByZXR1cm4gcHQudG9TdHJpbmcoXCJ1dGY4XCIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmFuZG9tS2V5KHByZWZpeCA9IFwia3hfbGl2ZV9cIikge1xuICBjb25zdCBieXRlcyA9IGNyeXB0by5yYW5kb21CeXRlcygzMik7XG4gIHJldHVybiBwcmVmaXggKyBiYXNlNjR1cmwoYnl0ZXMpLnNsaWNlKDAsIDQ4KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNoYTI1NkhleChpbnB1dCkge1xuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhhc2goXCJzaGEyNTZcIikudXBkYXRlKGlucHV0KS5kaWdlc3QoXCJoZXhcIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBobWFjU2hhMjU2SGV4KHNlY3JldCwgaW5wdXQpIHtcbiAgcmV0dXJuIGNyeXB0by5jcmVhdGVIbWFjKFwic2hhMjU2XCIsIHNlY3JldCkudXBkYXRlKGlucHV0KS5kaWdlc3QoXCJoZXhcIik7XG59XG5cbi8qKlxuICogS2V5IGhhc2hpbmcgc3RyYXRlZ3k6XG4gKiAtIERlZmF1bHQ6IFNIQS0yNTYoa2V5KVxuICogLSBJZiBLRVlfUEVQUEVSIGlzIHNldDogSE1BQy1TSEEyNTYoS0VZX1BFUFBFUiwga2V5KVxuICpcbiAqIElNUE9SVEFOVDogUGVwcGVyIGlzIG9wdGlvbmFsIGFuZCBjYW4gYmUgZW5hYmxlZCBsYXRlci5cbiAqIEF1dGggY29kZSB3aWxsIGF1dG8tbWlncmF0ZSBsZWdhY3kgaGFzaGVzIG9uIGZpcnN0IHN1Y2Nlc3NmdWwgbG9va3VwLlxuICovXG5leHBvcnQgZnVuY3Rpb24ga2V5SGFzaEhleChpbnB1dCkge1xuICBjb25zdCBwZXBwZXIgPSBwcm9jZXNzLmVudi5LRVlfUEVQUEVSO1xuICBpZiAocGVwcGVyKSByZXR1cm4gaG1hY1NoYTI1NkhleChwZXBwZXIsIGlucHV0KTtcbiAgcmV0dXJuIHNoYTI1NkhleChpbnB1dCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsZWdhY3lLZXlIYXNoSGV4KGlucHV0KSB7XG4gIHJldHVybiBzaGEyNTZIZXgoaW5wdXQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2lnbkp3dChwYXlsb2FkLCB0dGxTZWNvbmRzID0gMzYwMCkge1xuICBjb25zdCBzZWNyZXQgPSBwcm9jZXNzLmVudi5KV1RfU0VDUkVUO1xuICBpZiAoIXNlY3JldCkge1xuICAgIHRocm93IGNvbmZpZ0Vycm9yKFxuICAgICAgXCJNaXNzaW5nIEpXVF9TRUNSRVRcIixcbiAgICAgIFwiU2V0IEpXVF9TRUNSRVQgaW4gTmV0bGlmeSBcdTIxOTIgU2l0ZSBjb25maWd1cmF0aW9uIFx1MjE5MiBFbnZpcm9ubWVudCB2YXJpYWJsZXMgKHVzZSBhIGxvbmcgcmFuZG9tIHN0cmluZykuXCJcbiAgICApO1xuICB9XG5cbiAgY29uc3QgaGVhZGVyID0geyBhbGc6IFwiSFMyNTZcIiwgdHlwOiBcIkpXVFwiIH07XG4gIGNvbnN0IG5vdyA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApO1xuICBjb25zdCBib2R5ID0geyAuLi5wYXlsb2FkLCBpYXQ6IG5vdywgZXhwOiBub3cgKyB0dGxTZWNvbmRzIH07XG5cbiAgY29uc3QgaCA9IGJhc2U2NHVybChKU09OLnN0cmluZ2lmeShoZWFkZXIpKTtcbiAgY29uc3QgcCA9IGJhc2U2NHVybChKU09OLnN0cmluZ2lmeShib2R5KSk7XG4gIGNvbnN0IGRhdGEgPSBgJHtofS4ke3B9YDtcbiAgY29uc3Qgc2lnID0gYmFzZTY0dXJsKGNyeXB0by5jcmVhdGVIbWFjKFwic2hhMjU2XCIsIHNlY3JldCkudXBkYXRlKGRhdGEpLmRpZ2VzdCgpKTtcblxuICByZXR1cm4gYCR7ZGF0YX0uJHtzaWd9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZlcmlmeUp3dCh0b2tlbikge1xuICBjb25zdCBzZWNyZXQgPSBwcm9jZXNzLmVudi5KV1RfU0VDUkVUO1xuICBpZiAoIXNlY3JldCkge1xuICAgIHRocm93IGNvbmZpZ0Vycm9yKFxuICAgICAgXCJNaXNzaW5nIEpXVF9TRUNSRVRcIixcbiAgICAgIFwiU2V0IEpXVF9TRUNSRVQgaW4gTmV0bGlmeSBcdTIxOTIgU2l0ZSBjb25maWd1cmF0aW9uIFx1MjE5MiBFbnZpcm9ubWVudCB2YXJpYWJsZXMgKHVzZSBhIGxvbmcgcmFuZG9tIHN0cmluZykuXCJcbiAgICApO1xuICB9XG5cbiAgY29uc3QgcGFydHMgPSB0b2tlbi5zcGxpdChcIi5cIik7XG4gIGlmIChwYXJ0cy5sZW5ndGggIT09IDMpIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IFtoLCBwLCBzXSA9IHBhcnRzO1xuICBjb25zdCBkYXRhID0gYCR7aH0uJHtwfWA7XG4gIGNvbnN0IGV4cGVjdGVkID0gYmFzZTY0dXJsKGNyeXB0by5jcmVhdGVIbWFjKFwic2hhMjU2XCIsIHNlY3JldCkudXBkYXRlKGRhdGEpLmRpZ2VzdCgpKTtcblxuICB0cnkge1xuICAgIGNvbnN0IGEgPSBCdWZmZXIuZnJvbShleHBlY3RlZCk7XG4gICAgY29uc3QgYiA9IEJ1ZmZlci5mcm9tKHMpO1xuICAgIGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpIHJldHVybiBudWxsO1xuICAgIGlmICghY3J5cHRvLnRpbWluZ1NhZmVFcXVhbChhLCBiKSkgcmV0dXJuIG51bGw7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBwYXlsb2FkID0gSlNPTi5wYXJzZShcbiAgICAgIEJ1ZmZlci5mcm9tKHAucmVwbGFjZSgvLS9nLCBcIitcIikucmVwbGFjZSgvXy9nLCBcIi9cIiksIFwiYmFzZTY0XCIpLnRvU3RyaW5nKFwidXRmLThcIilcbiAgICApO1xuICAgIGNvbnN0IG5vdyA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApO1xuICAgIGlmIChwYXlsb2FkLmV4cCAmJiBub3cgPiBwYXlsb2FkLmV4cCkgcmV0dXJuIG51bGw7XG4gICAgcmV0dXJuIHBheWxvYWQ7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgcSB9IGZyb20gXCIuL2RiLmpzXCI7XG5pbXBvcnQgeyBlbmNyeXB0U2VjcmV0LCBkZWNyeXB0U2VjcmV0IH0gZnJvbSBcIi4vY3J5cHRvLmpzXCI7XG5cbi8qKlxuICogUGVyLWN1c3RvbWVyIEdpdEh1YiB0b2tlbnMgKGVudGVycHJpc2UgYm91bmRhcnkpLlxuICpcbiAqIFN0b3JlZCBlbmNyeXB0ZWQgaW4gTmV0bGlmeSBEQi5cbiAqIFByZWZlciBPQXV0aCB0b2tlbnMgKHNjb3BlZCkgYnV0IHN1cHBvcnRzIFBBVHMgYXMgd2VsbC5cbiAqL1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0R2l0SHViVG9rZW5Gb3JDdXN0b21lcihjdXN0b21lcl9pZCkge1xuICBjb25zdCByZXMgPSBhd2FpdCBxKGBzZWxlY3QgdG9rZW5fZW5jIGZyb20gY3VzdG9tZXJfZ2l0aHViX3Rva2VucyB3aGVyZSBjdXN0b21lcl9pZD0kMWAsIFtjdXN0b21lcl9pZF0pO1xuICBpZiAocmVzLnJvd3MubGVuZ3RoKSB7XG4gICAgY29uc3QgZGVjID0gZGVjcnlwdFNlY3JldChyZXMucm93c1swXS50b2tlbl9lbmMpO1xuICAgIGlmIChkZWMpIHJldHVybiBkZWM7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXRHaXRIdWJUb2tlbkZvckN1c3RvbWVyKGN1c3RvbWVyX2lkLCB0b2tlbl9wbGFpbiwgdG9rZW5fdHlwZSA9IFwib2F1dGhcIiwgc2NvcGVzID0gW10pIHtcbiAgY29uc3QgZW5jID0gZW5jcnlwdFNlY3JldCh0b2tlbl9wbGFpbik7XG4gIGNvbnN0IHNjb3Blc0FyciA9IEFycmF5LmlzQXJyYXkoc2NvcGVzKSA/IHNjb3Blcy5tYXAocyA9PiBTdHJpbmcocykudHJpbSgpKS5maWx0ZXIoQm9vbGVhbikgOiBbXTtcbiAgYXdhaXQgcShcbiAgICBgaW5zZXJ0IGludG8gY3VzdG9tZXJfZ2l0aHViX3Rva2VucyhjdXN0b21lcl9pZCwgdG9rZW5fZW5jLCB0b2tlbl90eXBlLCBzY29wZXMsIGNyZWF0ZWRfYXQsIHVwZGF0ZWRfYXQpXG4gICAgIHZhbHVlcyAoJDEsJDIsJDMsJDQsbm93KCksbm93KCkpXG4gICAgIG9uIGNvbmZsaWN0IChjdXN0b21lcl9pZClcbiAgICAgZG8gdXBkYXRlIHNldCB0b2tlbl9lbmM9ZXhjbHVkZWQudG9rZW5fZW5jLCB0b2tlbl90eXBlPWV4Y2x1ZGVkLnRva2VuX3R5cGUsIHNjb3Blcz1leGNsdWRlZC5zY29wZXMsIHVwZGF0ZWRfYXQ9bm93KClgLFxuICAgIFtjdXN0b21lcl9pZCwgZW5jLCB0b2tlbl90eXBlLCBzY29wZXNBcnJdXG4gICk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjbGVhckdpdEh1YlRva2VuRm9yQ3VzdG9tZXIoY3VzdG9tZXJfaWQpIHtcbiAgYXdhaXQgcShgZGVsZXRlIGZyb20gY3VzdG9tZXJfZ2l0aHViX3Rva2VucyB3aGVyZSBjdXN0b21lcl9pZD0kMWAsIFtjdXN0b21lcl9pZF0pO1xufVxuIiwgImltcG9ydCB7IHNsZWVwIH0gZnJvbSBcIi4vaHR0cC5qc1wiO1xuXG5mdW5jdGlvbiBiYXNlKCkge1xuICByZXR1cm4gKHByb2Nlc3MuZW52LkdJVEhVQl9BUElfQkFTRSB8fCBcImh0dHBzOi8vYXBpLmdpdGh1Yi5jb21cIikudHJpbSgpIHx8IFwiaHR0cHM6Ly9hcGkuZ2l0aHViLmNvbVwiO1xufVxuXG5mdW5jdGlvbiBhcGlWZXJzaW9uKCkge1xuICByZXR1cm4gKHByb2Nlc3MuZW52LkdJVEhVQl9BUElfVkVSU0lPTiB8fCBcIjIwMjItMTEtMjhcIikudHJpbSgpIHx8IFwiMjAyMi0xMS0yOFwiO1xufVxuXG5mdW5jdGlvbiBwYXJzZVJldHJ5QWZ0ZXIoaCkge1xuICBjb25zdCByYSA9IGguZ2V0KFwicmV0cnktYWZ0ZXJcIik7XG4gIGlmICghcmEpIHJldHVybiBudWxsO1xuICBjb25zdCBuID0gcGFyc2VJbnQocmEsIDEwKTtcbiAgcmV0dXJuIE51bWJlci5pc0Zpbml0ZShuKSAmJiBuID49IDAgPyBuIDogbnVsbDtcbn1cblxuZnVuY3Rpb24gcGFyc2VSYXRlUmVzZXRTZWNvbmRzKGgpIHtcbiAgY29uc3QgcmVzZXQgPSBoLmdldChcIngtcmF0ZWxpbWl0LXJlc2V0XCIpO1xuICBpZiAoIXJlc2V0KSByZXR1cm4gbnVsbDtcbiAgY29uc3QgbiA9IHBhcnNlSW50KHJlc2V0LCAxMCk7XG4gIGlmICghTnVtYmVyLmlzRmluaXRlKG4pIHx8IG4gPD0gMCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IG5vdyA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApO1xuICByZXR1cm4gTWF0aC5tYXgoMCwgbiAtIG5vdyk7XG59XG5cbmV4cG9ydCBjbGFzcyBHaXRIdWJBcGlFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZSwgc3RhdHVzLCBjb2RlLCBtZXRhID0ge30pIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLm5hbWUgPSBcIkdpdEh1YkFwaUVycm9yXCI7XG4gICAgdGhpcy5zdGF0dXMgPSBzdGF0dXM7XG4gICAgdGhpcy5jb2RlID0gY29kZTtcbiAgICB0aGlzLm1ldGEgPSBtZXRhO1xuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnaEZldGNoKHsgdG9rZW4sIG1ldGhvZCwgcGF0aCwgYm9keSwgYWNjZXB0ID0gXCJhcHBsaWNhdGlvbi92bmQuZ2l0aHViK2pzb25cIiwgYWxsb3dSZXRyeSA9IHRydWUgfSkge1xuICBjb25zdCB1cmwgPSBiYXNlKCkucmVwbGFjZSgvXFwvJC8sIFwiXCIpICsgcGF0aDtcbiAgY29uc3QgaGVhZGVycyA9IG5ldyBIZWFkZXJzKCk7XG4gIGhlYWRlcnMuc2V0KFwiYWNjZXB0XCIsIGFjY2VwdCk7XG4gIGhlYWRlcnMuc2V0KFwieC1naXRodWItYXBpLXZlcnNpb25cIiwgYXBpVmVyc2lvbigpKTtcbiAgaGVhZGVycy5zZXQoXCJhdXRob3JpemF0aW9uXCIsIGBCZWFyZXIgJHt0b2tlbn1gKTtcbiAgaWYgKGJvZHkgIT09IHVuZGVmaW5lZCAmJiBib2R5ICE9PSBudWxsKSBoZWFkZXJzLnNldChcImNvbnRlbnQtdHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG5cbiAgY29uc3QgbWF4QXR0ZW1wdHMgPSBhbGxvd1JldHJ5ID8gNSA6IDE7XG4gIGxldCBhdHRlbXB0ID0gMDtcblxuICB3aGlsZSAoYXR0ZW1wdCA8IG1heEF0dGVtcHRzKSB7XG4gICAgYXR0ZW1wdCsrO1xuICAgIGxldCByZXM7XG4gICAgdHJ5IHtcbiAgICAgIHJlcyA9IGF3YWl0IGZldGNoKHVybCwgeyBtZXRob2QsIGhlYWRlcnMsIGJvZHk6IGJvZHkgIT09IHVuZGVmaW5lZCAmJiBib2R5ICE9PSBudWxsID8gSlNPTi5zdHJpbmdpZnkoYm9keSkgOiB1bmRlZmluZWQgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gbmV0d29yayBlcnJvclxuICAgICAgaWYgKGF0dGVtcHQgPj0gbWF4QXR0ZW1wdHMpIHRocm93IG5ldyBHaXRIdWJBcGlFcnJvcihgR2l0SHViIG5ldHdvcmsgZXJyb3I6ICR7ZT8ubWVzc2FnZSB8fCBcInVua25vd25cIn1gLCA1MDIsIFwiR0lUSFVCX05FVFdPUktcIik7XG4gICAgICBjb25zdCBiYWNrb2ZmID0gTWF0aC5taW4oODAwMCwgNTAwICogKDIgKiogKGF0dGVtcHQgLSAxKSkpICsgTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMjUwKTtcbiAgICAgIGF3YWl0IHNsZWVwKGJhY2tvZmYpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gUmF0ZSBsaW1pdCAvIHJldHJ5IGhhbmRsaW5nXG4gICAgaWYgKHJlcy5zdGF0dXMgPT09IDQyOSB8fCByZXMuc3RhdHVzID09PSA1MDIgfHwgcmVzLnN0YXR1cyA9PT0gNTAzIHx8IHJlcy5zdGF0dXMgPT09IDUwNCkge1xuICAgICAgaWYgKGF0dGVtcHQgPj0gbWF4QXR0ZW1wdHMpIHtcbiAgICAgICAgY29uc3QgdCA9IGF3YWl0IHNhZmVUZXh0KHJlcyk7XG4gICAgICAgIHRocm93IG5ldyBHaXRIdWJBcGlFcnJvcihgR2l0SHViIHRyYW5zaWVudCBlcnJvciAoJHtyZXMuc3RhdHVzfSlgLCByZXMuc3RhdHVzLCBcIkdJVEhVQl9UUkFOU0lFTlRcIiwgeyBib2R5OiB0IH0pO1xuICAgICAgfVxuICAgICAgY29uc3QgcmEgPSBwYXJzZVJldHJ5QWZ0ZXIocmVzLmhlYWRlcnMpO1xuICAgICAgY29uc3Qgd2FpdE1zID0gKHJhICE9PSBudWxsID8gcmEgKiAxMDAwIDogTWF0aC5taW4oODAwMCwgNTAwICogKDIgKiogKGF0dGVtcHQgLSAxKSkpICsgTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMjUwKSk7XG4gICAgICBhd2FpdCBzbGVlcCh3YWl0TXMpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gR2l0SHViIHJhdGUgbGltaXQgaXMgb2Z0ZW4gYSA0MDMgd2l0aCByZW1haW5pbmc9MFxuICAgIGlmIChyZXMuc3RhdHVzID09PSA0MDMpIHtcbiAgICAgIGNvbnN0IHJlbWFpbmluZyA9IHJlcy5oZWFkZXJzLmdldChcIngtcmF0ZWxpbWl0LXJlbWFpbmluZ1wiKTtcbiAgICAgIGNvbnN0IHJlbSA9IHJlbWFpbmluZyA/IHBhcnNlSW50KHJlbWFpbmluZywgMTApIDogbnVsbDtcbiAgICAgIGlmIChyZW0gPT09IDApIHtcbiAgICAgICAgY29uc3QgcmVzZXRTZWMgPSBwYXJzZVJhdGVSZXNldFNlY29uZHMocmVzLmhlYWRlcnMpO1xuICAgICAgICBjb25zdCB0ID0gYXdhaXQgc2FmZVRleHQocmVzKTtcbiAgICAgICAgdGhyb3cgbmV3IEdpdEh1YkFwaUVycm9yKFwiR2l0SHViIHJhdGUgbGltaXQgcmVhY2hlZFwiLCA0MjksIFwiR0lUSFVCX1JBVEVfTElNSVRcIiwgeyByZXNldF9zZWNvbmRzOiByZXNldFNlYywgYm9keTogdCB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXJlcy5vaykge1xuICAgICAgY29uc3QgdCA9IGF3YWl0IHNhZmVUZXh0KHJlcyk7XG4gICAgICBsZXQgY29kZSA9IFwiR0lUSFVCX0VSUk9SXCI7XG4gICAgICBpZiAocmVzLnN0YXR1cyA9PT0gNDAxKSBjb2RlID0gXCJHSVRIVUJfVU5BVVRIT1JJWkVEXCI7XG4gICAgICBpZiAocmVzLnN0YXR1cyA9PT0gNDA0KSBjb2RlID0gXCJHSVRIVUJfTk9UX0ZPVU5EXCI7XG4gICAgICBpZiAocmVzLnN0YXR1cyA9PT0gNDA5KSBjb2RlID0gXCJHSVRIVUJfQ09ORkxJQ1RcIjtcbiAgICAgIHRocm93IG5ldyBHaXRIdWJBcGlFcnJvcihgR2l0SHViIEFQSSBlcnJvciAoJHtyZXMuc3RhdHVzfSlgLCByZXMuc3RhdHVzLCBjb2RlLCB7IGJvZHk6IHQgfSk7XG4gICAgfVxuXG4gICAgLy8gU29tZSBlbmRwb2ludHMgcmV0dXJuIDIwNFxuICAgIGlmIChyZXMuc3RhdHVzID09PSAyMDQpIHJldHVybiB7IG9rOiB0cnVlLCBzdGF0dXM6IDIwNCwgaGVhZGVyczogcmVzLmhlYWRlcnMsIGRhdGE6IG51bGwgfTtcblxuICAgIGNvbnN0IGN0ID0gKHJlcy5oZWFkZXJzLmdldChcImNvbnRlbnQtdHlwZVwiKSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpO1xuICAgIGlmIChjdC5pbmNsdWRlcyhcImFwcGxpY2F0aW9uL2pzb25cIikpIHtcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXMuanNvbigpO1xuICAgICAgcmV0dXJuIHsgb2s6IHRydWUsIHN0YXR1czogcmVzLnN0YXR1cywgaGVhZGVyczogcmVzLmhlYWRlcnMsIGRhdGEgfTtcbiAgICB9XG4gICAgY29uc3QgdGV4dCA9IGF3YWl0IHJlcy50ZXh0KCk7XG4gICAgcmV0dXJuIHsgb2s6IHRydWUsIHN0YXR1czogcmVzLnN0YXR1cywgaGVhZGVyczogcmVzLmhlYWRlcnMsIGRhdGE6IHRleHQgfTtcbiAgfVxuXG4gIHRocm93IG5ldyBHaXRIdWJBcGlFcnJvcihcIkdpdEh1YiByZXF1ZXN0IGZhaWxlZFwiLCA1MDIsIFwiR0lUSFVCX1VOS05PV05cIik7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNhZmVUZXh0KHJlcykge1xuICB0cnkgeyByZXR1cm4gYXdhaXQgcmVzLnRleHQoKTsgfSBjYXRjaCB7IHJldHVybiBcIlwiOyB9XG59XG5cbi8vIENvbnZlbmllbmNlIHdyYXBwZXJzXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2hHZXQoeyB0b2tlbiwgcGF0aCB9KSB7XG4gIHJldHVybiBnaEZldGNoKHsgdG9rZW4sIG1ldGhvZDogXCJHRVRcIiwgcGF0aCB9KTtcbn1cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnaFBvc3QoeyB0b2tlbiwgcGF0aCwgYm9keSB9KSB7XG4gIHJldHVybiBnaEZldGNoKHsgdG9rZW4sIG1ldGhvZDogXCJQT1NUXCIsIHBhdGgsIGJvZHkgfSk7XG59XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2hQYXRjaCh7IHRva2VuLCBwYXRoLCBib2R5IH0pIHtcbiAgcmV0dXJuIGdoRmV0Y2goeyB0b2tlbiwgbWV0aG9kOiBcIlBBVENIXCIsIHBhdGgsIGJvZHkgfSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7O0FBQUEsT0FBTyxRQUFRO0FBQ2YsWUFBWSxXQUFXO0FBQ3ZCLFNBQVMsZ0JBQWdCOzs7QUNGbEIsU0FBUyxVQUFVLEtBQUs7QUFDN0IsUUFBTSxZQUFZLFFBQVEsSUFBSSxtQkFBbUIsSUFBSSxLQUFLO0FBQzFELFFBQU0sWUFBWSxJQUFJLFFBQVEsSUFBSSxRQUFRLEtBQUssSUFBSSxRQUFRLElBQUksUUFBUTtBQUd2RSxRQUFNLGVBQWU7QUFDckIsUUFBTSxlQUFlO0FBRXJCLFFBQU1BLFFBQU87QUFBQSxJQUNYLGdDQUFnQztBQUFBLElBQ2hDLGdDQUFnQztBQUFBLElBQ2hDLGlDQUFpQztBQUFBLElBQ2pDLDBCQUEwQjtBQUFBLEVBQzVCO0FBS0EsTUFBSSxDQUFDLFVBQVU7QUFFYixXQUFPO0FBQUEsTUFDTCxHQUFHQTtBQUFBLE1BQ0gsR0FBSSxZQUFZLEVBQUUsTUFBTSxTQUFTLElBQUksQ0FBQztBQUFBLElBQ3hDO0FBQUEsRUFDRjtBQUVBLFFBQU0sVUFBVSxTQUFTLE1BQU0sR0FBRyxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLEVBQUUsT0FBTyxPQUFPO0FBR3ZFLE1BQUksUUFBUSxTQUFTLEdBQUcsR0FBRztBQUN6QixVQUFNLFNBQVMsYUFBYTtBQUM1QixXQUFPO0FBQUEsTUFDTCxHQUFHQTtBQUFBLE1BQ0gsK0JBQStCO0FBQUEsTUFDL0IsR0FBSSxZQUFZLEVBQUUsTUFBTSxTQUFTLElBQUksQ0FBQztBQUFBLElBQ3hDO0FBQUEsRUFDRjtBQUdBLE1BQUksYUFBYSxRQUFRLFNBQVMsU0FBUyxHQUFHO0FBQzVDLFdBQU87QUFBQSxNQUNMLEdBQUdBO0FBQUEsTUFDSCwrQkFBK0I7QUFBQSxNQUMvQixNQUFNO0FBQUEsSUFDUjtBQUFBLEVBQ0Y7QUFHQSxTQUFPO0FBQUEsSUFDTCxHQUFHQTtBQUFBLElBQ0gsR0FBSSxZQUFZLEVBQUUsTUFBTSxTQUFTLElBQUksQ0FBQztBQUFBLEVBQ3hDO0FBQ0Y7QUFHTyxTQUFTLEtBQUssUUFBUSxNQUFNLFVBQVUsQ0FBQyxHQUFHO0FBQy9DLFNBQU8sSUFBSSxTQUFTLEtBQUssVUFBVSxJQUFJLEdBQUc7QUFBQSxJQUN4QztBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsZ0JBQWdCO0FBQUEsTUFDaEIsR0FBRztBQUFBLElBQ0w7QUFBQSxFQUNGLENBQUM7QUFDSDtBQTRDTyxTQUFTLE1BQU0sSUFBSTtBQUN4QixTQUFPLElBQUksUUFBUSxDQUFDLE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQztBQUM3Qzs7O0FDN0dBLFNBQVMsWUFBWTtBQWFyQixJQUFJLE9BQU87QUFDWCxJQUFJLGlCQUFpQjtBQUVyQixTQUFTLFNBQVM7QUFDaEIsTUFBSSxLQUFNLFFBQU87QUFFakIsUUFBTSxXQUFXLENBQUMsRUFBRSxRQUFRLElBQUksd0JBQXdCLFFBQVEsSUFBSTtBQUNwRSxNQUFJLENBQUMsVUFBVTtBQUNiLFVBQU0sTUFBTSxJQUFJLE1BQU0sZ0dBQWdHO0FBQ3RILFFBQUksT0FBTztBQUNYLFFBQUksU0FBUztBQUNiLFFBQUksT0FBTztBQUNYLFVBQU07QUFBQSxFQUNSO0FBRUEsU0FBTyxLQUFLO0FBQ1osU0FBTztBQUNUO0FBRUEsZUFBZSxlQUFlO0FBQzVCLE1BQUksZUFBZ0IsUUFBTztBQUUzQixvQkFBa0IsWUFBWTtBQUM1QixVQUFNLE1BQU0sT0FBTztBQUNuQixVQUFNLGFBQWE7QUFBQSxNQUNqQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BWUE7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFXQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVdBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BUUE7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFPQTtBQUFBLE1BQTJHO0FBQUEsTUFDM0c7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BWUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUdBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQW1CQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BK0JBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BR0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU1BO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFrQkE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BT0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BU0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BWUE7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BU0E7QUFBQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU9BO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFjQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFRQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUF1QkE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQSxNQUdBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BZUE7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWlCQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFPQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BV0E7QUFBQSxJQUVOO0FBRUksZUFBVyxLQUFLLFlBQVk7QUFDMUIsWUFBTSxJQUFJLE1BQU0sQ0FBQztBQUFBLElBQ25CO0FBQUEsRUFDRixHQUFHO0FBRUgsU0FBTztBQUNUO0FBT0EsZUFBc0Is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
