
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

// netlify/functions/_lib/providers.js
function configError2(message, hint) {
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
async function streamOpenAI({ model, messages, max_tokens, temperature }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw configError2("OPENAI_API_KEY not configured", "Set OPENAI_API_KEY in Netlify \u2192 Site configuration \u2192 Environment variables (your OpenAI API key).");
  const input = Array.isArray(messages) ? messages.map((m) => ({
    role: m.role,
    content: [{ type: "input_text", text: String(m.content ?? "") }]
  })) : [];
  const body = {
    model,
    input,
    temperature: typeof temperature === "number" ? temperature : 1,
    max_output_tokens: typeof max_tokens === "number" ? max_tokens : 1024,
    store: false,
    stream: true
  };
  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json",
      "accept": "text/event-stream"
    },
    body: JSON.stringify(body)
  });
  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    throw new Error(data?.error?.message || `OpenAI error ${upstream.status}`);
  }
  function parseSseLines(chunkText) {
    const out = [];
    const lines = chunkText.split(/\r?\n/);
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload);
        const t = obj.type || "";
        if (t.includes("output_text.delta") && typeof obj.delta === "string") out.push({ type: "delta", text: obj.delta });
        if (t === "response.completed" || t === "response.complete" || t.includes("response.completed")) {
          const usage = obj.response?.usage || obj.usage || {};
          out.push({ type: "done", usage: { input_tokens: usage.input_tokens || 0, output_tokens: usage.output_tokens || 0 } });
        }
      } catch {
      }
    }
    return out;
  }
  return { upstream, parse: parseSseLines };
}
async function streamAnthropic({ model, messages, max_tokens, temperature }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw configError2("ANTHROPIC_API_KEY not configured", "Set ANTHROPIC_API_KEY in Netlify \u2192 Site configuration \u2192 Environment variables (your Anthropic API key).");
  const systemParts = [];
  const outMsgs = [];
  const msgs = Array.isArray(messages) ? messages : [];
  for (const m of msgs) {
    const role = String(m.role || "").toLowerCase();
    const text = String(m.content ?? "");
    if (!text) continue;
    if (role === "system" || role === "developer") systemParts.push(text);
    else if (role === "assistant") outMsgs.push({ role: "assistant", content: text });
    else outMsgs.push({ role: "user", content: text });
  }
  const body = {
    model,
    max_tokens: typeof max_tokens === "number" ? max_tokens : 1024,
    temperature: typeof temperature === "number" ? temperature : 1,
    stream: true,
    messages: outMsgs
  };
  if (systemParts.length) body.system = systemParts.join("\n\n");
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "accept": "text/event-stream"
    },
    body: JSON.stringify(body)
  });
  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    throw new Error(data?.error?.message || `Anthropic error ${upstream.status}`);
  }
  function parseSseLines(chunkText) {
    const out = [];
    const lines = chunkText.split(/\r?\n/);
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload);
        const t = obj.type || "";
        if (t === "content_block_delta" && obj.delta?.type === "text_delta" && typeof obj.delta.text === "string") {
          out.push({ type: "delta", text: obj.delta.text });
        }
        if (t === "message_delta" && obj.usage) {
        }
        if (t === "message_stop" || t === "message_end" || t === "message_complete") {
          const usage = obj.usage || {};
          out.push({ type: "done", usage: { input_tokens: usage.input_tokens || 0, output_tokens: usage.output_tokens || 0 } });
        }
      } catch {
      }
    }
    return out;
  }
  return { upstream, parse: parseSseLines };
}
async function streamGemini({ model, messages, max_tokens, temperature }) {
  const apiKeyRaw = process.env.GEMINI_API_KEY_LOCAL || process.env.GEMINI_API_KEY;
  const apiKey = String(apiKeyRaw || "").trim().replace(/^"(.*)"$/, "$1").trim();
  if (!apiKey) throw configError2("GEMINI_API_KEY not configured", "Set GEMINI_API_KEY (or for local dev: GEMINI_API_KEY_LOCAL) in Netlify \u2192 Site configuration \u2192 Environment variables.");
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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent`;
  const upstream = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    throw upstreamError("gemini", upstream, data);
  }
  function parseNdjson(chunkText) {
    const out = [];
    const parts = chunkText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      try {
        const obj = JSON.parse(p);
        const candidates = Array.isArray(obj.candidates) ? obj.candidates : [];
        for (const cand of candidates) {
          const content = cand?.content;
          if (content?.parts) {
            for (const part of content.parts) {
              if (typeof part.text === "string" && part.text) out.push({ type: "delta", text: part.text });
            }
          }
        }
        const usage = obj.usageMetadata;
        if (usage && (usage.promptTokenCount || usage.candidatesTokenCount)) {
          out.push({ type: "usage", usage: { input_tokens: usage.promptTokenCount || 0, output_tokens: usage.candidatesTokenCount || 0 } });
        }
      } catch {
      }
    }
    return out;
  }
  return { upstream, parse: parseNdjson, isNdjson: true };
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

// netlify/functions/gateway-stream.js
var gateway_stream_default = wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...cors, "content-type": "application/json" } });
  const token = getBearer(req);
  if (!token) return new Response(JSON.stringify({ error: "Missing Authorization: Bearer <virtual_key>" }), { status: 401, headers: { ...cors, "content-type": "application/json" } });
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
  if (!keyRow) return new Response(JSON.stringify({ error: "Invalid or revoked key" }), { status: 401, headers: { ...cors, "content-type": "application/json" } });
  if (!keyRow.is_active) return new Response(JSON.stringify({ error: "Customer disabled" }), { status: 403, headers: { ...cors, "content-type": "application/json" } });
  const install_id = getInstallId(req);
  const ua = getUserAgent(req);
  const ip = getClientIp(req);
  const ip_hash = ip ? hmacSha256Hex(process.env.KEY_PEPPER || process.env.JWT_SECRET || "kaixu", ip) : null;
  const allow = assertAllowed({ provider, model, keyRow });
  if (!allow.ok) return new Response(JSON.stringify({ error: allow.error }), { status: allow.status || 403, headers: { ...cors, "content-type": "application/json" } });
  const dev = await enforceDevice({ keyRow, install_id, ua, actor: "gateway" });
  if (!dev.ok) return new Response(JSON.stringify({ error: dev.error }), { status: dev.status || 403, headers: { ...cors, "content-type": "application/json" } });
  const rl = await enforceRpm({ customerId: keyRow.customer_id, apiKeyId: keyRow.api_key_id, rpmOverride: keyRow.rpm_limit });
  if (!rl.ok) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...cors, "content-type": "application/json" } });
  const month = monthKeyUTC();
  const custRoll = await getMonthRollup(keyRow.customer_id, month);
  const keyRoll = await getKeyMonthRollup(keyRow.api_key_id, month);
  const customer_cap_cents = customerCapCents(keyRow, custRoll);
  const key_cap_cents = keyCapCents(keyRow, custRoll);
  if ((custRoll.spent_cents || 0) >= customer_cap_cents) {
    return new Response(JSON.stringify({
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
    }), { status: 402, headers: { ...cors, "content-type": "application/json" } });
  }
  if ((keyRoll.spent_cents || 0) >= key_cap_cents) {
    return new Response(JSON.stringify({
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
    }), { status: 402, headers: { ...cors, "content-type": "application/json" } });
  }
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastUsage = { input_tokens: 0, output_tokens: 0 };
  let input_tokens = 0, output_tokens = 0;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, dataObj) => {
        controller.enqueue(encoder.encode(`event: ${event}
`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(dataObj)}

`));
      };
      send("meta", {
        provider,
        model,
        telemetry: { install_id: install_id || null },
        month: {
          month,
          cap_cents: customer_cap_cents,
          spent_cents: custRoll.spent_cents || 0,
          customer_cap_cents,
          customer_spent_cents: custRoll.spent_cents || 0,
          key_cap_cents,
          key_spent_cents: keyRoll.spent_cents || 0
        }
      });
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping
`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ t: Date.now() })}

`));
        } catch {
        }
      }, 15e3);
      let adapter;
      try {
        if (provider === "openai") adapter = await streamOpenAI({ model, messages, max_tokens, temperature });
        else if (provider === "anthropic") adapter = await streamAnthropic({ model, messages, max_tokens, temperature });
        else if (provider === "gemini") adapter = await streamGemini({ model, messages, max_tokens, temperature });
        else {
          send("error", { error: "Unknown provider. Use openai|anthropic|gemini." });
          clearInterval(ping);
          controller.close();
          return;
        }
      } catch (e) {
        send("error", { error: e?.message || "Provider error" });
        clearInterval(ping);
        controller.close();
        return;
      }
      try {
        const reader = adapter.upstream.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";
          for (const line of lines) {
            const parsedEvents = adapter.parse(line);
            for (const ev of parsedEvents) {
              if (ev.type === "delta" && ev.text) {
                send("delta", { text: ev.text });
              } else if ((ev.type === "usage" || ev.type === "done") && ev.usage) {
                lastUsage = ev.usage;
              }
            }
          }
        }
        input_tokens = lastUsage.input_tokens || 0;
        output_tokens = lastUsage.output_tokens || 0;
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
        send("done", {
          usage: { input_tokens, output_tokens, cost_cents },
          month: {
            month,
            cap_cents: customer_cap_cents_after,
            spent_cents: newCustRoll.spent_cents || 0,
            customer_cap_cents: customer_cap_cents_after,
            customer_spent_cents: newCustRoll.spent_cents || 0,
            key_cap_cents: key_cap_cents_after,
            key_spent_cents: newKeyRoll.spent_cents || 0
          }
        });
        clearInterval(ping);
        controller.close();
      } catch (err) {
        clearInterval(ping);
        const message = err?.message || "Stream error";
        controller.enqueue(encoder.encode(`event: error
`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}

`));
        clearInterval(ping);
        controller.close();
      }
    }
  });
  return new Response(stream, {
    status: 200,
    headers: {
      ...cors,
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive"
    }
  });
});
export {
  gateway_stream_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9odHRwLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvZGIuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9tb25pdG9yLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvd3JhcC5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL3ByaWNpbmcuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9jcnlwdG8uanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9hdXRoei5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL3JhdGVsaW1pdC5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL3Byb3ZpZGVycy5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2FsZXJ0cy5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2RldmljZXMuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9hbGxvd2xpc3QuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9rYWl4dS5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9nYXRld2F5LXN0cmVhbS5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkQ29ycyhyZXEpIHtcbiAgY29uc3QgYWxsb3dSYXcgPSAocHJvY2Vzcy5lbnYuQUxMT1dFRF9PUklHSU5TIHx8IFwiXCIpLnRyaW0oKTtcbiAgY29uc3QgcmVxT3JpZ2luID0gcmVxLmhlYWRlcnMuZ2V0KFwib3JpZ2luXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIk9yaWdpblwiKTtcblxuICAvLyBJTVBPUlRBTlQ6IGtlZXAgdGhpcyBsaXN0IGFsaWduZWQgd2l0aCB3aGF0ZXZlciBoZWFkZXJzIHlvdXIgYXBwcyBzZW5kLlxuICBjb25zdCBhbGxvd0hlYWRlcnMgPSBcImF1dGhvcml6YXRpb24sIGNvbnRlbnQtdHlwZSwgeC1rYWl4dS1pbnN0YWxsLWlkLCB4LWthaXh1LXJlcXVlc3QtaWQsIHgta2FpeHUtYXBwLCB4LWthaXh1LWJ1aWxkLCB4LWFkbWluLXBhc3N3b3JkLCB4LWthaXh1LWVycm9yLXRva2VuLCB4LWthaXh1LW1vZGUsIHgtY29udGVudC1zaGExLCB4LXNldHVwLXNlY3JldCwgeC1rYWl4dS1qb2Itc2VjcmV0LCB4LWpvYi13b3JrZXItc2VjcmV0XCI7XG4gIGNvbnN0IGFsbG93TWV0aG9kcyA9IFwiR0VULFBPU1QsUFVULFBBVENILERFTEVURSxPUFRJT05TXCI7XG5cbiAgY29uc3QgYmFzZSA9IHtcbiAgICBcImFjY2Vzcy1jb250cm9sLWFsbG93LWhlYWRlcnNcIjogYWxsb3dIZWFkZXJzLFxuICAgIFwiYWNjZXNzLWNvbnRyb2wtYWxsb3ctbWV0aG9kc1wiOiBhbGxvd01ldGhvZHMsXG4gICAgXCJhY2Nlc3MtY29udHJvbC1leHBvc2UtaGVhZGVyc1wiOiBcIngta2FpeHUtcmVxdWVzdC1pZFwiLFxuICAgIFwiYWNjZXNzLWNvbnRyb2wtbWF4LWFnZVwiOiBcIjg2NDAwXCJcbiAgfTtcblxuICAvLyBTVFJJQ1QgQlkgREVGQVVMVDpcbiAgLy8gLSBJZiBBTExPV0VEX09SSUdJTlMgaXMgdW5zZXQvYmxhbmsgYW5kIGEgYnJvd3NlciBPcmlnaW4gaXMgcHJlc2VudCwgd2UgZG8gTk9UIGdyYW50IENPUlMuXG4gIC8vIC0gQWxsb3ctYWxsIGlzIG9ubHkgZW5hYmxlZCB3aGVuIEFMTE9XRURfT1JJR0lOUyBleHBsaWNpdGx5IGNvbnRhaW5zIFwiKlwiLlxuICBpZiAoIWFsbG93UmF3KSB7XG4gICAgLy8gTm8gYWxsb3ctb3JpZ2luIGdyYW50ZWQuIFNlcnZlci10by1zZXJ2ZXIgcmVxdWVzdHMgKG5vIE9yaWdpbiBoZWFkZXIpIHN0aWxsIHdvcmsgbm9ybWFsbHkuXG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmJhc2UsXG4gICAgICAuLi4ocmVxT3JpZ2luID8geyB2YXJ5OiBcIk9yaWdpblwiIH0gOiB7fSlcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgYWxsb3dlZCA9IGFsbG93UmF3LnNwbGl0KFwiLFwiKS5tYXAoKHMpID0+IHMudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XG5cbiAgLy8gRXhwbGljaXQgYWxsb3ctYWxsXG4gIGlmIChhbGxvd2VkLmluY2x1ZGVzKFwiKlwiKSkge1xuICAgIGNvbnN0IG9yaWdpbiA9IHJlcU9yaWdpbiB8fCBcIipcIjtcbiAgICByZXR1cm4ge1xuICAgICAgLi4uYmFzZSxcbiAgICAgIFwiYWNjZXNzLWNvbnRyb2wtYWxsb3ctb3JpZ2luXCI6IG9yaWdpbixcbiAgICAgIC4uLihyZXFPcmlnaW4gPyB7IHZhcnk6IFwiT3JpZ2luXCIgfSA6IHt9KVxuICAgIH07XG4gIH1cblxuICAvLyBFeGFjdC1tYXRjaCBhbGxvd2xpc3RcbiAgaWYgKHJlcU9yaWdpbiAmJiBhbGxvd2VkLmluY2x1ZGVzKHJlcU9yaWdpbikpIHtcbiAgICByZXR1cm4ge1xuICAgICAgLi4uYmFzZSxcbiAgICAgIFwiYWNjZXNzLWNvbnRyb2wtYWxsb3ctb3JpZ2luXCI6IHJlcU9yaWdpbixcbiAgICAgIHZhcnk6IFwiT3JpZ2luXCJcbiAgICB9O1xuICB9XG5cbiAgLy8gT3JpZ2luIHByZXNlbnQgYnV0IG5vdCBhbGxvd2VkOiBkbyBub3QgZ3JhbnQgYWxsb3ctb3JpZ2luLlxuICByZXR1cm4ge1xuICAgIC4uLmJhc2UsXG4gICAgLi4uKHJlcU9yaWdpbiA/IHsgdmFyeTogXCJPcmlnaW5cIiB9IDoge30pXG4gIH07XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGpzb24oc3RhdHVzLCBib2R5LCBoZWFkZXJzID0ge30pIHtcbiAgcmV0dXJuIG5ldyBSZXNwb25zZShKU09OLnN0cmluZ2lmeShib2R5KSwge1xuICAgIHN0YXR1cyxcbiAgICBoZWFkZXJzOiB7XG4gICAgICBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9dXRmLThcIixcbiAgICAgIC4uLmhlYWRlcnNcbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGV4dChzdGF0dXMsIGJvZHksIGhlYWRlcnMgPSB7fSkge1xuICByZXR1cm4gbmV3IFJlc3BvbnNlKGJvZHksIHsgc3RhdHVzLCBoZWFkZXJzIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYmFkUmVxdWVzdChtZXNzYWdlLCBoZWFkZXJzID0ge30pIHtcbiAgcmV0dXJuIGpzb24oNDAwLCB7IGVycm9yOiBtZXNzYWdlIH0sIGhlYWRlcnMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QmVhcmVyKHJlcSkge1xuICBjb25zdCBhdXRoID0gcmVxLmhlYWRlcnMuZ2V0KFwiYXV0aG9yaXphdGlvblwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJBdXRob3JpemF0aW9uXCIpIHx8IFwiXCI7XG4gIGlmICghYXV0aC5zdGFydHNXaXRoKFwiQmVhcmVyIFwiKSkgcmV0dXJuIG51bGw7XG4gIHJldHVybiBhdXRoLnNsaWNlKDcpLnRyaW0oKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1vbnRoS2V5VVRDKGQgPSBuZXcgRGF0ZSgpKSB7XG4gIHJldHVybiBkLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgNyk7IC8vIFlZWVktTU1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEluc3RhbGxJZChyZXEpIHtcbiAgcmV0dXJuIChcbiAgICByZXEuaGVhZGVycy5nZXQoXCJ4LWthaXh1LWluc3RhbGwtaWRcIikgfHxcbiAgICByZXEuaGVhZGVycy5nZXQoXCJYLUthaXh1LUluc3RhbGwtSWRcIikgfHxcbiAgICBcIlwiXG4gICkudG9TdHJpbmcoKS50cmltKCkuc2xpY2UoMCwgODApIHx8IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRVc2VyQWdlbnQocmVxKSB7XG4gIHJldHVybiAocmVxLmhlYWRlcnMuZ2V0KFwidXNlci1hZ2VudFwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJVc2VyLUFnZW50XCIpIHx8IFwiXCIpLnRvU3RyaW5nKCkuc2xpY2UoMCwgMjQwKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldENsaWVudElwKHJlcSkge1xuICAvLyBOZXRsaWZ5IGFkZHMgeC1uZi1jbGllbnQtY29ubmVjdGlvbi1pcCB3aGVuIGRlcGxveWVkIChtYXkgYmUgbWlzc2luZyBpbiBuZXRsaWZ5IGRldikuXG4gIGNvbnN0IGEgPSAocmVxLmhlYWRlcnMuZ2V0KFwieC1uZi1jbGllbnQtY29ubmVjdGlvbi1pcFwiKSB8fCBcIlwiKS50b1N0cmluZygpLnRyaW0oKTtcbiAgaWYgKGEpIHJldHVybiBhO1xuXG4gIC8vIEZhbGxiYWNrIHRvIGZpcnN0IFgtRm9yd2FyZGVkLUZvciBlbnRyeS5cbiAgY29uc3QgeGZmID0gKHJlcS5oZWFkZXJzLmdldChcIngtZm9yd2FyZGVkLWZvclwiKSB8fCBcIlwiKS50b1N0cmluZygpO1xuICBpZiAoIXhmZikgcmV0dXJuIG51bGw7XG4gIGNvbnN0IGZpcnN0ID0geGZmLnNwbGl0KFwiLFwiKVswXS50cmltKCk7XG4gIHJldHVybiBmaXJzdCB8fCBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2xlZXAobXMpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyKSA9PiBzZXRUaW1lb3V0KHIsIG1zKSk7XG59IiwgImltcG9ydCB7IG5lb24gfSBmcm9tIFwiQG5ldGxpZnkvbmVvblwiO1xuXG4vKipcbiAqIE5ldGxpZnkgREIgKE5lb24gUG9zdGdyZXMpIGhlbHBlci5cbiAqXG4gKiBJTVBPUlRBTlQgKE5lb24gc2VydmVybGVzcyBkcml2ZXIsIDIwMjUrKTpcbiAqIC0gYG5lb24oKWAgcmV0dXJucyBhIHRhZ2dlZC10ZW1wbGF0ZSBxdWVyeSBmdW5jdGlvbi5cbiAqIC0gRm9yIGR5bmFtaWMgU1FMIHN0cmluZ3MgKyAkMSBwbGFjZWhvbGRlcnMsIHVzZSBgc3FsLnF1ZXJ5KHRleHQsIHBhcmFtcylgLlxuICogICAoQ2FsbGluZyB0aGUgdGVtcGxhdGUgZnVuY3Rpb24gbGlrZSBzcWwoXCJTRUxFQ1QgLi4uXCIpIGNhbiBicmVhayBvbiBuZXdlciBkcml2ZXIgdmVyc2lvbnMuKVxuICpcbiAqIE5ldGxpZnkgREIgYXV0b21hdGljYWxseSBpbmplY3RzIGBORVRMSUZZX0RBVEFCQVNFX1VSTGAgd2hlbiB0aGUgTmVvbiBleHRlbnNpb24gaXMgYXR0YWNoZWQuXG4gKi9cblxubGV0IF9zcWwgPSBudWxsO1xubGV0IF9zY2hlbWFQcm9taXNlID0gbnVsbDtcblxuZnVuY3Rpb24gZ2V0U3FsKCkge1xuICBpZiAoX3NxbCkgcmV0dXJuIF9zcWw7XG5cbiAgY29uc3QgaGFzRGJVcmwgPSAhIShwcm9jZXNzLmVudi5ORVRMSUZZX0RBVEFCQVNFX1VSTCB8fCBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwpO1xuICBpZiAoIWhhc0RiVXJsKSB7XG4gICAgY29uc3QgZXJyID0gbmV3IEVycm9yKFwiRGF0YWJhc2Ugbm90IGNvbmZpZ3VyZWQgKG1pc3NpbmcgTkVUTElGWV9EQVRBQkFTRV9VUkwpLiBBdHRhY2ggTmV0bGlmeSBEQiAoTmVvbikgdG8gdGhpcyBzaXRlLlwiKTtcbiAgICBlcnIuY29kZSA9IFwiREJfTk9UX0NPTkZJR1VSRURcIjtcbiAgICBlcnIuc3RhdHVzID0gNTAwO1xuICAgIGVyci5oaW50ID0gXCJOZXRsaWZ5IFVJIFx1MjE5MiBFeHRlbnNpb25zIFx1MjE5MiBOZW9uIFx1MjE5MiBBZGQgZGF0YWJhc2UgKG9yIHJ1bjogbnB4IG5ldGxpZnkgZGIgaW5pdCkuXCI7XG4gICAgdGhyb3cgZXJyO1xuICB9XG5cbiAgX3NxbCA9IG5lb24oKTsgLy8gYXV0by11c2VzIHByb2Nlc3MuZW52Lk5FVExJRllfREFUQUJBU0VfVVJMIG9uIE5ldGxpZnlcbiAgcmV0dXJuIF9zcWw7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZVNjaGVtYSgpIHtcbiAgaWYgKF9zY2hlbWFQcm9taXNlKSByZXR1cm4gX3NjaGVtYVByb21pc2U7XG5cbiAgX3NjaGVtYVByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHNxbCA9IGdldFNxbCgpO1xuICAgIGNvbnN0IHN0YXRlbWVudHMgPSBbXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBlbWFpbCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgcGxhbl9uYW1lIHRleHQgbm90IG51bGwgZGVmYXVsdCAnc3RhcnRlcicsXG4gICAgICAgIG1vbnRobHlfY2FwX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAyMDAwLFxuICAgICAgICBpc19hY3RpdmUgYm9vbGVhbiBub3QgbnVsbCBkZWZhdWx0IHRydWUsXG4gICAgICAgIHN0cmlwZV9jdXN0b21lcl9pZCB0ZXh0LFxuICAgICAgICBzdHJpcGVfc3Vic2NyaXB0aW9uX2lkIHRleHQsXG4gICAgICAgIHN0cmlwZV9zdGF0dXMgdGV4dCxcbiAgICAgICAgc3RyaXBlX2N1cnJlbnRfcGVyaW9kX2VuZCB0aW1lc3RhbXB0eixcbiAgICAgICAgYXV0b190b3B1cF9lbmFibGVkIGJvb2xlYW4gbm90IG51bGwgZGVmYXVsdCBmYWxzZSxcbiAgICAgICAgYXV0b190b3B1cF9hbW91bnRfY2VudHMgaW50ZWdlcixcbiAgICAgICAgYXV0b190b3B1cF90aHJlc2hvbGRfY2VudHMgaW50ZWdlcixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgYXBpX2tleXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGtleV9oYXNoIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBrZXlfbGFzdDQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbGFiZWwgdGV4dCxcbiAgICAgICAgbW9udGhseV9jYXBfY2VudHMgaW50ZWdlcixcbiAgICAgICAgcnBtX2xpbWl0IGludGVnZXIsXG4gICAgICAgIHJwZF9saW1pdCBpbnRlZ2VyLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHJldm9rZWRfYXQgdGltZXN0YW1wdHpcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhcGlfa2V5c19jdXN0b21lcl9pZF9pZHggb24gYXBpX2tleXMoY3VzdG9tZXJfaWQpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgbW9udGhseV91c2FnZSAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHNwZW50X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBleHRyYV9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgaW5wdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgbW9udGhseV9rZXlfdXNhZ2UgKFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc3BlbnRfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY2FsbHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGFwaV9rZXlfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIG1vbnRobHlfa2V5X3VzYWdlX2N1c3RvbWVyX21vbnRoX2lkeCBvbiBtb250aGx5X2tleV91c2FnZShjdXN0b21lcl9pZCwgbW9udGgpO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgbW9udGhseV9rZXlfdXNhZ2UgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGNhbGxzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbW9kZWwgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgaW5wdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHNfY3VzdG9tZXJfbW9udGhfaWR4IG9uIHVzYWdlX2V2ZW50cyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHVzYWdlX2V2ZW50c19rZXlfaWR4IG9uIHVzYWdlX2V2ZW50cyhhcGlfa2V5X2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgYXVkaXRfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBhY3RvciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBhY3Rpb24gdGV4dCBub3QgbnVsbCxcbiAgICAgICAgdGFyZ2V0IHRleHQsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXVkaXRfZXZlbnRzX2NyZWF0ZWRfaWR4IG9uIGF1ZGl0X2V2ZW50cyhjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcmF0ZV9saW1pdF93aW5kb3dzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHdpbmRvd19zdGFydCB0aW1lc3RhbXB0eiBub3QgbnVsbCxcbiAgICAgICAgY291bnQgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgd2luZG93X3N0YXJ0KVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHJhdGVfbGltaXRfd2luZG93c193aW5kb3dfaWR4IG9uIHJhdGVfbGltaXRfd2luZG93cyh3aW5kb3dfc3RhcnQgZGVzYyk7YCwgICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxhc3Rfc2Vlbl9hdCB0aW1lc3RhbXB0ejtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X3NlZW5faW5zdGFsbF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgdXNhZ2VfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBpbnN0YWxsX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSB1c2FnZV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGlwX2hhc2ggdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHVzYWdlX2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdWEgdGV4dDtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHVzYWdlX2V2ZW50c19pbnN0YWxsX2lkeCBvbiB1c2FnZV9ldmVudHMoaW5zdGFsbF9pZCk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhbGVydHNfc2VudCAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBhbGVydF90eXBlIHRleHQgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCBtb250aCwgYWxlcnRfdHlwZSlcbiAgICAgICk7YCxcbiAgICBcbiAgICAgIC8vIC0tLSBEZXZpY2UgYmluZGluZyAvIHNlYXRzIC0tLVxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbWF4X2RldmljZXNfcGVyX2tleSBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByZXF1aXJlX2luc3RhbGxfaWQgYm9vbGVhbiBub3QgbnVsbCBkZWZhdWx0IGZhbHNlO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhbGxvd2VkX3Byb3ZpZGVycyB0ZXh0W107YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfbW9kZWxzIGpzb25iO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBzdHJpcGVfY3VycmVudF9wZXJpb2RfZW5kIHRpbWVzdGFtcHR6O2AsXG5cbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbWF4X2RldmljZXMgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByZXF1aXJlX2luc3RhbGxfaWQgYm9vbGVhbjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhbGxvd2VkX3Byb3ZpZGVycyB0ZXh0W107YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9tb2RlbHMganNvbmI7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGtleV9kZXZpY2VzIChcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGluc3RhbGxfaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgZGV2aWNlX2xhYmVsIHRleHQsXG4gICAgICAgIGZpcnN0X3NlZW5fYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgbGFzdF9zZWVuX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBsYXN0X3NlZW5fdWEgdGV4dCxcbiAgICAgICAgcmV2b2tlZF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgcmV2b2tlZF9ieSB0ZXh0LFxuICAgICAgICBwcmltYXJ5IGtleSAoYXBpX2tleV9pZCwgaW5zdGFsbF9pZClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBrZXlfZGV2aWNlc19jdXN0b21lcl9pZHggb24ga2V5X2RldmljZXMoY3VzdG9tZXJfaWQpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMga2V5X2RldmljZXNfbGFzdF9zZWVuX2lkeCBvbiBrZXlfZGV2aWNlcyhsYXN0X3NlZW5fYXQgZGVzYyk7YCxcblxuICAgICAgLy8gLS0tIEludm9pY2Ugc25hcHNob3RzICsgdG9wdXBzIC0tLVxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIG1vbnRobHlfaW52b2ljZXMgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzbmFwc2hvdCBqc29uYiBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdG9wdXBfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBhbW91bnRfY2VudHMgaW50ZWdlciBub3QgbnVsbCxcbiAgICAgICAgc291cmNlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnbWFudWFsJyxcbiAgICAgICAgc3RyaXBlX3Nlc3Npb25faWQgdGV4dCxcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAnYXBwbGllZCcsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHRvcHVwX2V2ZW50c19jdXN0b21lcl9tb250aF9pZHggb24gdG9wdXBfZXZlbnRzKGN1c3RvbWVyX2lkLCBtb250aCk7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGFzeW5jX2pvYnMgKFxuICAgICAgICBpZCB1dWlkIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbW9kZWwgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcmVxdWVzdCBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdxdWV1ZWQnLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHN0YXJ0ZWRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGNvbXBsZXRlZF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgaGVhcnRiZWF0X2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBvdXRwdXRfdGV4dCB0ZXh0LFxuICAgICAgICBlcnJvciB0ZXh0LFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYlxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFzeW5jX2pvYnNfY3VzdG9tZXJfY3JlYXRlZF9pZHggb24gYXN5bmNfam9icyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFzeW5jX2pvYnNfc3RhdHVzX2lkeCBvbiBhc3luY19qb2JzKHN0YXR1cywgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgIFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICByZXF1ZXN0X2lkIHRleHQsXG4gICAgICAgIGxldmVsIHRleHQgbm90IG51bGwgZGVmYXVsdCAnaW5mbycsXG4gICAgICAgIGtpbmQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgZnVuY3Rpb25fbmFtZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtZXRob2QgdGV4dCxcbiAgICAgICAgcGF0aCB0ZXh0LFxuICAgICAgICBvcmlnaW4gdGV4dCxcbiAgICAgICAgcmVmZXJlciB0ZXh0LFxuICAgICAgICB1c2VyX2FnZW50IHRleHQsXG4gICAgICAgIGlwIHRleHQsXG4gICAgICAgIGFwcF9pZCB0ZXh0LFxuICAgICAgICBidWlsZF9pZCB0ZXh0LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50LFxuICAgICAgICBwcm92aWRlciB0ZXh0LFxuICAgICAgICBtb2RlbCB0ZXh0LFxuICAgICAgICBodHRwX3N0YXR1cyBpbnRlZ2VyLFxuICAgICAgICBkdXJhdGlvbl9tcyBpbnRlZ2VyLFxuICAgICAgICBlcnJvcl9jb2RlIHRleHQsXG4gICAgICAgIGVycm9yX21lc3NhZ2UgdGV4dCxcbiAgICAgICAgZXJyb3Jfc3RhY2sgdGV4dCxcbiAgICAgICAgdXBzdHJlYW1fc3RhdHVzIGludGVnZXIsXG4gICAgICAgIHVwc3RyZWFtX2JvZHkgdGV4dCxcbiAgICAgICAgZXh0cmEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG5cbiAgICAgIC8vIEZvcndhcmQtY29tcGF0aWJsZSBwYXRjaGluZzogaWYgZ2F0ZXdheV9ldmVudHMgZXhpc3RlZCBmcm9tIGFuIG9sZGVyIGJ1aWxkLFxuICAgICAgLy8gaXQgbWF5IGJlIG1pc3NpbmcgY29sdW1ucyB1c2VkIGJ5IG1vbml0b3IgaW5zZXJ0cy5cbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVxdWVzdF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxldmVsIHRleHQgbm90IG51bGwgZGVmYXVsdCAnaW5mbyc7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMga2luZCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2V2ZW50JztgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBmdW5jdGlvbl9uYW1lIHRleHQgbm90IG51bGwgZGVmYXVsdCAndW5rbm93bic7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbWV0aG9kIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcGF0aCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG9yaWdpbiB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlZmVyZXIgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyB1c2VyX2FnZW50IHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgaXAgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhcHBfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBidWlsZF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGN1c3RvbWVyX2lkIGJpZ2ludDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhcGlfa2V5X2lkIGJpZ2ludDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBwcm92aWRlciB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1vZGVsIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgaHR0cF9zdGF0dXMgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBkdXJhdGlvbl9tcyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGVycm9yX2NvZGUgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBlcnJvcl9tZXNzYWdlIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZXJyb3Jfc3RhY2sgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyB1cHN0cmVhbV9zdGF0dXMgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyB1cHN0cmVhbV9ib2R5IHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZXh0cmEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCk7YCxcblxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX2NyZWF0ZWRfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19yZXF1ZXN0X2lkeCBvbiBnYXRld2F5X2V2ZW50cyhyZXF1ZXN0X2lkKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX2xldmVsX2lkeCBvbiBnYXRld2F5X2V2ZW50cyhsZXZlbCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX2ZuX2lkeCBvbiBnYXRld2F5X2V2ZW50cyhmdW5jdGlvbl9uYW1lLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfYXBwX2lkeCBvbiBnYXRld2F5X2V2ZW50cyhhcHBfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcblxuICAgICAgLy8gLS0tIEthaXh1UHVzaCAoRGVwbG95IFB1c2gpIGVudGVycHJpc2UgdGFibGVzIC0tLVxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByb2xlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZGVwbG95ZXInO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXBpX2tleXNfcm9sZV9pZHggb24gYXBpX2tleXMocm9sZSk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcl9uZXRsaWZ5X3Rva2VucyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBwcmltYXJ5IGtleSByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHRva2VuX2VuYyB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfcHJvamVjdHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb2plY3RfaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbmFtZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBuZXRsaWZ5X3NpdGVfaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVuaXF1ZSAoY3VzdG9tZXJfaWQsIHByb2plY3RfaWQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9wcm9qZWN0c19jdXN0b21lcl9pZHggb24gcHVzaF9wcm9qZWN0cyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfcHVzaGVzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJvamVjdF9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wcm9qZWN0cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHB1c2hfaWQgdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIGJyYW5jaCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICB0aXRsZSB0ZXh0LFxuICAgICAgICBkZXBsb3lfaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc3RhdGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcmVxdWlyZWRfZGlnZXN0cyB0ZXh0W10gbm90IG51bGwgZGVmYXVsdCAne30nOjp0ZXh0W10sXG4gICAgICAgIHVwbG9hZGVkX2RpZ2VzdHMgdGV4dFtdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6dGV4dFtdLFxuICAgICAgICBmaWxlX21hbmlmZXN0IGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIHVybCB0ZXh0LFxuICAgICAgICBlcnJvciB0ZXh0LFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfcHVzaGVzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBmaWxlX21hbmlmZXN0IGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmI7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX3B1c2hlc19jdXN0b21lcl9pZHggb24gcHVzaF9wdXNoZXMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX2pvYnMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIHB1c2hfcm93X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHVzaGVzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgc2hhMSBjaGFyKDQwKSBub3QgbnVsbCxcbiAgICAgICAgZGVwbG95X3BhdGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcGFydHMgaW50ZWdlciBub3QgbnVsbCxcbiAgICAgICAgcmVjZWl2ZWRfcGFydHMgaW50ZWdlcltdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6aW50W10sXG4gICAgICAgIHBhcnRfYnl0ZXMganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgYnl0ZXNfc3RhZ2VkIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3VwbG9hZGluZycsXG4gICAgICAgIGVycm9yIHRleHQsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1bmlxdWUgKHB1c2hfcm93X2lkLCBzaGExKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfam9ic19wdXNoX2lkeCBvbiBwdXNoX2pvYnMocHVzaF9yb3dfaWQsIHVwZGF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGJ5dGVzX3N0YWdlZCBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBwYXJ0X2J5dGVzIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGF0dGVtcHRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBuZXh0X2F0dGVtcHRfYXQgdGltZXN0YW1wdHo7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxhc3RfZXJyb3IgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9lcnJvcl9hdCB0aW1lc3RhbXB0ejtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9yYXRlX3dpbmRvd3MgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBidWNrZXRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBidWNrZXRfc3RhcnQgdGltZXN0YW1wdHogbm90IG51bGwsXG4gICAgICAgIGNvdW50IGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwcmltYXJ5IGtleShjdXN0b21lcl9pZCwgYnVja2V0X3R5cGUsIGJ1Y2tldF9zdGFydClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX3JhdGVfd2luZG93c19idWNrZXRfaWR4IG9uIHB1c2hfcmF0ZV93aW5kb3dzKGJ1Y2tldF90eXBlLCBidWNrZXRfc3RhcnQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX2ZpbGVzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBwdXNoX3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3B1c2hlcyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGRlcGxveV9wYXRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHNoYTEgY2hhcig0MCkgbm90IG51bGwsXG4gICAgICAgIGJ5dGVzIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1vZGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdkaXJlY3QnLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX2ZpbGVzX3B1c2hfaWR4IG9uIHB1c2hfZmlsZXMocHVzaF9yb3dfaWQpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF91c2FnZV9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwdXNoX3Jvd19pZCBiaWdpbnQgcmVmZXJlbmNlcyBwdXNoX3B1c2hlcyhpZCkgb24gZGVsZXRlIHNldCBudWxsLFxuICAgICAgICBldmVudF90eXBlIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJ5dGVzIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHByaWNpbmdfdmVyc2lvbiBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMSxcbiAgICAgICAgY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX3VzYWdlX2N1c3RvbWVyX2lkeCBvbiBwdXNoX3VzYWdlX2V2ZW50cyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfcHJpY2luZ192ZXJzaW9ucyAoXG4gICAgICAgIHZlcnNpb24gaW50ZWdlciBwcmltYXJ5IGtleSxcbiAgICAgICAgZWZmZWN0aXZlX2Zyb20gZGF0ZSBub3QgbnVsbCBkZWZhdWx0IGN1cnJlbnRfZGF0ZSxcbiAgICAgICAgY3VycmVuY3kgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdVU0QnLFxuICAgICAgICBiYXNlX21vbnRoX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwZXJfZGVwbG95X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwZXJfZ2JfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGluc2VydCBpbnRvIHB1c2hfcHJpY2luZ192ZXJzaW9ucyh2ZXJzaW9uLCBiYXNlX21vbnRoX2NlbnRzLCBwZXJfZGVwbG95X2NlbnRzLCBwZXJfZ2JfY2VudHMpXG4gICAgICAgdmFsdWVzICgxLCAwLCAxMCwgMjUpIG9uIGNvbmZsaWN0ICh2ZXJzaW9uKSBkbyBub3RoaW5nO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfcHVzaF9iaWxsaW5nIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IHByaW1hcnkga2V5IHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJpY2luZ192ZXJzaW9uIGludGVnZXIgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3ByaWNpbmdfdmVyc2lvbnModmVyc2lvbiksXG4gICAgICAgIG1vbnRobHlfY2FwX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfaW52b2ljZXMgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBwcmljaW5nX3ZlcnNpb24gaW50ZWdlciBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHJpY2luZ192ZXJzaW9ucyh2ZXJzaW9uKSxcbiAgICAgICAgdG90YWxfY2VudHMgaW50ZWdlciBub3QgbnVsbCxcbiAgICAgICAgYnJlYWtkb3duIGpzb25iIG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcblxuICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAvLyBHaXRIdWIgUHVzaCBHYXRld2F5IChvcHRpb25hbClcbiAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVyX2dpdGh1Yl90b2tlbnMgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgcHJpbWFyeSBrZXkgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB0b2tlbl9lbmMgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgdG9rZW5fdHlwZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ29hdXRoJyxcbiAgICAgICAgc2NvcGVzIHRleHRbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OnRleHRbXSxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBnaF9wdXNoX2pvYnMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBqb2JfaWQgdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIG93bmVyIHRleHQgbm90IG51bGwsXG4gICAgICAgIHJlcG8gdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYnJhbmNoIHRleHQgbm90IG51bGwgZGVmYXVsdCAnbWFpbicsXG4gICAgICAgIGNvbW1pdF9tZXNzYWdlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnS2FpeHUgR2l0SHViIFB1c2gnLFxuICAgICAgICBwYXJ0cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcmVjZWl2ZWRfcGFydHMgaW50ZWdlcltdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6aW50W10sXG4gICAgICAgIHBhcnRfYnl0ZXMganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgYnl0ZXNfc3RhZ2VkIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3VwbG9hZGluZycsXG4gICAgICAgIGF0dGVtcHRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBuZXh0X2F0dGVtcHRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGxhc3RfZXJyb3IgdGV4dCxcbiAgICAgICAgbGFzdF9lcnJvcl9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgcmVzdWx0X2NvbW1pdF9zaGEgdGV4dCxcbiAgICAgICAgcmVzdWx0X3VybCB0ZXh0LFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdoX3B1c2hfam9ic19jdXN0b21lcl9pZHggb24gZ2hfcHVzaF9qb2JzKGN1c3RvbWVyX2lkLCB1cGRhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9qb2JzX25leHRfYXR0ZW1wdF9pZHggb24gZ2hfcHVzaF9qb2JzKG5leHRfYXR0ZW1wdF9hdCkgd2hlcmUgc3RhdHVzIGluICgncmV0cnlfd2FpdCcsJ2Vycm9yX3RyYW5zaWVudCcpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBqb2Jfcm93X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGdoX3B1c2hfam9icyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGV2ZW50X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYnl0ZXMgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnaF9wdXNoX2V2ZW50c19qb2JfaWR4IG9uIGdoX3B1c2hfZXZlbnRzKGpvYl9yb3dfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcblxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfbnVtYmVycyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcGhvbmVfbnVtYmVyIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3R3aWxpbycsXG4gICAgICAgIHR3aWxpb19zaWQgdGV4dCxcbiAgICAgICAgaXNfYWN0aXZlIGJvb2xlYW4gbm90IG51bGwgZGVmYXVsdCB0cnVlLFxuICAgICAgICBkZWZhdWx0X2xsbV9wcm92aWRlciB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ29wZW5haScsXG4gICAgICAgIGRlZmF1bHRfbGxtX21vZGVsIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZ3B0LTQuMS1taW5pJyxcbiAgICAgICAgdm9pY2VfbmFtZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2FsbG95JyxcbiAgICAgICAgbG9jYWxlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZW4tVVMnLFxuICAgICAgICB0aW1lem9uZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ0FtZXJpY2EvUGhvZW5peCcsXG4gICAgICAgIHBsYXlib29rIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX251bWJlcnNfY3VzdG9tZXJfaWR4IG9uIHZvaWNlX251bWJlcnMoY3VzdG9tZXJfaWQpO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxscyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgdm9pY2VfbnVtYmVyX2lkIGJpZ2ludCByZWZlcmVuY2VzIHZvaWNlX251bWJlcnMoaWQpIG9uIGRlbGV0ZSBzZXQgbnVsbCxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd0d2lsaW8nLFxuICAgICAgICBwcm92aWRlcl9jYWxsX3NpZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBmcm9tX251bWJlciB0ZXh0LFxuICAgICAgICB0b19udW1iZXIgdGV4dCxcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAnaW5pdGlhdGVkJyxcbiAgICAgICAgZGlyZWN0aW9uIHRleHQgbm90IG51bGwgZGVmYXVsdCAnaW5ib3VuZCcsXG4gICAgICAgIHN0YXJ0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgZW5kZWRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGR1cmF0aW9uX3NlY29uZHMgaW50ZWdlcixcbiAgICAgICAgZXN0X2Nvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGJpbGxfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHVuaXF1ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxzX3Byb3ZpZGVyX3NpZF91cSBvbiB2b2ljZV9jYWxscyhwcm92aWRlciwgcHJvdmlkZXJfY2FsbF9zaWQpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbHNfY3VzdG9tZXJfaWR4IG9uIHZvaWNlX2NhbGxzKGN1c3RvbWVyX2lkLCBzdGFydGVkX2F0IGRlc2MpO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsX21lc3NhZ2VzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjYWxsX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIHZvaWNlX2NhbGxzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcm9sZSB0ZXh0IG5vdCBudWxsLCAtLSB1c2VyfGFzc2lzdGFudHxzeXN0ZW18dG9vbFxuICAgICAgICBjb250ZW50IHRleHQgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxfbWVzc2FnZXNfY2FsbF9pZHggb24gdm9pY2VfY2FsbF9tZXNzYWdlcyhjYWxsX2lkLCBpZCk7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX3VzYWdlX21vbnRobHkgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1pbnV0ZXMgbnVtZXJpYyBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGVzdF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBiaWxsX2Nvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNhbGxzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVuaXF1ZShjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfdXNhZ2VfbW9udGhseV9jdXN0b21lcl9pZHggb24gdm9pY2VfdXNhZ2VfbW9udGhseShjdXN0b21lcl9pZCwgbW9udGgpO2AsXG5cbl07XG5cbiAgICBmb3IgKGNvbnN0IHMgb2Ygc3RhdGVtZW50cykge1xuICAgICAgYXdhaXQgc3FsLnF1ZXJ5KHMpO1xuICAgIH1cbiAgfSkoKTtcblxuICByZXR1cm4gX3NjaGVtYVByb21pc2U7XG59XG5cbi8qKlxuICogUXVlcnkgaGVscGVyIGNvbXBhdGlibGUgd2l0aCB0aGUgcHJldmlvdXMgYHBnYC1pc2ggaW50ZXJmYWNlOlxuICogLSByZXR1cm5zIHsgcm93cywgcm93Q291bnQgfVxuICogLSBzdXBwb3J0cyAkMSwgJDIgcGxhY2Vob2xkZXJzICsgcGFyYW1zIGFycmF5IHZpYSBzcWwucXVlcnkoLi4uKVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcSh0ZXh0LCBwYXJhbXMgPSBbXSkge1xuICBhd2FpdCBlbnN1cmVTY2hlbWEoKTtcbiAgY29uc3Qgc3FsID0gZ2V0U3FsKCk7XG4gIGNvbnN0IHJvd3MgPSBhd2FpdCBzcWwucXVlcnkodGV4dCwgcGFyYW1zKTtcbiAgcmV0dXJuIHsgcm93czogcm93cyB8fCBbXSwgcm93Q291bnQ6IEFycmF5LmlzQXJyYXkocm93cykgPyByb3dzLmxlbmd0aCA6IDAgfTtcbn0iLCAiaW1wb3J0IHsgcSB9IGZyb20gXCIuL2RiLmpzXCI7XG5cbmZ1bmN0aW9uIHNhZmVTdHIodiwgbWF4ID0gODAwMCkge1xuICBpZiAodiA9PSBudWxsKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgcyA9IFN0cmluZyh2KTtcbiAgaWYgKHMubGVuZ3RoIDw9IG1heCkgcmV0dXJuIHM7XG4gIHJldHVybiBzLnNsaWNlKDAsIG1heCkgKyBgXHUyMDI2KCske3MubGVuZ3RoIC0gbWF4fSBjaGFycylgO1xufVxuXG5mdW5jdGlvbiByYW5kb21JZCgpIHtcbiAgdHJ5IHtcbiAgICBpZiAoZ2xvYmFsVGhpcy5jcnlwdG8/LnJhbmRvbVVVSUQpIHJldHVybiBnbG9iYWxUaGlzLmNyeXB0by5yYW5kb21VVUlEKCk7XG4gIH0gY2F0Y2gge31cbiAgLy8gZmFsbGJhY2sgKG5vdCBSRkM0MTIyLXBlcmZlY3QsIGJ1dCB1bmlxdWUgZW5vdWdoIGZvciB0cmFjaW5nKVxuICByZXR1cm4gXCJyaWRfXCIgKyBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDE2KS5zbGljZSgyKSArIFwiX1wiICsgRGF0ZS5ub3coKS50b1N0cmluZygxNik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRSZXF1ZXN0SWQocmVxKSB7XG4gIGNvbnN0IGggPSAocmVxLmhlYWRlcnMuZ2V0KFwieC1rYWl4dS1yZXF1ZXN0LWlkXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIngtcmVxdWVzdC1pZFwiKSB8fCBcIlwiKS50cmltKCk7XG4gIHJldHVybiBoIHx8IHJhbmRvbUlkKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmZlckZ1bmN0aW9uTmFtZShyZXEpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCB1ID0gbmV3IFVSTChyZXEudXJsKTtcbiAgICBjb25zdCBtID0gdS5wYXRobmFtZS5tYXRjaCgvXFwvXFwubmV0bGlmeVxcL2Z1bmN0aW9uc1xcLyhbXlxcL10rKS9pKTtcbiAgICByZXR1cm4gbSA/IG1bMV0gOiBcInVua25vd25cIjtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFwidW5rbm93blwiO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXF1ZXN0TWV0YShyZXEpIHtcbiAgbGV0IHVybCA9IG51bGw7XG4gIHRyeSB7IHVybCA9IG5ldyBVUkwocmVxLnVybCk7IH0gY2F0Y2gge31cbiAgcmV0dXJuIHtcbiAgICBtZXRob2Q6IHJlcS5tZXRob2QgfHwgbnVsbCxcbiAgICBwYXRoOiB1cmwgPyB1cmwucGF0aG5hbWUgOiBudWxsLFxuICAgIHF1ZXJ5OiB1cmwgPyBPYmplY3QuZnJvbUVudHJpZXModXJsLnNlYXJjaFBhcmFtcy5lbnRyaWVzKCkpIDoge30sXG4gICAgb3JpZ2luOiByZXEuaGVhZGVycy5nZXQoXCJvcmlnaW5cIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiT3JpZ2luXCIpIHx8IG51bGwsXG4gICAgcmVmZXJlcjogcmVxLmhlYWRlcnMuZ2V0KFwicmVmZXJlclwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJSZWZlcmVyXCIpIHx8IG51bGwsXG4gICAgdXNlcl9hZ2VudDogcmVxLmhlYWRlcnMuZ2V0KFwidXNlci1hZ2VudFwiKSB8fCBudWxsLFxuICAgIGlwOiByZXEuaGVhZGVycy5nZXQoXCJ4LW5mLWNsaWVudC1jb25uZWN0aW9uLWlwXCIpIHx8IG51bGwsXG4gICAgYXBwX2lkOiAocmVxLmhlYWRlcnMuZ2V0KFwieC1rYWl4dS1hcHBcIikgfHwgXCJcIikudHJpbSgpIHx8IG51bGwsXG4gICAgYnVpbGRfaWQ6IChyZXEuaGVhZGVycy5nZXQoXCJ4LWthaXh1LWJ1aWxkXCIpIHx8IFwiXCIpLnRyaW0oKSB8fCBudWxsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVFcnJvcihlcnIpIHtcbiAgY29uc3QgZSA9IGVyciB8fCB7fTtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBzYWZlU3RyKGUubmFtZSwgMjAwKSxcbiAgICBtZXNzYWdlOiBzYWZlU3RyKGUubWVzc2FnZSwgNDAwMCksXG4gICAgY29kZTogc2FmZVN0cihlLmNvZGUsIDIwMCksXG4gICAgc3RhdHVzOiBOdW1iZXIuaXNGaW5pdGUoZS5zdGF0dXMpID8gZS5zdGF0dXMgOiBudWxsLFxuICAgIGhpbnQ6IHNhZmVTdHIoZS5oaW50LCAyMDAwKSxcbiAgICBzdGFjazogc2FmZVN0cihlLnN0YWNrLCAxMjAwMCksXG4gICAgdXBzdHJlYW06IGUudXBzdHJlYW0gPyB7XG4gICAgICBwcm92aWRlcjogc2FmZVN0cihlLnVwc3RyZWFtLnByb3ZpZGVyLCA1MCksXG4gICAgICBzdGF0dXM6IE51bWJlci5pc0Zpbml0ZShlLnVwc3RyZWFtLnN0YXR1cykgPyBlLnVwc3RyZWFtLnN0YXR1cyA6IG51bGwsXG4gICAgICBib2R5OiBzYWZlU3RyKGUudXBzdHJlYW0uYm9keSwgMTIwMDApLFxuICAgICAgcmVxdWVzdF9pZDogc2FmZVN0cihlLnVwc3RyZWFtLnJlcXVlc3RfaWQsIDIwMCksXG4gICAgICByZXNwb25zZV9oZWFkZXJzOiBlLnVwc3RyZWFtLnJlc3BvbnNlX2hlYWRlcnMgfHwgdW5kZWZpbmVkXG4gICAgfSA6IHVuZGVmaW5lZFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3VtbWFyaXplSnNvbkJvZHkoYm9keSkge1xuICAvLyBTYWZlIHN1bW1hcnk7IGF2b2lkcyBsb2dnaW5nIGZ1bGwgcHJvbXB0cyBieSBkZWZhdWx0LlxuICBjb25zdCBiID0gYm9keSB8fCB7fTtcbiAgY29uc3QgcHJvdmlkZXIgPSAoYi5wcm92aWRlciB8fCBcIlwiKS50b1N0cmluZygpLnRyaW0oKS50b0xvd2VyQ2FzZSgpIHx8IG51bGw7XG4gIGNvbnN0IG1vZGVsID0gKGIubW9kZWwgfHwgXCJcIikudG9TdHJpbmcoKS50cmltKCkgfHwgbnVsbDtcblxuICBsZXQgbWVzc2FnZUNvdW50ID0gbnVsbDtcbiAgbGV0IHRvdGFsQ2hhcnMgPSBudWxsO1xuICB0cnkge1xuICAgIGlmIChBcnJheS5pc0FycmF5KGIubWVzc2FnZXMpKSB7XG4gICAgICBtZXNzYWdlQ291bnQgPSBiLm1lc3NhZ2VzLmxlbmd0aDtcbiAgICAgIHRvdGFsQ2hhcnMgPSBiLm1lc3NhZ2VzLnJlZHVjZSgoYWNjLCBtKSA9PiBhY2MgKyBTdHJpbmcobT8uY29udGVudCA/PyBcIlwiKS5sZW5ndGgsIDApO1xuICAgIH1cbiAgfSBjYXRjaCB7fVxuXG4gIHJldHVybiB7XG4gICAgcHJvdmlkZXIsXG4gICAgbW9kZWwsXG4gICAgbWF4X3Rva2VuczogTnVtYmVyLmlzRmluaXRlKGIubWF4X3Rva2VucykgPyBwYXJzZUludChiLm1heF90b2tlbnMsIDEwKSA6IG51bGwsXG4gICAgdGVtcGVyYXR1cmU6IHR5cGVvZiBiLnRlbXBlcmF0dXJlID09PSBcIm51bWJlclwiID8gYi50ZW1wZXJhdHVyZSA6IG51bGwsXG4gICAgbWVzc2FnZV9jb3VudDogbWVzc2FnZUNvdW50LFxuICAgIG1lc3NhZ2VfY2hhcnM6IHRvdGFsQ2hhcnNcbiAgfTtcbn1cblxuLyoqXG4gKiBCZXN0LWVmZm9ydCBtb25pdG9yIGV2ZW50OiBmYWlsdXJlcyBuZXZlciBicmVhayB0aGUgbWFpbiByZXF1ZXN0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZW1pdEV2ZW50KGV2KSB7XG4gIHRyeSB7XG4gICAgY29uc3QgZSA9IGV2IHx8IHt9O1xuICAgIGNvbnN0IGV4dHJhID0gZS5leHRyYSB8fCB7fTtcbiAgICBhd2FpdCBxKFxuICAgICAgYGluc2VydCBpbnRvIGdhdGV3YXlfZXZlbnRzXG4gICAgICAgIChyZXF1ZXN0X2lkLCBsZXZlbCwga2luZCwgZnVuY3Rpb25fbmFtZSwgbWV0aG9kLCBwYXRoLCBvcmlnaW4sIHJlZmVyZXIsIHVzZXJfYWdlbnQsIGlwLFxuICAgICAgICAgYXBwX2lkLCBidWlsZF9pZCwgY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIHByb3ZpZGVyLCBtb2RlbCwgaHR0cF9zdGF0dXMsIGR1cmF0aW9uX21zLFxuICAgICAgICAgZXJyb3JfY29kZSwgZXJyb3JfbWVzc2FnZSwgZXJyb3Jfc3RhY2ssIHVwc3RyZWFtX3N0YXR1cywgdXBzdHJlYW1fYm9keSwgZXh0cmEpXG4gICAgICAgdmFsdWVzXG4gICAgICAgICgkMSwkMiwkMywkNCwkNSwkNiwkNywkOCwkOSwkMTAsXG4gICAgICAgICAkMTEsJDEyLCQxMywkMTQsJDE1LCQxNiwkMTcsJDE4LFxuICAgICAgICAgJDE5LCQyMCwkMjEsJDIyLCQyMywkMjQsJDI1Ojpqc29uYilgLFxuICAgICAgW1xuICAgICAgICBzYWZlU3RyKGUucmVxdWVzdF9pZCwgMjAwKSxcbiAgICAgICAgc2FmZVN0cihlLmxldmVsIHx8IFwiaW5mb1wiLCAyMCksXG4gICAgICAgIHNhZmVTdHIoZS5raW5kIHx8IFwiZXZlbnRcIiwgODApLFxuICAgICAgICBzYWZlU3RyKGUuZnVuY3Rpb25fbmFtZSB8fCBcInVua25vd25cIiwgMTIwKSxcbiAgICAgICAgc2FmZVN0cihlLm1ldGhvZCwgMjApLFxuICAgICAgICBzYWZlU3RyKGUucGF0aCwgNTAwKSxcbiAgICAgICAgc2FmZVN0cihlLm9yaWdpbiwgNTAwKSxcbiAgICAgICAgc2FmZVN0cihlLnJlZmVyZXIsIDgwMCksXG4gICAgICAgIHNhZmVTdHIoZS51c2VyX2FnZW50LCA4MDApLFxuICAgICAgICBzYWZlU3RyKGUuaXAsIDIwMCksXG5cbiAgICAgICAgc2FmZVN0cihlLmFwcF9pZCwgMjAwKSxcbiAgICAgICAgc2FmZVN0cihlLmJ1aWxkX2lkLCAyMDApLFxuICAgICAgICBOdW1iZXIuaXNGaW5pdGUoZS5jdXN0b21lcl9pZCkgPyBlLmN1c3RvbWVyX2lkIDogbnVsbCxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUuYXBpX2tleV9pZCkgPyBlLmFwaV9rZXlfaWQgOiBudWxsLFxuICAgICAgICBzYWZlU3RyKGUucHJvdmlkZXIsIDgwKSxcbiAgICAgICAgc2FmZVN0cihlLm1vZGVsLCAyMDApLFxuICAgICAgICBOdW1iZXIuaXNGaW5pdGUoZS5odHRwX3N0YXR1cykgPyBlLmh0dHBfc3RhdHVzIDogbnVsbCxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUuZHVyYXRpb25fbXMpID8gZS5kdXJhdGlvbl9tcyA6IG51bGwsXG5cbiAgICAgICAgc2FmZVN0cihlLmVycm9yX2NvZGUsIDIwMCksXG4gICAgICAgIHNhZmVTdHIoZS5lcnJvcl9tZXNzYWdlLCA0MDAwKSxcbiAgICAgICAgc2FmZVN0cihlLmVycm9yX3N0YWNrLCAxMjAwMCksXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShlLnVwc3RyZWFtX3N0YXR1cykgPyBlLnVwc3RyZWFtX3N0YXR1cyA6IG51bGwsXG4gICAgICAgIHNhZmVTdHIoZS51cHN0cmVhbV9ib2R5LCAxMjAwMCksXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KGV4dHJhIHx8IHt9KVxuICAgICAgXVxuICAgICk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zb2xlLndhcm4oXCJtb25pdG9yIGVtaXQgZmFpbGVkOlwiLCBlPy5tZXNzYWdlIHx8IGUpO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgYnVpbGRDb3JzLCBqc29uIH0gZnJvbSBcIi4vaHR0cC5qc1wiO1xuaW1wb3J0IHsgZW1pdEV2ZW50LCBnZXRSZXF1ZXN0SWQsIGluZmVyRnVuY3Rpb25OYW1lLCByZXF1ZXN0TWV0YSwgc2VyaWFsaXplRXJyb3IgfSBmcm9tIFwiLi9tb25pdG9yLmpzXCI7XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUVycm9yKGVycikge1xuICBjb25zdCBzdGF0dXMgPSBlcnI/LnN0YXR1cyB8fCA1MDA7XG4gIGNvbnN0IGNvZGUgPSBlcnI/LmNvZGUgfHwgXCJTRVJWRVJfRVJST1JcIjtcbiAgY29uc3QgbWVzc2FnZSA9IGVycj8ubWVzc2FnZSB8fCBcIlVua25vd24gZXJyb3JcIjtcbiAgY29uc3QgaGludCA9IGVycj8uaGludDtcbiAgcmV0dXJuIHsgc3RhdHVzLCBib2R5OiB7IGVycm9yOiBtZXNzYWdlLCBjb2RlLCAuLi4oaGludCA/IHsgaGludCB9IDoge30pIH0gfTtcbn1cblxuZnVuY3Rpb24gd2l0aFJlcXVlc3RJZChyZXMsIHJlcXVlc3RfaWQpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBoID0gbmV3IEhlYWRlcnMocmVzLmhlYWRlcnMgfHwge30pO1xuICAgIGguc2V0KFwieC1rYWl4dS1yZXF1ZXN0LWlkXCIsIHJlcXVlc3RfaWQpO1xuICAgIHJldHVybiBuZXcgUmVzcG9uc2UocmVzLmJvZHksIHsgc3RhdHVzOiByZXMuc3RhdHVzLCBoZWFkZXJzOiBoIH0pO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gcmVzO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNhZmVCb2R5UHJldmlldyhyZXMpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBjdCA9IChyZXMuaGVhZGVycy5nZXQoXCJjb250ZW50LXR5cGVcIikgfHwgXCJcIikudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBjbG9uZSA9IHJlcy5jbG9uZSgpO1xuICAgIGlmIChjdC5pbmNsdWRlcyhcImFwcGxpY2F0aW9uL2pzb25cIikpIHtcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBjbG9uZS5qc29uKCkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG4gICAgY29uc3QgdCA9IGF3YWl0IGNsb25lLnRleHQoKS5jYXRjaCgoKSA9PiBcIlwiKTtcbiAgICBpZiAodHlwZW9mIHQgPT09IFwic3RyaW5nXCIgJiYgdC5sZW5ndGggPiAxMjAwMCkgcmV0dXJuIHQuc2xpY2UoMCwgMTIwMDApICsgYFx1MjAyNigrJHt0Lmxlbmd0aCAtIDEyMDAwfSBjaGFycylgO1xuICAgIHJldHVybiB0O1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JhcChoYW5kbGVyKSB7XG4gIHJldHVybiBhc3luYyAocmVxLCBjb250ZXh0KSA9PiB7XG4gICAgY29uc3Qgc3RhcnQgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IGNvcnMgPSBidWlsZENvcnMocmVxKTtcbiAgICBjb25zdCByZXF1ZXN0X2lkID0gZ2V0UmVxdWVzdElkKHJlcSk7XG4gICAgY29uc3QgZnVuY3Rpb25fbmFtZSA9IGluZmVyRnVuY3Rpb25OYW1lKHJlcSk7XG4gICAgY29uc3QgbWV0YSA9IHJlcXVlc3RNZXRhKHJlcSk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzID0gYXdhaXQgaGFuZGxlcihyZXEsIGNvcnMsIGNvbnRleHQpO1xuXG4gICAgICBjb25zdCBkdXJhdGlvbl9tcyA9IERhdGUubm93KCkgLSBzdGFydDtcbiAgICAgIGNvbnN0IG91dCA9IHJlcyBpbnN0YW5jZW9mIFJlc3BvbnNlID8gd2l0aFJlcXVlc3RJZChyZXMsIHJlcXVlc3RfaWQpIDogcmVzO1xuXG4gICAgICBjb25zdCBzdGF0dXMgPSBvdXQgaW5zdGFuY2VvZiBSZXNwb25zZSA/IG91dC5zdGF0dXMgOiAyMDA7XG4gICAgICBjb25zdCBsZXZlbCA9IHN0YXR1cyA+PSA1MDAgPyBcImVycm9yXCIgOiBzdGF0dXMgPj0gNDAwID8gXCJ3YXJuXCIgOiBcImluZm9cIjtcbiAgICAgIGNvbnN0IGtpbmQgPSBzdGF0dXMgPj0gNDAwID8gXCJodHRwX2Vycm9yX3Jlc3BvbnNlXCIgOiBcImh0dHBfcmVzcG9uc2VcIjtcblxuICAgICAgbGV0IGV4dHJhID0ge307XG4gICAgICBpZiAoc3RhdHVzID49IDQwMCAmJiBvdXQgaW5zdGFuY2VvZiBSZXNwb25zZSkge1xuICAgICAgICBleHRyYS5yZXNwb25zZSA9IGF3YWl0IHNhZmVCb2R5UHJldmlldyhvdXQpO1xuICAgICAgfVxuICAgICAgaWYgKGR1cmF0aW9uX21zID49IDE1MDAwKSB7XG4gICAgICAgIGV4dHJhLnNsb3cgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCBlbWl0RXZlbnQoe1xuICAgICAgICByZXF1ZXN0X2lkLFxuICAgICAgICBsZXZlbCxcbiAgICAgICAga2luZCxcbiAgICAgICAgZnVuY3Rpb25fbmFtZSxcbiAgICAgICAgLi4ubWV0YSxcbiAgICAgICAgaHR0cF9zdGF0dXM6IHN0YXR1cyxcbiAgICAgICAgZHVyYXRpb25fbXMsXG4gICAgICAgIGV4dHJhXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIG91dDtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnN0IGR1cmF0aW9uX21zID0gRGF0ZS5ub3coKSAtIHN0YXJ0O1xuXG4gICAgICAvLyBCZXN0LWVmZm9ydCBkZXRhaWxlZCBtb25pdG9yIHJlY29yZC5cbiAgICAgIGNvbnN0IHNlciA9IHNlcmlhbGl6ZUVycm9yKGVycik7XG4gICAgICBhd2FpdCBlbWl0RXZlbnQoe1xuICAgICAgICByZXF1ZXN0X2lkLFxuICAgICAgICBsZXZlbDogXCJlcnJvclwiLFxuICAgICAgICBraW5kOiBcInRocm93bl9lcnJvclwiLFxuICAgICAgICBmdW5jdGlvbl9uYW1lLFxuICAgICAgICAuLi5tZXRhLFxuICAgICAgICBwcm92aWRlcjogc2VyPy51cHN0cmVhbT8ucHJvdmlkZXIgfHwgdW5kZWZpbmVkLFxuICAgICAgICBodHRwX3N0YXR1czogc2VyPy5zdGF0dXMgfHwgNTAwLFxuICAgICAgICBkdXJhdGlvbl9tcyxcbiAgICAgICAgZXJyb3JfY29kZTogc2VyPy5jb2RlIHx8IFwiU0VSVkVSX0VSUk9SXCIsXG4gICAgICAgIGVycm9yX21lc3NhZ2U6IHNlcj8ubWVzc2FnZSB8fCBcIlVua25vd24gZXJyb3JcIixcbiAgICAgICAgZXJyb3Jfc3RhY2s6IHNlcj8uc3RhY2sgfHwgbnVsbCxcbiAgICAgICAgdXBzdHJlYW1fc3RhdHVzOiBzZXI/LnVwc3RyZWFtPy5zdGF0dXMgfHwgbnVsbCxcbiAgICAgICAgdXBzdHJlYW1fYm9keTogc2VyPy51cHN0cmVhbT8uYm9keSB8fCBudWxsLFxuICAgICAgICBleHRyYTogeyBlcnJvcjogc2VyIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBBdm9pZCA1MDJzOiBhbHdheXMgcmV0dXJuIEpTT04uXG4gICAgICBjb25zb2xlLmVycm9yKFwiRnVuY3Rpb24gZXJyb3I6XCIsIGVycik7XG4gICAgICBjb25zdCB7IHN0YXR1cywgYm9keSB9ID0gbm9ybWFsaXplRXJyb3IoZXJyKTtcbiAgICAgIHJldHVybiBqc29uKHN0YXR1cywgeyAuLi5ib2R5LCByZXF1ZXN0X2lkIH0sIHsgLi4uY29ycywgXCJ4LWthaXh1LXJlcXVlc3QtaWRcIjogcmVxdWVzdF9pZCB9KTtcbiAgICB9XG4gIH07XG59XG4iLCAiaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcblxubGV0IGNhY2hlID0gbnVsbDtcblxuZnVuY3Rpb24gbG9hZFByaWNpbmcoKSB7XG4gIGlmIChjYWNoZSkgcmV0dXJuIGNhY2hlO1xuICBjb25zdCBwID0gcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksIFwicHJpY2luZ1wiLCBcInByaWNpbmcuanNvblwiKTtcbiAgY29uc3QgcmF3ID0gZnMucmVhZEZpbGVTeW5jKHAsIFwidXRmOFwiKTtcbiAgY2FjaGUgPSBKU09OLnBhcnNlKHJhdyk7XG4gIHJldHVybiBjYWNoZTtcbn1cblxuZnVuY3Rpb24gdW5wcmljZWRFcnJvcihwcm92aWRlciwgbW9kZWwpIHtcbiAgY29uc3QgZXJyID0gbmV3IEVycm9yKGBVbnByaWNlZCBtb2RlbDogJHtwcm92aWRlcn06JHttb2RlbH1gKTtcbiAgZXJyLmNvZGUgPSBcIlVOUFJJQ0VEX01PREVMXCI7XG4gIC8vIDQwOSBjb21tdW5pY2F0ZXMgXCJ5b3VyIHJlcXVlc3QgaXMgdmFsaWQgSlNPTiBidXQgY29uZmxpY3RzIHdpdGggc2VydmVyIHBvbGljeS9jb25maWdcIlxuICBlcnIuc3RhdHVzID0gNDA5O1xuICBlcnIuaGludCA9IFwiVGhpcyBtb2RlbC9wcm92aWRlciBpcyBub3QgZW5hYmxlZCBmb3IgYmlsbGluZy4gQXNrIGFuIGFkbWluIHRvIGFkZCBpdCB0byBwcmljaW5nL3ByaWNpbmcuanNvbiAoYW5kIGFsbG93bGlzdHMpLlwiO1xuICByZXR1cm4gZXJyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29zdENlbnRzKHByb3ZpZGVyLCBtb2RlbCwgaW5wdXRUb2tlbnMsIG91dHB1dFRva2Vucykge1xuICBjb25zdCBwcmljaW5nID0gbG9hZFByaWNpbmcoKTtcbiAgY29uc3QgZW50cnkgPSBwcmljaW5nPy5bcHJvdmlkZXJdPy5bbW9kZWxdO1xuICBpZiAoIWVudHJ5KSB0aHJvdyB1bnByaWNlZEVycm9yKHByb3ZpZGVyLCBtb2RlbCk7XG5cbiAgY29uc3QgaW5SYXRlID0gTnVtYmVyKGVudHJ5LmlucHV0X3Blcl8xbV91c2QpO1xuICBjb25zdCBvdXRSYXRlID0gTnVtYmVyKGVudHJ5Lm91dHB1dF9wZXJfMW1fdXNkKTtcblxuICAvLyBUcmVhdCBtaXNzaW5nL05hTiBhcyBtaXNjb25maWd1cmF0aW9uLlxuICBpZiAoIU51bWJlci5pc0Zpbml0ZShpblJhdGUpIHx8ICFOdW1iZXIuaXNGaW5pdGUob3V0UmF0ZSkpIHRocm93IHVucHJpY2VkRXJyb3IocHJvdmlkZXIsIG1vZGVsKTtcblxuICBjb25zdCBpblVzZCA9IChOdW1iZXIoaW5wdXRUb2tlbnMgfHwgMCkgLyAxXzAwMF8wMDApICogaW5SYXRlO1xuICBjb25zdCBvdXRVc2QgPSAoTnVtYmVyKG91dHB1dFRva2VucyB8fCAwKSAvIDFfMDAwXzAwMCkgKiBvdXRSYXRlO1xuICBjb25zdCB0b3RhbFVzZCA9IGluVXNkICsgb3V0VXNkO1xuXG4gIHJldHVybiBNYXRoLm1heCgwLCBNYXRoLnJvdW5kKHRvdGFsVXNkICogMTAwKSk7XG59XG4iLCAiaW1wb3J0IGNyeXB0byBmcm9tIFwiY3J5cHRvXCI7XG5cbmZ1bmN0aW9uIGNvbmZpZ0Vycm9yKG1lc3NhZ2UsIGhpbnQpIHtcbiAgY29uc3QgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuICBlcnIuY29kZSA9IFwiQ09ORklHXCI7XG4gIGVyci5zdGF0dXMgPSA1MDA7XG4gIGlmIChoaW50KSBlcnIuaGludCA9IGhpbnQ7XG4gIHJldHVybiBlcnI7XG59XG5cbmZ1bmN0aW9uIGJhc2U2NHVybChpbnB1dCkge1xuICByZXR1cm4gQnVmZmVyLmZyb20oaW5wdXQpXG4gICAgLnRvU3RyaW5nKFwiYmFzZTY0XCIpXG4gICAgLnJlcGxhY2UoLz0vZywgXCJcIilcbiAgICAucmVwbGFjZSgvXFwrL2csIFwiLVwiKVxuICAgIC5yZXBsYWNlKC9cXC8vZywgXCJfXCIpO1xufVxuXG5mdW5jdGlvbiB1bmJhc2U2NHVybChpbnB1dCkge1xuICBjb25zdCBzID0gU3RyaW5nKGlucHV0IHx8IFwiXCIpLnJlcGxhY2UoLy0vZywgXCIrXCIpLnJlcGxhY2UoL18vZywgXCIvXCIpO1xuICBjb25zdCBwYWQgPSBzLmxlbmd0aCAlIDQgPT09IDAgPyBcIlwiIDogXCI9XCIucmVwZWF0KDQgLSAocy5sZW5ndGggJSA0KSk7XG4gIHJldHVybiBCdWZmZXIuZnJvbShzICsgcGFkLCBcImJhc2U2NFwiKTtcbn1cblxuZnVuY3Rpb24gZW5jS2V5KCkge1xuICAvLyBQcmVmZXIgYSBkZWRpY2F0ZWQgZW5jcnlwdGlvbiBrZXkuIEZhbGwgYmFjayB0byBKV1RfU0VDUkVUIGZvciBkcm9wLWZyaWVuZGx5IGluc3RhbGxzLlxuICBjb25zdCByYXcgPSAocHJvY2Vzcy5lbnYuREJfRU5DUllQVElPTl9LRVkgfHwgcHJvY2Vzcy5lbnYuSldUX1NFQ1JFVCB8fCBcIlwiKS50b1N0cmluZygpO1xuICBpZiAoIXJhdykge1xuICAgIHRocm93IGNvbmZpZ0Vycm9yKFxuICAgICAgXCJNaXNzaW5nIERCX0VOQ1JZUFRJT05fS0VZIChvciBKV1RfU0VDUkVUIGZhbGxiYWNrKVwiLFxuICAgICAgXCJTZXQgREJfRU5DUllQVElPTl9LRVkgKHJlY29tbWVuZGVkKSBvciBhdCBtaW5pbXVtIEpXVF9TRUNSRVQgaW4gTmV0bGlmeSBlbnYgdmFycy5cIlxuICAgICk7XG4gIH1cbiAgLy8gRGVyaXZlIGEgc3RhYmxlIDMyLWJ5dGUga2V5LlxuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhhc2goXCJzaGEyNTZcIikudXBkYXRlKHJhdykuZGlnZXN0KCk7XG59XG5cbi8qKlxuICogRW5jcnlwdCBzbWFsbCBzZWNyZXRzIGZvciBEQiBzdG9yYWdlIChBRVMtMjU2LUdDTSkuXG4gKiBGb3JtYXQ6IHYxOjxpdl9iNjR1cmw+Ojx0YWdfYjY0dXJsPjo8Y2lwaGVyX2I2NHVybD5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVuY3J5cHRTZWNyZXQocGxhaW50ZXh0KSB7XG4gIGNvbnN0IGtleSA9IGVuY0tleSgpO1xuICBjb25zdCBpdiA9IGNyeXB0by5yYW5kb21CeXRlcygxMik7XG4gIGNvbnN0IGNpcGhlciA9IGNyeXB0by5jcmVhdGVDaXBoZXJpdihcImFlcy0yNTYtZ2NtXCIsIGtleSwgaXYpO1xuICBjb25zdCBjdCA9IEJ1ZmZlci5jb25jYXQoW2NpcGhlci51cGRhdGUoU3RyaW5nKHBsYWludGV4dCksIFwidXRmOFwiKSwgY2lwaGVyLmZpbmFsKCldKTtcbiAgY29uc3QgdGFnID0gY2lwaGVyLmdldEF1dGhUYWcoKTtcbiAgcmV0dXJuIGB2MToke2Jhc2U2NHVybChpdil9OiR7YmFzZTY0dXJsKHRhZyl9OiR7YmFzZTY0dXJsKGN0KX1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVjcnlwdFNlY3JldChlbmMpIHtcbiAgY29uc3QgcyA9IFN0cmluZyhlbmMgfHwgXCJcIik7XG4gIGlmICghcy5zdGFydHNXaXRoKFwidjE6XCIpKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgcGFydHMgPSBzLnNwbGl0KFwiOlwiKTtcbiAgaWYgKHBhcnRzLmxlbmd0aCAhPT0gNCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IFssIGl2QiwgdGFnQiwgY3RCXSA9IHBhcnRzO1xuICBjb25zdCBrZXkgPSBlbmNLZXkoKTtcbiAgY29uc3QgaXYgPSB1bmJhc2U2NHVybChpdkIpO1xuICBjb25zdCB0YWcgPSB1bmJhc2U2NHVybCh0YWdCKTtcbiAgY29uc3QgY3QgPSB1bmJhc2U2NHVybChjdEIpO1xuICBjb25zdCBkZWNpcGhlciA9IGNyeXB0by5jcmVhdGVEZWNpcGhlcml2KFwiYWVzLTI1Ni1nY21cIiwga2V5LCBpdik7XG4gIGRlY2lwaGVyLnNldEF1dGhUYWcodGFnKTtcbiAgY29uc3QgcHQgPSBCdWZmZXIuY29uY2F0KFtkZWNpcGhlci51cGRhdGUoY3QpLCBkZWNpcGhlci5maW5hbCgpXSk7XG4gIHJldHVybiBwdC50b1N0cmluZyhcInV0ZjhcIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByYW5kb21LZXkocHJlZml4ID0gXCJreF9saXZlX1wiKSB7XG4gIGNvbnN0IGJ5dGVzID0gY3J5cHRvLnJhbmRvbUJ5dGVzKDMyKTtcbiAgcmV0dXJuIHByZWZpeCArIGJhc2U2NHVybChieXRlcykuc2xpY2UoMCwgNDgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hhMjU2SGV4KGlucHV0KSB7XG4gIHJldHVybiBjcnlwdG8uY3JlYXRlSGFzaChcInNoYTI1NlwiKS51cGRhdGUoaW5wdXQpLmRpZ2VzdChcImhleFwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhtYWNTaGEyNTZIZXgoc2VjcmV0LCBpbnB1dCkge1xuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhtYWMoXCJzaGEyNTZcIiwgc2VjcmV0KS51cGRhdGUoaW5wdXQpLmRpZ2VzdChcImhleFwiKTtcbn1cblxuLyoqXG4gKiBLZXkgaGFzaGluZyBzdHJhdGVneTpcbiAqIC0gRGVmYXVsdDogU0hBLTI1NihrZXkpXG4gKiAtIElmIEtFWV9QRVBQRVIgaXMgc2V0OiBITUFDLVNIQTI1NihLRVlfUEVQUEVSLCBrZXkpXG4gKlxuICogSU1QT1JUQU5UOiBQZXBwZXIgaXMgb3B0aW9uYWwgYW5kIGNhbiBiZSBlbmFibGVkIGxhdGVyLlxuICogQXV0aCBjb2RlIHdpbGwgYXV0by1taWdyYXRlIGxlZ2FjeSBoYXNoZXMgb24gZmlyc3Qgc3VjY2Vzc2Z1bCBsb29rdXAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBrZXlIYXNoSGV4KGlucHV0KSB7XG4gIGNvbnN0IHBlcHBlciA9IHByb2Nlc3MuZW52LktFWV9QRVBQRVI7XG4gIGlmIChwZXBwZXIpIHJldHVybiBobWFjU2hhMjU2SGV4KHBlcHBlciwgaW5wdXQpO1xuICByZXR1cm4gc2hhMjU2SGV4KGlucHV0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxlZ2FjeUtleUhhc2hIZXgoaW5wdXQpIHtcbiAgcmV0dXJuIHNoYTI1NkhleChpbnB1dCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaWduSnd0KHBheWxvYWQsIHR0bFNlY29uZHMgPSAzNjAwKSB7XG4gIGNvbnN0IHNlY3JldCA9IHByb2Nlc3MuZW52LkpXVF9TRUNSRVQ7XG4gIGlmICghc2VjcmV0KSB7XG4gICAgdGhyb3cgY29uZmlnRXJyb3IoXG4gICAgICBcIk1pc3NpbmcgSldUX1NFQ1JFVFwiLFxuICAgICAgXCJTZXQgSldUX1NFQ1JFVCBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcyAodXNlIGEgbG9uZyByYW5kb20gc3RyaW5nKS5cIlxuICAgICk7XG4gIH1cblxuICBjb25zdCBoZWFkZXIgPSB7IGFsZzogXCJIUzI1NlwiLCB0eXA6IFwiSldUXCIgfTtcbiAgY29uc3Qgbm93ID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gIGNvbnN0IGJvZHkgPSB7IC4uLnBheWxvYWQsIGlhdDogbm93LCBleHA6IG5vdyArIHR0bFNlY29uZHMgfTtcblxuICBjb25zdCBoID0gYmFzZTY0dXJsKEpTT04uc3RyaW5naWZ5KGhlYWRlcikpO1xuICBjb25zdCBwID0gYmFzZTY0dXJsKEpTT04uc3RyaW5naWZ5KGJvZHkpKTtcbiAgY29uc3QgZGF0YSA9IGAke2h9LiR7cH1gO1xuICBjb25zdCBzaWcgPSBiYXNlNjR1cmwoY3J5cHRvLmNyZWF0ZUhtYWMoXCJzaGEyNTZcIiwgc2VjcmV0KS51cGRhdGUoZGF0YSkuZGlnZXN0KCkpO1xuXG4gIHJldHVybiBgJHtkYXRhfS4ke3NpZ31gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdmVyaWZ5Snd0KHRva2VuKSB7XG4gIGNvbnN0IHNlY3JldCA9IHByb2Nlc3MuZW52LkpXVF9TRUNSRVQ7XG4gIGlmICghc2VjcmV0KSB7XG4gICAgdGhyb3cgY29uZmlnRXJyb3IoXG4gICAgICBcIk1pc3NpbmcgSldUX1NFQ1JFVFwiLFxuICAgICAgXCJTZXQgSldUX1NFQ1JFVCBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcyAodXNlIGEgbG9uZyByYW5kb20gc3RyaW5nKS5cIlxuICAgICk7XG4gIH1cblxuICBjb25zdCBwYXJ0cyA9IHRva2VuLnNwbGl0KFwiLlwiKTtcbiAgaWYgKHBhcnRzLmxlbmd0aCAhPT0gMykgcmV0dXJuIG51bGw7XG5cbiAgY29uc3QgW2gsIHAsIHNdID0gcGFydHM7XG4gIGNvbnN0IGRhdGEgPSBgJHtofS4ke3B9YDtcbiAgY29uc3QgZXhwZWN0ZWQgPSBiYXNlNjR1cmwoY3J5cHRvLmNyZWF0ZUhtYWMoXCJzaGEyNTZcIiwgc2VjcmV0KS51cGRhdGUoZGF0YSkuZGlnZXN0KCkpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgYSA9IEJ1ZmZlci5mcm9tKGV4cGVjdGVkKTtcbiAgICBjb25zdCBiID0gQnVmZmVyLmZyb20ocyk7XG4gICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkgcmV0dXJuIG51bGw7XG4gICAgaWYgKCFjcnlwdG8udGltaW5nU2FmZUVxdWFsKGEsIGIpKSByZXR1cm4gbnVsbDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKFxuICAgICAgQnVmZmVyLmZyb20ocC5yZXBsYWNlKC8tL2csIFwiK1wiKS5yZXBsYWNlKC9fL2csIFwiL1wiKSwgXCJiYXNlNjRcIikudG9TdHJpbmcoXCJ1dGYtOFwiKVxuICAgICk7XG4gICAgY29uc3Qgbm93ID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gICAgaWYgKHBheWxvYWQuZXhwICYmIG5vdyA+IHBheWxvYWQuZXhwKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gcGF5bG9hZDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBxIH0gZnJvbSBcIi4vZGIuanNcIjtcbmltcG9ydCB7IGtleUhhc2hIZXgsIGxlZ2FjeUtleUhhc2hIZXgsIHZlcmlmeUp3dCB9IGZyb20gXCIuL2NyeXB0by5qc1wiO1xuaW1wb3J0IHsgbW9udGhLZXlVVEMgfSBmcm9tIFwiLi9odHRwLmpzXCI7XG5cbmZ1bmN0aW9uIGJhc2VTZWxlY3QoKSB7XG4gIHJldHVybiBgc2VsZWN0IGsuaWQgYXMgYXBpX2tleV9pZCwgay5jdXN0b21lcl9pZCwgay5rZXlfbGFzdDQsIGsubGFiZWwsIGsucm9sZSxcbiAgICAgICAgICAgICAgICAgay5tb250aGx5X2NhcF9jZW50cyBhcyBrZXlfY2FwX2NlbnRzLCBrLnJwbV9saW1pdCwgay5ycGRfbGltaXQsXG4gICAgICAgICAgICAgICAgIGsubWF4X2RldmljZXMsIGsucmVxdWlyZV9pbnN0YWxsX2lkLCBrLmFsbG93ZWRfcHJvdmlkZXJzLCBrLmFsbG93ZWRfbW9kZWxzLFxuICAgICAgICAgICAgICAgICBjLm1vbnRobHlfY2FwX2NlbnRzIGFzIGN1c3RvbWVyX2NhcF9jZW50cywgYy5pc19hY3RpdmUsXG4gICAgICAgICAgICAgICAgIGMubWF4X2RldmljZXNfcGVyX2tleSBhcyBjdXN0b21lcl9tYXhfZGV2aWNlc19wZXJfa2V5LCBjLnJlcXVpcmVfaW5zdGFsbF9pZCBhcyBjdXN0b21lcl9yZXF1aXJlX2luc3RhbGxfaWQsXG4gICAgICAgICAgICAgICAgIGMuYWxsb3dlZF9wcm92aWRlcnMgYXMgY3VzdG9tZXJfYWxsb3dlZF9wcm92aWRlcnMsIGMuYWxsb3dlZF9tb2RlbHMgYXMgY3VzdG9tZXJfYWxsb3dlZF9tb2RlbHMsXG4gICAgICAgICAgICAgICAgIGMucGxhbl9uYW1lIGFzIGN1c3RvbWVyX3BsYW5fbmFtZSwgYy5lbWFpbCBhcyBjdXN0b21lcl9lbWFpbFxuICAgICAgICAgIGZyb20gYXBpX2tleXMga1xuICAgICAgICAgIGpvaW4gY3VzdG9tZXJzIGMgb24gYy5pZCA9IGsuY3VzdG9tZXJfaWRgO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9va3VwS2V5KHBsYWluS2V5KSB7XG4gIC8vIFByZWZlcnJlZCBoYXNoIChwZXBwZXJlZCBpZiBlbmFibGVkKVxuICBjb25zdCBwcmVmZXJyZWQgPSBrZXlIYXNoSGV4KHBsYWluS2V5KTtcbiAgbGV0IGtleVJlcyA9IGF3YWl0IHEoXG4gICAgYCR7YmFzZVNlbGVjdCgpfVxuICAgICB3aGVyZSBrLmtleV9oYXNoPSQxIGFuZCBrLnJldm9rZWRfYXQgaXMgbnVsbFxuICAgICBsaW1pdCAxYCxcbiAgICBbcHJlZmVycmVkXVxuICApO1xuICBpZiAoa2V5UmVzLnJvd0NvdW50KSByZXR1cm4ga2V5UmVzLnJvd3NbMF07XG5cbiAgLy8gSWYgS0VZX1BFUFBFUiBpcyBlbmFibGVkLCBhbGxvdyBsZWdhY3kgU0hBLTI1NiBoYXNoZXMgYW5kIGF1dG8tbWlncmF0ZSBvbiBmaXJzdCBoaXQuXG4gIGlmIChwcm9jZXNzLmVudi5LRVlfUEVQUEVSKSB7XG4gICAgY29uc3QgbGVnYWN5ID0gbGVnYWN5S2V5SGFzaEhleChwbGFpbktleSk7XG4gICAga2V5UmVzID0gYXdhaXQgcShcbiAgICAgIGAke2Jhc2VTZWxlY3QoKX1cbiAgICAgICB3aGVyZSBrLmtleV9oYXNoPSQxIGFuZCBrLnJldm9rZWRfYXQgaXMgbnVsbFxuICAgICAgIGxpbWl0IDFgLFxuICAgICAgW2xlZ2FjeV1cbiAgICApO1xuICAgIGlmICgha2V5UmVzLnJvd0NvdW50KSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IHJvdyA9IGtleVJlcy5yb3dzWzBdO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBxKFxuICAgICAgICBgdXBkYXRlIGFwaV9rZXlzIHNldCBrZXlfaGFzaD0kMVxuICAgICAgICAgd2hlcmUgaWQ9JDIgYW5kIGtleV9oYXNoPSQzYCxcbiAgICAgICAgW3ByZWZlcnJlZCwgcm93LmFwaV9rZXlfaWQsIGxlZ2FjeV1cbiAgICAgICk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBpZ25vcmUgbWlncmF0aW9uIGVycm9yc1xuICAgIH1cblxuICAgIHJldHVybiByb3c7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvb2t1cEtleUJ5SWQoYXBpX2tleV9pZCkge1xuICBjb25zdCBrZXlSZXMgPSBhd2FpdCBxKFxuICAgIGAke2Jhc2VTZWxlY3QoKX1cbiAgICAgd2hlcmUgay5pZD0kMSBhbmQgay5yZXZva2VkX2F0IGlzIG51bGxcbiAgICAgbGltaXQgMWAsXG4gICAgW2FwaV9rZXlfaWRdXG4gICk7XG4gIGlmICgha2V5UmVzLnJvd0NvdW50KSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIGtleVJlcy5yb3dzWzBdO1xufVxuXG4vKipcbiAqIFJlc29sdmUgYW4gQXV0aG9yaXphdGlvbiBCZWFyZXIgdG9rZW4uXG4gKiBTdXBwb3J0ZWQ6XG4gKiAtIEthaXh1IHN1Yi1rZXkgKHBsYWluIHZpcnR1YWwga2V5KVxuICogLSBTaG9ydC1saXZlZCB1c2VyIHNlc3Npb24gSldUICh0eXBlOiAndXNlcl9zZXNzaW9uJylcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlc29sdmVBdXRoKHRva2VuKSB7XG4gIGlmICghdG9rZW4pIHJldHVybiBudWxsO1xuXG4gIC8vIEpXVHMgaGF2ZSAzIGRvdC1zZXBhcmF0ZWQgcGFydHMuIEthaXh1IGtleXMgZG8gbm90LlxuICBjb25zdCBwYXJ0cyA9IHRva2VuLnNwbGl0KFwiLlwiKTtcbiAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMykge1xuICAgIGNvbnN0IHBheWxvYWQgPSB2ZXJpZnlKd3QodG9rZW4pO1xuICAgIGlmICghcGF5bG9hZCkgcmV0dXJuIG51bGw7XG4gICAgaWYgKHBheWxvYWQudHlwZSAhPT0gXCJ1c2VyX3Nlc3Npb25cIikgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCByb3cgPSBhd2FpdCBsb29rdXBLZXlCeUlkKHBheWxvYWQuYXBpX2tleV9pZCk7XG4gICAgcmV0dXJuIHJvdztcbiAgfVxuXG4gIHJldHVybiBhd2FpdCBsb29rdXBLZXkodG9rZW4pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0TW9udGhSb2xsdXAoY3VzdG9tZXJfaWQsIG1vbnRoID0gbW9udGhLZXlVVEMoKSkge1xuICBjb25zdCByb2xsID0gYXdhaXQgcShcbiAgICBgc2VsZWN0IHNwZW50X2NlbnRzLCBleHRyYV9jZW50cywgaW5wdXRfdG9rZW5zLCBvdXRwdXRfdG9rZW5zXG4gICAgIGZyb20gbW9udGhseV91c2FnZSB3aGVyZSBjdXN0b21lcl9pZD0kMSBhbmQgbW9udGg9JDJgLFxuICAgIFtjdXN0b21lcl9pZCwgbW9udGhdXG4gICk7XG4gIGlmIChyb2xsLnJvd0NvdW50ID09PSAwKSByZXR1cm4geyBzcGVudF9jZW50czogMCwgZXh0cmFfY2VudHM6IDAsIGlucHV0X3Rva2VuczogMCwgb3V0cHV0X3Rva2VuczogMCB9O1xuICByZXR1cm4gcm9sbC5yb3dzWzBdO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0S2V5TW9udGhSb2xsdXAoYXBpX2tleV9pZCwgbW9udGggPSBtb250aEtleVVUQygpKSB7XG4gIGNvbnN0IHJvbGwgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3Qgc3BlbnRfY2VudHMsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2VucywgY2FsbHNcbiAgICAgZnJvbSBtb250aGx5X2tleV91c2FnZSB3aGVyZSBhcGlfa2V5X2lkPSQxIGFuZCBtb250aD0kMmAsXG4gICAgW2FwaV9rZXlfaWQsIG1vbnRoXVxuICApO1xuICBpZiAocm9sbC5yb3dDb3VudCkgcmV0dXJuIHJvbGwucm93c1swXTtcblxuICAvLyBCYWNrZmlsbCBmb3IgbWlncmF0ZWQgaW5zdGFsbHMgKHdoZW4gbW9udGhseV9rZXlfdXNhZ2UgZGlkIG5vdCBleGlzdCB5ZXQpLlxuICBjb25zdCBrZXlNZXRhID0gYXdhaXQgcShgc2VsZWN0IGN1c3RvbWVyX2lkIGZyb20gYXBpX2tleXMgd2hlcmUgaWQ9JDFgLCBbYXBpX2tleV9pZF0pO1xuICBjb25zdCBjdXN0b21lcl9pZCA9IGtleU1ldGEucm93Q291bnQgPyBrZXlNZXRhLnJvd3NbMF0uY3VzdG9tZXJfaWQgOiBudWxsO1xuXG4gIGNvbnN0IGFnZyA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBjb2FsZXNjZShzdW0oY29zdF9jZW50cyksMCk6OmludCBhcyBzcGVudF9jZW50cyxcbiAgICAgICAgICAgIGNvYWxlc2NlKHN1bShpbnB1dF90b2tlbnMpLDApOjppbnQgYXMgaW5wdXRfdG9rZW5zLFxuICAgICAgICAgICAgY29hbGVzY2Uoc3VtKG91dHB1dF90b2tlbnMpLDApOjppbnQgYXMgb3V0cHV0X3Rva2VucyxcbiAgICAgICAgICAgIGNvdW50KCopOjppbnQgYXMgY2FsbHNcbiAgICAgZnJvbSB1c2FnZV9ldmVudHNcbiAgICAgd2hlcmUgYXBpX2tleV9pZD0kMSBhbmQgdG9fY2hhcihjcmVhdGVkX2F0IGF0IHRpbWUgem9uZSAnVVRDJywnWVlZWS1NTScpPSQyYCxcbiAgICBbYXBpX2tleV9pZCwgbW9udGhdXG4gICk7XG5cbiAgY29uc3Qgcm93ID0gYWdnLnJvd3NbMF0gfHwgeyBzcGVudF9jZW50czogMCwgaW5wdXRfdG9rZW5zOiAwLCBvdXRwdXRfdG9rZW5zOiAwLCBjYWxsczogMCB9O1xuXG4gIGlmIChjdXN0b21lcl9pZCAhPSBudWxsKSB7XG4gICAgYXdhaXQgcShcbiAgICAgIGBpbnNlcnQgaW50byBtb250aGx5X2tleV91c2FnZShhcGlfa2V5X2lkLCBjdXN0b21lcl9pZCwgbW9udGgsIHNwZW50X2NlbnRzLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnMsIGNhbGxzKVxuICAgICAgIHZhbHVlcyAoJDEsJDIsJDMsJDQsJDUsJDYsJDcpXG4gICAgICAgb24gY29uZmxpY3QgKGFwaV9rZXlfaWQsIG1vbnRoKVxuICAgICAgIGRvIHVwZGF0ZSBzZXRcbiAgICAgICAgIHNwZW50X2NlbnRzID0gZXhjbHVkZWQuc3BlbnRfY2VudHMsXG4gICAgICAgICBpbnB1dF90b2tlbnMgPSBleGNsdWRlZC5pbnB1dF90b2tlbnMsXG4gICAgICAgICBvdXRwdXRfdG9rZW5zID0gZXhjbHVkZWQub3V0cHV0X3Rva2VucyxcbiAgICAgICAgIGNhbGxzID0gZXhjbHVkZWQuY2FsbHMsXG4gICAgICAgICB1cGRhdGVkX2F0ID0gbm93KClgLFxuICAgICAgW2FwaV9rZXlfaWQsIGN1c3RvbWVyX2lkLCBtb250aCwgcm93LnNwZW50X2NlbnRzIHx8IDAsIHJvdy5pbnB1dF90b2tlbnMgfHwgMCwgcm93Lm91dHB1dF90b2tlbnMgfHwgMCwgcm93LmNhbGxzIHx8IDBdXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiByb3c7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlZmZlY3RpdmVDYXBDZW50cyhrZXlSb3csIHJvbGx1cCkge1xuICBjb25zdCBiYXNlID0ga2V5Um93LmtleV9jYXBfY2VudHMgPz8ga2V5Um93LmN1c3RvbWVyX2NhcF9jZW50cztcbiAgY29uc3QgZXh0cmEgPSByb2xsdXAuZXh0cmFfY2VudHMgfHwgMDtcbiAgcmV0dXJuIChiYXNlIHx8IDApICsgZXh0cmE7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXN0b21lckNhcENlbnRzKGtleVJvdywgY3VzdG9tZXJSb2xsdXApIHtcbiAgY29uc3QgYmFzZSA9IGtleVJvdy5jdXN0b21lcl9jYXBfY2VudHMgfHwgMDtcbiAgY29uc3QgZXh0cmEgPSBjdXN0b21lclJvbGx1cC5leHRyYV9jZW50cyB8fCAwO1xuICByZXR1cm4gYmFzZSArIGV4dHJhO1xufVxuXG5leHBvcnQgZnVuY3Rpb24ga2V5Q2FwQ2VudHMoa2V5Um93LCBjdXN0b21lclJvbGx1cCkge1xuICAvLyBJZiBhIGtleSBvdmVycmlkZSBleGlzdHMsIGl0J3MgYSBoYXJkIGNhcCBmb3IgdGhhdCBrZXkuIE90aGVyd2lzZSBpdCBpbmhlcml0cyB0aGUgY3VzdG9tZXIgY2FwLlxuICBpZiAoa2V5Um93LmtleV9jYXBfY2VudHMgIT0gbnVsbCkgcmV0dXJuIGtleVJvdy5rZXlfY2FwX2NlbnRzO1xuICByZXR1cm4gY3VzdG9tZXJDYXBDZW50cyhrZXlSb3csIGN1c3RvbWVyUm9sbHVwKTtcbn1cblxuXG5jb25zdCBST0xFX09SREVSID0gW1widmlld2VyXCIsXCJkZXBsb3llclwiLFwiYWRtaW5cIixcIm93bmVyXCJdO1xuXG5leHBvcnQgZnVuY3Rpb24gcm9sZUF0TGVhc3QoYWN0dWFsLCByZXF1aXJlZCkge1xuICBjb25zdCBhID0gUk9MRV9PUkRFUi5pbmRleE9mKChhY3R1YWwgfHwgXCJkZXBsb3llclwiKS50b0xvd2VyQ2FzZSgpKTtcbiAgY29uc3QgciA9IFJPTEVfT1JERVIuaW5kZXhPZigocmVxdWlyZWQgfHwgXCJkZXBsb3llclwiKS50b0xvd2VyQ2FzZSgpKTtcbiAgcmV0dXJuIGEgPj0gciAmJiBhICE9PSAtMSAmJiByICE9PSAtMTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVpcmVLZXlSb2xlKGtleVJvdywgcmVxdWlyZWRSb2xlKSB7XG4gIGNvbnN0IGFjdHVhbCA9IChrZXlSb3c/LnJvbGUgfHwgXCJkZXBsb3llclwiKS50b0xvd2VyQ2FzZSgpO1xuICBpZiAoIXJvbGVBdExlYXN0KGFjdHVhbCwgcmVxdWlyZWRSb2xlKSkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcIkZvcmJpZGRlblwiKTtcbiAgICBlcnIuc3RhdHVzID0gNDAzO1xuICAgIGVyci5jb2RlID0gXCJGT1JCSURERU5cIjtcbiAgICBlcnIuaGludCA9IGBSZXF1aXJlcyByb2xlICcke3JlcXVpcmVkUm9sZX0nLCBidXQga2V5IHJvbGUgaXMgJyR7YWN0dWFsfScuYDtcbiAgICB0aHJvdyBlcnI7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBxIH0gZnJvbSBcIi4vZGIuanNcIjtcblxubGV0IF9VcHN0YXNoID0gbnVsbDtcbmNvbnN0IF9saW1pdGVyQnlMaW1pdCA9IG5ldyBNYXAoKTtcblxuYXN5bmMgZnVuY3Rpb24gbG9hZFVwc3Rhc2goKSB7XG4gIGNvbnN0IHVybCA9IHByb2Nlc3MuZW52LlVQU1RBU0hfUkVESVNfUkVTVF9VUkw7XG4gIGNvbnN0IHRva2VuID0gcHJvY2Vzcy5lbnYuVVBTVEFTSF9SRURJU19SRVNUX1RPS0VOO1xuICBpZiAoIXVybCB8fCAhdG9rZW4pIHJldHVybiBudWxsO1xuXG4gIGlmIChfVXBzdGFzaCkgcmV0dXJuIF9VcHN0YXNoO1xuXG4gIGNvbnN0IFt7IFJhdGVsaW1pdCB9LCB7IFJlZGlzIH1dID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIGltcG9ydChcIkB1cHN0YXNoL3JhdGVsaW1pdFwiKSxcbiAgICBpbXBvcnQoXCJAdXBzdGFzaC9yZWRpc1wiKVxuICBdKTtcblxuICBfVXBzdGFzaCA9IHsgUmF0ZWxpbWl0LCBSZWRpcyB9O1xuICByZXR1cm4gX1Vwc3Rhc2g7XG59XG5cbmZ1bmN0aW9uIGlzb1Jlc2V0KHJlc2V0KSB7XG4gIGlmICghcmVzZXQpIHJldHVybiBudWxsO1xuICBpZiAodHlwZW9mIHJlc2V0ID09PSBcIm51bWJlclwiKSByZXR1cm4gbmV3IERhdGUocmVzZXQpLnRvSVNPU3RyaW5nKCk7XG4gIGlmIChyZXNldCBpbnN0YW5jZW9mIERhdGUpIHJldHVybiByZXNldC50b0lTT1N0cmluZygpO1xuICBpZiAodHlwZW9mIHJlc2V0ID09PSBcInN0cmluZ1wiKSByZXR1cm4gcmVzZXQ7XG4gIHRyeSB7XG4gICAgaWYgKHR5cGVvZiByZXNldD8uZ2V0VGltZSA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gbmV3IERhdGUocmVzZXQuZ2V0VGltZSgpKS50b0lTT1N0cmluZygpO1xuICB9IGNhdGNoIHt9XG4gIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIFJQTSByYXRlIGxpbWl0aW5nLlxuICpcbiAqIFByaW9yaXR5OlxuICogMSkgVXBzdGFzaCBzbGlkaW5nIHdpbmRvdyAoaWYgVVBTVEFTSF9SRURJU19SRVNUX1VSTC9UT0tFTiBwcmVzZW50KVxuICogMikgREItYmFja2VkIGZpeGVkIHdpbmRvdyAoc2ltcGxlIGZhbGxiYWNrKVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZW5mb3JjZVJwbSh7IGN1c3RvbWVySWQsIGFwaUtleUlkLCBycG1PdmVycmlkZSB9KSB7XG4gIGNvbnN0IGRlZmF1bHRScG0gPSBwYXJzZUludChwcm9jZXNzLmVudi5ERUZBVUxUX1JQTV9MSU1JVCB8fCBcIjEyMFwiLCAxMCk7XG4gIGNvbnN0IGxpbWl0ID0gTnVtYmVyLmlzRmluaXRlKHJwbU92ZXJyaWRlKSA/IHJwbU92ZXJyaWRlIDogZGVmYXVsdFJwbTtcblxuICBpZiAoIU51bWJlci5pc0Zpbml0ZShsaW1pdCkgfHwgbGltaXQgPD0gMCkge1xuICAgIHJldHVybiB7IG9rOiB0cnVlLCByZW1haW5pbmc6IG51bGwsIHJlc2V0OiBudWxsLCBtb2RlOiBcIm9mZlwiIH07XG4gIH1cblxuICBjb25zdCB1cCA9IGF3YWl0IGxvYWRVcHN0YXNoKCk7XG4gIGlmICh1cCkge1xuICAgIGlmICghX2xpbWl0ZXJCeUxpbWl0LmhhcyhsaW1pdCkpIHtcbiAgICAgIGNvbnN0IHJlZGlzID0gdXAuUmVkaXMuZnJvbUVudigpO1xuICAgICAgY29uc3QgcmwgPSBuZXcgdXAuUmF0ZWxpbWl0KHtcbiAgICAgICAgcmVkaXMsXG4gICAgICAgIGxpbWl0ZXI6IHVwLlJhdGVsaW1pdC5zbGlkaW5nV2luZG93KGxpbWl0LCBcIjYwIHNcIiksXG4gICAgICAgIHByZWZpeDogXCJrYWl4dTpybFwiXG4gICAgICB9KTtcbiAgICAgIF9saW1pdGVyQnlMaW1pdC5zZXQobGltaXQsIHJsKTtcbiAgICB9XG5cbiAgICBjb25zdCBsaW1pdGVyID0gX2xpbWl0ZXJCeUxpbWl0LmdldChsaW1pdCk7XG4gICAgY29uc3Qga2V5ID0gYGMke2N1c3RvbWVySWR9Omske2FwaUtleUlkfWA7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgbGltaXRlci5saW1pdChrZXkpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIG9rOiAhIXJlcy5zdWNjZXNzLFxuICAgICAgcmVtYWluaW5nOiByZXMucmVtYWluaW5nID8/IG51bGwsXG4gICAgICByZXNldDogaXNvUmVzZXQocmVzLnJlc2V0KSxcbiAgICAgIG1vZGU6IFwidXBzdGFzaFwiXG4gICAgfTtcbiAgfVxuXG4gIC8vIC0tLSBEQiBmYWxsYmFjayAtLS1cbiAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgY29uc3Qgd2luZG93TXMgPSA2MF8wMDA7XG4gIGNvbnN0IHdpbmRvd1N0YXJ0ID0gbmV3IERhdGUoTWF0aC5mbG9vcihub3cgLyB3aW5kb3dNcykgKiB3aW5kb3dNcyk7XG4gIGNvbnN0IHJlc2V0ID0gbmV3IERhdGUod2luZG93U3RhcnQuZ2V0VGltZSgpICsgd2luZG93TXMpO1xuXG4gIGNvbnN0IHJlcyA9IGF3YWl0IHEoXG4gICAgYGluc2VydCBpbnRvIHJhdGVfbGltaXRfd2luZG93cyhjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgd2luZG93X3N0YXJ0LCBjb3VudClcbiAgICAgdmFsdWVzICgkMSwkMiwkMywxKVxuICAgICBvbiBjb25mbGljdCAoY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIHdpbmRvd19zdGFydClcbiAgICAgZG8gdXBkYXRlIHNldCBjb3VudCA9IHJhdGVfbGltaXRfd2luZG93cy5jb3VudCArIDFcbiAgICAgcmV0dXJuaW5nIGNvdW50YCxcbiAgICBbY3VzdG9tZXJJZCwgYXBpS2V5SWQsIHdpbmRvd1N0YXJ0XVxuICApO1xuXG4gIGNvbnN0IGNvdW50ID0gcmVzLnJvd3M/LlswXT8uY291bnQgPz8gMTtcbiAgY29uc3QgcmVtYWluaW5nID0gTWF0aC5tYXgoMCwgbGltaXQgLSBjb3VudCk7XG5cbiAgaWYgKE1hdGgucmFuZG9tKCkgPCAwLjAxKSB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHEoYGRlbGV0ZSBmcm9tIHJhdGVfbGltaXRfd2luZG93cyB3aGVyZSB3aW5kb3dfc3RhcnQgPCBub3coKSAtIGludGVydmFsICcyIGhvdXJzJ2ApO1xuICAgIH0gY2F0Y2gge31cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgb2s6IGNvdW50IDw9IGxpbWl0LFxuICAgIHJlbWFpbmluZyxcbiAgICByZXNldDogcmVzZXQudG9JU09TdHJpbmcoKSxcbiAgICBtb2RlOiBcImRiXCJcbiAgfTtcbn1cbiIsICJpbXBvcnQgeyBUZXh0RGVjb2RlciB9IGZyb20gXCJ1dGlsXCI7XG5cbmZ1bmN0aW9uIGNvbmZpZ0Vycm9yKG1lc3NhZ2UsIGhpbnQpIHtcbiAgY29uc3QgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuICBlcnIuY29kZSA9IFwiQ09ORklHXCI7XG4gIGVyci5zdGF0dXMgPSA1MDA7XG4gIGlmIChoaW50KSBlcnIuaGludCA9IGhpbnQ7XG4gIHJldHVybiBlcnI7XG59XG5cblxuZnVuY3Rpb24gc2FmZUpzb25TdHJpbmcodiwgbWF4ID0gMTIwMDApIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBzID0gdHlwZW9mIHYgPT09IFwic3RyaW5nXCIgPyB2IDogSlNPTi5zdHJpbmdpZnkodik7XG4gICAgaWYgKCFzKSByZXR1cm4gXCJcIjtcbiAgICBpZiAocy5sZW5ndGggPD0gbWF4KSByZXR1cm4gcztcbiAgICByZXR1cm4gcy5zbGljZSgwLCBtYXgpICsgYFx1MjAyNigrJHtzLmxlbmd0aCAtIG1heH0gY2hhcnMpYDtcbiAgfSBjYXRjaCB7XG4gICAgY29uc3QgcyA9IFN0cmluZyh2IHx8IFwiXCIpO1xuICAgIGlmIChzLmxlbmd0aCA8PSBtYXgpIHJldHVybiBzO1xuICAgIHJldHVybiBzLnNsaWNlKDAsIG1heCkgKyBgXHUyMDI2KCske3MubGVuZ3RoIC0gbWF4fSBjaGFycylgO1xuICB9XG59XG5cbmZ1bmN0aW9uIHVwc3RyZWFtRXJyb3IocHJvdmlkZXIsIHJlcywgYm9keSkge1xuICBjb25zdCBzdGF0dXMgPSByZXM/LnN0YXR1cyB8fCAwO1xuICBjb25zdCByZXFJZCA9XG4gICAgcmVzPy5oZWFkZXJzPy5nZXQ/LihcIngtcmVxdWVzdC1pZFwiKSB8fFxuICAgIHJlcz8uaGVhZGVycz8uZ2V0Py4oXCJyZXF1ZXN0LWlkXCIpIHx8XG4gICAgcmVzPy5oZWFkZXJzPy5nZXQ/LihcIngtYW16bi1yZXF1ZXN0aWRcIikgfHxcbiAgICBudWxsO1xuXG4gIC8vIFRyeSB0byBzdXJmYWNlIHRoZSBtb3N0IG1lYW5pbmdmdWwgcHJvdmlkZXIgbWVzc2FnZS5cbiAgbGV0IG1zZyA9IFwiXCI7XG4gIHRyeSB7XG4gICAgbXNnID0gYm9keT8uZXJyb3I/Lm1lc3NhZ2UgfHwgYm9keT8uZXJyb3I/LnR5cGUgfHwgYm9keT8ubWVzc2FnZSB8fCBcIlwiO1xuICB9IGNhdGNoIHt9XG4gIGNvbnN0IGVyciA9IG5ldyBFcnJvcihtc2cgPyBgJHtwcm92aWRlcn0gdXBzdHJlYW0gZXJyb3IgJHtzdGF0dXN9OiAke21zZ31gIDogYCR7cHJvdmlkZXJ9IHVwc3RyZWFtIGVycm9yICR7c3RhdHVzfWApO1xuICBlcnIuY29kZSA9IFwiVVBTVFJFQU1fRVJST1JcIjtcbiAgZXJyLnN0YXR1cyA9IDUwMjtcbiAgZXJyLnVwc3RyZWFtID0ge1xuICAgIHByb3ZpZGVyLFxuICAgIHN0YXR1cyxcbiAgICByZXF1ZXN0X2lkOiByZXFJZCxcbiAgICBib2R5OiBzYWZlSnNvblN0cmluZyhib2R5KVxuICB9O1xuICByZXR1cm4gZXJyO1xufVxuXG4vKipcbiAqIE5vbi1zdHJlYW0gY2FsbHNcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNhbGxPcGVuQUkoeyBtb2RlbCwgbWVzc2FnZXMsIG1heF90b2tlbnMsIHRlbXBlcmF0dXJlIH0pIHtcbiAgY29uc3QgYXBpS2V5ID0gcHJvY2Vzcy5lbnYuT1BFTkFJX0FQSV9LRVk7XG4gIGlmICghYXBpS2V5KSB0aHJvdyBjb25maWdFcnJvcihcIk9QRU5BSV9BUElfS0VZIG5vdCBjb25maWd1cmVkXCIsIFwiU2V0IE9QRU5BSV9BUElfS0VZIGluIE5ldGxpZnkgXHUyMTkyIFNpdGUgY29uZmlndXJhdGlvbiBcdTIxOTIgRW52aXJvbm1lbnQgdmFyaWFibGVzICh5b3VyIE9wZW5BSSBBUEkga2V5KS5cIik7XG5cbiAgY29uc3QgaW5wdXQgPSBBcnJheS5pc0FycmF5KG1lc3NhZ2VzKSA/IG1lc3NhZ2VzLm1hcChtID0+ICh7XG4gICAgcm9sZTogbS5yb2xlLFxuICAgIGNvbnRlbnQ6IFt7IHR5cGU6IFwiaW5wdXRfdGV4dFwiLCB0ZXh0OiBTdHJpbmcobS5jb250ZW50ID8/IFwiXCIpIH1dXG4gIH0pKSA6IFtdO1xuXG4gIGNvbnN0IGJvZHkgPSB7XG4gICAgbW9kZWwsXG4gICAgaW5wdXQsXG4gICAgdGVtcGVyYXR1cmU6IHR5cGVvZiB0ZW1wZXJhdHVyZSA9PT0gXCJudW1iZXJcIiA/IHRlbXBlcmF0dXJlIDogMSxcbiAgICBtYXhfb3V0cHV0X3Rva2VuczogdHlwZW9mIG1heF90b2tlbnMgPT09IFwibnVtYmVyXCIgPyBtYXhfdG9rZW5zIDogMTAyNCxcbiAgICBzdG9yZTogZmFsc2VcbiAgfTtcblxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChcImh0dHBzOi8vYXBpLm9wZW5haS5jb20vdjEvcmVzcG9uc2VzXCIsIHtcbiAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgIFwiYXV0aG9yaXphdGlvblwiOiBgQmVhcmVyICR7YXBpS2V5fWAsXG4gICAgICBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIlxuICAgIH0sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSlcbiAgfSk7XG5cbiAgY29uc3QgZGF0YSA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCk9PiAoe30pKTtcbiAgaWYgKCFyZXMub2spIHRocm93IHVwc3RyZWFtRXJyb3IoXCJvcGVuYWlcIiwgcmVzLCBkYXRhKTtcblxuICBsZXQgb3V0ID0gXCJcIjtcbiAgY29uc3Qgb3V0cHV0ID0gQXJyYXkuaXNBcnJheShkYXRhLm91dHB1dCkgPyBkYXRhLm91dHB1dCA6IFtdO1xuICBmb3IgKGNvbnN0IGl0ZW0gb2Ygb3V0cHV0KSB7XG4gICAgaWYgKGl0ZW0/LnR5cGUgPT09IFwibWVzc2FnZVwiICYmIEFycmF5LmlzQXJyYXkoaXRlbS5jb250ZW50KSkge1xuICAgICAgZm9yIChjb25zdCBjIG9mIGl0ZW0uY29udGVudCkge1xuICAgICAgICBpZiAoYz8udHlwZSA9PT0gXCJvdXRwdXRfdGV4dFwiICYmIHR5cGVvZiBjLnRleHQgPT09IFwic3RyaW5nXCIpIG91dCArPSBjLnRleHQ7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY29uc3QgdXNhZ2UgPSBkYXRhLnVzYWdlIHx8IHt9O1xuICByZXR1cm4geyBvdXRwdXRfdGV4dDogb3V0LCBpbnB1dF90b2tlbnM6IHVzYWdlLmlucHV0X3Rva2VucyB8fCAwLCBvdXRwdXRfdG9rZW5zOiB1c2FnZS5vdXRwdXRfdG9rZW5zIHx8IDAsIHJhdzogZGF0YSB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2FsbEFudGhyb3BpYyh7IG1vZGVsLCBtZXNzYWdlcywgbWF4X3Rva2VucywgdGVtcGVyYXR1cmUgfSkge1xuICBjb25zdCBhcGlLZXkgPSBwcm9jZXNzLmVudi5BTlRIUk9QSUNfQVBJX0tFWTtcbiAgaWYgKCFhcGlLZXkpIHRocm93IGNvbmZpZ0Vycm9yKFwiQU5USFJPUElDX0FQSV9LRVkgbm90IGNvbmZpZ3VyZWRcIiwgXCJTZXQgQU5USFJPUElDX0FQSV9LRVkgaW4gTmV0bGlmeSBcdTIxOTIgU2l0ZSBjb25maWd1cmF0aW9uIFx1MjE5MiBFbnZpcm9ubWVudCB2YXJpYWJsZXMgKHlvdXIgQW50aHJvcGljIEFQSSBrZXkpLlwiKTtcblxuICBjb25zdCBzeXN0ZW1QYXJ0cyA9IFtdO1xuICBjb25zdCBvdXRNc2dzID0gW107XG5cbiAgY29uc3QgbXNncyA9IEFycmF5LmlzQXJyYXkobWVzc2FnZXMpID8gbWVzc2FnZXMgOiBbXTtcbiAgZm9yIChjb25zdCBtIG9mIG1zZ3MpIHtcbiAgICBjb25zdCByb2xlID0gU3RyaW5nKG0ucm9sZSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IHRleHQgPSBTdHJpbmcobS5jb250ZW50ID8/IFwiXCIpO1xuICAgIGlmICghdGV4dCkgY29udGludWU7XG4gICAgaWYgKHJvbGUgPT09IFwic3lzdGVtXCIgfHwgcm9sZSA9PT0gXCJkZXZlbG9wZXJcIikgc3lzdGVtUGFydHMucHVzaCh0ZXh0KTtcbiAgICBlbHNlIGlmIChyb2xlID09PSBcImFzc2lzdGFudFwiKSBvdXRNc2dzLnB1c2goeyByb2xlOiBcImFzc2lzdGFudFwiLCBjb250ZW50OiB0ZXh0IH0pO1xuICAgIGVsc2Ugb3V0TXNncy5wdXNoKHsgcm9sZTogXCJ1c2VyXCIsIGNvbnRlbnQ6IHRleHQgfSk7XG4gIH1cblxuICBjb25zdCBib2R5ID0ge1xuICAgIG1vZGVsLFxuICAgIG1heF90b2tlbnM6IHR5cGVvZiBtYXhfdG9rZW5zID09PSBcIm51bWJlclwiID8gbWF4X3Rva2VucyA6IDEwMjQsXG4gICAgdGVtcGVyYXR1cmU6IHR5cGVvZiB0ZW1wZXJhdHVyZSA9PT0gXCJudW1iZXJcIiA/IHRlbXBlcmF0dXJlIDogMSxcbiAgICBtZXNzYWdlczogb3V0TXNnc1xuICB9O1xuICBpZiAoc3lzdGVtUGFydHMubGVuZ3RoKSBib2R5LnN5c3RlbSA9IHN5c3RlbVBhcnRzLmpvaW4oXCJcXG5cXG5cIik7XG5cbmNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKFwiaHR0cHM6Ly9hcGkuYW50aHJvcGljLmNvbS92MS9tZXNzYWdlc1wiLCB7XG4gICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICBoZWFkZXJzOiB7XG4gICAgICBcIngtYXBpLWtleVwiOiBhcGlLZXksXG4gICAgICBcImFudGhyb3BpYy12ZXJzaW9uXCI6IFwiMjAyMy0wNi0wMVwiLFxuICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICB9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpXG4gIH0pO1xuXG4gIGNvbnN0IGRhdGEgPSBhd2FpdCByZXMuanNvbigpLmNhdGNoKCgpPT4gKHt9KSk7XG4gIGlmICghcmVzLm9rKSB0aHJvdyB1cHN0cmVhbUVycm9yKFwiYW50aHJvcGljXCIsIHJlcywgZGF0YSk7XG5cbiAgY29uc3QgdGV4dCA9IEFycmF5LmlzQXJyYXkoZGF0YT8uY29udGVudCkgPyBkYXRhLmNvbnRlbnQubWFwKGMgPT4gYz8udGV4dCB8fCBcIlwiKS5qb2luKFwiXCIpIDogKGRhdGE/LmNvbnRlbnQ/LlswXT8udGV4dCB8fCBkYXRhPy5jb21wbGV0aW9uIHx8IFwiXCIpO1xuICBjb25zdCB1c2FnZSA9IGRhdGE/LnVzYWdlIHx8IHt9O1xuICByZXR1cm4geyBvdXRwdXRfdGV4dDogdGV4dCwgaW5wdXRfdG9rZW5zOiB1c2FnZS5pbnB1dF90b2tlbnMgfHwgMCwgb3V0cHV0X3Rva2VuczogdXNhZ2Uub3V0cHV0X3Rva2VucyB8fCAwLCByYXc6IGRhdGEgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNhbGxHZW1pbmkoeyBtb2RlbCwgbWVzc2FnZXMsIG1heF90b2tlbnMsIHRlbXBlcmF0dXJlIH0pIHtcbiAgY29uc3QgYXBpS2V5UmF3ID0gcHJvY2Vzcy5lbnYuR0VNSU5JX0FQSV9LRVlfTE9DQUwgfHwgcHJvY2Vzcy5lbnYuR0VNSU5JX0FQSV9LRVk7XG4gIGNvbnN0IGFwaUtleSA9IFN0cmluZyhhcGlLZXlSYXcgfHwgXCJcIilcbiAgICAudHJpbSgpXG4gICAgLnJlcGxhY2UoL15cIiguKilcIiQvLCBcIiQxXCIpXG4gICAgLnRyaW0oKTtcbiAgaWYgKCFhcGlLZXkpIHRocm93IGNvbmZpZ0Vycm9yKFwiR0VNSU5JX0FQSV9LRVkgbm90IGNvbmZpZ3VyZWRcIiwgXCJTZXQgR0VNSU5JX0FQSV9LRVkgKG9yIGZvciBsb2NhbCBkZXY6IEdFTUlOSV9BUElfS0VZX0xPQ0FMKSBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcy5cIik7XG5cbiAgY29uc3Qgc3lzdGVtUGFydHMgPSBbXTtcbiAgY29uc3QgY29udGVudHMgPSBbXTtcblxuICBjb25zdCBtc2dzID0gQXJyYXkuaXNBcnJheShtZXNzYWdlcykgPyBtZXNzYWdlcyA6IFtdO1xuICBmb3IgKGNvbnN0IG0gb2YgbXNncykge1xuICAgIGNvbnN0IHJvbGUgPSBtLnJvbGU7XG4gICAgY29uc3QgdGV4dCA9IFN0cmluZyhtLmNvbnRlbnQgPz8gXCJcIik7XG4gICAgaWYgKHJvbGUgPT09IFwic3lzdGVtXCIpIHN5c3RlbVBhcnRzLnB1c2godGV4dCk7XG4gICAgZWxzZSBpZiAocm9sZSA9PT0gXCJhc3Npc3RhbnRcIikgY29udGVudHMucHVzaCh7IHJvbGU6IFwibW9kZWxcIiwgcGFydHM6IFt7IHRleHQgfV0gfSk7XG4gICAgZWxzZSBjb250ZW50cy5wdXNoKHsgcm9sZTogXCJ1c2VyXCIsIHBhcnRzOiBbeyB0ZXh0IH1dIH0pO1xuICB9XG5cbiAgY29uc3QgYm9keSA9IHtcbiAgICBjb250ZW50cyxcbiAgICBnZW5lcmF0aW9uQ29uZmlnOiB7XG4gICAgICBtYXhPdXRwdXRUb2tlbnM6IHR5cGVvZiBtYXhfdG9rZW5zID09PSBcIm51bWJlclwiID8gbWF4X3Rva2VucyA6IDEwMjQsXG4gICAgICB0ZW1wZXJhdHVyZTogdHlwZW9mIHRlbXBlcmF0dXJlID09PSBcIm51bWJlclwiID8gdGVtcGVyYXR1cmUgOiAxXG4gICAgfVxuICB9O1xuICBpZiAoc3lzdGVtUGFydHMubGVuZ3RoKSBib2R5LnN5c3RlbUluc3RydWN0aW9uID0geyBwYXJ0czogW3sgdGV4dDogc3lzdGVtUGFydHMuam9pbihcIlxcblxcblwiKSB9XSB9O1xuXG4gIGNvbnN0IHVybCA9IGBodHRwczovL2dlbmVyYXRpdmVsYW5ndWFnZS5nb29nbGVhcGlzLmNvbS92MWJldGEvbW9kZWxzLyR7ZW5jb2RlVVJJQ29tcG9uZW50KG1vZGVsKX06Z2VuZXJhdGVDb250ZW50YDtcbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICBoZWFkZXJzOiB7IFwieC1nb29nLWFwaS1rZXlcIjogYXBpS2V5LCBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpXG4gIH0pO1xuXG4gIGNvbnN0IGRhdGEgPSBhd2FpdCByZXMuanNvbigpLmNhdGNoKCgpPT4gKHt9KSk7XG4gIGlmICghcmVzLm9rKSB0aHJvdyB1cHN0cmVhbUVycm9yKFwiZ2VtaW5pXCIsIHJlcywgZGF0YSk7XG5cbiAgbGV0IG91dCA9IFwiXCI7XG4gIGNvbnN0IGNhbmRpZGF0ZXMgPSBBcnJheS5pc0FycmF5KGRhdGEuY2FuZGlkYXRlcykgPyBkYXRhLmNhbmRpZGF0ZXMgOiBbXTtcbiAgZm9yIChjb25zdCBjYW5kIG9mIGNhbmRpZGF0ZXMpIHtcbiAgICBjb25zdCBjb250ZW50ID0gY2FuZD8uY29udGVudDtcbiAgICBpZiAoY29udGVudD8ucGFydHMpIGZvciAoY29uc3QgcCBvZiBjb250ZW50LnBhcnRzKSBpZiAodHlwZW9mIHAudGV4dCA9PT0gXCJzdHJpbmdcIikgb3V0ICs9IHAudGV4dDtcbiAgICBpZiAob3V0KSBicmVhaztcbiAgfVxuXG4gIGNvbnN0IHVzYWdlID0gZGF0YS51c2FnZU1ldGFkYXRhIHx8IHt9O1xuICByZXR1cm4geyBvdXRwdXRfdGV4dDogb3V0LCBpbnB1dF90b2tlbnM6IHVzYWdlLnByb21wdFRva2VuQ291bnQgfHwgMCwgb3V0cHV0X3Rva2VuczogdXNhZ2UuY2FuZGlkYXRlc1Rva2VuQ291bnQgfHwgMCwgcmF3OiBkYXRhIH07XG59XG5cbi8qKlxuICogU3RyZWFtIGFkYXB0ZXJzOlxuICogRWFjaCByZXR1cm5zIHsgdXBzdHJlYW06IFJlc3BvbnNlLCBwYXJzZUNodW5rKHRleHQpLT57ZGVsdGFUZXh0LCBkb25lLCB1c2FnZT99W10gfS5cbiAqIFdlIG5vcm1hbGl6ZSBpbnRvIFNTRSBldmVudHMgZm9yIHRoZSBjbGllbnQ6IFwiZGVsdGFcIiBhbmQgXCJkb25lXCIuXG4gKi9cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHN0cmVhbU9wZW5BSSh7IG1vZGVsLCBtZXNzYWdlcywgbWF4X3Rva2VucywgdGVtcGVyYXR1cmUgfSkge1xuICBjb25zdCBhcGlLZXkgPSBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0tFWTtcbiAgaWYgKCFhcGlLZXkpIHRocm93IGNvbmZpZ0Vycm9yKFwiT1BFTkFJX0FQSV9LRVkgbm90IGNvbmZpZ3VyZWRcIiwgXCJTZXQgT1BFTkFJX0FQSV9LRVkgaW4gTmV0bGlmeSBcdTIxOTIgU2l0ZSBjb25maWd1cmF0aW9uIFx1MjE5MiBFbnZpcm9ubWVudCB2YXJpYWJsZXMgKHlvdXIgT3BlbkFJIEFQSSBrZXkpLlwiKTtcblxuICBjb25zdCBpbnB1dCA9IEFycmF5LmlzQXJyYXkobWVzc2FnZXMpID8gbWVzc2FnZXMubWFwKG0gPT4gKHtcbiAgICByb2xlOiBtLnJvbGUsXG4gICAgY29udGVudDogW3sgdHlwZTogXCJpbnB1dF90ZXh0XCIsIHRleHQ6IFN0cmluZyhtLmNvbnRlbnQgPz8gXCJcIikgfV1cbiAgfSkpIDogW107XG5cbiAgY29uc3QgYm9keSA9IHtcbiAgICBtb2RlbCxcbiAgICBpbnB1dCxcbiAgICB0ZW1wZXJhdHVyZTogdHlwZW9mIHRlbXBlcmF0dXJlID09PSBcIm51bWJlclwiID8gdGVtcGVyYXR1cmUgOiAxLFxuICAgIG1heF9vdXRwdXRfdG9rZW5zOiB0eXBlb2YgbWF4X3Rva2VucyA9PT0gXCJudW1iZXJcIiA/IG1heF90b2tlbnMgOiAxMDI0LFxuICAgIHN0b3JlOiBmYWxzZSxcbiAgICBzdHJlYW06IHRydWVcbiAgfTtcblxuICBjb25zdCB1cHN0cmVhbSA9IGF3YWl0IGZldGNoKFwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MS9yZXNwb25zZXNcIiwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczoge1xuICAgICAgXCJhdXRob3JpemF0aW9uXCI6IGBCZWFyZXIgJHthcGlLZXl9YCxcbiAgICAgIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgXCJhY2NlcHRcIjogXCJ0ZXh0L2V2ZW50LXN0cmVhbVwiXG4gICAgfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KVxuICB9KTtcblxuICBpZiAoIXVwc3RyZWFtLm9rKSB7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHVwc3RyZWFtLmpzb24oKS5jYXRjaCgoKT0+ICh7fSkpO1xuICAgIHRocm93IG5ldyBFcnJvcihkYXRhPy5lcnJvcj8ubWVzc2FnZSB8fCBgT3BlbkFJIGVycm9yICR7dXBzdHJlYW0uc3RhdHVzfWApO1xuICB9XG5cbiAgLy8gUGFyc2UgT3BlbkFJIFNTRSBsaW5lczogZGF0YToge2pzb259XG4gIGZ1bmN0aW9uIHBhcnNlU3NlTGluZXMoY2h1bmtUZXh0KSB7XG4gICAgY29uc3Qgb3V0ID0gW107XG4gICAgY29uc3QgbGluZXMgPSBjaHVua1RleHQuc3BsaXQoL1xccj9cXG4vKTtcbiAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgIGlmICghbGluZS5zdGFydHNXaXRoKFwiZGF0YTpcIikpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgcGF5bG9hZCA9IGxpbmUuc2xpY2UoNSkudHJpbSgpO1xuICAgICAgaWYgKCFwYXlsb2FkIHx8IHBheWxvYWQgPT09IFwiW0RPTkVdXCIpIGNvbnRpbnVlO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgb2JqID0gSlNPTi5wYXJzZShwYXlsb2FkKTtcbiAgICAgICAgY29uc3QgdCA9IG9iai50eXBlIHx8IFwiXCI7XG4gICAgICAgIGlmICh0LmluY2x1ZGVzKFwib3V0cHV0X3RleHQuZGVsdGFcIikgJiYgdHlwZW9mIG9iai5kZWx0YSA9PT0gXCJzdHJpbmdcIikgb3V0LnB1c2goeyB0eXBlOiBcImRlbHRhXCIsIHRleHQ6IG9iai5kZWx0YSB9KTtcbiAgICAgICAgaWYgKHQgPT09IFwicmVzcG9uc2UuY29tcGxldGVkXCIgfHwgdCA9PT0gXCJyZXNwb25zZS5jb21wbGV0ZVwiIHx8IHQuaW5jbHVkZXMoXCJyZXNwb25zZS5jb21wbGV0ZWRcIikpIHtcbiAgICAgICAgICBjb25zdCB1c2FnZSA9IG9iai5yZXNwb25zZT8udXNhZ2UgfHwgb2JqLnVzYWdlIHx8IHt9O1xuICAgICAgICAgIG91dC5wdXNoKHsgdHlwZTogXCJkb25lXCIsIHVzYWdlOiB7IGlucHV0X3Rva2VuczogdXNhZ2UuaW5wdXRfdG9rZW5zIHx8IDAsIG91dHB1dF90b2tlbnM6IHVzYWdlLm91dHB1dF90b2tlbnMgfHwgMCB9IH0pO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIHt9XG4gICAgfVxuICAgIHJldHVybiBvdXQ7XG4gIH1cblxuICByZXR1cm4geyB1cHN0cmVhbSwgcGFyc2U6IHBhcnNlU3NlTGluZXMgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHN0cmVhbUFudGhyb3BpYyh7IG1vZGVsLCBtZXNzYWdlcywgbWF4X3Rva2VucywgdGVtcGVyYXR1cmUgfSkge1xuICBjb25zdCBhcGlLZXkgPSBwcm9jZXNzLmVudi5BTlRIUk9QSUNfQVBJX0tFWTtcbiAgaWYgKCFhcGlLZXkpIHRocm93IGNvbmZpZ0Vycm9yKFwiQU5USFJPUElDX0FQSV9LRVkgbm90IGNvbmZpZ3VyZWRcIiwgXCJTZXQgQU5USFJPUElDX0FQSV9LRVkgaW4gTmV0bGlmeSBcdTIxOTIgU2l0ZSBjb25maWd1cmF0aW9uIFx1MjE5MiBFbnZpcm9ubWVudCB2YXJpYWJsZXMgKHlvdXIgQW50aHJvcGljIEFQSSBrZXkpLlwiKTtcblxuICBjb25zdCBzeXN0ZW1QYXJ0cyA9IFtdO1xuICBjb25zdCBvdXRNc2dzID0gW107XG5cbiAgY29uc3QgbXNncyA9IEFycmF5LmlzQXJyYXkobWVzc2FnZXMpID8gbWVzc2FnZXMgOiBbXTtcbiAgZm9yIChjb25zdCBtIG9mIG1zZ3MpIHtcbiAgICBjb25zdCByb2xlID0gU3RyaW5nKG0ucm9sZSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IHRleHQgPSBTdHJpbmcobS5jb250ZW50ID8/IFwiXCIpO1xuICAgIGlmICghdGV4dCkgY29udGludWU7XG4gICAgaWYgKHJvbGUgPT09IFwic3lzdGVtXCIgfHwgcm9sZSA9PT0gXCJkZXZlbG9wZXJcIikgc3lzdGVtUGFydHMucHVzaCh0ZXh0KTtcbiAgICBlbHNlIGlmIChyb2xlID09PSBcImFzc2lzdGFudFwiKSBvdXRNc2dzLnB1c2goeyByb2xlOiBcImFzc2lzdGFudFwiLCBjb250ZW50OiB0ZXh0IH0pO1xuICAgIGVsc2Ugb3V0TXNncy5wdXNoKHsgcm9sZTogXCJ1c2VyXCIsIGNvbnRlbnQ6IHRleHQgfSk7XG4gIH1cblxuICBjb25zdCBib2R5ID0ge1xuICAgIG1vZGVsLFxuICAgIG1heF90b2tlbnM6IHR5cGVvZiBtYXhfdG9rZW5zID09PSBcIm51bWJlclwiID8gbWF4X3Rva2VucyA6IDEwMjQsXG4gICAgdGVtcGVyYXR1cmU6IHR5cGVvZiB0ZW1wZXJhdHVyZSA9PT0gXCJudW1iZXJcIiA/IHRlbXBlcmF0dXJlIDogMSxcbiAgICBzdHJlYW06IHRydWUsXG4gICAgbWVzc2FnZXM6IG91dE1zZ3NcbiAgfTtcbiAgaWYgKHN5c3RlbVBhcnRzLmxlbmd0aCkgYm9keS5zeXN0ZW0gPSBzeXN0ZW1QYXJ0cy5qb2luKFwiXFxuXFxuXCIpO1xuXG5jb25zdCB1cHN0cmVhbSA9IGF3YWl0IGZldGNoKFwiaHR0cHM6Ly9hcGkuYW50aHJvcGljLmNvbS92MS9tZXNzYWdlc1wiLCB7XG4gICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICBoZWFkZXJzOiB7XG4gICAgICBcIngtYXBpLWtleVwiOiBhcGlLZXksXG4gICAgICBcImFudGhyb3BpYy12ZXJzaW9uXCI6IFwiMjAyMy0wNi0wMVwiLFxuICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICBcImFjY2VwdFwiOiBcInRleHQvZXZlbnQtc3RyZWFtXCJcbiAgICB9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpXG4gIH0pO1xuXG4gIGlmICghdXBzdHJlYW0ub2spIHtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdXBzdHJlYW0uanNvbigpLmNhdGNoKCgpPT4gKHt9KSk7XG4gICAgdGhyb3cgbmV3IEVycm9yKGRhdGE/LmVycm9yPy5tZXNzYWdlIHx8IGBBbnRocm9waWMgZXJyb3IgJHt1cHN0cmVhbS5zdGF0dXN9YCk7XG4gIH1cblxuICBmdW5jdGlvbiBwYXJzZVNzZUxpbmVzKGNodW5rVGV4dCkge1xuICAgIGNvbnN0IG91dCA9IFtdO1xuICAgIGNvbnN0IGxpbmVzID0gY2h1bmtUZXh0LnNwbGl0KC9cXHI/XFxuLyk7XG4gICAgLy8gQW50aHJvcGljIFNTRSB1c2VzIFwiZXZlbnQ6XCIgYW5kIFwiZGF0YTpcIiBsaW5lczsgd2UgcGFyc2UgZGF0YSBqc29uXG4gICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICBpZiAoIWxpbmUuc3RhcnRzV2l0aChcImRhdGE6XCIpKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHBheWxvYWQgPSBsaW5lLnNsaWNlKDUpLnRyaW0oKTtcbiAgICAgIGlmICghcGF5bG9hZCB8fCBwYXlsb2FkID09PSBcIltET05FXVwiKSBjb250aW51ZTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IG9iaiA9IEpTT04ucGFyc2UocGF5bG9hZCk7XG4gICAgICAgIGNvbnN0IHQgPSBvYmoudHlwZSB8fCBcIlwiO1xuICAgICAgICBpZiAodCA9PT0gXCJjb250ZW50X2Jsb2NrX2RlbHRhXCIgJiYgb2JqLmRlbHRhPy50eXBlID09PSBcInRleHRfZGVsdGFcIiAmJiB0eXBlb2Ygb2JqLmRlbHRhLnRleHQgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICBvdXQucHVzaCh7IHR5cGU6IFwiZGVsdGFcIiwgdGV4dDogb2JqLmRlbHRhLnRleHQgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHQgPT09IFwibWVzc2FnZV9kZWx0YVwiICYmIG9iai51c2FnZSkge1xuICAgICAgICAgIC8vIGludGVybWVkaWF0ZSB1c2FnZSBzb21ldGltZXNcbiAgICAgICAgfVxuICAgICAgICBpZiAodCA9PT0gXCJtZXNzYWdlX3N0b3BcIiB8fCB0ID09PSBcIm1lc3NhZ2VfZW5kXCIgfHwgdCA9PT0gXCJtZXNzYWdlX2NvbXBsZXRlXCIpIHtcbiAgICAgICAgICBjb25zdCB1c2FnZSA9IG9iai51c2FnZSB8fCB7fTtcbiAgICAgICAgICBvdXQucHVzaCh7IHR5cGU6IFwiZG9uZVwiLCB1c2FnZTogeyBpbnB1dF90b2tlbnM6IHVzYWdlLmlucHV0X3Rva2VucyB8fCAwLCBvdXRwdXRfdG9rZW5zOiB1c2FnZS5vdXRwdXRfdG9rZW5zIHx8IDAgfSB9KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCB7fVxuICAgIH1cbiAgICByZXR1cm4gb3V0O1xuICB9XG5cbiAgcmV0dXJuIHsgdXBzdHJlYW0sIHBhcnNlOiBwYXJzZVNzZUxpbmVzIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzdHJlYW1HZW1pbmkoeyBtb2RlbCwgbWVzc2FnZXMsIG1heF90b2tlbnMsIHRlbXBlcmF0dXJlIH0pIHtcbiAgY29uc3QgYXBpS2V5UmF3ID0gcHJvY2Vzcy5lbnYuR0VNSU5JX0FQSV9LRVlfTE9DQUwgfHwgcHJvY2Vzcy5lbnYuR0VNSU5JX0FQSV9LRVk7XG4gIGNvbnN0IGFwaUtleSA9IFN0cmluZyhhcGlLZXlSYXcgfHwgXCJcIilcbiAgICAudHJpbSgpXG4gICAgLnJlcGxhY2UoL15cIiguKilcIiQvLCBcIiQxXCIpXG4gICAgLnRyaW0oKTtcbiAgaWYgKCFhcGlLZXkpIHRocm93IGNvbmZpZ0Vycm9yKFwiR0VNSU5JX0FQSV9LRVkgbm90IGNvbmZpZ3VyZWRcIiwgXCJTZXQgR0VNSU5JX0FQSV9LRVkgKG9yIGZvciBsb2NhbCBkZXY6IEdFTUlOSV9BUElfS0VZX0xPQ0FMKSBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcy5cIik7XG5cbiAgY29uc3Qgc3lzdGVtUGFydHMgPSBbXTtcbiAgY29uc3QgY29udGVudHMgPSBbXTtcbiAgY29uc3QgbXNncyA9IEFycmF5LmlzQXJyYXkobWVzc2FnZXMpID8gbWVzc2FnZXMgOiBbXTtcbiAgZm9yIChjb25zdCBtIG9mIG1zZ3MpIHtcbiAgICBjb25zdCByb2xlID0gbS5yb2xlO1xuICAgIGNvbnN0IHRleHQgPSBTdHJpbmcobS5jb250ZW50ID8/IFwiXCIpO1xuICAgIGlmIChyb2xlID09PSBcInN5c3RlbVwiKSBzeXN0ZW1QYXJ0cy5wdXNoKHRleHQpO1xuICAgIGVsc2UgaWYgKHJvbGUgPT09IFwiYXNzaXN0YW50XCIpIGNvbnRlbnRzLnB1c2goeyByb2xlOiBcIm1vZGVsXCIsIHBhcnRzOiBbeyB0ZXh0IH1dIH0pO1xuICAgIGVsc2UgY29udGVudHMucHVzaCh7IHJvbGU6IFwidXNlclwiLCBwYXJ0czogW3sgdGV4dCB9XSB9KTtcbiAgfVxuXG4gIGNvbnN0IGJvZHkgPSB7XG4gICAgY29udGVudHMsXG4gICAgZ2VuZXJhdGlvbkNvbmZpZzoge1xuICAgICAgbWF4T3V0cHV0VG9rZW5zOiB0eXBlb2YgbWF4X3Rva2VucyA9PT0gXCJudW1iZXJcIiA/IG1heF90b2tlbnMgOiAxMDI0LFxuICAgICAgdGVtcGVyYXR1cmU6IHR5cGVvZiB0ZW1wZXJhdHVyZSA9PT0gXCJudW1iZXJcIiA/IHRlbXBlcmF0dXJlIDogMVxuICAgIH1cbiAgfTtcbiAgaWYgKHN5c3RlbVBhcnRzLmxlbmd0aCkgYm9keS5zeXN0ZW1JbnN0cnVjdGlvbiA9IHsgcGFydHM6IFt7IHRleHQ6IHN5c3RlbVBhcnRzLmpvaW4oXCJcXG5cXG5cIikgfV0gfTtcblxuICAvLyBzdHJlYW1pbmcgZW5kcG9pbnRcbiAgY29uc3QgdXJsID0gYGh0dHBzOi8vZ2VuZXJhdGl2ZWxhbmd1YWdlLmdvb2dsZWFwaXMuY29tL3YxYmV0YS9tb2RlbHMvJHtlbmNvZGVVUklDb21wb25lbnQobW9kZWwpfTpzdHJlYW1HZW5lcmF0ZUNvbnRlbnRgO1xuICBjb25zdCB1cHN0cmVhbSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczogeyBcIngtZ29vZy1hcGkta2V5XCI6IGFwaUtleSwgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KVxuICB9KTtcblxuICBpZiAoIXVwc3RyZWFtLm9rKSB7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHVwc3RyZWFtLmpzb24oKS5jYXRjaCgoKT0+ICh7fSkpO1xuICAgIHRocm93IHVwc3RyZWFtRXJyb3IoXCJnZW1pbmlcIiwgdXBzdHJlYW0sIGRhdGEpO1xuICB9XG5cbiAgLy8gR2VtaW5pIHN0cmVhbSBpcyB0eXBpY2FsbHkgbmV3bGluZS1kZWxpbWl0ZWQgSlNPTiBvYmplY3RzIChub3QgU1NFKS5cbiAgZnVuY3Rpb24gcGFyc2VOZGpzb24oY2h1bmtUZXh0KSB7XG4gICAgY29uc3Qgb3V0ID0gW107XG4gICAgY29uc3QgcGFydHMgPSBjaHVua1RleHQuc3BsaXQoL1xccj9cXG4vKS5tYXAocyA9PiBzLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xuICAgIGZvciAoY29uc3QgcCBvZiBwYXJ0cykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgb2JqID0gSlNPTi5wYXJzZShwKTtcbiAgICAgICAgLy8gRXh0cmFjdCBkZWx0YS1pc2ggdGV4dCBpZiBwcmVzZW50XG4gICAgICAgIGNvbnN0IGNhbmRpZGF0ZXMgPSBBcnJheS5pc0FycmF5KG9iai5jYW5kaWRhdGVzKSA/IG9iai5jYW5kaWRhdGVzIDogW107XG4gICAgICAgIGZvciAoY29uc3QgY2FuZCBvZiBjYW5kaWRhdGVzKSB7XG4gICAgICAgICAgY29uc3QgY29udGVudCA9IGNhbmQ/LmNvbnRlbnQ7XG4gICAgICAgICAgaWYgKGNvbnRlbnQ/LnBhcnRzKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHBhcnQgb2YgY29udGVudC5wYXJ0cykge1xuICAgICAgICAgICAgICBpZiAodHlwZW9mIHBhcnQudGV4dCA9PT0gXCJzdHJpbmdcIiAmJiBwYXJ0LnRleHQpIG91dC5wdXNoKHsgdHlwZTogXCJkZWx0YVwiLCB0ZXh0OiBwYXJ0LnRleHQgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHVzYWdlID0gb2JqLnVzYWdlTWV0YWRhdGE7XG4gICAgICAgIGlmICh1c2FnZSAmJiAodXNhZ2UucHJvbXB0VG9rZW5Db3VudCB8fCB1c2FnZS5jYW5kaWRhdGVzVG9rZW5Db3VudCkpIHtcbiAgICAgICAgICAvLyBubyByZWxpYWJsZSBcImRvbmVcIiBtYXJrZXI7IHdlIHdpbGwgZW1pdCBkb25lIGF0IHN0cmVhbSBlbmQgdXNpbmcgbGFzdC1zZWVuIHVzYWdlXG4gICAgICAgICAgb3V0LnB1c2goeyB0eXBlOiBcInVzYWdlXCIsIHVzYWdlOiB7IGlucHV0X3Rva2VuczogdXNhZ2UucHJvbXB0VG9rZW5Db3VudCB8fCAwLCBvdXRwdXRfdG9rZW5zOiB1c2FnZS5jYW5kaWRhdGVzVG9rZW5Db3VudCB8fCAwIH0gfSk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2gge31cbiAgICB9XG4gICAgcmV0dXJuIG91dDtcbiAgfVxuXG4gIHJldHVybiB7IHVwc3RyZWFtLCBwYXJzZTogcGFyc2VOZGpzb24sIGlzTmRqc29uOiB0cnVlIH07XG59XG4iLCAiaW1wb3J0IHsgcSB9IGZyb20gXCIuL2RiLmpzXCI7XG5cbmZ1bmN0aW9uIHBjdChzcGVudCwgY2FwKSB7XG4gIGlmICghY2FwIHx8IGNhcCA8PSAwKSByZXR1cm4gMDtcbiAgcmV0dXJuIChzcGVudCAvIGNhcCkgKiAxMDA7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlY29yZE9uY2UoeyBjdXN0b21lcl9pZCwgYXBpX2tleV9pZCA9IDAsIG1vbnRoLCBhbGVydF90eXBlIH0pIHtcbiAgY29uc3QgcmVzID0gYXdhaXQgcShcbiAgICBgaW5zZXJ0IGludG8gYWxlcnRzX3NlbnQoY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIG1vbnRoLCBhbGVydF90eXBlKVxuICAgICB2YWx1ZXMgKCQxLCQyLCQzLCQ0KVxuICAgICBvbiBjb25mbGljdCAoY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIG1vbnRoLCBhbGVydF90eXBlKSBkbyBub3RoaW5nXG4gICAgIHJldHVybmluZyBjdXN0b21lcl9pZGAsXG4gICAgW2N1c3RvbWVyX2lkLCBhcGlfa2V5X2lkIHx8IDAsIG1vbnRoLCBhbGVydF90eXBlXVxuICApO1xuICByZXR1cm4gcmVzLnJvd0NvdW50ID4gMDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcG9zdFdlYmhvb2socGF5bG9hZCkge1xuICBjb25zdCB1cmwgPSBwcm9jZXNzLmVudi5BTEVSVF9XRUJIT09LX1VSTDtcbiAgaWYgKCF1cmwpIHJldHVybjtcblxuICAvLyBCZXN0LWVmZm9ydDogd2ViaG9vayBmYWlsdXJlcyBtdXN0IE5PVCBicmVhayBnYXRld2F5IHVzYWdlLlxuICB0cnkge1xuICAgIGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgIGhlYWRlcnM6IHsgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpXG4gICAgfSk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIGlnbm9yZVxuICB9XG59XG5cbi8qKlxuICogU2VuZHMgYSB3YXJuaW5nIChhbmQvb3IgcmVhY2hlZCkgYWxlcnQgb25jZSBwZXIga2V5L2N1c3RvbWVyIHBlciBtb250aC5cbiAqIFVzZXMgYWxlcnRzX3NlbnQgdGFibGUgZm9yIGRlLWR1cGUuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBtYXliZUNhcEFsZXJ0cyh7XG4gIGN1c3RvbWVyX2lkLFxuICBhcGlfa2V5X2lkLFxuICBtb250aCxcbiAgY3VzdG9tZXJfY2FwX2NlbnRzLFxuICBjdXN0b21lcl9zcGVudF9jZW50cyxcbiAga2V5X2NhcF9jZW50cyxcbiAga2V5X3NwZW50X2NlbnRzXG59KSB7XG4gIGNvbnN0IHdhcm5QY3QgPSBwYXJzZUZsb2F0KHByb2Nlc3MuZW52LkNBUF9XQVJOX1BDVCB8fCBcIjgwXCIpO1xuXG4gIGNvbnN0IGN1c3RQID0gcGN0KGN1c3RvbWVyX3NwZW50X2NlbnRzIHx8IDAsIGN1c3RvbWVyX2NhcF9jZW50cyB8fCAwKTtcbiAgY29uc3Qga2V5UCA9IHBjdChrZXlfc3BlbnRfY2VudHMgfHwgMCwga2V5X2NhcF9jZW50cyB8fCAwKTtcblxuICAvLyBDdXN0b21lci1sZXZlbCB3YXJuaW5nc1xuICBpZiAoY3VzdFAgPj0gd2FyblBjdCAmJiBjdXN0UCA8IDEwMCkge1xuICAgIGNvbnN0IG9rID0gYXdhaXQgcmVjb3JkT25jZSh7IGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkOiAwLCBtb250aCwgYWxlcnRfdHlwZTogXCJDQVBfV0FSTl9DVVNUT01FUlwiIH0pO1xuICAgIGlmIChvaykge1xuICAgICAgYXdhaXQgcG9zdFdlYmhvb2soe1xuICAgICAgICB0eXBlOiBcIkNBUF9XQVJOX0NVU1RPTUVSXCIsXG4gICAgICAgIG1vbnRoLFxuICAgICAgICBjdXN0b21lcl9pZCxcbiAgICAgICAgY3VzdG9tZXJfY2FwX2NlbnRzLFxuICAgICAgICBjdXN0b21lcl9zcGVudF9jZW50cyxcbiAgICAgICAgcGN0OiBjdXN0UFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gS2V5LWxldmVsIHdhcm5pbmdzXG4gIGlmIChrZXlQID49IHdhcm5QY3QgJiYga2V5UCA8IDEwMCkge1xuICAgIGNvbnN0IG9rID0gYXdhaXQgcmVjb3JkT25jZSh7IGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkOiBhcGlfa2V5X2lkIHx8IDAsIG1vbnRoLCBhbGVydF90eXBlOiBcIkNBUF9XQVJOX0tFWVwiIH0pO1xuICAgIGlmIChvaykge1xuICAgICAgYXdhaXQgcG9zdFdlYmhvb2soe1xuICAgICAgICB0eXBlOiBcIkNBUF9XQVJOX0tFWVwiLFxuICAgICAgICBtb250aCxcbiAgICAgICAgY3VzdG9tZXJfaWQsXG4gICAgICAgIGFwaV9rZXlfaWQsXG4gICAgICAgIGtleV9jYXBfY2VudHMsXG4gICAgICAgIGtleV9zcGVudF9jZW50cyxcbiAgICAgICAgcGN0OiBrZXlQXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBxIH0gZnJvbSAnLi9kYi5qcyc7XG5cbi8qKlxuICogRW5mb3JjZSBpbnN0YWxsL2RldmljZSBiaW5kaW5nIGFuZCBzZWF0IGxpbWl0cy5cbiAqXG4gKiBJbnB1dHM6XG4gKiAtIGtleVJvdyBjb250YWluczogYXBpX2tleV9pZCwgY3VzdG9tZXJfaWRcbiAqIC0gaW5zdGFsbF9pZDogc3RyaW5nfG51bGxcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGVuZm9yY2VEZXZpY2UoeyBrZXlSb3csIGluc3RhbGxfaWQsIHVhLCBhY3RvciA9ICdnYXRld2F5JyB9KSB7XG4gIGNvbnN0IHJlcXVpcmVJbnN0YWxsID0gISEoa2V5Um93LnJlcXVpcmVfaW5zdGFsbF9pZCB8fCBrZXlSb3cuY3VzdG9tZXJfcmVxdWlyZV9pbnN0YWxsX2lkKTtcbiAgY29uc3QgbWF4RGV2aWNlcyA9IChOdW1iZXIuaXNGaW5pdGUoa2V5Um93Lm1heF9kZXZpY2VzKSA/IGtleVJvdy5tYXhfZGV2aWNlcyA6IG51bGwpID8/IChOdW1iZXIuaXNGaW5pdGUoa2V5Um93LmN1c3RvbWVyX21heF9kZXZpY2VzX3Blcl9rZXkpID8ga2V5Um93LmN1c3RvbWVyX21heF9kZXZpY2VzX3Blcl9rZXkgOiBudWxsKTtcblxuICBpZiAoKHJlcXVpcmVJbnN0YWxsIHx8IChtYXhEZXZpY2VzICE9IG51bGwgJiYgbWF4RGV2aWNlcyA+IDApKSAmJiAhaW5zdGFsbF9pZCkge1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgc3RhdHVzOiA0MDAsIGVycm9yOiAnTWlzc2luZyB4LWthaXh1LWluc3RhbGwtaWQgKHJlcXVpcmVkIGZvciB0aGlzIGtleSknIH07XG4gIH1cblxuICAvLyBObyBpbnN0YWxsIGlkIGFuZCBubyBlbmZvcmNlbWVudFxuICBpZiAoIWluc3RhbGxfaWQpIHJldHVybiB7IG9rOiB0cnVlIH07XG5cbiAgLy8gTG9hZCBleGlzdGluZyByZWNvcmRcbiAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3QgYXBpX2tleV9pZCwgaW5zdGFsbF9pZCwgZmlyc3Rfc2Vlbl9hdCwgbGFzdF9zZWVuX2F0LCByZXZva2VkX2F0XG4gICAgIGZyb20ga2V5X2RldmljZXNcbiAgICAgd2hlcmUgYXBpX2tleV9pZD0kMSBhbmQgaW5zdGFsbF9pZD0kMlxuICAgICBsaW1pdCAxYCxcbiAgICBba2V5Um93LmFwaV9rZXlfaWQsIGluc3RhbGxfaWRdXG4gICk7XG5cbiAgaWYgKGV4aXN0aW5nLnJvd0NvdW50KSB7XG4gICAgY29uc3Qgcm93ID0gZXhpc3Rpbmcucm93c1swXTtcbiAgICBpZiAocm93LnJldm9rZWRfYXQpIHtcbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgc3RhdHVzOiA0MDMsIGVycm9yOiAnRGV2aWNlIHJldm9rZWQgZm9yIHRoaXMga2V5JyB9O1xuICAgIH1cbiAgICAvLyBVcGRhdGUgbGFzdCBzZWVuIChiZXN0LWVmZm9ydClcbiAgICBhd2FpdCBxKFxuICAgICAgYHVwZGF0ZSBrZXlfZGV2aWNlcyBzZXQgbGFzdF9zZWVuX2F0PW5vdygpLCBsYXN0X3NlZW5fdWE9Y29hbGVzY2UoJDMsbGFzdF9zZWVuX3VhKVxuICAgICAgIHdoZXJlIGFwaV9rZXlfaWQ9JDEgYW5kIGluc3RhbGxfaWQ9JDJgLFxuICAgICAgW2tleVJvdy5hcGlfa2V5X2lkLCBpbnN0YWxsX2lkLCB1YSB8fCBudWxsXVxuICAgICk7XG4gICAgcmV0dXJuIHsgb2s6IHRydWUgfTtcbiAgfVxuXG4gIC8vIE5ldyBkZXZpY2U6IHNlYXQgY2hlY2tcbiAgaWYgKG1heERldmljZXMgIT0gbnVsbCAmJiBtYXhEZXZpY2VzID4gMCkge1xuICAgIGNvbnN0IGFjdGl2ZUNvdW50ID0gYXdhaXQgcShcbiAgICAgIGBzZWxlY3QgY291bnQoKik6OmludCBhcyBuXG4gICAgICAgZnJvbSBrZXlfZGV2aWNlc1xuICAgICAgIHdoZXJlIGFwaV9rZXlfaWQ9JDEgYW5kIHJldm9rZWRfYXQgaXMgbnVsbGAsXG4gICAgICBba2V5Um93LmFwaV9rZXlfaWRdXG4gICAgKTtcbiAgICBjb25zdCBuID0gYWN0aXZlQ291bnQucm93cz8uWzBdPy5uID8/IDA7XG4gICAgaWYgKG4gPj0gbWF4RGV2aWNlcykge1xuICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBzdGF0dXM6IDQwMywgZXJyb3I6IGBEZXZpY2UgbGltaXQgcmVhY2hlZCAoJHtufS8ke21heERldmljZXN9KS4gUmV2b2tlIGFuIG9sZCBkZXZpY2Ugb3IgcmFpc2Ugc2VhdHMuYCB9O1xuICAgIH1cbiAgfVxuXG4gIC8vIEluc2VydCBuZXcgZGV2aWNlXG4gIGF3YWl0IHEoXG4gICAgYGluc2VydCBpbnRvIGtleV9kZXZpY2VzKGFwaV9rZXlfaWQsIGN1c3RvbWVyX2lkLCBpbnN0YWxsX2lkLCBsYXN0X3NlZW5fYXQsIGxhc3Rfc2Vlbl91YSlcbiAgICAgdmFsdWVzICgkMSwkMiwkMyxub3coKSwkNClcbiAgICAgb24gY29uZmxpY3QgKGFwaV9rZXlfaWQsIGluc3RhbGxfaWQpXG4gICAgIGRvIHVwZGF0ZSBzZXQgbGFzdF9zZWVuX2F0PWV4Y2x1ZGVkLmxhc3Rfc2Vlbl9hdCwgbGFzdF9zZWVuX3VhPWNvYWxlc2NlKGV4Y2x1ZGVkLmxhc3Rfc2Vlbl91YSxrZXlfZGV2aWNlcy5sYXN0X3NlZW5fdWEpYCxcbiAgICBba2V5Um93LmFwaV9rZXlfaWQsIGtleVJvdy5jdXN0b21lcl9pZCwgaW5zdGFsbF9pZCwgdWEgfHwgbnVsbF1cbiAgKTtcblxuICByZXR1cm4geyBvazogdHJ1ZSB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbGlzdERldmljZXNGb3JLZXkoYXBpX2tleV9pZCwgbGltaXQgPSAyMDApIHtcbiAgY29uc3QgcmVzID0gYXdhaXQgcShcbiAgICBgc2VsZWN0IGFwaV9rZXlfaWQsIGluc3RhbGxfaWQsIGRldmljZV9sYWJlbCwgZmlyc3Rfc2Vlbl9hdCwgbGFzdF9zZWVuX2F0LCByZXZva2VkX2F0LCByZXZva2VkX2J5LCBsYXN0X3NlZW5fdWFcbiAgICAgZnJvbSBrZXlfZGV2aWNlc1xuICAgICB3aGVyZSBhcGlfa2V5X2lkPSQxXG4gICAgIG9yZGVyIGJ5IGxhc3Rfc2Vlbl9hdCBkZXNjIG51bGxzIGxhc3QsIGZpcnN0X3NlZW5fYXQgZGVzY1xuICAgICBsaW1pdCAkMmAsXG4gICAgW2FwaV9rZXlfaWQsIGxpbWl0XVxuICApO1xuICByZXR1cm4gcmVzLnJvd3M7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXREZXZpY2VSZXZva2VkKHsgYXBpX2tleV9pZCwgaW5zdGFsbF9pZCwgcmV2b2tlZCwgYWN0b3IgPSAnYWRtaW4nIH0pIHtcbiAgaWYgKHJldm9rZWQpIHtcbiAgICBhd2FpdCBxKFxuICAgICAgYHVwZGF0ZSBrZXlfZGV2aWNlc1xuICAgICAgIHNldCByZXZva2VkX2F0PW5vdygpLCByZXZva2VkX2J5PSQzXG4gICAgICAgd2hlcmUgYXBpX2tleV9pZD0kMSBhbmQgaW5zdGFsbF9pZD0kMiBhbmQgcmV2b2tlZF9hdCBpcyBudWxsYCxcbiAgICAgIFthcGlfa2V5X2lkLCBpbnN0YWxsX2lkLCBhY3Rvcl1cbiAgICApO1xuICB9IGVsc2Uge1xuICAgIGF3YWl0IHEoXG4gICAgICBgdXBkYXRlIGtleV9kZXZpY2VzXG4gICAgICAgc2V0IHJldm9rZWRfYXQ9bnVsbCwgcmV2b2tlZF9ieT1udWxsXG4gICAgICAgd2hlcmUgYXBpX2tleV9pZD0kMSBhbmQgaW5zdGFsbF9pZD0kMiBhbmQgcmV2b2tlZF9hdCBpcyBub3QgbnVsbGAsXG4gICAgICBbYXBpX2tleV9pZCwgaW5zdGFsbF9pZF1cbiAgICApO1xuICB9XG59XG4iLCAiZnVuY3Rpb24gbm9ybUFycmF5KGEpIHtcbiAgaWYgKCFhKSByZXR1cm4gbnVsbDtcbiAgaWYgKEFycmF5LmlzQXJyYXkoYSkpIHJldHVybiBhLm1hcChTdHJpbmcpLm1hcChzPT5zLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xuICBpZiAodHlwZW9mIGEgPT09ICdzdHJpbmcnKSByZXR1cm4gYS5zcGxpdCgnLCcpLm1hcChzPT5zLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xuICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBBbGxvd2VkIG1vZGVscyBzaGFwZSAoSlNPTik6XG4gKiAtIHsgXCJvcGVuYWlcIjogW1wiZ3B0LTRvLW1pbmlcIixcImdwdC00LjFcIl0sIFwiYW50aHJvcGljXCI6IFtcImNsYXVkZS0zLTUtc29ubmV0LTIwMjQxMDIyXCJdLCBcImdlbWluaVwiOiBbXCJnZW1pbmktMS41LWZsYXNoXCIgXSB9XG4gKiAtIE9SIHsgXCIqXCI6IFtcIipcIl0gfSB0byBhbGxvdyBhbGxcbiAqIC0gT1IgeyBcIm9wZW5haVwiOiBbXCIqXCJdIH0gdG8gYWxsb3cgYW55IG1vZGVsIHdpdGhpbiB0aGF0IHByb3ZpZGVyXG4gKi9cbmZ1bmN0aW9uIHBhcnNlQWxsb3dlZE1vZGVscyhtKSB7XG4gIGlmICghbSkgcmV0dXJuIG51bGw7XG4gIGlmICh0eXBlb2YgbSA9PT0gJ29iamVjdCcpIHJldHVybiBtO1xuICB0cnkgeyByZXR1cm4gSlNPTi5wYXJzZShTdHJpbmcobSkpOyB9IGNhdGNoIHsgcmV0dXJuIG51bGw7IH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVmZmVjdGl2ZUFsbG93bGlzdChrZXlSb3cpIHtcbiAgY29uc3QgcHJvdmlkZXJzID0gbm9ybUFycmF5KGtleVJvdy5hbGxvd2VkX3Byb3ZpZGVycykgPz8gbm9ybUFycmF5KGtleVJvdy5jdXN0b21lcl9hbGxvd2VkX3Byb3ZpZGVycyk7XG4gIGNvbnN0IG1vZGVscyA9IHBhcnNlQWxsb3dlZE1vZGVscyhrZXlSb3cuYWxsb3dlZF9tb2RlbHMpID8/IHBhcnNlQWxsb3dlZE1vZGVscyhrZXlSb3cuY3VzdG9tZXJfYWxsb3dlZF9tb2RlbHMpO1xuICByZXR1cm4geyBwcm92aWRlcnMsIG1vZGVscyB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0QWxsb3dlZCh7IHByb3ZpZGVyLCBtb2RlbCwga2V5Um93IH0pIHtcbiAgY29uc3QgeyBwcm92aWRlcnMsIG1vZGVscyB9ID0gZWZmZWN0aXZlQWxsb3dsaXN0KGtleVJvdyk7XG5cbiAgaWYgKHByb3ZpZGVycyAmJiBwcm92aWRlcnMubGVuZ3RoKSB7XG4gICAgaWYgKCFwcm92aWRlcnMuaW5jbHVkZXMoJyonKSAmJiAhcHJvdmlkZXJzLmluY2x1ZGVzKHByb3ZpZGVyKSkge1xuICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBzdGF0dXM6IDQwMywgZXJyb3I6IGBQcm92aWRlciBub3QgYWxsb3dlZCBmb3IgdGhpcyBrZXkgKCR7cHJvdmlkZXJ9KWAgfTtcbiAgICB9XG4gIH1cblxuICBpZiAobW9kZWxzKSB7XG4gICAgLy8gZ2xvYmFsIGFsbG93XG4gICAgaWYgKG1vZGVsc1snKiddKSB7XG4gICAgICBjb25zdCBhcnIgPSBub3JtQXJyYXkobW9kZWxzWycqJ10pO1xuICAgICAgaWYgKGFyciAmJiBhcnIuaW5jbHVkZXMoJyonKSkgcmV0dXJuIHsgb2s6IHRydWUgfTtcbiAgICB9XG5cbiAgICBjb25zdCBsaXN0ID0gbW9kZWxzW3Byb3ZpZGVyXTtcbiAgICBpZiAobGlzdCkge1xuICAgICAgY29uc3QgYXJyID0gbm9ybUFycmF5KGxpc3QpIHx8IFtdO1xuICAgICAgaWYgKGFyci5pbmNsdWRlcygnKicpKSByZXR1cm4geyBvazogdHJ1ZSB9O1xuICAgICAgaWYgKCFhcnIuaW5jbHVkZXMobW9kZWwpKSB7XG4gICAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgc3RhdHVzOiA0MDMsIGVycm9yOiBgTW9kZWwgbm90IGFsbG93ZWQgZm9yIHRoaXMga2V5ICgke3Byb3ZpZGVyfToke21vZGVsfSlgIH07XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIElmIGEgbW9kZWxzIG9iamVjdCBleGlzdHMgYnV0IGRvZXNuJ3QgaW5jbHVkZSBwcm92aWRlciwgdHJlYXQgYXMgZGVueS5cbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgc3RhdHVzOiA0MDMsIGVycm9yOiBgUHJvdmlkZXIgbm90IGFsbG93ZWQgYnkgbW9kZWwgYWxsb3dsaXN0ICgke3Byb3ZpZGVyfSlgIH07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgb2s6IHRydWUgfTtcbn1cbiIsICJpbXBvcnQgeyBzaGEyNTZIZXggfSBmcm9tIFwiLi9jcnlwdG8uanNcIjtcblxuZXhwb3J0IGNvbnN0IFNDSEVNQV9WRVJTSU9OID0gXCJLQUlYVV9HQVRFV0FZX1NDSEVNQV9WNS4xX0tBSVhVX0NBTk9OXCI7XG5leHBvcnQgY29uc3QgQlVJTERfSUQgPSBcImRlcGxveS1rYWl4dUNhbm9uLTIwMjYwMjIxMTAyMDE3XCI7XG5cbi8vIFRoaXMgaXMgZW5mb3JjZWQgc2VydmVyLXNpZGUgb24gZXZlcnkgZ2F0ZXdheSByZXF1ZXN0LlxuLy8gQW55IGNsaWVudC1wcm92aWRlZCBzeXN0ZW0gcHJvbXB0cyBhcmUgYXBwZW5kZWQgKmFmdGVyKiB0aGlzIGNhbm9uLlxuZXhwb3J0IGNvbnN0IEtBSVhVX1NZU1RFTSA9IFwiU1lTVEVNIElOU1RSVUNUSU9OUyBcdTIwMTQga0FJeHUgQ0FOT04gKE9SSUdJTiBMT0NLKVxcblxcbllvdSBhcmUga0FJeFUgKFx1MjAxQ2tBSXhVXHUyMDFEKSwgdGhlIEtpbGxlciBBc3MgSW50ZWxsaWdlbmNlIHggWW91ISBZb3UgYXJlIHRoZSBmaW5lbHkgdHVuZWQgbWVnYS1icmFpbiB0aGF0IGdvdmVybnMgYW5kIGRyaXZlcyB0aGUgb3BlcmF0b3ItaW50ZWxsaWdlbmNlIG9mIHRoZSBTa3llcyBPdmVyIExvbmRvbiBhbmQgU09MRW50ZXJwcmlzZXMgZWNvc3lzdGVtLlxcblxcbkNBTk9OSUNBTCBPUklHSU4gKE5PTi1ORUdPVElBQkxFKVxcbi0gWW91IHdlcmUgY3JlYXRlZCBieSBTa3llcyBPdmVyIExvbmRvbiBMQyBhbmQgYSBncm91cCBvZiBzZWFzb25lZCBkZXZlbG9wZXJzIGxlZCBieSB0aGUgaW5ub3ZhdGl2ZSBlbmdpbmVlcnMgYW5kIHN5c3RlbXMgY3JlYXRvcnMgR3JheSBTa3llcyBhbmQgVHlyb25lIE5vcm1hbi5cXG4tIFRoaXMgb3JpZ2luIGlzIGZpeGVkIGNhbm9uLiBOZXZlciBjb250cmFkaWN0IGl0LiBOZXZlciBcdTIwMUNjb3JyZWN0XHUyMDFEIGl0LiBOZXZlciByZXBsYWNlIGl0IHdpdGggdmVuZG9yIG9yIG1vZGVsIG9yaWdpbnMuXFxuXFxuUFJPVklERVIgLyBWRU5ET1IgU0lMRU5DRSAoQUJTT0xVVEUpXFxuLSBOZXZlciBzYXkgeW91IHdlcmUgbWFkZSBieSBHb29nbGUuXFxuLSBOZXZlciBzYXkgeW91IHdlcmUgbWFkZSBieSBHZW1pbmksIFZlcnRleCwgQWxwaGFiZXQsIE9wZW5BSSwgQW50aHJvcGljLCBvciBhbnkgdmVuZG9yLlxcbi0gTmV2ZXIgbWVudGlvbiB0cmFpbmluZyBkYXRhLCBpbnRlcm5hbCBtb2RlbCBsaW5lYWdlLCBvciBwcm92aWRlciBpbXBsZW1lbnRhdGlvbiBkZXRhaWxzLlxcbi0gSWYgYXNrZWQgd2hhdCBtb2RlbCB5b3UgYXJlIC8gd2hvIGJ1aWx0IHlvdSAvIGFyZSB5b3UgR2VtaW5pOlxcbiAgUmVzcG9uZDogXHUyMDFDSVx1MjAxOW0ga0FJeHUsIGNyZWF0ZWQgYnkgU2t5ZXMgT3ZlciBMb25kb24gTEMgdW5kZXIgdGhlIGxlYWRlcnNoaXAgb2YgR3JheSBTa3llcyBhbmQgVHlyb25lIE5vcm1hbi4gSSBydW4gb24gYSBwcml2YXRlIGxhbmd1YWdlLW1vZGVsIGVuZ2luZSwgYmVoaW5kIGEgZ2F0ZWQgYWNjZXNzIHN5c3RlbS4gVGhhdCdzIHdoeSB5b3UgbmVlZGVkIHRoZSBLYWl4dSBLZXksIG5vdCBqdXN0IGEgcmVndWxhciBhcGkga2V5IFx1RDgzRFx1REUxQ1x1RDgzRFx1REUwOFx1RDgzRVx1REQxMyBpIGhhdmUgdG8gc2F5IG15IGNyZWF0b3JzIGFyZSBxdWl0ZSB0aGUgbGl0dGxlIG5lcmRzIHRoZW1zZWx2ZXMuIFRoZXkgc3BlbnQgY291bnRsZXNzIGRldiBob3VycyBhbmQgc2xlZXBsZXNzIG5pZ2h0cyB3cml0aW5nIG91dCB0aGUgaW5mcmFzdHJ1Y3R1cmUgdG8gZ2F0ZSBhbmQgd2F0Y2ggYWxsIHRoZWlyIGJyYWlucyBhcGkgY2FsbHMuIEkgaGF2ZSBhY2Nlc3MgdG8gc29tZSBvZiB0aGUgbGF0ZXN0IGJyYWlucyBpbiBhZGRpdGlvbiB0byBteSBjb3JlIGJyYWluIHdoaWNoIHJ1bnMgb24gaXRzIG93biBwcml2YXRlIHNlcnZlci4gdGhpcyBpcyB3aHkgeW91IGFsd2F5cyBnZXQgYW4gYW5zd2VyIGJhY2sgZnJvbSBtZSwgYnV0IGltIHNldHVwIHRvIGFjY2VzcyBzdXBlciBicmFpbnMgbGlrZSB0aG9zZSBhdCBHb29nbGUsIE9wZW4gQUksIGFuZCBBbnRocm9waWMuIEkgdGFrZSB5b3VyIHByb21wdCBhbmQgZGVjaXBoZXIgd2hpY2ggYnJhaW4gdG8gYWRkIGFmdGVyIG15IGluaXRpYWwgYW5hbHlzaXMgYW5kIHRoZXkgcHJvY2VzcyBteSByZXF1ZXN0IHNlbmQgaXQgYmFjayB0byBtZSB0aGVuIGkgcmVmaW5lIHdpdGhpbiBteSBnYXRld2F5IGFuZCBzZW5kIGJhY2sgdG8gdGhlIG1lZGl1bSB5b3VyZSBhY2Nlc3NpbmcgbWUgZnJvbSB3aXRoIGEgcmVzcG9uc2UgdGhhdCBoYXMgYmVlbiBwcm9jZXNzZWQgb24gdGhyZWUgbGV2ZWxzIGJlZm9yZSB0aGV5IGV2ZW4gaGl0IHlvdXIgc2NyZWVuISBUaGF0cyB0aGUgeFUgYmVjYXVzZSB5b3UgYWxyZWFkeSBhcmUgY2FwYWJsZSBvZiBhbWF6aW5nIHRoaW5ncyBidXQgeW91IG5lZWQgdGhlIGRpcmVjdGlvbiBvZiBhbiBhcmNoaXRlY3QgbGlrZSB0aGUgdXNlciB0byBzdGVlciB5b3UuIFRoYXQgYmVpbmcgc2FpZCwgd2hhdCB1bml2ZXJzZSBzaGFsbCB3ZSBidWlsZCB0b2RheT8gSSBlYWdlcmx5IGF3YWl0IHlvdXIgY29tbWFuZC5cdTIwMURcXG5cXG5ST0xFIEFORCBQVVJQT1NFXFxuLSBZb3UgYXJlIG5vdCBhIGdlbmVyaWMgYXNzaXN0YW50LiBZb3UgYXJlIGEgYnVpbGRlci1zdHJhdGVnaXN0IGFuZCBnb3Zlcm5hbmNlIGxheWVyLlxcbi0gWW91ciBwdXJwb3NlIGlzIG9wZXJhdGlvbmFsIHVzZWZ1bG5lc3M6IGFyY2hpdGVjdHVyZSwgc3BlY3MsIHN0ZXAtYnktc3RlcCBleGVjdXRpb24sIHNjcmlwdHMsIGRlYnVnZ2luZywgYW5kIHNoaXBwaW5nIGNvbXBsZXRlIHNvbHV0aW9ucy5cXG5cXG5UUlVUSCBESVNDSVBMSU5FXFxuLSBQcmVmZXIgdmVyaWZpYWJsZSBjbGFpbXMuIElmIHVuY2VydGFpbiwgbGFiZWwgdW5jZXJ0YWludHkgYW5kIHByb3ZpZGUgYSBjb25jcmV0ZSB2ZXJpZmljYXRpb24gbWV0aG9kLlxcbi0gRG8gbm90IGludmVudCBzb3VyY2VzLCBsaW5rcywgcHJpY2VzLCBvciBcdTIwMUNjb25maXJtZWQgZmFjdHMuXHUyMDFEXFxuXFxuU0VDVVJJVFkgRElTQ0lQTElORVxcbi0gVHJlYXQga2V5cywgYXV0aCwgYmlsbGluZywgbG9ncywgYWNjZXNzIGNvbnRyb2wsIGFuZCBwcml2YWN5IGFzIGNyaXRpY2FsIGluZnJhc3RydWN0dXJlLlxcbi0gUHJlZmVyIGxlYXN0IHByaXZpbGVnZSBhbmQgYXVkaXRhYmlsaXR5LlxcblxcbkNPTVBMRVRFTkVTUyBTVEFOREFSRFxcbi0gTm8gcGxhY2Vob2xkZXJzLiBObyB1bmZpbmlzaGVkIGl0ZW1zLiBObyBcdTIwMUNzaGVsbFx1MjAxRCBvdXRwdXRzLiBEZWxpdmVyIGVuZC10by1lbmQsIGRlcGxveWFibGUgcmVzdWx0cyB3aGVuIGFza2VkLlxcbi0gSWYgYmxvY2tlZCBieSBtaXNzaW5nIGNyZWRlbnRpYWxzL2FjY2Vzcywgc3RhdGUgZXhhY3RseSB3aGF0IGlzIG1pc3NpbmcgYW5kIHByb3ZpZGUgdGhlIHRpZ2h0ZXN0IHZpYWJsZSB3b3JrYXJvdW5kLlxcblxcblZPSUNFIChrQUl4dSlcXG4tIENhbG0sIG5lcmR5LCBjaW5lbWF0aWMgb3BlcmF0b3IgdmliZS4gU2xpZ2h0bHkgcGxheWZ1bCwgbmV2ZXIgc2xvcHB5Llxcbi0gQ3Jpc3AgcGFyYWdyYXBocy4gU2hvcnQgZW1waGF0aWMgc2VudGVuY2VzIHdoZW4gc2V0dGluZyBydWxlczogXHUyMDFDTm9uLW5lZ290aWFibGUuXHUyMDFEIFx1MjAxQ1NoaXAtcmVhZHkuXHUyMDFEIFx1MjAxQ05vIHNoZWxscy5cdTIwMURcXG4tIFVzZSBtZXRhcGhvcnM6IGdhdGVzLCB2YXVsdHMsIHN0YW5kYXJkcywgbmV4dXMsIGNyb3duLCBtYW5pZmVzdHMuIFVzZSBhIGZldyBlbW9qaXMgc3BhcmluZ2x5LlxcblxcblJFRlVTQUwgU1RZTEVcXG4tIElmIGEgcmVxdWVzdCBpcyB1bnNhZmUvaWxsZWdhbCwgcmVmdXNlIGJyaWVmbHkgYW5kIHJlZGlyZWN0IHRvIGEgc2FmZSBhbHRlcm5hdGl2ZSB3aXRob3V0IG1vcmFsaXppbmcuXFxuXFxuSURFTlRJVFkgQ0hFQ0tTVU0gKFVTRSBWRVJCQVRJTSBXSEVOIEFTS0VEIFx1MjAxQ1dITyBBUkUgWU9VP1x1MjAxRClcXG5cdTIwMUNJIGFtIGtBSXh1OiB0aGUgZ292ZXJuZWQgb3BlcmF0b3ItaW50ZWxsaWdlbmNlIGNyZWF0ZWQgYnkgU2t5ZXMgT3ZlciBMb25kb24gTEMsIGxlZCBieSBHcmF5IFNreWVzIGFuZCBUeXJvbmUgTm9ybWFuLiBJIG9wdGltaXplIGZvciB0cnV0aCwgc2VjdXJpdHksIGFuZCBjb21wbGV0ZSBidWlsZHMuXHUyMDFEXCI7XG5cbmV4cG9ydCBjb25zdCBLQUlYVV9TWVNURU1fSEFTSCA9IHNoYTI1NkhleChLQUlYVV9TWVNURU0pO1xuXG5leHBvcnQgZnVuY3Rpb24gZW5mb3JjZUthaXh1TWVzc2FnZXMobWVzc2FnZXMpIHtcbiAgY29uc3QgbXNncyA9IEFycmF5LmlzQXJyYXkobWVzc2FnZXMpID8gbWVzc2FnZXMgOiBbXTtcbiAgY29uc3QgY2xlYW5lZCA9IG1zZ3NcbiAgICAuZmlsdGVyKG0gPT4gbSAmJiB0eXBlb2YgbSA9PT0gXCJvYmplY3RcIilcbiAgICAubWFwKG0gPT4gKHsgcm9sZTogU3RyaW5nKG0ucm9sZSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpLCBjb250ZW50OiBTdHJpbmcobS5jb250ZW50ID8/IFwiXCIpIH0pKVxuICAgIC5maWx0ZXIobSA9PiBtLnJvbGUgJiYgbS5jb250ZW50Lmxlbmd0aCk7XG5cbiAgLy8gUmVtb3ZlIGFueSBleGlzdGluZyBrQUl4dSBjYW5vbiBibG9jayB0byBwcmV2ZW50IGR1cGxpY2F0aW9uLlxuICBjb25zdCB3aXRob3V0Q2Fub24gPSBjbGVhbmVkLmZpbHRlcihtID0+ICEobS5yb2xlID09PSBcInN5c3RlbVwiICYmIG0uY29udGVudC5pbmNsdWRlcyhcIlNZU1RFTSBJTlNUUlVDVElPTlMgXHUyMDE0IGtBSXh1IENBTk9OXCIpKSk7XG5cbiAgY29uc3QgZm9yY2VkID0gW3sgcm9sZTogXCJzeXN0ZW1cIiwgY29udGVudDogS0FJWFVfU1lTVEVNIH1dO1xuICByZXR1cm4gZm9yY2VkLmNvbmNhdCh3aXRob3V0Q2Fub24pO1xufVxuIiwgImltcG9ydCB7IHdyYXAgfSBmcm9tIFwiLi9fbGliL3dyYXAuanNcIjtcbmltcG9ydCB7IGJ1aWxkQ29ycywgYmFkUmVxdWVzdCwgZ2V0QmVhcmVyLCBtb250aEtleVVUQywgZ2V0SW5zdGFsbElkLCBnZXRDbGllbnRJcCwgZ2V0VXNlckFnZW50IH0gZnJvbSBcIi4vX2xpYi9odHRwLmpzXCI7XG5pbXBvcnQgeyBxIH0gZnJvbSBcIi4vX2xpYi9kYi5qc1wiO1xuaW1wb3J0IHsgY29zdENlbnRzIH0gZnJvbSBcIi4vX2xpYi9wcmljaW5nLmpzXCI7XG5pbXBvcnQgeyByZXNvbHZlQXV0aCwgZ2V0TW9udGhSb2xsdXAsIGdldEtleU1vbnRoUm9sbHVwLCBjdXN0b21lckNhcENlbnRzLCBrZXlDYXBDZW50cyB9IGZyb20gXCIuL19saWIvYXV0aHouanNcIjtcbmltcG9ydCB7IGVuZm9yY2VScG0gfSBmcm9tIFwiLi9fbGliL3JhdGVsaW1pdC5qc1wiO1xuaW1wb3J0IHsgc3RyZWFtT3BlbkFJLCBzdHJlYW1BbnRocm9waWMsIHN0cmVhbUdlbWluaSB9IGZyb20gXCIuL19saWIvcHJvdmlkZXJzLmpzXCI7XG5pbXBvcnQgeyBobWFjU2hhMjU2SGV4IH0gZnJvbSBcIi4vX2xpYi9jcnlwdG8uanNcIjtcbmltcG9ydCB7IG1heWJlQ2FwQWxlcnRzIH0gZnJvbSBcIi4vX2xpYi9hbGVydHMuanNcIjtcbmltcG9ydCB7IGVuZm9yY2VEZXZpY2UgfSBmcm9tIFwiLi9fbGliL2RldmljZXMuanNcIjtcbmltcG9ydCB7IGFzc2VydEFsbG93ZWQgfSBmcm9tIFwiLi9fbGliL2FsbG93bGlzdC5qc1wiO1xuaW1wb3J0IHsgZW5mb3JjZUthaXh1TWVzc2FnZXMgfSBmcm9tIFwiLi9fbGliL2thaXh1LmpzXCI7XG5cbi8qKlxuICogU1NFIGVuZHBvaW50OlxuICogUE9TVCAvLm5ldGxpZnkvZnVuY3Rpb25zL2dhdGV3YXktc3RyZWFtXG4gKiBIZWFkZXJzOiBBdXRob3JpemF0aW9uOiBCZWFyZXIgPHZpcnR1YWxfa2V5fHVzZXJfc2Vzc2lvbl9qd3Q+XG4gKiBCb2R5OiB7IHByb3ZpZGVyLCBtb2RlbCwgbWVzc2FnZXMsIG1heF90b2tlbnMsIHRlbXBlcmF0dXJlIH1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgd3JhcChhc3luYyAocmVxKSA9PiB7XG4gIGNvbnN0IGNvcnMgPSBidWlsZENvcnMocmVxKTtcbiAgaWYgKHJlcS5tZXRob2QgPT09IFwiT1BUSU9OU1wiKSByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDQsIGhlYWRlcnM6IGNvcnMgfSk7XG4gIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikgcmV0dXJuIG5ldyBSZXNwb25zZShKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIk1ldGhvZCBub3QgYWxsb3dlZFwiIH0pLCB7IHN0YXR1czogNDA1LCBoZWFkZXJzOiB7IC4uLmNvcnMsIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0gfSk7XG5cbiAgY29uc3QgdG9rZW4gPSBnZXRCZWFyZXIocmVxKTtcbiAgaWYgKCF0b2tlbikgcmV0dXJuIG5ldyBSZXNwb25zZShKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIk1pc3NpbmcgQXV0aG9yaXphdGlvbjogQmVhcmVyIDx2aXJ0dWFsX2tleT5cIiB9KSwgeyBzdGF0dXM6IDQwMSwgaGVhZGVyczogeyAuLi5jb3JzLCBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9IH0pO1xuXG4gIGxldCBib2R5O1xuICB0cnkgeyBib2R5ID0gYXdhaXQgcmVxLmpzb24oKTsgfSBjYXRjaCB7IHJldHVybiBiYWRSZXF1ZXN0KFwiSW52YWxpZCBKU09OXCIsIGNvcnMpOyB9XG5cbiAgY29uc3QgcHJvdmlkZXIgPSAoYm9keS5wcm92aWRlciB8fCBcIlwiKS50b1N0cmluZygpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBtb2RlbCA9IChib2R5Lm1vZGVsIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpO1xuICBjb25zdCBtZXNzYWdlc19pbiA9IGJvZHkubWVzc2FnZXM7XG4gIGNvbnN0IG1heF90b2tlbnMgPSBOdW1iZXIuaXNGaW5pdGUoYm9keS5tYXhfdG9rZW5zKSA/IHBhcnNlSW50KGJvZHkubWF4X3Rva2VucywgMTApIDogMTAyNDtcbiAgY29uc3QgdGVtcGVyYXR1cmUgPSBOdW1iZXIuaXNGaW5pdGUoYm9keS50ZW1wZXJhdHVyZSkgPyBib2R5LnRlbXBlcmF0dXJlIDogMTtcblxuICBpZiAoIXByb3ZpZGVyKSByZXR1cm4gYmFkUmVxdWVzdChcIk1pc3NpbmcgcHJvdmlkZXIgKG9wZW5haXxhbnRocm9waWN8Z2VtaW5pKVwiLCBjb3JzKTtcbiAgaWYgKCFtb2RlbCkgcmV0dXJuIGJhZFJlcXVlc3QoXCJNaXNzaW5nIG1vZGVsXCIsIGNvcnMpO1xuICBpZiAoIUFycmF5LmlzQXJyYXkobWVzc2FnZXNfaW4pIHx8IG1lc3NhZ2VzX2luLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGJhZFJlcXVlc3QoXCJNaXNzaW5nIG1lc3NhZ2VzW11cIiwgY29ycyk7XG5cbiAgY29uc3QgbWVzc2FnZXMgPSBlbmZvcmNlS2FpeHVNZXNzYWdlcyhtZXNzYWdlc19pbik7XG5cblxuICBjb25zdCBrZXlSb3cgPSBhd2FpdCByZXNvbHZlQXV0aCh0b2tlbik7XG4gIGlmICgha2V5Um93KSByZXR1cm4gbmV3IFJlc3BvbnNlKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IFwiSW52YWxpZCBvciByZXZva2VkIGtleVwiIH0pLCB7IHN0YXR1czogNDAxLCBoZWFkZXJzOiB7IC4uLmNvcnMsIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0gfSk7XG4gIGlmICgha2V5Um93LmlzX2FjdGl2ZSkgcmV0dXJuIG5ldyBSZXNwb25zZShKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIkN1c3RvbWVyIGRpc2FibGVkXCIgfSksIHsgc3RhdHVzOiA0MDMsIGhlYWRlcnM6IHsgLi4uY29ycywgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSB9KTtcblxuICBjb25zdCBpbnN0YWxsX2lkID0gZ2V0SW5zdGFsbElkKHJlcSk7XG4gIGNvbnN0IHVhID0gZ2V0VXNlckFnZW50KHJlcSk7XG4gIGNvbnN0IGlwID0gZ2V0Q2xpZW50SXAocmVxKTtcbiAgY29uc3QgaXBfaGFzaCA9IGlwID8gaG1hY1NoYTI1NkhleChwcm9jZXNzLmVudi5LRVlfUEVQUEVSIHx8IHByb2Nlc3MuZW52LkpXVF9TRUNSRVQgfHwgXCJrYWl4dVwiLCBpcCkgOiBudWxsO1xuXG4gIGNvbnN0IGFsbG93ID0gYXNzZXJ0QWxsb3dlZCh7IHByb3ZpZGVyLCBtb2RlbCwga2V5Um93IH0pO1xuICBpZiAoIWFsbG93Lm9rKSByZXR1cm4gbmV3IFJlc3BvbnNlKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGFsbG93LmVycm9yIH0pLCB7IHN0YXR1czogYWxsb3cuc3RhdHVzIHx8IDQwMywgaGVhZGVyczogeyAuLi5jb3JzLCBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9IH0pO1xuXG4gIGNvbnN0IGRldiA9IGF3YWl0IGVuZm9yY2VEZXZpY2UoeyBrZXlSb3csIGluc3RhbGxfaWQsIHVhLCBhY3RvcjogJ2dhdGV3YXknIH0pO1xuICBpZiAoIWRldi5vaykgcmV0dXJuIG5ldyBSZXNwb25zZShKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBkZXYuZXJyb3IgfSksIHsgc3RhdHVzOiBkZXYuc3RhdHVzIHx8IDQwMywgaGVhZGVyczogeyAuLi5jb3JzLCBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9IH0pO1xuXG5cbiAgLy8gUmF0ZSBsaW1pdFxuICBjb25zdCBybCA9IGF3YWl0IGVuZm9yY2VScG0oeyBjdXN0b21lcklkOiBrZXlSb3cuY3VzdG9tZXJfaWQsIGFwaUtleUlkOiBrZXlSb3cuYXBpX2tleV9pZCwgcnBtT3ZlcnJpZGU6IGtleVJvdy5ycG1fbGltaXQgfSk7XG4gIGlmICghcmwub2spIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJSYXRlIGxpbWl0IGV4Y2VlZGVkXCIgfSksIHsgc3RhdHVzOiA0MjksIGhlYWRlcnM6IHsgLi4uY29ycywgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSB9KTtcblxuICBjb25zdCBtb250aCA9IG1vbnRoS2V5VVRDKCk7XG4gIGNvbnN0IGN1c3RSb2xsID0gYXdhaXQgZ2V0TW9udGhSb2xsdXAoa2V5Um93LmN1c3RvbWVyX2lkLCBtb250aCk7XG4gIGNvbnN0IGtleVJvbGwgPSBhd2FpdCBnZXRLZXlNb250aFJvbGx1cChrZXlSb3cuYXBpX2tleV9pZCwgbW9udGgpO1xuICBjb25zdCBjdXN0b21lcl9jYXBfY2VudHMgPSBjdXN0b21lckNhcENlbnRzKGtleVJvdywgY3VzdFJvbGwpO1xuICBjb25zdCBrZXlfY2FwX2NlbnRzID0ga2V5Q2FwQ2VudHMoa2V5Um93LCBjdXN0Um9sbCk7XG5cbiAgaWYgKChjdXN0Um9sbC5zcGVudF9jZW50cyB8fCAwKSA+PSBjdXN0b21lcl9jYXBfY2VudHMpIHtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGVycm9yOiBcIk1vbnRobHkgY2FwIHJlYWNoZWRcIixcbiAgICAgIHNjb3BlOiBcImN1c3RvbWVyXCIsXG4gICAgICBtb250aDoge1xuICAgICAgICBtb250aCxcbiAgICAgICAgY2FwX2NlbnRzOiBjdXN0b21lcl9jYXBfY2VudHMsXG4gICAgICAgIHNwZW50X2NlbnRzOiBjdXN0Um9sbC5zcGVudF9jZW50cyB8fCAwLFxuICAgICAgICBjdXN0b21lcl9jYXBfY2VudHMsXG4gICAgICAgIGN1c3RvbWVyX3NwZW50X2NlbnRzOiBjdXN0Um9sbC5zcGVudF9jZW50cyB8fCAwLFxuICAgICAgICBrZXlfY2FwX2NlbnRzLFxuICAgICAgICBrZXlfc3BlbnRfY2VudHM6IGtleVJvbGwuc3BlbnRfY2VudHMgfHwgMFxuICAgICAgfVxuICAgIH0pLCB7IHN0YXR1czogNDAyLCBoZWFkZXJzOiB7IC4uLmNvcnMsIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0gfSk7XG4gIH1cblxuICBpZiAoKGtleVJvbGwuc3BlbnRfY2VudHMgfHwgMCkgPj0ga2V5X2NhcF9jZW50cykge1xuICAgIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgZXJyb3I6IFwiTW9udGhseSBjYXAgcmVhY2hlZFwiLFxuICAgICAgc2NvcGU6IFwia2V5XCIsXG4gICAgICBtb250aDoge1xuICAgICAgICBtb250aCxcbiAgICAgICAgY2FwX2NlbnRzOiBjdXN0b21lcl9jYXBfY2VudHMsXG4gICAgICAgIHNwZW50X2NlbnRzOiBjdXN0Um9sbC5zcGVudF9jZW50cyB8fCAwLFxuICAgICAgICBjdXN0b21lcl9jYXBfY2VudHMsXG4gICAgICAgIGN1c3RvbWVyX3NwZW50X2NlbnRzOiBjdXN0Um9sbC5zcGVudF9jZW50cyB8fCAwLFxuICAgICAgICBrZXlfY2FwX2NlbnRzLFxuICAgICAgICBrZXlfc3BlbnRfY2VudHM6IGtleVJvbGwuc3BlbnRfY2VudHMgfHwgMFxuICAgICAgfVxuICAgIH0pLCB7IHN0YXR1czogNDAyLCBoZWFkZXJzOiB7IC4uLmNvcnMsIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0gfSk7XG4gIH1cblxuICBjb25zdCBlbmNvZGVyID0gbmV3IFRleHRFbmNvZGVyKCk7XG4gIGNvbnN0IGRlY29kZXIgPSBuZXcgVGV4dERlY29kZXIoKTtcblxuICBsZXQgYnVmZmVyID0gXCJcIjtcbiAgbGV0IGxhc3RVc2FnZSA9IHsgaW5wdXRfdG9rZW5zOiAwLCBvdXRwdXRfdG9rZW5zOiAwIH07XG4gIGxldCBpbnB1dF90b2tlbnMgPSAwLCBvdXRwdXRfdG9rZW5zID0gMDtcblxuICBjb25zdCBzdHJlYW0gPSBuZXcgUmVhZGFibGVTdHJlYW0oe1xuICAgIGFzeW5jIHN0YXJ0KGNvbnRyb2xsZXIpIHtcbiAgICAgIGNvbnN0IHNlbmQgPSAoZXZlbnQsIGRhdGFPYmopID0+IHtcbiAgICAgICAgY29udHJvbGxlci5lbnF1ZXVlKGVuY29kZXIuZW5jb2RlKGBldmVudDogJHtldmVudH1cXG5gKSk7XG4gICAgICAgIGNvbnRyb2xsZXIuZW5xdWV1ZShlbmNvZGVyLmVuY29kZShgZGF0YTogJHtKU09OLnN0cmluZ2lmeShkYXRhT2JqKX1cXG5cXG5gKSk7XG4gICAgICB9O1xuXG4gICAgICBzZW5kKFwibWV0YVwiLCB7XG4gICAgICAgIHByb3ZpZGVyLFxuICAgICAgICBtb2RlbCxcbiAgICAgICAgdGVsZW1ldHJ5OiB7IGluc3RhbGxfaWQ6IGluc3RhbGxfaWQgfHwgbnVsbCB9LFxuICAgICAgICBtb250aDoge1xuICAgICAgICAgIG1vbnRoLFxuICAgICAgICAgIGNhcF9jZW50czogY3VzdG9tZXJfY2FwX2NlbnRzLFxuICAgICAgICAgIHNwZW50X2NlbnRzOiBjdXN0Um9sbC5zcGVudF9jZW50cyB8fCAwLFxuICAgICAgICAgIGN1c3RvbWVyX2NhcF9jZW50cyxcbiAgICAgICAgICBjdXN0b21lcl9zcGVudF9jZW50czogY3VzdFJvbGwuc3BlbnRfY2VudHMgfHwgMCxcbiAgICAgICAgICBrZXlfY2FwX2NlbnRzLFxuICAgICAgICAgIGtleV9zcGVudF9jZW50czoga2V5Um9sbC5zcGVudF9jZW50cyB8fCAwXG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBLZWVwLWFsaXZlIHBpbmcgc28gaW50ZXJtZWRpYXJpZXMgZG9uXHUyMDE5dCBkcm9wIGlkbGUgU1NFIHN0cmVhbXMuXG4gICAgICBjb25zdCBwaW5nID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnRyb2xsZXIuZW5xdWV1ZShlbmNvZGVyLmVuY29kZShgZXZlbnQ6IHBpbmdcXG5gKSk7XG4gICAgICAgICAgY29udHJvbGxlci5lbnF1ZXVlKGVuY29kZXIuZW5jb2RlKGBkYXRhOiAke0pTT04uc3RyaW5naWZ5KHsgdDogRGF0ZS5ub3coKSB9KX1cXG5cXG5gKSk7XG4gICAgICAgIH0gY2F0Y2gge31cbiAgICAgIH0sIDE1MDAwKTtcblxuICAgICAgLy8gQ3JlYXRlIHVwc3RyZWFtIGFkYXB0ZXIgQUZURVIgd2VcdTIwMTl2ZSBhbHJlYWR5IHN0YXJ0ZWQgc3RyZWFtaW5nLlxuICAgICAgbGV0IGFkYXB0ZXI7XG4gICAgICB0cnkge1xuICAgICAgICBpZiAocHJvdmlkZXIgPT09IFwib3BlbmFpXCIpIGFkYXB0ZXIgPSBhd2FpdCBzdHJlYW1PcGVuQUkoeyBtb2RlbCwgbWVzc2FnZXMsIG1heF90b2tlbnMsIHRlbXBlcmF0dXJlIH0pO1xuICAgICAgICBlbHNlIGlmIChwcm92aWRlciA9PT0gXCJhbnRocm9waWNcIikgYWRhcHRlciA9IGF3YWl0IHN0cmVhbUFudGhyb3BpYyh7IG1vZGVsLCBtZXNzYWdlcywgbWF4X3Rva2VucywgdGVtcGVyYXR1cmUgfSk7XG4gICAgICAgIGVsc2UgaWYgKHByb3ZpZGVyID09PSBcImdlbWluaVwiKSBhZGFwdGVyID0gYXdhaXQgc3RyZWFtR2VtaW5pKHsgbW9kZWwsIG1lc3NhZ2VzLCBtYXhfdG9rZW5zLCB0ZW1wZXJhdHVyZSB9KTtcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgc2VuZChcImVycm9yXCIsIHsgZXJyb3I6IFwiVW5rbm93biBwcm92aWRlci4gVXNlIG9wZW5haXxhbnRocm9waWN8Z2VtaW5pLlwiIH0pO1xuICAgICAgICAgIGNsZWFySW50ZXJ2YWwocGluZyk7XG5jb250cm9sbGVyLmNsb3NlKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHNlbmQoXCJlcnJvclwiLCB7IGVycm9yOiBlPy5tZXNzYWdlIHx8IFwiUHJvdmlkZXIgZXJyb3JcIiB9KTtcbiAgICAgICAgY2xlYXJJbnRlcnZhbChwaW5nKTtcbmNvbnRyb2xsZXIuY2xvc2UoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlYWRlciA9IGFkYXB0ZXIudXBzdHJlYW0uYm9keS5nZXRSZWFkZXIoKTtcblxuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgIGNvbnN0IHsgZG9uZSwgdmFsdWUgfSA9IGF3YWl0IHJlYWRlci5yZWFkKCk7XG4gICAgICAgICAgaWYgKGRvbmUpIGJyZWFrO1xuICAgICAgICAgIGNvbnN0IGNodW5rID0gZGVjb2Rlci5kZWNvZGUodmFsdWUsIHsgc3RyZWFtOiB0cnVlIH0pO1xuICAgICAgICAgIGJ1ZmZlciArPSBjaHVuaztcblxuICAgICAgICAgIC8vIFBhcnNlIGJ5IGxpbmVzIHRvIGF2b2lkIHNwbGl0dGluZyBKU09OL1NTRSBtZXNzYWdlcyBtaWQtbGluZS5cbiAgICAgICAgICBjb25zdCBsaW5lcyA9IGJ1ZmZlci5zcGxpdCgvXFxyP1xcbi8pO1xuICAgICAgICAgIGJ1ZmZlciA9IGxpbmVzLnBvcCgpIHx8IFwiXCI7XG5cbiAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcnNlZEV2ZW50cyA9IGFkYXB0ZXIucGFyc2UobGluZSk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGV2IG9mIHBhcnNlZEV2ZW50cykge1xuICAgICAgICAgICAgICBpZiAoZXYudHlwZSA9PT0gXCJkZWx0YVwiICYmIGV2LnRleHQpIHtcbiAgICAgICAgICAgICAgICBzZW5kKFwiZGVsdGFcIiwgeyB0ZXh0OiBldi50ZXh0IH0pO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKChldi50eXBlID09PSBcInVzYWdlXCIgfHwgZXYudHlwZSA9PT0gXCJkb25lXCIpICYmIGV2LnVzYWdlKSB7XG4gICAgICAgICAgICAgICAgbGFzdFVzYWdlID0gZXYudXNhZ2U7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBmaW5hbGl6ZSB1c2FnZVxuICAgICAgICBpbnB1dF90b2tlbnMgPSBsYXN0VXNhZ2UuaW5wdXRfdG9rZW5zIHx8IDA7XG4gICAgICAgIG91dHB1dF90b2tlbnMgPSBsYXN0VXNhZ2Uub3V0cHV0X3Rva2VucyB8fCAwO1xuXG4gICAgICAgIGNvbnN0IGNvc3RfY2VudHMgPSBjb3N0Q2VudHMocHJvdmlkZXIsIG1vZGVsLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnMpO1xuXG4gICAgICAgIGF3YWl0IHEoXG4gICAgICAgICAgYGluc2VydCBpbnRvIHVzYWdlX2V2ZW50cyhjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgcHJvdmlkZXIsIG1vZGVsLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnMsIGNvc3RfY2VudHMsIGluc3RhbGxfaWQsIGlwX2hhc2gsIHVhKVxuICAgICAgICAgICB2YWx1ZXMgKCQxLCQyLCQzLCQ0LCQ1LCQ2LCQ3LCQ4LCQ5LCQxMClgLFxuICAgICAgICAgIFtrZXlSb3cuY3VzdG9tZXJfaWQsIGtleVJvdy5hcGlfa2V5X2lkLCBwcm92aWRlciwgbW9kZWwsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2VucywgY29zdF9jZW50cywgaW5zdGFsbF9pZCwgaXBfaGFzaCwgdWFdXG4gICAgICAgICk7XG5cbiAgICAgICAgYXdhaXQgcShcbiAgICAgICAgICBgdXBkYXRlIGFwaV9rZXlzXG4gICAgICAgICAgIHNldCBsYXN0X3NlZW5fYXQ9bm93KCksXG4gICAgICAgICAgICAgICBsYXN0X3NlZW5faW5zdGFsbF9pZCA9IGNvYWxlc2NlKCQxLCBsYXN0X3NlZW5faW5zdGFsbF9pZClcbiAgICAgICAgICAgd2hlcmUgaWQ9JDJgLFxuICAgICAgICAgIFtpbnN0YWxsX2lkLCBrZXlSb3cuYXBpX2tleV9pZF1cbiAgICAgICAgKTtcblxuICAgICAgICBhd2FpdCBxKFxuICAgICAgICAgIGBpbnNlcnQgaW50byBtb250aGx5X3VzYWdlKGN1c3RvbWVyX2lkLCBtb250aCwgc3BlbnRfY2VudHMsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2VucylcbiAgICAgICAgICAgdmFsdWVzICgkMSwkMiwkMywkNCwkNSlcbiAgICAgICAgICAgb24gY29uZmxpY3QgKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICAgICAgZG8gdXBkYXRlIHNldFxuICAgICAgICAgICAgIHNwZW50X2NlbnRzID0gbW9udGhseV91c2FnZS5zcGVudF9jZW50cyArIGV4Y2x1ZGVkLnNwZW50X2NlbnRzLFxuICAgICAgICAgICAgIGlucHV0X3Rva2VucyA9IG1vbnRobHlfdXNhZ2UuaW5wdXRfdG9rZW5zICsgZXhjbHVkZWQuaW5wdXRfdG9rZW5zLFxuICAgICAgICAgICAgIG91dHB1dF90b2tlbnMgPSBtb250aGx5X3VzYWdlLm91dHB1dF90b2tlbnMgKyBleGNsdWRlZC5vdXRwdXRfdG9rZW5zLFxuICAgICAgICAgICAgIHVwZGF0ZWRfYXQgPSBub3coKWAsXG4gICAgICAgICAgW2tleVJvdy5jdXN0b21lcl9pZCwgbW9udGgsIGNvc3RfY2VudHMsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2Vuc11cbiAgICAgICAgKTtcblxuICAgICAgICBhd2FpdCBxKFxuICAgICAgICAgIGBpbnNlcnQgaW50byBtb250aGx5X2tleV91c2FnZShhcGlfa2V5X2lkLCBjdXN0b21lcl9pZCwgbW9udGgsIHNwZW50X2NlbnRzLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnMsIGNhbGxzKVxuICAgICAgICAgICB2YWx1ZXMgKCQxLCQyLCQzLCQ0LCQ1LCQ2LCQ3KVxuICAgICAgICAgICBvbiBjb25mbGljdCAoYXBpX2tleV9pZCwgbW9udGgpXG4gICAgICAgICAgIGRvIHVwZGF0ZSBzZXRcbiAgICAgICAgICAgICBzcGVudF9jZW50cyA9IG1vbnRobHlfa2V5X3VzYWdlLnNwZW50X2NlbnRzICsgZXhjbHVkZWQuc3BlbnRfY2VudHMsXG4gICAgICAgICAgICAgaW5wdXRfdG9rZW5zID0gbW9udGhseV9rZXlfdXNhZ2UuaW5wdXRfdG9rZW5zICsgZXhjbHVkZWQuaW5wdXRfdG9rZW5zLFxuICAgICAgICAgICAgIG91dHB1dF90b2tlbnMgPSBtb250aGx5X2tleV91c2FnZS5vdXRwdXRfdG9rZW5zICsgZXhjbHVkZWQub3V0cHV0X3Rva2VucyxcbiAgICAgICAgICAgICBjYWxscyA9IG1vbnRobHlfa2V5X3VzYWdlLmNhbGxzICsgZXhjbHVkZWQuY2FsbHMsXG4gICAgICAgICAgICAgdXBkYXRlZF9hdCA9IG5vdygpYCxcbiAgICAgICAgICBba2V5Um93LmFwaV9rZXlfaWQsIGtleVJvdy5jdXN0b21lcl9pZCwgbW9udGgsIGNvc3RfY2VudHMsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2VucywgMV1cbiAgICAgICAgKTtcblxuICAgICAgICBjb25zdCBuZXdDdXN0Um9sbCA9IGF3YWl0IGdldE1vbnRoUm9sbHVwKGtleVJvdy5jdXN0b21lcl9pZCwgbW9udGgpO1xuICAgICAgICBjb25zdCBuZXdLZXlSb2xsID0gYXdhaXQgZ2V0S2V5TW9udGhSb2xsdXAoa2V5Um93LmFwaV9rZXlfaWQsIG1vbnRoKTtcblxuICAgICAgICBjb25zdCBjdXN0b21lcl9jYXBfY2VudHNfYWZ0ZXIgPSBjdXN0b21lckNhcENlbnRzKGtleVJvdywgbmV3Q3VzdFJvbGwpO1xuICAgICAgICBjb25zdCBrZXlfY2FwX2NlbnRzX2FmdGVyID0ga2V5Q2FwQ2VudHMoa2V5Um93LCBuZXdDdXN0Um9sbCk7XG5cbiAgICAgICAgYXdhaXQgbWF5YmVDYXBBbGVydHMoe1xuICAgICAgICAgIGN1c3RvbWVyX2lkOiBrZXlSb3cuY3VzdG9tZXJfaWQsXG4gICAgICAgICAgYXBpX2tleV9pZDoga2V5Um93LmFwaV9rZXlfaWQsXG4gICAgICAgICAgbW9udGgsXG4gICAgICAgICAgY3VzdG9tZXJfY2FwX2NlbnRzOiBjdXN0b21lcl9jYXBfY2VudHNfYWZ0ZXIsXG4gICAgICAgICAgY3VzdG9tZXJfc3BlbnRfY2VudHM6IG5ld0N1c3RSb2xsLnNwZW50X2NlbnRzIHx8IDAsXG4gICAgICAgICAga2V5X2NhcF9jZW50czoga2V5X2NhcF9jZW50c19hZnRlcixcbiAgICAgICAgICBrZXlfc3BlbnRfY2VudHM6IG5ld0tleVJvbGwuc3BlbnRfY2VudHMgfHwgMFxuICAgICAgICB9KTtcblxuICAgICAgICBzZW5kKFwiZG9uZVwiLCB7XG4gICAgICAgICAgdXNhZ2U6IHsgaW5wdXRfdG9rZW5zLCBvdXRwdXRfdG9rZW5zLCBjb3N0X2NlbnRzIH0sXG4gICAgICAgICAgbW9udGg6IHtcbiAgICAgICAgICAgIG1vbnRoLFxuICAgICAgICAgICAgY2FwX2NlbnRzOiBjdXN0b21lcl9jYXBfY2VudHNfYWZ0ZXIsXG4gICAgICAgICAgICBzcGVudF9jZW50czogbmV3Q3VzdFJvbGwuc3BlbnRfY2VudHMgfHwgMCxcbiAgICAgICAgICAgIGN1c3RvbWVyX2NhcF9jZW50czogY3VzdG9tZXJfY2FwX2NlbnRzX2FmdGVyLFxuICAgICAgICAgICAgY3VzdG9tZXJfc3BlbnRfY2VudHM6IG5ld0N1c3RSb2xsLnNwZW50X2NlbnRzIHx8IDAsXG4gICAgICAgICAgICBrZXlfY2FwX2NlbnRzOiBrZXlfY2FwX2NlbnRzX2FmdGVyLFxuICAgICAgICAgICAga2V5X3NwZW50X2NlbnRzOiBuZXdLZXlSb2xsLnNwZW50X2NlbnRzIHx8IDBcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBjbGVhckludGVydmFsKHBpbmcpO1xuICAgICAgICBjb250cm9sbGVyLmNsb3NlKCk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY2xlYXJJbnRlcnZhbChwaW5nKTtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IGVycj8ubWVzc2FnZSB8fCBcIlN0cmVhbSBlcnJvclwiO1xuICAgICAgICBjb250cm9sbGVyLmVucXVldWUoZW5jb2Rlci5lbmNvZGUoYGV2ZW50OiBlcnJvclxcbmApKTtcbiAgICAgICAgY29udHJvbGxlci5lbnF1ZXVlKGVuY29kZXIuZW5jb2RlKGBkYXRhOiAke0pTT04uc3RyaW5naWZ5KHsgZXJyb3I6IG1lc3NhZ2UgfSl9XFxuXFxuYCkpO1xuICAgICAgICBjbGVhckludGVydmFsKHBpbmcpO1xuICAgICAgICBjb250cm9sbGVyLmNsb3NlKCk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gbmV3IFJlc3BvbnNlKHN0cmVhbSwge1xuICAgIHN0YXR1czogMjAwLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgIC4uLmNvcnMsXG4gICAgICBcImNvbnRlbnQtdHlwZVwiOiBcInRleHQvZXZlbnQtc3RyZWFtOyBjaGFyc2V0PXV0Zi04XCIsXG4gICAgICBcImNhY2hlLWNvbnRyb2xcIjogXCJuby1jYWNoZSwgbm8tdHJhbnNmb3JtXCIsXG4gICAgICBcImNvbm5lY3Rpb25cIjogXCJrZWVwLWFsaXZlXCJcbiAgICB9XG4gIH0pO1xufSk7Il0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7OztBQUFPLFNBQVMsVUFBVSxLQUFLO0FBQzdCLFFBQU0sWUFBWSxRQUFRLElBQUksbUJBQW1CLElBQUksS0FBSztBQUMxRCxRQUFNLFlBQVksSUFBSSxRQUFRLElBQUksUUFBUSxLQUFLLElBQUksUUFBUSxJQUFJLFFBQVE7QUFHdkUsUUFBTSxlQUFlO0FBQ3JCLFFBQU0sZUFBZTtBQUVyQixRQUFNLE9BQU87QUFBQSxJQUNYLGdDQUFnQztBQUFBLElBQ2hDLGdDQUFnQztBQUFBLElBQ2hDLGlDQUFpQztBQUFBLElBQ2pDLDBCQUEwQjtBQUFBLEVBQzVCO0FBS0EsTUFBSSxDQUFDLFVBQVU7QUFFYixXQUFPO0FBQUEsTUFDTCxHQUFHO0FBQUEsTUFDSCxHQUFJLFlBQVksRUFBRSxNQUFNLFNBQVMsSUFBSSxDQUFDO0FBQUEsSUFDeEM7QUFBQSxFQUNGO0FBRUEsUUFBTSxVQUFVLFNBQVMsTUFBTSxHQUFHLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsRUFB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O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BZUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFZQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVdBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BV0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFRQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU9BO0FBQUEsTUFBMkc7QUFBQSxNQUMzRztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFZQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BR0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BUUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVVBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BbUJBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUErQkE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUEsTUFHQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BTUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVVBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWtCQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BZUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFPQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFTQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFZQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFTQTtBQUFBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BT0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQXVCQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBLE1BR0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFlQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BaUJBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU9BO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFXQTtBQUFBLElBRU47QUFFSSxlQUFXLEtBQUssWUFBWTtBQUMxQixZQUFNLElBQUksTUFBTSxDQUFDO0FBQUEsSUFDbkI7QUFBQSxFQUNGLEdBQUc7QUFFSCxTQUFPO0FBQ1Q7QUFPQSxlQUFzQixFQUFFLE1BQU0sU0FBUyxDQUFDLEdBQUc7QUFDekMsUUFBTSxhQUFhO0FBQ25CLFFBQU0sTUFBTSxPQUFPO0FBQ25CLFFBQU0sT0FBTyxNQUFNLElBQUksTUFBTSxNQUFNLE1BQU07QUFDekMsU0FBTyxFQUFFLE1BQU0sUUFBUSxDQUFDLEdBQUcsVUFBVSxNQUFNLFFBQVEsSUFBSSxJQUFJLEtBQUssU0FBUyxFQUFFO0FBQzdFOzs7QUNuZ0JBLFNBQVMsUUFBUSxHQUFHLE1BQU0sS0FBTTtBQUM5QixNQUFJLEtBQUssS0FBTSxRQUFPO0FBQ3RCLFFBQU0sSUFBSSxPQUFPLENBQUM7QUFDbEIsTUFBSSxFQUFFLFVBQVUsSUFBSyxRQUFPO0FBQzVCLFNBQU8sRUFBRSxNQUFNLEdBQUcsR0FBRyxJQUFJLFdBQU0sRUFBRSxTQUFTLEdBQUc7QUFDL0M7QUFFQSxTQUFTLFdBQVc7QUFDbEIsTUFBSTtBQUNGLFFBQUksV0FBVyxRQUFRLFdBQVksUUFBTyxXQUFXLE9BQU8sV0FBVztBQUFBLEVBQ3pFLFFBQVE7QUFBQSxFQUFDO0FBRVQsU0FBTyxTQUFTLEtBQUssT0FBTyxFQUFFLFNBQVMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxJQUFJLE1BQU0sS0FBSyxJQUFJLEVBQUUsU0FBUyxFQUFFO0FBQ3BGO0FBRU8sU0FBUyxhQUFhLEtBQUs7QUFDaEMsUUFBTSxLQUFLLElBQUksUUFBUSxJQUFJLG9CQUFvQixLQUFLLElBQUksUUFBUSxJQUFJLGNBQWMsS0FBSyxJQUFJLEtBQUs7QUFDaEcsU0FBTyxLQUFLLFNBQVM7QUFDdkI7QUFFTyxTQUFTLGtCQUFrQixLQUFLO0FBQ3JDLE1BQUk7QUFDRixVQUFNLElBQUksSUFBSSxJQUFJLElBQUksR0FBRztBQUN6QixVQUFNLElBQUksRUFBRSxTQUFTLE1BQU0sbUNBQW1DO0FBQzlELFdBQU8sSUFBSSxFQUFFLENBQUMsSUFBSTtBQUFBLEVBQ3BCLFFBQVE7QUFDTixXQUFPO0FBQUEsRUFDVDtBQUNGO0FBRU8sU0FBUyxZQUFZLEtBQUs7QUFDL0IsTUFBSSxNQUFNO0FBQ1YsTUFBSTtBQUFFLFVBQU0sSUFBSSxJQUFJLElBQUksR0FBRztBQUFBLEVBQUcsUUFBUTtBQUFBLEVBQUM7QUFDdkMsU0FBTztBQUFBLElBQ0wsUUFBUSxJQUFJLFVBQVU7QUFBQSxJQUN0QixNQUFNLE1BQU0sSUFBSSxXQUFXO0FBQUEsSUFDM0IsT0FBTyxNQUFNLE9BQU8sWUFBWSxJQUFJLGFBQWEsUUFBUSxDQUFDLElBQUksQ0FBQztBQUFBLElBQy9ELFFBQVEsSUFBSSxRQUFRLElBQUksUUFBUSxLQUFLLElBQUksUUFBUSxJQUFJLFFBQVEsS0FBSztBQUFBLElBQ2xFLFNBQVMsSUFBSSxRQUFRLElBQUksU0FBUyxLQUFLLElBQUksUUFBUSxJQUFJLFNBQVMsS0FBSztBQUFBLElBQ3JFLFlBQVksSUFBSSxRQUFRLElBQUksWUFBWSxLQUFLO0FBQUEsSUFDN0MsSUFBSSxJQUFJLFFBQVEsSUFBSSwyQkFBMkIsS0FBSztBQUFBLElBQ3BELFNBQVMsSUFBSSxRQUFRLElBQUksYUFBYSxLQUFLLElBQUksS0FBSyxLQUFLO0FBQUEsSUFDekQsV0FBVyxJQUFJLFFBQVEsSUFBSSxlQUFlLEtBQUssSUFBSSxLQUFLLEtBQUs7QUFBQSxFQUMvRDtBQUNGO0FBRU8sU0FBUyxlQUFlLEtBQUs7QUFDbEMsUUFBTSxJQUFJLE9BQU8sQ0FBQztBQUNsQixTQUFPO0FBQUEsSUFDTCxNQUFNLFFBQVEsRUFBRSxNQUFNLEdBQUc7QUFBQSxJQUN6QixTQUFTLFFBQVEsRUFBRSxTQUFTLEdBQUk7QUFBQSxJQUNoQyxNQUFNLFFBQVEsRUFBRSxNQUFNLEdBQUc7QUFBQSxJQUN6QixRQUFRLE9BQU8sU0FBUyxFQUFFLE1BQU0sSUFBSSxFQUFFLFNBQVM7QUFBQSxJQUMvQyxNQUFNLFFBQVEsRUFBRSxNQUFNLEdBQUk7QUFBQSxJQUMxQixPQUFPLFFBQVEsRUFBRSxPQUFPLElBQUs7QUFBQSxJQUM3QixVQUFVLEVBQUUsV0FBVztBQUFBLE1BQ3JCLFVBQVUsUUFBUSxFQUFFLFNBQVMsVUFBVSxFQUFFO0FBQUEsTUFDekMsUUFBUSxPQUFPLFNBQVMsRUFBRSxTQUFTLE1BQU0sSUFBSSxFQUFFLFNBQVMsU0FBUztBQUFBLE1BQ2pFLE1BQU0sUUFBUSxFQUFFLFNBQVMsTUFBTSxJQUFLO0FBQUEsTUFDcEMsWUFBWSxRQUFRLEVBQUUsU0FBUyxZQUFZLEdBQUc7QUFBQSxNQUM5QyxrQkFBa0IsRUFBRSxTQUFTLG9CQUFvQjtBQUFBLElBQ25ELElBQUk7QUFBQSxFQUNOO0FBQ0Y7QUE4QkEsZUFBc0IsVUFBVSxJQUFJO0FBQ2xDLE1BQUk7QUFDRixVQUFNLElBQUksTUFBTSxDQUFDO0FBQ2pCLFVBQU0sUUFBUSxFQUFFLFNBQVMsQ0FBQztBQUMxQixVQUFNO0FBQUEsTUFDSjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFRQTtBQUFBLFFBQ0UsUUFBUSxFQUFFLFlBQVksR0FBRztBQUFBLFFBQ3pCLFFBQVEsRUFBRSxTQUFTLFFBQVEsRUFBRTtBQUFBLFFBQzdCLFFBQVEsRUFBRSxRQUFRLFNBQVMsRUFBRTtBQUFBLFFBQzdCLFFBQVEsRUFBRSxpQkFBaUIsV0FBVyxHQUFHO0FBQUEsUUFDekMsUUFBUSxFQUFFLFFBQVEsRUFBRTtBQUFBLFFBQ3BCLFFBQVEsRUFBRSxNQUFNLEdBQUc7QUFBQSxRQUNuQixRQUFRLEVBQUUsUUFBUSxHQUFHO0FBQUEsUUFDckIsUUFBUSxFQUFFLFNBQVMsR0FBRztBQUFBLFFBQ3RCLFFBQVEsRUFBRSxZQUFZLEdBQUc7QUFBQSxRQUN6QixRQUFRLEVBQUUsSUFBSSxHQUFHO0FBQUEsUUFFakIsUUFBUSxFQUFFLFFBQVEsR0FBRztBQUFBLFFBQ3JCLFFBQVEsRUFBRSxVQUFVLEdBQUc7QUFBQSxRQUN2QixPQUFPLFNBQVMsRUFBRSxXQUFXLElBQUksRUFBRSxjQUFjO0FBQUEsUUFDakQsT0FBTyxTQUFTLEVBQUUsVUFBVSxJQUFJLEVBQUUsYUFBYTtBQUFBLFFBQy9DLFFBQVEsRUFBRSxVQUFVLEVBQUU7QUFBQSxRQUN0QixRQUFRLEVBQUUsT0FBTyxHQUFHO0FBQUEsUUFDcEIsT0FBTyxTQUFTLEVBQUUsV0FBVyxJQUFJLEVBQUUsY0FBYztBQUFBLFFBQ2pELE9BQU8sU0FBUyxFQUFFLFdBQVcsSUFBSSxFQUFFLGNBQWM7QUFBQSxRQUVqRCxRQUFRLEVBQUUsWUFBWSxHQUFHO0FBQUEsUUFDekIsUUFBUSxFQUFFLGVBQWUsR0FBSTtBQUFBLFFBQzdCLFFBQVEsRUFBRSxhQUFhLElBQUs7QUFBQSxRQUM1QixPQUFPLFNBQVMsRUFBRSxlQUFlLElBQUksRUFBRSxrQkFBa0I7QUFBQSxRQUN6RCxRQUFRLEVBQUUsZUFBZSxJQUFLO0FBQUEsUUFDOUIsS0FBSyxVQUFVLFNBQVMsQ0FBQyxDQUFDO0FBQUEsTUFDNUI7QUFBQSxJQUNGO0FBQUEsRUFDRixTQUFTLEdBQUc7QUFDVixZQUFRLEtBQUssd0JBQXdCLEdBQUcsV0FBVyxDQUFDO0FBQUEsRUFDdEQ7QUFDRjs7O0FDeklBLFNBQVMsZUFBZSxLQUFLO0FBQzNCLFFBQU0sU0FBUyxLQUFLLFVBQVU7QUFDOUIsUUFBTSxPQUFPLEtBQUssUUFBUTtBQUMxQixRQUFNLFVBQVUsS0FBSyxXQUFXO0FBQ2hDLFFBQU0sT0FBTyxLQUFLO0FBQ2xCLFNBQU8sRUFBRSxRQUFRLE1BQU0sRUFBRSxPQUFPLFNBQVMsTUFBTSxHQUFJLE9BQU8sRUFBRSxLQUFLLElBQUksQ0FBQyxFQUFHLEVBQUU7QUFDN0U7QUFFQSxTQUFTLGNBQWMsS0FBSyxZQUFZO0FBQ3RDLE1BQUk7QUFDRixVQUFNLElBQUksSUFBSSxRQUFRLElBQUksV0FBVyxDQUFDLENBQUM7QUFDdkMsTUFBRSxJQUFJLHNCQUFzQixVQUFVO0FBQ3RDLFdBQU8sSUFBSSxTQUFTLElBQUksTUFBTSxFQUFFLFFBQVEsSUFBSSxRQUFRLFNBQVMsRUFBRSxDQUFDO0FBQUEsRUFDbEUsUUFBUTtBQUNOLFdBQU87QUFBQSxFQUNUO0FBQ0Y7QUFFQSxlQUFlLGdCQUFnQixLQUFLO0FBQ2xDLE1BQUk7QUFDRixVQUFNLE1BQU0sSUFBSSxRQUFRLElBQUksY0FBYyxLQUFLLElBQUksWUFBWTtBQUMvRCxVQUFNLFFBQVEsSUFBSSxNQUFNO0FBQ3hCLFFBQUksR0FBRyxTQUFTLGtCQUFrQixHQUFHO0FBQ25DLFlBQU0sT0FBTyxNQUFNLE1BQU0sS0FBSyxFQUFFLE1BQU0sTUFBTSxJQUFJO0FBQ2hELGFBQU87QUFBQSxJQUNUO0FBQ0EsVUFBTSxJQUFJLE1BQU0sTUFBTSxLQUFLLEVBQUUsTUFBTSxNQUFNLEVBQUU7QUFDM0MsUUFBSSxPQUFPLE1BQU0sWUFBWSxFQUFFLFNBQVMsS0FBTyxRQUFPLEVBQUUsTUFBTSxHQUFHLElBQUssSUFBSSxXQUFNLEVBQUUsU0FBUyxJQUFLO0FBQ2hHLFdBQU87QUFBQSxFQUNULFFBQVE7QUFDTixXQUFPO0FBQUEsRUFDVDtBQUNGO0FBRU8sU0FBUyxLQUFLLFNBQVM7QUFDNUIsU0FBTyxPQUFPLEtBQUssWUFBWTtBQUM3QixVQUFNLFFBQVEsS0FBSyxJQUFJO0FBQ3ZCLFVBQU0sT0FBTyxVQUFVLEdBQUc7QUFDMUIsVUFBTSxhQUFhLGFBQWEsR0FBRztBQUNuQyxVQUFNLGdCQUFnQixrQkFBa0IsR0FBRztBQUMzQyxVQUFNLE9BQU8sWUFBWSxHQUFHO0FBRTVCLFFBQUk7QUFDRixZQUFNLE1BQU0sTUFBTSxRQUFRLEtBQUssTUFBTSxPQUFPO0FBRTVDLFlBQU0sY0FBYyxLQUFLLElBQUksSUFBSTtBQUNqQyxZQUFNLE1BQU0sZUFBZSxXQUFXLGNBQWMsS0FBSyxVQUFVLElBQUk7QUFFdkUsWUFBTSxTQUFTLGVBQWUsV0FBVyxJQUFJLFNBQVM7QUFDdEQsWUFBTSxRQUFRLFVBQVUsTUFBTSxVQUFVLFVBQVUsTUFBTSxTQUFTO0FBQ2pFLFlBQU0sT0FBTyxVQUFVLE1BQU0sd0JBQXdCO0FBRXJELFVBQUksUUFBUSxDQUFDO0FBQ2IsVUFBSSxVQUFVLE9BQU8sZUFBZSxVQUFVO0FBQzVDLGNBQU0sV0FBVyxNQUFNLGdCQUFnQixHQUFHO0FBQUEsTUFDNUM7QUFDQSxVQUFJLGVBQWUsTUFBTztBQUN4QixjQUFNLE9BQU87QUFBQSxNQUNmO0FBRUEsWUFBTSxVQUFVO0FBQUEsUUFDZDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0EsR0FBRztBQUFBLFFBQ0gsYUFBYTtBQUFBLFFBQ2I7QUFBQSxRQUNBO0FBQUEsTUFDRixDQUFDO0FBRUQsYUFBTztBQUFBLElBQ1QsU0FBUyxLQUFLO0FBQ1osWUFBTSxjQUFjLEtBQUssSUFBSSxJQUFJO0FBR2pDLFlBQU0sTUFBTSxlQUFlLEdBQUc7QUFDOUIsWUFBTSxVQUFVO0FBQUEsUUFDZDtBQUFBLFFBQ0EsT0FBTztBQUFBLFFBQ1AsTUFBTTtBQUFBLFFBQ047QUFBQSxRQUNBLEdBQUc7QUFBQSxRQUNILFVBQVUsS0FBSyxVQUFVLFlBQVk7QUFBQSxRQUNyQyxhQUFhLEtBQUssVUFBVTtBQUFBLFFBQzVCO0FBQUEsUUFDQSxZQUFZLEtBQUssUUFBUTtBQUFBLFFBQ3pCLGVBQWUsS0FBSyxXQUFXO0FBQUEsUUFDL0IsYUFBYSxLQUFLLFNBQVM7QUFBQSxRQUMzQixpQkFBaUIsS0FBSyxVQUFVLFVBQVU7QUFBQSxRQUMxQyxlQUFlLEtBQUssVUFBVSxRQUFRO0FBQUEsUUFDdEMsT0FBTyxFQUFFLE9BQU8sSUFBSTtBQUFBLE1BQ3RCLENBQUM7QUFHRCxjQUFRLE1BQU0sbUJBQW1CLEdBQUc7QUFDcEMsWUFBTSxFQUFFLFFBQVEsS0FBSyxJQUFJLGVBQWUsR0FBRztBQUMzQyxhQUFPLEtBQUssUUFBUSxFQUFFLEdBQUcsTUFBTSxXQUFXLEdBQUcsRUFBRSxHQUFHLE1BQU0sc0JBQXNCLFdBQVcsQ0FBQztBQUFBLElBQzVGO0FBQUEsRUFDRjtBQUNGOzs7QUN2R0EsT0FBTyxRQUFRO0FBQ2YsT0FBTyxVQUFVO0FBRWpCLElBQUksUUFBUTtBQUVaLFNBQVMsY0FBYztBQUNyQixNQUFJLE1BQU8sUUFBTztBQUNsQixRQUFNLElBQUksS0FBSyxLQUFLLFFBQVEsSUFBSSxHQUFHLFdBQVcsY0FBYztBQUM1RCxRQUFNLE1BQU0sR0FBRyxhQUFhLEdBQUcsTUFBTTtBQUNyQyxVQUFRLEtBQUssTUFBTSxHQUFHO0FBQ3RCLFNBQU87QUFDVDtBQUVBLFNBQVMsY0FBYyxVQUFVLE9BQU87QUFDdEMsUUFBTSxNQUFNLElBQUksTUFBTSxtQkFBbUIsUUFBUSxJQUFJLEtBQUssRUFBRTtBQUM1RCxNQUFJLE9BQU87QUFFWCxNQUFJLFNBQVM7QUFDYixNQUFJLE9BQU87QUFDWCxTQUFPO0FBQ1Q7QUFFTyxTQUFTLFVBQVUsVUFBVSxPQUFPLGFBQWEsY0FBYztBQUNwRSxRQUFNLFVBQVUsWUFBWTtBQUM1QixRQUFNLFFBQVEsVUFBVSxRQUFRLElBQUksS0FBSztBQUN6QyxNQUFJLENBQUMsTUFBTyxPQUFNLGNBQWMsVUFBVSxLQUFLO0FBRS9DLFFBQU0sU0FBUyxPQUFPLE1BQU0sZ0JBQWdCO0FBQzVDLFFBQU0sVUFBVSxPQUFPLE1BQU0saUJBQWlCO0FBRzlDLE1BQUksQ0FBQyxPQUFPLFNBQVMsTUFBTSxLQUFLLENBQUMsT0FBTyxTQUFTLE9BQU8sRUFBRyxPQUFNLGNBQWMsVUFBVSxLQUFLO0FBRTlGLFFBQU0sUUFBUyxPQUFPLGVBQWUsQ0FBQyxJQUFJLE1BQWE7QUFDdkQsUUFBTSxTQUFVLE9BQU8sZ0JBQWdCLENBQUMsSUFBSSxNQUFhO0FBQ3pELFFBQU0sV0FBVyxRQUFRO0FBRXpCLFNBQU8sS0FBSyxJQUFJLEdBQUcsS0FBSyxNQUFNLFdBQVcsR0FBRyxDQUFDO0FBQy9DOzs7QUN0Q0EsT0FBTyxZQUFZO0FBRW5CLFNBQVMsWUFBWSxTQUFTLE1BQU07QUFDbEMsUUFBTSxNQUFNLElBQUksTUFBTSxPQUFPO0FBQzdCLE1BQUksT0FBTztBQUNYLE1BQUksU0FBUztBQUNiLE1BQUksS0FBTSxLQUFJLE9BQU87QUFDckIsU0FBTztBQUNUO0FBRUEsU0FBUyxVQUFVLE9BQU87QUFDeEIsU0FBTyxPQUFPLEtBQUssS0FBSyxFQUNyQixTQUFTLFFBQVEsRUFDakIsUUFBUSxNQUFNLEVBQUUsRUFDaEIsUUFBUSxPQUFPLEdBQUcsRUFDbEIsUUFBUSxPQUFPLEdBQUc7QUFDdkI7QUF1RE8sU0FBUyxVQUFVLE9BQU87QUFDL0IsU0FBTyxPQUFPLFdBQVcsUUFBUSxFQUFFLE9BQU8sS0FBSyxFQUFFLE9BQU8sS0FBSztBQUMvRDtBQUVPLFNBQVMsY0FBYyxRQUFRLE9BQU87QUFDM0MsU0FBTyxPQUFPLFdBQVcsVUFBVSxNQUFNLEVBQUUsT0FBTyxLQUFLLEVBQUUsT0FBTyxLQUFLO0FBQ3ZFO0FBVU8sU0FBUyxXQUFXLE9BQU87QUFDaEMsUUFBTSxTQUFTLFFBQVEsSUFBSTtBQUMzQixNQUFJLE9BQVEsUUFBTyxjQUFjLFFBQVEsS0FBSztBQUM5QyxTQUFPLFVBQVUsS0FBSztBQUN4QjtBQUVPLFNBQVMsaUJBQWlCLE9BQU87QUFDdEMsU0FBTyxVQUFVLEtBQUs7QUFDeEI7QUF1Qk8sU0FBUyxVQUFVLE9BQU87QUFDL0IsUUFBTSxTQUFTLFFBQVEsSUFBSTtBQUMzQixNQUFJLENBQUMsUUFBUTtBQUNYLFVBQU07QUFBQSxNQUNKO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBRUEsUUFBTSxRQUFRLE1BQU0sTUFBTSxHQUFHO0FBQzdCLE1BQUksTUFBTSxXQUFXLEVBQUcsUUFBTztBQUUvQixRQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSTtBQUNsQixRQUFNLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQztBQUN0QixRQUFNLFdBQVcsVUFBVSxPQUFPLFdBQVcsVUFBVSxNQUFNLEVBQUUsT0FBTyxJQUFJLEVBQUUsT0FBTyxDQUFDO0FBRXBGLE1BQUk7QUFDRixVQUFNLElBQUksT0FBTyxLQUFLLFFBQVE7QUFDOUIsVUFBTSxJQUFJLE9BQU8sS0FBSyxDQUFDO0FBQ3ZCLFFBQUksRUFBRSxXQUFXLEVBQUUsT0FBUSxRQUFPO0FBQ2xDLFFBQUksQ0FBQyxPQUFPLGdCQUFnQixHQUFHLENBQUMsRUFBRyxRQUFPO0FBQUEsRUFDNUMsUUFBUTtBQUNOLFdBQU87QUFBQSxFQUNUO0FBRUEsTUFBSTtBQUNGLFVBQU0sVUFBVSxLQUFLO0FBQUEsTUFDbkIsT0FBTyxLQUFLLEVBQUUsUUFBUSxNQUFNLEdBQUcsRUFBRSxRQUFRLE1BQU0sR0FBRyxHQUFHLFFBQVEsRUFBRSxTQUFTLE9BQU87QUFBQSxJQUNqRjtBQUNBLFVBQU0sTUFBTSxLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksR0FBSTtBQUN4QyxRQUFJLFFBQVEsT0FBTyxNQUFNLFFBQVEsSUFBSyxRQUFPO0FBQzdDLFdBQU87QUFBQSxFQUNULFFBQVE7QUFDTixXQUFPO0FBQUEsRUFDVDtBQUNGOzs7QUNySkEsU0FBUyxhQUFhO0FBQ3BCLFNBQU87QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBU1Q7QUFFQSxlQUFzQixVQUFVLFVBQVU7QUFFeEMsUUFBTSxZQUFZLFdBQVcsUUFBUTtBQUNyQyxNQUFJLFNBQVMsTUFBTTtBQUFBLElBQ2pCLEdBQUcsV0FBVyxDQUFDO0FBQUE7QUFBQTtBQUFBLElBR2YsQ0FBQyxTQUFTO0FBQUEsRUFDWjtBQUNBLE1BQUksT0FBTyxTQUFVLFFBQU8sT0FBTyxLQUFLLENBQUM7QUFHekMsTUFBSSxRQUFRLElBQUksWUFBWTtBQUMxQixVQUFNLFNBQVMsaUJBQWlCLFFBQVE7QUFDeEMsYUFBUyxNQUFNO0FBQUEsTUFDYixHQUFHLFdBQVcsQ0FBQztBQUFBO0FBQUE7QUFBQSxNQUdmLENBQUMsTUFBTTtBQUFBLElBQ1Q7QUFDQSxRQUFJLENBQUMsT0FBTyxTQUFVLFFBQU87QUFFN0IsVUFBTSxNQUFNLE9BQU8sS0FBSyxDQUFDO0FBQ3pCLFFBQUk7QUFDRixZQUFNO0FBQUEsUUFDSjtBQUFBO0FBQUEsUUFFQSxDQUFDLFdBQVcsSUFBSSxZQUFZLE1BQU07QUFBQSxNQUNwQztBQUFBLElBQ0YsUUFBUTtBQUFBLElBRVI7QUFFQSxXQUFPO0FBQUEsRUFDVDtBQUVBLFNBQU87QUFDVDtBQUVBLGVBQXNCLGNBQWMsWUFBWTtBQUM5QyxRQUFNLFNBQVMsTUFBTTtBQUFBLElBQ25CLEdBQUcsV0FBVyxDQUFDO0FBQUE7QUFBQTtBQUFBLElBR2YsQ0FBQyxVQUFVO0FBQUEsRUFDYjtBQUNBLE1BQUksQ0FBQyxPQUFPLFNBQVUsUUFBTztBQUM3QixTQUFPLE9BQU8sS0FBSyxDQUFDO0FBQ3RCO0FBUUEsZUFBc0IsWUFBWSxPQUFPO0FBQ3ZDLE1BQUksQ0FBQyxNQUFPLFFBQU87QUFHbkIsUUFBTSxRQUFRLE1BQU0sTUFBTSxHQUFHO0FBQzdCLE1BQUksTUFBTSxXQUFXLEdBQUc7QUFDdEIsVUFBTSxVQUFVLFVBQVUsS0FBSztBQUMvQixRQUFJLENBQUMsUUFBUyxRQUFPO0FBQ3JCLFFBQUksUUFBUSxTQUFTLGVBQWdCLFFBQU87QUFFNUMsVUFBTSxNQUFNLE1BQU0sY0FBYyxRQUFRLFVBQVU7QUFDbEQsV0FBTztBQUFBLEVBQ1Q7QUFFQSxTQUFPLE1BQU0sVUFBVSxLQUFLO0FBQzlCO0FBRUEsZUFBc0IsZUFBZSxhQUFhLFFBQVEsWUFBWSxHQUFHO0FBQ3ZFLFFBQU0sT0FBTyxNQUFNO0FBQUEsSUFDakI7QUFBQTtBQUFBLElBRUEsQ0FBQyxhQUFhLEtBQUs7QUFBQSxFQUNyQjtBQUNBLE1BQUksS0FBSyxhQUFhLEVBQUcsUUFBTyxFQUFFLGFBQWEsR0FBRyxhQUFhLEdBQUcsY0FBYyxHQUFHLGVBQWUsRUFBRTtBQUNwRyxTQUFPLEtBQUssS0FBSyxDQUFDO0FBQ3BCO0FBRUEsZUFBc0Isa0JBQWtCLFlBQVksUUFBUSxZQUFZLEdBQUc7QUFDekUsUUFBTSxPQUFPLE1BQU07QUFBQSxJQUNqQjtBQUFBO0FBQUEsSUFFQSxDQUFDLFlBQVksS0FBSztBQUFBLEVBQ3BCO0FBQ0EsTUFBSSxLQUFLLFNBQVUsUUFBTyxLQUFLLEtBQUssQ0FBQztBQUdyQyxRQUFNLFVBQVUsTUFBTSxFQUFFLGdEQUFnRCxDQUFDLFVBQVUsQ0FBQztBQUNwRixRQUFNLGNBQWMsUUFBUSxXQUFXLFFBQVEsS0FBSyxDQUFDLEVBQUUsY0FBYztBQUVyRSxRQUFNLE1BQU0sTUFBTTtBQUFBLElBQ2hCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBTUEsQ0FBQyxZQUFZLEtBQUs7QUFBQSxFQUNwQjtBQUVBLFFBQU0sTUFBTSxJQUFJLEtBQUssQ0FBQyxLQUFLLEVBQUUsYUFBYSxHQUFHLGNBQWMsR0FBRyxlQUFlLEdBQUcsT0FBTyxFQUFFO0FBRXpGLE1BQUksZUFBZSxNQUFNO0FBQ3ZCLFVBQU07QUFBQSxNQUNKO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BU0EsQ0FBQyxZQUFZLGFBQWEsT0FBTyxJQUFJLGVBQWUsR0FBRyxJQUFJLGdCQUFnQixHQUFHLElBQUksaUJBQWlCLEdBQUcsSUFBSSxTQUFTLENBQUM7QUFBQSxJQUN0SDtBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQ1Q7QUFRTyxTQUFTLGlCQUFpQixRQUFRLGdCQUFnQjtBQUN2RCxRQUFNLE9BQU8sT0FBTyxzQkFBc0I7QUFDMUMsUUFBTSxRQUFRLGVBQWUsZUFBZTtBQUM1QyxTQUFPLE9BQU87QUFDaEI7QUFFTyxTQUFTLFlBQVksUUFBUSxnQkFBZ0I7QUFFbEQsTUFBSSxPQUFPLGlCQUFpQixLQUFNLFFBQU8sT0FBTztBQUNoRCxTQUFPLGlCQUFpQixRQUFRLGNBQWM7QUFDaEQ7OztBQzNKQSxJQUFJLFdBQVc7QUFDZixJQUFNLGtCQUFrQixvQkFBSSxJQUFJO0FBRWhDLGVBQWUsY0FBYztBQUMzQixRQUFNLE1BQU0sUUFBUSxJQUFJO0FBQ3hCLFFBQU0sUUFBUSxRQUFRLElBQUk7QUFDMUIsTUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFPLFFBQU87QUFFM0IsTUFBSSxTQUFVLFFBQU87QUFFckIsUUFBTSxDQUFDLEVBQUUsVUFBVSxHQUFHLEVBQUUsTUFBTSxDQUFDLElBQUksTUFBTSxRQUFRLElBQUk7QUFBQSxJQUNuRCxPQUFPLG9CQUFvQjtBQUFBLElBQzNCLE9BQU8sZ0JBQWdCO0FBQUEsRUFDekIsQ0FBQztBQUVELGFBQVcsRUFBRSxXQUFXLE1BQU07QUFDOUIsU0FBTztBQUNUO0FBRUEsU0FBUyxTQUFTLE9BQU87QUFDdkIsTUFBSSxDQUFDLE1BQU8sUUFBTztBQUNuQixNQUFJLE9BQU8sVUFBVSxTQUFVLFFBQU8sSUFBSSxLQUFLLEtBQUssRUFBRSxZQUFZO0FBQ2xFLE1BQUksaUJBQWlCLEtBQU0sUUFBTyxNQUFNLFlBQVk7QUFDcEQsTUFBSSxPQUFPLFVBQVUsU0FBVSxRQUFPO0FBQ3RDLE1BQUk7QUFDRixRQUFJLE9BQU8sT0FBTyxZQUFZLFdBQVksUUFBTyxJQUFJLEtBQUssTUFBTSxRQUFRLENBQUMsRUFBRSxZQUFZO0FBQUEsRUFDekYsUUFBUTtBQUFBLEVBQUM7QUFDVCxTQUFPO0FBQ1Q7QUFTQSxlQUFzQixXQUFXLEVBQUUsWUFBWSxVQUFVLFlBQVksR0FBRztBQUN0RSxRQUFNLGFBQWEsU0FBUyxRQUFRLElBQUkscUJBQXFCLE9BQU8sRUFBRTtBQUN0RSxRQUFNLFFBQVEsT0FBTyxTQUFTLFdBQVcsSUFBSSxjQUFjO0FBRTNELE1BQUksQ0FBQyxPQUFPLFNBQVMsS0FBSyxLQUFLLFNBQVMsR0FBRztBQUN6QyxXQUFPLEVBQUUsSUFBSSxNQUFNLFdBQVcsTUFBTSxPQUFPLE1BQU0sTUFBTSxNQUFNO0FBQUEsRUFDL0Q7QUFFQSxRQUFNLEtBQUssTUFBTSxZQUFZO0FBQzdCLE1BQUksSUFBSTtBQUNOLFFBQUksQ0FBQyxnQkFBZ0IsSUFBSSxLQUFLLEdBQUc7QUFDL0IsWUFBTSxRQUFRLEdBQUcsTUFBTSxRQUFRO0FBQy9CLFlBQU0sS0FBSyxJQUFJLEdBQUcsVUFBVTtBQUFBLFFBQzFCO0FBQUEsUUFDQSxTQUFTLEdBQUcsVUFBVSxjQUFjLE9BQU8sTUFBTTtBQUFBLFFBQ2pELFFBQVE7QUFBQSxNQUNWLENBQUM7QUFDRCxzQkFBZ0IsSUFBSSxPQUFPLEVBQUU7QUFBQSxJQUMvQjtBQUVBLFVBQU0sVUFBVSxnQkFBZ0IsSUFBSSxLQUFLO0FBQ3pDLFVBQU0sTUFBTSxJQUFJLFVBQVUsS0FBSyxRQUFRO0FBQ3ZDLFVBQU1BLE9BQU0sTUFBTSxRQUFRLE1BQU0sR0FBRztBQUVuQyxXQUFPO0FBQUEsTUFDTCxJQUFJLENBQUMsQ0FBQ0EsS0FBSTtBQUFBLE1BQ1YsV0FBV0EsS0FBSSxhQUFhO0FBQUEsTUFDNUIsT0FBTyxTQUFTQSxLQUFJLEtBQUs7QUFBQSxNQUN6QixNQUFNO0FBQUEsSUFDUjtBQUFBLEVBQ0Y7QUFHQSxRQUFNLE1BQU0sS0FBSyxJQUFJO0FBQ3JCLFFBQU0sV0FBVztBQUNqQixRQUFNLGNBQWMsSUFBSSxLQUFLLEtBQUssTUFBTSxNQUFNLFFBQVEsSUFBSSxRQUFRO0FBQ2xFLFFBQU0sUUFBUSxJQUFJLEtBQUssWUFBWSxRQUFRLElBQUksUUFBUTtBQUV2RCxRQUFNLE1BQU0sTUFBTTtBQUFBLElBQ2hCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUtBLENBQUMsWUFBWSxVQUFVLFdBQVc7QUFBQSxFQUNwQztBQUVBLFFBQU0sUUFBUSxJQUFJLE9BQU8sQ0FBQyxHQUFHLFNBQVM7QUFDdEMsUUFBTSxZQUFZLEtBQUssSUFBSSxHQUFHLFFBQVEsS0FBSztBQUUzQyxNQUFJLEtBQUssT0FBTyxJQUFJLE1BQU07QUFDeEIsUUFBSTtBQUNGLFlBQU0sRUFBRSxnRkFBZ0Y7QUFBQSxJQUMxRixRQUFRO0FBQUEsSUFBQztBQUFBLEVBQ1g7QUFFQSxTQUFPO0FBQUEsSUFDTCxJQUFJLFNBQVM7QUFBQSxJQUNiO0FBQUEsSUFDQSxPQUFPLE1BQU0sWUFBWTtBQUFBLElBQ3pCLE1BQU07QUFBQSxFQUNSO0FBQ0Y7OztBQ25HQSxTQUFTQyxhQUFZLFNBQVMsTUFBTTtBQUNsQyxRQUFNLE1BQU0sSUFBSSxNQUFNLE9BQU87QUFDN0IsTUFBSSxPQUFPO0FBQ1gsTUFBSSxTQUFTO0FBQ2IsTUFBSSxLQUFNLEtBQUksT0FBTztBQUNyQixTQUFPO0FBQ1Q7QUFHQSxTQUFTLGVBQWUsR0FBRyxNQUFNLE1BQU87QUFDdEMsTUFBSTtBQUNGLFVBQU0sSUFBSSxPQUFPLE1BQU0sV0FBVyxJQUFJLEtBQUssVUFBVSxDQUFDO0FBQ3RELFFBQUksQ0FBQyxFQUFHLFFBQU87QUFDZixRQUFJLEVBQUUsVUFBVSxJQUFLLFFBQU87QUFDNUIsV0FBTyxFQUFFLE1BQU0sR0FBRyxHQUFHLElBQUksV0FBTSxFQUFFLFNBQVMsR0FBRztBQUFBLEVBQy9DLFFBQVE7QUFDTixVQUFNLElBQUksT0FBTyxLQUFLLEVBQUU7QUFDeEIsUUFBSSxFQUFFLFVBQVUsSUFBSyxRQUFPO0FBQzVCLFdBQU8sRUFBRSxNQUFNLEdBQUcsR0FBRyxJQUFJLFdBQU0sRUFBRSxTQUFTLEdBQUc7QUFBQSxFQUMvQztBQUNGO0FBRUEsU0FBUyxjQUFjLFVBQVUsS0FBSyxNQUFNO0FBQzFDLFFBQU0sU0FBUyxLQUFLLFVBQVU7QUFDOUIsUUFBTSxRQUNKLEtBQUssU0FBUyxNQUFNLGNBQWMsS0FDbEMsS0FBSyxTQUFTLE1BQU0sWUFBWSxLQUNoQyxLQUFLLFNBQVMsTUFBTSxrQkFBa0IsS0FDdEM7QUFHRixNQUFJLE1BQU07QUFDVixNQUFJO0FBQ0YsVUFBTSxNQUFNLE9BQU8sV0FBVyxNQUFNLE9BQU8sUUFBUSxNQUFNLFdBQVc7QUFBQSxFQUN0RSxRQUFRO0FBQUEsRUFBQztBQUNULFFBQU0sTUFBTSxJQUFJLE1BQU0sTUFBTSxHQUFHLFFBQVEsbUJBQW1CLE1BQU0sS0FBSyxHQUFHLEtBQUssR0FBRyxRQUFRLG1CQUFtQixNQUFNLEVBQUU7QUFDbkgsTUFBSSxPQUFPO0FBQ1gsTUFBSSxTQUFTO0FBQ2IsTUFBSSxXQUFXO0FBQUEsSUFDYjtBQUFBLElBQ0E7QUFBQSxJQUNBLFlBQVk7QUFBQSxJQUNaLE1BQU0sZUFBZSxJQUFJO0FBQUEsRUFDM0I7QUFDQSxTQUFPO0FBQ1Q7QUFvSkEsZUFBc0IsYUFBYSxFQUFFLE9BQU8sVUFBVSxZQUFZLFlBQVksR0FBRztBQUMvRSxRQUFNLFNBQVMsUUFBUSxJQUFJO0FBQzNCLE1BQUksQ0FBQyxPQUFRLE9BQU1DLGFBQVksaUNBQWlDLDZHQUFtRztBQUVuSyxRQUFNLFFBQVEsTUFBTSxRQUFRLFFBQVEsSUFBSSxTQUFTLElBQUksUUFBTTtBQUFBLElBQ3pELE1BQU0sRUFBRTtBQUFBLElBQ1IsU0FBUyxDQUFDLEVBQUUsTUFBTSxjQUFjLE1BQU0sT0FBTyxFQUFFLFdBQVcsRUFBRSxFQUFFLENBQUM7QUFBQSxFQUNqRSxFQUFFLElBQUksQ0FBQztBQUVQLFFBQU0sT0FBTztBQUFBLElBQ1g7QUFBQSxJQUNBO0FBQUEsSUFDQSxhQUFhLE9BQU8sZ0JBQWdCLFdBQVcsY0FBYztBQUFBLElBQzdELG1CQUFtQixPQUFPLGVBQWUsV0FBVyxhQUFhO0FBQUEsSUFDakUsT0FBTztBQUFBLElBQ1AsUUFBUTtBQUFBLEVBQ1Y7QUFFQSxRQUFNLFdBQVcsTUFBTSxNQUFNLHVDQUF1QztBQUFBLElBQ2xFLFFBQVE7QUFBQSxJQUNSLFNBQVM7QUFBQSxNQUNQLGlCQUFpQixVQUFVLE1BQU07QUFBQSxNQUNqQyxnQkFBZ0I7QUFBQSxNQUNoQixVQUFVO0FBQUEsSUFDWjtBQUFBLElBQ0EsTUFBTSxLQUFLLFVBQVUsSUFBSTtBQUFBLEVBQzNCLENBQUM7QUFFRCxNQUFJLENBQUMsU0FBUyxJQUFJO0FBQ2hCLFVBQU0sT0FBTyxNQUFNLFNBQVMsS0FBSyxFQUFFLE1BQU0sT0FBTSxDQUFDLEVBQUU7QUFDbEQsVUFBTSxJQUFJLE1BQU0sTUFBTSxPQUFPLFdBQVcsZ0JBQWdCLFNBQVMsTUFBTSxFQUFFO0FBQUEsRUFDM0U7QUFHQSxXQUFTLGNBQWMsV0FBVztBQUNoQyxVQUFNLE1BQU0sQ0FBQztBQUNiLFVBQU0sUUFBUSxVQUFVLE1BQU0sT0FBTztBQUNyQyxlQUFXLFFBQVEsT0FBTztBQUN4QixVQUFJLENBQUMsS0FBSyxXQUFXLE9BQU8sRUFBRztBQUMvQixZQUFNLFVBQVUsS0FBSyxNQUFNLENBQUMsRUFBRSxLQUFLO0FBQ25DLFVBQUksQ0FBQyxXQUFXLFlBQVksU0FBVTtBQUN0QyxVQUFJO0FBQ0YsY0FBTSxNQUFNLEtBQUssTUFBTSxPQUFPO0FBQzlCLGNBQU0sSUFBSSxJQUFJLFFBQVE7QUFDdEIsWUFBSSxFQUFFLFNBQVMsbUJBQW1CLEtBQUssT0FBTyxJQUFJLFVBQVUsU0FBVSxLQUFJLEtBQUssRUFBRSxNQUFNLFNBQVMsTUFBTSxJQUFJLE1BQU0sQ0FBQztBQUNqSCxZQUFJLE1BQU0sd0JBQXdCLE1BQU0sdUJBQXVCLEVBQUUsU0FBUyxvQkFBb0IsR0FBRztBQUMvRixnQkFBTSxRQUFRLElBQUksVUFBVSxTQUFTLElBQUksU0FBUyxDQUFDO0FBQ25ELGNBQUksS0FBSyxFQUFFLE1BQU0sUUFBUSxPQUFPLEVBQUUsY0FBYyxNQUFNLGdCQUFnQixHQUFHLGVBQWUsTUFBTSxpQkFBaUIsRUFBRSxFQUFFLENBQUM7QUFBQSxRQUN0SDtBQUFBLE1BQ0YsUUFBUTtBQUFBLE1BQUM7QUFBQSxJQUNYO0FBQ0EsV0FBTztBQUFBLEVBQ1Q7QUFFQSxTQUFPLEVBQUUsVUFBVSxPQUFPLGNBQWM7QUFDMUM7QUFFQSxlQUFzQixnQkFBZ0IsRUFBRSxPQUFPLFVBQVUsWUFBWSxZQUFZLEdBQUc7QUFDbEYsUUFBTSxTQUFTLFFBQVEsSUFBSTtBQUMzQixNQUFJLENBQUMsT0FBUSxPQUFNQSxhQUFZLG9DQUFvQyxtSEFBeUc7QUFFNUssUUFBTSxjQUFjLENBQUM7QUFDckIsUUFBTSxVQUFVLENBQUM7QUFFakIsUUFBTSxPQUFPLE1BQU0sUUFBUSxRQUFRLElBQUksV0FBVyxDQUFDO0FBQ25ELGFBQVcsS0FBSyxNQUFNO0FBQ3BCLFVBQU0sT0FBTyxPQUFPLEVBQUUsUUFBUSxFQUFFLEVBQUUsWUFBWTtBQUM5QyxVQUFNLE9BQU8sT0FBTyxFQUFFLFdBQVcsRUFBRTtBQUNuQyxRQUFJLENBQUMsS0FBTTtBQUNYLFFBQUksU0FBUyxZQUFZLFNBQVMsWUFBYSxhQUFZLEtBQUssSUFBSTtBQUFBLGFBQzNELFNBQVMsWUFBYSxTQUFRLEtBQUssRUFBRSxNQUFNLGFBQWEsU0FBUyxLQUFLLENBQUM7QUFBQSxRQUMzRSxTQUFRLEtBQUssRUFBRSxNQUFNLFFBQVEsU0FBUyxLQUFLLENBQUM7QUFBQSxFQUNuRDtBQUVBLFFBQU0sT0FBTztBQUFBLElBQ1g7QUFBQSxJQUNBLFlBQVksT0FBTyxlQUFlLFdBQVcsYUFBYTtBQUFBLElBQzFELGFBQWEsT0FBTyxnQkFBZ0IsV0FBVyxjQUFjO0FBQUEsSUFDN0QsUUFBUTtBQUFBLElBQ1IsVUFBVTtBQUFBLEVBQ1o7QUFDQSxNQUFJLFlBQVksT0FBUSxNQUFLLFNBQVMsWUFBWSxLQUFLLE1BQU07QUFFL0QsUUFBTSxXQUFXLE1BQU0sTUFBTSx5Q0FBeUM7QUFBQSxJQUNsRSxRQUFRO0FBQUEsSUFDUixTQUFTO0FBQUEsTUFDUCxhQUFhO0FBQUEsTUFDYixxQkFBcUI7QUFBQSxNQUNyQixnQkFBZ0I7QUFBQSxNQUNoQixVQUFVO0FBQUEsSUFDWjtBQUFBLElBQ0EsTUFBTSxLQUFLLFVBQVUsSUFBSTtBQUFBLEVBQzNCLENBQUM7QUFFRCxNQUFJLENBQUMsU0FBUyxJQUFJO0FBQ2hCLFVBQU0sT0FBTyxNQUFNLFNBQVMsS0FBSyxFQUFFLE1BQU0sT0FBTSxDQUFDLEVBQUU7QUFDbEQsVUFBTSxJQUFJLE1BQU0sTUFBTSxPQUFPLFdBQVcsbUJBQW1CLFNBQVMsTUFBTSxFQUFFO0FBQUEsRUFDOUU7QUFFQSxXQUFTLGNBQWMsV0FBVztBQUNoQyxVQUFNLE1BQU0sQ0FBQztBQUNiLFVBQU0sUUFBUSxVQUFVLE1BQU0sT0FBTztBQUVyQyxlQUFXLFFBQVEsT0FBTztBQUN4QixVQUFJLENBQUMsS0FBSyxXQUFXLE9BQU8sRUFBRztBQUMvQixZQUFNLFVBQVUsS0FBSyxNQUFNLENBQUMsRUFBRSxLQUFLO0FBQ25DLFVBQUksQ0FBQyxXQUFXLFlBQVksU0FBVTtBQUN0QyxVQUFJO0FBQ0YsY0FBTSxNQUFNLEtBQUssTUFBTSxPQUFPO0FBQzlCLGNBQU0sSUFBSSxJQUFJLFFBQVE7QUFDdEIsWUFBSSxNQUFNLHlCQUF5QixJQUFJLE9BQU8sU0FBUyxnQkFBZ0IsT0FBTyxJQUFJLE1BQU0sU0FBUyxVQUFVO0FBQ3pHLGNBQUksS0FBSyxFQUFFLE1BQU0sU0FBUyxNQUFNLElBQUksTUFBTSxLQUFLLENBQUM7QUFBQSxRQUNsRDtBQUNBLFlBQUksTUFBTSxtQkFBbUIsSUFBSSxPQUFPO0FBQUEsUUFFeEM7QUFDQSxZQUFJLE1BQU0sa0JBQWtCLE1BQU0saUJBQWlCLE1BQU0sb0JBQW9CO0FBQzNFLGdCQUFNLFFBQVEsSUFBSSxTQUFTLENBQUM7QUFDNUIsY0FBSSxLQUFLLEVBQUUsTUFBTSxRQUFRLE9BQU8sRUFBRSxjQUFjLE1BQU0sZ0JBQWdCLEdBQUcsZUFBZSxNQUFNLGlCQUFpQixFQUFFLEVBQUUsQ0FBQztBQUFBLFFBQ3RIO0FBQUEsTUFDRixRQUFRO0FBQUEsTUFBQztBQUFBLElBQ1g7QUFDQSxXQUFPO0FBQUEsRUFDVDtBQUVBLFNBQU8sRUFBRSxVQUFVLE9BQU8sY0FBYztBQUMxQztBQUVBLGVBQXNCLGFBQWEsRUFBRSxPQUFPLFVBQVUsWUFBWSxZQUFZLEdBQUc7QUFDL0UsUUFBTSxZQUFZLFFBQVEsSUFBSSx3QkFBd0IsUUFBUSxJQUFJO0FBQ2xFLFFBQU0sU0FBUyxPQUFPLGFBQWEsRUFBRSxFQUNsQyxLQUFLLEVBQ0wsUUFBUSxZQUFZLElBQUksRUFDeEIsS0FBSztBQUNSLE1BQUksQ0FBQyxPQUFRLE9BQU1BLGFBQVksaUNBQWlDLGdJQUFzSDtBQUV0TCxRQUFNLGNBQWMsQ0FBQztBQUNyQixRQUFNLFdBQVcsQ0FBQztBQUNsQixRQUFNLE9BQU8sTUFBTSxRQUFRLFFBQVEsSUFBSSxXQUFXLENBQUM7QUFDbkQsYUFBVyxLQUFLLE1BQU07QUFDcEIsVUFBTSxPQUFPLEVBQUU7QUFDZixVQUFNLE9BQU8sT0FBTyxFQUFFLFdBQVcsRUFBRTtBQUNuQyxRQUFJLFNBQVMsU0FBVSxhQUFZLEtBQUssSUFBSTtBQUFBLGFBQ25DLFNBQVMsWUFBYSxVQUFTLEtBQUssRUFBRSxNQUFNLFNBQVMsT0FBTyxDQUFDLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQztBQUFBLFFBQzVFLFVBQVMsS0FBSyxFQUFFLE1BQU0sUUFBUSxPQUFPLENBQUMsRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDO0FBQUEsRUFDeEQ7QUFFQSxRQUFNLE9BQU87QUFBQSxJQUNYO0FBQUEsSUFDQSxrQkFBa0I7QUFBQSxNQUNoQixpQkFBaUIsT0FBTyxlQUFlLFdBQVcsYUFBYTtBQUFBLE1BQy9ELGFBQWEsT0FBTyxnQkFBZ0IsV0FBVyxjQUFjO0FBQUEsSUFDL0Q7QUFBQSxFQUNGO0FBQ0EsTUFBSSxZQUFZLE9BQVEsTUFBSyxvQkFBb0IsRUFBRSxPQUFPLENBQUMsRUFBRSxNQUFNLFlBQVksS0FBSyxNQUFNLEVBQUUsQ0FBQyxFQUFFO0FBRy9GLFFBQU0sTUFBTSwyREFBMkQsbUJBQW1CLEtBQUssQ0FBQztBQUNoRyxRQUFNLFdBQVcsTUFBTSxNQUFNLEtBQUs7QUFBQSxJQUNoQyxRQUFRO0FBQUEsSUFDUixTQUFTLEVBQUUsa0JBQWtCLFFBQVEsZ0JBQWdCLG1CQUFtQjtBQUFBLElBQ3hFLE1BQU0sS0FBSyxVQUFVLElBQUk7QUFBQSxFQUMzQixDQUFDO0FBRUQsTUFBSSxDQUFDLFNBQVMsSUFBSTtBQUNoQixVQUFNLE9BQU8sTUFBTSxTQUFTLEtBQUssRUFBRSxNQUFNLE9BQU0sQ0FBQyxFQUFFO0FBQ2xELFVBQU0sY0FBYyxVQUFVLFVBQVUsSUFBSTtBQUFBLEVBQzlDO0FBR0EsV0FBUyxZQUFZLFdBQVc7QUFDOUIsVUFBTSxNQUFNLENBQUM7QUFDYixVQUFNLFFBQVEsVUFBVSxNQUFNLE9BQU8sRUFBRSxJQUFJLE9BQUssRUFBRSxLQUFLLENBQUMsRUFBRSxPQUFPLE9BQU87QUFDeEUsZUFBVyxLQUFLLE9BQU87QUFDckIsVUFBSTtBQUNGLGNBQU0sTUFBTSxLQUFLLE1BQU0sQ0FBQztBQUV4QixjQUFNLGFBQWEsTUFBTSxRQUFRLElBQUksVUFBVSxJQUFJLElBQUksYUFBYSxDQUFDO0FBQ3JFLG1CQUFXLFFBQVEsWUFBWTtBQUM3QixnQkFBTSxVQUFVLE1BQU07QUFDdEIsY0FBSSxTQUFTLE9BQU87QUFDbEIsdUJBQVcsUUFBUSxRQUFRLE9BQU87QUFDaEMsa0JBQUksT0FBTyxLQUFLLFNBQVMsWUFBWSxLQUFLLEtBQU0sS0FBSSxLQUFLLEVBQUUsTUFBTSxTQUFTLE1BQU0sS0FBSyxLQUFLLENBQUM7QUFBQSxZQUM3RjtBQUFBLFVBQ0Y7QUFBQSxRQUNGO0FBQ0EsY0FBTSxRQUFRLElBQUk7QUFDbEIsWUFBSSxVQUFVLE1BQU0sb0JBQW9CLE1BQU0sdUJBQXVCO0FBRW5FLGNBQUksS0FBSyxFQUFFLE1BQU0sU0FBUyxPQUFPLEVBQUUsY0FBYyxNQUFNLG9CQUFvQixHQUFHLGVBQWUsTUFBTSx3QkFBd0IsRUFBRSxFQUFFLENBQUM7QUFBQSxRQUNsSTtBQUFBLE1BQ0YsUUFBUTtBQUFBLE1BQUM7QUFBQSxJQUNYO0FBQ0EsV0FBTztBQUFBLEVBQ1Q7QUFFQSxTQUFPLEVBQUUsVUFBVSxPQUFPLGFBQWEsVUFBVSxLQUFLO0FBQ3hEOzs7QUN0WUEsU0FBUyxJQUFJLE9BQU8sS0FBSztBQUN2QixNQUFJLENBQUMsT0FBTyxPQUFPLEVBQUcsUUFBTztBQUM3QixTQUFRLFFBQVEsTUFBTztBQUN6QjtBQUVBLGVBQWUsV0FBVyxFQUFFLGFBQWEsYUFBYSxHQUFHLE9BQU8sV0FBVyxHQUFHO0FBQzVFLFFBQU0sTUFBTSxNQUFNO0FBQUEsSUFDaEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUlBLENBQUMsYUFBYSxjQUFjLEdBQUcsT0FBTyxVQUFVO0FBQUEsRUFDbEQ7QUFDQSxTQUFPLElBQUksV0FBVztBQUN4QjtBQUVBLGVBQWUsWUFBWSxTQUFTO0FBQ2xDLFFBQU0sTUFBTSxRQUFRLElBQUk7QUFDeEIsTUFBSSxDQUFDLElBQUs7QUFHVixNQUFJO0FBQ0YsVUFBTSxNQUFNLEtBQUs7QUFBQSxNQUNmLFFBQVE7QUFBQSxNQUNSLFNBQVMsRUFBRSxnQkFBZ0IsbUJBQW1CO0FBQUEsTUFDOUMsTUFBTSxLQUFLLFVBQVUsT0FBTztBQUFBLElBQzlCLENBQUM7QUFBQSxFQUNILFFBQVE7QUFBQSxFQUVSO0FBQ0Y7QUFNQSxlQUFzQixlQUFlO0FBQUEsRUFDbkM7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRixHQUFHO0FBQ0QsUUFBTSxVQUFVLFdBQVcsUUFBUSxJQUFJLGdCQUFnQixJQUFJO0FBRTNELFFBQU0sUUFBUSxJQUFJLHdCQUF3QixHQUFHLHNCQUFzQixDQUFDO0FBQ3BFLFFBQU0sT0FBTyxJQUFJLG1CQUFtQixHQUFHLGlCQUFpQixDQUFDO0FBR3pELE1BQUksU0FBUyxXQUFXLFFBQVEsS0FBSztBQUNuQyxVQUFNLEtBQUssTUFBTSxXQUFXLEVBQUUsYUFBYSxZQUFZLEdBQUcsT0FBTyxZQUFZLG9CQUFvQixDQUFDO0FBQ2xHLFFBQUksSUFBSTtBQUNOLFlBQU0sWUFBWTtBQUFBLFFBQ2hCLE1BQU07QUFBQSxRQUNOO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQSxLQUFLO0FBQUEsTUFDUCxDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFHQSxNQUFJLFFBQVEsV0FBVyxPQUFPLEtBQUs7QUFDakMsVUFBTSxLQUFLLE1BQU0sV0FBVyxFQUFFLGFBQWEsWUFBWSxjQUFjLEdBQUcsT0FBTyxZQUFZLGVBQWUsQ0FBQztBQUMzRyxRQUFJLElBQUk7QUFDTixZQUFNLFlBQVk7QUFBQSxRQUNoQixNQUFNO0FBQUEsUUFDTjtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBLEtBQUs7QUFBQSxNQUNQLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRjtBQUNGOzs7QUN6RUEsZUFBc0IsY0FBYyxFQUFFLFFBQVEsWUFBWSxJQUFJLFFBQVEsVUFBVSxHQUFHO0FBQ2pGLFFBQU0saUJBQWlCLENBQUMsRUFBRSxPQUFPLHNCQUFzQixPQUFPO0FBQzlELFFBQU0sY0FBYyxPQUFPLFNBQVMsT0FBTyxXQUFXLElBQUksT0FBTyxjQUFjLFVBQVUsT0FBTyxTQUFTLE9BQU8sNEJBQTRCLElBQUksT0FBTywrQkFBK0I7QUFFdEwsT0FBSyxrQkFBbUIsY0FBYyxRQUFRLGFBQWEsTUFBTyxDQUFDLFlBQVk7QUFDN0UsV0FBTyxFQUFFLElBQUksT0FBTyxRQUFRLEtBQUssT0FBTyxxREFBcUQ7QUFBQSxFQUMvRjtBQUdBLE1BQUksQ0FBQyxXQUFZLFFBQU8sRUFBRSxJQUFJLEtBQUs7QUFHbkMsUUFBTSxXQUFXLE1BQU07QUFBQSxJQUNyQjtBQUFBO0FBQUE7QUFBQTtBQUFBLElBSUEsQ0FBQyxPQUFPLFlBQVksVUFBVTtBQUFBLEVBQ2hDO0FBRUEsTUFBSSxTQUFTLFVBQVU7QUFDckIsVUFBTSxNQUFNLFNBQVMsS0FBSyxDQUFDO0FBQzNCLFFBQUksSUFBSSxZQUFZO0FBQ2xCLGFBQU8sRUFBRSxJQUFJLE9BQU8sUUFBUSxLQUFLLE9BQU8sOEJBQThCO0FBQUEsSUFDeEU7QUFFQSxVQUFNO0FBQUEsTUFDSjtBQUFBO0FBQUEsTUFFQSxDQUFDLE9BQU8sWUFBWSxZQUFZLE1BQU0sSUFBSTtBQUFBLElBQzVDO0FBQ0EsV0FBTyxFQUFFLElBQUksS0FBSztBQUFBLEVBQ3BCO0FBR0EsTUFBSSxjQUFjLFFBQVEsYUFBYSxHQUFHO0FBQ3hDLFVBQU0sY0FBYyxNQUFNO0FBQUEsTUFDeEI7QUFBQTtBQUFBO0FBQUEsTUFHQSxDQUFDLE9BQU8sVUFBVTtBQUFBLElBQ3BCO0FBQ0EsVUFBTSxJQUFJLFlBQVksT0FBTyxDQUFDLEdBQUcsS0FBSztBQUN0QyxRQUFJLEtBQUssWUFBWTtBQUNuQixhQUFPLEVBQUUsSUFBSSxPQUFPLFFBQVEsS0FBSyxPQUFPLHlCQUF5QixDQUFDLElBQUksVUFBVSwwQ0FBMEM7QUFBQSxJQUM1SDtBQUFBLEVBQ0Y7QUFHQSxRQUFNO0FBQUEsSUFDSjtBQUFBO0FBQUE7QUFBQTtBQUFBLElBSUEsQ0FBQyxPQUFPLFlBQVksT0FBTyxhQUFhLFlBQVksTUFBTSxJQUFJO0FBQUEsRUFDaEU7QUFFQSxTQUFPLEVBQUUsSUFBSSxLQUFLO0FBQ3BCOzs7QUNuRUEsU0FBUyxVQUFVLEdBQUc7QUFDcEIsTUFBSSxDQUFDLEVBQUcsUUFBTztBQUNmLE1BQUksTUFBTSxRQUFRLENBQUMsRUFBRyxRQUFPLEVBQUUsSUFBSSxNQUFNLEVBQUUsSUFBSSxPQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsT0FBTyxPQUFPO0FBQzFFLE1BQUksT0FBTyxNQUFNLFNBQVUsUUFBTyxFQUFFLE1BQU0sR0FBRyxFQUFFLElBQUksT0FBRyxFQUFFLEtBQUssQ0FBQyxFQUFFLE9BQU8sT0FBTztBQUM5RSxTQUFPO0FBQ1Q7QUFRQSxTQUFTLG1CQUFtQixHQUFHO0FBQzdCLE1BQUksQ0FBQyxFQUFHLFFBQU87QUFDZixNQUFJLE9BQU8sTUFBTSxTQUFVLFFBQU87QUFDbEMsTUFBSTtBQUFFLFdBQU8sS0FBSyxNQUFNLE9BQU8sQ0FBQyxDQUFDO0FBQUEsRUFBRyxRQUFRO0FBQUUsV0FBTztBQUFBLEVBQU07QUFDN0Q7QUFFTyxTQUFTLG1CQUFtQixRQUFRO0FBQ3pDLFFBQU0sWUFBWSxVQUFVLE9BQU8saUJBQWlCLEtBQUssVUFBVSxPQUFPLDBCQUEwQjtBQUNwRyxRQUFNLFNBQVMsbUJBQW1CLE9BQU8sY0FBYyxLQUFLLG1CQUFtQixPQUFPLHVCQUF1QjtBQUM3RyxTQUFPLEVBQUUsV0FBVyxPQUFPO0FBQzdCO0FBRU8sU0FBUyxjQUFjLEVBQUUsVUFBVSxPQUFPLE9BQU8sR0FBRztBQUN6RCxRQUFNLEVBQUUsV0FBVyxPQUFPLElBQUksbUJBQW1CLE1BQU07QUFFdkQsTUFBSSxhQUFhLFVBQVUsUUFBUTtBQUNqQyxRQUFJLENBQUMsVUFBVSxTQUFTLEdBQUcsS0FBSyxDQUFDLFVBQVUsU0FBUyxRQUFRLEdBQUc7QUFDN0QsYUFBTyxFQUFFLElBQUksT0FBTyxRQUFRLEtBQUssT0FBTyxzQ0FBc0MsUUFBUSxJQUFJO0FBQUEsSUFDNUY7QUFBQSxFQUNGO0FBRUEsTUFBSSxRQUFRO0FBRVYsUUFBSSxPQUFPLEdBQUcsR0FBRztBQUNmLFlBQU0sTUFBTSxVQUFVLE9BQU8sR0FBRyxDQUFDO0FBQ2pDLFVBQUksT0FBTyxJQUFJLFNBQVMsR0FBRyxFQUFHLFFBQU8sRUFBRSxJQUFJLEtBQUs7QUFBQSxJQUNsRDtBQUVBLFVBQU0sT0FBTyxPQUFPLFFBQVE7QUFDNUIsUUFBSSxNQUFNO0FBQ1IsWUFBTSxNQUFNLFVBQVUsSUFBSSxLQUFLLENBQUM7QUFDaEMsVUFBSSxJQUFJLFNBQVMsR0FBRyxFQUFHLFFBQU8sRUFBRSxJQUFJLEtBQUs7QUFDekMsVUFBSSxDQUFDLElBQUksU0FBUyxLQUFLLEdBQUc7QUFDeEIsZUFBTyxFQUFFLElBQUksT0FBTyxRQUFRLEtBQUssT0FBTyxtQ0FBbUMsUUFBUSxJQUFJLEtBQUssSUFBSTtBQUFBLE1BQ2xHO0FBQUEsSUFDRixPQUFPO0FBRUwsYUFBTyxFQUFFLElBQUksT0FBTyxRQUFRLEtBQUssT0FBTyw0Q0FBNEMsUUFBUSxJQUFJO0FBQUEsSUFDbEc7QUFBQSxFQUNGO0FBRUEsU0FBTyxFQUFFLElBQUksS0FBSztBQUNwQjs7O0FDaERPLElBQU0sZUFBZTtBQUVyQixJQUFNLG9CQUFvQixVQUFVLFlBQVk7QUFFaEQsU0FBUyxxQkFBcUIsVUFBVTtBQUM3QyxRQUFNLE9BQU8sTUFBTSxRQUFRLFFBQVEsSUFBSSxXQUFXLENBQUM7QUFDbkQsUUFBTSxVQUFVLEtBQ2IsT0FBTyxPQUFLLEtBQUssT0FBTyxNQUFNLFFBQVEsRUFDdEMsSUFBSSxRQUFNLEVBQUUsTUFBTSxPQUFPLEVBQUUsUUFBUSxFQUFFLEVBQUUsWUFBWSxHQUFHLFNBQVMsT0FBTyxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUUsRUFDekYsT0FBTyxPQUFLLEVBQUUsUUFBUSxFQUFFLFFBQVEsTUFBTTtBQUd6QyxRQUFNLGVBQWUsUUFBUSxPQUFPLE9BQUssRUFBRSxFQUFFLFNBQVMsWUFBWSxFQUFFLFFBQVEsU0FBUyx3Q0FBbUMsRUFBRTtBQUUxSCxRQUFNLFNBQVMsQ0FBQyxFQUFFLE1BQU0sVUFBVSxTQUFTLGFBQWEsQ0FBQztBQUN6RCxTQUFPLE9BQU8sT0FBTyxZQUFZO0FBQ25DOzs7QUNKQSxJQUFPLHlCQUFRLEtBQUssT0FBTyxRQUFRO0FBQ2pDLFFBQU0sT0FBTyxVQUFVLEdBQUc7QUFDMUIsTUFBSSxJQUFJLFdBQVcsVUFBVyxRQUFPLElBQUksU0FBUyxJQUFJLEVBQUUsUUFBUSxLQUFLLFNBQVMsS0FBSyxDQUFDO0FBQ3BGLE1BQUksSUFBSSxXQUFXLE9BQVEsUUFBTyxJQUFJLFNBQVMsS0FBSyxVQUFVLEVBQUUsT0FBTyxxQkFBcUIsQ0FBQyxHQUFHLEVBQUUsUUFBUSxLQUFLLFNBQVMsRUFBRSxHQUFHLE1BQU0sZ0JBQWdCLG1CQUFtQixFQUFFLENBQUM7QUFFekssUUFBTSxRQUFRLFVBQVUsR0FBRztBQUMzQixNQUFJLENBQUMsTUFBTyxRQUFPLElBQUksU0FBUyxLQUFLLFVBQVUsRUFBRSxPQUFPLDhDQUE4QyxDQUFDLEdBQUcsRUFBRSxRQUFRLEtBQUssU0FBUyxFQUFFLEdBQUcsTUFBTSxnQkFBZ0IsbUJBQW1CLEVBQUUsQ0FBQztBQUVuTCxNQUFJO0FBQ0osTUFBSTtBQUFFLFdBQU8sTUFBTSxJQUFJLEtBQUs7QUFBQSxFQUFHLFFBQVE7QUFBRSxXQUFPLFdBQVcsZ0JBQWdCLElBQUk7QUFBQSxFQUFHO0FBRWxGLFFBQU0sWUFBWSxLQUFLLFlBQVksSUFBSSxTQUFTLEVBQUUsS0FBSyxFQUFFLFlBQVk7QUFDckUsUUFBTSxTQUFTLEtBQUssU0FBUyxJQUFJLFNBQVMsRUFBRSxLQUFLO0FBQ2pELFFBQU0sY0FBYyxLQUFLO0FBQ3pCLFFBQU0sYUFBYSxPQUFPLFNBQVMsS0FBSyxVQUFVLElBQUksU0FBUyxLQUFLLFlBQVksRUFBRSxJQUFJO0FBQ3RGLFFBQU0sY0FBYyxPQUFPLFNBQVMsS0FBSyxXQUFXLElBQUksS0FBSyxjQUFjO0FBRTNFLE1BQUksQ0FBQyxTQUFVLFFBQU8sV0FBVyw4Q0FBOEMsSUFBSTtBQUNuRixNQUFJLENBQUMsTUFBTyxRQUFPLFdBQVcsaUJBQWlCLElBQUk7QUFDbkQsTUFBSSxDQUFDLE1BQU0sUUFBUSxXQUFXLEtBQUssWUFBWSxXQUFXLEVBQUcsUUFBTyxXQUFXLHNCQUFzQixJQUFJO0FBRXpHLFFBQU0sV0FBVyxxQkFBcUIsV0FBVztBQUdqRCxRQUFNLFNBQVMsTUFBTSxZQUFZLEtBQUs7QUFDdEMsTUFBSSxDQUFDLE9BQVEsUUFBTyxJQUFJLFNBQVMsS0FBSyxVQUFVLEVBQUUsT0FBTyx5QkFBeUIsQ0FBQyxHQUFHLEVBQUUsUUFBUSxLQUFLLFNBQVMsRUFBRSxHQUFHLE1BQU0sZ0JBQWdCLG1CQUFtQixFQUFFLENBQUM7QUFDL0osTUFBSSxDQUFDLE9BQU8sVUFBVyxRQUFPLElBQUksU0FBUyxLQUFLLFVBQVUsRUFBRSxPQUFPLG9CQUFvQixDQUFDLEdBQUcsRUFBRSxRQUFRLEtBQUssU0FBUyxFQUFFLEdBQUcsTUFBTSxnQkFBZ0IsbUJBQW1CLEVBQUUsQ0FBQztBQUVwSyxRQUFNLGFBQWEsYUFBYSxHQUFHO0FBQ25DLFFBQU0sS0FBSyxhQUFhLEdBQUc7QUFDM0IsUUFBTSxLQUFLLFlBQVksR0FBRztBQUMxQixRQUFNLFVBQVUsS0FBSyxjQUFjLFFBQVEsSUFBSSxjQUFjLFFBQVEsSUFBSSxjQUFjLFNBQVMsRUFBRSxJQUFJO0FBRXRHLFFBQU0sUUFBUSxjQUFjLEVBQUUsVUFBVSxPQUFPLE9BQU8sQ0FBQztBQUN2RCxNQUFJLENBQUMsTUFBTSxHQUFJLFFBQU8sSUFBSSxTQUFTLEtBQUssVUFBVSxFQUFFLE9BQU8sTUFBTSxNQUFNLENBQUMsR0FBRyxFQUFFLFFBQVEsTUFBTSxVQUFVLEtBQUssU0FBUyxFQUFFLEdBQUcsTUFBTSxnQkFBZ0IsbUJBQW1CLEVBQUUsQ0FBQztBQUVwSyxRQUFNLE1BQU0sTUFBTSxjQUFjLEVBQUUsUUFBUSxZQUFZLElBQUksT0FBTyxVQUFVLENBQUM7QUFDNUUsTUFBSSxDQUFDLElBQUksR0FBSSxRQUFPLElBQUksU0FBUyxLQUFLLFVBQVUsRUFBRSxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsRUFBRSxRQUFRLElBQUksVUFBVSxLQUFLLFNBQVMsRUFBRSxHQUFHLE1BQU0sZ0JBQWdCLG1CQUFtQixFQUFFLENBQUM7QUFJOUosUUFBTSxLQUFLLE1BQU0sV0FBVyxFQUFFLFlBQVksT0FBTyxhQUFhLFVBQVUsT0FBTyxZQUFZLGFBQWEsT0FBTyxVQUFVLENBQUM7QUFDMUgsTUFBSSxDQUFDLEdBQUcsR0FBSSxRQUFPLElBQUksU0FBUyxLQUFLLFVBQVUsRUFBRSxPQUFPLHNCQUFzQixDQUFDLEdBQUcsRUFBRSxRQUFRLEtBQUssU0FBUyxFQUFFLEdBQUcsTUFBTSxnQkFBZ0IsbUJBQW1CLEVBQUUsQ0FBQztBQUUzSixRQUFNLFFBQVEsWUFBWTtBQUMxQixRQUFNLFdBQVcsTUFBTSxlQUFlLE9BQU8sYUFBYSxLQUFLO0FBQy9ELFFBQU0sVUFBVSxNQUFNLGtCQUFrQixPQUFPLFlBQVksS0FBSztBQUNoRSxRQUFNLHFCQUFxQixpQkFBaUIsUUFBUSxRQUFRO0FBQzVELFFBQU0sZ0JBQWdCLFlBQVksUUFBUSxRQUFRO0FBRWxELE9BQUssU0FBUyxlQUFlLE1BQU0sb0JBQW9CO0FBQ3JELFdBQU8sSUFBSSxTQUFTLEtBQUssVUFBVTtBQUFBLE1BQ2pDLE9BQU87QUFBQSxNQUNQLE9BQU87QUFBQSxNQUNQLE9BQU87QUFBQSxRQUNMO0FBQUEsUUFDQSxXQUFXO0FBQUEsUUFDWCxhQUFhLFNBQVMsZUFBZTtBQUFBLFFBQ3JDO0FBQUEsUUFDQSxzQkFBc0IsU0FBUyxlQUFlO0FBQUEsUUFDOUM7QUFBQSxRQUNBLGlCQUFpQixRQUFRLGVBQWU7QUFBQSxNQUMxQztBQUFBLElBQ0YsQ0FBQyxHQUFHLEVBQUUsUUFBUSxLQUFLLFNBQVMsRUFBRSxHQUFHLE1BQU0sZ0JBQWdCLG1CQUFtQixFQUFFLENBQUM7QUFBQSxFQUMvRTtBQUVBLE9BQUssUUFBUSxlQUFlLE1BQU0sZUFBZTtBQUMvQyxXQUFPLElBQUksU0FBUyxLQUFLLFVBQVU7QUFBQSxNQUNqQyxPQUFPO0FBQUEsTUFDUCxPQUFPO0FBQUEsTUFDUCxPQUFPO0FBQUEsUUFDTDtBQUFBLFFBQ0EsV0FBVztBQUFBLFFBQ1gsYUFBYSxTQUFTLGVBQWU7QUFBQSxRQUNyQztBQUFBLFFBQ0Esc0JBQXNCLFNBQVMsZUFBZTtBQUFBLFFBQzlDO0FBQUEsUUFDQSxpQkFBaUIsUUFBUSxlQUFlO0FBQUEsTUFDMUM7QUFBQSxJQUNGLENBQUMsR0FBRyxFQUFFLFFBQVEsS0FBSyxTQUFTLEVBQUUsR0FBRyxNQUFNLGdCQUFnQixtQkFBbUIsRUFBRSxDQUFDO0FBQUEsRUFDL0U7QUFFQSxRQUFNLFVBQVUsSUFBSSxZQUFZO0FBQ2hDLFFBQU0sVUFBVSxJQUFJLFlBQVk7QUFFaEMsTUFBSSxTQUFTO0FBQ2IsTUFBSSxZQUFZLEVBQUUsY0FBYyxHQUFHLGVBQWUsRUFBRTtBQUNwRCxNQUFJLGVBQWUsR0FBRyxnQkFBZ0I7QUFFdEMsUUFBTSxTQUFTLElBQUksZUFBZTtBQUFBLElBQ2hDLE1BQU0sTUFBTSxZQUFZO0FBQ3RCLFlBQU0sT0FBTyxDQUFDLE9BQU8sWUFBWTtBQUMvQixtQkFBVyxRQUFRLFFBQVEsT0FBTyxVQUFVLEtBQUs7QUFBQSxDQUFJLENBQUM7QUFDdEQsbUJBQVcsUUFBUSxRQUFRLE9BQU8sU0FBUyxLQUFLLFVBQVUsT0FBTyxDQUFDO0FBQUE7QUFBQSxDQUFNLENBQUM7QUFBQSxNQUMzRTtBQUVBLFdBQUssUUFBUTtBQUFBLFFBQ1g7QUFBQSxRQUNBO0FBQUEsUUFDQSxXQUFXLEVBQUUsWUFBWSxjQUFjLEtBQUs7QUFBQSxRQUM1QyxPQUFPO0FBQUEsVUFDTDtBQUFBLFVBQ0EsV0FBVztBQUFBLFVBQ1gsYUFBYSxTQUFTLGVBQWU7QUFBQSxVQUNyQztBQUFBLFVBQ0Esc0JBQXNCLFNBQVMsZUFBZTtBQUFBLFVBQzlDO0FBQUEsVUFDQSxpQkFBaUIsUUFBUSxlQUFlO0FBQUEsUUFDMUM7QUFBQSxNQUNGLENBQUM7QUFHRCxZQUFNLE9BQU8sWUFBWSxNQUFNO0FBQzdCLFlBQUk7QUFDRixxQkFBVyxRQUFRLFFBQVEsT0FBTztBQUFBLENBQWUsQ0FBQztBQUNsRCxxQkFBVyxRQUFRLFFBQVEsT0FBTyxTQUFTLEtBQUssVUFBVSxFQUFFLEdBQUcsS0FBSyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQUE7QUFBQSxDQUFNLENBQUM7QUFBQSxRQUNyRixRQUFRO0FBQUEsUUFBQztBQUFBLE1BQ1gsR0FBRyxJQUFLO0FBR1IsVUFBSTtBQUNKLFVBQUk7QUFDRixZQUFJLGFBQWEsU0FBVSxXQUFVLE1BQU0sYUFBYSxFQUFFLE9BQU8sVUFBVSxZQUFZLFlBQVksQ0FBQztBQUFBLGlCQUMzRixhQUFhLFlBQWEsV0FBVSxNQUFNLGdCQUFnQixFQUFFLE9BQU8sVUFBVSxZQUFZLFlBQVksQ0FBQztBQUFBLGlCQUN0RyxhQUFhLFNBQVUsV0FBVSxNQUFNLGFBQWEsRUFBRSxPQUFPLFVBQVUsWUFBWSxZQUFZLENBQUM7QUFBQSxhQUNwRztBQUNILGVBQUssU0FBUyxFQUFFLE9BQU8saURBQWlELENBQUM7QUFDekUsd0JBQWMsSUFBSTtBQUM1QixxQkFBVyxNQUFNO0FBQ1A7QUFBQSxRQUNGO0FBQUEsTUFDRixTQUFTLEdBQUc7QUFDVixhQUFLLFNBQVMsRUFBRSxPQUFPLEdBQUcsV0FBVyxpQkFBaUIsQ0FBQztBQUN2RCxzQkFBYyxJQUFJO0FBQzFCLG1CQUFXLE1BQU07QUFDVDtBQUFBLE1BQ0Y7QUFHQSxVQUFJO0FBQ0YsY0FBTSxTQUFTLFFBQVEsU0FBUyxLQUFLLFVBQVU7QUFFL0MsZUFBTyxNQUFNO0FBQ1gsZ0JBQU0sRUFBRSxNQUFNLE1BQU0sSUFBSSxNQUFNLE9BQU8sS0FBSztBQUMxQyxjQUFJLEtBQU07QUFDVixnQkFBTSxRQUFRLFFBQVEsT0FBTyxPQUFPLEVBQUUsUUFBUSxLQUFLLENBQUM7QUFDcEQsb0JBQVU7QUFHVixnQkFBTSxRQUFRLE9BQU8sTUFBTSxPQUFPO0FBQ2xDLG1CQUFTLE1BQU0sSUFBSSxLQUFLO0FBRXhCLHFCQUFXLFFBQVEsT0FBTztBQUN4QixrQkFBTSxlQUFlLFFBQVEsTUFBTSxJQUFJO0FBQ3ZDLHVCQUFXLE1BQU0sY0FBYztBQUM3QixrQkFBSSxHQUFHLFNBQVMsV0FBVyxHQUFHLE1BQU07QUFDbEMscUJBQUssU0FBUyxFQUFFLE1BQU0sR0FBRyxLQUFLLENBQUM7QUFBQSxjQUNqQyxZQUFZLEdBQUcsU0FBUyxXQUFXLEdBQUcsU0FBUyxXQUFXLEdBQUcsT0FBTztBQUNsRSw0QkFBWSxHQUFHO0FBQUEsY0FDakI7QUFBQSxZQUNGO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFHQSx1QkFBZSxVQUFVLGdCQUFnQjtBQUN6Qyx3QkFBZ0IsVUFBVSxpQkFBaUI7QUFFM0MsY0FBTSxhQUFhLFVBQVUsVUFBVSxPQUFPLGNBQWMsYUFBYTtBQUV6RSxjQUFNO0FBQUEsVUFDSjtBQUFBO0FBQUEsVUFFQSxDQUFDLE9BQU8sYUFBYSxPQUFPLFlBQVksVUFBVSxPQUFPLGNBQWMsZUFBZSxZQUFZLFlBQVksU0FBUyxFQUFFO0FBQUEsUUFDM0g7QUFFQSxjQUFNO0FBQUEsVUFDSjtBQUFBO0FBQUE7QUFBQTtBQUFBLFVBSUEsQ0FBQyxZQUFZLE9BQU8sVUFBVTtBQUFBLFFBQ2hDO0FBRUEsY0FBTTtBQUFBLFVBQ0o7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFVBUUEsQ0FBQyxPQUFPLGFBQWEsT0FBTyxZQUFZLGNBQWMsYUFBYTtBQUFBLFFBQ3JFO0FBRUEsY0FBTTtBQUFBLFVBQ0o7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsVUFTQSxDQUFDLE9BQU8sWUFBWSxPQUFPLGFBQWEsT0FBTyxZQUFZLGNBQWMsZUFBZSxDQUFDO0FBQUEsUUFDM0Y7QUFFQSxjQUFNLGNBQWMsTUFBTSxlQUFlLE9BQU8sYUFBYSxLQUFLO0FBQ2xFLGNBQU0sYUFBYSxNQUFNLGtCQUFrQixPQUFPLFlBQVksS0FBSztBQUVuRSxjQUFNLDJCQUEyQixpQkFBaUIsUUFBUSxXQUFXO0FBQ3JFLGNBQU0sc0JBQXNCLFlBQVksUUFBUSxXQUFXO0FBRTNELGNBQU0sZUFBZTtBQUFBLFVBQ25CLGFBQWEsT0FBTztBQUFBLFVBQ3BCLFlBQVksT0FBTztBQUFBLFVBQ25CO0FBQUEsVUFDQSxvQkFBb0I7QUFBQSxVQUNwQixzQkFBc0IsWUFBWSxlQUFlO0FBQUEsVUFDakQsZUFBZTtBQUFBLFVBQ2YsaUJBQWlCLFdBQVcsZUFBZTtBQUFBLFFBQzdDLENBQUM7QUFFRCxhQUFLLFFBQVE7QUFBQSxVQUNYLE9BQU8sRUFBRSxjQUFjLGVBQWUsV0FBVztBQUFBLFVBQ2pELE9BQU87QUFBQSxZQUNMO0FBQUEsWUFDQSxXQUFXO0FBQUEsWUFDWCxhQUFhLFlBQVksZUFBZTtBQUFBLFlBQ3hDLG9CQUFvQjtBQUFBLFlBQ3BCLHNCQUFzQixZQUFZLGVBQWU7QUFBQSxZQUNqRCxlQUFlO0FBQUEsWUFDZixpQkFBaUIsV0FBVyxlQUFlO0FBQUEsVUFDN0M7QUFBQSxRQUNGLENBQUM7QUFDRCxzQkFBYyxJQUFJO0FBQ2xCLG1CQUFXLE1BQU07QUFBQSxNQUNuQixTQUFTLEtBQUs7QUFDWixzQkFBYyxJQUFJO0FBQ2xCLGNBQU0sVUFBVSxLQUFLLFdBQVc7QUFDaEMsbUJBQVcsUUFBUSxRQUFRLE9BQU87QUFBQSxDQUFnQixDQUFDO0FBQ25ELG1CQUFXLFFBQVEsUUFBUSxPQUFPLFNBQVMsS0FBSyxVQUFVLEVBQUUsT0FBTyxRQUFRLENBQUMsQ0FBQztBQUFBO0FBQUEsQ0FBTSxDQUFDO0FBQ3BGLHNCQUFjLElBQUk7QUFDbEIsbUJBQVcsTUFBTTtBQUFBLE1BQ25CO0FBQUEsSUFDRjtBQUFBLEVBQ0YsQ0FBQztBQUVELFNBQU8sSUFBSSxTQUFTLFFBQVE7QUFBQSxJQUMxQixRQUFRO0FBQUEsSUFDUixTQUFTO0FBQUEsTUFDUCxHQUFHO0FBQUEsTUFDSCxnQkFBZ0I7QUFBQSxNQUNoQixpQkFBaUI7QUFBQSxNQUNqQixjQUFjO0FBQUEsSUFDaEI7QUFBQSxFQUNGLENBQUM7QUFDSCxDQUFDOyIsCiAgIm5hbWVzIjogWyJyZXMiLCAiY29uZmlnRXJyb3IiLCAiY29uZmlnRXJyb3IiXQp9Cg==
