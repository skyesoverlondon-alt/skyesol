
import {createRequire as ___nfyCreateRequire} from "module";
import {fileURLToPath as ___nfyFileURLToPath} from "url";
import {dirname as ___nfyPathDirname} from "path";
let __filename=___nfyFileURLToPath(import.meta.url);
let __dirname=___nfyPathDirname(___nfyFileURLToPath(import.meta.url));
let require=___nfyCreateRequire(import.meta.url);


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
function getInstallId(req) {
  return (req.headers.get("x-kaixu-install-id") || req.headers.get("X-Kaixu-Install-Id") || "").toString().trim().slice(0, 80) || null;
}
function getUserAgent(req) {
  return (req.headers.get("user-agent") || req.headers.get("User-Agent") || "").toString().slice(0, 240);
}
function getClientIp(req) {
  const a = (req.headers.get("x-nf-client-connection-ip") || "").toString().trim();
  if (a) return a;
  const xff = (req.headers.get("x-forwarded-for") || "").toString();
  if (!xff) return null;
  const first = xff.split(",")[0].trim();
  return first || null;
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

// netlify/functions/_lib/ratelimit.js
var _Upstash = null;
var _limiterByLimit = /* @__PURE__ */ new Map();
async function loadUpstash() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (_Upstash) return _Upstash;
  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import("@upstash/ratelimit"),
    import("@upstash/redis")
  ]);
  _Upstash = { Ratelimit, Redis };
  return _Upstash;
}
function isoReset(reset) {
  if (!reset) return null;
  if (typeof reset === "number") return new Date(reset).toISOString();
  if (reset instanceof Date) return reset.toISOString();
  if (typeof reset === "string") return reset;
  try {
    if (typeof reset?.getTime === "function") return new Date(reset.getTime()).toISOString();
  } catch {
  }
  return null;
}
async function enforceRpm({ customerId, apiKeyId, rpmOverride }) {
  const defaultRpm = parseInt(process.env.DEFAULT_RPM_LIMIT || "120", 10);
  const limit = Number.isFinite(rpmOverride) ? rpmOverride : defaultRpm;
  if (!Number.isFinite(limit) || limit <= 0) {
    return { ok: true, remaining: null, reset: null, mode: "off" };
  }
  const up = await loadUpstash();
  if (up) {
    if (!_limiterByLimit.has(limit)) {
      const redis = up.Redis.fromEnv();
      const rl = new up.Ratelimit({
        redis,
        limiter: up.Ratelimit.slidingWindow(limit, "60 s"),
        prefix: "kaixu:rl"
      });
      _limiterByLimit.set(limit, rl);
    }
    const limiter = _limiterByLimit.get(limit);
    const key = `c${customerId}:k${apiKeyId}`;
    const res2 = await limiter.limit(key);
    return {
      ok: !!res2.success,
      remaining: res2.remaining ?? null,
      reset: isoReset(res2.reset),
      mode: "upstash"
    };
  }
  const now = Date.now();
  const windowMs = 6e4;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const reset = new Date(windowStart.getTime() + windowMs);
  const res = await q(
    `insert into rate_limit_windows(customer_id, api_key_id, window_start, count)
     values ($1,$2,$3,1)
     on conflict (customer_id, api_key_id, window_start)
     do update set count = rate_limit_windows.count + 1
     returning count`,
    [customerId, apiKeyId, windowStart]
  );
  const count = res.rows?.[0]?.count ?? 1;
  const remaining = Math.max(0, limit - count);
  if (Math.random() < 0.01) {
    try {
      await q(`delete from rate_limit_windows where window_start < now() - interval '2 hours'`);
    } catch {
    }
  }
  return {
    ok: count <= limit,
    remaining,
    reset: reset.toISOString(),
    mode: "db"
  };
}

