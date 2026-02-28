
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

// netlify/functions/_lib/netlifyTokens.js
async function getNetlifyTokenForCustomer(customer_id) {
  const res = await q(`select token_enc from customer_netlify_tokens where customer_id=$1`, [customer_id]);
  if (res.rows.length) {
    const dec = decryptSecret(res.rows[0].token_enc);
    if (dec) return dec;
  }
  return (process.env.NETLIFY_AUTH_TOKEN || "").trim() || null;
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
async function getDeploy({ deploy_id, netlify_token = null }) {
  const url = `${API}/deploys/${encodeURIComponent(deploy_id)}`;
  return nfFetch(url, { method: "GET" }, netlify_token);
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

// netlify/functions/_lib/pushCaps.js
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

// netlify/functions/push-complete-background.js
var push_complete_background_default = wrap(async (req) => {
  try {
    const secret = process.env.JOB_WORKER_SECRET;
    if (!secret) {
      try {
        await q(
          `insert into gateway_events(level, function_name, message, meta)
       values ('warn',$1,$2,'{}'::jsonb)`,
          ["push-complete-background", "JOB_WORKER_SECRET not set; background worker refused"]
        );
      } catch {
      }
      return new Response("", { status: 202 });
    }
    const got = req.headers.get("x-kaixu-job-secret") || req.headers.get("x-job-worker-secret") || "";
    if (got !== secret) return new Response("", { status: 202 });
    if (req.method !== "POST") return new Response("", { status: 202 });
    const key = getBearer(req);
    if (!key) return new Response("", { status: 202 });
    const krow = await lookupKey(key);
    if (!krow) return new Response("", { status: 202 });
    requireKeyRole(krow, "deployer");
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response("", { status: 202 });
    }
    const pushId = (body.pushId || "").toString();
    if (!pushId) return new Response("", { status: 202 });
    const pres = await q(
      `select id, customer_id, api_key_id, deploy_id, required_digests, uploaded_digests, state
       from push_pushes where push_id=$1 limit 1`,
      [pushId]
    );
    if (!pres.rowCount) return new Response("", { status: 202 });
    const push = pres.rows[0];
    if (push.customer_id !== krow.customer_id) return new Response("", { status: 202 });
    const required = push.required_digests || [];
    const uploaded = new Set(push.uploaded_digests || []);
    const missing = required.filter((d2) => !uploaded.has(d2));
    if (missing.length) {
      await q(
        `update push_pushes set state='missing_uploads', error=$2, updated_at=now() where id=$1`,
        [push.id, `Missing ${missing.length} required uploads`]
      );
      return new Response("", { status: 202 });
    }
    await q(`update push_pushes set state='finalizing', updated_at=now() where id=$1`, [push.id]);
    const netlify_token = await getNetlifyTokenForCustomer(krow.customer_id);
    let d = await getDeploy({ deploy_id: push.deploy_id, netlify_token });
    const start = Date.now();
    while (Date.now() - start < 6e5) {
      if (d?.state === "ready" || d?.state === "error") break;
      await sleep(2e3);
      d = await getDeploy({ deploy_id: push.deploy_id, netlify_token });
    }
    const state = d?.state || "unknown";
    const url = d?.ssl_url || d?.url || null;
    const err = state === "error" ? d?.error_message || "Netlify deploy error" : state === "ready" ? null : "Timed out waiting for deploy";
    await q(
      `update push_pushes set state=$2, url=$3, error=$4, updated_at=now() where id=$1`,
      [push.id, state, url, err]
    );
    const evType = state === "ready" ? "deploy_ready" : "deploy_error";
    const already = await q(
      `select id from push_usage_events where push_row_id=$1 and event_type=$2 limit 1`,
      [push.id, evType]
    );
    if (!already.rowCount) {
      const month = monthKeyUTC();
      const cfg = await getPushPricing(krow.customer_id);
      const pv = cfg?.pricing_version ?? 1;
      await q(
        `insert into push_usage_events(customer_id, api_key_id, push_row_id, event_type, bytes, pricing_version, cost_cents, meta)
         values ($1,$2,$3,$4,0,$6,0,$5::jsonb)`,
        [krow.customer_id, krow.api_key_id, push.id, evType, JSON.stringify({ url, error: err, month }), pv]
      );
    }
    await audit(`key:${krow.key_last4}`, "PUSH_COMPLETE_BG", `push:${pushId}`, { state, url, error: err });
    return new Response("", { status: 202 });
  } catch {
    return new Response("", { status: 202 });
  }
});
export {
  push_complete_background_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9odHRwLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvZGIuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9tb25pdG9yLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvd3JhcC5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2NyeXB0by5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2F1dGh6LmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvbmV0bGlmeVRva2Vucy5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL3B1c2hOZXRsaWZ5LmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvYXVkaXQuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9wdXNoQ2Fwcy5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9wdXNoLWNvbXBsZXRlLWJhY2tncm91bmQuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImV4cG9ydCBmdW5jdGlvbiBidWlsZENvcnMocmVxKSB7XG4gIGNvbnN0IGFsbG93UmF3ID0gKHByb2Nlc3MuZW52LkFMTE9XRURfT1JJR0lOUyB8fCBcIlwiKS50cmltKCk7XG4gIGNvbnN0IHJlcU9yaWdpbiA9IHJlcS5oZWFkZXJzLmdldChcIm9yaWdpblwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJPcmlnaW5cIik7XG5cbiAgLy8gSU1QT1JUQU5UOiBrZWVwIHRoaXMgbGlzdCBhbGlnbmVkIHdpdGggd2hhdGV2ZXIgaGVhZGVycyB5b3VyIGFwcHMgc2VuZC5cbiAgY29uc3QgYWxsb3dIZWFkZXJzID0gXCJhdXRob3JpemF0aW9uLCBjb250ZW50LXR5cGUsIHgta2FpeHUtaW5zdGFsbC1pZCwgeC1rYWl4dS1yZXF1ZXN0LWlkLCB4LWthaXh1LWFwcCwgeC1rYWl4dS1idWlsZCwgeC1hZG1pbi1wYXNzd29yZCwgeC1rYWl4dS1lcnJvci10b2tlbiwgeC1rYWl4dS1tb2RlLCB4LWNvbnRlbnQtc2hhMSwgeC1zZXR1cC1zZWNyZXQsIHgta2FpeHUtam9iLXNlY3JldCwgeC1qb2Itd29ya2VyLXNlY3JldFwiO1xuICBjb25zdCBhbGxvd01ldGhvZHMgPSBcIkdFVCxQT1NULFBVVCxQQVRDSCxERUxFVEUsT1BUSU9OU1wiO1xuXG4gIGNvbnN0IGJhc2UgPSB7XG4gICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1oZWFkZXJzXCI6IGFsbG93SGVhZGVycyxcbiAgICBcImFjY2Vzcy1jb250cm9sLWFsbG93LW1ldGhvZHNcIjogYWxsb3dNZXRob2RzLFxuICAgIFwiYWNjZXNzLWNvbnRyb2wtZXhwb3NlLWhlYWRlcnNcIjogXCJ4LWthaXh1LXJlcXVlc3QtaWRcIixcbiAgICBcImFjY2Vzcy1jb250cm9sLW1heC1hZ2VcIjogXCI4NjQwMFwiXG4gIH07XG5cbiAgLy8gU1RSSUNUIEJZIERFRkFVTFQ6XG4gIC8vIC0gSWYgQUxMT1dFRF9PUklHSU5TIGlzIHVuc2V0L2JsYW5rIGFuZCBhIGJyb3dzZXIgT3JpZ2luIGlzIHByZXNlbnQsIHdlIGRvIE5PVCBncmFudCBDT1JTLlxuICAvLyAtIEFsbG93LWFsbCBpcyBvbmx5IGVuYWJsZWQgd2hlbiBBTExPV0VEX09SSUdJTlMgZXhwbGljaXRseSBjb250YWlucyBcIipcIi5cbiAgaWYgKCFhbGxvd1Jhdykge1xuICAgIC8vIE5vIGFsbG93LW9yaWdpbiBncmFudGVkLiBTZXJ2ZXItdG8tc2VydmVyIHJlcXVlc3RzIChubyBPcmlnaW4gaGVhZGVyKSBzdGlsbCB3b3JrIG5vcm1hbGx5LlxuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlLFxuICAgICAgLi4uKHJlcU9yaWdpbiA/IHsgdmFyeTogXCJPcmlnaW5cIiB9IDoge30pXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IGFsbG93ZWQgPSBhbGxvd1Jhdy5zcGxpdChcIixcIikubWFwKChzKSA9PiBzLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xuXG4gIC8vIEV4cGxpY2l0IGFsbG93LWFsbFxuICBpZiAoYWxsb3dlZC5pbmNsdWRlcyhcIipcIikpIHtcbiAgICBjb25zdCBvcmlnaW4gPSByZXFPcmlnaW4gfHwgXCIqXCI7XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmJhc2UsXG4gICAgICBcImFjY2Vzcy1jb250cm9sLWFsbG93LW9yaWdpblwiOiBvcmlnaW4sXG4gICAgICAuLi4ocmVxT3JpZ2luID8geyB2YXJ5OiBcIk9yaWdpblwiIH0gOiB7fSlcbiAgICB9O1xuICB9XG5cbiAgLy8gRXhhY3QtbWF0Y2ggYWxsb3dsaXN0XG4gIGlmIChyZXFPcmlnaW4gJiYgYWxsb3dlZC5pbmNsdWRlcyhyZXFPcmlnaW4pKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmJhc2UsXG4gICAgICBcImFjY2Vzcy1jb250cm9sLWFsbG93LW9yaWdpblwiOiByZXFPcmlnaW4sXG4gICAgICB2YXJ5OiBcIk9yaWdpblwiXG4gICAgfTtcbiAgfVxuXG4gIC8vIE9yaWdpbiBwcmVzZW50IGJ1dCBub3QgYWxsb3dlZDogZG8gbm90IGdyYW50IGFsbG93LW9yaWdpbi5cbiAgcmV0dXJuIHtcbiAgICAuLi5iYXNlLFxuICAgIC4uLihyZXFPcmlnaW4gPyB7IHZhcnk6IFwiT3JpZ2luXCIgfSA6IHt9KVxuICB9O1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBqc29uKHN0YXR1cywgYm9keSwgaGVhZGVycyA9IHt9KSB7XG4gIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoYm9keSksIHtcbiAgICBzdGF0dXMsXG4gICAgaGVhZGVyczoge1xuICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PXV0Zi04XCIsXG4gICAgICAuLi5oZWFkZXJzXG4gICAgfVxuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRleHQoc3RhdHVzLCBib2R5LCBoZWFkZXJzID0ge30pIHtcbiAgcmV0dXJuIG5ldyBSZXNwb25zZShib2R5LCB7IHN0YXR1cywgaGVhZGVycyB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJhZFJlcXVlc3QobWVzc2FnZSwgaGVhZGVycyA9IHt9KSB7XG4gIHJldHVybiBqc29uKDQwMCwgeyBlcnJvcjogbWVzc2FnZSB9LCBoZWFkZXJzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEJlYXJlcihyZXEpIHtcbiAgY29uc3QgYXV0aCA9IHJlcS5oZWFkZXJzLmdldChcImF1dGhvcml6YXRpb25cIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiQXV0aG9yaXphdGlvblwiKSB8fCBcIlwiO1xuICBpZiAoIWF1dGguc3RhcnRzV2l0aChcIkJlYXJlciBcIikpIHJldHVybiBudWxsO1xuICByZXR1cm4gYXV0aC5zbGljZSg3KS50cmltKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtb250aEtleVVUQyhkID0gbmV3IERhdGUoKSkge1xuICByZXR1cm4gZC50b0lTT1N0cmluZygpLnNsaWNlKDAsIDcpOyAvLyBZWVlZLU1NXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbnN0YWxsSWQocmVxKSB7XG4gIHJldHVybiAoXG4gICAgcmVxLmhlYWRlcnMuZ2V0KFwieC1rYWl4dS1pbnN0YWxsLWlkXCIpIHx8XG4gICAgcmVxLmhlYWRlcnMuZ2V0KFwiWC1LYWl4dS1JbnN0YWxsLUlkXCIpIHx8XG4gICAgXCJcIlxuICApLnRvU3RyaW5nKCkudHJpbSgpLnNsaWNlKDAsIDgwKSB8fCBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VXNlckFnZW50KHJlcSkge1xuICByZXR1cm4gKHJlcS5oZWFkZXJzLmdldChcInVzZXItYWdlbnRcIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiVXNlci1BZ2VudFwiKSB8fCBcIlwiKS50b1N0cmluZygpLnNsaWNlKDAsIDI0MCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDbGllbnRJcChyZXEpIHtcbiAgLy8gTmV0bGlmeSBhZGRzIHgtbmYtY2xpZW50LWNvbm5lY3Rpb24taXAgd2hlbiBkZXBsb3llZCAobWF5IGJlIG1pc3NpbmcgaW4gbmV0bGlmeSBkZXYpLlxuICBjb25zdCBhID0gKHJlcS5oZWFkZXJzLmdldChcIngtbmYtY2xpZW50LWNvbm5lY3Rpb24taXBcIikgfHwgXCJcIikudG9TdHJpbmcoKS50cmltKCk7XG4gIGlmIChhKSByZXR1cm4gYTtcblxuICAvLyBGYWxsYmFjayB0byBmaXJzdCBYLUZvcndhcmRlZC1Gb3IgZW50cnkuXG4gIGNvbnN0IHhmZiA9IChyZXEuaGVhZGVycy5nZXQoXCJ4LWZvcndhcmRlZC1mb3JcIikgfHwgXCJcIikudG9TdHJpbmcoKTtcbiAgaWYgKCF4ZmYpIHJldHVybiBudWxsO1xuICBjb25zdCBmaXJzdCA9IHhmZi5zcGxpdChcIixcIilbMF0udHJpbSgpO1xuICByZXR1cm4gZmlyc3QgfHwgbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNsZWVwKG1zKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocikgPT4gc2V0VGltZW91dChyLCBtcykpO1xufSIsICJpbXBvcnQgeyBuZW9uIH0gZnJvbSBcIkBuZXRsaWZ5L25lb25cIjtcblxuLyoqXG4gKiBOZXRsaWZ5IERCIChOZW9uIFBvc3RncmVzKSBoZWxwZXIuXG4gKlxuICogSU1QT1JUQU5UIChOZW9uIHNlcnZlcmxlc3MgZHJpdmVyLCAyMDI1Kyk6XG4gKiAtIGBuZW9uKClgIHJldHVybnMgYSB0YWdnZWQtdGVtcGxhdGUgcXVlcnkgZnVuY3Rpb24uXG4gKiAtIEZvciBkeW5hbWljIFNRTCBzdHJpbmdzICsgJDEgcGxhY2Vob2xkZXJzLCB1c2UgYHNxbC5xdWVyeSh0ZXh0LCBwYXJhbXMpYC5cbiAqICAgKENhbGxpbmcgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uIGxpa2Ugc3FsKFwiU0VMRUNUIC4uLlwiKSBjYW4gYnJlYWsgb24gbmV3ZXIgZHJpdmVyIHZlcnNpb25zLilcbiAqXG4gKiBOZXRsaWZ5IERCIGF1dG9tYXRpY2FsbHkgaW5qZWN0cyBgTkVUTElGWV9EQVRBQkFTRV9VUkxgIHdoZW4gdGhlIE5lb24gZXh0ZW5zaW9uIGlzIGF0dGFjaGVkLlxuICovXG5cbmxldCBfc3FsID0gbnVsbDtcbmxldCBfc2NoZW1hUHJvbWlzZSA9IG51bGw7XG5cbmZ1bmN0aW9uIGdldFNxbCgpIHtcbiAgaWYgKF9zcWwpIHJldHVybiBfc3FsO1xuXG4gIGNvbnN0IGhhc0RiVXJsID0gISEocHJvY2Vzcy5lbnYuTkVUTElGWV9EQVRBQkFTRV9VUkwgfHwgcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMKTtcbiAgaWYgKCFoYXNEYlVybCkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcIkRhdGFiYXNlIG5vdCBjb25maWd1cmVkIChtaXNzaW5nIE5FVExJRllfREFUQUJBU0VfVVJMKS4gQXR0YWNoIE5ldGxpZnkgREIgKE5lb24pIHRvIHRoaXMgc2l0ZS5cIik7XG4gICAgZXJyLmNvZGUgPSBcIkRCX05PVF9DT05GSUdVUkVEXCI7XG4gICAgZXJyLnN0YXR1cyA9IDUwMDtcbiAgICBlcnIuaGludCA9IFwiTmV0bGlmeSBVSSBcdTIxOTIgRXh0ZW5zaW9ucyBcdTIxOTIgTmVvbiBcdTIxOTIgQWRkIGRhdGFiYXNlIChvciBydW46IG5weCBuZXRsaWZ5IGRiIGluaXQpLlwiO1xuICAgIHRocm93IGVycjtcbiAgfVxuXG4gIF9zcWwgPSBuZW9uKCk7IC8vIGF1dG8tdXNlcyBwcm9jZXNzLmVudi5ORVRMSUZZX0RBVEFCQVNFX1VSTCBvbiBOZXRsaWZ5XG4gIHJldHVybiBfc3FsO1xufVxuXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVTY2hlbWEoKSB7XG4gIGlmIChfc2NoZW1hUHJvbWlzZSkgcmV0dXJuIF9zY2hlbWFQcm9taXNlO1xuXG4gIF9zY2hlbWFQcm9taXNlID0gKGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBzcWwgPSBnZXRTcWwoKTtcbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gW1xuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVycyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgZW1haWwgdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIHBsYW5fbmFtZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3N0YXJ0ZXInLFxuICAgICAgICBtb250aGx5X2NhcF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMjAwMCxcbiAgICAgICAgaXNfYWN0aXZlIGJvb2xlYW4gbm90IG51bGwgZGVmYXVsdCB0cnVlLFxuICAgICAgICBzdHJpcGVfY3VzdG9tZXJfaWQgdGV4dCxcbiAgICAgICAgc3RyaXBlX3N1YnNjcmlwdGlvbl9pZCB0ZXh0LFxuICAgICAgICBzdHJpcGVfc3RhdHVzIHRleHQsXG4gICAgICAgIHN0cmlwZV9jdXJyZW50X3BlcmlvZF9lbmQgdGltZXN0YW1wdHosXG4gICAgICAgIGF1dG9fdG9wdXBfZW5hYmxlZCBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgZmFsc2UsXG4gICAgICAgIGF1dG9fdG9wdXBfYW1vdW50X2NlbnRzIGludGVnZXIsXG4gICAgICAgIGF1dG9fdG9wdXBfdGhyZXNob2xkX2NlbnRzIGludGVnZXIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGFwaV9rZXlzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBrZXlfaGFzaCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAga2V5X2xhc3Q0IHRleHQgbm90IG51bGwsXG4gICAgICAgIGxhYmVsIHRleHQsXG4gICAgICAgIG1vbnRobHlfY2FwX2NlbnRzIGludGVnZXIsXG4gICAgICAgIHJwbV9saW1pdCBpbnRlZ2VyLFxuICAgICAgICBycGRfbGltaXQgaW50ZWdlcixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICByZXZva2VkX2F0IHRpbWVzdGFtcHR6XG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXBpX2tleXNfY3VzdG9tZXJfaWRfaWR4IG9uIGFwaV9rZXlzKGN1c3RvbWVyX2lkKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIG1vbnRobHlfdXNhZ2UgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzcGVudF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgZXh0cmFfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIG1vbnRobHlfa2V5X3VzYWdlIChcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHNwZW50X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNhbGxzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChhcGlfa2V5X2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBtb250aGx5X2tleV91c2FnZV9jdXN0b21lcl9tb250aF9pZHggb24gbW9udGhseV9rZXlfdXNhZ2UoY3VzdG9tZXJfaWQsIG1vbnRoKTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIG1vbnRobHlfa2V5X3VzYWdlIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBjYWxscyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMDtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHVzYWdlX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1vZGVsIHRleHQgbm90IG51bGwsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzX2N1c3RvbWVyX21vbnRoX2lkeCBvbiB1c2FnZV9ldmVudHMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHNfa2V5X2lkeCBvbiB1c2FnZV9ldmVudHMoYXBpX2tleV9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGF1ZGl0X2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgYWN0b3IgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYWN0aW9uIHRleHQgbm90IG51bGwsXG4gICAgICAgIHRhcmdldCB0ZXh0LFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGF1ZGl0X2V2ZW50c19jcmVhdGVkX2lkeCBvbiBhdWRpdF9ldmVudHMoY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHJhdGVfbGltaXRfd2luZG93cyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB3aW5kb3dfc3RhcnQgdGltZXN0YW1wdHogbm90IG51bGwsXG4gICAgICAgIGNvdW50IGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIHdpbmRvd19zdGFydClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyByYXRlX2xpbWl0X3dpbmRvd3Nfd2luZG93X2lkeCBvbiByYXRlX2xpbWl0X3dpbmRvd3Mod2luZG93X3N0YXJ0IGRlc2MpO2AsICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X3NlZW5fYXQgdGltZXN0YW1wdHo7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9zZWVuX2luc3RhbGxfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHVzYWdlX2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgaW5zdGFsbF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgdXNhZ2VfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBpcF9oYXNoIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSB1c2FnZV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVhIHRleHQ7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHNfaW5zdGFsbF9pZHggb24gdXNhZ2VfZXZlbnRzKGluc3RhbGxfaWQpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgYWxlcnRzX3NlbnQgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYWxlcnRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgbW9udGgsIGFsZXJ0X3R5cGUpXG4gICAgICApO2AsXG4gICAgXG4gICAgICAvLyAtLS0gRGV2aWNlIGJpbmRpbmcgLyBzZWF0cyAtLS1cbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1heF9kZXZpY2VzX3Blcl9rZXkgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVxdWlyZV9pbnN0YWxsX2lkIGJvb2xlYW4gbm90IG51bGwgZGVmYXVsdCBmYWxzZTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9wcm92aWRlcnMgdGV4dFtdO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhbGxvd2VkX21vZGVscyBqc29uYjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgc3RyaXBlX2N1cnJlbnRfcGVyaW9kX2VuZCB0aW1lc3RhbXB0ejtgLFxuXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1heF9kZXZpY2VzIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVxdWlyZV9pbnN0YWxsX2lkIGJvb2xlYW47YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9wcm92aWRlcnMgdGV4dFtdO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfbW9kZWxzIGpzb25iO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBrZXlfZGV2aWNlcyAoXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBpbnN0YWxsX2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIGRldmljZV9sYWJlbCB0ZXh0LFxuICAgICAgICBmaXJzdF9zZWVuX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIGxhc3Rfc2Vlbl9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgbGFzdF9zZWVuX3VhIHRleHQsXG4gICAgICAgIHJldm9rZWRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIHJldm9rZWRfYnkgdGV4dCxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGFwaV9rZXlfaWQsIGluc3RhbGxfaWQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMga2V5X2RldmljZXNfY3VzdG9tZXJfaWR4IG9uIGtleV9kZXZpY2VzKGN1c3RvbWVyX2lkKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGtleV9kZXZpY2VzX2xhc3Rfc2Vlbl9pZHggb24ga2V5X2RldmljZXMobGFzdF9zZWVuX2F0IGRlc2MpO2AsXG5cbiAgICAgIC8vIC0tLSBJbnZvaWNlIHNuYXBzaG90cyArIHRvcHVwcyAtLS1cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBtb250aGx5X2ludm9pY2VzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc25hcHNob3QganNvbmIgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHRvcHVwX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYW1vdW50X2NlbnRzIGludGVnZXIgbm90IG51bGwsXG4gICAgICAgIHNvdXJjZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ21hbnVhbCcsXG4gICAgICAgIHN0cmlwZV9zZXNzaW9uX2lkIHRleHQsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2FwcGxpZWQnLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB0b3B1cF9ldmVudHNfY3VzdG9tZXJfbW9udGhfaWR4IG9uIHRvcHVwX2V2ZW50cyhjdXN0b21lcl9pZCwgbW9udGgpO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhc3luY19qb2JzIChcbiAgICAgICAgaWQgdXVpZCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1vZGVsIHRleHQgbm90IG51bGwsXG4gICAgICAgIHJlcXVlc3QganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAncXVldWVkJyxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBzdGFydGVkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBjb21wbGV0ZWRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGhlYXJ0YmVhdF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgb3V0cHV0X3RleHQgdGV4dCxcbiAgICAgICAgZXJyb3IgdGV4dCxcbiAgICAgICAgaW5wdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmJcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhc3luY19qb2JzX2N1c3RvbWVyX2NyZWF0ZWRfaWR4IG9uIGFzeW5jX2pvYnMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhc3luY19qb2JzX3N0YXR1c19pZHggb24gYXN5bmNfam9icyhzdGF0dXMsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICBcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgcmVxdWVzdF9pZCB0ZXh0LFxuICAgICAgICBsZXZlbCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luZm8nLFxuICAgICAgICBraW5kIHRleHQgbm90IG51bGwsXG4gICAgICAgIGZ1bmN0aW9uX25hbWUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbWV0aG9kIHRleHQsXG4gICAgICAgIHBhdGggdGV4dCxcbiAgICAgICAgb3JpZ2luIHRleHQsXG4gICAgICAgIHJlZmVyZXIgdGV4dCxcbiAgICAgICAgdXNlcl9hZ2VudCB0ZXh0LFxuICAgICAgICBpcCB0ZXh0LFxuICAgICAgICBhcHBfaWQgdGV4dCxcbiAgICAgICAgYnVpbGRfaWQgdGV4dCxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50LFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCxcbiAgICAgICAgbW9kZWwgdGV4dCxcbiAgICAgICAgaHR0cF9zdGF0dXMgaW50ZWdlcixcbiAgICAgICAgZHVyYXRpb25fbXMgaW50ZWdlcixcbiAgICAgICAgZXJyb3JfY29kZSB0ZXh0LFxuICAgICAgICBlcnJvcl9tZXNzYWdlIHRleHQsXG4gICAgICAgIGVycm9yX3N0YWNrIHRleHQsXG4gICAgICAgIHVwc3RyZWFtX3N0YXR1cyBpbnRlZ2VyLFxuICAgICAgICB1cHN0cmVhbV9ib2R5IHRleHQsXG4gICAgICAgIGV4dHJhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuXG4gICAgICAvLyBGb3J3YXJkLWNvbXBhdGlibGUgcGF0Y2hpbmc6IGlmIGdhdGV3YXlfZXZlbnRzIGV4aXN0ZWQgZnJvbSBhbiBvbGRlciBidWlsZCxcbiAgICAgIC8vIGl0IG1heSBiZSBtaXNzaW5nIGNvbHVtbnMgdXNlZCBieSBtb25pdG9yIGluc2VydHMuXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlcXVlc3RfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsZXZlbCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luZm8nO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGtpbmQgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdldmVudCc7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZnVuY3Rpb25fbmFtZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3Vua25vd24nO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1ldGhvZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHBhdGggdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBvcmlnaW4gdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByZWZlcmVyIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdXNlcl9hZ2VudCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGlwIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYXBwX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYnVpbGRfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBjdXN0b21lcl9pZCBiaWdpbnQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYXBpX2tleV9pZCBiaWdpbnQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcHJvdmlkZXIgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtb2RlbCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGh0dHBfc3RhdHVzIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZHVyYXRpb25fbXMgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBlcnJvcl9jb2RlIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZXJyb3JfbWVzc2FnZSB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGVycm9yX3N0YWNrIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdXBzdHJlYW1fc3RhdHVzIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdXBzdHJlYW1fYm9keSB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGV4dHJhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpO2AsXG5cbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19jcmVhdGVkX2lkeCBvbiBnYXRld2F5X2V2ZW50cyhjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfcmVxdWVzdF9pZHggb24gZ2F0ZXdheV9ldmVudHMocmVxdWVzdF9pZCk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19sZXZlbF9pZHggb24gZ2F0ZXdheV9ldmVudHMobGV2ZWwsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19mbl9pZHggb24gZ2F0ZXdheV9ldmVudHMoZnVuY3Rpb25fbmFtZSwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX2FwcF9pZHggb24gZ2F0ZXdheV9ldmVudHMoYXBwX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG5cbiAgICAgIC8vIC0tLSBLYWl4dVB1c2ggKERlcGxveSBQdXNoKSBlbnRlcnByaXNlIHRhYmxlcyAtLS1cbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcm9sZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2RlcGxveWVyJztgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFwaV9rZXlzX3JvbGVfaWR4IG9uIGFwaV9rZXlzKHJvbGUpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfbmV0bGlmeV90b2tlbnMgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgcHJpbWFyeSBrZXkgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB0b2tlbl9lbmMgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3Byb2plY3RzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm9qZWN0X2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIG5hbWUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbmV0bGlmeV9zaXRlX2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1bmlxdWUgKGN1c3RvbWVyX2lkLCBwcm9qZWN0X2lkKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfcHJvamVjdHNfY3VzdG9tZXJfaWR4IG9uIHB1c2hfcHJvamVjdHMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3B1c2hlcyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb2plY3Rfcm93X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHJvamVjdHMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwdXNoX2lkIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBicmFuY2ggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgdGl0bGUgdGV4dCxcbiAgICAgICAgZGVwbG95X2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIHN0YXRlIHRleHQgbm90IG51bGwsXG4gICAgICAgIHJlcXVpcmVkX2RpZ2VzdHMgdGV4dFtdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6dGV4dFtdLFxuICAgICAgICB1cGxvYWRlZF9kaWdlc3RzIHRleHRbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OnRleHRbXSxcbiAgICAgICAgZmlsZV9tYW5pZmVzdCBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICB1cmwgdGV4dCxcbiAgICAgICAgZXJyb3IgdGV4dCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX3B1c2hlcyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZmlsZV9tYW5pZmVzdCBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9wdXNoZXNfY3VzdG9tZXJfaWR4IG9uIHB1c2hfcHVzaGVzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9qb2JzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBwdXNoX3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3B1c2hlcyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHNoYTEgY2hhcig0MCkgbm90IG51bGwsXG4gICAgICAgIGRlcGxveV9wYXRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHBhcnRzIGludGVnZXIgbm90IG51bGwsXG4gICAgICAgIHJlY2VpdmVkX3BhcnRzIGludGVnZXJbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OmludFtdLFxuICAgICAgICBwYXJ0X2J5dGVzIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGJ5dGVzX3N0YWdlZCBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd1cGxvYWRpbmcnLFxuICAgICAgICBlcnJvciB0ZXh0LFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdW5pcXVlIChwdXNoX3Jvd19pZCwgc2hhMSlcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX2pvYnNfcHVzaF9pZHggb24gcHVzaF9qb2JzKHB1c2hfcm93X2lkLCB1cGRhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBieXRlc19zdGFnZWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcGFydF9ieXRlcyBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhdHRlbXB0cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbmV4dF9hdHRlbXB0X2F0IHRpbWVzdGFtcHR6O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X2Vycm9yIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxhc3RfZXJyb3JfYXQgdGltZXN0YW1wdHo7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfcmF0ZV93aW5kb3dzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYnVja2V0X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYnVja2V0X3N0YXJ0IHRpbWVzdGFtcHR6IG5vdCBudWxsLFxuICAgICAgICBjb3VudCBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcHJpbWFyeSBrZXkoY3VzdG9tZXJfaWQsIGJ1Y2tldF90eXBlLCBidWNrZXRfc3RhcnQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9yYXRlX3dpbmRvd3NfYnVja2V0X2lkeCBvbiBwdXNoX3JhdGVfd2luZG93cyhidWNrZXRfdHlwZSwgYnVja2V0X3N0YXJ0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9maWxlcyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgcHVzaF9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wdXNoZXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBkZXBsb3lfcGF0aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzaGExIGNoYXIoNDApIG5vdCBudWxsLFxuICAgICAgICBieXRlcyBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtb2RlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZGlyZWN0JyxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9maWxlc19wdXNoX2lkeCBvbiBwdXNoX2ZpbGVzKHB1c2hfcm93X2lkKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfdXNhZ2VfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHVzaF9yb3dfaWQgYmlnaW50IHJlZmVyZW5jZXMgcHVzaF9wdXNoZXMoaWQpIG9uIGRlbGV0ZSBzZXQgbnVsbCxcbiAgICAgICAgZXZlbnRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBieXRlcyBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwcmljaW5nX3ZlcnNpb24gaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDEsXG4gICAgICAgIGNvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF91c2FnZV9jdXN0b21lcl9pZHggb24gcHVzaF91c2FnZV9ldmVudHMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3ByaWNpbmdfdmVyc2lvbnMgKFxuICAgICAgICB2ZXJzaW9uIGludGVnZXIgcHJpbWFyeSBrZXksXG4gICAgICAgIGVmZmVjdGl2ZV9mcm9tIGRhdGUgbm90IG51bGwgZGVmYXVsdCBjdXJyZW50X2RhdGUsXG4gICAgICAgIGN1cnJlbmN5IHRleHQgbm90IG51bGwgZGVmYXVsdCAnVVNEJyxcbiAgICAgICAgYmFzZV9tb250aF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcGVyX2RlcGxveV9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcGVyX2diX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBpbnNlcnQgaW50byBwdXNoX3ByaWNpbmdfdmVyc2lvbnModmVyc2lvbiwgYmFzZV9tb250aF9jZW50cywgcGVyX2RlcGxveV9jZW50cywgcGVyX2diX2NlbnRzKVxuICAgICAgIHZhbHVlcyAoMSwgMCwgMTAsIDI1KSBvbiBjb25mbGljdCAodmVyc2lvbikgZG8gbm90aGluZztgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVyX3B1c2hfYmlsbGluZyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBwcmltYXJ5IGtleSByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByaWNpbmdfdmVyc2lvbiBpbnRlZ2VyIG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wcmljaW5nX3ZlcnNpb25zKHZlcnNpb24pLFxuICAgICAgICBtb250aGx5X2NhcF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX2ludm9pY2VzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcHJpY2luZ192ZXJzaW9uIGludGVnZXIgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3ByaWNpbmdfdmVyc2lvbnModmVyc2lvbiksXG4gICAgICAgIHRvdGFsX2NlbnRzIGludGVnZXIgbm90IG51bGwsXG4gICAgICAgIGJyZWFrZG93biBqc29uYiBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICApO2AsXG5cbiAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgLy8gR2l0SHViIFB1c2ggR2F0ZXdheSAob3B0aW9uYWwpXG4gICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcl9naXRodWJfdG9rZW5zIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IHByaW1hcnkga2V5IHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgdG9rZW5fZW5jIHRleHQgbm90IG51bGwsXG4gICAgICAgIHRva2VuX3R5cGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdvYXV0aCcsXG4gICAgICAgIHNjb3BlcyB0ZXh0W10gbm90IG51bGwgZGVmYXVsdCAne30nOjp0ZXh0W10sXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9qb2JzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgam9iX2lkIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBvd25lciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICByZXBvIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJyYW5jaCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ21haW4nLFxuICAgICAgICBjb21taXRfbWVzc2FnZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ0thaXh1IEdpdEh1YiBQdXNoJyxcbiAgICAgICAgcGFydHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHJlY2VpdmVkX3BhcnRzIGludGVnZXJbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OmludFtdLFxuICAgICAgICBwYXJ0X2J5dGVzIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGJ5dGVzX3N0YWdlZCBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd1cGxvYWRpbmcnLFxuICAgICAgICBhdHRlbXB0cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbmV4dF9hdHRlbXB0X2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBsYXN0X2Vycm9yIHRleHQsXG4gICAgICAgIGxhc3RfZXJyb3JfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIHJlc3VsdF9jb21taXRfc2hhIHRleHQsXG4gICAgICAgIHJlc3VsdF91cmwgdGV4dCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnaF9wdXNoX2pvYnNfY3VzdG9tZXJfaWR4IG9uIGdoX3B1c2hfam9icyhjdXN0b21lcl9pZCwgdXBkYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdoX3B1c2hfam9ic19uZXh0X2F0dGVtcHRfaWR4IG9uIGdoX3B1c2hfam9icyhuZXh0X2F0dGVtcHRfYXQpIHdoZXJlIHN0YXR1cyBpbiAoJ3JldHJ5X3dhaXQnLCdlcnJvcl90cmFuc2llbnQnKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGdoX3B1c2hfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgam9iX3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBnaF9wdXNoX2pvYnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBldmVudF90eXBlIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJ5dGVzIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9ldmVudHNfam9iX2lkeCBvbiBnaF9wdXNoX2V2ZW50cyhqb2Jfcm93X2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG5cblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX251bWJlcnMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHBob25lX251bWJlciB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd0d2lsaW8nLFxuICAgICAgICB0d2lsaW9fc2lkIHRleHQsXG4gICAgICAgIGlzX2FjdGl2ZSBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgdHJ1ZSxcbiAgICAgICAgZGVmYXVsdF9sbG1fcHJvdmlkZXIgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdvcGVuYWknLFxuICAgICAgICBkZWZhdWx0X2xsbV9tb2RlbCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2dwdC00LjEtbWluaScsXG4gICAgICAgIHZvaWNlX25hbWUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdhbGxveScsXG4gICAgICAgIGxvY2FsZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2VuLVVTJyxcbiAgICAgICAgdGltZXpvbmUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdBbWVyaWNhL1Bob2VuaXgnLFxuICAgICAgICBwbGF5Ym9vayBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9udW1iZXJzX2N1c3RvbWVyX2lkeCBvbiB2b2ljZV9udW1iZXJzKGN1c3RvbWVyX2lkKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHZvaWNlX251bWJlcl9pZCBiaWdpbnQgcmVmZXJlbmNlcyB2b2ljZV9udW1iZXJzKGlkKSBvbiBkZWxldGUgc2V0IG51bGwsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwgZGVmYXVsdCAndHdpbGlvJyxcbiAgICAgICAgcHJvdmlkZXJfY2FsbF9zaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgZnJvbV9udW1iZXIgdGV4dCxcbiAgICAgICAgdG9fbnVtYmVyIHRleHQsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luaXRpYXRlZCcsXG4gICAgICAgIGRpcmVjdGlvbiB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luYm91bmQnLFxuICAgICAgICBzdGFydGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIGVuZGVkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBkdXJhdGlvbl9zZWNvbmRzIGludGVnZXIsXG4gICAgICAgIGVzdF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBiaWxsX2Nvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYlxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB1bmlxdWUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsc19wcm92aWRlcl9zaWRfdXEgb24gdm9pY2VfY2FsbHMocHJvdmlkZXIsIHByb3ZpZGVyX2NhbGxfc2lkKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxzX2N1c3RvbWVyX2lkeCBvbiB2b2ljZV9jYWxscyhjdXN0b21lcl9pZCwgc3RhcnRlZF9hdCBkZXNjKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbF9tZXNzYWdlcyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY2FsbF9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyB2b2ljZV9jYWxscyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHJvbGUgdGV4dCBub3QgbnVsbCwgLS0gdXNlcnxhc3Npc3RhbnR8c3lzdGVtfHRvb2xcbiAgICAgICAgY29udGVudCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsX21lc3NhZ2VzX2NhbGxfaWR4IG9uIHZvaWNlX2NhbGxfbWVzc2FnZXMoY2FsbF9pZCwgaWQpO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB2b2ljZV91c2FnZV9tb250aGx5IChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtaW51dGVzIG51bWVyaWMgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBlc3RfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgYmlsbF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjYWxscyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1bmlxdWUoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX3VzYWdlX21vbnRobHlfY3VzdG9tZXJfaWR4IG9uIHZvaWNlX3VzYWdlX21vbnRobHkoY3VzdG9tZXJfaWQsIG1vbnRoKTtgLFxuXG5dO1xuXG4gICAgZm9yIChjb25zdCBzIG9mIHN0YXRlbWVudHMpIHtcbiAgICAgIGF3YWl0IHNxbC5xdWVyeShzKTtcbiAgICB9XG4gIH0pKCk7XG5cbiAgcmV0dXJuIF9zY2hlbWFQcm9taXNlO1xufVxuXG4vKipcbiAqIFF1ZXJ5IGhlbHBlciBjb21wYXRpYmxlIHdpdGggdGhlIHByZXZpb3VzIGBwZ2AtaXNoIGludGVyZmFjZTpcbiAqIC0gcmV0dXJucyB7IHJvd3MsIHJvd0NvdW50IH1cbiAqIC0gc3VwcG9ydHMgJDEsICQyIHBsYWNlaG9sZGVycyArIHBhcmFtcyBhcnJheSB2aWEgc3FsLnF1ZXJ5KC4uLilcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHEodGV4dCwgcGFyYW1zID0gW10pIHtcbiAgYXdhaXQgZW5zdXJlU2NoZW1hKCk7XG4gIGNvbnN0IHNxbCA9IGdldFNxbCgpO1xuICBjb25zdCByb3dzID0gYXdhaXQgc3FsLnF1ZXJ5KHRleHQsIHBhcmFtcyk7XG4gIHJldHVybiB7IHJvd3M6IHJvd3MgfHwgW10sIHJvd0NvdW50OiBBcnJheS5pc0FycmF5KHJvd3MpID8gcm93cy5sZW5ndGggOiAwIH07XG59IiwgImltcG9ydCB7IHEgfSBmcm9tIFwiLi9kYi5qc1wiO1xuXG5mdW5jdGlvbiBzYWZlU3RyKHYsIG1heCA9IDgwMDApIHtcbiAgaWYgKHYgPT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHMgPSBTdHJpbmcodik7XG4gIGlmIChzLmxlbmd0aCA8PSBtYXgpIHJldHVybiBzO1xuICByZXR1cm4gcy5zbGljZSgwLCBtYXgpICsgYFx1MjAyNigrJHtzLmxlbmd0aCAtIG1heH0gY2hhcnMpYDtcbn1cblxuZnVuY3Rpb24gcmFuZG9tSWQoKSB7XG4gIHRyeSB7XG4gICAgaWYgKGdsb2JhbFRoaXMuY3J5cHRvPy5yYW5kb21VVUlEKSByZXR1cm4gZ2xvYmFsVGhpcy5jcnlwdG8ucmFuZG9tVVVJRCgpO1xuICB9IGNhdGNoIHt9XG4gIC8vIGZhbGxiYWNrIChub3QgUkZDNDEyMi1wZXJmZWN0LCBidXQgdW5pcXVlIGVub3VnaCBmb3IgdHJhY2luZylcbiAgcmV0dXJuIFwicmlkX1wiICsgTWF0aC5yYW5kb20oKS50b1N0cmluZygxNikuc2xpY2UoMikgKyBcIl9cIiArIERhdGUubm93KCkudG9TdHJpbmcoMTYpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UmVxdWVzdElkKHJlcSkge1xuICBjb25zdCBoID0gKHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtcmVxdWVzdC1pZFwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJ4LXJlcXVlc3QtaWRcIikgfHwgXCJcIikudHJpbSgpO1xuICByZXR1cm4gaCB8fCByYW5kb21JZCgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5mZXJGdW5jdGlvbk5hbWUocmVxKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgdSA9IG5ldyBVUkwocmVxLnVybCk7XG4gICAgY29uc3QgbSA9IHUucGF0aG5hbWUubWF0Y2goL1xcL1xcLm5ldGxpZnlcXC9mdW5jdGlvbnNcXC8oW15cXC9dKykvaSk7XG4gICAgcmV0dXJuIG0gPyBtWzFdIDogXCJ1bmtub3duXCI7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBcInVua25vd25cIjtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVxdWVzdE1ldGEocmVxKSB7XG4gIGxldCB1cmwgPSBudWxsO1xuICB0cnkgeyB1cmwgPSBuZXcgVVJMKHJlcS51cmwpOyB9IGNhdGNoIHt9XG4gIHJldHVybiB7XG4gICAgbWV0aG9kOiByZXEubWV0aG9kIHx8IG51bGwsXG4gICAgcGF0aDogdXJsID8gdXJsLnBhdGhuYW1lIDogbnVsbCxcbiAgICBxdWVyeTogdXJsID8gT2JqZWN0LmZyb21FbnRyaWVzKHVybC5zZWFyY2hQYXJhbXMuZW50cmllcygpKSA6IHt9LFxuICAgIG9yaWdpbjogcmVxLmhlYWRlcnMuZ2V0KFwib3JpZ2luXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIk9yaWdpblwiKSB8fCBudWxsLFxuICAgIHJlZmVyZXI6IHJlcS5oZWFkZXJzLmdldChcInJlZmVyZXJcIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiUmVmZXJlclwiKSB8fCBudWxsLFxuICAgIHVzZXJfYWdlbnQ6IHJlcS5oZWFkZXJzLmdldChcInVzZXItYWdlbnRcIikgfHwgbnVsbCxcbiAgICBpcDogcmVxLmhlYWRlcnMuZ2V0KFwieC1uZi1jbGllbnQtY29ubmVjdGlvbi1pcFwiKSB8fCBudWxsLFxuICAgIGFwcF9pZDogKHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtYXBwXCIpIHx8IFwiXCIpLnRyaW0oKSB8fCBudWxsLFxuICAgIGJ1aWxkX2lkOiAocmVxLmhlYWRlcnMuZ2V0KFwieC1rYWl4dS1idWlsZFwiKSB8fCBcIlwiKS50cmltKCkgfHwgbnVsbFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplRXJyb3IoZXJyKSB7XG4gIGNvbnN0IGUgPSBlcnIgfHwge307XG4gIHJldHVybiB7XG4gICAgbmFtZTogc2FmZVN0cihlLm5hbWUsIDIwMCksXG4gICAgbWVzc2FnZTogc2FmZVN0cihlLm1lc3NhZ2UsIDQwMDApLFxuICAgIGNvZGU6IHNhZmVTdHIoZS5jb2RlLCAyMDApLFxuICAgIHN0YXR1czogTnVtYmVyLmlzRmluaXRlKGUuc3RhdHVzKSA/IGUuc3RhdHVzIDogbnVsbCxcbiAgICBoaW50OiBzYWZlU3RyKGUuaGludCwgMjAwMCksXG4gICAgc3RhY2s6IHNhZmVTdHIoZS5zdGFjaywgMTIwMDApLFxuICAgIHVwc3RyZWFtOiBlLnVwc3RyZWFtID8ge1xuICAgICAgcHJvdmlkZXI6IHNhZmVTdHIoZS51cHN0cmVhbS5wcm92aWRlciwgNTApLFxuICAgICAgc3RhdHVzOiBOdW1iZXIuaXNGaW5pdGUoZS51cHN0cmVhbS5zdGF0dXMpID8gZS51cHN0cmVhbS5zdGF0dXMgOiBudWxsLFxuICAgICAgYm9keTogc2FmZVN0cihlLnVwc3RyZWFtLmJvZHksIDEyMDAwKSxcbiAgICAgIHJlcXVlc3RfaWQ6IHNhZmVTdHIoZS51cHN0cmVhbS5yZXF1ZXN0X2lkLCAyMDApLFxuICAgICAgcmVzcG9uc2VfaGVhZGVyczogZS51cHN0cmVhbS5yZXNwb25zZV9oZWFkZXJzIHx8IHVuZGVmaW5lZFxuICAgIH0gOiB1bmRlZmluZWRcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN1bW1hcml6ZUpzb25Cb2R5KGJvZHkpIHtcbiAgLy8gU2FmZSBzdW1tYXJ5OyBhdm9pZHMgbG9nZ2luZyBmdWxsIHByb21wdHMgYnkgZGVmYXVsdC5cbiAgY29uc3QgYiA9IGJvZHkgfHwge307XG4gIGNvbnN0IHByb3ZpZGVyID0gKGIucHJvdmlkZXIgfHwgXCJcIikudG9TdHJpbmcoKS50cmltKCkudG9Mb3dlckNhc2UoKSB8fCBudWxsO1xuICBjb25zdCBtb2RlbCA9IChiLm1vZGVsIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpIHx8IG51bGw7XG5cbiAgbGV0IG1lc3NhZ2VDb3VudCA9IG51bGw7XG4gIGxldCB0b3RhbENoYXJzID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShiLm1lc3NhZ2VzKSkge1xuICAgICAgbWVzc2FnZUNvdW50ID0gYi5tZXNzYWdlcy5sZW5ndGg7XG4gICAgICB0b3RhbENoYXJzID0gYi5tZXNzYWdlcy5yZWR1Y2UoKGFjYywgbSkgPT4gYWNjICsgU3RyaW5nKG0/LmNvbnRlbnQgPz8gXCJcIikubGVuZ3RoLCAwKTtcbiAgICB9XG4gIH0gY2F0Y2gge31cblxuICByZXR1cm4ge1xuICAgIHByb3ZpZGVyLFxuICAgIG1vZGVsLFxuICAgIG1heF90b2tlbnM6IE51bWJlci5pc0Zpbml0ZShiLm1heF90b2tlbnMpID8gcGFyc2VJbnQoYi5tYXhfdG9rZW5zLCAxMCkgOiBudWxsLFxuICAgIHRlbXBlcmF0dXJlOiB0eXBlb2YgYi50ZW1wZXJhdHVyZSA9PT0gXCJudW1iZXJcIiA/IGIudGVtcGVyYXR1cmUgOiBudWxsLFxuICAgIG1lc3NhZ2VfY291bnQ6IG1lc3NhZ2VDb3VudCxcbiAgICBtZXNzYWdlX2NoYXJzOiB0b3RhbENoYXJzXG4gIH07XG59XG5cbi8qKlxuICogQmVzdC1lZmZvcnQgbW9uaXRvciBldmVudDogZmFpbHVyZXMgbmV2ZXIgYnJlYWsgdGhlIG1haW4gcmVxdWVzdC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGVtaXRFdmVudChldikge1xuICB0cnkge1xuICAgIGNvbnN0IGUgPSBldiB8fCB7fTtcbiAgICBjb25zdCBleHRyYSA9IGUuZXh0cmEgfHwge307XG4gICAgYXdhaXQgcShcbiAgICAgIGBpbnNlcnQgaW50byBnYXRld2F5X2V2ZW50c1xuICAgICAgICAocmVxdWVzdF9pZCwgbGV2ZWwsIGtpbmQsIGZ1bmN0aW9uX25hbWUsIG1ldGhvZCwgcGF0aCwgb3JpZ2luLCByZWZlcmVyLCB1c2VyX2FnZW50LCBpcCxcbiAgICAgICAgIGFwcF9pZCwgYnVpbGRfaWQsIGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCBwcm92aWRlciwgbW9kZWwsIGh0dHBfc3RhdHVzLCBkdXJhdGlvbl9tcyxcbiAgICAgICAgIGVycm9yX2NvZGUsIGVycm9yX21lc3NhZ2UsIGVycm9yX3N0YWNrLCB1cHN0cmVhbV9zdGF0dXMsIHVwc3RyZWFtX2JvZHksIGV4dHJhKVxuICAgICAgIHZhbHVlc1xuICAgICAgICAoJDEsJDIsJDMsJDQsJDUsJDYsJDcsJDgsJDksJDEwLFxuICAgICAgICAgJDExLCQxMiwkMTMsJDE0LCQxNSwkMTYsJDE3LCQxOCxcbiAgICAgICAgICQxOSwkMjAsJDIxLCQyMiwkMjMsJDI0LCQyNTo6anNvbmIpYCxcbiAgICAgIFtcbiAgICAgICAgc2FmZVN0cihlLnJlcXVlc3RfaWQsIDIwMCksXG4gICAgICAgIHNhZmVTdHIoZS5sZXZlbCB8fCBcImluZm9cIiwgMjApLFxuICAgICAgICBzYWZlU3RyKGUua2luZCB8fCBcImV2ZW50XCIsIDgwKSxcbiAgICAgICAgc2FmZVN0cihlLmZ1bmN0aW9uX25hbWUgfHwgXCJ1bmtub3duXCIsIDEyMCksXG4gICAgICAgIHNhZmVTdHIoZS5tZXRob2QsIDIwKSxcbiAgICAgICAgc2FmZVN0cihlLnBhdGgsIDUwMCksXG4gICAgICAgIHNhZmVTdHIoZS5vcmlnaW4sIDUwMCksXG4gICAgICAgIHNhZmVTdHIoZS5yZWZlcmVyLCA4MDApLFxuICAgICAgICBzYWZlU3RyKGUudXNlcl9hZ2VudCwgODAwKSxcbiAgICAgICAgc2FmZVN0cihlLmlwLCAyMDApLFxuXG4gICAgICAgIHNhZmVTdHIoZS5hcHBfaWQsIDIwMCksXG4gICAgICAgIHNhZmVTdHIoZS5idWlsZF9pZCwgMjAwKSxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUuY3VzdG9tZXJfaWQpID8gZS5jdXN0b21lcl9pZCA6IG51bGwsXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShlLmFwaV9rZXlfaWQpID8gZS5hcGlfa2V5X2lkIDogbnVsbCxcbiAgICAgICAgc2FmZVN0cihlLnByb3ZpZGVyLCA4MCksXG4gICAgICAgIHNhZmVTdHIoZS5tb2RlbCwgMjAwKSxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUuaHR0cF9zdGF0dXMpID8gZS5odHRwX3N0YXR1cyA6IG51bGwsXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShlLmR1cmF0aW9uX21zKSA/IGUuZHVyYXRpb25fbXMgOiBudWxsLFxuXG4gICAgICAgIHNhZmVTdHIoZS5lcnJvcl9jb2RlLCAyMDApLFxuICAgICAgICBzYWZlU3RyKGUuZXJyb3JfbWVzc2FnZSwgNDAwMCksXG4gICAgICAgIHNhZmVTdHIoZS5lcnJvcl9zdGFjaywgMTIwMDApLFxuICAgICAgICBOdW1iZXIuaXNGaW5pdGUoZS51cHN0cmVhbV9zdGF0dXMpID8gZS51cHN0cmVhbV9zdGF0dXMgOiBudWxsLFxuICAgICAgICBzYWZlU3RyKGUudXBzdHJlYW1fYm9keSwgMTIwMDApLFxuICAgICAgICBKU09OLnN0cmluZ2lmeShleHRyYSB8fCB7fSlcbiAgICAgIF1cbiAgICApO1xuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc29sZS53YXJuKFwibW9uaXRvciBlbWl0IGZhaWxlZDpcIiwgZT8ubWVzc2FnZSB8fCBlKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IGJ1aWxkQ29ycywganNvbiB9IGZyb20gXCIuL2h0dHAuanNcIjtcbmltcG9ydCB7IGVtaXRFdmVudCwgZ2V0UmVxdWVzdElkLCBpbmZlckZ1bmN0aW9uTmFtZSwgcmVxdWVzdE1ldGEsIHNlcmlhbGl6ZUVycm9yIH0gZnJvbSBcIi4vbW9uaXRvci5qc1wiO1xuXG5mdW5jdGlvbiBub3JtYWxpemVFcnJvcihlcnIpIHtcbiAgY29uc3Qgc3RhdHVzID0gZXJyPy5zdGF0dXMgfHwgNTAwO1xuICBjb25zdCBjb2RlID0gZXJyPy5jb2RlIHx8IFwiU0VSVkVSX0VSUk9SXCI7XG4gIGNvbnN0IG1lc3NhZ2UgPSBlcnI/Lm1lc3NhZ2UgfHwgXCJVbmtub3duIGVycm9yXCI7XG4gIGNvbnN0IGhpbnQgPSBlcnI/LmhpbnQ7XG4gIHJldHVybiB7IHN0YXR1cywgYm9keTogeyBlcnJvcjogbWVzc2FnZSwgY29kZSwgLi4uKGhpbnQgPyB7IGhpbnQgfSA6IHt9KSB9IH07XG59XG5cbmZ1bmN0aW9uIHdpdGhSZXF1ZXN0SWQocmVzLCByZXF1ZXN0X2lkKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgaCA9IG5ldyBIZWFkZXJzKHJlcy5oZWFkZXJzIHx8IHt9KTtcbiAgICBoLnNldChcIngta2FpeHUtcmVxdWVzdC1pZFwiLCByZXF1ZXN0X2lkKTtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKHJlcy5ib2R5LCB7IHN0YXR1czogcmVzLnN0YXR1cywgaGVhZGVyczogaCB9KTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHJlcztcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBzYWZlQm9keVByZXZpZXcocmVzKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgY3QgPSAocmVzLmhlYWRlcnMuZ2V0KFwiY29udGVudC10eXBlXCIpIHx8IFwiXCIpLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgY2xvbmUgPSByZXMuY2xvbmUoKTtcbiAgICBpZiAoY3QuaW5jbHVkZXMoXCJhcHBsaWNhdGlvbi9qc29uXCIpKSB7XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgY2xvbmUuanNvbigpLmNhdGNoKCgpID0+IG51bGwpO1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxuICAgIGNvbnN0IHQgPSBhd2FpdCBjbG9uZS50ZXh0KCkuY2F0Y2goKCkgPT4gXCJcIik7XG4gICAgaWYgKHR5cGVvZiB0ID09PSBcInN0cmluZ1wiICYmIHQubGVuZ3RoID4gMTIwMDApIHJldHVybiB0LnNsaWNlKDAsIDEyMDAwKSArIGBcdTIwMjYoKyR7dC5sZW5ndGggLSAxMjAwMH0gY2hhcnMpYDtcbiAgICByZXR1cm4gdDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyYXAoaGFuZGxlcikge1xuICByZXR1cm4gYXN5bmMgKHJlcSwgY29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCBjb3JzID0gYnVpbGRDb3JzKHJlcSk7XG4gICAgY29uc3QgcmVxdWVzdF9pZCA9IGdldFJlcXVlc3RJZChyZXEpO1xuICAgIGNvbnN0IGZ1bmN0aW9uX25hbWUgPSBpbmZlckZ1bmN0aW9uTmFtZShyZXEpO1xuICAgIGNvbnN0IG1ldGEgPSByZXF1ZXN0TWV0YShyZXEpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGhhbmRsZXIocmVxLCBjb3JzLCBjb250ZXh0KTtcblxuICAgICAgY29uc3QgZHVyYXRpb25fbXMgPSBEYXRlLm5vdygpIC0gc3RhcnQ7XG4gICAgICBjb25zdCBvdXQgPSByZXMgaW5zdGFuY2VvZiBSZXNwb25zZSA/IHdpdGhSZXF1ZXN0SWQocmVzLCByZXF1ZXN0X2lkKSA6IHJlcztcblxuICAgICAgY29uc3Qgc3RhdHVzID0gb3V0IGluc3RhbmNlb2YgUmVzcG9uc2UgPyBvdXQuc3RhdHVzIDogMjAwO1xuICAgICAgY29uc3QgbGV2ZWwgPSBzdGF0dXMgPj0gNTAwID8gXCJlcnJvclwiIDogc3RhdHVzID49IDQwMCA/IFwid2FyblwiIDogXCJpbmZvXCI7XG4gICAgICBjb25zdCBraW5kID0gc3RhdHVzID49IDQwMCA/IFwiaHR0cF9lcnJvcl9yZXNwb25zZVwiIDogXCJodHRwX3Jlc3BvbnNlXCI7XG5cbiAgICAgIGxldCBleHRyYSA9IHt9O1xuICAgICAgaWYgKHN0YXR1cyA+PSA0MDAgJiYgb3V0IGluc3RhbmNlb2YgUmVzcG9uc2UpIHtcbiAgICAgICAgZXh0cmEucmVzcG9uc2UgPSBhd2FpdCBzYWZlQm9keVByZXZpZXcob3V0KTtcbiAgICAgIH1cbiAgICAgIGlmIChkdXJhdGlvbl9tcyA+PSAxNTAwMCkge1xuICAgICAgICBleHRyYS5zbG93ID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgZW1pdEV2ZW50KHtcbiAgICAgICAgcmVxdWVzdF9pZCxcbiAgICAgICAgbGV2ZWwsXG4gICAgICAgIGtpbmQsXG4gICAgICAgIGZ1bmN0aW9uX25hbWUsXG4gICAgICAgIC4uLm1ldGEsXG4gICAgICAgIGh0dHBfc3RhdHVzOiBzdGF0dXMsXG4gICAgICAgIGR1cmF0aW9uX21zLFxuICAgICAgICBleHRyYVxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBvdXQ7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zdCBkdXJhdGlvbl9tcyA9IERhdGUubm93KCkgLSBzdGFydDtcblxuICAgICAgLy8gQmVzdC1lZmZvcnQgZGV0YWlsZWQgbW9uaXRvciByZWNvcmQuXG4gICAgICBjb25zdCBzZXIgPSBzZXJpYWxpemVFcnJvcihlcnIpO1xuICAgICAgYXdhaXQgZW1pdEV2ZW50KHtcbiAgICAgICAgcmVxdWVzdF9pZCxcbiAgICAgICAgbGV2ZWw6IFwiZXJyb3JcIixcbiAgICAgICAga2luZDogXCJ0aHJvd25fZXJyb3JcIixcbiAgICAgICAgZnVuY3Rpb25fbmFtZSxcbiAgICAgICAgLi4ubWV0YSxcbiAgICAgICAgcHJvdmlkZXI6IHNlcj8udXBzdHJlYW0/LnByb3ZpZGVyIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgaHR0cF9zdGF0dXM6IHNlcj8uc3RhdHVzIHx8IDUwMCxcbiAgICAgICAgZHVyYXRpb25fbXMsXG4gICAgICAgIGVycm9yX2NvZGU6IHNlcj8uY29kZSB8fCBcIlNFUlZFUl9FUlJPUlwiLFxuICAgICAgICBlcnJvcl9tZXNzYWdlOiBzZXI/Lm1lc3NhZ2UgfHwgXCJVbmtub3duIGVycm9yXCIsXG4gICAgICAgIGVycm9yX3N0YWNrOiBzZXI/LnN0YWNrIHx8IG51bGwsXG4gICAgICAgIHVwc3RyZWFtX3N0YXR1czogc2VyPy51cHN0cmVhbT8uc3RhdHVzIHx8IG51bGwsXG4gICAgICAgIHVwc3RyZWFtX2JvZHk6IHNlcj8udXBzdHJlYW0/LmJvZHkgfHwgbnVsbCxcbiAgICAgICAgZXh0cmE6IHsgZXJyb3I6IHNlciB9XG4gICAgICB9KTtcblxuICAgICAgLy8gQXZvaWQgNTAyczogYWx3YXlzIHJldHVybiBKU09OLlxuICAgICAgY29uc29sZS5lcnJvcihcIkZ1bmN0aW9uIGVycm9yOlwiLCBlcnIpO1xuICAgICAgY29uc3QgeyBzdGF0dXMsIGJvZHkgfSA9IG5vcm1hbGl6ZUVycm9yKGVycik7XG4gICAgICByZXR1cm4ganNvbihzdGF0dXMsIHsgLi4uYm9keSwgcmVxdWVzdF9pZCB9LCB7IC4uLmNvcnMsIFwieC1rYWl4dS1yZXF1ZXN0LWlkXCI6IHJlcXVlc3RfaWQgfSk7XG4gICAgfVxuICB9O1xufVxuIiwgImltcG9ydCBjcnlwdG8gZnJvbSBcImNyeXB0b1wiO1xuXG5mdW5jdGlvbiBjb25maWdFcnJvcihtZXNzYWdlLCBoaW50KSB7XG4gIGNvbnN0IGVyciA9IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgZXJyLmNvZGUgPSBcIkNPTkZJR1wiO1xuICBlcnIuc3RhdHVzID0gNTAwO1xuICBpZiAoaGludCkgZXJyLmhpbnQgPSBoaW50O1xuICByZXR1cm4gZXJyO1xufVxuXG5mdW5jdGlvbiBiYXNlNjR1cmwoaW5wdXQpIHtcbiAgcmV0dXJuIEJ1ZmZlci5mcm9tKGlucHV0KVxuICAgIC50b1N0cmluZyhcImJhc2U2NFwiKVxuICAgIC5yZXBsYWNlKC89L2csIFwiXCIpXG4gICAgLnJlcGxhY2UoL1xcKy9nLCBcIi1cIilcbiAgICAucmVwbGFjZSgvXFwvL2csIFwiX1wiKTtcbn1cblxuZnVuY3Rpb24gdW5iYXNlNjR1cmwoaW5wdXQpIHtcbiAgY29uc3QgcyA9IFN0cmluZyhpbnB1dCB8fCBcIlwiKS5yZXBsYWNlKC8tL2csIFwiK1wiKS5yZXBsYWNlKC9fL2csIFwiL1wiKTtcbiAgY29uc3QgcGFkID0gcy5sZW5ndGggJSA0ID09PSAwID8gXCJcIiA6IFwiPVwiLnJlcGVhdCg0IC0gKHMubGVuZ3RoICUgNCkpO1xuICByZXR1cm4gQnVmZmVyLmZyb20ocyArIHBhZCwgXCJiYXNlNjRcIik7XG59XG5cbmZ1bmN0aW9uIGVuY0tleSgpIHtcbiAgLy8gUHJlZmVyIGEgZGVkaWNhdGVkIGVuY3J5cHRpb24ga2V5LiBGYWxsIGJhY2sgdG8gSldUX1NFQ1JFVCBmb3IgZHJvcC1mcmllbmRseSBpbnN0YWxscy5cbiAgY29uc3QgcmF3ID0gKHByb2Nlc3MuZW52LkRCX0VOQ1JZUFRJT05fS0VZIHx8IHByb2Nlc3MuZW52LkpXVF9TRUNSRVQgfHwgXCJcIikudG9TdHJpbmcoKTtcbiAgaWYgKCFyYXcpIHtcbiAgICB0aHJvdyBjb25maWdFcnJvcihcbiAgICAgIFwiTWlzc2luZyBEQl9FTkNSWVBUSU9OX0tFWSAob3IgSldUX1NFQ1JFVCBmYWxsYmFjaylcIixcbiAgICAgIFwiU2V0IERCX0VOQ1JZUFRJT05fS0VZIChyZWNvbW1lbmRlZCkgb3IgYXQgbWluaW11bSBKV1RfU0VDUkVUIGluIE5ldGxpZnkgZW52IHZhcnMuXCJcbiAgICApO1xuICB9XG4gIC8vIERlcml2ZSBhIHN0YWJsZSAzMi1ieXRlIGtleS5cbiAgcmV0dXJuIGNyeXB0by5jcmVhdGVIYXNoKFwic2hhMjU2XCIpLnVwZGF0ZShyYXcpLmRpZ2VzdCgpO1xufVxuXG4vKipcbiAqIEVuY3J5cHQgc21hbGwgc2VjcmV0cyBmb3IgREIgc3RvcmFnZSAoQUVTLTI1Ni1HQ00pLlxuICogRm9ybWF0OiB2MTo8aXZfYjY0dXJsPjo8dGFnX2I2NHVybD46PGNpcGhlcl9iNjR1cmw+XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmNyeXB0U2VjcmV0KHBsYWludGV4dCkge1xuICBjb25zdCBrZXkgPSBlbmNLZXkoKTtcbiAgY29uc3QgaXYgPSBjcnlwdG8ucmFuZG9tQnl0ZXMoMTIpO1xuICBjb25zdCBjaXBoZXIgPSBjcnlwdG8uY3JlYXRlQ2lwaGVyaXYoXCJhZXMtMjU2LWdjbVwiLCBrZXksIGl2KTtcbiAgY29uc3QgY3QgPSBCdWZmZXIuY29uY2F0KFtjaXBoZXIudXBkYXRlKFN0cmluZyhwbGFpbnRleHQpLCBcInV0ZjhcIiksIGNpcGhlci5maW5hbCgpXSk7XG4gIGNvbnN0IHRhZyA9IGNpcGhlci5nZXRBdXRoVGFnKCk7XG4gIHJldHVybiBgdjE6JHtiYXNlNjR1cmwoaXYpfToke2Jhc2U2NHVybCh0YWcpfToke2Jhc2U2NHVybChjdCl9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlY3J5cHRTZWNyZXQoZW5jKSB7XG4gIGNvbnN0IHMgPSBTdHJpbmcoZW5jIHx8IFwiXCIpO1xuICBpZiAoIXMuc3RhcnRzV2l0aChcInYxOlwiKSkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHBhcnRzID0gcy5zcGxpdChcIjpcIik7XG4gIGlmIChwYXJ0cy5sZW5ndGggIT09IDQpIHJldHVybiBudWxsO1xuICBjb25zdCBbLCBpdkIsIHRhZ0IsIGN0Ql0gPSBwYXJ0cztcbiAgY29uc3Qga2V5ID0gZW5jS2V5KCk7XG4gIGNvbnN0IGl2ID0gdW5iYXNlNjR1cmwoaXZCKTtcbiAgY29uc3QgdGFnID0gdW5iYXNlNjR1cmwodGFnQik7XG4gIGNvbnN0IGN0ID0gdW5iYXNlNjR1cmwoY3RCKTtcbiAgY29uc3QgZGVjaXBoZXIgPSBjcnlwdG8uY3JlYXRlRGVjaXBoZXJpdihcImFlcy0yNTYtZ2NtXCIsIGtleSwgaXYpO1xuICBkZWNpcGhlci5zZXRBdXRoVGFnKHRhZyk7XG4gIGNvbnN0IHB0ID0gQnVmZmVyLmNvbmNhdChbZGVjaXBoZXIudXBkYXRlKGN0KSwgZGVjaXBoZXIuZmluYWwoKV0pO1xuICByZXR1cm4gcHQudG9TdHJpbmcoXCJ1dGY4XCIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmFuZG9tS2V5KHByZWZpeCA9IFwia3hfbGl2ZV9cIikge1xuICBjb25zdCBieXRlcyA9IGNyeXB0by5yYW5kb21CeXRlcygzMik7XG4gIHJldHVybiBwcmVmaXggKyBiYXNlNjR1cmwoYnl0ZXMpLnNsaWNlKDAsIDQ4KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNoYTI1NkhleChpbnB1dCkge1xuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhhc2goXCJzaGEyNTZcIikudXBkYXRlKGlucHV0KS5kaWdlc3QoXCJoZXhcIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBobWFjU2hhMjU2SGV4KHNlY3JldCwgaW5wdXQpIHtcbiAgcmV0dXJuIGNyeXB0by5jcmVhdGVIbWFjKFwic2hhMjU2XCIsIHNlY3JldCkudXBkYXRlKGlucHV0KS5kaWdlc3QoXCJoZXhcIik7XG59XG5cbi8qKlxuICogS2V5IGhhc2hpbmcgc3RyYXRlZ3k6XG4gKiAtIERlZmF1bHQ6IFNIQS0yNTYoa2V5KVxuICogLSBJZiBLRVlfUEVQUEVSIGlzIHNldDogSE1BQy1TSEEyNTYoS0VZX1BFUFBFUiwga2V5KVxuICpcbiAqIElNUE9SVEFOVDogUGVwcGVyIGlzIG9wdGlvbmFsIGFuZCBjYW4gYmUgZW5hYmxlZCBsYXRlci5cbiAqIEF1dGggY29kZSB3aWxsIGF1dG8tbWlncmF0ZSBsZWdhY3kgaGFzaGVzIG9uIGZpcnN0IHN1Y2Nlc3NmdWwgbG9va3VwLlxuICovXG5leHBvcnQgZnVuY3Rpb24ga2V5SGFzaEhleChpbnB1dCkge1xuICBjb25zdCBwZXBwZXIgPSBwcm9jZXNzLmVudi5LRVlfUEVQUEVSO1xuICBpZiAocGVwcGVyKSByZXR1cm4gaG1hY1NoYTI1NkhleChwZXBwZXIsIGlucHV0KTtcbiAgcmV0dXJuIHNoYTI1NkhleChpbnB1dCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsZWdhY3lLZXlIYXNoSGV4KGlucHV0KSB7XG4gIHJldHVybiBzaGEyNTZIZXgoaW5wdXQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2lnbkp3dChwYXlsb2FkLCB0dGxTZWNvbmRzID0gMzYwMCkge1xuICBjb25zdCBzZWNyZXQgPSBwcm9jZXNzLmVudi5KV1RfU0VDUkVUO1xuICBpZiAoIXNlY3JldCkge1xuICAgIHRocm93IGNvbmZpZ0Vycm9yKFxuICAgICAgXCJNaXNzaW5nIEpXVF9TRUNSRVRcIixcbiAgICAgIFwiU2V0IEpXVF9TRUNSRVQgaW4gTmV0bGlmeSBcdTIxOTIgU2l0ZSBjb25maWd1cmF0aW9uIFx1MjE5MiBFbnZpcm9ubWVudCB2YXJpYWJsZXMgKHVzZSBhIGxvbmcgcmFuZG9tIHN0cmluZykuXCJcbiAgICApO1xuICB9XG5cbiAgY29uc3QgaGVhZGVyID0geyBhbGc6IFwiSFMyNTZcIiwgdHlwOiBcIkpXVFwiIH07XG4gIGNvbnN0IG5vdyA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApO1xuICBjb25zdCBib2R5ID0geyAuLi5wYXlsb2FkLCBpYXQ6IG5vdywgZXhwOiBub3cgKyB0dGxTZWNvbmRzIH07XG5cbiAgY29uc3QgaCA9IGJhc2U2NHVybChKU09OLnN0cmluZ2lmeShoZWFkZXIpKTtcbiAgY29uc3QgcCA9IGJhc2U2NHVybChKU09OLnN0cmluZ2lmeShib2R5KSk7XG4gIGNvbnN0IGRhdGEgPSBgJHtofS4ke3B9YDtcbiAgY29uc3Qgc2lnID0gYmFzZTY0dXJsKGNyeXB0by5jcmVhdGVIbWFjKFwic2hhMjU2XCIsIHNlY3JldCkudXBkYXRlKGRhdGEpLmRpZ2VzdCgpKTtcblxuICByZXR1cm4gYCR7ZGF0YX0uJHtzaWd9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZlcmlmeUp3dCh0b2tlbikge1xuICBjb25zdCBzZWNyZXQgPSBwcm9jZXNzLmVudi5KV1RfU0VDUkVUO1xuICBpZiAoIXNlY3JldCkge1xuICAgIHRocm93IGNvbmZpZ0Vycm9yKFxuICAgICAgXCJNaXNzaW5nIEpXVF9TRUNSRVRcIixcbiAgICAgIFwiU2V0IEpXVF9TRUNSRVQgaW4gTmV0bGlmeSBcdTIxOTIgU2l0ZSBjb25maWd1cmF0aW9uIFx1MjE5MiBFbnZpcm9ubWVudCB2YXJpYWJsZXMgKHVzZSBhIGxvbmcgcmFuZG9tIHN0cmluZykuXCJcbiAgICApO1xuICB9XG5cbiAgY29uc3QgcGFydHMgPSB0b2tlbi5zcGxpdChcIi5cIik7XG4gIGlmIChwYXJ0cy5sZW5ndGggIT09IDMpIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IFtoLCBwLCBzXSA9IHBhcnRzO1xuICBjb25zdCBkYXRhID0gYCR7aH0uJHtwfWA7XG4gIGNvbnN0IGV4cGVjdGVkID0gYmFzZTY0dXJsKGNyeXB0by5jcmVhdGVIbWFjKFwic2hhMjU2XCIsIHNlY3JldCkudXBkYXRlKGRhdGEpLmRpZ2VzdCgpKTtcblxuICB0cnkge1xuICAgIGNvbnN0IGEgPSBCdWZmZXIuZnJvbShleHBlY3RlZCk7XG4gICAgY29uc3QgYiA9IEJ1ZmZlci5mcm9tKHMpO1xuICAgIGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpIHJldHVybiBudWxsO1xuICAgIGlmICghY3J5cHRvLnRpbWluZ1NhZmVFcXVhbChhLCBiKSkgcmV0dXJuIG51bGw7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBwYXlsb2FkID0gSlNPTi5wYXJzZShcbiAgICAgIEJ1ZmZlci5mcm9tKHAucmVwbGFjZSgvLS9nLCBcIitcIikucmVwbGFjZSgvXy9nLCBcIi9cIiksIFwiYmFzZTY0XCIpLnRvU3RyaW5nKFwidXRmLThcIilcbiAgICApO1xuICAgIGNvbnN0IG5vdyA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApO1xuICAgIGlmIChwYXlsb2FkLmV4cCAmJiBub3cgPiBwYXlsb2FkLmV4cCkgcmV0dXJuIG51bGw7XG4gICAgcmV0dXJuIHBheWxvYWQ7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgcSB9IGZyb20gXCIuL2RiLmpzXCI7XG5pbXBvcnQgeyBrZXlIYXNoSGV4LCBsZWdhY3lLZXlIYXNoSGV4LCB2ZXJpZnlKd3QgfSBmcm9tIFwiLi9jcnlwdG8uanNcIjtcbmltcG9ydCB7IG1vbnRoS2V5VVRDIH0gZnJvbSBcIi4vaHR0cC5qc1wiO1xuXG5mdW5jdGlvbiBiYXNlU2VsZWN0KCkge1xuICByZXR1cm4gYHNlbGVjdCBrLmlkIGFzIGFwaV9rZXlfaWQsIGsuY3VzdG9tZXJfaWQsIGsua2V5X2xhc3Q0LCBrLmxhYmVsLCBrLnJvbGUsXG4gICAgICAgICAgICAgICAgIGsubW9udGhseV9jYXBfY2VudHMgYXMga2V5X2NhcF9jZW50cywgay5ycG1fbGltaXQsIGsucnBkX2xpbWl0LFxuICAgICAgICAgICAgICAgICBrLm1heF9kZXZpY2VzLCBrLnJlcXVpcmVfaW5zdGFsbF9pZCwgay5hbGxvd2VkX3Byb3ZpZGVycywgay5hbGxvd2VkX21vZGVscyxcbiAgICAgICAgICAgICAgICAgYy5tb250aGx5X2NhcF9jZW50cyBhcyBjdXN0b21lcl9jYXBfY2VudHMsIGMuaXNfYWN0aXZlLFxuICAgICAgICAgICAgICAgICBjLm1heF9kZXZpY2VzX3Blcl9rZXkgYXMgY3VzdG9tZXJfbWF4X2RldmljZXNfcGVyX2tleSwgYy5yZXF1aXJlX2luc3RhbGxfaWQgYXMgY3VzdG9tZXJfcmVxdWlyZV9pbnN0YWxsX2lkLFxuICAgICAgICAgICAgICAgICBjLmFsbG93ZWRfcHJvdmlkZXJzIGFzIGN1c3RvbWVyX2FsbG93ZWRfcHJvdmlkZXJzLCBjLmFsbG93ZWRfbW9kZWxzIGFzIGN1c3RvbWVyX2FsbG93ZWRfbW9kZWxzLFxuICAgICAgICAgICAgICAgICBjLnBsYW5fbmFtZSBhcyBjdXN0b21lcl9wbGFuX25hbWUsIGMuZW1haWwgYXMgY3VzdG9tZXJfZW1haWxcbiAgICAgICAgICBmcm9tIGFwaV9rZXlzIGtcbiAgICAgICAgICBqb2luIGN1c3RvbWVycyBjIG9uIGMuaWQgPSBrLmN1c3RvbWVyX2lkYDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvb2t1cEtleShwbGFpbktleSkge1xuICAvLyBQcmVmZXJyZWQgaGFzaCAocGVwcGVyZWQgaWYgZW5hYmxlZClcbiAgY29uc3QgcHJlZmVycmVkID0ga2V5SGFzaEhleChwbGFpbktleSk7XG4gIGxldCBrZXlSZXMgPSBhd2FpdCBxKFxuICAgIGAke2Jhc2VTZWxlY3QoKX1cbiAgICAgd2hlcmUgay5rZXlfaGFzaD0kMSBhbmQgay5yZXZva2VkX2F0IGlzIG51bGxcbiAgICAgbGltaXQgMWAsXG4gICAgW3ByZWZlcnJlZF1cbiAgKTtcbiAgaWYgKGtleVJlcy5yb3dDb3VudCkgcmV0dXJuIGtleVJlcy5yb3dzWzBdO1xuXG4gIC8vIElmIEtFWV9QRVBQRVIgaXMgZW5hYmxlZCwgYWxsb3cgbGVnYWN5IFNIQS0yNTYgaGFzaGVzIGFuZCBhdXRvLW1pZ3JhdGUgb24gZmlyc3QgaGl0LlxuICBpZiAocHJvY2Vzcy5lbnYuS0VZX1BFUFBFUikge1xuICAgIGNvbnN0IGxlZ2FjeSA9IGxlZ2FjeUtleUhhc2hIZXgocGxhaW5LZXkpO1xuICAgIGtleVJlcyA9IGF3YWl0IHEoXG4gICAgICBgJHtiYXNlU2VsZWN0KCl9XG4gICAgICAgd2hlcmUgay5rZXlfaGFzaD0kMSBhbmQgay5yZXZva2VkX2F0IGlzIG51bGxcbiAgICAgICBsaW1pdCAxYCxcbiAgICAgIFtsZWdhY3ldXG4gICAgKTtcbiAgICBpZiAoIWtleVJlcy5yb3dDb3VudCkgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCByb3cgPSBrZXlSZXMucm93c1swXTtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgcShcbiAgICAgICAgYHVwZGF0ZSBhcGlfa2V5cyBzZXQga2V5X2hhc2g9JDFcbiAgICAgICAgIHdoZXJlIGlkPSQyIGFuZCBrZXlfaGFzaD0kM2AsXG4gICAgICAgIFtwcmVmZXJyZWQsIHJvdy5hcGlfa2V5X2lkLCBsZWdhY3ldXG4gICAgICApO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gaWdub3JlIG1pZ3JhdGlvbiBlcnJvcnNcbiAgICB9XG5cbiAgICByZXR1cm4gcm93O1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb29rdXBLZXlCeUlkKGFwaV9rZXlfaWQpIHtcbiAgY29uc3Qga2V5UmVzID0gYXdhaXQgcShcbiAgICBgJHtiYXNlU2VsZWN0KCl9XG4gICAgIHdoZXJlIGsuaWQ9JDEgYW5kIGsucmV2b2tlZF9hdCBpcyBudWxsXG4gICAgIGxpbWl0IDFgLFxuICAgIFthcGlfa2V5X2lkXVxuICApO1xuICBpZiAoIWtleVJlcy5yb3dDb3VudCkgcmV0dXJuIG51bGw7XG4gIHJldHVybiBrZXlSZXMucm93c1swXTtcbn1cblxuLyoqXG4gKiBSZXNvbHZlIGFuIEF1dGhvcml6YXRpb24gQmVhcmVyIHRva2VuLlxuICogU3VwcG9ydGVkOlxuICogLSBLYWl4dSBzdWIta2V5IChwbGFpbiB2aXJ0dWFsIGtleSlcbiAqIC0gU2hvcnQtbGl2ZWQgdXNlciBzZXNzaW9uIEpXVCAodHlwZTogJ3VzZXJfc2Vzc2lvbicpXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXNvbHZlQXV0aCh0b2tlbikge1xuICBpZiAoIXRva2VuKSByZXR1cm4gbnVsbDtcblxuICAvLyBKV1RzIGhhdmUgMyBkb3Qtc2VwYXJhdGVkIHBhcnRzLiBLYWl4dSBrZXlzIGRvIG5vdC5cbiAgY29uc3QgcGFydHMgPSB0b2tlbi5zcGxpdChcIi5cIik7XG4gIGlmIChwYXJ0cy5sZW5ndGggPT09IDMpIHtcbiAgICBjb25zdCBwYXlsb2FkID0gdmVyaWZ5Snd0KHRva2VuKTtcbiAgICBpZiAoIXBheWxvYWQpIHJldHVybiBudWxsO1xuICAgIGlmIChwYXlsb2FkLnR5cGUgIT09IFwidXNlcl9zZXNzaW9uXCIpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3Qgcm93ID0gYXdhaXQgbG9va3VwS2V5QnlJZChwYXlsb2FkLmFwaV9rZXlfaWQpO1xuICAgIHJldHVybiByb3c7XG4gIH1cblxuICByZXR1cm4gYXdhaXQgbG9va3VwS2V5KHRva2VuKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldE1vbnRoUm9sbHVwKGN1c3RvbWVyX2lkLCBtb250aCA9IG1vbnRoS2V5VVRDKCkpIHtcbiAgY29uc3Qgcm9sbCA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBzcGVudF9jZW50cywgZXh0cmFfY2VudHMsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2Vuc1xuICAgICBmcm9tIG1vbnRobHlfdXNhZ2Ugd2hlcmUgY3VzdG9tZXJfaWQ9JDEgYW5kIG1vbnRoPSQyYCxcbiAgICBbY3VzdG9tZXJfaWQsIG1vbnRoXVxuICApO1xuICBpZiAocm9sbC5yb3dDb3VudCA9PT0gMCkgcmV0dXJuIHsgc3BlbnRfY2VudHM6IDAsIGV4dHJhX2NlbnRzOiAwLCBpbnB1dF90b2tlbnM6IDAsIG91dHB1dF90b2tlbnM6IDAgfTtcbiAgcmV0dXJuIHJvbGwucm93c1swXTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEtleU1vbnRoUm9sbHVwKGFwaV9rZXlfaWQsIG1vbnRoID0gbW9udGhLZXlVVEMoKSkge1xuICBjb25zdCByb2xsID0gYXdhaXQgcShcbiAgICBgc2VsZWN0IHNwZW50X2NlbnRzLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnMsIGNhbGxzXG4gICAgIGZyb20gbW9udGhseV9rZXlfdXNhZ2Ugd2hlcmUgYXBpX2tleV9pZD0kMSBhbmQgbW9udGg9JDJgLFxuICAgIFthcGlfa2V5X2lkLCBtb250aF1cbiAgKTtcbiAgaWYgKHJvbGwucm93Q291bnQpIHJldHVybiByb2xsLnJvd3NbMF07XG5cbiAgLy8gQmFja2ZpbGwgZm9yIG1pZ3JhdGVkIGluc3RhbGxzICh3aGVuIG1vbnRobHlfa2V5X3VzYWdlIGRpZCBub3QgZXhpc3QgeWV0KS5cbiAgY29uc3Qga2V5TWV0YSA9IGF3YWl0IHEoYHNlbGVjdCBjdXN0b21lcl9pZCBmcm9tIGFwaV9rZXlzIHdoZXJlIGlkPSQxYCwgW2FwaV9rZXlfaWRdKTtcbiAgY29uc3QgY3VzdG9tZXJfaWQgPSBrZXlNZXRhLnJvd0NvdW50ID8ga2V5TWV0YS5yb3dzWzBdLmN1c3RvbWVyX2lkIDogbnVsbDtcblxuICBjb25zdCBhZ2cgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3QgY29hbGVzY2Uoc3VtKGNvc3RfY2VudHMpLDApOjppbnQgYXMgc3BlbnRfY2VudHMsXG4gICAgICAgICAgICBjb2FsZXNjZShzdW0oaW5wdXRfdG9rZW5zKSwwKTo6aW50IGFzIGlucHV0X3Rva2VucyxcbiAgICAgICAgICAgIGNvYWxlc2NlKHN1bShvdXRwdXRfdG9rZW5zKSwwKTo6aW50IGFzIG91dHB1dF90b2tlbnMsXG4gICAgICAgICAgICBjb3VudCgqKTo6aW50IGFzIGNhbGxzXG4gICAgIGZyb20gdXNhZ2VfZXZlbnRzXG4gICAgIHdoZXJlIGFwaV9rZXlfaWQ9JDEgYW5kIHRvX2NoYXIoY3JlYXRlZF9hdCBhdCB0aW1lIHpvbmUgJ1VUQycsJ1lZWVktTU0nKT0kMmAsXG4gICAgW2FwaV9rZXlfaWQsIG1vbnRoXVxuICApO1xuXG4gIGNvbnN0IHJvdyA9IGFnZy5yb3dzWzBdIHx8IHsgc3BlbnRfY2VudHM6IDAsIGlucHV0X3Rva2VuczogMCwgb3V0cHV0X3Rva2VuczogMCwgY2FsbHM6IDAgfTtcblxuICBpZiAoY3VzdG9tZXJfaWQgIT0gbnVsbCkge1xuICAgIGF3YWl0IHEoXG4gICAgICBgaW5zZXJ0IGludG8gbW9udGhseV9rZXlfdXNhZ2UoYXBpX2tleV9pZCwgY3VzdG9tZXJfaWQsIG1vbnRoLCBzcGVudF9jZW50cywgaW5wdXRfdG9rZW5zLCBvdXRwdXRfdG9rZW5zLCBjYWxscylcbiAgICAgICB2YWx1ZXMgKCQxLCQyLCQzLCQ0LCQ1LCQ2LCQ3KVxuICAgICAgIG9uIGNvbmZsaWN0IChhcGlfa2V5X2lkLCBtb250aClcbiAgICAgICBkbyB1cGRhdGUgc2V0XG4gICAgICAgICBzcGVudF9jZW50cyA9IGV4Y2x1ZGVkLnNwZW50X2NlbnRzLFxuICAgICAgICAgaW5wdXRfdG9rZW5zID0gZXhjbHVkZWQuaW5wdXRfdG9rZW5zLFxuICAgICAgICAgb3V0cHV0X3Rva2VucyA9IGV4Y2x1ZGVkLm91dHB1dF90b2tlbnMsXG4gICAgICAgICBjYWxscyA9IGV4Y2x1ZGVkLmNhbGxzLFxuICAgICAgICAgdXBkYXRlZF9hdCA9IG5vdygpYCxcbiAgICAgIFthcGlfa2V5X2lkLCBjdXN0b21lcl9pZCwgbW9udGgsIHJvdy5zcGVudF9jZW50cyB8fCAwLCByb3cuaW5wdXRfdG9rZW5zIHx8IDAsIHJvdy5vdXRwdXRfdG9rZW5zIHx8IDAsIHJvdy5jYWxscyB8fCAwXVxuICAgICk7XG4gIH1cblxuICByZXR1cm4gcm93O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZWZmZWN0aXZlQ2FwQ2VudHMoa2V5Um93LCByb2xsdXApIHtcbiAgY29uc3QgYmFzZSA9IGtleVJvdy5rZXlfY2FwX2NlbnRzID8/IGtleVJvdy5jdXN0b21lcl9jYXBfY2VudHM7XG4gIGNvbnN0IGV4dHJhID0gcm9sbHVwLmV4dHJhX2NlbnRzIHx8IDA7XG4gIHJldHVybiAoYmFzZSB8fCAwKSArIGV4dHJhO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3VzdG9tZXJDYXBDZW50cyhrZXlSb3csIGN1c3RvbWVyUm9sbHVwKSB7XG4gIGNvbnN0IGJhc2UgPSBrZXlSb3cuY3VzdG9tZXJfY2FwX2NlbnRzIHx8IDA7XG4gIGNvbnN0IGV4dHJhID0gY3VzdG9tZXJSb2xsdXAuZXh0cmFfY2VudHMgfHwgMDtcbiAgcmV0dXJuIGJhc2UgKyBleHRyYTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGtleUNhcENlbnRzKGtleVJvdywgY3VzdG9tZXJSb2xsdXApIHtcbiAgLy8gSWYgYSBrZXkgb3ZlcnJpZGUgZXhpc3RzLCBpdCdzIGEgaGFyZCBjYXAgZm9yIHRoYXQga2V5LiBPdGhlcndpc2UgaXQgaW5oZXJpdHMgdGhlIGN1c3RvbWVyIGNhcC5cbiAgaWYgKGtleVJvdy5rZXlfY2FwX2NlbnRzICE9IG51bGwpIHJldHVybiBrZXlSb3cua2V5X2NhcF9jZW50cztcbiAgcmV0dXJuIGN1c3RvbWVyQ2FwQ2VudHMoa2V5Um93LCBjdXN0b21lclJvbGx1cCk7XG59XG5cblxuY29uc3QgUk9MRV9PUkRFUiA9IFtcInZpZXdlclwiLFwiZGVwbG95ZXJcIixcImFkbWluXCIsXCJvd25lclwiXTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJvbGVBdExlYXN0KGFjdHVhbCwgcmVxdWlyZWQpIHtcbiAgY29uc3QgYSA9IFJPTEVfT1JERVIuaW5kZXhPZigoYWN0dWFsIHx8IFwiZGVwbG95ZXJcIikudG9Mb3dlckNhc2UoKSk7XG4gIGNvbnN0IHIgPSBST0xFX09SREVSLmluZGV4T2YoKHJlcXVpcmVkIHx8IFwiZGVwbG95ZXJcIikudG9Mb3dlckNhc2UoKSk7XG4gIHJldHVybiBhID49IHIgJiYgYSAhPT0gLTEgJiYgciAhPT0gLTE7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXF1aXJlS2V5Um9sZShrZXlSb3csIHJlcXVpcmVkUm9sZSkge1xuICBjb25zdCBhY3R1YWwgPSAoa2V5Um93Py5yb2xlIHx8IFwiZGVwbG95ZXJcIikudG9Mb3dlckNhc2UoKTtcbiAgaWYgKCFyb2xlQXRMZWFzdChhY3R1YWwsIHJlcXVpcmVkUm9sZSkpIHtcbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXCJGb3JiaWRkZW5cIik7XG4gICAgZXJyLnN0YXR1cyA9IDQwMztcbiAgICBlcnIuY29kZSA9IFwiRk9SQklEREVOXCI7XG4gICAgZXJyLmhpbnQgPSBgUmVxdWlyZXMgcm9sZSAnJHtyZXF1aXJlZFJvbGV9JywgYnV0IGtleSByb2xlIGlzICcke2FjdHVhbH0nLmA7XG4gICAgdGhyb3cgZXJyO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgcSB9IGZyb20gXCIuL2RiLmpzXCI7XG5pbXBvcnQgeyBlbmNyeXB0U2VjcmV0LCBkZWNyeXB0U2VjcmV0IH0gZnJvbSBcIi4vY3J5cHRvLmpzXCI7XG5cbi8qKlxuICogUGVyLWN1c3RvbWVyIE5ldGxpZnkgQVBJIHRva2VucyAoZW50ZXJwcmlzZSBib3VuZGFyeSkuXG4gKlxuICogLSBTdG9yZWQgZW5jcnlwdGVkIGluIE5ldGxpZnkgREIuXG4gKiAtIFVzZWQgYnkgS2FpeHVQdXNoIHRvIGNyZWF0ZSBkZXBsb3lzL3VwbG9hZHMgaW4gdGhlIGN1c3RvbWVyJ3MgTmV0bGlmeSBhY2NvdW50LlxuICogLSBGYWxscyBiYWNrIHRvIHByb2Nlc3MuZW52Lk5FVExJRllfQVVUSF9UT0tFTiBpZiBubyBjdXN0b21lciB0b2tlbiBleGlzdHMgKGJhY2stY29tcGF0KS5cbiAqL1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0TmV0bGlmeVRva2VuRm9yQ3VzdG9tZXIoY3VzdG9tZXJfaWQpIHtcbiAgY29uc3QgcmVzID0gYXdhaXQgcShgc2VsZWN0IHRva2VuX2VuYyBmcm9tIGN1c3RvbWVyX25ldGxpZnlfdG9rZW5zIHdoZXJlIGN1c3RvbWVyX2lkPSQxYCwgW2N1c3RvbWVyX2lkXSk7XG4gIGlmIChyZXMucm93cy5sZW5ndGgpIHtcbiAgICBjb25zdCBkZWMgPSBkZWNyeXB0U2VjcmV0KHJlcy5yb3dzWzBdLnRva2VuX2VuYyk7XG4gICAgaWYgKGRlYykgcmV0dXJuIGRlYztcbiAgfVxuICByZXR1cm4gKHByb2Nlc3MuZW52Lk5FVExJRllfQVVUSF9UT0tFTiB8fCBcIlwiKS50cmltKCkgfHwgbnVsbDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldE5ldGxpZnlUb2tlbkZvckN1c3RvbWVyKGN1c3RvbWVyX2lkLCB0b2tlbl9wbGFpbikge1xuICBjb25zdCBlbmMgPSBlbmNyeXB0U2VjcmV0KHRva2VuX3BsYWluKTtcbiAgYXdhaXQgcShcbiAgICBgaW5zZXJ0IGludG8gY3VzdG9tZXJfbmV0bGlmeV90b2tlbnMoY3VzdG9tZXJfaWQsIHRva2VuX2VuYywgY3JlYXRlZF9hdCwgdXBkYXRlZF9hdClcbiAgICAgdmFsdWVzICgkMSwkMixub3coKSxub3coKSlcbiAgICAgb24gY29uZmxpY3QgKGN1c3RvbWVyX2lkKVxuICAgICBkbyB1cGRhdGUgc2V0IHRva2VuX2VuYz1leGNsdWRlZC50b2tlbl9lbmMsIHVwZGF0ZWRfYXQ9bm93KClgLFxuICAgIFtjdXN0b21lcl9pZCwgZW5jXVxuICApO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2xlYXJOZXRsaWZ5VG9rZW5Gb3JDdXN0b21lcihjdXN0b21lcl9pZCkge1xuICBhd2FpdCBxKGBkZWxldGUgZnJvbSBjdXN0b21lcl9uZXRsaWZ5X3Rva2VucyB3aGVyZSBjdXN0b21lcl9pZD0kMWAsIFtjdXN0b21lcl9pZF0pO1xufVxuIiwgImltcG9ydCB7IHNsZWVwIH0gZnJvbSBcIi4vaHR0cC5qc1wiO1xuaW1wb3J0IHsgZW5jb2RlVVJJQ29tcG9uZW50U2FmZVBhdGggfSBmcm9tIFwiLi9wdXNoUGF0aC5qc1wiO1xuXG5jb25zdCBBUEkgPSBcImh0dHBzOi8vYXBpLm5ldGxpZnkuY29tL2FwaS92MVwiO1xuXG5mdW5jdGlvbiB0b2tlbihuZXRsaWZ5X3Rva2VuKSB7XG4gIGNvbnN0IHQgPSAobmV0bGlmeV90b2tlbiB8fCBwcm9jZXNzLmVudi5ORVRMSUZZX0FVVEhfVE9LRU4gfHwgXCJcIikudG9TdHJpbmcoKS50cmltKCk7XG4gIGlmICghdCkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcIk1pc3NpbmcgTmV0bGlmeSB0b2tlblwiKTtcbiAgICBlcnIuY29kZSA9IFwiQ09ORklHXCI7XG4gICAgZXJyLnN0YXR1cyA9IDUwMDtcbiAgICBlcnIuaGludCA9IFwiU2V0IGEgcGVyLWN1c3RvbWVyIE5ldGxpZnkgdG9rZW4gKHJlY29tbWVuZGVkKSBvciBzZXQgTkVUTElGWV9BVVRIX1RPS0VOIGluIE5ldGxpZnkgZW52IHZhcnMuXCI7XG4gICAgdGhyb3cgZXJyO1xuICB9XG4gIHJldHVybiB0O1xufVxuXG5hc3luYyBmdW5jdGlvbiBuZkZldGNoKHVybCwgaW5pdCA9IHt9LCBuZXRsaWZ5X3Rva2VuID0gbnVsbCkge1xuICBjb25zdCBtZXRob2QgPSAoKGluaXQubWV0aG9kIHx8IFwiR0VUXCIpICsgXCJcIikudG9VcHBlckNhc2UoKTtcbiAgY29uc3QgYm9keSA9IGluaXQuYm9keTtcblxuICBjb25zdCBpc1dlYlJlYWRhYmxlU3RyZWFtID0gYm9keSAmJiB0eXBlb2YgYm9keSA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgYm9keS5nZXRSZWFkZXIgPT09IFwiZnVuY3Rpb25cIjtcbiAgY29uc3QgaXNCdWZmZXIgPSB0eXBlb2YgQnVmZmVyICE9PSBcInVuZGVmaW5lZFwiICYmIEJ1ZmZlci5pc0J1ZmZlcihib2R5KTtcbiAgY29uc3QgaXNVaW50OCA9IGJvZHkgaW5zdGFuY2VvZiBVaW50OEFycmF5O1xuICBjb25zdCBpc0FycmF5QnVmZmVyID0gYm9keSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyO1xuICBjb25zdCBpc1N0cmluZyA9IHR5cGVvZiBib2R5ID09PSBcInN0cmluZ1wiO1xuXG4gIC8vIE9ubHkgcmV0cnkgaWRlbXBvdGVudC1pc2ggcmVxdWVzdHMgd2hlcmUgdGhlIGJvZHkgY2FuIGJlIHNhZmVseSByZXBsYXllZC5cbiAgLy8gLSBHRVQvSEVBRDogc2FmZVxuICAvLyAtIFBVVCB3aXRoIEJ1ZmZlci9VaW50OEFycmF5L0FycmF5QnVmZmVyL3N0cmluZzogc2FmZS1pc2hcbiAgLy8gLSBTdHJlYW1zOiBOT1Qgc2FmZWx5IHJlcGxheWFibGUsIHNvIG5vIHJldHJpZXMuXG4gIGNvbnN0IGNhblJlcGxheUJvZHkgPSAhYm9keSB8fCBpc0J1ZmZlciB8fCBpc1VpbnQ4IHx8IGlzQXJyYXlCdWZmZXIgfHwgaXNTdHJpbmc7XG4gIGNvbnN0IGNhblJldHJ5ID0gKG1ldGhvZCA9PT0gXCJHRVRcIiB8fCBtZXRob2QgPT09IFwiSEVBRFwiIHx8IChtZXRob2QgPT09IFwiUFVUXCIgJiYgY2FuUmVwbGF5Qm9keSkpICYmICFpc1dlYlJlYWRhYmxlU3RyZWFtO1xuXG4gIGNvbnN0IG1heEF0dGVtcHRzID0gY2FuUmV0cnkgPyA1IDogMTtcblxuICBmb3IgKGxldCBhdHRlbXB0ID0gMTsgYXR0ZW1wdCA8PSBtYXhBdHRlbXB0czsgYXR0ZW1wdCsrKSB7XG4gICAgY29uc3QgaGVhZGVycyA9IHtcbiAgICAgIGF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0b2tlbihuZXRsaWZ5X3Rva2VuKX1gLFxuICAgICAgLi4uKGluaXQuaGVhZGVycyB8fCB7fSlcbiAgICB9O1xuXG4gICAgbGV0IHJlcztcbiAgICBsZXQgdGV4dCA9IFwiXCI7XG4gICAgbGV0IGRhdGEgPSBudWxsO1xuXG4gICAgdHJ5IHtcbiAgICAgIHJlcyA9IGF3YWl0IGZldGNoKHVybCwgeyAuLi5pbml0LCBoZWFkZXJzIH0pO1xuICAgICAgdGV4dCA9IGF3YWl0IHJlcy50ZXh0KCk7XG4gICAgICB0cnkgeyBkYXRhID0gSlNPTi5wYXJzZSh0ZXh0KTsgfSBjYXRjaCB7fVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIE5ldHdvcmstbGV2ZWwgZmFpbHVyZTsgcmV0cnkgaWYgYWxsb3dlZC5cbiAgICAgIGlmIChjYW5SZXRyeSAmJiBhdHRlbXB0IDwgbWF4QXR0ZW1wdHMpIHtcbiAgICAgICAgY29uc3QgYmFja29mZiA9IE1hdGgubWluKDgwMDAsIDI1MCAqIE1hdGgucG93KDIsIGF0dGVtcHQgLSAxKSArIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDE1MCkpO1xuICAgICAgICBhd2FpdCBzbGVlcChiYWNrb2ZmKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXCJOZXRsaWZ5IEFQSSBmZXRjaCBmYWlsZWRcIik7XG4gICAgICBlcnIuY29kZSA9IFwiTkVUTElGWV9GRVRDSFwiO1xuICAgICAgZXJyLnN0YXR1cyA9IDUwMjtcbiAgICAgIGVyci5kZXRhaWwgPSBTdHJpbmcoZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBlKTtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG5cbiAgICBpZiAocmVzLm9rKSByZXR1cm4gZGF0YSA/PyB0ZXh0O1xuXG4gICAgY29uc3Qgc3RhdHVzID0gcmVzLnN0YXR1cztcbiAgICBjb25zdCByZXRyeWFibGUgPSBzdGF0dXMgPT09IDQyOSB8fCBzdGF0dXMgPT09IDUwMiB8fCBzdGF0dXMgPT09IDUwMyB8fCBzdGF0dXMgPT09IDUwNDtcblxuICAgIGlmIChjYW5SZXRyeSAmJiByZXRyeWFibGUgJiYgYXR0ZW1wdCA8IG1heEF0dGVtcHRzKSB7XG4gICAgICAvLyBSZXNwZWN0IFJldHJ5LUFmdGVyIGlmIHByZXNlbnQgKHNlY29uZHMpLlxuICAgICAgY29uc3QgcmEgPSByZXMuaGVhZGVycy5nZXQoXCJyZXRyeS1hZnRlclwiKTtcbiAgICAgIGxldCB3YWl0TXMgPSAwO1xuICAgICAgY29uc3Qgc2VjID0gcmEgPyBwYXJzZUludChyYSwgMTApIDogTmFOO1xuICAgICAgaWYgKE51bWJlci5pc0Zpbml0ZShzZWMpICYmIHNlYyA+PSAwKSB3YWl0TXMgPSBNYXRoLm1pbigxNTAwMCwgc2VjICogMTAwMCk7XG4gICAgICBpZiAoIXdhaXRNcykgd2FpdE1zID0gTWF0aC5taW4oMTUwMDAsIDMwMCAqIE1hdGgucG93KDIsIGF0dGVtcHQgLSAxKSArIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDIwMCkpO1xuICAgICAgYXdhaXQgc2xlZXAod2FpdE1zKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgTmV0bGlmeSBBUEkgZXJyb3IgJHtzdGF0dXN9YCk7XG4gICAgZXJyLmNvZGUgPSBcIk5FVExJRllfQVBJXCI7XG4gICAgZXJyLnN0YXR1cyA9IHN0YXR1cztcbiAgICBlcnIuZGV0YWlsID0gZGF0YSB8fCB0ZXh0O1xuICAgIHRocm93IGVycjtcbiAgfVxufVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZURpZ2VzdERlcGxveSh7IHNpdGVfaWQsIGJyYW5jaCwgdGl0bGUsIGZpbGVzLCBuZXRsaWZ5X3Rva2VuID0gbnVsbCB9KSB7XG4gIGNvbnN0IGNsZWFuRmlsZXMgPSB7fTtcbiAgZm9yIChjb25zdCBbcCwgc2hhXSBvZiBPYmplY3QuZW50cmllcyhmaWxlcyB8fCB7fSkpIHtcbiAgICBjb25zdCBrID0gKHAgJiYgcFswXSA9PT0gXCIvXCIpID8gcC5zbGljZSgxKSA6IFN0cmluZyhwIHx8IFwiXCIpO1xuICAgIGlmIChrKSBjbGVhbkZpbGVzW2tdID0gc2hhO1xuICB9XG4gIGNvbnN0IGZpbGVzRm9yTmV0bGlmeSA9IGNsZWFuRmlsZXM7XG4gIGNvbnN0IHFzID0gbmV3IFVSTFNlYXJjaFBhcmFtcygpO1xuICBpZiAoYnJhbmNoKSBxcy5zZXQoXCJicmFuY2hcIiwgYnJhbmNoKTtcbiAgaWYgKHRpdGxlKSBxcy5zZXQoXCJ0aXRsZVwiLCB0aXRsZSk7XG4gIGNvbnN0IHVybCA9IGAke0FQSX0vc2l0ZXMvJHtlbmNvZGVVUklDb21wb25lbnQoc2l0ZV9pZCl9L2RlcGxveXM/JHtxcy50b1N0cmluZygpfWA7XG4gIHJldHVybiBuZkZldGNoKHVybCwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczogeyBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgYXN5bmM6IHRydWUsIGRyYWZ0OiBmYWxzZSwgZmlsZXM6IGZpbGVzRm9yTmV0bGlmeSB9KVxuICB9LCBuZXRsaWZ5X3Rva2VuKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFNpdGVEZXBsb3koeyBzaXRlX2lkLCBkZXBsb3lfaWQsIG5ldGxpZnlfdG9rZW4gPSBudWxsIH0pIHtcbiAgY29uc3QgdXJsID0gYCR7QVBJfS9zaXRlcy8ke2VuY29kZVVSSUNvbXBvbmVudChzaXRlX2lkKX0vZGVwbG95cy8ke2VuY29kZVVSSUNvbXBvbmVudChkZXBsb3lfaWQpfWA7XG4gIHJldHVybiBuZkZldGNoKHVybCwgeyBtZXRob2Q6IFwiR0VUXCIgfSwgbmV0bGlmeV90b2tlbik7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXREZXBsb3koeyBkZXBsb3lfaWQsIG5ldGxpZnlfdG9rZW4gPSBudWxsIH0pIHtcbiAgY29uc3QgdXJsID0gYCR7QVBJfS9kZXBsb3lzLyR7ZW5jb2RlVVJJQ29tcG9uZW50KGRlcGxveV9pZCl9YDtcbiAgcmV0dXJuIG5mRmV0Y2godXJsLCB7IG1ldGhvZDogXCJHRVRcIiB9LCBuZXRsaWZ5X3Rva2VuKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHB1dERlcGxveUZpbGUoeyBkZXBsb3lfaWQsIGRlcGxveV9wYXRoLCBib2R5LCBuZXRsaWZ5X3Rva2VuID0gbnVsbCB9KSB7XG4gIGNvbnN0IGVuY29kZWQgPSBlbmNvZGVVUklDb21wb25lbnRTYWZlUGF0aChkZXBsb3lfcGF0aCk7XG4gIGNvbnN0IHVybCA9IGAke0FQSX0vZGVwbG95cy8ke2VuY29kZVVSSUNvbXBvbmVudChkZXBsb3lfaWQpfS9maWxlcy8ke2VuY29kZWR9YDtcbiAgcmV0dXJuIG5mRmV0Y2godXJsLCB7XG4gICAgbWV0aG9kOiBcIlBVVFwiLFxuICAgIGhlYWRlcnM6IHsgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW1cIiB9LFxuICAgIGJvZHksXG4gICAgZHVwbGV4OiBcImhhbGZcIlxuICB9LCBuZXRsaWZ5X3Rva2VuKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHBvbGxEZXBsb3lVbnRpbCh7IHNpdGVfaWQsIGRlcGxveV9pZCwgdGltZW91dF9tcyA9IDYwMDAwLCBuZXRsaWZ5X3Rva2VuID0gbnVsbCB9KSB7XG4gIGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgbGV0IGQgPSBhd2FpdCBnZXRTaXRlRGVwbG95KHsgc2l0ZV9pZCwgZGVwbG95X2lkLCBuZXRsaWZ5X3Rva2VuIH0pO1xuICB3aGlsZSAoRGF0ZS5ub3coKSAtIHN0YXJ0IDwgdGltZW91dF9tcykge1xuICAgIGNvbnN0IHN0ID0gZD8uc3RhdGUgfHwgXCJcIjtcbiAgICBjb25zdCBoYXNSZXEgPSBBcnJheS5pc0FycmF5KGQ/LnJlcXVpcmVkKSAmJiBkLnJlcXVpcmVkLmxlbmd0aCA+IDA7XG4gICAgaWYgKHN0ID09PSBcInJlYWR5XCIgfHwgc3QgPT09IFwiZXJyb3JcIiB8fCBoYXNSZXEgfHwgKHN0ICYmIHN0ICE9PSBcInByZXBhcmluZ1wiKSkgcmV0dXJuIGQ7XG4gICAgYXdhaXQgc2xlZXAoMTIwMCk7XG4gICAgZCA9IGF3YWl0IGdldFNpdGVEZXBsb3koeyBzaXRlX2lkLCBkZXBsb3lfaWQsIG5ldGxpZnlfdG9rZW4gfSk7XG4gIH1cbiAgcmV0dXJuIGQ7XG59XG4iLCAiaW1wb3J0IHsgcSB9IGZyb20gXCIuL2RiLmpzXCI7XG5cbi8qKlxuICogQmVzdC1lZmZvcnQgYXVkaXQgbG9nOiBmYWlsdXJlcyBuZXZlciBicmVhayB0aGUgbWFpbiByZXF1ZXN0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXVkaXQoYWN0b3IsIGFjdGlvbiwgdGFyZ2V0ID0gbnVsbCwgbWV0YSA9IHt9KSB7XG4gIHRyeSB7XG4gICAgYXdhaXQgcShcbiAgICAgIGBpbnNlcnQgaW50byBhdWRpdF9ldmVudHMoYWN0b3IsIGFjdGlvbiwgdGFyZ2V0LCBtZXRhKSB2YWx1ZXMgKCQxLCQyLCQzLCQ0Ojpqc29uYilgLFxuICAgICAgW2FjdG9yLCBhY3Rpb24sIHRhcmdldCwgSlNPTi5zdHJpbmdpZnkobWV0YSB8fCB7fSldXG4gICAgKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUud2FybihcImF1ZGl0IGZhaWxlZDpcIiwgZT8ubWVzc2FnZSB8fCBlKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IHEgfSBmcm9tIFwiLi9kYi5qc1wiO1xuXG5mdW5jdGlvbiBtb250aFJhbmdlVVRDKG1vbnRoKSB7XG4gIGNvbnN0IFt5LCBtXSA9IFN0cmluZyhtb250aCB8fCBcIlwiKS5zcGxpdChcIi1cIikubWFwKCh4KSA9PiBwYXJzZUludCh4LCAxMCkpO1xuICBpZiAoIXkgfHwgIW0gfHwgbSA8IDEgfHwgbSA+IDEyKSByZXR1cm4gbnVsbDtcbiAgY29uc3Qgc3RhcnQgPSBuZXcgRGF0ZShEYXRlLlVUQyh5LCBtIC0gMSwgMSwgMCwgMCwgMCkpO1xuICBjb25zdCBlbmQgPSBuZXcgRGF0ZShEYXRlLlVUQyh5LCBtLCAxLCAwLCAwLCAwKSk7XG4gIHJldHVybiB7IHN0YXJ0LCBlbmQgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFB1c2hQcmljaW5nKGN1c3RvbWVyX2lkKSB7XG4gIGxldCBwdiA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBiLnByaWNpbmdfdmVyc2lvbiwgYi5tb250aGx5X2NhcF9jZW50cyxcbiAgICAgICAgICAgIHAuYmFzZV9tb250aF9jZW50cywgcC5wZXJfZGVwbG95X2NlbnRzLCBwLnBlcl9nYl9jZW50cywgcC5jdXJyZW5jeVxuICAgICBmcm9tIGN1c3RvbWVyX3B1c2hfYmlsbGluZyBiXG4gICAgIGpvaW4gcHVzaF9wcmljaW5nX3ZlcnNpb25zIHAgb24gcC52ZXJzaW9uID0gYi5wcmljaW5nX3ZlcnNpb25cbiAgICAgd2hlcmUgYi5jdXN0b21lcl9pZD0kMVxuICAgICBsaW1pdCAxYCxcbiAgICBbY3VzdG9tZXJfaWRdXG4gICk7XG5cbiAgaWYgKCFwdi5yb3dDb3VudCkge1xuICAgIHB2ID0gYXdhaXQgcShcbiAgICAgIGBzZWxlY3QgMSBhcyBwcmljaW5nX3ZlcnNpb24sIDAgYXMgbW9udGhseV9jYXBfY2VudHMsXG4gICAgICAgICAgICAgIGJhc2VfbW9udGhfY2VudHMsIHBlcl9kZXBsb3lfY2VudHMsIHBlcl9nYl9jZW50cywgY3VycmVuY3lcbiAgICAgICBmcm9tIHB1c2hfcHJpY2luZ192ZXJzaW9ucyB3aGVyZSB2ZXJzaW9uPTEgbGltaXQgMWAsXG4gICAgICBbXVxuICAgICk7XG4gIH1cbiAgcmV0dXJuIHB2LnJvd0NvdW50ID8gcHYucm93c1swXSA6IG51bGw7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFB1c2hVc2FnZShjdXN0b21lcl9pZCwgcmFuZ2UpIHtcbiAgY29uc3QgdXNhZ2UgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3RcbiAgICAgICAgY291bnQoKikgZmlsdGVyICh3aGVyZSBldmVudF90eXBlPSdkZXBsb3lfcmVhZHknKTo6aW50IGFzIGRlcGxveXNfcmVhZHksXG4gICAgICAgIGNvdW50KCopIGZpbHRlciAod2hlcmUgZXZlbnRfdHlwZT0nZGVwbG95X2luaXQnKTo6aW50IGFzIGRlcGxveXNfaW5pdCxcbiAgICAgICAgY29hbGVzY2Uoc3VtKGJ5dGVzKSBmaWx0ZXIgKHdoZXJlIGV2ZW50X3R5cGU9J2ZpbGVfdXBsb2FkJyksMCk6OmJpZ2ludCBhcyBieXRlc191cGxvYWRlZFxuICAgICBmcm9tIHB1c2hfdXNhZ2VfZXZlbnRzXG4gICAgIHdoZXJlIGN1c3RvbWVyX2lkPSQxIGFuZCBjcmVhdGVkX2F0ID49ICQyIGFuZCBjcmVhdGVkX2F0IDwgJDNgLFxuICAgIFtjdXN0b21lcl9pZCwgcmFuZ2Uuc3RhcnQudG9JU09TdHJpbmcoKSwgcmFuZ2UuZW5kLnRvSVNPU3RyaW5nKCldXG4gICk7XG4gIHJldHVybiB1c2FnZS5yb3dzWzBdIHx8IHsgZGVwbG95c19yZWFkeTogMCwgZGVwbG95c19pbml0OiAwLCBieXRlc191cGxvYWRlZDogMCB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRTdGFnZWRCeXRlcyhjdXN0b21lcl9pZCwgcmFuZ2UpIHtcbiAgLy8gQ291bnQgYnl0ZXMgc3RhZ2VkIGluIGNodW5rIGpvYnMgdGhhdCBoYXZlIG5vdCBiZWVuIGNvbXBsZXRlZC9jbGVhcmVkLlxuICBjb25zdCByZXMgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3QgY29hbGVzY2Uoc3VtKGouYnl0ZXNfc3RhZ2VkKSwwKTo6YmlnaW50IGFzIGJ5dGVzX3N0YWdlZFxuICAgICBmcm9tIHB1c2hfam9icyBqXG4gICAgIGpvaW4gcHVzaF9wdXNoZXMgcCBvbiBwLmlkPWoucHVzaF9yb3dfaWRcbiAgICAgd2hlcmUgcC5jdXN0b21lcl9pZD0kMVxuICAgICAgIGFuZCBwLmNyZWF0ZWRfYXQgPj0gJDIgYW5kIHAuY3JlYXRlZF9hdCA8ICQzXG4gICAgICAgYW5kIGouc3RhdHVzIGluICgndXBsb2FkaW5nJywncXVldWVkJywnYXNzZW1ibGluZycpYCxcbiAgICBbY3VzdG9tZXJfaWQsIHJhbmdlLnN0YXJ0LnRvSVNPU3RyaW5nKCksIHJhbmdlLmVuZC50b0lTT1N0cmluZygpXVxuICApO1xuICByZXR1cm4gTnVtYmVyKHJlcy5yb3dzWzBdPy5ieXRlc19zdGFnZWQgfHwgMCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbmZvcmNlUHVzaENhcCh7IGN1c3RvbWVyX2lkLCBtb250aCwgZXh0cmFfZGVwbG95cyA9IDAsIGV4dHJhX2J5dGVzID0gMCB9KSB7XG4gIGNvbnN0IHJhbmdlID0gbW9udGhSYW5nZVVUQyhtb250aCk7XG4gIGlmICghcmFuZ2UpIHtcbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXCJJbnZhbGlkIG1vbnRoIChZWVlZLU1NKVwiKTtcbiAgICBlcnIuY29kZSA9IFwiQkFEX01PTlRIXCI7XG4gICAgZXJyLnN0YXR1cyA9IDQwMDtcbiAgICB0aHJvdyBlcnI7XG4gIH1cblxuICBjb25zdCBjZmcgPSBhd2FpdCBnZXRQdXNoUHJpY2luZyhjdXN0b21lcl9pZCk7XG4gIGlmICghY2ZnKSByZXR1cm4geyBvazogdHJ1ZSwgY2ZnOiBudWxsIH07IC8vIElmIHB1c2ggcHJpY2luZyBub3QgY29uZmlndXJlZCwgZG9uJ3QgYmxvY2suXG5cbiAgY29uc3QgY2FwID0gTnVtYmVyKGNmZy5tb250aGx5X2NhcF9jZW50cyB8fCAwKTtcbiAgaWYgKCFjYXAgfHwgY2FwIDw9IDApIHJldHVybiB7IG9rOiB0cnVlLCBjZmcgfTsgLy8gY2FwPTAgPT4gdW5saW1pdGVkXG5cbiAgY29uc3QgdXNhZ2UgPSBhd2FpdCBnZXRQdXNoVXNhZ2UoY3VzdG9tZXJfaWQsIHJhbmdlKTtcbiAgY29uc3Qgc3RhZ2VkID0gYXdhaXQgZ2V0U3RhZ2VkQnl0ZXMoY3VzdG9tZXJfaWQsIHJhbmdlKTtcblxuICBjb25zdCBkZXBsb3lzX2luaXQgPSBOdW1iZXIodXNhZ2UuZGVwbG95c19pbml0IHx8IDApO1xuICBjb25zdCBkZXBsb3lzX3JlYWR5ID0gTnVtYmVyKHVzYWdlLmRlcGxveXNfcmVhZHkgfHwgMCk7XG4gIGNvbnN0IGRlcGxveXNfcmVzZXJ2ZWQgPSBNYXRoLm1heCgwLCBkZXBsb3lzX2luaXQgLSBkZXBsb3lzX3JlYWR5KTsgLy8gaW4tcHJvZ3Jlc3MgLyBhdHRlbXB0ZWQgZGVwbG95c1xuICBjb25zdCBkZXBsb3lzX3VzZWQgPSBkZXBsb3lzX3JlYWR5ICsgZGVwbG95c19yZXNlcnZlZCArIE51bWJlcihleHRyYV9kZXBsb3lzIHx8IDApO1xuICBjb25zdCBieXRlc190b3RhbCA9IE51bWJlcih1c2FnZS5ieXRlc191cGxvYWRlZCB8fCAwKSArIE51bWJlcihzdGFnZWQgfHwgMCkgKyBOdW1iZXIoZXh0cmFfYnl0ZXMgfHwgMCk7XG5cbiAgY29uc3QgZ2IgPSBieXRlc190b3RhbCAvIDEwNzM3NDE4MjQ7IC8vIEdpQlxuICBjb25zdCBiYXNlID0gTnVtYmVyKGNmZy5iYXNlX21vbnRoX2NlbnRzIHx8IDApO1xuICBjb25zdCBkZXBsb3lDb3N0ID0gTnVtYmVyKGNmZy5wZXJfZGVwbG95X2NlbnRzIHx8IDApICogZGVwbG95c191c2VkO1xuICBjb25zdCBnYkNvc3QgPSBNYXRoLnJvdW5kKE51bWJlcihjZmcucGVyX2diX2NlbnRzIHx8IDApICogZ2IpO1xuICBjb25zdCB0b3RhbCA9IGJhc2UgKyBkZXBsb3lDb3N0ICsgZ2JDb3N0O1xuXG4gIGlmICh0b3RhbCA+IGNhcCkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcIlB1c2ggbW9udGhseSBjYXAgcmVhY2hlZFwiKTtcbiAgICBlcnIuY29kZSA9IFwiUFVTSF9DQVBfUkVBQ0hFRFwiO1xuICAgIGVyci5zdGF0dXMgPSA0MDI7XG4gICAgZXJyLnBheWxvYWQgPSB7XG4gICAgICBjb2RlOiBcIlBVU0hfQ0FQX1JFQUNIRURcIixcbiAgICAgIG1vbnRoLFxuICAgICAgcHJpY2luZ192ZXJzaW9uOiBjZmcucHJpY2luZ192ZXJzaW9uLFxuICAgICAgbW9udGhseV9jYXBfY2VudHM6IGNhcCxcbiAgICAgIHByb2plY3RlZF90b3RhbF9jZW50czogdG90YWwsXG4gICAgICBjdXJyZW50OiB7XG4gICAgICAgIGRlcGxveXNfaW5pdCxcbiAgICAgICAgZGVwbG95c19yZWFkeSxcbiAgICAgICAgZGVwbG95c19yZXNlcnZlZCxcbiAgICAgICAgYnl0ZXNfdXBsb2FkZWQ6IE51bWJlcih1c2FnZS5ieXRlc191cGxvYWRlZCB8fCAwKSxcbiAgICAgICAgYnl0ZXNfc3RhZ2VkOiBOdW1iZXIoc3RhZ2VkIHx8IDApXG4gICAgICB9LFxuICAgICAgcHJvcG9zZWQ6IHtcbiAgICAgICAgZXh0cmFfZGVwbG95czogTnVtYmVyKGV4dHJhX2RlcGxveXMgfHwgMCksXG4gICAgICAgIGV4dHJhX2J5dGVzOiBOdW1iZXIoZXh0cmFfYnl0ZXMgfHwgMClcbiAgICAgIH1cbiAgICB9O1xuICAgIHRocm93IGVycjtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgb2s6IHRydWUsXG4gICAgY2ZnLFxuICAgIG1vbnRoLFxuICAgIHByb2plY3RlZF90b3RhbF9jZW50czogdG90YWwsXG4gICAgbW9udGhseV9jYXBfY2VudHM6IGNhcCxcbiAgICBjdXJyZW50OiB7XG4gICAgICBkZXBsb3lzX2luaXQsXG4gICAgICBkZXBsb3lzX3JlYWR5LFxuICAgICAgZGVwbG95c19yZXNlcnZlZCxcbiAgICAgIGJ5dGVzX3VwbG9hZGVkOiBOdW1iZXIodXNhZ2UuYnl0ZXNfdXBsb2FkZWQgfHwgMCksXG4gICAgICBieXRlc19zdGFnZWQ6IE51bWJlcihzdGFnZWQgfHwgMClcbiAgICB9XG4gIH07XG59XG4iLCAiaW1wb3J0IHsgd3JhcCB9IGZyb20gXCIuL19saWIvd3JhcC5qc1wiO1xuaW1wb3J0IHsgcSB9IGZyb20gXCIuL19saWIvZGIuanNcIjtcbmltcG9ydCB7IGdldEJlYXJlciwgc2xlZXAsIG1vbnRoS2V5VVRDIH0gZnJvbSBcIi4vX2xpYi9odHRwLmpzXCI7XG5pbXBvcnQgeyBsb29rdXBLZXksIHJlcXVpcmVLZXlSb2xlIH0gZnJvbSBcIi4vX2xpYi9hdXRoei5qc1wiO1xuaW1wb3J0IHsgZ2V0TmV0bGlmeVRva2VuRm9yQ3VzdG9tZXIgfSBmcm9tIFwiLi9fbGliL25ldGxpZnlUb2tlbnMuanNcIjtcbmltcG9ydCB7IGdldERlcGxveSB9IGZyb20gXCIuL19saWIvcHVzaE5ldGxpZnkuanNcIjtcbmltcG9ydCB7IGF1ZGl0IH0gZnJvbSBcIi4vX2xpYi9hdWRpdC5qc1wiO1xuaW1wb3J0IHsgZ2V0UHVzaFByaWNpbmcgfSBmcm9tIFwiLi9fbGliL3B1c2hDYXBzLmpzXCI7XG5cbi8qKlxuICogQmFja2dyb3VuZCBjb21wbGV0aW9uIHdvcmtlci5cbiAqIFRyaWdnZXJlZCBieSBwdXNoLWNvbXBsZXRlIChhc3luYyBtb2RlKSBhbmQgcHJvdGVjdGVkIGJ5IG9wdGlvbmFsIEpPQl9XT1JLRVJfU0VDUkVULlxuICpcbiAqIEVuZHBvaW50OiBQT1NUIC8ubmV0bGlmeS9mdW5jdGlvbnMvcHVzaC1jb21wbGV0ZS1iYWNrZ3JvdW5kXG4gKiBCb2R5OiB7IHB1c2hJZCB9XG4gKi9cbmV4cG9ydCBkZWZhdWx0IHdyYXAoYXN5bmMgKHJlcSkgPT4ge1xuICB0cnkge1xuICAgIC8vIE9wdGlvbmFsIGhhcmQgbG9jazogb25seSBhbGxvdyBpbnRlcm5hbCB0cmlnZ2VyIGlmIEpPQl9XT1JLRVJfU0VDUkVUIGlzIHNldC5cbiAgICBjb25zdCBzZWNyZXQgPSBwcm9jZXNzLmVudi5KT0JfV09SS0VSX1NFQ1JFVDtcbmlmICghc2VjcmV0KSB7XG4gIC8vIEZhaWwgY2xvc2VkIGluIHByb2R1Y3Rpb246IGJhY2tncm91bmQgd29ya2VycyBzaG91bGQgYmUgZ2F0ZWQgYnkgYSBzZWNyZXQgaGVhZGVyLlxuICB0cnkge1xuICAgIGF3YWl0IHEoXG4gICAgICBgaW5zZXJ0IGludG8gZ2F0ZXdheV9ldmVudHMobGV2ZWwsIGZ1bmN0aW9uX25hbWUsIG1lc3NhZ2UsIG1ldGEpXG4gICAgICAgdmFsdWVzICgnd2FybicsJDEsJDIsJ3t9Jzo6anNvbmIpYCxcbiAgICAgIFtcInB1c2gtY29tcGxldGUtYmFja2dyb3VuZFwiLCBcIkpPQl9XT1JLRVJfU0VDUkVUIG5vdCBzZXQ7IGJhY2tncm91bmQgd29ya2VyIHJlZnVzZWRcIl1cbiAgICApO1xuICB9IGNhdGNoIHt9XG4gIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwMiB9KTtcbn1cbmNvbnN0IGdvdCA9IChyZXEuaGVhZGVycy5nZXQoXCJ4LWthaXh1LWpvYi1zZWNyZXRcIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwieC1qb2Itd29ya2VyLXNlY3JldFwiKSB8fCBcIlwiKTtcbmlmIChnb3QgIT09IHNlY3JldCkgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuXG4gICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG5cbiAgICBjb25zdCBrZXkgPSBnZXRCZWFyZXIocmVxKTtcbiAgICBpZiAoIWtleSkgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuXG4gICAgY29uc3Qga3JvdyA9IGF3YWl0IGxvb2t1cEtleShrZXkpO1xuICAgIGlmICgha3JvdykgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuXG4gICAgcmVxdWlyZUtleVJvbGUoa3JvdywgXCJkZXBsb3llclwiKTtcblxuICAgIGxldCBib2R5O1xuICAgIHRyeSB7IGJvZHkgPSBhd2FpdCByZXEuanNvbigpOyB9IGNhdGNoIHsgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pOyB9XG4gICAgY29uc3QgcHVzaElkID0gKGJvZHkucHVzaElkIHx8IFwiXCIpLnRvU3RyaW5nKCk7XG4gICAgaWYgKCFwdXNoSWQpIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwMiB9KTtcblxuICAgIGNvbnN0IHByZXMgPSBhd2FpdCBxKFxuICAgICAgYHNlbGVjdCBpZCwgY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIGRlcGxveV9pZCwgcmVxdWlyZWRfZGlnZXN0cywgdXBsb2FkZWRfZGlnZXN0cywgc3RhdGVcbiAgICAgICBmcm9tIHB1c2hfcHVzaGVzIHdoZXJlIHB1c2hfaWQ9JDEgbGltaXQgMWAsXG4gICAgICBbcHVzaElkXVxuICAgICk7XG4gICAgaWYgKCFwcmVzLnJvd0NvdW50KSByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG4gICAgY29uc3QgcHVzaCA9IHByZXMucm93c1swXTtcbiAgICBpZiAocHVzaC5jdXN0b21lcl9pZCAhPT0ga3Jvdy5jdXN0b21lcl9pZCkgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuXG4gICAgLy8gRG9uXHUyMDE5dCBmaW5hbGl6ZSB1bnRpbCByZXF1aXJlZCB1cGxvYWRzIGFyZSBwcmVzZW50XG4gICAgY29uc3QgcmVxdWlyZWQgPSBwdXNoLnJlcXVpcmVkX2RpZ2VzdHMgfHwgW107XG4gICAgY29uc3QgdXBsb2FkZWQgPSBuZXcgU2V0KHB1c2gudXBsb2FkZWRfZGlnZXN0cyB8fCBbXSk7XG4gICAgY29uc3QgbWlzc2luZyA9IHJlcXVpcmVkLmZpbHRlcigoZCkgPT4gIXVwbG9hZGVkLmhhcyhkKSk7XG4gICAgaWYgKG1pc3NpbmcubGVuZ3RoKSB7XG4gICAgICBhd2FpdCBxKGB1cGRhdGUgcHVzaF9wdXNoZXMgc2V0IHN0YXRlPSdtaXNzaW5nX3VwbG9hZHMnLCBlcnJvcj0kMiwgdXBkYXRlZF9hdD1ub3coKSB3aGVyZSBpZD0kMWAsXG4gICAgICAgIFtwdXNoLmlkLCBgTWlzc2luZyAke21pc3NpbmcubGVuZ3RofSByZXF1aXJlZCB1cGxvYWRzYF1cbiAgICAgICk7XG4gICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG4gICAgfVxuXG4gICAgYXdhaXQgcShgdXBkYXRlIHB1c2hfcHVzaGVzIHNldCBzdGF0ZT0nZmluYWxpemluZycsIHVwZGF0ZWRfYXQ9bm93KCkgd2hlcmUgaWQ9JDFgLCBbcHVzaC5pZF0pO1xuXG4gICAgY29uc3QgbmV0bGlmeV90b2tlbiA9IGF3YWl0IGdldE5ldGxpZnlUb2tlbkZvckN1c3RvbWVyKGtyb3cuY3VzdG9tZXJfaWQpO1xuXG4gICAgLy8gUG9sbCB1cCB0byAxMCBtaW51dGVzXG4gICAgbGV0IGQgPSBhd2FpdCBnZXREZXBsb3koeyBkZXBsb3lfaWQ6IHB1c2guZGVwbG95X2lkLCBuZXRsaWZ5X3Rva2VuIH0pO1xuICAgIGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgICB3aGlsZSAoRGF0ZS5ub3coKSAtIHN0YXJ0IDwgNjAwMDAwKSB7XG4gICAgICBpZiAoZD8uc3RhdGUgPT09IFwicmVhZHlcIiB8fCBkPy5zdGF0ZSA9PT0gXCJlcnJvclwiKSBicmVhaztcbiAgICAgIGF3YWl0IHNsZWVwKDIwMDApO1xuICAgICAgZCA9IGF3YWl0IGdldERlcGxveSh7IGRlcGxveV9pZDogcHVzaC5kZXBsb3lfaWQsIG5ldGxpZnlfdG9rZW4gfSk7XG4gICAgfVxuXG4gICAgY29uc3Qgc3RhdGUgPSBkPy5zdGF0ZSB8fCBcInVua25vd25cIjtcbiAgICBjb25zdCB1cmwgPSBkPy5zc2xfdXJsIHx8IGQ/LnVybCB8fCBudWxsO1xuICAgIGNvbnN0IGVyciA9IHN0YXRlID09PSBcImVycm9yXCIgPyAoZD8uZXJyb3JfbWVzc2FnZSB8fCBcIk5ldGxpZnkgZGVwbG95IGVycm9yXCIpIDogKHN0YXRlID09PSBcInJlYWR5XCIgPyBudWxsIDogXCJUaW1lZCBvdXQgd2FpdGluZyBmb3IgZGVwbG95XCIpO1xuXG4gICAgYXdhaXQgcShcbiAgICAgIGB1cGRhdGUgcHVzaF9wdXNoZXMgc2V0IHN0YXRlPSQyLCB1cmw9JDMsIGVycm9yPSQ0LCB1cGRhdGVkX2F0PW5vdygpIHdoZXJlIGlkPSQxYCxcbiAgICAgIFtwdXNoLmlkLCBzdGF0ZSwgdXJsLCBlcnJdXG4gICAgKTtcblxuICAgIC8vIEluc2VydCB1c2FnZSBldmVudCBvbmNlIChhdm9pZCBkdXBsaWNhdGVzKVxuICAgIGNvbnN0IGV2VHlwZSA9IHN0YXRlID09PSBcInJlYWR5XCIgPyBcImRlcGxveV9yZWFkeVwiIDogXCJkZXBsb3lfZXJyb3JcIjtcbiAgICBjb25zdCBhbHJlYWR5ID0gYXdhaXQgcShcbiAgICAgIGBzZWxlY3QgaWQgZnJvbSBwdXNoX3VzYWdlX2V2ZW50cyB3aGVyZSBwdXNoX3Jvd19pZD0kMSBhbmQgZXZlbnRfdHlwZT0kMiBsaW1pdCAxYCxcbiAgICAgIFtwdXNoLmlkLCBldlR5cGVdXG4gICAgKTtcbiAgICBpZiAoIWFscmVhZHkucm93Q291bnQpIHtcbiAgICAgIGNvbnN0IG1vbnRoID0gbW9udGhLZXlVVEMoKTtcbiAgICAgIGNvbnN0IGNmZyA9IGF3YWl0IGdldFB1c2hQcmljaW5nKGtyb3cuY3VzdG9tZXJfaWQpO1xuICAgICAgY29uc3QgcHYgPSBjZmc/LnByaWNpbmdfdmVyc2lvbiA/PyAxO1xuXG4gICAgICBhd2FpdCBxKFxuICAgICAgICBgaW5zZXJ0IGludG8gcHVzaF91c2FnZV9ldmVudHMoY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIHB1c2hfcm93X2lkLCBldmVudF90eXBlLCBieXRlcywgcHJpY2luZ192ZXJzaW9uLCBjb3N0X2NlbnRzLCBtZXRhKVxuICAgICAgICAgdmFsdWVzICgkMSwkMiwkMywkNCwwLCQ2LDAsJDU6Ompzb25iKWAsXG4gICAgICAgIFtrcm93LmN1c3RvbWVyX2lkLCBrcm93LmFwaV9rZXlfaWQsIHB1c2guaWQsIGV2VHlwZSwgSlNPTi5zdHJpbmdpZnkoeyB1cmwsIGVycm9yOiBlcnIsIG1vbnRoIH0pLCBwdl1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgYXdhaXQgYXVkaXQoYGtleToke2tyb3cua2V5X2xhc3Q0fWAsIFwiUFVTSF9DT01QTEVURV9CR1wiLCBgcHVzaDoke3B1c2hJZH1gLCB7IHN0YXRlLCB1cmwsIGVycm9yOiBlcnIgfSk7XG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG4gIH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7OztBQUFPLFNBQVMsVUFBVSxLQUFLO0FBQzdCLFFBQU0sWUFBWSxRQUFRLElB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QTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVdBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BV0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFRQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU9BO0FBQUEsTUFBMkc7QUFBQSxNQUMzRztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFZQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BR0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BUUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVVBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BbUJBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUErQkE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUEsTUFHQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BTUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVVBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWtCQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BZUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFPQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFTQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFZQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFTQTtBQUFBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BT0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQXVCQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBLE1BR0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFlQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BaUJBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU9BO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFXQTtBQUFBLElBRU47QUFFSSxlQUFXLEtBQUssWUFBWTtBQUMxQixZQUFNLElBQUksTUFBTSxDQUFDO0FBQUEsSUFDbkI7QUFBQSxFQUNG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QUFFLDJFQUEyRSxDQUFDLEtBQUssRUFBRSxDQUFDO0FBRTVGLFVBQU0sZ0JBQWdCLE1BQU0sMkJBQTJCLEtBQUssV0FBVztBQUd2RSxRQUFJLElBQUksTUFBTSxVQUFVLEVBQUUsV0FBVyxLQUFLLFdBQVcsY0FBYyxDQUFDO0FBQ3BFLFVBQU0sUUFBUSxLQUFLLElBQUk7QUFDdkIsV0FBTyxLQUFLLElBQUksSUFBSSxRQUFRLEtBQVE7QUFDbEMsVUFBSSxHQUFHLFVBQVUsV0FBVyxHQUFHLFVBQVUsUUFBUztBQUNsRCxZQUFNLE1BQU0sR0FBSTtBQUNoQixVQUFJLE1BQU0sVUFBVSxFQUFFLFdBQVcsS0FBSyxXQUFXLGNBQWMsQ0FBQztBQUFBLElBQ2xFO0FBRUEsVUFBTSxRQUFRLEdBQUcsU0FBUztBQUMxQixVQUFNLE1BQU0sR0FBRyxXQUFXLEdBQUcsT0FBTztBQUNwQyxVQUFNLE1BQU0sVUFBVSxVQUFXLEdBQUcsaUJBQWlCLHlCQUEyQixVQUFVLFVBQVUsT0FBTztBQUUzRyxVQUFNO0FBQUEsTUFDSjtBQUFBLE1BQ0EsQ0FBQyxLQUFLLElBQUksT0FBTyxLQUFLLEdBQUc7QUFBQSxJQUMzQjtBQUdBLFVBQU0sU0FBUyxVQUFVLFVBQVUsaUJBQWlCO0FBQ3BELFVBQU0sVUFBVSxNQUFNO0FBQUEsTUFDcEI7QUFBQSxNQUNBLENBQUMsS0FBSyxJQUFJLE1BQU07QUFBQSxJQUNsQjtBQUNBLFFBQUksQ0FBQyxRQUFRLFVBQVU7QUFDckIsWUFBTSxRQUFRLFlBQVk7QUFDMUIsWUFBTSxNQUFNLE1BQU0sZUFBZSxLQUFLLFdBQVc7QUFDakQsWUFBTSxLQUFLLEtBQUssbUJBQW1CO0FBRW5DLFlBQU07QUFBQSxRQUNKO0FBQUE7QUFBQSxRQUVBLENBQUMsS0FBSyxhQUFhLEtBQUssWUFBWSxLQUFLLElBQUksUUFBUSxLQUFLLFVBQVUsRUFBRSxLQUFLLE9BQU8sS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFO0FBQUEsTUFDckc7QUFBQSxJQUNGO0FBRUEsVUFBTSxNQUFNLE9BQU8sS0FBSyxTQUFTLElBQUksb0JBQW9CLFFBQVEsTUFBTSxJQUFJLEVBQUUsT0FBTyxLQUFLLE9BQU8sSUFBSSxDQUFDO0FBQ3JHLFdBQU8sSUFBSSxTQUFTLElBQUksRUFBRSxRQUFRLElBQUksQ0FBQztBQUFBLEVBQ3pDLFFBQVE7QUFDTixXQUFPLElBQUksU0FBUyxJQUFJLEVBQUUsUUFBUSxJQUFJLENBQUM7QUFBQSxFQUN6QztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbImVyciIsICJkIl0KfQo=
