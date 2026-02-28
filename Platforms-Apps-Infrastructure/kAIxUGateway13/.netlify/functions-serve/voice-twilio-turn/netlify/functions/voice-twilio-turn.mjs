
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

// netlify/functions/_lib/twilio.js
import crypto from "crypto";
function computeTwilioSignature({ url, params, authToken }) {
  const keys = Object.keys(params || {}).sort();
  let data = url;
  for (const k of keys) data += k + (params[k] ?? "");
  const h = crypto.createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  return h;
}
function timingSafeEqual(a, b) {
  const aa = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}
function validateTwilioRequest({ req, url, params }) {
  const auth = (process.env.TWILIO_AUTH_TOKEN || "").toString();
  if (!auth) return { ok: false, status: 500, error: "Missing TWILIO_AUTH_TOKEN" };
  const sig = req.headers.get("x-twilio-signature") || req.headers.get("X-Twilio-Signature") || "";
  if (!sig) return { ok: false, status: 401, error: "Missing X-Twilio-Signature" };
  const expected = computeTwilioSignature({ url, params, authToken: auth });
  const ok = timingSafeEqual(sig, expected);
  if (!ok) return { ok: false, status: 401, error: "Invalid Twilio signature" };
  return { ok: true };
}
function twiml(xmlBody) {
  return new Response(xmlBody, {
    status: 200,
    headers: {
      "content-type": "text/xml; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
function escapeXml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function sayGatherTwiml({ say, actionUrl, language = "en-US", voice = "alice", hints = null, timeout = 3 }) {
  const sayText = escapeXml(say || "");
  const action = escapeXml(actionUrl);
  const hintAttr = hints ? ` speechHints="${escapeXml(hints)}"` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${action}" method="POST" timeout="${timeout}" speechTimeout="auto" language="${escapeXml(language)}"${hintAttr}>
    <Say voice="${escapeXml(voice)}">${sayText}</Say>
  </Gather>
  <Say voice="${escapeXml(voice)}">I didn't catch that. Please say that again.</Say>
  <Redirect method="POST">${action}</Redirect>
</Response>`;
}
function hangupTwiml({ say, voice = "alice", language = "en-US" }) {
  const sayText = escapeXml(say || "Goodbye.");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeXml(voice)}" language="${escapeXml(language)}">${sayText}</Say>
  <Hangup/>
</Response>`;
}
function dialTwiml({ say, dialNumber, voice = "alice", language = "en-US" }) {
  const sayText = escapeXml(say || "One moment while I connect you.");
  const num = escapeXml(dialNumber);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeXml(voice)}" language="${escapeXml(language)}">${sayText}</Say>
  <Dial>${num}</Dial>
</Response>`;
}

// netlify/functions/_lib/voice.js
async function getVoiceNumberByTo(toNumber) {
  const to = (toNumber || "").toString().trim();
  if (!to) return null;
  const r = await q(`select * from voice_numbers where phone_number = $1 and is_active = true`, [to]);
  return r.rows[0] || null;
}
async function upsertCall({ customerId, voiceNumberId, provider, callSid, fromNumber, toNumber, meta = {} }) {
  const r = await q(
    `insert into voice_calls (customer_id, voice_number_id, provider, provider_call_sid, from_number, to_number, meta)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb)
     on conflict (provider, provider_call_sid)
     do update set from_number=excluded.from_number, to_number=excluded.to_number
     returning *`,
    [customerId, voiceNumberId, provider, callSid, fromNumber || null, toNumber || null, JSON.stringify(meta || {})]
  );
  return r.rows[0];
}
async function addCallMessage(callId, role, content) {
  await q(
    `insert into voice_call_messages (call_id, role, content) values ($1,$2,$3)`,
    [callId, role, (content || "").toString()]
  );
}
async function getRecentMessages(callId, limit = 12) {
  const r = await q(
    `select role, content from voice_call_messages where call_id=$1 order by id desc limit $2`,
    [callId, limit]
  );
  return (r.rows || []).reverse();
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

// netlify/functions/voice-twilio-turn.js
function safeText(s, max = 1400) {
  const t = (s || "").toString().trim();
  return t.length > max ? t.slice(0, max) + "\u2026" : t;
}
function buildSystemPrompt(vn, from, to) {
  const pb = vn.playbook || {};
  const base = pb.system_prompt || `You are Kaixu Voice Operator for SOLEnterprises. You answer business calls like a sharp human assistant.
Rules:
- Be concise, polite, and decisive.
- Ask one question at a time.
- If caller asks to speak with a human, offer to transfer.
- Never ask for full credit card numbers or sensitive personal data.
- Confirm any time/date/dollar amounts before finalizing.
- If you are done and the caller has no further requests, end the call.`;
  const routing = pb.routing || {};
  const tz = vn.timezone || "America/Phoenix";
  return `${base}

Context:
- Tenant/Customer ID: ${vn.customer_id}
- Called Number: ${to}
- Caller Number: ${from}
- Timezone: ${tz}

Transfer:
- If transfer is needed, say: "<TRANSFER/>" on its own line at the end of your response.
- If ending the call, say: "<END_CALL/>" on its own line at the end of your response.
`;
}
async function runLLM({ provider, model, messages }) {
  if (provider === "openai") return await callOpenAI({ model, messages });
  if (provider === "anthropic") return await callAnthropic({ model, messages });
  if (provider === "gemini") return await callGemini({ model, messages });
  const err = new Error("Unsupported provider");
  err.status = 400;
  throw err;
}
var voice_twilio_turn_default = wrap(async (req) => {
  const bodyText = await req.text();
  const params = Object.fromEntries(new URLSearchParams(bodyText));
  const url = new URL(req.url);
  const fullUrl = url.toString();
  const v = validateTwilioRequest({ req, url: fullUrl, params });
  if (!v.ok) return new Response(v.error, { status: v.status || 401, headers: { "content-type": "text/plain" } });
  const callSid = params.CallSid || params.CallSID;
  const from = params.From || "";
  const to = params.To || "";
  const speech = params.SpeechResult || params.speechResult || "";
  if (!callSid || !to) return new Response("Missing CallSid/To", { status: 400 });
  const vn = await getVoiceNumberByTo(to);
  if (!vn) return twiml(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, this number is not configured.</Say><Hangup/></Response>`);
  const call = await upsertCall({
    customerId: vn.customer_id,
    voiceNumberId: vn.id,
    provider: "twilio",
    callSid,
    fromNumber: from,
    toNumber: to,
    meta: { twilio: { account_sid: params.AccountSid || null } }
  });
  const utterance = safeText(speech || "");
  if (utterance) await addCallMessage(call.id, "user", utterance);
  const recent = await getRecentMessages(call.id, 14);
  const system = buildSystemPrompt(vn, from, to);
  const messages = [
    { role: "system", content: system },
    ...recent.map((m) => ({ role: m.role, content: m.content }))
  ];
  const provider = (vn.default_llm_provider || "openai").toString().toLowerCase();
  const model = (vn.default_llm_model || "gpt-4.1-mini").toString();
  let assistant = "Sorry\u2014one moment. Could you repeat that?";
  try {
    const res = await runLLM({ provider, model, messages });
    assistant = res && res.text ? String(res.text) : assistant;
  } catch (e) {
    assistant = "I hit a system error. Let me connect you with a human.";
    assistant += "\n<TRANSFER/>";
  }
  const lines = assistant.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const hasTransfer = lines.includes("<TRANSFER/>");
  const hasEnd = lines.includes("<END_CALL/>");
  const clean = assistant.replace(/\n\s*<TRANSFER\/>\s*/g, "\n").replace(/\n\s*<END_CALL\/>\s*/g, "\n").trim();
  await addCallMessage(call.id, "assistant", safeText(clean, 4e3));
  const actionUrl = new URL("/.netlify/functions/voice-twilio-turn", url.origin).toString();
  if (hasTransfer) {
    const transferNumber = vn.playbook && vn.playbook.transfer_number ? String(vn.playbook.transfer_number) : process.env.VOICE_FALLBACK_TRANSFER_NUMBER || "";
    if (!transferNumber) {
      return twiml(sayGatherTwiml({
        say: clean + " I can't transfer right now\u2014please leave a message after the tone, or call back.",
        actionUrl,
        language: vn.locale || "en-US",
        voice: "alice"
      }));
    }
    return twiml(dialTwiml({ say: clean || "Connecting you now.", dialNumber: transferNumber, voice: "alice", language: vn.locale || "en-US" }));
  }
  if (hasEnd) {
    return twiml(hangupTwiml({ say: clean || "Goodbye.", voice: "alice", language: vn.locale || "en-US" }));
  }
  return twiml(sayGatherTwiml({
    say: clean,
    actionUrl,
    language: vn.locale || "en-US",
    voice: "alice"
  }));
});
export {
  voice_twilio_turn_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9odHRwLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvZGIuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9tb25pdG9yLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvd3JhcC5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL3R3aWxpby5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL3ZvaWNlLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvcHJvdmlkZXJzLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL3ZvaWNlLXR3aWxpby10dXJuLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJleHBvcnQgZnVuY3Rpb24gYnVpbGRDb3JzKHJlcSkge1xuICBjb25zdCBhbGxvd1JhdyA9IChwcm9jZXNzLmVudi5BTExPV0VEX09SSUdJTlMgfHwgXCJcIikudHJpbSgpO1xuICBjb25zdCByZXFPcmlnaW4gPSByZXEuaGVhZGVycy5nZXQoXCJvcmlnaW5cIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiT3JpZ2luXCIpO1xuXG4gIC8vIElNUE9SVEFOVDoga2VlcCB0aGlzIGxpc3QgYWxpZ25lZCB3aXRoIHdoYXRldmVyIGhlYWRlcnMgeW91ciBhcHBzIHNlbmQuXG4gIGNvbnN0IGFsbG93SGVhZGVycyA9IFwiYXV0aG9yaXphdGlvbiwgY29udGVudC10eXBlLCB4LWthaXh1LWluc3RhbGwtaWQsIHgta2FpeHUtcmVxdWVzdC1pZCwgeC1rYWl4dS1hcHAsIHgta2FpeHUtYnVpbGQsIHgtYWRtaW4tcGFzc3dvcmQsIHgta2FpeHUtZXJyb3ItdG9rZW4sIHgta2FpeHUtbW9kZSwgeC1jb250ZW50LXNoYTEsIHgtc2V0dXAtc2VjcmV0LCB4LWthaXh1LWpvYi1zZWNyZXQsIHgtam9iLXdvcmtlci1zZWNyZXRcIjtcbiAgY29uc3QgYWxsb3dNZXRob2RzID0gXCJHRVQsUE9TVCxQVVQsUEFUQ0gsREVMRVRFLE9QVElPTlNcIjtcblxuICBjb25zdCBiYXNlID0ge1xuICAgIFwiYWNjZXNzLWNvbnRyb2wtYWxsb3ctaGVhZGVyc1wiOiBhbGxvd0hlYWRlcnMsXG4gICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1tZXRob2RzXCI6IGFsbG93TWV0aG9kcyxcbiAgICBcImFjY2Vzcy1jb250cm9sLWV4cG9zZS1oZWFkZXJzXCI6IFwieC1rYWl4dS1yZXF1ZXN0LWlkXCIsXG4gICAgXCJhY2Nlc3MtY29udHJvbC1tYXgtYWdlXCI6IFwiODY0MDBcIlxuICB9O1xuXG4gIC8vIFNUUklDVCBCWSBERUZBVUxUOlxuICAvLyAtIElmIEFMTE9XRURfT1JJR0lOUyBpcyB1bnNldC9ibGFuayBhbmQgYSBicm93c2VyIE9yaWdpbiBpcyBwcmVzZW50LCB3ZSBkbyBOT1QgZ3JhbnQgQ09SUy5cbiAgLy8gLSBBbGxvdy1hbGwgaXMgb25seSBlbmFibGVkIHdoZW4gQUxMT1dFRF9PUklHSU5TIGV4cGxpY2l0bHkgY29udGFpbnMgXCIqXCIuXG4gIGlmICghYWxsb3dSYXcpIHtcbiAgICAvLyBObyBhbGxvdy1vcmlnaW4gZ3JhbnRlZC4gU2VydmVyLXRvLXNlcnZlciByZXF1ZXN0cyAobm8gT3JpZ2luIGhlYWRlcikgc3RpbGwgd29yayBub3JtYWxseS5cbiAgICByZXR1cm4ge1xuICAgICAgLi4uYmFzZSxcbiAgICAgIC4uLihyZXFPcmlnaW4gPyB7IHZhcnk6IFwiT3JpZ2luXCIgfSA6IHt9KVxuICAgIH07XG4gIH1cblxuICBjb25zdCBhbGxvd2VkID0gYWxsb3dSYXcuc3BsaXQoXCIsXCIpLm1hcCgocykgPT4gcy50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcblxuICAvLyBFeHBsaWNpdCBhbGxvdy1hbGxcbiAgaWYgKGFsbG93ZWQuaW5jbHVkZXMoXCIqXCIpKSB7XG4gICAgY29uc3Qgb3JpZ2luID0gcmVxT3JpZ2luIHx8IFwiKlwiO1xuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlLFxuICAgICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1vcmlnaW5cIjogb3JpZ2luLFxuICAgICAgLi4uKHJlcU9yaWdpbiA/IHsgdmFyeTogXCJPcmlnaW5cIiB9IDoge30pXG4gICAgfTtcbiAgfVxuXG4gIC8vIEV4YWN0LW1hdGNoIGFsbG93bGlzdFxuICBpZiAocmVxT3JpZ2luICYmIGFsbG93ZWQuaW5jbHVkZXMocmVxT3JpZ2luKSkge1xuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlLFxuICAgICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1vcmlnaW5cIjogcmVxT3JpZ2luLFxuICAgICAgdmFyeTogXCJPcmlnaW5cIlxuICAgIH07XG4gIH1cblxuICAvLyBPcmlnaW4gcHJlc2VudCBidXQgbm90IGFsbG93ZWQ6IGRvIG5vdCBncmFudCBhbGxvdy1vcmlnaW4uXG4gIHJldHVybiB7XG4gICAgLi4uYmFzZSxcbiAgICAuLi4ocmVxT3JpZ2luID8geyB2YXJ5OiBcIk9yaWdpblwiIH0gOiB7fSlcbiAgfTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24ganNvbihzdGF0dXMsIGJvZHksIGhlYWRlcnMgPSB7fSkge1xuICByZXR1cm4gbmV3IFJlc3BvbnNlKEpTT04uc3RyaW5naWZ5KGJvZHkpLCB7XG4gICAgc3RhdHVzLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOFwiLFxuICAgICAgLi4uaGVhZGVyc1xuICAgIH1cbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZXh0KHN0YXR1cywgYm9keSwgaGVhZGVycyA9IHt9KSB7XG4gIHJldHVybiBuZXcgUmVzcG9uc2UoYm9keSwgeyBzdGF0dXMsIGhlYWRlcnMgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBiYWRSZXF1ZXN0KG1lc3NhZ2UsIGhlYWRlcnMgPSB7fSkge1xuICByZXR1cm4ganNvbig0MDAsIHsgZXJyb3I6IG1lc3NhZ2UgfSwgaGVhZGVycyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRCZWFyZXIocmVxKSB7XG4gIGNvbnN0IGF1dGggPSByZXEuaGVhZGVycy5nZXQoXCJhdXRob3JpemF0aW9uXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIkF1dGhvcml6YXRpb25cIikgfHwgXCJcIjtcbiAgaWYgKCFhdXRoLnN0YXJ0c1dpdGgoXCJCZWFyZXIgXCIpKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIGF1dGguc2xpY2UoNykudHJpbSgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbW9udGhLZXlVVEMoZCA9IG5ldyBEYXRlKCkpIHtcbiAgcmV0dXJuIGQudG9JU09TdHJpbmcoKS5zbGljZSgwLCA3KTsgLy8gWVlZWS1NTVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5zdGFsbElkKHJlcSkge1xuICByZXR1cm4gKFxuICAgIHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtaW5zdGFsbC1pZFwiKSB8fFxuICAgIHJlcS5oZWFkZXJzLmdldChcIlgtS2FpeHUtSW5zdGFsbC1JZFwiKSB8fFxuICAgIFwiXCJcbiAgKS50b1N0cmluZygpLnRyaW0oKS5zbGljZSgwLCA4MCkgfHwgbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFVzZXJBZ2VudChyZXEpIHtcbiAgcmV0dXJuIChyZXEuaGVhZGVycy5nZXQoXCJ1c2VyLWFnZW50XCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIlVzZXItQWdlbnRcIikgfHwgXCJcIikudG9TdHJpbmcoKS5zbGljZSgwLCAyNDApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q2xpZW50SXAocmVxKSB7XG4gIC8vIE5ldGxpZnkgYWRkcyB4LW5mLWNsaWVudC1jb25uZWN0aW9uLWlwIHdoZW4gZGVwbG95ZWQgKG1heSBiZSBtaXNzaW5nIGluIG5ldGxpZnkgZGV2KS5cbiAgY29uc3QgYSA9IChyZXEuaGVhZGVycy5nZXQoXCJ4LW5mLWNsaWVudC1jb25uZWN0aW9uLWlwXCIpIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpO1xuICBpZiAoYSkgcmV0dXJuIGE7XG5cbiAgLy8gRmFsbGJhY2sgdG8gZmlyc3QgWC1Gb3J3YXJkZWQtRm9yIGVudHJ5LlxuICBjb25zdCB4ZmYgPSAocmVxLmhlYWRlcnMuZ2V0KFwieC1mb3J3YXJkZWQtZm9yXCIpIHx8IFwiXCIpLnRvU3RyaW5nKCk7XG4gIGlmICgheGZmKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgZmlyc3QgPSB4ZmYuc3BsaXQoXCIsXCIpWzBdLnRyaW0oKTtcbiAgcmV0dXJuIGZpcnN0IHx8IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzbGVlcChtcykge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgbXMpKTtcbn0iLCAiaW1wb3J0IHsgbmVvbiB9IGZyb20gXCJAbmV0bGlmeS9uZW9uXCI7XG5cbi8qKlxuICogTmV0bGlmeSBEQiAoTmVvbiBQb3N0Z3JlcykgaGVscGVyLlxuICpcbiAqIElNUE9SVEFOVCAoTmVvbiBzZXJ2ZXJsZXNzIGRyaXZlciwgMjAyNSspOlxuICogLSBgbmVvbigpYCByZXR1cm5zIGEgdGFnZ2VkLXRlbXBsYXRlIHF1ZXJ5IGZ1bmN0aW9uLlxuICogLSBGb3IgZHluYW1pYyBTUUwgc3RyaW5ncyArICQxIHBsYWNlaG9sZGVycywgdXNlIGBzcWwucXVlcnkodGV4dCwgcGFyYW1zKWAuXG4gKiAgIChDYWxsaW5nIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvbiBsaWtlIHNxbChcIlNFTEVDVCAuLi5cIikgY2FuIGJyZWFrIG9uIG5ld2VyIGRyaXZlciB2ZXJzaW9ucy4pXG4gKlxuICogTmV0bGlmeSBEQiBhdXRvbWF0aWNhbGx5IGluamVjdHMgYE5FVExJRllfREFUQUJBU0VfVVJMYCB3aGVuIHRoZSBOZW9uIGV4dGVuc2lvbiBpcyBhdHRhY2hlZC5cbiAqL1xuXG5sZXQgX3NxbCA9IG51bGw7XG5sZXQgX3NjaGVtYVByb21pc2UgPSBudWxsO1xuXG5mdW5jdGlvbiBnZXRTcWwoKSB7XG4gIGlmIChfc3FsKSByZXR1cm4gX3NxbDtcblxuICBjb25zdCBoYXNEYlVybCA9ICEhKHByb2Nlc3MuZW52Lk5FVExJRllfREFUQUJBU0VfVVJMIHx8IHByb2Nlc3MuZW52LkRBVEFCQVNFX1VSTCk7XG4gIGlmICghaGFzRGJVcmwpIHtcbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXCJEYXRhYmFzZSBub3QgY29uZmlndXJlZCAobWlzc2luZyBORVRMSUZZX0RBVEFCQVNFX1VSTCkuIEF0dGFjaCBOZXRsaWZ5IERCIChOZW9uKSB0byB0aGlzIHNpdGUuXCIpO1xuICAgIGVyci5jb2RlID0gXCJEQl9OT1RfQ09ORklHVVJFRFwiO1xuICAgIGVyci5zdGF0dXMgPSA1MDA7XG4gICAgZXJyLmhpbnQgPSBcIk5ldGxpZnkgVUkgXHUyMTkyIEV4dGVuc2lvbnMgXHUyMTkyIE5lb24gXHUyMTkyIEFkZCBkYXRhYmFzZSAob3IgcnVuOiBucHggbmV0bGlmeSBkYiBpbml0KS5cIjtcbiAgICB0aHJvdyBlcnI7XG4gIH1cblxuICBfc3FsID0gbmVvbigpOyAvLyBhdXRvLXVzZXMgcHJvY2Vzcy5lbnYuTkVUTElGWV9EQVRBQkFTRV9VUkwgb24gTmV0bGlmeVxuICByZXR1cm4gX3NxbDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZW5zdXJlU2NoZW1hKCkge1xuICBpZiAoX3NjaGVtYVByb21pc2UpIHJldHVybiBfc2NoZW1hUHJvbWlzZTtcblxuICBfc2NoZW1hUHJvbWlzZSA9IChhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgc3FsID0gZ2V0U3FsKCk7XG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IFtcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcnMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGVtYWlsIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBwbGFuX25hbWUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdzdGFydGVyJyxcbiAgICAgICAgbW9udGhseV9jYXBfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDIwMDAsXG4gICAgICAgIGlzX2FjdGl2ZSBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgdHJ1ZSxcbiAgICAgICAgc3RyaXBlX2N1c3RvbWVyX2lkIHRleHQsXG4gICAgICAgIHN0cmlwZV9zdWJzY3JpcHRpb25faWQgdGV4dCxcbiAgICAgICAgc3RyaXBlX3N0YXR1cyB0ZXh0LFxuICAgICAgICBzdHJpcGVfY3VycmVudF9wZXJpb2RfZW5kIHRpbWVzdGFtcHR6LFxuICAgICAgICBhdXRvX3RvcHVwX2VuYWJsZWQgYm9vbGVhbiBub3QgbnVsbCBkZWZhdWx0IGZhbHNlLFxuICAgICAgICBhdXRvX3RvcHVwX2Ftb3VudF9jZW50cyBpbnRlZ2VyLFxuICAgICAgICBhdXRvX3RvcHVwX3RocmVzaG9sZF9jZW50cyBpbnRlZ2VyLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhcGlfa2V5cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAga2V5X2hhc2ggdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIGtleV9sYXN0NCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBsYWJlbCB0ZXh0LFxuICAgICAgICBtb250aGx5X2NhcF9jZW50cyBpbnRlZ2VyLFxuICAgICAgICBycG1fbGltaXQgaW50ZWdlcixcbiAgICAgICAgcnBkX2xpbWl0IGludGVnZXIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcmV2b2tlZF9hdCB0aW1lc3RhbXB0elxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFwaV9rZXlzX2N1c3RvbWVyX2lkX2lkeCBvbiBhcGlfa2V5cyhjdXN0b21lcl9pZCk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBtb250aGx5X3VzYWdlIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc3BlbnRfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGV4dHJhX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBtb250aGx5X2tleV91c2FnZSAoXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzcGVudF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgaW5wdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjYWxscyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoYXBpX2tleV9pZCwgbW9udGgpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgbW9udGhseV9rZXlfdXNhZ2VfY3VzdG9tZXJfbW9udGhfaWR4IG9uIG1vbnRobHlfa2V5X3VzYWdlKGN1c3RvbWVyX2lkLCBtb250aCk7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBtb250aGx5X2tleV91c2FnZSBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgY2FsbHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDA7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtb2RlbCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHVzYWdlX2V2ZW50c19jdXN0b21lcl9tb250aF9pZHggb24gdXNhZ2VfZXZlbnRzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzX2tleV9pZHggb24gdXNhZ2VfZXZlbnRzKGFwaV9rZXlfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhdWRpdF9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGFjdG9yIHRleHQgbm90IG51bGwsXG4gICAgICAgIGFjdGlvbiB0ZXh0IG5vdCBudWxsLFxuICAgICAgICB0YXJnZXQgdGV4dCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhdWRpdF9ldmVudHNfY3JlYXRlZF9pZHggb24gYXVkaXRfZXZlbnRzKGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyByYXRlX2xpbWl0X3dpbmRvd3MgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgd2luZG93X3N0YXJ0IHRpbWVzdGFtcHR6IG5vdCBudWxsLFxuICAgICAgICBjb3VudCBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCB3aW5kb3dfc3RhcnQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcmF0ZV9saW1pdF93aW5kb3dzX3dpbmRvd19pZHggb24gcmF0ZV9saW1pdF93aW5kb3dzKHdpbmRvd19zdGFydCBkZXNjKTtgLCAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9zZWVuX2F0IHRpbWVzdGFtcHR6O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxhc3Rfc2Vlbl9pbnN0YWxsX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSB1c2FnZV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGluc3RhbGxfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHVzYWdlX2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgaXBfaGFzaCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgdXNhZ2VfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyB1YSB0ZXh0O2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzX2luc3RhbGxfaWR4IG9uIHVzYWdlX2V2ZW50cyhpbnN0YWxsX2lkKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGFsZXJ0c19zZW50IChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIGFsZXJ0X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIG1vbnRoLCBhbGVydF90eXBlKVxuICAgICAgKTtgLFxuICAgIFxuICAgICAgLy8gLS0tIERldmljZSBiaW5kaW5nIC8gc2VhdHMgLS0tXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtYXhfZGV2aWNlc19wZXJfa2V5IGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlcXVpcmVfaW5zdGFsbF9pZCBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgZmFsc2U7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfcHJvdmlkZXJzIHRleHRbXTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9tb2RlbHMganNvbmI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHN0cmlwZV9jdXJyZW50X3BlcmlvZF9lbmQgdGltZXN0YW1wdHo7YCxcblxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtYXhfZGV2aWNlcyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlcXVpcmVfaW5zdGFsbF9pZCBib29sZWFuO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfcHJvdmlkZXJzIHRleHRbXTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhbGxvd2VkX21vZGVscyBqc29uYjtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMga2V5X2RldmljZXMgKFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgaW5zdGFsbF9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBkZXZpY2VfbGFiZWwgdGV4dCxcbiAgICAgICAgZmlyc3Rfc2Vlbl9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBsYXN0X3NlZW5fYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGxhc3Rfc2Vlbl91YSB0ZXh0LFxuICAgICAgICByZXZva2VkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICByZXZva2VkX2J5IHRleHQsXG4gICAgICAgIHByaW1hcnkga2V5IChhcGlfa2V5X2lkLCBpbnN0YWxsX2lkKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGtleV9kZXZpY2VzX2N1c3RvbWVyX2lkeCBvbiBrZXlfZGV2aWNlcyhjdXN0b21lcl9pZCk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBrZXlfZGV2aWNlc19sYXN0X3NlZW5faWR4IG9uIGtleV9kZXZpY2VzKGxhc3Rfc2Vlbl9hdCBkZXNjKTtgLFxuXG4gICAgICAvLyAtLS0gSW52b2ljZSBzbmFwc2hvdHMgKyB0b3B1cHMgLS0tXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgbW9udGhseV9pbnZvaWNlcyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHNuYXBzaG90IGpzb25iIG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB0b3B1cF9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIGFtb3VudF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsLFxuICAgICAgICBzb3VyY2UgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdtYW51YWwnLFxuICAgICAgICBzdHJpcGVfc2Vzc2lvbl9pZCB0ZXh0LFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdhcHBsaWVkJyxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdG9wdXBfZXZlbnRzX2N1c3RvbWVyX21vbnRoX2lkeCBvbiB0b3B1cF9ldmVudHMoY3VzdG9tZXJfaWQsIG1vbnRoKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgYXN5bmNfam9icyAoXG4gICAgICAgIGlkIHV1aWQgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtb2RlbCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICByZXF1ZXN0IGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3F1ZXVlZCcsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgc3RhcnRlZF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgY29tcGxldGVkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBoZWFydGJlYXRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIG91dHB1dF90ZXh0IHRleHQsXG4gICAgICAgIGVycm9yIHRleHQsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXN5bmNfam9ic19jdXN0b21lcl9jcmVhdGVkX2lkeCBvbiBhc3luY19qb2JzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXN5bmNfam9ic19zdGF0dXNfaWR4IG9uIGFzeW5jX2pvYnMoc3RhdHVzLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIHJlcXVlc3RfaWQgdGV4dCxcbiAgICAgICAgbGV2ZWwgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbmZvJyxcbiAgICAgICAga2luZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBmdW5jdGlvbl9uYW1lIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1ldGhvZCB0ZXh0LFxuICAgICAgICBwYXRoIHRleHQsXG4gICAgICAgIG9yaWdpbiB0ZXh0LFxuICAgICAgICByZWZlcmVyIHRleHQsXG4gICAgICAgIHVzZXJfYWdlbnQgdGV4dCxcbiAgICAgICAgaXAgdGV4dCxcbiAgICAgICAgYXBwX2lkIHRleHQsXG4gICAgICAgIGJ1aWxkX2lkIHRleHQsXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQsXG4gICAgICAgIHByb3ZpZGVyIHRleHQsXG4gICAgICAgIG1vZGVsIHRleHQsXG4gICAgICAgIGh0dHBfc3RhdHVzIGludGVnZXIsXG4gICAgICAgIGR1cmF0aW9uX21zIGludGVnZXIsXG4gICAgICAgIGVycm9yX2NvZGUgdGV4dCxcbiAgICAgICAgZXJyb3JfbWVzc2FnZSB0ZXh0LFxuICAgICAgICBlcnJvcl9zdGFjayB0ZXh0LFxuICAgICAgICB1cHN0cmVhbV9zdGF0dXMgaW50ZWdlcixcbiAgICAgICAgdXBzdHJlYW1fYm9keSB0ZXh0LFxuICAgICAgICBleHRyYSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcblxuICAgICAgLy8gRm9yd2FyZC1jb21wYXRpYmxlIHBhdGNoaW5nOiBpZiBnYXRld2F5X2V2ZW50cyBleGlzdGVkIGZyb20gYW4gb2xkZXIgYnVpbGQsXG4gICAgICAvLyBpdCBtYXkgYmUgbWlzc2luZyBjb2x1bW5zIHVzZWQgYnkgbW9uaXRvciBpbnNlcnRzLlxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByZXF1ZXN0X2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGV2ZWwgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbmZvJztgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBraW5kIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZXZlbnQnO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGZ1bmN0aW9uX25hbWUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd1bmtub3duJztgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtZXRob2QgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBwYXRoIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgb3JpZ2luIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVmZXJlciB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVzZXJfYWdlbnQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBpcCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFwcF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGJ1aWxkX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfaWQgYmlnaW50O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFwaV9rZXlfaWQgYmlnaW50O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHByb3ZpZGVyIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbW9kZWwgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBodHRwX3N0YXR1cyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGR1cmF0aW9uX21zIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZXJyb3JfY29kZSB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGVycm9yX21lc3NhZ2UgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBlcnJvcl9zdGFjayB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVwc3RyZWFtX3N0YXR1cyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVwc3RyZWFtX2JvZHkgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBleHRyYSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKTtgLFxuXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfY3JlYXRlZF9pZHggb24gZ2F0ZXdheV9ldmVudHMoY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX3JlcXVlc3RfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKHJlcXVlc3RfaWQpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfbGV2ZWxfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKGxldmVsLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfZm5faWR4IG9uIGdhdGV3YXlfZXZlbnRzKGZ1bmN0aW9uX25hbWUsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19hcHBfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKGFwcF9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuXG4gICAgICAvLyAtLS0gS2FpeHVQdXNoIChEZXBsb3kgUHVzaCkgZW50ZXJwcmlzZSB0YWJsZXMgLS0tXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJvbGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdkZXBsb3llcic7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhcGlfa2V5c19yb2xlX2lkeCBvbiBhcGlfa2V5cyhyb2xlKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVyX25ldGxpZnlfdG9rZW5zIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IHByaW1hcnkga2V5IHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgdG9rZW5fZW5jIHRleHQgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9wcm9qZWN0cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJvamVjdF9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBuYW1lIHRleHQgbm90IG51bGwsXG4gICAgICAgIG5ldGxpZnlfc2l0ZV9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdW5pcXVlIChjdXN0b21lcl9pZCwgcHJvamVjdF9pZClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX3Byb2plY3RzX2N1c3RvbWVyX2lkeCBvbiBwdXNoX3Byb2plY3RzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9wdXNoZXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm9qZWN0X3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3Byb2plY3RzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHVzaF9pZCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgYnJhbmNoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHRpdGxlIHRleHQsXG4gICAgICAgIGRlcGxveV9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzdGF0ZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICByZXF1aXJlZF9kaWdlc3RzIHRleHRbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OnRleHRbXSxcbiAgICAgICAgdXBsb2FkZWRfZGlnZXN0cyB0ZXh0W10gbm90IG51bGwgZGVmYXVsdCAne30nOjp0ZXh0W10sXG4gICAgICAgIGZpbGVfbWFuaWZlc3QganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgdXJsIHRleHQsXG4gICAgICAgIGVycm9yIHRleHQsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9wdXNoZXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGZpbGVfbWFuaWZlc3QganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYjtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfcHVzaGVzX2N1c3RvbWVyX2lkeCBvbiBwdXNoX3B1c2hlcyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfam9icyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgcHVzaF9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wdXNoZXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBzaGExIGNoYXIoNDApIG5vdCBudWxsLFxuICAgICAgICBkZXBsb3lfcGF0aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBwYXJ0cyBpbnRlZ2VyIG5vdCBudWxsLFxuICAgICAgICByZWNlaXZlZF9wYXJ0cyBpbnRlZ2VyW10gbm90IG51bGwgZGVmYXVsdCAne30nOjppbnRbXSxcbiAgICAgICAgcGFydF9ieXRlcyBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBieXRlc19zdGFnZWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAndXBsb2FkaW5nJyxcbiAgICAgICAgZXJyb3IgdGV4dCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVuaXF1ZSAocHVzaF9yb3dfaWQsIHNoYTEpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9qb2JzX3B1c2hfaWR4IG9uIHB1c2hfam9icyhwdXNoX3Jvd19pZCwgdXBkYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYnl0ZXNfc3RhZ2VkIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDA7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHBhcnRfYnl0ZXMganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYXR0ZW1wdHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDA7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG5leHRfYXR0ZW1wdF9hdCB0aW1lc3RhbXB0ejtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9lcnJvciB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X2Vycm9yX2F0IHRpbWVzdGFtcHR6O2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3JhdGVfd2luZG93cyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGJ1Y2tldF90eXBlIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJ1Y2tldF9zdGFydCB0aW1lc3RhbXB0eiBub3QgbnVsbCxcbiAgICAgICAgY291bnQgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHByaW1hcnkga2V5KGN1c3RvbWVyX2lkLCBidWNrZXRfdHlwZSwgYnVja2V0X3N0YXJ0KVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfcmF0ZV93aW5kb3dzX2J1Y2tldF9pZHggb24gcHVzaF9yYXRlX3dpbmRvd3MoYnVja2V0X3R5cGUsIGJ1Y2tldF9zdGFydCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfZmlsZXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIHB1c2hfcm93X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHVzaGVzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgZGVwbG95X3BhdGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc2hhMSBjaGFyKDQwKSBub3QgbnVsbCxcbiAgICAgICAgYnl0ZXMgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbW9kZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2RpcmVjdCcsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfZmlsZXNfcHVzaF9pZHggb24gcHVzaF9maWxlcyhwdXNoX3Jvd19pZCk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3VzYWdlX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHB1c2hfcm93X2lkIGJpZ2ludCByZWZlcmVuY2VzIHB1c2hfcHVzaGVzKGlkKSBvbiBkZWxldGUgc2V0IG51bGwsXG4gICAgICAgIGV2ZW50X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYnl0ZXMgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcHJpY2luZ192ZXJzaW9uIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAxLFxuICAgICAgICBjb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfdXNhZ2VfY3VzdG9tZXJfaWR4IG9uIHB1c2hfdXNhZ2VfZXZlbnRzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9wcmljaW5nX3ZlcnNpb25zIChcbiAgICAgICAgdmVyc2lvbiBpbnRlZ2VyIHByaW1hcnkga2V5LFxuICAgICAgICBlZmZlY3RpdmVfZnJvbSBkYXRlIG5vdCBudWxsIGRlZmF1bHQgY3VycmVudF9kYXRlLFxuICAgICAgICBjdXJyZW5jeSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ1VTRCcsXG4gICAgICAgIGJhc2VfbW9udGhfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHBlcl9kZXBsb3lfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHBlcl9nYl9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgaW5zZXJ0IGludG8gcHVzaF9wcmljaW5nX3ZlcnNpb25zKHZlcnNpb24sIGJhc2VfbW9udGhfY2VudHMsIHBlcl9kZXBsb3lfY2VudHMsIHBlcl9nYl9jZW50cylcbiAgICAgICB2YWx1ZXMgKDEsIDAsIDEwLCAyNSkgb24gY29uZmxpY3QgKHZlcnNpb24pIGRvIG5vdGhpbmc7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcl9wdXNoX2JpbGxpbmcgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgcHJpbWFyeSBrZXkgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcmljaW5nX3ZlcnNpb24gaW50ZWdlciBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHJpY2luZ192ZXJzaW9ucyh2ZXJzaW9uKSxcbiAgICAgICAgbW9udGhseV9jYXBfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9pbnZvaWNlcyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHByaWNpbmdfdmVyc2lvbiBpbnRlZ2VyIG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wcmljaW5nX3ZlcnNpb25zKHZlcnNpb24pLFxuICAgICAgICB0b3RhbF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsLFxuICAgICAgICBicmVha2Rvd24ganNvbmIgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuXG4gICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgIC8vIEdpdEh1YiBQdXNoIEdhdGV3YXkgKG9wdGlvbmFsKVxuICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfZ2l0aHViX3Rva2VucyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBwcmltYXJ5IGtleSByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHRva2VuX2VuYyB0ZXh0IG5vdCBudWxsLFxuICAgICAgICB0b2tlbl90eXBlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnb2F1dGgnLFxuICAgICAgICBzY29wZXMgdGV4dFtdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6dGV4dFtdLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGdoX3B1c2hfam9icyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGpvYl9pZCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgb3duZXIgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcmVwbyB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBicmFuY2ggdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdtYWluJyxcbiAgICAgICAgY29tbWl0X21lc3NhZ2UgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdLYWl4dSBHaXRIdWIgUHVzaCcsXG4gICAgICAgIHBhcnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICByZWNlaXZlZF9wYXJ0cyBpbnRlZ2VyW10gbm90IG51bGwgZGVmYXVsdCAne30nOjppbnRbXSxcbiAgICAgICAgcGFydF9ieXRlcyBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBieXRlc19zdGFnZWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAndXBsb2FkaW5nJyxcbiAgICAgICAgYXR0ZW1wdHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG5leHRfYXR0ZW1wdF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgbGFzdF9lcnJvciB0ZXh0LFxuICAgICAgICBsYXN0X2Vycm9yX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICByZXN1bHRfY29tbWl0X3NoYSB0ZXh0LFxuICAgICAgICByZXN1bHRfdXJsIHRleHQsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9qb2JzX2N1c3RvbWVyX2lkeCBvbiBnaF9wdXNoX2pvYnMoY3VzdG9tZXJfaWQsIHVwZGF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnaF9wdXNoX2pvYnNfbmV4dF9hdHRlbXB0X2lkeCBvbiBnaF9wdXNoX2pvYnMobmV4dF9hdHRlbXB0X2F0KSB3aGVyZSBzdGF0dXMgaW4gKCdyZXRyeV93YWl0JywnZXJyb3JfdHJhbnNpZW50Jyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBnaF9wdXNoX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGpvYl9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgZ2hfcHVzaF9qb2JzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgZXZlbnRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBieXRlcyBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdoX3B1c2hfZXZlbnRzX2pvYl9pZHggb24gZ2hfcHVzaF9ldmVudHMoam9iX3Jvd19pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB2b2ljZV9udW1iZXJzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwaG9uZV9udW1iZXIgdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwgZGVmYXVsdCAndHdpbGlvJyxcbiAgICAgICAgdHdpbGlvX3NpZCB0ZXh0LFxuICAgICAgICBpc19hY3RpdmUgYm9vbGVhbiBub3QgbnVsbCBkZWZhdWx0IHRydWUsXG4gICAgICAgIGRlZmF1bHRfbGxtX3Byb3ZpZGVyIHRleHQgbm90IG51bGwgZGVmYXVsdCAnb3BlbmFpJyxcbiAgICAgICAgZGVmYXVsdF9sbG1fbW9kZWwgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdncHQtNC4xLW1pbmknLFxuICAgICAgICB2b2ljZV9uYW1lIHRleHQgbm90IG51bGwgZGVmYXVsdCAnYWxsb3knLFxuICAgICAgICBsb2NhbGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdlbi1VUycsXG4gICAgICAgIHRpbWV6b25lIHRleHQgbm90IG51bGwgZGVmYXVsdCAnQW1lcmljYS9QaG9lbml4JyxcbiAgICAgICAgcGxheWJvb2sganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfbnVtYmVyc19jdXN0b21lcl9pZHggb24gdm9pY2VfbnVtYmVycyhjdXN0b21lcl9pZCk7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB2b2ljZV9udW1iZXJfaWQgYmlnaW50IHJlZmVyZW5jZXMgdm9pY2VfbnVtYmVycyhpZCkgb24gZGVsZXRlIHNldCBudWxsLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3R3aWxpbycsXG4gICAgICAgIHByb3ZpZGVyX2NhbGxfc2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIGZyb21fbnVtYmVyIHRleHQsXG4gICAgICAgIHRvX251bWJlciB0ZXh0LFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbml0aWF0ZWQnLFxuICAgICAgICBkaXJlY3Rpb24gdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbmJvdW5kJyxcbiAgICAgICAgc3RhcnRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBlbmRlZF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgZHVyYXRpb25fc2Vjb25kcyBpbnRlZ2VyLFxuICAgICAgICBlc3RfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgYmlsbF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmJcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdW5pcXVlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbHNfcHJvdmlkZXJfc2lkX3VxIG9uIHZvaWNlX2NhbGxzKHByb3ZpZGVyLCBwcm92aWRlcl9jYWxsX3NpZCk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsc19jdXN0b21lcl9pZHggb24gdm9pY2VfY2FsbHMoY3VzdG9tZXJfaWQsIHN0YXJ0ZWRfYXQgZGVzYyk7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxfbWVzc2FnZXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGNhbGxfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgdm9pY2VfY2FsbHMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICByb2xlIHRleHQgbm90IG51bGwsIC0tIHVzZXJ8YXNzaXN0YW50fHN5c3RlbXx0b29sXG4gICAgICAgIGNvbnRlbnQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbF9tZXNzYWdlc19jYWxsX2lkeCBvbiB2b2ljZV9jYWxsX21lc3NhZ2VzKGNhbGxfaWQsIGlkKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfdXNhZ2VfbW9udGhseSAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbWludXRlcyBudW1lcmljIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgZXN0X2Nvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGJpbGxfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY2FsbHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdW5pcXVlKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV91c2FnZV9tb250aGx5X2N1c3RvbWVyX2lkeCBvbiB2b2ljZV91c2FnZV9tb250aGx5KGN1c3RvbWVyX2lkLCBtb250aCk7YCxcblxuXTtcblxuICAgIGZvciAoY29uc3QgcyBvZiBzdGF0ZW1lbnRzKSB7XG4gICAgICBhd2FpdCBzcWwucXVlcnkocyk7XG4gICAgfVxuICB9KSgpO1xuXG4gIHJldHVybiBfc2NoZW1hUHJvbWlzZTtcbn1cblxuLyoqXG4gKiBRdWVyeSBoZWxwZXIgY29tcGF0aWJsZSB3aXRoIHRoZSBwcmV2aW91cyBgcGdgLWlzaCBpbnRlcmZhY2U6XG4gKiAtIHJldHVybnMgeyByb3dzLCByb3dDb3VudCB9XG4gKiAtIHN1cHBvcnRzICQxLCAkMiBwbGFjZWhvbGRlcnMgKyBwYXJhbXMgYXJyYXkgdmlhIHNxbC5xdWVyeSguLi4pXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBxKHRleHQsIHBhcmFtcyA9IFtdKSB7XG4gIGF3YWl0IGVuc3VyZVNjaGVtYSgpO1xuICBjb25zdCBzcWwgPSBnZXRTcWwoKTtcbiAgY29uc3Qgcm93cyA9IGF3YWl0IHNxbC5xdWVyeSh0ZXh0LCBwYXJhbXMpO1xuICByZXR1cm4geyByb3dzOiByb3dzIHx8IFtdLCByb3dDb3VudDogQXJyYXkuaXNBcnJheShyb3dzKSA/IHJvd3MubGVuZ3RoIDogMCB9O1xufSIsICJpbXBvcnQgeyBxIH0gZnJvbSBcIi4vZGIuanNcIjtcblxuZnVuY3Rpb24gc2FmZVN0cih2LCBtYXggPSA4MDAwKSB7XG4gIGlmICh2ID09IG51bGwpIHJldHVybiBudWxsO1xuICBjb25zdCBzID0gU3RyaW5nKHYpO1xuICBpZiAocy5sZW5ndGggPD0gbWF4KSByZXR1cm4gcztcbiAgcmV0dXJuIHMuc2xpY2UoMCwgbWF4KSArIGBcdTIwMjYoKyR7cy5sZW5ndGggLSBtYXh9IGNoYXJzKWA7XG59XG5cbmZ1bmN0aW9uIHJhbmRvbUlkKCkge1xuICB0cnkge1xuICAgIGlmIChnbG9iYWxUaGlzLmNyeXB0bz8ucmFuZG9tVVVJRCkgcmV0dXJuIGdsb2JhbFRoaXMuY3J5cHRvLnJhbmRvbVVVSUQoKTtcbiAgfSBjYXRjaCB7fVxuICAvLyBmYWxsYmFjayAobm90IFJGQzQxMjItcGVyZmVjdCwgYnV0IHVuaXF1ZSBlbm91Z2ggZm9yIHRyYWNpbmcpXG4gIHJldHVybiBcInJpZF9cIiArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMTYpLnNsaWNlKDIpICsgXCJfXCIgKyBEYXRlLm5vdygpLnRvU3RyaW5nKDE2KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFJlcXVlc3RJZChyZXEpIHtcbiAgY29uc3QgaCA9IChyZXEuaGVhZGVycy5nZXQoXCJ4LWthaXh1LXJlcXVlc3QtaWRcIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwieC1yZXF1ZXN0LWlkXCIpIHx8IFwiXCIpLnRyaW0oKTtcbiAgcmV0dXJuIGggfHwgcmFuZG9tSWQoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluZmVyRnVuY3Rpb25OYW1lKHJlcSkge1xuICB0cnkge1xuICAgIGNvbnN0IHUgPSBuZXcgVVJMKHJlcS51cmwpO1xuICAgIGNvbnN0IG0gPSB1LnBhdGhuYW1lLm1hdGNoKC9cXC9cXC5uZXRsaWZ5XFwvZnVuY3Rpb25zXFwvKFteXFwvXSspL2kpO1xuICAgIHJldHVybiBtID8gbVsxXSA6IFwidW5rbm93blwiO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gXCJ1bmtub3duXCI7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVlc3RNZXRhKHJlcSkge1xuICBsZXQgdXJsID0gbnVsbDtcbiAgdHJ5IHsgdXJsID0gbmV3IFVSTChyZXEudXJsKTsgfSBjYXRjaCB7fVxuICByZXR1cm4ge1xuICAgIG1ldGhvZDogcmVxLm1ldGhvZCB8fCBudWxsLFxuICAgIHBhdGg6IHVybCA/IHVybC5wYXRobmFtZSA6IG51bGwsXG4gICAgcXVlcnk6IHVybCA/IE9iamVjdC5mcm9tRW50cmllcyh1cmwuc2VhcmNoUGFyYW1zLmVudHJpZXMoKSkgOiB7fSxcbiAgICBvcmlnaW46IHJlcS5oZWFkZXJzLmdldChcIm9yaWdpblwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJPcmlnaW5cIikgfHwgbnVsbCxcbiAgICByZWZlcmVyOiByZXEuaGVhZGVycy5nZXQoXCJyZWZlcmVyXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIlJlZmVyZXJcIikgfHwgbnVsbCxcbiAgICB1c2VyX2FnZW50OiByZXEuaGVhZGVycy5nZXQoXCJ1c2VyLWFnZW50XCIpIHx8IG51bGwsXG4gICAgaXA6IHJlcS5oZWFkZXJzLmdldChcIngtbmYtY2xpZW50LWNvbm5lY3Rpb24taXBcIikgfHwgbnVsbCxcbiAgICBhcHBfaWQ6IChyZXEuaGVhZGVycy5nZXQoXCJ4LWthaXh1LWFwcFwiKSB8fCBcIlwiKS50cmltKCkgfHwgbnVsbCxcbiAgICBidWlsZF9pZDogKHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtYnVpbGRcIikgfHwgXCJcIikudHJpbSgpIHx8IG51bGxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUVycm9yKGVycikge1xuICBjb25zdCBlID0gZXJyIHx8IHt9O1xuICByZXR1cm4ge1xuICAgIG5hbWU6IHNhZmVTdHIoZS5uYW1lLCAyMDApLFxuICAgIG1lc3NhZ2U6IHNhZmVTdHIoZS5tZXNzYWdlLCA0MDAwKSxcbiAgICBjb2RlOiBzYWZlU3RyKGUuY29kZSwgMjAwKSxcbiAgICBzdGF0dXM6IE51bWJlci5pc0Zpbml0ZShlLnN0YXR1cykgPyBlLnN0YXR1cyA6IG51bGwsXG4gICAgaGludDogc2FmZVN0cihlLmhpbnQsIDIwMDApLFxuICAgIHN0YWNrOiBzYWZlU3RyKGUuc3RhY2ssIDEyMDAwKSxcbiAgICB1cHN0cmVhbTogZS51cHN0cmVhbSA/IHtcbiAgICAgIHByb3ZpZGVyOiBzYWZlU3RyKGUudXBzdHJlYW0ucHJvdmlkZXIsIDUwKSxcbiAgICAgIHN0YXR1czogTnVtYmVyLmlzRmluaXRlKGUudXBzdHJlYW0uc3RhdHVzKSA/IGUudXBzdHJlYW0uc3RhdHVzIDogbnVsbCxcbiAgICAgIGJvZHk6IHNhZmVTdHIoZS51cHN0cmVhbS5ib2R5LCAxMjAwMCksXG4gICAgICByZXF1ZXN0X2lkOiBzYWZlU3RyKGUudXBzdHJlYW0ucmVxdWVzdF9pZCwgMjAwKSxcbiAgICAgIHJlc3BvbnNlX2hlYWRlcnM6IGUudXBzdHJlYW0ucmVzcG9uc2VfaGVhZGVycyB8fCB1bmRlZmluZWRcbiAgICB9IDogdW5kZWZpbmVkXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdW1tYXJpemVKc29uQm9keShib2R5KSB7XG4gIC8vIFNhZmUgc3VtbWFyeTsgYXZvaWRzIGxvZ2dpbmcgZnVsbCBwcm9tcHRzIGJ5IGRlZmF1bHQuXG4gIGNvbnN0IGIgPSBib2R5IHx8IHt9O1xuICBjb25zdCBwcm92aWRlciA9IChiLnByb3ZpZGVyIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpLnRvTG93ZXJDYXNlKCkgfHwgbnVsbDtcbiAgY29uc3QgbW9kZWwgPSAoYi5tb2RlbCB8fCBcIlwiKS50b1N0cmluZygpLnRyaW0oKSB8fCBudWxsO1xuXG4gIGxldCBtZXNzYWdlQ291bnQgPSBudWxsO1xuICBsZXQgdG90YWxDaGFycyA9IG51bGw7XG4gIHRyeSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoYi5tZXNzYWdlcykpIHtcbiAgICAgIG1lc3NhZ2VDb3VudCA9IGIubWVzc2FnZXMubGVuZ3RoO1xuICAgICAgdG90YWxDaGFycyA9IGIubWVzc2FnZXMucmVkdWNlKChhY2MsIG0pID0+IGFjYyArIFN0cmluZyhtPy5jb250ZW50ID8/IFwiXCIpLmxlbmd0aCwgMCk7XG4gICAgfVxuICB9IGNhdGNoIHt9XG5cbiAgcmV0dXJuIHtcbiAgICBwcm92aWRlcixcbiAgICBtb2RlbCxcbiAgICBtYXhfdG9rZW5zOiBOdW1iZXIuaXNGaW5pdGUoYi5tYXhfdG9rZW5zKSA/IHBhcnNlSW50KGIubWF4X3Rva2VucywgMTApIDogbnVsbCxcbiAgICB0ZW1wZXJhdHVyZTogdHlwZW9mIGIudGVtcGVyYXR1cmUgPT09IFwibnVtYmVyXCIgPyBiLnRlbXBlcmF0dXJlIDogbnVsbCxcbiAgICBtZXNzYWdlX2NvdW50OiBtZXNzYWdlQ291bnQsXG4gICAgbWVzc2FnZV9jaGFyczogdG90YWxDaGFyc1xuICB9O1xufVxuXG4vKipcbiAqIEJlc3QtZWZmb3J0IG1vbml0b3IgZXZlbnQ6IGZhaWx1cmVzIG5ldmVyIGJyZWFrIHRoZSBtYWluIHJlcXVlc3QuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbWl0RXZlbnQoZXYpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBlID0gZXYgfHwge307XG4gICAgY29uc3QgZXh0cmEgPSBlLmV4dHJhIHx8IHt9O1xuICAgIGF3YWl0IHEoXG4gICAgICBgaW5zZXJ0IGludG8gZ2F0ZXdheV9ldmVudHNcbiAgICAgICAgKHJlcXVlc3RfaWQsIGxldmVsLCBraW5kLCBmdW5jdGlvbl9uYW1lLCBtZXRob2QsIHBhdGgsIG9yaWdpbiwgcmVmZXJlciwgdXNlcl9hZ2VudCwgaXAsXG4gICAgICAgICBhcHBfaWQsIGJ1aWxkX2lkLCBjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgcHJvdmlkZXIsIG1vZGVsLCBodHRwX3N0YXR1cywgZHVyYXRpb25fbXMsXG4gICAgICAgICBlcnJvcl9jb2RlLCBlcnJvcl9tZXNzYWdlLCBlcnJvcl9zdGFjaywgdXBzdHJlYW1fc3RhdHVzLCB1cHN0cmVhbV9ib2R5LCBleHRyYSlcbiAgICAgICB2YWx1ZXNcbiAgICAgICAgKCQxLCQyLCQzLCQ0LCQ1LCQ2LCQ3LCQ4LCQ5LCQxMCxcbiAgICAgICAgICQxMSwkMTIsJDEzLCQxNCwkMTUsJDE2LCQxNywkMTgsXG4gICAgICAgICAkMTksJDIwLCQyMSwkMjIsJDIzLCQyNCwkMjU6Ompzb25iKWAsXG4gICAgICBbXG4gICAgICAgIHNhZmVTdHIoZS5yZXF1ZXN0X2lkLCAyMDApLFxuICAgICAgICBzYWZlU3RyKGUubGV2ZWwgfHwgXCJpbmZvXCIsIDIwKSxcbiAgICAgICAgc2FmZVN0cihlLmtpbmQgfHwgXCJldmVudFwiLCA4MCksXG4gICAgICAgIHNhZmVTdHIoZS5mdW5jdGlvbl9uYW1lIHx8IFwidW5rbm93blwiLCAxMjApLFxuICAgICAgICBzYWZlU3RyKGUubWV0aG9kLCAyMCksXG4gICAgICAgIHNhZmVTdHIoZS5wYXRoLCA1MDApLFxuICAgICAgICBzYWZlU3RyKGUub3JpZ2luLCA1MDApLFxuICAgICAgICBzYWZlU3RyKGUucmVmZXJlciwgODAwKSxcbiAgICAgICAgc2FmZVN0cihlLnVzZXJfYWdlbnQsIDgwMCksXG4gICAgICAgIHNhZmVTdHIoZS5pcCwgMjAwKSxcblxuICAgICAgICBzYWZlU3RyKGUuYXBwX2lkLCAyMDApLFxuICAgICAgICBzYWZlU3RyKGUuYnVpbGRfaWQsIDIwMCksXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShlLmN1c3RvbWVyX2lkKSA/IGUuY3VzdG9tZXJfaWQgOiBudWxsLFxuICAgICAgICBOdW1iZXIuaXNGaW5pdGUoZS5hcGlfa2V5X2lkKSA/IGUuYXBpX2tleV9pZCA6IG51bGwsXG4gICAgICAgIHNhZmVTdHIoZS5wcm92aWRlciwgODApLFxuICAgICAgICBzYWZlU3RyKGUubW9kZWwsIDIwMCksXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShlLmh0dHBfc3RhdHVzKSA/IGUuaHR0cF9zdGF0dXMgOiBudWxsLFxuICAgICAgICBOdW1iZXIuaXNGaW5pdGUoZS5kdXJhdGlvbl9tcykgPyBlLmR1cmF0aW9uX21zIDogbnVsbCxcblxuICAgICAgICBzYWZlU3RyKGUuZXJyb3JfY29kZSwgMjAwKSxcbiAgICAgICAgc2FmZVN0cihlLmVycm9yX21lc3NhZ2UsIDQwMDApLFxuICAgICAgICBzYWZlU3RyKGUuZXJyb3Jfc3RhY2ssIDEyMDAwKSxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUudXBzdHJlYW1fc3RhdHVzKSA/IGUudXBzdHJlYW1fc3RhdHVzIDogbnVsbCxcbiAgICAgICAgc2FmZVN0cihlLnVwc3RyZWFtX2JvZHksIDEyMDAwKSxcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoZXh0cmEgfHwge30pXG4gICAgICBdXG4gICAgKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUud2FybihcIm1vbml0b3IgZW1pdCBmYWlsZWQ6XCIsIGU/Lm1lc3NhZ2UgfHwgZSk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBidWlsZENvcnMsIGpzb24gfSBmcm9tIFwiLi9odHRwLmpzXCI7XG5pbXBvcnQgeyBlbWl0RXZlbnQsIGdldFJlcXVlc3RJZCwgaW5mZXJGdW5jdGlvbk5hbWUsIHJlcXVlc3RNZXRhLCBzZXJpYWxpemVFcnJvciB9IGZyb20gXCIuL21vbml0b3IuanNcIjtcblxuZnVuY3Rpb24gbm9ybWFsaXplRXJyb3IoZXJyKSB7XG4gIGNvbnN0IHN0YXR1cyA9IGVycj8uc3RhdHVzIHx8IDUwMDtcbiAgY29uc3QgY29kZSA9IGVycj8uY29kZSB8fCBcIlNFUlZFUl9FUlJPUlwiO1xuICBjb25zdCBtZXNzYWdlID0gZXJyPy5tZXNzYWdlIHx8IFwiVW5rbm93biBlcnJvclwiO1xuICBjb25zdCBoaW50ID0gZXJyPy5oaW50O1xuICByZXR1cm4geyBzdGF0dXMsIGJvZHk6IHsgZXJyb3I6IG1lc3NhZ2UsIGNvZGUsIC4uLihoaW50ID8geyBoaW50IH0gOiB7fSkgfSB9O1xufVxuXG5mdW5jdGlvbiB3aXRoUmVxdWVzdElkKHJlcywgcmVxdWVzdF9pZCkge1xuICB0cnkge1xuICAgIGNvbnN0IGggPSBuZXcgSGVhZGVycyhyZXMuaGVhZGVycyB8fCB7fSk7XG4gICAgaC5zZXQoXCJ4LWthaXh1LXJlcXVlc3QtaWRcIiwgcmVxdWVzdF9pZCk7XG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShyZXMuYm9keSwgeyBzdGF0dXM6IHJlcy5zdGF0dXMsIGhlYWRlcnM6IGggfSk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiByZXM7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gc2FmZUJvZHlQcmV2aWV3KHJlcykge1xuICB0cnkge1xuICAgIGNvbnN0IGN0ID0gKHJlcy5oZWFkZXJzLmdldChcImNvbnRlbnQtdHlwZVwiKSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGNsb25lID0gcmVzLmNsb25lKCk7XG4gICAgaWYgKGN0LmluY2x1ZGVzKFwiYXBwbGljYXRpb24vanNvblwiKSkge1xuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGNsb25lLmpzb24oKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cbiAgICBjb25zdCB0ID0gYXdhaXQgY2xvbmUudGV4dCgpLmNhdGNoKCgpID0+IFwiXCIpO1xuICAgIGlmICh0eXBlb2YgdCA9PT0gXCJzdHJpbmdcIiAmJiB0Lmxlbmd0aCA+IDEyMDAwKSByZXR1cm4gdC5zbGljZSgwLCAxMjAwMCkgKyBgXHUyMDI2KCske3QubGVuZ3RoIC0gMTIwMDB9IGNoYXJzKWA7XG4gICAgcmV0dXJuIHQ7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cmFwKGhhbmRsZXIpIHtcbiAgcmV0dXJuIGFzeW5jIChyZXEsIGNvbnRleHQpID0+IHtcbiAgICBjb25zdCBzdGFydCA9IERhdGUubm93KCk7XG4gICAgY29uc3QgY29ycyA9IGJ1aWxkQ29ycyhyZXEpO1xuICAgIGNvbnN0IHJlcXVlc3RfaWQgPSBnZXRSZXF1ZXN0SWQocmVxKTtcbiAgICBjb25zdCBmdW5jdGlvbl9uYW1lID0gaW5mZXJGdW5jdGlvbk5hbWUocmVxKTtcbiAgICBjb25zdCBtZXRhID0gcmVxdWVzdE1ldGEocmVxKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBoYW5kbGVyKHJlcSwgY29ycywgY29udGV4dCk7XG5cbiAgICAgIGNvbnN0IGR1cmF0aW9uX21zID0gRGF0ZS5ub3coKSAtIHN0YXJ0O1xuICAgICAgY29uc3Qgb3V0ID0gcmVzIGluc3RhbmNlb2YgUmVzcG9uc2UgPyB3aXRoUmVxdWVzdElkKHJlcywgcmVxdWVzdF9pZCkgOiByZXM7XG5cbiAgICAgIGNvbnN0IHN0YXR1cyA9IG91dCBpbnN0YW5jZW9mIFJlc3BvbnNlID8gb3V0LnN0YXR1cyA6IDIwMDtcbiAgICAgIGNvbnN0IGxldmVsID0gc3RhdHVzID49IDUwMCA/IFwiZXJyb3JcIiA6IHN0YXR1cyA+PSA0MDAgPyBcIndhcm5cIiA6IFwiaW5mb1wiO1xuICAgICAgY29uc3Qga2luZCA9IHN0YXR1cyA+PSA0MDAgPyBcImh0dHBfZXJyb3JfcmVzcG9uc2VcIiA6IFwiaHR0cF9yZXNwb25zZVwiO1xuXG4gICAgICBsZXQgZXh0cmEgPSB7fTtcbiAgICAgIGlmIChzdGF0dXMgPj0gNDAwICYmIG91dCBpbnN0YW5jZW9mIFJlc3BvbnNlKSB7XG4gICAgICAgIGV4dHJhLnJlc3BvbnNlID0gYXdhaXQgc2FmZUJvZHlQcmV2aWV3KG91dCk7XG4gICAgICB9XG4gICAgICBpZiAoZHVyYXRpb25fbXMgPj0gMTUwMDApIHtcbiAgICAgICAgZXh0cmEuc2xvdyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IGVtaXRFdmVudCh7XG4gICAgICAgIHJlcXVlc3RfaWQsXG4gICAgICAgIGxldmVsLFxuICAgICAgICBraW5kLFxuICAgICAgICBmdW5jdGlvbl9uYW1lLFxuICAgICAgICAuLi5tZXRhLFxuICAgICAgICBodHRwX3N0YXR1czogc3RhdHVzLFxuICAgICAgICBkdXJhdGlvbl9tcyxcbiAgICAgICAgZXh0cmFcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gb3V0O1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc3QgZHVyYXRpb25fbXMgPSBEYXRlLm5vdygpIC0gc3RhcnQ7XG5cbiAgICAgIC8vIEJlc3QtZWZmb3J0IGRldGFpbGVkIG1vbml0b3IgcmVjb3JkLlxuICAgICAgY29uc3Qgc2VyID0gc2VyaWFsaXplRXJyb3IoZXJyKTtcbiAgICAgIGF3YWl0IGVtaXRFdmVudCh7XG4gICAgICAgIHJlcXVlc3RfaWQsXG4gICAgICAgIGxldmVsOiBcImVycm9yXCIsXG4gICAgICAgIGtpbmQ6IFwidGhyb3duX2Vycm9yXCIsXG4gICAgICAgIGZ1bmN0aW9uX25hbWUsXG4gICAgICAgIC4uLm1ldGEsXG4gICAgICAgIHByb3ZpZGVyOiBzZXI/LnVwc3RyZWFtPy5wcm92aWRlciB8fCB1bmRlZmluZWQsXG4gICAgICAgIGh0dHBfc3RhdHVzOiBzZXI/LnN0YXR1cyB8fCA1MDAsXG4gICAgICAgIGR1cmF0aW9uX21zLFxuICAgICAgICBlcnJvcl9jb2RlOiBzZXI/LmNvZGUgfHwgXCJTRVJWRVJfRVJST1JcIixcbiAgICAgICAgZXJyb3JfbWVzc2FnZTogc2VyPy5tZXNzYWdlIHx8IFwiVW5rbm93biBlcnJvclwiLFxuICAgICAgICBlcnJvcl9zdGFjazogc2VyPy5zdGFjayB8fCBudWxsLFxuICAgICAgICB1cHN0cmVhbV9zdGF0dXM6IHNlcj8udXBzdHJlYW0/LnN0YXR1cyB8fCBudWxsLFxuICAgICAgICB1cHN0cmVhbV9ib2R5OiBzZXI/LnVwc3RyZWFtPy5ib2R5IHx8IG51bGwsXG4gICAgICAgIGV4dHJhOiB7IGVycm9yOiBzZXIgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIEF2b2lkIDUwMnM6IGFsd2F5cyByZXR1cm4gSlNPTi5cbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJGdW5jdGlvbiBlcnJvcjpcIiwgZXJyKTtcbiAgICAgIGNvbnN0IHsgc3RhdHVzLCBib2R5IH0gPSBub3JtYWxpemVFcnJvcihlcnIpO1xuICAgICAgcmV0dXJuIGpzb24oc3RhdHVzLCB7IC4uLmJvZHksIHJlcXVlc3RfaWQgfSwgeyAuLi5jb3JzLCBcIngta2FpeHUtcmVxdWVzdC1pZFwiOiByZXF1ZXN0X2lkIH0pO1xuICAgIH1cbiAgfTtcbn1cbiIsICJpbXBvcnQgY3J5cHRvIGZyb20gXCJjcnlwdG9cIjtcblxuZnVuY3Rpb24gYjY0KHN0cikge1xuICByZXR1cm4gQnVmZmVyLmZyb20oc3RyLCBcInV0ZjhcIikudG9TdHJpbmcoXCJiYXNlNjRcIik7XG59XG5cbi8qKlxuICogVmFsaWRhdGUgWC1Ud2lsaW8tU2lnbmF0dXJlLlxuICogVHdpbGlvIHNpZ25hdHVyZSA9IGJhc2U2NChITUFDLVNIQTEoYXV0aF90b2tlbiwgdXJsICsgY29uY2F0KHNvcnRlZChwYXJhbXMpKSkpXG4gKlxuICogTm90ZXM6XG4gKiAtIHVybCBtdXN0IGJlIHRoZSBmdWxsIFVSTCBUd2lsaW8gdXNlZCB0byBtYWtlIHRoZSByZXF1ZXN0IChpbmNsdWRpbmcgcXVlcnlzdHJpbmcgaWYgcHJlc2VudCkuXG4gKiAtIHBhcmFtcyBhcmUgUE9TVCBmb3JtIHBhcmFtcyBPUiBxdWVyeSBwYXJhbXMgZGVwZW5kaW5nIG9uIG1ldGhvZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXB1dGVUd2lsaW9TaWduYXR1cmUoeyB1cmwsIHBhcmFtcywgYXV0aFRva2VuIH0pIHtcbiAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHBhcmFtcyB8fCB7fSkuc29ydCgpO1xuICBsZXQgZGF0YSA9IHVybDtcbiAgZm9yIChjb25zdCBrIG9mIGtleXMpIGRhdGEgKz0gayArIChwYXJhbXNba10gPz8gXCJcIik7XG4gIGNvbnN0IGggPSBjcnlwdG8uY3JlYXRlSG1hYyhcInNoYTFcIiwgYXV0aFRva2VuKS51cGRhdGUoZGF0YSwgXCJ1dGY4XCIpLmRpZ2VzdChcImJhc2U2NFwiKTtcbiAgcmV0dXJuIGg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0aW1pbmdTYWZlRXF1YWwoYSwgYikge1xuICBjb25zdCBhYSA9IEJ1ZmZlci5mcm9tKFN0cmluZyhhIHx8IFwiXCIpLCBcInV0ZjhcIik7XG4gIGNvbnN0IGJiID0gQnVmZmVyLmZyb20oU3RyaW5nKGIgfHwgXCJcIiksIFwidXRmOFwiKTtcbiAgaWYgKGFhLmxlbmd0aCAhPT0gYmIubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBjcnlwdG8udGltaW5nU2FmZUVxdWFsKGFhLCBiYik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZVR3aWxpb1JlcXVlc3QoeyByZXEsIHVybCwgcGFyYW1zIH0pIHtcbiAgY29uc3QgYXV0aCA9IChwcm9jZXNzLmVudi5UV0lMSU9fQVVUSF9UT0tFTiB8fCBcIlwiKS50b1N0cmluZygpO1xuICBpZiAoIWF1dGgpIHJldHVybiB7IG9rOiBmYWxzZSwgc3RhdHVzOiA1MDAsIGVycm9yOiBcIk1pc3NpbmcgVFdJTElPX0FVVEhfVE9LRU5cIiB9O1xuXG4gIGNvbnN0IHNpZyA9IHJlcS5oZWFkZXJzLmdldChcIngtdHdpbGlvLXNpZ25hdHVyZVwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJYLVR3aWxpby1TaWduYXR1cmVcIikgfHwgXCJcIjtcbiAgaWYgKCFzaWcpIHJldHVybiB7IG9rOiBmYWxzZSwgc3RhdHVzOiA0MDEsIGVycm9yOiBcIk1pc3NpbmcgWC1Ud2lsaW8tU2lnbmF0dXJlXCIgfTtcblxuICBjb25zdCBleHBlY3RlZCA9IGNvbXB1dGVUd2lsaW9TaWduYXR1cmUoeyB1cmwsIHBhcmFtcywgYXV0aFRva2VuOiBhdXRoIH0pO1xuICBjb25zdCBvayA9IHRpbWluZ1NhZmVFcXVhbChzaWcsIGV4cGVjdGVkKTtcbiAgaWYgKCFvaykgcmV0dXJuIHsgb2s6IGZhbHNlLCBzdGF0dXM6IDQwMSwgZXJyb3I6IFwiSW52YWxpZCBUd2lsaW8gc2lnbmF0dXJlXCIgfTtcbiAgcmV0dXJuIHsgb2s6IHRydWUgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHR3aW1sKHhtbEJvZHkpIHtcbiAgcmV0dXJuIG5ldyBSZXNwb25zZSh4bWxCb2R5LCB7XG4gICAgc3RhdHVzOiAyMDAsXG4gICAgaGVhZGVyczoge1xuICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJ0ZXh0L3htbDsgY2hhcnNldD11dGYtOFwiLFxuICAgICAgXCJjYWNoZS1jb250cm9sXCI6IFwibm8tc3RvcmVcIlxuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGVzY2FwZVhtbChzKSB7XG4gIHJldHVybiBTdHJpbmcocyA/PyBcIlwiKVxuICAgIC5yZXBsYWNlKC8mL2csIFwiJmFtcDtcIilcbiAgICAucmVwbGFjZSgvPC9nLCBcIiZsdDtcIilcbiAgICAucmVwbGFjZSgvPi9nLCBcIiZndDtcIilcbiAgICAucmVwbGFjZSgvXCIvZywgXCImcXVvdDtcIilcbiAgICAucmVwbGFjZSgvJy9nLCBcIiZhcG9zO1wiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNheUdhdGhlclR3aW1sKHsgc2F5LCBhY3Rpb25VcmwsIGxhbmd1YWdlID0gXCJlbi1VU1wiLCB2b2ljZSA9IFwiYWxpY2VcIiwgaGludHMgPSBudWxsLCB0aW1lb3V0ID0gMyB9KSB7XG4gIGNvbnN0IHNheVRleHQgPSBlc2NhcGVYbWwoc2F5IHx8IFwiXCIpO1xuICBjb25zdCBhY3Rpb24gPSBlc2NhcGVYbWwoYWN0aW9uVXJsKTtcbiAgY29uc3QgaGludEF0dHIgPSBoaW50cyA/IGAgc3BlZWNoSGludHM9XCIke2VzY2FwZVhtbChoaW50cyl9XCJgIDogXCJcIjtcbiAgcmV0dXJuIGA8P3htbCB2ZXJzaW9uPVwiMS4wXCIgZW5jb2Rpbmc9XCJVVEYtOFwiPz5cbjxSZXNwb25zZT5cbiAgPEdhdGhlciBpbnB1dD1cInNwZWVjaFwiIGFjdGlvbj1cIiR7YWN0aW9ufVwiIG1ldGhvZD1cIlBPU1RcIiB0aW1lb3V0PVwiJHt0aW1lb3V0fVwiIHNwZWVjaFRpbWVvdXQ9XCJhdXRvXCIgbGFuZ3VhZ2U9XCIke2VzY2FwZVhtbChsYW5ndWFnZSl9XCIke2hpbnRBdHRyfT5cbiAgICA8U2F5IHZvaWNlPVwiJHtlc2NhcGVYbWwodm9pY2UpfVwiPiR7c2F5VGV4dH08L1NheT5cbiAgPC9HYXRoZXI+XG4gIDxTYXkgdm9pY2U9XCIke2VzY2FwZVhtbCh2b2ljZSl9XCI+SSBkaWRuJ3QgY2F0Y2ggdGhhdC4gUGxlYXNlIHNheSB0aGF0IGFnYWluLjwvU2F5PlxuICA8UmVkaXJlY3QgbWV0aG9kPVwiUE9TVFwiPiR7YWN0aW9ufTwvUmVkaXJlY3Q+XG48L1Jlc3BvbnNlPmA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBoYW5ndXBUd2ltbCh7IHNheSwgdm9pY2UgPSBcImFsaWNlXCIsIGxhbmd1YWdlID0gXCJlbi1VU1wiIH0pIHtcbiAgY29uc3Qgc2F5VGV4dCA9IGVzY2FwZVhtbChzYXkgfHwgXCJHb29kYnllLlwiKTtcbiAgcmV0dXJuIGA8P3htbCB2ZXJzaW9uPVwiMS4wXCIgZW5jb2Rpbmc9XCJVVEYtOFwiPz5cbjxSZXNwb25zZT5cbiAgPFNheSB2b2ljZT1cIiR7ZXNjYXBlWG1sKHZvaWNlKX1cIiBsYW5ndWFnZT1cIiR7ZXNjYXBlWG1sKGxhbmd1YWdlKX1cIj4ke3NheVRleHR9PC9TYXk+XG4gIDxIYW5ndXAvPlxuPC9SZXNwb25zZT5gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGlhbFR3aW1sKHsgc2F5LCBkaWFsTnVtYmVyLCB2b2ljZSA9IFwiYWxpY2VcIiwgbGFuZ3VhZ2UgPSBcImVuLVVTXCIgfSkge1xuICBjb25zdCBzYXlUZXh0ID0gZXNjYXBlWG1sKHNheSB8fCBcIk9uZSBtb21lbnQgd2hpbGUgSSBjb25uZWN0IHlvdS5cIik7XG4gIGNvbnN0IG51bSA9IGVzY2FwZVhtbChkaWFsTnVtYmVyKTtcbiAgcmV0dXJuIGA8P3htbCB2ZXJzaW9uPVwiMS4wXCIgZW5jb2Rpbmc9XCJVVEYtOFwiPz5cbjxSZXNwb25zZT5cbiAgPFNheSB2b2ljZT1cIiR7ZXNjYXBlWG1sKHZvaWNlKX1cIiBsYW5ndWFnZT1cIiR7ZXNjYXBlWG1sKGxhbmd1YWdlKX1cIj4ke3NheVRleHR9PC9TYXk+XG4gIDxEaWFsPiR7bnVtfTwvRGlhbD5cbjwvUmVzcG9uc2U+YDtcbn1cbiIsICJpbXBvcnQgeyBxIH0gZnJvbSBcIi4vZGIuanNcIjtcbmltcG9ydCB7IHZvaWNlQmlsbENlbnRzLCB2b2ljZUNvc3RDZW50cywgdm9pY2VNb250aEtleVVUQyB9IGZyb20gXCIuL3ZvaWNlX3ByaWNpbmcuanNcIjtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFZvaWNlTnVtYmVyQnlUbyh0b051bWJlcikge1xuICBjb25zdCB0byA9ICh0b051bWJlciB8fCBcIlwiKS50b1N0cmluZygpLnRyaW0oKTtcbiAgaWYgKCF0bykgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHIgPSBhd2FpdCBxKGBzZWxlY3QgKiBmcm9tIHZvaWNlX251bWJlcnMgd2hlcmUgcGhvbmVfbnVtYmVyID0gJDEgYW5kIGlzX2FjdGl2ZSA9IHRydWVgLCBbdG9dKTtcbiAgcmV0dXJuIHIucm93c1swXSB8fCBudWxsO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdXBzZXJ0Q2FsbCh7IGN1c3RvbWVySWQsIHZvaWNlTnVtYmVySWQsIHByb3ZpZGVyLCBjYWxsU2lkLCBmcm9tTnVtYmVyLCB0b051bWJlciwgbWV0YSA9IHt9IH0pIHtcbiAgY29uc3QgciA9IGF3YWl0IHEoXG4gICAgYGluc2VydCBpbnRvIHZvaWNlX2NhbGxzIChjdXN0b21lcl9pZCwgdm9pY2VfbnVtYmVyX2lkLCBwcm92aWRlciwgcHJvdmlkZXJfY2FsbF9zaWQsIGZyb21fbnVtYmVyLCB0b19udW1iZXIsIG1ldGEpXG4gICAgIHZhbHVlcyAoJDEsJDIsJDMsJDQsJDUsJDYsJDc6Ompzb25iKVxuICAgICBvbiBjb25mbGljdCAocHJvdmlkZXIsIHByb3ZpZGVyX2NhbGxfc2lkKVxuICAgICBkbyB1cGRhdGUgc2V0IGZyb21fbnVtYmVyPWV4Y2x1ZGVkLmZyb21fbnVtYmVyLCB0b19udW1iZXI9ZXhjbHVkZWQudG9fbnVtYmVyXG4gICAgIHJldHVybmluZyAqYCxcbiAgICBbY3VzdG9tZXJJZCwgdm9pY2VOdW1iZXJJZCwgcHJvdmlkZXIsIGNhbGxTaWQsIGZyb21OdW1iZXIgfHwgbnVsbCwgdG9OdW1iZXIgfHwgbnVsbCwgSlNPTi5zdHJpbmdpZnkobWV0YSB8fCB7fSldXG4gICk7XG4gIHJldHVybiByLnJvd3NbMF07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhZGRDYWxsTWVzc2FnZShjYWxsSWQsIHJvbGUsIGNvbnRlbnQpIHtcbiAgYXdhaXQgcShcbiAgICBgaW5zZXJ0IGludG8gdm9pY2VfY2FsbF9tZXNzYWdlcyAoY2FsbF9pZCwgcm9sZSwgY29udGVudCkgdmFsdWVzICgkMSwkMiwkMylgLFxuICAgIFtjYWxsSWQsIHJvbGUsIChjb250ZW50IHx8IFwiXCIpLnRvU3RyaW5nKCldXG4gICk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRSZWNlbnRNZXNzYWdlcyhjYWxsSWQsIGxpbWl0ID0gMTIpIHtcbiAgY29uc3QgciA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCByb2xlLCBjb250ZW50IGZyb20gdm9pY2VfY2FsbF9tZXNzYWdlcyB3aGVyZSBjYWxsX2lkPSQxIG9yZGVyIGJ5IGlkIGRlc2MgbGltaXQgJDJgLFxuICAgIFtjYWxsSWQsIGxpbWl0XVxuICApO1xuICAvLyByZXZlcnNlIHRvIGNocm9ub2xvZ2ljYWxcbiAgcmV0dXJuIChyLnJvd3MgfHwgW10pLnJldmVyc2UoKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZUNhbGxTdGF0dXMoeyBwcm92aWRlciwgY2FsbFNpZCwgc3RhdHVzLCBkdXJhdGlvblNlY29uZHMgfSkge1xuICBjb25zdCBub3dFbmRlZCA9IHN0YXR1cyA9PT0gXCJjb21wbGV0ZWRcIiB8fCBzdGF0dXMgPT09IFwiY2FuY2VsZWRcIiB8fCBzdGF0dXMgPT09IFwiZmFpbGVkXCIgfHwgc3RhdHVzID09PSBcImJ1c3lcIiB8fCBzdGF0dXMgPT09IFwibm8tYW5zd2VyXCI7XG4gIGNvbnN0IHIgPSBhd2FpdCBxKFxuICAgIGB1cGRhdGUgdm9pY2VfY2FsbHNcbiAgICAgICBzZXQgc3RhdHVzID0gJDEsXG4gICAgICAgICAgIGVuZGVkX2F0ID0gY2FzZSB3aGVuICQyIHRoZW4gY29hbGVzY2UoZW5kZWRfYXQsIG5vdygpKSBlbHNlIGVuZGVkX2F0IGVuZCxcbiAgICAgICAgICAgZHVyYXRpb25fc2Vjb25kcyA9IGNhc2Ugd2hlbiAkMzo6aW50IGlzIG5vdCBudWxsIHRoZW4gJDM6OmludCBlbHNlIGR1cmF0aW9uX3NlY29uZHMgZW5kXG4gICAgIHdoZXJlIHByb3ZpZGVyID0gJDQgYW5kIHByb3ZpZGVyX2NhbGxfc2lkID0gJDVcbiAgICAgcmV0dXJuaW5nICpgLFxuICAgIFtzdGF0dXMsIG5vd0VuZGVkLCBOdW1iZXIuaXNGaW5pdGUoZHVyYXRpb25TZWNvbmRzKSA/IGR1cmF0aW9uU2Vjb25kcyA6IG51bGwsIHByb3ZpZGVyLCBjYWxsU2lkXVxuICApO1xuICByZXR1cm4gci5yb3dzWzBdIHx8IG51bGw7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmaW5hbGl6ZUJpbGxpbmdGb3JDYWxsKGNhbGxSb3cpIHtcbiAgaWYgKCFjYWxsUm93KSByZXR1cm4gbnVsbDtcbiAgY29uc3QgZHVyID0gY2FsbFJvdy5kdXJhdGlvbl9zZWNvbmRzIHx8IDA7XG4gIGNvbnN0IG1pbnV0ZXMgPSBNYXRoLm1heCgwLCBNYXRoLmNlaWwoZHVyIC8gNjApKTtcbiAgY29uc3QgZXN0X2Nvc3RfY2VudHMgPSB2b2ljZUNvc3RDZW50cyhtaW51dGVzKTtcbiAgY29uc3QgYmlsbF9jb3N0X2NlbnRzID0gdm9pY2VCaWxsQ2VudHMobWludXRlcyk7XG5cbiAgY29uc3QgdXBkID0gYXdhaXQgcShcbiAgICBgdXBkYXRlIHZvaWNlX2NhbGxzXG4gICAgICAgIHNldCBlc3RfY29zdF9jZW50cz0kMSwgYmlsbF9jb3N0X2NlbnRzPSQyXG4gICAgICB3aGVyZSBpZD0kM1xuICAgICAgcmV0dXJuaW5nICpgLFxuICAgIFtlc3RfY29zdF9jZW50cywgYmlsbF9jb3N0X2NlbnRzLCBjYWxsUm93LmlkXVxuICApO1xuXG4gIGNvbnN0IG1vbnRoID0gdm9pY2VNb250aEtleVVUQygpO1xuICBhd2FpdCBxKFxuICAgIGBpbnNlcnQgaW50byB2b2ljZV91c2FnZV9tb250aGx5IChjdXN0b21lcl9pZCwgbW9udGgsIG1pbnV0ZXMsIGVzdF9jb3N0X2NlbnRzLCBiaWxsX2Nvc3RfY2VudHMsIGNhbGxzKVxuICAgICB2YWx1ZXMgKCQxLCQyLCQzLCQ0LCQ1LCQ2KVxuICAgICBvbiBjb25mbGljdCAoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICBkbyB1cGRhdGUgc2V0XG4gICAgICAgIG1pbnV0ZXMgPSB2b2ljZV91c2FnZV9tb250aGx5Lm1pbnV0ZXMgKyBleGNsdWRlZC5taW51dGVzLFxuICAgICAgICBlc3RfY29zdF9jZW50cyA9IHZvaWNlX3VzYWdlX21vbnRobHkuZXN0X2Nvc3RfY2VudHMgKyBleGNsdWRlZC5lc3RfY29zdF9jZW50cyxcbiAgICAgICAgYmlsbF9jb3N0X2NlbnRzID0gdm9pY2VfdXNhZ2VfbW9udGhseS5iaWxsX2Nvc3RfY2VudHMgKyBleGNsdWRlZC5iaWxsX2Nvc3RfY2VudHMsXG4gICAgICAgIGNhbGxzID0gdm9pY2VfdXNhZ2VfbW9udGhseS5jYWxscyArIGV4Y2x1ZGVkLmNhbGxzYCxcbiAgICBbY2FsbFJvdy5jdXN0b21lcl9pZCwgbW9udGgsIG1pbnV0ZXMsIGVzdF9jb3N0X2NlbnRzLCBiaWxsX2Nvc3RfY2VudHMsIDFdXG4gICk7XG5cbiAgcmV0dXJuIHVwZC5yb3dzWzBdIHx8IG51bGw7XG59XG4iLCAiaW1wb3J0IHsgVGV4dERlY29kZXIgfSBmcm9tIFwidXRpbFwiO1xuXG5mdW5jdGlvbiBjb25maWdFcnJvcihtZXNzYWdlLCBoaW50KSB7XG4gIGNvbnN0IGVyciA9IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgZXJyLmNvZGUgPSBcIkNPTkZJR1wiO1xuICBlcnIuc3RhdHVzID0gNTAwO1xuICBpZiAoaGludCkgZXJyLmhpbnQgPSBoaW50O1xuICByZXR1cm4gZXJyO1xufVxuXG5cbmZ1bmN0aW9uIHNhZmVKc29uU3RyaW5nKHYsIG1heCA9IDEyMDAwKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgcyA9IHR5cGVvZiB2ID09PSBcInN0cmluZ1wiID8gdiA6IEpTT04uc3RyaW5naWZ5KHYpO1xuICAgIGlmICghcykgcmV0dXJuIFwiXCI7XG4gICAgaWYgKHMubGVuZ3RoIDw9IG1heCkgcmV0dXJuIHM7XG4gICAgcmV0dXJuIHMuc2xpY2UoMCwgbWF4KSArIGBcdTIwMjYoKyR7cy5sZW5ndGggLSBtYXh9IGNoYXJzKWA7XG4gIH0gY2F0Y2gge1xuICAgIGNvbnN0IHMgPSBTdHJpbmcodiB8fCBcIlwiKTtcbiAgICBpZiAocy5sZW5ndGggPD0gbWF4KSByZXR1cm4gcztcbiAgICByZXR1cm4gcy5zbGljZSgwLCBtYXgpICsgYFx1MjAyNigrJHtzLmxlbmd0aCAtIG1heH0gY2hhcnMpYDtcbiAgfVxufVxuXG5mdW5jdGlvbiB1cHN0cmVhbUVycm9yKHByb3ZpZGVyLCByZXMsIGJvZHkpIHtcbiAgY29uc3Qgc3RhdHVzID0gcmVzPy5zdGF0dXMgfHwgMDtcbiAgY29uc3QgcmVxSWQgPVxuICAgIHJlcz8uaGVhZGVycz8uZ2V0Py4oXCJ4LXJlcXVlc3QtaWRcIikgfHxcbiAgICByZXM/LmhlYWRlcnM/LmdldD8uKFwicmVxdWVzdC1pZFwiKSB8fFxuICAgIHJlcz8uaGVhZGVycz8uZ2V0Py4oXCJ4LWFtem4tcmVxdWVzdGlkXCIpIHx8XG4gICAgbnVsbDtcblxuICAvLyBUcnkgdG8gc3VyZmFjZSB0aGUgbW9zdCBtZWFuaW5nZnVsIHByb3ZpZGVyIG1lc3NhZ2UuXG4gIGxldCBtc2cgPSBcIlwiO1xuICB0cnkge1xuICAgIG1zZyA9IGJvZHk/LmVycm9yPy5tZXNzYWdlIHx8IGJvZHk/LmVycm9yPy50eXBlIHx8IGJvZHk/Lm1lc3NhZ2UgfHwgXCJcIjtcbiAgfSBjYXRjaCB7fVxuICBjb25zdCBlcnIgPSBuZXcgRXJyb3IobXNnID8gYCR7cHJvdmlkZXJ9IHVwc3RyZWFtIGVycm9yICR7c3RhdHVzfTogJHttc2d9YCA6IGAke3Byb3ZpZGVyfSB1cHN0cmVhbSBlcnJvciAke3N0YXR1c31gKTtcbiAgZXJyLmNvZGUgPSBcIlVQU1RSRUFNX0VSUk9SXCI7XG4gIGVyci5zdGF0dXMgPSA1MDI7XG4gIGVyci51cHN0cmVhbSA9IHtcbiAgICBwcm92aWRlcixcbiAgICBzdGF0dXMsXG4gICAgcmVxdWVzdF9pZDogcmVxSWQsXG4gICAgYm9keTogc2FmZUpzb25TdHJpbmcoYm9keSlcbiAgfTtcbiAgcmV0dXJuIGVycjtcbn1cblxuLyoqXG4gKiBOb24tc3RyZWFtIGNhbGxzXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjYWxsT3BlbkFJKHsgbW9kZWwsIG1lc3NhZ2VzLCBtYXhfdG9rZW5zLCB0ZW1wZXJhdHVyZSB9KSB7XG4gIGNvbnN0IGFwaUtleSA9IHByb2Nlc3MuZW52Lk9QRU5BSV9BUElfS0VZO1xuICBpZiAoIWFwaUtleSkgdGhyb3cgY29uZmlnRXJyb3IoXCJPUEVOQUlfQVBJX0tFWSBub3QgY29uZmlndXJlZFwiLCBcIlNldCBPUEVOQUlfQVBJX0tFWSBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcyAoeW91ciBPcGVuQUkgQVBJIGtleSkuXCIpO1xuXG4gIGNvbnN0IGlucHV0ID0gQXJyYXkuaXNBcnJheShtZXNzYWdlcykgPyBtZXNzYWdlcy5tYXAobSA9PiAoe1xuICAgIHJvbGU6IG0ucm9sZSxcbiAgICBjb250ZW50OiBbeyB0eXBlOiBcImlucHV0X3RleHRcIiwgdGV4dDogU3RyaW5nKG0uY29udGVudCA/PyBcIlwiKSB9XVxuICB9KSkgOiBbXTtcblxuICBjb25zdCBib2R5ID0ge1xuICAgIG1vZGVsLFxuICAgIGlucHV0LFxuICAgIHRlbXBlcmF0dXJlOiB0eXBlb2YgdGVtcGVyYXR1cmUgPT09IFwibnVtYmVyXCIgPyB0ZW1wZXJhdHVyZSA6IDEsXG4gICAgbWF4X291dHB1dF90b2tlbnM6IHR5cGVvZiBtYXhfdG9rZW5zID09PSBcIm51bWJlclwiID8gbWF4X3Rva2VucyA6IDEwMjQsXG4gICAgc3RvcmU6IGZhbHNlXG4gIH07XG5cbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goXCJodHRwczovL2FwaS5vcGVuYWkuY29tL3YxL3Jlc3BvbnNlc1wiLCB7XG4gICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICBoZWFkZXJzOiB7XG4gICAgICBcImF1dGhvcml6YXRpb25cIjogYEJlYXJlciAke2FwaUtleX1gLFxuICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICB9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpXG4gIH0pO1xuXG4gIGNvbnN0IGRhdGEgPSBhd2FpdCByZXMuanNvbigpLmNhdGNoKCgpPT4gKHt9KSk7XG4gIGlmICghcmVzLm9rKSB0aHJvdyB1cHN0cmVhbUVycm9yKFwib3BlbmFpXCIsIHJlcywgZGF0YSk7XG5cbiAgbGV0IG91dCA9IFwiXCI7XG4gIGNvbnN0IG91dHB1dCA9IEFycmF5LmlzQXJyYXkoZGF0YS5vdXRwdXQpID8gZGF0YS5vdXRwdXQgOiBbXTtcbiAgZm9yIChjb25zdCBpdGVtIG9mIG91dHB1dCkge1xuICAgIGlmIChpdGVtPy50eXBlID09PSBcIm1lc3NhZ2VcIiAmJiBBcnJheS5pc0FycmF5KGl0ZW0uY29udGVudCkpIHtcbiAgICAgIGZvciAoY29uc3QgYyBvZiBpdGVtLmNvbnRlbnQpIHtcbiAgICAgICAgaWYgKGM/LnR5cGUgPT09IFwib3V0cHV0X3RleHRcIiAmJiB0eXBlb2YgYy50ZXh0ID09PSBcInN0cmluZ1wiKSBvdXQgKz0gYy50ZXh0O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHVzYWdlID0gZGF0YS51c2FnZSB8fCB7fTtcbiAgcmV0dXJuIHsgb3V0cHV0X3RleHQ6IG91dCwgaW5wdXRfdG9rZW5zOiB1c2FnZS5pbnB1dF90b2tlbnMgfHwgMCwgb3V0cHV0X3Rva2VuczogdXNhZ2Uub3V0cHV0X3Rva2VucyB8fCAwLCByYXc6IGRhdGEgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNhbGxBbnRocm9waWMoeyBtb2RlbCwgbWVzc2FnZXMsIG1heF90b2tlbnMsIHRlbXBlcmF0dXJlIH0pIHtcbiAgY29uc3QgYXBpS2V5ID0gcHJvY2Vzcy5lbnYuQU5USFJPUElDX0FQSV9LRVk7XG4gIGlmICghYXBpS2V5KSB0aHJvdyBjb25maWdFcnJvcihcIkFOVEhST1BJQ19BUElfS0VZIG5vdCBjb25maWd1cmVkXCIsIFwiU2V0IEFOVEhST1BJQ19BUElfS0VZIGluIE5ldGxpZnkgXHUyMTkyIFNpdGUgY29uZmlndXJhdGlvbiBcdTIxOTIgRW52aXJvbm1lbnQgdmFyaWFibGVzICh5b3VyIEFudGhyb3BpYyBBUEkga2V5KS5cIik7XG5cbiAgY29uc3Qgc3lzdGVtUGFydHMgPSBbXTtcbiAgY29uc3Qgb3V0TXNncyA9IFtdO1xuXG4gIGNvbnN0IG1zZ3MgPSBBcnJheS5pc0FycmF5KG1lc3NhZ2VzKSA/IG1lc3NhZ2VzIDogW107XG4gIGZvciAoY29uc3QgbSBvZiBtc2dzKSB7XG4gICAgY29uc3Qgcm9sZSA9IFN0cmluZyhtLnJvbGUgfHwgXCJcIikudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCB0ZXh0ID0gU3RyaW5nKG0uY29udGVudCA/PyBcIlwiKTtcbiAgICBpZiAoIXRleHQpIGNvbnRpbnVlO1xuICAgIGlmIChyb2xlID09PSBcInN5c3RlbVwiIHx8IHJvbGUgPT09IFwiZGV2ZWxvcGVyXCIpIHN5c3RlbVBhcnRzLnB1c2godGV4dCk7XG4gICAgZWxzZSBpZiAocm9sZSA9PT0gXCJhc3Npc3RhbnRcIikgb3V0TXNncy5wdXNoKHsgcm9sZTogXCJhc3Npc3RhbnRcIiwgY29udGVudDogdGV4dCB9KTtcbiAgICBlbHNlIG91dE1zZ3MucHVzaCh7IHJvbGU6IFwidXNlclwiLCBjb250ZW50OiB0ZXh0IH0pO1xuICB9XG5cbiAgY29uc3QgYm9keSA9IHtcbiAgICBtb2RlbCxcbiAgICBtYXhfdG9rZW5zOiB0eXBlb2YgbWF4X3Rva2VucyA9PT0gXCJudW1iZXJcIiA/IG1heF90b2tlbnMgOiAxMDI0LFxuICAgIHRlbXBlcmF0dXJlOiB0eXBlb2YgdGVtcGVyYXR1cmUgPT09IFwibnVtYmVyXCIgPyB0ZW1wZXJhdHVyZSA6IDEsXG4gICAgbWVzc2FnZXM6IG91dE1zZ3NcbiAgfTtcbiAgaWYgKHN5c3RlbVBhcnRzLmxlbmd0aCkgYm9keS5zeXN0ZW0gPSBzeXN0ZW1QYXJ0cy5qb2luKFwiXFxuXFxuXCIpO1xuXG5jb25zdCByZXMgPSBhd2FpdCBmZXRjaChcImh0dHBzOi8vYXBpLmFudGhyb3BpYy5jb20vdjEvbWVzc2FnZXNcIiwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczoge1xuICAgICAgXCJ4LWFwaS1rZXlcIjogYXBpS2V5LFxuICAgICAgXCJhbnRocm9waWMtdmVyc2lvblwiOiBcIjIwMjMtMDYtMDFcIixcbiAgICAgIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KVxuICB9KTtcblxuICBjb25zdCBkYXRhID0gYXdhaXQgcmVzLmpzb24oKS5jYXRjaCgoKT0+ICh7fSkpO1xuICBpZiAoIXJlcy5vaykgdGhyb3cgdXBzdHJlYW1FcnJvcihcImFudGhyb3BpY1wiLCByZXMsIGRhdGEpO1xuXG4gIGNvbnN0IHRleHQgPSBBcnJheS5pc0FycmF5KGRhdGE/LmNvbnRlbnQpID8gZGF0YS5jb250ZW50Lm1hcChjID0+IGM/LnRleHQgfHwgXCJcIikuam9pbihcIlwiKSA6IChkYXRhPy5jb250ZW50Py5bMF0/LnRleHQgfHwgZGF0YT8uY29tcGxldGlvbiB8fCBcIlwiKTtcbiAgY29uc3QgdXNhZ2UgPSBkYXRhPy51c2FnZSB8fCB7fTtcbiAgcmV0dXJuIHsgb3V0cHV0X3RleHQ6IHRleHQsIGlucHV0X3Rva2VuczogdXNhZ2UuaW5wdXRfdG9rZW5zIHx8IDAsIG91dHB1dF90b2tlbnM6IHVzYWdlLm91dHB1dF90b2tlbnMgfHwgMCwgcmF3OiBkYXRhIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjYWxsR2VtaW5pKHsgbW9kZWwsIG1lc3NhZ2VzLCBtYXhfdG9rZW5zLCB0ZW1wZXJhdHVyZSB9KSB7XG4gIGNvbnN0IGFwaUtleVJhdyA9IHByb2Nlc3MuZW52LkdFTUlOSV9BUElfS0VZX0xPQ0FMIHx8IHByb2Nlc3MuZW52LkdFTUlOSV9BUElfS0VZO1xuICBjb25zdCBhcGlLZXkgPSBTdHJpbmcoYXBpS2V5UmF3IHx8IFwiXCIpXG4gICAgLnRyaW0oKVxuICAgIC5yZXBsYWNlKC9eXCIoLiopXCIkLywgXCIkMVwiKVxuICAgIC50cmltKCk7XG4gIGlmICghYXBpS2V5KSB0aHJvdyBjb25maWdFcnJvcihcIkdFTUlOSV9BUElfS0VZIG5vdCBjb25maWd1cmVkXCIsIFwiU2V0IEdFTUlOSV9BUElfS0VZIChvciBmb3IgbG9jYWwgZGV2OiBHRU1JTklfQVBJX0tFWV9MT0NBTCkgaW4gTmV0bGlmeSBcdTIxOTIgU2l0ZSBjb25maWd1cmF0aW9uIFx1MjE5MiBFbnZpcm9ubWVudCB2YXJpYWJsZXMuXCIpO1xuXG4gIGNvbnN0IHN5c3RlbVBhcnRzID0gW107XG4gIGNvbnN0IGNvbnRlbnRzID0gW107XG5cbiAgY29uc3QgbXNncyA9IEFycmF5LmlzQXJyYXkobWVzc2FnZXMpID8gbWVzc2FnZXMgOiBbXTtcbiAgZm9yIChjb25zdCBtIG9mIG1zZ3MpIHtcbiAgICBjb25zdCByb2xlID0gbS5yb2xlO1xuICAgIGNvbnN0IHRleHQgPSBTdHJpbmcobS5jb250ZW50ID8/IFwiXCIpO1xuICAgIGlmIChyb2xlID09PSBcInN5c3RlbVwiKSBzeXN0ZW1QYXJ0cy5wdXNoKHRleHQpO1xuICAgIGVsc2UgaWYgKHJvbGUgPT09IFwiYXNzaXN0YW50XCIpIGNvbnRlbnRzLnB1c2goeyByb2xlOiBcIm1vZGVsXCIsIHBhcnRzOiBbeyB0ZXh0IH1dIH0pO1xuICAgIGVsc2UgY29udGVudHMucHVzaCh7IHJvbGU6IFwidXNlclwiLCBwYXJ0czogW3sgdGV4dCB9XSB9KTtcbiAgfVxuXG4gIGNvbnN0IGJvZHkgPSB7XG4gICAgY29udGVudHMsXG4gICAgZ2VuZXJhdGlvbkNvbmZpZzoge1xuICAgICAgbWF4T3V0cHV0VG9rZW5zOiB0eXBlb2YgbWF4X3Rva2VucyA9PT0gXCJudW1iZXJcIiA/IG1heF90b2tlbnMgOiAxMDI0LFxuICAgICAgdGVtcGVyYXR1cmU6IHR5cGVvZiB0ZW1wZXJhdHVyZSA9PT0gXCJudW1iZXJcIiA/IHRlbXBlcmF0dXJlIDogMVxuICAgIH1cbiAgfTtcbiAgaWYgKHN5c3RlbVBhcnRzLmxlbmd0aCkgYm9keS5zeXN0ZW1JbnN0cnVjdGlvbiA9IHsgcGFydHM6IFt7IHRleHQ6IHN5c3RlbVBhcnRzLmpvaW4oXCJcXG5cXG5cIikgfV0gfTtcblxuICBjb25zdCB1cmwgPSBgaHR0cHM6Ly9nZW5lcmF0aXZlbGFuZ3VhZ2UuZ29vZ2xlYXBpcy5jb20vdjFiZXRhL21vZGVscy8ke2VuY29kZVVSSUNvbXBvbmVudChtb2RlbCl9OmdlbmVyYXRlQ29udGVudGA7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczogeyBcIngtZ29vZy1hcGkta2V5XCI6IGFwaUtleSwgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KVxuICB9KTtcblxuICBjb25zdCBkYXRhID0gYXdhaXQgcmVzLmpzb24oKS5jYXRjaCgoKT0+ICh7fSkpO1xuICBpZiAoIXJlcy5vaykgdGhyb3cgdXBzdHJlYW1FcnJvcihcImdlbWluaVwiLCByZXMsIGRhdGEpO1xuXG4gIGxldCBvdXQgPSBcIlwiO1xuICBjb25zdCBjYW5kaWRhdGVzID0gQXJyYXkuaXNBcnJheShkYXRhLmNhbmRpZGF0ZXMpID8gZGF0YS5jYW5kaWRhdGVzIDogW107XG4gIGZvciAoY29uc3QgY2FuZCBvZiBjYW5kaWRhdGVzKSB7XG4gICAgY29uc3QgY29udGVudCA9IGNhbmQ/LmNvbnRlbnQ7XG4gICAgaWYgKGNvbnRlbnQ/LnBhcnRzKSBmb3IgKGNvbnN0IHAgb2YgY29udGVudC5wYXJ0cykgaWYgKHR5cGVvZiBwLnRleHQgPT09IFwic3RyaW5nXCIpIG91dCArPSBwLnRleHQ7XG4gICAgaWYgKG91dCkgYnJlYWs7XG4gIH1cblxuICBjb25zdCB1c2FnZSA9IGRhdGEudXNhZ2VNZXRhZGF0YSB8fCB7fTtcbiAgcmV0dXJuIHsgb3V0cHV0X3RleHQ6IG91dCwgaW5wdXRfdG9rZW5zOiB1c2FnZS5wcm9tcHRUb2tlbkNvdW50IHx8IDAsIG91dHB1dF90b2tlbnM6IHVzYWdlLmNhbmRpZGF0ZXNUb2tlbkNvdW50IHx8IDAsIHJhdzogZGF0YSB9O1xufVxuXG4vKipcbiAqIFN0cmVhbSBhZGFwdGVyczpcbiAqIEVhY2ggcmV0dXJucyB7IHVwc3RyZWFtOiBSZXNwb25zZSwgcGFyc2VDaHVuayh0ZXh0KS0+e2RlbHRhVGV4dCwgZG9uZSwgdXNhZ2U/fVtdIH0uXG4gKiBXZSBub3JtYWxpemUgaW50byBTU0UgZXZlbnRzIGZvciB0aGUgY2xpZW50OiBcImRlbHRhXCIgYW5kIFwiZG9uZVwiLlxuICovXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzdHJlYW1PcGVuQUkoeyBtb2RlbCwgbWVzc2FnZXMsIG1heF90b2tlbnMsIHRlbXBlcmF0dXJlIH0pIHtcbiAgY29uc3QgYXBpS2V5ID0gcHJvY2Vzcy5lbnYuT1BFTkFJX0FQSV9LRVk7XG4gIGlmICghYXBpS2V5KSB0aHJvdyBjb25maWdFcnJvcihcIk9QRU5BSV9BUElfS0VZIG5vdCBjb25maWd1cmVkXCIsIFwiU2V0IE9QRU5BSV9BUElfS0VZIGluIE5ldGxpZnkgXHUyMTkyIFNpdGUgY29uZmlndXJhdGlvbiBcdTIxOTIgRW52aXJvbm1lbnQgdmFyaWFibGVzICh5b3VyIE9wZW5BSSBBUEkga2V5KS5cIik7XG5cbiAgY29uc3QgaW5wdXQgPSBBcnJheS5pc0FycmF5KG1lc3NhZ2VzKSA/IG1lc3NhZ2VzLm1hcChtID0+ICh7XG4gICAgcm9sZTogbS5yb2xlLFxuICAgIGNvbnRlbnQ6IFt7IHR5cGU6IFwiaW5wdXRfdGV4dFwiLCB0ZXh0OiBTdHJpbmcobS5jb250ZW50ID8/IFwiXCIpIH1dXG4gIH0pKSA6IFtdO1xuXG4gIGNvbnN0IGJvZHkgPSB7XG4gICAgbW9kZWwsXG4gICAgaW5wdXQsXG4gICAgdGVtcGVyYXR1cmU6IHR5cGVvZiB0ZW1wZXJhdHVyZSA9PT0gXCJudW1iZXJcIiA/IHRlbXBlcmF0dXJlIDogMSxcbiAgICBtYXhfb3V0cHV0X3Rva2VuczogdHlwZW9mIG1heF90b2tlbnMgPT09IFwibnVtYmVyXCIgPyBtYXhfdG9rZW5zIDogMTAyNCxcbiAgICBzdG9yZTogZmFsc2UsXG4gICAgc3RyZWFtOiB0cnVlXG4gIH07XG5cbiAgY29uc3QgdXBzdHJlYW0gPSBhd2FpdCBmZXRjaChcImh0dHBzOi8vYXBpLm9wZW5haS5jb20vdjEvcmVzcG9uc2VzXCIsIHtcbiAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgIFwiYXV0aG9yaXphdGlvblwiOiBgQmVhcmVyICR7YXBpS2V5fWAsXG4gICAgICBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgIFwiYWNjZXB0XCI6IFwidGV4dC9ldmVudC1zdHJlYW1cIlxuICAgIH0sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSlcbiAgfSk7XG5cbiAgaWYgKCF1cHN0cmVhbS5vaykge1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB1cHN0cmVhbS5qc29uKCkuY2F0Y2goKCk9PiAoe30pKTtcbiAgICB0aHJvdyBuZXcgRXJyb3IoZGF0YT8uZXJyb3I/Lm1lc3NhZ2UgfHwgYE9wZW5BSSBlcnJvciAke3Vwc3RyZWFtLnN0YXR1c31gKTtcbiAgfVxuXG4gIC8vIFBhcnNlIE9wZW5BSSBTU0UgbGluZXM6IGRhdGE6IHtqc29ufVxuICBmdW5jdGlvbiBwYXJzZVNzZUxpbmVzKGNodW5rVGV4dCkge1xuICAgIGNvbnN0IG91dCA9IFtdO1xuICAgIGNvbnN0IGxpbmVzID0gY2h1bmtUZXh0LnNwbGl0KC9cXHI/XFxuLyk7XG4gICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICBpZiAoIWxpbmUuc3RhcnRzV2l0aChcImRhdGE6XCIpKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHBheWxvYWQgPSBsaW5lLnNsaWNlKDUpLnRyaW0oKTtcbiAgICAgIGlmICghcGF5bG9hZCB8fCBwYXlsb2FkID09PSBcIltET05FXVwiKSBjb250aW51ZTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IG9iaiA9IEpTT04ucGFyc2UocGF5bG9hZCk7XG4gICAgICAgIGNvbnN0IHQgPSBvYmoudHlwZSB8fCBcIlwiO1xuICAgICAgICBpZiAodC5pbmNsdWRlcyhcIm91dHB1dF90ZXh0LmRlbHRhXCIpICYmIHR5cGVvZiBvYmouZGVsdGEgPT09IFwic3RyaW5nXCIpIG91dC5wdXNoKHsgdHlwZTogXCJkZWx0YVwiLCB0ZXh0OiBvYmouZGVsdGEgfSk7XG4gICAgICAgIGlmICh0ID09PSBcInJlc3BvbnNlLmNvbXBsZXRlZFwiIHx8IHQgPT09IFwicmVzcG9uc2UuY29tcGxldGVcIiB8fCB0LmluY2x1ZGVzKFwicmVzcG9uc2UuY29tcGxldGVkXCIpKSB7XG4gICAgICAgICAgY29uc3QgdXNhZ2UgPSBvYmoucmVzcG9uc2U/LnVzYWdlIHx8IG9iai51c2FnZSB8fCB7fTtcbiAgICAgICAgICBvdXQucHVzaCh7IHR5cGU6IFwiZG9uZVwiLCB1c2FnZTogeyBpbnB1dF90b2tlbnM6IHVzYWdlLmlucHV0X3Rva2VucyB8fCAwLCBvdXRwdXRfdG9rZW5zOiB1c2FnZS5vdXRwdXRfdG9rZW5zIHx8IDAgfSB9KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCB7fVxuICAgIH1cbiAgICByZXR1cm4gb3V0O1xuICB9XG5cbiAgcmV0dXJuIHsgdXBzdHJlYW0sIHBhcnNlOiBwYXJzZVNzZUxpbmVzIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzdHJlYW1BbnRocm9waWMoeyBtb2RlbCwgbWVzc2FnZXMsIG1heF90b2tlbnMsIHRlbXBlcmF0dXJlIH0pIHtcbiAgY29uc3QgYXBpS2V5ID0gcHJvY2Vzcy5lbnYuQU5USFJPUElDX0FQSV9LRVk7XG4gIGlmICghYXBpS2V5KSB0aHJvdyBjb25maWdFcnJvcihcIkFOVEhST1BJQ19BUElfS0VZIG5vdCBjb25maWd1cmVkXCIsIFwiU2V0IEFOVEhST1BJQ19BUElfS0VZIGluIE5ldGxpZnkgXHUyMTkyIFNpdGUgY29uZmlndXJhdGlvbiBcdTIxOTIgRW52aXJvbm1lbnQgdmFyaWFibGVzICh5b3VyIEFudGhyb3BpYyBBUEkga2V5KS5cIik7XG5cbiAgY29uc3Qgc3lzdGVtUGFydHMgPSBbXTtcbiAgY29uc3Qgb3V0TXNncyA9IFtdO1xuXG4gIGNvbnN0IG1zZ3MgPSBBcnJheS5pc0FycmF5KG1lc3NhZ2VzKSA/IG1lc3NhZ2VzIDogW107XG4gIGZvciAoY29uc3QgbSBvZiBtc2dzKSB7XG4gICAgY29uc3Qgcm9sZSA9IFN0cmluZyhtLnJvbGUgfHwgXCJcIikudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCB0ZXh0ID0gU3RyaW5nKG0uY29udGVudCA/PyBcIlwiKTtcbiAgICBpZiAoIXRleHQpIGNvbnRpbnVlO1xuICAgIGlmIChyb2xlID09PSBcInN5c3RlbVwiIHx8IHJvbGUgPT09IFwiZGV2ZWxvcGVyXCIpIHN5c3RlbVBhcnRzLnB1c2godGV4dCk7XG4gICAgZWxzZSBpZiAocm9sZSA9PT0gXCJhc3Npc3RhbnRcIikgb3V0TXNncy5wdXNoKHsgcm9sZTogXCJhc3Npc3RhbnRcIiwgY29udGVudDogdGV4dCB9KTtcbiAgICBlbHNlIG91dE1zZ3MucHVzaCh7IHJvbGU6IFwidXNlclwiLCBjb250ZW50OiB0ZXh0IH0pO1xuICB9XG5cbiAgY29uc3QgYm9keSA9IHtcbiAgICBtb2RlbCxcbiAgICBtYXhfdG9rZW5zOiB0eXBlb2YgbWF4X3Rva2VucyA9PT0gXCJudW1iZXJcIiA/IG1heF90b2tlbnMgOiAxMDI0LFxuICAgIHRlbXBlcmF0dXJlOiB0eXBlb2YgdGVtcGVyYXR1cmUgPT09IFwibnVtYmVyXCIgPyB0ZW1wZXJhdHVyZSA6IDEsXG4gICAgc3RyZWFtOiB0cnVlLFxuICAgIG1lc3NhZ2VzOiBvdXRNc2dzXG4gIH07XG4gIGlmIChzeXN0ZW1QYXJ0cy5sZW5ndGgpIGJvZHkuc3lzdGVtID0gc3lzdGVtUGFydHMuam9pbihcIlxcblxcblwiKTtcblxuY29uc3QgdXBzdHJlYW0gPSBhd2FpdCBmZXRjaChcImh0dHBzOi8vYXBpLmFudGhyb3BpYy5jb20vdjEvbWVzc2FnZXNcIiwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczoge1xuICAgICAgXCJ4LWFwaS1rZXlcIjogYXBpS2V5LFxuICAgICAgXCJhbnRocm9waWMtdmVyc2lvblwiOiBcIjIwMjMtMDYtMDFcIixcbiAgICAgIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgXCJhY2NlcHRcIjogXCJ0ZXh0L2V2ZW50LXN0cmVhbVwiXG4gICAgfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KVxuICB9KTtcblxuICBpZiAoIXVwc3RyZWFtLm9rKSB7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHVwc3RyZWFtLmpzb24oKS5jYXRjaCgoKT0+ICh7fSkpO1xuICAgIHRocm93IG5ldyBFcnJvcihkYXRhPy5lcnJvcj8ubWVzc2FnZSB8fCBgQW50aHJvcGljIGVycm9yICR7dXBzdHJlYW0uc3RhdHVzfWApO1xuICB9XG5cbiAgZnVuY3Rpb24gcGFyc2VTc2VMaW5lcyhjaHVua1RleHQpIHtcbiAgICBjb25zdCBvdXQgPSBbXTtcbiAgICBjb25zdCBsaW5lcyA9IGNodW5rVGV4dC5zcGxpdCgvXFxyP1xcbi8pO1xuICAgIC8vIEFudGhyb3BpYyBTU0UgdXNlcyBcImV2ZW50OlwiIGFuZCBcImRhdGE6XCIgbGluZXM7IHdlIHBhcnNlIGRhdGEganNvblxuICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgaWYgKCFsaW5lLnN0YXJ0c1dpdGgoXCJkYXRhOlwiKSkgY29udGludWU7XG4gICAgICBjb25zdCBwYXlsb2FkID0gbGluZS5zbGljZSg1KS50cmltKCk7XG4gICAgICBpZiAoIXBheWxvYWQgfHwgcGF5bG9hZCA9PT0gXCJbRE9ORV1cIikgY29udGludWU7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBvYmogPSBKU09OLnBhcnNlKHBheWxvYWQpO1xuICAgICAgICBjb25zdCB0ID0gb2JqLnR5cGUgfHwgXCJcIjtcbiAgICAgICAgaWYgKHQgPT09IFwiY29udGVudF9ibG9ja19kZWx0YVwiICYmIG9iai5kZWx0YT8udHlwZSA9PT0gXCJ0ZXh0X2RlbHRhXCIgJiYgdHlwZW9mIG9iai5kZWx0YS50ZXh0ID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgb3V0LnB1c2goeyB0eXBlOiBcImRlbHRhXCIsIHRleHQ6IG9iai5kZWx0YS50ZXh0IH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0ID09PSBcIm1lc3NhZ2VfZGVsdGFcIiAmJiBvYmoudXNhZ2UpIHtcbiAgICAgICAgICAvLyBpbnRlcm1lZGlhdGUgdXNhZ2Ugc29tZXRpbWVzXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHQgPT09IFwibWVzc2FnZV9zdG9wXCIgfHwgdCA9PT0gXCJtZXNzYWdlX2VuZFwiIHx8IHQgPT09IFwibWVzc2FnZV9jb21wbGV0ZVwiKSB7XG4gICAgICAgICAgY29uc3QgdXNhZ2UgPSBvYmoudXNhZ2UgfHwge307XG4gICAgICAgICAgb3V0LnB1c2goeyB0eXBlOiBcImRvbmVcIiwgdXNhZ2U6IHsgaW5wdXRfdG9rZW5zOiB1c2FnZS5pbnB1dF90b2tlbnMgfHwgMCwgb3V0cHV0X3Rva2VuczogdXNhZ2Uub3V0cHV0X3Rva2VucyB8fCAwIH0gfSk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2gge31cbiAgICB9XG4gICAgcmV0dXJuIG91dDtcbiAgfVxuXG4gIHJldHVybiB7IHVwc3RyZWFtLCBwYXJzZTogcGFyc2VTc2VMaW5lcyB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3RyZWFtR2VtaW5pKHsgbW9kZWwsIG1lc3NhZ2VzLCBtYXhfdG9rZW5zLCB0ZW1wZXJhdHVyZSB9KSB7XG4gIGNvbnN0IGFwaUtleVJhdyA9IHByb2Nlc3MuZW52LkdFTUlOSV9BUElfS0VZX0xPQ0FMIHx8IHByb2Nlc3MuZW52LkdFTUlOSV9BUElfS0VZO1xuICBjb25zdCBhcGlLZXkgPSBTdHJpbmcoYXBpS2V5UmF3IHx8IFwiXCIpXG4gICAgLnRyaW0oKVxuICAgIC5yZXBsYWNlKC9eXCIoLiopXCIkLywgXCIkMVwiKVxuICAgIC50cmltKCk7XG4gIGlmICghYXBpS2V5KSB0aHJvdyBjb25maWdFcnJvcihcIkdFTUlOSV9BUElfS0VZIG5vdCBjb25maWd1cmVkXCIsIFwiU2V0IEdFTUlOSV9BUElfS0VZIChvciBmb3IgbG9jYWwgZGV2OiBHRU1JTklfQVBJX0tFWV9MT0NBTCkgaW4gTmV0bGlmeSBcdTIxOTIgU2l0ZSBjb25maWd1cmF0aW9uIFx1MjE5MiBFbnZpcm9ubWVudCB2YXJpYWJsZXMuXCIpO1xuXG4gIGNvbnN0IHN5c3RlbVBhcnRzID0gW107XG4gIGNvbnN0IGNvbnRlbnRzID0gW107XG4gIGNvbnN0IG1zZ3MgPSBBcnJheS5pc0FycmF5KG1lc3NhZ2VzKSA/IG1lc3NhZ2VzIDogW107XG4gIGZvciAoY29uc3QgbSBvZiBtc2dzKSB7XG4gICAgY29uc3Qgcm9sZSA9IG0ucm9sZTtcbiAgICBjb25zdCB0ZXh0ID0gU3RyaW5nKG0uY29udGVudCA/PyBcIlwiKTtcbiAgICBpZiAocm9sZSA9PT0gXCJzeXN0ZW1cIikgc3lzdGVtUGFydHMucHVzaCh0ZXh0KTtcbiAgICBlbHNlIGlmIChyb2xlID09PSBcImFzc2lzdGFudFwiKSBjb250ZW50cy5wdXNoKHsgcm9sZTogXCJtb2RlbFwiLCBwYXJ0czogW3sgdGV4dCB9XSB9KTtcbiAgICBlbHNlIGNvbnRlbnRzLnB1c2goeyByb2xlOiBcInVzZXJcIiwgcGFydHM6IFt7IHRleHQgfV0gfSk7XG4gIH1cblxuICBjb25zdCBib2R5ID0ge1xuICAgIGNvbnRlbnRzLFxuICAgIGdlbmVyYXRpb25Db25maWc6IHtcbiAgICAgIG1heE91dHB1dFRva2VuczogdHlwZW9mIG1heF90b2tlbnMgPT09IFwibnVtYmVyXCIgPyBtYXhfdG9rZW5zIDogMTAyNCxcbiAgICAgIHRlbXBlcmF0dXJlOiB0eXBlb2YgdGVtcGVyYXR1cmUgPT09IFwibnVtYmVyXCIgPyB0ZW1wZXJhdHVyZSA6IDFcbiAgICB9XG4gIH07XG4gIGlmIChzeXN0ZW1QYXJ0cy5sZW5ndGgpIGJvZHkuc3lzdGVtSW5zdHJ1Y3Rpb24gPSB7IHBhcnRzOiBbeyB0ZXh0OiBzeXN0ZW1QYXJ0cy5qb2luKFwiXFxuXFxuXCIpIH1dIH07XG5cbiAgLy8gc3RyZWFtaW5nIGVuZHBvaW50XG4gIGNvbnN0IHVybCA9IGBodHRwczovL2dlbmVyYXRpdmVsYW5ndWFnZS5nb29nbGVhcGlzLmNvbS92MWJldGEvbW9kZWxzLyR7ZW5jb2RlVVJJQ29tcG9uZW50KG1vZGVsKX06c3RyZWFtR2VuZXJhdGVDb250ZW50YDtcbiAgY29uc3QgdXBzdHJlYW0gPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgIGhlYWRlcnM6IHsgXCJ4LWdvb2ctYXBpLWtleVwiOiBhcGlLZXksIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSlcbiAgfSk7XG5cbiAgaWYgKCF1cHN0cmVhbS5vaykge1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB1cHN0cmVhbS5qc29uKCkuY2F0Y2goKCk9PiAoe30pKTtcbiAgICB0aHJvdyB1cHN0cmVhbUVycm9yKFwiZ2VtaW5pXCIsIHVwc3RyZWFtLCBkYXRhKTtcbiAgfVxuXG4gIC8vIEdlbWluaSBzdHJlYW0gaXMgdHlwaWNhbGx5IG5ld2xpbmUtZGVsaW1pdGVkIEpTT04gb2JqZWN0cyAobm90IFNTRSkuXG4gIGZ1bmN0aW9uIHBhcnNlTmRqc29uKGNodW5rVGV4dCkge1xuICAgIGNvbnN0IG91dCA9IFtdO1xuICAgIGNvbnN0IHBhcnRzID0gY2h1bmtUZXh0LnNwbGl0KC9cXHI/XFxuLykubWFwKHMgPT4gcy50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcbiAgICBmb3IgKGNvbnN0IHAgb2YgcGFydHMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IG9iaiA9IEpTT04ucGFyc2UocCk7XG4gICAgICAgIC8vIEV4dHJhY3QgZGVsdGEtaXNoIHRleHQgaWYgcHJlc2VudFxuICAgICAgICBjb25zdCBjYW5kaWRhdGVzID0gQXJyYXkuaXNBcnJheShvYmouY2FuZGlkYXRlcykgPyBvYmouY2FuZGlkYXRlcyA6IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IGNhbmQgb2YgY2FuZGlkYXRlcykge1xuICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBjYW5kPy5jb250ZW50O1xuICAgICAgICAgIGlmIChjb250ZW50Py5wYXJ0cykge1xuICAgICAgICAgICAgZm9yIChjb25zdCBwYXJ0IG9mIGNvbnRlbnQucGFydHMpIHtcbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiBwYXJ0LnRleHQgPT09IFwic3RyaW5nXCIgJiYgcGFydC50ZXh0KSBvdXQucHVzaCh7IHR5cGU6IFwiZGVsdGFcIiwgdGV4dDogcGFydC50ZXh0IH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCB1c2FnZSA9IG9iai51c2FnZU1ldGFkYXRhO1xuICAgICAgICBpZiAodXNhZ2UgJiYgKHVzYWdlLnByb21wdFRva2VuQ291bnQgfHwgdXNhZ2UuY2FuZGlkYXRlc1Rva2VuQ291bnQpKSB7XG4gICAgICAgICAgLy8gbm8gcmVsaWFibGUgXCJkb25lXCIgbWFya2VyOyB3ZSB3aWxsIGVtaXQgZG9uZSBhdCBzdHJlYW0gZW5kIHVzaW5nIGxhc3Qtc2VlbiB1c2FnZVxuICAgICAgICAgIG91dC5wdXNoKHsgdHlwZTogXCJ1c2FnZVwiLCB1c2FnZTogeyBpbnB1dF90b2tlbnM6IHVzYWdlLnByb21wdFRva2VuQ291bnQgfHwgMCwgb3V0cHV0X3Rva2VuczogdXNhZ2UuY2FuZGlkYXRlc1Rva2VuQ291bnQgfHwgMCB9IH0pO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIHt9XG4gICAgfVxuICAgIHJldHVybiBvdXQ7XG4gIH1cblxuICByZXR1cm4geyB1cHN0cmVhbSwgcGFyc2U6IHBhcnNlTmRqc29uLCBpc05kanNvbjogdHJ1ZSB9O1xufVxuIiwgImltcG9ydCB7IHdyYXAgfSBmcm9tIFwiLi9fbGliL3dyYXAuanNcIjtcbmltcG9ydCB7IHZhbGlkYXRlVHdpbGlvUmVxdWVzdCwgc2F5R2F0aGVyVHdpbWwsIGhhbmd1cFR3aW1sLCBkaWFsVHdpbWwsIHR3aW1sIH0gZnJvbSBcIi4vX2xpYi90d2lsaW8uanNcIjtcbmltcG9ydCB7IGdldFZvaWNlTnVtYmVyQnlUbywgdXBzZXJ0Q2FsbCwgYWRkQ2FsbE1lc3NhZ2UsIGdldFJlY2VudE1lc3NhZ2VzIH0gZnJvbSBcIi4vX2xpYi92b2ljZS5qc1wiO1xuaW1wb3J0IHsgY2FsbE9wZW5BSSwgY2FsbEFudGhyb3BpYywgY2FsbEdlbWluaSB9IGZyb20gXCIuL19saWIvcHJvdmlkZXJzLmpzXCI7XG5cbmZ1bmN0aW9uIHNhZmVUZXh0KHMsIG1heCA9IDE0MDApIHtcbiAgY29uc3QgdCA9IChzIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpO1xuICByZXR1cm4gdC5sZW5ndGggPiBtYXggPyB0LnNsaWNlKDAsIG1heCkgKyBcIlx1MjAyNlwiIDogdDtcbn1cblxuZnVuY3Rpb24gYnVpbGRTeXN0ZW1Qcm9tcHQodm4sIGZyb20sIHRvKSB7XG4gIGNvbnN0IHBiID0gdm4ucGxheWJvb2sgfHwge307XG4gIGNvbnN0IGJhc2UgPSBwYi5zeXN0ZW1fcHJvbXB0IHx8IGBZb3UgYXJlIEthaXh1IFZvaWNlIE9wZXJhdG9yIGZvciBTT0xFbnRlcnByaXNlcy4gWW91IGFuc3dlciBidXNpbmVzcyBjYWxscyBsaWtlIGEgc2hhcnAgaHVtYW4gYXNzaXN0YW50LlxuUnVsZXM6XG4tIEJlIGNvbmNpc2UsIHBvbGl0ZSwgYW5kIGRlY2lzaXZlLlxuLSBBc2sgb25lIHF1ZXN0aW9uIGF0IGEgdGltZS5cbi0gSWYgY2FsbGVyIGFza3MgdG8gc3BlYWsgd2l0aCBhIGh1bWFuLCBvZmZlciB0byB0cmFuc2Zlci5cbi0gTmV2ZXIgYXNrIGZvciBmdWxsIGNyZWRpdCBjYXJkIG51bWJlcnMgb3Igc2Vuc2l0aXZlIHBlcnNvbmFsIGRhdGEuXG4tIENvbmZpcm0gYW55IHRpbWUvZGF0ZS9kb2xsYXIgYW1vdW50cyBiZWZvcmUgZmluYWxpemluZy5cbi0gSWYgeW91IGFyZSBkb25lIGFuZCB0aGUgY2FsbGVyIGhhcyBubyBmdXJ0aGVyIHJlcXVlc3RzLCBlbmQgdGhlIGNhbGwuYDtcblxuICBjb25zdCByb3V0aW5nID0gcGIucm91dGluZyB8fCB7fTtcbiAgY29uc3QgdHogPSB2bi50aW1lem9uZSB8fCBcIkFtZXJpY2EvUGhvZW5peFwiO1xuXG4gIHJldHVybiBgJHtiYXNlfVxuXG5Db250ZXh0OlxuLSBUZW5hbnQvQ3VzdG9tZXIgSUQ6ICR7dm4uY3VzdG9tZXJfaWR9XG4tIENhbGxlZCBOdW1iZXI6ICR7dG99XG4tIENhbGxlciBOdW1iZXI6ICR7ZnJvbX1cbi0gVGltZXpvbmU6ICR7dHp9XG5cblRyYW5zZmVyOlxuLSBJZiB0cmFuc2ZlciBpcyBuZWVkZWQsIHNheTogXCI8VFJBTlNGRVIvPlwiIG9uIGl0cyBvd24gbGluZSBhdCB0aGUgZW5kIG9mIHlvdXIgcmVzcG9uc2UuXG4tIElmIGVuZGluZyB0aGUgY2FsbCwgc2F5OiBcIjxFTkRfQ0FMTC8+XCIgb24gaXRzIG93biBsaW5lIGF0IHRoZSBlbmQgb2YgeW91ciByZXNwb25zZS5cbmA7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJ1bkxMTSh7IHByb3ZpZGVyLCBtb2RlbCwgbWVzc2FnZXMgfSkge1xuICBpZiAocHJvdmlkZXIgPT09IFwib3BlbmFpXCIpIHJldHVybiBhd2FpdCBjYWxsT3BlbkFJKHsgbW9kZWwsIG1lc3NhZ2VzIH0pO1xuICBpZiAocHJvdmlkZXIgPT09IFwiYW50aHJvcGljXCIpIHJldHVybiBhd2FpdCBjYWxsQW50aHJvcGljKHsgbW9kZWwsIG1lc3NhZ2VzIH0pO1xuICBpZiAocHJvdmlkZXIgPT09IFwiZ2VtaW5pXCIpIHJldHVybiBhd2FpdCBjYWxsR2VtaW5pKHsgbW9kZWwsIG1lc3NhZ2VzIH0pO1xuICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXCJVbnN1cHBvcnRlZCBwcm92aWRlclwiKTtcbiAgZXJyLnN0YXR1cyA9IDQwMDtcbiAgdGhyb3cgZXJyO1xufVxuXG5leHBvcnQgZGVmYXVsdCB3cmFwKGFzeW5jIChyZXEpID0+IHtcbiAgY29uc3QgYm9keVRleHQgPSBhd2FpdCByZXEudGV4dCgpO1xuICBjb25zdCBwYXJhbXMgPSBPYmplY3QuZnJvbUVudHJpZXMobmV3IFVSTFNlYXJjaFBhcmFtcyhib2R5VGV4dCkpO1xuXG4gIGNvbnN0IHVybCA9IG5ldyBVUkwocmVxLnVybCk7XG4gIGNvbnN0IGZ1bGxVcmwgPSB1cmwudG9TdHJpbmcoKTtcblxuICBjb25zdCB2ID0gdmFsaWRhdGVUd2lsaW9SZXF1ZXN0KHsgcmVxLCB1cmw6IGZ1bGxVcmwsIHBhcmFtcyB9KTtcbiAgaWYgKCF2Lm9rKSByZXR1cm4gbmV3IFJlc3BvbnNlKHYuZXJyb3IsIHsgc3RhdHVzOiB2LnN0YXR1cyB8fCA0MDEsIGhlYWRlcnM6IHsgXCJjb250ZW50LXR5cGVcIjogXCJ0ZXh0L3BsYWluXCIgfSB9KTtcblxuICBjb25zdCBjYWxsU2lkID0gcGFyYW1zLkNhbGxTaWQgfHwgcGFyYW1zLkNhbGxTSUQ7XG4gIGNvbnN0IGZyb20gPSBwYXJhbXMuRnJvbSB8fCBcIlwiO1xuICBjb25zdCB0byA9IHBhcmFtcy5UbyB8fCBcIlwiO1xuICBjb25zdCBzcGVlY2ggPSBwYXJhbXMuU3BlZWNoUmVzdWx0IHx8IHBhcmFtcy5zcGVlY2hSZXN1bHQgfHwgXCJcIjtcbiAgaWYgKCFjYWxsU2lkIHx8ICF0bykgcmV0dXJuIG5ldyBSZXNwb25zZShcIk1pc3NpbmcgQ2FsbFNpZC9Ub1wiLCB7IHN0YXR1czogNDAwIH0pO1xuXG4gIGNvbnN0IHZuID0gYXdhaXQgZ2V0Vm9pY2VOdW1iZXJCeVRvKHRvKTtcbiAgaWYgKCF2bikgcmV0dXJuIHR3aW1sKGA8P3htbCB2ZXJzaW9uPVwiMS4wXCIgZW5jb2Rpbmc9XCJVVEYtOFwiPz48UmVzcG9uc2U+PFNheT5Tb3JyeSwgdGhpcyBudW1iZXIgaXMgbm90IGNvbmZpZ3VyZWQuPC9TYXk+PEhhbmd1cC8+PC9SZXNwb25zZT5gKTtcblxuICBjb25zdCBjYWxsID0gYXdhaXQgdXBzZXJ0Q2FsbCh7XG4gICAgY3VzdG9tZXJJZDogdm4uY3VzdG9tZXJfaWQsXG4gICAgdm9pY2VOdW1iZXJJZDogdm4uaWQsXG4gICAgcHJvdmlkZXI6IFwidHdpbGlvXCIsXG4gICAgY2FsbFNpZCxcbiAgICBmcm9tTnVtYmVyOiBmcm9tLFxuICAgIHRvTnVtYmVyOiB0byxcbiAgICBtZXRhOiB7IHR3aWxpbzogeyBhY2NvdW50X3NpZDogcGFyYW1zLkFjY291bnRTaWQgfHwgbnVsbCB9IH1cbiAgfSk7XG5cbiAgY29uc3QgdXR0ZXJhbmNlID0gc2FmZVRleHQoc3BlZWNoIHx8IFwiXCIpO1xuICBpZiAodXR0ZXJhbmNlKSBhd2FpdCBhZGRDYWxsTWVzc2FnZShjYWxsLmlkLCBcInVzZXJcIiwgdXR0ZXJhbmNlKTtcblxuICBjb25zdCByZWNlbnQgPSBhd2FpdCBnZXRSZWNlbnRNZXNzYWdlcyhjYWxsLmlkLCAxNCk7XG5cbiAgY29uc3Qgc3lzdGVtID0gYnVpbGRTeXN0ZW1Qcm9tcHQodm4sIGZyb20sIHRvKTtcbiAgY29uc3QgbWVzc2FnZXMgPSBbXG4gICAgeyByb2xlOiBcInN5c3RlbVwiLCBjb250ZW50OiBzeXN0ZW0gfSxcbiAgICAuLi5yZWNlbnQubWFwKG0gPT4gKHsgcm9sZTogbS5yb2xlLCBjb250ZW50OiBtLmNvbnRlbnQgfSkpXG4gIF07XG5cbiAgY29uc3QgcHJvdmlkZXIgPSAodm4uZGVmYXVsdF9sbG1fcHJvdmlkZXIgfHwgXCJvcGVuYWlcIikudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBtb2RlbCA9ICh2bi5kZWZhdWx0X2xsbV9tb2RlbCB8fCBcImdwdC00LjEtbWluaVwiKS50b1N0cmluZygpO1xuXG4gIGxldCBhc3Npc3RhbnQgPSBcIlNvcnJ5XHUyMDE0b25lIG1vbWVudC4gQ291bGQgeW91IHJlcGVhdCB0aGF0P1wiO1xuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHJ1bkxMTSh7IHByb3ZpZGVyLCBtb2RlbCwgbWVzc2FnZXMgfSk7XG4gICAgYXNzaXN0YW50ID0gKHJlcyAmJiByZXMudGV4dCkgPyBTdHJpbmcocmVzLnRleHQpIDogYXNzaXN0YW50O1xuICB9IGNhdGNoIChlKSB7XG4gICAgYXNzaXN0YW50ID0gXCJJIGhpdCBhIHN5c3RlbSBlcnJvci4gTGV0IG1lIGNvbm5lY3QgeW91IHdpdGggYSBodW1hbi5cIjtcbiAgICBhc3Npc3RhbnQgKz0gXCJcXG48VFJBTlNGRVIvPlwiO1xuICB9XG5cbiAgLy8gRXh0cmFjdCBjb250cm9sIHRhZ3NcbiAgY29uc3QgbGluZXMgPSBhc3Npc3RhbnQuc3BsaXQoL1xccj9cXG4vKS5tYXAocyA9PiBzLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xuICBjb25zdCBoYXNUcmFuc2ZlciA9IGxpbmVzLmluY2x1ZGVzKFwiPFRSQU5TRkVSLz5cIik7XG4gIGNvbnN0IGhhc0VuZCA9IGxpbmVzLmluY2x1ZGVzKFwiPEVORF9DQUxMLz5cIik7XG4gIGNvbnN0IGNsZWFuID0gYXNzaXN0YW50LnJlcGxhY2UoL1xcblxccyo8VFJBTlNGRVJcXC8+XFxzKi9nLCBcIlxcblwiKS5yZXBsYWNlKC9cXG5cXHMqPEVORF9DQUxMXFwvPlxccyovZywgXCJcXG5cIikudHJpbSgpO1xuXG4gIGF3YWl0IGFkZENhbGxNZXNzYWdlKGNhbGwuaWQsIFwiYXNzaXN0YW50XCIsIHNhZmVUZXh0KGNsZWFuLCA0MDAwKSk7XG5cbiAgY29uc3QgYWN0aW9uVXJsID0gbmV3IFVSTChcIi8ubmV0bGlmeS9mdW5jdGlvbnMvdm9pY2UtdHdpbGlvLXR1cm5cIiwgdXJsLm9yaWdpbikudG9TdHJpbmcoKTtcblxuICBpZiAoaGFzVHJhbnNmZXIpIHtcbiAgICBjb25zdCB0cmFuc2Zlck51bWJlciA9ICh2bi5wbGF5Ym9vayAmJiB2bi5wbGF5Ym9vay50cmFuc2Zlcl9udW1iZXIpID8gU3RyaW5nKHZuLnBsYXlib29rLnRyYW5zZmVyX251bWJlcikgOiAocHJvY2Vzcy5lbnYuVk9JQ0VfRkFMTEJBQ0tfVFJBTlNGRVJfTlVNQkVSIHx8IFwiXCIpO1xuICAgIGlmICghdHJhbnNmZXJOdW1iZXIpIHtcbiAgICAgIHJldHVybiB0d2ltbChzYXlHYXRoZXJUd2ltbCh7XG4gICAgICAgIHNheTogY2xlYW4gKyBcIiBJIGNhbid0IHRyYW5zZmVyIHJpZ2h0IG5vd1x1MjAxNHBsZWFzZSBsZWF2ZSBhIG1lc3NhZ2UgYWZ0ZXIgdGhlIHRvbmUsIG9yIGNhbGwgYmFjay5cIixcbiAgICAgICAgYWN0aW9uVXJsLFxuICAgICAgICBsYW5ndWFnZTogdm4ubG9jYWxlIHx8IFwiZW4tVVNcIixcbiAgICAgICAgdm9pY2U6IFwiYWxpY2VcIlxuICAgICAgfSkpO1xuICAgIH1cbiAgICByZXR1cm4gdHdpbWwoZGlhbFR3aW1sKHsgc2F5OiBjbGVhbiB8fCBcIkNvbm5lY3RpbmcgeW91IG5vdy5cIiwgZGlhbE51bWJlcjogdHJhbnNmZXJOdW1iZXIsIHZvaWNlOiBcImFsaWNlXCIsIGxhbmd1YWdlOiB2bi5sb2NhbGUgfHwgXCJlbi1VU1wiIH0pKTtcbiAgfVxuXG4gIGlmIChoYXNFbmQpIHtcbiAgICByZXR1cm4gdHdpbWwoaGFuZ3VwVHdpbWwoeyBzYXk6IGNsZWFuIHx8IFwiR29vZGJ5ZS5cIiwgdm9pY2U6IFwiYWxpY2VcIiwgbGFuZ3VhZ2U6IHZuLmxvY2FsZSB8fCBcImVuLVVTXCIgfSkpO1xuICB9XG5cbiAgcmV0dXJuIHR3aW1sKHNheUdhdGhlclR3aW1sKHtcbiAgICBzYXk6IGNsZWFuLFxuICAgIGFjdGlvblVybCxcbiAgICBsYW5ndWFnZTogdm4ubG9jYWxlIHx8IFwiZW4tVVNcIixcbiAgICB2b2ljZTogXCJhbGljZVwiXG4gIH0pKTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7OztBQUFPLFNBQVMsVUFBVSxLQUFLO0FBQzdCLFFBQU0sWUFBWSxRQUFRLElBQUksbUJBQW1CLElBQUksS0FBSztBQUMxRCxRQUFNLFlBQVksSUFBSSxRQUFRLElBQUksUUFBUSxLQUFLLElBQUksUUFBUSxJQUFJLFFBQVE7QUFHdkUsUUFBTSxlQUFlO0FBQ3JCLFFBQU0sZUFBZTtBQUVyQixRQUFNLE9BQU87QUFBQSxJQUNYLGdDQUFnQztBQUFBLElBQ2hDLGdDQUFnQztBQUFBLElBQ2hDLGlDQUFpQztBQUFBLElBQ2pDLDBCQUEwQjtBQUFBLEVBQzVCO0FBS0EsTUFBSSxDQUFDLFVBQVU7QUFFYixXQUFPO0FBQUEsTUFDTCxHQUFHO0FBQUEsTUFDSCxHQUFJLFlBQVksRUFBRSxNQUFNLFNBQVMsSUFBSSxDQUFDO0FBQUEsSUFDeEM7QUFBQSxFQUNGO0FBRUEsUUFBTSxVQUFVLFNBQVMsTUFBTSxHQUFHLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsRUFBRSxPQUFPLE9BQU87QUFHdkUsTUFBSSxRQUFRLFNBQVMsR0FBRyxHQUFHO0FBQ3pCLFVBQU0sU0FBUyxhQUFhO0FBQzVCLFdBQU87QUFBQSxNQUNMLEdBQUc7QUFBQSxNQUNILCtCQUErQjtBQUFBLE1BQy9CLEdBQUksWUFBWSxFQUFFLE1BQU0sU0FBUyxJQUFJLENBQUM7QUFBQSxJQUN4QztBQUFBLEVBQ0Y7QUFHQSxNQUFJLGFBQWEsUUFBUSxTQUFTLFNBQVMsR0FBRztBQUM1QyxXQUFPO0FBQUEsTUFDTCxHQUFHO0FBQUEsTUFDSCwrQkFBK0I7QUFBQSxNQUMvQixNQUFNO0FBQUEsSUFDUjtBQUFBLEVBQ0Y7QUFHQSxTQUFPO0FBQUEsSUFDTCxHQUFHO0FBQUEsSUFDSCxHQUFJLFlBQVksRUFBRSxNQUFNLFNBQVMsSUFBSSxDQUFDO0FBQUEsRUFDeEM7QUFDRjtBQUdPLFNBQVMsS0FBSyxRQUFRLE1BQU0sVUFBVSxDQUFDLEdBQUc7QUFDL0MsU0FBTyxJQUFJLFNBQVMsS0FBSyxVQUFVLElBQUksR0FBRztBQUFBLElBQ3hDO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUCxnQkFBZ0I7QUFBQSxNQUNoQixHQUFHO0FBQUEsSUFDTDtBQUFBLEVBQ0YsQ0FBQztBQUNIOzs7QUMvREEsU0FBUyxZQUFZO0FBYXJCLElBQUksT0FBTztBQUNYLElBQUksaUJBQWlCO0FBRXJCLFNBQVMsU0FBUztBQUNoQixNQUFJLEtBQU0sUUFBTztBQUVqQixRQUFNLFdBQVcsQ0FBQyxFQUFFLFFBQVEsSUFBSSx3QkFBd0IsUUFBUSxJQUFJO0FBQ3BFLE1BQUksQ0FBQyxVQUFVO0FBQ2IsVUFBTSxNQUFNLElBQUksTUFBTSxnR0FBZ0c7QUFDdEgsUUFBSSxPQUFPO0FBQ1gsUUFBSSxTQUFTO0FBQ2IsUUFBSSxPQUFPO0FBQ1gsVUFBTTtBQUFBLEVBQ1I7QUFFQSxTQUFPLEtBQUs7QUFDWixTQUFPO0FBQ1Q7QUFFQSxlQUFlLGVBQWU7QUFDNUIsTUFBSSxlQUFnQixRQUFPO0FBRTNCLG9CQUFrQixZQUFZO0FBQzVCLFVBQU0sTUFBTSxPQUFPO0FBQ25CLFVBQU0sYUFBYTtBQUFBLE1BQ2pCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BZUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFZQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVdBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BV0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFRQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU9BO0FBQUEsTUFBMkc7QUFBQSxNQUMzRztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFZQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BR0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BUUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVVBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BbUJBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUErQkE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUEsTUFHQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BTUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVVBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWtCQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BZUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFPQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFTQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFZQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFTQTtBQUFBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BT0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQXVCQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBLE1BR0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFlQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BaUJBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU9BO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFXQTtBQUFBLElBRU47QUFFSSxlQUFXLEtBQUssWUFBWTtBQUMxQixZQUFNLElBQUksTUFBTSxDQUFDO0FBQUEsSUFDbkI7QUFBQSxFQUNGLEdBQUc7QUFFSCxTQUFPO0FBQ1Q7QUFPQSxlQUFzQixFQUFFLE1BQU0sU0FBUyxDQUFDLEdBQUc7QUFDekMsUUFBTSxhQUFhO0FBQ25CLFFBQU0sTUFBTSxPQUFPO0FBQ25CLFFBQU0sT0FBTyxNQUFNLElBQUksTUFBTSxNQUFNLE1BQU07QUFDekMsU0FBTyxFQUFFLE1BQU0sUUFBUSxDQUFDLEdBQUcsVUFBVSxNQUFNLFFBQVEsSUFBSSxJQUFJLEtBQUssU0FBUyxFQUFFO0FBQzdFOzs7QUNuZ0JBLFNBQVMsUUFBUSxHQUFHLE1BQU0sS0FBTTtBQUM5QixNQUFJLEtBQUssS0FBTSxRQUFPO0FBQ3RCLFFBQU0sSUFBSSxPQUFPLENBQUM7QUFDbEIsTUFBSSxFQUFFLFVBQVUsSUFBSyxRQUFPO0FBQzVCLFNBQU8sRUFBRSxNQUFNLEdBQUcsR0FBRyxJQUFJLFdBQU0sRUFBRSxTQUFTLEdBQUc7QUFDL0M7QUFFQSxTQUFTLFdBQVc7QUFDbEIsTUFBSTtBQUNGLFFBQUksV0FBVyxRQUFRLFdBQVksUUFBTyxXQUFXLE9BQU8sV0FBVztBQUFBLEVBQ3pFLFFBQVE7QUFBQSxFQUFDO0FBRVQsU0FBTyxTQUFTLEtBQUssT0FBTyxFQUFFLFNBQVMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxJQUFJLE1BQU0sS0FBSyxJQUFJLEVBQUUsU0FBUyxFQUFFO0FBQ3BGO0FBRU8sU0FBUyxhQUFhLEtBQUs7QUFDaEMsUUFBTSxLQUFLLElBQUksUUFBUSxJQUFJLG9CQUFvQixLQUFLLElBQUksUUFBUSxJQUFJLGNBQWMsS0FBSyxJQUFJLEtBQUs7QUFDaEcsU0FBTyxLQUFLLFNBQVM7QUFDdkI7QUFFTyxTQUFTLGtCQUFrQixLQUFLO0FBQ3JDLE1BQUk7QUFDRixVQUFNLElBQUksSUFBSSxJQUFJLElBQUksR0FBRztBQUN6QixVQUFNLElBQUksRUFBRSxTQUFTLE1BQU0sbUNBQW1DO0FBQzlELFdBQU8sSUFBSSxFQUFFLENBQUMsSUFBSTtBQUFBLEVBQ3BCLFFBQVE7QUFDTixXQUFPO0FBQUEsRUFDVDtBQUNGO0FBRU8sU0FBUyxZQUFZLEtBQUs7QUFDL0IsTUFBSSxNQUFNO0FBQ1YsTUFBSTtBQUFFLFVBQU0sSUFBSSxJQUFJLElBQUksR0FBRztBQUFBLEVBQUcsUUFBUTtBQUFBLEVBQUM7QUFDdkMsU0FBTztBQUFBLElBQ0wsUUFBUSxJQUFJLFVBQVU7QUFBQSxJQUN0QixNQUFNLE1BQU0sSUFBSSxXQUFXO0FBQUEsSUFDM0IsT0FBTyxNQUFNLE9BQU8sWUFBWSxJQUFJLGFBQWEsUUFBUSxDQUFDLElBQUksQ0FBQztBQUFBLElBQy9ELFFBQVEsSUFBSSxRQUFRLElBQUksUUFBUSxLQUFLLElBQUksUUFBUSxJQUFJLFFBQVEsS0FBSztBQUFBLElBQ2xFLFNBQVMsSUFBSSxRQUFRLElBQUksU0FBUyxLQUFLLElBQUksUUFBUSxJQUFJLFNBQVMsS0FBSztBQUFBLElBQ3JFLFlBQVksSUFBSSxRQUFRLElBQUksWUFBWSxLQUFLO0FBQUEsSUFDN0MsSUFBSSxJQUFJLFFBQVEsSUFBSSwyQkFBMkIsS0FBSztBQUFBLElBQ3BELFNBQVMsSUFBSSxRQUFRLElBQUksYUFBYSxLQUFLLElBQUksS0FBSyxLQUFLO0FBQUEsSUFDekQsV0FBVyxJQUFJLFFBQVEsSUFBSSxlQUFlLEtBQUssSUFBSSxLQUFLLEtBQUs7QUFBQSxFQUMvRDtBQUNGO0FBRU8sU0FBUyxlQUFlLEtBQUs7QUFDbEMsUUFBTSxJQUFJLE9BQU8sQ0FBQztBQUNsQixTQUFPO0FBQUEsSUFDTCxNQUFNLFFBQVEsRUFBRSxNQUFNLEdBQUc7QUFBQSxJQUN6QixTQUFTLFFBQVEsRUFBRSxTQUFTLEdBQUk7QUFBQSxJQUNoQyxNQUFNLFFBQVEsRUFBRSxNQUFNLEdBQUc7QUFBQSxJQUN6QixRQUFRLE9BQU8sU0FBUyxFQUFFLE1BQU0sSUFBSSxFQUFFLFNBQVM7QUFBQSxJQUMvQyxNQUFNLFFBQVEsRUFBRSxNQUFNLEdBQUk7QUFBQSxJQUMxQixPQUFPLFFBQVEsRUFBRSxPQUFPLElBQUs7QUFBQSxJQUM3QixVQUFVLEVBQUUsV0FBVztBQUFBLE1BQ3JCLFVBQVUsUUFBUSxFQUFFLFNBQVMsVUFBVSxFQUFFO0FBQUEsTUFDekMsUUFBUSxPQUFPLFNBQVMsRUFBRSxTQUFTLE1BQU0sSUFBSSxFQUFFLFNBQVMsU0FBUztBQUFBLE1BQ2pFLE1BQU0sUUFBUSxFQUFFLFNBQVMsTUFBTSxJQUFLO0FBQUEsTUFDcEMsWUFBWSxRQUFRLEVBQUUsU0FBUyxZQUFZLEdBQUc7QUFBQSxNQUM5QyxrQkFBa0IsRUFBRSxTQUFTLG9CQUFvQjtBQUFBLElBQ25ELElBQUk7QUFBQSxFQUNOO0FBQ0Y7QUE4QkEsZUFBc0IsVUFBVSxJQUFJO0FBQ2xDLE1BQUk7QUFDRixVQUFNLElBQUksTUFBTSxDQUFDO0FBQ2pCLFVBQU0sUUFBUSxFQUFFLFNBQVMsQ0FBQztBQUMxQixVQUFNO0FBQUEsTUFDSjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFRQTtBQUFBLFFBQ0UsUUFBUSxFQUFFLFlBQVksR0FBRztBQUFBLFFBQ3pCLFFBQVEsRUFBRSxTQUFTLFFBQVEsRUFBRTtBQUFBLFFBQzdCLFFBQVEsRUFBRSxRQUFRLFNBQVMsRUFBRTtBQUFBLFFBQzdCLFFBQVEsRUFBRSxpQkFBaUIsV0FBVyxHQUFHO0FBQUEsUUFDekMsUUFBUSxFQUFFLFFBQVEsRUFBRTtBQUFBLFFBQ3BCLFFBQVEsRUFBRSxNQUFNLEdBQUc7QUFBQSxRQUNuQixRQUFRLEVBQUUsUUFBUSxHQUFHO0FBQUEsUUFDckIsUUFBUSxFQUFFLFNBQVMsR0FBRztBQUFBLFFBQ3RCLFFBQVEsRUFBRSxZQUFZLEdBQUc7QUFBQSxRQUN6QixRQUFRLEVBQUUsSUFBSSxHQUFHO0FBQUEsUUFFakIsUUFBUSxFQUFFLFFBQVEsR0FBRztBQUFBLFFBQ3JCLFFBQVEsRUFBRSxVQUFVLEdBQUc7QUFBQSxRQUN2QixPQUFPLFNBQVMsRUFBRSxXQUFXLElBQUksRUFBRSxjQUFjO0FBQUEsUUFDakQsT0FBTyxTQUFTLEVBQUUsVUFBVSxJQUFJLEVBQUUsYUFBYTtBQUFBLFFBQy9DLFFBQVEsRUFBRSxVQUFVLEVBQUU7QUFBQSxRQUN0QixRQUFRLEVBQUUsT0FBTyxHQUFHO0FBQUEsUUFDcEIsT0FBTyxTQUFTLEVBQUUsV0FBVyxJQUFJLEVBQUUsY0FBYztBQUFBLFFBQ2pELE9BQU8sU0FBUyxFQUFFLFdBQVcsSUFBSSxFQUFFLGNBQWM7QUFBQSxRQUVqRCxRQUFRLEVBQUUsWUFBWSxHQUFHO0FBQUEsUUFDekIsUUFBUSxFQUFFLGVBQWUsR0FBSTtBQUFBLFFBQzdCLFFBQVEsRUFBRSxhQUFhLElBQUs7QUFBQSxRQUM1QixPQUFPLFNBQVMsRUFBRSxlQUFlLElBQUksRUFBRSxrQkFBa0I7QUFBQSxRQUN6RCxRQUFRLEVBQUUsZUFBZSxJQUFLO0FBQUEsUUFDOUIsS0FBSyxVQUFVLFNBQVMsQ0FBQyxDQUFDO0FBQUEsTUFDNUI7QUFBQSxJQUNGO0FBQUEsRUFDRixTQUFTLEdBQUc7QUFDVixZQUFRLEtBQUssd0JBQXdCLEdBQUcsV0FBVyxDQUFDO0FBQUEsRUFDdEQ7QUFDRjs7O0FDeklBLFNBQVMsZUFBZSxLQUFLO0FBQzNCLFFBQU0sU0FBUyxLQUFLLFVBQVU7QUFDOUIsUUFBTSxPQUFPLEtBQUssUUFBUTtBQUMxQixRQUFNLFVBQVUsS0FBSyxXQUFXO0FBQ2hDLFFBQU0sT0FBTyxLQUFLO0FBQ2xCLFNBQU8sRUFBRSxRQUFRLE1BQU0sRUFBRSxPQUFPLFNBQVMsTUFBTSxHQUFJLE9BQU8sRUFBRSxLQUFLLElBQUksQ0FBQyxFQUFHLEVBQUU7QUFDN0U7QUFFQSxTQUFTLGNBQWMsS0FBSyxZQUFZO0FBQ3RDLE1BQUk7QUFDRixVQUFNLElBQUksSUFBSSxRQUFRLElBQUksV0FBVyxDQUFDLENBQUM7QUFDdkMsTUFBRSxJQUFJLHNCQUFzQixVQUFVO0FBQ3RDLFdBQU8sSUFBSSxTQUFTLElBQUksTUFBTSxFQUFFLFFBQVEsSUFBSSxRQUFRLFNBQVMsRUFBRSxDQUFDO0FBQUEsRUFDbEUsUUFBUTtBQUNOLFdBQU87QUFBQSxFQUNUO0FBQ0Y7QUFFQSxlQUFlLGdCQUFnQixLQUFLO0FBQ2xDLE1BQUk7QUFDRixVQUFNLE1BQU0sSUFBSSxRQUFRLElBQUksY0FBYyxLQUFLLElBQUksWUFBWTtBQUMvRCxVQUFNLFFBQVEsSUFBSSxNQUFNO0FBQ3hCLFFBQUksR0FBRyxTQUFTLGtCQUFrQixHQUFHO0FBQ25DLFlBQU0sT0FBTyxNQUFNLE1BQU0sS0FBSyxFQUFFLE1BQU0sTUFBTSxJQUFJO0FBQ2hELGFBQU87QUFBQSxJQUNUO0FBQ0EsVUFBTSxJQUFJLE1BQU0sTUFBTSxLQUFLLEVBQUUsTUFBTSxNQUFNLEVBQUU7QUFDM0MsUUFBSSxPQUFPLE1BQU0sWUFBWSxFQUFFLFNBQVMsS0FBTyxRQUFPLEVBQUUsTUFBTSxHQUFHLElBQUssSUFBSSxXQUFNLEVBQUUsU0FBUyxJQUFLO0FBQ2hHLFdBQU87QUFBQSxFQUNULFFBQVE7QUFDTixXQUFPO0FBQUEsRUFDVDtBQUNGO0FBRU8sU0FBUyxLQUFLLFNBQVM7QUFDNUIsU0FBTyxPQUFPLEtBQUssWUFBWTtBQUM3QixVQUFNLFFBQVEsS0FBSyxJQUFJO0FBQ3ZCLFVBQU0sT0FBTyxVQUFVLEdBQUc7QUFDMUIsVUFBTSxhQUFhLGFBQWEsR0FBRztBQUNuQyxVQUFNLGdCQUFnQixrQkFBa0IsR0FBRztBQUMzQyxVQUFNLE9BQU8sWUFBWSxHQUFHO0FBRTVCLFFBQUk7QUFDRixZQUFNLE1BQU0sTUFBTSxRQUFRLEtBQUssTUFBTSxPQUFPO0FBRTVDLFlBQU0sY0FBYyxLQUFLLElBQUksSUFBSTtBQUNqQyxZQUFNLE1BQU0sZUFBZSxXQUFXLGNBQWMsS0FBSyxVQUFVLElBQUk7QUFFdkUsWUFBTSxTQUFTLGVBQWUsV0FBVyxJQUFJLFNBQVM7QUFDdEQsWUFBTSxRQUFRLFVBQVUsTUFBTSxVQUFVLFVBQVUsTUFBTSxTQUFTO0FBQ2pFLFlBQU0sT0FBTyxVQUFVLE1BQU0sd0JBQXdCO0FBRXJELFVBQUksUUFBUSxDQUFDO0FBQ2IsVUFBSSxVQUFVLE9BQU8sZUFBZSxVQUFVO0FBQzVDLGNBQU0sV0FBVyxNQUFNLGdCQUFnQixHQUFHO0FBQUEsTUFDNUM7QUFDQSxVQUFJLGVBQWUsTUFBTztBQUN4QixjQUFNLE9BQU87QUFBQSxNQUNmO0FBRUEsWUFBTSxVQUFVO0FBQUEsUUFDZDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0EsR0FBRztBQUFBLFFBQ0gsYUFBYTtBQUFBLFFBQ2I7QUFBQSxRQUNBO0FBQUEsTUFDRixDQUFDO0FBRUQsYUFBTztBQUFBLElBQ1QsU0FBUyxLQUFLO0FBQ1osWUFBTSxjQUFjLEtBQUssSUFBSSxJQUFJO0FBR2pDLFlBQU0sTUFBTSxlQUFlLEdBQUc7QUFDOUIsWUFBTSxVQUFVO0FBQUEsUUFDZDtBQUFBLFFBQ0EsT0FBTztBQUFBLFFBQ1AsTUFBTTtBQUFBLFFBQ047QUFBQSxRQUNBLEdBQUc7QUFBQSxRQUNILFVBQVUsS0FBSyxVQUFVLFlBQVk7QUFBQSxRQUNyQyxhQUFhLEtBQUssVUFBVTtBQUFBLFFBQzVCO0FBQUEsUUFDQSxZQUFZLEtBQUssUUFBUTtBQUFBLFFBQ3pCLGVBQWUsS0FBSyxXQUFXO0FBQUEsUUFDL0IsYUFBYSxLQUFLLFNBQVM7QUFBQSxRQUMzQixpQkFBaUIsS0FBSyxVQUFVLFVBQVU7QUFBQSxRQUMxQyxlQUFlLEtBQUssVUFBVSxRQUFRO0FBQUEsUUFDdEMsT0FBTyxFQUFFLE9BQU8sSUFBSTtBQUFBLE1BQ3RCLENBQUM7QUFHRCxjQUFRLE1BQU0sbUJBQW1CLEdBQUc7QUFDcEMsWUFBTSxFQUFFLFFBQVEsS0FBSyxJQUFJLGVBQWUsR0FBRztBQUMzQyxhQUFPLEtBQUssUUFBUSxFQUFFLEdBQUcsTUFBTSxXQUFXLEdBQUcsRUFBRSxHQUFHLE1BQU0sc0JBQXNCLFdBQVcsQ0FBQztBQUFBLElBQzVGO0FBQUEsRUFDRjtBQUNGOzs7QUN2R0EsT0FBTyxZQUFZO0FBY1osU0FBUyx1QkFBdUIsRUFBRSxLQUFLLFFBQVEsVUFBVSxHQUFHO0FBQ2pFLFFBQU0sT0FBTyxPQUFPLEtBQUssVUFBVSxDQUFDLENBQUMsRUFBRSxLQUFLO0FBQzVDLE1BQUksT0FBTztBQUNYLGFBQVcsS0FBSyxLQUFNLFNBQVEsS0FBSyxPQUFPLENBQUMsS0FBSztBQUNoRCxRQUFNLElBQUksT0FBTyxXQUFXLFFBQVEsU0FBUyxFQUFFLE9BQU8sTUFBTSxNQUFNLEVBQUUsT0FBTyxRQUFRO0FBQ25GLFNBQU87QUFDVDtBQUVPLFNBQVMsZ0JBQWdCLEdBQUcsR0FBRztBQUNwQyxRQUFNLEtBQUssT0FBTyxLQUFLLE9BQU8sS0FBSyxFQUFFLEdBQUcsTUFBTTtBQUM5QyxRQUFNLEtBQUssT0FBTyxLQUFLLE9BQU8sS0FBSyxFQUFFLEdBQUcsTUFBTTtBQUM5QyxNQUFJLEdBQUcsV0FBVyxHQUFHLE9BQVEsUUFBTztBQUNwQyxTQUFPLE9BQU8sZ0JBQWdCLElBQUksRUFBRTtBQUN0QztBQUVPLFNBQVMsc0JBQXNCLEVBQUUsS0FBSyxLQUFLLE9BQU8sR0FBRztBQUMxRCxRQUFNLFFBQVEsUUFBUSxJQUFJLHFCQUFxQixJQUFJLFNBQVM7QUFDNUQsTUFBSSxDQUFDLEtBQU0sUUFBTyxFQUFFLElBQUksT0FBTyxRQUFRLEtBQUssT0FBTyw0QkFBNEI7QUFFL0UsUUFBTSxNQUFNLElBQUksUUFBUSxJQUFJLG9CQUFvQixLQUFLLElBQUksUUFBUSxJQUFJLG9CQUFvQixLQUFLO0FBQzlGLE1BQUksQ0FBQyxJQUFLLFFBQU8sRUFBRSxJQUFJLE9BQU8sUUFBUSxLQUFLLE9BQU8sNkJBQTZCO0FBRS9FLFFBQU0sV0FBVyx1QkFBdUIsRUFBRSxLQUFLLFFBQVEsV0FBVyxLQUFLLENBQUM7QUFDeEUsUUFBTSxLQUFLLGdCQUFnQixLQUFLLFFBQVE7QUFDeEMsTUFBSSxDQUFDLEdBQUksUUFBTyxFQUFFLElBQUksT0FBTyxRQUFRLEtBQUssT0FBTywyQkFBMkI7QUFDNUUsU0FBTyxFQUFFLElBQUksS0FBSztBQUNwQjtBQUVPLFNBQVMsTUFBTSxTQUFTO0FBQzdCLFNBQU8sSUFBSSxTQUFTLFNBQVM7QUFBQSxJQUMzQixRQUFRO0FBQUEsSUFDUixTQUFTO0FBQUEsTUFDUCxnQkFBZ0I7QUFBQSxNQUNoQixpQkFBaUI7QUFBQSxJQUNuQjtBQUFBLEVBQ0YsQ0FBQztBQUNIO0FBRUEsU0FBUyxVQUFVLEdBQUc7QUFDcEIsU0FBTyxPQUFPLEtBQUssRUFBRSxFQUNsQixRQUFRLE1BQU0sT0FBTyxFQUNyQixRQUFRLE1BQU0sTUFBTSxFQUNwQixRQUFRLE1BQU0sTUFBTSxFQUNwQixRQUFRLE1BQU0sUUFBUSxFQUN0QixRQUFRLE1BQU0sUUFBUTtBQUMzQjtBQUVPLFNBQVMsZUFBZSxFQUFFLEtBQUssV0FBVyxXQUFXLFNBQVMsUUFBUSxTQUFTLFFBQVEsTUFBTSxVQUFVLEVBQUUsR0FBRztBQUNqSCxRQUFNLFVBQVUsVUFBVSxPQUFPLEVBQUU7QUFDbkMsUUFBTSxTQUFTLFVBQVUsU0FBUztBQUNsQyxRQUFNLFdBQVcsUUFBUSxpQkFBaUIsVUFBVSxLQUFLLENBQUMsTUFBTTtBQUNoRSxTQUFPO0FBQUE7QUFBQSxtQ0FFMEIsTUFBTSw0QkFBNEIsT0FBTyxvQ0FBb0MsVUFBVSxRQUFRLENBQUMsSUFBSSxRQUFRO0FBQUEsa0JBQzdILFVBQVUsS0FBSyxDQUFDLEtBQUssT0FBTztBQUFBO0FBQUEsZ0JBRTlCLFVBQVUsS0FBSyxDQUFDO0FBQUEsNEJBQ0osTUFBTTtBQUFBO0FBRWxDO0FBRU8sU0FBUyxZQUFZLEVBQUUsS0FBSyxRQUFRLFNBQVMsV0FBVyxRQUFRLEdBQUc7QUFDeEUsUUFBTSxVQUFVLFVBQVUsT0FBTyxVQUFVO0FBQzNDLFNBQU87QUFBQTtBQUFBLGdCQUVPLFVBQVUsS0FBSyxDQUFDLGVBQWUsVUFBVSxRQUFRLENBQUMsS0FBSyxPQUFPO0FBQUE7QUFBQTtBQUc5RTtBQUVPLFNBQVMsVUFBVSxFQUFFLEtBQUssWUFBWSxRQUFRLFNBQVMsV0FBVyxRQUFRLEdBQUc7QUFDbEYsUUFBTSxVQUFVLFVBQVUsT0FBTyxpQ0FBaUM7QUFDbEUsUUFBTSxNQUFNLFVBQVUsVUFBVTtBQUNoQyxTQUFPO0FBQUE7QUFBQSxnQkFFTyxVQUFVLEtBQUssQ0FBQyxlQUFlLFVBQVUsUUFBUSxDQUFDLEtBQUssT0FBTztBQUFBLFVBQ3BFLEdBQUc7QUFBQTtBQUViOzs7QUN6RkEsZUFBc0IsbUJBQW1CLFVBQVU7QUFDakQsUUFBTSxNQUFNLFlBQVksSUFBSSxTQUFTLEVBQUUsS0FBSztBQUM1QyxNQUFJLENBQUMsR0FBSSxRQUFPO0FBQ2hCLFFBQU0sSUFBSSxNQUFNLEVBQUUsNEVBQTRFLENBQUMsRUFBRSxDQUFDO0FBQ2xHLFNBQU8sRUFBRSxLQUFLLENBQUMsS0FBSztBQUN0QjtBQUVBLGVBQXNCLFdBQVcsRUFBRSxZQUFZLGVBQWUsVUFBVSxTQUFTLFlBQVksVUFBVSxPQUFPLENBQUMsRUFBRSxHQUFHO0FBQ2xILFFBQU0sSUFBSSxNQUFNO0FBQUEsSUFDZDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFLQSxDQUFDLFlBQVksZUFBZSxVQUFVLFNBQVMsY0FBYyxNQUFNLFlBQVksTUFBTSxLQUFLLFVBQVUsUUFBUSxDQUFDLENBQUMsQ0FBQztBQUFBLEVBQ2pIO0FBQ0EsU0FBTyxFQUFFLEtBQUssQ0FBQztBQUNqQjtBQUVBLGVBQXNCLGVBQWUsUUFBUSxNQUFNLFNBQVM7QUFDMUQsUUFBTTtBQUFBLElBQ0o7QUFBQSxJQUNBLENBQUMsUUFBUSxPQUFPLFdBQVcsSUFBSSxTQUFTLENBQUM7QUFBQSxFQUMzQztBQUNGO0FBRUEsZUFBc0Isa0JBQWtCLFFBQVEsUUFBUSxJQUFJO0FBQzFELFFBQU0sSUFBSSxNQUFNO0FBQUEsSUFDZDtBQUFBLElBQ0EsQ0FBQyxRQUFRLEtBQUs7QUFBQSxFQUNoQjtBQUVBLFVBQVEsRUFBRSxRQUFRLENBQUMsR0FBRyxRQUFRO0FBQ2hDOzs7QUNsQ0EsU0FBUyxZQUFZLFNBQVMsTUFBTTtBQUNsQyxRQUFNLE1BQU0sSUFBSSxNQUFNLE9BQU87QUFDN0IsTUFBSSxPQUFPO0FBQ1gsTUFBSSxTQUFTO0FBQ2IsTUFBSSxLQUFNLEtBQUksT0FBTztBQUNyQixTQUFPO0FBQ1Q7QUFHQSxTQUFTLGVBQWUsR0FBRyxNQUFNLE1BQU87QUFDdEMsTUFBSTtBQUNGLFVBQU0sSUFBSSxPQUFPLE1BQU0sV0FBVyxJQUFJLEtBQUssVUFBVSxDQUFDO0FBQ3RELFFBQUksQ0FBQyxFQUFHLFFBQU87QUFDZixRQUFJLEVBQUUsVUFBVSxJQUFLLFFBQU87QUFDNUIsV0FBTyxFQUFFLE1BQU0sR0FBRyxHQUFHLElBQUksV0FBTSxFQUFFLFNBQVMsR0FBRztBQUFBLEVBQy9DLFFBQVE7QUFDTixVQUFNLElBQUksT0FBTyxLQUFLLEVBQUU7QUFDeEIsUUFBSSxFQUFFLFVBQVUsSUFBSyxRQUFPO0FBQzVCLFdBQU8sRUFBRSxNQUFNLEdBQUcsR0FBRyxJQUFJLFdBQU0sRUFBRSxTQUFTLEdBQUc7QUFBQSxFQUMvQztBQUNGO0FBRUEsU0FBUyxjQUFjLFVBQVUsS0FBSyxNQUFNO0FBQzFDLFFBQU0sU0FBUyxLQUFLLFVBQVU7QUFDOUIsUUFBTSxRQUNKLEtBQUssU0FBUyxNQUFNLGNBQWMsS0FDbEMsS0FBSyxTQUFTLE1BQU0sWUFBWSxLQUNoQyxLQUFLLFNBQVMsTUFBTSxrQkFBa0IsS0FDdEM7QUFHRixNQUFJLE1BQU07QUFDVixNQUFJO0FBQ0YsVUFBTSxNQUFNLE9BQU8sV0FBVyxNQUFNLE9BQU8sUUFBUSxNQUFNLFdBQVc7QUFBQSxFQUN0RSxRQUFRO0FBQUEsRUFBQztBQUNULFFBQU0sTUFBTSxJQUFJLE1BQU0sTUFBTSxHQUFHLFFBQVEsbUJBQW1CLE1BQU0sS0FBSyxHQUFHLEtBQUssR0FBRyxRQUFRLG1CQUFtQixNQUFNLEVBQUU7QUFDbkgsTUFBSSxPQUFPO0FBQ1gsTUFBSSxTQUFTO0FBQ2IsTUFBSSxXQUFXO0FBQUEsSUFDYjtBQUFBLElBQ0E7QUFBQSxJQUNBLFlBQVk7QUFBQSxJQUNaLE1BQU0sZUFBZSxJQUFJO0FBQUEsRUFDM0I7QUFDQSxTQUFPO0FBQ1Q7QUFLQSxlQUFzQixXQUFXLEVBQUUsT0FBTyxVQUFVLFlBQVksWUFBWSxHQUFHO0FBQzdFLFFBQU0sU0FBUyxRQUFRLElBQUk7QUFDM0IsTUFBSSxDQUFDLE9BQVEsT0FBTSxZQUFZLGlDQUFpQyw2R0FBbUc7QUFFbkssUUFBTSxRQUFRLE1BQU0sUUFBUSxRQUFRLElBQUksU0FBUyxJQUFJLFFBQU07QUFBQSxJQUN6RCxNQUFNLEVBQUU7QUFBQSxJQUNSLFNBQVMsQ0FBQyxFQUFFLE1BQU0sY0FBYyxNQUFNLE9BQU8sRUFBRSxXQUFXLEVBQUUsRUFBRSxDQUFDO0FBQUEsRUFDakUsRUFBRSxJQUFJLENBQUM7QUFFUCxRQUFNLE9BQU87QUFBQSxJQUNYO0FBQUEsSUFDQTtBQUFBLElBQ0EsYUFBYSxPQUFPLGdCQUFnQixXQUFXLGNBQWM7QUFBQSxJQUM3RCxtQkFBbUIsT0FBTyxlQUFlLFdBQVcsYUFBYTtBQUFBLElBQ2pFLE9BQU87QUFBQSxFQUNUO0FBRUEsUUFBTSxNQUFNLE1BQU0sTUFBTSx1Q0FBdUM7QUFBQSxJQUM3RCxRQUFRO0FBQUEsSUFDUixTQUFTO0FBQUEsTUFDUCxpQkFBaUIsVUFBVSxNQUFNO0FBQUEsTUFDakMsZ0JBQWdCO0FBQUEsSUFDbEI7QUFBQSxJQUNBLE1BQU0sS0FBSyxVQUFVLElBQUk7QUFBQSxFQUMzQixDQUFDO0FBRUQsUUFBTSxPQUFPLE1BQU0sSUFBSSxLQUFLLEVBQUUsTUFBTSxPQUFNLENBQUMsRUFBRTtBQUM3QyxNQUFJLENBQUMsSUFBSSxHQUFJLE9BQU0sY0FBYyxVQUFVLEtBQUssSUFBSTtBQUVwRCxNQUFJLE1BQU07QUFDVixRQUFNLFNBQVMsTUFBTSxRQUFRLEtBQUssTUFBTSxJQUFJLEtBQUssU0FBUyxDQUFDO0FBQzNELGFBQVcsUUFBUSxRQUFRO0FBQ3pCLFFBQUksTUFBTSxTQUFTLGFBQWEsTUFBTSxRQUFRLEtBQUssT0FBTyxHQUFHO0FBQzNELGlCQUFXLEtBQUssS0FBSyxTQUFTO0FBQzVCLFlBQUksR0FBRyxTQUFTLGlCQUFpQixPQUFPLEVBQUUsU0FBUyxTQUFVLFFBQU8sRUFBRTtBQUFBLE1BQ3hFO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFFQSxRQUFNLFFBQVEsS0FBSyxTQUFTLENBQUM7QUFDN0IsU0FBTyxFQUFFLGFBQWEsS0FBSyxjQUFjLE1BQU0sZ0JBQWdCLEdBQUcsZUFBZSxNQUFNLGlCQUFpQixHQUFHLEtBQUssS0FBSztBQUN2SDtBQUVBLGVBQXNCLGNBQWMsRUFBRSxPQUFPLFVBQVUsWUFBWSxZQUFZLEdBQUc7QUFDaEYsUUFBTSxTQUFTLFFBQVEsSUFBSTtBQUMzQixNQUFJLENBQUMsT0FBUSxPQUFNLFlBQVksb0NBQW9DLG1IQUF5RztBQUU1SyxRQUFNLGNBQWMsQ0FBQztBQUNyQixRQUFNLFVBQVUsQ0FBQztBQUVqQixRQUFNLE9BQU8sTUFBTSxRQUFRLFFBQVEsSUFBSSxXQUFXLENBQUM7QUFDbkQsYUFBVyxLQUFLLE1BQU07QUFDcEIsVUFBTSxPQUFPLE9BQU8sRUFBRSxRQUFRLEVBQUUsRUFBRSxZQUFZO0FBQzlDLFVBQU1BLFFBQU8sT0FBTyxFQUFFLFdBQVcsRUFBRTtBQUNuQyxRQUFJLENBQUNBLE1BQU07QUFDWCxRQUFJLFNBQVMsWUFBWSxTQUFTLFlBQWEsYUFBWSxLQUFLQSxLQUFJO0FBQUEsYUFDM0QsU0FBUyxZQUFhLFNBQVEsS0FBSyxFQUFFLE1BQU0sYUFBYSxTQUFTQSxNQUFLLENBQUM7QUFBQSxRQUMzRSxTQUFRLEtBQUssRUFBRSxNQUFNLFFBQVEsU0FBU0EsTUFBSyxDQUFDO0FBQUEsRUFDbkQ7QUFFQSxRQUFNLE9BQU87QUFBQSxJQUNYO0FBQUEsSUFDQSxZQUFZLE9BQU8sZUFBZSxXQUFXLGFBQWE7QUFBQSxJQUMxRCxhQUFhLE9BQU8sZ0JBQWdCLFdBQVcsY0FBYztBQUFBLElBQzdELFVBQVU7QUFBQSxFQUNaO0FBQ0EsTUFBSSxZQUFZLE9BQVEsTUFBSyxTQUFTLFlBQVksS0FBSyxNQUFNO0FBRS9ELFFBQU0sTUFBTSxNQUFNLE1BQU0seUNBQXlDO0FBQUEsSUFDN0QsUUFBUTtBQUFBLElBQ1IsU0FBUztBQUFBLE1BQ1AsYUFBYTtBQUFBLE1BQ2IscUJBQXFCO0FBQUEsTUFDckIsZ0JBQWdCO0FBQUEsSUFDbEI7QUFBQSxJQUNBLE1BQU0sS0FBSyxVQUFVLElBQUk7QUFBQSxFQUMzQixDQUFDO0FBRUQsUUFBTSxPQUFPLE1BQU0sSUFBSSxLQUFLLEVBQUUsTUFBTSxPQUFNLENBQUMsRUFBRTtBQUM3QyxNQUFJLENBQUMsSUFBSSxHQUFJLE9BQU0sY0FBYyxhQUFhLEtBQUssSUFBSTtBQUV2RCxRQUFNLE9BQU8sTUFBTSxRQUFRLE1BQU0sT0FBTyxJQUFJLEtBQUssUUFBUSxJQUFJLE9BQUssR0FBRyxRQUFRLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSyxNQUFNLFVBQVUsQ0FBQyxHQUFHLFFBQVEsTUFBTSxjQUFjO0FBQzdJLFFBQU0sUUFBUSxNQUFNLFNBQVMsQ0FBQztBQUM5QixTQUFPLEVBQUUsYUFBYSxNQUFNLGNBQWMsTUFBTSxnQkFBZ0IsR0FBRyxlQUFlLE1BQU0saUJBQWlCLEdBQUcsS0FBSyxLQUFLO0FBQ3hIO0FBRUEsZUFBc0IsV0FBVyxFQUFFLE9BQU8sVUFBVSxZQUFZLFlBQVksR0FBRztBQUM3RSxRQUFNLFlBQVksUUFBUSxJQUFJLHdCQUF3QixRQUFRLElBQUk7QUFDbEUsUUFBTSxTQUFTLE9BQU8sYUFBYSxFQUFFLEVBQ2xDLEtBQUssRUFDTCxRQUFRLFlBQVksSUFBSSxFQUN4QixLQUFLO0FBQ1IsTUFBSSxDQUFDLE9BQVEsT0FBTSxZQUFZLGlDQUFpQyxnSUFBc0g7QUFFdEwsUUFBTSxjQUFjLENBQUM7QUFDckIsUUFBTSxXQUFXLENBQUM7QUFFbEIsUUFBTSxPQUFPLE1BQU0sUUFBUSxRQUFRLElBQUksV0FBVyxDQUFDO0FBQ25ELGFBQVcsS0FBSyxNQUFNO0FBQ3BCLFVBQU0sT0FBTyxFQUFFO0FBQ2YsVUFBTSxPQUFPLE9BQU8sRUFBRSxXQUFXLEVBQUU7QUFDbkMsUUFBSSxTQUFTLFNBQVUsYUFBWSxLQUFLLElBQUk7QUFBQSxhQUNuQyxTQUFTLFlBQWEsVUFBUyxLQUFLLEVBQUUsTUFBTSxTQUFTLE9BQU8sQ0FBQyxFQUFFLEtBQUssQ0FBQyxFQUFFLENBQUM7QUFBQSxRQUM1RSxVQUFTLEtBQUssRUFBRSxNQUFNLFFBQVEsT0FBTyxDQUFDLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQztBQUFBLEVBQ3hEO0FBRUEsUUFBTSxPQUFPO0FBQUEsSUFDWDtBQUFBLElBQ0Esa0JBQWtCO0FBQUEsTUFDaEIsaUJBQWlCLE9BQU8sZUFBZSxXQUFXLGFBQWE7QUFBQSxNQUMvRCxhQUFhLE9BQU8sZ0JBQWdCLFdBQVcsY0FBYztBQUFBLElBQy9EO0FBQUEsRUFDRjtBQUNBLE1BQUksWUFBWSxPQUFRLE1BQUssb0JBQW9CLEVBQUUsT0FBTyxDQUFDLEVBQUUsTUFBTSxZQUFZLEtBQUssTUFBTSxFQUFFLENBQUMsRUFBRTtBQUUvRixRQUFNLE1BQU0sMkRBQTJELG1CQUFtQixLQUFLLENBQUM7QUFDaEcsUUFBTSxNQUFNLE1BQU0sTUFBTSxLQUFLO0FBQUEsSUFDM0IsUUFBUTtBQUFBLElBQ1IsU0FBUyxFQUFFLGtCQUFrQixRQUFRLGdCQUFnQixtQkFBbUI7QUFBQSxJQUN4RSxNQUFNLEtBQUssVUFBVSxJQUFJO0FBQUEsRUFDM0IsQ0FBQztBQUVELFFBQU0sT0FBTyxNQUFNLElBQUksS0FBSyxFQUFFLE1BQU0sT0FBTSxDQUFDLEVBQUU7QUFDN0MsTUFBSSxDQUFDLElBQUksR0FBSSxPQUFNLGNBQWMsVUFBVSxLQUFLLElBQUk7QUFFcEQsTUFBSSxNQUFNO0FBQ1YsUUFBTSxhQUFhLE1BQU0sUUFBUSxLQUFLLFVBQVUsSUFBSSxLQUFLLGFBQWEsQ0FBQztBQUN2RSxhQUFXLFFBQVEsWUFBWTtBQUM3QixVQUFNLFVBQVUsTUFBTTtBQUN0QixRQUFJLFNBQVM7QUFBTyxpQkFBVyxLQUFLLFFBQVEsTUFBTyxLQUFJLE9BQU8sRUFBRSxTQUFTLFNBQVUsUUFBTyxFQUFFO0FBQUE7QUFDNUYsUUFBSSxJQUFLO0FBQUEsRUFDWDtBQUVBLFFBQU0sUUFBUSxLQUFLLGlCQUFpQixDQUFDO0FBQ3JDLFNBQU8sRUFBRSxhQUFhLEtBQUssY0FBYyxNQUFNLG9CQUFvQixHQUFHLGVBQWUsTUFBTSx3QkFBd0IsR0FBRyxLQUFLLEtBQUs7QUFDbEk7OztBQ3RMQSxTQUFTLFNBQVMsR0FBRyxNQUFNLE1BQU07QUFDL0IsUUFBTSxLQUFLLEtBQUssSUFBSSxTQUFTLEVBQUUsS0FBSztBQUNwQyxTQUFPLEVBQUUsU0FBUyxNQUFNLEVBQUUsTUFBTSxHQUFHLEdBQUcsSUFBSSxXQUFNO0FBQ2xEO0FBRUEsU0FBUyxrQkFBa0IsSUFBSSxNQUFNLElBQUk7QUFDdkMsUUFBTSxLQUFLLEdBQUcsWUFBWSxDQUFDO0FBQzNCLFFBQU0sT0FBTyxHQUFHLGlCQUFpQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBU2pDLFFBQU0sVUFBVSxHQUFHLFdBQVcsQ0FBQztBQUMvQixRQUFNLEtBQUssR0FBRyxZQUFZO0FBRTFCLFNBQU8sR0FBRyxJQUFJO0FBQUE7QUFBQTtBQUFBLHdCQUdRLEdBQUcsV0FBVztBQUFBLG1CQUNuQixFQUFFO0FBQUEsbUJBQ0YsSUFBSTtBQUFBLGNBQ1QsRUFBRTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFNaEI7QUFFQSxlQUFlLE9BQU8sRUFBRSxVQUFVLE9BQU8sU0FBUyxHQUFHO0FBQ25ELE1BQUksYUFBYSxTQUFVLFFBQU8sTUFBTSxXQUFXLEVBQUUsT0FBTyxTQUFTLENBQUM7QUFDdEUsTUFBSSxhQUFhLFlBQWEsUUFBTyxNQUFNLGNBQWMsRUFBRSxPQUFPLFNBQVMsQ0FBQztBQUM1RSxNQUFJLGFBQWEsU0FBVSxRQUFPLE1BQU0sV0FBVyxFQUFFLE9BQU8sU0FBUyxDQUFDO0FBQ3RFLFFBQU0sTUFBTSxJQUFJLE1BQU0sc0JBQXNCO0FBQzVDLE1BQUksU0FBUztBQUNiLFFBQU07QUFDUjtBQUVBLElBQU8sNEJBQVEsS0FBSyxPQUFPLFFBQVE7QUFDakMsUUFBTSxXQUFXLE1BQU0sSUFBSSxLQUFLO0FBQ2hDLFFBQU0sU0FBUyxPQUFPLFlBQVksSUFBSSxnQkFBZ0IsUUFBUSxDQUFDO0FBRS9ELFFBQU0sTUFBTSxJQUFJLElBQUksSUFBSSxHQUFHO0FBQzNCLFFBQU0sVUFBVSxJQUFJLFNBQVM7QUFFN0IsUUFBTSxJQUFJLHNCQUFzQixFQUFFLEtBQUssS0FBSyxTQUFTLE9BQU8sQ0FBQztBQUM3RCxNQUFJLENBQUMsRUFBRSxHQUFJLFFBQU8sSUFBSSxTQUFTLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxVQUFVLEtBQUssU0FBUyxFQUFFLGdCQUFnQixhQUFhLEVBQUUsQ0FBQztBQUU5RyxRQUFNLFVBQVUsT0FBTyxXQUFXLE9BQU87QUFDekMsUUFBTSxPQUFPLE9BQU8sUUFBUTtBQUM1QixRQUFNLEtBQUssT0FBTyxNQUFNO0FBQ3hCLFFBQU0sU0FBUyxPQUFPLGdCQUFnQixPQUFPLGdCQUFnQjtBQUM3RCxNQUFJLENBQUMsV0FBVyxDQUFDLEdBQUksUUFBTyxJQUFJLFNBQVMsc0JBQXNCLEVBQUUsUUFBUSxJQUFJLENBQUM7QUFFOUUsUUFBTSxLQUFLLE1BQU0sbUJBQW1CLEVBQUU7QUFDdEMsTUFBSSxDQUFDLEdBQUksUUFBTyxNQUFNLHNIQUFzSDtBQUU1SSxRQUFNLE9BQU8sTUFBTSxXQUFXO0FBQUEsSUFDNUIsWUFBWSxHQUFHO0FBQUEsSUFDZixlQUFlLEdBQUc7QUFBQSxJQUNsQixVQUFVO0FBQUEsSUFDVjtBQUFBLElBQ0EsWUFBWTtBQUFBLElBQ1osVUFBVTtBQUFBLElBQ1YsTUFBTSxFQUFFLFFBQVEsRUFBRSxhQUFhLE9BQU8sY0FBYyxLQUFLLEVBQUU7QUFBQSxFQUM3RCxDQUFDO0FBRUQsUUFBTSxZQUFZLFNBQVMsVUFBVSxFQUFFO0FBQ3ZDLE1BQUksVUFBVyxPQUFNLGVBQWUsS0FBSyxJQUFJLFFBQVEsU0FBUztBQUU5RCxRQUFNLFNBQVMsTUFBTSxrQkFBa0IsS0FBSyxJQUFJLEVBQUU7QUFFbEQsUUFBTSxTQUFTLGtCQUFrQixJQUFJLE1BQU0sRUFBRTtBQUM3QyxRQUFNLFdBQVc7QUFBQSxJQUNmLEVBQUUsTUFBTSxVQUFVLFNBQVMsT0FBTztBQUFBLElBQ2xDLEdBQUcsT0FBTyxJQUFJLFFBQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxTQUFTLEVBQUUsUUFBUSxFQUFFO0FBQUEsRUFDM0Q7QUFFQSxRQUFNLFlBQVksR0FBRyx3QkFBd0IsVUFBVSxTQUFTLEVBQUUsWUFBWTtBQUM5RSxRQUFNLFNBQVMsR0FBRyxxQkFBcUIsZ0JBQWdCLFNBQVM7QUFFaEUsTUFBSSxZQUFZO0FBQ2hCLE1BQUk7QUFDRixVQUFNLE1BQU0sTUFBTSxPQUFPLEVBQUUsVUFBVSxPQUFPLFNBQVMsQ0FBQztBQUN0RCxnQkFBYSxPQUFPLElBQUksT0FBUSxPQUFPLElBQUksSUFBSSxJQUFJO0FBQUEsRUFDckQsU0FBUyxHQUFHO0FBQ1YsZ0JBQVk7QUFDWixpQkFBYTtBQUFBLEVBQ2Y7QUFHQSxRQUFNLFFBQVEsVUFBVSxNQUFNLE9BQU8sRUFBRSxJQUFJLE9BQUssRUFBRSxLQUFLLENBQUMsRUFBRSxPQUFPLE9BQU87QUFDeEUsUUFBTSxjQUFjLE1BQU0sU0FBUyxhQUFhO0FBQ2hELFFBQU0sU0FBUyxNQUFNLFNBQVMsYUFBYTtBQUMzQyxRQUFNLFFBQVEsVUFBVSxRQUFRLHlCQUF5QixJQUFJLEVBQUUsUUFBUSx5QkFBeUIsSUFBSSxFQUFFLEtBQUs7QUFFM0csUUFBTSxlQUFlLEtBQUssSUFBSSxhQUFhLFNBQVMsT0FBTyxHQUFJLENBQUM7QUFFaEUsUUFBTSxZQUFZLElBQUksSUFBSSx5Q0FBeUMsSUFBSSxNQUFNLEVBQUUsU0FBUztBQUV4RixNQUFJLGFBQWE7QUFDZixVQUFNLGlCQUFrQixHQUFHLFlBQVksR0FBRyxTQUFTLGtCQUFtQixPQUFPLEdBQUcsU0FBUyxlQUFlLElBQUssUUFBUSxJQUFJLGtDQUFrQztBQUMzSixRQUFJLENBQUMsZ0JBQWdCO0FBQ25CLGFBQU8sTUFBTSxlQUFlO0FBQUEsUUFDMUIsS0FBSyxRQUFRO0FBQUEsUUFDYjtBQUFBLFFBQ0EsVUFBVSxHQUFHLFVBQVU7QUFBQSxRQUN2QixPQUFPO0FBQUEsTUFDVCxDQUFDLENBQUM7QUFBQSxJQUNKO0FBQ0EsV0FBTyxNQUFNLFVBQVUsRUFBRSxLQUFLLFNBQVMsdUJBQXVCLFlBQVksZ0JBQWdCLE9BQU8sU0FBUyxVQUFVLEdBQUcsVUFBVSxRQUFRLENBQUMsQ0FBQztBQUFBLEVBQzdJO0FBRUEsTUFBSSxRQUFRO0FBQ1YsV0FBTyxNQUFNLFlBQVksRUFBRSxLQUFLLFNBQVMsWUFBWSxPQUFPLFNBQVMsVUFBVSxHQUFHLFVBQVUsUUFBUSxDQUFDLENBQUM7QUFBQSxFQUN4RztBQUVBLFNBQU8sTUFBTSxlQUFlO0FBQUEsSUFDMUIsS0FBSztBQUFBLElBQ0w7QUFBQSxJQUNBLFVBQVUsR0FBRyxVQUFVO0FBQUEsSUFDdkIsT0FBTztBQUFBLEVBQ1QsQ0FBQyxDQUFDO0FBQ0osQ0FBQzsiLAogICJuYW1lcyI6IFsidGV4dCJdCn0K
