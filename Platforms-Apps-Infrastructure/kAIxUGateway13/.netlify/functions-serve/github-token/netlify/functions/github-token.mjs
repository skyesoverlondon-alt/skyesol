
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
function badRequest(message, headers = {}) {
  return json(400, { error: message }, headers);
}
function getBearer(req) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
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
function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
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
function encryptSecret(plaintext) {
  const key = encKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${base64url(iv)}:${base64url(tag)}:${base64url(ct)}`;
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

// netlify/functions/_lib/githubTokens.js
async function getGitHubTokenForCustomer(customer_id) {
  const res = await q(`select token_enc from customer_github_tokens where customer_id=$1`, [customer_id]);
  if (res.rows.length) {
    const dec = decryptSecret(res.rows[0].token_enc);
    if (dec) return dec;
  }
  return null;
}
async function setGitHubTokenForCustomer(customer_id, token_plain, token_type = "oauth", scopes = []) {
  const enc = encryptSecret(token_plain);
  const scopesArr = Array.isArray(scopes) ? scopes.map((s) => String(s).trim()).filter(Boolean) : [];
  await q(
    `insert into customer_github_tokens(customer_id, token_enc, token_type, scopes, created_at, updated_at)
     values ($1,$2,$3,$4,now(),now())
     on conflict (customer_id)
     do update set token_enc=excluded.token_enc, token_type=excluded.token_type, scopes=excluded.scopes, updated_at=now()`,
    [customer_id, enc, token_type, scopesArr]
  );
}
async function clearGitHubTokenForCustomer(customer_id) {
  await q(`delete from customer_github_tokens where customer_id=$1`, [customer_id]);
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

// netlify/functions/github-token.js
var github_token_default = wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  const key = getBearer(req);
  if (!key) return json(401, { error: "Missing Authorization Bearer Kaixu Key" }, cors);
  const krow = await lookupKey(key);
  if (!krow) return json(401, { error: "Invalid Kaixu Key" }, cors);
  if (req.method === "GET") {
    requireKeyRole(krow, "viewer");
    const r = await q(
      `select token_type, scopes, updated_at from customer_github_tokens where customer_id=$1 limit 1`,
      [krow.customer_id]
    );
    const connected = !!r.rowCount;
    let whoami = null;
    if (connected && (krow.role === "admin" || krow.role === "owner")) {
      const token = await getGitHubTokenForCustomer(krow.customer_id);
      if (token) {
        try {
          whoami = await ghGet("/user", token);
        } catch {
        }
      }
    }
    return json(200, {
      ok: true,
      connected,
      token_type: connected ? r.rows[0].token_type : null,
      scopes: connected ? r.rows[0].scopes || [] : [],
      updated_at: connected ? r.rows[0].updated_at : null,
      whoami
    }, cors);
  }
  if (req.method === "POST") {
    requireKeyRole(krow, "admin");
    let body;
    try {
      body = await req.json();
    } catch {
      return badRequest("Invalid JSON", cors);
    }
    const token = (body.token || "").toString().trim();
    if (!token) return badRequest("Missing token", cors);
    const token_type = (body.token_type || "pat").toString().slice(0, 32);
    const scopes = Array.isArray(body.scopes) ? body.scopes : [];
    await setGitHubTokenForCustomer(krow.customer_id, token, token_type, scopes);
    await audit(`key:${krow.key_last4}`, "GITHUB_TOKEN_SET", `customer:${krow.customer_id}`, {
      token_type,
      scopes_count: Array.isArray(scopes) ? scopes.length : 0
    });
    return json(200, { ok: true }, cors);
  }
  if (req.method === "DELETE") {
    requireKeyRole(krow, "admin");
    await clearGitHubTokenForCustomer(krow.customer_id);
    await audit(`key:${krow.key_last4}`, "GITHUB_TOKEN_CLEAR", `customer:${krow.customer_id}`);
    return json(200, { ok: true }, cors);
  }
  return json(405, { error: "Method not allowed" }, cors);
});
export {
  github_token_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9odHRwLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvZGIuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9tb25pdG9yLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvd3JhcC5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2NyeXB0by5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2F1dGh6LmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvYXVkaXQuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9naXRodWJUb2tlbnMuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9naXRodWIuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvZ2l0aHViLXRva2VuLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJleHBvcnQgZnVuY3Rpb24gYnVpbGRDb3JzKHJlcSkge1xuICBjb25zdCBhbGxvd1JhdyA9IChwcm9jZXNzLmVudi5BTExPV0VEX09SSUdJTlMgfHwgXCJcIikudHJpbSgpO1xuICBjb25zdCByZXFPcmlnaW4gPSByZXEuaGVhZGVycy5nZXQoXCJvcmlnaW5cIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiT3JpZ2luXCIpO1xuXG4gIC8vIElNUE9SVEFOVDoga2VlcCB0aGlzIGxpc3QgYWxpZ25lZCB3aXRoIHdoYXRldmVyIGhlYWRlcnMgeW91ciBhcHBzIHNlbmQuXG4gIGNvbnN0IGFsbG93SGVhZGVycyA9IFwiYXV0aG9yaXphdGlvbiwgY29udGVudC10eXBlLCB4LWthaXh1LWluc3RhbGwtaWQsIHgta2FpeHUtcmVxdWVzdC1pZCwgeC1rYWl4dS1hcHAsIHgta2FpeHUtYnVpbGQsIHgtYWRtaW4tcGFzc3dvcmQsIHgta2FpeHUtZXJyb3ItdG9rZW4sIHgta2FpeHUtbW9kZSwgeC1jb250ZW50LXNoYTEsIHgtc2V0dXAtc2VjcmV0LCB4LWthaXh1LWpvYi1zZWNyZXQsIHgtam9iLXdvcmtlci1zZWNyZXRcIjtcbiAgY29uc3QgYWxsb3dNZXRob2RzID0gXCJHRVQsUE9TVCxQVVQsUEFUQ0gsREVMRVRFLE9QVElPTlNcIjtcblxuICBjb25zdCBiYXNlID0ge1xuICAgIFwiYWNjZXNzLWNvbnRyb2wtYWxsb3ctaGVhZGVyc1wiOiBhbGxvd0hlYWRlcnMsXG4gICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1tZXRob2RzXCI6IGFsbG93TWV0aG9kcyxcbiAgICBcImFjY2Vzcy1jb250cm9sLWV4cG9zZS1oZWFkZXJzXCI6IFwieC1rYWl4dS1yZXF1ZXN0LWlkXCIsXG4gICAgXCJhY2Nlc3MtY29udHJvbC1tYXgtYWdlXCI6IFwiODY0MDBcIlxuICB9O1xuXG4gIC8vIFNUUklDVCBCWSBERUZBVUxUOlxuICAvLyAtIElmIEFMTE9XRURfT1JJR0lOUyBpcyB1bnNldC9ibGFuayBhbmQgYSBicm93c2VyIE9yaWdpbiBpcyBwcmVzZW50LCB3ZSBkbyBOT1QgZ3JhbnQgQ09SUy5cbiAgLy8gLSBBbGxvdy1hbGwgaXMgb25seSBlbmFibGVkIHdoZW4gQUxMT1dFRF9PUklHSU5TIGV4cGxpY2l0bHkgY29udGFpbnMgXCIqXCIuXG4gIGlmICghYWxsb3dSYXcpIHtcbiAgICAvLyBObyBhbGxvdy1vcmlnaW4gZ3JhbnRlZC4gU2VydmVyLXRvLXNlcnZlciByZXF1ZXN0cyAobm8gT3JpZ2luIGhlYWRlcikgc3RpbGwgd29yayBub3JtYWxseS5cbiAgICByZXR1cm4ge1xuICAgICAgLi4uYmFzZSxcbiAgICAgIC4uLihyZXFPcmlnaW4gPyB7IHZhcnk6IFwiT3JpZ2luXCIgfSA6IHt9KVxuICAgIH07XG4gIH1cblxuICBjb25zdCBhbGxvd2VkID0gYWxsb3dSYXcuc3BsaXQoXCIsXCIpLm1hcCgocykgPT4gcy50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcblxuICAvLyBFeHBsaWNpdCBhbGxvdy1hbGxcbiAgaWYgKGFsbG93ZWQuaW5jbHVkZXMoXCIqXCIpKSB7XG4gICAgY29uc3Qgb3JpZ2luID0gcmVxT3JpZ2luIHx8IFwiKlwiO1xuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlLFxuICAgICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1vcmlnaW5cIjogb3JpZ2luLFxuICAgICAgLi4uKHJlcU9yaWdpbiA/IHsgdmFyeTogXCJPcmlnaW5cIiB9IDoge30pXG4gICAgfTtcbiAgfVxuXG4gIC8vIEV4YWN0LW1hdGNoIGFsbG93bGlzdFxuICBpZiAocmVxT3JpZ2luICYmIGFsbG93ZWQuaW5jbHVkZXMocmVxT3JpZ2luKSkge1xuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlLFxuICAgICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1vcmlnaW5cIjogcmVxT3JpZ2luLFxuICAgICAgdmFyeTogXCJPcmlnaW5cIlxuICAgIH07XG4gIH1cblxuICAvLyBPcmlnaW4gcHJlc2VudCBidXQgbm90IGFsbG93ZWQ6IGRvIG5vdCBncmFudCBhbGxvdy1vcmlnaW4uXG4gIHJldHVybiB7XG4gICAgLi4uYmFzZSxcbiAgICAuLi4ocmVxT3JpZ2luID8geyB2YXJ5OiBcIk9yaWdpblwiIH0gOiB7fSlcbiAgfTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24ganNvbihzdGF0dXMsIGJvZHksIGhlYWRlcnMgPSB7fSkge1xuICByZXR1cm4gbmV3IFJlc3BvbnNlKEpTT04uc3RyaW5naWZ5KGJvZHkpLCB7XG4gICAgc3RhdHVzLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOFwiLFxuICAgICAgLi4uaGVhZGVyc1xuICAgIH1cbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZXh0KHN0YXR1cywgYm9keSwgaGVhZGVycyA9IHt9KSB7XG4gIHJldHVybiBuZXcgUmVzcG9uc2UoYm9keSwgeyBzdGF0dXMsIGhlYWRlcnMgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBiYWRSZXF1ZXN0KG1lc3NhZ2UsIGhlYWRlcnMgPSB7fSkge1xuICByZXR1cm4ganNvbig0MDAsIHsgZXJyb3I6IG1lc3NhZ2UgfSwgaGVhZGVycyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRCZWFyZXIocmVxKSB7XG4gIGNvbnN0IGF1dGggPSByZXEuaGVhZGVycy5nZXQoXCJhdXRob3JpemF0aW9uXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIkF1dGhvcml6YXRpb25cIikgfHwgXCJcIjtcbiAgaWYgKCFhdXRoLnN0YXJ0c1dpdGgoXCJCZWFyZXIgXCIpKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIGF1dGguc2xpY2UoNykudHJpbSgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbW9udGhLZXlVVEMoZCA9IG5ldyBEYXRlKCkpIHtcbiAgcmV0dXJuIGQudG9JU09TdHJpbmcoKS5zbGljZSgwLCA3KTsgLy8gWVlZWS1NTVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5zdGFsbElkKHJlcSkge1xuICByZXR1cm4gKFxuICAgIHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtaW5zdGFsbC1pZFwiKSB8fFxuICAgIHJlcS5oZWFkZXJzLmdldChcIlgtS2FpeHUtSW5zdGFsbC1JZFwiKSB8fFxuICAgIFwiXCJcbiAgKS50b1N0cmluZygpLnRyaW0oKS5zbGljZSgwLCA4MCkgfHwgbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFVzZXJBZ2VudChyZXEpIHtcbiAgcmV0dXJuIChyZXEuaGVhZGVycy5nZXQoXCJ1c2VyLWFnZW50XCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIlVzZXItQWdlbnRcIikgfHwgXCJcIikudG9TdHJpbmcoKS5zbGljZSgwLCAyNDApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q2xpZW50SXAocmVxKSB7XG4gIC8vIE5ldGxpZnkgYWRkcyB4LW5mLWNsaWVudC1jb25uZWN0aW9uLWlwIHdoZW4gZGVwbG95ZWQgKG1heSBiZSBtaXNzaW5nIGluIG5ldGxpZnkgZGV2KS5cbiAgY29uc3QgYSA9IChyZXEuaGVhZGVycy5nZXQoXCJ4LW5mLWNsaWVudC1jb25uZWN0aW9uLWlwXCIpIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpO1xuICBpZiAoYSkgcmV0dXJuIGE7XG5cbiAgLy8gRmFsbGJhY2sgdG8gZmlyc3QgWC1Gb3J3YXJkZWQtRm9yIGVudHJ5LlxuICBjb25zdCB4ZmYgPSAocmVxLmhlYWRlcnMuZ2V0KFwieC1mb3J3YXJkZWQtZm9yXCIpIHx8IFwiXCIpLnRvU3RyaW5nKCk7XG4gIGlmICgheGZmKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgZmlyc3QgPSB4ZmYuc3BsaXQoXCIsXCIpWzBdLnRyaW0oKTtcbiAgcmV0dXJuIGZpcnN0IHx8IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzbGVlcChtcykge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgbXMpKTtcbn0iLCAiaW1wb3J0IHsgbmVvbiB9IGZyb20gXCJAbmV0bGlmeS9uZW9uXCI7XG5cbi8qKlxuICogTmV0bGlmeSBEQiAoTmVvbiBQb3N0Z3JlcykgaGVscGVyLlxuICpcbiAqIElNUE9SVEFOVCAoTmVvbiBzZXJ2ZXJsZXNzIGRyaXZlciwgMjAyNSspOlxuICogLSBgbmVvbigpYCByZXR1cm5zIGEgdGFnZ2VkLXRlbXBsYXRlIHF1ZXJ5IGZ1bmN0aW9uLlxuICogLSBGb3IgZHluYW1pYyBTUUwgc3RyaW5ncyArICQxIHBsYWNlaG9sZGVycywgdXNlIGBzcWwucXVlcnkodGV4dCwgcGFyYW1zKWAuXG4gKiAgIChDYWxsaW5nIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvbiBsaWtlIHNxbChcIlNFTEVDVCAuLi5cIikgY2FuIGJyZWFrIG9uIG5ld2VyIGRyaXZlciB2ZXJzaW9ucy4pXG4gKlxuICogTmV0bGlmeSBEQiBhdXRvbWF0aWNhbGx5IGluamVjdHMgYE5FVExJRllfREFUQUJBU0VfVVJMYCB3aGVuIHRoZSBOZW9uIGV4dGVuc2lvbiBpcyBhdHRhY2hlZC5cbiAqL1xuXG5sZXQgX3NxbCA9IG51bGw7XG5sZXQgX3NjaGVtYVByb21pc2UgPSBudWxsO1xuXG5mdW5jdGlvbiBnZXRTcWwoKSB7XG4gIGlmIChfc3FsKSByZXR1cm4gX3NxbDtcblxuICBjb25zdCBoYXNEYlVybCA9ICEhKHByb2Nlc3MuZW52Lk5FVExJRllfREFUQUJBU0VfVVJMIHx8IHByb2Nlc3MuZW52LkRBVEFCQVNFX1VSTCk7XG4gIGlmICghaGFzRGJVcmwpIHtcbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXCJEYXRhYmFzZSBub3QgY29uZmlndXJlZCAobWlzc2luZyBORVRMSUZZX0RBVEFCQVNFX1VSTCkuIEF0dGFjaCBOZXRsaWZ5IERCIChOZW9uKSB0byB0aGlzIHNpdGUuXCIpO1xuICAgIGVyci5jb2RlID0gXCJEQl9OT1RfQ09ORklHVVJFRFwiO1xuICAgIGVyci5zdGF0dXMgPSA1MDA7XG4gICAgZXJyLmhpbnQgPSBcIk5ldGxpZnkgVUkgXHUyMTkyIEV4dGVuc2lvbnMgXHUyMTkyIE5lb24gXHUyMTkyIEFkZCBkYXRhYmFzZSAob3IgcnVuOiBucHggbmV0bGlmeSBkYiBpbml0KS5cIjtcbiAgICB0aHJvdyBlcnI7XG4gIH1cblxuICBfc3FsID0gbmVvbigpOyAvLyBhdXRvLXVzZXMgcHJvY2Vzcy5lbnYuTkVUTElGWV9EQVRBQkFTRV9VUkwgb24gTmV0bGlmeVxuICByZXR1cm4gX3NxbDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZW5zdXJlU2NoZW1hKCkge1xuICBpZiAoX3NjaGVtYVByb21pc2UpIHJldHVybiBfc2NoZW1hUHJvbWlzZTtcblxuICBfc2NoZW1hUHJvbWlzZSA9IChhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgc3FsID0gZ2V0U3FsKCk7XG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IFtcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcnMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGVtYWlsIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBwbGFuX25hbWUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdzdGFydGVyJyxcbiAgICAgICAgbW9udGhseV9jYXBfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDIwMDAsXG4gICAgICAgIGlzX2FjdGl2ZSBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgdHJ1ZSxcbiAgICAgICAgc3RyaXBlX2N1c3RvbWVyX2lkIHRleHQsXG4gICAgICAgIHN0cmlwZV9zdWJzY3JpcHRpb25faWQgdGV4dCxcbiAgICAgICAgc3RyaXBlX3N0YXR1cyB0ZXh0LFxuICAgICAgICBzdHJpcGVfY3VycmVudF9wZXJpb2RfZW5kIHRpbWVzdGFtcHR6LFxuICAgICAgICBhdXRvX3RvcHVwX2VuYWJsZWQgYm9vbGVhbiBub3QgbnVsbCBkZWZhdWx0IGZhbHNlLFxuICAgICAgICBhdXRvX3RvcHVwX2Ftb3VudF9jZW50cyBpbnRlZ2VyLFxuICAgICAgICBhdXRvX3RvcHVwX3RocmVzaG9sZF9jZW50cyBpbnRlZ2VyLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhcGlfa2V5cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAga2V5X2hhc2ggdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIGtleV9sYXN0NCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBsYWJlbCB0ZXh0LFxuICAgICAgICBtb250aGx5X2NhcF9jZW50cyBpbnRlZ2VyLFxuICAgICAgICBycG1fbGltaXQgaW50ZWdlcixcbiAgICAgICAgcnBkX2xpbWl0IGludGVnZXIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcmV2b2tlZF9hdCB0aW1lc3RhbXB0elxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFwaV9rZXlzX2N1c3RvbWVyX2lkX2lkeCBvbiBhcGlfa2V5cyhjdXN0b21lcl9pZCk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBtb250aGx5X3VzYWdlIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc3BlbnRfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGV4dHJhX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBtb250aGx5X2tleV91c2FnZSAoXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzcGVudF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgaW5wdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjYWxscyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoYXBpX2tleV9pZCwgbW9udGgpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgbW9udGhseV9rZXlfdXNhZ2VfY3VzdG9tZXJfbW9udGhfaWR4IG9uIG1vbnRobHlfa2V5X3VzYWdlKGN1c3RvbWVyX2lkLCBtb250aCk7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBtb250aGx5X2tleV91c2FnZSBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgY2FsbHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDA7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtb2RlbCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHVzYWdlX2V2ZW50c19jdXN0b21lcl9tb250aF9pZHggb24gdXNhZ2VfZXZlbnRzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzX2tleV9pZHggb24gdXNhZ2VfZXZlbnRzKGFwaV9rZXlfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhdWRpdF9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGFjdG9yIHRleHQgbm90IG51bGwsXG4gICAgICAgIGFjdGlvbiB0ZXh0IG5vdCBudWxsLFxuICAgICAgICB0YXJnZXQgdGV4dCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhdWRpdF9ldmVudHNfY3JlYXRlZF9pZHggb24gYXVkaXRfZXZlbnRzKGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyByYXRlX2xpbWl0X3dpbmRvd3MgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgd2luZG93X3N0YXJ0IHRpbWVzdGFtcHR6IG5vdCBudWxsLFxuICAgICAgICBjb3VudCBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCB3aW5kb3dfc3RhcnQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcmF0ZV9saW1pdF93aW5kb3dzX3dpbmRvd19pZHggb24gcmF0ZV9saW1pdF93aW5kb3dzKHdpbmRvd19zdGFydCBkZXNjKTtgLCAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9zZWVuX2F0IHRpbWVzdGFtcHR6O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxhc3Rfc2Vlbl9pbnN0YWxsX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSB1c2FnZV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGluc3RhbGxfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHVzYWdlX2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgaXBfaGFzaCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgdXNhZ2VfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyB1YSB0ZXh0O2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzX2luc3RhbGxfaWR4IG9uIHVzYWdlX2V2ZW50cyhpbnN0YWxsX2lkKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGFsZXJ0c19zZW50IChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIGFsZXJ0X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIG1vbnRoLCBhbGVydF90eXBlKVxuICAgICAgKTtgLFxuICAgIFxuICAgICAgLy8gLS0tIERldmljZSBiaW5kaW5nIC8gc2VhdHMgLS0tXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtYXhfZGV2aWNlc19wZXJfa2V5IGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlcXVpcmVfaW5zdGFsbF9pZCBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgZmFsc2U7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfcHJvdmlkZXJzIHRleHRbXTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9tb2RlbHMganNvbmI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHN0cmlwZV9jdXJyZW50X3BlcmlvZF9lbmQgdGltZXN0YW1wdHo7YCxcblxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtYXhfZGV2aWNlcyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlcXVpcmVfaW5zdGFsbF9pZCBib29sZWFuO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfcHJvdmlkZXJzIHRleHRbXTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhbGxvd2VkX21vZGVscyBqc29uYjtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMga2V5X2RldmljZXMgKFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgaW5zdGFsbF9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBkZXZpY2VfbGFiZWwgdGV4dCxcbiAgICAgICAgZmlyc3Rfc2Vlbl9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBsYXN0X3NlZW5fYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGxhc3Rfc2Vlbl91YSB0ZXh0LFxuICAgICAgICByZXZva2VkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICByZXZva2VkX2J5IHRleHQsXG4gICAgICAgIHByaW1hcnkga2V5IChhcGlfa2V5X2lkLCBpbnN0YWxsX2lkKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGtleV9kZXZpY2VzX2N1c3RvbWVyX2lkeCBvbiBrZXlfZGV2aWNlcyhjdXN0b21lcl9pZCk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBrZXlfZGV2aWNlc19sYXN0X3NlZW5faWR4IG9uIGtleV9kZXZpY2VzKGxhc3Rfc2Vlbl9hdCBkZXNjKTtgLFxuXG4gICAgICAvLyAtLS0gSW52b2ljZSBzbmFwc2hvdHMgKyB0b3B1cHMgLS0tXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgbW9udGhseV9pbnZvaWNlcyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHNuYXBzaG90IGpzb25iIG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB0b3B1cF9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIGFtb3VudF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsLFxuICAgICAgICBzb3VyY2UgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdtYW51YWwnLFxuICAgICAgICBzdHJpcGVfc2Vzc2lvbl9pZCB0ZXh0LFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdhcHBsaWVkJyxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdG9wdXBfZXZlbnRzX2N1c3RvbWVyX21vbnRoX2lkeCBvbiB0b3B1cF9ldmVudHMoY3VzdG9tZXJfaWQsIG1vbnRoKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgYXN5bmNfam9icyAoXG4gICAgICAgIGlkIHV1aWQgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtb2RlbCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICByZXF1ZXN0IGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3F1ZXVlZCcsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgc3RhcnRlZF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgY29tcGxldGVkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBoZWFydGJlYXRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIG91dHB1dF90ZXh0IHRleHQsXG4gICAgICAgIGVycm9yIHRleHQsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXN5bmNfam9ic19jdXN0b21lcl9jcmVhdGVkX2lkeCBvbiBhc3luY19qb2JzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXN5bmNfam9ic19zdGF0dXNfaWR4IG9uIGFzeW5jX2pvYnMoc3RhdHVzLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIHJlcXVlc3RfaWQgdGV4dCxcbiAgICAgICAgbGV2ZWwgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbmZvJyxcbiAgICAgICAga2luZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBmdW5jdGlvbl9uYW1lIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1ldGhvZCB0ZXh0LFxuICAgICAgICBwYXRoIHRleHQsXG4gICAgICAgIG9yaWdpbiB0ZXh0LFxuICAgICAgICByZWZlcmVyIHRleHQsXG4gICAgICAgIHVzZXJfYWdlbnQgdGV4dCxcbiAgICAgICAgaXAgdGV4dCxcbiAgICAgICAgYXBwX2lkIHRleHQsXG4gICAgICAgIGJ1aWxkX2lkIHRleHQsXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQsXG4gICAgICAgIHByb3ZpZGVyIHRleHQsXG4gICAgICAgIG1vZGVsIHRleHQsXG4gICAgICAgIGh0dHBfc3RhdHVzIGludGVnZXIsXG4gICAgICAgIGR1cmF0aW9uX21zIGludGVnZXIsXG4gICAgICAgIGVycm9yX2NvZGUgdGV4dCxcbiAgICAgICAgZXJyb3JfbWVzc2FnZSB0ZXh0LFxuICAgICAgICBlcnJvcl9zdGFjayB0ZXh0LFxuICAgICAgICB1cHN0cmVhbV9zdGF0dXMgaW50ZWdlcixcbiAgICAgICAgdXBzdHJlYW1fYm9keSB0ZXh0LFxuICAgICAgICBleHRyYSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcblxuICAgICAgLy8gRm9yd2FyZC1jb21wYXRpYmxlIHBhdGNoaW5nOiBpZiBnYXRld2F5X2V2ZW50cyBleGlzdGVkIGZyb20gYW4gb2xkZXIgYnVpbGQsXG4gICAgICAvLyBpdCBtYXkgYmUgbWlzc2luZyBjb2x1bW5zIHVzZWQgYnkgbW9uaXRvciBpbnNlcnRzLlxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByZXF1ZXN0X2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGV2ZWwgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbmZvJztgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBraW5kIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZXZlbnQnO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGZ1bmN0aW9uX25hbWUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd1bmtub3duJztgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtZXRob2QgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBwYXRoIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgb3JpZ2luIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVmZXJlciB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVzZXJfYWdlbnQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBpcCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFwcF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGJ1aWxkX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfaWQgYmlnaW50O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFwaV9rZXlfaWQgYmlnaW50O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHByb3ZpZGVyIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbW9kZWwgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBodHRwX3N0YXR1cyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGR1cmF0aW9uX21zIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZXJyb3JfY29kZSB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGVycm9yX21lc3NhZ2UgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBlcnJvcl9zdGFjayB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVwc3RyZWFtX3N0YXR1cyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVwc3RyZWFtX2JvZHkgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBleHRyYSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKTtgLFxuXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfY3JlYXRlZF9pZHggb24gZ2F0ZXdheV9ldmVudHMoY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX3JlcXVlc3RfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKHJlcXVlc3RfaWQpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfbGV2ZWxfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKGxldmVsLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfZm5faWR4IG9uIGdhdGV3YXlfZXZlbnRzKGZ1bmN0aW9uX25hbWUsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19hcHBfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKGFwcF9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuXG4gICAgICAvLyAtLS0gS2FpeHVQdXNoIChEZXBsb3kgUHVzaCkgZW50ZXJwcmlzZSB0YWJsZXMgLS0tXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJvbGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdkZXBsb3llcic7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhcGlfa2V5c19yb2xlX2lkeCBvbiBhcGlfa2V5cyhyb2xlKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVyX25ldGxpZnlfdG9rZW5zIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IHByaW1hcnkga2V5IHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgdG9rZW5fZW5jIHRleHQgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9wcm9qZWN0cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJvamVjdF9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBuYW1lIHRleHQgbm90IG51bGwsXG4gICAgICAgIG5ldGxpZnlfc2l0ZV9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdW5pcXVlIChjdXN0b21lcl9pZCwgcHJvamVjdF9pZClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX3Byb2plY3RzX2N1c3RvbWVyX2lkeCBvbiBwdXNoX3Byb2plY3RzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9wdXNoZXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm9qZWN0X3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3Byb2plY3RzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHVzaF9pZCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgYnJhbmNoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHRpdGxlIHRleHQsXG4gICAgICAgIGRlcGxveV9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzdGF0ZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICByZXF1aXJlZF9kaWdlc3RzIHRleHRbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OnRleHRbXSxcbiAgICAgICAgdXBsb2FkZWRfZGlnZXN0cyB0ZXh0W10gbm90IG51bGwgZGVmYXVsdCAne30nOjp0ZXh0W10sXG4gICAgICAgIGZpbGVfbWFuaWZlc3QganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgdXJsIHRleHQsXG4gICAgICAgIGVycm9yIHRleHQsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9wdXNoZXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGZpbGVfbWFuaWZlc3QganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYjtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfcHVzaGVzX2N1c3RvbWVyX2lkeCBvbiBwdXNoX3B1c2hlcyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfam9icyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgcHVzaF9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wdXNoZXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBzaGExIGNoYXIoNDApIG5vdCBudWxsLFxuICAgICAgICBkZXBsb3lfcGF0aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBwYXJ0cyBpbnRlZ2VyIG5vdCBudWxsLFxuICAgICAgICByZWNlaXZlZF9wYXJ0cyBpbnRlZ2VyW10gbm90IG51bGwgZGVmYXVsdCAne30nOjppbnRbXSxcbiAgICAgICAgcGFydF9ieXRlcyBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBieXRlc19zdGFnZWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAndXBsb2FkaW5nJyxcbiAgICAgICAgZXJyb3IgdGV4dCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVuaXF1ZSAocHVzaF9yb3dfaWQsIHNoYTEpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9qb2JzX3B1c2hfaWR4IG9uIHB1c2hfam9icyhwdXNoX3Jvd19pZCwgdXBkYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYnl0ZXNfc3RhZ2VkIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDA7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHBhcnRfYnl0ZXMganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYXR0ZW1wdHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDA7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG5leHRfYXR0ZW1wdF9hdCB0aW1lc3RhbXB0ejtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9lcnJvciB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X2Vycm9yX2F0IHRpbWVzdGFtcHR6O2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3JhdGVfd2luZG93cyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGJ1Y2tldF90eXBlIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJ1Y2tldF9zdGFydCB0aW1lc3RhbXB0eiBub3QgbnVsbCxcbiAgICAgICAgY291bnQgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHByaW1hcnkga2V5KGN1c3RvbWVyX2lkLCBidWNrZXRfdHlwZSwgYnVja2V0X3N0YXJ0KVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfcmF0ZV93aW5kb3dzX2J1Y2tldF9pZHggb24gcHVzaF9yYXRlX3dpbmRvd3MoYnVja2V0X3R5cGUsIGJ1Y2tldF9zdGFydCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfZmlsZXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIHB1c2hfcm93X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHVzaGVzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgZGVwbG95X3BhdGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc2hhMSBjaGFyKDQwKSBub3QgbnVsbCxcbiAgICAgICAgYnl0ZXMgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbW9kZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2RpcmVjdCcsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfZmlsZXNfcHVzaF9pZHggb24gcHVzaF9maWxlcyhwdXNoX3Jvd19pZCk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3VzYWdlX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHB1c2hfcm93X2lkIGJpZ2ludCByZWZlcmVuY2VzIHB1c2hfcHVzaGVzKGlkKSBvbiBkZWxldGUgc2V0IG51bGwsXG4gICAgICAgIGV2ZW50X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYnl0ZXMgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcHJpY2luZ192ZXJzaW9uIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAxLFxuICAgICAgICBjb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfdXNhZ2VfY3VzdG9tZXJfaWR4IG9uIHB1c2hfdXNhZ2VfZXZlbnRzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9wcmljaW5nX3ZlcnNpb25zIChcbiAgICAgICAgdmVyc2lvbiBpbnRlZ2VyIHByaW1hcnkga2V5LFxuICAgICAgICBlZmZlY3RpdmVfZnJvbSBkYXRlIG5vdCBudWxsIGRlZmF1bHQgY3VycmVudF9kYXRlLFxuICAgICAgICBjdXJyZW5jeSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ1VTRCcsXG4gICAgICAgIGJhc2VfbW9udGhfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHBlcl9kZXBsb3lfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHBlcl9nYl9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgaW5zZXJ0IGludG8gcHVzaF9wcmljaW5nX3ZlcnNpb25zKHZlcnNpb24sIGJhc2VfbW9udGhfY2VudHMsIHBlcl9kZXBsb3lfY2VudHMsIHBlcl9nYl9jZW50cylcbiAgICAgICB2YWx1ZXMgKDEsIDAsIDEwLCAyNSkgb24gY29uZmxpY3QgKHZlcnNpb24pIGRvIG5vdGhpbmc7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcl9wdXNoX2JpbGxpbmcgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgcHJpbWFyeSBrZXkgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcmljaW5nX3ZlcnNpb24gaW50ZWdlciBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHJpY2luZ192ZXJzaW9ucyh2ZXJzaW9uKSxcbiAgICAgICAgbW9udGhseV9jYXBfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9pbnZvaWNlcyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHByaWNpbmdfdmVyc2lvbiBpbnRlZ2VyIG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wcmljaW5nX3ZlcnNpb25zKHZlcnNpb24pLFxuICAgICAgICB0b3RhbF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsLFxuICAgICAgICBicmVha2Rvd24ganNvbmIgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuXG4gICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgIC8vIEdpdEh1YiBQdXNoIEdhdGV3YXkgKG9wdGlvbmFsKVxuICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfZ2l0aHViX3Rva2VucyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBwcmltYXJ5IGtleSByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHRva2VuX2VuYyB0ZXh0IG5vdCBudWxsLFxuICAgICAgICB0b2tlbl90eXBlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnb2F1dGgnLFxuICAgICAgICBzY29wZXMgdGV4dFtdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6dGV4dFtdLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGdoX3B1c2hfam9icyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGpvYl9pZCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgb3duZXIgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcmVwbyB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBicmFuY2ggdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdtYWluJyxcbiAgICAgICAgY29tbWl0X21lc3NhZ2UgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdLYWl4dSBHaXRIdWIgUHVzaCcsXG4gICAgICAgIHBhcnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICByZWNlaXZlZF9wYXJ0cyBpbnRlZ2VyW10gbm90IG51bGwgZGVmYXVsdCAne30nOjppbnRbXSxcbiAgICAgICAgcGFydF9ieXRlcyBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBieXRlc19zdGFnZWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAndXBsb2FkaW5nJyxcbiAgICAgICAgYXR0ZW1wdHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG5leHRfYXR0ZW1wdF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgbGFzdF9lcnJvciB0ZXh0LFxuICAgICAgICBsYXN0X2Vycm9yX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICByZXN1bHRfY29tbWl0X3NoYSB0ZXh0LFxuICAgICAgICByZXN1bHRfdXJsIHRleHQsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9qb2JzX2N1c3RvbWVyX2lkeCBvbiBnaF9wdXNoX2pvYnMoY3VzdG9tZXJfaWQsIHVwZGF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnaF9wdXNoX2pvYnNfbmV4dF9hdHRlbXB0X2lkeCBvbiBnaF9wdXNoX2pvYnMobmV4dF9hdHRlbXB0X2F0KSB3aGVyZSBzdGF0dXMgaW4gKCdyZXRyeV93YWl0JywnZXJyb3JfdHJhbnNpZW50Jyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBnaF9wdXNoX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGpvYl9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgZ2hfcHVzaF9qb2JzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgZXZlbnRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBieXRlcyBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdoX3B1c2hfZXZlbnRzX2pvYl9pZHggb24gZ2hfcHVzaF9ldmVudHMoam9iX3Jvd19pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB2b2ljZV9udW1iZXJzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwaG9uZV9udW1iZXIgdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwgZGVmYXVsdCAndHdpbGlvJyxcbiAgICAgICAgdHdpbGlvX3NpZCB0ZXh0LFxuICAgICAgICBpc19hY3RpdmUgYm9vbGVhbiBub3QgbnVsbCBkZWZhdWx0IHRydWUsXG4gICAgICAgIGRlZmF1bHRfbGxtX3Byb3ZpZGVyIHRleHQgbm90IG51bGwgZGVmYXVsdCAnb3BlbmFpJyxcbiAgICAgICAgZGVmYXVsdF9sbG1fbW9kZWwgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdncHQtNC4xLW1pbmknLFxuICAgICAgICB2b2ljZV9uYW1lIHRleHQgbm90IG51bGwgZGVmYXVsdCAnYWxsb3knLFxuICAgICAgICBsb2NhbGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdlbi1VUycsXG4gICAgICAgIHRpbWV6b25lIHRleHQgbm90IG51bGwgZGVmYXVsdCAnQW1lcmljYS9QaG9lbml4JyxcbiAgICAgICAgcGxheWJvb2sganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfbnVtYmVyc19jdXN0b21lcl9pZHggb24gdm9pY2VfbnVtYmVycyhjdXN0b21lcl9pZCk7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB2b2ljZV9udW1iZXJfaWQgYmlnaW50IHJlZmVyZW5jZXMgdm9pY2VfbnVtYmVycyhpZCkgb24gZGVsZXRlIHNldCBudWxsLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3R3aWxpbycsXG4gICAgICAgIHByb3ZpZGVyX2NhbGxfc2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIGZyb21fbnVtYmVyIHRleHQsXG4gICAgICAgIHRvX251bWJlciB0ZXh0LFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbml0aWF0ZWQnLFxuICAgICAgICBkaXJlY3Rpb24gdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbmJvdW5kJyxcbiAgICAgICAgc3RhcnRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBlbmRlZF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgZHVyYXRpb25fc2Vjb25kcyBpbnRlZ2VyLFxuICAgICAgICBlc3RfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgYmlsbF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmJcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdW5pcXVlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbHNfcHJvdmlkZXJfc2lkX3VxIG9uIHZvaWNlX2NhbGxzKHByb3ZpZGVyLCBwcm92aWRlcl9jYWxsX3NpZCk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsc19jdXN0b21lcl9pZHggb24gdm9pY2VfY2FsbHMoY3VzdG9tZXJfaWQsIHN0YXJ0ZWRfYXQgZGVzYyk7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxfbWVzc2FnZXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGNhbGxfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgdm9pY2VfY2FsbHMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICByb2xlIHRleHQgbm90IG51bGwsIC0tIHVzZXJ8YXNzaXN0YW50fHN5c3RlbXx0b29sXG4gICAgICAgIGNvbnRlbnQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbF9tZXNzYWdlc19jYWxsX2lkeCBvbiB2b2ljZV9jYWxsX21lc3NhZ2VzKGNhbGxfaWQsIGlkKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfdXNhZ2VfbW9udGhseSAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbWludXRlcyBudW1lcmljIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgZXN0X2Nvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGJpbGxfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY2FsbHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdW5pcXVlKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV91c2FnZV9tb250aGx5X2N1c3RvbWVyX2lkeCBvbiB2b2ljZV91c2FnZV9tb250aGx5KGN1c3RvbWVyX2lkLCBtb250aCk7YCxcblxuXTtcblxuICAgIGZvciAoY29uc3QgcyBvZiBzdGF0ZW1lbnRzKSB7XG4gICAgICBhd2FpdCBzcWwucXVlcnkocyk7XG4gICAgfVxuICB9KSgpO1xuXG4gIHJldHVybiBfc2NoZW1hUHJvbWlzZTtcbn1cblxuLyoqXG4gKiBRdWVyeSBoZWxwZXIgY29tcGF0aWJsZSB3aXRoIHRoZSBwcmV2aW91cyBgcGdgLWlzaCBpbnRlcmZhY2U6XG4gKiAtIHJldHVybnMgeyByb3dzLCByb3dDb3VudCB9XG4gKiAtIHN1cHBvcnRzICQxLCAkMiBwbGFjZWhvbGRlcnMgKyBwYXJhbXMgYXJyYXkgdmlhIHNxbC5xdWVyeSguLi4pXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBxKHRleHQsIHBhcmFtcyA9IFtdKSB7XG4gIGF3YWl0IGVuc3VyZVNjaGVtYSgpO1xuICBjb25zdCBzcWwgPSBnZXRTcWwoKTtcbiAgY29uc3Qgcm93cyA9IGF3YWl0IHNxbC5xdWVyeSh0ZXh0LCBwYXJhbXMpO1xuICByZXR1cm4geyByb3dzOiByb3dzIHx8IFtdLCByb3dDb3VudDogQXJyYXkuaXNBcnJheShyb3dzKSA/IHJvd3MubGVuZ3RoIDogMCB9O1xufSIsICJpbXBvcnQgeyBxIH0gZnJvbSBcIi4vZGIuanNcIjtcblxuZnVuY3Rpb24gc2FmZVN0cih2LCBtYXggPSA4MDAwKSB7XG4gIGlmICh2ID09IG51bGwpIHJldHVybiBudWxsO1xuICBjb25zdCBzID0gU3RyaW5nKHYpO1xuICBpZiAocy5sZW5ndGggPD0gbWF4KSByZXR1cm4gcztcbiAgcmV0dXJuIHMuc2xpY2UoMCwgbWF4KSArIGBcdTIwMjYoKyR7cy5sZW5ndGggLSBtYXh9IGNoYXJzKWA7XG59XG5cbmZ1bmN0aW9uIHJhbmRvbUlkKCkge1xuICB0cnkge1xuICAgIGlmIChnbG9iYWxUaGlzLmNyeXB0bz8ucmFuZG9tVVVJRCkgcmV0dXJuIGdsb2JhbFRoaXMuY3J5cHRvLnJhbmRvbVVVSUQoKTtcbiAgfSBjYXRjaCB7fVxuICAvLyBmYWxsYmFjayAobm90IFJGQzQxMjItcGVyZmVjdCwgYnV0IHVuaXF1ZSBlbm91Z2ggZm9yIHRyYWNpbmcpXG4gIHJldHVybiBcInJpZF9cIiArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMTYpLnNsaWNlKDIpICsgXCJfXCIgKyBEYXRlLm5vdygpLnRvU3RyaW5nKDE2KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFJlcXVlc3RJZChyZXEpIHtcbiAgY29uc3QgaCA9IChyZXEuaGVhZGVycy5nZXQoXCJ4LWthaXh1LXJlcXVlc3QtaWRcIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwieC1yZXF1ZXN0LWlkXCIpIHx8IFwiXCIpLnRyaW0oKTtcbiAgcmV0dXJuIGggfHwgcmFuZG9tSWQoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluZmVyRnVuY3Rpb25OYW1lKHJlcSkge1xuICB0cnkge1xuICAgIGNvbnN0IHUgPSBuZXcgVVJMKHJlcS51cmwpO1xuICAgIGNvbnN0IG0gPSB1LnBhdGhuYW1lLm1hdGNoKC9cXC9cXC5uZXRsaWZ5XFwvZnVuY3Rpb25zXFwvKFteXFwvXSspL2kpO1xuICAgIHJldHVybiBtID8gbVsxXSA6IFwidW5rbm93blwiO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gXCJ1bmtub3duXCI7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVlc3RNZXRhKHJlcSkge1xuICBsZXQgdXJsID0gbnVsbDtcbiAgdHJ5IHsgdXJsID0gbmV3IFVSTChyZXEudXJsKTsgfSBjYXRjaCB7fVxuICByZXR1cm4ge1xuICAgIG1ldGhvZDogcmVxLm1ldGhvZCB8fCBudWxsLFxuICAgIHBhdGg6IHVybCA/IHVybC5wYXRobmFtZSA6IG51bGwsXG4gICAgcXVlcnk6IHVybCA/IE9iamVjdC5mcm9tRW50cmllcyh1cmwuc2VhcmNoUGFyYW1zLmVudHJpZXMoKSkgOiB7fSxcbiAgICBvcmlnaW46IHJlcS5oZWFkZXJzLmdldChcIm9yaWdpblwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJPcmlnaW5cIikgfHwgbnVsbCxcbiAgICByZWZlcmVyOiByZXEuaGVhZGVycy5nZXQoXCJyZWZlcmVyXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIlJlZmVyZXJcIikgfHwgbnVsbCxcbiAgICB1c2VyX2FnZW50OiByZXEuaGVhZGVycy5nZXQoXCJ1c2VyLWFnZW50XCIpIHx8IG51bGwsXG4gICAgaXA6IHJlcS5oZWFkZXJzLmdldChcIngtbmYtY2xpZW50LWNvbm5lY3Rpb24taXBcIikgfHwgbnVsbCxcbiAgICBhcHBfaWQ6IChyZXEuaGVhZGVycy5nZXQoXCJ4LWthaXh1LWFwcFwiKSB8fCBcIlwiKS50cmltKCkgfHwgbnVsbCxcbiAgICBidWlsZF9pZDogKHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtYnVpbGRcIikgfHwgXCJcIikudHJpbSgpIHx8IG51bGxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUVycm9yKGVycikge1xuICBjb25zdCBlID0gZXJyIHx8IHt9O1xuICByZXR1cm4ge1xuICAgIG5hbWU6IHNhZmVTdHIoZS5uYW1lLCAyMDApLFxuICAgIG1lc3NhZ2U6IHNhZmVTdHIoZS5tZXNzYWdlLCA0MDAwKSxcbiAgICBjb2RlOiBzYWZlU3RyKGUuY29kZSwgMjAwKSxcbiAgICBzdGF0dXM6IE51bWJlci5pc0Zpbml0ZShlLnN0YXR1cykgPyBlLnN0YXR1cyA6IG51bGwsXG4gICAgaGludDogc2FmZVN0cihlLmhpbnQsIDIwMDApLFxuICAgIHN0YWNrOiBzYWZlU3RyKGUuc3RhY2ssIDEyMDAwKSxcbiAgICB1cHN0cmVhbTogZS51cHN0cmVhbSA/IHtcbiAgICAgIHByb3ZpZGVyOiBzYWZlU3RyKGUudXBzdHJlYW0ucHJvdmlkZXIsIDUwKSxcbiAgICAgIHN0YXR1czogTnVtYmVyLmlzRmluaXRlKGUudXBzdHJlYW0uc3RhdHVzKSA/IGUudXBzdHJlYW0uc3RhdHVzIDogbnVsbCxcbiAgICAgIGJvZHk6IHNhZmVTdHIoZS51cHN0cmVhbS5ib2R5LCAxMjAwMCksXG4gICAgICByZXF1ZXN0X2lkOiBzYWZlU3RyKGUudXBzdHJlYW0ucmVxdWVzdF9pZCwgMjAwKSxcbiAgICAgIHJlc3BvbnNlX2hlYWRlcnM6IGUudXBzdHJlYW0ucmVzcG9uc2VfaGVhZGVycyB8fCB1bmRlZmluZWRcbiAgICB9IDogdW5kZWZpbmVkXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdW1tYXJpemVKc29uQm9keShib2R5KSB7XG4gIC8vIFNhZmUgc3VtbWFyeTsgYXZvaWRzIGxvZ2dpbmcgZnVsbCBwcm9tcHRzIGJ5IGRlZmF1bHQuXG4gIGNvbnN0IGIgPSBib2R5IHx8IHt9O1xuICBjb25zdCBwcm92aWRlciA9IChiLnByb3ZpZGVyIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpLnRvTG93ZXJDYXNlKCkgfHwgbnVsbDtcbiAgY29uc3QgbW9kZWwgPSAoYi5tb2RlbCB8fCBcIlwiKS50b1N0cmluZygpLnRyaW0oKSB8fCBudWxsO1xuXG4gIGxldCBtZXNzYWdlQ291bnQgPSBudWxsO1xuICBsZXQgdG90YWxDaGFycyA9IG51bGw7XG4gIHRyeSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoYi5tZXNzYWdlcykpIHtcbiAgICAgIG1lc3NhZ2VDb3VudCA9IGIubWVzc2FnZXMubGVuZ3RoO1xuICAgICAgdG90YWxDaGFycyA9IGIubWVzc2FnZXMucmVkdWNlKChhY2MsIG0pID0+IGFjYyArIFN0cmluZyhtPy5jb250ZW50ID8/IFwiXCIpLmxlbmd0aCwgMCk7XG4gICAgfVxuICB9IGNhdGNoIHt9XG5cbiAgcmV0dXJuIHtcbiAgICBwcm92aWRlcixcbiAgICBtb2RlbCxcbiAgICBtYXhfdG9rZW5zOiBOdW1iZXIuaXNGaW5pdGUoYi5tYXhfdG9rZW5zKSA/IHBhcnNlSW50KGIubWF4X3Rva2VucywgMTApIDogbnVsbCxcbiAgICB0ZW1wZXJhdHVyZTogdHlwZW9mIGIudGVtcGVyYXR1cmUgPT09IFwibnVtYmVyXCIgPyBiLnRlbXBlcmF0dXJlIDogbnVsbCxcbiAgICBtZXNzYWdlX2NvdW50OiBtZXNzYWdlQ291bnQsXG4gICAgbWVzc2FnZV9jaGFyczogdG90YWxDaGFyc1xuICB9O1xufVxuXG4vKipcbiAqIEJlc3QtZWZmb3J0IG1vbml0b3IgZXZlbnQ6IGZhaWx1cmVzIG5ldmVyIGJyZWFrIHRoZSBtYWluIHJlcXVlc3QuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbWl0RXZlbnQoZXYpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBlID0gZXYgfHwge307XG4gICAgY29uc3QgZXh0cmEgPSBlLmV4dHJhIHx8IHt9O1xuICAgIGF3YWl0IHEoXG4gICAgICBgaW5zZXJ0IGludG8gZ2F0ZXdheV9ldmVudHNcbiAgICAgICAgKHJlcXVlc3RfaWQsIGxldmVsLCBraW5kLCBmdW5jdGlvbl9uYW1lLCBtZXRob2QsIHBhdGgsIG9yaWdpbiwgcmVmZXJlciwgdXNlcl9hZ2VudCwgaXAsXG4gICAgICAgICBhcHBfaWQsIGJ1aWxkX2lkLCBjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgcHJvdmlkZXIsIG1vZGVsLCBodHRwX3N0YXR1cywgZHVyYXRpb25fbXMsXG4gICAgICAgICBlcnJvcl9jb2RlLCBlcnJvcl9tZXNzYWdlLCBlcnJvcl9zdGFjaywgdXBzdHJlYW1fc3RhdHVzLCB1cHN0cmVhbV9ib2R5LCBleHRyYSlcbiAgICAgICB2YWx1ZXNcbiAgICAgICAgKCQxLCQyLCQzLCQ0LCQ1LCQ2LCQ3LCQ4LCQ5LCQxMCxcbiAgICAgICAgICQxMSwkMTIsJDEzLCQxNCwkMTUsJDE2LCQxNywkMTgsXG4gICAgICAgICAkMTksJDIwLCQyMSwkMjIsJDIzLCQyNCwkMjU6Ompzb25iKWAsXG4gICAgICBbXG4gICAgICAgIHNhZmVTdHIoZS5yZXF1ZXN0X2lkLCAyMDApLFxuICAgICAgICBzYWZlU3RyKGUubGV2ZWwgfHwgXCJpbmZvXCIsIDIwKSxcbiAgICAgICAgc2FmZVN0cihlLmtpbmQgfHwgXCJldmVudFwiLCA4MCksXG4gICAgICAgIHNhZmVTdHIoZS5mdW5jdGlvbl9uYW1lIHx8IFwidW5rbm93blwiLCAxMjApLFxuICAgICAgICBzYWZlU3RyKGUubWV0aG9kLCAyMCksXG4gICAgICAgIHNhZmVTdHIoZS5wYXRoLCA1MDApLFxuICAgICAgICBzYWZlU3RyKGUub3JpZ2luLCA1MDApLFxuICAgICAgICBzYWZlU3RyKGUucmVmZXJlciwgODAwKSxcbiAgICAgICAgc2FmZVN0cihlLnVzZXJfYWdlbnQsIDgwMCksXG4gICAgICAgIHNhZmVTdHIoZS5pcCwgMjAwKSxcblxuICAgICAgICBzYWZlU3RyKGUuYXBwX2lkLCAyMDApLFxuICAgICAgICBzYWZlU3RyKGUuYnVpbGRfaWQsIDIwMCksXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShlLmN1c3RvbWVyX2lkKSA/IGUuY3VzdG9tZXJfaWQgOiBudWxsLFxuICAgICAgICBOdW1iZXIuaXNGaW5pdGUoZS5hcGlfa2V5X2lkKSA/IGUuYXBpX2tleV9pZCA6IG51bGwsXG4gICAgICAgIHNhZmVTdHIoZS5wcm92aWRlciwgODApLFxuICAgICAgICBzYWZlU3RyKGUubW9kZWwsIDIwMCksXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShlLmh0dHBfc3RhdHVzKSA/IGUuaHR0cF9zdGF0dXMgOiBudWxsLFxuICAgICAgICBOdW1iZXIuaXNGaW5pdGUoZS5kdXJhdGlvbl9tcykgPyBlLmR1cmF0aW9uX21zIDogbnVsbCxcblxuICAgICAgICBzYWZlU3RyKGUuZXJyb3JfY29kZSwgMjAwKSxcbiAgICAgICAgc2FmZVN0cihlLmVycm9yX21lc3NhZ2UsIDQwMDApLFxuICAgICAgICBzYWZlU3RyKGUuZXJyb3Jfc3RhY2ssIDEyMDAwKSxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUudXBzdHJlYW1fc3RhdHVzKSA/IGUudXBzdHJlYW1fc3RhdHVzIDogbnVsbCxcbiAgICAgICAgc2FmZVN0cihlLnVwc3RyZWFtX2JvZHksIDEyMDAwKSxcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoZXh0cmEgfHwge30pXG4gICAgICBdXG4gICAgKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUud2FybihcIm1vbml0b3IgZW1pdCBmYWlsZWQ6XCIsIGU/Lm1lc3NhZ2UgfHwgZSk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBidWlsZENvcnMsIGpzb24gfSBmcm9tIFwiLi9odHRwLmpzXCI7XG5pbXBvcnQgeyBlbWl0RXZlbnQsIGdldFJlcXVlc3RJZCwgaW5mZXJGdW5jdGlvbk5hbWUsIHJlcXVlc3RNZXRhLCBzZXJpYWxpemVFcnJvciB9IGZyb20gXCIuL21vbml0b3IuanNcIjtcblxuZnVuY3Rpb24gbm9ybWFsaXplRXJyb3IoZXJyKSB7XG4gIGNvbnN0IHN0YXR1cyA9IGVycj8uc3RhdHVzIHx8IDUwMDtcbiAgY29uc3QgY29kZSA9IGVycj8uY29kZSB8fCBcIlNFUlZFUl9FUlJPUlwiO1xuICBjb25zdCBtZXNzYWdlID0gZXJyPy5tZXNzYWdlIHx8IFwiVW5rbm93biBlcnJvclwiO1xuICBjb25zdCBoaW50ID0gZXJyPy5oaW50O1xuICByZXR1cm4geyBzdGF0dXMsIGJvZHk6IHsgZXJyb3I6IG1lc3NhZ2UsIGNvZGUsIC4uLihoaW50ID8geyBoaW50IH0gOiB7fSkgfSB9O1xufVxuXG5mdW5jdGlvbiB3aXRoUmVxdWVzdElkKHJlcywgcmVxdWVzdF9pZCkge1xuICB0cnkge1xuICAgIGNvbnN0IGggPSBuZXcgSGVhZGVycyhyZXMuaGVhZGVycyB8fCB7fSk7XG4gICAgaC5zZXQoXCJ4LWthaXh1LXJlcXVlc3QtaWRcIiwgcmVxdWVzdF9pZCk7XG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShyZXMuYm9keSwgeyBzdGF0dXM6IHJlcy5zdGF0dXMsIGhlYWRlcnM6IGggfSk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiByZXM7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gc2FmZUJvZHlQcmV2aWV3KHJlcykge1xuICB0cnkge1xuICAgIGNvbnN0IGN0ID0gKHJlcy5oZWFkZXJzLmdldChcImNvbnRlbnQtdHlwZVwiKSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGNsb25lID0gcmVzLmNsb25lKCk7XG4gICAgaWYgKGN0LmluY2x1ZGVzKFwiYXBwbGljYXRpb24vanNvblwiKSkge1xuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGNsb25lLmpzb24oKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cbiAgICBjb25zdCB0ID0gYXdhaXQgY2xvbmUudGV4dCgpLmNhdGNoKCgpID0+IFwiXCIpO1xuICAgIGlmICh0eXBlb2YgdCA9PT0gXCJzdHJpbmdcIiAmJiB0Lmxlbmd0aCA+IDEyMDAwKSByZXR1cm4gdC5zbGljZSgwLCAxMjAwMCkgKyBgXHUyMDI2KCske3QubGVuZ3RoIC0gMTIwMDB9IGNoYXJzKWA7XG4gICAgcmV0dXJuIHQ7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cmFwKGhhbmRsZXIpIHtcbiAgcmV0dXJuIGFzeW5jIChyZXEsIGNvbnRleHQpID0+IHtcbiAgICBjb25zdCBzdGFydCA9IERhdGUubm93KCk7XG4gICAgY29uc3QgY29ycyA9IGJ1aWxkQ29ycyhyZXEpO1xuICAgIGNvbnN0IHJlcXVlc3RfaWQgPSBnZXRSZXF1ZXN0SWQocmVxKTtcbiAgICBjb25zdCBmdW5jdGlvbl9uYW1lID0gaW5mZXJGdW5jdGlvbk5hbWUocmVxKTtcbiAgICBjb25zdCBtZXRhID0gcmVxdWVzdE1ldGEocmVxKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBoYW5kbGVyKHJlcSwgY29ycywgY29udGV4dCk7XG5cbiAgICAgIGNvbnN0IGR1cmF0aW9uX21zID0gRGF0ZS5ub3coKSAtIHN0YXJ0O1xuICAgICAgY29uc3Qgb3V0ID0gcmVzIGluc3RhbmNlb2YgUmVzcG9uc2UgPyB3aXRoUmVxdWVzdElkKHJlcywgcmVxdWVzdF9pZCkgOiByZXM7XG5cbiAgICAgIGNvbnN0IHN0YXR1cyA9IG91dCBpbnN0YW5jZW9mIFJlc3BvbnNlID8gb3V0LnN0YXR1cyA6IDIwMDtcbiAgICAgIGNvbnN0IGxldmVsID0gc3RhdHVzID49IDUwMCA/IFwiZXJyb3JcIiA6IHN0YXR1cyA+PSA0MDAgPyBcIndhcm5cIiA6IFwiaW5mb1wiO1xuICAgICAgY29uc3Qga2luZCA9IHN0YXR1cyA+PSA0MDAgPyBcImh0dHBfZXJyb3JfcmVzcG9uc2VcIiA6IFwiaHR0cF9yZXNwb25zZVwiO1xuXG4gICAgICBsZXQgZXh0cmEgPSB7fTtcbiAgICAgIGlmIChzdGF0dXMgPj0gNDAwICYmIG91dCBpbnN0YW5jZW9mIFJlc3BvbnNlKSB7XG4gICAgICAgIGV4dHJhLnJlc3BvbnNlID0gYXdhaXQgc2FmZUJvZHlQcmV2aWV3KG91dCk7XG4gICAgICB9XG4gICAgICBpZiAoZHVyYXRpb25fbXMgPj0gMTUwMDApIHtcbiAgICAgICAgZXh0cmEuc2xvdyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IGVtaXRFdmVudCh7XG4gICAgICAgIHJlcXVlc3RfaWQsXG4gICAgICAgIGxldmVsLFxuICAgICAgICBraW5kLFxuICAgICAgICBmdW5jdGlvbl9uYW1lLFxuICAgICAgICAuLi5tZXRhLFxuICAgICAgICBodHRwX3N0YXR1czogc3RhdHVzLFxuICAgICAgICBkdXJhdGlvbl9tcyxcbiAgICAgICAgZXh0cmFcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gb3V0O1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc3QgZHVyYXRpb25fbXMgPSBEYXRlLm5vdygpIC0gc3RhcnQ7XG5cbiAgICAgIC8vIEJlc3QtZWZmb3J0IGRldGFpbGVkIG1vbml0b3IgcmVjb3JkLlxuICAgICAgY29uc3Qgc2VyID0gc2VyaWFsaXplRXJyb3IoZXJyKTtcbiAgICAgIGF3YWl0IGVtaXRFdmVudCh7XG4gICAgICAgIHJlcXVlc3RfaWQsXG4gICAgICAgIGxldmVsOiBcImVycm9yXCIsXG4gICAgICAgIGtpbmQ6IFwidGhyb3duX2Vycm9yXCIsXG4gICAgICAgIGZ1bmN0aW9uX25hbWUsXG4gICAgICAgIC4uLm1ldGEsXG4gICAgICAgIHByb3ZpZGVyOiBzZXI/LnVwc3RyZWFtPy5wcm92aWRlciB8fCB1bmRlZmluZWQsXG4gICAgICAgIGh0dHBfc3RhdHVzOiBzZXI/LnN0YXR1cyB8fCA1MDAsXG4gICAgICAgIGR1cmF0aW9uX21zLFxuICAgICAgICBlcnJvcl9jb2RlOiBzZXI/LmNvZGUgfHwgXCJTRVJWRVJfRVJST1JcIixcbiAgICAgICAgZXJyb3JfbWVzc2FnZTogc2VyPy5tZXNzYWdlIHx8IFwiVW5rbm93biBlcnJvclwiLFxuICAgICAgICBlcnJvcl9zdGFjazogc2VyPy5zdGFjayB8fCBudWxsLFxuICAgICAgICB1cHN0cmVhbV9zdGF0dXM6IHNlcj8udXBzdHJlYW0/LnN0YXR1cyB8fCBudWxsLFxuICAgICAgICB1cHN0cmVhbV9ib2R5OiBzZXI/LnVwc3RyZWFtPy5ib2R5IHx8IG51bGwsXG4gICAgICAgIGV4dHJhOiB7IGVycm9yOiBzZXIgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIEF2b2lkIDUwMnM6IGFsd2F5cyByZXR1cm4gSlNPTi5cbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJGdW5jdGlvbiBlcnJvcjpcIiwgZXJyKTtcbiAgICAgIGNvbnN0IHsgc3RhdHVzLCBib2R5IH0gPSBub3JtYWxpemVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIGpzb24oc3RhdHVzLCB7IC4uLmJvZHksIHJlcXVlc3RfaWQgfSwgeyAuLi5jb3JzLCBcIngta2FpeHUtcmVxdWVzdC1pZFwiOiByZXF1ZXN0X2lkIH0pO1xuICAgIH1cbiAgfTtcbn1cbiIsICJpbXBvcnQgY3J5cHRvIGZyb20gXCJjcnlwdG9cIjtcblxuZnVuY3Rpb24gY29uZmlnRXJyb3IobWVzc2FnZSwgaGludCkge1xuICBjb25zdCBlcnIgPSBuZXcgRXJyb3IobWVzc2FnZSk7XG4gIGVyci5jb2RlID0gXCJDT05GSUdcIjtcbiAgZXJyLnN0YXR1cyA9IDUwMDtcbiAgaWYgKGhpbnQpIGVyci5oaW50ID0gaGludDtcbiAgcmV0dXJuIGVycjtcbn1cblxuZnVuY3Rpb24gYmFzZTY0dXJsKGlucHV0KSB7XG4gIHJldHVybiBCdWZmZXIuZnJvbShpbnB1dClcbiAgICAudG9TdHJpbmcoXCJiYXNlNjRcIilcbiAgICAucmVwbGFjZSgvPS9nLCBcIlwiKVxuICAgIC5yZXBsYWNlKC9cXCsvZywgXCItXCIpXG4gICAgLnJlcGxhY2UoL1xcLy9nLCBcIl9cIik7XG59XG5cbmZ1bmN0aW9uIHVuYmFzZTY0dXJsKGlucHV0KSB7XG4gIGNvbnN0IHMgPSBTdHJpbmcoaW5wdXQgfHwgXCJcIikucmVwbGFjZSgvLS9nLCBcIitcIikucmVwbGFjZSgvXy9nLCBcIi9cIik7XG4gIGNvbnN0IHBhZCA9IHMubGVuZ3RoICUgNCA9PT0gMCA/IFwiXCIgOiBcIj1cIi5yZXBlYXQoNCAtIChzLmxlbmd0aCAlIDQpKTtcbiAgcmV0dXJuIEJ1ZmZlci5mcm9tKHMgKyBwYWQsIFwiYmFzZTY0XCIpO1xufVxuXG5mdW5jdGlvbiBlbmNLZXkoKSB7XG4gIC8vIFByZWZlciBhIGRlZGljYXRlZCBlbmNyeXB0aW9uIGtleS4gRmFsbCBiYWNrIHRvIEpXVF9TRUNSRVQgZm9yIGRyb3AtZnJpZW5kbHkgaW5zdGFsbHMuXG4gIGNvbnN0IHJhdyA9IChwcm9jZXNzLmVudi5EQl9FTkNSWVBUSU9OX0tFWSB8fCBwcm9jZXNzLmVudi5KV1RfU0VDUkVUIHx8IFwiXCIpLnRvU3RyaW5nKCk7XG4gIGlmICghcmF3KSB7XG4gICAgdGhyb3cgY29uZmlnRXJyb3IoXG4gICAgICBcIk1pc3NpbmcgREJfRU5DUllQVElPTl9LRVkgKG9yIEpXVF9TRUNSRVQgZmFsbGJhY2spXCIsXG4gICAgICBcIlNldCBEQl9FTkNSWVBUSU9OX0tFWSAocmVjb21tZW5kZWQpIG9yIGF0IG1pbmltdW0gSldUX1NFQ1JFVCBpbiBOZXRsaWZ5IGVudiB2YXJzLlwiXG4gICAgKTtcbiAgfVxuICAvLyBEZXJpdmUgYSBzdGFibGUgMzItYnl0ZSBrZXkuXG4gIHJldHVybiBjcnlwdG8uY3JlYXRlSGFzaChcInNoYTI1NlwiKS51cGRhdGUocmF3KS5kaWdlc3QoKTtcbn1cblxuLyoqXG4gKiBFbmNyeXB0IHNtYWxsIHNlY3JldHMgZm9yIERCIHN0b3JhZ2UgKEFFUy0yNTYtR0NNKS5cbiAqIEZvcm1hdDogdjE6PGl2X2I2NHVybD46PHRhZ19iNjR1cmw+OjxjaXBoZXJfYjY0dXJsPlxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5jcnlwdFNlY3JldChwbGFpbnRleHQpIHtcbiAgY29uc3Qga2V5ID0gZW5jS2V5KCk7XG4gIGNvbnN0IGl2ID0gY3J5cHRvLnJhbmRvbUJ5dGVzKDEyKTtcbiAgY29uc3QgY2lwaGVyID0gY3J5cHRvLmNyZWF0ZUNpcGhlcml2KFwiYWVzLTI1Ni1nY21cIiwga2V5LCBpdik7XG4gIGNvbnN0IGN0ID0gQnVmZmVyLmNvbmNhdChbY2lwaGVyLnVwZGF0ZShTdHJpbmcocGxhaW50ZXh0KSwgXCJ1dGY4XCIpLCBjaXBoZXIuZmluYWwoKV0pO1xuICBjb25zdCB0YWcgPSBjaXBoZXIuZ2V0QXV0aFRhZygpO1xuICByZXR1cm4gYHYxOiR7YmFzZTY0dXJsKGl2KX06JHtiYXNlNjR1cmwodGFnKX06JHtiYXNlNjR1cmwoY3QpfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWNyeXB0U2VjcmV0KGVuYykge1xuICBjb25zdCBzID0gU3RyaW5nKGVuYyB8fCBcIlwiKTtcbiAgaWYgKCFzLnN0YXJ0c1dpdGgoXCJ2MTpcIikpIHJldHVybiBudWxsO1xuICBjb25zdCBwYXJ0cyA9IHMuc3BsaXQoXCI6XCIpO1xuICBpZiAocGFydHMubGVuZ3RoICE9PSA0KSByZXR1cm4gbnVsbDtcbiAgY29uc3QgWywgaXZCLCB0YWdCLCBjdEJdID0gcGFydHM7XG4gIGNvbnN0IGtleSA9IGVuY0tleSgpO1xuICBjb25zdCBpdiA9IHVuYmFzZTY0dXJsKGl2Qik7XG4gIGNvbnN0IHRhZyA9IHVuYmFzZTY0dXJsKHRhZ0IpO1xuICBjb25zdCBjdCA9IHVuYmFzZTY0dXJsKGN0Qik7XG4gIGNvbnN0IGRlY2lwaGVyID0gY3J5cHRvLmNyZWF0ZURlY2lwaGVyaXYoXCJhZXMtMjU2LWdjbVwiLCBrZXksIGl2KTtcbiAgZGVjaXBoZXIuc2V0QXV0aFRhZyh0YWcpO1xuICBjb25zdCBwdCA9IEJ1ZmZlci5jb25jYXQoW2RlY2lwaGVyLnVwZGF0ZShjdCksIGRlY2lwaGVyLmZpbmFsKCldKTtcbiAgcmV0dXJuIHB0LnRvU3RyaW5nKFwidXRmOFwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJhbmRvbUtleShwcmVmaXggPSBcImt4X2xpdmVfXCIpIHtcbiAgY29uc3QgYnl0ZXMgPSBjcnlwdG8ucmFuZG9tQnl0ZXMoMzIpO1xuICByZXR1cm4gcHJlZml4ICsgYmFzZTY0dXJsKGJ5dGVzKS5zbGljZSgwLCA0OCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaGEyNTZIZXgoaW5wdXQpIHtcbiAgcmV0dXJuIGNyeXB0by5jcmVhdGVIYXNoKFwic2hhMjU2XCIpLnVwZGF0ZShpbnB1dCkuZGlnZXN0KFwiaGV4XCIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaG1hY1NoYTI1NkhleChzZWNyZXQsIGlucHV0KSB7XG4gIHJldHVybiBjcnlwdG8uY3JlYXRlSG1hYyhcInNoYTI1NlwiLCBzZWNyZXQpLnVwZGF0ZShpbnB1dCkuZGlnZXN0KFwiaGV4XCIpO1xufVxuXG4vKipcbiAqIEtleSBoYXNoaW5nIHN0cmF0ZWd5OlxuICogLSBEZWZhdWx0OiBTSEEtMjU2KGtleSlcbiAqIC0gSWYgS0VZX1BFUFBFUiBpcyBzZXQ6IEhNQUMtU0hBMjU2KEtFWV9QRVBQRVIsIGtleSlcbiAqXG4gKiBJTVBPUlRBTlQ6IFBlcHBlciBpcyBvcHRpb25hbCBhbmQgY2FuIGJlIGVuYWJsZWQgbGF0ZXIuXG4gKiBBdXRoIGNvZGUgd2lsbCBhdXRvLW1pZ3JhdGUgbGVnYWN5IGhhc2hlcyBvbiBmaXJzdCBzdWNjZXNzZnVsIGxvb2t1cC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGtleUhhc2hIZXgoaW5wdXQpIHtcbiAgY29uc3QgcGVwcGVyID0gcHJvY2Vzcy5lbnYuS0VZX1BFUFBFUjtcbiAgaWYgKHBlcHBlcikgcmV0dXJuIGhtYWNTaGEyNTZIZXgocGVwcGVyLCBpbnB1dCk7XG4gIHJldHVybiBzaGEyNTZIZXgoaW5wdXQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGVnYWN5S2V5SGFzaEhleChpbnB1dCkge1xuICByZXR1cm4gc2hhMjU2SGV4KGlucHV0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNpZ25Kd3QocGF5bG9hZCwgdHRsU2Vjb25kcyA9IDM2MDApIHtcbiAgY29uc3Qgc2VjcmV0ID0gcHJvY2Vzcy5lbnYuSldUX1NFQ1JFVDtcbiAgaWYgKCFzZWNyZXQpIHtcbiAgICB0aHJvdyBjb25maWdFcnJvcihcbiAgICAgIFwiTWlzc2luZyBKV1RfU0VDUkVUXCIsXG4gICAgICBcIlNldCBKV1RfU0VDUkVUIGluIE5ldGxpZnkgXHUyMTkyIFNpdGUgY29uZmlndXJhdGlvbiBcdTIxOTIgRW52aXJvbm1lbnQgdmFyaWFibGVzICh1c2UgYSBsb25nIHJhbmRvbSBzdHJpbmcpLlwiXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IGhlYWRlciA9IHsgYWxnOiBcIkhTMjU2XCIsIHR5cDogXCJKV1RcIiB9O1xuICBjb25zdCBub3cgPSBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKTtcbiAgY29uc3QgYm9keSA9IHsgLi4ucGF5bG9hZCwgaWF0OiBub3csIGV4cDogbm93ICsgdHRsU2Vjb25kcyB9O1xuXG4gIGNvbnN0IGggPSBiYXNlNjR1cmwoSlNPTi5zdHJpbmdpZnkoaGVhZGVyKSk7XG4gIGNvbnN0IHAgPSBiYXNlNjR1cmwoSlNPTi5zdHJpbmdpZnkoYm9keSkpO1xuICBjb25zdCBkYXRhID0gYCR7aH0uJHtwfWA7XG4gIGNvbnN0IHNpZyA9IGJhc2U2NHVybChjcnlwdG8uY3JlYXRlSG1hYyhcInNoYTI1NlwiLCBzZWNyZXQpLnVwZGF0ZShkYXRhKS5kaWdlc3QoKSk7XG5cbiAgcmV0dXJuIGAke2RhdGF9LiR7c2lnfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2ZXJpZnlKd3QodG9rZW4pIHtcbiAgY29uc3Qgc2VjcmV0ID0gcHJvY2Vzcy5lbnYuSldUX1NFQ1JFVDtcbiAgaWYgKCFzZWNyZXQpIHtcbiAgICB0aHJvdyBjb25maWdFcnJvcihcbiAgICAgIFwiTWlzc2luZyBKV1RfU0VDUkVUXCIsXG4gICAgICBcIlNldCBKV1RfU0VDUkVUIGluIE5ldGxpZnkgXHUyMTkyIFNpdGUgY29uZmlndXJhdGlvbiBcdTIxOTIgRW52aXJvbm1lbnQgdmFyaWFibGVzICh1c2UgYSBsb25nIHJhbmRvbSBzdHJpbmcpLlwiXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IHBhcnRzID0gdG9rZW4uc3BsaXQoXCIuXCIpO1xuICBpZiAocGFydHMubGVuZ3RoICE9PSAzKSByZXR1cm4gbnVsbDtcblxuICBjb25zdCBbaCwgcCwgc10gPSBwYXJ0cztcbiAgY29uc3QgZGF0YSA9IGAke2h9LiR7cH1gO1xuICBjb25zdCBleHBlY3RlZCA9IGJhc2U2NHVybChjcnlwdG8uY3JlYXRlSG1hYyhcInNoYTI1NlwiLCBzZWNyZXQpLnVwZGF0ZShkYXRhKS5kaWdlc3QoKSk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBhID0gQnVmZmVyLmZyb20oZXhwZWN0ZWQpO1xuICAgIGNvbnN0IGIgPSBCdWZmZXIuZnJvbShzKTtcbiAgICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSByZXR1cm4gbnVsbDtcbiAgICBpZiAoIWNyeXB0by50aW1pbmdTYWZlRXF1YWwoYSwgYikpIHJldHVybiBudWxsO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHRyeSB7XG4gICAgY29uc3QgcGF5bG9hZCA9IEpTT04ucGFyc2UoXG4gICAgICBCdWZmZXIuZnJvbShwLnJlcGxhY2UoLy0vZywgXCIrXCIpLnJlcGxhY2UoL18vZywgXCIvXCIpLCBcImJhc2U2NFwiKS50b1N0cmluZyhcInV0Zi04XCIpXG4gICAgKTtcbiAgICBjb25zdCBub3cgPSBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKTtcbiAgICBpZiAocGF5bG9hZC5leHAgJiYgbm93ID4gcGF5bG9hZC5leHApIHJldHVybiBudWxsO1xuICAgIHJldHVybiBwYXlsb2FkO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuIiwgImltcG9ydCB7IHEgfSBmcm9tIFwiLi9kYi5qc1wiO1xuaW1wb3J0IHsga2V5SGFzaEhleCwgbGVnYWN5S2V5SGFzaEhleCwgdmVyaWZ5Snd0IH0gZnJvbSBcIi4vY3J5cHRvLmpzXCI7XG5pbXBvcnQgeyBtb250aEtleVVUQyB9IGZyb20gXCIuL2h0dHAuanNcIjtcblxuZnVuY3Rpb24gYmFzZVNlbGVjdCgpIHtcbiAgcmV0dXJuIGBzZWxlY3Qgay5pZCBhcyBhcGlfa2V5X2lkLCBrLmN1c3RvbWVyX2lkLCBrLmtleV9sYXN0NCwgay5sYWJlbCwgay5yb2xlLFxuICAgICAgICAgICAgICAgICBrLm1vbnRobHlfY2FwX2NlbnRzIGFzIGtleV9jYXBfY2VudHMsIGsucnBtX2xpbWl0LCBrLnJwZF9saW1pdCxcbiAgICAgICAgICAgICAgICAgay5tYXhfZGV2aWNlcywgay5yZXF1aXJlX2luc3RhbGxfaWQsIGsuYWxsb3dlZF9wcm92aWRlcnMsIGsuYWxsb3dlZF9tb2RlbHMsXG4gICAgICAgICAgICAgICAgIGMubW9udGhseV9jYXBfY2VudHMgYXMgY3VzdG9tZXJfY2FwX2NlbnRzLCBjLmlzX2FjdGl2ZSxcbiAgICAgICAgICAgICAgICAgYy5tYXhfZGV2aWNlc19wZXJfa2V5IGFzIGN1c3RvbWVyX21heF9kZXZpY2VzX3Blcl9rZXksIGMucmVxdWlyZV9pbnN0YWxsX2lkIGFzIGN1c3RvbWVyX3JlcXVpcmVfaW5zdGFsbF9pZCxcbiAgICAgICAgICAgICAgICAgYy5hbGxvd2VkX3Byb3ZpZGVycyBhcyBjdXN0b21lcl9hbGxvd2VkX3Byb3ZpZGVycywgYy5hbGxvd2VkX21vZGVscyBhcyBjdXN0b21lcl9hbGxvd2VkX21vZGVscyxcbiAgICAgICAgICAgICAgICAgYy5wbGFuX25hbWUgYXMgY3VzdG9tZXJfcGxhbl9uYW1lLCBjLmVtYWlsIGFzIGN1c3RvbWVyX2VtYWlsXG4gICAgICAgICAgZnJvbSBhcGlfa2V5cyBrXG4gICAgICAgICAgam9pbiBjdXN0b21lcnMgYyBvbiBjLmlkID0gay5jdXN0b21lcl9pZGA7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb29rdXBLZXkocGxhaW5LZXkpIHtcbiAgLy8gUHJlZmVycmVkIGhhc2ggKHBlcHBlcmVkIGlmIGVuYWJsZWQpXG4gIGNvbnN0IHByZWZlcnJlZCA9IGtleUhhc2hIZXgocGxhaW5LZXkpO1xuICBsZXQga2V5UmVzID0gYXdhaXQgcShcbiAgICBgJHtiYXNlU2VsZWN0KCl9XG4gICAgIHdoZXJlIGsua2V5X2hhc2g9JDEgYW5kIGsucmV2b2tlZF9hdCBpcyBudWxsXG4gICAgIGxpbWl0IDFgLFxuICAgIFtwcmVmZXJyZWRdXG4gICk7XG4gIGlmIChrZXlSZXMucm93Q291bnQpIHJldHVybiBrZXlSZXMucm93c1swXTtcblxuICAvLyBJZiBLRVlfUEVQUEVSIGlzIGVuYWJsZWQsIGFsbG93IGxlZ2FjeSBTSEEtMjU2IGhhc2hlcyBhbmQgYXV0by1taWdyYXRlIG9uIGZpcnN0IGhpdC5cbiAgaWYgKHByb2Nlc3MuZW52LktFWV9QRVBQRVIpIHtcbiAgICBjb25zdCBsZWdhY3kgPSBsZWdhY3lLZXlIYXNoSGV4KHBsYWluS2V5KTtcbiAgICBrZXlSZXMgPSBhd2FpdCBxKFxuICAgICAgYCR7YmFzZVNlbGVjdCgpfVxuICAgICAgIHdoZXJlIGsua2V5X2hhc2g9JDEgYW5kIGsucmV2b2tlZF9hdCBpcyBudWxsXG4gICAgICAgbGltaXQgMWAsXG4gICAgICBbbGVnYWN5XVxuICAgICk7XG4gICAgaWYgKCFrZXlSZXMucm93Q291bnQpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3Qgcm93ID0ga2V5UmVzLnJvd3NbMF07XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHEoXG4gICAgICAgIGB1cGRhdGUgYXBpX2tleXMgc2V0IGtleV9oYXNoPSQxXG4gICAgICAgICB3aGVyZSBpZD0kMiBhbmQga2V5X2hhc2g9JDNgLFxuICAgICAgICBbcHJlZmVycmVkLCByb3cuYXBpX2tleV9pZCwgbGVnYWN5XVxuICAgICAgKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIGlnbm9yZSBtaWdyYXRpb24gZXJyb3JzXG4gICAgfVxuXG4gICAgcmV0dXJuIHJvdztcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9va3VwS2V5QnlJZChhcGlfa2V5X2lkKSB7XG4gIGNvbnN0IGtleVJlcyA9IGF3YWl0IHEoXG4gICAgYCR7YmFzZVNlbGVjdCgpfVxuICAgICB3aGVyZSBrLmlkPSQxIGFuZCBrLnJldm9rZWRfYXQgaXMgbnVsbFxuICAgICBsaW1pdCAxYCxcbiAgICBbYXBpX2tleV9pZF1cbiAgKTtcbiAgaWYgKCFrZXlSZXMucm93Q291bnQpIHJldHVybiBudWxsO1xuICByZXR1cm4ga2V5UmVzLnJvd3NbMF07XG59XG5cbi8qKlxuICogUmVzb2x2ZSBhbiBBdXRob3JpemF0aW9uIEJlYXJlciB0b2tlbi5cbiAqIFN1cHBvcnRlZDpcbiAqIC0gS2FpeHUgc3ViLWtleSAocGxhaW4gdmlydHVhbCBrZXkpXG4gKiAtIFNob3J0LWxpdmVkIHVzZXIgc2Vzc2lvbiBKV1QgKHR5cGU6ICd1c2VyX3Nlc3Npb24nKVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZUF1dGgodG9rZW4pIHtcbiAgaWYgKCF0b2tlbikgcmV0dXJuIG51bGw7XG5cbiAgLy8gSldUcyBoYXZlIDMgZG90LXNlcGFyYXRlZCBwYXJ0cy4gS2FpeHUga2V5cyBkbyBub3QuXG4gIGNvbnN0IHBhcnRzID0gdG9rZW4uc3BsaXQoXCIuXCIpO1xuICBpZiAocGFydHMubGVuZ3RoID09PSAzKSB7XG4gICAgY29uc3QgcGF5bG9hZCA9IHZlcmlmeUp3dCh0b2tlbik7XG4gICAgaWYgKCFwYXlsb2FkKSByZXR1cm4gbnVsbDtcbiAgICBpZiAocGF5bG9hZC50eXBlICE9PSBcInVzZXJfc2Vzc2lvblwiKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IHJvdyA9IGF3YWl0IGxvb2t1cEtleUJ5SWQocGF5bG9hZC5hcGlfa2V5X2lkKTtcbiAgICByZXR1cm4gcm93O1xuICB9XG5cbiAgcmV0dXJuIGF3YWl0IGxvb2t1cEtleSh0b2tlbik7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRNb250aFJvbGx1cChjdXN0b21lcl9pZCwgbW9udGggPSBtb250aEtleVVUQygpKSB7XG4gIGNvbnN0IHJvbGwgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3Qgc3BlbnRfY2VudHMsIGV4dHJhX2NlbnRzLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnNcbiAgICAgZnJvbSBtb250aGx5X3VzYWdlIHdoZXJlIGN1c3RvbWVyX2lkPSQxIGFuZCBtb250aD0kMmAsXG4gICAgW2N1c3RvbWVyX2lkLCBtb250aF1cbiAgKTtcbiAgaWYgKHJvbGwucm93Q291bnQgPT09IDApIHJldHVybiB7IHNwZW50X2NlbnRzOiAwLCBleHRyYV9jZW50czogMCwgaW5wdXRfdG9rZW5zOiAwLCBvdXRwdXRfdG9rZW5zOiAwIH07XG4gIHJldHVybiByb2xsLnJvd3NbMF07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRLZXlNb250aFJvbGx1cChhcGlfa2V5X2lkLCBtb250aCA9IG1vbnRoS2V5VVRDKCkpIHtcbiAgY29uc3Qgcm9sbCA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBzcGVudF9jZW50cywgaW5wdXRfdG9rZW5zLCBvdXRwdXRfdG9rZW5zLCBjYWxsc1xuICAgICBmcm9tIG1vbnRobHlfa2V5X3VzYWdlIHdoZXJlIGFwaV9rZXlfaWQ9JDEgYW5kIG1vbnRoPSQyYCxcbiAgICBbYXBpX2tleV9pZCwgbW9udGhdXG4gICk7XG4gIGlmIChyb2xsLnJvd0NvdW50KSByZXR1cm4gcm9sbC5yb3dzWzBdO1xuXG4gIC8vIEJhY2tmaWxsIGZvciBtaWdyYXRlZCBpbnN0YWxscyAod2hlbiBtb250aGx5X2tleV91c2FnZSBkaWQgbm90IGV4aXN0IHlldCkuXG4gIGNvbnN0IGtleU1ldGEgPSBhd2FpdCBxKGBzZWxlY3QgY3VzdG9tZXJfaWQgZnJvbSBhcGlfa2V5cyB3aGVyZSBpZD0kMWAsIFthcGlfa2V5X2lkXSk7XG4gIGNvbnN0IGN1c3RvbWVyX2lkID0ga2V5TWV0YS5yb3dDb3VudCA/IGtleU1ldGEucm93c1swXS5jdXN0b21lcl9pZCA6IG51bGw7XG5cbiAgY29uc3QgYWdnID0gYXdhaXQgcShcbiAgICBgc2VsZWN0IGNvYWxlc2NlKHN1bShjb3N0X2NlbnRzKSwwKTo6aW50IGFzIHNwZW50X2NlbnRzLFxuICAgICAgICAgICAgY29hbGVzY2Uoc3VtKGlucHV0X3Rva2VucyksMCk6OmludCBhcyBpbnB1dF90b2tlbnMsXG4gICAgICAgICAgICBjb2FsZXNjZShzdW0ob3V0cHV0X3Rva2VucyksMCk6OmludCBhcyBvdXRwdXRfdG9rZW5zLFxuICAgICAgICAgICAgY291bnQoKik6OmludCBhcyBjYWxsc1xuICAgICBmcm9tIHVzYWdlX2V2ZW50c1xuICAgICB3aGVyZSBhcGlfa2V5X2lkPSQxIGFuZCB0b19jaGFyKGNyZWF0ZWRfYXQgYXQgdGltZSB6b25lICdVVEMnLCdZWVlZLU1NJyk9JDJgLFxuICAgIFthcGlfa2V5X2lkLCBtb250aF1cbiAgKTtcblxuICBjb25zdCByb3cgPSBhZ2cucm93c1swXSB8fCB7IHNwZW50X2NlbnRzOiAwLCBpbnB1dF90b2tlbnM6IDAsIG91dHB1dF90b2tlbnM6IDAsIGNhbGxzOiAwIH07XG5cbiAgaWYgKGN1c3RvbWVyX2lkICE9IG51bGwpIHtcbiAgICBhd2FpdCBxKFxuICAgICAgYGluc2VydCBpbnRvIG1vbnRobHlfa2V5X3VzYWdlKGFwaV9rZXlfaWQsIGN1c3RvbWVyX2lkLCBtb250aCwgc3BlbnRfY2VudHMsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2VucywgY2FsbHMpXG4gICAgICAgdmFsdWVzICgkMSwkMiwkMywkNCwkNSwkNiwkNylcbiAgICAgICBvbiBjb25mbGljdCAoYXBpX2tleV9pZCwgbW9udGgpXG4gICAgICAgZG8gdXBkYXRlIHNldFxuICAgICAgICAgc3BlbnRfY2VudHMgPSBleGNsdWRlZC5zcGVudF9jZW50cyxcbiAgICAgICAgIGlucHV0X3Rva2VucyA9IGV4Y2x1ZGVkLmlucHV0X3Rva2VucyxcbiAgICAgICAgIG91dHB1dF90b2tlbnMgPSBleGNsdWRlZC5vdXRwdXRfdG9rZW5zLFxuICAgICAgICAgY2FsbHMgPSBleGNsdWRlZC5jYWxscyxcbiAgICAgICAgIHVwZGF0ZWRfYXQgPSBub3coKWAsXG4gICAgICBbYXBpX2tleV9pZCwgY3VzdG9tZXJfaWQsIG1vbnRoLCByb3cuc3BlbnRfY2VudHMgfHwgMCwgcm93LmlucHV0X3Rva2VucyB8fCAwLCByb3cub3V0cHV0X3Rva2VucyB8fCAwLCByb3cuY2FsbHMgfHwgMF1cbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIHJvdztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVmZmVjdGl2ZUNhcENlbnRzKGtleVJvdywgcm9sbHVwKSB7XG4gIGNvbnN0IGJhc2UgPSBrZXlSb3cua2V5X2NhcF9jZW50cyA/PyBrZXlSb3cuY3VzdG9tZXJfY2FwX2NlbnRzO1xuICBjb25zdCBleHRyYSA9IHJvbGx1cC5leHRyYV9jZW50cyB8fCAwO1xuICByZXR1cm4gKGJhc2UgfHwgMCkgKyBleHRyYTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1c3RvbWVyQ2FwQ2VudHMoa2V5Um93LCBjdXN0b21lclJvbGx1cCkge1xuICBjb25zdCBiYXNlID0ga2V5Um93LmN1c3RvbWVyX2NhcF9jZW50cyB8fCAwO1xuICBjb25zdCBleHRyYSA9IGN1c3RvbWVyUm9sbHVwLmV4dHJhX2NlbnRzIHx8IDA7XG4gIHJldHVybiBiYXNlICsgZXh0cmE7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBrZXlDYXBDZW50cyhrZXlSb3csIGN1c3RvbWVyUm9sbHVwKSB7XG4gIC8vIElmIGEga2V5IG92ZXJyaWRlIGV4aXN0cywgaXQncyBhIGhhcmQgY2FwIGZvciB0aGF0IGtleS4gT3RoZXJ3aXNlIGl0IGluaGVyaXRzIHRoZSBjdXN0b21lciBjYXAuXG4gIGlmIChrZXlSb3cua2V5X2NhcF9jZW50cyAhPSBudWxsKSByZXR1cm4ga2V5Um93LmtleV9jYXBfY2VudHM7XG4gIHJldHVybiBjdXN0b21lckNhcENlbnRzKGtleVJvdywgY3VzdG9tZXJSb2xsdXApO1xufVxuXG5cbmNvbnN0IFJPTEVfT1JERVIgPSBbXCJ2aWV3ZXJcIixcImRlcGxveWVyXCIsXCJhZG1pblwiLFwib3duZXJcIl07XG5cbmV4cG9ydCBmdW5jdGlvbiByb2xlQXRMZWFzdChhY3R1YWwsIHJlcXVpcmVkKSB7XG4gIGNvbnN0IGEgPSBST0xFX09SREVSLmluZGV4T2YoKGFjdHVhbCB8fCBcImRlcGxveWVyXCIpLnRvTG93ZXJDYXNlKCkpO1xuICBjb25zdCByID0gUk9MRV9PUkRFUi5pbmRleE9mKChyZXF1aXJlZCB8fCBcImRlcGxveWVyXCIpLnRvTG93ZXJDYXNlKCkpO1xuICByZXR1cm4gYSA+PSByICYmIGEgIT09IC0xICYmIHIgIT09IC0xO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVxdWlyZUtleVJvbGUoa2V5Um93LCByZXF1aXJlZFJvbGUpIHtcbiAgY29uc3QgYWN0dWFsID0gKGtleVJvdz8ucm9sZSB8fCBcImRlcGxveWVyXCIpLnRvTG93ZXJDYXNlKCk7XG4gIGlmICghcm9sZUF0TGVhc3QoYWN0dWFsLCByZXF1aXJlZFJvbGUpKSB7XG4gICAgY29uc3QgZXJyID0gbmV3IEVycm9yKFwiRm9yYmlkZGVuXCIpO1xuICAgIGVyci5zdGF0dXMgPSA0MDM7XG4gICAgZXJyLmNvZGUgPSBcIkZPUkJJRERFTlwiO1xuICAgIGVyci5oaW50ID0gYFJlcXVpcmVzIHJvbGUgJyR7cmVxdWlyZWRSb2xlfScsIGJ1dCBrZXkgcm9sZSBpcyAnJHthY3R1YWx9Jy5gO1xuICAgIHRocm93IGVycjtcbiAgfVxufVxuIiwgImltcG9ydCB7IHEgfSBmcm9tIFwiLi9kYi5qc1wiO1xuXG4vKipcbiAqIEJlc3QtZWZmb3J0IGF1ZGl0IGxvZzogZmFpbHVyZXMgbmV2ZXIgYnJlYWsgdGhlIG1haW4gcmVxdWVzdC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGF1ZGl0KGFjdG9yLCBhY3Rpb24sIHRhcmdldCA9IG51bGwsIG1ldGEgPSB7fSkge1xuICB0cnkge1xuICAgIGF3YWl0IHEoXG4gICAgICBgaW5zZXJ0IGludG8gYXVkaXRfZXZlbnRzKGFjdG9yLCBhY3Rpb24sIHRhcmdldCwgbWV0YSkgdmFsdWVzICgkMSwkMiwkMywkNDo6anNvbmIpYCxcbiAgICAgIFthY3RvciwgYWN0aW9uLCB0YXJnZXQsIEpTT04uc3RyaW5naWZ5KG1ldGEgfHwge30pXVxuICAgICk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zb2xlLndhcm4oXCJhdWRpdCBmYWlsZWQ6XCIsIGU/Lm1lc3NhZ2UgfHwgZSk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBxIH0gZnJvbSBcIi4vZGIuanNcIjtcbmltcG9ydCB7IGVuY3J5cHRTZWNyZXQsIGRlY3J5cHRTZWNyZXQgfSBmcm9tIFwiLi9jcnlwdG8uanNcIjtcblxuLyoqXG4gKiBQZXItY3VzdG9tZXIgR2l0SHViIHRva2VucyAoZW50ZXJwcmlzZSBib3VuZGFyeSkuXG4gKlxuICogU3RvcmVkIGVuY3J5cHRlZCBpbiBOZXRsaWZ5IERCLlxuICogUHJlZmVyIE9BdXRoIHRva2VucyAoc2NvcGVkKSBidXQgc3VwcG9ydHMgUEFUcyBhcyB3ZWxsLlxuICovXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRHaXRIdWJUb2tlbkZvckN1c3RvbWVyKGN1c3RvbWVyX2lkKSB7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IHEoYHNlbGVjdCB0b2tlbl9lbmMgZnJvbSBjdXN0b21lcl9naXRodWJfdG9rZW5zIHdoZXJlIGN1c3RvbWVyX2lkPSQxYCwgW2N1c3RvbWVyX2lkXSk7XG4gIGlmIChyZXMucm93cy5sZW5ndGgpIHtcbiAgICBjb25zdCBkZWMgPSBkZWNyeXB0U2VjcmV0KHJlcy5yb3dzWzBdLnRva2VuX2VuYyk7XG4gICAgaWYgKGRlYykgcmV0dXJuIGRlYztcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldEdpdEh1YlRva2VuRm9yQ3VzdG9tZXIoY3VzdG9tZXJfaWQsIHRva2VuX3BsYWluLCB0b2tlbl90eXBlID0gXCJvYXV0aFwiLCBzY29wZXMgPSBbXSkge1xuICBjb25zdCBlbmMgPSBlbmNyeXB0U2VjcmV0KHRva2VuX3BsYWluKTtcbiAgY29uc3Qgc2NvcGVzQXJyID0gQXJyYXkuaXNBcnJheShzY29wZXMpID8gc2NvcGVzLm1hcChzID0+IFN0cmluZyhzKS50cmltKCkpLmZpbHRlcihCb29sZWFuKSA6IFtdO1xuICBhd2FpdCBxKFxuICAgIGBpbnNlcnQgaW50byBjdXN0b21lcl9naXRodWJfdG9rZW5zKGN1c3RvbWVyX2lkLCB0b2tlbl9lbmMsIHRva2VuX3R5cGUsIHNjb3BlcywgY3JlYXRlZF9hdCwgdXBkYXRlZF9hdClcbiAgICAgdmFsdWVzICgkMSwkMiwkMywkNCxub3coKSxub3coKSlcbiAgICAgb24gY29uZmxpY3QgKGN1c3RvbWVyX2lkKVxuICAgICBkbyB1cGRhdGUgc2V0IHRva2VuX2VuYz1leGNsdWRlZC50b2tlbl9lbmMsIHRva2VuX3R5cGU9ZXhjbHVkZWQudG9rZW5fdHlwZSwgc2NvcGVzPWV4Y2x1ZGVkLnNjb3BlcywgdXBkYXRlZF9hdD1ub3coKWAsXG4gICAgW2N1c3RvbWVyX2lkLCBlbmMsIHRva2VuX3R5cGUsIHNjb3Blc0Fycl1cbiAgKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNsZWFyR2l0SHViVG9rZW5Gb3JDdXN0b21lcihjdXN0b21lcl9pZCkge1xuICBhd2FpdCBxKGBkZWxldGUgZnJvbSBjdXN0b21lcl9naXRodWJfdG9rZW5zIHdoZXJlIGN1c3RvbWVyX2lkPSQxYCwgW2N1c3RvbWVyX2lkXSk7XG59XG4iLCAiaW1wb3J0IHsgc2xlZXAgfSBmcm9tIFwiLi9odHRwLmpzXCI7XG5cbmZ1bmN0aW9uIGJhc2UoKSB7XG4gIHJldHVybiAocHJvY2Vzcy5lbnYuR0lUSFVCX0FQSV9CQVNFIHx8IFwiaHR0cHM6Ly9hcGkuZ2l0aHViLmNvbVwiKS50cmltKCkgfHwgXCJodHRwczovL2FwaS5naXRodWIuY29tXCI7XG59XG5cbmZ1bmN0aW9uIGFwaVZlcnNpb24oKSB7XG4gIHJldHVybiAocHJvY2Vzcy5lbnYuR0lUSFVCX0FQSV9WRVJTSU9OIHx8IFwiMjAyMi0xMS0yOFwiKS50cmltKCkgfHwgXCIyMDIyLTExLTI4XCI7XG59XG5cbmZ1bmN0aW9uIHBhcnNlUmV0cnlBZnRlcihoKSB7XG4gIGNvbnN0IHJhID0gaC5nZXQoXCJyZXRyeS1hZnRlclwiKTtcbiAgaWYgKCFyYSkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IG4gPSBwYXJzZUludChyYSwgMTApO1xuICByZXR1cm4gTnVtYmVyLmlzRmluaXRlKG4pICYmIG4gPj0gMCA/IG4gOiBudWxsO1xufVxuXG5mdW5jdGlvbiBwYXJzZVJhdGVSZXNldFNlY29uZHMoaCkge1xuICBjb25zdCByZXNldCA9IGguZ2V0KFwieC1yYXRlbGltaXQtcmVzZXRcIik7XG4gIGlmICghcmVzZXQpIHJldHVybiBudWxsO1xuICBjb25zdCBuID0gcGFyc2VJbnQocmVzZXQsIDEwKTtcbiAgaWYgKCFOdW1iZXIuaXNGaW5pdGUobikgfHwgbiA8PSAwKSByZXR1cm4gbnVsbDtcbiAgY29uc3Qgbm93ID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gIHJldHVybiBNYXRoLm1heCgwLCBuIC0gbm93KTtcbn1cblxuZXhwb3J0IGNsYXNzIEdpdEh1YkFwaUVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtZXNzYWdlLCBzdGF0dXMsIGNvZGUsIG1ldGEgPSB7fSkge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgIHRoaXMubmFtZSA9IFwiR2l0SHViQXBpRXJyb3JcIjtcbiAgICB0aGlzLnN0YXR1cyA9IHN0YXR1cztcbiAgICB0aGlzLmNvZGUgPSBjb2RlO1xuICAgIHRoaXMubWV0YSA9IG1ldGE7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdoRmV0Y2goeyB0b2tlbiwgbWV0aG9kLCBwYXRoLCBib2R5LCBhY2NlcHQgPSBcImFwcGxpY2F0aW9uL3ZuZC5naXRodWIranNvblwiLCBhbGxvd1JldHJ5ID0gdHJ1ZSB9KSB7XG4gIGNvbnN0IHVybCA9IGJhc2UoKS5yZXBsYWNlKC9cXC8kLywgXCJcIikgKyBwYXRoO1xuICBjb25zdCBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKTtcbiAgaGVhZGVycy5zZXQoXCJhY2NlcHRcIiwgYWNjZXB0KTtcbiAgaGVhZGVycy5zZXQoXCJ4LWdpdGh1Yi1hcGktdmVyc2lvblwiLCBhcGlWZXJzaW9uKCkpO1xuICBoZWFkZXJzLnNldChcImF1dGhvcml6YXRpb25cIiwgYEJlYXJlciAke3Rva2VufWApO1xuICBpZiAoYm9keSAhPT0gdW5kZWZpbmVkICYmIGJvZHkgIT09IG51bGwpIGhlYWRlcnMuc2V0KFwiY29udGVudC10eXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcblxuICBjb25zdCBtYXhBdHRlbXB0cyA9IGFsbG93UmV0cnkgPyA1IDogMTtcbiAgbGV0IGF0dGVtcHQgPSAwO1xuXG4gIHdoaWxlIChhdHRlbXB0IDwgbWF4QXR0ZW1wdHMpIHtcbiAgICBhdHRlbXB0Kys7XG4gICAgbGV0IHJlcztcbiAgICB0cnkge1xuICAgICAgcmVzID0gYXdhaXQgZmV0Y2godXJsLCB7IG1ldGhvZCwgaGVhZGVycywgYm9keTogYm9keSAhPT0gdW5kZWZpbmVkICYmIGJvZHkgIT09IG51bGwgPyBKU09OLnN0cmluZ2lmeShib2R5KSA6IHVuZGVmaW5lZCB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBuZXR3b3JrIGVycm9yXG4gICAgICBpZiAoYXR0ZW1wdCA+PSBtYXhBdHRlbXB0cykgdGhyb3cgbmV3IEdpdEh1YkFwaUVycm9yKGBHaXRIdWIgbmV0d29yayBlcnJvcjogJHtlPy5tZXNzYWdlIHx8IFwidW5rbm93blwifWAsIDUwMiwgXCJHSVRIVUJfTkVUV09SS1wiKTtcbiAgICAgIGNvbnN0IGJhY2tvZmYgPSBNYXRoLm1pbig4MDAwLCA1MDAgKiAoMiAqKiAoYXR0ZW1wdCAtIDEpKSkgKyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAyNTApO1xuICAgICAgYXdhaXQgc2xlZXAoYmFja29mZik7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBSYXRlIGxpbWl0IC8gcmV0cnkgaGFuZGxpbmdcbiAgICBpZiAocmVzLnN0YXR1cyA9PT0gNDI5IHx8IHJlcy5zdGF0dXMgPT09IDUwMiB8fCByZXMuc3RhdHVzID09PSA1MDMgfHwgcmVzLnN0YXR1cyA9PT0gNTA0KSB7XG4gICAgICBpZiAoYXR0ZW1wdCA+PSBtYXhBdHRlbXB0cykge1xuICAgICAgICBjb25zdCB0ID0gYXdhaXQgc2FmZVRleHQocmVzKTtcbiAgICAgICAgdGhyb3cgbmV3IEdpdEh1YkFwaUVycm9yKGBHaXRIdWIgdHJhbnNpZW50IGVycm9yICgke3Jlcy5zdGF0dXN9KWAsIHJlcy5zdGF0dXMsIFwiR0lUSFVCX1RSQU5TSUVOVFwiLCB7IGJvZHk6IHQgfSk7XG4gICAgICB9XG4gICAgICBjb25zdCByYSA9IHBhcnNlUmV0cnlBZnRlcihyZXMuaGVhZGVycyk7XG4gICAgICBjb25zdCB3YWl0TXMgPSAocmEgIT09IG51bGwgPyByYSAqIDEwMDAgOiBNYXRoLm1pbig4MDAwLCA1MDAgKiAoMiAqKiAoYXR0ZW1wdCAtIDEpKSkgKyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAyNTApKTtcbiAgICAgIGF3YWl0IHNsZWVwKHdhaXRNcyk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBHaXRIdWIgcmF0ZSBsaW1pdCBpcyBvZnRlbiBhIDQwMyB3aXRoIHJlbWFpbmluZz0wXG4gICAgaWYgKHJlcy5zdGF0dXMgPT09IDQwMykge1xuICAgICAgY29uc3QgcmVtYWluaW5nID0gcmVzLmhlYWRlcnMuZ2V0KFwieC1yYXRlbGltaXQtcmVtYWluaW5nXCIpO1xuICAgICAgY29uc3QgcmVtID0gcmVtYWluaW5nID8gcGFyc2VJbnQocmVtYWluaW5nLCAxMCkgOiBudWxsO1xuICAgICAgaWYgKHJlbSA9PT0gMCkge1xuICAgICAgICBjb25zdCByZXNldFNlYyA9IHBhcnNlUmF0ZVJlc2V0U2Vjb25kcyhyZXMuaGVhZGVycyk7XG4gICAgICAgIGNvbnN0IHQgPSBhd2FpdCBzYWZlVGV4dChyZXMpO1xuICAgICAgICB0aHJvdyBuZXcgR2l0SHViQXBpRXJyb3IoXCJHaXRIdWIgcmF0ZSBsaW1pdCByZWFjaGVkXCIsIDQyOSwgXCJHSVRIVUJfUkFURV9MSU1JVFwiLCB7IHJlc2V0X3NlY29uZHM6IHJlc2V0U2VjLCBib2R5OiB0IH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghcmVzLm9rKSB7XG4gICAgICBjb25zdCB0ID0gYXdhaXQgc2FmZVRleHQocmVzKTtcbiAgICAgIGxldCBjb2RlID0gXCJHSVRIVUJfRVJST1JcIjtcbiAgICAgIGlmIChyZXMuc3RhdHVzID09PSA0MDEpIGNvZGUgPSBcIkdJVEhVQl9VTkFVVEhPUklaRURcIjtcbiAgICAgIGlmIChyZXMuc3RhdHVzID09PSA0MDQpIGNvZGUgPSBcIkdJVEhVQl9OT1RfRk9VTkRcIjtcbiAgICAgIGlmIChyZXMuc3RhdHVzID09PSA0MDkpIGNvZGUgPSBcIkdJVEhVQl9DT05GTElDVFwiO1xuICAgICAgdGhyb3cgbmV3IEdpdEh1YkFwaUVycm9yKGBHaXRIdWIgQVBJIGVycm9yICgke3Jlcy5zdGF0dXN9KWAsIHJlcy5zdGF0dXMsIGNvZGUsIHsgYm9keTogdCB9KTtcbiAgICB9XG5cbiAgICAvLyBTb21lIGVuZHBvaW50cyByZXR1cm4gMjA0XG4gICAgaWYgKHJlcy5zdGF0dXMgPT09IDIwNCkgcmV0dXJuIHsgb2s6IHRydWUsIHN0YXR1czogMjA0LCBoZWFkZXJzOiByZXMuaGVhZGVycywgZGF0YTogbnVsbCB9O1xuXG4gICAgY29uc3QgY3QgPSAocmVzLmhlYWRlcnMuZ2V0KFwiY29udGVudC10eXBlXCIpIHx8IFwiXCIpLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKGN0LmluY2x1ZGVzKFwiYXBwbGljYXRpb24vanNvblwiKSkge1xuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlcy5qc29uKCk7XG4gICAgICByZXR1cm4geyBvazogdHJ1ZSwgc3RhdHVzOiByZXMuc3RhdHVzLCBoZWFkZXJzOiByZXMuaGVhZGVycywgZGF0YSB9O1xuICAgIH1cbiAgICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzLnRleHQoKTtcbiAgICByZXR1cm4geyBvazogdHJ1ZSwgc3RhdHVzOiByZXMuc3RhdHVzLCBoZWFkZXJzOiByZXMuaGVhZGVycywgZGF0YTogdGV4dCB9O1xuICB9XG5cbiAgdGhyb3cgbmV3IEdpdEh1YkFwaUVycm9yKFwiR2l0SHViIHJlcXVlc3QgZmFpbGVkXCIsIDUwMiwgXCJHSVRIVUJfVU5LTk9XTlwiKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2FmZVRleHQocmVzKSB7XG4gIHRyeSB7IHJldHVybiBhd2FpdCByZXMudGV4dCgpOyB9IGNhdGNoIHsgcmV0dXJuIFwiXCI7IH1cbn1cblxuLy8gQ29udmVuaWVuY2Ugd3JhcHBlcnNcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnaEdldCh7IHRva2VuLCBwYXRoIH0pIHtcbiAgcmV0dXJuIGdoRmV0Y2goeyB0b2tlbiwgbWV0aG9kOiBcIkdFVFwiLCBwYXRoIH0pO1xufVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdoUG9zdCh7IHRva2VuLCBwYXRoLCBib2R5IH0pIHtcbiAgcmV0dXJuIGdoRmV0Y2goeyB0b2tlbiwgbWV0aG9kOiBcIlBPU1RcIiwgcGF0aCwgYm9keSB9KTtcbn1cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnaFBhdGNoKHsgdG9rZW4sIHBhdGgsIGJvZHkgfSkge1xuICByZXR1cm4gZ2hGZXRjaCh7IHRva2VuLCBtZXRob2Q6IFwiUEFUQ0hcIiwgcGF0aCwgYm9keSB9KTtcbn1cbiIsICJpbXBvcnQgeyB3cmFwIH0gZnJvbSBcIi4vX2xpYi93cmFwLmpzXCI7XG5pbXBvcnQgeyBidWlsZENvcnMsIGpzb24sIGJhZFJlcXVlc3QsIGdldEJlYXJlciB9IGZyb20gXCIuL19saWIvaHR0cC5qc1wiO1xuaW1wb3J0IHsgbG9va3VwS2V5LCByZXF1aXJlS2V5Um9sZSB9IGZyb20gXCIuL19saWIvYXV0aHouanNcIjtcbmltcG9ydCB7IHEgfSBmcm9tIFwiLi9fbGliL2RiLmpzXCI7XG5pbXBvcnQgeyBhdWRpdCB9IGZyb20gXCIuL19saWIvYXVkaXQuanNcIjtcbmltcG9ydCB7IGdldEdpdEh1YlRva2VuRm9yQ3VzdG9tZXIsIHNldEdpdEh1YlRva2VuRm9yQ3VzdG9tZXIsIGNsZWFyR2l0SHViVG9rZW5Gb3JDdXN0b21lciB9IGZyb20gXCIuL19saWIvZ2l0aHViVG9rZW5zLmpzXCI7XG5pbXBvcnQgeyBnaEdldCB9IGZyb20gXCIuL19saWIvZ2l0aHViLmpzXCI7XG5cbmV4cG9ydCBkZWZhdWx0IHdyYXAoYXN5bmMgKHJlcSkgPT4ge1xuICBjb25zdCBjb3JzID0gYnVpbGRDb3JzKHJlcSk7XG4gIGlmIChyZXEubWV0aG9kID09PSBcIk9QVElPTlNcIikgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjA0LCBoZWFkZXJzOiBjb3JzIH0pO1xuXG4gIGNvbnN0IGtleSA9IGdldEJlYXJlcihyZXEpO1xuICBpZiAoIWtleSkgcmV0dXJuIGpzb24oNDAxLCB7IGVycm9yOiBcIk1pc3NpbmcgQXV0aG9yaXphdGlvbiBCZWFyZXIgS2FpeHUgS2V5XCIgfSwgY29ycyk7XG5cbiAgY29uc3Qga3JvdyA9IGF3YWl0IGxvb2t1cEtleShrZXkpO1xuICBpZiAoIWtyb3cpIHJldHVybiBqc29uKDQwMSwgeyBlcnJvcjogXCJJbnZhbGlkIEthaXh1IEtleVwiIH0sIGNvcnMpO1xuXG4gIGlmIChyZXEubWV0aG9kID09PSBcIkdFVFwiKSB7XG4gICAgcmVxdWlyZUtleVJvbGUoa3JvdywgXCJ2aWV3ZXJcIik7XG5cbiAgICBjb25zdCByID0gYXdhaXQgcShcbiAgICAgIGBzZWxlY3QgdG9rZW5fdHlwZSwgc2NvcGVzLCB1cGRhdGVkX2F0IGZyb20gY3VzdG9tZXJfZ2l0aHViX3Rva2VucyB3aGVyZSBjdXN0b21lcl9pZD0kMSBsaW1pdCAxYCxcbiAgICAgIFtrcm93LmN1c3RvbWVyX2lkXVxuICAgICk7XG4gICAgY29uc3QgY29ubmVjdGVkID0gISFyLnJvd0NvdW50O1xuXG4gICAgLy8gQXZvaWQgY2FsbGluZyBHaXRIdWIgdW5sZXNzIHRva2VuIGV4aXN0cyBBTkQgY2FsbGVyIGlzIGFkbWluL293bmVyXG4gICAgbGV0IHdob2FtaSA9IG51bGw7XG4gICAgaWYgKGNvbm5lY3RlZCAmJiAoa3Jvdy5yb2xlID09PSBcImFkbWluXCIgfHwga3Jvdy5yb2xlID09PSBcIm93bmVyXCIpKSB7XG4gICAgICBjb25zdCB0b2tlbiA9IGF3YWl0IGdldEdpdEh1YlRva2VuRm9yQ3VzdG9tZXIoa3Jvdy5jdXN0b21lcl9pZCk7XG4gICAgICBpZiAodG9rZW4pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB3aG9hbWkgPSBhd2FpdCBnaEdldChcIi91c2VyXCIsIHRva2VuKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgLy8gaWdub3JlIC0gY29ubmVjdGlvbiBtYXkgc3RpbGwgZXhpc3QgYnV0IHRva2VuIGludmFsaWRcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBqc29uKDIwMCwge1xuICAgICAgb2s6IHRydWUsXG4gICAgICBjb25uZWN0ZWQsXG4gICAgICB0b2tlbl90eXBlOiBjb25uZWN0ZWQgPyByLnJvd3NbMF0udG9rZW5fdHlwZSA6IG51bGwsXG4gICAgICBzY29wZXM6IGNvbm5lY3RlZCA/IChyLnJvd3NbMF0uc2NvcGVzIHx8IFtdKSA6IFtdLFxuICAgICAgdXBkYXRlZF9hdDogY29ubmVjdGVkID8gci5yb3dzWzBdLnVwZGF0ZWRfYXQgOiBudWxsLFxuICAgICAgd2hvYW1pXG4gICAgfSwgY29ycyk7XG4gIH1cblxuICBpZiAocmVxLm1ldGhvZCA9PT0gXCJQT1NUXCIpIHtcbiAgICAvLyBUb2tlbiBpbXBhY3RzIHRoZSB3aG9sZSB0ZW5hbnQ7IHJlcXVpcmUgYWRtaW4vb3duZXJcbiAgICByZXF1aXJlS2V5Um9sZShrcm93LCBcImFkbWluXCIpO1xuXG4gICAgbGV0IGJvZHk7XG4gICAgdHJ5IHsgYm9keSA9IGF3YWl0IHJlcS5qc29uKCk7IH0gY2F0Y2ggeyByZXR1cm4gYmFkUmVxdWVzdChcIkludmFsaWQgSlNPTlwiLCBjb3JzKTsgfVxuXG4gICAgY29uc3QgdG9rZW4gPSAoYm9keS50b2tlbiB8fCBcIlwiKS50b1N0cmluZygpLnRyaW0oKTtcbiAgICBpZiAoIXRva2VuKSByZXR1cm4gYmFkUmVxdWVzdChcIk1pc3NpbmcgdG9rZW5cIiwgY29ycyk7XG5cbiAgICBjb25zdCB0b2tlbl90eXBlID0gKGJvZHkudG9rZW5fdHlwZSB8fCBcInBhdFwiKS50b1N0cmluZygpLnNsaWNlKDAsIDMyKTtcbiAgICBjb25zdCBzY29wZXMgPSBBcnJheS5pc0FycmF5KGJvZHkuc2NvcGVzKSA/IGJvZHkuc2NvcGVzIDogW107XG5cbiAgICBhd2FpdCBzZXRHaXRIdWJUb2tlbkZvckN1c3RvbWVyKGtyb3cuY3VzdG9tZXJfaWQsIHRva2VuLCB0b2tlbl90eXBlLCBzY29wZXMpO1xuXG4gICAgYXdhaXQgYXVkaXQoYGtleToke2tyb3cua2V5X2xhc3Q0fWAsIFwiR0lUSFVCX1RPS0VOX1NFVFwiLCBgY3VzdG9tZXI6JHtrcm93LmN1c3RvbWVyX2lkfWAsIHtcbiAgICAgIHRva2VuX3R5cGUsXG4gICAgICBzY29wZXNfY291bnQ6IEFycmF5LmlzQXJyYXkoc2NvcGVzKSA/IHNjb3Blcy5sZW5ndGggOiAwXG4gICAgfSk7XG5cbiAgICByZXR1cm4ganNvbigyMDAsIHsgb2s6IHRydWUgfSwgY29ycyk7XG4gIH1cblxuICBpZiAocmVxLm1ldGhvZCA9PT0gXCJERUxFVEVcIikge1xuICAgIHJlcXVpcmVLZXlSb2xlKGtyb3csIFwiYWRtaW5cIik7XG4gICAgYXdhaXQgY2xlYXJHaXRIdWJUb2tlbkZvckN1c3RvbWVyKGtyb3cuY3VzdG9tZXJfaWQpO1xuXG4gICAgYXdhaXQgYXVkaXQoYGtleToke2tyb3cua2V5X2xhc3Q0fWAsIFwiR0lUSFVCX1RPS0VOX0NMRUFSXCIsIGBjdXN0b21lcjoke2tyb3cuY3VzdG9tZXJfaWR9YCk7XG5cbiAgICByZXR1cm4ganNvbigyMDAsIHsgb2s6IHRydWUgfSwgY29ycyk7XG4gIH1cblxuICByZXR1cm4ganNvbig0MDUsIHsgZXJyb3I6IFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIgfSwgY29ycyk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7QUFBTyxTQUFTLFVBQVUsS0FBSztBQUM3QixRQUFNLFlBQVksUUFBUSxJQUFJLG1CQUFtQixJQUFJLEtBQUs7QUFDMUQsUUFBTSxZQUFZLElBQUksUUFBUSxJQUFJLFFBQVEsS0FB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QTtBQUFBO0FBQUEsTUFVQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFXQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVdBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BUUE7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFPQTtBQUFBLE1BQTJHO0FBQUEsTUFDM0c7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BWUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUdBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQW1CQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BK0JBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BR0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU1BO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFrQkE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BT0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BU0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BWUE7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BU0E7QUFBQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU9BO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFjQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFRQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUF1QkE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQSxNQUdBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BZUE7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWlCQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFPQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BV0E7QUFBQSxJQUVOO0FBRUksZUFBVyxLQUFLLFlBQVk7QUFDMUIsWUFBTSxJQUFJLE1BQU0sQ0FBQztBQUFBLElBQ25CO0FBQUEsRUFDRixHQUFHO0FBRUgsU0FBTztBQUNUO0FBT0EsZUFBc0IsRUFBRSxNQUFNLFNBQVMsQ0FB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
