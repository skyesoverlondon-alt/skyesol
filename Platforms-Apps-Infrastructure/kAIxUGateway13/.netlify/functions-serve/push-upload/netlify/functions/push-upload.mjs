
import {createRequire as ___nfyCreateRequire} from "module";
import {fileURLToPath as ___nfyFileURLToPath} from "url";
import {dirname as ___nfyPathDirname} from "path";
let __filename=___nfyFileURLToPath(import.meta.url);
let __dirname=___nfyPathDirname(___nfyFileURLToPath(import.meta.url));
let require=___nfyCreateRequire(import.meta.url);


// netlify/functions/push-upload.js
import crypto2 from "crypto";

// netlify/functions/_lib/http.js
function buildCors(req) {
  const allowRaw = (process.env.ALLOWED_ORIGINS || "").trim();
  const reqOrigin = req.headers.get("origin") || req.headers.get("Origin");
  const allowHeaders = "authorization, content-type, x-kaixu-install-id, x-kaixu-request-id, x-kaixu-app, x-kaixu-build, x-admin-password, x-kaixu-error-token, x-kaixu-mode, x-content-sha1, x-setup-secret, x-kaixu-job-secret, x-job-worker-secret";
  const allowMethods = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
  const base = {
    "access-control-allow-headers": allowHeaders,
    "access-control-allow-methods": allowMethods,
    "access-control-expose-headers": "x-kaixu-request-id",
    "access-control-max-age": "86400"
  };
  if (!allowRaw) {
    return {
      ...base,
      ...reqOrigin ? { vary: "Origin" } : {}
    };
  }
  const allowed = allowRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.includes("*")) {
    const origin = reqOrigin || "*";
    return {
      ...base,
      "access-control-allow-origin": origin,
      ...reqOrigin ? { vary: "Origin" } : {}
    };
  }
  if (reqOrigin && allowed.includes(reqOrigin)) {
    return {
      ...base,
      "access-control-allow-origin": reqOrigin,
      vary: "Origin"
    };
  }
  return {
    ...base,
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
function badRequest(message, headers = {}) {
  return json(400, { error: message }, headers);
}
function getBearer(req) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}
function monthKeyUTC(d = /* @__PURE__ */ new Date()) {
  return d.toISOString().slice(0, 7);
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
var ROLE_ORDER = ["viewer", "deployer", "admin", "owner"];
function roleAtLeast(actual, required) {
  const a = ROLE_ORDER.indexOf((actual || "deployer").toLowerCase());
  const r = ROLE_ORDER.indexOf((required || "deployer").toLowerCase());
  return a >= r && a !== -1 && r !== -1;
}
function requireKeyRole(keyRow, requiredRole) {
  const actual = (keyRow?.role || "deployer").toLowerCase();
  if (!roleAtLeast(actual, requiredRole)) {
    const err = new Error("Forbidden");
    err.status = 403;
    err.code = "FORBIDDEN";
    err.hint = `Requires role '${requiredRole}', but key role is '${actual}'.`;
    throw err;
  }
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

// netlify/functions/_lib/netlifyTokens.js
async function getNetlifyTokenForCustomer(customer_id) {
  const res = await q(`select token_enc from customer_netlify_tokens where customer_id=$1`, [customer_id]);
  if (res.rows.length) {
    const dec = decryptSecret(res.rows[0].token_enc);
    if (dec) return dec;
  }
  return (process.env.NETLIFY_AUTH_TOKEN || "").trim() || null;
}

// netlify/functions/_lib/pushPathNormalize.js
function normalizePath(input) {
  let p = String(input || "").trim();
  p = p.replace(/\\/g, "/");
  if (p.includes("#") || p.includes("?")) {
    const err = new Error("File paths must not include '#' or '?'");
    err.code = "BAD_PATH";
    err.status = 400;
    throw err;
  }
  if (!p.startsWith("/")) p = "/" + p;
  p = "/" + p.slice(1).replace(/\/{2,}/g, "/");
  if (/[\x00-\x1F\x7F]/.test(p)) {
    const err = new Error("File path contains control characters");
    err.code = "BAD_PATH";
    err.status = 400;
    throw err;
  }
  if (p.length > 1 && p.endsWith("/")) {
    const err = new Error("File path must not end with '/'");
    err.code = "BAD_PATH";
    err.status = 400;
    throw err;
  }
  const segs = p.split("/");
  for (const seg of segs) {
    if (seg === ".." || seg === ".") {
      const err = new Error("File path must not include '.' or '..' segments");
      err.code = "BAD_PATH";
      err.status = 400;
      throw err;
    }
    if (/[<>:"|*]/.test(seg)) {
      const err = new Error("File path contains invalid characters");
      err.code = "BAD_PATH";
      err.status = 400;
      throw err;
    }
  }
  if (p.length > 1024) {
    const err = new Error("File path too long");
    err.code = "BAD_PATH";
    err.status = 400;
    throw err;
  }
  return p;
}

// netlify/functions/_lib/pushPath.js
function encodeURIComponentSafePath(pathWithLeadingSlash) {
  const p = normalizePath(pathWithLeadingSlash);
  const parts = p.slice(1).split("/").map((seg) => encodeURIComponent(seg));
  return parts.join("/");
}

// netlify/functions/_lib/pushNetlify.js
var API = "https://api.netlify.com/api/v1";
function token(netlify_token) {
  const t = (netlify_token || process.env.NETLIFY_AUTH_TOKEN || "").toString().trim();
  if (!t) {
    const err = new Error("Missing Netlify token");
    err.code = "CONFIG";
    err.status = 500;
    err.hint = "Set a per-customer Netlify token (recommended) or set NETLIFY_AUTH_TOKEN in Netlify env vars.";
    throw err;
  }
  return t;
}
async function nfFetch(url, init = {}, netlify_token = null) {
  const method = ((init.method || "GET") + "").toUpperCase();
  const body = init.body;
  const isWebReadableStream = body && typeof body === "object" && typeof body.getReader === "function";
  const isBuffer = typeof Buffer !== "undefined" && Buffer.isBuffer(body);
  const isUint8 = body instanceof Uint8Array;
  const isArrayBuffer = body instanceof ArrayBuffer;
  const isString = typeof body === "string";
  const canReplayBody = !body || isBuffer || isUint8 || isArrayBuffer || isString;
  const canRetry = (method === "GET" || method === "HEAD" || method === "PUT" && canReplayBody) && !isWebReadableStream;
  const maxAttempts = canRetry ? 5 : 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const headers = {
      authorization: `Bearer ${token(netlify_token)}`,
      ...init.headers || {}
    };
    let res;
    let text = "";
    let data = null;
    try {
      res = await fetch(url, { ...init, headers });
      text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
      }
    } catch (e) {
      if (canRetry && attempt < maxAttempts) {
        const backoff = Math.min(8e3, 250 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 150));
        await sleep(backoff);
        continue;
      }
      const err2 = new Error("Netlify API fetch failed");
      err2.code = "NETLIFY_FETCH";
      err2.status = 502;
      err2.detail = String(e && e.message ? e.message : e);
      throw err2;
    }
    if (res.ok) return data ?? text;
    const status = res.status;
    const retryable = status === 429 || status === 502 || status === 503 || status === 504;
    if (canRetry && retryable && attempt < maxAttempts) {
      const ra = res.headers.get("retry-after");
      let waitMs = 0;
      const sec = ra ? parseInt(ra, 10) : NaN;
      if (Number.isFinite(sec) && sec >= 0) waitMs = Math.min(15e3, sec * 1e3);
      if (!waitMs) waitMs = Math.min(15e3, 300 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200));
      await sleep(waitMs);
      continue;
    }
    const err = new Error(`Netlify API error ${status}`);
    err.code = "NETLIFY_API";
    err.status = status;
    err.detail = data || text;
    throw err;
  }
}
async function putDeployFile({ deploy_id, deploy_path, body, netlify_token = null }) {
  const encoded = encodeURIComponentSafePath(deploy_path);
  const url = `${API}/deploys/${encodeURIComponent(deploy_id)}/files/${encoded}`;
  return nfFetch(url, {
    method: "PUT",
    headers: { "content-type": "application/octet-stream" },
    body,
    duplex: "half"
  }, netlify_token);
}

