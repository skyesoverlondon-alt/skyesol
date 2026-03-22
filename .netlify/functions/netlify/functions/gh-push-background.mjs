
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