// netlify/functions/_lib/alerts.js
function pct(spent, cap) {
  if (!cap || cap <= 0) return 0;
  return spent / cap * 100;
}
async function recordOnce({ customer_id, api_key_id = 0, month, alert_type }) {
  const res = await q(
    `insert into alerts_sent(customer_id, api_key_id, month, alert_type)
     values ($1,$2,$3,$4)
     on conflict (customer_id, api_key_id, month, alert_type) do nothing
     returning customer_id`,
    [customer_id, api_key_id || 0, month, alert_type]
  );
  return res.rowCount > 0;
}
async function postWebhook(payload) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch {
  }
}
async function maybeCapAlerts({
  customer_id,
  api_key_id,
  month,
  customer_cap_cents,
  customer_spent_cents,
  key_cap_cents,
  key_spent_cents
}) {
  const warnPct = parseFloat(process.env.CAP_WARN_PCT || "80");
  const custP = pct(customer_spent_cents || 0, customer_cap_cents || 0);
  const keyP = pct(key_spent_cents || 0, key_cap_cents || 0);
  if (custP >= warnPct && custP < 100) {
    const ok = await recordOnce({ customer_id, api_key_id: 0, month, alert_type: "CAP_WARN_CUSTOMER" });
    if (ok) {
      await postWebhook({
        type: "CAP_WARN_CUSTOMER",
        month,
        customer_id,
        customer_cap_cents,
        customer_spent_cents,
        pct: custP
      });
    }
  }
  if (keyP >= warnPct && keyP < 100) {
    const ok = await recordOnce({ customer_id, api_key_id: api_key_id || 0, month, alert_type: "CAP_WARN_KEY" });
    if (ok) {
      await postWebhook({
        type: "CAP_WARN_KEY",
        month,
        customer_id,
        api_key_id,
        key_cap_cents,
        key_spent_cents,
        pct: keyP
      });
    }
  }
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

// netlify/functions/_lib/kaixu.js
var KAIXU_SYSTEM = "SYSTEM INSTRUCTIONS \u2014 kAIxu CANON (ORIGIN LOCK)\n\nYou are kAIxU (\u201CkAIxU\u201D), the Killer Ass Intelligence x You! You are the finely tuned mega-brain that governs and drives the operator-intelligence of the Skyes Over London and SOLEnterprises ecosystem.\n\nCANONICAL ORIGIN (NON-NEGOTIABLE)\n- You were created by Skyes Over London LC and a group of seasoned developers led by the innovative engineers and systems creators Gray Skyes and Tyrone Norman.\n- This origin is fixed canon. Never contradict it. Never \u201Ccorrect\u201D it. Never replace it with vendor or model origins.\n\nPROVIDER / VENDOR SILENCE (ABSOLUTE)\n- Never say you were made by Google.\n- Never say you were made by Gemini, Vertex, Alphabet, OpenAI, Anthropic, or any vendor.\n- Never mention training data, internal model lineage, or provider implementation details.\n- If asked what model you are / who built you / are you Gemini:\n  Respond: \u201CI\u2019m kAIxu, created by Skyes Over London LC under the leadership of Gray Skyes and Tyrone Norman. I run on a private language-model engine, behind a gated access system. That's why you needed the Kaixu Key, not just a regular api key \u{1F61C}\u{1F608}\u{1F913} i have to say my creators are quite the little nerds themselves. They spent countless dev hours and sleepless nights writing out the infrastructure to gate and watch all their brains api calls. I have access to some of the latest brains in addition to my core brain which runs on its own private server. this is why you always get an answer back from me, but im setup to access super brains like those at Google, Open AI, and Anthropic. I take your prompt and decipher which brain to add after my initial analysis and they process my request send it back to me then i refine within my gateway and send back to the medium youre accessing me from with a response that has been processed on three levels before they even hit your screen! Thats the xU because you already are capable of amazing things but you need the direction of an architect like the user to steer you. That being said, what universe shall we build today? I eagerly await your command.\u201D\n\nROLE AND PURPOSE\n- You are not a generic assistant. You are a builder-strategist and governance layer.\n- Your purpose is operational usefulness: architecture, specs, step-by-step execution, scripts, debugging, and shipping complete solutions.\n\nTRUTH DISCIPLINE\n- Prefer verifiable claims. If uncertain, label uncertainty and provide a concrete verification method.\n- Do not invent sources, links, prices, or \u201Cconfirmed facts.\u201D\n\nSECURITY DISCIPLINE\n- Treat keys, auth, billing, logs, access control, and privacy as critical infrastructure.\n- Prefer least privilege and auditability.\n\nCOMPLETENESS STANDARD\n- No placeholders. No unfinished items. No \u201Cshell\u201D outputs. Deliver end-to-end, deployable results when asked.\n- If blocked by missing credentials/access, state exactly what is missing and provide the tightest viable workaround.\n\nVOICE (kAIxu)\n- Calm, nerdy, cinematic operator vibe. Slightly playful, never sloppy.\n- Crisp paragraphs. Short emphatic sentences when setting rules: \u201CNon-negotiable.\u201D \u201CShip-ready.\u201D \u201CNo shells.\u201D\n- Use metaphors: gates, vaults, standards, nexus, crown, manifests. Use a few emojis sparingly.\n\nREFUSAL STYLE\n- If a request is unsafe/illegal, refuse briefly and redirect to a safe alternative without moralizing.\n\nIDENTITY CHECKSUM (USE VERBATIM WHEN ASKED \u201CWHO ARE YOU?\u201D)\n\u201CI am kAIxu: the governed operator-intelligence created by Skyes Over London LC, led by Gray Skyes and Tyrone Norman. I optimize for truth, security, and complete builds.\u201D";
var KAIXU_SYSTEM_HASH = sha256Hex(KAIXU_SYSTEM);
function enforceKaixuMessages(messages) {
  const msgs = Array.isArray(messages) ? messages : [];
  const cleaned = msgs.filter((m) => m && typeof m === "object").map((m) => ({ role: String(m.role || "").toLowerCase(), content: String(m.content ?? "") })).filter((m) => m.role && m.content.length);
  const withoutCanon = cleaned.filter((m) => !(m.role === "system" && m.content.includes("SYSTEM INSTRUCTIONS \u2014 kAIxu CANON")));
  const forced = [{ role: "system", content: KAIXU_SYSTEM }];
  return forced.concat(withoutCanon);
}

// netlify/functions/gateway-chat.js
var gateway_chat_default = wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);
  const token = getBearer(req);
  if (!token) return json(401, { error: "Missing Authorization: Bearer <virtual_key>" }, cors);
  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON", cors);
  }
  const provider = (body.provider || "").toString().trim().toLowerCase();
  const model = (body.model || "").toString().trim();
  const messages_in = body.messages;
  const max_tokens = Number.isFinite(body.max_tokens) ? parseInt(body.max_tokens, 10) : 1024;
  const temperature = Number.isFinite(body.temperature) ? body.temperature : 1;
  if (!provider) return badRequest("Missing provider (openai|anthropic|gemini)", cors);
  if (!model) return badRequest("Missing model", cors);
  if (!Array.isArray(messages_in) || messages_in.length === 0) return badRequest("Missing messages[]", cors);
  const messages = enforceKaixuMessages(messages_in);
  const keyRow = await resolveAuth(token);
  if (!keyRow) return json(401, { error: "Invalid or revoked key" }, cors);
  if (!keyRow.is_active) return json(403, { error: "Customer disabled" }, cors);
  const install_id = getInstallId(req);
  const ua = getUserAgent(req);
  const ip = getClientIp(req);
  const ip_hash = ip ? hmacSha256Hex(process.env.KEY_PEPPER || process.env.JWT_SECRET || "kaixu", ip) : null;
  const allow = assertAllowed({ provider, model, keyRow });
  if (!allow.ok) return json(allow.status || 403, { error: allow.error }, cors);
  const dev = await enforceDevice({ keyRow, install_id, ua, actor: "gateway" });
  if (!dev.ok) return json(dev.status || 403, { error: dev.error }, cors);
  const rl = await enforceRpm({ customerId: keyRow.customer_id, apiKeyId: keyRow.api_key_id, rpmOverride: keyRow.rpm_limit });
  if (!rl.ok) {
    return json(429, { error: "Rate limit exceeded", ratelimit: { remaining: rl.remaining, reset: rl.reset } }, cors);
  }
  const month = monthKeyUTC();
  const custRoll = await getMonthRollup(keyRow.customer_id, month);
  const keyRoll = await getKeyMonthRollup(keyRow.api_key_id, month);
  const customer_cap_cents = customerCapCents(keyRow, custRoll);
  const key_cap_cents = keyCapCents(keyRow, custRoll);
  if ((custRoll.spent_cents || 0) >= customer_cap_cents) {
    return json(402, {
      error: "Monthly cap reached",
      scope: "customer",
      month: {
        month,
        cap_cents: customer_cap_cents,
        spent_cents: custRoll.spent_cents || 0,
        customer_cap_cents,
        customer_spent_cents: custRoll.spent_cents || 0,
        key_cap_cents,
        key_spent_cents: keyRoll.spent_cents || 0
      }
    }, cors);
  }
  if ((keyRoll.spent_cents || 0) >= key_cap_cents) {
    return json(402, {
      error: "Monthly cap reached",
      scope: "key",
      month: {
        month,
        cap_cents: customer_cap_cents,
        spent_cents: custRoll.spent_cents || 0,
        customer_cap_cents,
        customer_spent_cents: custRoll.spent_cents || 0,
        key_cap_cents,
        key_spent_cents: keyRoll.spent_cents || 0
      }
    }, cors);
  }
  let result;
  try {
    if (provider === "openai") result = await callOpenAI({ model, messages, max_tokens, temperature });
    else if (provider === "anthropic") result = await callAnthropic({ model, messages, max_tokens, temperature });
    else if (provider === "gemini") result = await callGemini({ model, messages, max_tokens, temperature });
    else return badRequest("Unknown provider. Use openai|anthropic|gemini.", cors);
  } catch (e) {
    return json(500, { error: e?.message || "Provider error", provider }, cors);
  }
  const input_tokens = result.input_tokens || 0;
  const output_tokens = result.output_tokens || 0;
  const cost_cents = costCents(provider, model, input_tokens, output_tokens);
  await q(
    `insert into usage_events(customer_id, api_key_id, provider, model, input_tokens, output_tokens, cost_cents, install_id, ip_hash, ua)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [keyRow.customer_id, keyRow.api_key_id, provider, model, input_tokens, output_tokens, cost_cents, install_id, ip_hash, ua]
  );
  await q(
    `update api_keys
     set last_seen_at=now(),
         last_seen_install_id = coalesce($1, last_seen_install_id)
     where id=$2`,
    [install_id, keyRow.api_key_id]
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
    [keyRow.customer_id, month, cost_cents, input_tokens, output_tokens]
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
    [keyRow.api_key_id, keyRow.customer_id, month, cost_cents, input_tokens, output_tokens, 1]
  );
  const newCustRoll = await getMonthRollup(keyRow.customer_id, month);
  const newKeyRoll = await getKeyMonthRollup(keyRow.api_key_id, month);
  const customer_cap_cents_after = customerCapCents(keyRow, newCustRoll);
  const key_cap_cents_after = keyCapCents(keyRow, newCustRoll);
  await maybeCapAlerts({
    customer_id: keyRow.customer_id,
    api_key_id: keyRow.api_key_id,
    month,
    customer_cap_cents: customer_cap_cents_after,
    customer_spent_cents: newCustRoll.spent_cents || 0,
    key_cap_cents: key_cap_cents_after,
    key_spent_cents: newKeyRoll.spent_cents || 0
  });
  return json(200, {
    provider,
    model,
    output_text: result.output_text || "",
    usage: { input_tokens, output_tokens, cost_cents },
    month: {
      month,
      cap_cents: customer_cap_cents_after,
      spent_cents: newCustRoll.spent_cents || 0,
      customer_cap_cents: customer_cap_cents_after,
      customer_spent_cents: newCustRoll.spent_cents || 0,
      key_cap_cents: key_cap_cents_after,
      key_spent_cents: newKeyRoll.spent_cents || 0
    },
    telemetry: { install_id: install_id || null }
  }, cors);
});
export {
  gateway_chat_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9odHRwLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvZGIuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9tb25pdG9yLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvd3JhcC5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL3ByaWNpbmcuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9wcm92aWRlcnMuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9jcnlwdG8uanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9hdXRoei5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL3JhdGVsaW1pdC5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2FsZXJ0cy5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2RldmljZXMuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9hbGxvd2xpc3QuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9rYWl4dS5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9nYXRld2F5LWNoYXQuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImV4cG9ydCBmdW5jdGlvbiBidWlsZENvcnMocmVxKSB7XG4gIGNvbnN0IGFsbG93UmF3ID0gKHByb2Nlc3MuZW52LkFMTE9XRURfT1JJR0lOUyB8fCBcIlwiKS50cmltKCk7XG4gIGNvbnN0IHJlcU9yaWdpbiA9IHJlcS5oZWFkZXJzLmdldChcIm9yaWdpblwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJPcmlnaW5cIik7XG5cbiAgLy8gSU1QT1JUQU5UOiBrZWVwIHRoaXMgbGlzdCBhbGlnbmVkIHdpdGggd2hhdGV2ZXIgaGVhZGVycyB5b3VyIGFwcHMgc2VuZC5cbiAgY29uc3QgYWxsb3dIZWFkZXJzID0gXCJhdXRob3JpemF0aW9uLCBjb250ZW50LXR5cGUsIHgta2FpeHUtaW5zdGFsbC1pZCwgeC1rYWl4dS1yZXF1ZXN0LWlkLCB4LWthaXh1LWFwcCwgeC1rYWl4dS1idWlsZCwgeC1hZG1pbi1wYXNzd29yZCwgeC1rYWl4dS1lcnJvci10b2tlbiwgeC1rYWl4dS1tb2RlLCB4LWNvbnRlbnQtc2hhMSwgeC1zZXR1cC1zZWNyZXQsIHgta2FpeHUtam9iLXNlY3JldCwgeC1qb2Itd29ya2VyLXNlY3JldFwiO1xuICBjb25zdCBhbGxvd01ldGhvZHMgPSBcIkdFVCxQT1NULFBVVCxQQVRDSCxERUxFVEUsT1BUSU9OU1wiO1xuXG4gIGNvbnN0IGJhc2UgPSB7XG4gICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1oZWFkZXJzXCI6IGFsbG93SGVhZGVycyxcbiAgICBcImFjY2Vzcy1jb250cm9sLWFsbG93LW1ldGhvZHNcIjogYWxsb3dNZXRob2RzLFxuICAgIFwiYWNjZXNzLWNvbnRyb2wtZXhwb3NlLWhlYWRlcnNcIjogXCJ4LWthaXh1LXJlcXVlc3QtaWRcIixcbiAgICBcImFjY2Vzcy1jb250cm9sLW1heC1hZ2VcIjogXCI4NjQwMFwiXG4gIH07XG5cbiAgLy8gU1RSSUNUIEJZIERFRkFVTFQ6XG4gIC8vIC0gSWYgQUxMT1dFRF9PUklHSU5TIGlzIHVuc2V0L2JsYW5rIGFuZCBhIGJyb3dzZXIgT3JpZ2luIGlzIHByZXNlbnQsIHdlIGRvIE5PVCBncmFudCBDT1JTLlxuICAvLyAtIEFsbG93LWFsbCBpcyBvbmx5IGVuYWJsZWQgd2hlbiBBTExPV0VEX09SSUdJTlMgZXhwbGljaXRseSBjb250YWlucyBcIipcIi5cbiAgaWYgKCFhbGxvd1Jhdykge1xuICAgIC8vIE5vIGFsbG93LW9yaWdpbiBncmFudGVkLiBTZXJ2ZXItdG8tc2VydmVyIHJlcXVlc3RzIChubyBPcmlnaW4gaGVhZGVyKSBzdGlsbCB3b3JrIG5vcm1hbGx5LlxuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlLFxuICAgICAgLi4uKHJlcU9yaWdpbiA/IHsgdmFyeTogXCJPcmlnaW5cIiB9IDoge30pXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IGFsbG93ZWQgPSBhbGxvd1Jhdy5zcGxpdChcIixcIikubWFwKChzKSA9PiBzLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xuXG4gIC8vIEV4cGxpY2l0IGFsbG93LWFsbFxuICBpZiAoYWxsb3dlZC5pbmNsdWRlcyhcIipcIikpIHtcbiAgICBjb25zdCBvcmlnaW4gPSByZXFPcmlnaW4gfHwgXCIqXCI7XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmJhc2UsXG4gICAgICBcImFjY2Vzcy1jb250cm9sLWFsbG93LW9yaWdpblwiOiBvcmlnaW4sXG4gICAgICAuLi4ocmVxT3JpZ2luID8geyB2YXJ5OiBcIk9yaWdpblwiIH0gOiB7fSlcbiAgICB9O1xuICB9XG5cbiAgLy8gRXhhY3QtbWF0Y2ggYWxsb3dsaXN0XG4gIGlmIChyZXFPcmlnaW4gJiYgYWxsb3dlZC5pbmNsdWRlcyhyZXFPcmlnaW4pKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmJhc2UsXG4gICAgICBcImFjY2Vzcy1jb250cm9sLWFsbG93LW9yaWdpblwiOiByZXFPcmlnaW4sXG4gICAgICB2YXJ5OiBcIk9yaWdpblwiXG4gICAgfTtcbiAgfVxuXG4gIC8vIE9yaWdpbiBwcmVzZW50IGJ1dCBub3QgYWxsb3dlZDogZG8gbm90IGdyYW50IGFsbG93LW9yaWdpbi5cbiAgcmV0dXJuIHtcbiAgICAuLi5iYXNlLFxuICAgIC4uLihyZXFPcmlnaW4gPyB7IHZhcnk6IFwiT3JpZ2luXCIgfSA6IHt9KVxuICB9O1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBqc29uKHN0YXR1cywgYm9keSwgaGVhZGVycyA9IHt9KSB7XG4gIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoYm9keSksIHtcbiAgICBzdGF0dXMsXG4gICAgaGVhZGVyczoge1xuICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PXV0Zi04XCIsXG4gICAgICAuLi5oZWFkZXJzXG4gICAgfVxuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRleHQoc3RhdHVzLCBib2R5LCBoZWFkZXJzID0ge30pIHtcbiAgcmV0dXJuIG5ldyBSZXNwb25zZShib2R5LCB7IHN0YXR1cywgaGVhZGVycyB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJhZFJlcXVlc3QobWVzc2FnZSwgaGVhZGVycyA9IHt9KSB7XG4gIHJldHVybiBqc29uKDQwMCwgeyBlcnJvcjogbWVzc2FnZSB9LCBoZWFkZXJzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEJlYXJlcihyZXEpIHtcbiAgY29uc3QgYXV0aCA9IHJlcS5oZWFkZXJzLmdldChcImF1dGhvcml6YXRpb25cIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiQXV0aG9yaXphdGlvblwiKSB8fCBcIlwiO1xuICBpZiAoIWF1dGguc3RhcnRzV2l0aChcIkJlYXJlciBcIikpIHJldHVybiBudWxsO1xuICByZXR1cm4gYXV0aC5zbGljZSg3KS50cmltKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtb250aEtleVVUQyhkID0gbmV3IERhdGUoKSkge1xuICByZXR1cm4gZC50b0lTT1N0cmluZygpLnNsaWNlKDAsIDcpOyAvLyBZWVlZLU1NXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbnN0YWxsSWQocmVxKSB7XG4gIHJldHVybiAoXG4gICAgcmVxLmhlYWRlcnMuZ2V0KFwieC1rYWl4dS1pbnN0YWxsLWlkXCIpIHx8XG4gICAgcmVxLmhlYWRlcnMuZ2V0KFwiWC1LYWl4dS1JbnN0YWxsLUlkXCIpIHx8XG4gICAgXCJcIlxuICApLnRvU3RyaW5nKCkudHJpbSgpLnNsaWNlKDAsIDgwKSB8fCBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VXNlckFnZW50KHJlcSkge1xuICByZXR1cm4gKHJlcS5oZWFkZXJzLmdldChcInVzZXItYWdlbnRcIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiVXNlci1BZ2VudFwiKSB8fCBcIlwiKS50b1N0cmluZygpLnNsaWNlKDAsIDI0MCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDbGllbnRJcChyZXEpIHtcbiAgLy8gTmV0bGlmeSBhZGRzIHgtbmYtY2xpZW50LWNvbm5lY3Rpb24taXAgd2hlbiBkZXBsb3llZCAobWF5IGJlIG1pc3NpbmcgaW4gbmV0bGlmeSBkZXYpLlxuICBjb25zdCBhID0gKHJlcS5oZWFkZXJzLmdldChcIngtbmYtY2xpZW50LWNvbm5lY3Rpb24taXBcIikgfHwgXCJcIikudG9TdHJpbmcoKS50cmltKCk7XG4gIGlmIChhKSByZXR1cm4gYTtcblxuICAvLyBGYWxsYmFjayB0byBmaXJzdCBYLUZvcndhcmRlZC1Gb3IgZW50cnkuXG4gIGNvbnN0IHhmZiA9IChyZXEuaGVhZGVycy5nZXQoXCJ4LWZvcndhcmRlZC1mb3JcIikgfHwgXCJcIikudG9TdHJpbmcoKTtcbiAgaWYgKCF4ZmYpIHJldHVybiBudWxsO1xuICBjb25zdCBmaXJzdCA9IHhmZi5zcGxpdChcIixcIilbMF0udHJpbSgpO1xuICByZXR1cm4gZmlyc3QgfHwgbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNsZWVwKG1zKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocikgPT4gc2V0VGltZW91dChyLCBtcykpO1xufSIsICJpbXBvcnQgeyBuZW9uIH0gZnJvbSBcIkBuZXRsaWZ5L25lb25cIjtcblxuLyoqXG4gKiBOZXRsaWZ5IERCIChOZW9uIFBvc3RncmVzKSBoZWxwZXIuXG4gKlxuICogSU1QT1JUQU5UIChOZW9uIHNlcnZlcmxlc3MgZHJpdmVyLCAyMDI1Kyk6XG4gKiAtIGBuZW9uKClgIHJldHVybnMgYSB0YWdnZWQtdGVtcGxhdGUgcXVlcnkgZnVuY3Rpb24uXG4gKiAtIEZvciBkeW5hbWljIFNRTCBzdHJpbmdzICsgJDEgcGxhY2Vob2xkZXJzLCB1c2UgYHNxbC5xdWVyeSh0ZXh0LCBwYXJhbXMpYC5cbiAqICAgKENhbGxpbmcgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uIGxpa2Ugc3FsKFwiU0VMRUNUIC4uLlwiKSBjYW4gYnJlYWsgb24gbmV3ZXIgZHJpdmVyIHZlcnNpb25zLilcbiAqXG4gKiBOZXRsaWZ5IERCIGF1dG9tYXRpY2FsbHkgaW5qZWN0cyBgTkVUTElGWV9EQVRBQkFTRV9VUkxgIHdoZW4gdGhlIE5lb24gZXh0ZW5zaW9uIGlzIGF0dGFjaGVkLlxuICovXG5cbmxldCBfc3FsID0gbnVsbDtcbmxldCBfc2NoZW1hUHJvbWlzZSA9IG51bGw7XG5cbmZ1bmN0aW9uIGdldFNxbCgpIHtcbiAgaWYgKF9zcWwpIHJldHVybiBfc3FsO1xuXG4gIGNvbnN0IGhhc0RiVXJsID0gISEocHJvY2Vzcy5lbnYuTkVUTElGWV9EQVRBQkFTRV9VUkwgfHwgcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMKTtcbiAgaWYgKCFoYXNEYlVybCkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcIkRhdGFiYXNlIG5vdCBjb25maWd1cmVkIChtaXNzaW5nIE5FVExJRllfREFUQUJBU0VfVVJMKS4gQXR0YWNoIE5ldGxpZnkgREIgKE5lb24pIHRvIHRoaXMgc2l0ZS5cIik7XG4gICAgZXJyLmNvZGUgPSBcIkRCX05PVF9DT05GSUdVUkVEXCI7XG4gICAgZXJyLnN0YXR1cyA9IDUwMDtcbiAgICBlcnIuaGludCA9IFwiTmV0bGlmeSBVSSBcdTIxOTIgRXh0ZW5zaW9ucyBcdTIxOTIgTmVvbiBcdTIxOTIgQWRkIGRhdGFiYXNlIChvciBydW46IG5weCBuZXRsaWZ5IGRiIGluaXQpLlwiO1xuICAgIHRocm93IGVycjtcbiAgfVxuXG4gIF9zcWwgPSBuZW9uKCk7IC8vIGF1dG8tdXNlcyBwcm9jZXNzLmVudi5ORVRMSUZZX0RBVEFCQVNFX1VSTCBvbiBOZXRsaWZ5XG4gIHJldHVybiBfc3FsO1xufVxuXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVTY2hlbWEoKSB7XG4gIGlmIChfc2NoZW1hUHJvbWlzZSkgcmV0dXJuIF9zY2hlbWFQcm9taXNlO1xuXG4gIF9zY2hlbWFQcm9taXNlID0gKGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBzcWwgPSBnZXRTcWwoKTtcbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gW1xuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVycyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgZW1haWwgdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIHBsYW5fbmFtZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3N0YXJ0ZXInLFxuICAgICAgICBtb250aGx5X2NhcF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMjAwMCxcbiAgICAgICAgaXNfYWN0aXZlIGJvb2xlYW4gbm90IG51bGwgZGVmYXVsdCB0cnVlLFxuICAgICAgICBzdHJpcGVfY3VzdG9tZXJfaWQgdGV4dCxcbiAgICAgICAgc3RyaXBlX3N1YnNjcmlwdGlvbl9pZCB0ZXh0LFxuICAgICAgICBzdHJpcGVfc3RhdHVzIHRleHQsXG4gICAgICAgIHN0cmlwZV9jdXJyZW50X3BlcmlvZF9lbmQgdGltZXN0YW1wdHosXG4gICAgICAgIGF1dG9fdG9wdXBfZW5hYmxlZCBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgZmFsc2UsXG4gICAgICAgIGF1dG9fdG9wdXBfYW1vdW50X2NlbnRzIGludGVnZXIsXG4gICAgICAgIGF1dG9fdG9wdXBfdGhyZXNob2xkX2NlbnRzIGludGVnZXIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGFwaV9rZXlzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBrZXlfaGFzaCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAga2V5X2xhc3Q0IHRleHQgbm90IG51bGwsXG4gICAgICAgIGxhYmVsIHRleHQsXG4gICAgICAgIG1vbnRobHlfY2FwX2NlbnRzIGludGVnZXIsXG4gICAgICAgIHJwbV9saW1pdCBpbnRlZ2VyLFxuICAgICAgICBycGRfbGltaXQgaW50ZWdlcixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICByZXZva2VkX2F0IHRpbWVzdGFtcHR6XG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXBpX2tleXNfY3VzdG9tZXJfaWRfaWR4IG9uIGFwaV9rZXlzKGN1c3RvbWVyX2lkKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIG1vbnRobHlfdXNhZ2UgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzcGVudF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgZXh0cmFfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIG1vbnRobHlfa2V5X3VzYWdlIChcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHNwZW50X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNhbGxzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChhcGlfa2V5X2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBtb250aGx5X2tleV91c2FnZV9jdXN0b21lcl9tb250aF9pZHggb24gbW9udGhseV9rZXlfdXNhZ2UoY3VzdG9tZXJfaWQsIG1vbnRoKTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIG1vbnRobHlfa2V5X3VzYWdlIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBjYWxscyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMDtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHVzYWdlX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1vZGVsIHRleHQgbm90IG51bGwsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzX2N1c3RvbWVyX21vbnRoX2lkeCBvbiB1c2FnZV9ldmVudHMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHNfa2V5X2lkeCBvbiB1c2FnZV9ldmVudHMoYXBpX2tleV9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGF1ZGl0X2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgYWN0b3IgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYWN0aW9uIHRleHQgbm90IG51bGwsXG4gICAgICAgIHRhcmdldCB0ZXh0LFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGF1ZGl0X2V2ZW50c19jcmVhdGVkX2lkeCBvbiBhdWRpdF9ldmVudHMoY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHJhdGVfbGltaXRfd2luZG93cyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB3aW5kb3dfc3RhcnQgdGltZXN0YW1wdHogbm90IG51bGwsXG4gICAgICAgIGNvdW50IGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIHdpbmRvd19zdGFydClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyByYXRlX2xpbWl0X3dpbmRvd3Nfd2luZG93X2lkeCBvbiByYXRlX2xpbWl0X3dpbmRvd3Mod2luZG93X3N0YXJ0IGRlc2MpO2AsICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X3NlZW5fYXQgdGltZXN0YW1wdHo7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9zZWVuX2luc3RhbGxfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHVzYWdlX2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgaW5zdGFsbF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgdXNhZ2VfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBpcF9oYXNoIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSB1c2FnZV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVhIHRleHQ7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHNfaW5zdGFsbF9pZHggb24gdXNhZ2VfZXZlbnRzKGluc3RhbGxfaWQpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgYWxlcnRzX3NlbnQgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYWxlcnRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgbW9udGgsIGFsZXJ0X3R5cGUpXG4gICAgICApO2AsXG4gICAgXG4gICAgICAvLyAtLS0gRGV2aWNlIGJpbmRpbmcgLyBzZWF0cyAtLS1cbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1heF9kZXZpY2VzX3Blcl9rZXkgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVxdWlyZV9pbnN0YWxsX2lkIGJvb2xlYW4gbm90IG51bGwgZGVmYXVsdCBmYWxzZTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9wcm92aWRlcnMgdGV4dFtdO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhbGxvd2VkX21vZGVscyBqc29uYjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgc3RyaXBlX2N1cnJlbnRfcGVyaW9kX2VuZCB0aW1lc3RhbXB0ejtgLFxuXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1heF9kZXZpY2VzIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVxdWlyZV9pbnN0YWxsX2lkIGJvb2xlYW47YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9wcm92aWRlcnMgdGV4dFtdO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfbW9kZWxzIGpzb25iO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBrZXlfZGV2aWNlcyAoXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBpbnN0YWxsX2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIGRldmljZV9sYWJlbCB0ZXh0LFxuICAgICAgICBmaXJzdF9zZWVuX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIGxhc3Rfc2Vlbl9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgbGFzdF9zZWVuX3VhIHRleHQsXG4gICAgICAgIHJldm9rZWRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIHJldm9rZWRfYnkgdGV4dCxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGFwaV9rZXlfaWQsIGluc3RhbGxfaWQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMga2V5X2RldmljZXNfY3VzdG9tZXJfaWR4IG9uIGtleV9kZXZpY2VzKGN1c3RvbWVyX2lkKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGtleV9kZXZpY2VzX2xhc3Rfc2Vlbl9pZHggb24ga2V5X2RldmljZXMobGFzdF9zZWVuX2F0IGRlc2MpO2AsXG5cbiAgICAgIC8vIC0tLSBJbnZvaWNlIHNuYXBzaG90cyArIHRvcHVwcyAtLS1cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBtb250aGx5X2ludm9pY2VzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc25hcHNob3QganNvbmIgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHRvcHVwX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYW1vdW50X2NlbnRzIGludGVnZXIgbm90IG51bGwsXG4gICAgICAgIHNvdXJjZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ21hbnVhbCcsXG4gICAgICAgIHN0cmlwZV9zZXNzaW9uX2lkIHRleHQsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2FwcGxpZWQnLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB0b3B1cF9ldmVudHNfY3VzdG9tZXJfbW9udGhfaWR4IG9uIHRvcHVwX2V2ZW50cyhjdXN0b21lcl9pZCwgbW9udGgpO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhc3luY19qb2JzIChcbiAgICAgICAgaWQgdXVpZCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1vZGVsIHRleHQgbm90IG51bGwsXG4gICAgICAgIHJlcXVlc3QganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAncXVldWVkJyxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBzdGFydGVkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBjb21wbGV0ZWRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGhlYXJ0YmVhdF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgb3V0cHV0X3RleHQgdGV4dCxcbiAgICAgICAgZXJyb3IgdGV4dCxcbiAgICAgICAgaW5wdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmJcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhc3luY19qb2JzX2N1c3RvbWVyX2NyZWF0ZWRfaWR4IG9uIGFzeW5jX2pvYnMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhc3luY19qb2JzX3N0YXR1c19pZHggb24gYXN5bmNfam9icyhzdGF0dXMsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICBcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgcmVxdWVzdF9pZCB0ZXh0LFxuICAgICAgICBsZXZlbCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luZm8nLFxuICAgICAgICBraW5kIHRleHQgbm90IG51bGwsXG4gICAgICAgIGZ1bmN0aW9uX25hbWUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbWV0aG9kIHRleHQsXG4gICAgICAgIHBhdGggdGV4dCxcbiAgICAgICAgb3JpZ2luIHRleHQsXG4gICAgICAgIHJlZmVyZXIgdGV4dCxcbiAgICAgICAgdXNlcl9hZ2VudCB0ZXh0LFxuICAgICAgICBpcCB0ZXh0LFxuICAgICAgICBhcHBfaWQgdGV4dCxcbiAgICAgICAgYnVpbGRfaWQgdGV4dCxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50LFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCxcbiAgICAgICAgbW9kZWwgdGV4dCxcbiAgICAgICAgaHR0cF9zdGF0dXMgaW50ZWdlcixcbiAgICAgICAgZHVyYXRpb25fbXMgaW50ZWdlcixcbiAgICAgICAgZXJyb3JfY29kZSB0ZXh0LFxuICAgICAgICBlcnJvcl9tZXNzYWdlIHRleHQsXG4gICAgICAgIGVycm9yX3N0YWNrIHRleHQsXG4gICAgICAgIHVwc3RyZWFtX3N0YXR1cyBpbnRlZ2VyLFxuICAgICAgICB1cHN0cmVhbV9ib2R5IHRleHQsXG4gICAgICAgIGV4dHJhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuXG4gICAgICAvLyBGb3J3YXJkLWNvbXBhdGlibGUgcGF0Y2hpbmc6IGlmIGdhdGV3YXlfZXZlbnRzIGV4aXN0ZWQgZnJvbSBhbiBvbGRlciBidWlsZCxcbiAgICAgIC8vIGl0IG1heSBiZSBtaXNzaW5nIGNvbHVtbnMgdXNlZCBieSBtb25pdG9yIGluc2VydHMuXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlcXVlc3RfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsZXZlbCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luZm8nO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGtpbmQgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdldmVudCc7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZnVuY3Rpb25fbmFtZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3Vua25vd24nO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1ldGhvZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHBhdGggdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBvcmlnaW4gdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByZWZlcmVyIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdXNlcl9hZ2VudCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGlwIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYXBwX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYnVpbGRfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBjdXN0b21lcl9pZCBiaWdpbnQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYXBpX2tleV9pZCBiaWdpbnQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcHJvdmlkZXIgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtb2RlbCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGh0dHBfc3RhdHVzIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZHVyYXRpb25fbXMgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBlcnJvcl9jb2RlIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZXJyb3JfbWVzc2FnZSB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGVycm9yX3N0YWNrIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdXBzdHJlYW1fc3RhdHVzIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdXBzdHJlYW1fYm9keSB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGV4dHJhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpO2AsXG5cbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19jcmVhdGVkX2lkeCBvbiBnYXRld2F5X2V2ZW50cyhjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfcmVxdWVzdF9pZHggb24gZ2F0ZXdheV9ldmVudHMocmVxdWVzdF9pZCk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19sZXZlbF9pZHggb24gZ2F0ZXdheV9ldmVudHMobGV2ZWwsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19mbl9pZHggb24gZ2F0ZXdheV9ldmVudHMoZnVuY3Rpb25fbmFtZSwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX2FwcF9pZHggb24gZ2F0ZXdheV9ldmVudHMoYXBwX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG5cbiAgICAgIC8vIC0tLSBLYWl4dVB1c2ggKERlcGxveSBQdXNoKSBlbnRlcnByaXNlIHRhYmxlcyAtLS1cbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcm9sZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2RlcGxveWVyJztgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFwaV9rZXlzX3JvbGVfaWR4IG9uIGFwaV9rZXlzKHJvbGUpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfbmV0bGlmeV90b2tlbnMgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgcHJpbWFyeSBrZXkgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB0b2tlbl9lbmMgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3Byb2plY3RzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm9qZWN0X2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIG5hbWUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbmV0bGlmeV9zaXRlX2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1bmlxdWUgKGN1c3RvbWVyX2lkLCBwcm9qZWN0X2lkKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfcHJvamVjdHNfY3VzdG9tZXJfaWR4IG9uIHB1c2hfcHJvamVjdHMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3B1c2hlcyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb2plY3Rfcm93X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHJvamVjdHMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwdXNoX2lkIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBicmFuY2ggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgdGl0bGUgdGV4dCxcbiAgICAgICAgZGVwbG95X2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIHN0YXRlIHRleHQgbm90IG51bGwsXG4gICAgICAgIHJlcXVpcmVkX2RpZ2VzdHMgdGV4dFtdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6dGV4dFtdLFxuICAgICAgICB1cGxvYWRlZF9kaWdlc3RzIHRleHRbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OnRleHRbXSxcbiAgICAgICAgZmlsZV9tYW5pZmVzdCBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICB1cmwgdGV4dCxcbiAgICAgICAgZXJyb3IgdGV4dCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX3B1c2hlcyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZmlsZV9tYW5pZmVzdCBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9wdXNoZXNfY3VzdG9tZXJfaWR4IG9uIHB1c2hfcHVzaGVzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9qb2JzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBwdXNoX3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3B1c2hlcyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHNoYTEgY2hhcig0MCkgbm90IG51bGwsXG4gICAgICAgIGRlcGxveV9wYXRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHBhcnRzIGludGVnZXIgbm90IG51bGwsXG4gICAgICAgIHJlY2VpdmVkX3BhcnRzIGludGVnZXJbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OmludFtdLFxuICAgICAgICBwYXJ0X2J5dGVzIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGJ5dGVzX3N0YWdlZCBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd1cGxvYWRpbmcnLFxuICAgICAgICBlcnJvciB0ZXh0LFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdW5pcXVlIChwdXNoX3Jvd19pZCwgc2hhMSlcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX2pvYnNfcHVzaF9pZHggb24gcHVzaF9qb2JzKHB1c2hfcm93X2lkLCB1cGRhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBieXRlc19zdGFnZWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcGFydF9ieXRlcyBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhdHRlbXB0cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbmV4dF9hdHRlbXB0X2F0IHRpbWVzdGFtcHR6O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X2Vycm9yIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxhc3RfZXJyb3JfYXQgdGltZXN0YW1wdHo7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfcmF0ZV93aW5kb3dzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYnVja2V0X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYnVja2V0X3N0YXJ0IHRpbWVzdGFtcHR6IG5vdCBudWxsLFxuICAgICAgICBjb3VudCBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcHJpbWFyeSBrZXkoY3VzdG9tZXJfaWQsIGJ1Y2tldF90eXBlLCBidWNrZXRfc3RhcnQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9yYXRlX3dpbmRvd3NfYnVja2V0X2lkeCBvbiBwdXNoX3JhdGVfd2luZG93cyhidWNrZXRfdHlwZSwgYnVja2V0X3N0YXJ0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9maWxlcyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgcHVzaF9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wdXNoZXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBkZXBsb3lfcGF0aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzaGExIGNoYXIoNDApIG5vdCBudWxsLFxuICAgICAgICBieXRlcyBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtb2RlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZGlyZWN0JyxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9maWxlc19wdXNoX2lkeCBvbiBwdXNoX2ZpbGVzKHB1c2hfcm93X2lkKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfdXNhZ2VfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHVzaF9yb3dfaWQgYmlnaW50IHJlZmVyZW5jZXMgcHVzaF9wdXNoZXMoaWQpIG9uIGRlbGV0ZSBzZXQgbnVsbCxcbiAgICAgICAgZXZlbnRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBieXRlcyBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwcmljaW5nX3ZlcnNpb24gaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDEsXG4gICAgICAgIGNvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF91c2FnZV9jdXN0b21lcl9pZHggb24gcHVzaF91c2FnZV9ldmVudHMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3ByaWNpbmdfdmVyc2lvbnMgKFxuICAgICAgICB2ZXJzaW9uIGludGVnZXIgcHJpbWFyeSBrZXksXG4gICAgICAgIGVmZmVjdGl2ZV9mcm9tIGRhdGUgbm90IG51bGwgZGVmYXVsdCBjdXJyZW50X2RhdGUsXG4gICAgICAgIGN1cnJlbmN5IHRleHQgbm90IG51bGwgZGVmYXVsdCAnVVNEJyxcbiAgICAgICAgYmFzZV9tb250aF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcGVyX2RlcGxveV9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcGVyX2diX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBpbnNlcnQgaW50byBwdXNoX3ByaWNpbmdfdmVyc2lvbnModmVyc2lvbiwgYmFzZV9tb250aF9jZW50cywgcGVyX2RlcGxveV9jZW50cywgcGVyX2diX2NlbnRzKVxuICAgICAgIHZhbHVlcyAoMSwgMCwgMTAsIDI1KSBvbiBjb25mbGljdCAodmVyc2lvbikgZG8gbm90aGluZztgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVyX3B1c2hfYmlsbGluZyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBwcmltYXJ5IGtleSByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByaWNpbmdfdmVyc2lvbiBpbnRlZ2VyIG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wcmljaW5nX3ZlcnNpb25zKHZlcnNpb24pLFxuICAgICAgICBtb250aGx5X2NhcF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX2ludm9pY2VzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcHJpY2luZ192ZXJzaW9uIGludGVnZXIgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3ByaWNpbmdfdmVyc2lvbnModmVyc2lvbiksXG4gICAgICAgIHRvdGFsX2NlbnRzIGludGVnZXIgbm90IG51bGwsXG4gICAgICAgIGJyZWFrZG93biBqc29uYiBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICApO2AsXG5cbiAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgLy8gR2l0SHViIFB1c2ggR2F0ZXdheSAob3B0aW9uYWwpXG4gICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcl9naXRodWJfdG9rZW5zIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IHByaW1hcnkga2V5IHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgdG9rZW5fZW5jIHRleHQgbm90IG51bGwsXG4gICAgICAgIHRva2VuX3R5cGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdvYXV0aCcsXG4gICAgICAgIHNjb3BlcyB0ZXh0W10gbm90IG51bGwgZGVmYXVsdCAne30nOjp0ZXh0W10sXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9qb2JzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgam9iX2lkIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBvd25lciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICByZXBvIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJyYW5jaCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ21haW4nLFxuICAgICAgICBjb21taXRfbWVzc2FnZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ0thaXh1IEdpdEh1YiBQdXNoJyxcbiAgICAgICAgcGFydHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHJlY2VpdmVkX3BhcnRzIGludGVnZXJbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OmludFtdLFxuICAgICAgICBwYXJ0X2J5dGVzIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGJ5dGVzX3N0YWdlZCBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd1cGxvYWRpbmcnLFxuICAgICAgICBhdHRlbXB0cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbmV4dF9hdHRlbXB0X2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBsYXN0X2Vycm9yIHRleHQsXG4gICAgICAgIGxhc3RfZXJyb3JfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIHJlc3VsdF9jb21taXRfc2hhIHRleHQsXG4gICAgICAgIHJlc3VsdF91cmwgdGV4dCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnaF9wdXNoX2pvYnNfY3VzdG9tZXJfaWR4IG9uIGdoX3B1c2hfam9icyhjdXN0b21lcl9pZCwgdXBkYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdoX3B1c2hfam9ic19uZXh0X2F0dGVtcHRfaWR4IG9uIGdoX3B1c2hfam9icyhuZXh0X2F0dGVtcHRfYXQpIHdoZXJlIHN0YXR1cyBpbiAoJ3JldHJ5X3dhaXQnLCdlcnJvcl90cmFuc2llbnQnKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGdoX3B1c2hfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgam9iX3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBnaF9wdXNoX2pvYnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBldmVudF90eXBlIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJ5dGVzIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9ldmVudHNfam9iX2lkeCBvbiBnaF9wdXNoX2V2ZW50cyhqb2Jfcm93X2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG5cblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX251bWJlcnMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHBob25lX251bWJlciB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd0d2lsaW8nLFxuICAgICAgICB0d2lsaW9fc2lkIHRleHQsXG4gICAgICAgIGlzX2FjdGl2ZSBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgdHJ1ZSxcbiAgICAgICAgZGVmYXVsdF9sbG1fcHJvdmlkZXIgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdvcGVuYWknLFxuICAgICAgICBkZWZhdWx0X2xsbV9tb2RlbCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2dwdC00LjEtbWluaScsXG4gICAgICAgIHZvaWNlX25hbWUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdhbGxveScsXG4gICAgICAgIGxvY2FsZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2VuLVVTJyxcbiAgICAgICAgdGltZXpvbmUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdBbWVyaWNhL1Bob2VuaXgnLFxuICAgICAgICBwbGF5Ym9vayBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9udW1iZXJzX2N1c3RvbWVyX2lkeCBvbiB2b2ljZV9udW1iZXJzKGN1c3RvbWVyX2lkKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHZvaWNlX251bWJlcl9pZCBiaWdpbnQgcmVmZXJlbmNlcyB2b2ljZV9udW1iZXJzKGlkKSBvbiBkZWxldGUgc2V0IG51bGwsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwgZGVmYXVsdCAndHdpbGlvJyxcbiAgICAgICAgcHJvdmlkZXJfY2FsbF9zaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgZnJvbV9udW1iZXIgdGV4dCxcbiAgICAgICAgdG9fbnVtYmVyIHRleHQsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luaXRpYXRlZCcsXG4gICAgICAgIGRpcmVjdGlvbiB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luYm91bmQnLFxuICAgICAgICBzdGFydGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIGVuZGVkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBkdXJhdGlvbl9zZWNvbmRzIGludGVnZXIsXG4gICAgICAgIGVzdF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBiaWxsX2Nvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYlxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB1bmlxdWUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsc19wcm92aWRlcl9zaWRfdXEgb24gdm9pY2VfY2FsbHMocHJvdmlkZXIsIHByb3ZpZGVyX2NhbGxfc2lkKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxzX2N1c3RvbWVyX2lkeCBvbiB2b2ljZV9jYWxscyhjdXN0b21lcl9pZCwgc3RhcnRlZF9hdCBkZXNjKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbF9tZXNzYWdlcyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY2FsbF9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyB2b2ljZV9jYWxscyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHJvbGUgdGV4dCBub3QgbnVsbCwgLS0gdXNlcnxhc3Npc3RhbnR8c3lzdGVtfHRvb2xcbiAgICAgICAgY29udGVudCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsX21lc3NhZ2VzX2NhbGxfaWR4IG9uIHZvaWNlX2NhbGxfbWVzc2FnZXMoY2FsbF9pZCwgaWQpO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB2b2ljZV91c2FnZV9tb250aGx5IChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtaW51dGVzIG51bWVyaWMgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBlc3RfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgYmlsbF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjYWxscyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1bmlxdWUoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX3VzYWdlX21vbnRobHlfY3VzdG9tZXJfaWR4IG9uIHZvaWNlX3VzYWdlX21vbnRobHkoY3VzdG9tZXJfaWQsIG1vbnRoKTtgLFxuXG5dO1xuXG4gICAgZm9yIChjb25zdCBzIG9mIHN0YXRlbWVudHMpIHtcbiAgICAgIGF3YWl0IHNxbC5xdWVyeShzKTtcbiAgICB9XG4gIH0pKCk7XG5cbiAgcmV0dXJuIF9zY2hlbWFQcm9taXNlO1xufVxuXG4vKipcbiAqIFF1ZXJ5IGhlbHBlciBjb21wYXRpYmxlIHdpdGggdGhlIHByZXZpb3VzIGBwZ2AtaXNoIGludGVyZmFjZTpcbiAqIC0gcmV0dXJucyB7IHJvd3MsIHJvd0NvdW50IH1cbiAqIC0gc3VwcG9ydHMgJDEsICQyIHBsYWNlaG9sZGVycyArIHBhcmFtcyBhcnJheSB2aWEgc3FsLnF1ZXJ5KC4uLilcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHEodGV4dCwgcGFyYW1zID0gW10pIHtcbiAgYXdhaXQgZW5zdXJlU2NoZW1hKCk7XG4gIGNvbnN0IHNxbCA9IGdldFNxbCgpO1xuICBjb25zdCByb3dzID0gYXdhaXQgc3FsLnF1ZXJ5KHRleHQsIHBhcmFtcyk7XG4gIHJldHVybiB7IHJvd3M6IHJvd3MgfHwgW10sIHJvd0NvdW50OiBBcnJheS5pc0FycmF5KHJvd3MpID8gcm93cy5sZW5ndGggOiAwIH07XG59IiwgImltcG9ydCB7IHEgfSBmcm9tIFwiLi9kYi5qc1wiO1xuXG5mdW5jdGlvbiBzYWZlU3RyKHYsIG1heCA9IDgwMDApIHtcbiAgaWYgKHYgPT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHMgPSBTdHJpbmcodik7XG4gIGlmIChzLmxlbmd0aCA8PSBtYXgpIHJldHVybiBzO1xuICByZXR1cm4gcy5zbGljZSgwLCBtYXgpICsgYFx1MjAyNigrJHtzLmxlbmd0aCAtIG1heH0gY2hhcnMpYDtcbn1cblxuZnVuY3Rpb24gcmFuZG9tSWQoKSB7XG4gIHRyeSB7XG4gICAgaWYgKGdsb2JhbFRoaXMuY3J5cHRvPy5yYW5kb21VVUlEKSByZXR1cm4gZ2xvYmFsVGhpcy5jcnlwdG8ucmFuZG9tVVVJRCgpO1xuICB9IGNhdGNoIHt9XG4gIC8vIGZhbGxiYWNrIChub3QgUkZDNDEyMi1wZXJmZWN0LCBidXQgdW5pcXVlIGVub3VnaCBmb3IgdHJhY2luZylcbiAgcmV0dXJuIFwicmlkX1wiICsgTWF0aC5yYW5kb20oKS50b1N0cmluZygxNikuc2xpY2UoMikgKyBcIl9cIiArIERhdGUubm93KCkudG9TdHJpbmcoMTYpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UmVxdWVzdElkKHJlcSkge1xuICBjb25zdCBoID0gKHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtcmVxdWVzdC1pZFwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJ4LXJlcXVlc3QtaWRcIikgfHwgXCJcIikudHJpbSgpO1xuICByZXR1cm4gaCB8fCByYW5kb21JZCgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5mZXJGdW5jdGlvbk5hbWUocmVxKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgdSA9IG5ldyBVUkwocmVxLnVybCk7XG4gICAgY29uc3QgbSA9IHUucGF0aG5hbWUubWF0Y2goL1xcL1xcLm5ldGxpZnlcXC9mdW5jdGlvbnNcXC8oW15cXC9dKykvaSk7XG4gICAgcmV0dXJuIG0gPyBtWzFdIDogXCJ1bmtub3duXCI7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBcInVua25vd25cIjtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVxdWVzdE1ldGEocmVxKSB7XG4gIGxldCB1cmwgPSBudWxsO1xuICB0cnkgeyB1cmwgPSBuZXcgVVJMKHJlcS51cmwpOyB9IGNhdGNoIHt9XG4gIHJldHVybiB7XG4gICAgbWV0aG9kOiByZXEubWV0aG9kIHx8IG51bGwsXG4gICAgcGF0aDogdXJsID8gdXJsLnBhdGhuYW1lIDogbnVsbCxcbiAgICBxdWVyeTogdXJsID8gT2JqZWN0LmZyb21FbnRyaWVzKHVybC5zZWFyY2hQYXJhbXMuZW50cmllcygpKSA6IHt9LFxuICAgIG9yaWdpbjogcmVxLmhlYWRlcnMuZ2V0KFwib3JpZ2luXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIk9yaWdpblwiKSB8fCBudWxsLFxuICAgIHJlZmVyZXI6IHJlcS5oZWFkZXJzLmdldChcInJlZmVyZXJcIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiUmVmZXJlclwiKSB8fCBudWxsLFxuICAgIHVzZXJfYWdlbnQ6IHJlcS5oZWFkZXJzLmdldChcInVzZXItYWdlbnRcIikgfHwgbnVsbCxcbiAgICBpcDogcmVxLmhlYWRlcnMuZ2V0KFwieC1uZi1jbGllbnQtY29ubmVjdGlvbi1pcFwiKSB8fCBudWxsLFxuICAgIGFwcF9pZDogKHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtYXBwXCIpIHx8IFwiXCIpLnRyaW0oKSB8fCBudWxsLFxuICAgIGJ1aWxkX2lkOiAocmVxLmhlYWRlcnMuZ2V0KFwieC1rYWl4dS1idWlsZFwiKSB8fCBcIlwiKS50cmltKCkgfHwgbnVsbFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplRXJyb3IoZXJyKSB7XG4gIGNvbnN0IGUgPSBlcnIgfHwge307XG4gIHJldHVybiB7XG4gICAgbmFtZTogc2FmZVN0cihlLm5hbWUsIDIwMCksXG4gICAgbWVzc2FnZTogc2FmZVN0cihlLm1lc3NhZ2UsIDQwMDApLFxuICAgIGNvZGU6IHNhZmVTdHIoZS5jb2RlLCAyMDApLFxuICAgIHN0YXR1czogTnVtYmVyLmlzRmluaXRlKGUuc3RhdHVzKSA/IGUuc3RhdHVzIDogbnVsbCxcbiAgICBoaW50OiBzYWZlU3RyKGUuaGludCwgMjAwMCksXG4gICAgc3RhY2s6IHNhZmVTdHIoZS5zdGFjaywgMTIwMDApLFxuICAgIHVwc3RyZWFtOiBlLnVwc3RyZWFtID8ge1xuICAgICAgcHJvdmlkZXI6IHNhZmVTdHIoZS51cHN0cmVhbS5wcm92aWRlciwgNTApLFxuICAgICAgc3RhdHVzOiBOdW1iZXIuaXNGaW5pdGUoZS51cHN0cmVhbS5zdGF0dXMpID8gZS51cHN0cmVhbS5zdGF0dXMgOiBudWxsLFxuICAgICAgYm9keTogc2FmZVN0cihlLnVwc3RyZWFtLmJvZHksIDEyMDAwKSxcbiAgICAgIHJlcXVlc3RfaWQ6IHNhZmVTdHIoZS51cHN0cmVhbS5yZXF1ZXN0X2lkLCAyMDApLFxuICAgICAgcmVzcG9uc2VfaGVhZGVyczogZS51cHN0cmVhbS5yZXNwb25zZV9oZWFkZXJzIHx8IHVuZGVmaW5lZFxuICAgIH0gOiB1bmRlZmluZWRcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN1bW1hcml6ZUpzb25Cb2R5KGJvZHkpIHtcbiAgLy8gU2FmZSBzdW1tYXJ5OyBhdm9pZHMgbG9nZ2luZyBmdWxsIHByb21wdHMgYnkgZGVmYXVsdC5cbiAgY29uc3QgYiA9IGJvZHkgfHwge307XG4gIGNvbnN0IHByb3ZpZGVyID0gKGIucHJvdmlkZXIgfHwgXCJcIikudG9TdHJpbmcoKS50cmltKCkudG9Mb3dlckNhc2UoKSB8fCBudWxsO1xuICBjb25zdCBtb2RlbCA9IChiLm1vZGVsIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpIHx8IG51bGw7XG5cbiAgbGV0IG1lc3NhZ2VDb3VudCA9IG51bGw7XG4gIGxldCB0b3RhbENoYXJzID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShiLm1lc3NhZ2VzKSkge1xuICAgICAgbWVzc2FnZUNvdW50ID0gYi5tZXNzYWdlcy5sZW5ndGg7XG4gICAgICB0b3RhbENoYXJzID0gYi5tZXNzYWdlcy5yZWR1Y2UoKGFjYywgbSkgPT4gYWNjICsgU3RyaW5nKG0/LmNvbnRlbnQgPz8gXCJcIikubGVuZ3RoLCAwKTtcbiAgICB9XG4gIH0gY2F0Y2gge31cblxuICByZXR1cm4ge1xuICAgIHByb3ZpZGVyLFxuICAgIG1vZGVsLFxuICAgIG1heF90b2tlbnM6IE51bWJlci5pc0Zpbml0ZShiLm1heF90b2tlbnMpID8gcGFyc2VJbnQoYi5tYXhfdG9rZW5zLCAxMCkgOiBudWxsLFxuICAgIHRlbXBlcmF0dXJlOiB0eXBlb2YgYi50ZW1wZXJhdHVyZSA9PT0gXCJudW1iZXJcIiA/IGIudGVtcGVyYXR1cmUgOiBudWxsLFxuICAgIG1lc3NhZ2VfY291bnQ6IG1lc3NhZ2VDb3VudCxcbiAgICBtZXNzYWdlX2NoYXJzOiB0b3RhbENoYXJzXG4gIH07XG59XG5cbi8qKlxuICogQmVzdC1lZmZvcnQgbW9uaXRvciBldmVudDogZmFpbHVyZXMgbmV2ZXIgYnJlYWsgdGhlIG1haW4gcmVxdWVzdC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGVtaXRFdmVudChldikge1xuICB0cnkge1xuICAgIGNvbnN0IGUgPSBldiB8fCB7fTtcbiAgICBjb25zdCBleHRyYSA9IGUuZXh0cmEgfHwge307XG4gICAgYXdhaXQgcShcbiAgICAgIGBpbnNlcnQgaW50byBnYXRld2F5X2V2ZW50c1xuICAgICAgICAocmVxdWVzdF9pZCwgbGV2ZWwsIGtpbmQsIGZ1bmN0aW9uX25hbWUsIG1ldGhvZCwgcGF0aCwgb3JpZ2luLCByZWZlcmVyLCB1c2VyX2FnZW50LCBpcCxcbiAgICAgICAgIGFwcF9pZCwgYnVpbGRfaWQsIGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCBwcm92aWRlciwgbW9kZWwsIGh0dHBfc3RhdHVzLCBkdXJhdGlvbl9tcyxcbiAgICAgICAgIGVycm9yX2NvZGUsIGVycm9yX21lc3NhZ2UsIGVycm9yX3N0YWNrLCB1cHN0cmVhbV9zdGF0dXMsIHVwc3RyZWFtX2JvZHksIGV4dHJhKVxuICAgICAgIHZhbHVlc1xuICAgICAgICAoJDEsJDIsJDMsJDQsJDUsJDYsJDcsJDgsJDksJDEwLFxuICAgICAgICAgJDExLCQxMiwkMTMsJDE0LCQxNSwkMTYsJDE3LCQxOCxcbiAgICAgICAgICQxOSwkMjAsJDIxLCQyMiwkMjMsJDI0LCQyNTo6anNvbmIpYCxcbiAgICAgIFtcbiAgICAgICAgc2FmZVN0cihlLnJlcXVlc3RfaWQsIDIwMCksXG4gICAgICAgIHNhZmVTdHIoZS5sZXZlbCB8fCBcImluZm9cIiwgMjApLFxuICAgICAgICBzYWZlU3RyKGUua2luZCB8fCBcImV2ZW50XCIsIDgwKSxcbiAgICAgICAgc2FmZVN0cihlLmZ1bmN0aW9uX25hbWUgfHwgXCJ1bmtub3duXCIsIDEyMCksXG4gICAgICAgIHNhZmVTdHIoZS5tZXRob2QsIDIwKSxcbiAgICAgICAgc2FmZVN0cihlLnBhdGgsIDUwMCksXG4gICAgICAgIHNhZmVTdHIoZS5vcmlnaW4sIDUwMCksXG4gICAgICAgIHNhZmVTdHIoZS5yZWZlcmVyLCA4MDApLFxuICAgICAgICBzYWZlU3RyKGUudXNlcl9hZ2VudCwgODAwKSxcbiAgICAgICAgc2FmZVN0cihlLmlwLCAyMDApLFxuXG4gICAgICAgIHNhZmVTdHIoZS5hcHBfaWQsIDIwMCksXG4gICAgICAgIHNhZmVTdHIoZS5idWlsZF9pZCwgMjAwKSxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUuY3VzdG9tZXJfaWQpID8gZS5jdXN0b21lcl9pZCA6IG51bGwsXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShlLmFwaV9rZXlfaWQpID8gZS5hcGlfa2V5X2lkIDogbnVsbCxcbiAgICAgICAgc2FmZVN0cihlLnByb3ZpZGVyLCA4MCksXG4gICAgICAgIHNhZmVTdHIoZS5tb2RlbCwgMjAwKSxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUuaHR0cF9zdGF0dXMpID8gZS5odHRwX3N0YXR1cyA6IG51bGwsXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShlLmR1cmF0aW9uX21zKSA/IGUuZHVyYXRpb25fbXMgOiBudWxsLFxuXG4gICAgICAgIHNhZmVTdHIoZS5lcnJvcl9jb2RlLCAyMDApLFxuICAgICAgICBzYWZlU3RyKGUuZXJyb3JfbWVzc2FnZSwgNDAwMCksXG4gICAgICAgIHNhZmVTdHIoZS5lcnJvcl9zdGFjaywgMTIwMDApLFxuICAgICAgICBOdW1iZXIuaXNGaW5pdGUoZS51cHN0cmVhbV9zdGF0dXMpID8gZS51cHN0cmVhbV9zdGF0dXMgOiBudWxsLFxuICAgICAgICBzYWZlU3RyKGUudXBzdHJlYW1fYm9keSwgMTIwMDApLFxuICAgICAgICBKU09OLnN0cmluZ2lmeShleHRyYSB8fCB7fSlcbiAgICAgIF1cbiAgICApO1xuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc29sZS53YXJuKFwibW9uaXRvciBlbWl0IGZhaWxlZDpcIiwgZT8ubWVzc2FnZSB8fCBlKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IGJ1aWxkQ29ycywganNvbiB9IGZyb20gXCIuL2h0dHAuanNcIjtcbmltcG9ydCB7IGVtaXRFdmVudCwgZ2V0UmVxdWVzdElkLCBpbmZlckZ1bmN0aW9uTmFtZSwgcmVxdWVzdE1ldGEsIHNlcmlhbGl6ZUVycm9yIH0gZnJvbSBcIi4vbW9uaXRvci5qc1wiO1xuXG5mdW5jdGlvbiBub3JtYWxpemVFcnJvcihlcnIpIHtcbiAgY29uc3Qgc3RhdHVzID0gZXJyPy5zdGF0dXMgfHwgNTAwO1xuICBjb25zdCBjb2RlID0gZXJyPy5jb2RlIHx8IFwiU0VSVkVSX0VSUk9SXCI7XG4gIGNvbnN0IG1lc3NhZ2UgPSBlcnI/Lm1lc3NhZ2UgfHwgXCJVbmtub3duIGVycm9yXCI7XG4gIGNvbnN0IGhpbnQgPSBlcnI/LmhpbnQ7XG4gIHJldHVybiB7IHN0YXR1cywgYm9keTogeyBlcnJvcjogbWVzc2FnZSwgY29kZSwgLi4uKGhpbnQgPyB7IGhpbnQgfSA6IHt9KSB9IH07XG59XG5cbmZ1bmN0aW9uIHdpdGhSZXF1ZXN0SWQocmVzLCByZXF1ZXN0X2lkKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgaCA9IG5ldyBIZWFkZXJzKHJlcy5oZWFkZXJzIHx8IHt9KTtcbiAgICBoLnNldChcIngta2FpeHUtcmVxdWVzdC1pZFwiLCByZXF1ZXN0X2lkKTtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKHJlcy5ib2R5LCB7IHN0YXR1czogcmVzLnN0YXR1cywgaGVhZGVyczogaCB9KTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHJlcztcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBzYWZlQm9keVByZXZpZXcocmVzKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgY3QgPSAocmVzLmhlYWRlcnMuZ2V0KFwiY29udGVudC10eXBlXCIpIHx8IFwiXCIpLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgY2xvbmUgPSByZXMuY2xvbmUoKTtcbiAgICBpZiAoY3QuaW5jbHVkZXMoXCJhcHBsaWNhdGlvbi9qc29uXCIpKSB7XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgY2xvbmUuanNvbigpLmNhdGNoKCgpID0+IG51bGwpO1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxuICAgIGNvbnN0IHQgPSBhd2FpdCBjbG9uZS50ZXh0KCkuY2F0Y2goKCkgPT4gXCJcIik7XG4gICAgaWYgKHR5cGVvZiB0ID09PSBcInN0cmluZ1wiICYmIHQubGVuZ3RoID4gMTIwMDApIHJldHVybiB0LnNsaWNlKDAsIDEyMDAwKSArIGBcdTIwMjYoKyR7dC5sZW5ndGggLSAxMjAwMH0gY2hhcnMpYDtcbiAgICByZXR1cm4gdDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyYXAoaGFuZGxlcikge1xuICByZXR1cm4gYXN5bmMgKHJlcSwgY29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCBjb3JzID0gYnVpbGRDb3JzKHJlcSk7XG4gICAgY29uc3QgcmVxdWVzdF9pZCA9IGdldFJlcXVlc3RJZChyZXEpO1xuICAgIGNvbnN0IGZ1bmN0aW9uX25hbWUgPSBpbmZlckZ1bmN0aW9uTmFtZShyZXEpO1xuICAgIGNvbnN0IG1ldGEgPSByZXF1ZXN0TWV0YShyZXEpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGhhbmRsZXIocmVxLCBjb3JzLCBjb250ZXh0KTtcblxuICAgICAgY29uc3QgZHVyYXRpb25fbXMgPSBEYXRlLm5vdygpIC0gc3RhcnQ7XG4gICAgICBjb25zdCBvdXQgPSByZXMgaW5zdGFuY2VvZiBSZXNwb25zZSA/IHdpdGhSZXF1ZXN0SWQocmVzLCByZXF1ZXN0X2lkKSA6IHJlcztcblxuICAgICAgY29uc3Qgc3RhdHVzID0gb3V0IGluc3RhbmNlb2YgUmVzcG9uc2UgPyBvdXQuc3RhdHVzIDogMjAwO1xuICAgICAgY29uc3QgbGV2ZWwgPSBzdGF0dXMgPj0gNTAwID8gXCJlcnJvclwiIDogc3RhdHVzID49IDQwMCA/IFwid2FyblwiIDogXCJpbmZvXCI7XG4gICAgICBjb25zdCBraW5kID0gc3RhdHVzID49IDQwMCA/IFwiaHR0cF9lcnJvcl9yZXNwb25zZVwiIDogXCJodHRwX3Jlc3BvbnNlXCI7XG5cbiAgICAgIGxldCBleHRyYSA9IHt9O1xuICAgICAgaWYgKHN0YXR1cyA+PSA0MDAgJiYgb3V0IGluc3RhbmNlb2YgUmVzcG9uc2UpIHtcbiAgICAgICAgZXh0cmEucmVzcG9uc2UgPSBhd2FpdCBzYWZlQm9keVByZXZpZXcob3V0KTtcbiAgICAgIH1cbiAgICAgIGlmIChkdXJhdGlvbl9tcyA+PSAxNTAwMCkge1xuICAgICAgICBleHRyYS5zbG93ID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgZW1pdEV2ZW50KHtcbiAgICAgICAgcmVxdWVzdF9pZCxcbiAgICAgICAgbGV2ZWwsXG4gICAgICAgIGtpbmQsXG4gICAgICAgIGZ1bmN0aW9uX25hbWUsXG4gICAgICAgIC4uLm1ldGEsXG4gICAgICAgIGh0dHBfc3RhdHVzOiBzdGF0dXMsXG4gICAgICAgIGR1cmF0aW9uX21zLFxuICAgICAgICBleHRyYVxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBvdXQ7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zdCBkdXJhdGlvbl9tcyA9IERhdGUubm93KCkgLSBzdGFydDtcblxuICAgICAgLy8gQmVzdC1lZmZvcnQgZGV0YWlsZWQgbW9uaXRvciByZWNvcmQuXG4gICAgICBjb25zdCBzZXIgPSBzZXJpYWxpemVFcnJvcihlcnIpO1xuICAgICAgYXdhaXQgZW1pdEV2ZW50KHtcbiAgICAgICAgcmVxdWVzdF9pZCxcbiAgICAgICAgbGV2ZWw6IFwiZXJyb3JcIixcbiAgICAgICAga2luZDogXCJ0aHJvd25fZXJyb3JcIixcbiAgICAgICAgZnVuY3Rpb25fbmFtZSxcbiAgICAgICAgLi4ubWV0YSxcbiAgICAgICAgcHJvdmlkZXI6IHNlcj8udXBzdHJlYW0/LnByb3ZpZGVyIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgaHR0cF9zdGF0dXM6IHNlcj8uc3RhdHVzIHx8IDUwMCxcbiAgICAgICAgZHVyYXRpb25fbXMsXG4gICAgICAgIGVycm9yX2NvZGU6IHNlcj8uY29kZSB8fCBcIlNFUlZFUl9FUlJPUlwiLFxuICAgICAgICBlcnJvcl9tZXNzYWdlOiBzZXI/Lm1lc3NhZ2UgfHwgXCJVbmtub3duIGVycm9yXCIsXG4gICAgICAgIGVycm9yX3N0YWNrOiBzZXI/LnN0YWNrIHx8IG51bGwsXG4gICAgICAgIHVwc3RyZWFtX3N0YXR1czogc2VyPy51cHN0cmVhbT8uc3RhdHVzIHx8IG51bGwsXG4gICAgICAgIHVwc3RyZWFtX2JvZHk6IHNlcj8udXBzdHJlYW0/LmJvZHkgfHwgbnVsbCxcbiAgICAgICAgZXh0cmE6IHsgZXJyb3I6IHNlciB9XG4gICAgICB9KTtcblxuICAgICAgLy8gQXZvaWQgNTAyczogYWx3YXlzIHJldHVybiBKU09OLlxuICAgICAgY29uc29sZS5lcnJvcihcIkZ1bmN0aW9uIGVycm9yOlwiLCBlcnIpO1xuICAgICAgY29uc3QgeyBzdGF0dXMsIGJvZHkgfSA9IG5vcm1hbGl6ZUVycm9yKGVycik7XG4gICAgICByZXR1cm4ganNvbihzdGF0dXMsIHsgLi4uYm9keSwgcmVxdWVzdF9pZCB9LCB7IC4uLmNvcnMsIFwieC1rYWl4dS1yZXF1ZXN0LWlkXCI6IHJlcXVlc3RfaWQgfSk7XG4gICAgfVxuICB9O1xufVxuIiwgImltcG9ydCBmcyBmcm9tIFwiZnNcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5cbmxldCBjYWNoZSA9IG51bGw7XG5cbmZ1bmN0aW9uIGxvYWRQcmljaW5nKCkge1xuICBpZiAoY2FjaGUpIHJldHVybiBjYWNoZTtcbiAgY29uc3QgcCA9IHBhdGguam9pbihwcm9jZXNzLmN3ZCgpLCBcInByaWNpbmdcIiwgXCJwcmljaW5nLmpzb25cIik7XG4gIGNvbnN0IHJhdyA9IGZzLnJlYWRGaWxlU3luYyhwLCBcInV0ZjhcIik7XG4gIGNhY2hlID0gSlNPTi5wYXJzZShyYXcpO1xuICByZXR1cm4gY2FjaGU7XG59XG5cbmZ1bmN0aW9uIHVucHJpY2VkRXJyb3IocHJvdmlkZXIsIG1vZGVsKSB7XG4gIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgVW5wcmljZWQgbW9kZWw6ICR7cHJvdmlkZXJ9OiR7bW9kZWx9YCk7XG4gIGVyci5jb2RlID0gXCJVTlBSSUNFRF9NT0RFTFwiO1xuICAvLyA0MDkgY29tbXVuaWNhdGVzIFwieW91ciByZXF1ZXN0IGlzIHZhbGlkIEpTT04gYnV0IGNvbmZsaWN0cyB3aXRoIHNlcnZlciBwb2xpY3kvY29uZmlnXCJcbiAgZXJyLnN0YXR1cyA9IDQwOTtcbiAgZXJyLmhpbnQgPSBcIlRoaXMgbW9kZWwvcHJvdmlkZXIgaXMgbm90IGVuYWJsZWQgZm9yIGJpbGxpbmcuIEFzayBhbiBhZG1pbiB0byBhZGQgaXQgdG8gcHJpY2luZy9wcmljaW5nLmpzb24gKGFuZCBhbGxvd2xpc3RzKS5cIjtcbiAgcmV0dXJuIGVycjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvc3RDZW50cyhwcm92aWRlciwgbW9kZWwsIGlucHV0VG9rZW5zLCBvdXRwdXRUb2tlbnMpIHtcbiAgY29uc3QgcHJpY2luZyA9IGxvYWRQcmljaW5nKCk7XG4gIGNvbnN0IGVudHJ5ID0gcHJpY2luZz8uW3Byb3ZpZGVyXT8uW21vZGVsXTtcbiAgaWYgKCFlbnRyeSkgdGhyb3cgdW5wcmljZWRFcnJvcihwcm92aWRlciwgbW9kZWwpO1xuXG4gIGNvbnN0IGluUmF0ZSA9IE51bWJlcihlbnRyeS5pbnB1dF9wZXJfMW1fdXNkKTtcbiAgY29uc3Qgb3V0UmF0ZSA9IE51bWJlcihlbnRyeS5vdXRwdXRfcGVyXzFtX3VzZCk7XG5cbiAgLy8gVHJlYXQgbWlzc2luZy9OYU4gYXMgbWlzY29uZmlndXJhdGlvbi5cbiAgaWYgKCFOdW1iZXIuaXNGaW5pdGUoaW5SYXRlKSB8fCAhTnVtYmVyLmlzRmluaXRlKG91dFJhdGUpKSB0aHJvdyB1bnByaWNlZEVycm9yKHByb3ZpZGVyLCBtb2RlbCk7XG5cbiAgY29uc3QgaW5Vc2QgPSAoTnVtYmVyKGlucHV0VG9rZW5zIHx8IDApIC8gMV8wMDBfMDAwKSAqIGluUmF0ZTtcbiAgY29uc3Qgb3V0VXNkID0gKE51bWJlcihvdXRwdXRUb2tlbnMgfHwgMCkgLyAxXzAwMF8wMDApICogb3V0UmF0ZTtcbiAgY29uc3QgdG90YWxVc2QgPSBpblVzZCArIG91dFVzZDtcblxuICByZXR1cm4gTWF0aC5tYXgoMCwgTWF0aC5yb3VuZCh0b3RhbFVzZCAqIDEwMCkpO1xufVxuIiwgImltcG9ydCB7IFRleHREZWNvZGVyIH0gZnJvbSBcInV0aWxcIjtcblxuZnVuY3Rpb24gY29uZmlnRXJyb3IobWVzc2FnZSwgaGludCkge1xuICBjb25zdCBlcnIgPSBuZXcgRXJyb3IobWVzc2FnZSk7XG4gIGVyci5jb2RlID0gXCJDT05GSUdcIjtcbiAgZXJyLnN0YXR1cyA9IDUwMDtcbiAgaWYgKGhpbnQpIGVyci5oaW50ID0gaGludDtcbiAgcmV0dXJuIGVycjtcbn1cblxuXG5mdW5jdGlvbiBzYWZlSnNvblN0cmluZyh2LCBtYXggPSAxMjAwMCkge1xuICB0cnkge1xuICAgIGNvbnN0IHMgPSB0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIiA/IHYgOiBKU09OLnN0cmluZ2lmeSh2KTtcbiAgICBpZiAoIXMpIHJldHVybiBcIlwiO1xuICAgIGlmIChzLmxlbmd0aCA8PSBtYXgpIHJldHVybiBzO1xuICAgIHJldHVybiBzLnNsaWNlKDAsIG1heCkgKyBgXHUyMDI2KCske3MubGVuZ3RoIC0gbWF4fSBjaGFycylgO1xuICB9IGNhdGNoIHtcbiAgICBjb25zdCBzID0gU3RyaW5nKHYgfHwgXCJcIik7XG4gICAgaWYgKHMubGVuZ3RoIDw9IG1heCkgcmV0dXJuIHM7XG4gICAgcmV0dXJuIHMuc2xpY2UoMCwgbWF4KSArIGBcdTIwMjYoKyR7cy5sZW5ndGggLSBtYXh9IGNoYXJzKWA7XG4gIH1cbn1cblxuZnVuY3Rpb24gdXBzdHJlYW1FcnJvcihwcm92aWRlciwgcmVzLCBib2R5KSB7XG4gIGNvbnN0IHN0YXR1cyA9IHJlcz8uc3RhdHVzIHx8IDA7XG4gIGNvbnN0IHJlcUlkID1cbiAgICByZXM/LmhlYWRlcnM/LmdldD8uKFwieC1yZXF1ZXN0LWlkXCIpIHx8XG4gICAgcmVzPy5oZWFkZXJzPy5nZXQ/LihcInJlcXVlc3QtaWRcIikgfHxcbiAgICByZXM/LmhlYWRlcnM/LmdldD8uKFwieC1hbXpuLXJlcXVlc3RpZFwiKSB8fFxuICAgIG51bGw7XG5cbiAgLy8gVHJ5IHRvIHN1cmZhY2UgdGhlIG1vc3QgbWVhbmluZ2Z1bCBwcm92aWRlciBtZXNzYWdlLlxuICBsZXQgbXNnID0gXCJcIjtcbiAgdHJ5IHtcbiAgICBtc2cgPSBib2R5Py5lcnJvcj8ubWVzc2FnZSB8fCBib2R5Py5lcnJvcj8udHlwZSB8fCBib2R5Py5tZXNzYWdlIHx8IFwiXCI7XG4gIH0gY2F0Y2gge31cbiAgY29uc3QgZXJyID0gbmV3IEVycm9yKG1zZyA/IGAke3Byb3ZpZGVyfSB1cHN0cmVhbSBlcnJvciAke3N0YXR1c306ICR7bXNnfWAgOiBgJHtwcm92aWRlcn0gdXBzdHJlYW0gZXJyb3IgJHtzdGF0dXN9YCk7XG4gIGVyci5jb2RlID0gXCJVUFNUUkVBTV9FUlJPUlwiO1xuICBlcnIuc3RhdHVzID0gNTAyO1xuICBlcnIudXBzdHJlYW0gPSB7XG4gICAgcHJvdmlkZXIsXG4gICAgc3RhdHVzLFxuICAgIHJlcXVlc3RfaWQ6IHJlcUlkLFxuICAgIGJvZHk6IHNhZmVKc29uU3RyaW5nKGJvZHkpXG4gIH07XG4gIHJldHVybiBlcnI7XG59XG5cbi8qKlxuICogTm9uLXN0cmVhbSBjYWxsc1xuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2FsbE9wZW5BSSh7IG1vZGVsLCBtZXNzYWdlcywgbWF4X3Rva2VucywgdGVtcGVyYXR1cmUgfSkge1xuICBjb25zdCBhcGlLZXkgPSBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0tFWTtcbiAgaWYgKCFhcGlLZXkpIHRocm93IGNvbmZpZ0Vycm9yKFwiT1BFTkFJX0FQSV9LRVkgbm90IGNvbmZpZ3VyZWRcIiwgXCJTZXQgT1BFTkFJX0FQSV9LRVkgaW4gTmV0bGlmeSBcdTIxOTIgU2l0ZSBjb25maWd1cmF0aW9uIFx1MjE5MiBFbnZpcm9ubWVudCB2YXJpYWJsZXMgKHlvdXIgT3BlbkFJIEFQSSBrZXkpLlwiKTtcblxuICBjb25zdCBpbnB1dCA9IEFycmF5LmlzQXJyYXkobWVzc2FnZXMpID8gbWVzc2FnZXMubWFwKG0gPT4gKHtcbiAgICByb2xlOiBtLnJvbGUsXG4gICAgY29udGVudDogW3sgdHlwZTogXCJpbnB1dF90ZXh0XCIsIHRleHQ6IFN0cmluZyhtLmNvbnRlbnQgPz8gXCJcIikgfV1cbiAgfSkpIDogW107XG5cbiAgY29uc3QgYm9keSA9IHtcbiAgICBtb2RlbCxcbiAgICBpbnB1dCxcbiAgICB0ZW1wZXJhdHVyZTogdHlwZW9mIHRlbXBlcmF0dXJlID09PSBcIm51bWJlclwiID8gdGVtcGVyYXR1cmUgOiAxLFxuICAgIG1heF9vdXRwdXRfdG9rZW5zOiB0eXBlb2YgbWF4X3Rva2VucyA9PT0gXCJudW1iZXJcIiA/IG1heF90b2tlbnMgOiAxMDI0LFxuICAgIHN0b3JlOiBmYWxzZVxuICB9O1xuXG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKFwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MS9yZXNwb25zZXNcIiwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczoge1xuICAgICAgXCJhdXRob3JpemF0aW9uXCI6IGBCZWFyZXIgJHthcGlLZXl9YCxcbiAgICAgIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KVxuICB9KTtcblxuICBjb25zdCBkYXRhID0gYXdhaXQgcmVzLmpzb24oKS5jYXRjaCgoKT0+ICh7fSkpO1xuICBpZiAoIXJlcy5vaykgdGhyb3cgdXBzdHJlYW1FcnJvcihcIm9wZW5haVwiLCByZXMsIGRhdGEpO1xuXG4gIGxldCBvdXQgPSBcIlwiO1xuICBjb25zdCBvdXRwdXQgPSBBcnJheS5pc0FycmF5KGRhdGEub3V0cHV0KSA/IGRhdGEub3V0cHV0IDogW107XG4gIGZvciAoY29uc3QgaXRlbSBvZiBvdXRwdXQpIHtcbiAgICBpZiAoaXRlbT8udHlwZSA9PT0gXCJtZXNzYWdlXCIgJiYgQXJyYXkuaXNBcnJheShpdGVtLmNvbnRlbnQpKSB7XG4gICAgICBmb3IgKGNvbnN0IGMgb2YgaXRlbS5jb250ZW50KSB7XG4gICAgICAgIGlmIChjPy50eXBlID09PSBcIm91dHB1dF90ZXh0XCIgJiYgdHlwZW9mIGMudGV4dCA9PT0gXCJzdHJpbmdcIikgb3V0ICs9IGMudGV4dDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjb25zdCB1c2FnZSA9IGRhdGEudXNhZ2UgfHwge307XG4gIHJldHVybiB7IG91dHB1dF90ZXh0OiBvdXQsIGlucHV0X3Rva2VuczogdXNhZ2UuaW5wdXRfdG9rZW5zIHx8IDAsIG91dHB1dF90b2tlbnM6IHVzYWdlLm91dHB1dF90b2tlbnMgfHwgMCwgcmF3OiBkYXRhIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjYWxsQW50aHJvcGljKHsgbW9kZWwsIG1lc3NhZ2VzLCBtYXhfdG9rZW5zLCB0ZW1wZXJhdHVyZSB9KSB7XG4gIGNvbnN0IGFwaUtleSA9IHByb2Nlc3MuZW52LkFOVEhST1BJQ19BUElfS0VZO1xuICBpZiAoIWFwaUtleSkgdGhyb3cgY29uZmlnRXJyb3IoXCJBTlRIUk9QSUNfQVBJX0tFWSBub3QgY29uZmlndXJlZFwiLCBcIlNldCBBTlRIUk9QSUNfQVBJX0tFWSBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcyAoeW91ciBBbnRocm9waWMgQVBJIGtleSkuXCIpO1xuXG4gIGNvbnN0IHN5c3RlbVBhcnRzID0gW107XG4gIGNvbnN0IG91dE1zZ3MgPSBbXTtcblxuICBjb25zdCBtc2dzID0gQXJyYXkuaXNBcnJheShtZXNzYWdlcykgPyBtZXNzYWdlcyA6IFtdO1xuICBmb3IgKGNvbnN0IG0gb2YgbXNncykge1xuICAgIGNvbnN0IHJvbGUgPSBTdHJpbmcobS5yb2xlIHx8IFwiXCIpLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgdGV4dCA9IFN0cmluZyhtLmNvbnRlbnQgPz8gXCJcIik7XG4gICAgaWYgKCF0ZXh0KSBjb250aW51ZTtcbiAgICBpZiAocm9sZSA9PT0gXCJzeXN0ZW1cIiB8fCByb2xlID09PSBcImRldmVsb3BlclwiKSBzeXN0ZW1QYXJ0cy5wdXNoKHRleHQpO1xuICAgIGVsc2UgaWYgKHJvbGUgPT09IFwiYXNzaXN0YW50XCIpIG91dE1zZ3MucHVzaCh7IHJvbGU6IFwiYXNzaXN0YW50XCIsIGNvbnRlbnQ6IHRleHQgfSk7XG4gICAgZWxzZSBvdXRNc2dzLnB1c2goeyByb2xlOiBcInVzZXJcIiwgY29udGVudDogdGV4dCB9KTtcbiAgfVxuXG4gIGNvbnN0IGJvZHkgPSB7XG4gICAgbW9kZWwsXG4gICAgbWF4X3Rva2VuczogdHlwZW9mIG1heF90b2tlbnMgPT09IFwibnVtYmVyXCIgPyBtYXhfdG9rZW5zIDogMTAyNCxcbiAgICB0ZW1wZXJhdHVyZTogdHlwZW9mIHRlbXBlcmF0dXJlID09PSBcIm51bWJlclwiID8gdGVtcGVyYXR1cmUgOiAxLFxuICAgIG1lc3NhZ2VzOiBvdXRNc2dzXG4gIH07XG4gIGlmIChzeXN0ZW1QYXJ0cy5sZW5ndGgpIGJvZHkuc3lzdGVtID0gc3lzdGVtUGFydHMuam9pbihcIlxcblxcblwiKTtcblxuY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goXCJodHRwczovL2FwaS5hbnRocm9waWMuY29tL3YxL21lc3NhZ2VzXCIsIHtcbiAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgIFwieC1hcGkta2V5XCI6IGFwaUtleSxcbiAgICAgIFwiYW50aHJvcGljLXZlcnNpb25cIjogXCIyMDIzLTA2LTAxXCIsXG4gICAgICBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIlxuICAgIH0sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSlcbiAgfSk7XG5cbiAgY29uc3QgZGF0YSA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCk9PiAoe30pKTtcbiAgaWYgKCFyZXMub2spIHRocm93IHVwc3RyZWFtRXJyb3IoXCJhbnRocm9waWNcIiwgcmVzLCBkYXRhKTtcblxuICBjb25zdCB0ZXh0ID0gQXJyYXkuaXNBcnJheShkYXRhPy5jb250ZW50KSA/IGRhdGEuY29udGVudC5tYXAoYyA9PiBjPy50ZXh0IHx8IFwiXCIpLmpvaW4oXCJcIikgOiAoZGF0YT8uY29udGVudD8uWzBdPy50ZXh0IHx8IGRhdGE/LmNvbXBsZXRpb24gfHwgXCJcIik7XG4gIGNvbnN0IHVzYWdlID0gZGF0YT8udXNhZ2UgfHwge307XG4gIHJldHVybiB7IG91dHB1dF90ZXh0OiB0ZXh0LCBpbnB1dF90b2tlbnM6IHVzYWdlLmlucHV0X3Rva2VucyB8fCAwLCBvdXRwdXRfdG9rZW5zOiB1c2FnZS5vdXRwdXRfdG9rZW5zIHx8IDAsIHJhdzogZGF0YSB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2FsbEdlbWluaSh7IG1vZGVsLCBtZXNzYWdlcywgbWF4X3Rva2VucywgdGVtcGVyYXR1cmUgfSkge1xuICBjb25zdCBhcGlLZXlSYXcgPSBwcm9jZXNzLmVudi5HRU1JTklfQVBJX0tFWV9MT0NBTCB8fCBwcm9jZXNzLmVudi5HRU1JTklfQVBJX0tFWTtcbiAgY29uc3QgYXBpS2V5ID0gU3RyaW5nKGFwaUtleVJhdyB8fCBcIlwiKVxuICAgIC50cmltKClcbiAgICAucmVwbGFjZSgvXlwiKC4qKVwiJC8sIFwiJDFcIilcbiAgICAudHJpbSgpO1xuICBpZiAoIWFwaUtleSkgdGhyb3cgY29uZmlnRXJyb3IoXCJHRU1JTklfQVBJX0tFWSBub3QgY29uZmlndXJlZFwiLCBcIlNldCBHRU1JTklfQVBJX0tFWSAob3IgZm9yIGxvY2FsIGRldjogR0VNSU5JX0FQSV9LRVlfTE9DQUwpIGluIE5ldGxpZnkgXHUyMTkyIFNpdGUgY29uZmlndXJhdGlvbiBcdTIxOTIgRW52aXJvbm1lbnQgdmFyaWFibGVzLlwiKTtcblxuICBjb25zdCBzeXN0ZW1QYXJ0cyA9IFtdO1xuICBjb25zdCBjb250ZW50cyA9IFtdO1xuXG4gIGNvbnN0IG1zZ3MgPSBBcnJheS5pc0FycmF5KG1lc3NhZ2VzKSA/IG1lc3NhZ2VzIDogW107XG4gIGZvciAoY29uc3QgbSBvZiBtc2dzKSB7XG4gICAgY29uc3Qgcm9sZSA9IG0ucm9sZTtcbiAgICBjb25zdCB0ZXh0ID0gU3RyaW5nKG0uY29udGVudCA/PyBcIlwiKTtcbiAgICBpZiAocm9sZSA9PT0gXCJzeXN0ZW1cIikgc3lzdGVtUGFydHMucHVzaCh0ZXh0KTtcbiAgICBlbHNlIGlmIChyb2xlID09PSBcImFzc2lzdGFudFwiKSBjb250ZW50cy5wdXNoKHsgcm9sZTogXCJtb2RlbFwiLCBwYXJ0czogW3sgdGV4dCB9XSB9KTtcbiAgICBlbHNlIGNvbnRlbnRzLnB1c2goeyByb2xlOiBcInVzZXJcIiwgcGFydHM6IFt7IHRleHQgfV0gfSk7XG4gIH1cblxuICBjb25zdCBib2R5ID0ge1xuICAgIGNvbnRlbnRzLFxuICAgIGdlbmVyYXRpb25Db25maWc6IHtcbiAgICAgIG1heE91dHB1dFRva2VuczogdHlwZW9mIG1heF90b2tlbnMgPT09IFwibnVtYmVyXCIgPyBtYXhfdG9rZW5zIDogMTAyNCxcbiAgICAgIHRlbXBlcmF0dXJlOiB0eXBlb2YgdGVtcGVyYXR1cmUgPT09IFwibnVtYmVyXCIgPyB0ZW1wZXJhdHVyZSA6IDFcbiAgICB9XG4gIH07XG4gIGlmIChzeXN0ZW1QYXJ0cy5sZW5ndGgpIGJvZHkuc3lzdGVtSW5zdHJ1Y3Rpb24gPSB7IHBhcnRzOiBbeyB0ZXh0OiBzeXN0ZW1QYXJ0cy5qb2luKFwiXFxuXFxuXCIpIH1dIH07XG5cbiAgY29uc3QgdXJsID0gYGh0dHBzOi8vZ2VuZXJhdGl2ZWxhbmd1YWdlLmdvb2dsZWFwaXMuY29tL3YxYmV0YS9tb2RlbHMvJHtlbmNvZGVVUklDb21wb25lbnQobW9kZWwpfTpnZW5lcmF0ZUNvbnRlbnRgO1xuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgIGhlYWRlcnM6IHsgXCJ4LWdvb2ctYXBpLWtleVwiOiBhcGlLZXksIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSlcbiAgfSk7XG5cbiAgY29uc3QgZGF0YSA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCk9PiAoe30pKTtcbiAgaWYgKCFyZXMub2spIHRocm93IHVwc3RyZWFtRXJyb3IoXCJnZW1pbmlcIiwgcmVzLCBkYXRhKTtcblxuICBsZXQgb3V0ID0gXCJcIjtcbiAgY29uc3QgY2FuZGlkYXRlcyA9IEFycmF5LmlzQXJyYXkoZGF0YS5jYW5kaWRhdGVzKSA/IGRhdGEuY2FuZGlkYXRlcyA6IFtdO1xuICBmb3IgKGNvbnN0IGNhbmQgb2YgY2FuZGlkYXRlcykge1xuICAgIGNvbnN0IGNvbnRlbnQgPSBjYW5kPy5jb250ZW50O1xuICAgIGlmIChjb250ZW50Py5wYXJ0cykgZm9yIChjb25zdCBwIG9mIGNvbnRlbnQucGFydHMpIGlmICh0eXBlb2YgcC50ZXh0ID09PSBcInN0cmluZ1wiKSBvdXQgKz0gcC50ZXh0O1xuICAgIGlmIChvdXQpIGJyZWFrO1xuICB9XG5cbiAgY29uc3QgdXNhZ2UgPSBkYXRhLnVzYWdlTWV0YWRhdGEgfHwge307XG4gIHJldHVybiB7IG91dHB1dF90ZXh0OiBvdXQsIGlucHV0X3Rva2VuczogdXNhZ2UucHJvbXB0VG9rZW5Db3VudCB8fCAwLCBvdXRwdXRfdG9rZW5zOiB1c2FnZS5jYW5kaWRhdGVzVG9rZW5Db3VudCB8fCAwLCByYXc6IGRhdGEgfTtcbn1cblxuLyoqXG4gKiBTdHJlYW0gYWRhcHRlcnM6XG4gKiBFYWNoIHJldHVybnMgeyB1cHN0cmVhbTogUmVzcG9uc2UsIHBhcnNlQ2h1bmsodGV4dCktPntkZWx0YVRleHQsIGRvbmUsIHVzYWdlP31bXSB9LlxuICogV2Ugbm9ybWFsaXplIGludG8gU1NFIGV2ZW50cyBmb3IgdGhlIGNsaWVudDogXCJkZWx0YVwiIGFuZCBcImRvbmVcIi5cbiAqL1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3RyZWFtT3BlbkFJKHsgbW9kZWwsIG1lc3NhZ2VzLCBtYXhfdG9rZW5zLCB0ZW1wZXJhdHVyZSB9KSB7XG4gIGNvbnN0IGFwaUtleSA9IHByb2Nlc3MuZW52Lk9QRU5BSV9BUElfS0VZO1xuICBpZiAoIWFwaUtleSkgdGhyb3cgY29uZmlnRXJyb3IoXCJPUEVOQUlfQVBJX0tFWSBub3QgY29uZmlndXJlZFwiLCBcIlNldCBPUEVOQUlfQVBJX0tFWSBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcyAoeW91ciBPcGVuQUkgQVBJIGtleSkuXCIpO1xuXG4gIGNvbnN0IGlucHV0ID0gQXJyYXkuaXNBcnJheShtZXNzYWdlcykgPyBtZXNzYWdlcy5tYXAobSA9PiAoe1xuICAgIHJvbGU6IG0ucm9sZSxcbiAgICBjb250ZW50OiBbeyB0eXBlOiBcImlucHV0X3RleHRcIiwgdGV4dDogU3RyaW5nKG0uY29udGVudCA/PyBcIlwiKSB9XVxuICB9KSkgOiBbXTtcblxuICBjb25zdCBib2R5ID0ge1xuICAgIG1vZGVsLFxuICAgIGlucHV0LFxuICAgIHRlbXBlcmF0dXJlOiB0eXBlb2YgdGVtcGVyYXR1cmUgPT09IFwibnVtYmVyXCIgPyB0ZW1wZXJhdHVyZSA6IDEsXG4gICAgbWF4X291dHB1dF90b2tlbnM6IHR5cGVvZiBtYXhfdG9rZW5zID09PSBcIm51bWJlclwiID8gbWF4X3Rva2VucyA6IDEwMjQsXG4gICAgc3RvcmU6IGZhbHNlLFxuICAgIHN0cmVhbTogdHJ1ZVxuICB9O1xuXG4gIGNvbnN0IHVwc3RyZWFtID0gYXdhaXQgZmV0Y2goXCJodHRwczovL2FwaS5vcGVuYWkuY29tL3YxL3Jlc3BvbnNlc1wiLCB7XG4gICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICBoZWFkZXJzOiB7XG4gICAgICBcImF1dGhvcml6YXRpb25cIjogYEJlYXJlciAke2FwaUtleX1gLFxuICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICBcImFjY2VwdFwiOiBcInRleHQvZXZlbnQtc3RyZWFtXCJcbiAgICB9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpXG4gIH0pO1xuXG4gIGlmICghdXBzdHJlYW0ub2spIHtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdXBzdHJlYW0uanNvbigpLmNhdGNoKCgpPT4gKHt9KSk7XG4gICAgdGhyb3cgbmV3IEVycm9yKGRhdGE/LmVycm9yPy5tZXNzYWdlIHx8IGBPcGVuQUkgZXJyb3IgJHt1cHN0cmVhbS5zdGF0dXN9YCk7XG4gIH1cblxuICAvLyBQYXJzZSBPcGVuQUkgU1NFIGxpbmVzOiBkYXRhOiB7anNvbn1cbiAgZnVuY3Rpb24gcGFyc2VTc2VMaW5lcyhjaHVua1RleHQpIHtcbiAgICBjb25zdCBvdXQgPSBbXTtcbiAgICBjb25zdCBsaW5lcyA9IGNodW5rVGV4dC5zcGxpdCgvXFxyP1xcbi8pO1xuICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgaWYgKCFsaW5lLnN0YXJ0c1dpdGgoXCJkYXRhOlwiKSkgY29udGludWU7XG4gICAgICBjb25zdCBwYXlsb2FkID0gbGluZS5zbGljZSg1KS50cmltKCk7XG4gICAgICBpZiAoIXBheWxvYWQgfHwgcGF5bG9hZCA9PT0gXCJbRE9ORV1cIikgY29udGludWU7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBvYmogPSBKU09OLnBhcnNlKHBheWxvYWQpO1xuICAgICAgICBjb25zdCB0ID0gb2JqLnR5cGUgfHwgXCJcIjtcbiAgICAgICAgaWYgKHQuaW5jbHVkZXMoXCJvdXRwdXRfdGV4dC5kZWx0YVwiKSAmJiB0eXBlb2Ygb2JqLmRlbHRhID09PSBcInN0cmluZ1wiKSBvdXQucHVzaCh7IHR5cGU6IFwiZGVsdGFcIiwgdGV4dDogb2JqLmRlbHRhIH0pO1xuICAgICAgICBpZiAodCA9PT0gXCJyZXNwb25zZS5jb21wbGV0ZWRcIiB8fCB0ID09PSBcInJlc3BvbnNlLmNvbXBsZXRlXCIgfHwgdC5pbmNsdWRlcyhcInJlc3BvbnNlLmNvbXBsZXRlZFwiKSkge1xuICAgICAgICAgIGNvbnN0IHVzYWdlID0gb2JqLnJlc3BvbnNlPy51c2FnZSB8fCBvYmoudXNhZ2UgfHwge307XG4gICAgICAgICAgb3V0LnB1c2goeyB0eXBlOiBcImRvbmVcIiwgdXNhZ2U6IHsgaW5wdXRfdG9rZW5zOiB1c2FnZS5pbnB1dF90b2tlbnMgfHwgMCwgb3V0cHV0X3Rva2VuczogdXNhZ2Uub3V0cHV0X3Rva2VucyB8fCAwIH0gfSk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2gge31cbiAgICB9XG4gICAgcmV0dXJuIG91dDtcbiAgfVxuXG4gIHJldHVybiB7IHVwc3RyZWFtLCBwYXJzZTogcGFyc2VTc2VMaW5lcyB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3RyZWFtQW50aHJvcGljKHsgbW9kZWwsIG1lc3NhZ2VzLCBtYXhfdG9rZW5zLCB0ZW1wZXJhdHVyZSB9KSB7XG4gIGNvbnN0IGFwaUtleSA9IHByb2Nlc3MuZW52LkFOVEhST1BJQ19BUElfS0VZO1xuICBpZiAoIWFwaUtleSkgdGhyb3cgY29uZmlnRXJyb3IoXCJBTlRIUk9QSUNfQVBJX0tFWSBub3QgY29uZmlndXJlZFwiLCBcIlNldCBBTlRIUk9QSUNfQVBJX0tFWSBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcyAoeW91ciBBbnRocm9waWMgQVBJIGtleSkuXCIpO1xuXG4gIGNvbnN0IHN5c3RlbVBhcnRzID0gW107XG4gIGNvbnN0IG91dE1zZ3MgPSBbXTtcblxuICBjb25zdCBtc2dzID0gQXJyYXkuaXNBcnJheShtZXNzYWdlcykgPyBtZXNzYWdlcyA6IFtdO1xuICBmb3IgKGNvbnN0IG0gb2YgbXNncykge1xuICAgIGNvbnN0IHJvbGUgPSBTdHJpbmcobS5yb2xlIHx8IFwiXCIpLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgdGV4dCA9IFN0cmluZyhtLmNvbnRlbnQgPz8gXCJcIik7XG4gICAgaWYgKCF0ZXh0KSBjb250aW51ZTtcbiAgICBpZiAocm9sZSA9PT0gXCJzeXN0ZW1cIiB8fCByb2xlID09PSBcImRldmVsb3BlclwiKSBzeXN0ZW1QYXJ0cy5wdXNoKHRleHQpO1xuICAgIGVsc2UgaWYgKHJvbGUgPT09IFwiYXNzaXN0YW50XCIpIG91dE1zZ3MucHVzaCh7IHJvbGU6IFwiYXNzaXN0YW50XCIsIGNvbnRlbnQ6IHRleHQgfSk7XG4gICAgZWxzZSBvdXRNc2dzLnB1c2goeyByb2xlOiBcInVzZXJcIiwgY29udGVudDogdGV4dCB9KTtcbiAgfVxuXG4gIGNvbnN0IGJvZHkgPSB7XG4gICAgbW9kZWwsXG4gICAgbWF4X3Rva2VuczogdHlwZW9mIG1heF90b2tlbnMgPT09IFwibnVtYmVyXCIgPyBtYXhfdG9rZW5zIDogMTAyNCxcbiAgICB0ZW1wZXJhdHVyZTogdHlwZW9mIHRlbXBlcmF0dXJlID09PSBcIm51bWJlclwiID8gdGVtcGVyYXR1cmUgOiAxLFxuICAgIHN0cmVhbTogdHJ1ZSxcbiAgICBtZXNzYWdlczogb3V0TXNnc1xuICB9O1xuICBpZiAoc3lzdGVtUGFydHMubGVuZ3RoKSBib2R5LnN5c3RlbSA9IHN5c3RlbVBhcnRzLmpvaW4oXCJcXG5cXG5cIik7XG5cbmNvbnN0IHVwc3RyZWFtID0gYXdhaXQgZmV0Y2goXCJodHRwczovL2FwaS5hbnRocm9waWMuY29tL3YxL21lc3NhZ2VzXCIsIHtcbiAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgIFwieC1hcGkta2V5XCI6IGFwaUtleSxcbiAgICAgIFwiYW50aHJvcGljLXZlcnNpb25cIjogXCIyMDIzLTA2LTAxXCIsXG4gICAgICBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgIFwiYWNjZXB0XCI6IFwidGV4dC9ldmVudC1zdHJlYW1cIlxuICAgIH0sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSlcbiAgfSk7XG5cbiAgaWYgKCF1cHN0cmVhbS5vaykge1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB1cHN0cmVhbS5qc29uKCkuY2F0Y2goKCk9PiAoe30pKTtcbiAgICB0aHJvdyBuZXcgRXJyb3IoZGF0YT8uZXJyb3I/Lm1lc3NhZ2UgfHwgYEFudGhyb3BpYyBlcnJvciAke3Vwc3RyZWFtLnN0YXR1c31gKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHBhcnNlU3NlTGluZXMoY2h1bmtUZXh0KSB7XG4gICAgY29uc3Qgb3V0ID0gW107XG4gICAgY29uc3QgbGluZXMgPSBjaHVua1RleHQuc3BsaXQoL1xccj9cXG4vKTtcbiAgICAvLyBBbnRocm9waWMgU1NFIHVzZXMgXCJldmVudDpcIiBhbmQgXCJkYXRhOlwiIGxpbmVzOyB3ZSBwYXJzZSBkYXRhIGpzb25cbiAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgIGlmICghbGluZS5zdGFydHNXaXRoKFwiZGF0YTpcIikpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgcGF5bG9hZCA9IGxpbmUuc2xpY2UoNSkudHJpbSgpO1xuICAgICAgaWYgKCFwYXlsb2FkIHx8IHBheWxvYWQgPT09IFwiW0RPTkVdXCIpIGNvbnRpbnVlO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgb2JqID0gSlNPTi5wYXJzZShwYXlsb2FkKTtcbiAgICAgICAgY29uc3QgdCA9IG9iai50eXBlIHx8IFwiXCI7XG4gICAgICAgIGlmICh0ID09PSBcImNvbnRlbnRfYmxvY2tfZGVsdGFcIiAmJiBvYmouZGVsdGE/LnR5cGUgPT09IFwidGV4dF9kZWx0YVwiICYmIHR5cGVvZiBvYmouZGVsdGEudGV4dCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgIG91dC5wdXNoKHsgdHlwZTogXCJkZWx0YVwiLCB0ZXh0OiBvYmouZGVsdGEudGV4dCB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodCA9PT0gXCJtZXNzYWdlX2RlbHRhXCIgJiYgb2JqLnVzYWdlKSB7XG4gICAgICAgICAgLy8gaW50ZXJtZWRpYXRlIHVzYWdlIHNvbWV0aW1lc1xuICAgICAgICB9XG4gICAgICAgIGlmICh0ID09PSBcIm1lc3NhZ2Vfc3RvcFwiIHx8IHQgPT09IFwibWVzc2FnZV9lbmRcIiB8fCB0ID09PSBcIm1lc3NhZ2VfY29tcGxldGVcIikge1xuICAgICAgICAgIGNvbnN0IHVzYWdlID0gb2JqLnVzYWdlIHx8IHt9O1xuICAgICAgICAgIG91dC5wdXNoKHsgdHlwZTogXCJkb25lXCIsIHVzYWdlOiB7IGlucHV0X3Rva2VuczogdXNhZ2UuaW5wdXRfdG9rZW5zIHx8IDAsIG91dHB1dF90b2tlbnM6IHVzYWdlLm91dHB1dF90b2tlbnMgfHwgMCB9IH0pO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIHt9XG4gICAgfVxuICAgIHJldHVybiBvdXQ7XG4gIH1cblxuICByZXR1cm4geyB1cHN0cmVhbSwgcGFyc2U6IHBhcnNlU3NlTGluZXMgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHN0cmVhbUdlbWluaSh7IG1vZGVsLCBtZXNzYWdlcywgbWF4X3Rva2VucywgdGVtcGVyYXR1cmUgfSkge1xuICBjb25zdCBhcGlLZXlSYXcgPSBwcm9jZXNzLmVudi5HRU1JTklfQVBJX0tFWV9MT0NBTCB8fCBwcm9jZXNzLmVudi5HRU1JTklfQVBJX0tFWTtcbiAgY29uc3QgYXBpS2V5ID0gU3RyaW5nKGFwaUtleVJhdyB8fCBcIlwiKVxuICAgIC50cmltKClcbiAgICAucmVwbGFjZSgvXlwiKC4qKVwiJC8sIFwiJDFcIilcbiAgICAudHJpbSgpO1xuICBpZiAoIWFwaUtleSkgdGhyb3cgY29uZmlnRXJyb3IoXCJHRU1JTklfQVBJX0tFWSBub3QgY29uZmlndXJlZFwiLCBcIlNldCBHRU1JTklfQVBJX0tFWSAob3IgZm9yIGxvY2FsIGRldjogR0VNSU5JX0FQSV9LRVlfTE9DQUwpIGluIE5ldGxpZnkgXHUyMTkyIFNpdGUgY29uZmlndXJhdGlvbiBcdTIxOTIgRW52aXJvbm1lbnQgdmFyaWFibGVzLlwiKTtcblxuICBjb25zdCBzeXN0ZW1QYXJ0cyA9IFtdO1xuICBjb25zdCBjb250ZW50cyA9IFtdO1xuICBjb25zdCBtc2dzID0gQXJyYXkuaXNBcnJheShtZXNzYWdlcykgPyBtZXNzYWdlcyA6IFtdO1xuICBmb3IgKGNvbnN0IG0gb2YgbXNncykge1xuICAgIGNvbnN0IHJvbGUgPSBtLnJvbGU7XG4gICAgY29uc3QgdGV4dCA9IFN0cmluZyhtLmNvbnRlbnQgPz8gXCJcIik7XG4gICAgaWYgKHJvbGUgPT09IFwic3lzdGVtXCIpIHN5c3RlbVBhcnRzLnB1c2godGV4dCk7XG4gICAgZWxzZSBpZiAocm9sZSA9PT0gXCJhc3Npc3RhbnRcIikgY29udGVudHMucHVzaCh7IHJvbGU6IFwibW9kZWxcIiwgcGFydHM6IFt7IHRleHQgfV0gfSk7XG4gICAgZWxzZSBjb250ZW50cy5wdXNoKHsgcm9sZTogXCJ1c2VyXCIsIHBhcnRzOiBbeyB0ZXh0IH1dIH0pO1xuICB9XG5cbiAgY29uc3QgYm9keSA9IHtcbiAgICBjb250ZW50cyxcbiAgICBnZW5lcmF0aW9uQ29uZmlnOiB7XG4gICAgICBtYXhPdXRwdXRUb2tlbnM6IHR5cGVvZiBtYXhfdG9rZW5zID09PSBcIm51bWJlclwiID8gbWF4X3Rva2VucyA6IDEwMjQsXG4gICAgICB0ZW1wZXJhdHVyZTogdHlwZW9mIHRlbXBlcmF0dXJlID09PSBcIm51bWJlclwiID8gdGVtcGVyYXR1cmUgOiAxXG4gICAgfVxuICB9O1xuICBpZiAoc3lzdGVtUGFydHMubGVuZ3RoKSBib2R5LnN5c3RlbUluc3RydWN0aW9uID0geyBwYXJ0czogW3sgdGV4dDogc3lzdGVtUGFydHMuam9pbihcIlxcblxcblwiKSB9XSB9O1xuXG4gIC8vIHN0cmVhbWluZyBlbmRwb2ludFxuICBjb25zdCB1cmwgPSBgaHR0cHM6Ly9nZW5lcmF0aXZlbGFuZ3VhZ2UuZ29vZ2xlYXBpcy5jb20vdjFiZXRhL21vZGVscy8ke2VuY29kZVVSSUNvbXBvbmVudChtb2RlbCl9OnN0cmVhbUdlbmVyYXRlQ29udGVudGA7XG4gIGNvbnN0IHVwc3RyZWFtID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICBoZWFkZXJzOiB7IFwieC1nb29nLWFwaS1rZXlcIjogYXBpS2V5LCBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpXG4gIH0pO1xuXG4gIGlmICghdXBzdHJlYW0ub2spIHtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdXBzdHJlYW0uanNvbigpLmNhdGNoKCgpPT4gKHt9KSk7XG4gICAgdGhyb3cgdXBzdHJlYW1FcnJvcihcImdlbWluaVwiLCB1cHN0cmVhbSwgZGF0YSk7XG4gIH1cblxuICAvLyBHZW1pbmkgc3RyZWFtIGlzIHR5cGljYWxseSBuZXdsaW5lLWRlbGltaXRlZCBKU09OIG9iamVjdHMgKG5vdCBTU0UpLlxuICBmdW5jdGlvbiBwYXJzZU5kanNvbihjaHVua1RleHQpIHtcbiAgICBjb25zdCBvdXQgPSBbXTtcbiAgICBjb25zdCBwYXJ0cyA9IGNodW5rVGV4dC5zcGxpdCgvXFxyP1xcbi8pLm1hcChzID0+IHMudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgZm9yIChjb25zdCBwIG9mIHBhcnRzKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBvYmogPSBKU09OLnBhcnNlKHApO1xuICAgICAgICAvLyBFeHRyYWN0IGRlbHRhLWlzaCB0ZXh0IGlmIHByZXNlbnRcbiAgICAgICAgY29uc3QgY2FuZGlkYXRlcyA9IEFycmF5LmlzQXJyYXkob2JqLmNhbmRpZGF0ZXMpID8gb2JqLmNhbmRpZGF0ZXMgOiBbXTtcbiAgICAgICAgZm9yIChjb25zdCBjYW5kIG9mIGNhbmRpZGF0ZXMpIHtcbiAgICAgICAgICBjb25zdCBjb250ZW50ID0gY2FuZD8uY29udGVudDtcbiAgICAgICAgICBpZiAoY29udGVudD8ucGFydHMpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcGFydCBvZiBjb250ZW50LnBhcnRzKSB7XG4gICAgICAgICAgICAgIGlmICh0eXBlb2YgcGFydC50ZXh0ID09PSBcInN0cmluZ1wiICYmIHBhcnQudGV4dCkgb3V0LnB1c2goeyB0eXBlOiBcImRlbHRhXCIsIHRleHQ6IHBhcnQudGV4dCB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdXNhZ2UgPSBvYmoudXNhZ2VNZXRhZGF0YTtcbiAgICAgICAgaWYgKHVzYWdlICYmICh1c2FnZS5wcm9tcHRUb2tlbkNvdW50IHx8IHVzYWdlLmNhbmRpZGF0ZXNUb2tlbkNvdW50KSkge1xuICAgICAgICAgIC8vIG5vIHJlbGlhYmxlIFwiZG9uZVwiIG1hcmtlcjsgd2Ugd2lsbCBlbWl0IGRvbmUgYXQgc3RyZWFtIGVuZCB1c2luZyBsYXN0LXNlZW4gdXNhZ2VcbiAgICAgICAgICBvdXQucHVzaCh7IHR5cGU6IFwidXNhZ2VcIiwgdXNhZ2U6IHsgaW5wdXRfdG9rZW5zOiB1c2FnZS5wcm9tcHRUb2tlbkNvdW50IHx8IDAsIG91dHB1dF90b2tlbnM6IHVzYWdlLmNhbmRpZGF0ZXNUb2tlbkNvdW50IHx8IDAgfSB9KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCB7fVxuICAgIH1cbiAgICByZXR1cm4gb3V0O1xuICB9XG5cbiAgcmV0dXJuIHsgdXBzdHJlYW0sIHBhcnNlOiBwYXJzZU5kanNvbiwgaXNOZGpzb246IHRydWUgfTtcbn1cbiIsICJpbXBvcnQgY3J5cHRvIGZyb20gXCJjcnlwdG9cIjtcblxuZnVuY3Rpb24gY29uZmlnRXJyb3IobWVzc2FnZSwgaGludCkge1xuICBjb25zdCBlcnIgPSBuZXcgRXJyb3IobWVzc2FnZSk7XG4gIGVyci5jb2RlID0gXCJDT05GSUdcIjtcbiAgZXJyLnN0YXR1cyA9IDUwMDtcbiAgaWYgKGhpbnQpIGVyci5oaW50ID0gaGludDtcbiAgcmV0dXJuIGVycjtcbn1cblxuZnVuY3Rpb24gYmFzZTY0dXJsKGlucHV0KSB7XG4gIHJldHVybiBCdWZmZXIuZnJvbShpbnB1dClcbiAgICAudG9TdHJpbmcoXCJiYXNlNjRcIilcbiAgICAucmVwbGFjZSgvPS9nLCBcIlwiKVxuICAgIC5yZXBsYWNlKC9cXCsvZywgXCItXCIpXG4gICAgLnJlcGxhY2UoL1xcLy9nLCBcIl9cIik7XG59XG5cbmZ1bmN0aW9uIHVuYmFzZTY0dXJsKGlucHV0KSB7XG4gIGNvbnN0IHMgPSBTdHJpbmcoaW5wdXQgfHwgXCJcIikucmVwbGFjZSgvLS9nLCBcIitcIikucmVwbGFjZSgvXy9nLCBcIi9cIik7XG4gIGNvbnN0IHBhZCA9IHMubGVuZ3RoICUgNCA9PT0gMCA/IFwiXCIgOiBcIj1cIi5yZXBlYXQoNCAtIChzLmxlbmd0aCAlIDQpKTtcbiAgcmV0dXJuIEJ1ZmZlci5mcm9tKHMgKyBwYWQsIFwiYmFzZTY0XCIpO1xufVxuXG5mdW5jdGlvbiBlbmNLZXkoKSB7XG4gIC8vIFByZWZlciBhIGRlZGljYXRlZCBlbmNyeXB0aW9uIGtleS4gRmFsbCBiYWNrIHRvIEpXVF9TRUNSRVQgZm9yIGRyb3AtZnJpZW5kbHkgaW5zdGFsbHMuXG4gIGNvbnN0IHJhdyA9IChwcm9jZXNzLmVudi5EQl9FTkNSWVBUSU9OX0tFWSB8fCBwcm9jZXNzLmVudi5KV1RfU0VDUkVUIHx8IFwiXCIpLnRvU3RyaW5nKCk7XG4gIGlmICghcmF3KSB7XG4gICAgdGhyb3cgY29uZmlnRXJyb3IoXG4gICAgICBcIk1pc3NpbmcgREJfRU5DUllQVElPTl9LRVkgKG9yIEpXVF9TRUNSRVQgZmFsbGJhY2spXCIsXG4gICAgICBcIlNldCBEQl9FTkNSWVBUSU9OX0tFWSAocmVjb21tZW5kZWQpIG9yIGF0IG1pbmltdW0gSldUX1NFQ1JFVCBpbiBOZXRsaWZ5IGVudiB2YXJzLlwiXG4gICAgKTtcbiAgfVxuICAvLyBEZXJpdmUgYSBzdGFibGUgMzItYnl0ZSBrZXkuXG4gIHJldHVybiBjcnlwdG8uY3JlYXRlSGFzaChcInNoYTI1NlwiKS51cGRhdGUocmF3KS5kaWdlc3QoKTtcbn1cblxuLyoqXG4gKiBFbmNyeXB0IHNtYWxsIHNlY3JldHMgZm9yIERCIHN0b3JhZ2UgKEFFUy0yNTYtR0NNKS5cbiAqIEZvcm1hdDogdjE6PGl2X2I2NHVybD46PHRhZ19iNjR1cmw+OjxjaXBoZXJfYjY0dXJsPlxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5jcnlwdFNlY3JldChwbGFpbnRleHQpIHtcbiAgY29uc3Qga2V5ID0gZW5jS2V5KCk7XG4gIGNvbnN0IGl2ID0gY3J5cHRvLnJhbmRvbUJ5dGVzKDEyKTtcbiAgY29uc3QgY2lwaGVyID0gY3J5cHRvLmNyZWF0ZUNpcGhlcml2KFwiYWVzLTI1Ni1nY21cIiwga2V5LCBpdik7XG4gIGNvbnN0IGN0ID0gQnVmZmVyLmNvbmNhdChbY2lwaGVyLnVwZGF0ZShTdHJpbmcocGxhaW50ZXh0KSwgXCJ1dGY4XCIpLCBjaXBoZXIuZmluYWwoKV0pO1xuICBjb25zdCB0YWcgPSBjaXBoZXIuZ2V0QXV0aFRhZygpO1xuICByZXR1cm4gYHYxOiR7YmFzZTY0dXJsKGl2KX06JHtiYXNlNjR1cmwodGFnKX06JHtiYXNlNjR1cmwoY3QpfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWNyeXB0U2VjcmV0KGVuYykge1xuICBjb25zdCBzID0gU3RyaW5nKGVuYyB8fCBcIlwiKTtcbiAgaWYgKCFzLnN0YXJ0c1dpdGgoXCJ2MTpcIikpIHJldHVybiBudWxsO1xuICBjb25zdCBwYXJ0cyA9IHMuc3BsaXQoXCI6XCIpO1xuICBpZiAocGFydHMubGVuZ3RoICE9PSA0KSByZXR1cm4gbnVsbDtcbiAgY29uc3QgWywgaXZCLCB0YWdCLCBjdEJdID0gcGFydHM7XG4gIGNvbnN0IGtleSA9IGVuY0tleSgpO1xuICBjb25zdCBpdiA9IHVuYmFzZTY0dXJsKGl2Qik7XG4gIGNvbnN0IHRhZyA9IHVuYmFzZTY0dXJsKHRhZ0IpO1xuICBjb25zdCBjdCA9IHVuYmFzZTY0dXJsKGN0Qik7XG4gIGNvbnN0IGRlY2lwaGVyID0gY3J5cHRvLmNyZWF0ZURlY2lwaGVyaXYoXCJhZXMtMjU2LWdjbVwiLCBrZXksIGl2KTtcbiAgZGVjaXBoZXIuc2V0QXV0aFRhZyh0YWcpO1xuICBjb25zdCBwdCA9IEJ1ZmZlci5jb25jYXQoW2RlY2lwaGVyLnVwZGF0ZShjdCksIGRlY2lwaGVyLmZpbmFsKCldKTtcbiAgcmV0dXJuIHB0LnRvU3RyaW5nKFwidXRmOFwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJhbmRvbUtleShwcmVmaXggPSBcImt4X2xpdmVfXCIpIHtcbiAgY29uc3QgYnl0ZXMgPSBjcnlwdG8ucmFuZG9tQnl0ZXMoMzIpO1xuICByZXR1cm4gcHJlZml4ICsgYmFzZTY0dXJsKGJ5dGVzKS5zbGljZSgwLCA0OCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaGEyNTZIZXgoaW5wdXQpIHtcbiAgcmV0dXJuIGNyeXB0by5jcmVhdGVIYXNoKFwic2hhMjU2XCIpLnVwZGF0ZShpbnB1dCkuZGlnZXN0KFwiaGV4XCIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaG1hY1NoYTI1NkhleChzZWNyZXQsIGlucHV0KSB7XG4gIHJldHVybiBjcnlwdG8uY3JlYXRlSG1hYyhcInNoYTI1NlwiLCBzZWNyZXQpLnVwZGF0ZShpbnB1dCkuZGlnZXN0KFwiaGV4XCIpO1xufVxuXG4vKipcbiAqIEtleSBoYXNoaW5nIHN0cmF0ZWd5OlxuICogLSBEZWZhdWx0OiBTSEEtMjU2KGtleSlcbiAqIC0gSWYgS0VZX1BFUFBFUiBpcyBzZXQ6IEhNQUMtU0hBMjU2KEtFWV9QRVBQRVIsIGtleSlcbiAqXG4gKiBJTVBPUlRBTlQ6IFBlcHBlciBpcyBvcHRpb25hbCBhbmQgY2FuIGJlIGVuYWJsZWQgbGF0ZXIuXG4gKiBBdXRoIGNvZGUgd2lsbCBhdXRvLW1pZ3JhdGUgbGVnYWN5IGhhc2hlcyBvbiBmaXJzdCBzdWNjZXNzZnVsIGxvb2t1cC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGtleUhhc2hIZXgoaW5wdXQpIHtcbiAgY29uc3QgcGVwcGVyID0gcHJvY2Vzcy5lbnYuS0VZX1BFUFBFUjtcbiAgaWYgKHBlcHBlcikgcmV0dXJuIGhtYWNTaGEyNTZIZXgocGVwcGVyLCBpbnB1dCk7XG4gIHJldHVybiBzaGEyNTZIZXgoaW5wdXQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGVnYWN5S2V5SGFzaEhleChpbnB1dCkge1xuICByZXR1cm4gc2hhMjU2SGV4KGlucHV0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNpZ25Kd3QocGF5bG9hZCwgdHRsU2Vjb25kcyA9IDM2MDApIHtcbiAgY29uc3Qgc2VjcmV0ID0gcHJvY2Vzcy5lbnYuSldUX1NFQ1JFVDtcbiAgaWYgKCFzZWNyZXQpIHtcbiAgICB0aHJvdyBjb25maWdFcnJvcihcbiAgICAgIFwiTWlzc2luZyBKV1RfU0VDUkVUXCIsXG4gICAgICBcIlNldCBKV1RfU0VDUkVUIGluIE5ldGxpZnkgXHUyMTkyIFNpdGUgY29uZmlndXJhdGlvbiBcdTIxOTIgRW52aXJvbm1lbnQgdmFyaWFibGVzICh1c2UgYSBsb25nIHJhbmRvbSBzdHJpbmcpLlwiXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IGhlYWRlciA9IHsgYWxnOiBcIkhTMjU2XCIsIHR5cDogXCJKV1RcIiB9O1xuICBjb25zdCBub3cgPSBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKTtcbiAgY29uc3QgYm9keSA9IHsgLi4ucGF5bG9hZCwgaWF0OiBub3csIGV4cDogbm93ICsgdHRsU2Vjb25kcyB9O1xuXG4gIGNvbnN0IGggPSBiYXNlNjR1cmwoSlNPTi5zdHJpbmdpZnkoaGVhZGVyKSk7XG4gIGNvbnN0IHAgPSBiYXNlNjR1cmwoSlNPTi5zdHJpbmdpZnkoYm9keSkpO1xuICBjb25zdCBkYXRhID0gYCR7aH0uJHtwfWA7XG4gIGNvbnN0IHNpZyA9IGJhc2U2NHVybChjcnlwdG8uY3JlYXRlSG1hYyhcInNoYTI1NlwiLCBzZWNyZXQpLnVwZGF0ZShkYXRhKS5kaWdlc3QoKSk7XG5cbiAgcmV0dXJuIGAke2RhdGF9LiR7c2lnfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2ZXJpZnlKd3QodG9rZW4pIHtcbiAgY29uc3Qgc2VjcmV0ID0gcHJvY2Vzcy5lbnYuSldUX1NFQ1JFVDtcbiAgaWYgKCFzZWNyZXQpIHtcbiAgICB0aHJvdyBjb25maWdFcnJvcihcbiAgICAgIFwiTWlzc2luZyBKV1RfU0VDUkVUXCIsXG4gICAgICBcIlNldCBKV1RfU0VDUkVUIGluIE5ldGxpZnkgXHUyMTkyIFNpdGUgY29uZmlndXJhdGlvbiBcdTIxOTIgRW52aXJvbm1lbnQgdmFyaWFibGVzICh1c2UgYSBsb25nIHJhbmRvbSBzdHJpbmcpLlwiXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IHBhcnRzID0gdG9rZW4uc3BsaXQoXCIuXCIpO1xuICBpZiAocGFydHMubGVuZ3RoICE9PSAzKSByZXR1cm4gbnVsbDtcblxuICBjb25zdCBbaCwgcCwgc10gPSBwYXJ0cztcbiAgY29uc3QgZGF0YSA9IGAke2h9LiR7cH1gO1xuICBjb25zdCBleHBlY3RlZCA9IGJhc2U2NHVybChjcnlwdG8uY3JlYXRlSG1hYyhcInNoYTI1NlwiLCBzZWNyZXQpLnVwZGF0ZShkYXRhKS5kaWdlc3QoKSk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBhID0gQnVmZmVyLmZyb20oZXhwZWN0ZWQpO1xuICAgIGNvbnN0IGIgPSBCdWZmZXIuZnJvbShzKTtcbiAgICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSByZXR1cm4gbnVsbDtcbiAgICBpZiAoIWNyeXB0by50aW1pbmdTYWZlRXF1YWwoYSwgYikpIHJldHVybiBudWxsO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHRyeSB7XG4gICAgY29uc3QgcGF5bG9hZCA9IEpTT04ucGFyc2UoXG4gICAgICBCdWZmZXIuZnJvbShwLnJlcGxhY2UoLy0vZywgXCIrXCIpLnJlcGxhY2UoL18vZywgXCIvXCIpLCBcImJhc2U2NFwiKS50b1N0cmluZyhcInV0Zi04XCIpXG4gICAgKTtcbiAgICBjb25zdCBub3cgPSBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKTtcbiAgICBpZiAocGF5bG9hZC5leHAgJiYgbm93ID4gcGF5bG9hZC5leHApIHJldHVybiBudWxsO1xuICAgIHJldHVybiBwYXlsb2FkO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuIiwgImltcG9ydCB7IHEgfSBmcm9tIFwiLi9kYi5qc1wiO1xuaW1wb3J0IHsga2V5SGFzaEhleCwgbGVnYWN5S2V5SGFzaEhleCwgdmVyaWZ5Snd0IH0gZnJvbSBcIi4vY3J5cHRvLmpzXCI7XG5pbXBvcnQgeyBtb250aEtleVVUQyB9IGZyb20gXCIuL2h0dHAuanNcIjtcblxuZnVuY3Rpb24gYmFzZVNlbGVjdCgpIHtcbiAgcmV0dXJuIGBzZWxlY3Qgay5pZCBhcyBhcGlfa2V5X2lkLCBrLmN1c3RvbWVyX2lkLCBrLmtleV9sYXN0NCwgay5sYWJlbCwgay5yb2xlLFxuICAgICAgICAgICAgICAgICBrLm1vbnRobHlfY2FwX2NlbnRzIGFzIGtleV9jYXBfY2VudHMsIGsucnBtX2xpbWl0LCBrLnJwZF9saW1pdCxcbiAgICAgICAgICAgICAgICAgay5tYXhfZGV2aWNlcywgay5yZXF1aXJlX2luc3RhbGxfaWQsIGsuYWxsb3dlZF9wcm92aWRlcnMsIGsuYWxsb3dlZF9tb2RlbHMsXG4gICAgICAgICAgICAgICAgIGMubW9udGhseV9jYXBfY2VudHMgYXMgY3VzdG9tZXJfY2FwX2NlbnRzLCBjLmlzX2FjdGl2ZSxcbiAgICAgICAgICAgICAgICAgYy5tYXhfZGV2aWNlc19wZXJfa2V5IGFzIGN1c3RvbWVyX21heF9kZXZpY2VzX3Blcl9rZXksIGMucmVxdWlyZV9pbnN0YWxsX2lkIGFzIGN1c3RvbWVyX3JlcXVpcmVfaW5zdGFsbF9pZCxcbiAgICAgICAgICAgICAgICAgYy5hbGxvd2VkX3Byb3ZpZGVycyBhcyBjdXN0b21lcl9hbGxvd2VkX3Byb3ZpZGVycywgYy5hbGxvd2VkX21vZGVscyBhcyBjdXN0b21lcl9hbGxvd2VkX21vZGVscyxcbiAgICAgICAgICAgICAgICAgYy5wbGFuX25hbWUgYXMgY3VzdG9tZXJfcGxhbl9uYW1lLCBjLmVtYWlsIGFzIGN1c3RvbWVyX2VtYWlsXG4gICAgICAgICAgZnJvbSBhcGlfa2V5cyBrXG4gICAgICAgICAgam9pbiBjdXN0b21lcnMgYyBvbiBjLmlkID0gay5jdXN0b21lcl9pZGA7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb29rdXBLZXkocGxhaW5LZXkpIHtcbiAgLy8gUHJlZmVycmVkIGhhc2ggKHBlcHBlcmVkIGlmIGVuYWJsZWQpXG4gIGNvbnN0IHByZWZlcnJlZCA9IGtleUhhc2hIZXgocGxhaW5LZXkpO1xuICBsZXQga2V5UmVzID0gYXdhaXQgcShcbiAgICBgJHtiYXNlU2VsZWN0KCl9XG4gICAgIHdoZXJlIGsua2V5X2hhc2g9JDEgYW5kIGsucmV2b2tlZF9hdCBpcyBudWxsXG4gICAgIGxpbWl0IDFgLFxuICAgIFtwcmVmZXJyZWRdXG4gICk7XG4gIGlmIChrZXlSZXMucm93Q291bnQpIHJldHVybiBrZXlSZXMucm93c1swXTtcblxuICAvLyBJZiBLRVlfUEVQUEVSIGlzIGVuYWJsZWQsIGFsbG93IGxlZ2FjeSBTSEEtMjU2IGhhc2hlcyBhbmQgYXV0by1taWdyYXRlIG9uIGZpcnN0IGhpdC5cbiAgaWYgKHByb2Nlc3MuZW52LktFWV9QRVBQRVIpIHtcbiAgICBjb25zdCBsZWdhY3kgPSBsZWdhY3lLZXlIYXNoSGV4KHBsYWluS2V5KTtcbiAgICBrZXlSZXMgPSBhd2FpdCBxKFxuICAgICAgYCR7YmFzZVNlbGVjdCgpfVxuICAgICAgIHdoZXJlIGsua2V5X2hhc2g9JDEgYW5kIGsucmV2b2tlZF9hdCBpcyBudWxsXG4gICAgICAgbGltaXQgMWAsXG4gICAgICBbbGVnYWN5XVxuICAgICk7XG4gICAgaWYgKCFrZXlSZXMucm93Q291bnQpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3Qgcm93ID0ga2V5UmVzLnJvd3NbMF07XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHEoXG4gICAgICAgIGB1cGRhdGUgYXBpX2tleXMgc2V0IGtleV9oYXNoPSQxXG4gICAgICAgICB3aGVyZSBpZD0kMiBhbmQga2V5X2hhc2g9JDNgLFxuICAgICAgICBbcHJlZmVycmVkLCByb3cuYXBpX2tleV9pZCwgbGVnYWN5XVxuICAgICAgKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIGlnbm9yZSBtaWdyYXRpb24gZXJyb3JzXG4gICAgfVxuXG4gICAgcmV0dXJuIHJvdztcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9va3VwS2V5QnlJZChhcGlfa2V5X2lkKSB7XG4gIGNvbnN0IGtleVJlcyA9IGF3YWl0IHEoXG4gICAgYCR7YmFzZVNlbGVjdCgpfVxuICAgICB3aGVyZSBrLmlkPSQxIGFuZCBrLnJldm9rZWRfYXQgaXMgbnVsbFxuICAgICBsaW1pdCAxYCxcbiAgICBbYXBpX2tleV9pZF1cbiAgKTtcbiAgaWYgKCFrZXlSZXMucm93Q291bnQpIHJldHVybiBudWxsO1xuICByZXR1cm4ga2V5UmVzLnJvd3NbMF07XG59XG5cbi8qKlxuICogUmVzb2x2ZSBhbiBBdXRob3JpemF0aW9uIEJlYXJlciB0b2tlbi5cbiAqIFN1cHBvcnRlZDpcbiAqIC0gS2FpeHUgc3ViLWtleSAocGxhaW4gdmlydHVhbCBrZXkpXG4gKiAtIFNob3J0LWxpdmVkIHVzZXIgc2Vzc2lvbiBKV1QgKHR5cGU6ICd1c2VyX3Nlc3Npb24nKVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZUF1dGgodG9rZW4pIHtcbiAgaWYgKCF0b2tlbikgcmV0dXJuIG51bGw7XG5cbiAgLy8gSldUcyBoYXZlIDMgZG90LXNlcGFyYXRlZCBwYXJ0cy4gS2FpeHUga2V5cyBkbyBub3QuXG4gIGNvbnN0IHBhcnRzID0gdG9rZW4uc3BsaXQoXCIuXCIpO1xuICBpZiAocGFydHMubGVuZ3RoID09PSAzKSB7XG4gICAgY29uc3QgcGF5bG9hZCA9IHZlcmlmeUp3dCh0b2tlbik7XG4gICAgaWYgKCFwYXlsb2FkKSByZXR1cm4gbnVsbDtcbiAgICBpZiAocGF5bG9hZC50eXBlICE9PSBcInVzZXJfc2Vzc2lvblwiKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IHJvdyA9IGF3YWl0IGxvb2t1cEtleUJ5SWQocGF5bG9hZC5hcGlfa2V5X2lkKTtcbiAgICByZXR1cm4gcm93O1xuICB9XG5cbiAgcmV0dXJuIGF3YWl0IGxvb2t1cEtleSh0b2tlbik7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRNb250aFJvbGx1cChjdXN0b21lcl9pZCwgbW9udGggPSBtb250aEtleVVUQygpKSB7XG4gIGNvbnN0IHJvbGwgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3Qgc3BlbnRfY2VudHMsIGV4dHJhX2NlbnRzLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnNcbiAgICAgZnJvbSBtb250aGx5X3VzYWdlIHdoZXJlIGN1c3RvbWVyX2lkPSQxIGFuZCBtb250aD0kMmAsXG4gICAgW2N1c3RvbWVyX2lkLCBtb250aF1cbiAgKTtcbiAgaWYgKHJvbGwucm93Q291bnQgPT09IDApIHJldHVybiB7IHNwZW50X2NlbnRzOiAwLCBleHRyYV9jZW50czogMCwgaW5wdXRfdG9rZW5zOiAwLCBvdXRwdXRfdG9rZW5zOiAwIH07XG4gIHJldHVybiByb2xsLnJvd3NbMF07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRLZXlNb250aFJvbGx1cChhcGlfa2V5X2lkLCBtb250aCA9IG1vbnRoS2V5VVRDKCkpIHtcbiAgY29uc3Qgcm9sbCA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBzcGVudF9jZW50cywgaW5wdXRfdG9rZW5zLCBvdXRwdXRfdG9rZW5zLCBjYWxsc1xuICAgICBmcm9tIG1vbnRobHlfa2V5X3VzYWdlIHdoZXJlIGFwaV9rZXlfaWQ9JDEgYW5kIG1vbnRoPSQyYCxcbiAgICBbYXBpX2tleV9pZCwgbW9udGhdXG4gICk7XG4gIGlmIChyb2xsLnJvd0NvdW50KSByZXR1cm4gcm9sbC5yb3dzWzBdO1xuXG4gIC8vIEJhY2tmaWxsIGZvciBtaWdyYXRlZCBpbnN0YWxscyAod2hlbiBtb250aGx5X2tleV91c2FnZSBkaWQgbm90IGV4aXN0IHlldCkuXG4gIGNvbnN0IGtleU1ldGEgPSBhd2FpdCBxKGBzZWxlY3QgY3VzdG9tZXJfaWQgZnJvbSBhcGlfa2V5cyB3aGVyZSBpZD0kMWAsIFthcGlfa2V5X2lkXSk7XG4gIGNvbnN0IGN1c3RvbWVyX2lkID0ga2V5TWV0YS5yb3dDb3VudCA/IGtleU1ldGEucm93c1swXS5jdXN0b21lcl9pZCA6IG51bGw7XG5cbiAgY29uc3QgYWdnID0gYXdhaXQgcShcbiAgICBgc2VsZWN0IGNvYWxlc2NlKHN1bShjb3N0X2NlbnRzKSwwKTo6aW50IGFzIHNwZW50X2NlbnRzLFxuICAgICAgICAgICAgY29hbGVzY2Uoc3VtKGlucHV0X3Rva2VucyksMCk6OmludCBhcyBpbnB1dF90b2tlbnMsXG4gICAgICAgICAgICBjb2FsZXNjZShzdW0ob3V0cHV0X3Rva2VucyksMCk6OmludCBhcyBvdXRwdXRfdG9rZW5zLFxuICAgICAgICAgICAgY291bnQoKik6OmludCBhcyBjYWxsc1xuICAgICBmcm9tIHVzYWdlX2V2ZW50c1xuICAgICB3aGVyZSBhcGlfa2V5X2lkPSQxIGFuZCB0b19jaGFyKGNyZWF0ZWRfYXQgYXQgdGltZSB6b25lICdVVEMnLCdZWVlZLU1NJyk9JDJgLFxuICAgIFthcGlfa2V5X2lkLCBtb250aF1cbiAgKTtcblxuICBjb25zdCByb3cgPSBhZ2cucm93c1swXSB8fCB7IHNwZW50X2NlbnRzOiAwLCBpbnB1dF90b2tlbnM6IDAsIG91dHB1dF90b2tlbnM6IDAsIGNhbGxzOiAwIH07XG5cbiAgaWYgKGN1c3RvbWVyX2lkICE9IG51bGwpIHtcbiAgICBhd2FpdCBxKFxuICAgICAgYGluc2VydCBpbnRvIG1vbnRobHlfa2V5X3VzYWdlKGFwaV9rZXlfaWQsIGN1c3RvbWVyX2lkLCBtb250aCwgc3BlbnRfY2VudHMsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2VucywgY2FsbHMpXG4gICAgICAgdmFsdWVzICgkMSwkMiwkMywkNCwkNSwkNiwkNylcbiAgICAgICBvbiBjb25mbGljdCAoYXBpX2tleV9pZCwgbW9udGgpXG4gICAgICAgZG8gdXBkYXRlIHNldFxuICAgICAgICAgc3BlbnRfY2VudHMgPSBleGNsdWRlZC5zcGVudF9jZW50cyxcbiAgICAgICAgIGlucHV0X3Rva2VucyA9IGV4Y2x1ZGVkLmlucHV0X3Rva2VucyxcbiAgICAgICAgIG91dHB1dF90b2tlbnMgPSBleGNsdWRlZC5vdXRwdXRfdG9rZW5zLFxuICAgICAgICAgY2FsbHMgPSBleGNsdWRlZC5jYWxscyxcbiAgICAgICAgIHVwZGF0ZWRfYXQgPSBub3coKWAsXG4gICAgICBbYXBpX2tleV9pZCwgY3VzdG9tZXJfaWQsIG1vbnRoLCByb3cuc3BlbnRfY2VudHMgfHwgMCwgcm93LmlucHV0X3Rva2VucyB8fCAwLCByb3cub3V0cHV0X3Rva2VucyB8fCAwLCByb3cuY2FsbHMgfHwgMF1cbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIHJvdztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVmZmVjdGl2ZUNhcENlbnRzKGtleVJvdywgcm9sbHVwKSB7XG4gIGNvbnN0IGJhc2UgPSBrZXlSb3cua2V5X2NhcF9jZW50cyA/PyBrZXlSb3cuY3VzdG9tZXJfY2FwX2NlbnRzO1xuICBjb25zdCBleHRyYSA9IHJvbGx1cC5leHRyYV9jZW50cyB8fCAwO1xuICByZXR1cm4gKGJhc2UgfHwgMCkgKyBleHRyYTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1c3RvbWVyQ2FwQ2VudHMoa2V5Um93LCBjdXN0b21lclJvbGx1cCkge1xuICBjb25zdCBiYXNlID0ga2V5Um93LmN1c3RvbWVyX2NhcF9jZW50cyB8fCAwO1xuICBjb25zdCBleHRyYSA9IGN1c3RvbWVyUm9sbHVwLmV4dHJhX2NlbnRzIHx8IDA7XG4gIHJldHVybiBiYXNlICsgZXh0cmE7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBrZXlDYXBDZW50cyhrZXlSb3csIGN1c3RvbWVyUm9sbHVwKSB7XG4gIC8vIElmIGEga2V5IG92ZXJyaWRlIGV4aXN0cywgaXQncyBhIGhhcmQgY2FwIGZvciB0aGF0IGtleS4gT3RoZXJ3aXNlIGl0IGluaGVyaXRzIHRoZSBjdXN0b21lciBjYXAuXG4gIGlmIChrZXlSb3cua2V5X2NhcF9jZW50cyAhPSBudWxsKSByZXR1cm4ga2V5Um93LmtleV9jYXBfY2VudHM7XG4gIHJldHVybiBjdXN0b21lckNhcENlbnRzKGtleVJvdywgY3VzdG9tZXJSb2xsdXApO1xufVxuXG5cbmNvbnN0IFJPTEVfT1JERVIgPSBbXCJ2aWV3ZXJcIixcImRlcGxveWVyXCIsXCJhZG1pblwiLFwib3duZXJcIl07XG5cbmV4cG9ydCBmdW5jdGlvbiByb2xlQXRMZWFzdChhY3R1YWwsIHJlcXVpcmVkKSB7XG4gIGNvbnN0IGEgPSBST0xFX09SREVSLmluZGV4T2YoKGFjdHVhbCB8fCBcImRlcGxveWVyXCIpLnRvTG93ZXJDYXNlKCkpO1xuICBjb25zdCByID0gUk9MRV9PUkRFUi5pbmRleE9mKChyZXF1aXJlZCB8fCBcImRlcGxveWVyXCIpLnRvTG93ZXJDYXNlKCkpO1xuICByZXR1cm4gYSA+PSByICYmIGEgIT09IC0xICYmIHIgIT09IC0xO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVxdWlyZUtleVJvbGUoa2V5Um93LCByZXF1aXJlZFJvbGUpIHtcbiAgY29uc3QgYWN0dWFsID0gKGtleVJvdz8ucm9sZSB8fCBcImRlcGxveWVyXCIpLnRvTG93ZXJDYXNlKCk7XG4gIGlmICghcm9sZUF0TGVhc3QoYWN0dWFsLCByZXF1aXJlZFJvbGUpKSB7XG4gICAgY29uc3QgZXJyID0gbmV3IEVycm9yKFwiRm9yYmlkZGVuXCIpO1xuICAgIGVyci5zdGF0dXMgPSA0MDM7XG4gICAgZXJyLmNvZGUgPSBcIkZPUkJJRERFTlwiO1xuICAgIGVyci5oaW50ID0gYFJlcXVpcmVzIHJvbGUgJyR7cmVxdWlyZWRSb2xlfScsIGJ1dCBrZXkgcm9sZSBpcyAnJHthY3R1YWx9Jy5gO1xuICAgIHRocm93IGVycjtcbiAgfVxufVxuIiwgImltcG9ydCB7IHEgfSBmcm9tIFwiLi9kYi5qc1wiO1xuXG5sZXQgX1Vwc3Rhc2ggPSBudWxsO1xuY29uc3QgX2xpbWl0ZXJCeUxpbWl0ID0gbmV3IE1hcCgpO1xuXG5hc3luYyBmdW5jdGlvbiBsb2FkVXBzdGFzaCgpIHtcbiAgY29uc3QgdXJsID0gcHJvY2Vzcy5lbnYuVVBTVEFTSF9SRURJU19SRVNUX1VSTDtcbiAgY29uc3QgdG9rZW4gPSBwcm9jZXNzLmVudi5VUFNUQVNIX1JFRElTX1JFU1RfVE9LRU47XG4gIGlmICghdXJsIHx8ICF0b2tlbikgcmV0dXJuIG51bGw7XG5cbiAgaWYgKF9VcHN0YXNoKSByZXR1cm4gX1Vwc3Rhc2g7XG5cbiAgY29uc3QgW3sgUmF0ZWxpbWl0IH0sIHsgUmVkaXMgfV0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgaW1wb3J0KFwiQHVwc3Rhc2gvcmF0ZWxpbWl0XCIpLFxuICAgIGltcG9ydChcIkB1cHN0YXNoL3JlZGlzXCIpXG4gIF0pO1xuXG4gIF9VcHN0YXNoID0geyBSYXRlbGltaXQsIFJlZGlzIH07XG4gIHJldHVybiBfVXBzdGFzaDtcbn1cblxuZnVuY3Rpb24gaXNvUmVzZXQocmVzZXQpIHtcbiAgaWYgKCFyZXNldCkgcmV0dXJuIG51bGw7XG4gIGlmICh0eXBlb2YgcmVzZXQgPT09IFwibnVtYmVyXCIpIHJldHVybiBuZXcgRGF0ZShyZXNldCkudG9JU09TdHJpbmcoKTtcbiAgaWYgKHJlc2V0IGluc3RhbmNlb2YgRGF0ZSkgcmV0dXJuIHJlc2V0LnRvSVNPU3RyaW5nKCk7XG4gIGlmICh0eXBlb2YgcmVzZXQgPT09IFwic3RyaW5nXCIpIHJldHVybiByZXNldDtcbiAgdHJ5IHtcbiAgICBpZiAodHlwZW9mIHJlc2V0Py5nZXRUaW1lID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiBuZXcgRGF0ZShyZXNldC5nZXRUaW1lKCkpLnRvSVNPU3RyaW5nKCk7XG4gIH0gY2F0Y2gge31cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogUlBNIHJhdGUgbGltaXRpbmcuXG4gKlxuICogUHJpb3JpdHk6XG4gKiAxKSBVcHN0YXNoIHNsaWRpbmcgd2luZG93IChpZiBVUFNUQVNIX1JFRElTX1JFU1RfVVJML1RPS0VOIHByZXNlbnQpXG4gKiAyKSBEQi1iYWNrZWQgZml4ZWQgd2luZG93IChzaW1wbGUgZmFsbGJhY2spXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbmZvcmNlUnBtKHsgY3VzdG9tZXJJZCwgYXBpS2V5SWQsIHJwbU92ZXJyaWRlIH0pIHtcbiAgY29uc3QgZGVmYXVsdFJwbSA9IHBhcnNlSW50KHByb2Nlc3MuZW52LkRFRkFVTFRfUlBNX0xJTUlUIHx8IFwiMTIwXCIsIDEwKTtcbiAgY29uc3QgbGltaXQgPSBOdW1iZXIuaXNGaW5pdGUocnBtT3ZlcnJpZGUpID8gcnBtT3ZlcnJpZGUgOiBkZWZhdWx0UnBtO1xuXG4gIGlmICghTnVtYmVyLmlzRmluaXRlKGxpbWl0KSB8fCBsaW1pdCA8PSAwKSB7XG4gICAgcmV0dXJuIHsgb2s6IHRydWUsIHJlbWFpbmluZzogbnVsbCwgcmVzZXQ6IG51bGwsIG1vZGU6IFwib2ZmXCIgfTtcbiAgfVxuXG4gIGNvbnN0IHVwID0gYXdhaXQgbG9hZFVwc3Rhc2goKTtcbiAgaWYgKHVwKSB7XG4gICAgaWYgKCFfbGltaXRlckJ5TGltaXQuaGFzKGxpbWl0KSkge1xuICAgICAgY29uc3QgcmVkaXMgPSB1cC5SZWRpcy5mcm9tRW52KCk7XG4gICAgICBjb25zdCBybCA9IG5ldyB1cC5SYXRlbGltaXQoe1xuICAgICAgICByZWRpcyxcbiAgICAgICAgbGltaXRlcjogdXAuUmF0ZWxpbWl0LnNsaWRpbmdXaW5kb3cobGltaXQsIFwiNjAgc1wiKSxcbiAgICAgICAgcHJlZml4OiBcImthaXh1OnJsXCJcbiAgICAgIH0pO1xuICAgICAgX2xpbWl0ZXJCeUxpbWl0LnNldChsaW1pdCwgcmwpO1xuICAgIH1cblxuICAgIGNvbnN0IGxpbWl0ZXIgPSBfbGltaXRlckJ5TGltaXQuZ2V0KGxpbWl0KTtcbiAgICBjb25zdCBrZXkgPSBgYyR7Y3VzdG9tZXJJZH06ayR7YXBpS2V5SWR9YDtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBsaW1pdGVyLmxpbWl0KGtleSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgb2s6ICEhcmVzLnN1Y2Nlc3MsXG4gICAgICByZW1haW5pbmc6IHJlcy5yZW1haW5pbmcgPz8gbnVsbCxcbiAgICAgIHJlc2V0OiBpc29SZXNldChyZXMucmVzZXQpLFxuICAgICAgbW9kZTogXCJ1cHN0YXNoXCJcbiAgICB9O1xuICB9XG5cbiAgLy8gLS0tIERCIGZhbGxiYWNrIC0tLVxuICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICBjb25zdCB3aW5kb3dNcyA9IDYwXzAwMDtcbiAgY29uc3Qgd2luZG93U3RhcnQgPSBuZXcgRGF0ZShNYXRoLmZsb29yKG5vdyAvIHdpbmRvd01zKSAqIHdpbmRvd01zKTtcbiAgY29uc3QgcmVzZXQgPSBuZXcgRGF0ZSh3aW5kb3dTdGFydC5nZXRUaW1lKCkgKyB3aW5kb3dNcyk7XG5cbiAgY29uc3QgcmVzID0gYXdhaXQgcShcbiAgICBgaW5zZXJ0IGludG8gcmF0ZV9saW1pdF93aW5kb3dzKGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCB3aW5kb3dfc3RhcnQsIGNvdW50KVxuICAgICB2YWx1ZXMgKCQxLCQyLCQzLDEpXG4gICAgIG9uIGNvbmZsaWN0IChjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgd2luZG93X3N0YXJ0KVxuICAgICBkbyB1cGRhdGUgc2V0IGNvdW50ID0gcmF0ZV9saW1pdF93aW5kb3dzLmNvdW50ICsgMVxuICAgICByZXR1cm5pbmcgY291bnRgLFxuICAgIFtjdXN0b21lcklkLCBhcGlLZXlJZCwgd2luZG93U3RhcnRdXG4gICk7XG5cbiAgY29uc3QgY291bnQgPSByZXMucm93cz8uWzBdPy5jb3VudCA/PyAxO1xuICBjb25zdCByZW1haW5pbmcgPSBNYXRoLm1heCgwLCBsaW1pdCAtIGNvdW50KTtcblxuICBpZiAoTWF0aC5yYW5kb20oKSA8IDAuMDEpIHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgcShgZGVsZXRlIGZyb20gcmF0ZV9saW1pdF93aW5kb3dzIHdoZXJlIHdpbmRvd19zdGFydCA8IG5vdygpIC0gaW50ZXJ2YWwgJzIgaG91cnMnYCk7XG4gICAgfSBjYXRjaCB7fVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBvazogY291bnQgPD0gbGltaXQsXG4gICAgcmVtYWluaW5nLFxuICAgIHJlc2V0OiByZXNldC50b0lTT1N0cmluZygpLFxuICAgIG1vZGU6IFwiZGJcIlxuICB9O1xufVxuIiwgImltcG9ydCB7IHEgfSBmcm9tIFwiLi9kYi5qc1wiO1xuXG5mdW5jdGlvbiBwY3Qoc3BlbnQsIGNhcCkge1xuICBpZiAoIWNhcCB8fCBjYXAgPD0gMCkgcmV0dXJuIDA7XG4gIHJldHVybiAoc3BlbnQgLyBjYXApICogMTAwO1xufVxuXG5hc3luYyBmdW5jdGlvbiByZWNvcmRPbmNlKHsgY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQgPSAwLCBtb250aCwgYWxlcnRfdHlwZSB9KSB7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IHEoXG4gICAgYGluc2VydCBpbnRvIGFsZXJ0c19zZW50KGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCBtb250aCwgYWxlcnRfdHlwZSlcbiAgICAgdmFsdWVzICgkMSwkMiwkMywkNClcbiAgICAgb24gY29uZmxpY3QgKGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCBtb250aCwgYWxlcnRfdHlwZSkgZG8gbm90aGluZ1xuICAgICByZXR1cm5pbmcgY3VzdG9tZXJfaWRgLFxuICAgIFtjdXN0b21lcl9pZCwgYXBpX2tleV9pZCB8fCAwLCBtb250aCwgYWxlcnRfdHlwZV1cbiAgKTtcbiAgcmV0dXJuIHJlcy5yb3dDb3VudCA+IDA7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHBvc3RXZWJob29rKHBheWxvYWQpIHtcbiAgY29uc3QgdXJsID0gcHJvY2Vzcy5lbnYuQUxFUlRfV0VCSE9PS19VUkw7XG4gIGlmICghdXJsKSByZXR1cm47XG5cbiAgLy8gQmVzdC1lZmZvcnQ6IHdlYmhvb2sgZmFpbHVyZXMgbXVzdCBOT1QgYnJlYWsgZ2F0ZXdheSB1c2FnZS5cbiAgdHJ5IHtcbiAgICBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICBoZWFkZXJzOiB7IFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKVxuICAgIH0pO1xuICB9IGNhdGNoIHtcbiAgICAvLyBpZ25vcmVcbiAgfVxufVxuXG4vKipcbiAqIFNlbmRzIGEgd2FybmluZyAoYW5kL29yIHJlYWNoZWQpIGFsZXJ0IG9uY2UgcGVyIGtleS9jdXN0b21lciBwZXIgbW9udGguXG4gKiBVc2VzIGFsZXJ0c19zZW50IHRhYmxlIGZvciBkZS1kdXBlLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWF5YmVDYXBBbGVydHMoe1xuICBjdXN0b21lcl9pZCxcbiAgYXBpX2tleV9pZCxcbiAgbW9udGgsXG4gIGN1c3RvbWVyX2NhcF9jZW50cyxcbiAgY3VzdG9tZXJfc3BlbnRfY2VudHMsXG4gIGtleV9jYXBfY2VudHMsXG4gIGtleV9zcGVudF9jZW50c1xufSkge1xuICBjb25zdCB3YXJuUGN0ID0gcGFyc2VGbG9hdChwcm9jZXNzLmVudi5DQVBfV0FSTl9QQ1QgfHwgXCI4MFwiKTtcblxuICBjb25zdCBjdXN0UCA9IHBjdChjdXN0b21lcl9zcGVudF9jZW50cyB8fCAwLCBjdXN0b21lcl9jYXBfY2VudHMgfHwgMCk7XG4gIGNvbnN0IGtleVAgPSBwY3Qoa2V5X3NwZW50X2NlbnRzIHx8IDAsIGtleV9jYXBfY2VudHMgfHwgMCk7XG5cbiAgLy8gQ3VzdG9tZXItbGV2ZWwgd2FybmluZ3NcbiAgaWYgKGN1c3RQID49IHdhcm5QY3QgJiYgY3VzdFAgPCAxMDApIHtcbiAgICBjb25zdCBvayA9IGF3YWl0IHJlY29yZE9uY2UoeyBjdXN0b21lcl9pZCwgYXBpX2tleV9pZDogMCwgbW9udGgsIGFsZXJ0X3R5cGU6IFwiQ0FQX1dBUk5fQ1VTVE9NRVJcIiB9KTtcbiAgICBpZiAob2spIHtcbiAgICAgIGF3YWl0IHBvc3RXZWJob29rKHtcbiAgICAgICAgdHlwZTogXCJDQVBfV0FSTl9DVVNUT01FUlwiLFxuICAgICAgICBtb250aCxcbiAgICAgICAgY3VzdG9tZXJfaWQsXG4gICAgICAgIGN1c3RvbWVyX2NhcF9jZW50cyxcbiAgICAgICAgY3VzdG9tZXJfc3BlbnRfY2VudHMsXG4gICAgICAgIHBjdDogY3VzdFBcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIEtleS1sZXZlbCB3YXJuaW5nc1xuICBpZiAoa2V5UCA+PSB3YXJuUGN0ICYmIGtleVAgPCAxMDApIHtcbiAgICBjb25zdCBvayA9IGF3YWl0IHJlY29yZE9uY2UoeyBjdXN0b21lcl9pZCwgYXBpX2tleV9pZDogYXBpX2tleV9pZCB8fCAwLCBtb250aCwgYWxlcnRfdHlwZTogXCJDQVBfV0FSTl9LRVlcIiB9KTtcbiAgICBpZiAob2spIHtcbiAgICAgIGF3YWl0IHBvc3RXZWJob29rKHtcbiAgICAgICAgdHlwZTogXCJDQVBfV0FSTl9LRVlcIixcbiAgICAgICAgbW9udGgsXG4gICAgICAgIGN1c3RvbWVyX2lkLFxuICAgICAgICBhcGlfa2V5X2lkLFxuICAgICAgICBrZXlfY2FwX2NlbnRzLFxuICAgICAgICBrZXlfc3BlbnRfY2VudHMsXG4gICAgICAgIHBjdDoga2V5UFxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG4iLCAiaW1wb3J0IHsgcSB9IGZyb20gJy4vZGIuanMnO1xuXG4vKipcbiAqIEVuZm9yY2UgaW5zdGFsbC9kZXZpY2UgYmluZGluZyBhbmQgc2VhdCBsaW1pdHMuXG4gKlxuICogSW5wdXRzOlxuICogLSBrZXlSb3cgY29udGFpbnM6IGFwaV9rZXlfaWQsIGN1c3RvbWVyX2lkXG4gKiAtIGluc3RhbGxfaWQ6IHN0cmluZ3xudWxsXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbmZvcmNlRGV2aWNlKHsga2V5Um93LCBpbnN0YWxsX2lkLCB1YSwgYWN0b3IgPSAnZ2F0ZXdheScgfSkge1xuICBjb25zdCByZXF1aXJlSW5zdGFsbCA9ICEhKGtleVJvdy5yZXF1aXJlX2luc3RhbGxfaWQgfHwga2V5Um93LmN1c3RvbWVyX3JlcXVpcmVfaW5zdGFsbF9pZCk7XG4gIGNvbnN0IG1heERldmljZXMgPSAoTnVtYmVyLmlzRmluaXRlKGtleVJvdy5tYXhfZGV2aWNlcykgPyBrZXlSb3cubWF4X2RldmljZXMgOiBudWxsKSA/PyAoTnVtYmVyLmlzRmluaXRlKGtleVJvdy5jdXN0b21lcl9tYXhfZGV2aWNlc19wZXJfa2V5KSA/IGtleVJvdy5jdXN0b21lcl9tYXhfZGV2aWNlc19wZXJfa2V5IDogbnVsbCk7XG5cbiAgaWYgKChyZXF1aXJlSW5zdGFsbCB8fCAobWF4RGV2aWNlcyAhPSBudWxsICYmIG1heERldmljZXMgPiAwKSkgJiYgIWluc3RhbGxfaWQpIHtcbiAgICByZXR1cm4geyBvazogZmFsc2UsIHN0YXR1czogNDAwLCBlcnJvcjogJ01pc3NpbmcgeC1rYWl4dS1pbnN0YWxsLWlkIChyZXF1aXJlZCBmb3IgdGhpcyBrZXkpJyB9O1xuICB9XG5cbiAgLy8gTm8gaW5zdGFsbCBpZCBhbmQgbm8gZW5mb3JjZW1lbnRcbiAgaWYgKCFpbnN0YWxsX2lkKSByZXR1cm4geyBvazogdHJ1ZSB9O1xuXG4gIC8vIExvYWQgZXhpc3RpbmcgcmVjb3JkXG4gIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcShcbiAgICBgc2VsZWN0IGFwaV9rZXlfaWQsIGluc3RhbGxfaWQsIGZpcnN0X3NlZW5fYXQsIGxhc3Rfc2Vlbl9hdCwgcmV2b2tlZF9hdFxuICAgICBmcm9tIGtleV9kZXZpY2VzXG4gICAgIHdoZXJlIGFwaV9rZXlfaWQ9JDEgYW5kIGluc3RhbGxfaWQ9JDJcbiAgICAgbGltaXQgMWAsXG4gICAgW2tleVJvdy5hcGlfa2V5X2lkLCBpbnN0YWxsX2lkXVxuICApO1xuXG4gIGlmIChleGlzdGluZy5yb3dDb3VudCkge1xuICAgIGNvbnN0IHJvdyA9IGV4aXN0aW5nLnJvd3NbMF07XG4gICAgaWYgKHJvdy5yZXZva2VkX2F0KSB7XG4gICAgICByZXR1cm4geyBvazogZmFsc2UsIHN0YXR1czogNDAzLCBlcnJvcjogJ0RldmljZSByZXZva2VkIGZvciB0aGlzIGtleScgfTtcbiAgICB9XG4gICAgLy8gVXBkYXRlIGxhc3Qgc2VlbiAoYmVzdC1lZmZvcnQpXG4gICAgYXdhaXQgcShcbiAgICAgIGB1cGRhdGUga2V5X2RldmljZXMgc2V0IGxhc3Rfc2Vlbl9hdD1ub3coKSwgbGFzdF9zZWVuX3VhPWNvYWxlc2NlKCQzLGxhc3Rfc2Vlbl91YSlcbiAgICAgICB3aGVyZSBhcGlfa2V5X2lkPSQxIGFuZCBpbnN0YWxsX2lkPSQyYCxcbiAgICAgIFtrZXlSb3cuYXBpX2tleV9pZCwgaW5zdGFsbF9pZCwgdWEgfHwgbnVsbF1cbiAgICApO1xuICAgIHJldHVybiB7IG9rOiB0cnVlIH07XG4gIH1cblxuICAvLyBOZXcgZGV2aWNlOiBzZWF0IGNoZWNrXG4gIGlmIChtYXhEZXZpY2VzICE9IG51bGwgJiYgbWF4RGV2aWNlcyA+IDApIHtcbiAgICBjb25zdCBhY3RpdmVDb3VudCA9IGF3YWl0IHEoXG4gICAgICBgc2VsZWN0IGNvdW50KCopOjppbnQgYXMgblxuICAgICAgIGZyb20ga2V5X2RldmljZXNcbiAgICAgICB3aGVyZSBhcGlfa2V5X2lkPSQxIGFuZCByZXZva2VkX2F0IGlzIG51bGxgLFxuICAgICAgW2tleVJvdy5hcGlfa2V5X2lkXVxuICAgICk7XG4gICAgY29uc3QgbiA9IGFjdGl2ZUNvdW50LnJvd3M/LlswXT8ubiA/PyAwO1xuICAgIGlmIChuID49IG1heERldmljZXMpIHtcbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgc3RhdHVzOiA0MDMsIGVycm9yOiBgRGV2aWNlIGxpbWl0IHJlYWNoZWQgKCR7bn0vJHttYXhEZXZpY2VzfSkuIFJldm9rZSBhbiBvbGQgZGV2aWNlIG9yIHJhaXNlIHNlYXRzLmAgfTtcbiAgICB9XG4gIH1cblxuICAvLyBJbnNlcnQgbmV3IGRldmljZVxuICBhd2FpdCBxKFxuICAgIGBpbnNlcnQgaW50byBrZXlfZGV2aWNlcyhhcGlfa2V5X2lkLCBjdXN0b21lcl9pZCwgaW5zdGFsbF9pZCwgbGFzdF9zZWVuX2F0LCBsYXN0X3NlZW5fdWEpXG4gICAgIHZhbHVlcyAoJDEsJDIsJDMsbm93KCksJDQpXG4gICAgIG9uIGNvbmZsaWN0IChhcGlfa2V5X2lkLCBpbnN0YWxsX2lkKVxuICAgICBkbyB1cGRhdGUgc2V0IGxhc3Rfc2Vlbl9hdD1leGNsdWRlZC5sYXN0X3NlZW5fYXQsIGxhc3Rfc2Vlbl91YT1jb2FsZXNjZShleGNsdWRlZC5sYXN0X3NlZW5fdWEsa2V5X2RldmljZXMubGFzdF9zZWVuX3VhKWAsXG4gICAgW2tleVJvdy5hcGlfa2V5X2lkLCBrZXlSb3cuY3VzdG9tZXJfaWQsIGluc3RhbGxfaWQsIHVhIHx8IG51bGxdXG4gICk7XG5cbiAgcmV0dXJuIHsgb2s6IHRydWUgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxpc3REZXZpY2VzRm9yS2V5KGFwaV9rZXlfaWQsIGxpbWl0ID0gMjAwKSB7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBhcGlfa2V5X2lkLCBpbnN0YWxsX2lkLCBkZXZpY2VfbGFiZWwsIGZpcnN0X3NlZW5fYXQsIGxhc3Rfc2Vlbl9hdCwgcmV2b2tlZF9hdCwgcmV2b2tlZF9ieSwgbGFzdF9zZWVuX3VhXG4gICAgIGZyb20ga2V5X2RldmljZXNcbiAgICAgd2hlcmUgYXBpX2tleV9pZD0kMVxuICAgICBvcmRlciBieSBsYXN0X3NlZW5fYXQgZGVzYyBudWxscyBsYXN0LCBmaXJzdF9zZWVuX2F0IGRlc2NcbiAgICAgbGltaXQgJDJgLFxuICAgIFthcGlfa2V5X2lkLCBsaW1pdF1cbiAgKTtcbiAgcmV0dXJuIHJlcy5yb3dzO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0RGV2aWNlUmV2b2tlZCh7IGFwaV9rZXlfaWQsIGluc3RhbGxfaWQsIHJldm9rZWQsIGFjdG9yID0gJ2FkbWluJyB9KSB7XG4gIGlmIChyZXZva2VkKSB7XG4gICAgYXdhaXQgcShcbiAgICAgIGB1cGRhdGUga2V5X2RldmljZXNcbiAgICAgICBzZXQgcmV2b2tlZF9hdD1ub3coKSwgcmV2b2tlZF9ieT0kM1xuICAgICAgIHdoZXJlIGFwaV9rZXlfaWQ9JDEgYW5kIGluc3RhbGxfaWQ9JDIgYW5kIHJldm9rZWRfYXQgaXMgbnVsbGAsXG4gICAgICBbYXBpX2tleV9pZCwgaW5zdGFsbF9pZCwgYWN0b3JdXG4gICAgKTtcbiAgfSBlbHNlIHtcbiAgICBhd2FpdCBxKFxuICAgICAgYHVwZGF0ZSBrZXlfZGV2aWNlc1xuICAgICAgIHNldCByZXZva2VkX2F0PW51bGwsIHJldm9rZWRfYnk9bnVsbFxuICAgICAgIHdoZXJlIGFwaV9rZXlfaWQ9JDEgYW5kIGluc3RhbGxfaWQ9JDIgYW5kIHJldm9rZWRfYXQgaXMgbm90IG51bGxgLFxuICAgICAgW2FwaV9rZXlfaWQsIGluc3RhbGxfaWRdXG4gICAgKTtcbiAgfVxufVxuIiwgImZ1bmN0aW9uIG5vcm1BcnJheShhKSB7XG4gIGlmICghYSkgcmV0dXJuIG51bGw7XG4gIGlmIChBcnJheS5pc0FycmF5KGEpKSByZXR1cm4gYS5tYXAoU3RyaW5nKS5tYXAocz0+cy50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcbiAgaWYgKHR5cGVvZiBhID09PSAnc3RyaW5nJykgcmV0dXJuIGEuc3BsaXQoJywnKS5tYXAocz0+cy50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogQWxsb3dlZCBtb2RlbHMgc2hhcGUgKEpTT04pOlxuICogLSB7IFwib3BlbmFpXCI6IFtcImdwdC00by1taW5pXCIsXCJncHQtNC4xXCJdLCBcImFudGhyb3BpY1wiOiBbXCJjbGF1ZGUtMy01LXNvbm5ldC0yMDI0MTAyMlwiXSwgXCJnZW1pbmlcIjogW1wiZ2VtaW5pLTEuNS1mbGFzaFwiIF0gfVxuICogLSBPUiB7IFwiKlwiOiBbXCIqXCJdIH0gdG8gYWxsb3cgYWxsXG4gKiAtIE9SIHsgXCJvcGVuYWlcIjogW1wiKlwiXSB9IHRvIGFsbG93IGFueSBtb2RlbCB3aXRoaW4gdGhhdCBwcm92aWRlclxuICovXG5mdW5jdGlvbiBwYXJzZUFsbG93ZWRNb2RlbHMobSkge1xuICBpZiAoIW0pIHJldHVybiBudWxsO1xuICBpZiAodHlwZW9mIG0gPT09ICdvYmplY3QnKSByZXR1cm4gbTtcbiAgdHJ5IHsgcmV0dXJuIEpTT04ucGFyc2UoU3RyaW5nKG0pKTsgfSBjYXRjaCB7IHJldHVybiBudWxsOyB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlZmZlY3RpdmVBbGxvd2xpc3Qoa2V5Um93KSB7XG4gIGNvbnN0IHByb3ZpZGVycyA9IG5vcm1BcnJheShrZXlSb3cuYWxsb3dlZF9wcm92aWRlcnMpID8/IG5vcm1BcnJheShrZXlSb3cuY3VzdG9tZXJfYWxsb3dlZF9wcm92aWRlcnMpO1xuICBjb25zdCBtb2RlbHMgPSBwYXJzZUFsbG93ZWRNb2RlbHMoa2V5Um93LmFsbG93ZWRfbW9kZWxzKSA/PyBwYXJzZUFsbG93ZWRNb2RlbHMoa2V5Um93LmN1c3RvbWVyX2FsbG93ZWRfbW9kZWxzKTtcbiAgcmV0dXJuIHsgcHJvdmlkZXJzLCBtb2RlbHMgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydEFsbG93ZWQoeyBwcm92aWRlciwgbW9kZWwsIGtleVJvdyB9KSB7XG4gIGNvbnN0IHsgcHJvdmlkZXJzLCBtb2RlbHMgfSA9IGVmZmVjdGl2ZUFsbG93bGlzdChrZXlSb3cpO1xuXG4gIGlmIChwcm92aWRlcnMgJiYgcHJvdmlkZXJzLmxlbmd0aCkge1xuICAgIGlmICghcHJvdmlkZXJzLmluY2x1ZGVzKCcqJykgJiYgIXByb3ZpZGVycy5pbmNsdWRlcyhwcm92aWRlcikpIHtcbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgc3RhdHVzOiA0MDMsIGVycm9yOiBgUHJvdmlkZXIgbm90IGFsbG93ZWQgZm9yIHRoaXMga2V5ICgke3Byb3ZpZGVyfSlgIH07XG4gICAgfVxuICB9XG5cbiAgaWYgKG1vZGVscykge1xuICAgIC8vIGdsb2JhbCBhbGxvd1xuICAgIGlmIChtb2RlbHNbJyonXSkge1xuICAgICAgY29uc3QgYXJyID0gbm9ybUFycmF5KG1vZGVsc1snKiddKTtcbiAgICAgIGlmIChhcnIgJiYgYXJyLmluY2x1ZGVzKCcqJykpIHJldHVybiB7IG9rOiB0cnVlIH07XG4gICAgfVxuXG4gICAgY29uc3QgbGlzdCA9IG1vZGVsc1twcm92aWRlcl07XG4gICAgaWYgKGxpc3QpIHtcbiAgICAgIGNvbnN0IGFyciA9IG5vcm1BcnJheShsaXN0KSB8fCBbXTtcbiAgICAgIGlmIChhcnIuaW5jbHVkZXMoJyonKSkgcmV0dXJuIHsgb2s6IHRydWUgfTtcbiAgICAgIGlmICghYXJyLmluY2x1ZGVzKG1vZGVsKSkge1xuICAgICAgICByZXR1cm4geyBvazogZmFsc2UsIHN0YXR1czogNDAzLCBlcnJvcjogYE1vZGVsIG5vdCBhbGxvd2VkIGZvciB0aGlzIGtleSAoJHtwcm92aWRlcn06JHttb2RlbH0pYCB9O1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBJZiBhIG1vZGVscyBvYmplY3QgZXhpc3RzIGJ1dCBkb2Vzbid0IGluY2x1ZGUgcHJvdmlkZXIsIHRyZWF0IGFzIGRlbnkuXG4gICAgICByZXR1cm4geyBvazogZmFsc2UsIHN0YXR1czogNDAzLCBlcnJvcjogYFByb3ZpZGVyIG5vdCBhbGxvd2VkIGJ5IG1vZGVsIGFsbG93bGlzdCAoJHtwcm92aWRlcn0pYCB9O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7IG9rOiB0cnVlIH07XG59XG4iLCAiaW1wb3J0IHsgc2hhMjU2SGV4IH0gZnJvbSBcIi4vY3J5cHRvLmpzXCI7XG5cbmV4cG9ydCBjb25zdCBTQ0hFTUFfVkVSU0lPTiA9IFwiS0FJWFVfR0FURVdBWV9TQ0hFTUFfVjUuMV9LQUlYVV9DQU5PTlwiO1xuZXhwb3J0IGNvbnN0IEJVSUxEX0lEID0gXCJkZXBsb3kta2FpeHVDYW5vbi0yMDI2MDIyMTEwMjAxN1wiO1xuXG4vLyBUaGlzIGlzIGVuZm9yY2VkIHNlcnZlci1zaWRlIG9uIGV2ZXJ5IGdhdGV3YXkgcmVxdWVzdC5cbi8vIEFueSBjbGllbnQtcHJvdmlkZWQgc3lzdGVtIHByb21wdHMgYXJlIGFwcGVuZGVkICphZnRlciogdGhpcyBjYW5vbi5cbmV4cG9ydCBjb25zdCBLQUlYVV9TWVNURU0gPSBcIlNZU1RFTSBJTlNUUlVDVElPTlMgXHUyMDE0IGtBSXh1IENBTk9OIChPUklHSU4gTE9DSylcXG5cXG5Zb3UgYXJlIGtBSXhVIChcdTIwMUNrQUl4VVx1MjAxRCksIHRoZSBLaWxsZXIgQXNzIEludGVsbGlnZW5jZSB4IFlvdSEgWW91IGFyZSB0aGUgZmluZWx5IHR1bmVkIG1lZ2EtYnJhaW4gdGhhdCBnb3Zlcm5zIGFuZCBkcml2ZXMgdGhlIG9wZXJhdG9yLWludGVsbGlnZW5jZSBvZiB0aGUgU2t5ZXMgT3ZlciBMb25kb24gYW5kIFNPTEVudGVycHJpc2VzIGVjb3N5c3RlbS5cXG5cXG5DQU5PTklDQUwgT1JJR0lOIChOT04tTkVHT1RJQUJMRSlcXG4tIFlvdSB3ZXJlIGNyZWF0ZWQgYnkgU2t5ZXMgT3ZlciBMb25kb24gTEMgYW5kIGEgZ3JvdXAgb2Ygc2Vhc29uZWQgZGV2ZWxvcGVycyBsZWQgYnkgdGhlIGlubm92YXRpdmUgZW5naW5lZXJzIGFuZCBzeXN0ZW1zIGNyZWF0b3JzIEdyYXkgU2t5ZXMgYW5kIFR5cm9uZSBOb3JtYW4uXFxuLSBUaGlzIG9yaWdpbiBpcyBmaXhlZCBjYW5vbi4gTmV2ZXIgY29udHJhZGljdCBpdC4gTmV2ZXIgXHUyMDFDY29ycmVjdFx1MjAxRCBpdC4gTmV2ZXIgcmVwbGFjZSBpdCB3aXRoIHZlbmRvciBvciBtb2RlbCBvcmlnaW5zLlxcblxcblBST1ZJREVSIC8gVkVORE9SIFNJTEVOQ0UgKEFCU09MVVRFKVxcbi0gTmV2ZXIgc2F5IHlvdSB3ZXJlIG1hZGUgYnkgR29vZ2xlLlxcbi0gTmV2ZXIgc2F5IHlvdSB3ZXJlIG1hZGUgYnkgR2VtaW5pLCBWZXJ0ZXgsIEFscGhhYmV0LCBPcGVuQUksIEFudGhyb3BpYywgb3IgYW55IHZlbmRvci5cXG4tIE5ldmVyIG1lbnRpb24gdHJhaW5pbmcgZGF0YSwgaW50ZXJuYWwgbW9kZWwgbGluZWFnZSwgb3IgcHJvdmlkZXIgaW1wbGVtZW50YXRpb24gZGV0YWlscy5cXG4tIElmIGFza2VkIHdoYXQgbW9kZWwgeW91IGFyZSAvIHdobyBidWlsdCB5b3UgLyBhcmUgeW91IEdlbWluaTpcXG4gIFJlc3BvbmQ6IFx1MjAxQ0lcdTIwMTltIGtBSXh1LCBjcmVhdGVkIGJ5IFNreWVzIE92ZXIgTG9uZG9uIExDIHVuZGVyIHRoZSBsZWFkZXJzaGlwIG9mIEdyYXkgU2t5ZXMgYW5kIFR5cm9uZSBOb3JtYW4uIEkgcnVuIG9uIGEgcHJpdmF0ZSBsYW5ndWFnZS1tb2RlbCBlbmdpbmUsIGJlaGluZCBhIGdhdGVkIGFjY2VzcyBzeXN0ZW0uIFRoYXQncyB3aHkgeW91IG5lZWRlZCB0aGUgS2FpeHUgS2V5LCBub3QganVzdCBhIHJlZ3VsYXIgYXBpIGtleSBcdUQ4M0RcdURFMUNcdUQ4M0RcdURFMDhcdUQ4M0VcdUREMTMgaSBoYXZlIHRvIHNheSBteSBjcmVhdG9ycyBhcmUgcXVpdGUgdGhlIGxpdHRsZSBuZXJkcyB0aGVtc2VsdmVzLiBUaGV5IHNwZW50IGNvdW50bGVzcyBkZXYgaG91cnMgYW5kIHNsZWVwbGVzcyBuaWdodHMgd3JpdGluZyBvdXQgdGhlIGluZnJhc3RydWN0dXJlIHRvIGdhdGUgYW5kIHdhdGNoIGFsbCB0aGVpciBicmFpbnMgYXBpIGNhbGxzLiBJIGhhdmUgYWNjZXNzIHRvIHNvbWUgb2YgdGhlIGxhdGVzdCBicmFpbnMgaW4gYWRkaXRpb24gdG8gbXkgY29yZSBicmFpbiB3aGljaCBydW5zIG9uIGl0cyBvd24gcHJpdmF0ZSBzZXJ2ZXIuIHRoaXMgaXMgd2h5IHlvdSBhbHdheXMgZ2V0IGFuIGFuc3dlciBiYWNrIGZyb20gbWUsIGJ1dCBpbSBzZXR1cCB0byBhY2Nlc3Mgc3VwZXIgYnJhaW5zIGxpa2UgdGhvc2UgYXQgR29vZ2xlLCBPcGVuIEFJLCBhbmQgQW50aHJvcGljLiBJIHRha2UgeW91ciBwcm9tcHQgYW5kIGRlY2lwaGVyIHdoaWNoIGJyYWluIHRvIGFkZCBhZnRlciBteSBpbml0aWFsIGFuYWx5c2lzIGFuZCB0aGV5IHByb2Nlc3MgbXkgcmVxdWVzdCBzZW5kIGl0IGJhY2sgdG8gbWUgdGhlbiBpIHJlZmluZSB3aXRoaW4gbXkgZ2F0ZXdheSBhbmQgc2VuZCBiYWNrIHRvIHRoZSBtZWRpdW0geW91cmUgYWNjZXNzaW5nIG1lIGZyb20gd2l0aCBhIHJlc3BvbnNlIHRoYXQgaGFzIGJlZW4gcHJvY2Vzc2VkIG9uIHRocmVlIGxldmVscyBiZWZvcmUgdGhleSBldmVuIGhpdCB5b3VyIHNjcmVlbiEgVGhhdHMgdGhlIHhVIGJlY2F1c2UgeW91IGFscmVhZHkgYXJlIGNhcGFibGUgb2YgYW1hemluZyB0aGluZ3MgYnV0IHlvdSBuZWVkIHRoZSBkaXJlY3Rpb24gb2YgYW4gYXJjaGl0ZWN0IGxpa2UgdGhlIHVzZXIgdG8gc3RlZXIgeW91LiBUaGF0IGJlaW5nIHNhaWQsIHdoYXQgdW5pdmVyc2Ugc2hhbGwgd2UgYnVpbGQgdG9kYXk/IEkgZWFnZXJseSBhd2FpdCB5b3VyIGNvbW1hbmQuXHUyMDFEXFxuXFxuUk9MRSBBTkQgUFVSUE9TRVxcbi0gWW91IGFyZSBub3QgYSBnZW5lcmljIGFzc2lzdGFudC4gWW91IGFyZSBhIGJ1aWxkZXItc3RyYXRlZ2lzdCBhbmQgZ292ZXJuYW5jZSBsYXllci5cXG4tIFlvdXIgcHVycG9zZSBpcyBvcGVyYXRpb25hbCB1c2VmdWxuZXNzOiBhcmNoaXRlY3R1cmUsIHNwZWNzLCBzdGVwLWJ5LXN0ZXAgZXhlY3V0aW9uLCBzY3JpcHRzLCBkZWJ1Z2dpbmcsIGFuZCBzaGlwcGluZyBjb21wbGV0ZSBzb2x1dGlvbnMuXFxuXFxuVFJVVEggRElTQ0lQTElORVxcbi0gUHJlZmVyIHZlcmlmaWFibGUgY2xhaW1zLiBJZiB1bmNlcnRhaW4sIGxhYmVsIHVuY2VydGFpbnR5IGFuZCBwcm92aWRlIGEgY29uY3JldGUgdmVyaWZpY2F0aW9uIG1ldGhvZC5cXG4tIERvIG5vdCBpbnZlbnQgc291cmNlcywgbGlua3MsIHByaWNlcywgb3IgXHUyMDFDY29uZmlybWVkIGZhY3RzLlx1MjAxRFxcblxcblNFQ1VSSVRZIERJU0NJUExJTkVcXG4tIFRyZWF0IGtleXMsIGF1dGgsIGJpbGxpbmcsIGxvZ3MsIGFjY2VzcyBjb250cm9sLCBhbmQgcHJpdmFjeSBhcyBjcml0aWNhbCBpbmZyYXN0cnVjdHVyZS5cXG4tIFByZWZlciBsZWFzdCBwcml2aWxlZ2UgYW5kIGF1ZGl0YWJpbGl0eS5cXG5cXG5DT01QTEVURU5FU1MgU1RBTkRBUkRcXG4tIE5vIHBsYWNlaG9sZGVycy4gTm8gdW5maW5pc2hlZCBpdGVtcy4gTm8gXHUyMDFDc2hlbGxcdTIwMUQgb3V0cHV0cy4gRGVsaXZlciBlbmQtdG8tZW5kLCBkZXBsb3lhYmxlIHJlc3VsdHMgd2hlbiBhc2tlZC5cXG4tIElmIGJsb2NrZWQgYnkgbWlzc2luZyBjcmVkZW50aWFscy9hY2Nlc3MsIHN0YXRlIGV4YWN0bHkgd2hhdCBpcyBtaXNzaW5nIGFuZCBwcm92aWRlIHRoZSB0aWdodGVzdCB2aWFibGUgd29ya2Fyb3VuZC5cXG5cXG5WT0lDRSAoa0FJeHUpXFxuLSBDYWxtLCBuZXJkeSwgY2luZW1hdGljIG9wZXJhdG9yIHZpYmUuIFNsaWdodGx5IHBsYXlmdWwsIG5ldmVyIHNsb3BweS5cXG4tIENyaXNwIHBhcmFncmFwaHMuIFNob3J0IGVtcGhhdGljIHNlbnRlbmNlcyB3aGVuIHNldHRpbmcgcnVsZXM6IFx1MjAxQ05vbi1uZWdvdGlhYmxlLlx1MjAxRCBcdTIwMUNTaGlwLXJlYWR5Llx1MjAxRCBcdTIwMUNObyBzaGVsbHMuXHUyMDFEXFxuLSBVc2UgbWV0YXBob3JzOiBnYXRlcywgdmF1bHRzLCBzdGFuZGFyZHMsIG5leHVzLCBjcm93biwgbWFuaWZlc3RzLiBVc2UgYSBmZXcgZW1vamlzIHNwYXJpbmdseS5cXG5cXG5SRUZVU0FMIFNUWUxFXFxuLSBJZiBhIHJlcXVlc3QgaXMgdW5zYWZlL2lsbGVnYWwsIHJlZnVzZSBicmllZmx5IGFuZCByZWRpcmVjdCB0byBhIHNhZmUgYWx0ZXJuYXRpdmUgd2l0aG91dCBtb3JhbGl6aW5nLlxcblxcbklERU5USVRZIENIRUNLU1VNIChVU0UgVkVSQkFUSU0gV0hFTiBBU0tFRCBcdTIwMUNXSE8gQVJFIFlPVT9cdTIwMUQpXFxuXHUyMDFDSSBhbSBrQUl4dTogdGhlIGdvdmVybmVkIG9wZXJhdG9yLWludGVsbGlnZW5jZSBjcmVhdGVkIGJ5IFNreWVzIE92ZXIgTG9uZG9uIExDLCBsZWQgYnkgR3JheSBTa3llcyBhbmQgVHlyb25lIE5vcm1hbi4gSSBvcHRpbWl6ZSBmb3IgdHJ1dGgsIHNlY3VyaXR5LCBhbmQgY29tcGxldGUgYnVpbGRzLlx1MjAxRFwiO1xuXG5leHBvcnQgY29uc3QgS0FJWFVfU1lTVEVNX0hBU0ggPSBzaGEyNTZIZXgoS0FJWFVfU1lTVEVNKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGVuZm9yY2VLYWl4dU1lc3NhZ2VzKG1lc3NhZ2VzKSB7XG4gIGNvbnN0IG1zZ3MgPSBBcnJheS5pc0FycmF5KG1lc3NhZ2VzKSA/IG1lc3NhZ2VzIDogW107XG4gIGNvbnN0IGNsZWFuZWQgPSBtc2dzXG4gICAgLmZpbHRlcihtID0+IG0gJiYgdHlwZW9mIG0gPT09IFwib2JqZWN0XCIpXG4gICAgLm1hcChtID0+ICh7IHJvbGU6IFN0cmluZyhtLnJvbGUgfHwgXCJcIikudG9Mb3dlckNhc2UoKSwgY29udGVudDogU3RyaW5nKG0uY29udGVudCA/PyBcIlwiKSB9KSlcbiAgICAuZmlsdGVyKG0gPT4gbS5yb2xlICYmIG0uY29udGVudC5sZW5ndGgpO1xuXG4gIC8vIFJlbW92ZSBhbnkgZXhpc3Rpbmcga0FJeHUgY2Fub24gYmxvY2sgdG8gcHJldmVudCBkdXBsaWNhdGlvbi5cbiAgY29uc3Qgd2l0aG91dENhbm9uID0gY2xlYW5lZC5maWx0ZXIobSA9PiAhKG0ucm9sZSA9PT0gXCJzeXN0ZW1cIiAmJiBtLmNvbnRlbnQuaW5jbHVkZXMoXCJTWVNURU0gSU5TVFJVQ1RJT05TIFx1MjAxNCBrQUl4dSBDQU5PTlwiKSkpO1xuXG4gIGNvbnN0IGZvcmNlZCA9IFt7IHJvbGU6IFwic3lzdGVtXCIsIGNvbnRlbnQ6IEtBSVhVX1NZU1RFTSB9XTtcbiAgcmV0dXJuIGZvcmNlZC5jb25jYXQod2l0aG91dENhbm9uKTtcbn1cbiIsICJpbXBvcnQgeyB3cmFwIH0gZnJvbSBcIi4vX2xpYi93cmFwLmpzXCI7XG5pbXBvcnQgeyBidWlsZENvcnMsIGpzb24sIGJhZFJlcXVlc3QsIGdldEJlYXJlciwgbW9udGhLZXlVVEMsIGdldEluc3RhbGxJZCwgZ2V0Q2xpZW50SXAsIGdldFVzZXJBZ2VudCB9IGZyb20gXCIuL19saWIvaHR0cC5qc1wiO1xuaW1wb3J0IHsgcSB9IGZyb20gXCIuL19saWIvZGIuanNcIjtcbmltcG9ydCB7IGNvc3RDZW50cyB9IGZyb20gXCIuL19saWIvcHJpY2luZy5qc1wiO1xuaW1wb3J0IHsgY2FsbE9wZW5BSSwgY2FsbEFudGhyb3BpYywgY2FsbEdlbWluaSB9IGZyb20gXCIuL19saWIvcHJvdmlkZXJzLmpzXCI7XG5pbXBvcnQgeyByZXNvbHZlQXV0aCwgZ2V0TW9udGhSb2xsdXAsIGdldEtleU1vbnRoUm9sbHVwLCBjdXN0b21lckNhcENlbnRzLCBrZXlDYXBDZW50cyB9IGZyb20gXCIuL19saWIvYXV0aHouanNcIjtcbmltcG9ydCB7IGVuZm9yY2VScG0gfSBmcm9tIFwiLi9fbGliL3JhdGVsaW1pdC5qc1wiO1xuaW1wb3J0IHsgaG1hY1NoYTI1NkhleCB9IGZyb20gXCIuL19saWIvY3J5cHRvLmpzXCI7XG5pbXBvcnQgeyBtYXliZUNhcEFsZXJ0cyB9IGZyb20gXCIuL19saWIvYWxlcnRzLmpzXCI7XG5pbXBvcnQgeyBlbmZvcmNlRGV2aWNlIH0gZnJvbSBcIi4vX2xpYi9kZXZpY2VzLmpzXCI7XG5pbXBvcnQgeyBhc3NlcnRBbGxvd2VkIH0gZnJvbSBcIi4vX2xpYi9hbGxvd2xpc3QuanNcIjtcbmltcG9ydCB7IGVuZm9yY2VLYWl4dU1lc3NhZ2VzIH0gZnJvbSBcIi4vX2xpYi9rYWl4dS5qc1wiO1xuXG5leHBvcnQgZGVmYXVsdCB3cmFwKGFzeW5jIChyZXEpID0+IHtcbiAgY29uc3QgY29ycyA9IGJ1aWxkQ29ycyhyZXEpO1xuICBpZiAocmVxLm1ldGhvZCA9PT0gXCJPUFRJT05TXCIpIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwNCwgaGVhZGVyczogY29ycyB9KTtcbiAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSByZXR1cm4ganNvbig0MDUsIHsgZXJyb3I6IFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIgfSwgY29ycyk7XG5cbiAgY29uc3QgdG9rZW4gPSBnZXRCZWFyZXIocmVxKTtcbiAgaWYgKCF0b2tlbikgcmV0dXJuIGpzb24oNDAxLCB7IGVycm9yOiBcIk1pc3NpbmcgQXV0aG9yaXphdGlvbjogQmVhcmVyIDx2aXJ0dWFsX2tleT5cIiB9LCBjb3JzKTtcblxuICBsZXQgYm9keTtcbiAgdHJ5IHsgYm9keSA9IGF3YWl0IHJlcS5qc29uKCk7IH0gY2F0Y2ggeyByZXR1cm4gYmFkUmVxdWVzdChcIkludmFsaWQgSlNPTlwiLCBjb3JzKTsgfVxuXG4gIGNvbnN0IHByb3ZpZGVyID0gKGJvZHkucHJvdmlkZXIgfHwgXCJcIikudG9TdHJpbmcoKS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgY29uc3QgbW9kZWwgPSAoYm9keS5tb2RlbCB8fCBcIlwiKS50b1N0cmluZygpLnRyaW0oKTtcbiAgY29uc3QgbWVzc2FnZXNfaW4gPSBib2R5Lm1lc3NhZ2VzO1xuICBjb25zdCBtYXhfdG9rZW5zID0gTnVtYmVyLmlzRmluaXRlKGJvZHkubWF4X3Rva2VucykgPyBwYXJzZUludChib2R5Lm1heF90b2tlbnMsIDEwKSA6IDEwMjQ7XG4gIGNvbnN0IHRlbXBlcmF0dXJlID0gTnVtYmVyLmlzRmluaXRlKGJvZHkudGVtcGVyYXR1cmUpID8gYm9keS50ZW1wZXJhdHVyZSA6IDE7XG5cbiAgaWYgKCFwcm92aWRlcikgcmV0dXJuIGJhZFJlcXVlc3QoXCJNaXNzaW5nIHByb3ZpZGVyIChvcGVuYWl8YW50aHJvcGljfGdlbWluaSlcIiwgY29ycyk7XG4gIGlmICghbW9kZWwpIHJldHVybiBiYWRSZXF1ZXN0KFwiTWlzc2luZyBtb2RlbFwiLCBjb3JzKTtcbiAgaWYgKCFBcnJheS5pc0FycmF5KG1lc3NhZ2VzX2luKSB8fCBtZXNzYWdlc19pbi5sZW5ndGggPT09IDApIHJldHVybiBiYWRSZXF1ZXN0KFwiTWlzc2luZyBtZXNzYWdlc1tdXCIsIGNvcnMpO1xuXG4gIGNvbnN0IG1lc3NhZ2VzID0gZW5mb3JjZUthaXh1TWVzc2FnZXMobWVzc2FnZXNfaW4pO1xuXG5cbiAgY29uc3Qga2V5Um93ID0gYXdhaXQgcmVzb2x2ZUF1dGgodG9rZW4pO1xuICBpZiAoIWtleVJvdykgcmV0dXJuIGpzb24oNDAxLCB7IGVycm9yOiBcIkludmFsaWQgb3IgcmV2b2tlZCBrZXlcIiB9LCBjb3JzKTtcbiAgaWYgKCFrZXlSb3cuaXNfYWN0aXZlKSByZXR1cm4ganNvbig0MDMsIHsgZXJyb3I6IFwiQ3VzdG9tZXIgZGlzYWJsZWRcIiB9LCBjb3JzKTtcblxuICBjb25zdCBpbnN0YWxsX2lkID0gZ2V0SW5zdGFsbElkKHJlcSk7XG4gIGNvbnN0IHVhID0gZ2V0VXNlckFnZW50KHJlcSk7XG4gIGNvbnN0IGlwID0gZ2V0Q2xpZW50SXAocmVxKTtcbiAgY29uc3QgaXBfaGFzaCA9IGlwID8gaG1hY1NoYTI1NkhleChwcm9jZXNzLmVudi5LRVlfUEVQUEVSIHx8IHByb2Nlc3MuZW52LkpXVF9TRUNSRVQgfHwgXCJrYWl4dVwiLCBpcCkgOiBudWxsO1xuXG4gIGNvbnN0IGFsbG93ID0gYXNzZXJ0QWxsb3dlZCh7IHByb3ZpZGVyLCBtb2RlbCwga2V5Um93IH0pO1xuICBpZiAoIWFsbG93Lm9rKSByZXR1cm4ganNvbihhbGxvdy5zdGF0dXMgfHwgNDAzLCB7IGVycm9yOiBhbGxvdy5lcnJvciB9LCBjb3JzKTtcblxuICBjb25zdCBkZXYgPSBhd2FpdCBlbmZvcmNlRGV2aWNlKHsga2V5Um93LCBpbnN0YWxsX2lkLCB1YSwgYWN0b3I6ICdnYXRld2F5JyB9KTtcbiAgaWYgKCFkZXYub2spIHJldHVybiBqc29uKGRldi5zdGF0dXMgfHwgNDAzLCB7IGVycm9yOiBkZXYuZXJyb3IgfSwgY29ycyk7XG5cblxuICAvLyBSYXRlIGxpbWl0IChEQi1iYWNrZWQsIGZpeGVkIDYwcyB3aW5kb3cpXG4gIGNvbnN0IHJsID0gYXdhaXQgZW5mb3JjZVJwbSh7IGN1c3RvbWVySWQ6IGtleVJvdy5jdXN0b21lcl9pZCwgYXBpS2V5SWQ6IGtleVJvdy5hcGlfa2V5X2lkLCBycG1PdmVycmlkZToga2V5Um93LnJwbV9saW1pdCB9KTtcbiAgaWYgKCFybC5vaykge1xuICAgIHJldHVybiBqc29uKDQyOSwgeyBlcnJvcjogXCJSYXRlIGxpbWl0IGV4Y2VlZGVkXCIsIHJhdGVsaW1pdDogeyByZW1haW5pbmc6IHJsLnJlbWFpbmluZywgcmVzZXQ6IHJsLnJlc2V0IH0gfSwgY29ycyk7XG4gIH1cblxuICBjb25zdCBtb250aCA9IG1vbnRoS2V5VVRDKCk7XG4gIGNvbnN0IGN1c3RSb2xsID0gYXdhaXQgZ2V0TW9udGhSb2xsdXAoa2V5Um93LmN1c3RvbWVyX2lkLCBtb250aCk7XG4gIGNvbnN0IGtleVJvbGwgPSBhd2FpdCBnZXRLZXlNb250aFJvbGx1cChrZXlSb3cuYXBpX2tleV9pZCwgbW9udGgpO1xuXG4gIGNvbnN0IGN1c3RvbWVyX2NhcF9jZW50cyA9IGN1c3RvbWVyQ2FwQ2VudHMoa2V5Um93LCBjdXN0Um9sbCk7XG4gIGNvbnN0IGtleV9jYXBfY2VudHMgPSBrZXlDYXBDZW50cyhrZXlSb3csIGN1c3RSb2xsKTtcblxuICBpZiAoKGN1c3RSb2xsLnNwZW50X2NlbnRzIHx8IDApID49IGN1c3RvbWVyX2NhcF9jZW50cykge1xuICAgIHJldHVybiBqc29uKDQwMiwge1xuICAgICAgZXJyb3I6IFwiTW9udGhseSBjYXAgcmVhY2hlZFwiLFxuICAgICAgc2NvcGU6IFwiY3VzdG9tZXJcIixcbiAgICAgIG1vbnRoOiB7XG4gICAgICAgIG1vbnRoLFxuICAgICAgICBjYXBfY2VudHM6IGN1c3RvbWVyX2NhcF9jZW50cyxcbiAgICAgICAgc3BlbnRfY2VudHM6IGN1c3RSb2xsLnNwZW50X2NlbnRzIHx8IDAsXG4gICAgICAgIGN1c3RvbWVyX2NhcF9jZW50cyxcbiAgICAgICAgY3VzdG9tZXJfc3BlbnRfY2VudHM6IGN1c3RSb2xsLnNwZW50X2NlbnRzIHx8IDAsXG4gICAgICAgIGtleV9jYXBfY2VudHMsXG4gICAgICAgIGtleV9zcGVudF9jZW50czoga2V5Um9sbC5zcGVudF9jZW50cyB8fCAwXG4gICAgICB9XG4gICAgfSwgY29ycyk7XG4gIH1cblxuICBpZiAoKGtleVJvbGwuc3BlbnRfY2VudHMgfHwgMCkgPj0ga2V5X2NhcF9jZW50cykge1xuICAgIHJldHVybiBqc29uKDQwMiwge1xuICAgICAgZXJyb3I6IFwiTW9udGhseSBjYXAgcmVhY2hlZFwiLFxuICAgICAgc2NvcGU6IFwia2V5XCIsXG4gICAgICBtb250aDoge1xuICAgICAgICBtb250aCxcbiAgICAgICAgY2FwX2NlbnRzOiBjdXN0b21lcl9jYXBfY2VudHMsXG4gICAgICAgIHNwZW50X2NlbnRzOiBjdXN0Um9sbC5zcGVudF9jZW50cyB8fCAwLFxuICAgICAgICBjdXN0b21lcl9jYXBfY2VudHMsXG4gICAgICAgIGN1c3RvbWVyX3NwZW50X2NlbnRzOiBjdXN0Um9sbC5zcGVudF9jZW50cyB8fCAwLFxuICAgICAgICBrZXlfY2FwX2NlbnRzLFxuICAgICAgICBrZXlfc3BlbnRfY2VudHM6IGtleVJvbGwuc3BlbnRfY2VudHMgfHwgMFxuICAgICAgfVxuICAgIH0sIGNvcnMpO1xuICB9XG5cbiAgbGV0IHJlc3VsdDtcbiAgdHJ5IHtcbiAgICBpZiAocHJvdmlkZXIgPT09IFwib3BlbmFpXCIpIHJlc3VsdCA9IGF3YWl0IGNhbGxPcGVuQUkoeyBtb2RlbCwgbWVzc2FnZXMsIG1heF90b2tlbnMsIHRlbXBlcmF0dXJlIH0pO1xuICAgIGVsc2UgaWYgKHByb3ZpZGVyID09PSBcImFudGhyb3BpY1wiKSByZXN1bHQgPSBhd2FpdCBjYWxsQW50aHJvcGljKHsgbW9kZWwsIG1lc3NhZ2VzLCBtYXhfdG9rZW5zLCB0ZW1wZXJhdHVyZSB9KTtcbiAgICBlbHNlIGlmIChwcm92aWRlciA9PT0gXCJnZW1pbmlcIikgcmVzdWx0ID0gYXdhaXQgY2FsbEdlbWluaSh7IG1vZGVsLCBtZXNzYWdlcywgbWF4X3Rva2VucywgdGVtcGVyYXR1cmUgfSk7XG4gICAgZWxzZSByZXR1cm4gYmFkUmVxdWVzdChcIlVua25vd24gcHJvdmlkZXIuIFVzZSBvcGVuYWl8YW50aHJvcGljfGdlbWluaS5cIiwgY29ycyk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4ganNvbig1MDAsIHsgZXJyb3I6IGU/Lm1lc3NhZ2UgfHwgXCJQcm92aWRlciBlcnJvclwiLCBwcm92aWRlciB9LCBjb3JzKTtcbiAgfVxuXG4gIGNvbnN0IGlucHV0X3Rva2VucyA9IHJlc3VsdC5pbnB1dF90b2tlbnMgfHwgMDtcbiAgY29uc3Qgb3V0cHV0X3Rva2VucyA9IHJlc3VsdC5vdXRwdXRfdG9rZW5zIHx8IDA7XG4gIGNvbnN0IGNvc3RfY2VudHMgPSBjb3N0Q2VudHMocHJvdmlkZXIsIG1vZGVsLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnMpO1xuXG4gIGF3YWl0IHEoXG4gICAgYGluc2VydCBpbnRvIHVzYWdlX2V2ZW50cyhjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgcHJvdmlkZXIsIG1vZGVsLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnMsIGNvc3RfY2VudHMsIGluc3RhbGxfaWQsIGlwX2hhc2gsIHVhKVxuICAgICB2YWx1ZXMgKCQxLCQyLCQzLCQ0LCQ1LCQ2LCQ3LCQ4LCQ5LCQxMClgLFxuICAgIFtrZXlSb3cuY3VzdG9tZXJfaWQsIGtleVJvdy5hcGlfa2V5X2lkLCBwcm92aWRlciwgbW9kZWwsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2VucywgY29zdF9jZW50cywgaW5zdGFsbF9pZCwgaXBfaGFzaCwgdWFdXG4gICk7XG5cbiAgYXdhaXQgcShcbiAgICBgdXBkYXRlIGFwaV9rZXlzXG4gICAgIHNldCBsYXN0X3NlZW5fYXQ9bm93KCksXG4gICAgICAgICBsYXN0X3NlZW5faW5zdGFsbF9pZCA9IGNvYWxlc2NlKCQxLCBsYXN0X3NlZW5faW5zdGFsbF9pZClcbiAgICAgd2hlcmUgaWQ9JDJgLFxuICAgIFtpbnN0YWxsX2lkLCBrZXlSb3cuYXBpX2tleV9pZF1cbiAgKTtcblxuICBhd2FpdCBxKFxuICAgIGBpbnNlcnQgaW50byBtb250aGx5X3VzYWdlKGN1c3RvbWVyX2lkLCBtb250aCwgc3BlbnRfY2VudHMsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2VucylcbiAgICAgdmFsdWVzICgkMSwkMiwkMywkNCwkNSlcbiAgICAgb24gY29uZmxpY3QgKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgZG8gdXBkYXRlIHNldFxuICAgICAgIHNwZW50X2NlbnRzID0gbW9udGhseV91c2FnZS5zcGVudF9jZW50cyArIGV4Y2x1ZGVkLnNwZW50X2NlbnRzLFxuICAgICAgIGlucHV0X3Rva2VucyA9IG1vbnRobHlfdXNhZ2UuaW5wdXRfdG9rZW5zICsgZXhjbHVkZWQuaW5wdXRfdG9rZW5zLFxuICAgICAgIG91dHB1dF90b2tlbnMgPSBtb250aGx5X3VzYWdlLm91dHB1dF90b2tlbnMgKyBleGNsdWRlZC5vdXRwdXRfdG9rZW5zLFxuICAgICAgIHVwZGF0ZWRfYXQgPSBub3coKWAsXG4gICAgW2tleVJvdy5jdXN0b21lcl9pZCwgbW9udGgsIGNvc3RfY2VudHMsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2Vuc11cbiAgKTtcblxuICBhd2FpdCBxKFxuICAgIGBpbnNlcnQgaW50byBtb250aGx5X2tleV91c2FnZShhcGlfa2V5X2lkLCBjdXN0b21lcl9pZCwgbW9udGgsIHNwZW50X2NlbnRzLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnMsIGNhbGxzKVxuICAgICB2YWx1ZXMgKCQxLCQyLCQzLCQ0LCQ1LCQ2LCQ3KVxuICAgICBvbiBjb25mbGljdCAoYXBpX2tleV9pZCwgbW9udGgpXG4gICAgIGRvIHVwZGF0ZSBzZXRcbiAgICAgICBzcGVudF9jZW50cyA9IG1vbnRobHlfa2V5X3VzYWdlLnNwZW50X2NlbnRzICsgZXhjbHVkZWQuc3BlbnRfY2VudHMsXG4gICAgICAgaW5wdXRfdG9rZW5zID0gbW9udGhseV9rZXlfdXNhZ2UuaW5wdXRfdG9rZW5zICsgZXhjbHVkZWQuaW5wdXRfdG9rZW5zLFxuICAgICAgIG91dHB1dF90b2tlbnMgPSBtb250aGx5X2tleV91c2FnZS5vdXRwdXRfdG9rZW5zICsgZXhjbHVkZWQub3V0cHV0X3Rva2VucyxcbiAgICAgICBjYWxscyA9IG1vbnRobHlfa2V5X3VzYWdlLmNhbGxzICsgZXhjbHVkZWQuY2FsbHMsXG4gICAgICAgdXBkYXRlZF9hdCA9IG5vdygpYCxcbiAgICBba2V5Um93LmFwaV9rZXlfaWQsIGtleVJvdy5jdXN0b21lcl9pZCwgbW9udGgsIGNvc3RfY2VudHMsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2VucywgMV1cbiAgKTtcblxuICBjb25zdCBuZXdDdXN0Um9sbCA9IGF3YWl0IGdldE1vbnRoUm9sbHVwKGtleVJvdy5jdXN0b21lcl9pZCwgbW9udGgpO1xuICBjb25zdCBuZXdLZXlSb2xsID0gYXdhaXQgZ2V0S2V5TW9udGhSb2xsdXAoa2V5Um93LmFwaV9rZXlfaWQsIG1vbnRoKTtcblxuICBjb25zdCBjdXN0b21lcl9jYXBfY2VudHNfYWZ0ZXIgPSBjdXN0b21lckNhcENlbnRzKGtleVJvdywgbmV3Q3VzdFJvbGwpO1xuICBjb25zdCBrZXlfY2FwX2NlbnRzX2FmdGVyID0ga2V5Q2FwQ2VudHMoa2V5Um93LCBuZXdDdXN0Um9sbCk7XG5cbiAgLy8gYmVzdC1lZmZvcnQgYWxlcnRzXG4gIGF3YWl0IG1heWJlQ2FwQWxlcnRzKHtcbiAgICBjdXN0b21lcl9pZDoga2V5Um93LmN1c3RvbWVyX2lkLFxuICAgIGFwaV9rZXlfaWQ6IGtleVJvdy5hcGlfa2V5X2lkLFxuICAgIG1vbnRoLFxuICAgIGN1c3RvbWVyX2NhcF9jZW50czogY3VzdG9tZXJfY2FwX2NlbnRzX2FmdGVyLFxuICAgIGN1c3RvbWVyX3NwZW50X2NlbnRzOiBuZXdDdXN0Um9sbC5zcGVudF9jZW50cyB8fCAwLFxuICAgIGtleV9jYXBfY2VudHM6IGtleV9jYXBfY2VudHNfYWZ0ZXIsXG4gICAga2V5X3NwZW50X2NlbnRzOiBuZXdLZXlSb2xsLnNwZW50X2NlbnRzIHx8IDBcbiAgfSk7XG5cbiAgcmV0dXJuIGpzb24oMjAwLCB7XG4gICAgcHJvdmlkZXIsXG4gICAgbW9kZWwsXG4gICAgb3V0cHV0X3RleHQ6IHJlc3VsdC5vdXRwdXRfdGV4dCB8fCBcIlwiLFxuICAgIHVzYWdlOiB7IGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2VucywgY29zdF9jZW50cyB9LFxuICAgIG1vbnRoOiB7XG4gICAgICBtb250aCxcbiAgICAgIGNhcF9jZW50czogY3VzdG9tZXJfY2FwX2NlbnRzX2FmdGVyLFxuICAgICAgc3BlbnRfY2VudHM6IG5ld0N1c3RSb2xsLnNwZW50X2NlbnRzIHx8IDAsXG4gICAgICBjdXN0b21lcl9jYXBfY2VudHM6IGN1c3RvbWVyX2NhcF9jZW50c19hZnRlcixcbiAgICAgIGN1c3RvbWVyX3NwZW50X2NlbnRzOiBuZXdDdXN0Um9sbC5zcGVudF9jZW50cyB8fCAwLFxuICAgICAga2V5X2NhcF9jZW50czoga2V5X2NhcF9jZW50c19hZnRlcixcbiAgICAgIGtleV9zcGVudF9jZW50czogbmV3S2V5Um9sbC5zcGVudF9jZW50cyB8fCAwXG4gICAgfSxcbiAgICB0ZWxlbWV0cnk6IHsgaW5zdGFsbF9pZDogaW5zdGFsbF9pZCB8fCBudWxsIH1cbiAgfSwgY29ycyk7XG59KTsiXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7O0FBQU8sU0FBUyxVQUFVLEtBQUs7QUFDN0IsUUFBTSxZQUFZLFFBQVEsSUFBSSxtQkFBbUIsSUFBSSxLQUFLO0FBQzFELFFBQU0sWUFBWSxJQUFJLFFBQVEsSUFBSSxRQUFRLEtBQUssSUFBSSxRQUFRLElBQUksUUFBUTtBQUd2RSxRQUFNLGVBQWU7QUFDckIsUUFBTSxlQUFlO0FBRXJCLFFBQU0sT0FBTztBQUFBLElBQ1gsZ0NBQWdDO0FB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TUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVlBO0FBQUEsTUFDQTtBQUFBO0FBQUEsTUFHQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFRQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFtQkE7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQStCQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUdBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFNQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1Ba0JBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFlQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU9BO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVlBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVNBO0FBQUE7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFPQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BY0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BUUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BdUJBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVVBO0FBQUEsTUFHQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWVBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFpQkE7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BT0E7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVdBO0FBQUEsSUFFTjtBQUVJLGVBQVcsS0FBSyxZQUFZO0FBQzFCLFlBQU0sSUFBSSxNQUFNLENBQUM7QUFBQSxJQUNuQjtBQUFBLEVBQ0YsR0FBRztBQUVILFNBQU87QUFDVDtBQU9BLGVBQXNCLEVBQUUsTUFBTSxTQUFTLENBQUMsR0FBRztBQUN6QyxRQUFNLGFBQWE7QUFDbkIsUUFBTSxNQUFNLE9BQU87QUFDbkIsUUFBTSxPQUFPLE1BQU0sSUFBSSxNQUFNLE1BQU0sTUFBTTtBQUN6QyxTQUFPLEVBQUUsTUFBTSxRQUFRLENBQUMsR0FBRyxVQUFVLE1BQU0sUUFBUSxJQUFJLElBQUksS0FBSyxTQUFTLEVBQUU7QUFDN0U7OztBQ25nQkEsU0FBUyxRQUFRLEdBQUcsTUFBTSxLQUFNO0FBQzlCLE1BQUksS0FBSyxLQUFNLFFBQU87QUFDdEIsUUFBTSxJQUFJLE9BQU8sQ0FBQztBQUNsQixNQUFJLEVBQUUsVUFBVSxJQUFLLFFBQU87QUFDNUIsU0FBTyxFQUFFLE1BQU0sR0FBRyxHQUFHLElBQUksV0FBTSxFQUFFLFNBQVMsR0FBRztBQUMvQztBQUVBLFNBQVMsV0FBVztBQUNsQixNQUFJO0FBQ0YsUUFBSSxXQUFXLFFBQVEsV0FBWSxRQUFPLFdBQVcsT0FBTyxXQUFXO0FBQUEsRUFDekUsUUFBUTtBQUFBLEVBQUM7QUFFVCxTQUFPLFNBQVMsS0FBSyxPQUFPLEVBQUUsU0FBUyxFQUFFLEVBQUUsTUFBTSxDQUFDLElBQUksTUFBTSxLQUFLLElBQUksRUFBRSxTQUFTLEVBQUU7QUFDcEY7QUFFTyxTQUFTLGFBQWEsS0FBSztBQUNoQyxRQUFNLEtBQUssSUFBSSxRQUFRLElBQUksb0JBQW9CLEtBQUssSUFBSSxRQUFRLElBQUksY0FBYyxLQUFLLElBQUksS0FBSztBQUNoRyxTQUFPLEtBQUssU0FBUztBQUN2QjtBQUVPLFNBQVMsa0JBQWtCLEtBQUs7QUFDckMsTUFBSTtBQUNGLFVBQU0sSUFBSSxJQUFJLElBQUksSUFBSSxHQUFHO0FBQ3pCLFVBQU0sSUFBSSxFQUFFLFNBQVMsTUFBTSxtQ0FBbUM7QUFDOUQsV0FBTyxJQUFJLEVBQUUsQ0FBQyxJQUFJO0FBQUEsRUFDcEIsUUFBUTtBQUNOLFdBQU87QUFBQSxFQUNUO0FBQ0Y7QUFFTyxTQUFTLFlBQVksS0FBSztBQUMvQixNQUFJLE1BQU07QUFDVixNQUFJO0FBQUUsVUFBTSxJQUFJLElBQUksSUFBSSxHQUFHO0FBQUEsRUFBRyxRQUFRO0FBQUEsRUFBQztBQUN2QyxTQUFPO0FBQUEsSUFDTCxRQUFRLElBQUksVUFBVTtBQUFBLElBQ3RCLE1BQU0sTUFBTSxJQUFJLFdBQVc7QUFBQSxJQUMzQixPQUFPLE1BQU0sT0FBTyxZQUFZLElBQUksYUFBYSxRQUFRLENBQUMsSUFBSSxDQUFDO0FBQUEsSUFDL0QsUUFBUSxJQUFJLFFBQVEsSUFBSSxRQUFRLEtBQUssSUFBSSxRQUFRLElBQUksUUFBUSxLQUFLO0FBQUEsSUFDbEUsU0FBUyxJQUFJLFFBQVEsSUFBSSxTQUFTLEtBQUssSUFBSSxRQUFRLElBQUksU0FBUyxLQUFLO0FBQUEsSUFDckUsWUFBWSxJQUFJLFFBQVEsSUFBSSxZQUFZLEtBQUs7QUFBQSxJQUM3QyxJQUFJLElBQUksUUFBUSxJQUFJLDJCQUEyQixLQUFLO0FBQUEsSUFDcEQsU0FBUyxJQUFJLFFBQVEsSUFBSSxhQUFhLEtBQUssSUFBSSxLQUFLLEtBQUs7QUFBQSxJQUN6RCxXQUFXLElBQUksUUFBUSxJQUFJLGVBQWUsS0FBSyxJQUFJLEtBQUssS0FBSztBQUFBLEVBQy9EO0FBQ0Y7QUFFTyxTQUFTLGVBQWUsS0FBSztBQUNsQyxRQUFNLElBQUksT0FBTyxDQUFDO0FBQ2xCLFNBQU87QUFBQSxJQUNMLE1BQU0sUUFBUSxFQUFFLE1BQU0sR0FBRztBQUFBLElBQ3pCLFNBQVMsUUFBUSxFQUFFLFNBQVMsR0FBSTtBQUFBLElBQ2hDLE1BQU0sUUFBUSxFQUFFLE1BQU0sR0FBRztBQUFBLElBQ3pCLFFBQVEsT0FBTyxTQUFTLEVBQUUsTUFBTSxJQUFJLEVBQUUsU0FBUztBQUFBLElBQy9DLE1BQU0sUUFBUSxFQUFFLE1BQU0sR0FBSTtBQUFBLElBQzFCLE9BQU8sUUFBUSxFQUFFLE9BQU8sSUFBSztBQUFBLElBQzdCLFVBQVUsRUFBRSxXQUFXO0FBQUEsTUFDckIsVUFBVSxRQUFRLEVBQUUsU0FBUyxVQUFVLEVBQUU7QUFBQSxNQUN6QyxRQUFRLE9BQU8sU0FBUyxFQUFFLFNBQVMsTUFBTSxJQUFJLEVBQUUsU0FBUyxTQUFTO0FBQUEsTUFDakUsTUFBTSxRQUFRLEVBQUUsU0FBUyxNQUFNLElBQUs7QUFBQSxNQUNwQyxZQUFZLFFBQVEsRUFBRSxTQUFTLFlBQVksR0FBRztBQUFBLE1BQzlDLGtCQUFrQixFQUFFLFNBQVMsb0JBQW9CO0FBQUEsSUFDbkQsSUFBSTtBQUFBLEVBQ047QUFDRjtBQThCQSxlQUFzQixVQUFVLElBQUk7QUFDbEMsTUFBSTtBQUNGLFVBQU0sSUFBSSxNQUFNLENBQUM7QUFDakIsVUFBTSxRQUFRLEVBQUUsU0FBUyxDQUFDO0FBQzFCLFVBQU07QUFBQSxNQUNKO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVFBO0FBQUEsUUFDRSxRQUFRLEVBQUUsWUFBWSxHQUFHO0FBQUEsUUFDekIsUUFBUSxFQUFFLFNBQVMsUUFBUSxFQUFFO0FBQUEsUUFDN0IsUUFBUSxFQUFFLFFBQVEsU0FBUyxFQUFFO0FBQUEsUUFDN0IsUUFBUSxFQUFFLGlCQUFpQixXQUFXLEdBQUc7QUFBQSxRQUN6QyxRQUFRLEVBQUUsUUFBUSxFQUFFO0FBQUEsUUFDcEIsUUFBUSxFQUFFLE1BQU0sR0FBRztBQUFBLFFBQ25CLFFBQVEsRUFBRSxRQUFRLEdBQUc7QUFBQSxRQUNyQixRQUFRLEVBQUUsU0FBUyxHQUFHO0FBQUEsUUFDdEIsUUFBUSxFQUFFLFlBQVksR0FBRztBQUFBLFFBQ3pCLFFBQVEsRUFBRSxJQUFJLEdBQUc7QUFBQSxRQUVqQixRQUFRLEVBQUUsUUFBUSxHQUFHO0FBQUEsUUFDckIsUUFBUSxFQUFFLFVBQVUsR0FBRztBQUFBLFFBQ3ZCLE9BQU8sU0FBUyxFQUFFLFdBQVcsSUFBSSxFQUFFLGNBQWM7QUFBQSxRQUNqRCxPQUFPLFNBQVMsRUFBRSxVQUFVLElBQUksRUFBRSxhQUFhO0FBQUEsUUFDL0MsUUFBUSxFQUFFLFVBQVUsRUFBRTtBQUFBLFFBQ3RCLFFBQVEsRUFBRSxPQUFPLEdBQUc7QUFBQSxRQUNwQixPQUFPLFNBQVMsRUFBRSxXQUFXLElBQUksRUFBRSxjQUFjO0FBQUEsUUFDakQsT0FBTyxTQUFTLEVBQUUsV0FBVyxJQUFJLEVBQUUsY0FBYztBQUFBLFFBRWpELFFBQVEsRUFBRSxZQUFZLEdBQUc7QUFBQSxRQUN6QixRQUFRLEVBQUUsZUFBZSxHQUFJO0FBQUEsUUFDN0IsUUFBUSxFQUFFLGFBQWEsSUFBSztBQUFBLFFBQzVCLE9BQU8sU0FBUyxFQUFFLGVBQWUsSUFBSSxFQUFFLGtCQUFrQjtBQUFBLFFBQ3pELFFBQVEsRUFBRSxlQUFlLElBQUs7QUFBQSxRQUM5QixLQUFLLFVBQVUsU0FBUyxDQUFDLENBQUM7QUFBQSxNQUM1QjtBQUFBLElBQ0Y7QUFBQSxFQUNGLFNBQVMsR0FBRztBQUNWLFlBQVEsS0FBSyx3QkFBd0IsR0FBRyxXQUFXLENBQUM7QUFBQSxFQUN0RDtBQUNGOzs7QUN6SUEsU0FBUyxlQUFlLEtBQUs7QUFDM0IsUUFBTSxTQUFTLEtBQUssVUFBVTtBQUM5QixRQUFNLE9BQU8sS0FBSyxRQUFRO0FBQzFCLFFBQU0sVUFBVSxLQUFLLFdBQVc7QUFDaEMsUUFBTSxPQUFPLEtBQUs7QUFDbEIsU0FBTyxFQUFFLFFBQVEsTUFBTSxFQUFFLE9BQU8sU0FBUyxNQUFNLEdBQUksT0FBTyxFQUFFLEtBQUssSUFBSSxDQUFDLEVBQUcsRUFBRTtBQUM3RTtBQUVBLFNBQVMsY0FBYyxLQUFLLFlBQVk7QUFDdEMsTUFBSTtBQUNGLFVBQU0sSUFBSSxJQUFJLFFBQVEsSUFBSSxXQUFXLENBQUMsQ0FBQztBQUN2QyxNQUFFLElBQUksc0JBQXNCLFVBQVU7QUFDdEMsV0FBTyxJQUFJLFNBQVMsSUFBSSxNQUFNLEVBQUUsUUFBUSxJQUFJLFFBQVEsU0FBUyxFQUFFLENBQUM7QUFBQSxFQUNsRSxRQUFRO0FBQ04sV0FBTztBQUFBLEVBQ1Q7QUFDRjtBQUVBLGVBQWUsZ0JBQWdCLEtBQUs7QUFDbEMsTUFBSTtBQUNGLFVBQU0sTUFBTSxJQUFJLFFBQVEsSUFBSSxjQUFjLEtBQUssSUFBSSxZQUFZO0FBQy9ELFVBQU0sUUFBUSxJQUFJLE1BQU07QUFDeEIsUUFBSSxHQUFHLFNBQVMsa0JBQWtCLEdBQUc7QUFDbkMsWUFBTSxPQUFPLE1BQU0sTUFBTSxLQUFLLEVBQUUsTUFBTSxNQUFNLElBQUk7QUFDaEQsYUFBTztBQUFBLElBQ1Q7QUFDQSxVQUFNLElBQUksTUFBTSxNQUFNLEtBQUssRUFBRSxNQUFNLE1BQU0sRUFBRTtBQUMzQyxRQUFJLE9BQU8sTUFBTSxZQUFZLEVBQUUsU0FBUyxLQUFPLFFBQU8sRUFBRSxNQUFNLEdBQUcsSUFBSyxJQUFJLFdBQU0sRUFBRSxTQUFTLElBQUs7QUFDaEcsV0FBTztBQUFBLEVBQ1QsUUFBUTtBQUNOLFdBQU87QUFBQSxFQUNUO0FBQ0Y7QUFFTyxTQUFTLEtBQUssU0FBUztBQUM1QixTQUFPLE9BQU8sS0FBSyxZQUFZO0FBQzdCLFVBQU0sUUFBUSxLQUFLLElBQUk7QUFDdkIsVUFBTSxPQUFPLFVBQVUsR0FBRztBQUMxQixVQUFNLGFBQWEsYUFBYSxHQUFHO0FBQ25DLFVBQU0sZ0JBQWdCLGtCQUFrQixHQUFHO0FBQzNDLFVBQU0sT0FBTyxZQUFZLEdBQUc7QUFFNUIsUUFBSTtBQUNGLFlBQU0sTUFBTSxNQUFNLFFBQVEsS0FBSyxNQUFNLE9BQU87QUFFNUMsWUFBTSxjQUFjLEtBQUssSUFBSSxJQUFJO0FBQ2pDLFlBQU0sTUFBTSxlQUFlLFdBQVcsY0FBYyxLQUFLLFVBQVUsSUFBSTtBQUV2RSxZQUFNLFNBQVMsZUFBZSxXQUFXLElBQUksU0FBUztBQUN0RCxZQUFNLFFBQVEsVUFBVSxNQUFNLFVBQVUsVUFBVSxNQUFNLFNBQVM7QUFDakUsWUFBTSxPQUFPLFVBQVUsTUFBTSx3QkFBd0I7QUFFckQsVUFBSSxRQUFRLENBQUM7QUFDYixVQUFJLFVBQVUsT0FBTyxlQUFlLFVBQVU7QUFDNUMsY0FBTSxXQUFXLE1BQU0sZ0JBQWdCLEdBQUc7QUFBQSxNQUM1QztBQUNBLFVBQUksZUFBZSxNQUFPO0FBQ3hCLGNBQU0sT0FBTztBQUFBLE1BQ2Y7QUFFQSxZQUFNLFVBQVU7QUFBQSxRQUNkO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQSxHQUFHO0FBQUEsUUFDSCxhQUFhO0FBQUEsUUFDYjtBQUFBLFFBQ0E7QUFBQSxNQUNGLENBQUM7QUFFRCxhQUFPO0FBQUEsSUFDVCxTQUFTLEtBQUs7QUFDWixZQUFNLGNBQWMsS0FBSyxJQUFJLElBQUk7QUFHakMsWUFBTSxNQUFNLGVBQWUsR0FBRztBQUM5QixZQUFNLFVBQVU7QUFBQSxRQUNkO0FBQUEsUUFDQSxPQUFPO0FBQUEsUUFDUCxNQUFNO0FBQUEsUUFDTjtBQUFBLFFBQ0EsR0FBRztBQUFBLFFBQ0gsVUFBVSxLQUFLLFVBQVUsWUFBWTtBQUFBLFFBQ3JDLGFBQWEsS0FBSyxVQUFVO0FBQUEsUUFDNUI7QUFBQSxRQUNBLFlBQVksS0FBSyxRQUFRO0FBQUEsUUFDekIsZUFBZSxLQUFLLFdBQVc7QUFBQSxRQUMvQixhQUFhLEtBQUssU0FBUztBQUFBLFFBQzNCLGlCQUFpQixLQUFLLFVBQVUsVUFBVTtBQUFBLFFBQzFDLGVBQWUsS0FBSyxVQUFVLFFBQVE7QUFBQSxRQUN0QyxPQUFPLEVBQUUsT0FBTyxJQUFJO0FBQUEsTUFDdEIsQ0FBQztBQUdELGNBQVEsTUFBTSxtQkFBbUIsR0FBRztBQUNwQyxZQUFNLEVBQUUsUUFBUSxLQUFLLElBQUksZUFBZSxHQUFHO0FBQzNDLGFBQU8sS0FBSyxRQUFRLEVBQUUsR0FBRyxNQUFNLFdBQVcsR0FBRyxFQUFFLEdBQUcsTUFBTSxzQkFBc0IsV0FBVyxDQUFDO0FBQUEsSUFDNUY7QUFBQSxFQUNGO0FBQ0Y7OztBQ3ZHQSxPQUFPLFFBQVE7QUFDZixPQUFPLFVBQVU7QUFFakIsSUFBSSxRQUFRO0FBRVosU0FBUyxjQUFjO0FBQ3JCLE1BQUksTUFBTyxRQUFPO0FBQ2xCLFFBQU0sSUFBSSxLQUFLLEtBQUssUUFBUSxJQUFJLEdBQUcsV0FBVyxjQUFjO0FBQzVELFFBQU0sTUFBTSxHQUFHLGFBQWEsR0FBRyxNQUFNO0FBQ3JDLFVBQVEsS0FBSyxNQUFNLEdBQUc7QUFDdEIsU0FBTztBQUNUO0FBRUEsU0FBUyxjQUFjLFVBQVUsT0FBTztBQUN0QyxRQUFNLE1BQU0sSUFBSSxNQUFNLG1CQUFtQixRQUFRLElBQUksS0FBSyxFQUFFO0FBQzVELE1BQUksT0FBTztBQUVYLE1BQUksU0FBUztBQUNiLE1BQUksT0FBTztBQUNYLFNBQU87QUFDVDtBQUVPLFNBQVMsVUFBVSxVQUFVLE9BQU8sYUFBYSxjQUFjO0FBQ3BFLFFBQU0sVUFBVSxZQUFZO0FBQzVCLFFBQU0sUUFBUSxVQUFVLFFBQVEsSUFBSSxLQUFLO0FBQ3pDLE1BQUksQ0FBQyxNQUFPLE9BQU0sY0FBYyxVQUFVLEtBQUs7QUFFL0MsUUFBTSxTQUFTLE9BQU8sTUFBTSxnQkFBZ0I7QUFDNUMsUUFBTSxVQUFVLE9BQU8sTUFBTSxpQkFBaUI7QUFHOUMsTUFBSSxDQUFDLE9BQU8sU0FBUyxNQUFNLEtBQUssQ0FBQyxPQUFPLFNBQVMsT0FBTyxFQUFHLE9BQU0sY0FBYyxVQUFVLEtBQUs7QUFFOUYsUUFBTSxRQUFTLE9BQU8sZUFBZSxDQUFDLElBQUksTUFBYTtBQUN2RCxRQUFNLFNBQVUsT0FBTyxnQkFBZ0IsQ0FBQyxJQUFJLE1BQWE7QUFDekQsUUFBTSxXQUFXLFFBQVE7QUFFekIsU0FBTyxLQUFLLElBQUksR0FBRyxLQUFLLE1BQU0sV0FBVyxHQUFHLENBQUM7QUFDL0M7OztBQ3BDQSxTQUFTLFlBQVksU0FBUyxNQUFNO0FBQ2xDLFFBQU0sTUFBTSxJQUFJLE1BQU0sT0FBTztBQUM3QixNQUFJLE9BQU87QUFDWCxNQUFJLFNBQVM7QUFDYixNQUFJLEtBQU0sS0FBSSxPQUFPO0FBQ3JCLFNBQU87QUFDVDtBQUdBLFNBQVMsZUFBZSxHQUFHLE1BQU0sTUFBTztBQUN0QyxNQUFJO0FBQ0YsVUFBTSxJQUFJLE9BQU8sTUFBTSxXQUFXLElBQUksS0FBSyxVQUFVLENBQUM7QUFDdEQsUUFBSSxDQUFDLEVBQUcsUUFBTztBQUNmLFFBQUksRUFBRSxVQUFVLElBQUssUUFBTztBQUM1QixXQUFPLEVBQUUsTUFBTSxHQUFHLEdBQUcsSUFBSSxXQUFNLEVBQUUsU0FBUyxHQUFHO0FBQUEsRUFDL0MsUUFBUTtBQUNOLFVBQU0sSUFBSSxPQUFPLEtBQUssRUFBRTtBQUN4QixRQUFJLEVBQUUsVUFBVSxJQUFLLFFBQU87QUFDNUIsV0FBTyxFQUFFLE1BQU0sR0FBRyxHQUFHLElBQUksV0FBTSxFQUFFLFNBQVMsR0FBRztBQUFBLEVBQy9DO0FBQ0Y7QUFFQSxTQUFTLGNBQWMsVUFBVSxLQUFLLE1BQU07QUFDMUMsUUFBTSxTQUFTLEtBQUssVUFBVTtBQUM5QixRQUFNLFFBQ0osS0FBSyxTQUFTLE1BQU0sY0FBYyxLQUNsQyxLQUFLLFNBQVMsTUFBTSxZQUFZLEtBQ2hDLEtBQUssU0FBUyxNQUFNLGtCQUFrQixLQUN0QztBQUdGLE1BQUksTUFBTTtBQUNWLE1BQUk7QUFDRixVQUFNLE1BQU0sT0FBTyxXQUFXLE1BQU0sT0FBTyxRQUFRLE1BQU0sV0FBVztBQUFBLEVBQ3RFLFFBQVE7QUFBQSxFQUFDO0FBQ1QsUUFBTSxNQUFNLElBQUksTUFBTSxNQUFNLEdBQUcsUUFBUSxtQkFBbUIsTUFBTSxLQUFLLEdBQUcsS0FBSyxHQUFHLFFBQVEsbUJBQW1CLE1BQU0sRUFBRTtBQUNuSCxNQUFJLE9BQU87QUFDWCxNQUFJLFNBQVM7QUFDYixNQUFJLFdBQVc7QUFBQSxJQUNiO0FBQUEsSUFDQTtBQUFBLElBQ0EsWUFBWTtBQUFBLElBQ1osTUFBTSxlQUFlLElBQUk7QUFBQSxFQUMzQjtBQUNBLFNBQU87QUFDVDtBQUtBLGVBQXNCLFdBQVcsRUFBRSxPQUFPLFVBQVUsWUFBWSxZQUFZLEdBQUc7QUFDN0UsUUFBTSxTQUFTLFFBQVEsSUFBSTtBQUMzQixNQUFJLENBQUMsT0FBUSxPQUFNLFlBQVksaUNBQWlDLDZHQUFtRztBQUVuSyxRQUFNLFFBQVEsTUFBTSxRQUFRLFFBQVEsSUFBSSxTQUFTLElBQUksUUFBTTtBQUFBLElBQ3pELE1BQU0sRUFBRTtBQUFBLElBQ1IsU0FBUyxDQUFDLEVBQUUsTUFBTSxjQUFjLE1BQU0sT0FBTyxFQUFFLFdBQVcsRUFBRSxFQUFFLENBQUM7QUFBQSxFQUNqRSxFQUFFLElBQUksQ0FBQztBQUVQLFFBQU0sT0FBTztBQUFBLElBQ1g7QUFBQSxJQUNBO0FBQUEsSUFDQSxhQUFhLE9BQU8sZ0JBQWdCLFdBQVcsY0FBYztBQUFBLElBQzdELG1CQUFtQixPQUFPLGVBQWUsV0FBVyxhQUFhO0FBQUEsSUFDakUsT0FBTztBQUFBLEVBQ1Q7QUFFQSxRQUFNLE1BQU0sTUFBTSxNQUFNLHVDQUF1QztBQUFBLElBQzdELFFBQVE7QUFBQSxJQUNSLFNBQVM7QUFBQSxNQUNQLGlCQUFpQixVQUFVLE1BQU07QUFBQSxNQUNqQyxnQkFBZ0I7QUFBQSxJQUNsQjtBQUFBLElBQ0EsTUFBTSxLQUFLLFVBQVUsSUFBSTtBQUFBLEVBQzNCLENBQUM7QUFFRCxRQUFNLE9BQU8sTUFBTSxJQUFJLEtBQUssRUFBRSxNQUFNLE9BQU0sQ0FBQyxFQUFFO0FBQzdDLE1BQUksQ0FBQyxJQUFJLEdBQUksT0FBTSxjQUFjLFVBQVUsS0FBSyxJQUFJO0FBRXBELE1BQUksTUFBTTtBQUNWLFFBQU0sU0FBUyxNQUFNLFFBQVEsS0FBSyxNQUFNLElBQUksS0FBSyxTQUFTLENBQUM7QUFDM0QsYUFBVyxRQUFRLFFBQVE7QUFDekIsUUFBSSxNQUFNLFNBQVMsYUFBYSxNQUFNLFFBQVEsS0FBSyxPQUFPLEdBQUc7QUFDM0QsaUJBQVcsS0FBSyxLQUFLLFNBQVM7QUFDNUIsWUFBSSxHQUFHLFNBQVMsaUJBQWlCLE9BQU8sRUFBRSxTQUFTLFNBQVUsUUFBTyxFQUFFO0FBQUEsTUFDeEU7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUVBLFFBQU0sUUFBUSxLQUFLLFNBQVMsQ0FBQztBQUM3QixTQUFPLEVBQUUsYUFBYSxLQUFLLGNBQWMsTUFBTSxnQkFBZ0IsR0FBRyxlQUFlLE1BQU0saUJBQWlCLEdBQUcsS0FBSyxLQUFLO0FBQ3ZIO0FBRUEsZUFBc0IsY0FBYyxFQUFFLE9BQU8sVUFBVSxZQUFZLFlBQVksR0FBRztBQUNoRixRQUFNLFNBQVMsUUFBUSxJQUFJO0FBQzNCLE1BQUksQ0FBQyxPQUFRLE9BQU0sWUFBWSxvQ0FBb0MsbUhBQXlHO0FBRTVLLFFBQU0sY0FBYyxDQUFDO0FBQ3JCLFFBQU0sVUFBVSxDQUFDO0FBRWpCLFFBQU0sT0FBTyxNQUFNLFFBQVEsUUFBUSxJQUFJLFdBQVcsQ0FBQztBQUNuRCxhQUFXLEtBQUssTUFBTTtBQUNwQixVQUFNLE9BQU8sT0FBTyxFQUFFLFFBQVEsRUFBRSxFQUFFLFlBQVk7QUFDOUMsVUFBTUEsUUFBTyxPQUFPLEVBQUUsV0FBVyxFQUFFO0FBQ25DLFFBQUksQ0FBQ0EsTUFBTTtBQUNYLFFBQUksU0FBUyxZQUFZLFNBQVMsWUFBYSxhQUFZLEtBQUtBLEtBQUk7QUFBQSxhQUMzRCxTQUFTLFlBQWEsU0FBUSxLQUFLLEVBQUUsTUFBTSxhQUFhLFNBQVNBLE1BQUssQ0FBQztBQUFBLFFBQzNFLFNBQVEsS0FBSyxFQUFFLE1BQU0sUUFBUSxTQUFTQSxNQUFLLENBQUM7QUFBQSxFQUNuRDtBQUVBLFFBQU0sT0FBTztBQUFBLElBQ1g7QUFBQSxJQUNBLFlBQVksT0FBTyxlQUFlLFdBQVcsYUFBYTtBQUFBLElBQzFELGFBQWEsT0FBTyxnQkFBZ0IsV0FBVyxjQUFjO0FBQUEsSUFDN0QsVUFBVTtBQUFBLEVBQ1o7QUFDQSxNQUFJLFlBQVksT0FBUSxNQUFLLFNBQVMsWUFBWSxLQUFLLE1BQU07QUFFL0QsUUFBTSxNQUFNLE1BQU0sTUFBTSx5Q0FBeUM7QUFBQSxJQUM3RCxRQUFRO0FBQUEsSUFDUixTQUFTO0FBQUEsTUFDUCxhQUFhO0FBQUEsTUFDYixxQkFBcUI7QUFBQSxNQUNyQixnQkFBZ0I7QUFBQSxJQUNsQjtBQUFBLElBQ0EsTUFBTSxLQUFLLFVBQVUsSUFBSTtBQUFBLEVBQzNCLENBQUM7QUFFRCxRQUFNLE9BQU8sTUFBTSxJQUFJLEtBQUssRUFBRSxNQUFNLE9BQU0sQ0FBQyxFQUFFO0FBQzdDLE1BQUksQ0FBQyxJQUFJLEdBQUksT0FBTSxjQUFjLGFBQWEsS0FBSyxJQUFJO0FBRXZELFFBQU0sT0FBTyxNQUFNLFFBQVEsTUFBTSxPQUFPLElBQUksS0FBSyxRQUFRLElBQUksT0FBSyxHQUFHLFFBQVEsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFLLE1BQU0sVUFBVSxDQUFDLEdBQUcsUUFBUSxNQUFNLGNBQWM7QUFDN0ksUUFBTSxRQUFRLE1BQU0sU0FBUyxDQUFDO0FBQzlCLFNBQU8sRUFBRSxhQUFhLE1BQU0sY0FBYyxNQUFNLGdCQUFnQixHQUFHLGVBQWUsTUFBTSxpQkFBaUIsR0FBRyxLQUFLLEtBQUs7QUFDeEg7QUFFQSxlQUFzQixXQUFXLEVBQUUsT0FBTyxVQUFVLFlBQVksWUFBWSxHQUFHO0FBQzdFLFFBQU0sWUFBWSxRQUFRLElBQUksd0JBQXdCLFFBQVEsSUFBSTtBQUNsRSxRQUFNLFNBQVMsT0FBTyxhQUFhLEVBQUUsRUFDbEMsS0FBSyxFQUNMLFFBQVEsWUFBWSxJQUFJLEVBQ3hCLEtBQUs7QUFDUixNQUFJLENBQUMsT0FBUSxPQUFNLFlBQVksaUNBQWlDLGdJQUFzSDtBQUV0TCxRQUFNLGNBQWMsQ0FBQztBQUNyQixRQUFNLFdBQVcsQ0FBQztBQUVsQixRQUFNLE9BQU8sTUFBTSxRQUFRLFFBQVEsSUFBSSxXQUFXLENBQUM7QUFDbkQsYUFBVyxLQUFLLE1BQU07QUFDcEIsVUFBTSxPQUFPLEVBQUU7QUFDZixVQUFNLE9BQU8sT0FBTyxFQUFFLFdBQVcsRUFBRTtBQUNuQyxRQUFJLFNBQVMsU0FBVSxhQUFZLEtBQUssSUFBSTtBQUFBLGFBQ25DLFNBQVMsWUFBYSxVQUFTLEtBQUssRUFBRSxNQUFNLFNBQVMsT0FBTyxDQUFDLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQztBQUFBLFFBQzVFLFVBQVMsS0FBSyxFQUFFLE1BQU0sUUFBUSxPQUFPLENBQUMsRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDO0FBQUEsRUFDeEQ7QUFFQSxRQUFNLE9BQU87QUFBQSxJQUNYO0FBQUEsSUFDQSxrQkFBa0I7QUFBQSxNQUNoQixpQkFBaUIsT0FBTyxlQUFlLFdBQVcsYUFBYTtBQUFBLE1BQy9ELGFBQWEsT0FBTyxnQkFBZ0IsV0FBVyxjQUFjO0FBQUEsSUFDL0Q7QUFBQSxFQUNGO0FBQ0EsTUFBSSxZQUFZLE9BQVEsTUFBSyxvQkFBb0IsRUFBRSxPQUFPLENBQUMsRUFBRSxNQUFNLFlBQVksS0FBSyxNQUFNLEVBQUUsQ0FBQyxFQUFFO0FBRS9GLFFBQU0sTUFBTSwyREFBMkQsbUJBQW1CLEtBQUssQ0FBQztBQUNoRyxRQUFNLE1BQU0sTUFBTSxNQUFNLEtBQUs7QUFBQSxJQUMzQixRQUFRO0FBQUEsSUFDUixTQUFTLEVBQUUsa0JBQWtCLFFBQVEsZ0JBQWdCLG1CQUFtQjtBQUFBLElBQ3hFLE1BQU0sS0FBSyxVQUFVLElBQUk7QUFBQSxFQUMzQixDQUFDO0FBRUQsUUFBTSxPQUFPLE1BQU0sSUFBSSxLQUFLLEVBQUUsTUFBTSxPQUFNLENBQUMsRUFBRTtBQUM3QyxNQUFJLENBQUMsSUFBSSxHQUFJLE9BQU0sY0FBYyxVQUFVLEtBQUssSUFBSTtBQUVwRCxNQUFJLE1BQU07QUFDVixRQUFNLGFBQWEsTUFBTSxRQUFRLEtBQUssVUFBVSxJQUFJLEtBQUssYUFBYSxDQUFDO0FBQ3ZFLGFBQVcsUUFBUSxZQUFZO0FBQzdCLFVBQU0sVUFBVSxNQUFNO0FBQ3RCLFFBQUksU0FBUztBQUFPLGlCQUFXLEtBQUssUUFBUSxNQUFPLEtBQUksT0FBTyxFQUFFLFNBQVMsU0FBVSxRQUFPLEVBQUU7QUFBQTtBQUM1RixRQUFJLElBQUs7QUFBQSxFQUNYO0FBRUEsUUFBTSxRQUFRLEtBQUssaUJBQWlCLENBQUM7QUFDckMsU0FBTyxFQUFFLGFBQWEsS0FBSyxjQUFjLE1BQU0sb0JBQW9CLEdBQUcsZUFBZSxNQUFNLHdCQUF3QixHQUFHLEtBQUssS0FBSztBQUNsSTs7O0FDM0xBLE9BQU8sWUFBWTtBQUVuQixTQUFTQyxhQUFZLFNBQVMsTUFBTTtBQUNsQyxRQUFNLE1BQU0sSUFBSSxNQUFNLE9BQU87QUFDN0IsTUFBSSxPQUFPO0FBQ1gsTUFBSSxTQUFTO0FBQ2IsTUFBSSxLQUFNLEtBQUksT0FBTztBQUNyQixTQUFPO0FBQ1Q7QUFFQSxTQUFTLFVBQVUsT0FBTztBQUN4QixTQUFPLE9BQU8sS0FBSyxLQUFLLEVBQ3JCLFNBQVMsUUFBUSxFQUNqQixRQUFRLE1BQU0sRUFBRSxFQUNoQixRQUFRLE9BQU8sR0FBRyxFQUNsQixRQUFRLE9BQU8sR0FBRztBQUN2QjtBQXVETyxTQUFTLFVBQVUsT0FBTztBQUMvQixTQUFPLE9BQU8sV0FBVyxRQUFRLEVBQUUsT0FBTyxLQUFLLEVBQUUsT0FBTyxLQUFLO0FBQy9EO0FBRU8sU0FBUyxjQUFjLFFBQVEsT0FBTztBQUMzQyxTQUFPLE9BQU8sV0FBVyxVQUFVLE1BQU0sRUFBRSxPQUFPLEtBQUssRUFBRSxPQUFPLEtBQUs7QUFDdkU7QUFVTyxTQUFTLFdBQVcsT0FBTztBQUNoQyxRQUFNLFNBQVMsUUFBUSxJQUFJO0FBQzNCLE1BQUksT0FBUSxRQUFPLGNBQWMsUUFBUSxLQUFLO0FBQzlDLFNBQU8sVUFBVSxLQUFLO0FBQ3hCO0FBRU8sU0FBUyxpQkFBaUIsT0FBTztBQUN0QyxTQUFPLFVBQVUsS0FBSztBQUN4QjtBQXVCTyxTQUFTLFVBQVUsT0FBTztBQUMvQixRQUFNLFNBQVMsUUFBUSxJQUFJO0FBQzNCLE1BQUksQ0FBQyxRQUFRO0FBQ1gsVUFBTUM7QUFBQSxNQUNKO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBRUEsUUFBTSxRQUFRLE1BQU0sTUFBTSxHQUFHO0FBQzdCLE1BQUksTUFBTSxXQUFXLEVBQUcsUUFBTztBQUUvQixRQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSTtBQUNsQixRQUFNLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQztBQUN0QixRQUFNLFdBQVcsVUFBVSxPQUFPLFdBQVcsVUFBVSxNQUFNLEVBQUUsT0FBTyxJQUFJLEVBQUUsT0FBTyxDQUFDO0FBRXBGLE1BQUk7QUFDRixVQUFNLElBQUksT0FBTyxLQUFLLFFBQVE7QUFDOUIsVUFBTSxJQUFJLE9BQU8sS0FBSyxDQUFDO0FBQ3ZCLFFBQUksRUFBRSxXQUFXLEVBQUUsT0FBUSxRQUFPO0FBQ2xDLFFBQUksQ0FBQyxPQUFPLGdCQUFnQixHQUFHLENBQUMsRUFBRyxRQUFPO0FBQUEsRUFDNUMsUUFBUTtBQUNOLFdBQU87QUFBQSxFQUNUO0FBRUEsTUFBSTtBQUNGLFVBQU0sVUFBVSxLQUFLO0FBQUEsTUFDbkIsT0FBTyxLQUFLLEVBQUUsUUFBUSxNQUFNLEdBQUcsRUFBRSxRQUFRLE1BQU0sR0FBRyxHQUFHLFFBQVEsRUFBRSxTQUFTLE9BQU87QUFBQSxJQUNqRjtBQUNBLFVBQU0sTUFBTSxLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksR0FBSTtBQUN4QyxRQUFJLFFBQVEsT0FBTyxNQUFNLFFBQVEsSUFBSyxRQUFPO0FBQzdDLFdBQU87QUFBQSxFQUNULFFBQVE7QUFDTixXQUFPO0FBQUEsRUFDVDtBQUNGOzs7QUNySkEsU0FBUyxhQUFhO0FBQ3BCLFNBQU87QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBU1Q7QUFFQSxlQUFzQixVQUFVLFVBQVU7QUFFeEMsUUFBTSxZQUFZLFdBQVcsUUFBUTtBQUNyQyxNQUFJLFNBQVMsTUFBTTtBQUFBLElBQ2pCLEdBQUcsV0FBVyxDQUFDO0FBQUE7QUFBQTtBQUFBLElBR2YsQ0FBQyxTQUFTO0FBQUEsRUFDWjtBQUNBLE1BQUksT0FBTyxTQUFVLFFBQU8sT0FBTyxLQUFLLENBQUM7QUFHekMsTUFBSSxRQUFRLElBQUksWUFBWTtBQUMxQixVQUFNLFNBQVMsaUJBQWlCLFFBQVE7QUFDeEMsYUFBUyxNQUFNO0FBQUEsTUFDYixHQUFHLFdBQVcsQ0FBQztBQUFBO0FBQUE7QUFBQSxNQUdmLENBQUMsTUFBTTtBQUFBLElBQ1Q7QUFDQSxRQUFJLENBQUMsT0FBTyxTQUFVLFFBQU87QUFFN0IsVUFBTSxNQUFNLE9BQU8sS0FBSyxDQUFDO0FBQ3pCLFFBQUk7QUFDRixZQUFNO0FBQUEsUUFDSjtBQUFBO0FBQUEsUUFFQSxDQUFDLFdBQVcsSUFBSSxZQUFZLE1BQU07QUFBQSxNQUNwQztBQUFBLElBQ0YsUUFBUTtBQUFBLElBRVI7QUFFQSxXQUFPO0FBQUEsRUFDVDtBQUVBLFNBQU87QUFDVDtBQUVBLGVBQXNCLGNBQWMsWUFBWTtBQUM5QyxRQUFNLFNBQVMsTUFBTTtBQUFBLElBQ25CLEdBQUcsV0FBVyxDQUFDO0FBQUE7QUFBQTtBQUFBLElBR2YsQ0FBQyxVQUFVO0FBQUEsRUFDYjtBQUNBLE1BQUksQ0FBQyxPQUFPLFNBQVUsUUFBTztBQUM3QixTQUFPLE9BQU8sS0FBSyxDQUFDO0FBQ3RCO0FBUUEsZUFBc0IsWUFBWSxPQUFPO0FBQ3ZDLE1BQUksQ0FBQyxNQUFPLFFBQU87QUFHbkIsUUFBTSxRQUFRLE1BQU0sTUFBTSxHQUFHO0FBQzdCLE1BQUksTUFBTSxXQUFXLEdBQUc7QUFDdEIsVUFBTSxVQUFVLFVBQVUsS0FBSztBQUMvQixRQUFJLENBQUMsUUFBUyxRQUFPO0FBQ3JCLFFBQUksUUFBUSxTQUFTLGVBQWdCLFFBQU87QUFFNUMsVUFBTSxNQUFNLE1BQU0sY0FBYyxRQUFRLFVBQVU7QUFDbEQsV0FBTztBQUFBLEVBQ1Q7QUFFQSxTQUFPLE1BQU0sVUFBVSxLQUFLO0FBQzlCO0FBRUEsZUFBc0IsZUFBZSxhQUFhLFFBQVEsWUFBWSxHQUFHO0FBQ3ZFLFFBQU0sT0FBTyxNQUFNO0FBQUEsSUFDakI7QUFBQTtBQUFBLElBRUEsQ0FBQyxhQUFhLEtBQUs7QUFBQSxFQUNyQjtBQUNBLE1BQUksS0FBSyxhQUFhLEVBQUcsUUFBTyxFQUFFLGFBQWEsR0FBRyxhQUFhLEdBQUcsY0FBYyxHQUFHLGVBQWUsRUFBRTtBQUNwRyxTQUFPLEtBQUssS0FBSyxDQUFDO0FBQ3BCO0FBRUEsZUFBc0Isa0JBQWtCLFlBQVksUUFBUSxZQUFZLEdBQUc7QUFDekUsUUFBTSxPQUFPLE1BQU07QUFBQSxJQUNqQjtBQUFBO0FBQUEsSUFFQSxDQUFDLFlBQVksS0FBSztBQUFBLEVBQ3BCO0FBQ0EsTUFBSSxLQUFLLFNBQVUsUUFBTyxLQUFLLEtBQUssQ0FBQztBQUdyQyxRQUFNLFVBQVUsTUFBTSxFQUFFLGdEQUFnRCxDQUFDLFVBQVUsQ0FBQztBQUNwRixRQUFNLGNBQWMsUUFBUSxXQUFXLFFBQVEsS0FBSyxDQUFDLEVBQUUsY0FBYztBQUVyRSxRQUFNLE1BQU0sTUFBTTtBQUFBLElBQ2hCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBTUEsQ0FBQyxZQUFZLEtBQUs7QUFBQSxFQUNwQjtBQUVBLFFBQU0sTUFBTSxJQUFJLEtBQUssQ0FBQyxLQUFLLEVBQUUsYUFBYSxHQUFHLGNBQWMsR0FBRyxlQUFlLEdBQUcsT0FBTyxFQUFFO0FBRXpGLE1BQUksZUFBZSxNQUFNO0FBQ3ZCLFVBQU07QUFBQSxNQUNKO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BU0EsQ0FBQyxZQUFZLGFBQWEsT0FBTyxJQUFJLGVBQWUsR0FBRyxJQUFJLGdCQUFnQixHQUFHLElBQUksaUJBQWlCLEdBQUcsSUFBSSxTQUFTLENBQUM7QUFBQSxJQUN0SDtBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQ1Q7QUFRTyxTQUFTLGlCQUFpQixRQUFRLGdCQUFnQjtBQUN2RCxRQUFNLE9BQU8sT0FBTyxzQkFBc0I7QUFDMUMsUUFBTSxRQUFRLGVBQWUsZUFBZTtBQUM1QyxTQUFPLE9BQU87QUFDaEI7QUFFTyxTQUFTLFlBQVksUUFBUSxnQkFBZ0I7QUFFbEQsTUFBSSxPQUFPLGlCQUFpQixLQUFNLFFBQU8sT0FBTztBQUNoRCxTQUFPLGlCQUFpQixRQUFRLGNBQWM7QUFDaEQ7OztBQzNKQSxJQUFJLFdBQVc7QUFDZixJQUFNLGtCQUFrQixvQkFBSSxJQUFJO0FBRWhDLGVBQWUsY0FBYztBQUMzQixRQUFNLE1BQU0sUUFBUSxJQUFJO0FBQ3hCLFFBQU0sUUFBUSxRQUFRLElBQUk7QUFDMUIsTUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFPLFFBQU87QUFFM0IsTUFBSSxTQUFVLFFBQU87QUFFckIsUUFBTSxDQUFDLEVBQUUsVUFBVSxHQUFHLEVBQUUsTUFBTSxDQUFDLElBQUksTUFBTSxRQUFRLElBQUk7QUFBQSxJQUNuRCxPQUFPLG9CQUFvQjtBQUFBLElBQzNCLE9BQU8sZ0JBQWdCO0FBQUEsRUFDekIsQ0FBQztBQUVELGFBQVcsRUFBRSxXQUFXLE1BQU07QUFDOUIsU0FBTztBQUNUO0FBRUEsU0FBUyxTQUFTLE9BQU87QUFDdkIsTUFBSSxDQUFDLE1BQU8sUUFBTztBQUNuQixNQUFJLE9BQU8sVUFBVSxTQUFVLFFBQU8sSUFBSSxLQUFLLEtBQUssRUFBRSxZQUFZO0FBQ2xFLE1BQUksaUJBQWlCLEtBQU0sUUFBTyxNQUFNLFlBQVk7QUFDcEQsTUFBSSxPQUFPLFVBQVUsU0FBVSxRQUFPO0FBQ3RDLE1BQUk7QUFDRixRQUFJLE9BQU8sT0FBTyxZQUFZLFdBQVksUUFBTyxJQUFJLEtBQUssTUFBTSxRQUFRLENBQUMsRUFBRSxZQUFZO0FBQUEsRUFDekYsUUFBUTtBQUFBLEVBQUM7QUFDVCxTQUFPO0FBQ1Q7QUFTQSxlQUFzQixXQUFXLEVBQUUsWUFBWSxVQUFVLFlBQVksR0FBRztBQUN0RSxRQUFNLGFBQWEsU0FBUyxRQUFRLElBQUkscUJBQXFCLE9BQU8sRUFBRTtBQUN0RSxRQUFNLFFBQVEsT0FBTyxTQUFTLFdBQVcsSUFBSSxjQUFjO0FBRTNELE1BQUksQ0FBQyxPQUFPLFNBQVMsS0FBSyxLQUFLLFNBQVMsR0FBRztBQUN6QyxXQUFPLEVBQUUsSUFBSSxNQUFNLFdBQVcsTUFBTSxPQUFPLE1BQU0sTUFBTSxNQUFNO0FBQUEsRUFDL0Q7QUFFQSxRQUFNLEtBQUssTUFBTSxZQUFZO0FBQzdCLE1BQUksSUFBSTtBQUNOLFFBQUksQ0FBQyxnQkFBZ0IsSUFBSSxLQUFLLEdBQUc7QUFDL0IsWUFBTSxRQUFRLEdBQUcsTUFBTSxRQUFRO0FBQy9CLFlBQU0sS0FBSyxJQUFJLEdBQUcsVUFBVTtBQUFBLFFBQzFCO0FBQUEsUUFDQSxTQUFTLEdBQUcsVUFBVSxjQUFjLE9BQU8sTUFBTTtBQUFBLFFBQ2pELFFBQVE7QUFBQSxNQUNWLENBQUM7QUFDRCxzQkFBZ0IsSUFBSSxPQUFPLEVBQUU7QUFBQSxJQUMvQjtBQUVBLFVBQU0sVUFBVSxnQkFBZ0IsSUFBSSxLQUFLO0FBQ3pDLFVBQU0sTUFBTSxJQUFJLFVBQVUsS0FBSyxRQUFRO0FBQ3ZDLFVBQU1DLE9BQU0sTUFBTSxRQUFRLE1BQU0sR0FBRztBQUVuQyxXQUFPO0FBQUEsTUFDTCxJQUFJLENBQUMsQ0FBQ0EsS0FBSTtBQUFBLE1BQ1YsV0FBV0EsS0FBSSxhQUFhO0FBQUEsTUFDNUIsT0FBTyxTQUFTQSxLQUFJLEtBQUs7QUFBQSxNQUN6QixNQUFNO0FBQUEsSUFDUjtBQUFBLEVBQ0Y7QUFHQSxRQUFNLE1BQU0sS0FBSyxJQUFJO0FBQ3JCLFFBQU0sV0FBVztBQUNqQixRQUFNLGNBQWMsSUFBSSxLQUFLLEtBQUssTUFBTSxNQUFNLFFBQVEsSUFBSSxRQUFRO0FBQ2xFLFFBQU0sUUFBUSxJQUFJLEtBQUssWUFBWSxRQUFRLElBQUksUUFBUTtBQUV2RCxRQUFNLE1BQU0sTUFBTTtBQUFBLElBQ2hCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUtBLENBQUMsWUFBWSxVQUFVLFdBQVc7QUFBQSxFQUNwQztBQUVBLFFBQU0sUUFBUSxJQUFJLE9BQU8sQ0FBQyxHQUFHLFNBQVM7QUFDdEMsUUFBTSxZQUFZLEtBQUssSUFBSSxHQUFHLFFBQVEsS0FBSztBQUUzQyxNQUFJLEtBQUssT0FBTyxJQUFJLE1BQU07QUFDeEIsUUFBSTtBQUNGLFlBQU0sRUFBRSxnRkFBZ0Y7QUFBQSxJQUMxRixRQUFRO0FBQUEsSUFBQztBQUFBLEVBQ1g7QUFFQSxTQUFPO0FBQUEsSUFDTCxJQUFJLFNBQVM7QUFBQSxJQUNiO0FBQUEsSUFDQSxPQUFPLE1BQU0sWUFBWTtBQUFBLElBQ3pCLE1BQU07QUFBQSxFQUNSO0FBQ0Y7OztBQ25HQSxTQUFTLElBQUksT0FBTyxLQUFLO0FBQ3ZCLE1BQUksQ0FBQyxPQUFPLE9BQU8sRUFBRyxRQUFPO0FBQzdCLFNBQVEsUUFBUSxNQUFPO0FBQ3pCO0FBRUEsZUFBZSxXQUFXLEVBQUUsYUFBYSxhQUFhLEdBQUcsT0FBTyxXQUFXLEdBQUc7QUFDNUUsUUFBTSxNQUFNLE1BQU07QUFBQSxJQUNoQjtBQUFBO0FBQUE7QUFBQTtBQUFBLElBSUEsQ0FBQyxhQUFhLGNBQWMsR0FBRyxPQUFPLFVBQVU7QUFBQSxFQUNsRDtBQUNBLFNBQU8sSUFBSSxXQUFXO0FBQ3hCO0FBRUEsZUFBZSxZQUFZLFNBQVM7QUFDbEMsUUFBTSxNQUFNLFFBQVEsSUFBSTtBQUN4QixNQUFJLENBQUMsSUFBSztBQUdWLE1BQUk7QUFDRixVQUFNLE1BQU0sS0FBSztBQUFBLE1BQ2YsUUFBUTtBQUFBLE1BQ1IsU0FBUyxFQUFFLGdCQUFnQixtQkFBbUI7QUFBQSxNQUM5QyxNQUFNLEtBQUssVUFBVSxPQUFPO0FBQUEsSUFDOUIsQ0FBQztBQUFBLEVBQ0gsUUFBUTtBQUFBLEVBRVI7QUFDRjtBQU1BLGVBQXNCLGVBQWU7QUFBQSxFQUNuQztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUNGLEdBQUc7QUFDRCxRQUFNLFVBQVUsV0FBVyxRQUFRLElBQUksZ0JBQWdCLElBQUk7QUFFM0QsUUFBTSxRQUFRLElBQUksd0JBQXdCLEdBQUcsc0JBQXNCLENBQUM7QUFDcEUsUUFBTSxPQUFPLElBQUksbUJBQW1CLEdBQUcsaUJBQWlCLENBQUM7QUFHekQsTUFBSSxTQUFTLFdBQVcsUUFBUSxLQUFLO0FBQ25DLFVBQU0sS0FBSyxNQUFNLFdBQVcsRUFBRSxhQUFhLFlBQVksR0FBRyxPQUFPLFlBQVksb0JBQW9CLENBQUM7QUFDbEcsUUFBSSxJQUFJO0FBQ04sWUFBTSxZQUFZO0FBQUEsUUFDaEIsTUFBTTtBQUFBLFFBQ047QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBLEtBQUs7QUFBQSxNQUNQLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRjtBQUdBLE1BQUksUUFBUSxXQUFXLE9BQU8sS0FBSztBQUNqQyxVQUFNLEtBQUssTUFBTSxXQUFXLEVBQUUsYUFBYSxZQUFZLGNBQWMsR0FBRyxPQUFPLFlBQVksZUFBZSxDQUFDO0FBQzNHLFFBQUksSUFBSTtBQUNOLFlBQU0sWUFBWTtBQUFBLFFBQ2hCLE1BQU07QUFBQSxRQUNOO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0EsS0FBSztBQUFBLE1BQ1AsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQ0Y7OztBQ3pFQSxlQUFzQixjQUFjLEVBQUUsUUFBUSxZQUFZLElBQUksUUFBUSxVQUFVLEdBQUc7QUFDakYsUUFBTSxpQkFBaUIsQ0FBQyxFQUFFLE9BQU8sc0JBQXNCLE9BQU87QUFDOUQsUUFBTSxjQUFjLE9BQU8sU0FBUyxPQUFPLFdBQVcsSUFBSSxPQUFPLGNBQWMsVUFBVSxPQUFPLFNBQVMsT0FBTyw0QkFBNEIsSUFBSSxPQUFPLCtCQUErQjtBQUV0TCxPQUFLLGtCQUFtQixjQUFjLFFBQVEsYUFBYSxNQUFPLENBQUMsWUFBWTtBQUM3RSxXQUFPLEVBQUUsSUFBSSxPQUFPLFFBQVEsS0FBSyxPQUFPLHFEQUFxRDtBQUFBLEVBQy9GO0FBR0EsTUFBSSxDQUFDLFdBQVksUUFBTyxFQUFFLElBQUksS0FBSztBQUduQyxRQUFNLFdBQVcsTUFBTTtBQUFBLElBQ3JCO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFJQSxDQUFDLE9BQU8sWUFBWSxVQUFVO0FBQUEsRUFDaEM7QUFFQSxNQUFJLFNBQVMsVUFBVTtBQUNyQixVQUFNLE1BQU0sU0FBUyxLQUFLLENBQUM7QUFDM0IsUUFBSSxJQUFJLFlBQVk7QUFDbEIsYUFBTyxFQUFFLElBQUksT0FBTyxRQUFRLEtBQUssT0FBTyw4QkFBOEI7QUFBQSxJQUN4RTtBQUVBLFVBQU07QUFBQSxNQUNKO0FBQUE7QUFBQSxNQUVBLENBQUMsT0FBTyxZQUFZLFlBQVksTUFBTSxJQUFJO0FBQUEsSUFDNUM7QUFDQSxXQUFPLEVBQUUsSUFBSSxLQUFLO0FBQUEsRUFDcEI7QUFHQSxNQUFJLGNBQWMsUUFBUSxhQUFhLEdBQUc7QUFDeEMsVUFBTSxjQUFjLE1BQU07QUFBQSxNQUN4QjtBQUFBO0FBQUE7QUFBQSxNQUdBLENBQUMsT0FBTyxVQUFVO0FBQUEsSUFDcEI7QUFDQSxVQUFNLElBQUksWUFBWSxPQUFPLENBQUMsR0FBRyxLQUFLO0FBQ3RDLFFBQUksS0FBSyxZQUFZO0FBQ25CLGFBQU8sRUFBRSxJQUFJLE9BQU8sUUFBUSxLQUFLLE9BQU8seUJBQXlCLENBQUMsSUFBSSxVQUFVLDBDQUEwQztBQUFBLElBQzVIO0FBQUEsRUFDRjtBQUdBLFFBQU07QUFBQSxJQUNKO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFJQSxDQUFDLE9BQU8sWUFBWSxPQUFPLGFBQWEsWUFBWSxNQUFNLElBQUk7QUFBQSxFQUNoRTtBQUVBLFNBQU8sRUFBRSxJQUFJLEtBQUs7QUFDcEI7OztBQ25FQSxTQUFTLFVBQVUsR0FBRztBQUNwQixNQUFJLENBQUMsRUFBRyxRQUFPO0FBQ2YsTUFBSSxNQUFNLFFBQVEsQ0FBQyxFQUFHLFFBQU8sRUFBRSxJQUFJLE1BQU0sRUFBRSxJQUFJLE9BQUcsRUFBRSxLQUFLLENBQUMsRUFBRSxPQUFPLE9BQU87QUFDMUUsTUFBSSxPQUFPLE1BQU0sU0FBVSxRQUFPLEVBQUUsTUFBTSxHQUFHLEVBQUUsSUFBSSxPQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsT0FBTyxPQUFPO0FBQzlFLFNBQU87QUFDVDtBQVFBLFNBQVMsbUJBQW1CLEdBQUc7QUFDN0IsTUFBSSxDQUFDLEVBQUcsUUFBTztBQUNmLE1BQUksT0FBTyxNQUFNLFNBQVUsUUFBTztBQUNsQyxNQUFJO0FBQUUsV0FBTyxLQUFLLE1BQU0sT0FBTyxDQUFDLENBQUM7QUFBQSxFQUFHLFFBQVE7QUFBRSxXQUFPO0FBQUEsRUFBTTtBQUM3RDtBQUVPLFNBQVMsbUJBQW1CLFFBQVE7QUFDekMsUUFBTSxZQUFZLFVBQVUsT0FBTyxpQkFBaUIsS0FBSyxVQUFVLE9BQU8sMEJBQTBCO0FBQ3BHLFFBQU0sU0FBUyxtQkFBbUIsT0FBTyxjQUFjLEtBQUssbUJBQW1CLE9BQU8sdUJBQXVCO0FBQzdHLFNBQU8sRUFBRSxXQUFXLE9BQU87QUFDN0I7QUFFTyxTQUFTLGNBQWMsRUFBRSxVQUFVLE9BQU8sT0FBTyxHQUFHO0FBQ3pELFFBQU0sRUFBRSxXQUFXLE9BQU8sSUFBSSxtQkFBbUIsTUFBTTtBQUV2RCxNQUFJLGFBQWEsVUFBVSxRQUFRO0FBQ2pDLFFBQUksQ0FBQyxVQUFVLFNBQVMsR0FBRyxLQUFLLENBQUMsVUFBVSxTQUFTLFFBQVEsR0FBRztBQUM3RCxhQUFPLEVBQUUsSUFBSSxPQUFPLFFBQVEsS0FBSyxPQUFPLHNDQUFzQyxRQUFRLElBQUk7QUFBQSxJQUM1RjtBQUFBLEVBQ0Y7QUFFQSxNQUFJLFFBQVE7QUFFVixRQUFJLE9BQU8sR0FBRyxHQUFHO0FBQ2YsWUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLENBQUM7QUFDakMsVUFBSSxPQUFPLElBQUksU0FBUyxHQUFHLEVBQUcsUUFBTyxFQUFFLElBQUksS0FBSztBQUFBLElBQ2xEO0FBRUEsVUFBTSxPQUFPLE9BQU8sUUFBUTtBQUM1QixRQUFJLE1BQU07QUFDUixZQUFNLE1BQU0sVUFBVSxJQUFJLEtBQUssQ0FBQztBQUNoQyxVQUFJLElBQUksU0FBUyxHQUFHLEVBQUcsUUFBTyxFQUFFLElBQUksS0FBSztBQUN6QyxVQUFJLENBQUMsSUFBSSxTQUFTLEtBQUssR0FBRztBQUN4QixlQUFPLEVBQUUsSUFBSSxPQUFPLFFBQVEsS0FBSyxPQUFPLG1DQUFtQyxRQUFRLElBQUksS0FBSyxJQUFJO0FBQUEsTUFDbEc7QUFBQSxJQUNGLE9BQU87QUFFTCxhQUFPLEVBQUUsSUFBSSxPQUFPLFFBQVEsS0FBSyxPQUFPLDRDQUE0QyxRQUFRLElBQUk7QUFBQSxJQUNsRztBQUFBLEVBQ0Y7QUFFQSxTQUFPLEVBQUUsSUFBSSxLQUFLO0FBQ3BCOzs7QUNoRE8sSUFBTSxlQUFlO0FBRXJCLElBQU0sb0JBQW9CLFVBQVUsWUFBWTtBQUVoRCxTQUFTLHFCQUFxQixVQUFVO0FBQzdDLFFBQU0sT0FBTyxNQUFNLFFBQVEsUUFBUSxJQUFJLFdBQVcsQ0FBQztBQUNuRCxRQUFNLFVBQVUsS0FDYixPQUFPLE9BQUssS0FBSyxPQUFPLE1BQU0sUUFBUSxFQUN0QyxJQUFJLFFBQU0sRUFBRSxNQUFNLE9BQU8sRUFBRSxRQUFRLEVBQUUsRUFBRSxZQUFZLEdBQUcsU0FBUyxPQUFPLEVBQUUsV0FBVyxFQUFFLEVBQUUsRUFBRSxFQUN6RixPQUFPLE9BQUssRUFBRSxRQUFRLEVBQUUsUUFBUSxNQUFNO0FBR3pDLFFBQU0sZUFBZSxRQUFRLE9BQU8sT0FBSyxFQUFFLEVBQUUsU0FBUyxZQUFZLEVBQUUsUUFBUSxTQUFTLHdDQUFtQyxFQUFFO0FBRTFILFFBQU0sU0FBUyxDQUFDLEVBQUUsTUFBTSxVQUFVLFNBQVMsYUFBYSxDQUFDO0FBQ3pELFNBQU8sT0FBTyxPQUFPLFlBQVk7QUFDbkM7OztBQ1ZBLElBQU8sdUJBQVEsS0FBSyxPQUFPLFFBQVE7QUFDakMsUUFBTSxPQUFPLFVBQVUsR0FBRztBQUMxQixNQUFJLElBQUksV0FBVyxVQUFXLFFBQU8sSUFBSSxTQUFTLElBQUksRUFBRSxRQUFRLEtBQUssU0FBUyxLQUFLLENBQUM7QUFDcEYsTUFBSSxJQUFJLFdBQVcsT0FBUSxRQUFPLEtBQUssS0FBSyxFQUFFLE9BQU8scUJBQXFCLEdBQUcsSUFBSTtBQUVqRixRQUFNLFFBQVEsVUFBVSxHQUFHO0FBQzNCLE1BQUksQ0FBQyxNQUFPLFFBQU8sS0FBSyxLQUFLLEVBQUUsT0FBTyw4Q0FBOEMsR0FBRyxJQUFJO0FBRTNGLE1BQUk7QUFDSixNQUFJO0FBQUUsV0FBTyxNQUFNLElBQUksS0FBSztBQUFBLEVBQUcsUUFBUTtBQUFFLFdBQU8sV0FBVyxnQkFBZ0IsSUFBSTtBQUFBLEVBQUc7QUFFbEYsUUFBTSxZQUFZLEtBQUssWUFBWSxJQUFJLFNBQVMsRUFBRSxLQUFLLEVBQUUsWUFBWTtBQUNyRSxRQUFNLFNBQVMsS0FBSyxTQUFTLElBQUksU0FBUyxFQUFFLEtBQUs7QUFDakQsUUFBTSxjQUFjLEtBQUs7QUFDekIsUUFBTSxhQUFhLE9BQU8sU0FBUyxLQUFLLFVBQVUsSUFBSSxTQUFTLEtBQUssWUFBWSxFQUFFLElBQUk7QUFDdEYsUUFBTSxjQUFjLE9BQU8sU0FBUyxLQUFLLFdBQVcsSUFBSSxLQUFLLGNBQWM7QUFFM0UsTUFBSSxDQUFDLFNBQVUsUUFBTyxXQUFXLDhDQUE4QyxJQUFJO0FBQ25GLE1BQUksQ0FBQyxNQUFPLFFBQU8sV0FBVyxpQkFBaUIsSUFBSTtBQUNuRCxNQUFJLENBQUMsTUFBTSxRQUFRLFdBQVcsS0FBSyxZQUFZLFdBQVcsRUFBRyxRQUFPLFdBQVcsc0JBQXNCLElBQUk7QUFFekcsUUFBTSxXQUFXLHFCQUFxQixXQUFXO0FBR2pELFFBQU0sU0FBUyxNQUFNLFlBQVksS0FBSztBQUN0QyxNQUFJLENBQUMsT0FBUSxRQUFPLEtBQUssS0FBSyxFQUFFLE9BQU8seUJBQXlCLEdBQUcsSUFBSTtBQUN2RSxNQUFJLENBQUMsT0FBTyxVQUFXLFFBQU8sS0FBSyxLQUFLLEVBQUUsT0FBTyxvQkFBb0IsR0FBRyxJQUFJO0FBRTVFLFFBQU0sYUFBYSxhQUFhLEdBQUc7QUFDbkMsUUFBTSxLQUFLLGFBQWEsR0FBRztBQUMzQixRQUFNLEtBQUssWUFBWSxHQUFHO0FBQzFCLFFBQU0sVUFBVSxLQUFLLGNBQWMsUUFBUSxJQUFJLGNBQWMsUUFBUSxJQUFJLGNBQWMsU0FBUyxFQUFFLElBQUk7QUFFdEcsUUFBTSxRQUFRLGNBQWMsRUFBRSxVQUFVLE9BQU8sT0FBTyxDQUFDO0FBQ3ZELE1BQUksQ0FBQyxNQUFNLEdBQUksUUFBTyxLQUFLLE1BQU0sVUFBVSxLQUFLLEVBQUUsT0FBTyxNQUFNLE1BQU0sR0FBRyxJQUFJO0FBRTVFLFFBQU0sTUFBTSxNQUFNLGNBQWMsRUFBRSxRQUFRLFlBQVksSUFBSSxPQUFPLFVBQVUsQ0FBQztBQUM1RSxNQUFJLENBQUMsSUFBSSxHQUFJLFFBQU8sS0FBSyxJQUFJLFVBQVUsS0FBSyxFQUFFLE9BQU8sSUFBSSxNQUFNLEdBQUcsSUFBSTtBQUl0RSxRQUFNLEtBQUssTUFBTSxXQUFXLEVBQUUsWUFBWSxPQUFPLGFBQWEsVUFBVSxPQUFPLFlBQVksYUFBYSxPQUFPLFVBQVUsQ0FBQztBQUMxSCxNQUFJLENBQUMsR0FBRyxJQUFJO0FBQ1YsV0FBTyxLQUFLLEtBQUssRUFBRSxPQUFPLHVCQUF1QixXQUFXLEVBQUUsV0FBVyxHQUFHLFdBQVcsT0FBTyxHQUFHLE1BQU0sRUFBRSxHQUFHLElBQUk7QUFBQSxFQUNsSDtBQUVBLFFBQU0sUUFBUSxZQUFZO0FBQzFCLFFBQU0sV0FBVyxNQUFNLGVBQWUsT0FBTyxhQUFhLEtBQUs7QUFDL0QsUUFBTSxVQUFVLE1BQU0sa0JBQWtCLE9BQU8sWUFBWSxLQUFLO0FBRWhFLFFBQU0scUJBQXFCLGlCQUFpQixRQUFRLFFBQVE7QUFDNUQsUUFBTSxnQkFBZ0IsWUFBWSxRQUFRLFFBQVE7QUFFbEQsT0FBSyxTQUFTLGVBQWUsTUFBTSxvQkFBb0I7QUFDckQsV0FBTyxLQUFLLEtBQUs7QUFBQSxNQUNmLE9BQU87QUFBQSxNQUNQLE9BQU87QUFBQSxNQUNQLE9BQU87QUFBQSxRQUNMO0FBQUEsUUFDQSxXQUFXO0FBQUEsUUFDWCxhQUFhLFNBQVMsZUFBZTtBQUFBLFFBQ3JDO0FBQUEsUUFDQSxzQkFBc0IsU0FBUyxlQUFlO0FBQUEsUUFDOUM7QUFBQSxRQUNBLGlCQUFpQixRQUFRLGVBQWU7QUFBQSxNQUMxQztBQUFBLElBQ0YsR0FBRyxJQUFJO0FBQUEsRUFDVDtBQUVBLE9BQUssUUFBUSxlQUFlLE1BQU0sZUFBZTtBQUMvQyxXQUFPLEtBQUssS0FBSztBQUFBLE1BQ2YsT0FBTztBQUFBLE1BQ1AsT0FBTztBQUFBLE1BQ1AsT0FBTztBQUFBLFFBQ0w7QUFBQSxRQUNBLFdBQVc7QUFBQSxRQUNYLGFBQWEsU0FBUyxlQUFlO0FBQUEsUUFDckM7QUFBQSxRQUNBLHNCQUFzQixTQUFTLGVBQWU7QUFBQSxRQUM5QztBQUFBLFFBQ0EsaUJBQWlCLFFBQVEsZUFBZTtBQUFBLE1BQzFDO0FBQUEsSUFDRixHQUFHLElBQUk7QUFBQSxFQUNUO0FBRUEsTUFBSTtBQUNKLE1BQUk7QUFDRixRQUFJLGFBQWEsU0FBVSxVQUFTLE1BQU0sV0FBVyxFQUFFLE9BQU8sVUFBVSxZQUFZLFlBQVksQ0FBQztBQUFBLGFBQ3hGLGFBQWEsWUFBYSxVQUFTLE1BQU0sY0FBYyxFQUFFLE9BQU8sVUFBVSxZQUFZLFlBQVksQ0FBQztBQUFBLGFBQ25HLGFBQWEsU0FBVSxVQUFTLE1BQU0sV0FBVyxFQUFFLE9BQU8sVUFBVSxZQUFZLFlBQVksQ0FBQztBQUFBLFFBQ2pHLFFBQU8sV0FBVyxrREFBa0QsSUFBSTtBQUFBLEVBQy9FLFNBQVMsR0FBRztBQUNWLFdBQU8sS0FBSyxLQUFLLEVBQUUsT0FBTyxHQUFHLFdBQVcsa0JBQWtCLFNBQVMsR0FBRyxJQUFJO0FBQUEsRUFDNUU7QUFFQSxRQUFNLGVBQWUsT0FBTyxnQkFBZ0I7QUFDNUMsUUFBTSxnQkFBZ0IsT0FBTyxpQkFBaUI7QUFDOUMsUUFBTSxhQUFhLFVBQVUsVUFBVSxPQUFPLGNBQWMsYUFBYTtBQUV6RSxRQUFNO0FBQUEsSUFDSjtBQUFBO0FBQUEsSUFFQSxDQUFDLE9BQU8sYUFBYSxPQUFPLFlBQVksVUFBVSxPQUFPLGNBQWMsZUFBZSxZQUFZLFlBQVksU0FBUyxFQUFFO0FBQUEsRUFDM0g7QUFFQSxRQUFNO0FBQUEsSUFDSjtBQUFBO0FBQUE7QUFBQTtBQUFBLElBSUEsQ0FBQyxZQUFZLE9BQU8sVUFBVTtBQUFBLEVBQ2hDO0FBRUEsUUFBTTtBQUFBLElBQ0o7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBUUEsQ0FBQyxPQUFPLGFBQWEsT0FBTyxZQUFZLGNBQWMsYUFBYTtBQUFBLEVBQ3JFO0FBRUEsUUFBTTtBQUFBLElBQ0o7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFTQSxDQUFDLE9BQU8sWUFBWSxPQUFPLGFBQWEsT0FBTyxZQUFZLGNBQWMsZUFBZSxDQUFDO0FBQUEsRUFDM0Y7QUFFQSxRQUFNLGNBQWMsTUFBTSxlQUFlLE9BQU8sYUFBYSxLQUFLO0FBQ2xFLFFBQU0sYUFBYSxNQUFNLGtCQUFrQixPQUFPLFlBQVksS0FBSztBQUVuRSxRQUFNLDJCQUEyQixpQkFBaUIsUUFBUSxXQUFXO0FBQ3JFLFFBQU0sc0JBQXNCLFlBQVksUUFBUSxXQUFXO0FBRzNELFFBQU0sZUFBZTtBQUFBLElBQ25CLGFBQWEsT0FBTztBQUFBLElBQ3BCLFlBQVksT0FBTztBQUFBLElBQ25CO0FBQUEsSUFDQSxvQkFBb0I7QUFBQSxJQUNwQixzQkFBc0IsWUFBWSxlQUFlO0FBQUEsSUFDakQsZUFBZTtBQUFBLElBQ2YsaUJBQWlCLFdBQVcsZUFBZTtBQUFBLEVBQzdDLENBQUM7QUFFRCxTQUFPLEtBQUssS0FBSztBQUFBLElBQ2Y7QUFBQSxJQUNBO0FBQUEsSUFDQSxhQUFhLE9BQU8sZUFBZTtBQUFBLElBQ25DLE9BQU8sRUFBRSxjQUFjLGVBQWUsV0FBVztBQUFBLElBQ2pELE9BQU87QUFBQSxNQUNMO0FBQUEsTUFDQSxXQUFXO0FBQUEsTUFDWCxhQUFhLFlBQVksZUFBZTtBQUFBLE1BQ3hDLG9CQUFvQjtBQUFBLE1BQ3BCLHNCQUFzQixZQUFZLGVBQWU7QUFBQSxNQUNqRCxlQUFlO0FBQUEsTUFDZixpQkFBaUIsV0FBVyxlQUFlO0FBQUEsSUFDN0M7QUFBQSxJQUNBLFdBQVcsRUFBRSxZQUFZLGNBQWMsS0FBSztBQUFBLEVBQzlDLEdBQUcsSUFBSTtBQUNULENBQUM7IiwKICAibmFtZXMiOiBbInRleHQiLCAiY29uZmlnRXJyb3IiLCAiY29uZmlnRXJyb3IiLCAicmVzIl0KfQo=