// netlify/functions/_lib/pushCaps.js
function monthRangeUTC(month) {
  const [y, m] = String(month || "").split("-").map((x) => parseInt(x, 10));
  if (!y || !m || m < 1 || m > 12) return null;
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { start, end };
}
async function getPushPricing(customer_id) {
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
async function enforcePushCap({ customer_id, month, extra_deploys = 0, extra_bytes = 0 }) {
  const range = monthRangeUTC(month);
  if (!range) {
    const err = new Error("Invalid month (YYYY-MM)");
    err.code = "BAD_MONTH";
    err.status = 400;
    throw err;
  }
  const cfg = await getPushPricing(customer_id);
  if (!cfg) return { ok: true, cfg: null };
  const cap = Number(cfg.monthly_cap_cents || 0);
  if (!cap || cap <= 0) return { ok: true, cfg };
  const usage = await getPushUsage(customer_id, range);
  const staged = await getStagedBytes(customer_id, range);
  const deploys_init = Number(usage.deploys_init || 0);
  const deploys_ready = Number(usage.deploys_ready || 0);
  const deploys_reserved = Math.max(0, deploys_init - deploys_ready);
  const deploys_used = deploys_ready + deploys_reserved + Number(extra_deploys || 0);
  const bytes_total = Number(usage.bytes_uploaded || 0) + Number(staged || 0) + Number(extra_bytes || 0);
  const gb = bytes_total / 1073741824;
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

// netlify/functions/push-upload.js
function sha1Hex(buf) {
  return crypto2.createHash("sha1").update(buf).digest("hex");
}
var push_upload_default = wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "PUT") return json(405, { error: "Method not allowed" }, cors);
  const key = getBearer(req);
  if (!key) return json(401, { error: "Missing Authorization Bearer Kaixu Key" }, cors);
  const krow = await lookupKey(key);
  if (!krow) return json(401, { error: "Invalid Kaixu Key" }, cors);
  requireKeyRole(krow, "deployer");
  const netlify_token = await getNetlifyTokenForCustomer(krow.customer_id);
  const url = new URL(req.url);
  const pushId = (url.searchParams.get("pushId") || "").toString();
  const path = (url.searchParams.get("path") || "").toString();
  if (!pushId) return badRequest("Missing pushId", cors);
  if (!path) return badRequest("Missing path", cors);
  const deploy_path = normalizePath(path);
  const sha1Header = (req.headers.get("x-content-sha1") || "").trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(sha1Header)) return badRequest("Missing/invalid X-Content-Sha1", cors);
  const pres = await q(
    `select id, customer_id, api_key_id, deploy_id, required_digests, uploaded_digests, file_manifest
     from push_pushes where push_id=$1 limit 1`,
    [pushId]
  );
  if (!pres.rowCount) return json(404, { error: "Push not found" }, cors);
  const push = pres.rows[0];
  if (push.customer_id !== krow.customer_id) return json(403, { error: "Forbidden" }, cors);
  const ab = await req.arrayBuffer();
  const buf = Buffer.from(ab);
  const computed = sha1Hex(buf);
  if (computed !== sha1Header) {
    return json(400, { error: "SHA1 mismatch", expected: sha1Header, got: computed }, cors);
  }
  let manifest = push.file_manifest;
  if (typeof manifest === "string") {
    try {
      manifest = JSON.parse(manifest);
    } catch {
      manifest = {};
    }
  }
  if (!manifest || typeof manifest !== "object") manifest = {};
  const expected = manifest[deploy_path] || null;
  if (!expected) {
    return json(409, { error: "Path not in manifest for this push", code: "PATH_NOT_IN_MANIFEST", path: deploy_path }, cors);
  }
  if (expected !== sha1Header) {
    return json(409, { error: "SHA1 does not match manifest for path", code: "SHA1_NOT_MATCHING_MANIFEST", path: deploy_path, expected, got: sha1Header }, cors);
  }
  const required = Array.isArray(push.required_digests) ? push.required_digests : [];
  if (!required.includes(sha1Header)) {
    return json(409, { error: "File not required by deploy (digest not in required list)", code: "NOT_REQUIRED", sha1: sha1Header, path: deploy_path }, cors);
  }
  if (Array.isArray(push.uploaded_digests) && push.uploaded_digests.includes(sha1Header)) {
    return json(200, { ok: true, skipped: true, reason: "already_uploaded", pushId, path: deploy_path, sha1: sha1Header }, cors);
  }
  const month = monthKeyUTC();
  let capInfo = null;
  try {
    capInfo = await enforcePushCap({ customer_id: krow.customer_id, month, extra_deploys: 0, extra_bytes: buf.length });
  } catch (e) {
    if (e?.code === "PUSH_CAP_REACHED") return json(402, e.payload || { error: e.message, code: e.code }, cors);
    throw e;
  }
  await putDeployFile({ deploy_id: push.deploy_id, deploy_path, body: buf, netlify_token });
  await q(
    `insert into push_files(push_row_id, deploy_path, sha1, bytes, mode) values ($1,$2,$3,$4,'direct')`,
    [push.id, deploy_path, computed, buf.length]
  );
  await q(
    `insert into push_usage_events(customer_id, api_key_id, push_row_id, event_type, bytes, pricing_version, cost_cents, meta)
     values ($1,$2,$3,'file_upload',$4,$6,0,$5::jsonb)`,
    [krow.customer_id, krow.api_key_id, push.id, buf.length, JSON.stringify({ sha1: computed, path: deploy_path, mode: "direct" }), capInfo?.cfg?.pricing_version ?? 1]
  );
  await q(
    `update push_pushes
     set uploaded_digests = case when not (uploaded_digests @> array[$2]) then array_append(uploaded_digests, $2) else uploaded_digests end,
         updated_at = now()
     where id=$1`,
    [push.id, computed]
  );
  await audit(`key:${krow.key_last4}`, "PUSH_FILE_UPLOAD", `push:${pushId}`, { sha1: computed, path: deploy_path, bytes: buf.length, mode: "direct" });
  return json(200, { ok: true, pushId, path: deploy_path, sha1: computed, bytes: buf.length }, cors);
});
export {
  push_upload_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibmV0bGlmeS9mdW5jdGlvbnMvcHVzaC11cGxvYWQuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9odHRwLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvZGIuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9tb25pdG9yLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvd3JhcC5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2NyeXB0by5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2F1dGh6LmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvYXVkaXQuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9uZXRsaWZ5VG9rZW5zLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvcHVzaFBhdGhOb3JtYWxpemUuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9wdXNoUGF0aC5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL3B1c2hOZXRsaWZ5LmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvcHVzaENhcHMuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCBjcnlwdG8gZnJvbSBcImNyeXB0b1wiO1xuaW1wb3J0IHsgd3JhcCB9IGZyb20gXCIuL19saWIvd3JhcC5qc1wiO1xuaW1wb3J0IHsgYnVpbGRDb3JzLCBqc29uLCBiYWRSZXF1ZXN0LCBnZXRCZWFyZXIsIG1vbnRoS2V5VVRDIH0gZnJvbSBcIi4vX2xpYi9odHRwLmpzXCI7XG5pbXBvcnQgeyBxIH0gZnJvbSBcIi4vX2xpYi9kYi5qc1wiO1xuaW1wb3J0IHsgbG9va3VwS2V5LCByZXF1aXJlS2V5Um9sZSB9IGZyb20gXCIuL19saWIvYXV0aHouanNcIjtcbmltcG9ydCB7IGF1ZGl0IH0gZnJvbSBcIi4vX2xpYi9hdWRpdC5qc1wiO1xuaW1wb3J0IHsgZ2V0TmV0bGlmeVRva2VuRm9yQ3VzdG9tZXIgfSBmcm9tIFwiLi9fbGliL25ldGxpZnlUb2tlbnMuanNcIjtcbmltcG9ydCB7IHB1dERlcGxveUZpbGUgfSBmcm9tIFwiLi9fbGliL3B1c2hOZXRsaWZ5LmpzXCI7XG5pbXBvcnQgeyBub3JtYWxpemVQYXRoIH0gZnJvbSBcIi4vX2xpYi9wdXNoUGF0aE5vcm1hbGl6ZS5qc1wiO1xuaW1wb3J0IHsgZW5mb3JjZVB1c2hDYXAgfSBmcm9tIFwiLi9fbGliL3B1c2hDYXBzLmpzXCI7XG5cbmZ1bmN0aW9uIHNoYTFIZXgoYnVmKSB7XG4gIHJldHVybiBjcnlwdG8uY3JlYXRlSGFzaChcInNoYTFcIikudXBkYXRlKGJ1ZikuZGlnZXN0KFwiaGV4XCIpO1xufVxuXG5leHBvcnQgZGVmYXVsdCB3cmFwKGFzeW5jIChyZXEpID0+IHtcbiAgY29uc3QgY29ycyA9IGJ1aWxkQ29ycyhyZXEpO1xuICBpZiAocmVxLm1ldGhvZCA9PT0gXCJPUFRJT05TXCIpIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwNCwgaGVhZGVyczogY29ycyB9KTtcbiAgaWYgKHJlcS5tZXRob2QgIT09IFwiUFVUXCIpIHJldHVybiBqc29uKDQwNSwgeyBlcnJvcjogXCJNZXRob2Qgbm90IGFsbG93ZWRcIiB9LCBjb3JzKTtcblxuICBjb25zdCBrZXkgPSBnZXRCZWFyZXIocmVxKTtcbiAgaWYgKCFrZXkpIHJldHVybiBqc29uKDQwMSwgeyBlcnJvcjogXCJNaXNzaW5nIEF1dGhvcml6YXRpb24gQmVhcmVyIEthaXh1IEtleVwiIH0sIGNvcnMpO1xuXG4gIGNvbnN0IGtyb3cgPSBhd2FpdCBsb29rdXBLZXkoa2V5KTtcbiAgaWYgKCFrcm93KSByZXR1cm4ganNvbig0MDEsIHsgZXJyb3I6IFwiSW52YWxpZCBLYWl4dSBLZXlcIiB9LCBjb3JzKTtcblxuICByZXF1aXJlS2V5Um9sZShrcm93LCBcImRlcGxveWVyXCIpO1xuXG4gIGNvbnN0IG5ldGxpZnlfdG9rZW4gPSBhd2FpdCBnZXROZXRsaWZ5VG9rZW5Gb3JDdXN0b21lcihrcm93LmN1c3RvbWVyX2lkKTtcblxuICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcS51cmwpO1xuICBjb25zdCBwdXNoSWQgPSAodXJsLnNlYXJjaFBhcmFtcy5nZXQoXCJwdXNoSWRcIikgfHwgXCJcIikudG9TdHJpbmcoKTtcbiAgY29uc3QgcGF0aCA9ICh1cmwuc2VhcmNoUGFyYW1zLmdldChcInBhdGhcIikgfHwgXCJcIikudG9TdHJpbmcoKTtcblxuICBpZiAoIXB1c2hJZCkgcmV0dXJuIGJhZFJlcXVlc3QoXCJNaXNzaW5nIHB1c2hJZFwiLCBjb3JzKTtcbiAgaWYgKCFwYXRoKSByZXR1cm4gYmFkUmVxdWVzdChcIk1pc3NpbmcgcGF0aFwiLCBjb3JzKTtcblxuICBjb25zdCBkZXBsb3lfcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG5cbiAgY29uc3Qgc2hhMUhlYWRlciA9IChyZXEuaGVhZGVycy5nZXQoXCJ4LWNvbnRlbnQtc2hhMVwiKSB8fCBcIlwiKS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgaWYgKCEvXlthLWYwLTldezQwfSQvLnRlc3Qoc2hhMUhlYWRlcikpIHJldHVybiBiYWRSZXF1ZXN0KFwiTWlzc2luZy9pbnZhbGlkIFgtQ29udGVudC1TaGExXCIsIGNvcnMpO1xuXG4gIGNvbnN0IHByZXMgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3QgaWQsIGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCBkZXBsb3lfaWQsIHJlcXVpcmVkX2RpZ2VzdHMsIHVwbG9hZGVkX2RpZ2VzdHMsIGZpbGVfbWFuaWZlc3RcbiAgICAgZnJvbSBwdXNoX3B1c2hlcyB3aGVyZSBwdXNoX2lkPSQxIGxpbWl0IDFgLFxuICAgIFtwdXNoSWRdXG4gICk7XG4gIGlmICghcHJlcy5yb3dDb3VudCkgcmV0dXJuIGpzb24oNDA0LCB7IGVycm9yOiBcIlB1c2ggbm90IGZvdW5kXCIgfSwgY29ycyk7XG4gIGNvbnN0IHB1c2ggPSBwcmVzLnJvd3NbMF07XG4gIGlmIChwdXNoLmN1c3RvbWVyX2lkICE9PSBrcm93LmN1c3RvbWVyX2lkKSByZXR1cm4ganNvbig0MDMsIHsgZXJyb3I6IFwiRm9yYmlkZGVuXCIgfSwgY29ycyk7XG5cbiAgY29uc3QgYWIgPSBhd2FpdCByZXEuYXJyYXlCdWZmZXIoKTtcbiAgY29uc3QgYnVmID0gQnVmZmVyLmZyb20oYWIpO1xuICBjb25zdCBjb21wdXRlZCA9IHNoYTFIZXgoYnVmKTtcblxuICBpZiAoY29tcHV0ZWQgIT09IHNoYTFIZWFkZXIpIHtcbiAgICByZXR1cm4ganNvbig0MDAsIHsgZXJyb3I6IFwiU0hBMSBtaXNtYXRjaFwiLCBleHBlY3RlZDogc2hhMUhlYWRlciwgZ290OiBjb21wdXRlZCB9LCBjb3JzKTtcbiAgfVxuXG4gIGxldCBtYW5pZmVzdCA9IHB1c2guZmlsZV9tYW5pZmVzdDtcbiAgaWYgKHR5cGVvZiBtYW5pZmVzdCA9PT0gXCJzdHJpbmdcIikge1xuICAgIHRyeSB7IG1hbmlmZXN0ID0gSlNPTi5wYXJzZShtYW5pZmVzdCk7IH0gY2F0Y2ggeyBtYW5pZmVzdCA9IHt9OyB9XG4gIH1cbiAgaWYgKCFtYW5pZmVzdCB8fCB0eXBlb2YgbWFuaWZlc3QgIT09IFwib2JqZWN0XCIpIG1hbmlmZXN0ID0ge307XG4gIGNvbnN0IGV4cGVjdGVkID0gbWFuaWZlc3RbZGVwbG95X3BhdGhdIHx8IG51bGw7XG4gIGlmICghZXhwZWN0ZWQpIHtcbiAgICByZXR1cm4ganNvbig0MDksIHsgZXJyb3I6IFwiUGF0aCBub3QgaW4gbWFuaWZlc3QgZm9yIHRoaXMgcHVzaFwiLCBjb2RlOiBcIlBBVEhfTk9UX0lOX01BTklGRVNUXCIsIHBhdGg6IGRlcGxveV9wYXRoIH0sIGNvcnMpO1xuICB9XG4gIGlmIChleHBlY3RlZCAhPT0gc2hhMUhlYWRlcikge1xuICAgIHJldHVybiBqc29uKDQwOSwgeyBlcnJvcjogXCJTSEExIGRvZXMgbm90IG1hdGNoIG1hbmlmZXN0IGZvciBwYXRoXCIsIGNvZGU6IFwiU0hBMV9OT1RfTUFUQ0hJTkdfTUFOSUZFU1RcIiwgcGF0aDogZGVwbG95X3BhdGgsIGV4cGVjdGVkLCBnb3Q6IHNoYTFIZWFkZXIgfSwgY29ycyk7XG4gIH1cbiAgY29uc3QgcmVxdWlyZWQgPSBBcnJheS5pc0FycmF5KHB1c2gucmVxdWlyZWRfZGlnZXN0cykgPyBwdXNoLnJlcXVpcmVkX2RpZ2VzdHMgOiBbXTtcbiAgaWYgKCFyZXF1aXJlZC5pbmNsdWRlcyhzaGExSGVhZGVyKSkge1xuICAgIHJldHVybiBqc29uKDQwOSwgeyBlcnJvcjogXCJGaWxlIG5vdCByZXF1aXJlZCBieSBkZXBsb3kgKGRpZ2VzdCBub3QgaW4gcmVxdWlyZWQgbGlzdClcIiwgY29kZTogXCJOT1RfUkVRVUlSRURcIiwgc2hhMTogc2hhMUhlYWRlciwgcGF0aDogZGVwbG95X3BhdGggfSwgY29ycyk7XG4gIH1cbiAgaWYgKEFycmF5LmlzQXJyYXkocHVzaC51cGxvYWRlZF9kaWdlc3RzKSAmJiBwdXNoLnVwbG9hZGVkX2RpZ2VzdHMuaW5jbHVkZXMoc2hhMUhlYWRlcikpIHtcbiAgICByZXR1cm4ganNvbigyMDAsIHsgb2s6IHRydWUsIHNraXBwZWQ6IHRydWUsIHJlYXNvbjogXCJhbHJlYWR5X3VwbG9hZGVkXCIsIHB1c2hJZCwgcGF0aDogZGVwbG95X3BhdGgsIHNoYTE6IHNoYTFIZWFkZXIgfSwgY29ycyk7XG4gIH1cblxuICBjb25zdCBtb250aCA9IG1vbnRoS2V5VVRDKCk7XG4gIGxldCBjYXBJbmZvID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBjYXBJbmZvID0gYXdhaXQgZW5mb3JjZVB1c2hDYXAoeyBjdXN0b21lcl9pZDoga3Jvdy5jdXN0b21lcl9pZCwgbW9udGgsIGV4dHJhX2RlcGxveXM6IDAsIGV4dHJhX2J5dGVzOiBidWYubGVuZ3RoIH0pO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKGU/LmNvZGUgPT09IFwiUFVTSF9DQVBfUkVBQ0hFRFwiKSByZXR1cm4ganNvbig0MDIsIGUucGF5bG9hZCB8fCB7IGVycm9yOiBlLm1lc3NhZ2UsIGNvZGU6IGUuY29kZSB9LCBjb3JzKTtcbiAgICB0aHJvdyBlO1xuICB9XG5cbiAgYXdhaXQgcHV0RGVwbG95RmlsZSh7IGRlcGxveV9pZDogcHVzaC5kZXBsb3lfaWQsIGRlcGxveV9wYXRoLCBib2R5OiBidWYsIG5ldGxpZnlfdG9rZW4gfSk7XG5cbiAgLy8gcmVjb3JkIGZpbGVcbiAgYXdhaXQgcShcbiAgICBgaW5zZXJ0IGludG8gcHVzaF9maWxlcyhwdXNoX3Jvd19pZCwgZGVwbG95X3BhdGgsIHNoYTEsIGJ5dGVzLCBtb2RlKSB2YWx1ZXMgKCQxLCQyLCQzLCQ0LCdkaXJlY3QnKWAsXG4gICAgW3B1c2guaWQsIGRlcGxveV9wYXRoLCBjb21wdXRlZCwgYnVmLmxlbmd0aF1cbiAgKTtcblxuICAvLyB1c2FnZSBldmVudFxuICBhd2FpdCBxKFxuICAgIGBpbnNlcnQgaW50byBwdXNoX3VzYWdlX2V2ZW50cyhjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgcHVzaF9yb3dfaWQsIGV2ZW50X3R5cGUsIGJ5dGVzLCBwcmljaW5nX3ZlcnNpb24sIGNvc3RfY2VudHMsIG1ldGEpXG4gICAgIHZhbHVlcyAoJDEsJDIsJDMsJ2ZpbGVfdXBsb2FkJywkNCwkNiwwLCQ1Ojpqc29uYilgLFxuICAgIFtrcm93LmN1c3RvbWVyX2lkLCBrcm93LmFwaV9rZXlfaWQsIHB1c2guaWQsIGJ1Zi5sZW5ndGgsIEpTT04uc3RyaW5naWZ5KHsgc2hhMTogY29tcHV0ZWQsIHBhdGg6IGRlcGxveV9wYXRoLCBtb2RlOiBcImRpcmVjdFwiIH0pLCAoY2FwSW5mbz8uY2ZnPy5wcmljaW5nX3ZlcnNpb24gPz8gMSldXG4gICk7XG5cbiAgLy8gYXBwZW5kIGRpZ2VzdCBpZiBub3QgcHJlc2VudFxuICBhd2FpdCBxKFxuICAgIGB1cGRhdGUgcHVzaF9wdXNoZXNcbiAgICAgc2V0IHVwbG9hZGVkX2RpZ2VzdHMgPSBjYXNlIHdoZW4gbm90ICh1cGxvYWRlZF9kaWdlc3RzIEA+IGFycmF5WyQyXSkgdGhlbiBhcnJheV9hcHBlbmQodXBsb2FkZWRfZGlnZXN0cywgJDIpIGVsc2UgdXBsb2FkZWRfZGlnZXN0cyBlbmQsXG4gICAgICAgICB1cGRhdGVkX2F0ID0gbm93KClcbiAgICAgd2hlcmUgaWQ9JDFgLFxuICAgIFtwdXNoLmlkLCBjb21wdXRlZF1cbiAgKTtcblxuICBhd2FpdCBhdWRpdChga2V5OiR7a3Jvdy5rZXlfbGFzdDR9YCwgXCJQVVNIX0ZJTEVfVVBMT0FEXCIsIGBwdXNoOiR7cHVzaElkfWAsIHsgc2hhMTogY29tcHV0ZWQsIHBhdGg6IGRlcGxveV9wYXRoLCBieXRlczogYnVmLmxlbmd0aCwgbW9kZTogXCJkaXJlY3RcIiB9KTtcblxuICByZXR1cm4ganNvbigyMDAsIHsgb2s6IHRydWUsIHB1c2hJZCwgcGF0aDogZGVwbG95X3BhdGgsIHNoYTE6IGNvbXB1dGVkLCBieXRlczogYnVmLmxlbmd0aCB9LCBjb3JzKTtcbn0pOyIsICJleHBvcnQgZnVuY3Rpb24gYnVpbGRDb3JzKHJlcSkge1xuICBjb25zdCBhbGxvd1JhdyA9IChwcm9jZXNzLmVudi5BTExPV0VEX09SSUdJTlMgfHwgXCJcIikudHJpbSgpO1xuICBjb25zdCByZXFPcmlnaW4gPSByZXEuaGVhZGVycy5nZXQoXCJvcmlnaW5cIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiT3JpZ2luXCIpO1xuXG4gIC8vIElNUE9SVEFOVDoga2VlcCB0aGlzIGxpc3QgYWxpZ25lZCB3aXRoIHdoYXRldmVyIGhlYWRlcnMgeW91ciBhcHBzIHNlbmQuXG4gIGNvbnN0IGFsbG93SGVhZGVycyA9IFwiYXV0aG9yaXphdGlvbiwgY29udGVudC10eXBlLCB4LWthaXh1LWluc3RhbGwtaWQsIHgta2FpeHUtcmVxdWVzdC1pZCwgeC1rYWl4dS1hcHAsIHgta2FpeHUtYnVpbGQsIHgtYWRtaW4tcGFzc3dvcmQsIHgta2FpeHUtZXJyb3ItdG9rZW4sIHgta2FpeHUtbW9kZSwgeC1jb250ZW50LXNoYTEsIHgtc2V0dXAtc2VjcmV0LCB4LWthaXh1LWpvYi1zZWNyZXQsIHgtam9iLXdvcmtlci1zZWNyZXRcIjtcbiAgY29uc3QgYWxsb3dNZXRob2RzID0gXCJHRVQsUE9TVCxQVVQsUEFUQ0gsREVMRVRFLE9QVElPTlNcIjtcblxuICBjb25zdCBiYXNlID0ge1xuICAgIFwiYWNjZXNzLWNvbnRyb2wtYWxsb3ctaGVhZGVyc1wiOiBhbGxvd0hlYWRlcnMsXG4gICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1tZXRob2RzXCI6IGFsbG93TWV0aG9kcyxcbiAgICBcImFjY2Vzcy1jb250cm9sLWV4cG9zZS1oZWFkZXJzXCI6IFwieC1rYWl4dS1yZXF1ZXN0LWlkXCIsXG4gICAgXCJhY2Nlc3MtY29udHJvbC1tYXgtYWdlXCI6IFwiODY0MDBcIlxuICB9O1xuXG4gIC8vIFNUUklDVCBCWSBERUZBVUxUOlxuICAvLyAtIElmIEFMTE9XRURfT1JJR0lOUyBpcyB1bnNldC9ibGFuayBhbmQgYSBicm93c2VyIE9yaWdpbiBpcyBwcmVzZW50LCB3ZSBkbyBOT1QgZ3JhbnQgQ09SUy5cbiAgLy8gLSBBbGxvdy1hbGwgaXMgb25seSBlbmFibGVkIHdoZW4gQUxMT1dFRF9PUklHSU5TIGV4cGxpY2l0bHkgY29udGFpbnMgXCIqXCIuXG4gIGlmICghYWxsb3dSYXcpIHtcbiAgICAvLyBObyBhbGxvdy1vcmlnaW4gZ3JhbnRlZC4gU2VydmVyLXRvLXNlcnZlciByZXF1ZXN0cyAobm8gT3JpZ2luIGhlYWRlcikgc3RpbGwgd29yayBub3JtYWxseS5cbiAgICByZXR1cm4ge1xuICAgICAgLi4uYmFzZSxcbiAgICAgIC4uLihyZXFPcmlnaW4gPyB7IHZhcnk6IFwiT3JpZ2luXCIgfSA6IHt9KVxuICAgIH07XG4gIH1cblxuICBjb25zdCBhbGxvd2VkID0gYWxsb3dSYXcuc3BsaXQoXCIsXCIpLm1hcCgocykgPT4gcy50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcblxuICAvLyBFeHBsaWNpdCBhbGxvdy1hbGxcbiAgaWYgKGFsbG93ZWQuaW5jbHVkZXMoXCIqXCIpKSB7XG4gICAgY29uc3Qgb3JpZ2luID0gcmVxT3JpZ2luIHx8IFwiKlwiO1xuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlLFxuICAgICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1vcmlnaW5cIjogb3JpZ2luLFxuICAgICAgLi4uKHJlcU9yaWdpbiA/IHsgdmFyeTogXCJPcmlnaW5cIiB9IDoge30pXG4gICAgfTtcbiAgfVxuXG4gIC8vIEV4YWN0LW1hdGNoIGFsbG93bGlzdFxuICBpZiAocmVxT3JpZ2luICYmIGFsbG93ZWQuaW5jbHVkZXMocmVxT3JpZ2luKSkge1xuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlLFxuICAgICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1vcmlnaW5cIjogcmVxT3JpZ2luLFxuICAgICAgdmFyeTogXCJPcmlnaW5cIlxuICAgIH07XG4gIH1cblxuICAvLyBPcmlnaW4gcHJlc2VudCBidXQgbm90IGFsbG93ZWQ6IGRvIG5vdCBncmFudCBhbGxvdy1vcmlnaW4uXG4gIHJldHVybiB7XG4gICAgLi4uYmFzZSxcbiAgICAuLi4ocmVxT3JpZ2luID8geyB2YXJ5OiBcIk9yaWdpblwiIH0gOiB7fSlcbiAgfTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24ganNvbihzdGF0dXMsIGJvZHksIGhlYWRlcnMgPSB7fSkge1xuICByZXR1cm4gbmV3IFJlc3BvbnNlKEpTT04uc3RyaW5naWZ5KGJvZHkpLCB7XG4gICAgc3RhdHVzLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOFwiLFxuICAgICAgLi4uaGVhZGVyc1xuICAgIH1cbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZXh0KHN0YXR1cywgYm9keSwgaGVhZGVycyA9IHt9KSB7XG4gIHJldHVybiBuZXcgUmVzcG9uc2UoYm9keSwgeyBzdGF0dXMsIGhlYWRlcnMgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBiYWRSZXF1ZXN0KG1lc3NhZ2UsIGhlYWRlcnMgPSB7fSkge1xuICByZXR1cm4ganNvbig0MDAsIHsgZXJyb3I6IG1lc3NhZ2UgfSwgaGVhZGVycyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRCZWFyZXIocmVxKSB7XG4gIGNvbnN0IGF1dGggPSByZXEuaGVhZGVycy5nZXQoXCJhdXRob3JpemF0aW9uXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIkF1dGhvcml6YXRpb25cIikgfHwgXCJcIjtcbiAgaWYgKCFhdXRoLnN0YXJ0c1dpdGgoXCJCZWFyZXIgXCIpKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIGF1dGguc2xpY2UoNykudHJpbSgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbW9udGhLZXlVVEMoZCA9IG5ldyBEYXRlKCkpIHtcbiAgcmV0dXJuIGQudG9JU09TdHJpbmcoKS5zbGljZSgwLCA3KTsgLy8gWVlZWS1NTVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5zdGFsbElkKHJlcSkge1xuICByZXR1cm4gKFxuICAgIHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtaW5zdGFsbC1pZFwiKSB8fFxuICAgIHJlcS5oZWFkZXJzLmdldChcIlgtS2FpeHUtSW5zdGFsbC1JZFwiKSB8fFxuICAgIFwiXCJcbiAgKS50b1N0cmluZygpLnRyaW0oKS5zbGljZSgwLCA4MCkgfHwgbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFVzZXJBZ2VudChyZXEpIHtcbiAgcmV0dXJuIChyZXEuaGVhZGVycy5nZXQoXCJ1c2VyLWFnZW50XCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIlVzZXItQWdlbnRcIikgfHwgXCJcIikudG9TdHJpbmcoKS5zbGljZSgwLCAyNDApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q2xpZW50SXAocmVxKSB7XG4gIC8vIE5ldGxpZnkgYWRkcyB4LW5mLWNsaWVudC1jb25uZWN0aW9uLWlwIHdoZW4gZGVwbG95ZWQgKG1heSBiZSBtaXNzaW5nIGluIG5ldGxpZnkgZGV2KS5cbiAgY29uc3QgYSA9IChyZXEuaGVhZGVycy5nZXQoXCJ4LW5mLWNsaWVudC1jb25uZWN0aW9uLWlwXCIpIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpO1xuICBpZiAoYSkgcmV0dXJuIGE7XG5cbiAgLy8gRmFsbGJhY2sgdG8gZmlyc3QgWC1Gb3J3YXJkZWQtRm9yIGVudHJ5LlxuICBjb25zdCB4ZmYgPSAocmVxLmhlYWRlcnMuZ2V0KFwieC1mb3J3YXJkZWQtZm9yXCIpIHx8IFwiXCIpLnRvU3RyaW5nKCk7XG4gIGlmICgheGZmKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgZmlyc3QgPSB4ZmYuc3BsaXQoXCIsXCIpWzBdLnRyaW0oKTtcbiAgcmV0dXJuIGZpcnN0IHx8IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzbGVlcChtcykge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgbXMpKTtcbn0iLCAiaW1wb3J0IHsgbmVvbiB9IGZyb20gXCJAbmV0bGlmeS9uZW9uXCI7XG5cbi8qKlxuICogTmV0bGlmeSBEQiAoTmVvbiBQb3N0Z3JlcykgaGVscGVyLlxuICpcbiAqIElNUE9SVEFOVCAoTmVvbiBzZXJ2ZXJsZXNzIGRyaXZlciwgMjAyNSspOlxuICogLSBgbmVvbigpYCByZXR1cm5zIGEgdGFnZ2VkLXRlbXBsYXRlIHF1ZXJ5IGZ1bmN0aW9uLlxuICogLSBGb3IgZHluYW1pYyBTUUwgc3RyaW5ncyArICQxIHBsYWNlaG9sZGVycywgdXNlIGBzcWwucXVlcnkodGV4dCwgcGFyYW1zKWAuXG4gKiAgIChDYWxsaW5nIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvbiBsaWtlIHNxbChcIlNFTEVDVCAuLi5cIikgY2FuIGJyZWFrIG9uIG5ld2VyIGRyaXZlciB2ZXJzaW9ucy4pXG4gKlxuICogTmV0bGlmeSBEQiBhdXRvbWF0aWNhbGx5IGluamVjdHMgYE5FVExJRllfREFUQUJBU0VfVVJMYCB3aGVuIHRoZSBOZW9uIGV4dGVuc2lvbiBpcyBhdHRhY2hlZC5cbiAqL1xuXG5sZXQgX3NxbCA9IG51bGw7XG5sZXQgX3NjaGVtYVByb21pc2UgPSBudWxsO1xuXG5mdW5jdGlvbiBnZXRTcWwoKSB7XG4gIGlmIChfc3FsKSByZXR1cm4gX3NxbDtcblxuICBjb25zdCBoYXNEYlVybCA9ICEhKHByb2Nlc3MuZW52Lk5FVExJRllfREFUQUJBU0VfVVJMIHx8IHByb2Nlc3MuZW52LkRBVEFCQVNFX1VSTCk7XG4gIGlmICghaGFzRGJVcmwpIHtcbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXCJEYXRhYmFzZSBub3QgY29uZmlndXJlZCAobWlzc2luZyBORVRMSUZZX0RBVEFCQVNFX1VSTCkuIEF0dGFjaCBOZXRsaWZ5IERCIChOZW9uKSB0byB0aGlzIHNpdGUuXCIpO1xuICAgIGVyci5jb2RlID0gXCJEQl9OT1RfQ09ORklHVVJFRFwiO1xuICAgIGVyci5zdGF0dXMgPSA1MDA7XG4gICAgZXJyLmhpbnQgPSBcIk5ldGxpZnkgVUkgXHUyMTkyIEV4dGVuc2lvbnMgXHUyMTkyIE5lb24gXHUyMTkyIEFkZCBkYXRhYmFzZSAob3IgcnVuOiBucHggbmV0bGlmeSBkYiBpbml0KS5cIjtcbiAgICB0aHJvdyBlcnI7XG4gIH1cblxuICBfc3FsID0gbmVvbigpOyAvLyBhdXRvLXVzZXMgcHJvY2Vzcy5lbnYuTkVUTElGWV9EQVRBQkFTRV9VUkwgb24gTmV0bGlmeVxuICByZXR1cm4gX3NxbDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZW5zdXJlU2NoZW1hKCkge1xuICBpZiAoX3NjaGVtYVByb21pc2UpIHJldHVybiBfc2NoZW1hUHJvbWlzZTtcblxuICBfc2NoZW1hUHJvbWlzZSA9IChhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgc3FsID0gZ2V0U3FsKCk7XG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IFtcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcnMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGVtYWlsIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBwbGFuX25hbWUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdzdGFydGVyJyxcbiAgICAgICAgbW9udGhseV9jYXBfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDIwMDAsXG4gICAgICAgIGlzX2FjdGl2ZSBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgdHJ1ZSxcbiAgICAgICAgc3RyaXBlX2N1c3RvbWVyX2lkIHRleHQsXG4gICAgICAgIHN0cmlwZV9zdWJzY3JpcHRpb25faWQgdGV4dCxcbiAgICAgICAgc3RyaXBlX3N0YXR1cyB0ZXh0LFxuICAgICAgICBzdHJpcGVfY3VycmVudF9wZXJpb2RfZW5kIHRpbWVzdGFtcHR6LFxuICAgICAgICBhdXRvX3RvcHVwX2VuYWJsZWQgYm9vbGVhbiBub3QgbnVsbCBkZWZhdWx0IGZhbHNlLFxuICAgICAgICBhdXRvX3RvcHVwX2Ftb3VudF9jZW50cyBpbnRlZ2VyLFxuICAgICAgICBhdXRvX3RvcHVwX3RocmVzaG9sZF9jZW50cyBpbnRlZ2VyLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhcGlfa2V5cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAga2V5X2hhc2ggdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIGtleV9sYXN0NCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBsYWJlbCB0ZXh0LFxuICAgICAgICBtb250aGx5X2NhcF9jZW50cyBpbnRlZ2VyLFxuICAgICAgICBycG1fbGltaXQgaW50ZWdlcixcbiAgICAgICAgcnBkX2xpbWl0IGludGVnZXIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcmV2b2tlZF9hdCB0aW1lc3RhbXB0elxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFwaV9rZXlzX2N1c3RvbWVyX2lkX2lkeCBvbiBhcGlfa2V5cyhjdXN0b21lcl9pZCk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBtb250aGx5X3VzYWdlIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc3BlbnRfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGV4dHJhX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBtb250aGx5X2tleV91c2FnZSAoXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzcGVudF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgaW5wdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjYWxscyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoYXBpX2tleV9pZCwgbW9udGgpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgbW9udGhseV9rZXlfdXNhZ2VfY3VzdG9tZXJfbW9udGhfaWR4IG9uIG1vbnRobHlfa2V5X3VzYWdlKGN1c3RvbWVyX2lkLCBtb250aCk7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBtb250aGx5X2tleV91c2FnZSBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgY2FsbHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDA7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtb2RlbCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHVzYWdlX2V2ZW50c19jdXN0b21lcl9tb250aF9pZHggb24gdXNhZ2VfZXZlbnRzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzX2tleV9pZHggb24gdXNhZ2VfZXZlbnRzKGFwaV9rZXlfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhdWRpdF9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGFjdG9yIHRleHQgbm90IG51bGwsXG4gICAgICAgIGFjdGlvbiB0ZXh0IG5vdCBudWxsLFxuICAgICAgICB0YXJnZXQgdGV4dCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhdWRpdF9ldmVudHNfY3JlYXRlZF9pZHggb24gYXVkaXRfZXZlbnRzKGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyByYXRlX2xpbWl0X3dpbmRvd3MgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgd2luZG93X3N0YXJ0IHRpbWVzdGFtcHR6IG5vdCBudWxsLFxuICAgICAgICBjb3VudCBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCB3aW5kb3dfc3RhcnQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcmF0ZV9saW1pdF93aW5kb3dzX3dpbmRvd19pZHggb24gcmF0ZV9saW1pdF93aW5kb3dzKHdpbmRvd19zdGFydCBkZXNjKTtgLCAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9zZWVuX2F0IHRpbWVzdGFtcHR6O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxhc3Rfc2Vlbl9pbnN0YWxsX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSB1c2FnZV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGluc3RhbGxfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHVzYWdlX2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgaXBfaGFzaCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgdXNhZ2VfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyB1YSB0ZXh0O2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzX2luc3RhbGxfaWR4IG9uIHVzYWdlX2V2ZW50cyhpbnN0YWxsX2lkKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGFsZXJ0c19zZW50IChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIGFsZXJ0X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIG1vbnRoLCBhbGVydF90eXBlKVxuICAgICAgKTtgLFxuICAgIFxuICAgICAgLy8gLS0tIERldmljZSBiaW5kaW5nIC8gc2VhdHMgLS0tXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtYXhfZGV2aWNlc19wZXJfa2V5IGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlcXVpcmVfaW5zdGFsbF9pZCBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgZmFsc2U7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfcHJvdmlkZXJzIHRleHRbXTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9tb2RlbHMganNvbmI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHN0cmlwZV9jdXJyZW50X3BlcmlvZF9lbmQgdGltZXN0YW1wdHo7YCxcblxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtYXhfZGV2aWNlcyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlcXVpcmVfaW5zdGFsbF9pZCBib29sZWFuO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfcHJvdmlkZXJzIHRleHRbXTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhbGxvd2VkX21vZGVscyBqc29uYjtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMga2V5X2RldmljZXMgKFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgaW5zdGFsbF9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBkZXZpY2VfbGFiZWwgdGV4dCxcbiAgICAgICAgZmlyc3Rfc2Vlbl9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBsYXN0X3NlZW5fYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGxhc3Rfc2Vlbl91YSB0ZXh0LFxuICAgICAgICByZXZva2VkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICByZXZva2VkX2J5IHRleHQsXG4gICAgICAgIHByaW1hcnkga2V5IChhcGlfa2V5X2lkLCBpbnN0YWxsX2lkKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGtleV9kZXZpY2VzX2N1c3RvbWVyX2lkeCBvbiBrZXlfZGV2aWNlcyhjdXN0b21lcl9pZCk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBrZXlfZGV2aWNlc19sYXN0X3NlZW5faWR4IG9uIGtleV9kZXZpY2VzKGxhc3Rfc2Vlbl9hdCBkZXNjKTtgLFxuXG4gICAgICAvLyAtLS0gSW52b2ljZSBzbmFwc2hvdHMgKyB0b3B1cHMgLS0tXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgbW9udGhseV9pbnZvaWNlcyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHNuYXBzaG90IGpzb25iIG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB0b3B1cF9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIGFtb3VudF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsLFxuICAgICAgICBzb3VyY2UgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdtYW51YWwnLFxuICAgICAgICBzdHJpcGVfc2Vzc2lvbl9pZCB0ZXh0LFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdhcHBsaWVkJyxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdG9wdXBfZXZlbnRzX2N1c3RvbWVyX21vbnRoX2lkeCBvbiB0b3B1cF9ldmVudHMoY3VzdG9tZXJfaWQsIG1vbnRoKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgYXN5bmNfam9icyAoXG4gICAgICAgIGlkIHV1aWQgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtb2RlbCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICByZXF1ZXN0IGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3F1ZXVlZCcsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgc3RhcnRlZF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgY29tcGxldGVkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBoZWFydGJlYXRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIG91dHB1dF90ZXh0IHRleHQsXG4gICAgICAgIGVycm9yIHRleHQsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXN5bmNfam9ic19jdXN0b21lcl9jcmVhdGVkX2lkeCBvbiBhc3luY19qb2JzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXN5bmNfam9ic19zdGF0dXNfaWR4IG9uIGFzeW5jX2pvYnMoc3RhdHVzLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIHJlcXVlc3RfaWQgdGV4dCxcbiAgICAgICAgbGV2ZWwgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbmZvJyxcbiAgICAgICAga2luZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBmdW5jdGlvbl9uYW1lIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1ldGhvZCB0ZXh0LFxuICAgICAgICBwYXRoIHRleHQsXG4gICAgICAgIG9yaWdpbiB0ZXh0LFxuICAgICAgICByZWZlcmVyIHRleHQsXG4gICAgICAgIHVzZXJfYWdlbnQgdGV4dCxcbiAgICAgICAgaXAgdGV4dCxcbiAgICAgICAgYXBwX2lkIHRleHQsXG4gICAgICAgIGJ1aWxkX2lkIHRleHQsXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQsXG4gICAgICAgIHByb3ZpZGVyIHRleHQsXG4gICAgICAgIG1vZGVsIHRleHQsXG4gICAgICAgIGh0dHBfc3RhdHVzIGludGVnZXIsXG4gICAgICAgIGR1cmF0aW9uX21zIGludGVnZXIsXG4gICAgICAgIGVycm9yX2NvZGUgdGV4dCxcbiAgICAgICAgZXJyb3JfbWVzc2FnZSB0ZXh0LFxuICAgICAgICBlcnJvcl9zdGFjayB0ZXh0LFxuICAgICAgICB1cHN0cmVhbV9zdGF0dXMgaW50ZWdlcixcbiAgICAgICAgdXBzdHJlYW1fYm9keSB0ZXh0LFxuICAgICAgICBleHRyYSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcblxuICAgICAgLy8gRm9yd2FyZC1jb21wYXRpYmxlIHBhdGNoaW5nOiBpZiBnYXRld2F5X2V2ZW50cyBleGlzdGVkIGZyb20gYW4gb2xkZXIgYnVpbGQsXG4gICAgICAvLyBpdCBtYXkgYmUgbWlzc2luZyBjb2x1bW5zIHVzZWQgYnkgbW9uaXRvciBpbnNlcnRzLlxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByZXF1ZXN0X2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGV2ZWwgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbmZvJztgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBraW5kIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZXZlbnQnO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGZ1bmN0aW9uX25hbWUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd1bmtub3duJztgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtZXRob2QgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBwYXRoIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgb3JpZ2luIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVmZXJlciB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVzZXJfYWdlbnQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBpcCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFwcF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGJ1aWxkX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfaWQgYmlnaW50O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFwaV9rZXlfaWQgYmlnaW50O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHByb3ZpZGVyIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbW9kZWwgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBodHRwX3N0YXR1cyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGR1cmF0aW9uX21zIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZXJyb3JfY29kZSB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGVycm9yX21lc3NhZ2UgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBlcnJvcl9zdGFjayB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVwc3RyZWFtX3N0YXR1cyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVwc3RyZWFtX2JvZHkgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBleHRyYSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKTtgLFxuXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfY3JlYXRlZF9pZHggb24gZ2F0ZXdheV9ldmVudHMoY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX3JlcXVlc3RfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKHJlcXVlc3RfaWQpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfbGV2ZWxfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKGxldmVsLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfZm5faWR4IG9uIGdhdGV3YXlfZXZlbnRzKGZ1bmN0aW9uX25hbWUsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19hcHBfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKGFwcF9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuXG4gICAgICAvLyAtLS0gS2FpeHVQdXNoIChEZXBsb3kgUHVzaCkgZW50ZXJwcmlzZSB0YWJsZXMgLS0tXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJvbGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdkZXBsb3llcic7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhcGlfa2V5c19yb2xlX2lkeCBvbiBhcGlfa2V5cyhyb2xlKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVyX25ldGxpZnlfdG9rZW5zIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IHByaW1hcnkga2V5IHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgdG9rZW5fZW5jIHRleHQgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9wcm9qZWN0cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJvamVjdF9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBuYW1lIHRleHQgbm90IG51bGwsXG4gICAgICAgIG5ldGxpZnlfc2l0ZV9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdW5pcXVlIChjdXN0b21lcl9pZCwgcHJvamVjdF9pZClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX3Byb2plY3RzX2N1c3RvbWVyX2lkeCBvbiBwdXNoX3Byb2plY3RzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9wdXNoZXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm9qZWN0X3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3Byb2plY3RzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHVzaF9pZCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgYnJhbmNoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHRpdGxlIHRleHQsXG4gICAgICAgIGRlcGxveV9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzdGF0ZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICByZXF1aXJlZF9kaWdlc3RzIHRleHRbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OnRleHRbXSxcbiAgICAgICAgdXBsb2FkZWRfZGlnZXN0cyB0ZXh0W10gbm90IG51bGwgZGVmYXVsdCAne30nOjp0ZXh0W10sXG4gICAgICAgIGZpbGVfbWFuaWZlc3QganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgdXJsIHRleHQsXG4gICAgICAgIGVycm9yIHRleHQsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9wdXNoZXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGZpbGVfbWFuaWZlc3QganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYjtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfcHVzaGVzX2N1c3RvbWVyX2lkeCBvbiBwdXNoX3B1c2hlcyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfam9icyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgcHVzaF9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wdXNoZXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBzaGExIGNoYXIoNDApIG5vdCBudWxsLFxuICAgICAgICBkZXBsb3lfcGF0aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBwYXJ0cyBpbnRlZ2VyIG5vdCBudWxsLFxuICAgICAgICByZWNlaXZlZF9wYXJ0cyBpbnRlZ2VyW10gbm90IG51bGwgZGVmYXVsdCAne30nOjppbnRbXSxcbiAgICAgICAgcGFydF9ieXRlcyBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBieXRlc19zdGFnZWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAndXBsb2FkaW5nJyxcbiAgICAgICAgZXJyb3IgdGV4dCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVuaXF1ZSAocHVzaF9yb3dfaWQsIHNoYTEpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9qb2JzX3B1c2hfaWR4IG9uIHB1c2hfam9icyhwdXNoX3Jvd19pZCwgdXBkYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYnl0ZXNfc3RhZ2VkIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDA7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHBhcnRfYnl0ZXMganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYXR0ZW1wdHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDA7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG5leHRfYXR0ZW1wdF9hdCB0aW1lc3RhbXB0ejtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9lcnJvciB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X2Vycm9yX2F0IHRpbWVzdGFtcHR6O2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3JhdGVfd2luZG93cyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGJ1Y2tldF90eXBlIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJ1Y2tldF9zdGFydCB0aW1lc3RhbXB0eiBub3QgbnVsbCxcbiAgICAgICAgY291bnQgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHByaW1hcnkga2V5KGN1c3RvbWVyX2lkLCBidWNrZXRfdHlwZSwgYnVja2V0X3N0YXJ0KVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfcmF0ZV93aW5kb3dzX2J1Y2tldF9pZHggb24gcHVzaF9yYXRlX3dpbmRvd3MoYnVja2V0X3R5cGUsIGJ1Y2tldF9zdGFydCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfZmlsZXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIHB1c2hfcm93X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHVzaGVzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgZGVwbG95X3BhdGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc2hhMSBjaGFyKDQwKSBub3QgbnVsbCxcbiAgICAgICAgYnl0ZXMgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbW9kZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2RpcmVjdCcsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfZmlsZXNfcHVzaF9pZHggb24gcHVzaF9maWxlcyhwdXNoX3Jvd19pZCk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3VzYWdlX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHB1c2hfcm93X2lkIGJpZ2ludCByZWZlcmVuY2VzIHB1c2hfcHVzaGVzKGlkKSBvbiBkZWxldGUgc2V0IG51bGwsXG4gICAgICAgIGV2ZW50X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYnl0ZXMgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcHJpY2luZ192ZXJzaW9uIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAxLFxuICAgICAgICBjb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfdXNhZ2VfY3VzdG9tZXJfaWR4IG9uIHB1c2hfdXNhZ2VfZXZlbnRzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9wcmljaW5nX3ZlcnNpb25zIChcbiAgICAgICAgdmVyc2lvbiBpbnRlZ2VyIHByaW1hcnkga2V5LFxuICAgICAgICBlZmZlY3RpdmVfZnJvbSBkYXRlIG5vdCBudWxsIGRlZmF1bHQgY3VycmVudF9kYXRlLFxuICAgICAgICBjdXJyZW5jeSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ1VTRCcsXG4gICAgICAgIGJhc2VfbW9udGhfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHBlcl9kZXBsb3lfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHBlcl9nYl9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgaW5zZXJ0IGludG8gcHVzaF9wcmljaW5nX3ZlcnNpb25zKHZlcnNpb24sIGJhc2VfbW9udGhfY2VudHMsIHBlcl9kZXBsb3lfY2VudHMsIHBlcl9nYl9jZW50cylcbiAgICAgICB2YWx1ZXMgKDEsIDAsIDEwLCAyNSkgb24gY29uZmxpY3QgKHZlcnNpb24pIGRvIG5vdGhpbmc7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcl9wdXNoX2JpbGxpbmcgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgcHJpbWFyeSBrZXkgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcmljaW5nX3ZlcnNpb24gaW50ZWdlciBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHJpY2luZ192ZXJzaW9ucyh2ZXJzaW9uKSxcbiAgICAgICAgbW9udGhseV9jYXBfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9pbnZvaWNlcyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHByaWNpbmdfdmVyc2lvbiBpbnRlZ2VyIG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wcmljaW5nX3ZlcnNpb25zKHZlcnNpb24pLFxuICAgICAgICB0b3RhbF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsLFxuICAgICAgICBicmVha2Rvd24ganNvbmIgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuXG4gICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgIC8vIEdpdEh1YiBQdXNoIEdhdGV3YXkgKG9wdGlvbmFsKVxuICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfZ2l0aHViX3Rva2VucyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBwcmltYXJ5IGtleSByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHRva2VuX2VuYyB0ZXh0IG5vdCBudWxsLFxuICAgICAgICB0b2tlbl90eXBlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnb2F1dGgnLFxuICAgICAgICBzY29wZXMgdGV4dFtdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6dGV4dFtdLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGdoX3B1c2hfam9icyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGpvYl9pZCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgb3duZXIgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcmVwbyB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBicmFuY2ggdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdtYWluJyxcbiAgICAgICAgY29tbWl0X21lc3NhZ2UgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdLYWl4dSBHaXRIdWIgUHVzaCcsXG4gICAgICAgIHBhcnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICByZWNlaXZlZF9wYXJ0cyBpbnRlZ2VyW10gbm90IG51bGwgZGVmYXVsdCAne30nOjppbnRbXSxcbiAgICAgICAgcGFydF9ieXRlcyBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBieXRlc19zdGFnZWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAndXBsb2FkaW5nJyxcbiAgICAgICAgYXR0ZW1wdHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG5leHRfYXR0ZW1wdF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgbGFzdF9lcnJvciB0ZXh0LFxuICAgICAgICBsYXN0X2Vycm9yX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICByZXN1bHRfY29tbWl0X3NoYSB0ZXh0LFxuICAgICAgICByZXN1bHRfdXJsIHRleHQsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9qb2JzX2N1c3RvbWVyX2lkeCBvbiBnaF9wdXNoX2pvYnMoY3VzdG9tZXJfaWQsIHVwZGF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnaF9wdXNoX2pvYnNfbmV4dF9hdHRlbXB0X2lkeCBvbiBnaF9wdXNoX2pvYnMobmV4dF9hdHRlbXB0X2F0KSB3aGVyZSBzdGF0dXMgaW4gKCdyZXRyeV93YWl0JywnZXJyb3JfdHJhbnNpZW50Jyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBnaF9wdXNoX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGpvYl9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgZ2hfcHVzaF9qb2JzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgZXZlbnRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBieXRlcyBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdoX3B1c2hfZXZlbnRzX2pvYl9pZHggb24gZ2hfcHVzaF9ldmVudHMoam9iX3Jvd19pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB2b2ljZV9udW1iZXJzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwaG9uZV9udW1iZXIgdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwgZGVmYXVsdCAndHdpbGlvJyxcbiAgICAgICAgdHdpbGlvX3NpZCB0ZXh0LFxuICAgICAgICBpc19hY3RpdmUgYm9vbGVhbiBub3QgbnVsbCBkZWZhdWx0IHRydWUsXG4gICAgICAgIGRlZmF1bHRfbGxtX3Byb3ZpZGVyIHRleHQgbm90IG51bGwgZGVmYXVsdCAnb3BlbmFpJyxcbiAgICAgICAgZGVmYXVsdF9sbG1fbW9kZWwgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdncHQtNC4xLW1pbmknLFxuICAgICAgICB2b2ljZV9uYW1lIHRleHQgbm90IG51bGwgZGVmYXVsdCAnYWxsb3knLFxuICAgICAgICBsb2NhbGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdlbi1VUycsXG4gICAgICAgIHRpbWV6b25lIHRleHQgbm90IG51bGwgZGVmYXVsdCAnQW1lcmljYS9QaG9lbml4JyxcbiAgICAgICAgcGxheWJvb2sganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfbnVtYmVyc19jdXN0b21lcl9pZHggb24gdm9pY2VfbnVtYmVycyhjdXN0b21lcl9pZCk7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB2b2ljZV9udW1iZXJfaWQgYmlnaW50IHJlZmVyZW5jZXMgdm9pY2VfbnVtYmVycyhpZCkgb24gZGVsZXRlIHNldCBudWxsLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3R3aWxpbycsXG4gICAgICAgIHByb3ZpZGVyX2NhbGxfc2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIGZyb21fbnVtYmVyIHRleHQsXG4gICAgICAgIHRvX251bWJlciB0ZXh0LFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbml0aWF0ZWQnLFxuICAgICAgICBkaXJlY3Rpb24gdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbmJvdW5kJyxcbiAgICAgICAgc3RhcnRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBlbmRlZF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgZHVyYXRpb25fc2Vjb25kcyBpbnRlZ2VyLFxuICAgICAgICBlc3RfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgYmlsbF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmJcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdW5pcXVlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbHNfcHJvdmlkZXJfc2lkX3VxIG9uIHZvaWNlX2NhbGxzKHByb3ZpZGVyLCBwcm92aWRlcl9jYWxsX3NpZCk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsc19jdXN0b21lcl9pZHggb24gdm9pY2VfY2FsbHMoY3VzdG9tZXJfaWQsIHN0YXJ0ZWRfYXQgZGVzYyk7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxfbWVzc2FnZXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGNhbGxfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgdm9pY2VfY2FsbHMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICByb2xlIHRleHQgbm90IG51bGwsIC0tIHVzZXJ8YXNzaXN0YW50fHN5c3RlbXx0b29sXG4gICAgICAgIGNvbnRlbnQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbF9tZXNzYWdlc19jYWxsX2lkeCBvbiB2b2ljZV9jYWxsX21lc3NhZ2VzKGNhbGxfaWQsIGlkKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfdXNhZ2VfbW9udGhseSAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbWludXRlcyBudW1lcmljIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgZXN0X2Nvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGJpbGxfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY2FsbHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdW5pcXVlKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV91c2FnZV9tb250aGx5X2N1c3RvbWVyX2lkeCBvbiB2b2ljZV91c2FnZV9tb250aGx5KGN1c3RvbWVyX2lkLCBtb250aCk7YCxcblxuXTtcblxuICAgIGZvciAoY29uc3QgcyBvZiBzdGF0ZW1lbnRzKSB7XG4gICAgICBhd2FpdCBzcWwucXVlcnkocyk7XG4gICAgfVxuICB9KSgpO1xuXG4gIHJldHVybiBfc2NoZW1hUHJvbWlzZTtcbn1cblxuLyoqXG4gKiBRdWVyeSBoZWxwZXIgY29tcGF0aWJsZSB3aXRoIHRoZSBwcmV2aW91cyBgcGdgLWlzaCBpbnRlcmZhY2U6XG4gKiAtIHJldHVybnMgeyByb3dzLCByb3dDb3VudCB9XG4gKiAtIHN1cHBvcnRzICQxLCAkMiBwbGFjZWhvbGRlcnMgKyBwYXJhbXMgYXJyYXkgdmlhIHNxbC5xdWVyeSguLi4pXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBxKHRleHQsIHBhcmFtcyA9IFtdKSB7XG4gIGF3YWl0IGVuc3VyZVNjaGVtYSgpO1xuICBjb25zdCBzcWwgPSBnZXRTcWwoKTtcbiAgY29uc3Qgcm93cyA9IGF3YWl0IHNxbC5xdWVyeSh0ZXh0LCBwYXJhbXMpO1xuICByZXR1cm4geyByb3dzOiByb3dzIHx8IFtdLCByb3dDb3VudDogQXJyYXkuaXNBcnJheShyb3dzKSA/IHJvd3MubGVuZ3RoIDogMCB9O1xufSIsICJpbXBvcnQgeyBxIH0gZnJvbSBcIi4vZGIuanNcIjtcblxuZnVuY3Rpb24gc2FmZVN0cih2LCBtYXggPSA4MDAwKSB7XG4gIGlmICh2ID09IG51bGwpIHJldHVybiBudWxsO1xuICBjb25zdCBzID0gU3RyaW5nKHYpO1xuICBpZiAocy5sZW5ndGggPD0gbWF4KSByZXR1cm4gcztcbiAgcmV0dXJuIHMuc2xpY2UoMCwgbWF4KSArIGBcdTIwMjYoKyR7cy5sZW5ndGggLSBtYXh9IGNoYXJzKWA7XG59XG5cbmZ1bmN0aW9uIHJhbmRvbUlkKCkge1xuICB0cnkge1xuICAgIGlmIChnbG9iYWxUaGlzLmNyeXB0bz8ucmFuZG9tVVVJRCkgcmV0dXJuIGdsb2JhbFRoaXMuY3J5cHRvLnJhbmRvbVVVSUQoKTtcbiAgfSBjYXRjaCB7fVxuICAvLyBmYWxsYmFjayAobm90IFJGQzQxMjItcGVyZmVjdCwgYnV0IHVuaXF1ZSBlbm91Z2ggZm9yIHRyYWNpbmcpXG4gIHJldHVybiBcInJpZF9cIiArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMTYpLnNsaWNlKDIpICsgXCJfXCIgKyBEYXRlLm5vdygpLnRvU3RyaW5nKDE2KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFJlcXVlc3RJZChyZXEpIHtcbiAgY29uc3QgaCA9IChyZXEuaGVhZGVycy5nZXQoXCJ4LWthaXh1LXJlcXVlc3QtaWRcIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwieC1yZXF1ZXN0LWlkXCIpIHx8IFwiXCIpLnRyaW0oKTtcbiAgcmV0dXJuIGggfHwgcmFuZG9tSWQoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluZmVyRnVuY3Rpb25OYW1lKHJlcSkge1xuICB0cnkge1xuICAgIGNvbnN0IHUgPSBuZXcgVVJMKHJlcS51cmwpO1xuICAgIGNvbnN0IG0gPSB1LnBhdGhuYW1lLm1hdGNoKC9cXC9cXC5uZXRsaWZ5XFwvZnVuY3Rpb25zXFwvKFteXFwvXSspL2kpO1xuICAgIHJldHVybiBtID8gbVsxXSA6IFwidW5rbm93blwiO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gXCJ1bmtub3duXCI7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVlc3RNZXRhKHJlcSkge1xuICBsZXQgdXJsID0gbnVsbDtcbiAgdHJ5IHsgdXJsID0gbmV3IFVSTChyZXEudXJsKTsgfSBjYXRjaCB7fVxuICByZXR1cm4ge1xuICAgIG1ldGhvZDogcmVxLm1ldGhvZCB8fCBudWxsLFxuICAgIHBhdGg6IHVybCA/IHVybC5wYXRobmFtZSA6IG51bGwsXG4gICAgcXVlcnk6IHVybCA/IE9iamVjdC5mcm9tRW50cmllcyh1cmwuc2VhcmNoUGFyYW1zLmVudHJpZXMoKSkgOiB7fSxcbiAgICBvcmlnaW46IHJlcS5oZWFkZXJzLmdldChcIm9yaWdpblwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJPcmlnaW5cIikgfHwgbnVsbCxcbiAgICByZWZlcmVyOiByZXEuaGVhZGVycy5nZXQoXCJyZWZlcmVyXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIlJlZmVyZXJcIikgfHwgbnVsbCxcbiAgICB1c2VyX2FnZW50OiByZXEuaGVhZGVycy5nZXQoXCJ1c2VyLWFnZW50XCIpIHx8IG51bGwsXG4gICAgaXA6IHJlcS5oZWFkZXJzLmdldChcIngtbmYtY2xpZW50LWNvbm5lY3Rpb24taXBcIikgfHwgbnVsbCxcbiAgICBhcHBfaWQ6IChyZXEuaGVhZGVycy5nZXQoXCJ4LWthaXh1LWFwcFwiKSB8fCBcIlwiKS50cmltKCkgfHwgbnVsbCxcbiAgICBidWlsZF9pZDogKHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtYnVpbGRcIikgfHwgXCJcIikudHJpbSgpIHx8IG51bGxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUVycm9yKGVycikge1xuICBjb25zdCBlID0gZXJyIHx8IHt9O1xuICByZXR1cm4ge1xuICAgIG5hbWU6IHNhZmVTdHIoZS5uYW1lLCAyMDApLFxuICAgIG1lc3NhZ2U6IHNhZmVTdHIoZS5tZXNzYWdlLCA0MDAwKSxcbiAgICBjb2RlOiBzYWZlU3RyKGUuY29kZSwgMjAwKSxcbiAgICBzdGF0dXM6IE51bWJlci5pc0Zpbml0ZShlLnN0YXR1cykgPyBlLnN0YXR1cyA6IG51bGwsXG4gICAgaGludDogc2FmZVN0cihlLmhpbnQsIDIwMDApLFxuICAgIHN0YWNrOiBzYWZlU3RyKGUuc3RhY2ssIDEyMDAwKSxcbiAgICB1cHN0cmVhbTogZS51cHN0cmVhbSA/IHtcbiAgICAgIHByb3ZpZGVyOiBzYWZlU3RyKGUudXBzdHJlYW0ucHJvdmlkZXIsIDUwKSxcbiAgICAgIHN0YXR1czogTnVtYmVyLmlzRmluaXRlKGUudXBzdHJlYW0uc3RhdHVzKSA/IGUudXBzdHJlYW0uc3RhdHVzIDogbnVsbCxcbiAgICAgIGJvZHk6IHNhZmVTdHIoZS51cHN0cmVhbS5ib2R5LCAxMjAwMCksXG4gICAgICByZXF1ZXN0X2lkOiBzYWZlU3RyKGUudXBzdHJlYW0ucmVxdWVzdF9pZCwgMjAwKSxcbiAgICAgIHJlc3BvbnNlX2hlYWRlcnM6IGUudXBzdHJlYW0ucmVzcG9uc2VfaGVhZGVycyB8fCB1bmRlZmluZWRcbiAgICB9IDogdW5kZWZpbmVkXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdW1tYXJpemVKc29uQm9keShib2R5KSB7XG4gIC8vIFNhZmUgc3VtbWFyeTsgYXZvaWRzIGxvZ2dpbmcgZnVsbCBwcm9tcHRzIGJ5IGRlZmF1bHQuXG4gIGNvbnN0IGIgPSBib2R5IHx8IHt9O1xuICBjb25zdCBwcm92aWRlciA9IChiLnByb3ZpZGVyIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpLnRvTG93ZXJDYXNlKCkgfHwgbnVsbDtcbiAgY29uc3QgbW9kZWwgPSAoYi5tb2RlbCB8fCBcIlwiKS50b1N0cmluZygpLnRyaW0oKSB8fCBudWxsO1xuXG4gIGxldCBtZXNzYWdlQ291bnQgPSBudWxsO1xuICBsZXQgdG90YWxDaGFycyA9IG51bGw7XG4gIHRyeSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoYi5tZXNzYWdlcykpIHtcbiAgICAgIG1lc3NhZ2VDb3VudCA9IGIubWVzc2FnZXMubGVuZ3RoO1xuICAgICAgdG90YWxDaGFycyA9IGIubWVzc2FnZXMucmVkdWNlKChhY2MsIG0pID0+IGFjYyArIFN0cmluZyhtPy5jb250ZW50ID8/IFwiXCIpLmxlbmd0aCwgMCk7XG4gICAgfVxuICB9IGNhdGNoIHt9XG5cbiAgcmV0dXJuIHtcbiAgICBwcm92aWRlcixcbiAgICBtb2RlbCxcbiAgICBtYXhfdG9rZW5zOiBOdW1iZXIuaXNGaW5pdGUoYi5tYXhfdG9rZW5zKSA/IHBhcnNlSW50KGIubWF4X3Rva2VucywgMTApIDogbnVsbCxcbiAgICB0ZW1wZXJhdHVyZTogdHlwZW9mIGIudGVtcGVyYXR1cmUgPT09IFwibnVtYmVyXCIgPyBiLnRlbXBlcmF0dXJlIDogbnVsbCxcbiAgICBtZXNzYWdlX2NvdW50OiBtZXNzYWdlQ291bnQsXG4gICAgbWVzc2FnZV9jaGFyczogdG90YWxDaGFyc1xuICB9O1xufVxuXG4vKipcbiAqIEJlc3QtZWZmb3J0IG1vbml0b3IgZXZlbnQ6IGZhaWx1cmVzIG5ldmVyIGJyZWFrIHRoZSBtYWluIHJlcXVlc3QuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbWl0RXZlbnQoZXYpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBlID0gZXYgfHwge307XG4gICAgY29uc3QgZXh0cmEgPSBlLmV4dHJhIHx8IHt9O1xuICAgIGF3YWl0IHEoXG4gICAgICBgaW5zZXJ0IGludG8gZ2F0ZXdheV9ldmVudHNcbiAgICAgICAgKHJlcXVlc3RfaWQsIGxldmVsLCBraW5kLCBmdW5jdGlvbl9uYW1lLCBtZXRob2QsIHBhdGgsIG9yaWdpbiwgcmVmZXJlciwgdXNlcl9hZ2VudCwgaXAsXG4gICAgICAgICBhcHBfaWQsIGJ1aWxkX2lkLCBjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgcHJvdmlkZXIsIG1vZGVsLCBodHRwX3N0YXR1cywgZHVyYXRpb25fbXMsXG4gICAgICAgICBlcnJvcl9jb2RlLCBlcnJvcl9tZXNzYWdlLCBlcnJvcl9zdGFjaywgdXBzdHJlYW1fc3RhdHVzLCB1cHN0cmVhbV9ib2R5LCBleHRyYSlcbiAgICAgICB2YWx1ZXNcbiAgICAgICAgKCQxLCQyLCQzLCQ0LCQ1LCQ2LCQ3LCQ4LCQ5LCQxMCxcbiAgICAgICAgICQxMSwkMTIsJDEzLCQxNCwkMTUsJDE2LCQxNywkMTgsXG4gICAgICAgICAkMTksJDIwLCQyMSwkMjIsJDIzLCQyNCwkMjU6Ompzb25iKWAsXG4gICAgICBbXG4gICAgICAgIHNhZmVTdHIoZS5yZXF1ZXN0X2lkLCAyMDApLFxuICAgICAgICBzYWZlU3RyKGUubGV2ZWwgfHwgXCJpbmZvXCIsIDIwKSxcbiAgICAgICAgc2FmZVN0cihlLmtpbmQgfHwgXCJldmVudFwiLCA4MCksXG4gICAgICAgIHNhZmVTdHIoZS5mdW5jdGlvbl9uYW1lIHx8IFwidW5rbm93blwiLCAxMjApLFxuICAgICAgICBzYWZlU3RyKGUubWV0aG9kLCAyMCksXG4gICAgICAgIHNhZmVTdHIoZS5wYXRoLCA1MDApLFxuICAgICAgICBzYWZlU3RyKGUub3JpZ2luLCA1MDApLFxuICAgICAgICBzYWZlU3RyKGUucmVmZXJlciwgODAwKSxcbiAgICAgICAgc2FmZVN0cihlLnVzZXJfYWdlbnQsIDgwMCksXG4gICAgICAgIHNhZmVTdHIoZS5pcCwgMjAwKSxcblxuICAgICAgICBzYWZlU3RyKGUuYXBwX2lkLCAyMDApLFxuICAgICAgICBzYWZlU3RyKGUuYnVpbGRfaWQsIDIwMCksXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShlLmN1c3RvbWVyX2lkKSA/IGUuY3VzdG9tZXJfaWQgOiBudWxsLFxuICAgICAgICBOdW1iZXIuaXNGaW5pdGUoZS5hcGlfa2V5X2lkKSA/IGUuYXBpX2tleV9pZCA6IG51bGwsXG4gICAgICAgIHNhZmVTdHIoZS5wcm92aWRlciwgODApLFxuICAgICAgICBzYWZlU3RyKGUubW9kZWwsIDIwMCksXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShlLmh0dHBfc3RhdHVzKSA/IGUuaHR0cF9zdGF0dXMgOiBudWxsLFxuICAgICAgICBOdW1iZXIuaXNGaW5pdGUoZS5kdXJhdGlvbl9tcykgPyBlLmR1cmF0aW9uX21zIDogbnVsbCxcblxuICAgICAgICBzYWZlU3RyKGUuZXJyb3JfY29kZSwgMjAwKSxcbiAgICAgICAgc2FmZVN0cihlLmVycm9yX21lc3NhZ2UsIDQwMDApLFxuICAgICAgICBzYWZlU3RyKGUuZXJyb3Jfc3RhY2ssIDEyMDAwKSxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUudXBzdHJlYW1fc3RhdHVzKSA/IGUudXBzdHJlYW1fc3RhdHVzIDogbnVsbCxcbiAgICAgICAgc2FmZVN0cihlLnVwc3RyZWFtX2JvZHksIDEyMDAwKSxcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoZXh0cmEgfHwge30pXG4gICAgICBdXG4gICAgKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUud2FybihcIm1vbml0b3IgZW1pdCBmYWlsZWQ6XCIsIGU/Lm1lc3NhZ2UgfHwgZSk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBidWlsZENvcnMsIGpzb24gfSBmcm9tIFwiLi9odHRwLmpzXCI7XG5pbXBvcnQgeyBlbWl0RXZlbnQsIGdldFJlcXVlc3RJZCwgaW5mZXJGdW5jdGlvbk5hbWUsIHJlcXVlc3RNZXRhLCBzZXJpYWxpemVFcnJvciB9IGZyb20gXCIuL21vbml0b3IuanNcIjtcblxuZnVuY3Rpb24gbm9ybWFsaXplRXJyb3IoZXJyKSB7XG4gIGNvbnN0IHN0YXR1cyA9IGVycj8uc3RhdHVzIHx8IDUwMDtcbiAgY29uc3QgY29kZSA9IGVycj8uY29kZSB8fCBcIlNFUlZFUl9FUlJPUlwiO1xuICBjb25zdCBtZXNzYWdlID0gZXJyPy5tZXNzYWdlIHx8IFwiVW5rbm93biBlcnJvclwiO1xuICBjb25zdCBoaW50ID0gZXJyPy5oaW50O1xuICByZXR1cm4geyBzdGF0dXMsIGJvZHk6IHsgZXJyb3I6IG1lc3NhZ2UsIGNvZGUsIC4uLihoaW50ID8geyBoaW50IH0gOiB7fSkgfSB9O1xufVxuXG5mdW5jdGlvbiB3aXRoUmVxdWVzdElkKHJlcywgcmVxdWVzdF9pZCkge1xuICB0cnkge1xuICAgIGNvbnN0IGggPSBuZXcgSGVhZGVycyhyZXMuaGVhZGVycyB8fCB7fSk7XG4gICAgaC5zZXQoXCJ4LWthaXh1LXJlcXVlc3QtaWRcIiwgcmVxdWVzdF9pZCk7XG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShyZXMuYm9keSwgeyBzdGF0dXM6IHJlcy5zdGF0dXMsIGhlYWRlcnM6IGggfSk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiByZXM7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gc2FmZUJvZHlQcmV2aWV3KHJlcykge1xuICB0cnkge1xuICAgIGNvbnN0IGN0ID0gKHJlcy5oZWFkZXJzLmdldChcImNvbnRlbnQtdHlwZVwiKSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGNsb25lID0gcmVzLmNsb25lKCk7XG4gICAgaWYgKGN0LmluY2x1ZGVzKFwiYXBwbGljYXRpb24vanNvblwiKSkge1xuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGNsb25lLmpzb24oKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cbiAgICBjb25zdCB0ID0gYXdhaXQgY2xvbmUudGV4dCgpLmNhdGNoKCgpID0+IFwiXCIpO1xuICAgIGlmICh0eXBlb2YgdCA9PT0gXCJzdHJpbmdcIiAmJiB0Lmxlbmd0aCA+IDEyMDAwKSByZXR1cm4gdC5zbGljZSgwLCAxMjAwMCkgKyBgXHUyMDI2KCske3QubGVuZ3RoIC0gMTIwMDB9IGNoYXJzKWA7XG4gICAgcmV0dXJuIHQ7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cmFwKGhhbmRsZXIpIHtcbiAgcmV0dXJuIGFzeW5jIChyZXEsIGNvbnRleHQpID0+IHtcbiAgICBjb25zdCBzdGFydCA9IERhdGUubm93KCk7XG4gICAgY29uc3QgY29ycyA9IGJ1aWxkQ29ycyhyZXEpO1xuICAgIGNvbnN0IHJlcXVlc3RfaWQgPSBnZXRSZXF1ZXN0SWQocmVxKTtcbiAgICBjb25zdCBmdW5jdGlvbl9uYW1lID0gaW5mZXJGdW5jdGlvbk5hbWUocmVxKTtcbiAgICBjb25zdCBtZXRhID0gcmVxdWVzdE1ldGEocmVxKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBoYW5kbGVyKHJlcSwgY29ycywgY29udGV4dCk7XG5cbiAgICAgIGNvbnN0IGR1cmF0aW9uX21zID0gRGF0ZS5ub3coKSAtIHN0YXJ0O1xuICAgICAgY29uc3Qgb3V0ID0gcmVzIGluc3RhbmNlb2YgUmVzcG9uc2UgPyB3aXRoUmVxdWVzdElkKHJlcywgcmVxdWVzdF9pZCkgOiByZXM7XG5cbiAgICAgIGNvbnN0IHN0YXR1cyA9IG91dCBpbnN0YW5jZW9mIFJlc3BvbnNlID8gb3V0LnN0YXR1cyA6IDIwMDtcbiAgICAgIGNvbnN0IGxldmVsID0gc3RhdHVzID49IDUwMCA/IFwiZXJyb3JcIiA6IHN0YXR1cyA+PSA0MDAgPyBcIndhcm5cIiA6IFwiaW5mb1wiO1xuICAgICAgY29uc3Qga2luZCA9IHN0YXR1cyA+PSA0MDAgPyBcImh0dHBfZXJyb3JfcmVzcG9uc2VcIiA6IFwiaHR0cF9yZXNwb25zZVwiO1xuXG4gICAgICBsZXQgZXh0cmEgPSB7fTtcbiAgICAgIGlmIChzdGF0dXMgPj0gNDAwICYmIG91dCBpbnN0YW5jZW9mIFJlc3BvbnNlKSB7XG4gICAgICAgIGV4dHJhLnJlc3BvbnNlID0gYXdhaXQgc2FmZUJvZHlQcmV2aWV3KG91dCk7XG4gICAgICB9XG4gICAgICBpZiAoZHVyYXRpb25fbXMgPj0gMTUwMDApIHtcbiAgICAgICAgZXh0cmEuc2xvdyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IGVtaXRFdmVudCh7XG4gICAgICAgIHJlcXVlc3RfaWQsXG4gICAgICAgIGxldmVsLFxuICAgICAgICBraW5kLFxuICAgICAgICBmdW5jdGlvbl9uYW1lLFxuICAgICAgICAuLi5tZXRhLFxuICAgICAgICBodHRwX3N0YXR1czogc3RhdHVzLFxuICAgICAgICBkdXJhdGlvbl9tcyxcbiAgICAgICAgZXh0cmFcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gb3V0O1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc3QgZHVyYXRpb25fbXMgPSBEYXRlLm5vdygpIC0gc3RhcnQ7XG5cbiAgICAgIC8vIEJlc3QtZWZmb3J0IGRldGFpbGVkIG1vbml0b3IgcmVjb3JkLlxuICAgICAgY29uc3Qgc2VyID0gc2VyaWFsaXplRXJyb3IoZXJyKTtcbiAgICAgIGF3YWl0IGVtaXRFdmVudCh7XG4gICAgICAgIHJlcXVlc3RfaWQsXG4gICAgICAgIGxldmVsOiBcImVycm9yXCIsXG4gICAgICAgIGtpbmQ6IFwidGhyb3duX2Vycm9yXCIsXG4gICAgICAgIGZ1bmN0aW9uX25hbWUsXG4gICAgICAgIC4uLm1ldGEsXG4gICAgICAgIHByb3ZpZGVyOiBzZXI/LnVwc3RyZWFtPy5wcm92aWRlciB8fCB1bmRlZmluZWQsXG4gICAgICAgIGh0dHBfc3RhdHVzOiBzZXI/LnN0YXR1cyB8fCA1MDAsXG4gICAgICAgIGR1cmF0aW9uX21zLFxuICAgICAgICBlcnJvcl9jb2RlOiBzZXI/LmNvZGUgfHwgXCJTRVJWRVJfRVJST1JcIixcbiAgICAgICAgZXJyb3JfbWVzc2FnZTogc2VyPy5tZXNzYWdlIHx8IFwiVW5rbm93biBlcnJvclwiLFxuICAgICAgICBlcnJvcl9zdGFjazogc2VyPy5zdGFjayB8fCBudWxsLFxuICAgICAgICB1cHN0cmVhbV9zdGF0dXM6IHNlcj8udXBzdHJlYW0/LnN0YXR1cyB8fCBudWxsLFxuICAgICAgICB1cHN0cmVhbV9ib2R5OiBzZXI/LnVwc3RyZWFtPy5ib2R5IHx8IG51bGwsXG4gICAgICAgIGV4dHJhOiB7IGVycm9yOiBzZXIgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIEF2b2lkIDUwMnM6IGFsd2F5cyByZXR1cm4gSlNPTi5cbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJGdW5jdGlvbiBlcnJvcjpcIiwgZXJyKTtcbiAgICAgIGNvbnN0IHsgc3RhdHVzLCBib2R5IH0gPSBub3JtYWxpemVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIGpzb24oc3RhdHVzLCB7IC4uLmJvZHksIHJlcXVlc3RfaWQgfSwgeyAuLi5jb3JzLCBcIngta2FpeHUtcmVxdWVzdC1pZFwiOiByZXF1ZXN0X2lkIH0pO1xuICAgIH1cbiAgfTtcbn1cbiIsICJpbXBvcnQgY3J5cHRvIGZyb20gXCJjcnlwdG9cIjtcblxuZnVuY3Rpb24gY29uZmlnRXJyb3IobWVzc2FnZSwgaGludCkge1xuICBjb25zdCBlcnIgPSBuZXcgRXJyb3IobWVzc2FnZSk7XG4gIGVyci5jb2RlID0gXCJDT05GSUdcIjtcbiAgZXJyLnN0YXR1cyA9IDUwMDtcbiAgaWYgKGhpbnQpIGVyci5oaW50ID0gaGludDtcbiAgcmV0dXJuIGVycjtcbn1cblxuZnVuY3Rpb24gYmFzZTY0dXJsKGlucHV0KSB7XG4gIHJldHVybiBCdWZmZXIuZnJvbShpbnB1dClcbiAgICAudG9TdHJpbmcoXCJiYXNlNjRcIilcbiAgICAucmVwbGFjZSgvPS9nLCBcIlwiKVxuICAgIC5yZXBsYWNlKC9cXCsvZywgXCItXCIpXG4gICAgLnJlcGxhY2UoL1xcLy9nLCBcIl9cIik7XG59XG5cbmZ1bmN0aW9uIHVuYmFzZTY0dXJsKGlucHV0KSB7XG4gIGNvbnN0IHMgPSBTdHJpbmcoaW5wdXQgfHwgXCJcIikucmVwbGFjZSgvLS9nLCBcIitcIikucmVwbGFjZSgvXy9nLCBcIi9cIik7XG4gIGNvbnN0IHBhZCA9IHMubGVuZ3RoICUgNCA9PT0gMCA/IFwiXCIgOiBcIj1cIi5yZXBlYXQoNCAtIChzLmxlbmd0aCAlIDQpKTtcbiAgcmV0dXJuIEJ1ZmZlci5mcm9tKHMgKyBwYWQsIFwiYmFzZTY0XCIpO1xufVxuXG5mdW5jdGlvbiBlbmNLZXkoKSB7XG4gIC8vIFByZWZlciBhIGRlZGljYXRlZCBlbmNyeXB0aW9uIGtleS4gRmFsbCBiYWNrIHRvIEpXVF9TRUNSRVQgZm9yIGRyb3AtZnJpZW5kbHkgaW5zdGFsbHMuXG4gIGNvbnN0IHJhdyA9IChwcm9jZXNzLmVudi5EQl9FTkNSWVBUSU9OX0tFWSB8fCBwcm9jZXNzLmVudi5KV1RfU0VDUkVUIHx8IFwiXCIpLnRvU3RyaW5nKCk7XG4gIGlmICghcmF3KSB7XG4gICAgdGhyb3cgY29uZmlnRXJyb3IoXG4gICAgICBcIk1pc3NpbmcgREJfRU5DUllQVElPTl9LRVkgKG9yIEpXVF9TRUNSRVQgZmFsbGJhY2spXCIsXG4gICAgICBcIlNldCBEQl9FTkNSWVBUSU9OX0tFWSAocmVjb21tZW5kZWQpIG9yIGF0IG1pbmltdW0gSldUX1NFQ1JFVCBpbiBOZXRsaWZ5IGVudiB2YXJzLlwiXG4gICAgKTtcbiAgfVxuICAvLyBEZXJpdmUgYSBzdGFibGUgMzItYnl0ZSBrZXkuXG4gIHJldHVybiBjcnlwdG8uY3JlYXRlSGFzaChcInNoYTI1NlwiKS51cGRhdGUocmF3KS5kaWdlc3QoKTtcbn1cblxuLyoqXG4gKiBFbmNyeXB0IHNtYWxsIHNlY3JldHMgZm9yIERCIHN0b3JhZ2UgKEFFUy0yNTYtR0NNKS5cbiAqIEZvcm1hdDogdjE6PGl2X2I2NHVybD46PHRhZ19iNjR1cmw+OjxjaXBoZXJfYjY0dXJsPlxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5jcnlwdFNlY3JldChwbGFpbnRleHQpIHtcbiAgY29uc3Qga2V5ID0gZW5jS2V5KCk7XG4gIGNvbnN0IGl2ID0gY3J5cHRvLnJhbmRvbUJ5dGVzKDEyKTtcbiAgY29uc3QgY2lwaGVyID0gY3J5cHRvLmNyZWF0ZUNpcGhlcml2KFwiYWVzLTI1Ni1nY21cIiwga2V5LCBpdik7XG4gIGNvbnN0IGN0ID0gQnVmZmVyLmNvbmNhdChbY2lwaGVyLnVwZGF0ZShTdHJpbmcocGxhaW50ZXh0KSwgXCJ1dGY4XCIpLCBjaXBoZXIuZmluYWwoKV0pO1xuICBjb25zdCB0YWcgPSBjaXBoZXIuZ2V0QXV0aFRhZygpO1xuICByZXR1cm4gYHYxOiR7YmFzZTY0dXJsKGl2KX06JHtiYXNlNjR1cmwodGFnKX06JHtiYXNlNjR1cmwoY3QpfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWNyeXB0U2VjcmV0KGVuYykge1xuICBjb25zdCBzID0gU3RyaW5nKGVuYyB8fCBcIlwiKTtcbiAgaWYgKCFzLnN0YXJ0c1dpdGgoXCJ2MTpcIikpIHJldHVybiBudWxsO1xuICBjb25zdCBwYXJ0cyA9IHMuc3BsaXQoXCI6XCIpO1xuICBpZiAocGFydHMubGVuZ3RoICE9PSA0KSByZXR1cm4gbnVsbDtcbiAgY29uc3QgWywgaXZCLCB0YWdCLCBjdEJdID0gcGFydHM7XG4gIGNvbnN0IGtleSA9IGVuY0tleSgpO1xuICBjb25zdCBpdiA9IHVuYmFzZTY0dXJsKGl2Qik7XG4gIGNvbnN0IHRhZyA9IHVuYmFzZTY0dXJsKHRhZ0IpO1xuICBjb25zdCBjdCA9IHVuYmFzZTY0dXJsKGN0Qik7XG4gIGNvbnN0IGRlY2lwaGVyID0gY3J5cHRvLmNyZWF0ZURlY2lwaGVyaXYoXCJhZXMtMjU2LWdjbVwiLCBrZXksIGl2KTtcbiAgZGVjaXBoZXIuc2V0QXV0aFRhZyh0YWcpO1xuICBjb25zdCBwdCA9IEJ1ZmZlci5jb25jYXQoW2RlY2lwaGVyLnVwZGF0ZShjdCksIGRlY2lwaGVyLmZpbmFsKCldKTtcbiAgcmV0dXJuIHB0LnRvU3RyaW5nKFwidXRmOFwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJhbmRvbUtleShwcmVmaXggPSBcImt4X2xpdmVfXCIpIHtcbiAgY29uc3QgYnl0ZXMgPSBjcnlwdG8ucmFuZG9tQnl0ZXMoMzIpO1xuICByZXR1cm4gcHJlZml4ICsgYmFzZTY0dXJsKGJ5dGVzKS5zbGljZSgwLCA0OCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaGEyNTZIZXgoaW5wdXQpIHtcbiAgcmV0dXJuIGNyeXB0by5jcmVhdGVIYXNoKFwic2hhMjU2XCIpLnVwZGF0ZShpbnB1dCkuZGlnZXN0KFwiaGV4XCIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaG1hY1NoYTI1NkhleChzZWNyZXQsIGlucHV0KSB7XG4gIHJldHVybiBjcnlwdG8uY3JlYXRlSG1hYyhcInNoYTI1NlwiLCBzZWNyZXQpLnVwZGF0ZShpbnB1dCkuZGlnZXN0KFwiaGV4XCIpO1xufVxuXG4vKipcbiAqIEtleSBoYXNoaW5nIHN0cmF0ZWd5OlxuICogLSBEZWZhdWx0OiBTSEEtMjU2KGtleSlcbiAqIC0gSWYgS0VZX1BFUFBFUiBpcyBzZXQ6IEhNQUMtU0hBMjU2KEtFWV9QRVBQRVIsIGtleSlcbiAqXG4gKiBJTVBPUlRBTlQ6IFBlcHBlciBpcyBvcHRpb25hbCBhbmQgY2FuIGJlIGVuYWJsZWQgbGF0ZXIuXG4gKiBBdXRoIGNvZGUgd2lsbCBhdXRvLW1pZ3JhdGUgbGVnYWN5IGhhc2hlcyBvbiBmaXJzdCBzdWNjZXNzZnVsIGxvb2t1cC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGtleUhhc2hIZXgoaW5wdXQpIHtcbiAgY29uc3QgcGVwcGVyID0gcHJvY2Vzcy5lbnYuS0VZX1BFUFBFUjtcbiAgaWYgKHBlcHBlcikgcmV0dXJuIGhtYWNTaGEyNTZIZXgocGVwcGVyLCBpbnB1dCk7XG4gIHJldHVybiBzaGEyNTZIZXgoaW5wdXQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGVnYWN5S2V5SGFzaEhleChpbnB1dCkge1xuICByZXR1cm4gc2hhMjU2SGV4KGlucHV0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNpZ25Kd3QocGF5bG9hZCwgdHRsU2Vjb25kcyA9IDM2MDApIHtcbiAgY29uc3Qgc2VjcmV0ID0gcHJvY2Vzcy5lbnYuSldUX1NFQ1JFVDtcbiAgaWYgKCFzZWNyZXQpIHtcbiAgICB0aHJvdyBjb25maWdFcnJvcihcbiAgICAgIFwiTWlzc2luZyBKV1RfU0VDUkVUXCIsXG4gICAgICBcIlNldCBKV1RfU0VDUkVUIGluIE5ldGxpZnkgXHUyMTkyIFNpdGUgY29uZmlndXJhdGlvbiBcdTIxOTIgRW52aXJvbm1lbnQgdmFyaWFibGVzICh1c2UgYSBsb25nIHJhbmRvbSBzdHJpbmcpLlwiXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IGhlYWRlciA9IHsgYWxnOiBcIkhTMjU2XCIsIHR5cDogXCJKV1RcIiB9O1xuICBjb25zdCBub3cgPSBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKTtcbiAgY29uc3QgYm9keSA9IHsgLi4ucGF5bG9hZCwgaWF0OiBub3csIGV4cDogbm93ICsgdHRsU2Vjb25kcyB9O1xuXG4gIGNvbnN0IGggPSBiYXNlNjR1cmwoSlNPTi5zdHJpbmdpZnkoaGVhZGVyKSk7XG4gIGNvbnN0IHAgPSBiYXNlNjR1cmwoSlNPTi5zdHJpbmdpZnkoYm9keSkpO1xuICBjb25zdCBkYXRhID0gYCR7aH0uJHtwfWA7XG4gIGNvbnN0IHNpZyA9IGJhc2U2NHVybChjcnlwdG8uY3JlYXRlSG1hYyhcInNoYTI1NlwiLCBzZWNyZXQpLnVwZGF0ZShkYXRhKS5kaWdlc3QoKSk7XG5cbiAgcmV0dXJuIGAke2RhdGF9LiR7c2lnfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2ZXJpZnlKd3QodG9rZW4pIHtcbiAgY29uc3Qgc2VjcmV0ID0gcHJvY2Vzcy5lbnYuSldUX1NFQ1JFVDtcbiAgaWYgKCFzZWNyZXQpIHtcbiAgICB0aHJvdyBjb25maWdFcnJvcihcbiAgICAgIFwiTWlzc2luZyBKV1RfU0VDUkVUXCIsXG4gICAgICBcIlNldCBKV1RfU0VDUkVUIGluIE5ldGxpZnkgXHUyMTkyIFNpdGUgY29uZmlndXJhdGlvbiBcdTIxOTIgRW52aXJvbm1lbnQgdmFyaWFibGVzICh1c2UgYSBsb25nIHJhbmRvbSBzdHJpbmcpLlwiXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IHBhcnRzID0gdG9rZW4uc3BsaXQoXCIuXCIpO1xuICBpZiAocGFydHMubGVuZ3RoICE9PSAzKSByZXR1cm4gbnVsbDtcblxuICBjb25zdCBbaCwgcCwgc10gPSBwYXJ0cztcbiAgY29uc3QgZGF0YSA9IGAke2h9LiR7cH1gO1xuICBjb25zdCBleHBlY3RlZCA9IGJhc2U2NHVybChjcnlwdG8uY3JlYXRlSG1hYyhcInNoYTI1NlwiLCBzZWNyZXQpLnVwZGF0ZShkYXRhKS5kaWdlc3QoKSk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBhID0gQnVmZmVyLmZyb20oZXhwZWN0ZWQpO1xuICAgIGNvbnN0IGIgPSBCdWZmZXIuZnJvbShzKTtcbiAgICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSByZXR1cm4gbnVsbDtcbiAgICBpZiAoIWNyeXB0by50aW1pbmdTYWZlRXF1YWwoYSwgYikpIHJldHVybiBudWxsO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHRyeSB7XG4gICAgY29uc3QgcGF5bG9hZCA9IEpTT04ucGFyc2UoXG4gICAgICBCdWZmZXIuZnJvbShwLnJlcGxhY2UoLy0vZywgXCIrXCIpLnJlcGxhY2UoL18vZywgXCIvXCIpLCBcImJhc2U2NFwiKS50b1N0cmluZyhcInV0Zi04XCIpXG4gICAgKTtcbiAgICBjb25zdCBub3cgPSBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKTtcbiAgICBpZiAocGF5bG9hZC5leHAgJiYgbm93ID4gcGF5bG9hZC5leHApIHJldHVybiBudWxsO1xuICAgIHJldHVybiBwYXlsb2FkO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuIiwgImltcG9ydCB7IHEgfSBmcm9tIFwiLi9kYi5qc1wiO1xuaW1wb3J0IHsga2V5SGFzaEhleCwgbGVnYWN5S2V5SGFzaEhleCwgdmVyaWZ5Snd0IH0gZnJvbSBcIi4vY3J5cHRvLmpzXCI7XG5pbXBvcnQgeyBtb250aEtleVVUQyB9IGZyb20gXCIuL2h0dHAuanNcIjtcblxuZnVuY3Rpb24gYmFzZVNlbGVjdCgpIHtcbiAgcmV0dXJuIGBzZWxlY3Qgay5pZCBhcyBhcGlfa2V5X2lkLCBrLmN1c3RvbWVyX2lkLCBrLmtleV9sYXN0NCwgay5sYWJlbCwgay5yb2xlLFxuICAgICAgICAgICAgICAgICBrLm1vbnRobHlfY2FwX2NlbnRzIGFzIGtleV9jYXBfY2VudHMsIGsucnBtX2xpbWl0LCBrLnJwZF9saW1pdCxcbiAgICAgICAgICAgICAgICAgay5tYXhfZGV2aWNlcywgay5yZXF1aXJlX2luc3RhbGxfaWQsIGsuYWxsb3dlZF9wcm92aWRlcnMsIGsuYWxsb3dlZF9tb2RlbHMsXG4gICAgICAgICAgICAgICAgIGMubW9udGhseV9jYXBfY2VudHMgYXMgY3VzdG9tZXJfY2FwX2NlbnRzLCBjLmlzX2FjdGl2ZSxcbiAgICAgICAgICAgICAgICAgYy5tYXhfZGV2aWNlc19wZXJfa2V5IGFzIGN1c3RvbWVyX21heF9kZXZpY2VzX3Blcl9rZXksIGMucmVxdWlyZV9pbnN0YWxsX2lkIGFzIGN1c3RvbWVyX3JlcXVpcmVfaW5zdGFsbF9pZCxcbiAgICAgICAgICAgICAgICAgYy5hbGxvd2VkX3Byb3ZpZGVycyBhcyBjdXN0b21lcl9hbGxvd2VkX3Byb3ZpZGVycywgYy5hbGxvd2VkX21vZGVscyBhcyBjdXN0b21lcl9hbGxvd2VkX21vZGVscyxcbiAgICAgICAgICAgICAgICAgYy5wbGFuX25hbWUgYXMgY3VzdG9tZXJfcGxhbl9uYW1lLCBjLmVtYWlsIGFzIGN1c3RvbWVyX2VtYWlsXG4gICAgICAgICAgZnJvbSBhcGlfa2V5cyBrXG4gICAgICAgICAgam9pbiBjdXN0b21lcnMgYyBvbiBjLmlkID0gay5jdXN0b21lcl9pZGA7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb29rdXBLZXkocGxhaW5LZXkpIHtcbiAgLy8gUHJlZmVycmVkIGhhc2ggKHBlcHBlcmVkIGlmIGVuYWJsZWQpXG4gIGNvbnN0IHByZWZlcnJlZCA9IGtleUhhc2hIZXgocGxhaW5LZXkpO1xuICBsZXQga2V5UmVzID0gYXdhaXQgcShcbiAgICBgJHtiYXNlU2VsZWN0KCl9XG4gICAgIHdoZXJlIGsua2V5X2hhc2g9JDEgYW5kIGsucmV2b2tlZF9hdCBpcyBudWxsXG4gICAgIGxpbWl0IDFgLFxuICAgIFtwcmVmZXJyZWRdXG4gICk7XG4gIGlmIChrZXlSZXMucm93Q291bnQpIHJldHVybiBrZXlSZXMucm93c1swXTtcblxuICAvLyBJZiBLRVlfUEVQUEVSIGlzIGVuYWJsZWQsIGFsbG93IGxlZ2FjeSBTSEEtMjU2IGhhc2hlcyBhbmQgYXV0by1taWdyYXRlIG9uIGZpcnN0IGhpdC5cbiAgaWYgKHByb2Nlc3MuZW52LktFWV9QRVBQRVIpIHtcbiAgICBjb25zdCBsZWdhY3kgPSBsZWdhY3lLZXlIYXNoSGV4KHBsYWluS2V5KTtcbiAgICBrZXlSZXMgPSBhd2FpdCBxKFxuICAgICAgYCR7YmFzZVNlbGVjdCgpfVxuICAgICAgIHdoZXJlIGsua2V5X2hhc2g9JDEgYW5kIGsucmV2b2tlZF9hdCBpcyBudWxsXG4gICAgICAgbGltaXQgMWAsXG4gICAgICBbbGVnYWN5XVxuICAgICk7XG4gICAgaWYgKCFrZXlSZXMucm93Q291bnQpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3Qgcm93ID0ga2V5UmVzLnJvd3NbMF07XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHEoXG4gICAgICAgIGB1cGRhdGUgYXBpX2tleXMgc2V0IGtleV9oYXNoPSQxXG4gICAgICAgICB3aGVyZSBpZD0kMiBhbmQga2V5X2hhc2g9JDNgLFxuICAgICAgICBbcHJlZmVycmVkLCByb3cuYXBpX2tleV9pZCwgbGVnYWN5XVxuICAgICAgKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIGlnbm9yZSBtaWdyYXRpb24gZXJyb3JzXG4gICAgfVxuXG4gICAgcmV0dXJuIHJvdztcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9va3VwS2V5QnlJZChhcGlfa2V5X2lkKSB7XG4gIGNvbnN0IGtleVJlcyA9IGF3YWl0IHEoXG4gICAgYCR7YmFzZVNlbGVjdCgpfVxuICAgICB3aGVyZSBrLmlkPSQxIGFuZCBrLnJldm9rZWRfYXQgaXMgbnVsbFxuICAgICBsaW1pdCAxYCxcbiAgICBbYXBpX2tleV9pZF1cbiAgKTtcbiAgaWYgKCFrZXlSZXMucm93Q291bnQpIHJldHVybiBudWxsO1xuICByZXR1cm4ga2V5UmVzLnJvd3NbMF07XG59XG5cbi8qKlxuICogUmVzb2x2ZSBhbiBBdXRob3JpemF0aW9uIEJlYXJlciB0b2tlbi5cbiAqIFN1cHBvcnRlZDpcbiAqIC0gS2FpeHUgc3ViLWtleSAocGxhaW4gdmlydHVhbCBrZXkpXG4gKiAtIFNob3J0LWxpdmVkIHVzZXIgc2Vzc2lvbiBKV1QgKHR5cGU6ICd1c2VyX3Nlc3Npb24nKVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZUF1dGgodG9rZW4pIHtcbiAgaWYgKCF0b2tlbikgcmV0dXJuIG51bGw7XG5cbiAgLy8gSldUcyBoYXZlIDMgZG90LXNlcGFyYXRlZCBwYXJ0cy4gS2FpeHUga2V5cyBkbyBub3QuXG4gIGNvbnN0IHBhcnRzID0gdG9rZW4uc3BsaXQoXCIuXCIpO1xuICBpZiAocGFydHMubGVuZ3RoID09PSAzKSB7XG4gICAgY29uc3QgcGF5bG9hZCA9IHZlcmlmeUp3dCh0b2tlbik7XG4gICAgaWYgKCFwYXlsb2FkKSByZXR1cm4gbnVsbDtcbiAgICBpZiAocGF5bG9hZC50eXBlICE9PSBcInVzZXJfc2Vzc2lvblwiKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IHJvdyA9IGF3YWl0IGxvb2t1cEtleUJ5SWQocGF5bG9hZC5hcGlfa2V5X2lkKTtcbiAgICByZXR1cm4gcm93O1xuICB9XG5cbiAgcmV0dXJuIGF3YWl0IGxvb2t1cEtleSh0b2tlbik7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRNb250aFJvbGx1cChjdXN0b21lcl9pZCwgbW9udGggPSBtb250aEtleVVUQygpKSB7XG4gIGNvbnN0IHJvbGwgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3Qgc3BlbnRfY2VudHMsIGV4dHJhX2NlbnRzLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnNcbiAgICAgZnJvbSBtb250aGx5X3VzYWdlIHdoZXJlIGN1c3RvbWVyX2lkPSQxIGFuZCBtb250aD0kMmAsXG4gICAgW2N1c3RvbWVyX2lkLCBtb250aF1cbiAgKTtcbiAgaWYgKHJvbGwucm93Q291bnQgPT09IDApIHJldHVybiB7IHNwZW50X2NlbnRzOiAwLCBleHRyYV9jZW50czogMCwgaW5wdXRfdG9rZW5zOiAwLCBvdXRwdXRfdG9rZW5zOiAwIH07XG4gIHJldHVybiByb2xsLnJvd3NbMF07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRLZXlNb250aFJvbGx1cChhcGlfa2V5X2lkLCBtb250aCA9IG1vbnRoS2V5VVRDKCkpIHtcbiAgY29uc3Qgcm9sbCA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBzcGVudF9jZW50cywgaW5wdXRfdG9rZW5zLCBvdXRwdXRfdG9rZW5zLCBjYWxsc1xuICAgICBmcm9tIG1vbnRobHlfa2V5X3VzYWdlIHdoZXJlIGFwaV9rZXlfaWQ9JDEgYW5kIG1vbnRoPSQyYCxcbiAgICBbYXBpX2tleV9pZCwgbW9udGhdXG4gICk7XG4gIGlmIChyb2xsLnJvd0NvdW50KSByZXR1cm4gcm9sbC5yb3dzWzBdO1xuXG4gIC8vIEJhY2tmaWxsIGZvciBtaWdyYXRlZCBpbnN0YWxscyAod2hlbiBtb250aGx5X2tleV91c2FnZSBkaWQgbm90IGV4aXN0IHlldCkuXG4gIGNvbnN0IGtleU1ldGEgPSBhd2FpdCBxKGBzZWxlY3QgY3VzdG9tZXJfaWQgZnJvbSBhcGlfa2V5cyB3aGVyZSBpZD0kMWAsIFthcGlfa2V5X2lkXSk7XG4gIGNvbnN0IGN1c3RvbWVyX2lkID0ga2V5TWV0YS5yb3dDb3VudCA/IGtleU1ldGEucm93c1swXS5jdXN0b21lcl9pZCA6IG51bGw7XG5cbiAgY29uc3QgYWdnID0gYXdhaXQgcShcbiAgICBgc2VsZWN0IGNvYWxlc2NlKHN1bShjb3N0X2NlbnRzKSwwKTo6aW50IGFzIHNwZW50X2NlbnRzLFxuICAgICAgICAgICAgY29hbGVzY2Uoc3VtKGlucHV0X3Rva2VucyksMCk6OmludCBhcyBpbnB1dF90b2tlbnMsXG4gICAgICAgICAgICBjb2FsZXNjZShzdW0ob3V0cHV0X3Rva2VucyksMCk6OmludCBhcyBvdXRwdXRfdG9rZW5zLFxuICAgICAgICAgICAgY291bnQoKik6OmludCBhcyBjYWxsc1xuICAgICBmcm9tIHVzYWdlX2V2ZW50c1xuICAgICB3aGVyZSBhcGlfa2V5X2lkPSQxIGFuZCB0b19jaGFyKGNyZWF0ZWRfYXQgYXQgdGltZSB6b25lICdVVEMnLCdZWVlZLU1NJyk9JDJgLFxuICAgIFthcGlfa2V5X2lkLCBtb250aF1cbiAgKTtcblxuICBjb25zdCByb3cgPSBhZ2cucm93c1swXSB8fCB7IHNwZW50X2NlbnRzOiAwLCBpbnB1dF90b2tlbnM6IDAsIG91dHB1dF90b2tlbnM6IDAsIGNhbGxzOiAwIH07XG5cbiAgaWYgKGN1c3RvbWVyX2lkICE9IG51bGwpIHtcbiAgICBhd2FpdCBxKFxuICAgICAgYGluc2VydCBpbnRvIG1vbnRobHlfa2V5X3VzYWdlKGFwaV9rZXlfaWQsIGN1c3RvbWVyX2lkLCBtb250aCwgc3BlbnRfY2VudHMsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2VucywgY2FsbHMpXG4gICAgICAgdmFsdWVzICgkMSwkMiwkMywkNCwkNSwkNiwkNylcbiAgICAgICBvbiBjb25mbGljdCAoYXBpX2tleV9pZCwgbW9udGgpXG4gICAgICAgZG8gdXBkYXRlIHNldFxuICAgICAgICAgc3BlbnRfY2VudHMgPSBleGNsdWRlZC5zcGVudF9jZW50cyxcbiAgICAgICAgIGlucHV0X3Rva2VucyA9IGV4Y2x1ZGVkLmlucHV0X3Rva2VucyxcbiAgICAgICAgIG91dHB1dF90b2tlbnMgPSBleGNsdWRlZC5vdXRwdXRfdG9rZW5zLFxuICAgICAgICAgY2FsbHMgPSBleGNsdWRlZC5jYWxscyxcbiAgICAgICAgIHVwZGF0ZWRfYXQgPSBub3coKWAsXG4gICAgICBbYXBpX2tleV9pZCwgY3VzdG9tZXJfaWQsIG1vbnRoLCByb3cuc3BlbnRfY2VudHMgfHwgMCwgcm93LmlucHV0X3Rva2VucyB8fCAwLCByb3cub3V0cHV0X3Rva2VucyB8fCAwLCByb3cuY2FsbHMgfHwgMF1cbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIHJvdztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVmZmVjdGl2ZUNhcENlbnRzKGtleVJvdywgcm9sbHVwKSB7XG4gIGNvbnN0IGJhc2UgPSBrZXlSb3cua2V5X2NhcF9jZW50cyA/PyBrZXlSb3cuY3VzdG9tZXJfY2FwX2NlbnRzO1xuICBjb25zdCBleHRyYSA9IHJvbGx1cC5leHRyYV9jZW50cyB8fCAwO1xuICByZXR1cm4gKGJhc2UgfHwgMCkgKyBleHRyYTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1c3RvbWVyQ2FwQ2VudHMoa2V5Um93LCBjdXN0b21lclJvbGx1cCkge1xuICBjb25zdCBiYXNlID0ga2V5Um93LmN1c3RvbWVyX2NhcF9jZW50cyB8fCAwO1xuICBjb25zdCBleHRyYSA9IGN1c3RvbWVyUm9sbHVwLmV4dHJhX2NlbnRzIHx8IDA7XG4gIHJldHVybiBiYXNlICsgZXh0cmE7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBrZXlDYXBDZW50cyhrZXlSb3csIGN1c3RvbWVyUm9sbHVwKSB7XG4gIC8vIElmIGEga2V5IG92ZXJyaWRlIGV4aXN0cywgaXQncyBhIGhhcmQgY2FwIGZvciB0aGF0IGtleS4gT3RoZXJ3aXNlIGl0IGluaGVyaXRzIHRoZSBjdXN0b21lciBjYXAuXG4gIGlmIChrZXlSb3cua2V5X2NhcF9jZW50cyAhPSBudWxsKSByZXR1cm4ga2V5Um93LmtleV9jYXBfY2VudHM7XG4gIHJldHVybiBjdXN0b21lckNhcENlbnRzKGtleVJvdywgY3VzdG9tZXJSb2xsdXApO1xufVxuXG5cbmNvbnN0IFJPTEVfT1JERVIgPSBbXCJ2aWV3ZXJcIixcImRlcGxveWVyXCIsXCJhZG1pblwiLFwib3duZXJcIl07XG5cbmV4cG9ydCBmdW5jdGlvbiByb2xlQXRMZWFzdChhY3R1YWwsIHJlcXVpcmVkKSB7XG4gIGNvbnN0IGEgPSBST0xFX09SREVSLmluZGV4T2YoKGFjdHVhbCB8fCBcImRlcGxveWVyXCIpLnRvTG93ZXJDYXNlKCkpO1xuICBjb25zdCByID0gUk9MRV9PUkRFUi5pbmRleE9mKChyZXF1aXJlZCB8fCBcImRlcGxveWVyXCIpLnRvTG93ZXJDYXNlKCkpO1xuICByZXR1cm4gYSA+PSByICYmIGEgIT09IC0xICYmIHIgIT09IC0xO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVxdWlyZUtleVJvbGUoa2V5Um93LCByZXF1aXJlZFJvbGUpIHtcbiAgY29uc3QgYWN0dWFsID0gKGtleVJvdz8ucm9sZSB8fCBcImRlcGxveWVyXCIpLnRvTG93ZXJDYXNlKCk7XG4gIGlmICghcm9sZUF0TGVhc3QoYWN0dWFsLCByZXF1aXJlZFJvbGUpKSB7XG4gICAgY29uc3QgZXJyID0gbmV3IEVycm9yKFwiRm9yYmlkZGVuXCIpO1xuICAgIGVyci5zdGF0dXMgPSA0MDM7XG4gICAgZXJyLmNvZGUgPSBcIkZPUkJJRERFTlwiO1xuICAgIGVyci5oaW50ID0gYFJlcXVpcmVzIHJvbGUgJyR7cmVxdWlyZWRSb2xlfScsIGJ1dCBrZXkgcm9sZSBpcyAnJHthY3R1YWx9Jy5gO1xuICAgIHRocm93IGVycjtcbiAgfVxufVxuIiwgImltcG9ydCB7IHEgfSBmcm9tIFwiLi9kYi5qc1wiO1xuXG4vKipcbiAqIEJlc3QtZWZmb3J0IGF1ZGl0IGxvZzogZmFpbHVyZXMgbmV2ZXIgYnJlYWsgdGhlIG1haW4gcmVxdWVzdC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGF1ZGl0KGFjdG9yLCBhY3Rpb24sIHRhcmdldCA9IG51bGwsIG1ldGEgPSB7fSkge1xuICB0cnkge1xuICAgIGF3YWl0IHEoXG4gICAgICBgaW5zZXJ0IGludG8gYXVkaXRfZXZlbnRzKGFjdG9yLCBhY3Rpb24sIHRhcmdldCwgbWV0YSkgdmFsdWVzICgkMSwkMiwkMywkNDo6anNvbmIpYCxcbiAgICAgIFthY3RvciwgYWN0aW9uLCB0YXJnZXQsIEpTT04uc3RyaW5naWZ5KG1ldGEgfHwge30pXVxuICAgICk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zb2xlLndhcm4oXCJhdWRpdCBmYWlsZWQ6XCIsIGU/Lm1lc3NhZ2UgfHwgZSk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBxIH0gZnJvbSBcIi4vZGIuanNcIjtcbmltcG9ydCB7IGVuY3J5cHRTZWNyZXQsIGRlY3J5cHRTZWNyZXQgfSBmcm9tIFwiLi9jcnlwdG8uanNcIjtcblxuLyoqXG4gKiBQZXItY3VzdG9tZXIgTmV0bGlmeSBBUEkgdG9rZW5zIChlbnRlcnByaXNlIGJvdW5kYXJ5KS5cbiAqXG4gKiAtIFN0b3JlZCBlbmNyeXB0ZWQgaW4gTmV0bGlmeSBEQi5cbiAqIC0gVXNlZCBieSBLYWl4dVB1c2ggdG8gY3JlYXRlIGRlcGxveXMvdXBsb2FkcyBpbiB0aGUgY3VzdG9tZXIncyBOZXRsaWZ5IGFjY291bnQuXG4gKiAtIEZhbGxzIGJhY2sgdG8gcHJvY2Vzcy5lbnYuTkVUTElGWV9BVVRIX1RPS0VOIGlmIG5vIGN1c3RvbWVyIHRva2VuIGV4aXN0cyAoYmFjay1jb21wYXQpLlxuICovXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXROZXRsaWZ5VG9rZW5Gb3JDdXN0b21lcihjdXN0b21lcl9pZCkge1xuICBjb25zdCByZXMgPSBhd2FpdCBxKGBzZWxlY3QgdG9rZW5fZW5jIGZyb20gY3VzdG9tZXJfbmV0bGlmeV90b2tlbnMgd2hlcmUgY3VzdG9tZXJfaWQ9JDFgLCBbY3VzdG9tZXJfaWRdKTtcbiAgaWYgKHJlcy5yb3dzLmxlbmd0aCkge1xuICAgIGNvbnN0IGRlYyA9IGRlY3J5cHRTZWNyZXQocmVzLnJvd3NbMF0udG9rZW5fZW5jKTtcbiAgICBpZiAoZGVjKSByZXR1cm4gZGVjO1xuICB9XG4gIHJldHVybiAocHJvY2Vzcy5lbnYuTkVUTElGWV9BVVRIX1RPS0VOIHx8IFwiXCIpLnRyaW0oKSB8fCBudWxsO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0TmV0bGlmeVRva2VuRm9yQ3VzdG9tZXIoY3VzdG9tZXJfaWQsIHRva2VuX3BsYWluKSB7XG4gIGNvbnN0IGVuYyA9IGVuY3J5cHRTZWNyZXQodG9rZW5fcGxhaW4pO1xuICBhd2FpdCBxKFxuICAgIGBpbnNlcnQgaW50byBjdXN0b21lcl9uZXRsaWZ5X3Rva2VucyhjdXN0b21lcl9pZCwgdG9rZW5fZW5jLCBjcmVhdGVkX2F0LCB1cGRhdGVkX2F0KVxuICAgICB2YWx1ZXMgKCQxLCQyLG5vdygpLG5vdygpKVxuICAgICBvbiBjb25mbGljdCAoY3VzdG9tZXJfaWQpXG4gICAgIGRvIHVwZGF0ZSBzZXQgdG9rZW5fZW5jPWV4Y2x1ZGVkLnRva2VuX2VuYywgdXBkYXRlZF9hdD1ub3coKWAsXG4gICAgW2N1c3RvbWVyX2lkLCBlbmNdXG4gICk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjbGVhck5ldGxpZnlUb2tlbkZvckN1c3RvbWVyKGN1c3RvbWVyX2lkKSB7XG4gIGF3YWl0IHEoYGRlbGV0ZSBmcm9tIGN1c3RvbWVyX25ldGxpZnlfdG9rZW5zIHdoZXJlIGN1c3RvbWVyX2lkPSQxYCwgW2N1c3RvbWVyX2lkXSk7XG59XG4iLCAiZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZVBhdGgoaW5wdXQpIHtcbiAgbGV0IHAgPSBTdHJpbmcoaW5wdXQgfHwgXCJcIikudHJpbSgpO1xuXG4gIC8vIE5vcm1hbGl6ZSBzbGFzaGVzXG4gIHAgPSBwLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpO1xuXG4gIC8vIERpc2FsbG93IFVSTCBmcmFnbWVudHMvcXVlcmllc1xuICBpZiAocC5pbmNsdWRlcyhcIiNcIikgfHwgcC5pbmNsdWRlcyhcIj9cIikpIHtcbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXCJGaWxlIHBhdGhzIG11c3Qgbm90IGluY2x1ZGUgJyMnIG9yICc/J1wiKTtcbiAgICBlcnIuY29kZSA9IFwiQkFEX1BBVEhcIjtcbiAgICBlcnIuc3RhdHVzID0gNDAwO1xuICAgIHRocm93IGVycjtcbiAgfVxuXG4gIC8vIEZvcmNlIGFic29sdXRlXG4gIGlmICghcC5zdGFydHNXaXRoKFwiL1wiKSkgcCA9IFwiL1wiICsgcDtcblxuICAvLyBDb2xsYXBzZSBkdXBsaWNhdGUgc2xhc2hlc1xuICBwID0gXCIvXCIgKyBwLnNsaWNlKDEpLnJlcGxhY2UoL1xcL3syLH0vZywgXCIvXCIpO1xuXG4gIC8vIE5vIGNvbnRyb2wgY2hhcnNcbiAgaWYgKC9bXFx4MDAtXFx4MUZcXHg3Rl0vLnRlc3QocCkpIHtcbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXCJGaWxlIHBhdGggY29udGFpbnMgY29udHJvbCBjaGFyYWN0ZXJzXCIpO1xuICAgIGVyci5jb2RlID0gXCJCQURfUEFUSFwiO1xuICAgIGVyci5zdGF0dXMgPSA0MDA7XG4gICAgdGhyb3cgZXJyO1xuICB9XG5cbiAgLy8gTm8gdHJhaWxpbmcgc2xhc2ggKGZpbGVzIG9ubHkpXG4gIGlmIChwLmxlbmd0aCA+IDEgJiYgcC5lbmRzV2l0aChcIi9cIikpIHtcbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXCJGaWxlIHBhdGggbXVzdCBub3QgZW5kIHdpdGggJy8nXCIpO1xuICAgIGVyci5jb2RlID0gXCJCQURfUEFUSFwiO1xuICAgIGVyci5zdGF0dXMgPSA0MDA7XG4gICAgdGhyb3cgZXJyO1xuICB9XG5cbiAgLy8gRm9yYmlkIHRyYXZlcnNhbCAvIGRvdCBzZWdtZW50c1xuICBjb25zdCBzZWdzID0gcC5zcGxpdChcIi9cIik7XG4gIGZvciAoY29uc3Qgc2VnIG9mIHNlZ3MpIHtcbiAgICBpZiAoc2VnID09PSBcIi4uXCIgfHwgc2VnID09PSBcIi5cIikge1xuICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKFwiRmlsZSBwYXRoIG11c3Qgbm90IGluY2x1ZGUgJy4nIG9yICcuLicgc2VnbWVudHNcIik7XG4gICAgICBlcnIuY29kZSA9IFwiQkFEX1BBVEhcIjtcbiAgICAgIGVyci5zdGF0dXMgPSA0MDA7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIC8vIEZvcmJpZCBXaW5kb3dzLXJlc2VydmVkIGFuZCBvdGhlciBkYW5nZXJvdXMgY2hhcmFjdGVycyBpbiBzZWdtZW50c1xuICAgIGlmICgvWzw+OlwifCpdLy50ZXN0KHNlZykpIHtcbiAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcIkZpbGUgcGF0aCBjb250YWlucyBpbnZhbGlkIGNoYXJhY3RlcnNcIik7XG4gICAgICBlcnIuY29kZSA9IFwiQkFEX1BBVEhcIjtcbiAgICAgIGVyci5zdGF0dXMgPSA0MDA7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICB9XG5cbiAgLy8gUmVhc29uYWJsZSBsZW5ndGggZ3VhcmRcbiAgaWYgKHAubGVuZ3RoID4gMTAyNCkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcIkZpbGUgcGF0aCB0b28gbG9uZ1wiKTtcbiAgICBlcnIuY29kZSA9IFwiQkFEX1BBVEhcIjtcbiAgICBlcnIuc3RhdHVzID0gNDAwO1xuICAgIHRocm93IGVycjtcbiAgfVxuXG4gIHJldHVybiBwO1xufVxuIiwgImltcG9ydCB7IG5vcm1hbGl6ZVBhdGggfSBmcm9tIFwiLi9wdXNoUGF0aE5vcm1hbGl6ZS5qc1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gZW5jb2RlVVJJQ29tcG9uZW50U2FmZVBhdGgocGF0aFdpdGhMZWFkaW5nU2xhc2gpIHtcbiAgY29uc3QgcCA9IG5vcm1hbGl6ZVBhdGgocGF0aFdpdGhMZWFkaW5nU2xhc2gpO1xuICBjb25zdCBwYXJ0cyA9IHAuc2xpY2UoMSkuc3BsaXQoXCIvXCIpLm1hcCgoc2VnKSA9PiBlbmNvZGVVUklDb21wb25lbnQoc2VnKSk7XG4gIHJldHVybiBwYXJ0cy5qb2luKFwiL1wiKTtcbn1cbiIsICJpbXBvcnQgeyBzbGVlcCB9IGZyb20gXCIuL2h0dHAuanNcIjtcbmltcG9ydCB7IGVuY29kZVVSSUNvbXBvbmVudFNhZmVQYXRoIH0gZnJvbSBcIi4vcHVzaFBhdGguanNcIjtcblxuY29uc3QgQVBJID0gXCJodHRwczovL2FwaS5uZXRsaWZ5LmNvbS9hcGkvdjFcIjtcblxuZnVuY3Rpb24gdG9rZW4obmV0bGlmeV90b2tlbikge1xuICBjb25zdCB0ID0gKG5ldGxpZnlfdG9rZW4gfHwgcHJvY2Vzcy5lbnYuTkVUTElGWV9BVVRIX1RPS0VOIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpO1xuICBpZiAoIXQpIHtcbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXCJNaXNzaW5nIE5ldGxpZnkgdG9rZW5cIik7XG4gICAgZXJyLmNvZGUgPSBcIkNPTkZJR1wiO1xuICAgIGVyci5zdGF0dXMgPSA1MDA7XG4gICAgZXJyLmhpbnQgPSBcIlNldCBhIHBlci1jdXN0b21lciBOZXRsaWZ5IHRva2VuIChyZWNvbW1lbmRlZCkgb3Igc2V0IE5FVExJRllfQVVUSF9UT0tFTiBpbiBOZXRsaWZ5IGVudiB2YXJzLlwiO1xuICAgIHRocm93IGVycjtcbiAgfVxuICByZXR1cm4gdDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gbmZGZXRjaCh1cmwsIGluaXQgPSB7fSwgbmV0bGlmeV90b2tlbiA9IG51bGwpIHtcbiAgY29uc3QgbWV0aG9kID0gKChpbml0Lm1ldGhvZCB8fCBcIkdFVFwiKSArIFwiXCIpLnRvVXBwZXJDYXNlKCk7XG4gIGNvbnN0IGJvZHkgPSBpbml0LmJvZHk7XG5cbiAgY29uc3QgaXNXZWJSZWFkYWJsZVN0cmVhbSA9IGJvZHkgJiYgdHlwZW9mIGJvZHkgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIGJvZHkuZ2V0UmVhZGVyID09PSBcImZ1bmN0aW9uXCI7XG4gIGNvbnN0IGlzQnVmZmVyID0gdHlwZW9mIEJ1ZmZlciAhPT0gXCJ1bmRlZmluZWRcIiAmJiBCdWZmZXIuaXNCdWZmZXIoYm9keSk7XG4gIGNvbnN0IGlzVWludDggPSBib2R5IGluc3RhbmNlb2YgVWludDhBcnJheTtcbiAgY29uc3QgaXNBcnJheUJ1ZmZlciA9IGJvZHkgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcjtcbiAgY29uc3QgaXNTdHJpbmcgPSB0eXBlb2YgYm9keSA9PT0gXCJzdHJpbmdcIjtcblxuICAvLyBPbmx5IHJldHJ5IGlkZW1wb3RlbnQtaXNoIHJlcXVlc3RzIHdoZXJlIHRoZSBib2R5IGNhbiBiZSBzYWZlbHkgcmVwbGF5ZWQuXG4gIC8vIC0gR0VUL0hFQUQ6IHNhZmVcbiAgLy8gLSBQVVQgd2l0aCBCdWZmZXIvVWludDhBcnJheS9BcnJheUJ1ZmZlci9zdHJpbmc6IHNhZmUtaXNoXG4gIC8vIC0gU3RyZWFtczogTk9UIHNhZmVseSByZXBsYXlhYmxlLCBzbyBubyByZXRyaWVzLlxuICBjb25zdCBjYW5SZXBsYXlCb2R5ID0gIWJvZHkgfHwgaXNCdWZmZXIgfHwgaXNVaW50OCB8fCBpc0FycmF5QnVmZmVyIHx8IGlzU3RyaW5nO1xuICBjb25zdCBjYW5SZXRyeSA9IChtZXRob2QgPT09IFwiR0VUXCIgfHwgbWV0aG9kID09PSBcIkhFQURcIiB8fCAobWV0aG9kID09PSBcIlBVVFwiICYmIGNhblJlcGxheUJvZHkpKSAmJiAhaXNXZWJSZWFkYWJsZVN0cmVhbTtcblxuICBjb25zdCBtYXhBdHRlbXB0cyA9IGNhblJldHJ5ID8gNSA6IDE7XG5cbiAgZm9yIChsZXQgYXR0ZW1wdCA9IDE7IGF0dGVtcHQgPD0gbWF4QXR0ZW1wdHM7IGF0dGVtcHQrKykge1xuICAgIGNvbnN0IGhlYWRlcnMgPSB7XG4gICAgICBhdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dG9rZW4obmV0bGlmeV90b2tlbil9YCxcbiAgICAgIC4uLihpbml0LmhlYWRlcnMgfHwge30pXG4gICAgfTtcblxuICAgIGxldCByZXM7XG4gICAgbGV0IHRleHQgPSBcIlwiO1xuICAgIGxldCBkYXRhID0gbnVsbDtcblxuICAgIHRyeSB7XG4gICAgICByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHsgLi4uaW5pdCwgaGVhZGVycyB9KTtcbiAgICAgIHRleHQgPSBhd2FpdCByZXMudGV4dCgpO1xuICAgICAgdHJ5IHsgZGF0YSA9IEpTT04ucGFyc2UodGV4dCk7IH0gY2F0Y2gge31cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBOZXR3b3JrLWxldmVsIGZhaWx1cmU7IHJldHJ5IGlmIGFsbG93ZWQuXG4gICAgICBpZiAoY2FuUmV0cnkgJiYgYXR0ZW1wdCA8IG1heEF0dGVtcHRzKSB7XG4gICAgICAgIGNvbnN0IGJhY2tvZmYgPSBNYXRoLm1pbig4MDAwLCAyNTAgKiBNYXRoLnBvdygyLCBhdHRlbXB0IC0gMSkgKyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxNTApKTtcbiAgICAgICAgYXdhaXQgc2xlZXAoYmFja29mZik7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKFwiTmV0bGlmeSBBUEkgZmV0Y2ggZmFpbGVkXCIpO1xuICAgICAgZXJyLmNvZGUgPSBcIk5FVExJRllfRkVUQ0hcIjtcbiAgICAgIGVyci5zdGF0dXMgPSA1MDI7XG4gICAgICBlcnIuZGV0YWlsID0gU3RyaW5nKGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogZSk7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuXG4gICAgaWYgKHJlcy5vaykgcmV0dXJuIGRhdGEgPz8gdGV4dDtcblxuICAgIGNvbnN0IHN0YXR1cyA9IHJlcy5zdGF0dXM7XG4gICAgY29uc3QgcmV0cnlhYmxlID0gc3RhdHVzID09PSA0MjkgfHwgc3RhdHVzID09PSA1MDIgfHwgc3RhdHVzID09PSA1MDMgfHwgc3RhdHVzID09PSA1MDQ7XG5cbiAgICBpZiAoY2FuUmV0cnkgJiYgcmV0cnlhYmxlICYmIGF0dGVtcHQgPCBtYXhBdHRlbXB0cykge1xuICAgICAgLy8gUmVzcGVjdCBSZXRyeS1BZnRlciBpZiBwcmVzZW50IChzZWNvbmRzKS5cbiAgICAgIGNvbnN0IHJhID0gcmVzLmhlYWRlcnMuZ2V0KFwicmV0cnktYWZ0ZXJcIik7XG4gICAgICBsZXQgd2FpdE1zID0gMDtcbiAgICAgIGNvbnN0IHNlYyA9IHJhID8gcGFyc2VJbnQocmEsIDEwKSA6IE5hTjtcbiAgICAgIGlmIChOdW1iZXIuaXNGaW5pdGUoc2VjKSAmJiBzZWMgPj0gMCkgd2FpdE1zID0gTWF0aC5taW4oMTUwMDAsIHNlYyAqIDEwMDApO1xuICAgICAgaWYgKCF3YWl0TXMpIHdhaXRNcyA9IE1hdGgubWluKDE1MDAwLCAzMDAgKiBNYXRoLnBvdygyLCBhdHRlbXB0IC0gMSkgKyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAyMDApKTtcbiAgICAgIGF3YWl0IHNsZWVwKHdhaXRNcyk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoYE5ldGxpZnkgQVBJIGVycm9yICR7c3RhdHVzfWApO1xuICAgIGVyci5jb2RlID0gXCJORVRMSUZZX0FQSVwiO1xuICAgIGVyci5zdGF0dXMgPSBzdGF0dXM7XG4gICAgZXJyLmRldGFpbCA9IGRhdGEgfHwgdGV4dDtcbiAgICB0aHJvdyBlcnI7XG4gIH1cbn1cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVEaWdlc3REZXBsb3koeyBzaXRlX2lkLCBicmFuY2gsIHRpdGxlLCBmaWxlcywgbmV0bGlmeV90b2tlbiA9IG51bGwgfSkge1xuICBjb25zdCBjbGVhbkZpbGVzID0ge307XG4gIGZvciAoY29uc3QgW3AsIHNoYV0gb2YgT2JqZWN0LmVudHJpZXMoZmlsZXMgfHwge30pKSB7XG4gICAgY29uc3QgayA9IChwICYmIHBbMF0gPT09IFwiL1wiKSA/IHAuc2xpY2UoMSkgOiBTdHJpbmcocCB8fCBcIlwiKTtcbiAgICBpZiAoaykgY2xlYW5GaWxlc1trXSA9IHNoYTtcbiAgfVxuICBjb25zdCBmaWxlc0Zvck5ldGxpZnkgPSBjbGVhbkZpbGVzO1xuICBjb25zdCBxcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoKTtcbiAgaWYgKGJyYW5jaCkgcXMuc2V0KFwiYnJhbmNoXCIsIGJyYW5jaCk7XG4gIGlmICh0aXRsZSkgcXMuc2V0KFwidGl0bGVcIiwgdGl0bGUpO1xuICBjb25zdCB1cmwgPSBgJHtBUEl9L3NpdGVzLyR7ZW5jb2RlVVJJQ29tcG9uZW50KHNpdGVfaWQpfS9kZXBsb3lzPyR7cXMudG9TdHJpbmcoKX1gO1xuICByZXR1cm4gbmZGZXRjaCh1cmwsIHtcbiAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgIGhlYWRlcnM6IHsgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGFzeW5jOiB0cnVlLCBkcmFmdDogZmFsc2UsIGZpbGVzOiBmaWxlc0Zvck5ldGxpZnkgfSlcbiAgfSwgbmV0bGlmeV90b2tlbik7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRTaXRlRGVwbG95KHsgc2l0ZV9pZCwgZGVwbG95X2lkLCBuZXRsaWZ5X3Rva2VuID0gbnVsbCB9KSB7XG4gIGNvbnN0IHVybCA9IGAke0FQSX0vc2l0ZXMvJHtlbmNvZGVVUklDb21wb25lbnQoc2l0ZV9pZCl9L2RlcGxveXMvJHtlbmNvZGVVUklDb21wb25lbnQoZGVwbG95X2lkKX1gO1xuICByZXR1cm4gbmZGZXRjaCh1cmwsIHsgbWV0aG9kOiBcIkdFVFwiIH0sIG5ldGxpZnlfdG9rZW4pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0RGVwbG95KHsgZGVwbG95X2lkLCBuZXRsaWZ5X3Rva2VuID0gbnVsbCB9KSB7XG4gIGNvbnN0IHVybCA9IGAke0FQSX0vZGVwbG95cy8ke2VuY29kZVVSSUNvbXBvbmVudChkZXBsb3lfaWQpfWA7XG4gIHJldHVybiBuZkZldGNoKHVybCwgeyBtZXRob2Q6IFwiR0VUXCIgfSwgbmV0bGlmeV90b2tlbik7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwdXREZXBsb3lGaWxlKHsgZGVwbG95X2lkLCBkZXBsb3lfcGF0aCwgYm9keSwgbmV0bGlmeV90b2tlbiA9IG51bGwgfSkge1xuICBjb25zdCBlbmNvZGVkID0gZW5jb2RlVVJJQ29tcG9uZW50U2FmZVBhdGgoZGVwbG95X3BhdGgpO1xuICBjb25zdCB1cmwgPSBgJHtBUEl9L2RlcGxveXMvJHtlbmNvZGVVUklDb21wb25lbnQoZGVwbG95X2lkKX0vZmlsZXMvJHtlbmNvZGVkfWA7XG4gIHJldHVybiBuZkZldGNoKHVybCwge1xuICAgIG1ldGhvZDogXCJQVVRcIixcbiAgICBoZWFkZXJzOiB7IFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtXCIgfSxcbiAgICBib2R5LFxuICAgIGR1cGxleDogXCJoYWxmXCJcbiAgfSwgbmV0bGlmeV90b2tlbik7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwb2xsRGVwbG95VW50aWwoeyBzaXRlX2lkLCBkZXBsb3lfaWQsIHRpbWVvdXRfbXMgPSA2MDAwMCwgbmV0bGlmeV90b2tlbiA9IG51bGwgfSkge1xuICBjb25zdCBzdGFydCA9IERhdGUubm93KCk7XG4gIGxldCBkID0gYXdhaXQgZ2V0U2l0ZURlcGxveSh7IHNpdGVfaWQsIGRlcGxveV9pZCwgbmV0bGlmeV90b2tlbiB9KTtcbiAgd2hpbGUgKERhdGUubm93KCkgLSBzdGFydCA8IHRpbWVvdXRfbXMpIHtcbiAgICBjb25zdCBzdCA9IGQ/LnN0YXRlIHx8IFwiXCI7XG4gICAgY29uc3QgaGFzUmVxID0gQXJyYXkuaXNBcnJheShkPy5yZXF1aXJlZCkgJiYgZC5yZXF1aXJlZC5sZW5ndGggPiAwO1xuICAgIGlmIChzdCA9PT0gXCJyZWFkeVwiIHx8IHN0ID09PSBcImVycm9yXCIgfHwgaGFzUmVxIHx8IChzdCAmJiBzdCAhPT0gXCJwcmVwYXJpbmdcIikpIHJldHVybiBkO1xuICAgIGF3YWl0IHNsZWVwKDEyMDApO1xuICAgIGQgPSBhd2FpdCBnZXRTaXRlRGVwbG95KHsgc2l0ZV9pZCwgZGVwbG95X2lkLCBuZXRsaWZ5X3Rva2VuIH0pO1xuICB9XG4gIHJldHVybiBkO1xufVxuIiwgImltcG9ydCB7IHEgfSBmcm9tIFwiLi9kYi5qc1wiO1xuXG5mdW5jdGlvbiBtb250aFJhbmdlVVRDKG1vbnRoKSB7XG4gIGNvbnN0IFt5LCBtXSA9IFN0cmluZyhtb250aCB8fCBcIlwiKS5zcGxpdChcIi1cIikubWFwKCh4KSA9PiBwYXJzZUludCh4LCAxMCkpO1xuICBpZiAoIXkgfHwgIW0gfHwgbSA8IDEgfHwgbSA+IDEyKSByZXR1cm4gbnVsbDtcbiAgY29uc3Qgc3RhcnQgPSBuZXcgRGF0ZShEYXRlLlVUQyh5LCBtIC0gMSwgMSwgMCwgMCwgMCkpO1xuICBjb25zdCBlbmQgPSBuZXcgRGF0ZShEYXRlLlVUQyh5LCBtLCAxLCAwLCAwLCAwKSk7XG4gIHJldHVybiB7IHN0YXJ0LCBlbmQgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFB1c2hQcmljaW5nKGN1c3RvbWVyX2lkKSB7XG4gIGxldCBwdiA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBiLnByaWNpbmdfdmVyc2lvbiwgYi5tb250aGx5X2NhcF9jZW50cyxcbiAgICAgICAgICAgIHAuYmFzZV9tb250aF9jZW50cywgcC5wZXJfZGVwbG95X2NlbnRzLCBwLnBlcl9nYl9jZW50cywgcC5jdXJyZW5jeVxuICAgICBmcm9tIGN1c3RvbWVyX3B1c2hfYmlsbGluZyBiXG4gICAgIGpvaW4gcHVzaF9wcmljaW5nX3ZlcnNpb25zIHAgb24gcC52ZXJzaW9uID0gYi5wcmljaW5nX3ZlcnNpb25cbiAgICAgd2hlcmUgYi5jdXN0b21lcl9pZD0kMVxuICAgICBsaW1pdCAxYCxcbiAgICBbY3VzdG9tZXJfaWRdXG4gICk7XG5cbiAgaWYgKCFwdi5yb3dDb3VudCkge1xuICAgIHB2ID0gYXdhaXQgcShcbiAgICAgIGBzZWxlY3QgMSBhcyBwcmljaW5nX3ZlcnNpb24sIDAgYXMgbW9udGhseV9jYXBfY2VudHMsXG4gICAgICAgICAgICAgIGJhc2VfbW9udGhfY2VudHMsIHBlcl9kZXBsb3lfY2VudHMsIHBlcl9nYl9jZW50cywgY3VycmVuY3lcbiAgICAgICBmcm9tIHB1c2hfcHJpY2luZ192ZXJzaW9ucyB3aGVyZSB2ZXJzaW9uPTEgbGltaXQgMWAsXG4gICAgICBbXVxuICAgICk7XG4gIH1cbiAgcmV0dXJuIHB2LnJvd0NvdW50ID8gcHYucm93c1swXSA6IG51bGw7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFB1c2hVc2FnZShjdXN0b21lcl9pZCwgcmFuZ2UpIHtcbiAgY29uc3QgdXNhZ2UgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3RcbiAgICAgICAgY291bnQoKikgZmlsdGVyICh3aGVyZSBldmVudF90eXBlPSdkZXBsb3lfcmVhZHknKTo6aW50IGFzIGRlcGxveXNfcmVhZHksXG4gICAgICAgIGNvdW50KCopIGZpbHRlciAod2hlcmUgZXZlbnRfdHlwZT0nZGVwbG95X2luaXQnKTo6aW50IGFzIGRlcGxveXNfaW5pdCxcbiAgICAgICAgY29hbGVzY2Uoc3VtKGJ5dGVzKSBmaWx0ZXIgKHdoZXJlIGV2ZW50X3R5cGU9J2ZpbGVfdXBsb2FkJyksMCk6OmJpZ2ludCBhcyBieXRlc191cGxvYWRlZFxuICAgICBmcm9tIHB1c2hfdXNhZ2VfZXZlbnRzXG4gICAgIHdoZXJlIGN1c3RvbWVyX2lkPSQxIGFuZCBjcmVhdGVkX2F0ID49ICQyIGFuZCBjcmVhdGVkX2F0IDwgJDNgLFxuICAgIFtjdXN0b21lcl9pZCwgcmFuZ2Uuc3RhcnQudG9JU09TdHJpbmcoKSwgcmFuZ2UuZW5kLnRvSVNPU3RyaW5nKCldXG4gICk7XG4gIHJldHVybiB1c2FnZS5yb3dzWzBdIHx8IHsgZGVwbG95c19yZWFkeTogMCwgZGVwbG95c19pbml0OiAwLCBieXRlc191cGxvYWRlZDogMCB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRTdGFnZWRCeXRlcyhjdXN0b21lcl9pZCwgcmFuZ2UpIHtcbiAgLy8gQ291bnQgYnl0ZXMgc3RhZ2VkIGluIGNodW5rIGpvYnMgdGhhdCBoYXZlIG5vdCBiZWVuIGNvbXBsZXRlZC9jbGVhcmVkLlxuICBjb25zdCByZXMgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3QgY29hbGVzY2Uoc3VtKGouYnl0ZXNfc3RhZ2VkKSwwKTo6YmlnaW50IGFzIGJ5dGVzX3N0YWdlZFxuICAgICBmcm9tIHB1c2hfam9icyBqXG4gICAgIGpvaW4gcHVzaF9wdXNoZXMgcCBvbiBwLmlkPWoucHVzaF9yb3dfaWRcbiAgICAgd2hlcmUgcC5jdXN0b21lcl9pZD0kMVxuICAgICAgIGFuZCBwLmNyZWF0ZWRfYXQgPj0gJDIgYW5kIHAuY3JlYXRlZF9hdCA8ICQzXG4gICAgICAgYW5kIGouc3RhdHVzIGluICgndXBsb2FkaW5nJywncXVldWVkJywnYXNzZW1ibGluZycpYCxcbiAgICBbY3VzdG9tZXJfaWQsIHJhbmdlLnN0YXJ0LnRvSVNPU3RyaW5nKCksIHJhbmdlLmVuZC50b0lTT1N0cmluZygpXVxuICApO1xuICByZXR1cm4gTnVtYmVyKHJlcy5yb3dzWzBdPy5ieXRlc19zdGFnZWQgfHwgMCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbmZvcmNlUHVzaENhcCh7IGN1c3RvbWVyX2lkLCBtb250aCwgZXh0cmFfZGVwbG95cyA9IDAsIGV4dHJhX2J5dGVzID0gMCB9KSB7XG4gIGNvbnN0IHJhbmdlID0gbW9udGhSYW5nZVVUQyhtb250aCk7XG4gIGlmICghcmFuZ2UpIHtcbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXCJJbnZhbGlkIG1vbnRoIChZWVlZLU1NKVwiKTtcbiAgICBlcnIuY29kZSA9IFwiQkFEX01PTlRIXCI7XG4gICAgZXJyLnN0YXR1cyA9IDQwMDtcbiAgICB0aHJvdyBlcnI7XG4gIH1cblxuICBjb25zdCBjZmcgPSBhd2FpdCBnZXRQdXNoUHJpY2luZyhjdXN0b21lcl9pZCk7XG4gIGlmICghY2ZnKSByZXR1cm4geyBvazogdHJ1ZSwgY2ZnOiBudWxsIH07IC8vIElmIHB1c2ggcHJpY2luZyBub3QgY29uZmlndXJlZCwgZG9uJ3QgYmxvY2suXG5cbiAgY29uc3QgY2FwID0gTnVtYmVyKGNmZy5tb250aGx5X2NhcF9jZW50cyB8fCAwKTtcbiAgaWYgKCFjYXAgfHwgY2FwIDw9IDApIHJldHVybiB7IG9rOiB0cnVlLCBjZmcgfTsgLy8gY2FwPTAgPT4gdW5saW1pdGVkXG5cbiAgY29uc3QgdXNhZ2UgPSBhd2FpdCBnZXRQdXNoVXNhZ2UoY3VzdG9tZXJfaWQsIHJhbmdlKTtcbiAgY29uc3Qgc3RhZ2VkID0gYXdhaXQgZ2V0U3RhZ2VkQnl0ZXMoY3VzdG9tZXJfaWQsIHJhbmdlKTtcblxuICBjb25zdCBkZXBsb3lzX2luaXQgPSBOdW1iZXIodXNhZ2UuZGVwbG95c19pbml0IHx8IDApO1xuICBjb25zdCBkZXBsb3lzX3JlYWR5ID0gTnVtYmVyKHVzYWdlLmRlcGxveXNfcmVhZHkgfHwgMCk7XG4gIGNvbnN0IGRlcGxveXNfcmVzZXJ2ZWQgPSBNYXRoLm1heCgwLCBkZXBsb3lzX2luaXQgLSBkZXBsb3lzX3JlYWR5KTsgLy8gaW4tcHJvZ3Jlc3MgLyBhdHRlbXB0ZWQgZGVwbG95c1xuICBjb25zdCBkZXBsb3lzX3VzZWQgPSBkZXBsb3lzX3JlYWR5ICsgZGVwbG95c19yZXNlcnZlZCArIE51bWJlcihleHRyYV9kZXBsb3lzIHx8IDApO1xuICBjb25zdCBieXRlc190b3RhbCA9IE51bWJlcih1c2FnZS5ieXRlc191cGxvYWRlZCB8fCAwKSArIE51bWJlcihzdGFnZWQgfHwgMCkgKyBOdW1iZXIoZXh0cmFfYnl0ZXMgfHwgMCk7XG5cbiAgY29uc3QgZ2IgPSBieXRlc190b3RhbCAvIDEwNzM3NDE4MjQ7IC8vIEdpQlxuICBjb25zdCBiYXNlID0gTnVtYmVyKGNmZy5iYXNlX21vbnRoX2NlbnRzIHx8IDApO1xuICBjb25zdCBkZXBsb3lDb3N0ID0gTnVtYmVyKGNmZy5wZXJfZGVwbG95X2NlbnRzIHx8IDApICogZGVwbG95c191c2VkO1xuICBjb25zdCBnYkNvc3QgPSBNYXRoLnJvdW5kKE51bWJlcihjZmcucGVyX2diX2NlbnRzIHx8IDApICogZ2IpO1xuICBjb25zdCB0b3RhbCA9IGJhc2UgKyBkZXBsb3lDb3N0ICsgZ2JDb3N0O1xuXG4gIGlmICh0b3RhbCA+IGNhcCkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcIlB1c2ggbW9udGhseSBjYXAgcmVhY2hlZFwiKTtcbiAgICBlcnIuY29kZSA9IFwiUFVTSF9DQVBfUkVBQ0hFRFwiO1xuICAgIGVyci5zdGF0dXMgPSA0MDI7XG4gICAgZXJyLnBheWxvYWQgPSB7XG4gICAgICBjb2RlOiBcIlBVU0hfQ0FQX1JFQUNIRURcIixcbiAgICAgIG1vbnRoLFxuICAgICAgcHJpY2luZ192ZXJzaW9uOiBjZmcucHJpY2luZ192ZXJzaW9uLFxuICAgICAgbW9udGhseV9jYXBfY2VudHM6IGNhcCxcbiAgICAgIHByb2plY3RlZF90b3RhbF9jZW50czogdG90YWwsXG4gICAgICBjdXJyZW50OiB7XG4gICAgICAgIGRlcGxveXNfaW5pdCxcbiAgICAgICAgZGVwbG95c19yZWFkeSxcbiAgICAgICAgZGVwbG95c19yZXNlcnZlZCxcbiAgICAgICAgYnl0ZXNfdXBsb2FkZWQ6IE51bWJlcih1c2FnZS5ieXRlc191cGxvYWRlZCB8fCAwKSxcbiAgICAgICAgYnl0ZXNfc3RhZ2VkOiBOdW1iZXIoc3RhZ2VkIHx8IDApXG4gICAgICB9LFxuICAgICAgcHJvcG9zZWQ6IHtcbiAgICAgICAgZXh0cmFfZGVwbG95czogTnVtYmVyKGV4dHJhX2RlcGxveXMgfHwgMCksXG4gICAgICAgIGV4dHJhX2J5dGVzOiBOdW1iZXIoZXh0cmFfYnl0ZXMgfHwgMClcbiAgICAgIH1cbiAgICB9O1xuICAgIHRocm93IGVycjtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgb2s6IHRydWUsXG4gICAgY2ZnLFxuICAgIG1vbnRoLFxuICAgIHByb2plY3RlZF90b3RhbF9jZW50czogdG90YWwsXG4gICAgbW9udGhseV9jYXBfY2VudHM6IGNhcCxcbiAgICBjdXJyZW50OiB7XG4gICAgICBkZXBsb3lzX2luaXQsXG4gICAgICBkZXBsb3lzX3JlYWR5LFxuICAgICAgZGVwbG95c19yZXNlcnZlZCxcbiAgICAgIGJ5dGVzX3VwbG9hZGVkOiBOdW1iZXIodXNhZ2UuYnl0ZXNfdXBsb2FkZWQgfHwgMCksXG4gICAgICBieXRlc19zdGFnZWQ6IE51bWJlcihzdGFnZWQgfHwgMClcbiAgICB9XG4gIH07XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7O0FBQUEsT0FBT0EsYUFBWTs7O0FDQVosU0FBUyxVQUFVLEtBQUs7QUFDN0IsUUFBTSxZQUFZLFFBQVEsSUFBSSxtQkFBbUIsSUFBSSxLQUFLO0FBQzFELFFBQU0sWUFBWSxJQUFJLFFBQVEsSUFBSSxRQUFRLEtBQUssSUFBSSxRQUFRLElBQUksUUFBUTtBQUd2RSxRQUFNLGVBQWU7QUFDckIsUUFBTSxlQUFlO0FBRXJCLFFBQU0sT0FBTztBQUFBLElBQ1gsZ0NBQWdDO0FBQUEsSUFDaEMsZ0NBQWdDO0FBQUEsSUFDaEMsaUNB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O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BV0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFXQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVFBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BT0E7QUFBQSxNQUEyRztBQUFBLE1BQzNHO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVlBO0FBQUEsTUFDQTtBQUFBO0FBQUEsTUFHQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFRQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFtQkE7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQStCQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUdBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFNQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1Ba0JBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFlQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU9BO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVlBO0FBQUEsTUFDQTtBQUFB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
