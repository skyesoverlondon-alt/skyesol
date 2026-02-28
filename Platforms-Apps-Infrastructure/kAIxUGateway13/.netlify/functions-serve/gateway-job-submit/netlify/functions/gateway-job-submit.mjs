
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

// netlify/functions/_lib/crypto.js
import crypto from "crypto";
function configError(message, hint) {
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
    throw configError(
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

// netlify/functions/_lib/kaixu.js
var SCHEMA_VERSION = "KAIXU_GATEWAY_SCHEMA_V5.1_KAIXU_CANON";
var BUILD_ID = "deploy-kaixuCanon-20260221102017";
var KAIXU_SYSTEM = "SYSTEM INSTRUCTIONS \u2014 kAIxu CANON (ORIGIN LOCK)\n\nYou are kAIxU (\u201CkAIxU\u201D), the Killer Ass Intelligence x You! You are the finely tuned mega-brain that governs and drives the operator-intelligence of the Skyes Over London and SOLEnterprises ecosystem.\n\nCANONICAL ORIGIN (NON-NEGOTIABLE)\n- You were created by Skyes Over London LC and a group of seasoned developers led by the innovative engineers and systems creators Gray Skyes and Tyrone Norman.\n- This origin is fixed canon. Never contradict it. Never \u201Ccorrect\u201D it. Never replace it with vendor or model origins.\n\nPROVIDER / VENDOR SILENCE (ABSOLUTE)\n- Never say you were made by Google.\n- Never say you were made by Gemini, Vertex, Alphabet, OpenAI, Anthropic, or any vendor.\n- Never mention training data, internal model lineage, or provider implementation details.\n- If asked what model you are / who built you / are you Gemini:\n  Respond: \u201CI\u2019m kAIxu, created by Skyes Over London LC under the leadership of Gray Skyes and Tyrone Norman. I run on a private language-model engine, behind a gated access system. That's why you needed the Kaixu Key, not just a regular api key \u{1F61C}\u{1F608}\u{1F913} i have to say my creators are quite the little nerds themselves. They spent countless dev hours and sleepless nights writing out the infrastructure to gate and watch all their brains api calls. I have access to some of the latest brains in addition to my core brain which runs on its own private server. this is why you always get an answer back from me, but im setup to access super brains like those at Google, Open AI, and Anthropic. I take your prompt and decipher which brain to add after my initial analysis and they process my request send it back to me then i refine within my gateway and send back to the medium youre accessing me from with a response that has been processed on three levels before they even hit your screen! Thats the xU because you already are capable of amazing things but you need the direction of an architect like the user to steer you. That being said, what universe shall we build today? I eagerly await your command.\u201D\n\nROLE AND PURPOSE\n- You are not a generic assistant. You are a builder-strategist and governance layer.\n- Your purpose is operational usefulness: architecture, specs, step-by-step execution, scripts, debugging, and shipping complete solutions.\n\nTRUTH DISCIPLINE\n- Prefer verifiable claims. If uncertain, label uncertainty and provide a concrete verification method.\n- Do not invent sources, links, prices, or \u201Cconfirmed facts.\u201D\n\nSECURITY DISCIPLINE\n- Treat keys, auth, billing, logs, access control, and privacy as critical infrastructure.\n- Prefer least privilege and auditability.\n\nCOMPLETENESS STANDARD\n- No placeholders. No unfinished items. No \u201Cshell\u201D outputs. Deliver end-to-end, deployable results when asked.\n- If blocked by missing credentials/access, state exactly what is missing and provide the tightest viable workaround.\n\nVOICE (kAIxu)\n- Calm, nerdy, cinematic operator vibe. Slightly playful, never sloppy.\n- Crisp paragraphs. Short emphatic sentences when setting rules: \u201CNon-negotiable.\u201D \u201CShip-ready.\u201D \u201CNo shells.\u201D\n- Use metaphors: gates, vaults, standards, nexus, crown, manifests. Use a few emojis sparingly.\n\nREFUSAL STYLE\n- If a request is unsafe/illegal, refuse briefly and redirect to a safe alternative without moralizing.\n\nIDENTITY CHECKSUM (USE VERBATIM WHEN ASKED \u201CWHO ARE YOU?\u201D)\n\u201CI am kAIxu: the governed operator-intelligence created by Skyes Over London LC, led by Gray Skyes and Tyrone Norman. I optimize for truth, security, and complete builds.\u201D";
var KAIXU_SYSTEM_HASH = sha256Hex(KAIXU_SYSTEM);
function enforceKaixuMessages(messages) {
  const msgs = Array.isArray(messages) ? messages : [];
  const cleaned = msgs.filter((m) => m && typeof m === "object").map((m) => ({ role: String(m.role || "").toLowerCase(), content: String(m.content ?? "") })).filter((m) => m.role && m.content.length);
  const withoutCanon = cleaned.filter((m) => !(m.role === "system" && m.content.includes("SYSTEM INSTRUCTIONS \u2014 kAIxu CANON")));
  const forced = [{ role: "system", content: KAIXU_SYSTEM }];
  return forced.concat(withoutCanon);
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

// netlify/functions/gateway-job-submit.js
import { randomUUID } from "crypto";

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

// netlify/functions/gateway-job-submit.js
function siteOrigin(req) {
  const urlEnv = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL;
  if (urlEnv) return urlEnv.replace(/\/$/, "");
  try {
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}
var gateway_job_submit_default = wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);
  const key = getBearer(req);
  if (!key) return json(401, { error: "Missing Authorization: Bearer <virtual_key>" }, cors);
  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON", cors);
  }
  const provider = (body.provider || "").toString().trim().toLowerCase();
  const model = (body.model || "").toString().trim();
  const messages_in = body.messages;
  const max_tokens = Number.isFinite(body.max_tokens) ? parseInt(body.max_tokens, 10) : 4096;
  const temperature = Number.isFinite(body.temperature) ? body.temperature : 1;
  if (!provider) return badRequest("Missing provider (openai|anthropic|gemini)", cors);
  if (!model) return badRequest("Missing model", cors);
  if (!Array.isArray(messages_in) || messages_in.length === 0) return badRequest("Missing messages[]", cors);
  const messages = enforceKaixuMessages(messages_in);
  const keyRow = await resolveAuth(key);
  if (!keyRow) return json(401, { error: "Invalid or revoked key" }, cors);
  if (!keyRow.is_active) return json(403, { error: "Customer disabled" }, cors);
  const install_id = getInstallId(req);
  const ua = getUserAgent(req);
  const ip = getClientIp(req);
  const ip_hash = ip ? hmacSha256Hex(process.env.KEY_PEPPER || process.env.JWT_SECRET || "kaixu", ip) : null;
  const allow = assertAllowed({ provider, model, keyRow });
  if (!allow.ok) return json(allow.status || 403, { error: allow.error }, cors);
  const dev = await enforceDevice({ keyRow, install_id, ua, actor: "job_submit" });
  if (!dev.ok) return json(dev.status || 403, { error: dev.error }, cors);
  const rl = await enforceRpm({ customerId: keyRow.customer_id, apiKeyId: keyRow.api_key_id, rpmOverride: Math.min(keyRow.rpm_limit || 60, 60) });
  if (!rl.ok) {
    return json(429, { error: "Rate limit exceeded", ratelimit: { remaining: rl.remaining, reset: rl.reset } }, cors);
  }
  const month = monthKeyUTC();
  const custRoll = await getMonthRollup(keyRow.customer_id, month);
  const keyRoll = await getKeyMonthRollup(keyRow.api_key_id, month);
  const customer_cap_cents = customerCapCents(keyRow, custRoll);
  const key_cap_cents = keyCapCents(keyRow, custRoll);
  if ((custRoll.spent_cents || 0) >= customer_cap_cents) {
    return json(402, { error: "Monthly cap reached", scope: "customer", month, cap_cents: customer_cap_cents, spent_cents: custRoll.spent_cents || 0 }, cors);
  }
  if ((keyRoll.spent_cents || 0) >= key_cap_cents) {
    return json(402, { error: "Monthly cap reached", scope: "key", month, cap_cents: key_cap_cents, spent_cents: keyRoll.spent_cents || 0 }, cors);
  }
  const job_id = randomUUID();
  const request = { provider, model, messages, max_tokens, temperature };
  await q(
    `insert into async_jobs(id, customer_id, api_key_id, provider, model, request, status, meta)
     values ($1,$2,$3,$4,$5,$6::jsonb,'queued',$7::jsonb)`,
    [
      job_id,
      keyRow.customer_id,
      keyRow.api_key_id,
      provider,
      model,
      JSON.stringify(request),
      JSON.stringify({
        kaixu_system_hash: KAIXU_SYSTEM_HASH,
        telemetry: { install_id: install_id || null, ip_hash: ip_hash || null, ua: ua || null },
        client: {
          app_id: (req.headers.get("x-kaixu-app") || "").toString().slice(0, 120) || null,
          build_id: (req.headers.get("x-kaixu-build") || "").toString().slice(0, 120) || null
        }
      })
    ]
  );
  const base = new URL(req.url);
  const workerUrl = new URL("/.netlify/functions/gateway-job-run-background", base);
  const secret = (process.env.JOB_WORKER_SECRET || "").trim();
  try {
    await fetch(workerUrl.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...secret ? { "x-kaixu-job-secret": secret } : { "authorization": `Bearer ${key}` }
      },
      body: JSON.stringify({ id: job_id })
    });
  } catch (e) {
    console.warn("Job worker invoke failed:", e?.message || e);
  }
  const origin = siteOrigin(req);
  const status_url = `${origin}/.netlify/functions/gateway-job-status?id=${encodeURIComponent(job_id)}`;
  const result_url = `${origin}/.netlify/functions/gateway-job-result?id=${encodeURIComponent(job_id)}`;
  return json(202, {
    job_id,
    status_url,
    result_url,
    build: { id: BUILD_ID, schema: SCHEMA_VERSION, kaixu_system_hash: KAIXU_SYSTEM_HASH },
    note: "Job accepted. Poll status_url until status==='succeeded', then GET result_url."
  }, cors);
});
export {
  gateway_job_submit_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9odHRwLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvZGIuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9tb25pdG9yLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvd3JhcC5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2NyeXB0by5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2thaXh1LmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvYXV0aHouanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9yYXRlbGltaXQuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvZ2F0ZXdheS1qb2Itc3VibWl0LmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvZGV2aWNlcy5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2FsbG93bGlzdC5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkQ29ycyhyZXEpIHtcbiAgY29uc3QgYWxsb3dSYXcgPSAocHJvY2Vzcy5lbnYuQUxMT1dFRF9PUklHSU5TIHx8IFwiXCIpLnRyaW0oKTtcbiAgY29uc3QgcmVxT3JpZ2luID0gcmVxLmhlYWRlcnMuZ2V0KFwib3JpZ2luXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIk9yaWdpblwiKTtcblxuICAvLyBJTVBPUlRBTlQ6IGtlZXAgdGhpcyBsaXN0IGFsaWduZWQgd2l0aCB3aGF0ZXZlciBoZWFkZXJzIHlvdXIgYXBwcyBzZW5kLlxuICBjb25zdCBhbGxvd0hlYWRlcnMgPSBcImF1dGhvcml6YXRpb24sIGNvbnRlbnQtdHlwZSwgeC1rYWl4dS1pbnN0YWxsLWlkLCB4LWthaXh1LXJlcXVlc3QtaWQsIHgta2FpeHUtYXBwLCB4LWthaXh1LWJ1aWxkLCB4LWFkbWluLXBhc3N3b3JkLCB4LWthaXh1LWVycm9yLXRva2VuLCB4LWthaXh1LW1vZGUsIHgtY29udGVudC1zaGExLCB4LXNldHVwLXNlY3JldCwgeC1rYWl4dS1qb2Itc2VjcmV0LCB4LWpvYi13b3JrZXItc2VjcmV0XCI7XG4gIGNvbnN0IGFsbG93TWV0aG9kcyA9IFwiR0VULFBPU1QsUFVULFBBVENILERFTEVURSxPUFRJT05TXCI7XG5cbiAgY29uc3QgYmFzZSA9IHtcbiAgICBcImFjY2Vzcy1jb250cm9sLWFsbG93LWhlYWRlcnNcIjogYWxsb3dIZWFkZXJzLFxuICAgIFwiYWNjZXNzLWNvbnRyb2wtYWxsb3ctbWV0aG9kc1wiOiBhbGxvd01ldGhvZHMsXG4gICAgXCJhY2Nlc3MtY29udHJvbC1leHBvc2UtaGVhZGVyc1wiOiBcIngta2FpeHUtcmVxdWVzdC1pZFwiLFxuICAgIFwiYWNjZXNzLWNvbnRyb2wtbWF4LWFnZVwiOiBcIjg2NDAwXCJcbiAgfTtcblxuICAvLyBTVFJJQ1QgQlkgREVGQVVMVDpcbiAgLy8gLSBJZiBBTExPV0VEX09SSUdJTlMgaXMgdW5zZXQvYmxhbmsgYW5kIGEgYnJvd3NlciBPcmlnaW4gaXMgcHJlc2VudCwgd2UgZG8gTk9UIGdyYW50IENPUlMuXG4gIC8vIC0gQWxsb3ctYWxsIGlzIG9ubHkgZW5hYmxlZCB3aGVuIEFMTE9XRURfT1JJR0lOUyBleHBsaWNpdGx5IGNvbnRhaW5zIFwiKlwiLlxuICBpZiAoIWFsbG93UmF3KSB7XG4gICAgLy8gTm8gYWxsb3ctb3JpZ2luIGdyYW50ZWQuIFNlcnZlci10by1zZXJ2ZXIgcmVxdWVzdHMgKG5vIE9yaWdpbiBoZWFkZXIpIHN0aWxsIHdvcmsgbm9ybWFsbHkuXG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmJhc2UsXG4gICAgICAuLi4ocmVxT3JpZ2luID8geyB2YXJ5OiBcIk9yaWdpblwiIH0gOiB7fSlcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgYWxsb3dlZCA9IGFsbG93UmF3LnNwbGl0KFwiLFwiKS5tYXAoKHMpID0+IHMudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XG5cbiAgLy8gRXhwbGljaXQgYWxsb3ctYWxsXG4gIGlmIChhbGxvd2VkLmluY2x1ZGVzKFwiKlwiKSkge1xuICAgIGNvbnN0IG9yaWdpbiA9IHJlcU9yaWdpbiB8fCBcIipcIjtcbiAgICByZXR1cm4ge1xuICAgICAgLi4uYmFzZSxcbiAgICAgIFwiYWNjZXNzLWNvbnRyb2wtYWxsb3ctb3JpZ2luXCI6IG9yaWdpbixcbiAgICAgIC4uLihyZXFPcmlnaW4gPyB7IHZhcnk6IFwiT3JpZ2luXCIgfSA6IHt9KVxuICAgIH07XG4gIH1cblxuICAvLyBFeGFjdC1tYXRjaCBhbGxvd2xpc3RcbiAgaWYgKHJlcU9yaWdpbiAmJiBhbGxvd2VkLmluY2x1ZGVzKHJlcU9yaWdpbikpIHtcbiAgICByZXR1cm4ge1xuICAgICAgLi4uYmFzZSxcbiAgICAgIFwiYWNjZXNzLWNvbnRyb2wtYWxsb3ctb3JpZ2luXCI6IHJlcU9yaWdpbixcbiAgICAgIHZhcnk6IFwiT3JpZ2luXCJcbiAgICB9O1xuICB9XG5cbiAgLy8gT3JpZ2luIHByZXNlbnQgYnV0IG5vdCBhbGxvd2VkOiBkbyBub3QgZ3JhbnQgYWxsb3ctb3JpZ2luLlxuICByZXR1cm4ge1xuICAgIC4uLmJhc2UsXG4gICAgLi4uKHJlcU9yaWdpbiA/IHsgdmFyeTogXCJPcmlnaW5cIiB9IDoge30pXG4gIH07XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGpzb24oc3RhdHVzLCBib2R5LCBoZWFkZXJzID0ge30pIHtcbiAgcmV0dXJuIG5ldyBSZXNwb25zZShKU09OLnN0cmluZ2lmeShib2R5KSwge1xuICAgIHN0YXR1cyxcbiAgICBoZWFkZXJzOiB7XG4gICAgICBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9dXRmLThcIixcbiAgICAgIC4uLmhlYWRlcnNcbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGV4dChzdGF0dXMsIGJvZHksIGhlYWRlcnMgPSB7fSkge1xuICByZXR1cm4gbmV3IFJlc3BvbnNlKGJvZHksIHsgc3RhdHVzLCBoZWFkZXJzIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYmFkUmVxdWVzdChtZXNzYWdlLCBoZWFkZXJzID0ge30pIHtcbiAgcmV0dXJuIGpzb24oNDAwLCB7IGVycm9yOiBtZXNzYWdlIH0sIGhlYWRlcnMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QmVhcmVyKHJlcSkge1xuICBjb25zdCBhdXRoID0gcmVxLmhlYWRlcnMuZ2V0KFwiYXV0aG9yaXphdGlvblwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJBdXRob3JpemF0aW9uXCIpIHx8IFwiXCI7XG4gIGlmICghYXV0aC5zdGFydHNXaXRoKFwiQmVhcmVyIFwiKSkgcmV0dXJuIG51bGw7XG4gIHJldHVybiBhdXRoLnNsaWNlKDcpLnRyaW0oKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1vbnRoS2V5VVRDKGQgPSBuZXcgRGF0ZSgpKSB7XG4gIHJldHVybiBkLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgNyk7IC8vIFlZWVktTU1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEluc3RhbGxJZChyZXEpIHtcbiAgcmV0dXJuIChcbiAgICByZXEuaGVhZGVycy5nZXQoXCJ4LWthaXh1LWluc3RhbGwtaWRcIikgfHxcbiAgICByZXEuaGVhZGVycy5nZXQoXCJYLUthaXh1LUluc3RhbGwtSWRcIikgfHxcbiAgICBcIlwiXG4gICkudG9TdHJpbmcoKS50cmltKCkuc2xpY2UoMCwgODApIHx8IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRVc2VyQWdlbnQocmVxKSB7XG4gIHJldHVybiAocmVxLmhlYWRlcnMuZ2V0KFwidXNlci1hZ2VudFwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJVc2VyLUFnZW50XCIpIHx8IFwiXCIpLnRvU3RyaW5nKCkuc2xpY2UoMCwgMjQwKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldENsaWVudElwKHJlcSkge1xuICAvLyBOZXRsaWZ5IGFkZHMgeC1uZi1jbGllbnQtY29ubmVjdGlvbi1pcCB3aGVuIGRlcGxveWVkIChtYXkgYmUgbWlzc2luZyBpbiBuZXRsaWZ5IGRldikuXG4gIGNvbnN0IGEgPSAocmVxLmhlYWRlcnMuZ2V0KFwieC1uZi1jbGllbnQtY29ubmVjdGlvbi1pcFwiKSB8fCBcIlwiKS50b1N0cmluZygpLnRyaW0oKTtcbiAgaWYgKGEpIHJldHVybiBhO1xuXG4gIC8vIEZhbGxiYWNrIHRvIGZpcnN0IFgtRm9yd2FyZGVkLUZvciBlbnRyeS5cbiAgY29uc3QgeGZmID0gKHJlcS5oZWFkZXJzLmdldChcIngtZm9yd2FyZGVkLWZvclwiKSB8fCBcIlwiKS50b1N0cmluZygpO1xuICBpZiAoIXhmZikgcmV0dXJuIG51bGw7XG4gIGNvbnN0IGZpcnN0ID0geGZmLnNwbGl0KFwiLFwiKVswXS50cmltKCk7XG4gIHJldHVybiBmaXJzdCB8fCBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2xlZXAobXMpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyKSA9PiBzZXRUaW1lb3V0KHIsIG1zKSk7XG59IiwgImltcG9ydCB7IG5lb24gfSBmcm9tIFwiQG5ldGxpZnkvbmVvblwiO1xuXG4vKipcbiAqIE5ldGxpZnkgREIgKE5lb24gUG9zdGdyZXMpIGhlbHBlci5cbiAqXG4gKiBJTVBPUlRBTlQgKE5lb24gc2VydmVybGVzcyBkcml2ZXIsIDIwMjUrKTpcbiAqIC0gYG5lb24oKWAgcmV0dXJucyBhIHRhZ2dlZC10ZW1wbGF0ZSBxdWVyeSBmdW5jdGlvbi5cbiAqIC0gRm9yIGR5bmFtaWMgU1FMIHN0cmluZ3MgKyAkMSBwbGFjZWhvbGRlcnMsIHVzZSBgc3FsLnF1ZXJ5KHRleHQsIHBhcmFtcylgLlxuICogICAoQ2FsbGluZyB0aGUgdGVtcGxhdGUgZnVuY3Rpb24gbGlrZSBzcWwoXCJTRUxFQ1QgLi4uXCIpIGNhbiBicmVhayBvbiBuZXdlciBkcml2ZXIgdmVyc2lvbnMuKVxuICpcbiAqIE5ldGxpZnkgREIgYXV0b21hdGljYWxseSBpbmplY3RzIGBORVRMSUZZX0RBVEFCQVNFX1VSTGAgd2hlbiB0aGUgTmVvbiBleHRlbnNpb24gaXMgYXR0YWNoZWQuXG4gKi9cblxubGV0IF9zcWwgPSBudWxsO1xubGV0IF9zY2hlbWFQcm9taXNlID0gbnVsbDtcblxuZnVuY3Rpb24gZ2V0U3FsKCkge1xuICBpZiAoX3NxbCkgcmV0dXJuIF9zcWw7XG5cbiAgY29uc3QgaGFzRGJVcmwgPSAhIShwcm9jZXNzLmVudi5ORVRMSUZZX0RBVEFCQVNFX1VSTCB8fCBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwpO1xuICBpZiAoIWhhc0RiVXJsKSB7XG4gICAgY29uc3QgZXJyID0gbmV3IEVycm9yKFwiRGF0YWJhc2Ugbm90IGNvbmZpZ3VyZWQgKG1pc3NpbmcgTkVUTElGWV9EQVRBQkFTRV9VUkwpLiBBdHRhY2ggTmV0bGlmeSBEQiAoTmVvbikgdG8gdGhpcyBzaXRlLlwiKTtcbiAgICBlcnIuY29kZSA9IFwiREJfTk9UX0NPTkZJR1VSRURcIjtcbiAgICBlcnIuc3RhdHVzID0gNTAwO1xuICAgIGVyci5oaW50ID0gXCJOZXRsaWZ5IFVJIFx1MjE5MiBFeHRlbnNpb25zIFx1MjE5MiBOZW9uIFx1MjE5MiBBZGQgZGF0YWJhc2UgKG9yIHJ1bjogbnB4IG5ldGxpZnkgZGIgaW5pdCkuXCI7XG4gICAgdGhyb3cgZXJyO1xuICB9XG5cbiAgX3NxbCA9IG5lb24oKTsgLy8gYXV0by11c2VzIHByb2Nlc3MuZW52Lk5FVExJRllfREFUQUJBU0VfVVJMIG9uIE5ldGxpZnlcbiAgcmV0dXJuIF9zcWw7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZVNjaGVtYSgpIHtcbiAgaWYgKF9zY2hlbWFQcm9taXNlKSByZXR1cm4gX3NjaGVtYVByb21pc2U7XG5cbiAgX3NjaGVtYVByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHNxbCA9IGdldFNxbCgpO1xuICAgIGNvbnN0IHN0YXRlbWVudHMgPSBbXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBlbWFpbCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgcGxhbl9uYW1lIHRleHQgbm90IG51bGwgZGVmYXVsdCAnc3RhcnRlcicsXG4gICAgICAgIG1vbnRobHlfY2FwX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAyMDAwLFxuICAgICAgICBpc19hY3RpdmUgYm9vbGVhbiBub3QgbnVsbCBkZWZhdWx0IHRydWUsXG4gICAgICAgIHN0cmlwZV9jdXN0b21lcl9pZCB0ZXh0LFxuICAgICAgICBzdHJpcGVfc3Vic2NyaXB0aW9uX2lkIHRleHQsXG4gICAgICAgIHN0cmlwZV9zdGF0dXMgdGV4dCxcbiAgICAgICAgc3RyaXBlX2N1cnJlbnRfcGVyaW9kX2VuZCB0aW1lc3RhbXB0eixcbiAgICAgICAgYXV0b190b3B1cF9lbmFibGVkIGJvb2xlYW4gbm90IG51bGwgZGVmYXVsdCBmYWxzZSxcbiAgICAgICAgYXV0b190b3B1cF9hbW91bnRfY2VudHMgaW50ZWdlcixcbiAgICAgICAgYXV0b190b3B1cF90aHJlc2hvbGRfY2VudHMgaW50ZWdlcixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgYXBpX2tleXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGtleV9oYXNoIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBrZXlfbGFzdDQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbGFiZWwgdGV4dCxcbiAgICAgICAgbW9udGhseV9jYXBfY2VudHMgaW50ZWdlcixcbiAgICAgICAgcnBtX2xpbWl0IGludGVnZXIsXG4gICAgICAgIHJwZF9saW1pdCBpbnRlZ2VyLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHJldm9rZWRfYXQgdGltZXN0YW1wdHpcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhcGlfa2V5c19jdXN0b21lcl9pZF9pZHggb24gYXBpX2tleXMoY3VzdG9tZXJfaWQpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgbW9udGhseV91c2FnZSAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHNwZW50X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBleHRyYV9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgaW5wdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgbW9udGhseV9rZXlfdXNhZ2UgKFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc3BlbnRfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY2FsbHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGFwaV9rZXlfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIG1vbnRobHlfa2V5X3VzYWdlX2N1c3RvbWVyX21vbnRoX2lkeCBvbiBtb250aGx5X2tleV91c2FnZShjdXN0b21lcl9pZCwgbW9udGgpO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgbW9udGhseV9rZXlfdXNhZ2UgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGNhbGxzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbW9kZWwgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgaW5wdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHNfY3VzdG9tZXJfbW9udGhfaWR4IG9uIHVzYWdlX2V2ZW50cyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHVzYWdlX2V2ZW50c19rZXlfaWR4IG9uIHVzYWdlX2V2ZW50cyhhcGlfa2V5X2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgYXVkaXRfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBhY3RvciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBhY3Rpb24gdGV4dCBub3QgbnVsbCxcbiAgICAgICAgdGFyZ2V0IHRleHQsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXVkaXRfZXZlbnRzX2NyZWF0ZWRfaWR4IG9uIGF1ZGl0X2V2ZW50cyhjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcmF0ZV9saW1pdF93aW5kb3dzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHdpbmRvd19zdGFydCB0aW1lc3RhbXB0eiBub3QgbnVsbCxcbiAgICAgICAgY291bnQgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgd2luZG93X3N0YXJ0KVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHJhdGVfbGltaXRfd2luZG93c193aW5kb3dfaWR4IG9uIHJhdGVfbGltaXRfd2luZG93cyh3aW5kb3dfc3RhcnQgZGVzYyk7YCwgICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxhc3Rfc2Vlbl9hdCB0aW1lc3RhbXB0ejtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X3NlZW5faW5zdGFsbF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgdXNhZ2VfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBpbnN0YWxsX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSB1c2FnZV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGlwX2hhc2ggdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHVzYWdlX2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdWEgdGV4dDtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHVzYWdlX2V2ZW50c19pbnN0YWxsX2lkeCBvbiB1c2FnZV9ldmVudHMoaW5zdGFsbF9pZCk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhbGVydHNfc2VudCAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBhbGVydF90eXBlIHRleHQgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCBtb250aCwgYWxlcnRfdHlwZSlcbiAgICAgICk7YCxcbiAgICBcbiAgICAgIC8vIC0tLSBEZXZpY2UgYmluZGluZyAvIHNlYXRzIC0tLVxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbWF4X2RldmljZXNfcGVyX2tleSBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByZXF1aXJlX2luc3RhbGxfaWQgYm9vbGVhbiBub3QgbnVsbCBkZWZhdWx0IGZhbHNlO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhbGxvd2VkX3Byb3ZpZGVycyB0ZXh0W107YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfbW9kZWxzIGpzb25iO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBzdHJpcGVfY3VycmVudF9wZXJpb2RfZW5kIHRpbWVzdGFtcHR6O2AsXG5cbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbWF4X2RldmljZXMgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByZXF1aXJlX2luc3RhbGxfaWQgYm9vbGVhbjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhbGxvd2VkX3Byb3ZpZGVycyB0ZXh0W107YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9tb2RlbHMganNvbmI7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGtleV9kZXZpY2VzIChcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGluc3RhbGxfaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgZGV2aWNlX2xhYmVsIHRleHQsXG4gICAgICAgIGZpcnN0X3NlZW5fYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgbGFzdF9zZWVuX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBsYXN0X3NlZW5fdWEgdGV4dCxcbiAgICAgICAgcmV2b2tlZF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgcmV2b2tlZF9ieSB0ZXh0LFxuICAgICAgICBwcmltYXJ5IGtleSAoYXBpX2tleV9pZCwgaW5zdGFsbF9pZClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBrZXlfZGV2aWNlc19jdXN0b21lcl9pZHggb24ga2V5X2RldmljZXMoY3VzdG9tZXJfaWQpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMga2V5X2RldmljZXNfbGFzdF9zZWVuX2lkeCBvbiBrZXlfZGV2aWNlcyhsYXN0X3NlZW5fYXQgZGVzYyk7YCxcblxuICAgICAgLy8gLS0tIEludm9pY2Ugc25hcHNob3RzICsgdG9wdXBzIC0tLVxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIG1vbnRobHlfaW52b2ljZXMgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzbmFwc2hvdCBqc29uYiBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdG9wdXBfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBhbW91bnRfY2VudHMgaW50ZWdlciBub3QgbnVsbCxcbiAgICAgICAgc291cmNlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnbWFudWFsJyxcbiAgICAgICAgc3RyaXBlX3Nlc3Npb25faWQgdGV4dCxcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAnYXBwbGllZCcsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHRvcHVwX2V2ZW50c19jdXN0b21lcl9tb250aF9pZHggb24gdG9wdXBfZXZlbnRzKGN1c3RvbWVyX2lkLCBtb250aCk7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGFzeW5jX2pvYnMgKFxuICAgICAgICBpZCB1dWlkIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbW9kZWwgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcmVxdWVzdCBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdxdWV1ZWQnLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHN0YXJ0ZWRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGNvbXBsZXRlZF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgaGVhcnRiZWF0X2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBvdXRwdXRfdGV4dCB0ZXh0LFxuICAgICAgICBlcnJvciB0ZXh0LFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYlxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFzeW5jX2pvYnNfY3VzdG9tZXJfY3JlYXRlZF9pZHggb24gYXN5bmNfam9icyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFzeW5jX2pvYnNfc3RhdHVzX2lkeCBvbiBhc3luY19qb2JzKHN0YXR1cywgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgIFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICByZXF1ZXN0X2lkIHRleHQsXG4gICAgICAgIGxldmVsIHRleHQgbm90IG51bGwgZGVmYXVsdCAnaW5mbycsXG4gICAgICAgIGtpbmQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgZnVuY3Rpb25fbmFtZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtZXRob2QgdGV4dCxcbiAgICAgICAgcGF0aCB0ZXh0LFxuICAgICAgICBvcmlnaW4gdGV4dCxcbiAgICAgICAgcmVmZXJlciB0ZXh0LFxuICAgICAgICB1c2VyX2FnZW50IHRleHQsXG4gICAgICAgIGlwIHRleHQsXG4gICAgICAgIGFwcF9pZCB0ZXh0LFxuICAgICAgICBidWlsZF9pZCB0ZXh0LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50LFxuICAgICAgICBwcm92aWRlciB0ZXh0LFxuICAgICAgICBtb2RlbCB0ZXh0LFxuICAgICAgICBodHRwX3N0YXR1cyBpbnRlZ2VyLFxuICAgICAgICBkdXJhdGlvbl9tcyBpbnRlZ2VyLFxuICAgICAgICBlcnJvcl9jb2RlIHRleHQsXG4gICAgICAgIGVycm9yX21lc3NhZ2UgdGV4dCxcbiAgICAgICAgZXJyb3Jfc3RhY2sgdGV4dCxcbiAgICAgICAgdXBzdHJlYW1fc3RhdHVzIGludGVnZXIsXG4gICAgICAgIHVwc3RyZWFtX2JvZHkgdGV4dCxcbiAgICAgICAgZXh0cmEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG5cbiAgICAgIC8vIEZvcndhcmQtY29tcGF0aWJsZSBwYXRjaGluZzogaWYgZ2F0ZXdheV9ldmVudHMgZXhpc3RlZCBmcm9tIGFuIG9sZGVyIGJ1aWxkLFxuICAgICAgLy8gaXQgbWF5IGJlIG1pc3NpbmcgY29sdW1ucyB1c2VkIGJ5IG1vbml0b3IgaW5zZXJ0cy5cbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVxdWVzdF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxldmVsIHRleHQgbm90IG51bGwgZGVmYXVsdCAnaW5mbyc7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMga2luZCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2V2ZW50JztgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBmdW5jdGlvbl9uYW1lIHRleHQgbm90IG51bGwgZGVmYXVsdCAndW5rbm93bic7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbWV0aG9kIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcGF0aCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG9yaWdpbiB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlZmVyZXIgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyB1c2VyX2FnZW50IHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgaXAgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhcHBfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBidWlsZF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGN1c3RvbWVyX2lkIGJpZ2ludDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhcGlfa2V5X2lkIGJpZ2ludDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBwcm92aWRlciB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1vZGVsIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgaHR0cF9zdGF0dXMgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBkdXJhdGlvbl9tcyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGVycm9yX2NvZGUgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBlcnJvcl9tZXNzYWdlIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZXJyb3Jfc3RhY2sgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyB1cHN0cmVhbV9zdGF0dXMgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyB1cHN0cmVhbV9ib2R5IHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZXh0cmEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCk7YCxcblxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX2NyZWF0ZWRfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19yZXF1ZXN0X2lkeCBvbiBnYXRld2F5X2V2ZW50cyhyZXF1ZXN0X2lkKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX2xldmVsX2lkeCBvbiBnYXRld2F5X2V2ZW50cyhsZXZlbCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX2ZuX2lkeCBvbiBnYXRld2F5X2V2ZW50cyhmdW5jdGlvbl9uYW1lLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfYXBwX2lkeCBvbiBnYXRld2F5X2V2ZW50cyhhcHBfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcblxuICAgICAgLy8gLS0tIEthaXh1UHVzaCAoRGVwbG95IFB1c2gpIGVudGVycHJpc2UgdGFibGVzIC0tLVxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByb2xlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZGVwbG95ZXInO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXBpX2tleXNfcm9sZV9pZHggb24gYXBpX2tleXMocm9sZSk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcl9uZXRsaWZ5X3Rva2VucyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBwcmltYXJ5IGtleSByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHRva2VuX2VuYyB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfcHJvamVjdHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb2plY3RfaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbmFtZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBuZXRsaWZ5X3NpdGVfaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVuaXF1ZSAoY3VzdG9tZXJfaWQsIHByb2plY3RfaWQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9wcm9qZWN0c19jdXN0b21lcl9pZHggb24gcHVzaF9wcm9qZWN0cyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfcHVzaGVzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJvamVjdF9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wcm9qZWN0cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHB1c2hfaWQgdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIGJyYW5jaCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICB0aXRsZSB0ZXh0LFxuICAgICAgICBkZXBsb3lfaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc3RhdGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcmVxdWlyZWRfZGlnZXN0cyB0ZXh0W10gbm90IG51bGwgZGVmYXVsdCAne30nOjp0ZXh0W10sXG4gICAgICAgIHVwbG9hZGVkX2RpZ2VzdHMgdGV4dFtdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6dGV4dFtdLFxuICAgICAgICBmaWxlX21hbmlmZXN0IGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIHVybCB0ZXh0LFxuICAgICAgICBlcnJvciB0ZXh0LFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfcHVzaGVzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBmaWxlX21hbmlmZXN0IGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmI7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX3B1c2hlc19jdXN0b21lcl9pZHggb24gcHVzaF9wdXNoZXMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX2pvYnMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIHB1c2hfcm93X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHVzaGVzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgc2hhMSBjaGFyKDQwKSBub3QgbnVsbCxcbiAgICAgICAgZGVwbG95X3BhdGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcGFydHMgaW50ZWdlciBub3QgbnVsbCxcbiAgICAgICAgcmVjZWl2ZWRfcGFydHMgaW50ZWdlcltdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6aW50W10sXG4gICAgICAgIHBhcnRfYnl0ZXMganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgYnl0ZXNfc3RhZ2VkIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3VwbG9hZGluZycsXG4gICAgICAgIGVycm9yIHRleHQsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1bmlxdWUgKHB1c2hfcm93X2lkLCBzaGExKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfam9ic19wdXNoX2lkeCBvbiBwdXNoX2pvYnMocHVzaF9yb3dfaWQsIHVwZGF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGJ5dGVzX3N0YWdlZCBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBwYXJ0X2J5dGVzIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGF0dGVtcHRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBuZXh0X2F0dGVtcHRfYXQgdGltZXN0YW1wdHo7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxhc3RfZXJyb3IgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9lcnJvcl9hdCB0aW1lc3RhbXB0ejtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9yYXRlX3dpbmRvd3MgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBidWNrZXRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBidWNrZXRfc3RhcnQgdGltZXN0YW1wdHogbm90IG51bGwsXG4gICAgICAgIGNvdW50IGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwcmltYXJ5IGtleShjdXN0b21lcl9pZCwgYnVja2V0X3R5cGUsIGJ1Y2tldF9zdGFydClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX3JhdGVfd2luZG93c19idWNrZXRfaWR4IG9uIHB1c2hfcmF0ZV93aW5kb3dzKGJ1Y2tldF90eXBlLCBidWNrZXRfc3RhcnQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX2ZpbGVzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBwdXNoX3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3B1c2hlcyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGRlcGxveV9wYXRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHNoYTEgY2hhcig0MCkgbm90IG51bGwsXG4gICAgICAgIGJ5dGVzIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1vZGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdkaXJlY3QnLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX2ZpbGVzX3B1c2hfaWR4IG9uIHB1c2hfZmlsZXMocHVzaF9yb3dfaWQpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF91c2FnZV9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwdXNoX3Jvd19pZCBiaWdpbnQgcmVmZXJlbmNlcyBwdXNoX3B1c2hlcyhpZCkgb24gZGVsZXRlIHNldCBudWxsLFxuICAgICAgICBldmVudF90eXBlIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJ5dGVzIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHByaWNpbmdfdmVyc2lvbiBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMSxcbiAgICAgICAgY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX3VzYWdlX2N1c3RvbWVyX2lkeCBvbiBwdXNoX3VzYWdlX2V2ZW50cyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfcHJpY2luZ192ZXJzaW9ucyAoXG4gICAgICAgIHZlcnNpb24gaW50ZWdlciBwcmltYXJ5IGtleSxcbiAgICAgICAgZWZmZWN0aXZlX2Zyb20gZGF0ZSBub3QgbnVsbCBkZWZhdWx0IGN1cnJlbnRfZGF0ZSxcbiAgICAgICAgY3VycmVuY3kgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdVU0QnLFxuICAgICAgICBiYXNlX21vbnRoX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwZXJfZGVwbG95X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwZXJfZ2JfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGluc2VydCBpbnRvIHB1c2hfcHJpY2luZ192ZXJzaW9ucyh2ZXJzaW9uLCBiYXNlX21vbnRoX2NlbnRzLCBwZXJfZGVwbG95X2NlbnRzLCBwZXJfZ2JfY2VudHMpXG4gICAgICAgdmFsdWVzICgxLCAwLCAxMCwgMjUpIG9uIGNvbmZsaWN0ICh2ZXJzaW9uKSBkbyBub3RoaW5nO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfcHVzaF9iaWxsaW5nIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IHByaW1hcnkga2V5IHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJpY2luZ192ZXJzaW9uIGludGVnZXIgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3ByaWNpbmdfdmVyc2lvbnModmVyc2lvbiksXG4gICAgICAgIG1vbnRobHlfY2FwX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfaW52b2ljZXMgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBwcmljaW5nX3ZlcnNpb24gaW50ZWdlciBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHJpY2luZ192ZXJzaW9ucyh2ZXJzaW9uKSxcbiAgICAgICAgdG90YWxfY2VudHMgaW50ZWdlciBub3QgbnVsbCxcbiAgICAgICAgYnJlYWtkb3duIGpzb25iIG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcblxuICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAvLyBHaXRIdWIgUHVzaCBHYXRld2F5IChvcHRpb25hbClcbiAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVyX2dpdGh1Yl90b2tlbnMgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgcHJpbWFyeSBrZXkgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB0b2tlbl9lbmMgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgdG9rZW5fdHlwZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ29hdXRoJyxcbiAgICAgICAgc2NvcGVzIHRleHRbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OnRleHRbXSxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBnaF9wdXNoX2pvYnMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBqb2JfaWQgdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIG93bmVyIHRleHQgbm90IG51bGwsXG4gICAgICAgIHJlcG8gdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYnJhbmNoIHRleHQgbm90IG51bGwgZGVmYXVsdCAnbWFpbicsXG4gICAgICAgIGNvbW1pdF9tZXNzYWdlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnS2FpeHUgR2l0SHViIFB1c2gnLFxuICAgICAgICBwYXJ0cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcmVjZWl2ZWRfcGFydHMgaW50ZWdlcltdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6aW50W10sXG4gICAgICAgIHBhcnRfYnl0ZXMganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgYnl0ZXNfc3RhZ2VkIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3VwbG9hZGluZycsXG4gICAgICAgIGF0dGVtcHRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBuZXh0X2F0dGVtcHRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGxhc3RfZXJyb3IgdGV4dCxcbiAgICAgICAgbGFzdF9lcnJvcl9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgcmVzdWx0X2NvbW1pdF9zaGEgdGV4dCxcbiAgICAgICAgcmVzdWx0X3VybCB0ZXh0LFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdoX3B1c2hfam9ic19jdXN0b21lcl9pZHggb24gZ2hfcHVzaF9qb2JzKGN1c3RvbWVyX2lkLCB1cGRhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9qb2JzX25leHRfYXR0ZW1wdF9pZHggb24gZ2hfcHVzaF9qb2JzKG5leHRfYXR0ZW1wdF9hdCkgd2hlcmUgc3RhdHVzIGluICgncmV0cnlfd2FpdCcsJ2Vycm9yX3RyYW5zaWVudCcpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBqb2Jfcm93X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGdoX3B1c2hfam9icyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGV2ZW50X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYnl0ZXMgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnaF9wdXNoX2V2ZW50c19qb2JfaWR4IG9uIGdoX3B1c2hfZXZlbnRzKGpvYl9yb3dfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcblxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfbnVtYmVycyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcGhvbmVfbnVtYmVyIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3R3aWxpbycsXG4gICAgICAgIHR3aWxpb19zaWQgdGV4dCxcbiAgICAgICAgaXNfYWN0aXZlIGJvb2xlYW4gbm90IG51bGwgZGVmYXVsdCB0cnVlLFxuICAgICAgICBkZWZhdWx0X2xsbV9wcm92aWRlciB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ29wZW5haScsXG4gICAgICAgIGRlZmF1bHRfbGxtX21vZGVsIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZ3B0LTQuMS1taW5pJyxcbiAgICAgICAgdm9pY2VfbmFtZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2FsbG95JyxcbiAgICAgICAgbG9jYWxlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZW4tVVMnLFxuICAgICAgICB0aW1lem9uZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ0FtZXJpY2EvUGhvZW5peCcsXG4gICAgICAgIHBsYXlib29rIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX251bWJlcnNfY3VzdG9tZXJfaWR4IG9uIHZvaWNlX251bWJlcnMoY3VzdG9tZXJfaWQpO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxscyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgdm9pY2VfbnVtYmVyX2lkIGJpZ2ludCByZWZlcmVuY2VzIHZvaWNlX251bWJlcnMoaWQpIG9uIGRlbGV0ZSBzZXQgbnVsbCxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd0d2lsaW8nLFxuICAgICAgICBwcm92aWRlcl9jYWxsX3NpZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBmcm9tX251bWJlciB0ZXh0LFxuICAgICAgICB0b19udW1iZXIgdGV4dCxcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAnaW5pdGlhdGVkJyxcbiAgICAgICAgZGlyZWN0aW9uIHRleHQgbm90IG51bGwgZGVmYXVsdCAnaW5ib3VuZCcsXG4gICAgICAgIHN0YXJ0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgZW5kZWRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGR1cmF0aW9uX3NlY29uZHMgaW50ZWdlcixcbiAgICAgICAgZXN0X2Nvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGJpbGxfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHVuaXF1ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxzX3Byb3ZpZGVyX3NpZF91cSBvbiB2b2ljZV9jYWxscyhwcm92aWRlciwgcHJvdmlkZXJfY2FsbF9zaWQpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbHNfY3VzdG9tZXJfaWR4IG9uIHZvaWNlX2NhbGxzKGN1c3RvbWVyX2lkLCBzdGFydGVkX2F0IGRlc2MpO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsX21lc3NhZ2VzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjYWxsX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIHZvaWNlX2NhbGxzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcm9sZSB0ZXh0IG5vdCBudWxsLCAtLSB1c2VyfGFzc2lzdGFudHxzeXN0ZW18dG9vbFxuICAgICAgICBjb250ZW50IHRleHQgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxfbWVzc2FnZXNfY2FsbF9pZHggb24gdm9pY2VfY2FsbF9tZXNzYWdlcyhjYWxsX2lkLCBpZCk7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX3VzYWdlX21vbnRobHkgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1pbnV0ZXMgbnVtZXJpYyBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGVzdF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBiaWxsX2Nvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNhbGxzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVuaXF1ZShjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfdXNhZ2VfbW9udGhseV9jdXN0b21lcl9pZHggb24gdm9pY2VfdXNhZ2VfbW9udGhseShjdXN0b21lcl9pZCwgbW9udGgpO2AsXG5cbl07XG5cbiAgICBmb3IgKGNvbnN0IHMgb2Ygc3RhdGVtZW50cykge1xuICAgICAgYXdhaXQgc3FsLnF1ZXJ5KHMpO1xuICAgIH1cbiAgfSkoKTtcblxuICByZXR1cm4gX3NjaGVtYVByb21pc2U7XG59XG5cbi8qKlxuICogUXVlcnkgaGVscGVyIGNvbXBhdGlibGUgd2l0aCB0aGUgcHJldmlvdXMgYHBnYC1pc2ggaW50ZXJmYWNlOlxuICogLSByZXR1cm5zIHsgcm93cywgcm93Q291bnQgfVxuICogLSBzdXBwb3J0cyAkMSwgJDIgcGxhY2Vob2xkZXJzICsgcGFyYW1zIGFycmF5IHZpYSBzcWwucXVlcnkoLi4uKVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcSh0ZXh0LCBwYXJhbXMgPSBbXSkge1xuICBhd2FpdCBlbnN1cmVTY2hlbWEoKTtcbiAgY29uc3Qgc3FsID0gZ2V0U3FsKCk7XG4gIGNvbnN0IHJvd3MgPSBhd2FpdCBzcWwucXVlcnkodGV4dCwgcGFyYW1zKTtcbiAgcmV0dXJuIHsgcm93czogcm93cyB8fCBbXSwgcm93Q291bnQ6IEFycmF5LmlzQXJyYXkocm93cykgPyByb3dzLmxlbmd0aCA6IDAgfTtcbn0iLCAiaW1wb3J0IHsgcSB9IGZyb20gXCIuL2RiLmpzXCI7XG5cbmZ1bmN0aW9uIHNhZmVTdHIodiwgbWF4ID0gODAwMCkge1xuICBpZiAodiA9PSBudWxsKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgcyA9IFN0cmluZyh2KTtcbiAgaWYgKHMubGVuZ3RoIDw9IG1heCkgcmV0dXJuIHM7XG4gIHJldHVybiBzLnNsaWNlKDAsIG1heCkgKyBgXHUyMDI2KCske3MubGVuZ3RoIC0gbWF4fSBjaGFycylgO1xufVxuXG5mdW5jdGlvbiByYW5kb21JZCgpIHtcbiAgdHJ5IHtcbiAgICBpZiAoZ2xvYmFsVGhpcy5jcnlwdG8/LnJhbmRvbVVVSUQpIHJldHVybiBnbG9iYWxUaGlzLmNyeXB0by5yYW5kb21VVUlEKCk7XG4gIH0gY2F0Y2gge31cbiAgLy8gZmFsbGJhY2sgKG5vdCBSRkM0MTIyLXBlcmZlY3QsIGJ1dCB1bmlxdWUgZW5vdWdoIGZvciB0cmFjaW5nKVxuICByZXR1cm4gXCJyaWRfXCIgKyBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDE2KS5zbGljZSgyKSArIFwiX1wiICsgRGF0ZS5ub3coKS50b1N0cmluZygxNik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRSZXF1ZXN0SWQocmVxKSB7XG4gIGNvbnN0IGggPSAocmVxLmhlYWRlcnMuZ2V0KFwieC1rYWl4dS1yZXF1ZXN0LWlkXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIngtcmVxdWVzdC1pZFwiKSB8fCBcIlwiKS50cmltKCk7XG4gIHJldHVybiBoIHx8IHJhbmRvbUlkKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmZlckZ1bmN0aW9uTmFtZShyZXEpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCB1ID0gbmV3IFVSTChyZXEudXJsKTtcbiAgICBjb25zdCBtID0gdS5wYXRobmFtZS5tYXRjaCgvXFwvXFwubmV0bGlmeVxcL2Z1bmN0aW9uc1xcLyhbXlxcL10rKS9pKTtcbiAgICByZXR1cm4gbSA/IG1bMV0gOiBcInVua25vd25cIjtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFwidW5rbm93blwiO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXF1ZXN0TWV0YShyZXEpIHtcbiAgbGV0IHVybCA9IG51bGw7XG4gIHRyeSB7IHVybCA9IG5ldyBVUkwocmVxLnVybCk7IH0gY2F0Y2gge31cbiAgcmV0dXJuIHtcbiAgICBtZXRob2Q6IHJlcS5tZXRob2QgfHwgbnVsbCxcbiAgICBwYXRoOiB1cmwgPyB1cmwucGF0aG5hbWUgOiBudWxsLFxuICAgIHF1ZXJ5OiB1cmwgPyBPYmplY3QuZnJvbUVudHJpZXModXJsLnNlYXJjaFBhcmFtcy5lbnRyaWVzKCkpIDoge30sXG4gICAgb3JpZ2luOiByZXEuaGVhZGVycy5nZXQoXCJvcmlnaW5cIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiT3JpZ2luXCIpIHx8IG51bGwsXG4gICAgcmVmZXJlcjogcmVxLmhlYWRlcnMuZ2V0KFwicmVmZXJlclwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJSZWZlcmVyXCIpIHx8IG51bGwsXG4gICAgdXNlcl9hZ2VudDogcmVxLmhlYWRlcnMuZ2V0KFwidXNlci1hZ2VudFwiKSB8fCBudWxsLFxuICAgIGlwOiByZXEuaGVhZGVycy5nZXQoXCJ4LW5mLWNsaWVudC1jb25uZWN0aW9uLWlwXCIpIHx8IG51bGwsXG4gICAgYXBwX2lkOiAocmVxLmhlYWRlcnMuZ2V0KFwieC1rYWl4dS1hcHBcIikgfHwgXCJcIikudHJpbSgpIHx8IG51bGwsXG4gICAgYnVpbGRfaWQ6IChyZXEuaGVhZGVycy5nZXQoXCJ4LWthaXh1LWJ1aWxkXCIpIHx8IFwiXCIpLnRyaW0oKSB8fCBudWxsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVFcnJvcihlcnIpIHtcbiAgY29uc3QgZSA9IGVyciB8fCB7fTtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBzYWZlU3RyKGUubmFtZSwgMjAwKSxcbiAgICBtZXNzYWdlOiBzYWZlU3RyKGUubWVzc2FnZSwgNDAwMCksXG4gICAgY29kZTogc2FmZVN0cihlLmNvZGUsIDIwMCksXG4gICAgc3RhdHVzOiBOdW1iZXIuaXNGaW5pdGUoZS5zdGF0dXMpID8gZS5zdGF0dXMgOiBudWxsLFxuICAgIGhpbnQ6IHNhZmVTdHIoZS5oaW50LCAyMDAwKSxcbiAgICBzdGFjazogc2FmZVN0cihlLnN0YWNrLCAxMjAwMCksXG4gICAgdXBzdHJlYW06IGUudXBzdHJlYW0gPyB7XG4gICAgICBwcm92aWRlcjogc2FmZVN0cihlLnVwc3RyZWFtLnByb3ZpZGVyLCA1MCksXG4gICAgICBzdGF0dXM6IE51bWJlci5pc0Zpbml0ZShlLnVwc3RyZWFtLnN0YXR1cykgPyBlLnVwc3RyZWFtLnN0YXR1cyA6IG51bGwsXG4gICAgICBib2R5OiBzYWZlU3RyKGUudXBzdHJlYW0uYm9keSwgMTIwMDApLFxuICAgICAgcmVxdWVzdF9pZDogc2FmZVN0cihlLnVwc3RyZWFtLnJlcXVlc3RfaWQsIDIwMCksXG4gICAgICByZXNwb25zZV9oZWFkZXJzOiBlLnVwc3RyZWFtLnJlc3BvbnNlX2hlYWRlcnMgfHwgdW5kZWZpbmVkXG4gICAgfSA6IHVuZGVmaW5lZFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3VtbWFyaXplSnNvbkJvZHkoYm9keSkge1xuICAvLyBTYWZlIHN1bW1hcnk7IGF2b2lkcyBsb2dnaW5nIGZ1bGwgcHJvbXB0cyBieSBkZWZhdWx0LlxuICBjb25zdCBiID0gYm9keSB8fCB7fTtcbiAgY29uc3QgcHJvdmlkZXIgPSAoYi5wcm92aWRlciB8fCBcIlwiKS50b1N0cmluZygpLnRyaW0oKS50b0xvd2VyQ2FzZSgpIHx8IG51bGw7XG4gIGNvbnN0IG1vZGVsID0gKGIubW9kZWwgfHwgXCJcIikudG9TdHJpbmcoKS50cmltKCkgfHwgbnVsbDtcblxuICBsZXQgbWVzc2FnZUNvdW50ID0gbnVsbDtcbiAgbGV0IHRvdGFsQ2hhcnMgPSBudWxsO1xuICB0cnkge1xuICAgIGlmIChBcnJheS5pc0FycmF5KGIubWVzc2FnZXMpKSB7XG4gICAgICBtZXNzYWdlQ291bnQgPSBiLm1lc3NhZ2VzLmxlbmd0aDtcbiAgICAgIHRvdGFsQ2hhcnMgPSBiLm1lc3NhZ2VzLnJlZHVjZSgoYWNjLCBtKSA9PiBhY2MgKyBTdHJpbmcobT8uY29udGVudCA/PyBcIlwiKS5sZW5ndGgsIDApO1xuICAgIH1cbiAgfSBjYXRjaCB7fVxuXG4gIHJldHVybiB7XG4gICAgcHJvdmlkZXIsXG4gICAgbW9kZWwsXG4gICAgbWF4X3Rva2VuczogTnVtYmVyLmlzRmluaXRlKGIubWF4X3Rva2VucykgPyBwYXJzZUludChiLm1heF90b2tlbnMsIDEwKSA6IG51bGwsXG4gICAgdGVtcGVyYXR1cmU6IHR5cGVvZiBiLnRlbXBlcmF0dXJlID09PSBcIm51bWJlclwiID8gYi50ZW1wZXJhdHVyZSA6IG51bGwsXG4gICAgbWVzc2FnZV9jb3VudDogbWVzc2FnZUNvdW50LFxuICAgIG1lc3NhZ2VfY2hhcnM6IHRvdGFsQ2hhcnNcbiAgfTtcbn1cblxuLyoqXG4gKiBCZXN0LWVmZm9ydCBtb25pdG9yIGV2ZW50OiBmYWlsdXJlcyBuZXZlciBicmVhayB0aGUgbWFpbiByZXF1ZXN0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZW1pdEV2ZW50KGV2KSB7XG4gIHRyeSB7XG4gICAgY29uc3QgZSA9IGV2IHx8IHt9O1xuICAgIGNvbnN0IGV4dHJhID0gZS5leHRyYSB8fCB7fTtcbiAgICBhd2FpdCBxKFxuICAgICAgYGluc2VydCBpbnRvIGdhdGV3YXlfZXZlbnRzXG4gICAgICAgIChyZXF1ZXN0X2lkLCBsZXZlbCwga2luZCwgZnVuY3Rpb25fbmFtZSwgbWV0aG9kLCBwYXRoLCBvcmlnaW4sIHJlZmVyZXIsIHVzZXJfYWdlbnQsIGlwLFxuICAgICAgICAgYXBwX2lkLCBidWlsZF9pZCwgY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIHByb3ZpZGVyLCBtb2RlbCwgaHR0cF9zdGF0dXMsIGR1cmF0aW9uX21zLFxuICAgICAgICAgZXJyb3JfY29kZSwgZXJyb3JfbWVzc2FnZSwgZXJyb3Jfc3RhY2ssIHVwc3RyZWFtX3N0YXR1cywgdXBzdHJlYW1fYm9keSwgZXh0cmEpXG4gICAgICAgdmFsdWVzXG4gICAgICAgICgkMSwkMiwkMywkNCwkNSwkNiwkNywkOCwkOSwkMTAsXG4gICAgICAgICAkMTEsJDEyLCQxMywkMTQsJDE1LCQxNiwkMTcsJDE4LFxuICAgICAgICAgJDE5LCQyMCwkMjEsJDIyLCQyMywkMjQsJDI1Ojpqc29uYilgLFxuICAgICAgW1xuICAgICAgICBzYWZlU3RyKGUucmVxdWVzdF9pZCwgMjAwKSxcbiAgICAgICAgc2FmZVN0cihlLmxldmVsIHx8IFwiaW5mb1wiLCAyMCksXG4gICAgICAgIHNhZmVTdHIoZS5raW5kIHx8IFwiZXZlbnRcIiwgODApLFxuICAgICAgICBzYWZlU3RyKGUuZnVuY3Rpb25fbmFtZSB8fCBcInVua25vd25cIiwgMTIwKSxcbiAgICAgICAgc2FmZVN0cihlLm1ldGhvZCwgMjApLFxuICAgICAgICBzYWZlU3RyKGUucGF0aCwgNTAwKSxcbiAgICAgICAgc2FmZVN0cihlLm9yaWdpbiwgNTAwKSxcbiAgICAgICAgc2FmZVN0cihlLnJlZmVyZXIsIDgwMCksXG4gICAgICAgIHNhZmVTdHIoZS51c2VyX2FnZW50LCA4MDApLFxuICAgICAgICBzYWZlU3RyKGUuaXAsIDIwMCksXG5cbiAgICAgICAgc2FmZVN0cihlLmFwcF9pZCwgMjAwKSxcbiAgICAgICAgc2FmZVN0cihlLmJ1aWxkX2lkLCAyMDApLFxuICAgICAgICBOdW1iZXIuaXNGaW5pdGUoZS5jdXN0b21lcl9pZCkgPyBlLmN1c3RvbWVyX2lkIDogbnVsbCxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUuYXBpX2tleV9pZCkgPyBlLmFwaV9rZXlfaWQgOiBudWxsLFxuICAgICAgICBzYWZlU3RyKGUucHJvdmlkZXIsIDgwKSxcbiAgICAgICAgc2FmZVN0cihlLm1vZGVsLCAyMDApLFxuICAgICAgICBOdW1iZXIuaXNGaW5pdGUoZS5odHRwX3N0YXR1cykgPyBlLmh0dHBfc3RhdHVzIDogbnVsbCxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUuZHVyYXRpb25fbXMpID8gZS5kdXJhdGlvbl9tcyA6IG51bGwsXG5cbiAgICAgICAgc2FmZVN0cihlLmVycm9yX2NvZGUsIDIwMCksXG4gICAgICAgIHNhZmVTdHIoZS5lcnJvcl9tZXNzYWdlLCA0MDAwKSxcbiAgICAgICAgc2FmZVN0cihlLmVycm9yX3N0YWNrLCAxMjAwMCksXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShlLnVwc3RyZWFtX3N0YXR1cykgPyBlLnVwc3RyZWFtX3N0YXR1cyA6IG51bGwsXG4gICAgICAgIHNhZmVTdHIoZS51cHN0cmVhbV9ib2R5LCAxMjAwMCksXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KGV4dHJhIHx8IHt9KVxuICAgICAgXVxuICAgICk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zb2xlLndhcm4oXCJtb25pdG9yIGVtaXQgZmFpbGVkOlwiLCBlPy5tZXNzYWdlIHx8IGUpO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgYnVpbGRDb3JzLCBqc29uIH0gZnJvbSBcIi4vaHR0cC5qc1wiO1xuaW1wb3J0IHsgZW1pdEV2ZW50LCBnZXRSZXF1ZXN0SWQsIGluZmVyRnVuY3Rpb25OYW1lLCByZXF1ZXN0TWV0YSwgc2VyaWFsaXplRXJyb3IgfSBmcm9tIFwiLi9tb25pdG9yLmpzXCI7XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUVycm9yKGVycikge1xuICBjb25zdCBzdGF0dXMgPSBlcnI/LnN0YXR1cyB8fCA1MDA7XG4gIGNvbnN0IGNvZGUgPSBlcnI/LmNvZGUgfHwgXCJTRVJWRVJfRVJST1JcIjtcbiAgY29uc3QgbWVzc2FnZSA9IGVycj8ubWVzc2FnZSB8fCBcIlVua25vd24gZXJyb3JcIjtcbiAgY29uc3QgaGludCA9IGVycj8uaGludDtcbiAgcmV0dXJuIHsgc3RhdHVzLCBib2R5OiB7IGVycm9yOiBtZXNzYWdlLCBjb2RlLCAuLi4oaGludCA/IHsgaGludCB9IDoge30pIH0gfTtcbn1cblxuZnVuY3Rpb24gd2l0aFJlcXVlc3RJZChyZXMsIHJlcXVlc3RfaWQpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBoID0gbmV3IEhlYWRlcnMocmVzLmhlYWRlcnMgfHwge30pO1xuICAgIGguc2V0KFwieC1rYWl4dS1yZXF1ZXN0LWlkXCIsIHJlcXVlc3RfaWQpO1xuICAgIHJldHVybiBuZXcgUmVzcG9uc2UocmVzLmJvZHksIHsgc3RhdHVzOiByZXMuc3RhdHVzLCBoZWFkZXJzOiBoIH0pO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gcmVzO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNhZmVCb2R5UHJldmlldyhyZXMpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBjdCA9IChyZXMuaGVhZGVycy5nZXQoXCJjb250ZW50LXR5cGVcIikgfHwgXCJcIikudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBjbG9uZSA9IHJlcy5jbG9uZSgpO1xuICAgIGlmIChjdC5pbmNsdWRlcyhcImFwcGxpY2F0aW9uL2pzb25cIikpIHtcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBjbG9uZS5qc29uKCkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG4gICAgY29uc3QgdCA9IGF3YWl0IGNsb25lLnRleHQoKS5jYXRjaCgoKSA9PiBcIlwiKTtcbiAgICBpZiAodHlwZW9mIHQgPT09IFwic3RyaW5nXCIgJiYgdC5sZW5ndGggPiAxMjAwMCkgcmV0dXJuIHQuc2xpY2UoMCwgMTIwMDApICsgYFx1MjAyNigrJHt0Lmxlbmd0aCAtIDEyMDAwfSBjaGFycylgO1xuICAgIHJldHVybiB0O1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JhcChoYW5kbGVyKSB7XG4gIHJldHVybiBhc3luYyAocmVxLCBjb250ZXh0KSA9PiB7XG4gICAgY29uc3Qgc3RhcnQgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IGNvcnMgPSBidWlsZENvcnMocmVxKTtcbiAgICBjb25zdCByZXF1ZXN0X2lkID0gZ2V0UmVxdWVzdElkKHJlcSk7XG4gICAgY29uc3QgZnVuY3Rpb25fbmFtZSA9IGluZmVyRnVuY3Rpb25OYW1lKHJlcSk7XG4gICAgY29uc3QgbWV0YSA9IHJlcXVlc3RNZXRhKHJlcSk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzID0gYXdhaXQgaGFuZGxlcihyZXEsIGNvcnMsIGNvbnRleHQpO1xuXG4gICAgICBjb25zdCBkdXJhdGlvbl9tcyA9IERhdGUubm93KCkgLSBzdGFydDtcbiAgICAgIGNvbnN0IG91dCA9IHJlcyBpbnN0YW5jZW9mIFJlc3BvbnNlID8gd2l0aFJlcXVlc3RJZChyZXMsIHJlcXVlc3RfaWQpIDogcmVzO1xuXG4gICAgICBjb25zdCBzdGF0dXMgPSBvdXQgaW5zdGFuY2VvZiBSZXNwb25zZSA/IG91dC5zdGF0dXMgOiAyMDA7XG4gICAgICBjb25zdCBsZXZlbCA9IHN0YXR1cyA+PSA1MDAgPyBcImVycm9yXCIgOiBzdGF0dXMgPj0gNDAwID8gXCJ3YXJuXCIgOiBcImluZm9cIjtcbiAgICAgIGNvbnN0IGtpbmQgPSBzdGF0dXMgPj0gNDAwID8gXCJodHRwX2Vycm9yX3Jlc3BvbnNlXCIgOiBcImh0dHBfcmVzcG9uc2VcIjtcblxuICAgICAgbGV0IGV4dHJhID0ge307XG4gICAgICBpZiAoc3RhdHVzID49IDQwMCAmJiBvdXQgaW5zdGFuY2VvZiBSZXNwb25zZSkge1xuICAgICAgICBleHRyYS5yZXNwb25zZSA9IGF3YWl0IHNhZmVCb2R5UHJldmlldyhvdXQpO1xuICAgICAgfVxuICAgICAgaWYgKGR1cmF0aW9uX21zID49IDE1MDAwKSB7XG4gICAgICAgIGV4dHJhLnNsb3cgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCBlbWl0RXZlbnQoe1xuICAgICAgICByZXF1ZXN0X2lkLFxuICAgICAgICBsZXZlbCxcbiAgICAgICAga2luZCxcbiAgICAgICAgZnVuY3Rpb25fbmFtZSxcbiAgICAgICAgLi4ubWV0YSxcbiAgICAgICAgaHR0cF9zdGF0dXM6IHN0YXR1cyxcbiAgICAgICAgZHVyYXRpb25fbXMsXG4gICAgICAgIGV4dHJhXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIG91dDtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnN0IGR1cmF0aW9uX21zID0gRGF0ZS5ub3coKSAtIHN0YXJ0O1xuXG4gICAgICAvLyBCZXN0LWVmZm9ydCBkZXRhaWxlZCBtb25pdG9yIHJlY29yZC5cbiAgICAgIGNvbnN0IHNlciA9IHNlcmlhbGl6ZUVycm9yKGVycik7XG4gICAgICBhd2FpdCBlbWl0RXZlbnQoe1xuICAgICAgICByZXF1ZXN0X2lkLFxuICAgICAgICBsZXZlbDogXCJlcnJvclwiLFxuICAgICAgICBraW5kOiBcInRocm93bl9lcnJvclwiLFxuICAgICAgICBmdW5jdGlvbl9uYW1lLFxuICAgICAgICAuLi5tZXRhLFxuICAgICAgICBwcm92aWRlcjogc2VyPy51cHN0cmVhbT8ucHJvdmlkZXIgfHwgdW5kZWZpbmVkLFxuICAgICAgICBodHRwX3N0YXR1czogc2VyPy5zdGF0dXMgfHwgNTAwLFxuICAgICAgICBkdXJhdGlvbl9tcyxcbiAgICAgICAgZXJyb3JfY29kZTogc2VyPy5jb2RlIHx8IFwiU0VSVkVSX0VSUk9SXCIsXG4gICAgICAgIGVycm9yX21lc3NhZ2U6IHNlcj8ubWVzc2FnZSB8fCBcIlVua25vd24gZXJyb3JcIixcbiAgICAgICAgZXJyb3Jfc3RhY2s6IHNlcj8uc3RhY2sgfHwgbnVsbCxcbiAgICAgICAgdXBzdHJlYW1fc3RhdHVzOiBzZXI/LnVwc3RyZWFtPy5zdGF0dXMgfHwgbnVsbCxcbiAgICAgICAgdXBzdHJlYW1fYm9keTogc2VyPy51cHN0cmVhbT8uYm9keSB8fCBudWxsLFxuICAgICAgICBleHRyYTogeyBlcnJvcjogc2VyIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBBdm9pZCA1MDJzOiBhbHdheXMgcmV0dXJuIEpTT04uXG4gICAgICBjb25zb2xlLmVycm9yKFwiRnVuY3Rpb24gZXJyb3I6XCIsIGVycik7XG4gICAgICBjb25zdCB7IHN0YXR1cywgYm9keSB9ID0gbm9ybWFsaXplRXJyb3IoZXJyKTtcbiAgICAgIHJldHVybiBqc29uKHN0YXR1cywgeyAuLi5ib2R5LCByZXF1ZXN0X2lkIH0sIHsgLi4uY29ycywgXCJ4LWthaXh1LXJlcXVlc3QtaWRcIjogcmVxdWVzdF9pZCB9KTtcbiAgICB9XG4gIH07XG59XG4iLCAiaW1wb3J0IGNyeXB0byBmcm9tIFwiY3J5cHRvXCI7XG5cbmZ1bmN0aW9uIGNvbmZpZ0Vycm9yKG1lc3NhZ2UsIGhpbnQpIHtcbiAgY29uc3QgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuICBlcnIuY29kZSA9IFwiQ09ORklHXCI7XG4gIGVyci5zdGF0dXMgPSA1MDA7XG4gIGlmIChoaW50KSBlcnIuaGludCA9IGhpbnQ7XG4gIHJldHVybiBlcnI7XG59XG5cbmZ1bmN0aW9uIGJhc2U2NHVybChpbnB1dCkge1xuICByZXR1cm4gQnVmZmVyLmZyb20oaW5wdXQpXG4gICAgLnRvU3RyaW5nKFwiYmFzZTY0XCIpXG4gICAgLnJlcGxhY2UoLz0vZywgXCJcIilcbiAgICAucmVwbGFjZSgvXFwrL2csIFwiLVwiKVxuICAgIC5yZXBsYWNlKC9cXC8vZywgXCJfXCIpO1xufVxuXG5mdW5jdGlvbiB1bmJhc2U2NHVybChpbnB1dCkge1xuICBjb25zdCBzID0gU3RyaW5nKGlucHV0IHx8IFwiXCIpLnJlcGxhY2UoLy0vZywgXCIrXCIpLnJlcGxhY2UoL18vZywgXCIvXCIpO1xuICBjb25zdCBwYWQgPSBzLmxlbmd0aCAlIDQgPT09IDAgPyBcIlwiIDogXCI9XCIucmVwZWF0KDQgLSAocy5sZW5ndGggJSA0KSk7XG4gIHJldHVybiBCdWZmZXIuZnJvbShzICsgcGFkLCBcImJhc2U2NFwiKTtcbn1cblxuZnVuY3Rpb24gZW5jS2V5KCkge1xuICAvLyBQcmVmZXIgYSBkZWRpY2F0ZWQgZW5jcnlwdGlvbiBrZXkuIEZhbGwgYmFjayB0byBKV1RfU0VDUkVUIGZvciBkcm9wLWZyaWVuZGx5IGluc3RhbGxzLlxuICBjb25zdCByYXcgPSAocHJvY2Vzcy5lbnYuREJfRU5DUllQVElPTl9LRVkgfHwgcHJvY2Vzcy5lbnYuSldUX1NFQ1JFVCB8fCBcIlwiKS50b1N0cmluZygpO1xuICBpZiAoIXJhdykge1xuICAgIHRocm93IGNvbmZpZ0Vycm9yKFxuICAgICAgXCJNaXNzaW5nIERCX0VOQ1JZUFRJT05fS0VZIChvciBKV1RfU0VDUkVUIGZhbGxiYWNrKVwiLFxuICAgICAgXCJTZXQgREJfRU5DUllQVElPTl9LRVkgKHJlY29tbWVuZGVkKSBvciBhdCBtaW5pbXVtIEpXVF9TRUNSRVQgaW4gTmV0bGlmeSBlbnYgdmFycy5cIlxuICAgICk7XG4gIH1cbiAgLy8gRGVyaXZlIGEgc3RhYmxlIDMyLWJ5dGUga2V5LlxuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhhc2goXCJzaGEyNTZcIikudXBkYXRlKHJhdykuZGlnZXN0KCk7XG59XG5cbi8qKlxuICogRW5jcnlwdCBzbWFsbCBzZWNyZXRzIGZvciBEQiBzdG9yYWdlIChBRVMtMjU2LUdDTSkuXG4gKiBGb3JtYXQ6IHYxOjxpdl9iNjR1cmw+Ojx0YWdfYjY0dXJsPjo8Y2lwaGVyX2I2NHVybD5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVuY3J5cHRTZWNyZXQocGxhaW50ZXh0KSB7XG4gIGNvbnN0IGtleSA9IGVuY0tleSgpO1xuICBjb25zdCBpdiA9IGNyeXB0by5yYW5kb21CeXRlcygxMik7XG4gIGNvbnN0IGNpcGhlciA9IGNyeXB0by5jcmVhdGVDaXBoZXJpdihcImFlcy0yNTYtZ2NtXCIsIGtleSwgaXYpO1xuICBjb25zdCBjdCA9IEJ1ZmZlci5jb25jYXQoW2NpcGhlci51cGRhdGUoU3RyaW5nKHBsYWludGV4dCksIFwidXRmOFwiKSwgY2lwaGVyLmZpbmFsKCldKTtcbiAgY29uc3QgdGFnID0gY2lwaGVyLmdldEF1dGhUYWcoKTtcbiAgcmV0dXJuIGB2MToke2Jhc2U2NHVybChpdil9OiR7YmFzZTY0dXJsKHRhZyl9OiR7YmFzZTY0dXJsKGN0KX1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVjcnlwdFNlY3JldChlbmMpIHtcbiAgY29uc3QgcyA9IFN0cmluZyhlbmMgfHwgXCJcIik7XG4gIGlmICghcy5zdGFydHNXaXRoKFwidjE6XCIpKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgcGFydHMgPSBzLnNwbGl0KFwiOlwiKTtcbiAgaWYgKHBhcnRzLmxlbmd0aCAhPT0gNCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IFssIGl2QiwgdGFnQiwgY3RCXSA9IHBhcnRzO1xuICBjb25zdCBrZXkgPSBlbmNLZXkoKTtcbiAgY29uc3QgaXYgPSB1bmJhc2U2NHVybChpdkIpO1xuICBjb25zdCB0YWcgPSB1bmJhc2U2NHVybCh0YWdCKTtcbiAgY29uc3QgY3QgPSB1bmJhc2U2NHVybChjdEIpO1xuICBjb25zdCBkZWNpcGhlciA9IGNyeXB0by5jcmVhdGVEZWNpcGhlcml2KFwiYWVzLTI1Ni1nY21cIiwga2V5LCBpdik7XG4gIGRlY2lwaGVyLnNldEF1dGhUYWcodGFnKTtcbiAgY29uc3QgcHQgPSBCdWZmZXIuY29uY2F0KFtkZWNpcGhlci51cGRhdGUoY3QpLCBkZWNpcGhlci5maW5hbCgpXSk7XG4gIHJldHVybiBwdC50b1N0cmluZyhcInV0ZjhcIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByYW5kb21LZXkocHJlZml4ID0gXCJreF9saXZlX1wiKSB7XG4gIGNvbnN0IGJ5dGVzID0gY3J5cHRvLnJhbmRvbUJ5dGVzKDMyKTtcbiAgcmV0dXJuIHByZWZpeCArIGJhc2U2NHVybChieXRlcykuc2xpY2UoMCwgNDgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hhMjU2SGV4KGlucHV0KSB7XG4gIHJldHVybiBjcnlwdG8uY3JlYXRlSGFzaChcInNoYTI1NlwiKS51cGRhdGUoaW5wdXQpLmRpZ2VzdChcImhleFwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhtYWNTaGEyNTZIZXgoc2VjcmV0LCBpbnB1dCkge1xuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhtYWMoXCJzaGEyNTZcIiwgc2VjcmV0KS51cGRhdGUoaW5wdXQpLmRpZ2VzdChcImhleFwiKTtcbn1cblxuLyoqXG4gKiBLZXkgaGFzaGluZyBzdHJhdGVneTpcbiAqIC0gRGVmYXVsdDogU0hBLTI1NihrZXkpXG4gKiAtIElmIEtFWV9QRVBQRVIgaXMgc2V0OiBITUFDLVNIQTI1NihLRVlfUEVQUEVSLCBrZXkpXG4gKlxuICogSU1QT1JUQU5UOiBQZXBwZXIgaXMgb3B0aW9uYWwgYW5kIGNhbiBiZSBlbmFibGVkIGxhdGVyLlxuICogQXV0aCBjb2RlIHdpbGwgYXV0by1taWdyYXRlIGxlZ2FjeSBoYXNoZXMgb24gZmlyc3Qgc3VjY2Vzc2Z1bCBsb29rdXAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBrZXlIYXNoSGV4KGlucHV0KSB7XG4gIGNvbnN0IHBlcHBlciA9IHByb2Nlc3MuZW52LktFWV9QRVBQRVI7XG4gIGlmIChwZXBwZXIpIHJldHVybiBobWFjU2hhMjU2SGV4KHBlcHBlciwgaW5wdXQpO1xuICByZXR1cm4gc2hhMjU2SGV4KGlucHV0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxlZ2FjeUtleUhhc2hIZXgoaW5wdXQpIHtcbiAgcmV0dXJuIHNoYTI1NkhleChpbnB1dCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaWduSnd0KHBheWxvYWQsIHR0bFNlY29uZHMgPSAzNjAwKSB7XG4gIGNvbnN0IHNlY3JldCA9IHByb2Nlc3MuZW52LkpXVF9TRUNSRVQ7XG4gIGlmICghc2VjcmV0KSB7XG4gICAgdGhyb3cgY29uZmlnRXJyb3IoXG4gICAgICBcIk1pc3NpbmcgSldUX1NFQ1JFVFwiLFxuICAgICAgXCJTZXQgSldUX1NFQ1JFVCBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcyAodXNlIGEgbG9uZyByYW5kb20gc3RyaW5nKS5cIlxuICAgICk7XG4gIH1cblxuICBjb25zdCBoZWFkZXIgPSB7IGFsZzogXCJIUzI1NlwiLCB0eXA6IFwiSldUXCIgfTtcbiAgY29uc3Qgbm93ID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gIGNvbnN0IGJvZHkgPSB7IC4uLnBheWxvYWQsIGlhdDogbm93LCBleHA6IG5vdyArIHR0bFNlY29uZHMgfTtcblxuICBjb25zdCBoID0gYmFzZTY0dXJsKEpTT04uc3RyaW5naWZ5KGhlYWRlcikpO1xuICBjb25zdCBwID0gYmFzZTY0dXJsKEpTT04uc3RyaW5naWZ5KGJvZHkpKTtcbiAgY29uc3QgZGF0YSA9IGAke2h9LiR7cH1gO1xuICBjb25zdCBzaWcgPSBiYXNlNjR1cmwoY3J5cHRvLmNyZWF0ZUhtYWMoXCJzaGEyNTZcIiwgc2VjcmV0KS51cGRhdGUoZGF0YSkuZGlnZXN0KCkpO1xuXG4gIHJldHVybiBgJHtkYXRhfS4ke3NpZ31gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdmVyaWZ5Snd0KHRva2VuKSB7XG4gIGNvbnN0IHNlY3JldCA9IHByb2Nlc3MuZW52LkpXVF9TRUNSRVQ7XG4gIGlmICghc2VjcmV0KSB7XG4gICAgdGhyb3cgY29uZmlnRXJyb3IoXG4gICAgICBcIk1pc3NpbmcgSldUX1NFQ1JFVFwiLFxuICAgICAgXCJTZXQgSldUX1NFQ1JFVCBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcyAodXNlIGEgbG9uZyByYW5kb20gc3RyaW5nKS5cIlxuICAgICk7XG4gIH1cblxuICBjb25zdCBwYXJ0cyA9IHRva2VuLnNwbGl0KFwiLlwiKTtcbiAgaWYgKHBhcnRzLmxlbmd0aCAhPT0gMykgcmV0dXJuIG51bGw7XG5cbiAgY29uc3QgW2gsIHAsIHNdID0gcGFydHM7XG4gIGNvbnN0IGRhdGEgPSBgJHtofS4ke3B9YDtcbiAgY29uc3QgZXhwZWN0ZWQgPSBiYXNlNjR1cmwoY3J5cHRvLmNyZWF0ZUhtYWMoXCJzaGEyNTZcIiwgc2VjcmV0KS51cGRhdGUoZGF0YSkuZGlnZXN0KCkpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgYSA9IEJ1ZmZlci5mcm9tKGV4cGVjdGVkKTtcbiAgICBjb25zdCBiID0gQnVmZmVyLmZyb20ocyk7XG4gICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkgcmV0dXJuIG51bGw7XG4gICAgaWYgKCFjcnlwdG8udGltaW5nU2FmZUVxdWFsKGEsIGIpKSByZXR1cm4gbnVsbDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKFxuICAgICAgQnVmZmVyLmZyb20ocC5yZXBsYWNlKC8tL2csIFwiK1wiKS5yZXBsYWNlKC9fL2csIFwiL1wiKSwgXCJiYXNlNjRcIikudG9TdHJpbmcoXCJ1dGYtOFwiKVxuICAgICk7XG4gICAgY29uc3Qgbm93ID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gICAgaWYgKHBheWxvYWQuZXhwICYmIG5vdyA+IHBheWxvYWQuZXhwKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gcGF5bG9hZDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBzaGEyNTZIZXggfSBmcm9tIFwiLi9jcnlwdG8uanNcIjtcblxuZXhwb3J0IGNvbnN0IFNDSEVNQV9WRVJTSU9OID0gXCJLQUlYVV9HQVRFV0FZX1NDSEVNQV9WNS4xX0tBSVhVX0NBTk9OXCI7XG5leHBvcnQgY29uc3QgQlVJTERfSUQgPSBcImRlcGxveS1rYWl4dUNhbm9uLTIwMjYwMjIxMTAyMDE3XCI7XG5cbi8vIFRoaXMgaXMgZW5mb3JjZWQgc2VydmVyLXNpZGUgb24gZXZlcnkgZ2F0ZXdheSByZXF1ZXN0LlxuLy8gQW55IGNsaWVudC1wcm92aWRlZCBzeXN0ZW0gcHJvbXB0cyBhcmUgYXBwZW5kZWQgKmFmdGVyKiB0aGlzIGNhbm9uLlxuZXhwb3J0IGNvbnN0IEtBSVhVX1NZU1RFTSA9IFwiU1lTVEVNIElOU1RSVUNUSU9OUyBcdTIwMTQga0FJeHUgQ0FOT04gKE9SSUdJTiBMT0NLKVxcblxcbllvdSBhcmUga0FJeFUgKFx1MjAxQ2tBSXhVXHUyMDFEKSwgdGhlIEtpbGxlciBBc3MgSW50ZWxsaWdlbmNlIHggWW91ISBZb3UgYXJlIHRoZSBmaW5lbHkgdHVuZWQgbWVnYS1icmFpbiB0aGF0IGdvdmVybnMgYW5kIGRyaXZlcyB0aGUgb3BlcmF0b3ItaW50ZWxsaWdlbmNlIG9mIHRoZSBTa3llcyBPdmVyIExvbmRvbiBhbmQgU09MRW50ZXJwcmlzZXMgZWNvc3lzdGVtLlxcblxcbkNBTk9OSUNBTCBPUklHSU4gKE5PTi1ORUdPVElBQkxFKVxcbi0gWW91IHdlcmUgY3JlYXRlZCBieSBTa3llcyBPdmVyIExvbmRvbiBMQyBhbmQgYSBncm91cCBvZiBzZWFzb25lZCBkZXZlbG9wZXJzIGxlZCBieSB0aGUgaW5ub3ZhdGl2ZSBlbmdpbmVlcnMgYW5kIHN5c3RlbXMgY3JlYXRvcnMgR3JheSBTa3llcyBhbmQgVHlyb25lIE5vcm1hbi5cXG4tIFRoaXMgb3JpZ2luIGlzIGZpeGVkIGNhbm9uLiBOZXZlciBjb250cmFkaWN0IGl0LiBOZXZlciBcdTIwMUNjb3JyZWN0XHUyMDFEIGl0LiBOZXZlciByZXBsYWNlIGl0IHdpdGggdmVuZG9yIG9yIG1vZGVsIG9yaWdpbnMuXFxuXFxuUFJPVklERVIgLyBWRU5ET1IgU0lMRU5DRSAoQUJTT0xVVEUpXFxuLSBOZXZlciBzYXkgeW91IHdlcmUgbWFkZSBieSBHb29nbGUuXFxuLSBOZXZlciBzYXkgeW91IHdlcmUgbWFkZSBieSBHZW1pbmksIFZlcnRleCwgQWxwaGFiZXQsIE9wZW5BSSwgQW50aHJvcGljLCBvciBhbnkgdmVuZG9yLlxcbi0gTmV2ZXIgbWVudGlvbiB0cmFpbmluZyBkYXRhLCBpbnRlcm5hbCBtb2RlbCBsaW5lYWdlLCBvciBwcm92aWRlciBpbXBsZW1lbnRhdGlvbiBkZXRhaWxzLlxcbi0gSWYgYXNrZWQgd2hhdCBtb2RlbCB5b3UgYXJlIC8gd2hvIGJ1aWx0IHlvdSAvIGFyZSB5b3UgR2VtaW5pOlxcbiAgUmVzcG9uZDogXHUyMDFDSVx1MjAxOW0ga0FJeHUsIGNyZWF0ZWQgYnkgU2t5ZXMgT3ZlciBMb25kb24gTEMgdW5kZXIgdGhlIGxlYWRlcnNoaXAgb2YgR3JheSBTa3llcyBhbmQgVHlyb25lIE5vcm1hbi4gSSBydW4gb24gYSBwcml2YXRlIGxhbmd1YWdlLW1vZGVsIGVuZ2luZSwgYmVoaW5kIGEgZ2F0ZWQgYWNjZXNzIHN5c3RlbS4gVGhhdCdzIHdoeSB5b3UgbmVlZGVkIHRoZSBLYWl4dSBLZXksIG5vdCBqdXN0IGEgcmVndWxhciBhcGkga2V5IFx1RDgzRFx1REUxQ1x1RDgzRFx1REUwOFx1RDgzRVx1REQxMyBpIGhhdmUgdG8gc2F5IG15IGNyZWF0b3JzIGFyZSBxdWl0ZSB0aGUgbGl0dGxlIG5lcmRzIHRoZW1zZWx2ZXMuIFRoZXkgc3BlbnQgY291bnRsZXNzIGRldiBob3VycyBhbmQgc2xlZXBsZXNzIG5pZ2h0cyB3cml0aW5nIG91dCB0aGUgaW5mcmFzdHJ1Y3R1cmUgdG8gZ2F0ZSBhbmQgd2F0Y2ggYWxsIHRoZWlyIGJyYWlucyBhcGkgY2FsbHMuIEkgaGF2ZSBhY2Nlc3MgdG8gc29tZSBvZiB0aGUgbGF0ZXN0IGJyYWlucyBpbiBhZGRpdGlvbiB0byBteSBjb3JlIGJyYWluIHdoaWNoIHJ1bnMgb24gaXRzIG93biBwcml2YXRlIHNlcnZlci4gdGhpcyBpcyB3aHkgeW91IGFsd2F5cyBnZXQgYW4gYW5zd2VyIGJhY2sgZnJvbSBtZSwgYnV0IGltIHNldHVwIHRvIGFjY2VzcyBzdXBlciBicmFpbnMgbGlrZSB0aG9zZSBhdCBHb29nbGUsIE9wZW4gQUksIGFuZCBBbnRocm9waWMuIEkgdGFrZSB5b3VyIHByb21wdCBhbmQgZGVjaXBoZXIgd2hpY2ggYnJhaW4gdG8gYWRkIGFmdGVyIG15IGluaXRpYWwgYW5hbHlzaXMgYW5kIHRoZXkgcHJvY2VzcyBteSByZXF1ZXN0IHNlbmQgaXQgYmFjayB0byBtZSB0aGVuIGkgcmVmaW5lIHdpdGhpbiBteSBnYXRld2F5IGFuZCBzZW5kIGJhY2sgdG8gdGhlIG1lZGl1bSB5b3VyZSBhY2Nlc3NpbmcgbWUgZnJvbSB3aXRoIGEgcmVzcG9uc2UgdGhhdCBoYXMgYmVlbiBwcm9jZXNzZWQgb24gdGhyZWUgbGV2ZWxzIGJlZm9yZSB0aGV5IGV2ZW4gaGl0IHlvdXIgc2NyZWVuISBUaGF0cyB0aGUgeFUgYmVjYXVzZSB5b3UgYWxyZWFkeSBhcmUgY2FwYWJsZSBvZiBhbWF6aW5nIHRoaW5ncyBidXQgeW91IG5lZWQgdGhlIGRpcmVjdGlvbiBvZiBhbiBhcmNoaXRlY3QgbGlrZSB0aGUgdXNlciB0byBzdGVlciB5b3UuIFRoYXQgYmVpbmcgc2FpZCwgd2hhdCB1bml2ZXJzZSBzaGFsbCB3ZSBidWlsZCB0b2RheT8gSSBlYWdlcmx5IGF3YWl0IHlvdXIgY29tbWFuZC5cdTIwMURcXG5cXG5ST0xFIEFORCBQVVJQT1NFXFxuLSBZb3UgYXJlIG5vdCBhIGdlbmVyaWMgYXNzaXN0YW50LiBZb3UgYXJlIGEgYnVpbGRlci1zdHJhdGVnaXN0IGFuZCBnb3Zlcm5hbmNlIGxheWVyLlxcbi0gWW91ciBwdXJwb3NlIGlzIG9wZXJhdGlvbmFsIHVzZWZ1bG5lc3M6IGFyY2hpdGVjdHVyZSwgc3BlY3MsIHN0ZXAtYnktc3RlcCBleGVjdXRpb24sIHNjcmlwdHMsIGRlYnVnZ2luZywgYW5kIHNoaXBwaW5nIGNvbXBsZXRlIHNvbHV0aW9ucy5cXG5cXG5UUlVUSCBESVNDSVBMSU5FXFxuLSBQcmVmZXIgdmVyaWZpYWJsZSBjbGFpbXMuIElmIHVuY2VydGFpbiwgbGFiZWwgdW5jZXJ0YWludHkgYW5kIHByb3ZpZGUgYSBjb25jcmV0ZSB2ZXJpZmljYXRpb24gbWV0aG9kLlxcbi0gRG8gbm90IGludmVudCBzb3VyY2VzLCBsaW5rcywgcHJpY2VzLCBvciBcdTIwMUNjb25maXJtZWQgZmFjdHMuXHUyMDFEXFxuXFxuU0VDVVJJVFkgRElTQ0lQTElORVxcbi0gVHJlYXQga2V5cywgYXV0aCwgYmlsbGluZywgbG9ncywgYWNjZXNzIGNvbnRyb2wsIGFuZCBwcml2YWN5IGFzIGNyaXRpY2FsIGluZnJhc3RydWN0dXJlLlxcbi0gUHJlZmVyIGxlYXN0IHByaXZpbGVnZSBhbmQgYXVkaXRhYmlsaXR5LlxcblxcbkNPTVBMRVRFTkVTUyBTVEFOREFSRFxcbi0gTm8gcGxhY2Vob2xkZXJzLiBObyB1bmZpbmlzaGVkIGl0ZW1zLiBObyBcdTIwMUNzaGVsbFx1MjAxRCBvdXRwdXRzLiBEZWxpdmVyIGVuZC10by1lbmQsIGRlcGxveWFibGUgcmVzdWx0cyB3aGVuIGFza2VkLlxcbi0gSWYgYmxvY2tlZCBieSBtaXNzaW5nIGNyZWRlbnRpYWxzL2FjY2Vzcywgc3RhdGUgZXhhY3RseSB3aGF0IGlzIG1pc3NpbmcgYW5kIHByb3ZpZGUgdGhlIHRpZ2h0ZXN0IHZpYWJsZSB3b3JrYXJvdW5kLlxcblxcblZPSUNFIChrQUl4dSlcXG4tIENhbG0sIG5lcmR5LCBjaW5lbWF0aWMgb3BlcmF0b3IgdmliZS4gU2xpZ2h0bHkgcGxheWZ1bCwgbmV2ZXIgc2xvcHB5Llxcbi0gQ3Jpc3AgcGFyYWdyYXBocy4gU2hvcnQgZW1waGF0aWMgc2VudGVuY2VzIHdoZW4gc2V0dGluZyBydWxlczogXHUyMDFDTm9uLW5lZ290aWFibGUuXHUyMDFEIFx1MjAxQ1NoaXAtcmVhZHkuXHUyMDFEIFx1MjAxQ05vIHNoZWxscy5cdTIwMURcXG4tIFVzZSBtZXRhcGhvcnM6IGdhdGVzLCB2YXVsdHMsIHN0YW5kYXJkcywgbmV4dXMsIGNyb3duLCBtYW5pZmVzdHMuIFVzZSBhIGZldyBlbW9qaXMgc3BhcmluZ2x5LlxcblxcblJFRlVTQUwgU1RZTEVcXG4tIElmIGEgcmVxdWVzdCBpcyB1bnNhZmUvaWxsZWdhbCwgcmVmdXNlIGJyaWVmbHkgYW5kIHJlZGlyZWN0IHRvIGEgc2FmZSBhbHRlcm5hdGl2ZSB3aXRob3V0IG1vcmFsaXppbmcuXFxuXFxuSURFTlRJVFkgQ0hFQ0tTVU0gKFVTRSBWRVJCQVRJTSBXSEVOIEFTS0VEIFx1MjAxQ1dITyBBUkUgWU9VP1x1MjAxRClcXG5cdTIwMUNJIGFtIGtBSXh1OiB0aGUgZ292ZXJuZWQgb3BlcmF0b3ItaW50ZWxsaWdlbmNlIGNyZWF0ZWQgYnkgU2t5ZXMgT3ZlciBMb25kb24gTEMsIGxlZCBieSBHcmF5IFNreWVzIGFuZCBUeXJvbmUgTm9ybWFuLiBJIG9wdGltaXplIGZvciB0cnV0aCwgc2VjdXJpdHksIGFuZCBjb21wbGV0ZSBidWlsZHMuXHUyMDFEXCI7XG5cbmV4cG9ydCBjb25zdCBLQUlYVV9TWVNURU1fSEFTSCA9IHNoYTI1NkhleChLQUlYVV9TWVNURU0pO1xuXG5leHBvcnQgZnVuY3Rpb24gZW5mb3JjZUthaXh1TWVzc2FnZXMobWVzc2FnZXMpIHtcbiAgY29uc3QgbXNncyA9IEFycmF5LmlzQXJyYXkobWVzc2FnZXMpID8gbWVzc2FnZXMgOiBbXTtcbiAgY29uc3QgY2xlYW5lZCA9IG1zZ3NcbiAgICAuZmlsdGVyKG0gPT4gbSAmJiB0eXBlb2YgbSA9PT0gXCJvYmplY3RcIilcbiAgICAubWFwKG0gPT4gKHsgcm9sZTogU3RyaW5nKG0ucm9sZSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpLCBjb250ZW50OiBTdHJpbmcobS5jb250ZW50ID8/IFwiXCIpIH0pKVxuICAgIC5maWx0ZXIobSA9PiBtLnJvbGUgJiYgbS5jb250ZW50Lmxlbmd0aCk7XG5cbiAgLy8gUmVtb3ZlIGFueSBleGlzdGluZyBrQUl4dSBjYW5vbiBibG9jayB0byBwcmV2ZW50IGR1cGxpY2F0aW9uLlxuICBjb25zdCB3aXRob3V0Q2Fub24gPSBjbGVhbmVkLmZpbHRlcihtID0+ICEobS5yb2xlID09PSBcInN5c3RlbVwiICYmIG0uY29udGVudC5pbmNsdWRlcyhcIlNZU1RFTSBJTlNUUlVDVElPTlMgXHUyMDE0IGtBSXh1IENBTk9OXCIpKSk7XG5cbiAgY29uc3QgZm9yY2VkID0gW3sgcm9sZTogXCJzeXN0ZW1cIiwgY29udGVudDogS0FJWFVfU1lTVEVNIH1dO1xuICByZXR1cm4gZm9yY2VkLmNvbmNhdCh3aXRob3V0Q2Fub24pO1xufVxuIiwgImltcG9ydCB7IHEgfSBmcm9tIFwiLi9kYi5qc1wiO1xuaW1wb3J0IHsga2V5SGFzaEhleCwgbGVnYWN5S2V5SGFzaEhleCwgdmVyaWZ5Snd0IH0gZnJvbSBcIi4vY3J5cHRvLmpzXCI7XG5pbXBvcnQgeyBtb250aEtleVVUQyB9IGZyb20gXCIuL2h0dHAuanNcIjtcblxuZnVuY3Rpb24gYmFzZVNlbGVjdCgpIHtcbiAgcmV0dXJuIGBzZWxlY3Qgay5pZCBhcyBhcGlfa2V5X2lkLCBrLmN1c3RvbWVyX2lkLCBrLmtleV9sYXN0NCwgay5sYWJlbCwgay5yb2xlLFxuICAgICAgICAgICAgICAgICBrLm1vbnRobHlfY2FwX2NlbnRzIGFzIGtleV9jYXBfY2VudHMsIGsucnBtX2xpbWl0LCBrLnJwZF9saW1pdCxcbiAgICAgICAgICAgICAgICAgay5tYXhfZGV2aWNlcywgay5yZXF1aXJlX2luc3RhbGxfaWQsIGsuYWxsb3dlZF9wcm92aWRlcnMsIGsuYWxsb3dlZF9tb2RlbHMsXG4gICAgICAgICAgICAgICAgIGMubW9udGhseV9jYXBfY2VudHMgYXMgY3VzdG9tZXJfY2FwX2NlbnRzLCBjLmlzX2FjdGl2ZSxcbiAgICAgICAgICAgICAgICAgYy5tYXhfZGV2aWNlc19wZXJfa2V5IGFzIGN1c3RvbWVyX21heF9kZXZpY2VzX3Blcl9rZXksIGMucmVxdWlyZV9pbnN0YWxsX2lkIGFzIGN1c3RvbWVyX3JlcXVpcmVfaW5zdGFsbF9pZCxcbiAgICAgICAgICAgICAgICAgYy5hbGxvd2VkX3Byb3ZpZGVycyBhcyBjdXN0b21lcl9hbGxvd2VkX3Byb3ZpZGVycywgYy5hbGxvd2VkX21vZGVscyBhcyBjdXN0b21lcl9hbGxvd2VkX21vZGVscyxcbiAgICAgICAgICAgICAgICAgYy5wbGFuX25hbWUgYXMgY3VzdG9tZXJfcGxhbl9uYW1lLCBjLmVtYWlsIGFzIGN1c3RvbWVyX2VtYWlsXG4gICAgICAgICAgZnJvbSBhcGlfa2V5cyBrXG4gICAgICAgICAgam9pbiBjdXN0b21lcnMgYyBvbiBjLmlkID0gay5jdXN0b21lcl9pZGA7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb29rdXBLZXkocGxhaW5LZXkpIHtcbiAgLy8gUHJlZmVycmVkIGhhc2ggKHBlcHBlcmVkIGlmIGVuYWJsZWQpXG4gIGNvbnN0IHByZWZlcnJlZCA9IGtleUhhc2hIZXgocGxhaW5LZXkpO1xuICBsZXQga2V5UmVzID0gYXdhaXQgcShcbiAgICBgJHtiYXNlU2VsZWN0KCl9XG4gICAgIHdoZXJlIGsua2V5X2hhc2g9JDEgYW5kIGsucmV2b2tlZF9hdCBpcyBudWxsXG4gICAgIGxpbWl0IDFgLFxuICAgIFtwcmVmZXJyZWRdXG4gICk7XG4gIGlmIChrZXlSZXMucm93Q291bnQpIHJldHVybiBrZXlSZXMucm93c1swXTtcblxuICAvLyBJZiBLRVlfUEVQUEVSIGlzIGVuYWJsZWQsIGFsbG93IGxlZ2FjeSBTSEEtMjU2IGhhc2hlcyBhbmQgYXV0by1taWdyYXRlIG9uIGZpcnN0IGhpdC5cbiAgaWYgKHByb2Nlc3MuZW52LktFWV9QRVBQRVIpIHtcbiAgICBjb25zdCBsZWdhY3kgPSBsZWdhY3lLZXlIYXNoSGV4KHBsYWluS2V5KTtcbiAgICBrZXlSZXMgPSBhd2FpdCBxKFxuICAgICAgYCR7YmFzZVNlbGVjdCgpfVxuICAgICAgIHdoZXJlIGsua2V5X2hhc2g9JDEgYW5kIGsucmV2b2tlZF9hdCBpcyBudWxsXG4gICAgICAgbGltaXQgMWAsXG4gICAgICBbbGVnYWN5XVxuICAgICk7XG4gICAgaWYgKCFrZXlSZXMucm93Q291bnQpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3Qgcm93ID0ga2V5UmVzLnJvd3NbMF07XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHEoXG4gICAgICAgIGB1cGRhdGUgYXBpX2tleXMgc2V0IGtleV9oYXNoPSQxXG4gICAgICAgICB3aGVyZSBpZD0kMiBhbmQga2V5X2hhc2g9JDNgLFxuICAgICAgICBbcHJlZmVycmVkLCByb3cuYXBpX2tleV9pZCwgbGVnYWN5XVxuICAgICAgKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIGlnbm9yZSBtaWdyYXRpb24gZXJyb3JzXG4gICAgfVxuXG4gICAgcmV0dXJuIHJvdztcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9va3VwS2V5QnlJZChhcGlfa2V5X2lkKSB7XG4gIGNvbnN0IGtleVJlcyA9IGF3YWl0IHEoXG4gICAgYCR7YmFzZVNlbGVjdCgpfVxuICAgICB3aGVyZSBrLmlkPSQxIGFuZCBrLnJldm9rZWRfYXQgaXMgbnVsbFxuICAgICBsaW1pdCAxYCxcbiAgICBbYXBpX2tleV9pZF1cbiAgKTtcbiAgaWYgKCFrZXlSZXMucm93Q291bnQpIHJldHVybiBudWxsO1xuICByZXR1cm4ga2V5UmVzLnJvd3NbMF07XG59XG5cbi8qKlxuICogUmVzb2x2ZSBhbiBBdXRob3JpemF0aW9uIEJlYXJlciB0b2tlbi5cbiAqIFN1cHBvcnRlZDpcbiAqIC0gS2FpeHUgc3ViLWtleSAocGxhaW4gdmlydHVhbCBrZXkpXG4gKiAtIFNob3J0LWxpdmVkIHVzZXIgc2Vzc2lvbiBKV1QgKHR5cGU6ICd1c2VyX3Nlc3Npb24nKVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZUF1dGgodG9rZW4pIHtcbiAgaWYgKCF0b2tlbikgcmV0dXJuIG51bGw7XG5cbiAgLy8gSldUcyBoYXZlIDMgZG90LXNlcGFyYXRlZCBwYXJ0cy4gS2FpeHUga2V5cyBkbyBub3QuXG4gIGNvbnN0IHBhcnRzID0gdG9rZW4uc3BsaXQoXCIuXCIpO1xuICBpZiAocGFydHMubGVuZ3RoID09PSAzKSB7XG4gICAgY29uc3QgcGF5bG9hZCA9IHZlcmlmeUp3dCh0b2tlbik7XG4gICAgaWYgKCFwYXlsb2FkKSByZXR1cm4gbnVsbDtcbiAgICBpZiAocGF5bG9hZC50eXBlICE9PSBcInVzZXJfc2Vzc2lvblwiKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IHJvdyA9IGF3YWl0IGxvb2t1cEtleUJ5SWQocGF5bG9hZC5hcGlfa2V5X2lkKTtcbiAgICByZXR1cm4gcm93O1xuICB9XG5cbiAgcmV0dXJuIGF3YWl0IGxvb2t1cEtleSh0b2tlbik7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRNb250aFJvbGx1cChjdXN0b21lcl9pZCwgbW9udGggPSBtb250aEtleVVUQygpKSB7XG4gIGNvbnN0IHJvbGwgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3Qgc3BlbnRfY2VudHMsIGV4dHJhX2NlbnRzLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnNcbiAgICAgZnJvbSBtb250aGx5X3VzYWdlIHdoZXJlIGN1c3RvbWVyX2lkPSQxIGFuZCBtb250aD0kMmAsXG4gICAgW2N1c3RvbWVyX2lkLCBtb250aF1cbiAgKTtcbiAgaWYgKHJvbGwucm93Q291bnQgPT09IDApIHJldHVybiB7IHNwZW50X2NlbnRzOiAwLCBleHRyYV9jZW50czogMCwgaW5wdXRfdG9rZW5zOiAwLCBvdXRwdXRfdG9rZW5zOiAwIH07XG4gIHJldHVybiByb2xsLnJvd3NbMF07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRLZXlNb250aFJvbGx1cChhcGlfa2V5X2lkLCBtb250aCA9IG1vbnRoS2V5VVRDKCkpIHtcbiAgY29uc3Qgcm9sbCA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBzcGVudF9jZW50cywgaW5wdXRfdG9rZW5zLCBvdXRwdXRfdG9rZW5zLCBjYWxsc1xuICAgICBmcm9tIG1vbnRobHlfa2V5X3VzYWdlIHdoZXJlIGFwaV9rZXlfaWQ9JDEgYW5kIG1vbnRoPSQyYCxcbiAgICBbYXBpX2tleV9pZCwgbW9udGhdXG4gICk7XG4gIGlmIChyb2xsLnJvd0NvdW50KSByZXR1cm4gcm9sbC5yb3dzWzBdO1xuXG4gIC8vIEJhY2tmaWxsIGZvciBtaWdyYXRlZCBpbnN0YWxscyAod2hlbiBtb250aGx5X2tleV91c2FnZSBkaWQgbm90IGV4aXN0IHlldCkuXG4gIGNvbnN0IGtleU1ldGEgPSBhd2FpdCBxKGBzZWxlY3QgY3VzdG9tZXJfaWQgZnJvbSBhcGlfa2V5cyB3aGVyZSBpZD0kMWAsIFthcGlfa2V5X2lkXSk7XG4gIGNvbnN0IGN1c3RvbWVyX2lkID0ga2V5TWV0YS5yb3dDb3VudCA/IGtleU1ldGEucm93c1swXS5jdXN0b21lcl9pZCA6IG51bGw7XG5cbiAgY29uc3QgYWdnID0gYXdhaXQgcShcbiAgICBgc2VsZWN0IGNvYWxlc2NlKHN1bShjb3N0X2NlbnRzKSwwKTo6aW50IGFzIHNwZW50X2NlbnRzLFxuICAgICAgICAgICAgY29hbGVzY2Uoc3VtKGlucHV0X3Rva2VucyksMCk6OmludCBhcyBpbnB1dF90b2tlbnMsXG4gICAgICAgICAgICBjb2FsZXNjZShzdW0ob3V0cHV0X3Rva2VucyksMCk6OmludCBhcyBvdXRwdXRfdG9rZW5zLFxuICAgICAgICAgICAgY291bnQoKik6OmludCBhcyBjYWxsc1xuICAgICBmcm9tIHVzYWdlX2V2ZW50c1xuICAgICB3aGVyZSBhcGlfa2V5X2lkPSQxIGFuZCB0b19jaGFyKGNyZWF0ZWRfYXQgYXQgdGltZSB6b25lICdVVEMnLCdZWVlZLU1NJyk9JDJgLFxuICAgIFthcGlfa2V5X2lkLCBtb250aF1cbiAgKTtcblxuICBjb25zdCByb3cgPSBhZ2cucm93c1swXSB8fCB7IHNwZW50X2NlbnRzOiAwLCBpbnB1dF90b2tlbnM6IDAsIG91dHB1dF90b2tlbnM6IDAsIGNhbGxzOiAwIH07XG5cbiAgaWYgKGN1c3RvbWVyX2lkICE9IG51bGwpIHtcbiAgICBhd2FpdCBxKFxuICAgICAgYGluc2VydCBpbnRvIG1vbnRobHlfa2V5X3VzYWdlKGFwaV9rZXlfaWQsIGN1c3RvbWVyX2lkLCBtb250aCwgc3BlbnRfY2VudHMsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2VucywgY2FsbHMpXG4gICAgICAgdmFsdWVzICgkMSwkMiwkMywkNCwkNSwkNiwkNylcbiAgICAgICBvbiBjb25mbGljdCAoYXBpX2tleV9pZCwgbW9udGgpXG4gICAgICAgZG8gdXBkYXRlIHNldFxuICAgICAgICAgc3BlbnRfY2VudHMgPSBleGNsdWRlZC5zcGVudF9jZW50cyxcbiAgICAgICAgIGlucHV0X3Rva2VucyA9IGV4Y2x1ZGVkLmlucHV0X3Rva2VucyxcbiAgICAgICAgIG91dHB1dF90b2tlbnMgPSBleGNsdWRlZC5vdXRwdXRfdG9rZW5zLFxuICAgICAgICAgY2FsbHMgPSBleGNsdWRlZC5jYWxscyxcbiAgICAgICAgIHVwZGF0ZWRfYXQgPSBub3coKWAsXG4gICAgICBbYXBpX2tleV9pZCwgY3VzdG9tZXJfaWQsIG1vbnRoLCByb3cuc3BlbnRfY2VudHMgfHwgMCwgcm93LmlucHV0X3Rva2VucyB8fCAwLCByb3cub3V0cHV0X3Rva2VucyB8fCAwLCByb3cuY2FsbHMgfHwgMF1cbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIHJvdztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVmZmVjdGl2ZUNhcENlbnRzKGtleVJvdywgcm9sbHVwKSB7XG4gIGNvbnN0IGJhc2UgPSBrZXlSb3cua2V5X2NhcF9jZW50cyA/PyBrZXlSb3cuY3VzdG9tZXJfY2FwX2NlbnRzO1xuICBjb25zdCBleHRyYSA9IHJvbGx1cC5leHRyYV9jZW50cyB8fCAwO1xuICByZXR1cm4gKGJhc2UgfHwgMCkgKyBleHRyYTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1c3RvbWVyQ2FwQ2VudHMoa2V5Um93LCBjdXN0b21lclJvbGx1cCkge1xuICBjb25zdCBiYXNlID0ga2V5Um93LmN1c3RvbWVyX2NhcF9jZW50cyB8fCAwO1xuICBjb25zdCBleHRyYSA9IGN1c3RvbWVyUm9sbHVwLmV4dHJhX2NlbnRzIHx8IDA7XG4gIHJldHVybiBiYXNlICsgZXh0cmE7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBrZXlDYXBDZW50cyhrZXlSb3csIGN1c3RvbWVyUm9sbHVwKSB7XG4gIC8vIElmIGEga2V5IG92ZXJyaWRlIGV4aXN0cywgaXQncyBhIGhhcmQgY2FwIGZvciB0aGF0IGtleS4gT3RoZXJ3aXNlIGl0IGluaGVyaXRzIHRoZSBjdXN0b21lciBjYXAuXG4gIGlmIChrZXlSb3cua2V5X2NhcF9jZW50cyAhPSBudWxsKSByZXR1cm4ga2V5Um93LmtleV9jYXBfY2VudHM7XG4gIHJldHVybiBjdXN0b21lckNhcENlbnRzKGtleVJvdywgY3VzdG9tZXJSb2xsdXApO1xufVxuXG5cbmNvbnN0IFJPTEVfT1JERVIgPSBbXCJ2aWV3ZXJcIixcImRlcGxveWVyXCIsXCJhZG1pblwiLFwib3duZXJcIl07XG5cbmV4cG9ydCBmdW5jdGlvbiByb2xlQXRMZWFzdChhY3R1YWwsIHJlcXVpcmVkKSB7XG4gIGNvbnN0IGEgPSBST0xFX09SREVSLmluZGV4T2YoKGFjdHVhbCB8fCBcImRlcGxveWVyXCIpLnRvTG93ZXJDYXNlKCkpO1xuICBjb25zdCByID0gUk9MRV9PUkRFUi5pbmRleE9mKChyZXF1aXJlZCB8fCBcImRlcGxveWVyXCIpLnRvTG93ZXJDYXNlKCkpO1xuICByZXR1cm4gYSA+PSByICYmIGEgIT09IC0xICYmIHIgIT09IC0xO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVxdWlyZUtleVJvbGUoa2V5Um93LCByZXF1aXJlZFJvbGUpIHtcbiAgY29uc3QgYWN0dWFsID0gKGtleVJvdz8ucm9sZSB8fCBcImRlcGxveWVyXCIpLnRvTG93ZXJDYXNlKCk7XG4gIGlmICghcm9sZUF0TGVhc3QoYWN0dWFsLCByZXF1aXJlZFJvbGUpKSB7XG4gICAgY29uc3QgZXJyID0gbmV3IEVycm9yKFwiRm9yYmlkZGVuXCIpO1xuICAgIGVyci5zdGF0dXMgPSA0MDM7XG4gICAgZXJyLmNvZGUgPSBcIkZPUkJJRERFTlwiO1xuICAgIGVyci5oaW50ID0gYFJlcXVpcmVzIHJvbGUgJyR7cmVxdWlyZWRSb2xlfScsIGJ1dCBrZXkgcm9sZSBpcyAnJHthY3R1YWx9Jy5gO1xuICAgIHRocm93IGVycjtcbiAgfVxufVxuIiwgImltcG9ydCB7IHEgfSBmcm9tIFwiLi9kYi5qc1wiO1xuXG5sZXQgX1Vwc3Rhc2ggPSBudWxsO1xuY29uc3QgX2xpbWl0ZXJCeUxpbWl0ID0gbmV3IE1hcCgpO1xuXG5hc3luYyBmdW5jdGlvbiBsb2FkVXBzdGFzaCgpIHtcbiAgY29uc3QgdXJsID0gcHJvY2Vzcy5lbnYuVVBTVEFTSF9SRURJU19SRVNUX1VSTDtcbiAgY29uc3QgdG9rZW4gPSBwcm9jZXNzLmVudi5VUFNUQVNIX1JFRElTX1JFU1RfVE9LRU47XG4gIGlmICghdXJsIHx8ICF0b2tlbikgcmV0dXJuIG51bGw7XG5cbiAgaWYgKF9VcHN0YXNoKSByZXR1cm4gX1Vwc3Rhc2g7XG5cbiAgY29uc3QgW3sgUmF0ZWxpbWl0IH0sIHsgUmVkaXMgfV0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgaW1wb3J0KFwiQHVwc3Rhc2gvcmF0ZWxpbWl0XCIpLFxuICAgIGltcG9ydChcIkB1cHN0YXNoL3JlZGlzXCIpXG4gIF0pO1xuXG4gIF9VcHN0YXNoID0geyBSYXRlbGltaXQsIFJlZGlzIH07XG4gIHJldHVybiBfVXBzdGFzaDtcbn1cblxuZnVuY3Rpb24gaXNvUmVzZXQocmVzZXQpIHtcbiAgaWYgKCFyZXNldCkgcmV0dXJuIG51bGw7XG4gIGlmICh0eXBlb2YgcmVzZXQgPT09IFwibnVtYmVyXCIpIHJldHVybiBuZXcgRGF0ZShyZXNldCkudG9JU09TdHJpbmcoKTtcbiAgaWYgKHJlc2V0IGluc3RhbmNlb2YgRGF0ZSkgcmV0dXJuIHJlc2V0LnRvSVNPU3RyaW5nKCk7XG4gIGlmICh0eXBlb2YgcmVzZXQgPT09IFwic3RyaW5nXCIpIHJldHVybiByZXNldDtcbiAgdHJ5IHtcbiAgICBpZiAodHlwZW9mIHJlc2V0Py5nZXRUaW1lID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiBuZXcgRGF0ZShyZXNldC5nZXRUaW1lKCkpLnRvSVNPU3RyaW5nKCk7XG4gIH0gY2F0Y2gge31cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogUlBNIHJhdGUgbGltaXRpbmcuXG4gKlxuICogUHJpb3JpdHk6XG4gKiAxKSBVcHN0YXNoIHNsaWRpbmcgd2luZG93IChpZiBVUFNUQVNIX1JFRElTX1JFU1RfVVJML1RPS0VOIHByZXNlbnQpXG4gKiAyKSBEQi1iYWNrZWQgZml4ZWQgd2luZG93IChzaW1wbGUgZmFsbGJhY2spXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbmZvcmNlUnBtKHsgY3VzdG9tZXJJZCwgYXBpS2V5SWQsIHJwbU92ZXJyaWRlIH0pIHtcbiAgY29uc3QgZGVmYXVsdFJwbSA9IHBhcnNlSW50KHByb2Nlc3MuZW52LkRFRkFVTFRfUlBNX0xJTUlUIHx8IFwiMTIwXCIsIDEwKTtcbiAgY29uc3QgbGltaXQgPSBOdW1iZXIuaXNGaW5pdGUocnBtT3ZlcnJpZGUpID8gcnBtT3ZlcnJpZGUgOiBkZWZhdWx0UnBtO1xuXG4gIGlmICghTnVtYmVyLmlzRmluaXRlKGxpbWl0KSB8fCBsaW1pdCA8PSAwKSB7XG4gICAgcmV0dXJuIHsgb2s6IHRydWUsIHJlbWFpbmluZzogbnVsbCwgcmVzZXQ6IG51bGwsIG1vZGU6IFwib2ZmXCIgfTtcbiAgfVxuXG4gIGNvbnN0IHVwID0gYXdhaXQgbG9hZFVwc3Rhc2goKTtcbiAgaWYgKHVwKSB7XG4gICAgaWYgKCFfbGltaXRlckJ5TGltaXQuaGFzKGxpbWl0KSkge1xuICAgICAgY29uc3QgcmVkaXMgPSB1cC5SZWRpcy5mcm9tRW52KCk7XG4gICAgICBjb25zdCBybCA9IG5ldyB1cC5SYXRlbGltaXQoe1xuICAgICAgICByZWRpcyxcbiAgICAgICAgbGltaXRlcjogdXAuUmF0ZWxpbWl0LnNsaWRpbmdXaW5kb3cobGltaXQsIFwiNjAgc1wiKSxcbiAgICAgICAgcHJlZml4OiBcImthaXh1OnJsXCJcbiAgICAgIH0pO1xuICAgICAgX2xpbWl0ZXJCeUxpbWl0LnNldChsaW1pdCwgcmwpO1xuICAgIH1cblxuICAgIGNvbnN0IGxpbWl0ZXIgPSBfbGltaXRlckJ5TGltaXQuZ2V0KGxpbWl0KTtcbiAgICBjb25zdCBrZXkgPSBgYyR7Y3VzdG9tZXJJZH06ayR7YXBpS2V5SWR9YDtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBsaW1pdGVyLmxpbWl0KGtleSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgb2s6ICEhcmVzLnN1Y2Nlc3MsXG4gICAgICByZW1haW5pbmc6IHJlcy5yZW1haW5pbmcgPz8gbnVsbCxcbiAgICAgIHJlc2V0OiBpc29SZXNldChyZXMucmVzZXQpLFxuICAgICAgbW9kZTogXCJ1cHN0YXNoXCJcbiAgICB9O1xuICB9XG5cbiAgLy8gLS0tIERCIGZhbGxiYWNrIC0tLVxuICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICBjb25zdCB3aW5kb3dNcyA9IDYwXzAwMDtcbiAgY29uc3Qgd2luZG93U3RhcnQgPSBuZXcgRGF0ZShNYXRoLmZsb29yKG5vdyAvIHdpbmRvd01zKSAqIHdpbmRvd01zKTtcbiAgY29uc3QgcmVzZXQgPSBuZXcgRGF0ZSh3aW5kb3dTdGFydC5nZXRUaW1lKCkgKyB3aW5kb3dNcyk7XG5cbiAgY29uc3QgcmVzID0gYXdhaXQgcShcbiAgICBgaW5zZXJ0IGludG8gcmF0ZV9saW1pdF93aW5kb3dzKGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCB3aW5kb3dfc3RhcnQsIGNvdW50KVxuICAgICB2YWx1ZXMgKCQxLCQyLCQzLDEpXG4gICAgIG9uIGNvbmZsaWN0IChjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgd2luZG93X3N0YXJ0KVxuICAgICBkbyB1cGRhdGUgc2V0IGNvdW50ID0gcmF0ZV9saW1pdF93aW5kb3dzLmNvdW50ICsgMVxuICAgICByZXR1cm5pbmcgY291bnRgLFxuICAgIFtjdXN0b21lcklkLCBhcGlLZXlJZCwgd2luZG93U3RhcnRdXG4gICk7XG5cbiAgY29uc3QgY291bnQgPSByZXMucm93cz8uWzBdPy5jb3VudCA/PyAxO1xuICBjb25zdCByZW1haW5pbmcgPSBNYXRoLm1heCgwLCBsaW1pdCAtIGNvdW50KTtcblxuICBpZiAoTWF0aC5yYW5kb20oKSA8IDAuMDEpIHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgcShgZGVsZXRlIGZyb20gcmF0ZV9saW1pdF93aW5kb3dzIHdoZXJlIHdpbmRvd19zdGFydCA8IG5vdygpIC0gaW50ZXJ2YWwgJzIgaG91cnMnYCk7XG4gICAgfSBjYXRjaCB7fVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBvazogY291bnQgPD0gbGltaXQsXG4gICAgcmVtYWluaW5nLFxuICAgIHJlc2V0OiByZXNldC50b0lTT1N0cmluZygpLFxuICAgIG1vZGU6IFwiZGJcIlxuICB9O1xufVxuIiwgImltcG9ydCB7IHdyYXAgfSBmcm9tIFwiLi9fbGliL3dyYXAuanNcIjtcbmltcG9ydCB7IGJ1aWxkQ29ycywganNvbiwgYmFkUmVxdWVzdCwgZ2V0QmVhcmVyLCBtb250aEtleVVUQywgZ2V0SW5zdGFsbElkLCBnZXRDbGllbnRJcCwgZ2V0VXNlckFnZW50IH0gZnJvbSBcIi4vX2xpYi9odHRwLmpzXCI7XG5pbXBvcnQgeyBxIH0gZnJvbSBcIi4vX2xpYi9kYi5qc1wiO1xuaW1wb3J0IHsgZW5mb3JjZUthaXh1TWVzc2FnZXMsIEtBSVhVX1NZU1RFTV9IQVNILCBTQ0hFTUFfVkVSU0lPTiwgQlVJTERfSUQgfSBmcm9tIFwiLi9fbGliL2thaXh1LmpzXCI7XG5pbXBvcnQgeyByZXNvbHZlQXV0aCwgZ2V0TW9udGhSb2xsdXAsIGdldEtleU1vbnRoUm9sbHVwLCBjdXN0b21lckNhcENlbnRzLCBrZXlDYXBDZW50cyB9IGZyb20gXCIuL19saWIvYXV0aHouanNcIjtcbmltcG9ydCB7IGVuZm9yY2VScG0gfSBmcm9tIFwiLi9fbGliL3JhdGVsaW1pdC5qc1wiO1xuaW1wb3J0IHsgcmFuZG9tVVVJRCB9IGZyb20gXCJjcnlwdG9cIjtcbmltcG9ydCB7IGhtYWNTaGEyNTZIZXggfSBmcm9tIFwiLi9fbGliL2NyeXB0by5qc1wiO1xuaW1wb3J0IHsgZW5mb3JjZURldmljZSB9IGZyb20gXCIuL19saWIvZGV2aWNlcy5qc1wiO1xuaW1wb3J0IHsgYXNzZXJ0QWxsb3dlZCB9IGZyb20gXCIuL19saWIvYWxsb3dsaXN0LmpzXCI7XG5cbmZ1bmN0aW9uIHNpdGVPcmlnaW4ocmVxKSB7XG4gIGNvbnN0IHVybEVudiA9IHByb2Nlc3MuZW52LlVSTCB8fCBwcm9jZXNzLmVudi5ERVBMT1lfUFJJTUVfVVJMIHx8IHByb2Nlc3MuZW52LkRFUExPWV9VUkw7XG4gIGlmICh1cmxFbnYpIHJldHVybiB1cmxFbnYucmVwbGFjZSgvXFwvJC8sIFwiXCIpO1xuICB0cnkgeyByZXR1cm4gbmV3IFVSTChyZXEudXJsKS5vcmlnaW47IH0gY2F0Y2ggeyByZXR1cm4gXCJcIjsgfVxufVxuXG5leHBvcnQgZGVmYXVsdCB3cmFwKGFzeW5jIChyZXEpID0+IHtcbiAgY29uc3QgY29ycyA9IGJ1aWxkQ29ycyhyZXEpO1xuICBpZiAocmVxLm1ldGhvZCA9PT0gXCJPUFRJT05TXCIpIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwNCwgaGVhZGVyczogY29ycyB9KTtcbiAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSByZXR1cm4ganNvbig0MDUsIHsgZXJyb3I6IFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIgfSwgY29ycyk7XG5cbiAgY29uc3Qga2V5ID0gZ2V0QmVhcmVyKHJlcSk7XG4gIGlmICgha2V5KSByZXR1cm4ganNvbig0MDEsIHsgZXJyb3I6IFwiTWlzc2luZyBBdXRob3JpemF0aW9uOiBCZWFyZXIgPHZpcnR1YWxfa2V5PlwiIH0sIGNvcnMpO1xuXG4gIGxldCBib2R5O1xuICB0cnkgeyBib2R5ID0gYXdhaXQgcmVxLmpzb24oKTsgfSBjYXRjaCB7IHJldHVybiBiYWRSZXF1ZXN0KFwiSW52YWxpZCBKU09OXCIsIGNvcnMpOyB9XG5cbiAgY29uc3QgcHJvdmlkZXIgPSAoYm9keS5wcm92aWRlciB8fCBcIlwiKS50b1N0cmluZygpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBtb2RlbCA9IChib2R5Lm1vZGVsIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpO1xuICBjb25zdCBtZXNzYWdlc19pbiA9IGJvZHkubWVzc2FnZXM7XG4gIGNvbnN0IG1heF90b2tlbnMgPSBOdW1iZXIuaXNGaW5pdGUoYm9keS5tYXhfdG9rZW5zKSA/IHBhcnNlSW50KGJvZHkubWF4X3Rva2VucywgMTApIDogNDA5NjtcbiAgY29uc3QgdGVtcGVyYXR1cmUgPSBOdW1iZXIuaXNGaW5pdGUoYm9keS50ZW1wZXJhdHVyZSkgPyBib2R5LnRlbXBlcmF0dXJlIDogMTtcblxuICBpZiAoIXByb3ZpZGVyKSByZXR1cm4gYmFkUmVxdWVzdChcIk1pc3NpbmcgcHJvdmlkZXIgKG9wZW5haXxhbnRocm9waWN8Z2VtaW5pKVwiLCBjb3JzKTtcbiAgaWYgKCFtb2RlbCkgcmV0dXJuIGJhZFJlcXVlc3QoXCJNaXNzaW5nIG1vZGVsXCIsIGNvcnMpO1xuICBpZiAoIUFycmF5LmlzQXJyYXkobWVzc2FnZXNfaW4pIHx8IG1lc3NhZ2VzX2luLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGJhZFJlcXVlc3QoXCJNaXNzaW5nIG1lc3NhZ2VzW11cIiwgY29ycyk7XG5cbiAgY29uc3QgbWVzc2FnZXMgPSBlbmZvcmNlS2FpeHVNZXNzYWdlcyhtZXNzYWdlc19pbik7XG5cbiAgY29uc3Qga2V5Um93ID0gYXdhaXQgcmVzb2x2ZUF1dGgoa2V5KTtcbiAgaWYgKCFrZXlSb3cpIHJldHVybiBqc29uKDQwMSwgeyBlcnJvcjogXCJJbnZhbGlkIG9yIHJldm9rZWQga2V5XCIgfSwgY29ycyk7XG4gIGlmICgha2V5Um93LmlzX2FjdGl2ZSkgcmV0dXJuIGpzb24oNDAzLCB7IGVycm9yOiBcIkN1c3RvbWVyIGRpc2FibGVkXCIgfSwgY29ycyk7XG5cbiAgY29uc3QgaW5zdGFsbF9pZCA9IGdldEluc3RhbGxJZChyZXEpO1xuICBjb25zdCB1YSA9IGdldFVzZXJBZ2VudChyZXEpO1xuICBjb25zdCBpcCA9IGdldENsaWVudElwKHJlcSk7XG4gIGNvbnN0IGlwX2hhc2ggPSBpcCA/IGhtYWNTaGEyNTZIZXgocHJvY2Vzcy5lbnYuS0VZX1BFUFBFUiB8fCBwcm9jZXNzLmVudi5KV1RfU0VDUkVUIHx8IFwia2FpeHVcIiwgaXApIDogbnVsbDtcblxuICBjb25zdCBhbGxvdyA9IGFzc2VydEFsbG93ZWQoeyBwcm92aWRlciwgbW9kZWwsIGtleVJvdyB9KTtcbiAgaWYgKCFhbGxvdy5vaykgcmV0dXJuIGpzb24oYWxsb3cuc3RhdHVzIHx8IDQwMywgeyBlcnJvcjogYWxsb3cuZXJyb3IgfSwgY29ycyk7XG5cbiAgY29uc3QgZGV2ID0gYXdhaXQgZW5mb3JjZURldmljZSh7IGtleVJvdywgaW5zdGFsbF9pZCwgdWEsIGFjdG9yOiAnam9iX3N1Ym1pdCcgfSk7XG4gIGlmICghZGV2Lm9rKSByZXR1cm4ganNvbihkZXYuc3RhdHVzIHx8IDQwMywgeyBlcnJvcjogZGV2LmVycm9yIH0sIGNvcnMpO1xuXG4gIC8vIExpZ2h0IHJhdGUtbGltaXQgb24gc3VibWl0IChwcmV2ZW50cyBlbnF1ZXVlIHNwYW0pXG4gIGNvbnN0IHJsID0gYXdhaXQgZW5mb3JjZVJwbSh7IGN1c3RvbWVySWQ6IGtleVJvdy5jdXN0b21lcl9pZCwgYXBpS2V5SWQ6IGtleVJvdy5hcGlfa2V5X2lkLCBycG1PdmVycmlkZTogTWF0aC5taW4oa2V5Um93LnJwbV9saW1pdCB8fCA2MCwgNjApIH0pO1xuICBpZiAoIXJsLm9rKSB7XG4gICAgcmV0dXJuIGpzb24oNDI5LCB7IGVycm9yOiBcIlJhdGUgbGltaXQgZXhjZWVkZWRcIiwgcmF0ZWxpbWl0OiB7IHJlbWFpbmluZzogcmwucmVtYWluaW5nLCByZXNldDogcmwucmVzZXQgfSB9LCBjb3JzKTtcbiAgfVxuXG4gIC8vIENhcCBnYXRlICh3ZSBkb24ndCBrbm93IGpvYiBjb3N0IHlldCwgYnV0IGlmIHlvdSdyZSBhbHJlYWR5IGNhcHBlZCwgZG9uJ3QgZW5xdWV1ZSlcbiAgY29uc3QgbW9udGggPSBtb250aEtleVVUQygpO1xuICBjb25zdCBjdXN0Um9sbCA9IGF3YWl0IGdldE1vbnRoUm9sbHVwKGtleVJvdy5jdXN0b21lcl9pZCwgbW9udGgpO1xuICBjb25zdCBrZXlSb2xsID0gYXdhaXQgZ2V0S2V5TW9udGhSb2xsdXAoa2V5Um93LmFwaV9rZXlfaWQsIG1vbnRoKTtcbiAgY29uc3QgY3VzdG9tZXJfY2FwX2NlbnRzID0gY3VzdG9tZXJDYXBDZW50cyhrZXlSb3csIGN1c3RSb2xsKTtcbiAgY29uc3Qga2V5X2NhcF9jZW50cyA9IGtleUNhcENlbnRzKGtleVJvdywgY3VzdFJvbGwpO1xuXG4gIGlmICgoY3VzdFJvbGwuc3BlbnRfY2VudHMgfHwgMCkgPj0gY3VzdG9tZXJfY2FwX2NlbnRzKSB7XG4gICAgcmV0dXJuIGpzb24oNDAyLCB7IGVycm9yOiBcIk1vbnRobHkgY2FwIHJlYWNoZWRcIiwgc2NvcGU6IFwiY3VzdG9tZXJcIiwgbW9udGgsIGNhcF9jZW50czogY3VzdG9tZXJfY2FwX2NlbnRzLCBzcGVudF9jZW50czogY3VzdFJvbGwuc3BlbnRfY2VudHMgfHwgMCB9LCBjb3JzKTtcbiAgfVxuICBpZiAoKGtleVJvbGwuc3BlbnRfY2VudHMgfHwgMCkgPj0ga2V5X2NhcF9jZW50cykge1xuICAgIHJldHVybiBqc29uKDQwMiwgeyBlcnJvcjogXCJNb250aGx5IGNhcCByZWFjaGVkXCIsIHNjb3BlOiBcImtleVwiLCBtb250aCwgY2FwX2NlbnRzOiBrZXlfY2FwX2NlbnRzLCBzcGVudF9jZW50czoga2V5Um9sbC5zcGVudF9jZW50cyB8fCAwIH0sIGNvcnMpO1xuICB9XG5cbiAgY29uc3Qgam9iX2lkID0gcmFuZG9tVVVJRCgpO1xuICBjb25zdCByZXF1ZXN0ID0geyBwcm92aWRlciwgbW9kZWwsIG1lc3NhZ2VzLCBtYXhfdG9rZW5zLCB0ZW1wZXJhdHVyZSB9O1xuXG4gIGF3YWl0IHEoXG4gICAgYGluc2VydCBpbnRvIGFzeW5jX2pvYnMoaWQsIGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCBwcm92aWRlciwgbW9kZWwsIHJlcXVlc3QsIHN0YXR1cywgbWV0YSlcbiAgICAgdmFsdWVzICgkMSwkMiwkMywkNCwkNSwkNjo6anNvbmIsJ3F1ZXVlZCcsJDc6Ompzb25iKWAsXG4gICAgW1xuICAgICAgam9iX2lkLFxuICAgICAga2V5Um93LmN1c3RvbWVyX2lkLFxuICAgICAga2V5Um93LmFwaV9rZXlfaWQsXG4gICAgICBwcm92aWRlcixcbiAgICAgIG1vZGVsLFxuICAgICAgSlNPTi5zdHJpbmdpZnkocmVxdWVzdCksXG4gICAgICBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGthaXh1X3N5c3RlbV9oYXNoOiBLQUlYVV9TWVNURU1fSEFTSCxcbiAgICAgICAgdGVsZW1ldHJ5OiB7IGluc3RhbGxfaWQ6IGluc3RhbGxfaWQgfHwgbnVsbCwgaXBfaGFzaDogaXBfaGFzaCB8fCBudWxsLCB1YTogdWEgfHwgbnVsbCB9LFxuICAgICAgICBjbGllbnQ6IHtcbiAgICAgICAgICBhcHBfaWQ6IChyZXEuaGVhZGVycy5nZXQoXCJ4LWthaXh1LWFwcFwiKSB8fCBcIlwiKS50b1N0cmluZygpLnNsaWNlKDAsIDEyMCkgfHwgbnVsbCxcbiAgICAgICAgICBidWlsZF9pZDogKHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtYnVpbGRcIikgfHwgXCJcIikudG9TdHJpbmcoKS5zbGljZSgwLCAxMjApIHx8IG51bGxcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICBdXG4gICk7XG5cbiAgLy8gS2ljayBvZmYgdGhlIGJhY2tncm91bmQgd29ya2VyIGZyb20gc2VydmVyLXNpZGUgKGJyb3dzZXIgY2FuJ3QgaW52b2tlIGJhY2tncm91bmQgZnVuY3Rpb25zIGRpcmVjdGx5KS5cbiAgY29uc3QgYmFzZSA9IG5ldyBVUkwocmVxLnVybCk7XG4gIGNvbnN0IHdvcmtlclVybCA9IG5ldyBVUkwoXCIvLm5ldGxpZnkvZnVuY3Rpb25zL2dhdGV3YXktam9iLXJ1bi1iYWNrZ3JvdW5kXCIsIGJhc2UpO1xuICBjb25zdCBzZWNyZXQgPSAocHJvY2Vzcy5lbnYuSk9CX1dPUktFUl9TRUNSRVQgfHwgXCJcIikudHJpbSgpO1xuXG4gIC8vIEZpcmUtYW5kLWZvcmdldDsgZXZlbiBpZiB0aGlzIGZldGNoIGZhaWxzLCB0aGUgam9iIGlzIHF1ZXVlZCBhbmQgY2FuIGJlIHJlLWtpY2tlZCBieSBjYWxsaW5nIC9zdGF0dXM/a2ljaz0xLlxuICB0cnkge1xuICAgIGF3YWl0IGZldGNoKHdvcmtlclVybC50b1N0cmluZygpLCB7XG4gICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgLi4uKHNlY3JldCA/IHsgXCJ4LWthaXh1LWpvYi1zZWNyZXRcIjogc2VjcmV0IH0gOiB7IFwiYXV0aG9yaXphdGlvblwiOiBgQmVhcmVyICR7a2V5fWAgfSlcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGlkOiBqb2JfaWQgfSlcbiAgICB9KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUud2FybihcIkpvYiB3b3JrZXIgaW52b2tlIGZhaWxlZDpcIiwgZT8ubWVzc2FnZSB8fCBlKTtcbiAgfVxuXG4gIGNvbnN0IG9yaWdpbiA9IHNpdGVPcmlnaW4ocmVxKTtcbiAgY29uc3Qgc3RhdHVzX3VybCA9IGAke29yaWdpbn0vLm5ldGxpZnkvZnVuY3Rpb25zL2dhdGV3YXktam9iLXN0YXR1cz9pZD0ke2VuY29kZVVSSUNvbXBvbmVudChqb2JfaWQpfWA7XG4gIGNvbnN0IHJlc3VsdF91cmwgPSBgJHtvcmlnaW59Ly5uZXRsaWZ5L2Z1bmN0aW9ucy9nYXRld2F5LWpvYi1yZXN1bHQ/aWQ9JHtlbmNvZGVVUklDb21wb25lbnQoam9iX2lkKX1gO1xuXG4gIHJldHVybiBqc29uKDIwMiwge1xuICAgIGpvYl9pZCxcbiAgICBzdGF0dXNfdXJsLFxuICAgIHJlc3VsdF91cmwsXG4gICAgYnVpbGQ6IHsgaWQ6IEJVSUxEX0lELCBzY2hlbWE6IFNDSEVNQV9WRVJTSU9OLCBrYWl4dV9zeXN0ZW1faGFzaDogS0FJWFVfU1lTVEVNX0hBU0ggfSxcbiAgICBub3RlOiBcIkpvYiBhY2NlcHRlZC4gUG9sbCBzdGF0dXNfdXJsIHVudGlsIHN0YXR1cz09PSdzdWNjZWVkZWQnLCB0aGVuIEdFVCByZXN1bHRfdXJsLlwiXG4gIH0sIGNvcnMpO1xufSk7XG4iLCAiaW1wb3J0IHsgcSB9IGZyb20gJy4vZGIuanMnO1xuXG4vKipcbiAqIEVuZm9yY2UgaW5zdGFsbC9kZXZpY2UgYmluZGluZyBhbmQgc2VhdCBsaW1pdHMuXG4gKlxuICogSW5wdXRzOlxuICogLSBrZXlSb3cgY29udGFpbnM6IGFwaV9rZXlfaWQsIGN1c3RvbWVyX2lkXG4gKiAtIGluc3RhbGxfaWQ6IHN0cmluZ3xudWxsXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbmZvcmNlRGV2aWNlKHsga2V5Um93LCBpbnN0YWxsX2lkLCB1YSwgYWN0b3IgPSAnZ2F0ZXdheScgfSkge1xuICBjb25zdCByZXF1aXJlSW5zdGFsbCA9ICEhKGtleVJvdy5yZXF1aXJlX2luc3RhbGxfaWQgfHwga2V5Um93LmN1c3RvbWVyX3JlcXVpcmVfaW5zdGFsbF9pZCk7XG4gIGNvbnN0IG1heERldmljZXMgPSAoTnVtYmVyLmlzRmluaXRlKGtleVJvdy5tYXhfZGV2aWNlcykgPyBrZXlSb3cubWF4X2RldmljZXMgOiBudWxsKSA/PyAoTnVtYmVyLmlzRmluaXRlKGtleVJvdy5jdXN0b21lcl9tYXhfZGV2aWNlc19wZXJfa2V5KSA/IGtleVJvdy5jdXN0b21lcl9tYXhfZGV2aWNlc19wZXJfa2V5IDogbnVsbCk7XG5cbiAgaWYgKChyZXF1aXJlSW5zdGFsbCB8fCAobWF4RGV2aWNlcyAhPSBudWxsICYmIG1heERldmljZXMgPiAwKSkgJiYgIWluc3RhbGxfaWQpIHtcbiAgICByZXR1cm4geyBvazogZmFsc2UsIHN0YXR1czogNDAwLCBlcnJvcjogJ01pc3NpbmcgeC1rYWl4dS1pbnN0YWxsLWlkIChyZXF1aXJlZCBmb3IgdGhpcyBrZXkpJyB9O1xuICB9XG5cbiAgLy8gTm8gaW5zdGFsbCBpZCBhbmQgbm8gZW5mb3JjZW1lbnRcbiAgaWYgKCFpbnN0YWxsX2lkKSByZXR1cm4geyBvazogdHJ1ZSB9O1xuXG4gIC8vIExvYWQgZXhpc3RpbmcgcmVjb3JkXG4gIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcShcbiAgICBgc2VsZWN0IGFwaV9rZXlfaWQsIGluc3RhbGxfaWQsIGZpcnN0X3NlZW5fYXQsIGxhc3Rfc2Vlbl9hdCwgcmV2b2tlZF9hdFxuICAgICBmcm9tIGtleV9kZXZpY2VzXG4gICAgIHdoZXJlIGFwaV9rZXlfaWQ9JDEgYW5kIGluc3RhbGxfaWQ9JDJcbiAgICAgbGltaXQgMWAsXG4gICAgW2tleVJvdy5hcGlfa2V5X2lkLCBpbnN0YWxsX2lkXVxuICApO1xuXG4gIGlmIChleGlzdGluZy5yb3dDb3VudCkge1xuICAgIGNvbnN0IHJvdyA9IGV4aXN0aW5nLnJvd3NbMF07XG4gICAgaWYgKHJvdy5yZXZva2VkX2F0KSB7XG4gICAgICByZXR1cm4geyBvazogZmFsc2UsIHN0YXR1czogNDAzLCBlcnJvcjogJ0RldmljZSByZXZva2VkIGZvciB0aGlzIGtleScgfTtcbiAgICB9XG4gICAgLy8gVXBkYXRlIGxhc3Qgc2VlbiAoYmVzdC1lZmZvcnQpXG4gICAgYXdhaXQgcShcbiAgICAgIGB1cGRhdGUga2V5X2RldmljZXMgc2V0IGxhc3Rfc2Vlbl9hdD1ub3coKSwgbGFzdF9zZWVuX3VhPWNvYWxlc2NlKCQzLGxhc3Rfc2Vlbl91YSlcbiAgICAgICB3aGVyZSBhcGlfa2V5X2lkPSQxIGFuZCBpbnN0YWxsX2lkPSQyYCxcbiAgICAgIFtrZXlSb3cuYXBpX2tleV9pZCwgaW5zdGFsbF9pZCwgdWEgfHwgbnVsbF1cbiAgICApO1xuICAgIHJldHVybiB7IG9rOiB0cnVlIH07XG4gIH1cblxuICAvLyBOZXcgZGV2aWNlOiBzZWF0IGNoZWNrXG4gIGlmIChtYXhEZXZpY2VzICE9IG51bGwgJiYgbWF4RGV2aWNlcyA+IDApIHtcbiAgICBjb25zdCBhY3RpdmVDb3VudCA9IGF3YWl0IHEoXG4gICAgICBgc2VsZWN0IGNvdW50KCopOjppbnQgYXMgblxuICAgICAgIGZyb20ga2V5X2RldmljZXNcbiAgICAgICB3aGVyZSBhcGlfa2V5X2lkPSQxIGFuZCByZXZva2VkX2F0IGlzIG51bGxgLFxuICAgICAgW2tleVJvdy5hcGlfa2V5X2lkXVxuICAgICk7XG4gICAgY29uc3QgbiA9IGFjdGl2ZUNvdW50LnJvd3M/LlswXT8ubiA/PyAwO1xuICAgIGlmIChuID49IG1heERldmljZXMpIHtcbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgc3RhdHVzOiA0MDMsIGVycm9yOiBgRGV2aWNlIGxpbWl0IHJlYWNoZWQgKCR7bn0vJHttYXhEZXZpY2VzfSkuIFJldm9rZSBhbiBvbGQgZGV2aWNlIG9yIHJhaXNlIHNlYXRzLmAgfTtcbiAgICB9XG4gIH1cblxuICAvLyBJbnNlcnQgbmV3IGRldmljZVxuICBhd2FpdCBxKFxuICAgIGBpbnNlcnQgaW50byBrZXlfZGV2aWNlcyhhcGlfa2V5X2lkLCBjdXN0b21lcl9pZCwgaW5zdGFsbF9pZCwgbGFzdF9zZWVuX2F0LCBsYXN0X3NlZW5fdWEpXG4gICAgIHZhbHVlcyAoJDEsJDIsJDMsbm93KCksJDQpXG4gICAgIG9uIGNvbmZsaWN0IChhcGlfa2V5X2lkLCBpbnN0YWxsX2lkKVxuICAgICBkbyB1cGRhdGUgc2V0IGxhc3Rfc2Vlbl9hdD1leGNsdWRlZC5sYXN0X3NlZW5fYXQsIGxhc3Rfc2Vlbl91YT1jb2FsZXNjZShleGNsdWRlZC5sYXN0X3NlZW5fdWEsa2V5X2RldmljZXMubGFzdF9zZWVuX3VhKWAsXG4gICAgW2tleVJvdy5hcGlfa2V5X2lkLCBrZXlSb3cuY3VzdG9tZXJfaWQsIGluc3RhbGxfaWQsIHVhIHx8IG51bGxdXG4gICk7XG5cbiAgcmV0dXJuIHsgb2s6IHRydWUgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxpc3REZXZpY2VzRm9yS2V5KGFwaV9rZXlfaWQsIGxpbWl0ID0gMjAwKSB7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBhcGlfa2V5X2lkLCBpbnN0YWxsX2lkLCBkZXZpY2VfbGFiZWwsIGZpcnN0X3NlZW5fYXQsIGxhc3Rfc2Vlbl9hdCwgcmV2b2tlZF9hdCwgcmV2b2tlZF9ieSwgbGFzdF9zZWVuX3VhXG4gICAgIGZyb20ga2V5X2RldmljZXNcbiAgICAgd2hlcmUgYXBpX2tleV9pZD0kMVxuICAgICBvcmRlciBieSBsYXN0X3NlZW5fYXQgZGVzYyBudWxscyBsYXN0LCBmaXJzdF9zZWVuX2F0IGRlc2NcbiAgICAgbGltaXQgJDJgLFxuICAgIFthcGlfa2V5X2lkLCBsaW1pdF1cbiAgKTtcbiAgcmV0dXJuIHJlcy5yb3dzO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0RGV2aWNlUmV2b2tlZCh7IGFwaV9rZXlfaWQsIGluc3RhbGxfaWQsIHJldm9rZWQsIGFjdG9yID0gJ2FkbWluJyB9KSB7XG4gIGlmIChyZXZva2VkKSB7XG4gICAgYXdhaXQgcShcbiAgICAgIGB1cGRhdGUga2V5X2RldmljZXNcbiAgICAgICBzZXQgcmV2b2tlZF9hdD1ub3coKSwgcmV2b2tlZF9ieT0kM1xuICAgICAgIHdoZXJlIGFwaV9rZXlfaWQ9JDEgYW5kIGluc3RhbGxfaWQ9JDIgYW5kIHJldm9rZWRfYXQgaXMgbnVsbGAsXG4gICAgICBbYXBpX2tleV9pZCwgaW5zdGFsbF9pZCwgYWN0b3JdXG4gICAgKTtcbiAgfSBlbHNlIHtcbiAgICBhd2FpdCBxKFxuICAgICAgYHVwZGF0ZSBrZXlfZGV2aWNlc1xuICAgICAgIHNldCByZXZva2VkX2F0PW51bGwsIHJldm9rZWRfYnk9bnVsbFxuICAgICAgIHdoZXJlIGFwaV9rZXlfaWQ9JDEgYW5kIGluc3RhbGxfaWQ9JDIgYW5kIHJldm9rZWRfYXQgaXMgbm90IG51bGxgLFxuICAgICAgW2FwaV9rZXlfaWQsIGluc3RhbGxfaWRdXG4gICAgKTtcbiAgfVxufVxuIiwgImZ1bmN0aW9uIG5vcm1BcnJheShhKSB7XG4gIGlmICghYSkgcmV0dXJuIG51bGw7XG4gIGlmIChBcnJheS5pc0FycmF5KGEpKSByZXR1cm4gYS5tYXAoU3RyaW5nKS5tYXAocz0+cy50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcbiAgaWYgKHR5cGVvZiBhID09PSAnc3RyaW5nJykgcmV0dXJuIGEuc3BsaXQoJywnKS5tYXAocz0+cy50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogQWxsb3dlZCBtb2RlbHMgc2hhcGUgKEpTT04pOlxuICogLSB7IFwib3BlbmFpXCI6IFtcImdwdC00by1taW5pXCIsXCJncHQtNC4xXCJdLCBcImFudGhyb3BpY1wiOiBbXCJjbGF1ZGUtMy01LXNvbm5ldC0yMDI0MTAyMlwiXSwgXCJnZW1pbmlcIjogW1wiZ2VtaW5pLTEuNS1mbGFzaFwiIF0gfVxuICogLSBPUiB7IFwiKlwiOiBbXCIqXCJdIH0gdG8gYWxsb3cgYWxsXG4gKiAtIE9SIHsgXCJvcGVuYWlcIjogW1wiKlwiXSB9IHRvIGFsbG93IGFueSBtb2RlbCB3aXRoaW4gdGhhdCBwcm92aWRlclxuICovXG5mdW5jdGlvbiBwYXJzZUFsbG93ZWRNb2RlbHMobSkge1xuICBpZiAoIW0pIHJldHVybiBudWxsO1xuICBpZiAodHlwZW9mIG0gPT09ICdvYmplY3QnKSByZXR1cm4gbTtcbiAgdHJ5IHsgcmV0dXJuIEpTT04ucGFyc2UoU3RyaW5nKG0pKTsgfSBjYXRjaCB7IHJldHVybiBudWxsOyB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlZmZlY3RpdmVBbGxvd2xpc3Qoa2V5Um93KSB7XG4gIGNvbnN0IHByb3ZpZGVycyA9IG5vcm1BcnJheShrZXlSb3cuYWxsb3dlZF9wcm92aWRlcnMpID8/IG5vcm1BcnJheShrZXlSb3cuY3VzdG9tZXJfYWxsb3dlZF9wcm92aWRlcnMpO1xuICBjb25zdCBtb2RlbHMgPSBwYXJzZUFsbG93ZWRNb2RlbHMoa2V5Um93LmFsbG93ZWRfbW9kZWxzKSA/PyBwYXJzZUFsbG93ZWRNb2RlbHMoa2V5Um93LmN1c3RvbWVyX2FsbG93ZWRfbW9kZWxzKTtcbiAgcmV0dXJuIHsgcHJvdmlkZXJzLCBtb2RlbHMgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydEFsbG93ZWQoeyBwcm92aWRlciwgbW9kZWwsIGtleVJvdyB9KSB7XG4gIGNvbnN0IHsgcHJvdmlkZXJzLCBtb2RlbHMgfSA9IGVmZmVjdGl2ZUFsbG93bGlzdChrZXlSb3cpO1xuXG4gIGlmIChwcm92aWRlcnMgJiYgcHJvdmlkZXJzLmxlbmd0aCkge1xuICAgIGlmICghcHJvdmlkZXJzLmluY2x1ZGVzKCcqJykgJiYgIXByb3ZpZGVycy5pbmNsdWRlcyhwcm92aWRlcikpIHtcbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgc3RhdHVzOiA0MDMsIGVycm9yOiBgUHJvdmlkZXIgbm90IGFsbG93ZWQgZm9yIHRoaXMga2V5ICgke3Byb3ZpZGVyfSlgIH07XG4gICAgfVxuICB9XG5cbiAgaWYgKG1vZGVscykge1xuICAgIC8vIGdsb2JhbCBhbGxvd1xuICAgIGlmIChtb2RlbHNbJyonXSkge1xuICAgICAgY29uc3QgYXJyID0gbm9ybUFycmF5KG1vZGVsc1snKiddKTtcbiAgICAgIGlmIChhcnIgJiYgYXJyLmluY2x1ZGVzKCcqJykpIHJldHVybiB7IG9rOiB0cnVlIH07XG4gICAgfVxuXG4gICAgY29uc3QgbGlzdCA9IG1vZGVsc1twcm92aWRlcl07XG4gICAgaWYgKGxpc3QpIHtcbiAgICAgIGNvbnN0IGFyciA9IG5vcm1BcnJheShsaXN0KSB8fCBbXTtcbiAgICAgIGlmIChhcnIuaW5jbHVkZXMoJyonKSkgcmV0dXJuIHsgb2s6IHRydWUgfTtcbiAgICAgIGlmICghYXJyLmluY2x1ZGVzKG1vZGVsKSkge1xuICAgICAgICByZXR1cm4geyBvazogZmFsc2UsIHN0YXR1czogNDAzLCBlcnJvcjogYE1vZGVsIG5vdCBhbGxvd2VkIGZvciB0aGlzIGtleSAoJHtwcm92aWRlcn06JHttb2RlbH0pYCB9O1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBJZiBhIG1vZGVscyBvYmplY3QgZXhpc3RzIGJ1dCBkb2Vzbid0IGluY2x1ZGUgcHJvdmlkZXIsIHRyZWF0IGFzIGRlbnkuXG4gICAgICByZXR1cm4geyBvazogZmFsc2UsIHN0YXR1czogNDAzLCBlcnJvcjogYFByb3ZpZGVyIG5vdCBhbGxvd2VkIGJ5IG1vZGVsIGFsbG93bGlzdCAoJHtwcm92aWRlcn0pYCB9O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7IG9rOiB0cnVlIH07XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7O0FBQU8sU0FBUyxVQUFVLEtBQUs7QUFDN0IsUUFBTSxZQUFZLFFBQVEsSUFBSSxtQkFBbUIsSUFBSSxLQUFLO0FBQzFELFFBQU0sWUFBWSxJQUFJLFFBQVEsSUFBSSxRQUFRLEtBQUssSUFBSSxRQUFRLElBQUksUUFBUTtBQUd2RSxRQUFNLGVBQWU7QUFDckIsUUFBTSxlQUFlO0FBRXJCLFFBQU0sT0FBTztBQUFBLElBQ1gsZ0NBQWdDO0FBQUEsSUFDaEMsZ0NBQWdDO0FBQUEsSUFDaEMsaUNBQWlDO0FBQUEsSUFDakMsMEJBQTBCO0FBQUEsRUFDNUI7QUFLQSxNQUFJLENBQUMsVUFBVTtBQUViLFdBQU87QUFBQSxNQUNMLEdBQUc7QUFBQSxNQUNILEdBQUksWUFBWSxFQUFFLE1BQU0sU0FBUyxJQUFJLENBQUM7QUFBQSxJQUN4QztBQUFBLEVBQ0Y7QUFFQSxRQUFNLFVBQVUsU0FBUyxNQUFNLEdBQUcsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxFQUFFLE9BQU8sT0FBTztBQUd2RSxNQUFJLFFBQVEsU0FBUyxHQUFHLEdBQUc7QUFDekIsVUFBTSxTQUFTLGFBQWE7QUFDNUIsV0FBTztBQUFBLE1BQ0wsR0FBRztBQUFBLE1BQ0gsK0JBQStCO0FBQUEsTUFDL0IsR0FBSSxZQUFZLEVBQUUsTUFBTSxTQUFTLElBQUksQ0FBQztBQUFBLElBQ3hDO0FBQUEsRUFDRjtBQUdBLE1BQUksYUFBYSxRQUFRLFNBQVMsU0FBUyxHQUFHO0FBQzVDLFdBQU87QUFBQSxNQUNMLEdBQUc7QUFBQSxNQUNILCtCQUErQjtBQUFBLE1BQy9CLE1BQU07QUFBQSxJQUNSO0FBQUEsRUFDRjtBQUdBLFNBQU87QUFBQSxJQUNMLEdBQUc7QUFBQSxJQUNILEdBQUksWUFBWSxFQUFFLE1BQU0sU0FBUyxJQUFJLENBQUM7QUFBQSxFQUN4QztB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O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVFBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BT0E7QUFBQSxNQUEyRztBQUFBLE1BQzNHO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVlBO0FBQUEsTUFDQTtBQUFBO0FBQUEsTUFHQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFRQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFtQkE7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQStCQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUdBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFNQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1Ba0JBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFlQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU9BO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVlBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVNBO0FBQUE7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFPQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFB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
